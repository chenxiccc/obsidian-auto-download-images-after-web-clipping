/**
 * 将构建产物复制到本地 Obsidian vault，并确保 .hotreload 文件存在
 * Copy build artifacts to the local Obsidian vault and ensure .hotreload exists
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLUGIN_ID = 'auto-download-images-after-web-clipping';
const VAULT_PLUGIN_DIR = `H:/Docs/Obsinote/.obsidian/plugins/${PLUGIN_ID}`;

const FILES = ['main.js', 'manifest.json', 'styles.css'];

if (!existsSync(VAULT_PLUGIN_DIR)) {
  mkdirSync(VAULT_PLUGIN_DIR, { recursive: true });
  console.log(`Created plugin dir: ${VAULT_PLUGIN_DIR}`);
}

for (const file of FILES) {
  if (existsSync(file)) {
    copyFileSync(file, join(VAULT_PLUGIN_DIR, file));
    console.log(`Copied ${file} → ${VAULT_PLUGIN_DIR}`);
  }
}

const hotreload = join(VAULT_PLUGIN_DIR, '.hotreload');
if (!existsSync(hotreload)) {
  writeFileSync(hotreload, '');
  console.log(`Created .hotreload in ${VAULT_PLUGIN_DIR}`);
}
