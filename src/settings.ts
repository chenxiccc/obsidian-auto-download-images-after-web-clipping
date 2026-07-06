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

  pathModeSettingName:           string;
  pathModeSettingDesc:           string;
  pathModeObsidian:              string;
  pathModeCustom:                string;
  pathModeSameName:              string;
  pathModeCustomTemplate:        string;
  customFolderSettingName:       string;
  customFolderSettingDesc:       string;
  customFolderPlaceholder:       string;
  customTemplateFolderSettingName:  string;
  customTemplateFolderSettingDesc:  string;
  customTemplateFolderPlaceholder:  string;
  imageNameTemplateSettingName:    string;
  imageNameTemplateSettingDesc:    string;
  imageNameTemplatePlaceholder:    string;
  keepOriginalNameSettingName:     string;
  keepOriginalNameSettingDesc:     string;
  previewLabel:                    (preview: string) => string;
  previewNoteName:                 string;
  previewNotePath:                 string;

  contextMenuSettingName:  string;
  contextMenuSettingDesc:  string;
  menuDownloadFolder:      string;
  menuDownloadFile:        string;
  confirmTitle:            string;
  confirmBody:             (files: number, images: number, name: string) => string;
  confirm:                 string;
  cancel:                  string;
  noticeFolderEmpty:       (name: string) => string;
  noticeNoExternal:        (name: string) => string;
  noticeCancelled:         string;
  noticeBatchDone:         (name: string) => string;
  noticeBatchProgress:     (done: number, total: number, name: string) => string;

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

    pathModeSettingName:              'Image save location',
    pathModeSettingDesc:              'Where to save downloaded images.',
    pathModeObsidian:                 'Follow Obsidian settings',
    pathModeCustom:                   'Custom subfolder under the same directory as the note',
    pathModeSameName:                 'Subfolder with the same name as the note (under the same directory)',
    pathModeCustomTemplate:           'Custom path template',
    customFolderSettingName:          'Subfolder name',
    customFolderSettingDesc:          'Folder name relative to the note\'s directory. Default: attachments',
    customFolderPlaceholder:          'attachments',
    customTemplateFolderSettingName:  'Path template',
    customTemplateFolderSettingDesc:  'Where to save images, starting from the vault root. Use {notename} for the note name, {notepath} for the note\'s folder, {date:FORMAT} for the date (e.g. {date:YYYY-MM} becomes 2026-08). Extension is added automatically.',
    customTemplateFolderPlaceholder:  'assets/{date:YYYY-MM}/{notename}',
    imageNameTemplateSettingName:     'Image filename template',
    imageNameTemplateSettingDesc:     'Use {notename} for the note name, {index:NNN} for a numeric suffix (e.g. {index:01} gives a two-digit counter starting from 01), {date:FORMAT} for the date. Extension is added automatically.',
    imageNameTemplatePlaceholder:     '{notename}-img-p{index:001}',
    keepOriginalNameSettingName:      'Keep original note name',
    keepOriginalNameSettingDesc:      'When on, spaces in the note name are preserved instead of being converted to dashes. Characters illegal on the filesystem (\\ / : * ? " < > |) are always replaced.',
    previewLabel:                     (preview) => `→ ${preview}`,
    previewNoteName:                  'Note name',
    previewNotePath:                  'note/folder',

    contextMenuSettingName:     'Add right-click menu',
    contextMenuSettingDesc:     'Add a context-menu item to files and folders to download their external image links on demand.',
    menuDownloadFolder:         'Download external images in this folder',
    menuDownloadFile:           'Download external images in this file',
    confirmTitle:               'Confirm download',
    confirmBody:                (files, images, name) => `Found ${images} external image(s) across ${files} markdown file(s) under "${name}". Download them all?`,
    confirm:                    'Download',
    cancel:                     'Cancel',
    noticeFolderEmpty:          (name) => `No markdown files under "${name}"`,
    noticeNoExternal:           (name) => `No external images found under "${name}"`,
    noticeCancelled:            'Cancelled',
    noticeBatchDone:            (name) => `Finished downloading external images in "${name}"`,
    noticeBatchProgress:        (done, total, name) => `Downloaded external images in ${done}/${total} file(s) under "${name}"...`,

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

    pathModeSettingName:              '图片保存位置',
    pathModeSettingDesc:              '下载的图片保存到哪里。',
    pathModeObsidian:                 '跟随 Obsidian 设置',
    pathModeCustom:                   '笔记所在目录下的指定子文件夹',
    pathModeSameName:                 '笔记所在目录下与笔记同名的子文件夹',
    pathModeCustomTemplate:           '自定义路径模板',
    customFolderSettingName:          '子文件夹名称',
    customFolderSettingDesc:          '相对于笔记所在目录的子文件夹名称，默认为 attachments',
    customFolderPlaceholder:          'attachments',
    customTemplateFolderSettingName:  '路径模板',
    customTemplateFolderSettingDesc:  '图片保存的位置，从库的根目录开始。可用 {notename} 代表笔记名，{notepath} 代表笔记所在文件夹，{date:日期格式} 代表日期（如 {date:YYYY-MM} 会转为如 2026-08 的年月形式）。',
    customTemplateFolderPlaceholder:  'assets/{date:YYYY-MM}/{notename}',
    imageNameTemplateSettingName:     '图片文件名模板',
    imageNameTemplateSettingDesc:     '图片文件名模板。可用 {notename} 代表笔记名，{index:NNN} 数字后缀（如 {index:01} 代表从 01 开始的两位数字序号），同样可以使用 {date:日期格式}。不需要填写后缀名。',
    imageNameTemplatePlaceholder:     '{notename}-img-p{index:001}',
    keepOriginalNameSettingName:      '保持原始笔记名',
    keepOriginalNameSettingDesc:      '开启后，笔记名中的空格将被保留，不再转为短横。文件系统非法字符（\\ / : * ? " < > |）始终会被替换。',
    previewLabel:                     (preview) => `→ ${preview}`,
    previewNoteName:                  '笔记名',
    previewNotePath:                  '笔记文件夹',

    contextMenuSettingName:     '添加右键菜单',
    contextMenuSettingDesc:     '给文件和文件夹添加右键菜单项，按需下载其中的外部图片链接。',
    menuDownloadFolder:         '下载该文件夹的外部图片',
    menuDownloadFile:           '下载该文件的外部图片',
    confirmTitle:               '确认下载',
    confirmBody:                (files, images, name) => `在「${name}」下发现 ${images} 张外部图片，分布于 ${files} 个 Markdown 文件。是否全部下载？`,
    confirm:                    '下载',
    cancel:                     '取消',
    noticeFolderEmpty:          (name) => `「${name}」下没有 Markdown 文件`,
    noticeNoExternal:           (name) => `「${name}」下没有外部图片`,
    noticeCancelled:            '已取消',
    noticeBatchDone:            (name) => `已完成「${name}」中外部图片的下载`,
    noticeBatchProgress:        (done, total, name) => `正在下载「${name}」中的外部图片：${done}/${total} 个文件已完成……`,

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

export type AttachmentPathMode = 'obsidian' | 'custom' | 'samename' | 'customTemplate';
export type Language = 'auto' | 'en' | 'zh';

export interface AutoDownloadSettings {
  watchFolders:           string;
  delayMs:                number;
  language:               Language;
  attachmentPathMode:     AttachmentPathMode;
  customAttachmentFolder: string;
  customTemplateFolder:   string;
  imageNameTemplate:      string;
  keepOriginalNoteName:   boolean;
  enableContextMenu:      boolean;
}

export const DEFAULT_SETTINGS: AutoDownloadSettings = {
  watchFolders:           'Clippings',
  delayMs:                2000,
  language:               'auto',
  attachmentPathMode:     'obsidian',
  customAttachmentFolder: 'attachments',
  customTemplateFolder:   '_global/assets/{date:YYYY-MM}',
  imageNameTemplate:      '{notename}-img-p{index:001}',
  keepOriginalNoteName:   false,
  enableContextMenu:      false,
};

// ─── 设置页 / Settings tab ─────────────────────────────────────────────────

import { App, PluginSettingTab, Setting, getLanguage } from 'obsidian';
import type AutoDownloadAttachmentsPlugin from './main';
import { formatDateToken, formatNameTemplate } from './main';

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

  // 将模板渲染为预览字符串（{notename}/{notepath} 替换为占位词，其他 token 正常展开）
  // Render a template to a preview string ({notename}/{notepath} → placeholder words, other tokens expanded normally)
  private buildPreview(template: string, t: TranslationMap, mode: 'filename' | 'path'): string {
    const keepSpaces = this.plugin.settings.keepOriginalNoteName;
    const namePH   = t.previewNoteName;
    const pathPH   = t.previewNotePath;
    // 用哨兵字符替换两个 notename/notepath 占位符，展开其余 token 后再换回
    // Use sentinel chars to replace notename/notepath, expand other tokens, then restore
    const sentinel = (tpl: string) =>
      tpl.replace(/{notepath}/g, '\x01').replace(/{notename}/g, '\x00');
    const restore  = (s: string) =>
      s.replace(/\x01/g, pathPH).replace(/\x00/g, namePH);

    if (mode === 'path') {
      // 路径模式：按段展开，保留 /
      // Path mode: expand per-segment, preserve /
      const segments = template.replace(/\\/g, '/').split('/').filter(s => s.length > 0);
      const expanded = segments.map(seg => restore(formatNameTemplate(sentinel(seg), '\x00', 0, keepSpaces)));
      return expanded.join('/');
    }
    // 文件名模式：整体展开
    // Filename mode: expand as a whole
    return restore(formatNameTemplate(sentinel(template), '\x00', 0, keepSpaces)) + '.webp';
  }

  // 将预览行插入到 .setting-item-description 之后（或直接更新已有节点）
  // Insert (or update) the preview line right after .setting-item-description
  private attachPreview(settingEl: HTMLElement, text: string): HTMLElement {
    let el = settingEl.querySelector<HTMLElement>('.auto-dl-live-preview');
    if (!el) {
      el = activeDocument.createElement('div');
      el.className = 'auto-dl-live-preview';
      el.style.fontFamily = 'var(--font-monospace)';
      el.style.color = 'var(--text-accent)';
      el.style.fontSize = 'var(--font-smallest)';
      el.style.marginTop = '4px';
      // 插到 .setting-item-description 之后，没有则追加到 settingEl 末尾
      // Insert after .setting-item-description; fall back to appending to settingEl
      const desc = settingEl.querySelector('.setting-item-description');
      if (desc?.parentNode) {
        desc.parentNode.insertBefore(el, desc.nextSibling);
      } else {
        settingEl.appendChild(el);
      }
    }
    el.textContent = text;
    return el;
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
        const ctrl = text.inputEl.parentElement;
        if (ctrl) ctrl.style.flex = '0 0 auto';
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
          .addOption('obsidian',        t.pathModeObsidian)
          .addOption('custom',          t.pathModeCustom)
          .addOption('samename',        t.pathModeSameName)
          .addOption('customTemplate',  t.pathModeCustomTemplate)
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

    // ── 路径模板（仅 customTemplate 模式显示）/ Path template ──────────────
    if (this.plugin.settings.attachmentPathMode === 'customTemplate') {
      const pathTemplateSetting = new Setting(containerEl)
        .setName(t.customTemplateFolderSettingName)
        .setDesc(t.customTemplateFolderSettingDesc)
        .addText(text => {
          text
            .setPlaceholder(t.customTemplateFolderPlaceholder)
            .setValue(this.plugin.settings.customTemplateFolder)
            .onChange(async (value) => {
              this.plugin.settings.customTemplateFolder = value.trim() || '_global/assets/{date:YYYY-MM}';
              await this.plugin.saveSettings();
              this.attachPreview(
                pathTemplateSetting.settingEl,
                t.previewLabel(this.buildPreview(this.plugin.settings.customTemplateFolder, t, 'path'))
              );
            });
          text.inputEl.addClass('auto-dl-template-folder-input');
        });
      // 初始预览 | Initial preview
      this.attachPreview(
        pathTemplateSetting.settingEl,
        t.previewLabel(this.buildPreview(this.plugin.settings.customTemplateFolder, t, 'path'))
      );
    }

    // ── 图片文件名模板 / Image filename template ──────────────────────────
    const nameSetting = new Setting(containerEl)
      .setName(t.imageNameTemplateSettingName)
      .setDesc(t.imageNameTemplateSettingDesc)
      .addText(text => {
        text
          .setPlaceholder(t.imageNameTemplatePlaceholder)
          .setValue(this.plugin.settings.imageNameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.imageNameTemplate = value.trim() || '{notename}-{index:001}';
            await this.plugin.saveSettings();
            this.attachPreview(
              nameSetting.settingEl,
              t.previewLabel(this.buildPreview(this.plugin.settings.imageNameTemplate, t, 'filename'))
            );
          });
        text.inputEl.addClass('auto-dl-image-name-input');
      });
    // 初始预览 | Initial preview
    this.attachPreview(
      nameSetting.settingEl,
      t.previewLabel(this.buildPreview(this.plugin.settings.imageNameTemplate, t, 'filename'))
    );

    // ── 保持原始笔记名 / Keep original note name ─────────────────────────
    new Setting(containerEl)
      .setName(t.keepOriginalNameSettingName)
      .setDesc(t.keepOriginalNameSettingDesc)
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.keepOriginalNoteName)
          .onChange(async (value) => {
            this.plugin.settings.keepOriginalNoteName = value;
            await this.plugin.saveSettings();
            // 开关变化影响预览，整页刷新以同步所有预览
            // The toggle affects previews; refresh the whole page to sync them
            this.display();
          });
      });

    // ── 右键菜单 / Context menu ──────────────────────────────────────────
    new Setting(containerEl)
      .setName(t.contextMenuSettingName)
      .setDesc(t.contextMenuSettingDesc)
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.enableContextMenu)
          .onChange(async (value) => {
            this.plugin.settings.enableContextMenu = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
