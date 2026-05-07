(function () {
    class TrailRipple {
        constructor(x, y, hue = 0, maxRadius = 30, scale = 0.5) {
            this.x = x;
            this.y = y;
            this.radius = 0;
            this.maxRadius = maxRadius;
            this.scale = scale;
            this.lineWidth = 2;
            this.hue = hue;
            this.alpha = 0.5;
        }

        update() {
            this.radius += 1.5;
            this.alpha -= 0.01;
            this.hue = (this.hue + 5) % 360;
        }

        draw(ctx) {
            ctx.save();
            ctx.strokeStyle = `hsla(${this.hue}, 82%, 62%, ${this.alpha})`;
            ctx.lineWidth = this.lineWidth;
            ctx.shadowBlur = 8;
            ctx.shadowColor = `hsla(${this.hue}, 82%, 62%, ${this.alpha * 0.7})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * this.scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        isDone() {
            return this.alpha <= 0 || this.radius >= this.maxRadius;
        }
    }

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 0.9;
            this.vy = (Math.random() - 0.5) * 0.9;
            this.size = Math.random() * 2.4 + 1;
            this.hue = Math.random() * 360;
            this.alpha = 1;
            this.sizeDirection = Math.random() < 0.5 ? -1 : 1;
            this.trail = [];
        }

        update(mouse, width, height, frameCount, autoDrift = true) {
            const hasMouse = mouse.x !== null && mouse.y !== null;
            const distSq = hasMouse ? (mouse.x - this.x) ** 2 + (mouse.y - this.y) ** 2 : 0;

            if (hasMouse && distSq > 0.001 && distSq < 22500) {
                const dist = Math.sqrt(distSq);
                const force = (22500 - distSq) / 22500;
                this.vx += ((mouse.x - this.x) / dist) * force * 0.1;
                this.vy += ((mouse.y - this.y) / dist) * force * 0.1;
                this.vx *= 0.99;
                this.vy *= 0.99;
            } else {
                if (autoDrift) {
                    this.vx += (Math.random() - 0.5) * 0.03;
                    this.vy += (Math.random() - 0.5) * 0.03;
                }
                this.vx *= 0.998;
                this.vy *= 0.998;
            }

            this.x += this.vx;
            this.y += this.vy;

            if (this.x <= 0 || this.x >= width - 1) this.vx *= -0.9;
            if (this.y <= 0 || this.y >= height - 1) this.vy *= -0.9;

            this.x = Math.max(0, Math.min(width, this.x));
            this.y = Math.max(0, Math.min(height, this.y));

            this.size += this.sizeDirection * 0.1;
            if (this.size > 4 || this.size < 1) this.sizeDirection *= -1;

            this.hue = (this.hue + 0.3) % 360;

            if (frameCount % 2 === 0 && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
                this.trail.push({
                    x: this.x,
                    y: this.y,
                    hue: this.hue,
                    alpha: this.alpha
                });
                if (this.trail.length > 15) this.trail.shift();
            }
        }

        draw(ctx) {
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            gradient.addColorStop(0, `hsla(${this.hue}, 80%, 62%, ${this.alpha})`);
            gradient.addColorStop(1, `hsla(${(this.hue + 30) % 360}, 80%, 32%, ${this.alpha})`);

            ctx.save();
            ctx.fillStyle = gradient;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `hsla(${this.hue}, 80%, 62%, 0.55)`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (this.trail.length > 1) {
                ctx.save();
                ctx.lineWidth = 1.5;
                for (let index = 0; index < this.trail.length - 1; index += 1) {
                    const p1 = this.trail[index];
                    const p2 = this.trail[index + 1];
                    ctx.strokeStyle = `hsla(${p1.hue}, 80%, 62%, ${Math.max(p1.alpha, 0) * 0.45})`;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
    }

    class DustParticle {
        constructor(width, height) {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 1.5 + 0.5;
            this.hue = Math.random() * 360;
            this.vx = (Math.random() - 0.5) * 0.05;
            this.vy = (Math.random() - 0.5) * 0.05;
        }

        update(width, height) {
            this.x = (this.x + this.vx + width) % width;
            this.y = (this.y + this.vy + height) % height;
            this.hue = (this.hue + 0.1) % 360;
        }

        draw(ctx) {
            ctx.fillStyle = `hsla(${this.hue}, 30%, 74%, 0.22)`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    window.MagicTrailPrimitives = {
        TrailRipple,
        Particle,
        DustParticle
    };
})();
