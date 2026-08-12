# Rhex Architecture

> Rhex 系统架构与插件扩展架构说明。
>
> 本文档描述当前仓库的架构事实、边界和插件系统设计原则。代码是最终事实来源；当本文档与代码不一致时，应先修正理解，再决定是否更新文档。

---

## 1. 项目定位

Rhex 是一个基于 Next.js App Router、React 19、Prisma、PostgreSQL、Redis 和 Worker 的现代社区/论坛系统。

当前核心能力包括：

- 社区内容与帖子
- 用户、认证、权限
- 评论与互动
- Markdown / 富内容
- 附件与对象存储
- 后台管理
- RSS
- AI 异步任务
- 游戏/运营应用
- Redis 队列与 Worker
- 可扩展 Plugin Runtime

---

## 2. 总体运行架构

```text
                         Browser
                            │
                            ▼
                  ┌───────────────────┐
                  │   Next.js Web/API │
                  │   App Router      │
                  └─────────┬─────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
        PostgreSQL        Redis        Object Storage
             ▲              ▲
             │              │
             └──────┬───────┘
                    │
                    ▼
              ┌───────────┐
              │  Worker   │
              └───────────┘
```

### Web/API

负责：

- 页面渲染
- Client/Server Components
- Route Handler
- Server Action
- 用户请求
- 权限判断
- 数据读取/写入
- Plugin Runtime 的 Web 侧集成

### PostgreSQL

负责持久化：

- 用户
- 帖子
- 评论
- 社区结构
- 权限/运营数据
- 应用数据
- Plugin 持久化数据（如果扩展机制允许）

### Redis

负责运行时能力：

- Cache
- Queue
- Lock
- 延迟任务
- Worker 协调
- 运行时状态

### Worker

负责：

- 异步任务
- RSS 抓取
- AI 回复
- 延迟任务
- 批量处理
- 其他不适合阻塞 Web request lifecycle 的工作

---

## 3. 源码结构

当前主要目录：

```text
src/
├── app/              # 页面、路由、API Route
├── components/       # UI 组件和页面组件
├── db/               # Prisma 查询与数据访问
├── hooks/            # 前端复用 Hook
├── lib/              # 业务服务、运行时、领域逻辑
└── types/            # TypeScript 类型

prisma/
├── migrations/
├── schema.prisma
└── seed.ts

scripts/
public/
docs/
test/
```

核心依赖方向应尽量保持：

```text
UI
 ↓
Application / Service
 ↓
Data Access
 ↓
Prisma
 ↓
PostgreSQL
```

而不是让 UI 直接散落数据库查询和基础设施逻辑。

---

## 4. Next.js 分层

### Server Component

适合：

- 数据读取
- 页面组装
- SEO
- 服务端权限检查
- Server-only 服务调用

禁止直接访问：

```text
window
document
localStorage
sessionStorage
Audio
MediaSource
navigator
```

### Client Component

适合：

- 用户交互
- 浏览器 API
- UI 状态
- Media
- WebSocket
- Client-only hooks

原则：

> Client Component 应尽可能小，不要因为一个浏览器 API 把整个页面树变成 Client Component。

### Route Handler

负责：

```text
HTTP Request
    ↓
Validation
    ↓
Authentication
    ↓
Authorization
    ↓
Service
    ↓
Response
```

不要在 Route Handler 中堆积复杂领域逻辑。

### Worker

与 Web request lifecycle 分离。

长任务：

```text
Request
  ↓
enqueue
  ↓
Redis
  ↓
Worker
```

---

# Plugin Architecture

## 5. 为什么需要插件

Rhex 本身已经包含大量业务能力。

如果每增加一个功能都直接修改：

```text
src/app
src/components
src/lib
```

最终会产生：

```text
Core 与业务插件强耦合
代码膨胀
升级困难
第三方扩展困难
功能之间互相影响
```

因此插件系统的核心目标是：

> **Core 提供稳定能力，Plugin 在公开扩展点上实现功能。**

---

## 6. 正确的插件模型

插件不是系统启动的前置条件。

正确模型：

```text
┌──────────────────────────┐
│        Rhex Core         │
│                          │
│ App / Auth / DB / Redis  │
│ UI / Worker / Services   │
└────────────┬─────────────┘
             │
       Plugin Runtime
             │
     ┌───────┴────────┐
     │                │
 Discovery         Registry
     │                │
     └───────┬────────┘
             │
       Extension API
             │
   ┌─────────┼─────────┐
   │         │         │
 slots     hooks     routes
   │         │         │
 surfaces   APIs      ...
   │         │         │
   └─────────┼─────────┘
             │
          Plugins
```

---

## 7. 插件生命周期

推荐生命周期：

```text
Discovery
   ↓
Manifest Validation
   ↓
Dependency Resolution
   ↓
Load
   ↓
Register
   ↓
Resolve Extension Points
   ↓
Mount / Execute
   ↓
Runtime
   ↓
Disable
   ↓
Unload
```

### Discovery

发现插件来源。

可能包括：

```text
内置插件目录
外部插件目录
配置声明
未来的插件仓库
```

Discovery 不应该直接执行插件代码。

### Validation

校验：

```text
Manifest
ID
Version
API Version
Dependencies
Permissions
Entry
Routes
Extension Points
```

### Dependency Resolution

构建：

```text
Plugin Dependency Graph
```

并检测：

```text
missing dependency
version mismatch
circular dependency
```

### Load

加载插件代码。

加载失败不得导致整个 Core 崩溃。

### Register

插件向 Runtime 注册：

```text
slots
surfaces
hooks
routes
APIs
```

### Resolve

Runtime 根据当前页面/运行环境解析需要的扩展。

### Mount / Execute

实际执行：

```text
UI Component
Hook
Route
API
Worker Task
```

### Disable / Unload

停止插件并释放资源。

---

# Extension Points

## 8. slots

`slots` 是 UI 注入点。

概念：

```text
Core UI
   │
   ├── Header Slot
   ├── Sidebar Slot
   ├── Post Slot
   ├── Footer Slot
   └── ...
```

插件：

```text
Plugin
  ↓
register slot
  ↓
Core Slot
  ↓
Plugin UI
```

多个插件可以使用同一个 slot。

必须明确：

```text
registration order
priority
error isolation
unmount
```

不要让插件直接修改 Core Component DOM 结构。

---

## 9. surfaces

`surfaces` 用于提供更完整的 UI Surface。

适用于：

```text
独立页面
面板
弹窗
工具面板
播放器
管理界面
```

与 `slots` 的区别：

```text
slot
= 插入已有 UI

surface
= 提供完整 UI Surface
```

---

## 10. hooks

Hooks 用于监听或扩展 Core 生命周期。

概念：

```text
Core Event
   ↓
Hook Dispatcher
   ↓
Plugin Hook
```

Hook 必须明确：

```text
触发时机
输入
输出
错误处理
是否允许修改数据
执行顺序
```

Hook 不应偷偷改变不可预期的 Core 状态。

---

## 11. routes

插件 Route 用于提供插件自己的 URL / HTTP 能力。

推荐：

```text
/plugin namespace
```

具体路径应遵循 Rhex 当前 Runtime 实现。

Route 生命周期：

```text
Request
 ↓
Plugin Route Resolver
 ↓
Plugin Handler
 ↓
Response
```

必须执行：

```text
authentication
authorization
validation
rate limiting
```

如果 Route 访问第三方 URL，还必须考虑 SSRF。

---

## 12. APIs

Plugin API 是插件与 Core 之间的正式通信边界。

推荐：

```text
Plugin
  ↓
Plugin API
  ↓
Core Service
  ↓
Database / Redis
```

不要：

```text
Plugin
  ↓
Core private implementation
```

API 应提供稳定 DTO，而不是直接返回 Prisma Model。

---

# Plugin Manifest

## 13. Manifest

推荐结构：

```json
{
  "id": "music-player",
  "name": "Music Player",
  "version": "1.0.0",
  "apiVersion": "1",
  "entry": "./dist/index.js",
  "dependencies": {},
  "permissions": [],
  "slots": [],
  "surfaces": [],
  "hooks": [],
  "routes": [],
  "apis": [],
  "assets": []
}
```

以上为架构示例，不代表当前代码已经固定采用该字段集合。

最终 Manifest Schema 必须以实际 Plugin Runtime 实现为准。

---

## 14. Plugin ID

使用：

```text
lowercase-kebab-case
```

例如：

```text
music-player
rss-reader
github-feed
```

ID 一旦发布后应保持稳定。

---

## 15. Plugin Version

使用 SemVer：

```text
MAJOR.MINOR.PATCH
```

例如：

```text
1.0.0
1.1.0
2.0.0
```

`apiVersion` 用于描述 Plugin API 兼容性。

---

# Plugin Security

## 16. Trusted Plugin Boundary

如果插件本质是 Node.js/JavaScript 代码：

```text
Plugin = Trusted Code
```

那么：

```text
Permission
```

只是业务能力控制，不是 JavaScript Sandbox。

例如插件本身如果获得 Node.js 执行权，就不能声称：

```text
database.read = false
```

能够阻止它直接读取文件或环境变量。

因此未来如果支持“不可信第三方插件”，必须引入：

```text
Sandbox
Isolated Runtime
Capability-based Security
```

之后才能提供真正的第三方插件安全模型。

---

## 17. Permission

权限建议分层：

```text
user.read
user.write

post.read
post.write

storage.read
storage.write

network.external

database.read
database.write

admin.*
```

高风险权限必须默认关闭。

---

## 18. Plugin Data Isolation

所有 Plugin 数据都必须 namespace。

Redis：

```text
plugin:{pluginId}:...
```

Browser Storage：

```text
rhex:plugin:{pluginId}:...
```

数据库：

优先通过 Plugin Data API 或 Plugin 专属模型隔离。

插件不得直接读取其他插件私有数据。

---

# Client / Server

## 19. Client Plugin

适用于：

```text
Audio
MediaSession
localStorage
WebSocket
DOM
browser events
```

生命周期必须独立于具体帖子页面。

例如音乐播放器：

```text
Rhex Layout
      │
      ├── Post Page A
      │
      ├── Post Page B
      │
      └── Music Player Runtime
                │
                └── Audio
```

页面变化：

```text
Post A → Post B
```

不应该导致：

```text
Audio → destroy
```

---

## 20. Server Plugin

适用于：

```text
Database
Redis
Filesystem
Server API
Worker
第三方 API Secret
```

Server-only capability 不得发送给 Browser。

---

## 21. Universal Plugin

必须拆分：

```text
plugin/
├── client/
├── server/
└── shared/
```

`shared/` 只能放真正跨环境安全的：

```text
types
constants
pure functions
schema
```

---

# Music Player Architecture Example

## 22. 音乐播放器推荐架构

针对未来的 Music Plugin：

```text
                 Rhex
                  │
          Plugin Runtime
                  │
          music-player
                  │
       ┌──────────┴──────────┐
       │                     │
   Player Runtime       Music API Layer
       │                     │
       │              ┌──────┴──────┐
       │              │             │
     Audio         Provider A    Provider B
       │
 MediaSession
```

播放器状态：

```text
currentTrack
queue
currentTime
duration
volume
playing
repeatMode
shuffle
```

应该由：

```text
Music Player Runtime / Store
```

管理，而不是：

```text
Post Component
```

---

## 23. 无刷新播放

目标：

```text
用户进入帖子 A
       ↓
播放音乐
       ↓
客户端导航到帖子 B
       ↓
Post Component 重新渲染
       ↓
Music Runtime 不变
       ↓
Audio 继续播放
```

关键点：

```text
Audio 生命周期 ≠ Post Page 生命周期
```

---

## 24. Music API

如果使用第三方音乐 API：

```text
Client
   ↓
Rhex Server API
   ↓
Provider
```

不要把：

```text
API Secret
Provider Secret
private credential
```

发送给 Browser。

如果 Provider 本身不需要 Secret，也应该根据 API rate limit 和 CORS/SSRF 风险决定是否通过 Server Proxy。

---

# Data Flow

## 25. 普通页面

```text
Browser
 ↓
Next.js Route / Server Component
 ↓
Service
 ↓
DB
 ↓
PostgreSQL
```

---

## 26. 异步任务

```text
Browser
 ↓
Next.js API
 ↓
Redis Queue
 ↓
Worker
 ↓
External API / DB
 ↓
Redis / PostgreSQL
```

---

## 27. Plugin API

```text
Plugin UI
 ↓
Plugin API
 ↓
Authorization
 ↓
Core Service
 ↓
DB / Redis
```

---

# Architecture Rules

## 28. Core 与 Plugin 的边界

Core 应提供：

```text
Runtime
API
Extension Points
Authentication
Authorization
Database abstraction
Storage abstraction
Queue abstraction
UI infrastructure
```

Plugin 应提供：

```text
业务功能
插件 UI
插件 API
插件 Route
插件 Hook
插件数据
插件配置
```

---

## 29. 禁止的耦合

禁止：

```text
Core
 └── if pluginId === "music-player"
```

禁止：

```text
Plugin
 └── import "../../src/internal/..."
```

禁止：

```text
Plugin
 └── 直接操作 Core 私有 Redis Key
```

禁止：

```text
Plugin
 └── 直接修改 Core DOM
```

推荐：

```text
Core
 ↓
Public Extension API
 ↓
Plugin
```

---

## 30. 何时修改 Core

只有当：

```text
现有 Extension Point 无法满足需求
```

才考虑修改 Core。

正确流程：

```text
发现能力缺口
 ↓
设计通用 Extension Point
 ↓
实现 Extension Point
 ↓
增加测试
 ↓
更新 architecture.md
 ↓
Plugin 使用
```

错误流程：

```text
需要 Music Plugin
 ↓
修改 SiteHeader
 ↓
增加 musicPlayer 特殊判断
```

---

# Error Isolation

## 31. Plugin Failure

插件失败：

```text
Manifest Error
Load Error
Register Error
Render Error
Hook Error
API Error
Unload Error
```

必须尽量：

```text
记录
 ↓
标记插件失败
 ↓
隔离插件
 ↓
Core 继续运行
```

插件不能成为 Core 单点故障。

---

# Lifecycle Cleanup

## 32. 必须释放的资源

插件停止时必须释放：

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

必须防止：

```text
Memory Leak
Duplicate Listener
Duplicate Timer
Duplicate Subscription
Duplicate Request
```

---

# Version Compatibility

## 33. Plugin API Version

Plugin API Breaking Change 必须：

```text
升级 apiVersion
```

或者：

```text
提供兼容层
```

禁止悄悄修改：

```text
参数含义
返回结构
Hook 生命周期
Slot 行为
Manifest Schema
```

---

## 34. Manifest Compatibility

Runtime 应拒绝或隔离：

```text
unsupported apiVersion
invalid manifest
missing required field
invalid dependency
```

错误必须可诊断。

---

# Observability

## 35. Plugin Logging

日志应包含：

```text
pluginId
event
duration
error type
request/task id
```

禁止输出：

```text
password
token
cookie
secret
database password
```

推荐日志结构：

```text
[plugin:music-player]
```

而不是大量无上下文的：

```text
console.log("error")
```

---

# Documentation

## 36. 文档同步

修改以下内容必须考虑更新本文件：

```text
Plugin Runtime
Plugin API
Manifest
Extension Point
Plugin lifecycle
Security boundary
Architecture
```

如果架构发生实际变化：

```text
代码
 ↓
测试
 ↓
architecture.md
 ↓
AGENTS.md（如果规则发生变化）
```

---

# Architecture Decision

## 37. 判断标准

新增功能前先问：

### 是否应该是 Core？

如果功能：

- 所有用户都需要
- 是基础设施
- 提供通用扩展能力

可以考虑 Core。

### 是否应该是 Plugin？

如果功能：

- 可选
- 独立业务
- 有自己的 UI
- 有自己的数据
- 有自己的第三方 API
- 不应该污染 Core

优先 Plugin。

---

## 38. 最终架构原则

```text
Rhex Core
    ↓
提供稳定基础能力
    ↓
Extension Points
    ↓
Plugin Runtime
    ↓
Plugins
```

核心目标：

```text
低耦合
高扩展
可卸载
可测试
可升级
错误隔离
安全边界清晰
```

> **不要让 Rhex 为插件服务；应该让插件通过 Rhex 提供的稳定能力服务于 Rhex。**
