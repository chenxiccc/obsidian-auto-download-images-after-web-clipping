// Node.js Buffer 的最小类型声明（Electron 渲染进程可用，isDesktopOnly: true 保证始终存在）
// Minimal type declaration for Node.js Buffer (available in Electron renderer, guaranteed by isDesktopOnly: true)
declare class Buffer extends Uint8Array {
  static concat(list: Buffer[]): Buffer;
}

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

// ─── Node.js https 模块的最小化类型定义 / Minimal type defs ────────────────

interface HttpsResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', cb: (chunk: Uint8Array) => void): void;
  on(event: 'end', cb: () => void): void;
}

interface HttpsRequest {
  on(event: 'error', cb: (err: Error) => void): void;
  on(event: 'timeout', cb: () => void): void;
  destroy(): void;
}

interface HttpsOptions {
  hostname: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  timeout: number;
}

interface HttpsModule {
  get(options: HttpsOptions, callback: (res: HttpsResponse) => void): HttpsRequest;
}

// ─── 工具函数 / Utility functions ──────────────────────────────────────────

// 根据是否使用 markdown 链接，生成最终的图片引用字符串（语法遵循 Obsidian「文件与链接 → 使用 Wiki 格式」；路径文本由 resolveLinkText 解析，已跟随「内部链接类型」）
// Generate image reference string. Syntax follows Obsidian "Files & Links → Use Wiki Links"; link-text is resolved by resolveLinkText and already follows "New link format"
function formatImageLink(linkText: string, alt: string, useMarkdownLinks: boolean): string {
  return useMarkdownLinks
    ? `![${alt}](<${linkText}>)`
    : `![[${linkText}]]`;
}

// 为带链接的图片生成最终引用格式：[![alt](img)](link) 的替换
// 在 wikilink 模式下丢弃外层链接（wikilink 不支持嵌套在 markdown 链接中），markdown 模式下保留
// Generate final reference for linked images: replacement for [![alt](img)](link)
// In wikilink mode, discard outer link (wikilink can't be nested in markdown links); preserve in markdown mode
function formatLinkedImageLink(linkText: string, alt: string, linkUrl: string, useMarkdownLinks: boolean): string {
  return useMarkdownLinks
    ? `[![${alt}](<${linkText}>)](${linkUrl})`
    : `![[${linkText}]]`;
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

// 文件夹名清理：非法字符→下划线；keepSpaces=false 时空白→短横
// Sanitize a folder name: illegal chars→underscore; whitespace→dash unless keepSpaces
function sanitizeFolderName(name: string, keepSpaces = false): string {
  let out = name.replace(/[\\/:*?"<>|]/g, '_');
  if (!keepSpaces) out = out.replace(/\s+/g, '-');
  out = out.replace(/^[.\s]+|[.\s]+$/g, '');
  return out || 'attachments';
}

// 笔记名清理：非法字符→下划线；keepSpaces=false 时空白→短横
// Sanitize a note name: illegal chars→underscore; whitespace→dash unless keepSpaces
function sanitizeNoteName(basename: string, keepSpaces = false): string {
  let out = basename.replace(/[\\/:*?"<>|]/g, '_');
  if (!keepSpaces) out = out.replace(/\s+/g, '-');
  return out;
}

// 左侧补零 | Left-pad a number with zeros to the given width
export function zeroPad(num: number, width: number): string {
  let s = String(num);
  while (s.length < width) s = '0' + s;
  return s;
}

// 日期格式化（手写子集，避免依赖 moment）| Date formatter (hand-written subset, no moment dependency)
// 支持 token：YYYY YY MM M DD D HH H mm m ss s | Supported tokens
export function formatDateToken(token: string, date: Date = new Date()): string {
  const map: Record<string, string> = {
    'YYYY': String(date.getFullYear()),
    'YY':   String(date.getFullYear()).slice(-2),
    'MM':   zeroPad(date.getMonth() + 1, 2),
    'M':    String(date.getMonth() + 1),
    'DD':   zeroPad(date.getDate(), 2),
    'D':    String(date.getDate()),
    'HH':   zeroPad(date.getHours(), 2),
    'H':    String(date.getHours()),
    'mm':   zeroPad(date.getMinutes(), 2),
    'm':    String(date.getMinutes()),
    'ss':   zeroPad(date.getSeconds(), 2),
    's':    String(date.getSeconds()),
  };
  // 长令牌在前，避免 YY 抢占 YYYY、M 抢占 MM
  // Longer tokens first to prevent YY matching inside YYYY, M inside MM, etc.
  return token.replace(/YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g, (m) => map[m] ?? m);
}

// 将文件名模板解析为最终文件名主干（不含扩展名，可从 settings.ts 导入）
// Resolve a filename template to a stem (no extension); exported so settings.ts can import it
export function formatNameTemplate(template: string, noteName: string, index: number, keepSpaces = false): string {
  let out = template;
  out = out.replace(/{date:([^}]+)}/g, (_, fmt: string) => formatDateToken(fmt));
  out = out.replace(/{notename}/g, noteName);
  // {index:NNN} —— NNN 的位数决定补零宽度，数值决定起始值
  // {index:NNN} — width = number of digits in NNN, start = numeric value of NNN
  out = out.replace(/{index:(\d+)}/g, (_, digits: string) => {
    const width = digits.length;
    const start = parseInt(digits, 10);
    return zeroPad(start + index, width);
  });
  // 非法文件名字符永远替换；空白仅在 keepSpaces=false 时转短横
  // Illegal filename chars always replaced; whitespace→dash only unless keepSpaces
  out = out.replace(/[\\/:*?"<>|]/g, '_');
  if (!keepSpaces) out = out.replace(/\s+/g, '-');
  return out;
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

  // 缓存的 User-Agent（复用 Obsidian 自带的 UA）
  // Cached User-Agent (reuses Obsidian's own UA)
  _userAgent: string = '';

  // 缓存的 Node.js https 模块引用（仅桌面端可用）
  // Cached Node.js https module reference (desktop only)
  private _httpsModule: HttpsModule | null = null;

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
      this._httpsModule = (window as unknown as { require(id: 'https'): HttpsModule }).require('https');
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
    const { attachmentPathMode, customAttachmentFolder, customTemplateFolder } = this.settings;
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
        const safeName = sanitizeFolderName(file.basename, this.settings.keepOriginalNoteName);
        return normalizePath(`${fileDir}/${safeName}`);
      }
      case 'customTemplate': {
        // 路径模板从 vault 根目录解析，支持 {date:FORMAT} 和 {notename} 占位符
        // Path template resolved from vault root, supports {date:FORMAT} and {notename} tokens
        return this.formatPathTemplate(customTemplateFolder || 'assets/{date:YYYY-MM}', file);
      }
      default:
        return normalizePath('attachments');
    }
  }

  // 将路径模板解析为 vault 根目录下的绝对路径
  // Resolve a path template into an absolute path from the vault root
  formatPathTemplate(template: string, file: TFile): string {
    const keepSpaces = this.settings.keepOriginalNoteName;
    const noteName  = sanitizeNoteName(file.basename, keepSpaces);
    // {notepath} 展开为笔记所在文件夹路径（vault 相对路径，已含 /）
    // {notepath} expands to the note's parent folder path (vault-relative, includes /)
    const notePath  = file.parent?.path ?? '';
    // 统一分隔符为 /，按段处理，逐段做占位符替换与清理，再重新拼接
    // Normalize separators to /, process per-segment, then rejoin
    // {notepath} 可能包含多段（如 Clippings/2026），先整体替换再按 / 拆段
    // {notepath} may contain multiple segments; replace it first, then split on /
    const withNotePath = template.replace(/\\/g, '/').replace(/{notepath}/g, notePath);
    const segments = withNotePath.split('/');
    const resolved = segments
      .map(seg => {
        let out = seg;
        out = out.replace(/{date:([^}]+)}/g, (_, fmt: string) => formatDateToken(fmt));
        out = out.replace(/{notename}/g, noteName);
        return sanitizeFolderName(out, keepSpaces);
      })
      .filter(seg => seg.length > 0);
    return normalizePath(resolved.join('/'));
  }

  // 将文件名模板解析为最终文件名主干（不含扩展名）
  // Resolve a filename template into the final name stem (without extension)
  formatNameTemplate(template: string, noteName: string, index: number): string {
    return formatNameTemplate(template, noteName, index, this.settings.keepOriginalNoteName);
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
        ...mdMatches.map(m => m[2] as string),
        ...htmlMatches.map(m => (m[1] ?? m[2]) as string),
      ].filter((u): u is string => Boolean(u));
      const uniqueUrls = [...new Set(allUrls)].filter(u => !this.failedUrls.has(u));
      if (uniqueUrls.length === 0) return;

      const attachmentFolder = this.resolveAttachmentFolder(file);
      await this.ensureFolder(attachmentFolder);

      const noteName = sanitizeNoteName(file.basename, this.settings.keepOriginalNoteName);

      const urlToLocal = new Map<string, { destPath: string; tfile: TFile | null }>();
      const failedUrls: string[]  = [];
      let savedIndex = 0;

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

        const stem = this.formatNameTemplate(this.settings.imageNameTemplate, noteName, savedIndex);
        const rawName = `${stem}${ext}`;
        const destPath = await this.resolveDestPath(attachmentFolder, rawName);

        try {
          // 高层 API：返回 TFile 并立即注册进文件抽象层，供 fileToLinktext 使用
          // High-level API: returns TFile and registers it in the file abstraction layer immediately for fileToLinktext
          const tf = await this.app.vault.createBinary(destPath, buffer);
          urlToLocal.set(url, { destPath, tfile: tf });
          savedIndex++;
        } catch {
          // TOCTOU 兜底：resolveDestPath 探测后极短窗口内被占用导致 createBinary 抛错，回退可覆盖写入
          // TOCTOU fallback: createBinary throws if the path is taken in the tiny window after resolveDestPath; fall back to overwrite-capable write
          try {
            await this.app.vault.adapter.writeBinary(destPath, buffer);
            urlToLocal.set(url, { destPath, tfile: null });
            savedIndex++;
          } catch (err2) {
            this.failedUrls.add(url);
            failedUrls.push(url);
            console.error(t.consoleWriteFailed(destPath, err2));
          }
        }
      }

      if (urlToLocal.size > 0) {
        // 实时读取 Obsidian「使用 Wiki 格式」设置，与 newLinkFormat 的实时性对齐
        // Read Obsidian "Use Wiki Links" setting live, aligned with newLinkFormat's live behavior
        const vaultWithConfig = this.app.vault as typeof this.app.vault & { getConfig(key: string): unknown };
        const useMarkdownLinks = (vaultWithConfig.getConfig('useMarkdownLinks') as boolean) ?? false;
        try {
          await this.app.vault.process(file, (currentContent) => {
            let updated = currentContent;
            for (const [url, { destPath, tfile }] of urlToLocal) {
              // 把目标路径解析为跟随 Obsidian「内部链接类型」的链接文本
              // Resolve the destination path into link-text that follows Obsidian "New link format"
              const linkText = this.resolveLinkText(tfile, destPath, file);
              const urlEscaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              const linkedMdRe = new RegExp(
                `\\[!\\[([^\\]]*)\\]\\(${urlEscaped}(?:\\s+(?:"[^"]*"|'[^']*'))?\\)\\]\\(([^)]+)\\)`,
                'g'
              );
              updated = updated.replace(linkedMdRe, (_, alt: string, linkUrl: string) =>
                formatLinkedImageLink(linkText, alt, linkUrl, useMarkdownLinks)
              );

              const mdRe = new RegExp(
                `!\\[([^\\]]*)\\]\\(${urlEscaped}(?:\\s+(?:"[^"]*"|'[^']*'))?\\)`,
                'g'
              );
              updated = updated.replace(mdRe, (_, alt: string) =>
                formatImageLink(linkText, alt, useMarkdownLinks)
              );

              const htmlRe = new RegExp(
                `<img\\s[^>]*\\bsrc=(?:"${urlEscaped}"|'${urlEscaped}')[^>]*>`,
                'gi'
              );
              updated = updated.replace(htmlRe, (fullTag: string) => {
                const altMatch = fullTag.match(/\balt=(?:"([^"]*)"|'([^']*)')/i);
                const alt = altMatch ? (altMatch[1] ?? altMatch[2] ?? '') : '';
                return formatImageLink(linkText, alt, useMarkdownLinks);
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
    https: HttpsModule,
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
    https: HttpsModule,
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

        const req = https.get(options, (res: HttpsResponse) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (hops >= MAX_REDIRECTS) {
              resolve({ type: 'too-many-redirects' });
              return;
            }
            hops++;
            currentUrl = new URL(res.headers.location as string, currentUrl).toString();
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

          const contentType = (res.headers['content-type'] as string) ?? '';
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => { chunks.push(chunk); });

          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
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

  // 把已下载图片的 TFile 转成嵌入链接中使用的路径文本（遵循 Obsidian「文件与链接 → 内部链接类型」）
  // Convert a downloaded image's TFile into the link-text used inside embeds (follows Obsidian "Files & Links → New link format")
  // fileToLinktext 内部已按 newLinkFormat(shortest/relative/absolute) 输出，无需在此分支
  // fileToLinktext already outputs per newLinkFormat(shortest/relative/absolute); no branching needed here
  resolveLinkText(imageFile: TFile | null, destPath: string, noteFile: TFile): string {
    if (imageFile) {
      return this.app.metadataCache.fileToLinktext(imageFile, noteFile.path);
    }
    // 兜底（仅写入回退分支无 TFile 时）：再尝试一次按路径取 TFile，取不到退绝对路径
    // Fallback (only when write-fallback branch has no TFile): retry by path, else absolute path
    const posix = destPath.replace(/\\/g, '/');
    const tf = this.app.vault.getAbstractFileByPath(posix);
    if (tf instanceof TFile) {
      return this.app.metadataCache.fileToLinktext(tf, noteFile.path);
    }
    return posix;
  }

  extractExt(url: string): string {
    const parts = url.split('?');
    const noQuery = parts[0] ?? url;
    const clean = noQuery.split('#')[0] ?? noQuery;
    const m = clean.match(URL_EXT_REGEX);
    return m ? `.${(m[1] ?? 'jpg').toLowerCase()}` : DEFAULT_EXT;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AutoDownloadSettings>);
    this._resolvedLang   = this.settings.language === 'auto' ? detectObsidianLang() : this.settings.language;
    this._watchedFolders = parseFolders(this.settings.watchFolders);
    const { userAgent } = window.navigator;
    this._userAgent = userAgent;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this._resolvedLang   = this.settings.language === 'auto' ? detectObsidianLang() : this.settings.language;
    this._watchedFolders = parseFolders(this.settings.watchFolders);
  }
}
