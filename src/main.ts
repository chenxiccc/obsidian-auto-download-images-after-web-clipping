import { Notice, Plugin, TFile, normalizePath, requestUrl } from 'obsidian';
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

// ─── 工具函数 / Utility functions ──────────────────────────────────────────

// 根据 linkFormat 生成最终的图片引用字符串
// Generate image reference string according to linkFormat
function formatImageLink(destPath: string, alt: string, linkFormat: string): string {
  return linkFormat === 'wikilink'
    ? `![[${destPath}]]`
    : `![${alt}](<${destPath}>)`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
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
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    || 'attachments';
}

/**
 * 以有限并发度运行异步任务列表，返回与入参顺序一致的结果数组
 * Run async tasks with a concurrency limit; returns results in the same order as input
 */
async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
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
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>>;

  // 缓存的已解析语言 | Cached resolved language
  _resolvedLang: string;

  // 缓存的监听文件夹列表 | Cached watched folders list
  _watchedFolders: string[];

  get t(): TranslationMap {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return TRANSLATIONS[this._resolvedLang] ?? TRANSLATIONS['en']!;
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new AutoDownloadSettingTab(this.app, this));

    this.processingFiles = new Set();
    this.failedUrls = new Set();
    this.debounceTimers = new Map();

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile)) return;
        if (!file.path.endsWith('.md')) return;
        if (!this.isWatched(file.path)) return;

        // 防抖：每次修改都重置计时器，静止 delayMs 后才真正触发
        // Debounce: reset timer on every modification, trigger only after delayMs of inactivity
        if (this.debounceTimers.has(file.path)) {
          clearTimeout(this.debounceTimers.get(file.path));
        }
        const timer = setTimeout(() => {
          this.debounceTimers.delete(file.path);
          this.downloadImagesInFile(file);
        }, this.settings.delayMs);
        this.debounceTimers.set(file.path, timer);
      })
    );

    const folders = this._watchedFolders.join(', ');
    console.log(this.t.consoleLoaded(folders));
  }

  onunload(): void {
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
  }

  isWatched(filePath: string): boolean {
    return this._watchedFolders.some(folder => {
      const prefix = folder.endsWith('/') ? folder : folder + '/';
      return filePath.startsWith(prefix);
    });
  }

  async resolveAttachmentFolder(file: TFile): Promise<string> {
    const { attachmentPathMode, customAttachmentFolder } = this.settings;
    const fileDir = file.parent?.path ?? '';

    switch (attachmentPathMode) {
      case 'obsidian': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const setting = (this.app.vault as any).getConfig('attachmentFolderPath') as string ?? 'attachments';
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
    // 同一文件同时只允许一个任务运行 | Only one task per file at a time
    if (this.processingFiles.has(file.path)) return;
    this.processingFiles.add(file.path);

    const t = this.t;

    try {
      // ── 1. 读取文件 / Read file ───────────────────────────────────────
      let content: string;
      try {
        content = await this.app.vault.read(file);
      } catch (err) {
        console.error(t.consoleReadError, err);
        return;
      }

      // ── 2. 无状态检测：同时扫描 Markdown 图片和 HTML img 标签
      //       Stateless detection: scan for Markdown images and HTML img tags simultaneously
      const mdMatches   = [...content.matchAll(MD_IMAGE_REGEX)];
      const htmlMatches = [...content.matchAll(HTML_IMG_REGEX)];
      if (mdMatches.length === 0 && htmlMatches.length === 0) return;

      // 收集所有唯一 URL，排除已知失败项
      // Collect all unique URLs, excluding known failures
      const allUrls = [
        ...mdMatches.map(m => m[2]),
        ...htmlMatches.map(m => m[1] ?? m[2]),
      ].filter((u): u is string => Boolean(u));
      const uniqueUrls = [...new Set(allUrls)].filter(u => !this.failedUrls.has(u));
      if (uniqueUrls.length === 0) return;

      // ── 3. 确保附件目录存在 / Ensure attachment folder exists ──────────
      const attachmentFolder = await this.resolveAttachmentFolder(file);
      await this.ensureFolder(attachmentFolder);

      const titleBase = file.basename
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]/g, '_');

      // ── 4. 并行下载所有唯一 URL（最多 DOWNLOAD_CONCURRENCY 个同时进行）
      //       Download all unique URLs in parallel (up to DOWNLOAD_CONCURRENCY at a time)
      const urlToLocal = new Map<string, string>(); // url → destPath
      const failedUrls: string[]  = [];
      let savedCount = 1;

      // 并行获取所有图片内容 | Fetch all images in parallel with concurrency limit
      const downloadResults = await runWithConcurrency(
        uniqueUrls.map(url => async () => {
          const result = await this.fetchWithRetry(url, 3);
          return { url, ...result };
        }),
        DOWNLOAD_CONCURRENCY
      );

      // 顺序保存到磁盘，避免命名冲突 | Save to disk sequentially to avoid naming conflicts
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

      // ── 5. 原子写回：用 vault.process 替换所有成功下载的链接
      //       Atomic write-back: replace all successfully downloaded links via vault.process
      if (urlToLocal.size > 0) {
        const { linkFormat } = this.settings;
        try {
          await this.app.vault.process(file, (currentContent) => {
            let updated = currentContent;
            for (const [url, destPath] of urlToLocal) {
              const urlEscaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              // 替换 Markdown 格式图片链接（含可选 title）
              // Replace Markdown image links (with optional title)
              const mdRe = new RegExp(
                `!\\[([^\\]]*)\\]\\(${urlEscaped}(?:\\s+(?:"[^"]*"|'[^']*'))?\\)`,
                'g'
              );
              updated = updated.replace(mdRe, (_, alt: string) =>
                formatImageLink(destPath, alt, linkFormat)
              );

              // 替换 HTML <img> 标签，从标签属性中提取 alt
              // Replace HTML <img> tags, extracting alt from tag attributes
              const htmlRe = new RegExp(
                `<img\\s[^>]*\\bsrc=(?:"${urlEscaped}"|'${urlEscaped}')[^>]*>`,
                'gi'
              );
              updated = updated.replace(htmlRe, (fullTag: string) => {
                const altMatch = fullTag.match(/\balt=(?:"([^"]*)"|'([^']*)')/i);
                const alt = altMatch ? (altMatch[1] ?? altMatch[2] ?? '') : '';
                return formatImageLink(destPath, alt, linkFormat);
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

      // ── 6. 通知用户 / Notify user ─────────────────────────────────────
      const successCount = urlToLocal.size;
      if (failedUrls.length === 0 && successCount > 0) {
        new Notice(t.noticeSuccess(successCount, file.basename));
      } else if (failedUrls.length > 0) {
        new Notice(t.noticePartial(successCount, failedUrls.length, file.basename), 8000);
        console.warn(t.consoleFailedUrls + '\n' + failedUrls.join('\n'));
      }

    } finally {
      // 无论成功还是失败都释放锁 | Release the lock regardless of success or failure
      this.processingFiles.delete(file.path);
    }
  }

  async fetchWithRetry(url: string, maxRetries = 3): Promise<{ buffer: ArrayBuffer | null; ext: string }> {
    const t = this.t;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 使用 requestUrl（Node.js 层发起，绕过 CORS / 防盗链限制）
        // Use requestUrl (Node.js level, bypasses CORS / hotlink protection)
        const resp = await requestUrl({
          url,
          headers: {
            'Referer':    new URL(url).origin,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          throw: false, // 不自动抛出，手动判断状态码 | Don't throw automatically, check status code manually
        });

        if (resp.status >= 400 && resp.status < 500) {
          console.warn(t.console4xx(resp.status, url));
          return { buffer: null, ext: '.jpg' };
        }

        if (resp.status >= 300) {
          throw new Error(`HTTP ${resp.status}`);
        }

        // ── 验证 Content-Type：仅接受图片类型
        //    Validate Content-Type: only accept image types
        const contentType = resp.headers['content-type'] ?? '';
        const isImage  = contentType.startsWith('image/');
        const isBinary = contentType.includes('application/octet-stream') || contentType === '';
        if (!isImage && !isBinary) {
          // 服务器明确返回了非图片类型（如 text/html 错误页），跳过
          // Server returned a non-image type (e.g. text/html error page), skip it
          console.warn(t.consoleSkipNonImage(contentType, url));
          return { buffer: null, ext: '.jpg' };
        }

        // ── 过滤追踪像素（< 1 KB）/ Filter tracking pixels (< 1 KB) ─────
        if (resp.arrayBuffer.byteLength < MIN_IMAGE_BYTES) {
          console.warn(t.consoleSkipTooSmall(resp.arrayBuffer.byteLength, url));
          return { buffer: null, ext: '.jpg' };
        }

        // 优先用 Content-Type 推断扩展名，回退到 URL 推断
        // Prefer Content-Type for extension inference, fall back to URL
        const ext = this.extFromContentType(contentType) ?? this.extractExt(url);
        return { buffer: resp.arrayBuffer, ext };

      } catch (err) {
        const isLastAttempt = attempt === maxRetries;
        const msg = err instanceof Error ? err.message : String(err);
        if (isLastAttempt) {
          console.warn(t.consoleGiveUp(attempt, url, msg));
          return { buffer: null, ext: '.jpg' };
        }
        console.warn(t.consoleRetry(attempt, RETRY_DELAY_MS, url, msg));
        await sleep(RETRY_DELAY_MS);
      }
    }

    return { buffer: null, ext: '.jpg' };
  }

  // 根据 Content-Type 响应头推断扩展名 | Infer file extension from Content-Type header
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
    // 超出上限时用时间戳兜底 | Fall back to timestamp suffix when counter exceeds limit
    return normalizePath(`${folder}/${stem}(${Date.now()})${ext}`);
  }

  // 确保目录存在：先整体检查，再逐级创建，容忍并发竞态
  // Ensure folder exists: quick full-path check first, then create segment by segment, tolerating race conditions
  async ensureFolder(folderPath: string): Promise<void> {
    if (!folderPath || folderPath === '/') return;
    // 绝大多数情况下文件夹已存在，一次检查即可返回 | Fast path: folder already exists in the common case
    if (await this.app.vault.adapter.exists(folderPath)) return;

    const parts = folderPath.split('/').filter(p => p);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!await this.app.vault.adapter.exists(current)) {
        try {
          await this.app.vault.createFolder(current);
        } catch (err) {
          // 若并发任务已先创建，exists 此时应为 true，否则真正报错
          // If a concurrent task already created it, exists should now be true; otherwise re-throw
          if (!await this.app.vault.adapter.exists(current)) throw err;
        }
      }
    }
  }

  // 从 URL 推断扩展名（作为 Content-Type 的回退）
  // Infer extension from URL (fallback when Content-Type is unavailable)
  extractExt(url: string): string {
    const parts = url.split('?');
    const noQuery = parts[0] ?? url;
    const clean = noQuery.split('#')[0] ?? noQuery;
    const m = clean.match(/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i);
    return m ? `.${(m[1] ?? 'jpg').toLowerCase()}` : '.jpg';
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AutoDownloadSettings>);
    // 缓存解析结果，避免每次事件都重新计算 | Cache derived values to avoid recomputation on every event
    this._resolvedLang   = this.settings.language === 'auto' ? detectObsidianLang() : this.settings.language;
    this._watchedFolders = parseFolders(this.settings.watchFolders);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // 设置变更后同步刷新缓存 | Refresh caches after settings change
    this._resolvedLang   = this.settings.language === 'auto' ? detectObsidianLang() : this.settings.language;
    this._watchedFolders = parseFolders(this.settings.watchFolders);
  }
}
