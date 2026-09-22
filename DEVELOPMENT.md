# 开发记录

## 2026-09-21 · 0.1.0

需求：在 Obsidian 右键插入本博客专属语法，点击按钮按需渲染，不运行 Astro 开发服务。开发源代码与文档独立于博客。

目录：`main.js` Obsidian 入口、菜单、对话框、预览；`formats.mjs` 纯语法生成/插入计算；`renderer.mjs` unified 管线；`preview.css` 基础主题适配；`build.mjs` 打包；`install.mjs` 定向安装；`test.mjs` 回归测试。

渲染流程：编辑器快照 → YAML 与正文分离 → remark parse/GFM/math/directive → 共享 remark-directive-rehype → rehype raw/slug → 共享 AdmonitionComponent / articleMedia → KaTeX → HTML → sanitize → 本地资产和文章卡片解析 → sandbox iframe。

隔离：文章 HTML 不执行脚本；iframe 仅允许预览内置交互脚本，不授予同源权限。CSP 禁止任意连接和对象，图片/音频允许 data 和 HTTP(S)。本地读取检查 realpath，避免越界；不读取服务端密钥。插件操作编辑器使用 replaceRange，可一次撤销；表单期间编辑器已变化则拒绝陈旧插入。

交互：不监听每次输入，不常驻 Node 子进程/服务器；打开预览时才渲染，返回编辑或切换文章释放面板。所有工作区事件通过 registerEvent 清理。

验证：4 项自动测试覆盖共享语法渲染、嵌套指令和属性转义、脚本/事件属性过滤、公式、正文分隔与非法音频地址拒绝。构建通过，构建产物约 3.4 MB（含内嵌 KaTeX 字体）。

限制：本机 Obsidian CLI 未开启；Computer Use 请求应用授权超时，未能完成真实 Obsidian 编辑器中的点击/撤销验证。不要将构建/渲染测试描述为 Obsidian 交互验证通过。后续需用户启用插件后试用，并反馈菜单与版式。

后续候选：复用 Expressive Code、Mermaid 离线预览、音频资源选择器、GitHub 数据显式加载、预览滚动位置记忆。

补充验证：插件入口 DOM 集成测试检查主题选项值、快照、卡片转换、返回编辑不修改正文、资源越界拒绝，总计 6 项测试通过。Edge headless 实际渲染检查亮蓝和暗黄输出；发现无封面卡片窄列问题后补齐占位列。此验证不替代真实 Obsidian 的菜单交互验证。

预览界面调整：正常渲染后移除状态说明行及其占位，仅保留加载中、资源缺失和失败提示。

## 0.2.0 · 博客配置驱动

站点相关 renderer/preview.css 与 KaTeX 资源迁移至 blogExample/editor。宿主没有博客源码导入，构建约 19KB；博客适配资源独立构建。格式配置每次操作读取，适配模块按 SHA256 内容变更清除 require 缓存。设置提供博客根目录与配置相对路径，保留旧 blogRoot 数据。新增配置热读取、适配器热更新验证。旧逐格式固定命令改为动态“选择博客格式”命令，右键菜单按配置顺序生成。

## 0.3.0 · 单栏原位实时预览

使用 Obsidian 的 CodeMirror StateField 与块替换装饰，仅渲染不与选区相交的完整块。适配器从实际 AST 生成源码范围，并处理 Frontmatter/BOM/CRLF 偏移。输入后 300ms 更新，异步结果需匹配文档快照和文件；切换/卸载释放定时器、消息监听和视图状态。CM 依赖由 Obsidian 提供，打包 external 避免多实例。

各块仍在不授予同源权限的 sandbox iframe 内，点击通过实例 token 与 event.source 校验定位到原生编辑器；不通过预览 DOM 回写正文。真实 Obsidian 1.13.7 已验证开关、段落点击、更新、撤销与模式恢复。

实时预览主题来自适配器输出的 HTML/CSS。`live-theme.js` 在每个编辑器的隔离 iframe 中解析实际调色板，按 source/token 校验消息，仅更新本编辑区；主题切换替换探针，退出、原生模式切换与卸载均清理样式和监听器。无需在插件中重复维护四套博客色值。
