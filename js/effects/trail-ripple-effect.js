(function () {
    const { TrailRipple } = window.MagicTrailPrimitives || {};

    class TrailRippleEffect {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.ripples = [];
            this.enabled = true;
            this.handlePointerMove = this.handlePointerMove.bind(this);
            this.handleResize = this.handleResize.bind(this);
            this.animate = this.animate.bind(this);
            this.resize();
            this.bind();
            this.animate();
        }

        bind() {
            window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
            window.addEventListener('resize', this.handleResize);
        }

        setEnabled(enabled) {
            this.enabled = enabled;
            if (!enabled) this.ripples.length = 0;
            this.canvas.style.opacity = enabled ? '0.95' : '0';
        }

        handleResize() {
            this.resize();
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }

        handlePointerMove(event) {
            if (!this.enabled) return;
            this.ripples.push(new TrailRipple(event.clientX, event.clientY, 0, 30, 0.5));
        }

        animate() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.enabled) {
                this.ripples = this.ripples.filter((ripple) => !ripple.isDone());
                this.ripples.forEach((ripple) => {
                    ripple.update();
                    ripple.draw(this.ctx);
                });
            }
            requestAnimationFrame(this.animate);
        }
    }

    window.TrailRippleEffect = TrailRippleEffect;
})();
