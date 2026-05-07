(function () {
    const assetConfigUrl = '../config/site-assets.json';
    const projectDataUrl = '../data/projects.json';
    const generatedSiteData = window.GeneratedSiteData || {};
    const fallbackCatalog = { items: [] };
    const fallbackAssets = {
        homeCover: '',
        projectCoverImages: {},
        detailImages: {},
        detailGalleries: {},
        detailVideos: {}
    };

    const categoryLabels = {
        android: 'Android',
        frontend: '前端',
        embedded: '嵌入式'
    };

    const contentTypeLabels = {
        image: '图片内容',
        gallery: '图集内容',
        video: '视频内容'
    };

    const pageTitle = document.getElementById('detailTitle');
    const pageSummary = document.getElementById('detailSummary');
    const pageBadge = document.getElementById('detailBadge');
    const pageMeta = document.getElementById('detailMeta');
    const pageMedia = document.getElementById('detailMedia');
    const pageHighlights = document.getElementById('detailHighlights');
    const pageBackLink = document.getElementById('detailBackLink');

    function getProjectId() {
        const params = new URLSearchParams(location.search);
        return params.get('id') || '';
    }

    function createCoverFallback(project) {
        const cover = project.cover || {};
        const label = cover.label || project.title || 'Project';
        const icon = cover.icon || 'fa-cube';
        const accent = cover.accent || '#7dbbff';
        const accentSoft = cover.accentSoft || '#ffd7ea';
        return `
            <div class="detail-cover detail-cover--icon" style="--cover-accent:${accent};--cover-accent-soft:${accentSoft};">
                <div class="detail-cover__mesh"></div>
                <div class="detail-cover__glow"></div>
                <div class="detail-cover__core"><i class="fa ${icon}"></i></div>
                <span class="detail-cover__badge">${label}</span>
            </div>
        `;
    }

    function renderMeta(project) {
        pageMeta.innerHTML = `
            <span class="detail-chip"><i class="fa fa-folder-open-o"></i>${categoryLabels[project.category] || project.category}</span>
            <span class="detail-chip"><i class="fa fa-tag"></i>${project.kind || project.contentType}</span>
            <span class="detail-chip"><i class="fa fa-file-o"></i>${contentTypeLabels[project.contentType] || project.contentType}</span>
        `;
    }

    function renderHighlights(project) {
        const highlights = Array.isArray(project.highlights) ? project.highlights : [];
        pageHighlights.innerHTML = highlights.map((item) => `<li>${item}</li>`).join('');
    }

    function renderImageMedia(project, assets) {
        const path = (assets.detailImages && assets.detailImages[project.id]) || '';
        if (path) {
            pageMedia.innerHTML = `<img class="detail-image" src="${path}" alt="${project.title}">`;
            return;
        }
        pageMedia.innerHTML = `
            <div class="detail-placeholder">
                ${createCoverFallback(project)}
                <p>这里可以放一张项目主图，后续只需要在 detailImages.${project.id} 中填写路径。</p>
            </div>
        `;
    }

    function renderGalleryMedia(project, assets) {
        const gallery = (assets.detailGalleries && assets.detailGalleries[project.id]) || [];
        if (gallery.length) {
            pageMedia.innerHTML = `
                <div class="detail-gallery">
                    ${gallery.map((src, index) => `
                        <figure class="detail-gallery__item">
                            <img src="${src}" alt="${project.title} 图集 ${index + 1}">
                        </figure>
                    `).join('')}
                </div>
            `;
            return;
        }

        pageMedia.innerHTML = `
            <div class="detail-placeholder detail-placeholder--gallery">
                <div class="detail-gallery detail-gallery--placeholder">
                    <div class="detail-gallery__item">${createCoverFallback(project)}</div>
                    <div class="detail-gallery__item detail-gallery__item--ghost"></div>
                    <div class="detail-gallery__item detail-gallery__item--ghost"></div>
                </div>
                <p>这里可以放多张图，后续只需要在 detailGalleries.${project.id} 数组里追加路径。</p>
            </div>
        `;
    }

    function renderVideoMedia(project, assets) {
        const path = (assets.detailVideos && assets.detailVideos[project.id]) || '';
        if (path) {
            pageMedia.innerHTML = `
                <video class="detail-video" controls playsinline preload="metadata" src="${path}"></video>
            `;
            return;
        }

        pageMedia.innerHTML = `
            <div class="detail-placeholder">
                ${createCoverFallback(project)}
                <p>这里可以放视频，后续只需要在 detailVideos.${project.id} 中填写地址。</p>
            </div>
        `;
    }

    function renderProject(project, assets) {
        document.title = `${project.title} | Akiyama Yusuke`;
        pageTitle.textContent = project.detailTitle || project.title;
        pageSummary.textContent = project.summary || '';
        pageBadge.textContent = project.cover?.label || project.title;
        pageBackLink.href = '../index.html#portfolio';
        renderMeta(project);
        renderHighlights(project);

        if (project.contentType === 'gallery') {
            renderGalleryMedia(project, assets);
        } else if (project.contentType === 'video') {
            renderVideoMedia(project, assets);
        } else {
            renderImageMedia(project, assets);
        }
    }

    function renderMissing() {
        document.title = '项目未找到 | Akiyama Yusuke';
        pageTitle.textContent = '项目未找到';
        pageSummary.textContent = '当前链接没有对应的数据，请检查项目 id 是否配置正确。';
        pageBadge.textContent = 'Project';
        pageMeta.innerHTML = '';
        pageHighlights.innerHTML = '<li>请检查 data/projects.json 中的项目 id。</li>';
        pageMedia.innerHTML = `
            <div class="detail-placeholder">
                <p>没有找到对应项目，可以返回首页重新选择。</p>
            </div>
        `;
    }

    async function init() {
        const loader = window.SiteDataLoader;
        if (!loader) return;

        const useGenerated = location.protocol === 'file:' && generatedSiteData.assets && generatedSiteData.projects;
        const [catalogRaw, assetRaw] = useGenerated
            ? [generatedSiteData.projects, generatedSiteData.assets]
            : await Promise.all([
                loader.loadJson(projectDataUrl, generatedSiteData.projects || fallbackCatalog),
                loader.loadJson(assetConfigUrl, generatedSiteData.assets || fallbackAssets)
            ]);

        const projects = loader.normalizeProjectCatalog(catalogRaw, fallbackCatalog.items);
        const assetConfig = loader.normalizeAssetConfig(assetRaw);
        assetConfig.detailImages = await loader.resolveImageMap(assetConfig.detailImages);
        assetConfig.detailGalleries = await loader.resolveGalleryMap(assetConfig.detailGalleries);

        const projectId = getProjectId();
        const project = projects.find((item) => item.id === projectId);
        if (!project) {
            renderMissing();
            return;
        }

        renderProject(project, assetConfig);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
