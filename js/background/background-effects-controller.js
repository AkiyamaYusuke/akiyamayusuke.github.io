(function () {
    class BackgroundEffectsController {
        constructor({ backdrop, overlay, mediaLayer, effectHost, sourceResolver }) {
            this.backdrop = backdrop;
            this.overlay = overlay;
            this.mediaLayer = mediaLayer;
            this.effectHost = effectHost;
            this.sourceResolver = sourceResolver || (() => '');
            this.jellyfishEffect = null;
            this.rainEffect = null;
        }

        init() {
            if (this.effectHost && window.JellyfishBackgroundEffect) {
                this.jellyfishEffect = new window.JellyfishBackgroundEffect(this.effectHost);
            }
            if (this.effectHost && window.RainGlassBackgroundEffect) {
                this.rainEffect = new window.RainGlassBackgroundEffect(this.effectHost, {
                    sourceResolver: this.sourceResolver
                });
                this.rainEffect.init();
            }
        }

        apply(settings) {
            if (!this.backdrop || !settings) return;

            const effect = settings.effect || 'none';
            const blur = Math.max(0, Math.min(100, Number(settings.blur) || 0));
            const useStaticBlur = effect === 'none';
            const blurRatio = useStaticBlur ? blur / 100 : 0;
            const easedBlur = Math.pow(blurRatio, 1.35);
            const blurPx = easedBlur * 12;
            const overlayOpacity = easedBlur * 0.34;
            const coverScale = 1 + easedBlur * 0.008;

            this.backdrop.style.setProperty('--home-cover-blur', `${blurPx.toFixed(2)}px`);
            this.backdrop.style.setProperty('--background-overlay-opacity', overlayOpacity.toFixed(3));
            this.backdrop.style.setProperty('--home-cover-scale', `${coverScale.toFixed(3)}`);

            if (this.mediaLayer) {
                this.mediaLayer.style.setProperty('--home-cover-blur', `${blurPx.toFixed(2)}px`);
            }
            if (this.overlay) {
                this.overlay.style.opacity = overlayOpacity.toFixed(3);
            }

            if (this.effectHost) {
                this.effectHost.setAttribute('data-background-effect', effect);
            }

            if (this.jellyfishEffect) {
                this.jellyfishEffect.setEnabled(effect === 'jellyfish');
            }
            if (this.rainEffect) {
                this.rainEffect.setEnabled(effect === 'rain');
            }
        }
    }

    window.BackgroundEffectsController = BackgroundEffectsController;
})();
