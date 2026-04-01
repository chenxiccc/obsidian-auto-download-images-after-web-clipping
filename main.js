const { Plugin, PluginSettingTab, Setting, Notice, normalizePath, requestUrl } = require('obsidian');

// ─── 国际化 ────────────────────────────────────────────────────────────────

const TRANSLATIONS = {
  en: {
    settingTitle:               'Auto Download Images After Clipping',
    pluginDescription:          'Automatically download remote images to local vault after web clipping.',

    // Language
    langSettingName:            'Language',
    langSettingDesc:            'Interface language. "Auto" follows Obsidian\'s language setting.',
    langAuto:                   'Auto',
    langEn:                     'English',
    langZh:                     '简体中文',

    // Watch folders
    folderSettingName:          'Watch folders',
    folderSettingDesc:          'Automatically download images when a .md file in these folders is written. One path per line, relative to vault root. e.g. Clippings or ReadItLater/Articles',
    folderPlaceholder:          'Clippings\nReadItLater/Articles',

    // Delay
    delaySettingName:           'Debounce delay (ms)',
    delaySettingDesc:           'Processing starts this long after the last file modification. Increase if images are missed because the clipper is still writing.',

    // Attachment path mode
    pathModeSettingName:        'Image save location',
    pathModeSettingDesc:        'Where to save downloaded images.',
    pathModeObsidian:           'Follow Obsidian settings',
    pathModeCustom:             'Custom subfolder under the same directory as the note',
    pathModeSameName:           'Subfolder with the same name as the note (under the same directory)',
    customFolderSettingName:    'Subfolder name',
    customFolderSettingDesc:    'Folder name relative to the note\'s directory. Default: attachments',
    customFolderPlaceholder:    'attachments',

    // Link format
    linkFormatSettingName:      'Image link format',
    linkFormatSettingDesc:      'Format used when inserting downloaded images into notes.',
    linkFormatWikilink:         'Wikilink  ![[...]]',
    linkFormatMarkdown:         'Markdown  ![alt](...)',

    // Notices
    noticeSuccess:              (count, name) => `✅ Downloaded ${count} image(s) — ${name}`,
    noticePartial:              (ok, fail, name) => `⚠️ ${name}: ${ok} succeeded, ${fail} failed (original links kept)`,
    noticeWriteError:           (name) => `[AutoDL] Failed to write back to ${name}, check console`,

    // Console
    consoleFailedUrls:          'The following images failed to download (original links kept):',
    consoleReadError:           'Failed to read file:',
    consoleWriteBackError:      'Failed to write back md file:',
    console4xx:                 (status, url) => `[AutoDL] HTTP ${status}, giving up: ${url}`,
    consoleRetry:               (attempt, delay, url, msg) =>
                                  `[AutoDL] Attempt ${attempt} failed, retrying in ${delay}ms: ${url}\nReason: ${msg}`,
    consoleGiveUp:              (attempt, url, msg) =>
                                  `[AutoDL] Attempt ${attempt} failed, giving up: ${url}\nReason: ${msg}`,
    consoleKeepOriginal:        (url) => `[AutoDL] Download failed, keeping original link: ${url}`,
    consoleWriteFailed:         (path, err) => `[AutoDL] Write failed ${path}: ${err}`,
    consoleSkipNonImage:        (type, url) => `[AutoDL] Non-image response (${type || 'unknown'}), skipping: ${url}`,
    consoleSkipTooSmall:        (bytes, url) => `[AutoDL] File too small (${bytes}B), likely a tracking pixel, skipping: ${url}`,
    consoleLoaded:              (folders) => `Auto Download Images After Clipping: started, watching → ${folders}`,
  },

  zh: {
    settingTitle:               '剪藏后自动下载图片',
    pluginDescription:          '网页剪藏后，自动将文中的远程图片下载到本地 vault。',

    langSettingName:            '语言',
    langSettingDesc:            '界面语言。选择「自动」时跟随 Obsidian 的语言设置。',
    langAuto:                   '自动',
    langEn:                     'English',
    langZh:                     '简体中文',

    folderSettingName:          '监听文件夹',
    folderSettingDesc:          '在这些文件夹内的 .md 文件写入完成后，自动下载文中图片。每行一个路径（相对于 vault 根目录），例如：Clippings 或 ReadItLater/Articles',
    folderPlaceholder:          'Clippings\nReadItLater/Articles',

    delaySettingName:           '防抖延迟（毫秒）',
    delaySettingDesc:           '文件最后一次修改后等待此时长再开始处理。如果图片经常漏下，说明剪藏器写入较慢，可适当调大。',

    pathModeSettingName:        '图片保存位置',
    pathModeSettingDesc:        '下载的图片保存到哪里。',
    pathModeObsidian:           '跟随 Obsidian 设置',
    pathModeCustom:             '笔记所在目录下的指定子文件夹',
    pathModeSameName:           '笔记所在目录下与笔记同名的子文件夹',
    customFolderSettingName:    '子文件夹名称',
    customFolderSettingDesc:    '相对于笔记所在目录的子文件夹名称，默认为 attachments',
    customFolderPlaceholder:    'attachments',

    linkFormatSettingName:      '图片引用格式',
    linkFormatSettingDesc:      '下载的图片插入笔记时使用的链接格式。',
    linkFormatWikilink:         'Wiki 链接  ![[...]]',
    linkFormatMarkdown:         'Markdown  ![alt](...)',

    noticeSuccess:              (count, name) => `✅ 图片下载完成：${count} 张（${name}）`,
    noticePartial:              (ok, fail, name) => `⚠️ ${name}：${ok} 张成功，${fail} 张失败（已保留原始链接）`,
    noticeWriteError:           (name) => `[AutoDL] 写回 ${name} 失败，请查看控制台日志`,

    consoleFailedUrls:          '以下图片下载失败，已保留原始链接：',
    consoleReadError:           '读取文件失败:',
    consoleWriteBackError:      '写回 md 文件失败:',
    console4xx:                 (status, url) => `[AutoDL] ${status} 错误，放弃重试: ${url}`,
    consoleRetry:               (attempt, delay, url, msg) =>
                                  `[AutoDL] 第 ${attempt} 次尝试失败，${delay}ms 后重试: ${url}\n原因: ${msg}`,
    consoleGiveUp:              (attempt, url, msg) =>
                                  `[AutoDL] 第 ${attempt} 次尝试失败，放弃: ${url}\n原因: ${msg}`,
    consoleKeepOriginal:        (url) => `[AutoDL] 下载失败，保留原始链接: ${url}`,
    consoleWriteFailed:         (path, err) => `[AutoDL] 写入文件失败 ${path}: ${err}`,
    consoleSkipNonImage:        (type, url) => `[AutoDL] 非图片响应（${type || '未知类型'}），跳过: ${url}`,
    consoleSkipTooSmall:        (bytes, url) => `[AutoDL] 文件过小（${bytes}B），疑似追踪像素，跳过: ${url}`,
    consoleLoaded:              (folders) => `剪藏后自动下载图片：已启动，监听文件夹 → ${folders}`,
  },
};

function detectObsidianLang() {
  const lang = window.localStorage.getItem('language') || '';
  return lang === 'zh' ? 'zh' : 'en';
}

// ─── 默认设置 ──────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  watchFolders:           'Clippings',
  delayMs:                2000,
  language:               'auto',       // 'auto' | 'en' | 'zh'
  attachmentPathMode:     'obsidian',   // 'obsidian' | 'custom' | 'samename'
  customAttachmentFolder: 'attachments',
  linkFormat:             'wikilink',   // 'wikilink' | 'markdown'
};

// ─── 正则 ──────────────────────────────────────────────────────────────────

// Markdown 图片：![alt](https://...) 及带 title 变体 ![alt](https://... "title")
const MD_IMAGE_REGEX = /!\[([^\]]*)\]\((https?:\/\/[^\s)"']+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;

// HTML img 标签：<img src="https://..."> 或 <img src='https://...'>（属性顺序不限）
const HTML_IMG_REGEX = /<img\s[^>]*\bsrc=(?:"(https?:\/\/[^"]+)"|'(https?:\/\/[^']+)')[^>]*>/gi;

// 最小文件大小：小于此值视为追踪像素，直接跳过（1 KB）
const MIN_IMAGE_BYTES = 1024;

// 下载失败后的重试间隔毫秒数 | Retry interval in milliseconds for failed downloads
const RETRY_DELAY_MS = 1500;

// 同时下载图片的最大并发数 | Maximum number of concurrent image downloads
const DOWNLOAD_CONCURRENCY = 3;

// MIME 类型到文件扩展名的映射表 | Map from MIME type to file extension
const MIME_EXT_MAP = {
  'image/jpeg':    '.jpg',
  'image/png':     '.png',
  'image/gif':     '.gif',
  'image/webp':    '.webp',
  'image/svg+xml': '.svg',
  'image/avif':    '.avif',
  'image/bmp':     '.bmp',
};

// ─── 设置页 ────────────────────────────────────────────────────────────────

class AutoDownloadSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  get t() {
    const { language } = this.plugin.settings;
    const lang = language === 'auto' ? detectObsidianLang() : language;
    return TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  }

  display() {
    const { containerEl } = this;
    const t = this.t;
    containerEl.empty();
    containerEl.createEl('h2', { text: t.settingTitle });

    // ── 语言 ──────────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName(t.langSettingName)
      .setDesc(t.langSettingDesc)
      .addDropdown(drop => {
        drop
          .addOption('auto', t.langAuto)
          .addOption('en',   t.langEn)
          .addOption('zh',   t.langZh)
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // ── 监听文件夹 ────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName(t.folderSettingName)
      .setDesc(t.folderSettingDesc)
      .addTextArea(text => {
        text
          .setPlaceholder(t.folderPlaceholder)
          .setValue(this.plugin.settings.watchFolders)
          .onChange(async (value) => {
            this.plugin.settings.watchFolders = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 6;
        text.inputEl.style.width = '100%';
        text.inputEl.style.fontFamily = 'monospace';
      });

    // ── 触发延迟 ──────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName(t.delaySettingName)
      .setDesc(t.delaySettingDesc)
      .addText(text => {
        text
          .setPlaceholder('2000')
          .setValue(String(this.plugin.settings.delayMs))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 0) {
              this.plugin.settings.delayMs = n;
              await this.plugin.saveSettings();
            }
          });
        text.inputEl.type = 'number';
        text.inputEl.style.width = '80px';
      });

    // ── 图片保存位置 ──────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName(t.pathModeSettingName)
      .setDesc(t.pathModeSettingDesc)
      .addDropdown(drop => {
        drop
          .addOption('obsidian', t.pathModeObsidian)
          .addOption('custom',   t.pathModeCustom)
          .addOption('samename', t.pathModeSameName)
          .setValue(this.plugin.settings.attachmentPathMode)
          .onChange(async (value) => {
            this.plugin.settings.attachmentPathMode = value;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // ── 子文件夹名称（仅 custom 模式显示）────────────────────────────────
    if (this.plugin.settings.attachmentPathMode === 'custom') {
      new Setting(containerEl)
        .setName(t.customFolderSettingName)
        .setDesc(t.customFolderSettingDesc)
        .addText(text => {
          text
            .setPlaceholder(t.customFolderPlaceholder)
            .setValue(this.plugin.settings.customAttachmentFolder)
            .onChange(async (value) => {
              this.plugin.settings.customAttachmentFolder = value.trim() || 'attachments';
              await this.plugin.saveSettings();
            });
          text.inputEl.style.width = '200px';
        });
    }

    // ── 图片引用格式 ──────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName(t.linkFormatSettingName)
      .setDesc(t.linkFormatSettingDesc)
      .addDropdown(drop => {
        drop
          .addOption('wikilink', t.linkFormatWikilink)
          .addOption('markdown', t.linkFormatMarkdown)
          .setValue(this.plugin.settings.linkFormat)
          .onChange(async (value) => {
            this.plugin.settings.linkFormat = value;
            await this.plugin.saveSettings();
          });
      });
  }
}

// ─── 主插件 ────────────────────────────────────────────────────────────────

class AutoDownloadAttachmentsPlugin extends Plugin {

  get t() {
    return TRANSLATIONS[this._resolvedLang] ?? TRANSLATIONS.en;
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AutoDownloadSettingTab(this.app, this));

    // 正在处理的文件路径锁，防止同一文件被并发处理
    this.processingFiles = new Set();
    // 本次会话内下载失败/跳过的 URL 黑名单，避免反复重试
    this.failedUrls = new Set();
    // 每个文件的防抖计时器
    this.debounceTimers = new Map();

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!file.path.endsWith('.md')) return;
        if (!this.isWatched(file.path)) return;

        // 防抖：每次修改都重置计时器，静止 delayMs 后才真正触发
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

  onunload() {
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
  }

  isWatched(filePath) {
    return this._watchedFolders.some(folder => {
      const prefix = folder.endsWith('/') ? folder : folder + '/';
      return filePath.startsWith(prefix);
    });
  }

  async resolveAttachmentFolder(file) {
    const { attachmentPathMode, customAttachmentFolder } = this.settings;
    const fileDir = file.parent?.path ?? '';

    switch (attachmentPathMode) {
      case 'obsidian': {
        const setting = this.app.vault.getConfig('attachmentFolderPath') ?? 'attachments';
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

  async downloadImagesInFile(file) {
    // 同一文件同时只允许一个任务运行
    if (this.processingFiles.has(file.path)) return;
    this.processingFiles.add(file.path);

    const t = this.t;

    try {
      // ── 1. 读取文件 ───────────────────────────────────────────────────
      let content;
      try {
        content = await this.app.vault.read(file);
      } catch (err) {
        console.error(t.consoleReadError, err);
        return;
      }

      // ── 2. 无状态检测：同时扫描 Markdown 图片和 HTML img 标签 ─────────
      const mdMatches   = [...content.matchAll(MD_IMAGE_REGEX)];
      const htmlMatches = [...content.matchAll(HTML_IMG_REGEX)];
      if (mdMatches.length === 0 && htmlMatches.length === 0) return;

      // 收集所有唯一 URL，排除已知失败项
      const allUrls = [
        ...mdMatches.map(m => m[2]),
        ...htmlMatches.map(m => m[1] ?? m[2]),
      ].filter(Boolean);
      const uniqueUrls = [...new Set(allUrls)].filter(u => !this.failedUrls.has(u));
      if (uniqueUrls.length === 0) return;

      // ── 3. 确保附件目录存在 ────────────────────────────────────────────
      const attachmentFolder = await this.resolveAttachmentFolder(file);
      await this.ensureFolder(attachmentFolder);

      const titleBase = file.basename
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]/g, '_');

      // ── 4. 并行下载所有唯一 URL（最多 DOWNLOAD_CONCURRENCY 个同时进行）──
      const urlToLocal = new Map(); // url → destPath
      const failedUrls  = [];
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

      // ── 5. 原子写回：用 vault.process 替换所有成功下载的链接 ──────────
      if (urlToLocal.size > 0) {
        const { linkFormat } = this.settings;
        try {
          await this.app.vault.process(file, (currentContent) => {
            let updated = currentContent;
            for (const [url, destPath] of urlToLocal) {
              const urlEscaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              // 替换 Markdown 格式图片链接（含可选 title）
              const mdRe = new RegExp(
                `!\\[([^\\]]*)\\]\\(${urlEscaped}(?:\\s+(?:"[^"]*"|'[^']*'))?\\)`,
                'g'
              );
              updated = updated.replace(mdRe, (_, alt) =>
                formatImageLink(destPath, alt, linkFormat)
              );

              // 替换 HTML <img> 标签，从标签属性中提取 alt
              const htmlRe = new RegExp(
                `<img\\s[^>]*\\bsrc=(?:"${urlEscaped}"|'${urlEscaped}')[^>]*>`,
                'gi'
              );
              updated = updated.replace(htmlRe, (fullTag) => {
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

      // ── 6. 通知用户 ───────────────────────────────────────────────────
      const successCount = urlToLocal.size;
      if (failedUrls.length === 0 && successCount > 0) {
        new Notice(t.noticeSuccess(successCount, file.basename));
      } else if (failedUrls.length > 0) {
        new Notice(t.noticePartial(successCount, failedUrls.length, file.basename), 8000);
        console.warn(t.consoleFailedUrls + '\n' + failedUrls.join('\n'));
      }

    } finally {
      // 无论成功还是失败都释放锁
      this.processingFiles.delete(file.path);
    }
  }

  async fetchWithRetry(url, maxRetries = 3) {
    const t = this.t;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 使用 requestUrl（Node.js 层发起，绕过 CORS / 防盗链限制）
        const resp = await requestUrl({
          url,
          headers: {
            'Referer':    new URL(url).origin,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          throw: false, // 不自动抛出，手动判断状态码
        });

        if (resp.status >= 400 && resp.status < 500) {
          console.warn(t.console4xx(resp.status, url));
          return { buffer: null, ext: '.jpg' };
        }

        if (resp.status >= 300) {
          throw new Error(`HTTP ${resp.status}`);
        }

        // ── 验证 Content-Type：仅接受图片类型 ─────────────────────────
        const contentType = resp.headers['content-type'] || '';
        const isImage  = contentType.startsWith('image/');
        const isBinary = contentType.includes('application/octet-stream') || contentType === '';
        if (!isImage && !isBinary) {
          // 服务器明确返回了非图片类型（如 text/html 错误页），跳过
          console.warn(t.consoleSkipNonImage(contentType, url));
          return { buffer: null, ext: '.jpg' };
        }

        // ── 过滤追踪像素（< 1 KB）─────────────────────────────────────
        if (resp.arrayBuffer.byteLength < MIN_IMAGE_BYTES) {
          console.warn(t.consoleSkipTooSmall(resp.arrayBuffer.byteLength, url));
          return { buffer: null, ext: '.jpg' };
        }

        // 优先用 Content-Type 推断扩展名，回退到 URL 推断
        const ext = this.extFromContentType(contentType) || this.extractExt(url);
        return { buffer: resp.arrayBuffer, ext };

      } catch (err) {
        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt) {
          console.warn(t.consoleGiveUp(attempt, url, err.message));
          return { buffer: null, ext: '.jpg' };
        }
        console.warn(t.consoleRetry(attempt, RETRY_DELAY_MS, url, err.message));
        await sleep(RETRY_DELAY_MS);
      }
    }

    return { buffer: null, ext: '.jpg' };
  }

  // 根据 Content-Type 响应头推断扩展名 | Infer file extension from Content-Type header
  extFromContentType(contentType) {
    return MIME_EXT_MAP[contentType.split(';')[0].trim()] ?? null;
  }

  // 解析目标路径，若同名文件已存在则追加 (2)、(3)… 后缀
  async resolveDestPath(folder, baseName) {
    let candidate = normalizePath(`${folder}/${baseName}`);
    if (!await this.app.vault.adapter.exists(candidate)) return candidate;

    const ext  = baseName.match(/\.[^.]+$/)?.[0] ?? '';
    const stem = baseName.slice(0, baseName.length - ext.length);
    for (let counter = 2; counter <= 99; counter++) {
      candidate = normalizePath(`${folder}/${stem}(${counter})${ext}`);
      if (!await this.app.vault.adapter.exists(candidate)) return candidate;
    }
    // 超出上限时用时间戳兜底
    return normalizePath(`${folder}/${stem}(${Date.now()})${ext}`);
  }

  // 确保目录存在：先整体检查，再逐级创建，容忍并发竞态
  // Ensure folder exists: quick full-path check first, then create segment by segment, tolerating race conditions
  async ensureFolder(folderPath) {
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
  extractExt(url) {
    const clean = url.split('?')[0].split('#')[0];
    const m = clean.match(/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i);
    return m ? `.${m[1].toLowerCase()}` : '.jpg';
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // 缓存解析结果，避免每次事件都重新计算 | Cache derived values to avoid recomputation on every event
    this._resolvedLang    = this.settings.language === 'auto' ? detectObsidianLang() : this.settings.language;
    this._watchedFolders  = parseFolders(this.settings.watchFolders);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // 设置变更后同步刷新缓存 | Refresh caches after settings change
    this._resolvedLang    = this.settings.language === 'auto' ? detectObsidianLang() : this.settings.language;
    this._watchedFolders  = parseFolders(this.settings.watchFolders);
  }
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────

// 根据 linkFormat 生成最终的图片引用字符串
function formatImageLink(destPath, alt, linkFormat) {
  return linkFormat === 'wikilink'
    ? `![[${destPath}]]`
    : `![${alt}](<${destPath}>)`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseFolders(raw) {
  return raw
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function sanitizeFolderName(name) {
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
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker)
  );
  return results;
}

module.exports = AutoDownloadAttachmentsPlugin;
