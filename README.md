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
| 颜色文字与 `/tellraw` | 浏览器本地；按 Java 1.21.5 的文本格式分界 |
| 主世界与下界坐标 | 浏览器本地 |
| Java / 基岩版服务器状态 | 浏览器调用 [mcstatus.io](https://mcstatus.io/docs)，结果由接口缓存 |
| Java 玩家 UUID 与皮肤 | 浏览器调用 [PlayerDB](https://playerdb.co/)；头像来自 Crafthead，皮肤来自 Mojang 贴图地址 |
| Java 版本动态 | 浏览器读取 [Mojang 官方版本目录](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json) |
| `/effect` 状态效果 | 浏览器本地；效果数据由 `minecraft-data` 在构建时生成 |
| `/title` 标题、字幕与操作栏 | 浏览器本地；按 Java 1.21.5 的文本格式分界 |
| `/setblock` 与 `/fill` | 浏览器本地；方块目录由 `minecraft-data` 在构建时生成，包含体积检查 |
| 工作台配方查询 | 浏览器本地；显示数据源收录的有序和无序合成方案 |

指令数据覆盖 Java `1.20.4`、`1.20.6`、`1.21.5`、`1.21.8`、`26.1`。Mojang 版本动态与本地指令数据是两套独立信息；出现更新的游戏版本时，需要先更新 `minecraft-data`、核对指令格式并重新构建，才开放该版本的指令生成。

当前无需 Cloudflare Worker。以后接入需要服务器凭据、数据库或原生 TCP 查询的功能时，可保持此站点静态部署，将 API 放在 `api.pkqa.top` 的 Worker；浏览器不得持有 RCON 密码等服务端密钥。公共 API 的跨域许可、缓存和限额可能变化，因此查询工具带有失败与超时提示。

## 检查

```bash
pnpm check:mc
pnpm lint
pnpm build
```

`check:mc` 对照 Mojang 发布记录中的关键版本差异，检查旧 NBT、1.20.5 后的物品组件、1.21.5 后简化的附魔格式及附魔书。浏览器交互仍应在所选游戏版本内最终验证。

## 数据与致谢

物品、附魔、效果、方块和合成配方目录来自 MIT 许可的 [PrismarineJS/minecraft-data](https://github.com/PrismarineJS/minecraft-data)。图形装饰由本站 CSS 绘制。项目没有直接复制其他 Minecraft 工具网站的界面或代码。
