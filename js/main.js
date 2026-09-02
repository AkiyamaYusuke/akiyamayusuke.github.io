(function () {
    const assetConfigUrl = 'config/site-assets.json';
    const projectDataUrl = 'data/projects.json';
    const defaultSettingsUrl = 'config/site-default-settings.json';
    const circleGalleryConfigUrl = 'config/portfolio-circle-gallery.json';
    const siteCopyUrl = 'data/site-copy.json';
    const generatedSiteData = window.GeneratedSiteData || {};

    // 首页文案与内容列表统一由 data/site-copy.json 驱动(sync 脚本并进 GeneratedSiteData)：
    // 改 JSON 即改站。以下数组在 loadSiteCopy() 时填充,渲染函数保持 map 通用。
    let metrics = [];
    let stats = [];
    let skills = [];
    let timeline = [];
    let contacts = [];

    // 默认作品与 data/projects.json 同源：直接派生自内嵌的 GeneratedSiteData 快照，
    // 避免两份数据漂移；远程模式下 loadProjectCatalog 会再用 projects.json 覆盖。
    const defaultProjects = Array.isArray(window.GeneratedSiteData?.projects?.items)
        ? window.GeneratedSiteData.projects.items.map((item) => ({ ...item }))
        : [];

    const defaultHomeCover = {
        name: 'P · R · T',
        icon: 'fa-sitemap',
        accent: '#31e0c6',
        accentSoft: '#d8f6ff',
        orbit: ['fa-camera-retro', 'fa-video-camera', 'fa-desktop', 'fa-gamepad']
    };
    let projects = defaultProjects.slice();

    const categoryLabels = {
        all: '全部',
        graphic: '图形',
        streaming: '流媒体',
        system: '系统',
        ai: 'AI'
    };

    const categoryIcons = {
        graphic: 'desktop',
        streaming: 'play-circle',
        system: 'android',
        ai: 'bolt'
    };

    const storageKeys = {
        theme: 'akiyama-theme',
        githubProfile: 'akiyama-github-profile',
        effects: 'akiyama-effects',
        settings: 'akiyama-ui-settings'
    };

    const githubUsername = 'AkiyamaYusuke';
    const githubProfileUrl = 'https://github.com/AkiyamaYusuke/';
    const githubAvatarUrl = 'https://github.com/AkiyamaYusuke.png';

    const metricsHost = document.getElementById('homeMetrics');
    const statsHost = document.getElementById('statsGrid');
    const filtersHost = document.getElementById('projectFilters');
    const gridHost = document.getElementById('projectGrid');
    const skillsHost = document.getElementById('skillsList');
    const timelineHost = document.getElementById('timelineList');
    const contactHost = document.getElementById('contactList');
    const yearHost = document.getElementById('year');
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const brandAvatar = document.getElementById('brandAvatar');
    const brandName = document.getElementById('brandName');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const brandLink = document.querySelector('.brand');
    const profileLink = document.querySelector('.profile-link');
    const footerName = document.getElementById('footerName');
    const particleTrail = document.getElementById('particleTrail');
    const trailOverlay = document.getElementById('trailOverlay');
    const magicTrail = document.getElementById('magicTrail');
    const homeBackdrop = document.querySelector('.home-backdrop');
    const homeCoverHost = document.getElementById('homeCoverLayer');
    const backgroundOverlay = document.querySelector('.background-overlay');
    const backgroundEffectsLayer = document.getElementById('backgroundEffectsLayer');
    const settingsDrawerRoot = document.getElementById('settingsDrawer');
    const settingsTrigger = document.getElementById('settingsTrigger');
    const settingsClose = document.getElementById('settingsClose');
    const settingsContent = document.getElementById('settingsContent');

    let currentThemePreference = 'light';
    let rafPending = false;
    let pointerTargetX = window.innerWidth * 0.5;
    let pointerTargetY = window.innerHeight * 0.5;
    let particleNetworkEffect = null;
    let trailRippleEffect = null;
    let clickSigilEffect = null;
    let live2dDockController = null;
    let backgroundEffectsController = null;
    let settingsStore = null;
    let settingsDrawer = null;
    let portfolioLayoutController = null;
    let tarotFeature = null;
    let effectState = null;
    let assetPathConfig = {
        homeCover: '',
        projectCoverImages: {},
        detailImages: {},
        detailGalleries: {},
        detailVideos: {}
    };
    let resolvedAssetPaths = {
        homeCover: '',
        projectCoverImages: {}
    };
    let circleGalleryImages = {};
    let defaultSettingsConfig = {
        theme: {
            preference: 'auto'
        },
        effects: {
            particles: false,
            trail: true,
            click: true
        },
        background: {
            blur: 72,
            effect: 'rain'
        },
        portfolio: {
            layout: 'circle'
        },
        live2d: {
            renderer: 'sdk'
        }
    };

    function mergeDeep(base, patch) {
        if (Array.isArray(base)) return Array.isArray(patch) ? patch.slice() : base.slice();
        if (!base || typeof base !== 'object') return patch ?? base;

        const next = { ...base };
        Object.keys(next).forEach((key) => {
            next[key] = mergeDeep(next[key], patch?.[key]);
        });

        if (patch && typeof patch === 'object') {
            Object.keys(patch).forEach((key) => {
                if (!(key in next)) {
                    next[key] = patch[key];
                }
            });
        }

        return next;
    }

    function getDefaultSettings() {
        return structuredClone(defaultSettingsConfig);
    }

    async function loadDefaultSettingsConfig() {
        if (!window.SiteDataLoader) return;
        const parsed = await window.SiteDataLoader.loadJson(defaultSettingsUrl, defaultSettingsConfig);
        defaultSettingsConfig = mergeDeep(defaultSettingsConfig, parsed || {});
    }

    async function loadCircleGalleryImages() {
        if (!window.SiteDataLoader) return;
        if (location.protocol === 'file:' && generatedSiteData.circleGallery) {
            const embeddedItems = generatedSiteData.circleGallery.items;
            circleGalleryImages = embeddedItems && typeof embeddedItems === 'object' ? embeddedItems : {};
            return;
        }
        const parsed = await window.SiteDataLoader.loadContentJson(circleGalleryConfigUrl, {
            items: generatedSiteData.circleGallery?.items || circleGalleryImages
        });
        circleGalleryImages = parsed?.items && typeof parsed.items === 'object' ? parsed.items : {};
    }

    async function loadAssetConfig() {
        if (!window.SiteDataLoader) return;
        if (location.protocol === 'file:' && generatedSiteData.assets) {
            assetPathConfig = window.SiteDataLoader.normalizeAssetConfig(generatedSiteData.assets);
            return;
        }
        const parsed = await window.SiteDataLoader.loadContentJson(assetConfigUrl, generatedSiteData.assets || assetPathConfig);
        assetPathConfig = window.SiteDataLoader.normalizeAssetConfig(parsed);
    }

    async function loadProjectCatalog() {
        if (!window.SiteDataLoader) return;
        if (location.protocol === 'file:' && generatedSiteData.projects) {
            projects = window.SiteDataLoader.normalizeProjectCatalog(generatedSiteData.projects, defaultProjects);
            return;
        }
        const parsed = await window.SiteDataLoader.loadContentJson(
            projectDataUrl,
            generatedSiteData.projects || { items: defaultProjects }
        );
        projects = window.SiteDataLoader.normalizeProjectCatalog(parsed, defaultProjects);
    }

    // 站点文案：远程 http(s) 直接抓 data/site-copy.json；file:// 用 sync 脚本
    // 打进 GeneratedSiteData 的 siteCopy 快照。载入后填内容数组并批量落 DOM。
    let siteCopy = {};

    function readPath(root, dottedPath) {
        return String(dottedPath)
            .split('.')
            .reduce((node, key) => (node == null ? node : node[key]), root);
    }

    function applySiteCopy(copy) {
        if (!copy || typeof copy !== 'object') return;

        document.querySelectorAll('[data-copy]').forEach((node) => {
            const value = readPath(copy, node.getAttribute('data-copy'));
            if (value == null) return;
            node.textContent = String(value);
            if (node.tagName === 'TITLE') {
                document.title = String(value);
            }
        });

        document.querySelectorAll('[data-copy-attr]').forEach((node) => {
            const attrName = node.getAttribute('data-copy-target') || 'content';
            const value = readPath(copy, node.getAttribute('data-copy-attr'));
            if (value == null) return;
            node.setAttribute(attrName, String(value));
        });
    }

    async function loadSiteCopy() {
        let parsed = generatedSiteData.siteCopy;
        if (window.SiteDataLoader && location.protocol !== 'file:') {
            parsed = await window.SiteDataLoader.loadContentJson(siteCopyUrl, parsed || {});
        }
        siteCopy = parsed && typeof parsed === 'object' ? parsed : {};
        metrics = Array.isArray(siteCopy.metrics) ? siteCopy.metrics : [];
        stats = Array.isArray(siteCopy.sections?.tech?.cards) ? siteCopy.sections.tech.cards : [];
        skills = Array.isArray(siteCopy.sections?.about?.skills) ? siteCopy.sections.about.skills : [];
        timeline = Array.isArray(siteCopy.sections?.about?.timeline) ? siteCopy.sections.about.timeline : [];
        contacts = Array.isArray(siteCopy.sections?.contact?.channels) ? siteCopy.sections.contact.channels : [];
        applySiteCopy(siteCopy);
    }

    async function resolveAssetPaths() {
        if (!window.SiteDataLoader) return;
        const homeCover = await window.SiteDataLoader.probeImage((assetPathConfig.homeCover || '').trim());
        const projectCoverImages = await window.SiteDataLoader.resolveImageMap(assetPathConfig.projectCoverImages);
        resolvedAssetPaths = {
            homeCover,
            projectCoverImages
        };
    }

    function resolveConfiguredImagePath(configuredPath, resolvedPath) {
        const normalizedConfiguredPath = (configuredPath || '').trim();
        if (resolvedPath) {
            return window.RuntimePathResolver?.preferServedAsset(resolvedPath) || resolvedPath;
        }

        if (/^(https?:)?\/\//.test(normalizedConfiguredPath) || normalizedConfiguredPath.startsWith('data:')) {
            return normalizedConfiguredPath;
        }

        if (location.protocol === 'file:' && normalizedConfiguredPath) {
            return window.RuntimePathResolver?.preferServedAsset(normalizedConfiguredPath) || normalizedConfiguredPath;
        }

        return '';
    }

    function renderManagedImage(className, preferredPath, fallbackPath, altText) {
        const fallbackAttr = fallbackPath ? ` data-fallback-src="${fallbackPath}"` : '';
        const onError = fallbackPath
            ? ' onerror="if(this.dataset.fallbackSrc&&this.src!==this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;this.removeAttribute(\'data-fallback-src\');}"'
            : '';
        return `<img class="${className}" src="${preferredPath}" alt="${altText}"${fallbackAttr}${onError}>`;
    }

    function applyGitHubProfile(profile) {
        const displayName = profile?.name || githubUsername;
        const avatarUrl = profile?.avatarUrl || githubAvatarUrl;

        [brandAvatar, profileAvatar].forEach((img) => {
            if (img) img.src = avatarUrl;
        });

        if (brandAvatar) brandAvatar.alt = `${displayName} 的 GitHub 头像`;
        if (profileAvatar) profileAvatar.alt = `${displayName} 的 GitHub 头像`;
        if (brandName) brandName.textContent = displayName;
        if (profileName) profileName.textContent = displayName;
        if (footerName) footerName.textContent = displayName;

        if (brandLink) {
            brandLink.href = githubProfileUrl;
            brandLink.target = '_blank';
            brandLink.rel = 'noopener noreferrer';
        }
        if (profileLink) {
            profileLink.href = githubProfileUrl;
            profileLink.target = '_blank';
            profileLink.rel = 'noopener noreferrer';
        }
    }

    function loadCachedGitHubProfile() {
        try {
            const cached = JSON.parse(localStorage.getItem(storageKeys.githubProfile));
            if (cached) {
                applyGitHubProfile(cached);
                return;
            }
        } catch {
            // Ignore broken cache.
        }
        applyGitHubProfile({ name: githubUsername, avatarUrl: githubAvatarUrl });
    }

    function resolveTheme(preference) {
        if (preference === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return preference;
    }

    function setTheme(preference, persist = true) {
        currentThemePreference = preference;
        const actualTheme = resolveTheme(preference);
        document.documentElement.dataset.theme = actualTheme;
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', actualTheme === 'dark' ? '#070d16' : '#e9f1fb');
        }
        if (persist) {
            localStorage.setItem(storageKeys.theme, preference);
        }
    }

    function attachThemeWatcher() {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const sync = () => {
            if (currentThemePreference === 'auto') {
                setTheme('auto', false);
            }
        };
        if (media.addEventListener) {
            media.addEventListener('change', sync);
        } else {
            media.addListener(sync);
        }
    }

    function renderMetrics() {
        metricsHost.innerHTML = metrics.map(({ value, label }) => `
            <article class="metric-card">
                <strong>${value}</strong>
                <span>${label}</span>
            </article>
        `).join('');
    }

    function renderStats() {
        statsHost.innerHTML = stats.map(({ label, value }) => `
            <article class="stat-card reveal tilt-card">
                <div class="label">${label}</div>
                <div class="value">${value}</div>
            </article>
        `).join('');
    }

    function renderFilters() {
        const filters = ['all', ...new Set(projects.map((item) => item.category))];
        filtersHost.innerHTML = filters.map((key, index) => `
            <button type="button" class="btn filter-btn${index === 0 ? ' is-active' : ''}" data-filter="${key}">
                ${categoryLabels[key]}
            </button>
        `).join('');
    }

    function renderHomeCover() {
        if (!homeCoverHost) return;

        const homePath = resolveConfiguredImagePath(assetPathConfig.homeCover, resolvedAssetPaths.homeCover);
        if (homePath) {
            const homeFallbackPath = (assetPathConfig.homeCover || '').trim();
            homeCoverHost.innerHTML = renderManagedImage('home-cover-image', homePath, homeFallbackPath, defaultHomeCover.name);
            return;
        }

        const orbitIcons = Array.isArray(defaultHomeCover.orbit) ? defaultHomeCover.orbit : [];
        homeCoverHost.innerHTML = `
            <div class="home-cover-icon" style="--cover-accent:${defaultHomeCover.accent};--cover-accent-soft:${defaultHomeCover.accentSoft};">
                <div class="home-cover-grid"></div>
                <div class="home-cover-rings">
                    ${orbitIcons.map((icon, index) => `
                        <span class="home-orbit home-orbit-${index + 1}"><i class="fa ${icon}"></i></span>
                    `).join('')}
                </div>
                <div class="home-cover-core">
                    <span class="home-cover-badge">${defaultHomeCover.name}</span>
                    <i class="fa ${defaultHomeCover.icon}"></i>
                </div>
            </div>
        `;
    }

    function getProjectCoverData(item) {
        const imagePath = resolveConfiguredImagePath(
            assetPathConfig.projectCoverImages[item.id],
            resolvedAssetPaths.projectCoverImages[item.id]
        );
        const cover = item.cover || {};
        const accent = cover.accent || '#7dbbff';
        const accentSoft = cover.accentSoft || '#dff3ff';
        const icon = cover.icon || `fa-${categoryIcons[item.category]}`;
        const label = cover.label || categoryLabels[item.category];

        return {
            imagePath,
            circleImagePath: resolveConfiguredImagePath(circleGalleryImages[item.id], ''),
            fallbackPath: (assetPathConfig.projectCoverImages[item.id] || '').trim(),
            accent,
            accentSoft,
            icon,
            label,
            cover
        };
    }

    function renderProjectCover(item) {
        const {
            imagePath,
            fallbackPath,
            accent,
            accentSoft,
            icon,
            label
        } = getProjectCoverData(item);

        if (imagePath) {
            return renderManagedImage('project-thumb', imagePath, fallbackPath, label || item.title);
        }

        return `
            <div class="project-thumb project-thumb--icon" aria-hidden="true" style="--cover-accent:${accent};--cover-accent-soft:${accentSoft};">
                <div class="project-thumb__mesh"></div>
                <div class="project-thumb__glow"></div>
                <div class="project-thumb__badge">${label}</div>
                <div class="project-thumb__core">
                    <i class="fa ${icon}"></i>
                </div>
                <span class="project-thumb__mini project-thumb__mini-a"><i class="fa fa-circle-o"></i></span>
                <span class="project-thumb__mini project-thumb__mini-b"><i class="fa ${icon}"></i></span>
                <span class="project-thumb__mini project-thumb__mini-c">+</span>
            </div>
        `;
    }

    function initPortfolioLayout() {
        if (!window.PortfolioLayoutController) {
            renderFilters();
            renderProjects();
            bindFilters();
            return;
        }

        portfolioLayoutController = new window.PortfolioLayoutController({
            filtersHost,
            gridHost,
            categoryLabels,
            categoryIcons,
            getProjects: () => projects,
            getHref: (item) => item.detailPath || `pages/project-detail.html?id=${item.id}`,
            resolveCoverData: getProjectCoverData,
            getCenterProfile: () => ({
                name: (profileName?.textContent || brandName?.textContent || githubUsername).trim(),
                avatar: profileAvatar?.getAttribute('src') || brandAvatar?.getAttribute('src') || '',
                subtitle: '感知 · 渲染 · 传输'
            }),
            onAfterRender: () => {
                bindTiltInteractions();
                bindRippleInteractions();
                observeReveals();
            }
        });

        portfolioLayoutController.init();
    }

    function renderProjects(filter = 'all') {
        const list = filter === 'all' ? projects : projects.filter((item) => item.category === filter);
        gridHost.innerHTML = list.map((item) => `
            <a class="project-card reveal tilt-card ripple" href="${item.detailPath || `pages/project-detail.html?id=${item.id}`}" data-category="${item.category}">
                ${renderProjectCover(item)}
                <div class="project-overlay">
                    <h3 class="project-title">${item.title}</h3>
                    <div class="project-meta">
                        <span class="chip"><i class="fa fa-${categoryIcons[item.category]}"></i>${categoryLabels[item.category]}</span>
                        <span class="chip"><i class="fa fa-tag"></i>${item.kind}</span>
                    </div>
                </div>
            </a>
        `).join('');
        bindTiltInteractions();
        bindRippleInteractions();
        observeReveals();
    }

    function renderSkills() {
        skillsHost.innerHTML = skills.map(({ name, value }) => `
            <div class="skill">
                <div class="skill-head">
                    <span>${name}</span>
                    <span>${value}%</span>
                </div>
                <div class="skill-track">
                    <div class="skill-fill" style="width:${value}%"></div>
                </div>
            </div>
        `).join('');
    }

    function renderTimeline() {
        timelineHost.innerHTML = timeline.map(({ title, time }) => `
            <article class="timeline-item reveal tilt-card">
                <div class="time">${time}</div>
                <h4>${title}</h4>
            </article>
        `).join('');
    }

    function renderContacts() {
        contactHost.innerHTML = contacts.map(({ label, value, href }) => {
            const Tag = href === '#' ? 'div' : 'a';
            const attrs = href === '#'
                ? ''
                : ` href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}`;
            return `
                <${Tag} class="contact-item reveal tilt-card"${attrs}>
                    <span>
                        <span class="label">${label}</span><br>
                        <span class="value">${value}</span>
                    </span>
                    <i class="fa fa-angle-right"></i>
                </${Tag}>
            `;
        }).join('');
    }

    function observeReveals() {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.16 });

        document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => observer.observe(el));
    }

    function bindFilters() {
        filtersHost.addEventListener('click', (event) => {
            const button = event.target.closest('.filter-btn');
            if (!button) return;

            filtersHost.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('is-active'));
            button.classList.add('is-active');
            renderProjects(button.dataset.filter);
        });
    }

    function bindPointerParallax() {
        window.addEventListener('pointermove', (event) => {
            pointerTargetX = event.clientX;
            pointerTargetY = event.clientY;

            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                const xPercent = `${(event.clientX / window.innerWidth) * 100}%`;
                const yPercent = `${(event.clientY / window.innerHeight) * 100}%`;
                document.documentElement.style.setProperty('--cursor-x', xPercent);
                document.documentElement.style.setProperty('--cursor-y', yPercent);

                if (homeBackdrop) {
                    const shiftX = ((event.clientX / window.innerWidth) - 0.5) * -18;
                    const shiftY = ((event.clientY / window.innerHeight) - 0.5) * -14;
                    homeBackdrop.style.setProperty('--home-shift-x', `${shiftX.toFixed(2)}px`);
                    homeBackdrop.style.setProperty('--home-shift-y', `${shiftY.toFixed(2)}px`);
                }
                rafPending = false;
            });
        }, { passive: true });
    }

    function applyEffectState() {
        if (particleNetworkEffect) {
            particleNetworkEffect.setEnabled(effectState.particles);
        }
        if (trailRippleEffect) {
            trailRippleEffect.setEnabled(effectState.trail);
        }
        if (clickSigilEffect) {
            clickSigilEffect.setEnabled(effectState.click);
        }
    }

    function bindTiltInteractions() {
        document.querySelectorAll('.tilt-card').forEach((card) => {
            if (card.dataset.tiltBound === '1') return;
            card.dataset.tiltBound = '1';

            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const px = (event.clientX - rect.left) / rect.width;
                const py = (event.clientY - rect.top) / rect.height;
                const rx = (0.5 - py) * 8;
                const ry = (px - 0.5) * 10;
                card.style.setProperty('--tilt-x', `${rx.toFixed(2)}deg`);
                card.style.setProperty('--tilt-y', `${ry.toFixed(2)}deg`);
                card.style.setProperty('--lift', '-4px');
            });

            card.addEventListener('pointerleave', () => {
                card.style.setProperty('--tilt-x', '0deg');
                card.style.setProperty('--tilt-y', '0deg');
                card.style.setProperty('--lift', '0px');
            });
        });
    }

    function bindRippleInteractions() {
        document.querySelectorAll('.ripple').forEach((button) => {
            if (button.dataset.rippleBound === '1') return;
            button.dataset.rippleBound = '1';

            button.addEventListener('click', (event) => {
                const rect = button.getBoundingClientRect();
                const ripple = document.createElement('span');
                ripple.className = 'ripple-wave';
                const size = Math.max(rect.width, rect.height) * 1.3;
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
                ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
                button.appendChild(ripple);
                setTimeout(() => ripple.remove(), 650);
            });
        });
    }

    function setActiveNav() {
        const sections = navLinks
            .map((link) => document.querySelector(link.getAttribute('href')))
            .filter(Boolean);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                navLinks.forEach((link) => {
                    link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`);
                });
            });
        }, { threshold: 0.34 });

        sections.forEach((section) => observer.observe(section));
    }

    function syncSettingsState(state) {
        currentThemePreference = state.theme.preference;
        effectState = { ...state.effects };
        setTheme(state.theme.preference, false);
        localStorage.setItem(storageKeys.theme, state.theme.preference);
        localStorage.setItem(storageKeys.effects, JSON.stringify(effectState));
        applyEffectState();
        backgroundEffectsController?.apply(state.background);
        live2dDockController?.applySettings(state.live2d);
        portfolioLayoutController?.setMode(state.portfolio?.layout || 'grid');
    }

    function initSettings() {
        if (!window.SiteSettingsStore || !window.SettingsDrawer || !window.HomeSettingsConfig) {
            effectState = getDefaultSettings().effects;
            setTheme(localStorage.getItem(storageKeys.theme) || 'light', false);
            attachThemeWatcher();
            applyEffectState();
            return;
        }

        settingsStore = new window.SiteSettingsStore({
            storageKey: storageKeys.settings,
            defaults: getDefaultSettings()
        });

        if (settingsStore.get('background.blur') !== undefined) {
            settingsStore.set('background.blur', Math.max(0, Math.min(100, Math.round(Number(settingsStore.get('background.blur')) || 0))));
        }

        settingsDrawer = new window.SettingsDrawer({
            root: settingsDrawerRoot,
            trigger: settingsTrigger,
            close: settingsClose,
            content: settingsContent,
            sections: window.HomeSettingsConfig,
            store: settingsStore,
            actions: {
                openTarot: () => tarotFeature?.open()
            }
        });

        settingsDrawer.init();
        syncSettingsState(settingsStore.getState());
        settingsStore.subscribe((state) => syncSettingsState(state));
        attachThemeWatcher();
    }

    async function loadGitHubProfile() {
        const endpoint = `https://api.github.com/users/${githubUsername}`;
        try {
            const response = await fetch(endpoint, {
                headers: { Accept: 'application/vnd.github+json' }
            });
            if (!response.ok) return;
            const data = await response.json();
            const profile = {
                name: data.name?.trim() || data.login || githubUsername,
                avatarUrl: data.avatar_url || githubAvatarUrl
            };
            localStorage.setItem(storageKeys.githubProfile, JSON.stringify(profile));
            applyGitHubProfile(profile);
        } catch {
            applyGitHubProfile({ name: githubUsername, avatarUrl: githubAvatarUrl });
        }
    }

    function bindScrollState() {
        const update = () => {
            document.body.classList.toggle('is-scrolled', window.scrollY > 10);
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    async function init() {
        if (yearHost) {
            yearHost.textContent = new Date().getFullYear();
        }

        if (particleTrail && window.ParticleNetworkEffect) {
            particleNetworkEffect = new window.ParticleNetworkEffect(particleTrail);
        }
        if (trailOverlay && window.TrailRippleEffect) {
            trailRippleEffect = new window.TrailRippleEffect(trailOverlay);
        }
        if (magicTrail && window.ClickSigilEffect) {
            clickSigilEffect = new window.ClickSigilEffect(magicTrail);
        }

        // 各内容源互不依赖:并行抓取,首屏等待 ≈ 最慢一个请求,而不是逐个累加。
        // 慢主机(如线上 ~35KB/s)上顺序 await 会放大到十几秒,并行可显著缩短空窗。
        await Promise.all([
            loadProjectCatalog(),
            loadAssetConfig(),
            loadDefaultSettingsConfig(),
            loadCircleGalleryImages(),
            loadSiteCopy()
        ]);

        // 纯文案区先渲染并立即揭幕——不等封面图探针,保证首屏"秒出内容"。
        renderMetrics();
        renderStats();
        renderSkills();
        renderTimeline();
        renderContacts();

        bindScrollState();
        setActiveNav();
        observeReveals();

        // 需要真实封面路径的 home 封面 + 作品环:封面图探针已限时(见 probeImage),
        // 服务器再慢也只会让这一层稍后出现,绝不会再阻塞整站渲染。
        await resolveAssetPaths();
        renderHomeCover();
        initPortfolioLayout();

        bindPointerParallax();
        bindTiltInteractions();
        bindRippleInteractions();
        observeReveals();
        if (window.BackgroundEffectsController) {
            backgroundEffectsController = new window.BackgroundEffectsController({
                backdrop: homeBackdrop,
                overlay: backgroundOverlay,
                mediaLayer: homeCoverHost,
                effectHost: backgroundEffectsLayer,
                sourceResolver: () => (assetPathConfig.homeCover || '').trim()
            });
            backgroundEffectsController.init();
        }
        initSettings();
        if (window.TarotFeature) {
            tarotFeature = new window.TarotFeature({
                title: '算一算今日运势',
                storageKey: 'akiyama-tarot-reading'
            });
            tarotFeature.init();
        }
        if (window.Live2DDockController) {
            live2dDockController = new window.Live2DDockController({
                storageKey: 'akiyama-live2d-dock',
                dockSelector: '#live2dDock',
                handleSelector: '#dockHandle',
                scaleSelector: '#dockScale',
                frameSelector: '#live2dFrame',
                fallbackSelector: '#live2dFallback',
                sdkUrl: './live2d-demo/index.html',
                widgetUrl: './live2d-widget/index.html',
                defaultModelPath: 'Haru/Haru.model3.json',
                baseWidth: 280,
                baseHeight: 380
            });
            live2dDockController.init();
            live2dDockController.applySettings(settingsStore?.getState().live2d || getDefaultSettings().live2d);
        }
        loadCachedGitHubProfile();
        loadGitHubProfile();
    }

    document.addEventListener('DOMContentLoaded', init);
})();

