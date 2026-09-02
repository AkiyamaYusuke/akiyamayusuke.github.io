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
            // 轻量雨幕回退（不读像素，供 file:// 离线等无法取图场景）
            this.fallbackCanvas = null;
            this.fallbackRaf = null;
            this.handleResize = () => {
                if (!this.enabled) return;
                if (this.fallbackCanvas) {
                    this.startFallback();
                    return;
                }
                this.rebuild();
            };
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
                // 引擎缺失也直接退化为轻量雨幕
                if (this.enabled && this.host) {
                    this.startFallback();
                }
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
                this.startFallback();
                return;
            }
            this.sourceCandidates = fallbackCandidates;
            this.sourceIndex = 0;
            this.stopFallback();

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
                    // 候选源全部失败（file:// 下跨域取图会失败）→ 退化为轻量雨幕
                    this.removeCanvas();
                    if (this.image?.parentNode) {
                        this.image.parentNode.removeChild(this.image);
                    }
                    this.image = null;
                    this.startFallback();
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
            this.stopFallback();
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

        // —— 轻量雨幕回退：不读取图像像素，直接以 rAF 绘制雨丝 ——
        // 适用于 file:// 双击打开、或任何拿不到可读图像（CORS/画布污染）的场景
        startFallback() {
            this.stopFallback();
            if (!this.host) return;

            const rect = this.host.getBoundingClientRect();
            const width = Math.max(1, Math.round(rect.width));
            const height = Math.max(1, Math.round(rect.height));
            if (!width || !height) return;

            const canvas = document.createElement('canvas');
            canvas.className = 'background-rain-canvas is-active is-fallback';
            canvas.width = width;
            canvas.height = height;
            this.host.appendChild(canvas);
            this.fallbackCanvas = canvas;
            this.resizeFallback();

            const ctx = canvas.getContext('2d');
            const area = width * height;
            const density = Math.max(28, Math.min(140, Math.round(area / 16000)));
            const drops = [];
            for (let i = 0; i < density; i += 1) {
                drops.push(this.spawnDrop(width, height, true));
            }

            const FALLBACK_TINT = this.fallbackTint || '232,242,255';
            let last = performance.now();
            const draw = (now) => {
                if (!this.fallbackCanvas || !this.enabled) {
                    this.stopFallback();
                    return;
                }
                const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
                last = now;

                ctx.clearRect(0, 0, width, height);
                ctx.lineCap = 'round';
                for (let i = 0; i < drops.length; i += 1) {
                    const d = drops[i];
                    d.y += d.vy * dt;
                    d.x += d.vx * dt;
                    if (d.y - d.len > height) {
                        drops[i] = this.spawnDrop(width, height, false);
                        continue;
                    }
                    const alpha = d.a * Math.min(1, (d.y - d.len) / Math.max(1, d.taper) + 0.25);
                    ctx.strokeStyle = `rgba(${FALLBACK_TINT},${alpha.toFixed(3)})`;
                    ctx.lineWidth = d.w;
                    ctx.beginPath();
                    ctx.moveTo(d.x - d.vx * (d.len / d.vy), d.y - d.len);
                    ctx.lineTo(d.x, d.y);
                    ctx.stroke();
                }
                this.fallbackRaf = requestAnimationFrame(draw);
            };
            this.fallbackRaf = requestAnimationFrame(draw);
        }

        spawnDrop(width, height, seededAnywhere) {
            const len = 14 + Math.random() * 30;
            const vy = 220 + Math.random() * 300;
            const vx = (Math.random() - 0.5) * 60;
            return {
                x: Math.random() * width,
                y: seededAnywhere ? -Math.random() * height - len : -len - Math.random() * 80,
                len,
                vy,
                vx,
                w: 0.6 + Math.random() * 1.1,
                a: 0.14 + Math.random() * 0.3,
                taper: Math.max(30, len * 4)
            };
        }

        resizeFallback() {
            if (!this.fallbackCanvas || !this.host) return;
            const rect = this.host.getBoundingClientRect();
            this.fallbackCanvas.width = Math.max(1, Math.round(rect.width));
            this.fallbackCanvas.height = Math.max(1, Math.round(rect.height));
        }

        stopFallback() {
            if (this.fallbackRaf) {
                cancelAnimationFrame(this.fallbackRaf);
                this.fallbackRaf = null;
            }
            if (this.fallbackCanvas?.parentNode) {
                this.fallbackCanvas.parentNode.removeChild(this.fallbackCanvas);
            }
            this.fallbackCanvas = null;
        }
    }

    window.RainGlassBackgroundEffect = RainGlassBackgroundEffect;
})();
