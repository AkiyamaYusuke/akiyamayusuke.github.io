(function () {
    function withCacheBust(url) {
        try {
            const resolved = new URL(url, location.href);
            resolved.searchParams.set('_ts', String(Date.now()));
            return resolved.href;
        } catch {
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}_ts=${Date.now()}`;
        }
    }

    function requestText(url) {
        if (location.protocol !== 'file:') {
            return fetch(withCacheBust(url), { cache: 'no-store' }).then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load ${url}`);
                }
                return response.text();
            });
        }

        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            iframe.setAttribute('aria-hidden', 'true');

            const cleanup = () => {
                iframe.onload = null;
                iframe.onerror = null;
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            };

            iframe.onload = () => {
                try {
                    const doc = iframe.contentDocument;
                    const bodyText = doc?.body?.textContent?.trim() || '';
                    const preText = doc?.querySelector('pre')?.textContent?.trim() || '';
                    const text = bodyText || preText;
                    cleanup();
                    if (!text) {
                        reject(new Error(`Failed to read ${url}`));
                        return;
                    }
                    resolve(text);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };

            iframe.onerror = () => {
                cleanup();
                reject(new Error(`Failed to load ${url}`));
            };

            iframe.src = withCacheBust(url);
            document.body.appendChild(iframe);
        });
    }

    async function loadJson(url, fallback) {
        try {
            const text = await requestText(url);
            const parsed = JSON.parse(text);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch {
            return fallback;
        }
    }

    function normalizeAssetConfig(raw) {
        const config = raw && typeof raw === 'object' ? raw : {};
        const ensureObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
        const ensureArrayMap = (value) => {
            const entries = Object.entries(ensureObject(value));
            return Object.fromEntries(entries.map(([key, items]) => [key, Array.isArray(items) ? items : []]));
        };

        return {
            homeCover: typeof config.homeCover === 'string' ? config.homeCover : '',
            projectCoverImages: ensureObject(config.projectCoverImages),
            detailImages: ensureObject(config.detailImages),
            detailGalleries: ensureArrayMap(config.detailGalleries),
            detailVideos: ensureObject(config.detailVideos)
        };
    }

    function normalizeProjectCatalog(raw, fallbackItems) {
        if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) {
            return fallbackItems.slice();
        }
        return raw.items;
    }

    function probeImage(path) {
        return new Promise((resolve) => {
            if (!path || typeof path !== 'string') {
                resolve('');
                return;
            }
            const img = new Image();
            img.onload = () => resolve(path);
            img.onerror = () => resolve('');
            img.src = path;
        });
    }

    function resolveImageMap(map) {
        const entries = Object.entries(map || {});
        return Promise.all(entries.map(async ([key, path]) => [key, await probeImage((path || '').trim())]))
            .then((results) => Object.fromEntries(results));
    }

    function resolveGalleryMap(map) {
        const entries = Object.entries(map || {});
        return Promise.all(entries.map(async ([key, items]) => {
            const list = Array.isArray(items) ? items : [];
            const resolved = await Promise.all(list.map((path) => probeImage((path || '').trim())));
            return [key, resolved.filter(Boolean)];
        })).then((results) => Object.fromEntries(results));
    }

    window.SiteDataLoader = {
        requestText,
        loadJson,
        normalizeAssetConfig,
        normalizeProjectCatalog,
        probeImage,
        resolveImageMap,
        resolveGalleryMap
    };
})();
