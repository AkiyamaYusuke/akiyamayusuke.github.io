(function () {
    const jellyfishSvg = `
        <svg class="background-jellyfish__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 278.8 291.7" aria-hidden="true">
            <defs>
                <style>
                    .cls-1{fill:#b2d1dc;}
                    .cls-2{fill:rgba(165,191,193,0.5);}
                    .cls-3{fill:#d5a2a2;}
                    .cls-4{fill:rgba(148,199,204,0.8);}
                    .cls-5{fill:rgba(147,203,223,0.5);}
                    .cls-6{fill:#93b8c4;}
                    .cls-7{fill:#c9ecf8;}
                    .cls-8{fill:#dbf2f9;}
                    .cls-9{fill:#eea4a4;}
                </style>
            </defs>
            <g class="background-jellyfish__body">
                <path class="cls-1" d="M177.4,279.8h-.1a1.1,1.1,0,0,1-1-1.2h0c0-.3.6-8.1,4.1-30.7s.1-45,0-45.3a1,1,0,0,1,.8-1.2h.1a1.1,1.1,0,0,1,1.3.9h0c0,.2,3.6,23.2,0,46s-4.1,30.3-4.1,30.4a1.1,1.1,0,0,1-1.1,1.1Z"/>
                <path class="cls-4" d="M232.4,157.2h0a78.1,78.1,0,0,1-11.5,11.5c-4.1,3.2-6,22.3-6,22.3s-4.5.1-12.7-4.9a20.3,20.3,0,0,1-9.7-13s-6,5.4-20,5.8a25.4,25.4,0,0,1-20.9-9.8s-3.6,4.5-15.3,6.3a47.8,47.8,0,0,1-22.2-2.3s-.5,6.6-16.6,10-17-.2-17-.2l-2,6.7c-2.1,6.6-10.1,10.5-13,9.9s-2.9-11.1-20.8-21.2L39.6,175h0c-25.1-18.2-40-60-19-107.7C69.7-44.3,217.1-.4,241.2,78.2,252.9,116.1,245.1,141.1,232.4,157.2Z"/>
                <path class="cls-8" d="M28,273.3a1,1,0,0,1-1-.7,1.2,1.2,0,0,1,.6-1.5c.3,0,23.3-8.3,34.8-40.5,6.1-17.1,7.9-25.8,8.4-30.1a14.1,14.1,0,0,0,0-4.1.6.6,0,0,1-.1-.4,1.1,1.1,0,0,1-.2-1.4,1.2,1.2,0,0,1,1.6-.3c1.4.9,3.4,6.4-7.6,37-11.9,33.3-35.2,41.6-36.1,41.9Z"/>
                <path class="cls-9" d="M62.1,194.8s-2.5,6.4,1.4,6.6,5.1-1.5,8.3-2,5.1-1.6,6.5-5.1,3.9-1.8,4.8-4.9-.2-4-.2-4,2.6,3.4,6.2,2,5.6-2.8,7.8-2.4,4.7.9,7.9-1.4,6.8-1.7,8.7-3.7a6.9,6.9,0,0,0,1.8-4.7s4.3,3.5,7.2,3.5,3.7,2.7,8.2,2.4,5.8-3.1,9-3.2,5.7.9,8.1-1.4a24.2,24.2,0,0,0,3.1-3.3s1.6,4.9,4.6,5,4.4,1.8,8.1,2,3.8,2.4,7.2,2.3,5.8-1.9,8.1-1.5,6.4.3,9-1.5l2.7-1.7s-.6,6.4,2.6,7.2,4.3,3.6,7.3,3.8,3.5,2.6,6.9,2.7a31.7,31.7,0,0,0,7.5-.6s-9.1-4.4-10.4-6.3-1.6-3.6-4.4-5.4-5.9-4.5-4.8-7.2,3.3-6.3.3-6.4-6.9,6.8-9.3,7.4-14.7,4.1-18.7,1.9-9.1-.6-10.4-4.6.7-10.8-3.2-10.9-6.2,9.2-9.1,10.5-8.8.3-11.5,1.1-7.3,1.1-13.8-.9-6.9-9.4-10.5-8.3,1.2,9.8,0,11.1-6.6.4-8.5,2.2-6.5,4.1-11.7,4.7-8.1-8.1-12.2-6.5.8,10-.4,12.8-5,4.5-7.2,6.1S62.1,194.8,62.1,194.8Z"/>
            </g>
        </svg>
    `;

    class JellyfishBackgroundEffect {
        constructor(host) {
            this.host = host;
            this.canvas = null;
            this.ctx = null;
            this.svg = null;
            this.enabled = false;
            this.frame = 0;
            this.rafId = 0;
            this.bubbles = [];
            this.handleResize = this.resize.bind(this);
        }

        init() {
            if (!this.host || this.canvas) return;
            this.host.innerHTML = `
                <canvas class="background-jellyfish__bubbles"></canvas>
                <div class="background-jellyfish__float">${jellyfishSvg}</div>
            `;
            this.canvas = this.host.querySelector('canvas');
            this.ctx = this.canvas.getContext('2d');
            this.float = this.host.querySelector('.background-jellyfish__float');
            this.svg = this.host.querySelector('.background-jellyfish__svg');
            this.resetBubbles();
            this.resize();
            window.addEventListener('resize', this.handleResize);
        }

        destroy() {
            cancelAnimationFrame(this.rafId);
            window.removeEventListener('resize', this.handleResize);
        }

        setEnabled(enabled) {
            this.init();
            this.enabled = enabled;
            this.host.classList.toggle('is-active', enabled);
            if (!enabled) {
                cancelAnimationFrame(this.rafId);
                this.clear();
                return;
            }
            this.loop();
        }

        resize() {
            if (!this.canvas || !this.host) return;
            const rect = this.host.getBoundingClientRect();
            this.canvas.width = Math.max(1, Math.round(rect.width * devicePixelRatio));
            this.canvas.height = Math.max(1, Math.round(rect.height * devicePixelRatio));
            this.canvas.style.width = `${rect.width}px`;
            this.canvas.style.height = `${rect.height}px`;
            this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
            this.resetBubbles(rect.width, rect.height);
        }

        resetBubbles(width = this.host.clientWidth, height = this.host.clientHeight) {
            const count = Math.max(24, Math.round(width / 26));
            this.bubbles = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: 1 + Math.random() * 8,
                drift: (Math.random() - 0.5) * 0.4,
                speed: 0.25 + Math.random() * 0.9,
                alpha: 0.12 + Math.random() * 0.28,
                hue: 182 + Math.random() * 22
            }));
        }

        loop() {
            if (!this.enabled) return;
            this.rafId = requestAnimationFrame(() => this.loop());
            this.frame += 1;
            this.draw();
            this.animateJellyfish();
        }

        clear() {
            if (!this.ctx || !this.canvas) return;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        draw() {
            if (!this.ctx || !this.host) return;
            const width = this.host.clientWidth;
            const height = this.host.clientHeight;
            this.ctx.clearRect(0, 0, width, height);

            this.bubbles.forEach((bubble) => {
                bubble.y -= bubble.speed;
                bubble.x += Math.sin((this.frame + bubble.y) * 0.01) * 0.12 + bubble.drift;
                if (bubble.y < -bubble.radius * 3) {
                    bubble.y = height + bubble.radius * 3;
                    bubble.x = Math.random() * width;
                }
                if (bubble.x > width + bubble.radius * 2) bubble.x = -bubble.radius * 2;
                if (bubble.x < -bubble.radius * 2) bubble.x = width + bubble.radius * 2;

                this.ctx.beginPath();
                this.ctx.strokeStyle = `hsla(${bubble.hue}, 70%, 78%, 0.55)`;
                this.ctx.fillStyle = `hsla(${bubble.hue}, 78%, 74%, ${bubble.alpha})`;
                this.ctx.lineWidth = 1;
                this.ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            });
        }

        animateJellyfish() {
            if (!this.float || !this.svg) return;
            const swim = Math.sin(this.frame * 0.016);
            const sway = Math.cos(this.frame * 0.013);
            this.float.style.transform = `translate3d(${swim * 10}px, ${sway * 10}px, 0) rotate(${swim * -2.2}deg)`;
            this.svg.style.transform = `scale(${1 + Math.sin(this.frame * 0.032) * 0.018}, ${1 + Math.cos(this.frame * 0.032) * 0.038})`;
        }
    }

    window.JellyfishBackgroundEffect = JellyfishBackgroundEffect;
})();
