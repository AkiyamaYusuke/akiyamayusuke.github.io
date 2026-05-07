(function () {
    class SiteSettingsStore {
        constructor({ storageKey, defaults }) {
            this.storageKey = storageKey;
            this.defaults = defaults;
            this.state = this.load();
            this.listeners = new Set();
        }

        load() {
            try {
                const parsed = JSON.parse(localStorage.getItem(this.storageKey));
                return this.merge(this.defaults, parsed || {});
            } catch {
                return structuredClone(this.defaults);
            }
        }

        merge(base, patch) {
            if (Array.isArray(base)) return Array.isArray(patch) ? patch.slice() : base.slice();
            if (!base || typeof base !== 'object') return patch ?? base;

            const next = { ...base };
            Object.keys(next).forEach((key) => {
                next[key] = this.merge(next[key], patch?.[key]);
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

        getState() {
            return structuredClone(this.state);
        }

        get(path) {
            return path.split('.').reduce((value, key) => value?.[key], this.state);
        }

        set(path, value) {
            const keys = path.split('.');
            const next = structuredClone(this.state);
            let cursor = next;
            for (let index = 0; index < keys.length - 1; index += 1) {
                const key = keys[index];
                cursor[key] = cursor[key] && typeof cursor[key] === 'object' ? cursor[key] : {};
                cursor = cursor[key];
            }
            cursor[keys[keys.length - 1]] = value;
            this.state = next;
            this.persist();
            this.emit();
        }

        persist() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        }

        subscribe(listener) {
            this.listeners.add(listener);
            return () => this.listeners.delete(listener);
        }

        emit() {
            const snapshot = this.getState();
            this.listeners.forEach((listener) => listener(snapshot));
        }
    }

    window.SiteSettingsStore = SiteSettingsStore;
})();
