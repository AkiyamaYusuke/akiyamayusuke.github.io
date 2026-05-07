# AkiyamaYusuke.github.io

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
