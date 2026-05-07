(function () {
    class PortfolioLayoutController {
        constructor({
            filtersHost,
            gridHost,
            categoryLabels,
            getProjects,
            getHref,
            resolveCoverData,
            getCenterProfile,
            onAfterRender
        }) {
            this.filtersHost = filtersHost;
            this.gridHost = gridHost;
            this.categoryLabels = categoryLabels || {};
            this.getProjects = getProjects || (() => []);
            this.getHref = getHref || ((item) => item.detailPath || '#');
            this.resolveCoverData = resolveCoverData || (() => ({}));
            this.getCenterProfile = getCenterProfile || (() => ({ name: 'AkiyamaYusuke', avatar: '', subtitle: '精选作品' }));
            this.onAfterRender = onAfterRender || (() => {});
            this.mode = 'grid';
            this.activeFilter = 'all';
        }

        init() {
            if (!this.filtersHost || !this.gridHost) return;
            this.renderFilters();
            this.bindFilters();
            this.render();
        }

        setMode(mode) {
            this.mode = mode === 'circle' ? 'circle' : 'grid';
            this.render();
        }

        renderFilters() {
            const projects = this.getProjects();
            const filters = ['all', ...new Set(projects.map((item) => item.category))];
            this.filtersHost.innerHTML = filters.map((key, index) => `
                <button type="button" class="btn filter-btn${index === 0 ? ' is-active' : ''}" data-filter="${key}">
                    ${this.categoryLabels[key] || key}
                </button>
            `).join('');
        }

        bindFilters() {
            if (this.filtersHost.dataset.portfolioFiltersBound === '1') return;
            this.filtersHost.dataset.portfolioFiltersBound = '1';

            this.filtersHost.addEventListener('click', (event) => {
                const button = event.target.closest('.filter-btn');
                if (!button) return;
                this.activeFilter = button.dataset.filter || 'all';
                this.filtersHost.querySelectorAll('.filter-btn').forEach((item) => {
                    item.classList.toggle('is-active', item === button);
                });
                this.render();
            });
        }

        getFilteredProjects() {
            const projects = this.getProjects();
            if (this.activeFilter === 'all') return projects;
            return projects.filter((item) => item.category === this.activeFilter);
        }

        render() {
            const list = this.getFilteredProjects();
            this.gridHost.classList.toggle('projects-grid--circle', this.mode === 'circle');
            this.gridHost.classList.toggle('projects-grid--grid', this.mode !== 'circle');

            if (!list.length) {
                this.gridHost.innerHTML = '<div class="portfolio-empty">当前筛选下还没有作品。</div>';
                this.onAfterRender();
                return;
            }

            if (this.mode === 'circle') {
                this.renderCircle(list);
            } else {
                this.renderGrid(list);
            }

            this.onAfterRender();
        }

        renderGrid(list) {
            this.gridHost.innerHTML = list.map((item) => {
                const data = this.resolveCoverData(item);
                return `
                    <a class="project-card reveal tilt-card ripple" href="${this.getHref(item)}" data-category="${item.category}">
                        ${this.renderGridCover(item, data)}
                        <div class="project-overlay">
                            <h3 class="project-title">${item.title}</h3>
                        </div>
                    </a>
                `;
            }).join('');
        }

        renderGridCover(item, data) {
            if (data.imagePath) {
                const fallbackAttr = data.fallbackPath ? ` data-fallback-src="${data.fallbackPath}"` : '';
                const onError = data.fallbackPath
                    ? ' onerror="if(this.dataset.fallbackSrc&&this.src!==this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;this.removeAttribute(\'data-fallback-src\');}"'
                    : '';
                return `<img class="project-thumb" src="${data.imagePath}" alt="${item.title}"${fallbackAttr}${onError}>`;
            }

            return `
                <div class="project-thumb project-thumb--icon" aria-hidden="true" style="--cover-accent:${data.accent};--cover-accent-soft:${data.accentSoft};">
                    <div class="project-thumb__mesh"></div>
                    <div class="project-thumb__glow"></div>
                    <div class="project-thumb__badge">${data.label || item.title}</div>
                    <div class="project-thumb__core">
                        <i class="fa ${data.icon || 'fa-file-image-o'}"></i>
                    </div>
                    <span class="project-thumb__mini project-thumb__mini-a"><i class="fa fa-circle-thin"></i></span>
                    <span class="project-thumb__mini project-thumb__mini-b"><i class="fa ${data.icon || 'fa-file-image-o'}"></i></span>
                    <span class="project-thumb__mini project-thumb__mini-c">+</span>
                </div>
            `;
        }

        renderCircle(list) {
            const centerProfile = this.getCenterProfile();
            this.gridHost.innerHTML = `
                <div class="source-gallery-shell reveal">
                    <section class="source-gallery-wrapper" style="--cards:${list.length};">
                        ${list.map((item, index) => {
                            const data = this.resolveCoverData(item);
                            const imagePath = data.circleImagePath || data.imagePath || data.fallbackPath || '';
                            return `
                                <div class="source-gallery-item" style="--i:${index + 1}; --bg-img:url('${imagePath}')">
                                    <a href="${this.getHref(item)}" aria-label="打开 ${item.title}">
                                        <img src="${imagePath}" alt="${item.title}">
                                    </a>
                                </div>
                            `;
                        }).join('')}
                        <div class="source-gallery-center">
                            ${centerProfile.avatar ? `<img class="source-gallery-center__avatar" src="${centerProfile.avatar}" alt="${centerProfile.name}">` : ''}
                            <strong class="source-gallery-center__name">${centerProfile.name || 'AkiyamaYusuke'}</strong>
                            <span class="source-gallery-center__meta">${centerProfile.subtitle || '精选作品'}</span>
                        </div>
                    </section>
                </div>
            `;
        }
    }

    window.PortfolioLayoutController = PortfolioLayoutController;
})();
