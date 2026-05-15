import { Notice, Plugin, TFile, normalizePath } from 'obsidian';
import {
  AutoDownloadSettings,
  AutoDownloadSettingTab,
  DEFAULT_SETTINGS,
  TranslationMap,
  TRANSLATIONS,
  detectObsidianLang,
} from './settings';

// ─── 正则 / Regexes ────────────────────────────────────────────────────────

// Markdown 图片：![alt](https://...) 及带 title 变体 ![alt](https://... "title")
// Markdown image: ![alt](https://...) and with optional title variant
const MD_IMAGE_REGEX = /!\[([^\]]*)\]\((https?:\/\/[^\s)"']+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;

// HTML img 标签：<img src="https://..."> 或 <img src='https://...'>（属性顺序不限）
// HTML img tag: <img src="https://..."> or <img src='https://...'> (attributes in any order)
const HTML_IMG_REGEX = /<img\s[^>]*\bsrc=(?:"(https?:\/\/[^"]+)"|'(https?:\/\/[^']+)')[^>]*>/gi;

// 最小文件大小：小于此值视为追踪像素，直接跳过（1 KB）
// Minimum file size: files below this threshold are treated as tracking pixels and skipped (1 KB)
const MIN_IMAGE_BYTES = 1024;

// 下载失败后的重试间隔毫秒数 | Retry interval in milliseconds for failed downloads
const RETRY_DELAY_MS = 1500;

// 同时下载图片的最大并发数 | Maximum number of concurrent image downloads
const DOWNLOAD_CONCURRENCY = 3;

// HTTP 重定向最大跟随次数 | Maximum number of redirect hops to follow
const MAX_REDIRECTS = 5;

// https 请求超时毫秒数 | https request timeout in milliseconds
const HTTPS_TIMEOUT_MS = 15000;

// 默认扩展名和下载失败哨兵值 | Default extension and download failure sentinel value
const DEFAULT_EXT = '.jpg';
const FAILED_DOWNLOAD = { buffer: null as ArrayBuffer | null, ext: DEFAULT_EXT };

// MIME 类型到文件扩展名的映射表 | Map from MIME type to file extension
const MIME_EXT_MAP: Record<string, string> = {
  'image/jpeg':    '.jpg',
  'image/png':     '.png',
  'image/gif':     '.gif',
  'image/webp':    '.webp',
  'image/svg+xml': '.svg',
  'image/avif':    '.avif',
  'image/bmp':     '.bmp',
};

// 从 URL 推断扩展名的正则，与 MIME_EXT_MAP 的值保持同步
// Regex for inferring extension from URL, kept in sync with MIME_EXT_MAP values
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp'];
const URL_EXT_REGEX = new RegExp(`\\.(${IMAGE_EXTS.join('|')})$`, 'i');

// ─── 工具函数 / Utility functions ──────────────────────────────────────────

// 根据 useMarkdownLinks 生成最终的图片引用字符串（遵循 Obsidian「文件与链接」设置）
// Generate image reference string based on useMarkdownLinks (follows Obsidian "Files & Links" setting)
function formatImageLink(destPath: string, alt: string, useMarkdownLinks: boolean): string {
  return useMarkdownLinks
    ? `![${alt}](<${destPath}>)`
    : `![[${destPath}]]`;
}

// 为带链接的图片生成最终引用格式：[![alt](img)](link) 的替换
// 在 wikilink 模式下丢弃外层链接（wikilink 不支持嵌套在 markdown 链接中），markdown 模式下保留
// Generate final reference for linked images: replacement for [![alt](img)](link)
// In wikilink mode, discard outer link (wikilink can't be nested in markdown links); preserve in markdown mode
function formatLinkedImageLink(destPath: string, alt: string, linkUrl: string, useMarkdownLinks: boolean): string {
  return useMarkdownLinks
    ? `[![${alt}](<${destPath}>)](${linkUrl})`
    : `![[${destPath}]]`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => window.setTimeout(r, ms));
}

function parseFolders(raw: string): string[] {
  return raw
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    || 'attachments';
}

/**
 * 以有限并发度运行异步任务列表，返回与入参顺序一致的结果数组
 * Run async tasks with a concurrency limit; returns results in the same order as input
 */
async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array<T>(tasks.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]!();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker)
  );
  return results;
}

// 从 frontmatter 的 source 字段提取网页来源 URL 作为 Referer
// Extract source page URL from frontmatter's 'source' field to use as Referer
function extractRefererFromFrontmatter(frontmatter: Record<string, unknown> | undefined | null): string | undefined {
  if (!frontmatter) return undefined;
  const value = frontmatter['source'];
  if (typeof value === 'string' && /^https?:\/\//.test(value)) {
    return value.trim();
  }
  return undefined;
}

// ─── 主插件 / Main plugin ──────────────────────────────────────────────────

export default class AutoDownloadAttachmentsPlugin extends Plugin {
  settings: AutoDownloadSettings;

  // 正在处理的文件路径锁，防止同一文件被并发处理
  // Lock set for files being processed, preventing concurrent processing of the same file
  private processingFiles: Set<string>;

  // 本次会话内下载失败/跳过的 URL 黑名单，避免反复重试
  // Session-level blacklist of failed/skipped URLs to avoid repeated retries
  private failedUrls: Set<string>;

  // 每个文件的防抖计时器 | Debounce timers per file
  private debounceTimers: Map<string, number>;

  // 缓存的已解析语言 | Cached resolved language
  _resolvedLang: string;

  // 缓存的监听文件夹列表 | Cached watched folders list
  _watchedFolders: string[];

  // 缓存的 Obsidian「使用 Wiki 链接」设置 | Cached Obsidian "Use Wiki Links" setting
  _useMarkdownLinks: boolean;

  // 缓存的 User-Agent（复用 Obsidian 自带的 UA）
  // Cached User-Agent (reuses Obsidian's own UA)
  _userAgent: string = '';

  // 缓存的 Node.js https 模块引用（仅桌面端可用）
  // Cached Node.js https module reference (desktop only)
  private _httpsModule: any = null;

  get t(): TranslationMap {
    return TRANSLATIONS[this._resolvedLang] ?? TRANSLATIONS['en']!;
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new AutoDownloadSettingTab(this.app, this));

    this.processingFiles = new Set();
    this.failedUrls = new Set();
    this.debounceTimers = new Map();

    // 缓存 https 模块（仅 Electron 桌面端可用）
    // Cache https module (only available in Electron desktop)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this._httpsModule = (window as any).require('https');
    } catch {
      this._httpsModule = null;
    }

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile)) return;
        if (!file.path.endsWith('.md')) return;
        if (!this.isWatched(file.path)) return;

        // 防抖：每次修改都重置计时器，静止 delayMs 后才真正触发
        // Debounce: reset timer on every modification, trigger only after delayMs of inactivity
        if (this.debounceTimers.has(file.path)) {
          window.clearTimeout(this.debounceTimers.get(file.path));
        }
        const timer = window.setTimeout(() => {
          this.debounceTimers.delete(file.path);
          void this.downloadImagesInFile(file);
        }, this.settings.delayMs);
        this.debounceTimers.set(file.path, timer);
      })
    );

    const folders = this._watchedFolders.join(', ');
    console.debug(this.t.consoleLoaded(folders));
  }

  onunload(): void {
    for (const timer of this.debounceTimers.values()) window.clearTimeout(timer);
    this.debounceTimers.clear();
  }

  isWatched(filePath: string): boolean {
    return this._watchedFolders.some(folder => {
      const prefix = folder.endsWith('/') ? folder : folder + '/';
      return filePath.startsWith(prefix);
    });
  }

  resolveAttachmentFolder(file: TFile): string {
    const { attachmentPathMode, customAttachmentFolder } = this.settings;
    const fileDir = file.parent?.path ?? '';

    switch (attachmentPathMode) {
      case 'obsidian': {
        const vaultWithConfig = this.app.vault as typeof this.app.vault & { getConfig(key: string): unknown };
        const setting = (vaultWithConfig.getConfig('attachmentFolderPath') as string | undefined) ?? 'attachments';
        if (setting === '/') return normalizePath('/');
        if (setting.startsWith('./')) {
          return normalizePath(`${fileDir}/${setting.slice(2)}`);
        }
        return normalizePath(setting);
      }
      case 'custom': {
        const subFolder = (customAttachmentFolder || 'attachments').trim();
        return normalizePath(`${fileDir}/${subFolder}`);
      }
      case 'samename': {
        const safeName = sanitizeFolderName(file.basename);
        return normalizePath(`${fileDir}/${safeName}`);
      }
      default:
        return normalizePath('attachments');
    }
  }

  async downloadImagesInFile(file: TFile): Promise<void> {
    if (this.processingFiles.has(file.path)) return;
    this.processingFiles.add(file.path);

    const t = this.t;

    try {
      let content: string;
      try {
        content = await this.app.vault.read(file);
      } catch (err) {
        console.error(t.consoleReadError, err);
        return;
      }

      const mdMatches   = [...content.matchAll(MD_IMAGE_REGEX)];
      const htmlMatches = [...content.matchAll(HTML_IMG_REGEX)];
      if (mdMatches.length === 0 && htmlMatches.length === 0) return;

      const cachedMetadata = this.app.metadataCache.getFileCache(file);
      const pageReferer = extractRefererFromFrontmatter(cachedMetadata?.frontmatter);

      if (pageReferer) {
        console.debug(t.consoleRefererResolved(pageReferer));
      } else {
        console.debug(t.consoleRefererFallback);
      }

      const allUrls = [
        ...mdMatches.map(m => m[2]),
        ...htmlMatches.map(m => m[1] ?? m[2]),
      ].filter((u): u is string => Boolean(u));
      const uniqueUrls = [...new Set(allUrls)].filter(u => !this.failedUrls.has(u));
      if (uniqueUrls.length === 0) return;

      const attachmentFolder = this.resolveAttachmentFolder(file);
      await this.ensureFolder(attachmentFolder);

      const titleBase = file.basename
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]/g, '_');

      const urlToLocal = new Map<string, string>();
      const failedUrls: string[]  = [];
      let savedCount = 1;

      const downloadResults = await runWithConcurrency(
        uniqueUrls.map(url => async () => {
          const result = await this.downloadImage(url, pageReferer);
          return { url, ...result };
        }),
        DOWNLOAD_CONCURRENCY
      );

      for (const { url, buffer, ext } of downloadResults) {
        if (!buffer) {
          this.failedUrls.add(url);
          failedUrls.push(url);
          console.warn(t.consoleKeepOriginal(url));
          continue;
        }

        const rawName = `${titleBase}-${savedCount}${ext}`
          .replace(/\s+/g, '-')
          .replace(/[\\:*?"<>|]/g, '_');
        const destPath = await this.resolveDestPath(attachmentFolder, rawName);

        try {
          await this.app.vault.adapter.writeBinary(destPath, buffer);
          urlToLocal.set(url, destPath);
          savedCount++;
        } catch (err) {
          this.failedUrls.add(url);
          failedUrls.push(url);
          console.error(t.consoleWriteFailed(destPath, err));
        }
      }

      if (urlToLocal.size > 0) {
        const useMarkdownLinks = this._useMarkdownLinks;
        try {
          await this.app.vault.process(file, (currentContent) => {
            let updated = currentContent;
            for (const [url, destPath] of urlToLocal) {
              const urlEscaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              const linkedMdRe = new RegExp(
                `\\[!\\[([^\\]]*)\\]\\(${urlEscaped}(?:\\s+(?:"[^"]*"|'[^']*'))?\\)\\]\\(([^)]+)\\)`,
                'g'
              );
              updated = updated.replace(linkedMdRe, (_, alt: string, linkUrl: string) =>
                formatLinkedImageLink(destPath, alt, linkUrl, useMarkdownLinks)
              );

              const mdRe = new RegExp(
                `!\\[([^\\]]*)\\]\\(${urlEscaped}(?:\\s+(?:"[^"]*"|'[^']*'))?\\)`,
                'g'
              );
              updated = updated.replace(mdRe, (_, alt: string) =>
                formatImageLink(destPath, alt, useMarkdownLinks)
              );

              const htmlRe = new RegExp(
                `<img\\s[^>]*\\bsrc=(?:"${urlEscaped}"|'${urlEscaped}')[^>]*>`,
                'gi'
              );
              updated = updated.replace(htmlRe, (fullTag: string) => {
                const altMatch = fullTag.match(/\balt=(?:"([^"]*)"|'([^']*)')/i);
                const alt = altMatch ? (altMatch[1] ?? altMatch[2] ?? '') : '';
                return formatImageLink(destPath, alt, useMarkdownLinks);
              });
            }
            return updated;
          });
        } catch (err) {
          console.error(t.consoleWriteBackError, err);
          new Notice(t.noticeWriteError(file.basename));
          return;
        }
      }

      const successCount = urlToLocal.size;
      if (failedUrls.length === 0 && successCount > 0) {
        new Notice(t.noticeSuccess(successCount, file.basename));
      } else if (failedUrls.length > 0) {
        new Notice(t.noticePartial(successCount, failedUrls.length, file.basename), 8000);
        console.warn(t.consoleFailedUrls + '\n' + failedUrls.join('\n'));
      }

    } finally {
      this.processingFiles.delete(file.path);
    }
  }

  // ── 下载方法 / Download methods ──────────────────────────────────────────

  async downloadImage(url: string, pageReferer?: string): Promise<{ buffer: ArrayBuffer | null; ext: string }> {
    if (!this._httpsModule) return FAILED_DOWNLOAD;

    const t = this.t;
    const imageOrigin = new URL(url).origin;

    const referersToTry: string[] = pageReferer && pageReferer !== imageOrigin
      ? [pageReferer, imageOrigin]
      : [pageReferer ?? imageOrigin];

    return this._tryReferers(this._httpsModule, url, referersToTry, 3, t);
  }

  private async _tryReferers(
    https: any,
    url: string,
    referersToTry: string[],
    maxRetries: number,
    t: TranslationMap,
  ): Promise<{ buffer: ArrayBuffer | null; ext: string }> {
    for (const referer of referersToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await this._httpsGet(https, url, referer);

        switch (result.type) {
          case 'success':
            return this.validateResponse(result.buffer, result.contentType, url);

          case 'non-403-4xx':
            console.warn(t.console4xx(result.status, url));
            return FAILED_DOWNLOAD;

          case '403':
            console.warn(t.console4xx(403, url));
            break;

          case 'network-error':
          case 'too-many-redirects':
            if (attempt === maxRetries) {
              console.warn(t.consoleGiveUp(attempt, url, result.error!));
              break;
            }
            console.warn(t.consoleRetry(attempt, RETRY_DELAY_MS, url, result.error!));
            await sleep(RETRY_DELAY_MS);
            continue;
        }
        break;
      }
    }

    return FAILED_DOWNLOAD;
  }

  private _httpsGet(
    https: any,
    url: string,
    referer: string,
  ): Promise<{ type: 'success'; buffer: ArrayBuffer; contentType: string } | { type: '403' | 'non-403-4xx'; status: number } | { type: 'network-error' | 'too-many-redirects'; error?: string }> {
    return new Promise((resolve) => {
      let currentUrl = url;
      let hops = 0;

      const makeRequest = (requestUrl: string): void => {
        const parsedUrl = new URL(requestUrl);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET' as const,
          headers: {
            'Referer':    referer,
            'User-Agent': this._userAgent,
            'Accept':     'image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8',
          },
          timeout: HTTPS_TIMEOUT_MS,
        };

        const req = https.get(options, (res: any) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (hops >= MAX_REDIRECTS) {
              resolve({ type: 'too-many-redirects' });
              return;
            }
            hops++;
            currentUrl = new URL(res.headers.location, currentUrl).toString();
            makeRequest(currentUrl);
            return;
          }

          if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500) {
            resolve({ type: res.statusCode === 403 ? '403' : 'non-403-4xx', status: res.statusCode });
            return;
          }

          if (!res.statusCode || res.statusCode >= 300) {
            resolve({ type: 'network-error', error: `HTTP ${res.statusCode}` });
            return;
          }

          const contentType = res.headers['content-type'] ?? '';
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => { chunks.push(chunk); });

          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
            resolve({ type: 'success', buffer: arrayBuffer, contentType });
          });
        });

        req.on('error', (err: Error) => {
          resolve({ type: 'network-error', error: err.message });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ type: 'network-error', error: 'Request timeout' });
        });
      };

      makeRequest(url);
    });
  }

  private validateResponse(rawBuffer: ArrayBuffer, contentType: string, url: string): { buffer: ArrayBuffer | null; ext: string } {
    const t = this.t;

    const isImage  = contentType.startsWith('image/');
    const isBinary = contentType.includes('application/octet-stream') || contentType === '';
    if (!isImage && !isBinary) {
      console.warn(t.consoleSkipNonImage(contentType, url));
      return FAILED_DOWNLOAD;
    }

    if (rawBuffer.byteLength < MIN_IMAGE_BYTES) {
      console.warn(t.consoleSkipTooSmall(rawBuffer.byteLength, url));
      return FAILED_DOWNLOAD;
    }

    const ext = this.extFromContentType(contentType) ?? this.extractExt(url);
    return { buffer: rawBuffer, ext };
  }

  extFromContentType(contentType: string): string | null {
    const mimeKey = contentType.split(';')[0]?.trim() ?? '';
    return MIME_EXT_MAP[mimeKey] ?? null;
  }

  // 解析目标路径，若同名文件已存在则追加 (2)、(3)… 后缀
  // Resolve destination path, appending (2), (3)... if a file with the same name exists
  async resolveDestPath(folder: string, baseName: string): Promise<string> {
    let candidate = normalizePath(`${folder}/${baseName}`);
    if (!await this.app.vault.adapter.exists(candidate)) return candidate;

    const ext  = baseName.match(/\.[^.]+$/)?.[0] ?? '';
    const stem = baseName.slice(0, baseName.length - ext.length);
    for (let counter = 2; counter <= 99; counter++) {
      candidate = normalizePath(`${folder}/${stem}(${counter})${ext}`);
      if (!await this.app.vault.adapter.exists(candidate)) return candidate;
    }
    return normalizePath(`${folder}/${stem}(${Date.now()})${ext}`);
  }

  async ensureFolder(folderPath: string): Promise<void> {
    if (!folderPath || folderPath === '/') return;
    if (await this.app.vault.adapter.exists(folderPath)) return;

    const parts = folderPath.split('/').filter(p => p);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!await this.app.vault.adapter.exists(current)) {
        try {
          await this.app.vault.createFolder(current);
        } catch (err) {
          if (!await this.app.vault.adapter.exists(current)) throw err;
        }
      }
    }
  }

  extractExt(url: string): string {
    const parts = url.split('?');
    const noQuery = parts[0] ?? url;
    const clean = noQuery.split('#')[0] ?? noQuery;
    const m = clean.match(URL_EXT_REGEX);
    return m ? `.${(m[1] ?? 'jpg').toLowerCase()}` : DEFAULT_EXT;
  }

  private async resolveUseMarkdownLinks(): Promise<boolean> {
    try {
      const configPath = `${this.app.vault.configDir}/app.json`;
      const raw = await this.app.vault.adapter.read(configPath);
      const config = JSON.parse(raw) as Record<string, unknown>;
      return config.useMarkdownLinks === true;
    } catch {
      return false;
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AutoDownloadSettings>);
    this._resolvedLang   = this.settings.language === 'auto' ? detectObsidianLang() : this.settings.language;
    this._watchedFolders = parseFolders(this.settings.watchFolders);
    this._useMarkdownLinks = await this.resolveUseMarkdownLinks();
    this._userAgent = navigator.userAgent;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this._resolvedLang   = this.settings.language === 'auto' ? detectObsidianLang() : this.settings.language;
    this._watchedFolders = parseFolders(this.settings.watchFolders);
  }
}
