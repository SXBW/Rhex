# 20260710 瀑布流导航修复

## 修改内容

- PC 端在瀑布流中点击帖子链接时，强制在新标签页打开。
- 原瀑布流标签页保持已加载数据和滚动位置，避免返回后丢失浏览位置。
- 手机触屏端继续使用原生站内导航和 BFCache，不改变侧滑返回体验。
- 分页列表、用户头像、板块链接和其他站内导航不受影响。

## 代码提交

```text
3be880d fix: open infinite feed posts in new tabs
```

## 校验结果

```text
git diff --check              通过
tsc --noEmit --pretty false   通过
```

## GitHub 推送

当前环境连接 `github.com:443` 超时，请在项目目录执行：

```bash
git push origin HEAD:main
```

## 历史 Docker 镜像

```text
ghcr.io/momofa/rhex-custom:latest
```

这是迁移前的历史发布记录，该镜像仅保留用于回滚，不再由 `momofa/Rhex` 更新。生产服务器平台为 `linux/amd64`。
