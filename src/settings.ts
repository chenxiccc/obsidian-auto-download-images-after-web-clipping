// ─── 国际化 / i18n ─────────────────────────────────────────────────────────

export interface TranslationMap {
  settingTitle:            string;
  pluginDescription:       string;

  langSettingName:         string;
  langSettingDesc:         string;
  langAuto:                string;
  langEn:                  string;
  langZh:                  string;

  folderSettingName:       string;
  folderSettingDesc:       string;
  folderPlaceholder:       string;

  delaySettingName:        string;
  delaySettingDesc:        string;

  pathModeSettingName:     string;
  pathModeSettingDesc:     string;
  pathModeObsidian:        string;
  pathModeCustom:          string;
  pathModeSameName:        string;
  customFolderSettingName: string;
  customFolderSettingDesc: string;
  customFolderPlaceholder: string;

  linkFormatSettingName:   string;
  linkFormatSettingDesc:   string;
  linkFormatObsidian:      string;
  linkFormatShortest:      string;
  linkFormatRelative:      string;
  linkFormatAbsolute:      string;

  noticeSuccess:           (count: number, name: string) => string;
  noticePartial:           (ok: number, fail: number, name: string) => string;
  noticeWriteError:        (name: string) => string;

  consoleFailedUrls:       string;
  consoleReadError:        string;
  consoleWriteBackError:   string;
  console4xx:              (status: number, url: string) => string;
  consoleRetry:            (attempt: number, delay: number, url: string, msg: string) => string;
  consoleGiveUp:           (attempt: number, url: string, msg: string) => string;
  consoleKeepOriginal:     (url: string) => string;
  consoleWriteFailed:      (path: string, err: unknown) => string;
  consoleSkipNonImage:     (type: string, url: string) => string;
  consoleSkipTooSmall:     (bytes: number, url: string) => string;
  consoleRefererResolved:  (referer: string) => string;
  consoleRefererFallback:   string;
  consoleLoaded:            (folders: string) => string;
}

export const TRANSLATIONS: Record<string, TranslationMap> = {
  en: {
    settingTitle:               'Auto Download Images After Clipping',
    pluginDescription:          'Automatically download remote images to local vault after web clipping.',

    langSettingName:            'Language',
    langSettingDesc:            'Interface language. "Auto" follows Obsidian\'s language setting.',
    langAuto:                   'Auto',
    langEn:                     'English',
    langZh:                     '简体中文',

    folderSettingName:          'Watch folders',
    folderSettingDesc:          'Automatically download images when a .md file in these folders is written. One path per line, relative to vault root. e.g. Clippings or ReadItLater/Articles',
    folderPlaceholder:          'Clippings\nReadItLater/Articles',

    delaySettingName:           'Debounce delay (ms)',
    delaySettingDesc:           'Processing starts this long after the last file modification. Increase if images are missed because the clipper is still writing.',

    pathModeSettingName:        'Image save location',
    pathModeSettingDesc:        'Where to save downloaded images.',
    pathModeObsidian:           'Follow Obsidian settings',
    pathModeCustom:             'Custom subfolder under the same directory as the note',
    pathModeSameName:           'Subfolder with the same name as the note (under the same directory)',
    customFolderSettingName:    'Subfolder name',
    customFolderSettingDesc:    'Folder name relative to the note\'s directory. Default: attachments',
    customFolderPlaceholder:    'attachments',

    linkFormatSettingName:      'Image link path format',
    linkFormatSettingDesc:      'How the path inside the embedded image reference is written. "Follow Obsidian settings" mirrors Files & Links → New link format.',
    linkFormatObsidian:         'Follow Obsidian settings',
    linkFormatShortest:         'Shortest path when possible',
    linkFormatRelative:         'Relative path to note',
    linkFormatAbsolute:         'Absolute path in vault',

    noticeSuccess:              (count, name) => `✅ Downloaded ${count} image(s) — ${name}`,
    noticePartial:              (ok, fail, name) => `⚠️ ${name}: ${ok} succeeded, ${fail} failed (original links kept)`,
    noticeWriteError:           (name) => `[AutoDL] Failed to write back to ${name}, check console`,

    consoleFailedUrls:          'The following images failed to download (original links kept):',
    consoleReadError:           'Failed to read file:',
    consoleWriteBackError:      'Failed to write back md file:',
    console4xx:                 (status, url) => `[AutoDL] HTTP ${status}, giving up: ${url}`,
    consoleRetry:               (attempt, delay, url, msg) =>
                                  `[AutoDL] Attempt ${attempt} failed, retrying in ${delay}ms: ${url}\nReason: ${msg}`,
    consoleGiveUp:              (attempt, url, msg) =>
                                  `[AutoDL] Attempt ${attempt} failed, giving up: ${url}\nReason: ${msg}`,
    consoleKeepOriginal:        (url) => `[AutoDL] Download failed, keeping original link: ${url}`,
    consoleWriteFailed:         (path, err) => `[AutoDL] Write failed ${path}: ${String(err)}`,
    consoleSkipNonImage:        (type, url) => `[AutoDL] Non-image response (${type || 'unknown'}), skipping: ${url}`,
    consoleSkipTooSmall:        (bytes, url) => `[AutoDL] File too small (${bytes}B), likely a tracking pixel, skipping: ${url}`,
    consoleRefererResolved:       (referer) => `[AutoDL] Referer resolved from page source: ${referer}`,
    consoleRefererFallback:       '[AutoDL] No page referer found, falling back to image origin',
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

    linkFormatSettingName:      '图片链接路径格式',
    linkFormatSettingDesc:      '嵌入图片时路径的书写方式。「跟随 Obsidian 设置」对应「文件与链接 → 新链接格式」。',
    linkFormatObsidian:         '跟随 Obsidian 设置',
    linkFormatShortest:         '最短路径（尽可能）',
    linkFormatRelative:         '相对路径（相对于笔记）',
    linkFormatAbsolute:         '绝对路径（vault 内）',

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
    consoleWriteFailed:         (path, err) => `[AutoDL] 写入文件失败 ${path}: ${String(err)}`,
    consoleSkipNonImage:        (type, url) => `[AutoDL] 非图片响应（${type || '未知类型'}），跳过: ${url}`,
    consoleSkipTooSmall:        (bytes, url) => `[AutoDL] 文件过小（${bytes}B），疑似追踪像素，跳过: ${url}`,
    consoleRefererResolved:       (referer) => `[AutoDL] 已从页面来源提取 Referer: ${referer}`,
    consoleRefererFallback:       '[AutoDL] 未找到页面 Referer，回退使用图片自身 origin',
    consoleLoaded:              (folders) => `剪藏后自动下载图片：已启动，监听文件夹 → ${folders}`,
  },
};

export function detectObsidianLang(): string {
  const lang = getLanguage();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

// ─── 设置接口 / Settings interface ────────────────────────────────────────

export type AttachmentPathMode = 'obsidian' | 'custom' | 'samename';
export type LinkPathFormat = 'obsidian' | 'shortest' | 'relative' | 'absolute';
export type Language = 'auto' | 'en' | 'zh';

export interface AutoDownloadSettings {
  watchFolders:           string;
  delayMs:                number;
  language:               Language;
  attachmentPathMode:     AttachmentPathMode;
  customAttachmentFolder: string;
  linkPathFormat:         LinkPathFormat;
}

export const DEFAULT_SETTINGS: AutoDownloadSettings = {
  watchFolders:           'Clippings',
  delayMs:                2000,
  language:               'auto',
  attachmentPathMode:     'obsidian',
  customAttachmentFolder: 'attachments',
  linkPathFormat:         'obsidian',
};

// ─── 设置页 / Settings tab ─────────────────────────────────────────────────

import { App, PluginSettingTab, Setting, getLanguage } from 'obsidian';
import type AutoDownloadAttachmentsPlugin from './main';

export class AutoDownloadSettingTab extends PluginSettingTab {
  plugin: AutoDownloadAttachmentsPlugin;

  constructor(app: App, plugin: AutoDownloadAttachmentsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  get t(): TranslationMap {
    const { language } = this.plugin.settings;
    const lang = language === 'auto' ? detectObsidianLang() : language;
    return TRANSLATIONS[lang] ?? TRANSLATIONS['en']!;
  }

  display(): void {
    const { containerEl } = this;
    const t = this.t;
    containerEl.empty();
    new Setting(containerEl).setName(t.settingTitle).setHeading();

    // ── 语言 / Language ──────────────────────────────────────────────────
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
            this.plugin.settings.language = value as Language;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // ── 监听文件夹 / Watch folders ────────────────────────────────────────
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
        text.inputEl.addClass('auto-dl-folder-input');
      });

    // ── 触发延迟 / Debounce delay ─────────────────────────────────────────
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
        text.inputEl.addClass('auto-dl-delay-input');
      });

    // ── 图片保存位置 / Image save location ───────────────────────────────
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
            this.plugin.settings.attachmentPathMode = value as AttachmentPathMode;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // ── 子文件夹名称（仅 custom 模式显示）/ Custom subfolder name ──────────
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
          text.inputEl.addClass('auto-dl-custom-folder-input');
        });
    }

    // ── 图片链接路径格式 / Image link path format ─────────────────────────
    new Setting(containerEl)
      .setName(t.linkFormatSettingName)
      .setDesc(t.linkFormatSettingDesc)
      .addDropdown(drop => {
        drop
          .addOption('obsidian',  t.linkFormatObsidian)
          .addOption('shortest',  t.linkFormatShortest)
          .addOption('relative',  t.linkFormatRelative)
          .addOption('absolute',  t.linkFormatAbsolute)
          .setValue(this.plugin.settings.linkPathFormat)
          .onChange(async (value) => {
            this.plugin.settings.linkPathFormat = value as LinkPathFormat;
            await this.plugin.saveSettings();
          });
      });
  }
}
