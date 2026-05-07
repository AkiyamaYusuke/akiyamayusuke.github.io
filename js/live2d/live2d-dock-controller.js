(function () {
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    class Live2DDockController {
        constructor(options = {}) {
            this.options = {
                storageKey: 'akiyama-live2d-dock',
                dockSelector: '#live2dDock',
                handleSelector: '#dockHandle',
                scaleSelector: '#dockScale',
                frameSelector: '#live2dFrame',
                fallbackSelector: '#live2dFallback',
                sdkUrl: './live2d-demo/index.html',
                widgetUrl: './live2d-widget/index.html',
                defaultModelPath: 'Haru/Haru.model3.json',
                defaultWidgetModel: 'https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json',
                baseWidth: 280,
                baseHeight: 380,
                compactBreakpoint: 980,
                ...options
            };

            this.dragging = false;
            this.dragOffset = { x: 0, y: 0 };
            this.resizeTimer = 0;
            this.currentViewportMode = '';
            this.widgetPointerBound = false;
            this.defaultState = {
                left: null,
                top: null,
                scale: 1,
                modelPath: this.options.defaultModelPath
            };
            this.state = this.loadState();
            this.rendererMode = location.protocol === 'file:' ? 'widget' : 'sdk';
        }

        init() {
            this.dock = document.querySelector(this.options.dockSelector);
            this.handle = document.querySelector(this.options.handleSelector);
            this.scaleInput = document.querySelector(this.options.scaleSelector);
            this.frame = document.querySelector(this.options.frameSelector);
            this.fallback = document.querySelector(this.options.fallbackSelector);

            if (!this.dock || !this.handle || !this.scaleInput || !this.frame || !this.fallback) {
                return;
            }

            this.bindInteractions();
            this.applyState();
            this.ensureInViewport(true);
            this.dock.classList.add('is-ready');
            this.refreshFrame();

            requestAnimationFrame(() => {
                this.ensureInViewport(true);
                this.refreshFrame();
            });

            window.addEventListener('load', () => {
                window.setTimeout(() => {
                    this.ensureInViewport(true);
                    this.refreshFrame();
                }, 120);
            }, { once: true });

            this.currentViewportMode = this.getViewportMode();
            window.addEventListener('resize', () => {
                this.ensureInViewport();
                const nextMode = this.getViewportMode();
                if (nextMode !== this.currentViewportMode) {
                    this.currentViewportMode = nextMode;
                    window.clearTimeout(this.resizeTimer);
                    this.resizeTimer = window.setTimeout(() => {
                        this.refreshFrame();
                    }, 180);
                }
            });
        }

        loadState() {
            try {
                const parsed = JSON.parse(localStorage.getItem(this.options.storageKey));
                return { ...this.defaultState, ...parsed };
            } catch {
                return { ...this.defaultState };
            }
        }

        saveState() {
            localStorage.setItem(this.options.storageKey, JSON.stringify(this.state));
        }

        getViewportMode() {
            return window.innerWidth <= this.options.compactBreakpoint ? 'compact' : 'wide';
        }

        buildSrc() {
            const isWidgetMode = this.rendererMode === 'widget';
            const base = new URL(isWidgetMode ? this.options.widgetUrl : this.options.sdkUrl, document.baseURI);
            if (isWidgetMode) {
                base.searchParams.set('model', this.options.defaultWidgetModel);
                base.searchParams.set('width', String(Math.round(this.options.baseWidth * this.state.scale)));
                base.searchParams.set('height', String(Math.round(this.options.baseHeight * this.state.scale)));
                base.searchParams.set('scale', String(this.state.scale));
            } else {
                base.searchParams.set('modelPath', this.state.modelPath || this.options.defaultModelPath);
            }
            base.searchParams.set('viewportMode', this.getViewportMode());
            return base.toString();
        }

        refreshFrame() {
            const freshUrl = new URL(this.buildSrc());
            freshUrl.searchParams.set('viewportMode', this.getViewportMode());
            freshUrl.searchParams.set('t', String(Date.now()));
            this.fallback.style.display = '';
            this.frame.src = freshUrl.toString();
        }

        setPosition(left, top) {
            this.dock.style.left = `${left}px`;
            this.dock.style.top = `${top}px`;
            this.dock.style.right = 'auto';
            this.dock.style.bottom = 'auto';
        }

        getDefaultPosition() {
            const marginX = this.getViewportMode() === 'compact' ? 10 : 18;
            const marginY = this.getViewportMode() === 'compact' ? 10 : 16;
            const left = Math.max(8, window.innerWidth - this.dock.offsetWidth - marginX);
            const top = Math.max(8, window.innerHeight - this.dock.offsetHeight - marginY);
            return { left, top };
        }

        applyState() {
            const width = Math.round(this.options.baseWidth * this.state.scale);
            const height = Math.round(this.options.baseHeight * this.state.scale);
            this.dock.style.width = `${width}px`;
            this.dock.style.height = `${height}px`;
            this.scaleInput.value = String(this.state.scale);

            const nextSrc = this.buildSrc();
            if (this.frame.src !== nextSrc) {
                this.fallback.style.display = '';
                this.frame.src = nextSrc;
            }
        }

        ensureInViewport(forceDefault = false) {
            const width = this.dock.offsetWidth;
            const height = this.dock.offsetHeight;
            const hasStoredPosition = this.state.left !== null && this.state.top !== null && !forceDefault;
            const basePosition = hasStoredPosition
                ? { left: this.state.left, top: this.state.top }
                : this.getDefaultPosition();

            const left = clamp(basePosition.left, 8, Math.max(8, window.innerWidth - width - 8));
            const top = clamp(basePosition.top, 8, Math.max(8, window.innerHeight - height - 8));
            this.state.left = left;
            this.state.top = top;
            this.setPosition(left, top);
            this.saveState();
        }

        startDrag(event) {
            this.dragging = true;
            document.documentElement.classList.add('is-dragging');
            const rect = this.dock.getBoundingClientRect();
            this.dragOffset = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            event.preventDefault();
        }

        stopDrag() {
            if (!this.dragging) return;
            this.dragging = false;
            document.documentElement.classList.remove('is-dragging');
            this.saveState();
        }

        bindInteractions() {
            this.handle.addEventListener('pointerdown', (event) => this.startDrag(event));

            this.scaleInput.addEventListener('input', () => {
                this.state.scale = Number(this.scaleInput.value);
                const width = Math.round(this.options.baseWidth * this.state.scale);
                const height = Math.round(this.options.baseHeight * this.state.scale);
                this.dock.style.width = `${width}px`;
                this.dock.style.height = `${height}px`;
                this.ensureInViewport();
                this.saveState();
            });

            window.addEventListener('pointermove', (event) => {
                if (!this.dragging) return;
                const left = clamp(event.clientX - this.dragOffset.x, 8, Math.max(8, window.innerWidth - this.dock.offsetWidth - 8));
                const top = clamp(event.clientY - this.dragOffset.y, 8, Math.max(8, window.innerHeight - this.dock.offsetHeight - 8));
                this.state.left = left;
                this.state.top = top;
                this.setPosition(left, top);
            }, { passive: true });

            window.addEventListener('pointerup', () => this.stopDrag());
            window.addEventListener('pointercancel', () => this.stopDrag());

            window.addEventListener('pointermove', (event) => {
                this.forwardWidgetPointer('mousemove', event);
            }, { passive: true });

            window.addEventListener('pointerdown', (event) => {
                this.forwardWidgetPointer('mousedown', event);
            }, { passive: true });

            window.addEventListener('pointerup', (event) => {
                this.forwardWidgetPointer('mouseup', event);
            }, { passive: true });

            window.addEventListener('pointerleave', (event) => {
                this.forwardWidgetPointer('mouseleave', event);
            }, { passive: true });

            this.frame.addEventListener('load', () => {
                this.fallback.style.display = 'none';
            });
        }

        forwardWidgetPointer(eventType, event) {
            if (this.rendererMode !== 'widget' || !this.frame?.contentWindow) {
                return;
            }

            const rect = this.frame.getBoundingClientRect();
            const relativeX = clamp(event.clientX - rect.left, -40, rect.width + 40);
            const relativeY = clamp(event.clientY - rect.top, -40, rect.height + 40);

            this.frame.contentWindow.postMessage({
                type: 'live2d-widget-pointer',
                eventType,
                clientX: relativeX,
                clientY: relativeY,
                screenX: relativeX,
                screenY: relativeY,
                buttons: event.buttons || 0
            }, '*');
        }

        applySettings(settings = {}) {
            const nextRenderer = settings.renderer === 'sdk' ? 'sdk' : 'widget';
            if (this.rendererMode === nextRenderer) return;
            this.rendererMode = nextRenderer;
            this.refreshFrame();
        }
    }

    window.Live2DDockController = Live2DDockController;
})();
