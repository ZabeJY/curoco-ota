#!/usr/bin/env node
/**
 * 发布热更新到 GitHub Pages
 *
 * 使用方法：
 *   node scripts/publish-update.js [version] [changelog]
 *
 * 示例：
 *   node scripts/publish-update.js 1.7.4 "修复TTS空文本问题"
 *
 * 前提条件：
 *   1. 创建 curoco-updates 仓库并启用 GitHub Pages
 *   2. 配置 GitHub Token 环境变量 (GH_TOKEN)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const UPDATES_REPO = 'ZabeJY/curoco-ota';
const UPDATES_DIR = path.join(__dirname, '../temp-updates');
const DIST_DIR = path.join(__dirname, '../dist');

// 获取参数
const version = process.argv[2] || require('../app.json').expo.version;
const changelog = process.argv[3] || 'Bug fixes and improvements';
const buildTime = new Date().toISOString();

console.log(`\n🚀 准备发布热更新 v${version}`);
console.log(`📝 变更说明: ${changelog}\n`);

// 清理临时目录
if (fs.existsSync(UPDATES_DIR)) {
  fs.rmSync(UPDATES_DIR, { recursive: true });
}
fs.mkdirSync(UPDATES_DIR, { recursive: true });

// 1. 打包 JS Bundle
console.log('📦 正在打包 JS Bundle...');
try {
  // 使用 expo export 导出 web bundle (包含所有JS代码)
  execSync('npx expo export --platform android --output-dir temp-bundle', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });

  // 复制 bundle 到更新目录
  const bundleDir = path.join(__dirname, '../temp-bundle');
  if (fs.existsSync(bundleDir)) {
    // 复制所有文件到更新目录
    execSync(`cp -r ${bundleDir}/* ${UPDATES_DIR}/`, { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ 打包失败:', error.message);
  process.exit(1);
}

// 2. 创建 manifest.json
const manifest = {
  version,
  buildTime,
  changelog,
  runtimeVersion: version,
  bundleUrl: `https://zabejy.github.io/curoco-updates/bundle.js`,
  platform: 'android',
};

fs.writeFileSync(
  path.join(UPDATES_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log('✅ Manifest 创建完成');

// 3. 上传到 GitHub Pages
console.log('\n📤 正在上传到 GitHub Pages...');

try {
  // 初始化 git 仓库
  execSync('git init', { cwd: UPDATES_DIR, stdio: 'pipe' });
  execSync('git checkout -b gh-pages', { cwd: UPDATES_DIR, stdio: 'pipe' });
  execSync('git add -A', { cwd: UPDATES_DIR, stdio: 'pipe' });
  execSync(`git commit -m "Update v${version}: ${changelog}"`, { cwd: UPDATES_DIR, stdio: 'pipe' });

  // 推送到 GitHub
  const remoteUrl = `https://github.com/${UPDATES_REPO}.git`;
  execSync(`git remote add origin ${remoteUrl}`, { cwd: UPDATES_DIR, stdio: 'pipe' });

  if (process.env.GH_TOKEN) {
    // 使用 token 推送
    const authUrl = remoteUrl.replace('https://', `https://x-access-token:${process.env.GH_TOKEN}@`);
    execSync(`git remote set-url origin ${authUrl}`, { cwd: UPDATES_DIR, stdio: 'pipe' });
  }

  execSync('git push -f origin gh-pages', { cwd: UPDATES_DIR, stdio: 'pipe' });

  console.log('\n✅ 热更新发布成功！');
  console.log(`🌐 更新地址: https://zabejy.github.io/curoco-updates/manifest.json`);
  console.log(`📱 用户下次打开 App 将自动获取更新\n`);

} catch (error) {
  console.error('\n❌ 上传失败:', error.message);
  console.log('\n请确保:');
  console.log('1. 已创建 curoco-updates 仓库');
  console.log('2. 已启用 GitHub Pages (gh-pages 分支)');
  console.log('3. 已配置 GH_TOKEN 环境变量');
  process.exit(1);
}

// 清理
console.log('🧹 清理临时文件...');
try {
  fs.rmSync(UPDATES_DIR, { recursive: true });
  const bundleDir = path.join(__dirname, '../temp-bundle');
  if (fs.existsSync(bundleDir)) {
    fs.rmSync(bundleDir, { recursive: true });
  }
} catch {}

console.log('✨ 完成！\n');
