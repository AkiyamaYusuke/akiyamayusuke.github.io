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

    // 个人本地覆盖 <base>.local.json 的候选路径（config/x.json -> config/x.local.json）。
    function toLocalCandidate(url) {
        return String(url).replace(/\.json$/, '.local.json');
    }

    // 分层加载站点内容：本地个人覆盖 .local.json > 提交的实例配置(url) > 内置默认(fallback)。
    // 任一层 404 / 读空 / 解析失败都静默降级到下一层；无 .local 时行为与 loadJson 完全一致。
    async function loadContentJson(url, fallback) {
        const candidates = [toLocalCandidate(url), url];
        for (const candidate of candidates) {
            try {
                const text = await requestText(candidate);
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            } catch {
                // try next candidate
            }
        }
        return fallback;
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

    function probeImage(path, timeoutMs) {
        return new Promise((resolve) => {
            if (!path || typeof path !== 'string') {
                resolve('');
                return;
            }
            // 探图限时:服务器很慢或图片迟迟不返回时,绝不无限期阻塞渲染链。
            const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3500;
            const img = new Image();
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            };
            img.onload = () => finish(path);
            img.onerror = () => finish(''); // 真实 404/解码失败(通常很快)→ 判定不可用
            // 超时:多半是慢网络上的真图 → 乐观保留路径,让 <img> 自己后台流入,
            // 而不是把本来就存在的封面判定为缺失。
            const timer = setTimeout(() => finish(path), ms);
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
        loadContentJson,
        toLocalCandidate,
        normalizeAssetConfig,
        normalizeProjectCatalog,
        probeImage,
        resolveImageMap,
        resolveGalleryMap
    };
})();
