(function () {
    const { Particle, DustParticle } = window.MagicTrailPrimitives || {};

    class ParticleNetworkEffect {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.particles = [];
            this.dustParticles = [];
            this.mouse = { x: null, y: null };
            this.frameCount = 0;
            this.autoDrift = true;
            this.enabled = true;
            this.handlePointerMove = this.handlePointerMove.bind(this);
            this.handlePointerLeave = this.handlePointerLeave.bind(this);
            this.handleResize = this.handleResize.bind(this);
            this.animate = this.animate.bind(this);
            this.resize();
            this.bind();
            this.animate();
        }

        bind() {
            window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
            window.addEventListener('pointerleave', this.handlePointerLeave, { passive: true });
            window.addEventListener('blur', this.handlePointerLeave);
            window.addEventListener('resize', this.handleResize);
        }

        setEnabled(enabled) {
            this.enabled = enabled;
            this.canvas.style.opacity = enabled ? '0.95' : '0';
        }

        handlePointerMove(event) {
            this.mouse.x = event.clientX;
            this.mouse.y = event.clientY;
            this.autoDrift = false;
        }

        handlePointerLeave() {
            this.mouse.x = null;
            this.mouse.y = null;
            this.autoDrift = true;
        }

        handleResize() {
            this.resize();
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.createParticles();
        }

        createParticles() {
            this.particles.length = 0;
            this.dustParticles.length = 0;
            const area = this.canvas.width * this.canvas.height;
            const numParticles = Math.max(40, Math.min(110, Math.round(area / 18000)));
            const numDust = Math.max(70, Math.min(180, Math.round(area / 12000)));

            for (let index = 0; index < numParticles; index += 1) {
                this.particles.push(new Particle(Math.random() * this.canvas.width, Math.random() * this.canvas.height));
            }

            for (let index = 0; index < numDust; index += 1) {
                this.dustParticles.push(new DustParticle(this.canvas.width, this.canvas.height));
            }
        }

        connectParticles() {
            const ctx = this.ctx;
            const gridSize = 120;
            const grid = new Map();

            this.particles.forEach((particle) => {
                const key = `${Math.floor(particle.x / gridSize)},${Math.floor(particle.y / gridSize)}`;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(particle);
            });

            ctx.lineWidth = 1.5;
            this.particles.forEach((particle) => {
                const gridX = Math.floor(particle.x / gridSize);
                const gridY = Math.floor(particle.y / gridSize);
                for (let dx = -1; dx <= 1; dx += 1) {
                    for (let dy = -1; dy <= 1; dy += 1) {
                        const key = `${gridX + dx},${gridY + dy}`;
                        if (!grid.has(key)) continue;
                        grid.get(key).forEach((neighbor) => {
                            if (neighbor === particle) return;
                            const diffX = neighbor.x - particle.x;
                            const diffY = neighbor.y - particle.y;
                            const distSq = diffX * diffX + diffY * diffY;
                            if (distSq >= 10000) return;
                            ctx.strokeStyle = `hsla(${(particle.hue + neighbor.hue) * 0.5}, 80%, 60%, ${1 - Math.sqrt(distSq) / 100})`;
                            ctx.beginPath();
                            ctx.moveTo(particle.x, particle.y);
                            ctx.lineTo(neighbor.x, neighbor.y);
                            ctx.stroke();
                        });
                    }
                }
            });

            if (this.mouse.x !== null) {
                this.particles.forEach((particle) => {
                    const dx = this.mouse.x - particle.x;
                    const dy = this.mouse.y - particle.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq >= 14400) return;
                    ctx.strokeStyle = `hsla(${particle.hue}, 90%, 66%, ${0.45 * (1 - Math.sqrt(distSq) / 120)})`;
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(this.mouse.x, this.mouse.y);
                    ctx.stroke();
                });
            }
        }

        animate() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.enabled) {
                this.dustParticles.forEach((dust) => {
                    dust.update(this.canvas.width, this.canvas.height);
                    dust.draw(ctx);
                });

                this.particles.forEach((particle) => {
                    particle.update(this.mouse, this.canvas.width, this.canvas.height, this.frameCount, this.autoDrift);
                    particle.draw(ctx);
                });

                this.connectParticles();
            }

            this.frameCount += 1;
            requestAnimationFrame(this.animate);
        }
    }

    window.ParticleNetworkEffect = ParticleNetworkEffect;
})();
