# Pkqa Center

GloryPkqa 的个人主页，基于 Next.js App Router、TypeScript、Tailwind CSS 和 Framer Motion。

## 本地开发

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 预览。生产构建使用 `pnpm build`，代码规范检查使用 `pnpm lint`。

## 修改网站内容

- 语录：`src/data/quotes.ts`
- 兴趣卡片：`src/data/interests.ts`
- 社交链接：`src/data/socials.ts`
- 页面结构与交互：`src/components/SiteExperience.tsx`
- 主题、排版与响应式样式：`src/app/globals.css`

主题选择会保存在浏览器本地。首次访问默认深色主题。

## GitHub Pages

将项目推送到 `GloryPkqa/glorypkqa.github.io` 的 `main` 分支后，GitHub Actions 会导出静态页面并发布到现有 GitHub Pages 站点。该站点已绑定 `https://pkqa.top/`，因此新版本会替换这个地址上的页面。此配置不修改 DNS，旧版本可从 Git 历史恢复。
