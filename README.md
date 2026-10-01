# Pkqa Center

个人站点与 Minecraft 工具工坊，使用 Next.js 静态导出，部署在 GitHub Pages。

## 本地运行

```bash
pnpm install
pnpm mc:data
pnpm dev
```

`pnpm build` 会重新生成 `public/mc-data/*.json`，然后导出静态站点到 `out/`。GitHub Pages 工作流在推送 `main` 时执行相同构建步骤。

## 工具页面

访问 `/tools`：

| 工具 | 数据与运行方式 |
| --- | --- |
| `/give` 物品与附魔 | 浏览器本地；物品和附魔数据由 `minecraft-data` 在构建时生成 |
| 颜色文字与 `/tellraw` | 浏览器本地；支持渐变、AB 交替和逐字上色，按 Java 1.21.5 的文本格式分界 |
| 主世界与下界坐标 | 浏览器本地 |
| Java / 基岩版服务器状态 | 地址默认留空；浏览器优先调用 [mcstatus.io](https://mcstatus.io/docs)，未探测到在线响应时向 [MCSrvStat.us](https://api.mcsrvstat.us/) 复核；结果由接口缓存 |
| Java 玩家 UUID、皮肤与已装备披风 | 打开页面自动查询 Pkqa；浏览器调用 [PlayerDB](https://playerdb.co/)；头像来自 Crafthead，皮肤和披风来自 Mojang 贴图地址，使用 [skinview3d](https://github.com/bs-community/skinview3d) 展示披风人物，资料可能存在缓存延迟 |
| Java 版本动态 | 浏览器读取 [Mojang 官方版本目录](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json) |
| `/effect` 状态效果与多效果药水 | 浏览器本地；可切换生成单效果 `/effect` 或多效果药水 `/give`，按版本输出 NBT 或物品组件；效果数据由 `minecraft-data` 在构建时生成 |
| `/title` 标题、字幕与操作栏 | 浏览器本地；三个区域独立配色，支持渐变、AB 交替和逐字上色，按 Java 1.21.5 的文本格式分界 |
| `/setblock` 与 `/fill` | 浏览器本地；方块目录由 `minecraft-data` 在构建时生成，包含体积检查 |
| 工作台配方查询 | 浏览器本地；按大类、小类和中英文名称查找，显示图标和数据源收录的有序、无序合成方案 |
| 时间、天气与难度 | 浏览器本地；生成 `/time`、`/weather`、`/difficulty` 指令 |
| 实体召唤与刷怪蛋 | 浏览器本地；实体目录由 `minecraft-data` 在构建时生成，刷怪蛋按物品目录确认 |
| 旗帜与盾牌图案 | 浏览器本地；编辑图层、预览图案并生成 `/give` 指令 |
| 熔炼、切石、锻造与酿造配方 | 浏览器本地；按当前版本的数据目录查询 |
| 数据包制作器 | 浏览器本地；生成配方与战利品表 ZIP，1.20.6 起可将本站 `/give` 的名称、描述、附魔及无法破坏属性导入配方产物 |

本地版本目录覆盖 Java `1.8.9`、`1.12.2`、`1.16.5`、`1.17`、`1.20.4`、`1.20.6`、`1.21.5`、`1.21.8`、`26.1`。各工具按当前版本能力提供功能；数据包制作器支持 `1.16.5` 及以上所列版本。原版工作台配方从 `1.20.5` 才支持带组件的产物，因此旧版配方不会导入 `/give` 属性。Mojang 版本动态与本地指令数据是两套独立信息；出现更新的游戏版本时，需要先更新 `minecraft-data`、核对指令格式并重新构建，才开放该版本的指令生成。

当前无需 Cloudflare Worker。以后接入需要服务器凭据、数据库或原生 TCP 查询的功能时，可保持此站点静态部署，将 API 放在 `api.pkqa.top` 的 Worker；浏览器不得持有 RCON 密码等服务端密钥。公共 API 的跨域许可、缓存和限额可能变化，因此查询工具带有失败与超时提示。

## 检查

```bash
pnpm check:mc
pnpm check:expanded
pnpm check:potion
pnpm lint
pnpm build
```

`check:mc` 对照 Mojang 发布记录中的关键版本差异，检查旧 NBT、1.20.5 后的物品组件、1.21.5 后简化的附魔格式及附魔书。`check:expanded` 检查跨版本目录、数据包 ZIP 及 `/give` 产物属性导入；`check:potion` 检查 1.8.9 至 26.1 的多效果药水语法与旧版效果过滤。浏览器交互仍应在所选游戏版本内最终验证。
草稿 PR 会运行相同的检查和静态构建；只有推送到 `main` 才触发 GitHub Pages 部署。

## 数据与致谢

物品、附魔、效果、方块、实体和合成配方目录来自 MIT 许可的 [PrismarineJS/minecraft-data](https://github.com/PrismarineJS/minecraft-data)。简体中文译名在构建前由 [Mojang 版本资源目录](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json) 中对应版本的语言文件生成，并校验 SHA-1。配方分类与大部分图标来自 [Block Render](https://blockrender.dev/)；部分特殊物品图标来自 MIT 许可的 [Webisso/minecraft-item-icons](https://github.com/Webisso/minecraft-item-icons)，其余少量新版物品用本站 CSS 占位图。外部图标源可能停机、变更或与所选游戏版本外观不一致。图形装饰由本站 CSS 绘制。本站是非官方爱好者工具，与 Mojang、Microsoft 无关联。

更新本地化、分类或补充图标索引时，可分别运行 `node scripts/update-mc-locales.mjs`、`node scripts/update-mc-item-categories.mjs`、`node scripts/update-mc-fallback-icons.mjs`，再运行 `pnpm mc:data`。日常构建读取仓库中的已生成索引，无需访问这些外部接口。
