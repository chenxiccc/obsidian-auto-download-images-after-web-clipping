当你在Obsidian使用[web clipper](https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf)插件保存网页后，网页上的图片不会保存在本地，而是仍然引用了在线的图片URL地址。
我希望图片能够保存在本地。
这有多个方案，比如你可以为editor:download-attachments 分配一个快捷键，手动下载图片到本地。
但我希望更自动化一些。所以有了这个插件。

# 插件功能
这个插件非常简单，当你使用Web Clipper插件剪藏文件后，他会在后台自动帮你把文件中的图片下载到本地。

# 配置项
## 文件夹监听
插件里，默认设置监听Clippings文件夹（你可以修改它，或者添加更多要监听的文件夹），当该文件夹下有新文件创建时，该插件会自动把文件内引用的在线图片下载到本地。
## 图片保存路径
你可以在设置里调整图片的保存路径：跟随Obsidian的附件保存位置（默认）/ 创建文件同名的文件夹 / 文件所在目录的指定子文件夹

# 如何安装 
## 方法1：
你可以下载Release文件的压缩包，解压到obsidian的.obsidian/plugins目录下，之后在obsidian里刷新插件列表，启用。
## 方法2
使用BRAT插件，点击侧边栏的BRAT按钮，点击添加插件，输入https://github.com/chenxiccc/obsidian-auto-download-images-after-web-clipping 
