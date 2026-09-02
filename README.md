# AkiyamaYusuke.github.io

## 内容配置：模板提交 vs 个人本地覆盖

站点文案与作品走**分层加载**，优先级从高到低：

1. **个人本地覆盖（最高）**：`data/site-copy.local.json`、`data/projects.local.json`
   只存在于本机、已在 `.gitignore` 中（不入库）。文件存在即覆盖下面的提交版。
2. **提交的模板（默认）**：`data/site-copy.json`、`data/projects.json`
   仓库内为通用示例内容，供 fork / 复刻后直接改写。
3. **代码内置默认**：页面自身的兜底字段。

改内容有两种方式：

- 直接改 `data/site-copy.json` / `data/projects.json`（改动会进入 git 提交）；
- 或复制出 `.local` 再改：`copy data/site-copy.json data/site-copy.local.json`
  之后编辑 `.local.json` —— 仅本机生效、不影响提交的模板；部署打包会把它带上服务器，
  服务器优先显示 `.local` 的真实内容。

改完内容后跑一次 `node scripts/sync-site-data.mjs`，重新生成
`js/config/generated-site-data.js`（本地 `file://` 直开用的离线快照；该文件同样不入库）。

主要内容文件：

- `data/site-copy.json` —— 文案：title / 导航 / 首页 / profile / 指标 / 技能 / 时间线 / 联系 / 页脚
- `data/projects.json` —— 作品卡列表（首页作品墙 + 详情页）
- `config/site-assets.json` —— 封面与媒体路径
- `config/portfolio-circle-gallery.json` —— 旋转画廊封面
- `config/site-default-settings.json` —— 页面默认设置

## Asset Config

All cover and media paths are managed in:

- `config/site-assets.json`

Structure:

```json
{
  "homeCover": "",
  "projectCoverImages": {
    "android-mobile-ui": ""
  },
  "detailImages": {
    "android-mobile-ui": ""
  },
  "detailGalleries": {
    "frontend-layout-flow": []
  },
  "detailVideos": {
    "embedded-device-motion": ""
  }
}
```

Field usage:

- `homeCover`
  Home cover
- `projectCoverImages`
  Card covers used on the home page
- `detailImages`
  Single-image project detail media
- `detailGalleries`
  Gallery project detail media
- `detailVideos`
  Video project detail media

Project metadata is stored in:

- `data/projects.json`

## Pages

- `index.html`
  Home page
- `pages/project-detail.html`
  Reusable project detail page
- `js/main.js`
  Home page logic
- `js/project-detail.js`
  Detail page logic
- `js/data/site-data-loader.js`
  Shared JSON loading and asset resolving logic

## Open Source

- [Live2D Cubism SDK for Web](https://github.com/Live2D/CubismWebFramework)
- [Live2D Cubism Core](https://www.live2d.com/en/sdk/about/)
- [Font Awesome](https://fontawesome.com/)
- [GitHub Pages](https://pages.github.com/)
