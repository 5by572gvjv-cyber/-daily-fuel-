# Daily Fuel

私人智能饮食工作台。中文为主、iPhone 优先、本地优先的 PWA。

## 当前阶段

已完成第 04 阶段：完整可视化界面、本机数据保存、备份恢复与单位营养计算。

- 今日仪表盘、食物库、统一记录、历史、分析、设置页面均已可操作；
- 饮食记录与基础食物库保存在本机浏览器 IndexedDB；记录、修改、删除与撤销会同步重新计算今日汇总；
- 可从设置导出 JSON 备份或恢复备份；备份在恢复前会校验版本和数据结构；
- 手动记录可按克、毫升或份计算；毫升仅在食物明确配置密度时才会换算为克，份仅在确认每份重量时可用；
- 支持分别设置训练日与休息日的热量、蛋白质、碳水和脂肪目标，并保存到本机；
- 未调用真实 AI，没有接入云端或上传任何数据；
- 支持 iPhone 紧凑布局与 Mac 侧栏双栏布局，以及浅色、深色和跟随系统主题。
- 今日页与记录页共享饮食助手输入状态；分析页支持单指标、单单位、目标线、缺失数据保留与按需加载；历史页支持完整月历浏览。
- 开发预览提供“电脑 / iPhone 390 × 844”切换：iPhone 模式使用独立 iframe 视口，仅在本地开发环境显示，不会进入生产构建。

## 本地运行

项目使用随项目提供的 Node.js 工具链。进入项目根目录后执行：

```bash
PROJECT_NODE_BIN="$PWD/.tools/node/bin"
env PATH="$PROJECT_NODE_BIN:$PATH" npm run dev -- --host 127.0.0.1
```

浏览器打开命令输出的地址，通常为 `http://127.0.0.1:5173`。

开发模式打开后，页面顶部可切换“电脑”与“iPhone 390 × 844”。iPhone 模式是实际的 390 × 844 CSS 像素 iframe，不会嵌套预览工具栏。

## 本地数据与备份

- 首次打开时，饮食记录为空；基础食物库会保存在本机浏览器中。
- 在“设置 → 本地数据”中导出 JSON 备份，或选择符合版本要求的 JSON 文件恢复。
- 旧版备份可恢复到当前格式；新版备份会同时包含训练日、休息日的营养目标。
- 恢复会替换当前浏览器里的饮食记录和食物库；不会上传到云端。

## 质量检查

```bash
PROJECT_NODE_BIN="$PWD/.tools/node/bin"
env PATH="$PROJECT_NODE_BIN:$PATH" npm run test
env PATH="$PROJECT_NODE_BIN:$PATH" npm run lint
env PATH="$PROJECT_NODE_BIN:$PATH" npm run build
```

## 文档阅读顺序

AGENTS.md → PRD.md → DESIGN.md → DATABASE.md → AI_RULES.md → TASKS.md。
