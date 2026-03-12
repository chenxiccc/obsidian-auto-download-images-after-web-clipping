const { Plugin, PluginSettingTab, Setting, Notice, normalizePath } = require('obsidian');

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
    folderSettingDesc:          'Automatically download images when a new .md file is created in these folders. One path per line, relative to vault root. e.g. Clippings or ReadItLater/Articles',
    folderPlaceholder:          'Clippings\nReadItLater/Articles',

    // Delay
    delaySettingName:           'Trigger delay (ms)',
    delaySettingDesc:           'How long to wait after file creation before downloading. Increase if files are sometimes not fully written yet.',

    // Attachment path mode
    pathModeSettingName:        'Image save location',
    pathModeSettingDesc:        'Where to save downloaded images.',
    pathModeObsidian:           'Follow Obsidian settings',
    pathModeCustom:             'Custom subfolder under the same directory as the note',
    pathModeSameName:           'Subfolder with the same name as the note (under the same directory)',
    customFolderSettingName:    'Subfolder name',
    customFolderSettingDesc:    'Folder name relative to the note\'s directory. Default: attachments',
    customFolderPlaceholder:    'attachments',

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
    folderSettingDesc:          '在这些文件夹内新建 .md 文件时，自动下载文中图片。每行一个路径（相对于 vault 根目录），例如：Clippings 或 ReadItLater/Articles',
    folderPlaceholder:          'Clippings\nReadItLater/Articles',

    delaySettingName:           '触发延迟（毫秒）',
    delaySettingDesc:           '文件创建后等待多久再开始下载。如果经常出现文件未写完的问题，可适当调大此值。',

    pathModeSettingName:        '图片保存位置',
    pathModeSettingDesc:        '下载的图片保存到哪里。',
    pathModeObsidian:           '跟随 Obsidian 设置',
    pathModeCustom:             '笔记所在目录下的指定子文件夹',
    pathModeSameName:           '笔记所在目录下与笔记同名的子文件夹',
    customFolderSettingName:    '子文件夹名称',
    customFolderSettingDesc:    '相对于笔记所在目录的子文件夹名称，默认为 attachments',
    customFolderPlaceholder:    'attachments',

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
  }
}

// ─── 主插件 ────────────────────────────────────────────────────────────────

class AutoDownloadAttachmentsPlugin extends Plugin {

  get t() {
    const { language } = this.settings;
    const lang = language === 'auto' ? detectObsidianLang() : language;
    return TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AutoDownloadSettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (!file.path.endsWith('.md')) return;
        if (!this.isWatched(file.path)) return;

        await sleep(this.settings.delayMs);
        await this.downloadImagesInFile(file);
      })
    );

    const folders = parseFolders(this.settings.watchFolders).join(', ');
    console.log(this.t.consoleLoaded(folders));
  }

  isWatched(filePath) {
    return parseFolders(this.settings.watchFolders).some(folder => {
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
    const t = this.t;

    let content;
    try {
      content = await this.app.vault.read(file);
    } catch (err) {
      console.error(t.consoleReadError, err);
      return;
    }

    const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
    const matches = [...content.matchAll(imageRegex)];
    if (matches.length === 0) return;

    const attachmentFolder = await this.resolveAttachmentFolder(file);
    await this.ensureFolder(attachmentFolder);

    const titleBase = file.basename
      .replace(/\s+/g, '-')
      .replace(/[\\/:*?"<>|]/g, '_');

    let updatedContent = content;
    let index = 1;
    let successCount = 0;
    const failedUrls = [];

    for (const match of matches) {
      const [fullMatch, alt, url] = match;

      const ext = this.extractExt(url);
      const safeFilename = `${titleBase}-${index}${ext}`
        .replace(/\s+/g, '-')
        .replace(/[\\:*?"<>|]/g, '_');
      const destPath = normalizePath(`${attachmentFolder}/${safeFilename}`);

      const arrayBuffer = await this.fetchWithRetry(url, 3);

      if (arrayBuffer === null) {
        failedUrls.push(url);
        console.warn(t.consoleKeepOriginal(url));
        index++;
        continue;
      }

      try {
        await this.app.vault.adapter.writeBinary(destPath, arrayBuffer);
      } catch (err) {
        failedUrls.push(url);
        console.error(t.consoleWriteFailed(destPath, err));
        index++;
        continue;
      }

      const localRef = `![${alt}](<${destPath}>)`;
      updatedContent = updatedContent.replace(fullMatch, localRef);
      successCount++;
      index++;
    }

    if (updatedContent !== content) {
      try {
        await this.app.vault.modify(file, updatedContent);
      } catch (err) {
        console.error(t.consoleWriteBackError, err);
        new Notice(t.noticeWriteError(file.basename));
        return;
      }
    }

    if (failedUrls.length === 0) {
      new Notice(t.noticeSuccess(successCount, file.basename));
    } else {
      new Notice(t.noticePartial(successCount, failedUrls.length, file.basename), 8000);
      console.warn(t.consoleFailedUrls + '\n' + failedUrls.join('\n'));
    }
  }

  async fetchWithRetry(url, maxRetries = 3) {
    const t = this.t;
    const RETRY_DELAY_MS = 1500;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const resp = await fetch(url, {
          headers: {
            'Referer': new URL(url).origin,
            'User-Agent': 'Mozilla/5.0',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          if (resp.status >= 400 && resp.status < 500) {
            console.warn(t.console4xx(resp.status, url));
            return null;
          }
          throw new Error(`HTTP ${resp.status}`);
        }

        return await resp.arrayBuffer();

      } catch (err) {
        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt) {
          console.warn(t.consoleGiveUp(attempt, url, err.message));
          return null;
        }
        console.warn(t.consoleRetry(attempt, RETRY_DELAY_MS, url, err.message));
        await sleep(RETRY_DELAY_MS);
      }
    }

    return null;
  }

  async ensureFolder(folderPath) {
    if (!folderPath || folderPath === '/') return;
    const exists = await this.app.vault.adapter.exists(folderPath);
    if (!exists) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  extractExt(url) {
    const clean = url.split('?')[0].split('#')[0];
    const m = clean.match(/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i);
    return m ? `.${m[1].toLowerCase()}` : '.jpg';
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────

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

module.exports = AutoDownloadAttachmentsPlugin;
