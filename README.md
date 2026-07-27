# 日记待办看板（Obsidian 插件）

从日记里的**有序列表**自动抽取待办，汇总到独立侧边栏看板管理完成状态。  
日记原文保持干净可读：不打开看板时，正文里没有额外 UI；完成操作只在看板侧进行，插件回写 `**【已完成】**` 标记。

当前版本：**1.2.0** · 变更记录见 [CHANGELOG.md](./CHANGELOG.md) · 许可 [MIT](./LICENSE)

## 三条铁律

1. **原文阅读体验不受影响** — 不在预览里划掉/淡出
2. **已完成事项保留在原位** — 只追加标记，不删不藏
3. **只抽取不删除** — 看板是引用与展示，不改原文结构

## 抽取规则

默认使用 `【】` 标记（可在设置中改成 `[]`、`〈〉` 等）：

| 原文（默认规则） | 是否进入看板 |
|------|----------------|
| `1. 【未完成】跟进文件审批` | ✅ |
| `1. **【持续中】** 还在推进` | ✅ |
| `1. 【待观察】观察指标` | ✅ |
| `1. 【已完成】联系老王` / `**【已完成】** …` | ❌ |
| `1. 没有【】标记的有序列表` | ❌ |
| `- 无序列表` / 段落 / 引用 / 代码块 | ❌ |

完成回写：把句首标记换成加粗的已完成文案（默认 `**【已完成】**`，可关加粗 / 改文案）：

```text
1. 【未完成】联系老王确认参数
→
1. **【已完成】**联系老王确认参数
```

## 安装

### 方式 A：本地开发 / 手动安装

1. 安装依赖并构建：

```powershell
# 在项目根目录执行
npm install
npm run build
```

2. 在 Obsidian 库中创建插件目录，并复制构建产物：

```text
<你的库>/.obsidian/plugins/obsidian-diary-todo-board/
  ├── main.js          ← 构建生成
  ├── manifest.json
  └── styles.css
```

PowerShell 示例：

```powershell
$vaultPlugin = "D:\Path\To\Vault\.obsidian\plugins\obsidian-diary-todo-board"
New-Item -ItemType Directory -Force -Path $vaultPlugin | Out-Null
Copy-Item manifest.json, styles.css, main.js $vaultPlugin -Force
```

3. 打开 Obsidian → 设置 → 社区插件 → 关闭安全模式 → 启用 **日记待办看板**

### 方式 B：开发监听

```powershell
npm run dev
```

将本项目目录（或 junction）放到库的 `plugins/obsidian-diary-todo-board`，改代码会自动重新打包 `main.js`。

## 使用

1. **设置** → **日记待办看板** → 填写「日记文件夹路径」（必填，相对库根，**不递归**子文件夹）
2. 可选填写「附加文件夹」（逗号分隔）
3. 左侧丝带图标 / 命令「打开日记待办看板」打开面板
4. 点 **刷新** 扫描；点 **完成** 写回原文并移出看板

命令面板：

- `打开日记待办看板`
- `刷新日记待办看板`

## 项目结构

```text
obsidian-diary-todo-board/
├── manifest.json
├── package.json
├── esbuild.config.mjs
├── styles.css
├── src/
│   ├── main.ts        # 插件入口
│   ├── settings.ts    # 设置页
│   ├── extract.ts     # 抽取 / 回写规则
│   ├── scanner.ts     # 扫描文件夹
│   └── view.ts        # 侧边栏看板
└── README.md
```

## 第一版不做

- 不实时监听文件变化（手动刷新）
- 不按标签筛选 / 不拖拽排序
- 不抽取无序列表
- 卸载时不清理原文标记

## 验收对照

1. 设置页配置日记文件夹  
2. 看板显示自动抽取的待办，并重新编号  
3. 点完成 → 看板移除 + 原文插入 `【已完成】`  
4. 再刷新 → 已完成项不再出现  
