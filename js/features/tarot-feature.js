(function () {
    const tarotDeck = [
        { name: '愚者', symbol: '🃏', upright: '新的旅程、自由、自发性', reversed: '鲁莽、风险、不负责任', description: '愚者代表新的开始、冒险精神，以及无限的可能性。' },
        { name: '魔术师', symbol: '🎩', upright: '能力、资源、专注', reversed: '操纵、狡猾、未使用的才能', description: '魔术师象征创造力、技能和将想法转化为现实的能力。' },
        { name: '女祭司', symbol: '🌙', upright: '直觉、神圣知识、潜意识', reversed: '隐藏的动机、忽视直觉', description: '女祭司代表直觉、内在智慧和神秘知识。' },
        { name: '皇后', symbol: '👑', upright: '母性、富足、感官享受', reversed: '依赖、自私、缺乏成长', description: '皇后象征养育、丰盛和感性。' },
        { name: '皇帝', symbol: '🏛', upright: '稳定、权力、保护', reversed: '专制、僵化、控制', description: '皇帝代表权威、结构和控制。' },
        { name: '恋人', symbol: '💑', upright: '伙伴关系、价值观一致', reversed: '不平衡、沟通不畅', description: '恋人牌代表爱情、和谐与选择。' },
        { name: '战车', symbol: '🏎', upright: '决心、意志力、胜利', reversed: '缺乏方向、侵略', description: '战车象征意志力、胜利和前进的动力。' },
        { name: '力量', symbol: '🦁', upright: '内在力量、影响、耐心', reversed: '自我怀疑、软弱', description: '力量牌代表内在力量、勇气和耐心。' },
        { name: '隐士', symbol: '🧙', upright: '灵魂探索、孤独、内省', reversed: '孤立、退缩', description: '隐士象征内省、孤独和寻求真理。' },
        { name: '命运之轮', symbol: '🎡', upright: '变化、命运、转折点', reversed: '抵抗变化、坏运气', description: '命运之轮代表变化、命运和生命周期。' },
        { name: '太阳', symbol: '☀️', upright: '快乐、成功、活力', reversed: '暂时的挫折', description: '太阳象征快乐、成功和活力。' },
        { name: '世界', symbol: '🌍', upright: '完成、成就、旅行', reversed: '未完成、缺乏结束', description: '世界牌象征完成、成就和旅行。' }
    ];

    const spreadConfigs = {
        single: {
            name: '单张牌占卜',
            cardCount: 1,
            positions: ['今日指引'],
            description: '简单快速的每日指引，为你提供当天的关键信息或建议。'
        },
        three: {
            name: '三张牌占卜',
            cardCount: 3,
            positions: ['过去', '现在', '未来'],
            description: '经典的三牌展开，展示过去的影响、现在的状况和未来的可能发展。'
        },
        celtic: {
            name: '凯尔特十字',
            cardCount: 6,
            positions: ['现状', '挑战', '潜意识', '近期过去', '目标', '近期未来'],
            description: '深入的六牌展开，提供对当前情况的全面分析，揭示隐藏的影响因素。'
        },
        love: {
            name: '爱情占卜',
            cardCount: 5,
            positions: ['你的感受', '对方的感受', '关系现状', '挑战', '潜在发展'],
            description: '专门针对感情关系的五牌展开，帮助你理解情感动态和未来可能性。'
        }
    };

    class TarotFeature {
        constructor(options = {}) {
            this.title = options.title || '算一算今日运势';
            this.storageKey = options.storageKey || 'akiyama-tarot-reading';
            this.root = null;
            this.selectedSpread = null;
            this.currentReading = null;
        }

        init() {
            if (this.root) return;
            this.inject();
            this.bind();
        }

        inject() {
            const wrapper = document.createElement('div');
            wrapper.className = 'tarot-feature';
            wrapper.innerHTML = `
                <div class="tarot-feature__backdrop" data-tarot-close></div>
                <section class="tarot-feature__dialog" aria-hidden="true" aria-label="${this.title}">
                    <div class="tarot-original">
                        <div class="tarot-original__head">
                            <div>
                                <h2>${this.title}</h2>
                                <p class="subtitle">选择占卜类型，让塔罗牌指引你的方向</p>
                            </div>
                            <button type="button" class="tarot-feature__close" data-tarot-close aria-label="关闭今日运势">
                                <i class="fa fa-times" aria-hidden="true"></i>
                            </button>
                        </div>

                        <div class="container">
                            <div class="selection-area" data-spread-selection>
                                <div class="selection-card" data-spread="single">
                                    <i class="fa fa-star"></i>
                                    <h3>单张牌占卜</h3>
                                    <p>简单快速的每日指引</p>
                                </div>
                                <div class="selection-card" data-spread="three">
                                    <i class="fa fa-calendar"></i>
                                    <h3>三张牌占卜</h3>
                                    <p>过去、现在、未来</p>
                                </div>
                                <div class="selection-card" data-spread="celtic">
                                    <i class="fa fa-plus"></i>
                                    <h3>凯尔特十字</h3>
                                    <p>深入全面的分析</p>
                                </div>
                                <div class="selection-card" data-spread="love">
                                    <i class="fa fa-heart"></i>
                                    <h3>爱情占卜</h3>
                                    <p>感情关系分析</p>
                                </div>
                            </div>

                            <button type="button" class="tarot-original__draw-btn" data-draw-btn disabled>
                                <span class="loading"></span>请先选择占卜类型
                            </button>

                            <div class="card-area" data-card-area></div>
                            <div class="interpretation" data-interpretation></div>

                            <div class="action-buttons" data-action-buttons style="display: none;">
                                <button type="button" data-new-reading><i class="fa fa-refresh"></i> 新的占卜</button>
                                <button type="button" data-save-reading><i class="fa fa-bookmark"></i> 保存结果</button>
                            </div>
                        </div>
                    </div>
                </section>
            `;
            document.body.appendChild(wrapper);
            this.root = wrapper;
        }

        bind() {
            this.root.querySelectorAll('[data-tarot-close]').forEach((button) => {
                button.addEventListener('click', () => this.close());
            });

            const spreadCards = this.root.querySelectorAll('.selection-card');
            spreadCards.forEach((card) => {
                card.addEventListener('click', () => {
                    spreadCards.forEach((item) => item.classList.remove('selected'));
                    card.classList.add('selected');
                    this.selectedSpread = card.dataset.spread;
                    this.updateDrawButton();
                });
            });

            this.root.querySelector('[data-draw-btn]')?.addEventListener('click', () => this.startReading());
            this.root.querySelector('[data-new-reading]')?.addEventListener('click', () => this.resetReading());
            this.root.querySelector('[data-save-reading]')?.addEventListener('click', () => this.saveReading());

            window.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.root.classList.contains('is-open')) {
                    this.close();
                }
            });
        }

        open() {
            this.init();
            this.root.classList.add('is-open');
            this.root.querySelector('.tarot-feature__dialog')?.setAttribute('aria-hidden', 'false');
            document.body.classList.add('tarot-open');
        }

        close() {
            if (!this.root) return;
            this.root.classList.remove('is-open');
            this.root.querySelector('.tarot-feature__dialog')?.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('tarot-open');
        }

        updateDrawButton() {
            const drawBtn = this.root.querySelector('[data-draw-btn]');
            if (!drawBtn) return;
            if (this.selectedSpread) {
                drawBtn.innerHTML = `开始${spreadConfigs[this.selectedSpread].name}`;
                drawBtn.disabled = false;
            } else {
                drawBtn.innerHTML = '<span class="loading"></span>请先选择占卜类型';
                drawBtn.disabled = true;
            }
        }

        startReading() {
            const cardArea = this.root.querySelector('[data-card-area]');
            const interpretation = this.root.querySelector('[data-interpretation]');
            const actionButtons = this.root.querySelector('[data-action-buttons]');
            const drawBtn = this.root.querySelector('[data-draw-btn]');
            if (!cardArea || !interpretation || !actionButtons || !drawBtn || !this.selectedSpread) return;

            cardArea.innerHTML = '';
            interpretation.style.display = 'none';
            actionButtons.style.display = 'none';
            drawBtn.innerHTML = '<span class="loading"></span>正在洗牌...';
            drawBtn.disabled = true;

            setTimeout(() => {
                this.drawCards(this.selectedSpread);
                drawBtn.style.display = 'none';
                actionButtons.style.display = 'flex';
            }, 1000);
        }

        drawCards(spreadType) {
            const config = spreadConfigs[spreadType];
            const cardArea = this.root.querySelector('[data-card-area]');
            if (!config || !cardArea) return;

            const shuffledDeck = this.shuffleDeck(tarotDeck.slice());
            const drawnCards = shuffledDeck.slice(0, config.cardCount).map((card, index) => ({
                ...card,
                isReversed: Math.random() > 0.5,
                position: config.positions[index],
                positionIndex: index
            }));

            drawnCards.forEach((card) => {
                const cardElement = this.createCardElement(card);
                cardArea.appendChild(cardElement);
                cardElement.style.animationDelay = `${card.positionIndex * 0.2}s`;
            });

            this.currentReading = {
                spread: spreadType,
                cards: drawnCards,
                date: new Date().toISOString()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentReading));
        }

        createCardElement(card) {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.dataset.positionIndex = String(card.positionIndex);

            const cardBack = document.createElement('div');
            cardBack.className = 'card-back';

            const cardBackPattern = document.createElement('div');
            cardBackPattern.className = 'card-back-pattern';
            cardBackPattern.textContent = '塔罗牌';
            cardBack.appendChild(cardBackPattern);
            cardElement.appendChild(cardBack);

            const cardFront = document.createElement('div');
            cardFront.className = 'card-front';

            const cardImage = document.createElement('div');
            cardImage.className = 'card-image';
            cardImage.textContent = card.symbol;

            const cardName = document.createElement('div');
            cardName.className = 'card-name';
            cardName.textContent = card.name;

            const cardPosition = document.createElement('div');
            cardPosition.className = `card-position ${card.isReversed ? 'reversed' : 'upright'}`;
            cardPosition.textContent = card.isReversed ? '逆位' : '正位';

            const cardMeaning = document.createElement('div');
            cardMeaning.className = 'card-meaning';
            cardMeaning.textContent = card.position;

            cardFront.appendChild(cardImage);
            cardFront.appendChild(cardName);
            cardFront.appendChild(cardPosition);
            cardFront.appendChild(cardMeaning);
            cardElement.appendChild(cardFront);

            cardElement.addEventListener('click', () => {
                cardElement.classList.toggle('selected');
                this.updateInterpretation();
            });

            cardElement.style.opacity = '0';
            cardElement.style.animation = 'tarotCardFadeIn 0.5s forwards';
            return cardElement;
        }

        updateInterpretation() {
            const interpretation = this.root.querySelector('[data-interpretation]');
            if (!interpretation || !this.currentReading) return;

            const selectedCards = Array.from(this.root.querySelectorAll('.card.selected'));
            if (!selectedCards.length) {
                interpretation.style.display = 'none';
                return;
            }

            const config = spreadConfigs[this.currentReading.spread];
            let interpretationText = `
                <h3>${config.name}解读</h3>
                <p class="spread-info">${config.description}</p>
            `;

            selectedCards.forEach((cardElement) => {
                const positionIndex = Number(cardElement.dataset.positionIndex);
                const cardData = this.currentReading.cards[positionIndex];
                interpretationText += `
                    <div class="card-interpretation">
                        <h4>${cardData.position}: ${cardData.name} (${cardData.isReversed ? '逆位' : '正位'})</h4>
                        <p><strong>牌义:</strong> ${cardData.isReversed ? cardData.reversed : cardData.upright}</p>
                        <p><strong>详细解读:</strong> ${cardData.description}</p>
                    </div>
                `;
            });

            interpretation.innerHTML = interpretationText;
            interpretation.style.display = 'block';
        }

        resetReading() {
            this.selectedSpread = null;
            this.currentReading = null;
            localStorage.removeItem(this.storageKey);

            const cardArea = this.root.querySelector('[data-card-area]');
            const interpretation = this.root.querySelector('[data-interpretation]');
            const actionButtons = this.root.querySelector('[data-action-buttons]');
            const drawBtn = this.root.querySelector('[data-draw-btn]');

            if (cardArea) cardArea.innerHTML = '';
            if (interpretation) interpretation.style.display = 'none';
            if (actionButtons) actionButtons.style.display = 'none';
            this.root.querySelectorAll('.selection-card').forEach((card) => card.classList.remove('selected'));
            if (drawBtn) {
                drawBtn.style.display = 'inline-block';
            }
            this.updateDrawButton();
        }

        saveReading() {
            const saveButton = this.root.querySelector('[data-save-reading]');
            if (!this.currentReading || !saveButton) return;
            saveButton.innerHTML = '<i class="fa fa-check"></i> 已保存';
            setTimeout(() => {
                saveButton.innerHTML = '<i class="fa fa-bookmark"></i> 保存结果';
            }, 2000);
        }

        shuffleDeck(deck) {
            for (let index = deck.length - 1; index > 0; index -= 1) {
                const randomIndex = Math.floor(Math.random() * (index + 1));
                [deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
            }
            return deck;
        }
    }

    window.TarotFeature = TarotFeature;
})();
