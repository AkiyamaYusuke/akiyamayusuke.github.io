(function () {
    class ClickSigilEffect {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.particles = [];
            this.enabled = true;
            this.handlePointerDown = this.handlePointerDown.bind(this);
            this.handleResize = this.handleResize.bind(this);
            this.animate = this.animate.bind(this);
            this.resize();
            this.bind();
            this.animate();
        }

        bind() {
            window.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
            window.addEventListener('resize', this.handleResize);
        }

        setEnabled(enabled) {
            this.enabled = enabled;
            if (!enabled) this.particles.length = 0;
            this.canvas.style.opacity = enabled ? '0.95' : '0';
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }

        handleResize() {
            this.resize();
        }

        handlePointerDown(event) {
            if (!this.enabled) return;

            for (let index = 0; index < 4; index += 1) {
                this.particles.push({
                    x: event.clientX,
                    y: event.clientY,
                    vx: 0,
                    vy: 0,
                    size: 16 + index * 6,
                    life: 0.3 - index * 0.04,
                    kind: 'arc',
                    rotation: (Math.PI * 2 * index) / 4,
                    spin: 0.008 - index * 0.003,
                    growth: 1.002,
                    color: index % 2 === 0 ? 'rgba(196, 238, 255, 0.88)' : 'rgba(112, 208, 255, 0.88)'
                });
            }

            for (let index = 0; index < 2; index += 1) {
                this.particles.push({
                    x: event.clientX,
                    y: event.clientY,
                    vx: 0,
                    vy: 0,
                    size: 14 + index * 8,
                    baseSize: 14 + index * 8,
                    life: 0.9 - index * 0.12,
                    kind: 'sigil',
                    rotation: index * 0.45,
                    spin: index === 0 ? 0.018 : -0.014,
                    reverseSpin: index === 0 ? 0.028 : -0.022,
                    growth: 1,
                    minScale: 0.34 + index * 0.04,
                    maxScale: index === 0 ? 5.6 : 4.8,
                    duration: index === 0 ? 148 : 136,
                    expandThreshold: index === 0 ? 0.22 : 0.24,
                    holdThreshold: index === 0 ? 0.72 : 0.7,
                    age: 0,
                    progress: 0,
                    color: 'rgba(164,223,255,0.82)'
                });
            }
        }

        drawArc(particle) {
            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(particle.rotation);
            this.ctx.globalAlpha = particle.life * 0.86;
            this.ctx.strokeStyle = particle.color;
            this.ctx.lineWidth = Math.max(0.8, particle.size * 0.11);
            this.ctx.shadowBlur = particle.size * 1.6;
            this.ctx.shadowColor = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, particle.size * 1.6, -0.72, 0.72);
            this.ctx.stroke();
            this.ctx.restore();
        }

        drawSigil(particle) {
            const radius = particle.size;
            const ringAlpha = particle.life * 0.78;
            const strokeColor = `rgba(146, 225, 255, ${ringAlpha})`;

            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(particle.rotation);
            this.ctx.globalAlpha = particle.life;
            this.ctx.shadowBlur = radius * 0.42;
            this.ctx.shadowColor = 'rgba(116, 216, 255, 0.92)';
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = Math.max(1, radius * 0.028);

            [1, 0.82, 0.64, 0.18].forEach((ratio, index) => {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, radius * ratio, 0, Math.PI * 2);
                this.ctx.stroke();
                if (index === 2) {
                    this.ctx.save();
                    this.ctx.setLineDash([radius * 0.05, radius * 0.032]);
                    this.ctx.rotate(-particle.rotation * 1.4);
                    this.ctx.strokeStyle = `rgba(210, 244, 255, ${ringAlpha * 0.9})`;
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, radius * 0.73, 0, Math.PI * 2);
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            });

            this.ctx.beginPath();
            for (let point = 0; point < 6; point += 1) {
                const angle = -Math.PI / 2 + (Math.PI * 2 * point) / 6;
                const x = Math.cos(angle) * radius * 0.54;
                const y = Math.sin(angle) * radius * 0.54;
                if (point === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.stroke();

            for (let point = 0; point < 6; point += 1) {
                const angle = -Math.PI / 2 + (Math.PI * 2 * point) / 6;
                const x = Math.cos(angle) * radius * 0.76;
                const y = Math.sin(angle) * radius * 0.76;
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();

                this.ctx.beginPath();
                this.ctx.arc(x, y, radius * 0.12, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            this.ctx.save();
            this.ctx.rotate(-particle.rotation * 1.8);
            for (let point = 0; point < 12; point += 1) {
                const angle = (Math.PI * 2 * point) / 12;
                const x = Math.cos(angle) * radius * 0.92;
                const y = Math.sin(angle) * radius * 0.92;
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius * 0.024, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(225, 250, 255, ${ringAlpha * 0.96})`;
                this.ctx.fill();
            }
            this.ctx.restore();

            this.ctx.restore();
        }

        updateParticle(particle) {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.rotation += particle.spin || 0;
            particle.vx *= particle.drag || 0.996;
            particle.vy *= particle.drag || 0.996;
            particle.life *= 0.987;
            particle.size *= particle.growth || 0.997;
            particle.age = (particle.age || 0) + 1;
            particle.progress = Math.min(1, (particle.age || 0) / (particle.duration || 60));

            if (particle.kind === 'sigil') {
                const expandThreshold = particle.expandThreshold || 0.26;
                const holdThreshold = particle.holdThreshold || 0.6;
                const expandPhase = particle.progress < expandThreshold;
                const holdPhase = particle.progress >= expandThreshold && particle.progress < holdThreshold;
                const shrinkProgress = (particle.progress - holdThreshold) / Math.max(0.001, 1 - holdThreshold);
                const phaseProgress = expandPhase ? particle.progress / expandThreshold : shrinkProgress;
                const ease = Math.max(0, Math.min(1, phaseProgress));
                const smoothEase = ease * ease * (3 - 2 * ease);
                const maxScale = particle.maxScale || 5.2;
                const minScale = particle.minScale || 0.28;
                const baseSize = particle.baseSize || particle.size;
                let scale = maxScale;
                if (expandPhase) {
                    scale = minScale + (maxScale - minScale) * smoothEase;
                } else if (!holdPhase) {
                    scale = maxScale - (maxScale - minScale * 0.6) * smoothEase;
                }
                particle.size = baseSize * scale;
                if (expandPhase) {
                    particle.rotation += particle.spin;
                    particle.life *= 0.997;
                } else if (holdPhase) {
                    particle.rotation += particle.spin * 0.16;
                    particle.life *= 0.999;
                } else {
                    particle.rotation -= particle.reverseSpin || particle.spin * 1.35;
                    particle.life *= 0.988;
                }
            }
        }

        animate() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.enabled) {
                this.particles = this.particles.filter((particle) => particle.life > 0.02);
                this.particles.forEach((particle) => {
                    this.updateParticle(particle);
                    if (particle.kind === 'arc') {
                        this.drawArc(particle);
                    } else if (particle.kind === 'sigil') {
                        this.drawSigil(particle);
                    }
                });
            }
            requestAnimationFrame(this.animate);
        }
    }

    window.ClickSigilEffect = ClickSigilEffect;
})();
