(function () {
    class SettingsDrawer {
        constructor({ root, trigger, close, content, sections, store, actions }) {
            this.root = root;
            this.trigger = trigger;
            this.closeButton = close;
            this.content = content;
            this.sections = sections;
            this.store = store;
            this.actions = actions || {};
            this.open = false;
            this.rangeTimers = new Map();
            this.activeRangePath = '';
            this.pendingState = null;
        }

        init() {
            if (!this.root || !this.trigger || !this.content || !this.store) return;
            this.render(this.store.getState());
            this.bind();
            this.store.subscribe((state) => {
                if (this.activeRangePath) {
                    this.pendingState = state;
                    return;
                }
                this.render(state);
            });
        }

        bind() {
            this.trigger.addEventListener('click', () => this.setOpen(!this.open));
            this.closeButton?.addEventListener('click', () => this.setOpen(false));
            this.root.addEventListener('click', (event) => {
                if (event.target === this.root) {
                    this.setOpen(false);
                }
            });

            window.addEventListener('pointerup', () => this.finishRangeInteraction(), { passive: true });
            window.addEventListener('pointercancel', () => this.finishRangeInteraction(), { passive: true });
        }

        setOpen(open) {
            this.open = open;
            this.root.classList.toggle('is-open', open);
            this.trigger.classList.toggle('is-open', open);
            this.trigger.setAttribute('aria-expanded', String(open));
            document.body.classList.toggle('settings-open', open);
        }

        render(state) {
            this.content.innerHTML = this.sections.map((section) => `
                <section class="settings-section" data-section="${section.id}">
                    <div class="settings-section__head">
                        <h3>${section.title}</h3>
                    </div>
                    <div class="settings-section__body">
                        ${section.items.map((item) => this.renderItem(item, state)).join('')}
                    </div>
                </section>
            `).join('');
            this.bindContentControls();
        }

        bindContentControls() {
            this.content.querySelectorAll('[data-setting-choice]').forEach((button) => {
                button.addEventListener('click', () => {
                    this.store.set(button.dataset.settingPath, button.dataset.settingValue);
                });
            });

            this.content.querySelectorAll('[data-setting-toggle]').forEach((button) => {
                button.addEventListener('click', () => {
                    const current = !!this.store.get(button.dataset.settingPath);
                    this.store.set(button.dataset.settingPath, !current);
                });
            });

            this.content.querySelectorAll('[data-setting-action]').forEach((button) => {
                button.addEventListener('click', () => {
                    const actionId = button.dataset.settingAction;
                    this.actions[actionId]?.(button);
                });
            });

            this.content.querySelectorAll('[data-setting-range]').forEach((range) => {
                range.addEventListener('input', () => {
                    this.startRangeInteraction(range);
                    this.updateRangePreview(range, Number(range.value));
                    this.scheduleRangeUpdate(range.dataset.settingPath, Number(range.value));
                });

                range.addEventListener('change', () => {
                    this.commitRangeUpdate(range.dataset.settingPath, Number(range.value));
                    this.finishRangeInteraction();
                });
            });
        }

        renderItem(item, state) {
            if (item.type === 'action') {
                return `
                    <button
                        type="button"
                        class="settings-action"
                        data-setting-action="${item.actionId}"
                    >
                        <span class="settings-action__copy">
                            <span class="settings-action__label">${item.label}</span>
                            ${item.description ? `<span class="settings-action__description">${item.description}</span>` : ''}
                        </span>
                        <span class="settings-action__icon">
                            <i class="fa fa-moon-o" aria-hidden="true"></i>
                        </span>
                    </button>
                `;
            }

            const value = this.storeValue(state, item.path);
            if (item.type === 'choice') {
                return `
                    <div class="settings-item">
                        <div class="settings-item__label">${item.label}</div>
                        <div class="settings-choice">
                            ${item.options.map((option) => `
                                <button
                                    type="button"
                                    class="settings-choice__option${value === option.value ? ' is-active' : ''}"
                                    data-setting-choice
                                    data-setting-path="${item.path}"
                                    data-setting-value="${option.value}"
                                >${option.label}</button>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            if (item.type === 'range') {
                return `
                    <div class="settings-item">
                        <div class="settings-item__row">
                            <div class="settings-item__label">${item.label}</div>
                            <div class="settings-item__value">${value}${item.unit || ''}</div>
                        </div>
                        <input
                            type="range"
                            class="settings-range"
                            min="${item.min}"
                            max="${item.max}"
                            step="${item.step || 1}"
                            value="${value}"
                            data-setting-range
                            data-setting-path="${item.path}"
                        >
                    </div>
                `;
            }

            return `
                <button
                    type="button"
                    class="settings-toggle${value ? ' is-active' : ''}"
                    data-setting-toggle
                    data-setting-path="${item.path}"
                >
                    <span class="settings-toggle__label">${item.label}</span>
                    <span class="settings-toggle__pill"><span class="settings-toggle__dot"></span></span>
                </button>
            `;
        }

        storeValue(state, path) {
            if (!path) return undefined;
            return path.split('.').reduce((value, key) => value?.[key], state);
        }

        updateRangePreview(range, value) {
            const container = range.closest('.settings-item');
            const valueLabel = container?.querySelector('.settings-item__value');
            if (valueLabel) {
                valueLabel.textContent = `${value}%`;
            }
        }

        startRangeInteraction(range) {
            this.activeRangePath = range.dataset.settingPath || '';
            this.root.classList.add('is-scrubbing');
        }

        finishRangeInteraction() {
            if (!this.activeRangePath) return;
            this.activeRangePath = '';
            this.root.classList.remove('is-scrubbing');
            const nextState = this.pendingState || this.store.getState();
            this.pendingState = null;
            this.render(nextState);
        }

        scheduleRangeUpdate(path, value) {
            clearTimeout(this.rangeTimers.get(path));
            const timer = setTimeout(() => {
                this.store.set(path, value);
                this.rangeTimers.delete(path);
            }, 140);
            this.rangeTimers.set(path, timer);
        }

        commitRangeUpdate(path, value) {
            clearTimeout(this.rangeTimers.get(path));
            this.rangeTimers.delete(path);
            this.store.set(path, value);
        }
    }

    window.SettingsDrawer = SettingsDrawer;
})();
