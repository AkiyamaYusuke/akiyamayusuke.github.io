(function () {
    class RainGlassBackgroundEffect {
        constructor(host, options = {}) {
            this.host = host;
            this.sourceResolver = options.sourceResolver || (() => '');
            this.enabled = false;
            this.engine = null;
            this.canvas = null;
            this.image = null;
            this.lastSource = '';
            this.sourceCandidates = [];
            this.sourceIndex = 0;
            this.handleResize = this.rebuild.bind(this);
        }

        init() {
            if (!this.host) return;
            window.addEventListener('resize', this.handleResize);
        }

        destroy() {
            window.removeEventListener('resize', this.handleResize);
            this.teardown();
        }

        setEnabled(enabled) {
            this.enabled = enabled;
            if (!enabled) {
                this.teardown();
                return;
            }
            this.rebuild();
        }

        rebuild() {
            if (!this.enabled || !this.host || typeof window.RainyDay !== 'function') {
                return;
            }

            const source = this.sourceResolver();
            const cleanSource = String(source || '').trim();
            const fallbackCandidates = [];
            if (cleanSource) {
                fallbackCandidates.push(cleanSource);
            }
            if (location.protocol === 'file:' && cleanSource && window.RuntimePathResolver) {
                const servedSource = window.RuntimePathResolver.buildServiceUrl(cleanSource);
                if (servedSource && servedSource !== cleanSource) {
                    fallbackCandidates.push(servedSource);
                }
            }
            if (!fallbackCandidates.length) {
                this.teardown();
                return;
            }
            this.sourceCandidates = fallbackCandidates;
            this.sourceIndex = 0;

            if (!this.image) {
                this.image = document.createElement('img');
                this.image.className = 'background-rain-source';
                this.image.alt = '';
                this.image.decoding = 'sync';
                this.image.crossOrigin = 'anonymous';
                this.host.appendChild(this.image);
            }

            this.image.onload = () => {
                this.lastSource = this.sourceCandidates[this.sourceIndex] || source;
                this.startRain();
            };

            this.image.onerror = () => {
                this.sourceIndex += 1;
                const nextSource = this.sourceCandidates[this.sourceIndex];
                if (!nextSource) {
                    this.teardown();
                    return;
                }
                this.image.src = '';
                requestAnimationFrame(() => {
                    if (this.image) {
                        this.image.src = nextSource;
                    }
                });
            };

            const preferredSource = this.sourceCandidates[0];
            if (this.lastSource !== preferredSource) {
                this.removeCanvas();
                this.image.src = '';
                requestAnimationFrame(() => {
                    if (this.image) {
                        this.image.src = preferredSource;
                    }
                });
            } else if (this.image.complete && this.image.naturalWidth) {
                this.startRain();
            }
        }

        startRain() {
            if (!this.image || !this.host || !this.image.complete || !this.image.naturalWidth) {
                return;
            }

            this.removeCanvas();

            const rect = this.host.getBoundingClientRect();
            this.engine = new window.RainyDay({
                image: this.image,
                parentElement: this.host,
                width: Math.max(1, Math.round(rect.width)),
                height: Math.max(1, Math.round(rect.height)),
                position: 'absolute',
                top: 0,
                left: 0,
                opacity: 1,
                enableSizeChange: true
            });

            this.canvas = this.engine?.canvas || null;
            if (this.canvas) {
                this.canvas.classList.add('background-rain-canvas', 'is-active');
            }

            this.engine.rain([[1, 2, 8000]]);
            this.engine.rain([[3, 3, 0.88], [5, 5, 0.9], [6, 2, 1]], 100);
        }

        removeCanvas() {
            if (this.canvas?.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
            this.canvas = null;
            this.engine = null;
        }

        teardown() {
            this.removeCanvas();
            if (this.image?.parentNode) {
                this.image.parentNode.removeChild(this.image);
            }
            this.image = null;
            this.lastSource = '';
            this.sourceCandidates = [];
            this.sourceIndex = 0;
        }
    }

    window.RainGlassBackgroundEffect = RainGlassBackgroundEffect;
})();
