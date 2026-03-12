[简体中文说明](https://github.com/chenxiccc/obsidian-auto-download-imgs-after-web-clipping/blob/main/README-CN.md)
# obsidian-auto-download-imgs-after-web-clipping
After you save a webpage using the [web clipper](https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf) plugin in Obsidian, the images on the webpage will not be stored locally but will instead still reference the online image URLs.

I want the images to be saved locally.

There are several solutions for this. For example, you can assign a shortcut key to `editor:download-attachments` to manually download the images to your local device.

However, I hope for a more automated solution. Hence, this plugin was created.

# Plugin Features
This plugin is very simple. When you clip a document using the Web Clipper plugin, it will automatically download the images in the document to your local device in the background.

# Configuration Options
## Folder Monitoring
By default, the plugin is set to monitor the "Clippings" folder (you can modify this or add more folders to monitor). When a new file is created in this folder, the plugin will automatically download the images within the file to your local device.
## Image Save Path
You can adjust the save path of images in the settings:
- Follow the attachment save location of Obsidian (default)
- Create a folder with the same name as the file
- A specified subfolder in the directory where the file is located

# How to Install
## Method 1:
You can download the compressed file from the Release, extract it to the `.obsidian/plugins` directory of Obsidian, then refresh the plugin list in Obsidian and enable it.
## Method 2
Use the BRAT plugin, click the BRAT button in the sidebar, click Add Plugin, and enter the following URL: https://github.com/chenxiccc/obsidian-auto-download-imgs-after-web-clipping
