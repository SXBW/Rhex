# Changelog

本项目所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.43] (2026-08-13)

### Added

- Markdown 正文中独立成行的单个 http(s) 链接自动渲染为「外链卡片」：不抓取、不加载任何外部内容，仅基于链接自身展示域名、完整 URL 与安全提示；命中后台配置的风险域名黑名单时渲染为红色警示卡片
- 后台「互动与热度」新增「链接卡片」子页面：可全局开启/关闭外链卡片，并维护风险域名黑名单（每行一个域名，支持子域名精确匹配）

### Changed

- 后台认证审核中心「取消认证」改版为独立弹窗：展示目标用户信息与认证类型，取消原因支持多行填写，原因填写与确认操作合并在一个弹窗内完成，替代原先「系统确认框 + 浏览器 prompt」的两步交互
- 外链卡片默认开启，帖子详情与帮助文档按站点设置渲染；站内列表摘要、评论、私信等其他 Markdown 展示面保持默认开启行为，不受后台开关影响

### Fixed

- 修复未识别为站内卡片的完整站内帖子链接（`/posts/xxx` 形式，如跨源、指向当前帖子、帖子不存在）被误渲染成蓝色「外链」卡片的问题：外链卡片分支现排除疑似站内帖子链接，回落为普通链接，避免误导
- 修复帮助文档页右侧栏帮助目录悬浮遮挡功能区面板（用户卡/热门/公告）的问题：文档存在目录时右栏仅显示目录，功能区面板仅在无目录时展示，避免两个 `sticky` 容器重叠
- 外链卡片链接不参与客户端链接增强，避免被重复添加「外部站点」样式

## 2026-08-13

### Added

- 后台认证审核中心新增「取消认证」操作：管理员可取消用户已通过的认证，可填写取消原因并通过系统通知告知用户
- 新增认证状态变更的全链路缓存失效逻辑（`revalidateVerificationMutation`）

### Changed

- 认证通过 / 驳回 / 取消后统一失效帖子详情、评论区、信息流、侧边栏及用户面缓存，替代原先仅刷新用户资料页的处理
- 后台「最近处理记录」改为展示全部已处理申请，配合状态筛选便于定位并取消已通过的认证

### Fixed

- 修复前台解除认证绑定后，帖子详情与评论作者头像旁仍显示旧认证图标的缓存残留问题
- 修复部分测试在 Node/tsx 环境加载 `server-only` 模块失败的问题：测试脚本改为以 `--conditions=react-server` 运行，与 Worker 脚本保持一致
- 修复移动端右侧小边栏在首页与板块页空白的问题：被 `hidden` 类隐藏的侧栏内容经 `Suspense` 包裹时不再正常展开，现改为穿透容器、仅对真实 DOM 节点调整类名
- 修复移动端右侧小边栏仍为空白的问题：异步侧栏内容经 `Suspense` 流式加载后绕过了类名修正，现改为将 `data-mobile-right-sidebar` 标记挂在侧栏容器（真实 DOM 节点）上，使移动端展示 CSS 规则无论内容是否流式到达都能生效
- 修复发帖页移动端「功能区」按钮与论坛页「全局右侧栏」按钮外观混淆：功能区按钮改用独立图标（`SlidersHorizontal`）并移至右下角，与右侧中部的全局侧栏按钮在位置与图标上彻底区分

## [1.0.43] - 2026-08-11

### 依赖升级

- 升级 Next.js 至 16.3.0，同步升级 `@next/bundle-analyzer`、`eslint-config-next` 至 16.3.0
- 升级 markdown 渲染链路：`markdown-it` 至 14.2.0、`mermaid` 至 11.16.1
- 升级 `nodemailer` 至 9.0.5（邮件发送）
- 升级 `adm-zip` 至 0.6.0
- 升级安全/工具依赖：`dompurify` 至 3.4.13、`postcss` 至 8.5.23
- 更新 `pnpm.overrides`：新增 `@babel/core`、`linkify-it`、`nanoid`、`qs`、`undici`、`ws`、`urllib>form-data` 等解析锁定条目
- 重新解析 `pnpm-lock.yaml` 锁文件，与新版依赖保持一致

### 系统层变更

- Dockerfile 基础镜像从已 EOL 的 `node:20-bookworm-slim` 升级为 `node:24-bookworm-slim`（Node 24 LTS，支持至 2028-04，与本地开发环境一致）
- `next-env.d.ts`：Next.js 16 自动补充 `./.next/types/root-params.d.ts` 类型引用

### 构建 / 脚本改进

- `scripts/setup.ts`、`scripts/prisma-db-push.ts`：将子进程调用从 `npx` 改为 `pnpm exec`，消除 npm 误读 `.npmrc` 中 pnpm 专属配置（`node-linker`、`supported-architectures.*` 等）时产生的 `Unknown env config` 警告
- `pnpm-workspace.yaml`：显式声明 `packages: ['.']`（单包），兼容 pnpm 11 要求

### 部署配置

- `.env.example` / `docker-compose.yml`：`DATABASE_URL` 增加 `connection_limit` / `pool_timeout` 连接池参数（web / worker 各用一个池）
- `docker-compose.yml`：Redis 启动命令增加 `--maxmemory` 与 `--maxmemory-policy volatile-lru`，并新增 `REDIS_MAXMEMORY` 环境变量

## [1.0.42] - 2026-07-24

### Added

- 公共页面缓存与首屏流式渲染（Suspense + 预热页面缓存）
- Auth 展示文案可配置（showcase text）
- 插件上传转换、插件数据库迁移
- Feed 封面展示与勋章管理能力

### Changed

- 发帖编辑器大幅重构：布局、增强面板、侧边栏、全屏适配与 z-index 修复
- 富文本编辑器预览面板布局与状态管理优化

### Fixed

- 无限 feed 去重状态重置
- 用户资料页与帖子标签展示细节
- 后台日志过滤加固

### Security / CI

- 镜像发布工作流优化（清理策略、并发控制、去除 provenance/sbom）
- 图片压缩插件修复
