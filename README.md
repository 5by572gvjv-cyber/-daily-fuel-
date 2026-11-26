# Daily Fuel

私人智能饮食工作台。中文为主、iPhone 优先、本地优先的 PWA。

## 当前阶段

第 06 阶段已完成部署：应用已发布到 GitHub Pages 的固定 HTTPS 地址，可用 iPhone Safari 打开并「添加到主屏幕」。

在线地址：**https://5by572gvjv-cyber.github.io/-daily-fuel-/**

- 今日仪表盘、食物库、统一记录、历史、分析、设置页面均已可操作；
- 饮食记录与基础食物库保存在本机浏览器 IndexedDB；记录、修改、删除与撤销会同步重新计算今日汇总；
- 可从设置导出 JSON 备份或恢复备份；备份在恢复前会校验版本和数据结构；
- 手动记录可按克、毫升或份计算；毫升仅在食物明确配置密度时才会换算为克，份仅在确认每份重量时可用；
- 支持分别设置训练日与休息日的热量、蛋白质、碳水和脂肪目标，并保存到本机；
- 食物库可创建私人菜谱：按两种原料、成品重量和实际食用量生成营养快照，并保存到本机食物库以便复用；估算记录会保留热量上下限和中心值，不会伪装成精确数据；
- 饮食助手仅作本地规则解析：只接受已有食物与明确数量，先展示拆解并由用户确认后保存；未知食物、缺失单位与重复请求不会写入，始终可回退至手动记录；
- 未调用真实 AI，没有接入云端或上传任何数据；
- 支持 iPhone 紧凑布局与 Mac 侧栏双栏布局，以及浅色、深色和跟随系统主题；主题选择保存在本机 `localStorage`，刷新或从主屏重开后保持，页面底色（橡皮筋区域）同步跟随，不会在深色下闪出浅色。
- 今日页与记录页共享饮食助手输入状态；分析页支持单指标、单单位、目标线、缺失数据保留与按需加载；历史页支持完整月历浏览。
- 开发预览提供“电脑 / iPhone 390 × 844”切换：iPhone 模式使用独立 iframe 视口，仅在本地开发环境显示，不会进入生产构建。

## PWA 与离线使用

- 生产构建会注册本地 Service Worker：首次在线打开后，会缓存应用壳与已经访问过的同源静态资源；之后断网仍可打开已缓存的应用页面，饮食数据继续保存在本机 IndexedDB。
- 断网时页面会明确提示“记录仍会保存到这台设备”；联网后不自动上传任何记录。
- 主屏图标使用 PNG（`public/icons/`），因为 iOS 不支持 SVG 的 `apple-touch-icon`；`manifest.webmanifest` 同时提供 192/512 与 maskable 图标。
- Service Worker 只缓存同源静态资源，作用域为站点子路径 `/-daily-fuel-/`；缓存版本号在 `public/sw.js` 中，改动资源后可递增。

## 在 iPhone 上安装（添加到主屏幕）

1. 用 iPhone 的 **Safari**（不是微信或夸克内置浏览器）打开 <https://5by572gvjv-cyber.github.io/-daily-fuel-/>。
2. 等页面完全加载一次：首次在线打开会注册离线缓存，之后断网也能打开应用壳。
3. 点击底部工具栏的「分享」按钮，在菜单中选择「**添加到主屏幕**」。
4. 确认名称为「Daily Fuel」后点「添加」。桌面会出现蓝底四柱线图标。
5. 之后从桌面图标打开，即为全屏无地址栏的应用；状态栏与底部导航已避开安全区。

注意：

- 应用数据只存在浏览器 IndexedDB。**换域名、换手机、清理 Safari 网站数据都会是空数据**，这是预期行为。
- 换机或清理前，先在「设置 → 本地数据 → 导出备份」保存 JSON 文件，再在新设备上「恢复备份」。
- 应用不联网同步任何记录；页面顶部出现「离线」标记时记录仍然会保存到本机。

## 自动部署（GitHub Pages）

仓库已配置 `.github/workflows/deploy-pages.yml`：推送到 `main` 会自动构建并发布，无需数据库、后端或付费服务。

- 站点地址：https://5by572gvjv-cyber.github.io/-daily-fuel-/ （仓库名以 `-` 开头结尾，页面路径也就是 `/-daily-fuel-/`）
- 构建使用相对路径（`base: './'`），因此可以在子目录下正常加载资源。
- 发布前失败过几次，原因是旧版部署动作在当前 Actions 产物后端上读不到 `github-pages` 产物；现在使用 `upload-pages-artifact@v5` + `deploy-pages@v5`，并在部署前用一步校验确认产物确实挂在本次运行上（失败时会直接指出问题在上传还是部署环节）。
- 若再次失败：先看 Actions 里 `Verify pages artifact` 这一步的输出；`artifacts: github-pages` 表示产物正常，否则是构建或上传问题。

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
