# Auto Download Images After Web Clipping

[English](#english) | [中文](#中文)

---

## English

When you use the [Obsidian Web Clipper](https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf) to save a webpage, images are not saved locally — they remain as remote URLs. This plugin automatically downloads those images and replaces the remote URLs with local references.

### Installation

Install from Obsidian Community Plugins: [Auto Download Images After Web Clipping](https://community.obsidian.md/plugins/auto-download-images-after-web-clipping)

### Features

- Automatically detects new web-clipped markdown files
- Downloads all remote images in the background
- Supports both Markdown image syntax (`![](url)`) and HTML `<img>` tags
- **Hotlink bypass**: Uses the page source URL (from frontmatter) as Referer to bypass CDN hotlink protection
- Desktop only (requires Node.js `https` module)

### Configuration

**Folder Monitoring** — By default, monitors the `Clippings` folder. You can add more folders.

**Image Save Path** — Four modes:
- Follow Obsidian's attachment settings (default)
- Create a subfolder named after the file
- Custom subfolder relative to the file's directory
- Custom path template (from vault root) — supports `{date:FORMAT}` and `{notename}` tokens, e.g. `_global/assets/{date:YYYY-MM}`

**Image Filename Template** — Customize the downloaded image filename with tokens:
- `{notename}` — the note's basename
- `{index:NNN}` — zero-padded index; the number of digits is the padding width and the numeric value is the start, e.g. `{index:000}` → 000,001,002… (start from 0) or `{index:001}` → 001,002,003… (start from 1)
- `{date:FORMAT}` — download date, e.g. `{date:YYYY-MM-DD}`
- The file extension is added automatically from the downloaded image's type

Default: `{notename}-img-p{index:001}` → e.g. `My Note-img-p001.webp`

---

## 中文

使用 [Obsidian Web Clipper](https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf) 剪藏网页时，图片不会保存到本地，仍然引用在线 URL。此插件会自动下载这些图片并替换为本地引用。

### 安装

从 Obsidian 社区插件市场安装：[Auto Download Images After Web Clipping](https://community.obsidian.md/plugins/auto-download-images-after-web-clipping)

### 功能

- 自动检测新剪藏的 Markdown 文件
- 后台下载文件中所有远程图片
- 支持 Markdown 图片语法和 HTML `<img>` 标签
- **防盗链破解**：使用页面来源 URL（frontmatter 中的 source 字段）作为 Referer，绕过 CDN 防盗链
- 仅桌面端（依赖 Node.js `https` 模块）

### 配置

**文件夹监听** — 默认监听 `Clippings` 文件夹，可添加更多。

**图片保存路径** — 四种模式：
- 跟随 Obsidian 附件设置（默认）
- 创建与文件同名的子文件夹
- 文件所在目录下的自定义子文件夹
- 自定义路径模板（从 vault 根目录开始）—— 支持 `{date:格式}` 和 `{notename}` 占位符，例如 `_global/assets/{date:YYYY-MM}`

**图片文件名模板** — 用占位符自定义下载后的图片文件名：
- `{notename}` —— 笔记名（不含扩展名）
- `{index:NNN}` —— 补零序号；位数即补零宽度，数值即起始值。例如 `{index:000}` → 000,001,002…（从 0 开始）；`{index:001}` → 001,002,003…（从 1 开始）
- `{date:格式}` —— 下载日期，例如 `{date:YYYY-MM-DD}`
- 文件扩展名根据下载图片的实际类型自动追加

默认：`{notename}-img-p{index:001}` → 例如 `我的笔记-img-p001.webp`
