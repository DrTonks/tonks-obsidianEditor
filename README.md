# 博客编辑器插件 0.2.0

通用 Obsidian 宿主：按博客提供的 JSON 构建格式菜单和表单，加载博客提供的本地预览适配器。无需 Astro 服务。

## 当前工作区

已安装到 content/.obsidian/plugins/tonks-blog-tools。升级后在 Obsidian 中停用再启用一次插件。
设置 → 插件设置：博客根目录（留空自动从工作区向上寻找）与配置路径（默认 editor/blog-editor.json）。原有 blogRoot 设置仍然兼容。
右键菜单读最新配置；命令面板使用“选择博客格式”；左侧书本图标或右键“博客预览”切换预览。预览主题选项由配置提供。

## 日常维护

不要再在插件里增加博客格式！配置及渲染维护说明位于博客 `editor/README.md`。
JSON 与 CSS 更新即时读取；博客的 JS 适配更新后在博客运行 `pnpm editor:build`。无需重建插件。预览是按需快照，返回编辑再打开即可。

## 插件开发

```powershell
npm ci
npm run build
npm test
npm run install:content
```

集成测试默认以相邻 blogExample/editor 为示例适配项目，测试前在该博客安装 editor 依赖并构建。插件构建本身不依赖该博客。

宿主主要代码：config.mjs（验证与加载）、formats.mjs（通用模板生成）、main.js（Obsidian 交互）、styles.css（工具栏布局）。站点地址、卡片实现、主题色、正文 CSS 均在博客侧。

插件执行指定的本地适配模块，应只连接可信博客代码。文章原文不会作为模块执行。切换工作区/机器后请在设置中检查路径。

尚未通过真实 Obsidian UI 自动化验证（本机应用控制授权超时）；已完成语法、模块热更新、插件入口 DOM 测试及浏览器渲染检查。当前博客适配限制详见其 README。
