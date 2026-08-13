# Changelog

本项目所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Fixed

- 修复移动端右侧小边栏在首页与板块页空白的问题：被 `hidden` 类隐藏的侧栏内容经 `Suspense` 包裹时不再正常展开，现改为穿透容器、仅对真实 DOM 节点调整类名
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
