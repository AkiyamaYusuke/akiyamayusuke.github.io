(function () {
    const defaultServiceOrigin = 'http://127.0.0.1:8000';

    function isAbsoluteUrl(path) {
        return /^(?:[a-z]+:)?\/\//i.test(String(path || '')) || /^file:/i.test(String(path || ''));
    }

    function normalizePath(path) {
        const text = String(path || '');
        if (isAbsoluteUrl(text)) {
            return text;
        }
        return text.replace(/^\.?\//, '');
    }

    function buildServiceUrl(path, serviceOrigin = defaultServiceOrigin) {
        const cleanPath = normalizePath(path);
        if (isAbsoluteUrl(cleanPath)) {
            return cleanPath;
        }
        return cleanPath ? `${serviceOrigin.replace(/\/$/, '')}/${cleanPath}` : '';
    }

    function preferServedAsset(path, serviceOrigin = defaultServiceOrigin) {
        if (!path) return '';
        if (location.protocol === 'file:') {
            return buildServiceUrl(path, serviceOrigin);
        }
        return path;
    }

    function buildFallbackCandidates(path, serviceOrigin = defaultServiceOrigin) {
        const cleanPath = normalizePath(path);
        if (!cleanPath) {
            return [];
        }

        const candidates = [];
        if (location.protocol === 'file:' && !isAbsoluteUrl(cleanPath)) {
            candidates.push(buildServiceUrl(cleanPath, serviceOrigin));
        }
        candidates.push(cleanPath);
        return candidates.filter(Boolean);
    }

    window.RuntimePathResolver = {
        serviceOrigin: defaultServiceOrigin,
        isAbsoluteUrl,
        normalizePath,
        buildServiceUrl,
        preferServedAsset,
        buildFallbackCandidates
    };
})();
