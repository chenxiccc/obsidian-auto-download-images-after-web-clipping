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

**Image Save Path** — Three modes:
- Follow Obsidian's attachment settings (default)
- Create a subfolder named after the file
- Custom subfolder relative to the file's directory

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

**图片保存路径** — 三种模式：
- 跟随 Obsidian 附件设置（默认）
- 创建与文件同名的子文件夹
- 文件所在目录下的自定义子文件夹
