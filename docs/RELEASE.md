# 开源协作备忘（日后公开仓库时用）

两个原则就够用：

1. **每次可感知的改动**都先写进 `CHANGELOG.md` 的 `[Unreleased]`，发版时再归入版本号章节。
2. **版本号**：修复用补丁（1.1.0 → 1.1.1），功能用次版本（1.1.0 → 1.2.0），不兼容改动用主版本（1.x → 2.0.0）。

Obsidian 插件发版时同步改：

- `package.json` → `version`
- `manifest.json` → `version`
- `versions.json` → 新版本与 `minAppVersion` 映射
- 然后 `npm run build`，把 `main.js` / `manifest.json` / `styles.css` 拷进库

日记桌面端发版时：更新 `CHANGELOG.md`，如需可在 README 顶部改「当前版本」数字。

公开到 GitHub 后，可把 CHANGELOG 底部补上 compare / release 链接。
