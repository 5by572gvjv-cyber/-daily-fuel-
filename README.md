# Daily Fuel

私人智能饮食工作台。中文为主、iPhone 优先、本地优先的 PWA。

## 当前阶段

已完成第 02 阶段及 02.1 收尾优化：完整可视化界面与交互原型。

- 今日仪表盘、食物库、统一记录、历史、分析、设置页面均已可操作；
- 使用同一套内存 mock 数据，记录、修改、删除与撤销会同步重新计算今日汇总；
- 明确标识“演示数据”和“未调用真实 AI”；没有建立数据库、接入云端或上传任何数据；
- 支持 iPhone 紧凑布局与 Mac 侧栏双栏布局，以及浅色、深色和跟随系统主题。
- 今日页与记录页共享饮食助手输入状态；分析页支持单指标、单单位、目标线、缺失数据保留与按需加载；历史页支持完整月历浏览。

## 本地运行

项目使用随项目提供的 Node.js 工具链。进入项目根目录后执行：

```bash
PROJECT_NODE_BIN="$PWD/.tools/node/bin"
env PATH="$PROJECT_NODE_BIN:$PATH" npm run dev -- --host 127.0.0.1
```

浏览器打开命令输出的地址，通常为 `http://127.0.0.1:5173`。

## 质量检查

```bash
PROJECT_NODE_BIN="$PWD/.tools/node/bin"
env PATH="$PROJECT_NODE_BIN:$PATH" npm run test
env PATH="$PROJECT_NODE_BIN:$PATH" npm run lint
env PATH="$PROJECT_NODE_BIN:$PATH" npm run build
```

## 文档阅读顺序

AGENTS.md → PRD.md → DESIGN.md → DATABASE.md → AI_RULES.md → TASKS.md。
