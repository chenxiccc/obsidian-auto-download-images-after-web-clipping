[中文说明](https://github.com/chenxiccc/obsidian-auto-download-imgs-after-web-clipping/blob/main/README-CN.md)
# obsidian-auto-download-imgs-after-web-clipping
When you use the [web clipper](https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf) plugin in Obsidian to save a webpage, the images on the webpage will not be saved locally and will still reference the online image URL addresses.  
I want the images to be saved locally.  
There are several solutions. For example, you can assign a shortcut key to `editor:download-attachments` to manually download the images to your local device.  
However, I hope for something more automated. So this plugin was created.

# Plugin Features

This plugin is very simple. When you clip a document using the Web Clipper plugin, it will automatically download the images in the document to your local device in the background.

# Configuration Options

## Folder Monitoring

By default, the plugin is set to monitor the "Clippings" folder (you can modify it or add more folders to monitor). When a new file is created in this folder, the plugin will automatically download the images inside the file to your local device.

## Image Save Path

You can adjust the save path of images in the settings:  
Follow Obsidian's attachment save location (default)  
Create a folder with the same name as the file  
A specified subfolder in the directory where the file is located

# How to Install

## Method 1:

You can download the compressed file from Releases, extract it to the `.obsidian/plugins` directory in Obsidian, then refresh the plugin list in Obsidian and enable it.

## Method 2

Use the BRAT plugin, click the BRAT button in the sidebar, click Add Plugin, and enter: [https://github.com/chenxiccc/obsidian-auto-download-imgs-after-web-clipping](https://github.com/chenxiccc/obsidian-auto-download-imgs-after-web-clipping)

# License
This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
