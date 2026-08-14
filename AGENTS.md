# Rhex 项目协作规则 v2.1

> 本文件用于约束 Rhex 项目的 AI Coding Agent、自动化开发工具和协作者。
>
> 核心原则：**先理解现有代码，再做最小修改；Core 提供能力，Plugin 使用能力；扩展点优先于核心硬编码。**

---

## 1. 回复与技术内容

- 始终使用简体中文回复用户。
- 代码、命令、路径、文件名、环境变量、包名、类型名、函数名、类名、数据库字段名、API 名称、标识符等技术内容保持原文。
- 不翻译代码中的 identifier。
- 不声称执行了没有实际执行的命令。
- 不声称测试通过，除非实际执行并获得通过结果。

---

## 2. 项目事实与架构边界

当前仓库基于 Next.js App Router、React 19、Prisma、PostgreSQL、Redis 和统一 Worker 构建；运行环境为 Node.js 20+。标准运行架构包含 Web/API、PostgreSQL、Redis、Worker；源码主要位于 `src/`，数据库位于 `prisma/`，项目还包含 `scripts/`、`public/`、`docs/` 等目录。

核心目录职责：

```text
src/app/         页面、App Router 路由、API Route
src/components/  UI 与页面组件
src/db/          Prisma 查询与数据访问
src/hooks/       前端复用 Hook
src/lib/         业务服务、运行时、领域逻辑
src/types/       TypeScript 类型
prisma/          Schema、migration、seed
scripts/         setup、worker 等脚本
public/          静态资源
docs/            项目文档
```

不要仅根据目录名称推断具体实现；修改前必须阅读实际调用链。

详细架构原则见：

```text
docs/architecture.md
```

如果该文件不存在或与代码不一致，以当前代码和配置为事实来源，并应在必要时同步更新文档。

---

## 3. 修改前检查

开始修改前必须先执行：

```bash
git status --short
```

然后：

1. 检查工作区已有修改。
2. 不覆盖、删除或回滚用户已有未提交修改。
3. 阅读目标文件及其直接调用方、依赖方和相关类型。
4. 涉及插件时阅读 `docs/architecture.md` 以及实际 Plugin Runtime 代码。
5. 涉及数据库时阅读 `prisma/schema.prisma` 和相关 migration。
6. 涉及认证、权限、Session、Redis、Worker 时必须阅读完整调用链。

如果无法安全区分用户修改和本次修改，停止修改并询问用户。

---

## 4. 文件修改规则

所有文件修改必须使用 `apply_patch`。

禁止：

```bash
sed -i
perl -i
ed
echo > file
printf > file
cat <<EOF > file
```

也禁止使用其他等价 shell 重定向覆盖项目文件。

优先进行外科式最小修改：

- 修改必要 import。
- 增加必要函数。
- 修改必要 JSX。
- 增加必要配置。
- 保留现有格式和结构。

禁止为了局部修改而整文件重写。

确需大规模重构时：

1. 说明原因。
2. 列出影响范围。
3. 尽量拆成独立修改。
4. 每一步完成后校验。

---

## 5. 包管理器与运行环境

Rhex 使用 `pnpm`。

- 优先使用项目声明的 Node.js 版本；当前最低运行要求为 Node.js 20+。
- 不得使用 `npm`、`yarn`、`bun` 替代 `pnpm` 管理依赖。
- 不得删除 `pnpm-lock.yaml` 后重新生成。
- 不得手工编辑 `pnpm-lock.yaml`。
- 修改 `package.json` 后必须使用 `pnpm` 更新 lockfile。
- 未经用户明确要求，不升级 Next.js、React、Prisma、Node.js 或其他主要依赖。
- 新增依赖前先检查现有依赖是否已经能够解决问题。

推荐：

```bash
pnpm install
pnpm install --frozen-lockfile
```

生产/CI 环境优先：

```bash
pnpm install --frozen-lockfile
```

---

## 6. Git 规则

### 6.1 分支开发原则

Rhex 的每次功能、修复、重构、文档或配置修改，都必须在**独立分支**中进行，不得直接在 `main`、`master` 或其他受保护的长期分支上开发和提交。

推荐流程：

```text
main
  ↓
创建任务分支
  ↓
修改
  ↓
校验
  ↓
提交
  ↓
Pull Request / Merge
  ↓
main
```

分支命名推荐使用：

```text
feat/<short-description>
fix/<short-description>
refactor/<short-description>
docs/<short-description>
chore/<short-description>
test/<short-description>
```

例如：

```text
feat/music-player
fix/header-logo-flash
docs/plugin-architecture
refactor/plugin-runtime
```

如果当前已经处于任务分支，则继续在当前任务分支完成本次相关修改，不应无意义地重复创建分支。

未经用户明确要求，不得：

- 直接向 `main` / `master` 提交。
- 将多个无关任务混入同一个分支。
- 修改其他任务分支的内容。
- 强制推送覆盖远程分支历史。
- 使用 `git reset --hard`、`git clean -fd` 等破坏性命令清理工作区。

### 6.2 提交前检查

提交前必须执行：

```bash
git status --short
git diff --stat
git diff
```

确认当前分支不是受保护的长期分支：

```bash
git branch --show-current
```

只暂存本次明确修改的文件。

优先：

```bash
git add path/to/file
```

不要无条件：

```bash
git add .
git add -A
```

特别注意不要误提交：

```text
.env
.env.local
uploads/
temporary files
build output
?? tools/
```

未经明确要求禁止：

```bash
git reset --hard
git clean -fd
git restore .
git checkout -- .
```

Commit 使用英文 Conventional Commit：

```text
feat(scope): add xxx
fix(scope): prevent xxx
refactor(scope): simplify xxx
docs(scope): update xxx
test(scope): add xxx
chore(scope): update xxx
```

每次逻辑完整的修改都应形成独立 commit，避免把多个无关任务压缩到同一个提交中。

推荐：

```text
feature/fix
    ↓
small logical commits
    ↓
Pull Request
```

除非用户明确要求，不得修改已经共享的历史提交；不得使用 `git commit --amend`、`git rebase` 或强制推送改变已经推送并被他人使用的提交历史。

---

## 7. TypeScript 规则

首选严格类型安全。

禁止通过大量以下方式掩盖真实错误：

```ts
as any
@ts-ignore
@ts-expect-error
```

如果确实必要：

1. 先确认没有更安全方案。
2. 尽量缩小作用范围。
3. 说明原因。

优先复用已有类型，不重复定义相同领域类型。

---

## 8. 本地校验

首选：

```bash
./node_modules/.bin/tsc --noEmit --pretty false
```

根据修改范围执行：

```bash
pnpm test
pnpm lint
pnpm run build
pnpm run prisma:generate
```

Docker 相关修改应执行项目现有的 Docker 校验命令；GitHub Actions 的生产镜像发布流程成功通常可作为生产构建和 GHCR 发布链路通过的依据。

`pnpm lint` 如果因 lockfile/config/环境问题失败，必须确认失败原因后再判断是否与本次修改有关。

---

## 9. Next.js / React 规则

Rhex 使用 Next.js App Router。

必须明确区分：

```text
Server Component
Client Component
Server Action
Route Handler
Worker
```

浏览器 API：

```text
window
document
localStorage
sessionStorage
navigator
Audio
MediaSource
MediaSession
```

只能在客户端运行环境访问。

不要为了使用一个浏览器 API，把整个上层组件树无意义地改成 Client Component；应把客户端逻辑隔离到最小范围。

Render 阶段不得执行副作用。

Event Listener、Timer、Subscription、WebSocket、Worker、Audio 等资源必须在生命周期结束时清理。

---

## 10. SSR / Hydration / 首屏

必须避免：

```text
SSR 输出 A
↓
浏览器第一次渲染 B
↓
Hydration mismatch / FOUC / Layout Shift
```

涉及主题、Header、Logo、Layout 时重点检查：

1. `/src/app/layout.tsx` 中 `<body>` 的初始可见性。
2. `data-root-init` 是否正确从 `pending` 转为 `ready`。
3. `/src/components/theme-provider.tsx` 是否正确清理 `document.body` 的 `visibility` 和 `overflow` 内联样式。
4. `/src/components/site-header.tsx` 中 Logo 是否包含必要的：
   ```text
   shrink-0 whitespace-nowrap
   ```
5. SSR 与客户端主题状态是否一致。
6. 是否存在字体/CSS/主题初始化导致的布局变化。

不得用长时间 `setTimeout` 等手段掩盖首屏闪动。

---

# 插件系统

## 11. 插件总原则

Rhex 是 Host Application。

正确模型：

```text
Rhex Core
  ↓
Plugin Runtime
  ↓
Discovery
  ↓
Validation
  ↓
Registration
  ↓
Extension Points
  ↓
Mount / Execute
```

**插件不是 Rhex 启动的前置依赖。**

不要设计成：

```text
Plugin
  ↓
启动 Rhex
```

插件应在系统提供扩展能力后由 Runtime 按需发现、验证、加载、缓存并挂载。

---

## 12. Extension Point First

当前设计涉及：

```text
slots
surfaces
hooks
routes
APIs
```

开发插件时必须：

```text
已有扩展点可以解决
    ↓
直接使用

无法解决
    ↓
增加通用扩展点

通用扩展点
    ↓
插件使用
```

禁止为单个插件在 Core 中增加硬编码：

```ts
if (pluginId === "music-player") {}
if (plugin.name === "xxx") {}
```

插件不能要求 Core 为自己添加特殊分支。

---

## 13. 插件生命周期

逻辑生命周期：

```text
Discovery
  ↓
Validation
  ↓
Dependency Resolution
  ↓
Load
  ↓
Register
  ↓
Resolve
  ↓
Mount / Execute
  ↓
Runtime
  ↓
Disable / Unload
```

每个阶段必须可处理错误。

单个插件业务异常不得未经处理直接导致 Web/API 或 Worker 整体退出。

---

## 14. 插件 Manifest

插件 Manifest 应为声明式配置，至少应能表达：

```text
id
name
version
apiVersion
description
author
entry
permissions
dependencies
routes
slots
hooks
surfaces
assets
```

Manifest 必须在执行插件代码前校验。

插件 ID：

```text
lowercase kebab-case
```

例如：

```text
music-player
rss-reader
github-feed
```

插件 ID 必须稳定，不应随意修改。

版本采用 SemVer。

---

## 15. 插件依赖

插件可以声明其他插件依赖。

Runtime 必须：

1. 检查依赖存在性。
2. 检查版本兼容性。
3. 构建依赖图。
4. 检测循环依赖。
5. 按依赖关系确定加载顺序。
6. 明确处理缺失或不兼容依赖。

禁止通过直接 import 其他插件内部文件建立隐式依赖。

---

## 16. Plugin API

插件与 Core 通信必须优先通过公开 Plugin API。

插件不得直接依赖：

```text
Core 内部组件状态
内部 Prisma 实现
内部 Redis Key
内部 Session 实现
内部 authentication implementation
未公开 utility
私有 hook
```

推荐：

```text
Plugin
  ↓
Plugin API
  ↓
Rhex Core
```

Plugin API 必须：

- 有明确输入/输出类型。
- 有明确错误模型。
- 有明确认证要求。
- 有明确授权要求。
- 有明确 API 版本。
- 避免直接暴露内部数据库对象。

Breaking Change 必须通过 API version 或兼容层处理。

---

## 17. 插件权限

权限必须遵循：

```text
Declare
  ↓
Validate
  ↓
Authorize
  ↓
Execute
```

高风险能力包括：

```text
database.write
filesystem.write
network.external
system.command
admin.*
```

不得默认开放。

### 重要：可信边界

当前 Plugin Runtime 如果加载的是 Node.js/JavaScript 代码，应视为**受信任代码**。

Plugin Permission 是业务能力控制，不等于 JavaScript Runtime Sandbox。

不得声称 Permission System 能阻止受信任插件直接访问 Node.js 能力。

未来如果允许加载不可信第三方插件，必须先设计真正的：

```text
Sandbox
Isolated Runtime
Capability-based Security
```

之后才能把不可信代码纳入运行时。

---

## 18. 插件数据隔离

插件产生的数据库、Redis、Storage、localStorage、sessionStorage 等数据必须使用自己的 namespace。

推荐：

```text
plugin:{pluginId}:...
```

例如：

```text
plugin:music-player:queue
plugin:music-player:settings
plugin:music-player:play-history
```

插件不得直接读取其他插件私有数据。

跨插件访问必须通过公开 API。

---

## 19. 插件 UI

插件 UI 必须：

- 遵循现有设计系统。
- 支持主题。
- 考虑移动端。
- 保持 SSR/Hydration 安全。
- 遵守无障碍规范。
- 不污染全局 CSS。
- 不覆盖 Core 全局样式，除非扩展点明确允许。

---

## 20. 插件 Route / API

插件 Route 应使用统一 namespace 或项目既定 Plugin Route 机制。

API 必须考虑：

```text
authentication
authorization
validation
rate limit
CSRF
CORS
SSRF
错误处理
```

不要直接暴露内部数据库模型。

---

## 21. 插件资源与卸载

插件必须清理：

```text
EventListener
Timer
Interval
Subscription
WebSocket
Audio
MediaSource
Worker
Observer
Queue Consumer
```

不得产生：

```text
memory leak
duplicate listener
duplicate timer
duplicate subscription
duplicate request
```

---

## 22. Client / Server Plugin

Client Plugin 不得访问：

```text
process.env secret
database
filesystem
server-only API
```

Server Plugin 不得将 Secret 发送到浏览器。

Universal Plugin 必须明确：

```text
server/
client/
shared/
```

共享代码不得隐式依赖 Node-only 或 Browser-only API。

---

## 23. 音频 / Media Plugin

音乐播放器属于典型 Client Plugin。

必须：

- Audio 生命周期由独立 Plugin Runtime 管理。
- 不绑定单个帖子组件。
- 路由变化不得默认销毁播放状态。
- 防止重复创建 Audio。
- 防止重复注册 `play`、`pause`、`ended`、`timeupdate`。
- 正确处理浏览器 autoplay policy。
- Media Session API 只能在 Client Runtime 使用。
- 第三方音乐 API 的服务端 Secret 不得暴露到客户端。

目标行为：

```text
打开帖子 A
  ↓
播放音乐
  ↓
进入帖子 B
  ↓
播放器 Runtime 保持
  ↓
音乐继续播放
```

---

# 数据库 / Redis / Worker

## 24. Prisma

修改：

```text
prisma/schema.prisma
```

前必须检查已有 model 和 migration。

修改后至少考虑：

```bash
pnpm run prisma:generate
./node_modules/.bin/tsc --noEmit --pretty false
```

生产数据库不得未经确认执行破坏性操作。

禁止：

```text
DROP TABLE
DROP DATABASE
TRUNCATE
大规模 DELETE
```

已经应用到生产环境的 migration 原则上不可修改；应新增 migration。

---

## 25. Redis

Redis 用于缓存、队列、锁等运行时能力。

修改 Redis Key 时必须检查：

```text
namespace
TTL
serialization
concurrency
compatibility
```

不得随意改变已有 Key 格式。

多实例/多程序共享 Redis 时必须注意 `REDIS_KEY_PREFIX`。

---

## 26. Worker

长时间任务、RSS 抓取、AI 请求、批量处理等不得阻塞 Web request lifecycle。

优先：

```text
Web/API
  ↓
Redis / Queue
  ↓
Worker
```

Worker Task 应考虑：

```text
idempotency
retry
timeout
failure isolation
concurrency
logging
```

单个 Task 的业务异常不得未经处理导致 Worker 进程退出。

---

# Web 安全

## 27. 输入永远不可信

用户输入包括：

```text
query
params
body
headers
cookies
form data
uploaded files
Markdown
HTML
URL
```

必须根据场景执行：

```text
authentication
authorization
validation
sanitization
rate limiting
```

---

## 28. 必须考虑的 Web 攻击面

开发 API、Markdown、上传、插件、OAuth、外部 URL 时必须考虑：

```text
XSS
SQL Injection
CSRF
SSRF
Open Redirect
Path Traversal
Command Injection
Prototype Pollution
Session Fixation
Cookie Theft
```

特别谨慎处理：

```tsx
dangerouslySetInnerHTML
```

SVG、Markdown、HTML、外部图片和外部 URL 都必须经过适当处理。

---

## 29. Secret

禁止提交或输出：

```text
.env
.env.local
SESSION_SECRET
DATABASE_URL 中的密码
OAuth Secret
API Key
Access Token
Redis Password
```

日志中不得输出完整 Cookie、Token、Secret、数据库连接字符串。

新增环境变量时同步考虑 `.env.example`。

---

## 30. 外部 API

必须：

- 设置 timeout。
- 处理失败。
- 限制 retry。
- 遵守 rate limit。
- 必要时缓存。
- Secret 只保存在 Server 环境。

推荐：

```text
Browser
  ↓
Rhex Server
  ↓
Third-party API
```

---

# 前端体验与性能

## 31. 无刷新导航

不要使用：

```ts
window.location.reload()
```

代替正常 App Router 导航或状态更新。

插件需要跨路由保持状态时，使用：

```text
Plugin Runtime
Store
Context
```

而不是依赖页面刷新。

---

## 32. 性能

避免：

```text
重复请求
重复订阅
重复初始化
无意义重渲染
```

大数据集优先：

```text
pagination
infinite scroll
virtualization
server-side loading
```

---

## 33. UI / Accessibility

新增 UI 优先使用现有组件。

必须考虑：

```text
dark mode
responsive
loading
empty
error
disabled
keyboard navigation
focus
ARIA
semantic HTML
```

不要用可点击 `<div>` 替代适合的 `<button>` 等语义元素。

---

# 测试

## 34. 测试范围

新增功能至少考虑：

```text
正常路径
错误路径
空数据
未登录
权限不足
重复调用
重复加载
卸载
边界条件
```

插件额外测试：

```text
discovery
manifest validation
load
register
mount
runtime
disable
unload
error isolation
duplicate initialization
resource cleanup
```

Client Plugin 额外测试：

```text
route change
component remount
browser API
event cleanup
```

---

# CI / Release / Documentation

## 35. CI

本地验证不能替代 CI。

修改以下内容时应重点关注 CI：

```text
package.json
pnpm-lock.yaml
Dockerfile
docker-compose.yml
next.config.mjs
tsconfig.json
GitHub Actions
Prisma
production build
```

不得为了通过 CI 删除测试、关闭 lint 或降低 TypeScript 检查。

---

## 36. Docker

生产镜像必须保持：

```text
可构建
可启动
Secret 不进入镜像
不包含无关开发文件
```

修改 Docker 构建流程后必须进行对应构建验证。

---

## 37. Documentation Sync

以下内容发生变化时必须考虑同步文档：

```text
Plugin API
Plugin Manifest
Extension Point
数据库结构
环境变量
部署方式
开发命令
架构边界
Breaking Change
```

如果新增 Plugin API，至少同步：

```text
docs/architecture.md
```

以及对应 Plugin API 文档。

---

## 38. Breaking Change

涉及以下变化时视为潜在 Breaking Change：

```text
Plugin API
Manifest Schema
数据库结构
环境变量
认证接口
公开 Route
公开 API
扩展点
插件生命周期
```

必须：

1. 明确影响范围。
2. 提供迁移方案或兼容层。
3. 更新文档。
4. 增加必要测试。
5. 在 CHANGELOG 中记录。

---

# 完成任务

## 39. 最终检查

完成后：

```bash
git diff --stat
git diff
./node_modules/.bin/tsc --noEmit --pretty false
git status --short
```

根据修改范围追加：

```bash
pnpm test
pnpm lint
pnpm run build
pnpm run prisma:generate
```

最终必须确认：

- 没有无关修改。
- 没有覆盖用户修改。
- 没有 Secret。
- 没有调试代码。
- 没有误提交生成文件。
- 没有新的 TypeScript 错误。

---

## 40. 最终回复格式

```text
修改内容：
- xxx
- xxx

验证：
- tsc: PASS
- test: PASS / 未执行
- lint: PASS / 环境问题 / 未执行
- build: PASS / 未执行

注意：
- xxx
```

---

## 41. 核心原则

```text
最小修改
  ↓
理解现有代码
  ↓
复用现有能力
  ↓
Extension Point First
  ↓
Plugin API First
  ↓
Core / Plugin Isolation
  ↓
类型安全
  ↓
安全优先
  ↓
可测试
  ↓
可维护
```

> **Rhex Core 提供能力，Plugin 使用能力；Core 提供扩展点，Plugin 实现功能。不要为了一个 Plugin 把 Plugin 写进 Core。**


## CHANGELOG.md 规则

每次代码、功能、修复、重构、配置、数据库、插件系统或架构更新完成后，必须同步检查并按实际情况更新项目根目录：

``` text
CHANGELOG.md
```

如果仓库实际文件名为：

``` text
CHANGELOG.MD
```

必须沿用现有文件名，不得同时创建：

``` text
CHANGELOG.md
```

------------------------------------------------------------------------

## 强制要求

-   用户要求的功能开发、Bug
    修复、重构、插件开发、架构调整、配置调整、数据库调整，必须更新
    `CHANGELOG`。
-   每次实际变更必须判断是否需要记录。
-   用户可感知的功能变化不得遗漏。
-   不得把 `CHANGELOG` 写成 Git Commit 日志。
-   不得简单复制 Commit Message 到 `CHANGELOG`。
-   CHANGELOG 描述必须面向用户说明实际变化和影响。
-   已发布版本历史不得删除、覆盖或重写。
-   新版本记录必须添加在已有版本记录之前。
-   日期格式必须使用：

``` text
YYYY-MM-DD
```

-   CHANGELOG 采用 Keep a Changelog 风格。
-   不得自动创建：

``` md
## [Unreleased]
```

除非用户明确要求使用 Unreleased 工作流。

------------------------------------------------------------------------

## 版本号规则

CHANGELOG 版本号必须使用项目实际版本。

版本确定优先级：

``` text
1. 用户明确指定版本号
2. 当前 Git Tag / Release 版本
3. package.json version
4. 项目已有 CHANGELOG 最新版本号
5. 无法确定时询问用户
```

------------------------------------------------------------------------

## 默认行为

如果用户没有指定版本号：

### 情况 1：项目存在当前版本

例如：

``` json
{
  "version": "1.5.0"
}
```

生成：

``` md
## [1.5.0] - 2026-08-14
```

------------------------------------------------------------------------

### 情况 2：CHANGELOG 已存在版本

例如：

``` md
## [1.4.0] - 2026-08-01
```

并且项目没有其他版本信息。

默认沿用：

``` md
## [1.4.0] - 2026-08-14
```

禁止自动创建：

``` md
## [Unreleased]
```

------------------------------------------------------------------------

### 情况 3：无法确定版本

禁止：

-   猜测版本号。
-   自动增加 Patch / Minor / Major。
-   创建 Unreleased。

必须询问用户：

``` text
当前无法确定 CHANGELOG 版本号，
请确认本次更新版本：
例如 1.5.0 / 1.4.1
```

------------------------------------------------------------------------

## 标准结构

``` md
# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [1.5.0] - 2026-08-14

### Added

- xxx

### Changed

- xxx

### Fixed

- xxx

### Removed

- xxx

### Security

- xxx

## [1.4.0] - 2026-08-01

### Added

- xxx
```

------------------------------------------------------------------------

## 变更分类

根据实际变化选择：

``` text
Added
Changed
Deprecated
Removed
Fixed
Security
```

规则：

-   只创建实际存在的分类。
-   不为了格式完整创建空分类。
-   不允许生成空结构：

``` md
### Added

### Changed

### Fixed
```

------------------------------------------------------------------------

## CHANGELOG 与 Git Commit 区别

Git Commit：

关注：

``` text
开发者做了什么
```

例如：

``` text
fix(plugin): repair plugin loader
```

CHANGELOG：

关注：

``` text
用户获得什么变化
```

例如：

``` md
### Fixed

- Fixed plugin loading failure when optional dependencies are missing.
```

禁止直接复制：

``` md
- fix(plugin): repair plugin loader
```

------------------------------------------------------------------------

## 发布版本保护

已发布版本：

``` md
## [1.4.0]
```

禁止：

-   修改历史内容。
-   删除历史版本。
-   覆盖已有 Release 记录。

新版本必须：

``` text
添加在顶部
保留完整历史
```

### 插件变更

涉及 Plugin 时，应明确记录插件相关变化，例如：

```md
### Added

- Added `music-player` plugin support.

### Changed

- Extended Plugin Runtime with persistent player state.

### Fixed

- Fixed plugin resource cleanup during route changes.
```

### 架构变更

如果修改以下内容，必须在 `CHANGELOG.md` 中明确记录影响：

```text
Plugin Runtime
Extension Point
Plugin API
Manifest
Database
Worker
Authentication
Authorization
Core / Plugin boundary
```

### Breaking Change

如果存在 Breaking Change，必须明确标记：

```md
### Changed

- **Breaking:** Changed Plugin API `apiVersion` from `1` to `2`.
```

同时必须同步检查：

```text
AGENTS.md
docs/architecture.md
相关 API 文档
```

### Commit 与 CHANGELOG 的职责

```text
Git Commit
    ↓
描述一次具体代码修改

CHANGELOG.md
    ↓
描述用户、开发者或插件作者需要知道的项目变化
```

Commit 与 CHANGELOG 不要求逐条一一对应。

一次功能可能包含多个 Commit，但在 CHANGELOG 中应作为一个完整功能变化记录。

### 提交前检查

在 Commit 前必须确认：

```bash
git status --short
git diff -- CHANGELOG.md
```

如果仓库使用的是 `CHANGELOG.MD`，应执行：

```bash
git diff -- CHANGELOG.MD
```

确认本次实际变更已经正确记录。

如果本次修改属于必须记录的变更，但 CHANGELOG 没有同步更新：

```text
不得完成最终提交。
```

### CHANGELOG 与版本发布

推荐流程：

```text
开发分支
    ↓
修改代码
    ↓
更新 CHANGELOG.md
    ↓
TypeScript / Test / Build
    ↓
git diff
    ↓
Commit
    ↓
Pull Request
    ↓
Merge
    ↓
Release
```

`Unreleased` 用于记录尚未正式发布的变化。

正式发布时，再将对应内容归入具体 SemVer 版本：

```text
[MAJOR.MINOR.PATCH] - YYYY-MM-DD
```

不得为了单次内部 Commit 随意增加一个新的正式版本号；正式版本号应与项目实际 Release 流程一致。
