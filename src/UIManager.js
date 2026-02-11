export class UIManager {
    constructor() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingProgress = document.getElementById('loading-progress');
        this.scoreElement = document.getElementById('score');
        this.gameOverElement = document.getElementById('game-over');
        this.restartButton = document.getElementById('restart-button');

        // Settings UI
        this.settingsButton = document.getElementById('settings-button');
        this.settingsModal = document.getElementById('settings-modal');
        this.mapSelectorOverlay = document.getElementById('map-selector-overlay'); // New Overlay
        this.closeSettings = document.getElementById('close-settings');
        this.closeMapSelector = document.getElementById('close-map-selector'); // New Close Button
        this.volumeSlider = document.getElementById('volume-slider');
        this.cameraTiles = document.querySelectorAll('.camera-tile');
        this.controlTiles = document.querySelectorAll('.control-tile');
        this.mapCards = document.querySelectorAll('.map-card'); // New Cards
        this.countdownElement = document.getElementById('countdown');
        this.leftButton = document.getElementById('left-button');
        this.rightButton = document.getElementById('right-button');
        this.finalScoreElement = document.getElementById('final-score-container');
        this.startScreen = document.getElementById('start-screen');
        this.startGameButton = document.getElementById('start-game-button');
        this.mapsButton = document.getElementById('maps-button');
        this.homeButton = document.getElementById('home-button');
        this.homeButtonSettings = document.getElementById('home-button-settings');
        this.selectedMapDisplay = document.getElementById('selected-map-display');
        this.modalBackdrop = document.getElementById('modal-backdrop');
        this.mapCarousel = document.querySelector('.map-carousel');

        this.controlMode = 'buttons'; // Track steering mode to hide/show buttons
        this.score = 0;
        this.speedCanvas = document.getElementById('speed-lines-canvas');
        if (this.speedCanvas) {
            this.speedCtx = this.speedCanvas.getContext('2d');
            this.speedLines = [];
            this.initSpeedLines();
        }

        this.score = 0;
    }

    updateScore(newScore) {
        this.score = newScore;
        if (this.scoreElement) {
            this.scoreElement.textContent = `Score: ${this.score}`;
        }
    }

    updateSelectedMapText(mapName) {
        if (this.selectedMapDisplay) {
            this.selectedMapDisplay.textContent = `MAP: ${mapName.toUpperCase()}`;
        }
    }

    showGameOver() {
        if (this.finalScoreElement) {
            this.finalScoreElement.innerHTML = `Final Score: <span id="final-score-value">${this.score}</span>`;
        }
        if (this.gameOverElement) {
            this.gameOverElement.style.display = 'flex';
        }
        // Hide controls but KEEP settings button visible
        if (this.settingsModal) this.settingsModal.style.display = 'none';
        if (this.leftButton) this.leftButton.style.display = 'none';
        if (this.rightButton) this.rightButton.style.display = 'none';
    }

    hideGameOver() {
        if (this.gameOverElement) {
            this.gameOverElement.style.display = 'none';
        }
        // Restore controls
        if (this.settingsButton) this.settingsButton.style.display = 'flex';

        // Only show steer buttons if in button mode
        const steerDisplay = this.controlMode === 'buttons' ? 'flex' : 'none';
        if (this.leftButton) this.leftButton.style.display = steerDisplay;
        if (this.rightButton) this.rightButton.style.display = steerDisplay;
    }

    updateLoading(progress) {
        if (this.loadingProgress) {
            const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
            this.loadingProgress.textContent = `${percent}%`;
            // Add a small bounce effect to the text to show it is active
            this.loadingProgress.style.transform = 'scale(1.1)';
            setTimeout(() => {
                this.loadingProgress.style.transform = 'scale(1)';
            }, 50);
        }
    }

    hideLoading() {
        if (this.loadingScreen) {
            this.loadingScreen.classList.add('hidden');
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    showLoadingError(url) {
        if (this.loadingScreen) {
            this.loadingScreen.textContent = `Error loading: ${url}`;
            this.loadingScreen.classList.remove('hidden');
            this.loadingScreen.style.opacity = 1;
        }
    }

    /* updatePauseButton removed */

    setCountdown(number) {
        if (this.countdownElement) {
            if (number === null) {
                this.countdownElement.style.display = 'none';
            } else {
                this.countdownElement.style.display = 'block';
                this.countdownElement.textContent = number;
            }
        }
    }

    toggleSettingsModal(show) {
        if (this.settingsModal) {
            this.settingsModal.style.display = show ? 'flex' : 'none';
        }
        if (this.modalBackdrop) {
            this.modalBackdrop.style.display = show ? 'block' : 'none';
        }

        this.updateMobileControlsVisibility(show);

        // Fix overlapping with Game Over UI
        if (show) {
            if (this.gameOverElement && this.gameOverElement.style.display === 'flex') {
                this.gameOverElement.style.display = 'none';
                this.wasGameOverVisible = true;
            }
        } else {
            if (this.wasGameOverVisible && this.gameOverElement) {
                this.gameOverElement.style.display = 'flex';
                this.wasGameOverVisible = false;
            }
        }
    }

    toggleMapsModal(show) {
        if (this.mapSelectorOverlay) {
            if (show) {
                this.mapSelectorOverlay.classList.remove('hidden');
                this.mapSelectorOverlay.style.display = 'flex';
                // Hide Start Screen content if needed, but overlay covers it.
            } else {
                this.mapSelectorOverlay.classList.add('hidden');
                setTimeout(() => {
                    this.mapSelectorOverlay.style.display = 'none';
                }, 500);
            }
        }
        this.updateMobileControlsVisibility(show);
    }

    updateMobileControlsVisibility(isModalOpen) {
        const showSettingsBtn = isModalOpen ? 'none' : 'flex';
        const showSteerBtns = (isModalOpen || this.controlMode !== 'buttons') ? 'none' : 'flex';

        if (this.settingsButton) this.settingsButton.style.display = showSettingsBtn;
        if (this.leftButton) this.leftButton.style.display = showSteerBtns;
        if (this.rightButton) this.rightButton.style.display = showSteerBtns;
    }

    /* onPause removed */

    // Settings Listeners
    onSettingsOpen(callback) {
        if (this.settingsButton) this.settingsButton.addEventListener('click', callback);
    }

    onResume(callback) {
        if (this.closeSettings) this.closeSettings.addEventListener('click', callback);
    }

    setResumeButtonText(text) {
        if (this.closeSettings) {
            this.closeSettings.textContent = text;
        }
    }

    /* onSoundToggle removed - merged with volume */

    onControlModeChange(callback) {
        if (this.controlTiles) {
            this.controlTiles.forEach(tile => {
                tile.addEventListener('click', () => {
                    this.controlTiles.forEach(t => t.classList.remove('active'));
                    tile.classList.add('active');
                    this.controlMode = tile.dataset.mode;

                    // Show/Hide buttons based on mode
                    const steerDisplay = this.controlMode === 'buttons' ? 'flex' : 'none';
                    if (this.leftButton) this.leftButton.style.display = steerDisplay;
                    if (this.rightButton) this.rightButton.style.display = steerDisplay;

                    callback(this.controlMode);
                });
            });
        }
    }

    onMapSelect(callback) {
        if (this.mapCards) {
            this.mapCards.forEach(card => {
                card.addEventListener('click', () => {
                    this.mapCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    callback(card.dataset.map, true); // true = click (close menu)
                });
            });
        }

        // Auto-select center card on scroll
        if (this.mapCarousel) {
            let scrollTimer = null;
            this.mapCarousel.addEventListener('scroll', () => {
                if (scrollTimer) clearTimeout(scrollTimer);

                scrollTimer = setTimeout(() => {
                    const carouselRect = this.mapCarousel.getBoundingClientRect();
                    const carouselCenter = carouselRect.left + carouselRect.width / 2;

                    let minDistance = Infinity;
                    let closestCard = null;

                    this.mapCards.forEach(card => {
                        const cardRect = card.getBoundingClientRect();
                        const cardCenter = cardRect.left + cardRect.width / 2;
                        const dist = Math.abs(carouselCenter - cardCenter);

                        if (dist < minDistance) {
                            minDistance = dist;
                            closestCard = card;
                        }
                    });

                    if (closestCard && !closestCard.classList.contains('active')) {
                        this.mapCards.forEach(c => c.classList.remove('active'));
                        closestCard.classList.add('active');
                        callback(closestCard.dataset.map, false); // false = scroll (keep menu open)
                    }
                }, 10);
            });
        }
    }

    onVolumeChange(callback) {
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', (e) => callback(parseFloat(e.target.value)));
        }
    }

    onCameraChange(callback) {
        if (this.cameraTiles) {
            this.cameraTiles.forEach(tile => {
                tile.addEventListener('click', () => {
                    // Update active state in UI
                    this.cameraTiles.forEach(t => t.classList.remove('active'));
                    tile.classList.add('active');

                    // Trigger callback
                    callback(tile.dataset.mode);
                });
            });
        }
    }

    onRestart(callback) {
        if (this.restartButton) {
            this.restartButton.addEventListener('click', callback);
        }
    }

    onHomeClick(callback) {
        if (this.homeButton) {
            this.homeButton.addEventListener('click', callback);
        }
        if (this.homeButtonSettings) {
            this.homeButtonSettings.addEventListener('click', callback);
        }
    }

    showStartScreen() {
        if (this.startScreen) {
            this.startScreen.classList.remove('hidden');
            this.startScreen.style.display = 'flex';
        }
        // Hide score and settings button on start screen
        if (this.scoreElement && this.scoreElement.parentElement) {
            this.scoreElement.parentElement.style.display = 'none';
        }
        if (this.settingsButton) this.settingsButton.style.display = 'none';
    }

    hideStartScreen() {
        if (this.startScreen) {
            this.startScreen.classList.add('hidden');
            setTimeout(() => {
                this.startScreen.style.display = 'none';
                // Show settings button and score once game starts
                if (this.settingsButton) this.settingsButton.style.display = 'flex';
                if (this.scoreElement && this.scoreElement.parentElement) {
                    this.scoreElement.parentElement.style.display = 'block';
                }

                // Show controls ONLY if in button mode
                const steerDisplay = this.controlMode === 'buttons' ? 'flex' : 'none';
                if (this.leftButton) this.leftButton.style.display = steerDisplay;
                if (this.rightButton) this.rightButton.style.display = steerDisplay;
            }, 500);
        }
    }

    onStartGame(callback) {
        if (this.startGameButton) {
            this.startGameButton.addEventListener('click', callback);
        }
    }

    onMapsClick(callback) {
        if (this.mapsButton) {
            this.mapsButton.addEventListener('click', callback);
        }
    }

    initSpeedLines() {
        this.speedLines = [];
        for (let i = 0; i < 40; i++) {
            this.speedLines.push({
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * 500 + 200,
                length: Math.random() * 100 + 50,
                speed: Math.random() * 15 + 15
            });
        }
        this.resizeSpeedCanvas();
        window.addEventListener('resize', () => this.resizeSpeedCanvas());
    }

    resizeSpeedCanvas() {
        if (!this.speedCanvas) return;
        this.speedCanvas.width = window.innerWidth;
        this.speedCanvas.height = window.innerHeight;
    }

    setNitroEffect(active) {
        if (active) {
            document.body.classList.add('nitro-active');
        } else {
            document.body.classList.remove('nitro-active');
        }
    }

    updateSpeedLines() {
        if (!this.speedCanvas || !document.body.classList.contains('nitro-active')) return;

        const ctx = this.speedCtx;
        const w = this.speedCanvas.width;
        const h = this.speedCanvas.height;
        const centerX = w / 2;
        const centerY = h / 2;

        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;

        this.speedLines.forEach(line => {
            line.radius -= line.speed;
            if (line.radius < 50) {
                line.radius = Math.random() * 400 + 400;
            }

            const x1 = centerX + Math.cos(line.angle) * line.radius;
            const y1 = centerY + Math.sin(line.angle) * line.radius;
            const x2 = centerX + Math.cos(line.angle) * (line.radius + line.length);
            const y2 = centerY + Math.sin(line.angle) * (line.radius + line.length);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        });
    }
}

