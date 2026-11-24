# Daily Fuel

私人智能饮食工作台。中文为主、iPhone 优先、本地优先的 PWA。

## 当前阶段

已完成第 01 阶段：React + TypeScript + Vite 项目骨架、Tailwind CSS、浅色/深色主题、移动端底部导航和桌面侧栏布局。没有接入 AI、云端服务、真实饮食数据或演示记录。

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
