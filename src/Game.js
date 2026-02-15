import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { EntityManager } from './EntityManager.js';
import { InputManager } from './InputManager.js';
import { UIManager } from './UIManager.js';
import { SoundManager } from './SoundManager.js';

class Game {
    constructor() {
        this.roadLength = 200;
        this.roadWidth = 10;

        this.sceneManager = new SceneManager('container', this.roadLength);
        this.entityManager = new EntityManager(this.sceneManager.scene, this.roadLength, this.roadWidth);
        this.inputManager = new InputManager();
        this.uiManager = new UIManager();
        this.soundManager = new SoundManager();
        this.clock = new THREE.Clock(); // For smooth delta time handling

        this.isGameOver = false;
        this.isGameOver = false;
        this.score = 0;
        this.baseScrollSpeed = 0.8; // Increased speed (was 0.5)
        this.enemyBaseSpeed = 0.9; // Increased enemy speed (was 0.6)
        this.speedMultiplier = 1; // Only for player/scroll
        this.boostTimeout = null;
        this.cameraMode = 'normal'; // 'normal', 'driver', 'top'
        this.isCountdownActive = false;
        this.isPaused = true; // Start paused for countdown
        this.hasStarted = false; // Flag to check if race has actually begun
        this.countdownTimer = null;

        this.init();
    }

    async init() {
        // Load Assets
        try {
            await this.entityManager.loadAssets((progress) => {
                this.uiManager.updateLoading(progress);
            });
            this.uiManager.hideLoading();

            // Force initial map state to ensure colors/lighting are correct from the start
            this.sceneManager.setMapType('city');
            this.entityManager.setMap('city');
            // We don't need to call createLevel here because loadAssets already did, 
            // but calling setMapType on SceneManager triggers the lighting/fog update fix.
        } catch (error) {
            console.error("Game Init Error:", error);
            if (this.uiManager.loadingProgress) {
                this.uiManager.loadingProgress.textContent = "Error: " + error.message;
                this.uiManager.loadingProgress.style.color = '#ff4757';
                this.uiManager.loadingProgress.style.fontSize = '12px';
            }
        }

        // camera Setup (initial)
        this.sceneManager.camera.position.set(0, 3, -7);

        // Listeners
        this.uiManager.onStartGame(() => {
            this.hasStarted = true;
            this.uiManager.hideStartScreen();
            this.startCountdown();
        });

        this.uiManager.onRestart(() => this.restart());

        // Settings Listeners
        this.uiManager.onSettingsOpen(() => this.openSettings());
        this.uiManager.onResume(() => this.closeSettings());
        this.uiManager.onVolumeChange((val) => this.setVolume(val));
        this.uiManager.onCameraChange((mode) => this.setCameraMode(mode));
        this.uiManager.onControlModeChange((mode) => this.inputManager.setControlMode(mode));
        this.uiManager.onHomeClick(() => this.goToMainMenu());

        // Maps Modal Listeners
        this.uiManager.onMapsClick(() => this.openMaps());
        this.uiManager.onCloseMapSelector(() => this.closeMaps());
        this.uiManager.onMapSelect((mapType, isClick) => {
            this.sceneManager.setMapType(mapType);
            this.entityManager.setMap(mapType);
            this.entityManager.createLevel();
            this.uiManager.updateSelectedMapText(mapType);

            // Only close menu on click, not on scroll
            if (isClick) {
                this.closeMaps();
                // If we were in Game Over state, reset to start screen state essentially
                if (this.isGameOver) {
                    this.isGameOver = false;
                    this.uiManager.hideGameOver();
                    this.goToMainMenu(); // Go to main menu to restart properly
                }
            }
        });

        // Spacebar to pause
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.togglePause();
            }
        });

        // Unlock Audio Context on first user interaction (browser policy)
        const unlockAudio = () => {
            this.soundManager.unlock();
            // Remove all once it's unlocked
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);

        // Initial State
        this.uiManager.showStartScreen();

        // Start Loop
        this.animate();
    }

    openSettings() {
        // If countdown is running, stop it first!
        if (this.isCountdownActive) {
            this.stopCountdown();
        }

        // Update Button Text based on state
        if (!this.hasStarted) {
            // Temporarily hide start screen while settings is open
            if (this.uiManager.startScreen) this.uiManager.startScreen.style.display = 'none';
        } else if (this.isGameOver) {
            this.uiManager.setResumeButtonText("BACK TO SCORE");
        } else {
            this.uiManager.setResumeButtonText("RESUME RACE");
        }

        if (this.isGameOver) {
            this.uiManager.toggleSettingsModal(true);
            return;
        }

        // Force Pause when opening settings
        this.isPaused = true;
        this.soundManager.stopEngine();
        this.uiManager.toggleSettingsModal(true);
    }

    closeSettings() {
        this.uiManager.toggleSettingsModal(false);

        if (this.isGameOver) {
            this.uiManager.showGameOver();
            return;
        }

        if (!this.hasStarted) {
            // If we haven't started, go back to start screen
            this.uiManager.showStartScreen();
            return;
        }

        if (this.isPaused) {
            this.startCountdown();
        }
    }

    openMaps() {
        if (this.uiManager.startScreen) this.uiManager.startScreen.style.display = 'none';
        this.uiManager.toggleMapsModal(true);
    }

    closeMaps() {
        this.uiManager.toggleMapsModal(false);
        if (!this.hasStarted) {
            this.uiManager.showStartScreen();
        }
    }

    startCountdown() {
        this.stopCountdown(); // Safety first: clear existing

        // Ensure UI is clean
        this.uiManager.hideGameOver();
        this.uiManager.toggleSettingsModal(false);

        this.isCountdownActive = true;
        this.isPaused = true;
        let count = 3;

        this.uiManager.setCountdown(count);
        this.soundManager.playCountdown(false);

        this.countdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                this.uiManager.setCountdown(count);
                this.soundManager.playCountdown(false);
            } else {
                this.stopCountdown(); // Clears interval and resets flag
                this.uiManager.setCountdown(null);
                this.soundManager.playCountdown(true);
                this.isPaused = false;
                this.soundManager.startEngine();
            }
        }, 1000);
    }

    stopCountdown() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        this.isCountdownActive = false;
        this.uiManager.setCountdown(null);
    }

    toggleSound(isChecked) {
        // Toggle expects !isMuted, so if checked (true) -> mute is false
        // However, standard switch: ON = Sound ON.
        const mute = !isChecked;
        this.soundManager.toggleMute(mute);
    }

    setVolume(val) {
        this.soundManager.setVolume(val);
    }

    updateCamera() {
        if (!this.entityManager.carModel) return;

        const car = this.entityManager.carModel;
        const cam = this.sceneManager.camera;

        if (this.cameraMode === 'driver') {
            // First Person / Driver View - Tilted to see hood and road
            const targetX = car.position.x;
            const targetY = car.position.y + 1.4;
            const targetZ = car.position.z - 0.2;

            // Instant snap to position for consistent view
            cam.position.x = targetX;
            cam.position.y = targetY;
            cam.position.z = targetZ;

            // Look forward but tilted down to catch the bonnet
            cam.lookAt(car.position.x, car.position.y + 0.4, car.position.z + 20);
        } else if (this.cameraMode === 'top') {
            // Top Down View
            cam.position.x += (car.position.x * 0.5 - cam.position.x) * 0.1;
            cam.position.y += (15 - cam.position.y) * 0.1;
            cam.position.z += ((car.position.z - 5) - cam.position.z) * 0.1;
            cam.lookAt(car.position.x, car.position.y, car.position.z + 5);
        } else {
            // Normal / Behind View
            cam.position.x += (car.position.x * 0.5 - cam.position.x) * 0.1;
            cam.position.y += (3 - cam.position.y) * 0.1;
            cam.position.z += (-7 - cam.position.z) * 0.1;

            cam.lookAt(car.position.x, car.position.y + 1, car.position.z + 5);
        }
    }

    setCameraMode(mode) {
        this.cameraMode = mode;
        // Force update immediately, even if paused
        this.updateCamera();
        this.sceneManager.render();
        // Auto close after selection
        this.closeSettings();
    }

    togglePause() {
        if (this.isGameOver) return;

        // If countdown is active, pausing should cancel it
        if (this.isCountdownActive) {
            this.stopCountdown();
            this.isPaused = true;
            this.uiManager.toggleSettingsModal(true);
            return;
        }

        if (this.isPaused) {
            // Unpausing: close settings and start countdown
            this.uiManager.toggleSettingsModal(false);
            if (this.hasStarted) {
                this.startCountdown();
            }
        } else {
            // Pausing: stop engine and show settings
            this.isPaused = true;
            this.soundManager.stopEngine();
            this.uiManager.toggleSettingsModal(true);
        }
    }

    restart() {
        this.isGameOver = false;
        this.isPaused = true; // Wait for countdown
        this.isCountdownActive = false;
        this.score = 0;
        this.uiManager.updateScore(0);
        this.uiManager.hideGameOver();
        this.inputManager.setGameOver(false);
        this.entityManager.reset();

        // Reset speeds (Updated to match higher base speeds)
        this.baseScrollSpeed = 0.8;
        this.enemyBaseSpeed = 0.9;
        this.speedMultiplier = 1;

        if (this.boostTimeout) clearTimeout(this.boostTimeout);
        this.boostTimeout = null;

        this.startCountdown();
    }

    goToMainMenu() {
        this.isGameOver = false;
        this.isPaused = true;
        this.isCountdownActive = false;
        this.hasStarted = false;
        this.score = 0;
        this.uiManager.updateScore(0);
        this.uiManager.hideGameOver();
        this.uiManager.toggleSettingsModal(false);
        this.inputManager.setGameOver(false);
        this.entityManager.reset();

        // Reset speeds (Updated to match higher base speeds)
        this.baseScrollSpeed = 0.8;
        this.enemyBaseSpeed = 0.9;
        this.speedMultiplier = 1;
        if (this.boostTimeout) clearTimeout(this.boostTimeout);
        this.boostTimeout = null;

        this.uiManager.showStartScreen();
        this.soundManager.stopEngine();
    }

    activateBoost() {
        if (this.speedMultiplier > 1) {
            // Extend duration if already active
            if (this.boostTimeout) clearTimeout(this.boostTimeout);
        }

        this.speedMultiplier = 2;
        this.soundManager.playBoost();
        this.soundManager.setEnginePitch(1.5); // Higher pitch
        // console.log("BOOST ACTIVATED! Speed:", this.baseSpeed * this.speedMultiplier);

        this.boostTimeout = setTimeout(() => {
            this.speedMultiplier = 1;
            this.soundManager.setEnginePitch(0); // Normal pitch
            // console.log("Boost ended.");
        }, 3000);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.isGameOver) {
            this.sceneManager.render();
            return;
        }

        const rawDelta = this.clock.getDelta();
        const delta = Math.min(rawDelta, 0.1);

        if (!this.isPaused && !this.isCountdownActive) {
            const isBoosted = this.speedMultiplier > 1;

            // Update Speed Line Effect & FOV
            this.sceneManager.updateSpeedLineEffect(this.speedMultiplier, isBoosted);

            // Sync Nitro UI & 2D Speed Lines
            this.uiManager.setNitroEffect(isBoosted);
            this.uiManager.updateSpeedLines();

            // Trigger 3D Exhaust Flames
            this.entityManager.setNitroExhaust(isBoosted);

            const timeScale = delta / 0.016; // Normalizes to 60fps base

            // Game Loop - Only update if NOT paused and NOT in countdown
            this.entityManager.update(
                delta, // True delta for animations
                (this.baseScrollSpeed * this.speedMultiplier) * timeScale, // Scaled Scroll
                this.enemyBaseSpeed * timeScale, // Scaled Enemy Speed
                this.inputManager,
                (points) => {
                    this.score += points;
                    this.uiManager.updateScore(this.score);
                    this.soundManager.playCoin();

                    if (this.score > 0 && this.score % 25 === 0) {
                        // Increase Enemy Speed
                        if (this.enemyBaseSpeed < 4.0) this.enemyBaseSpeed += 0.2;

                        // Increase Player/Scroll Speed (The user requested this)
                        if (this.baseScrollSpeed < 3.0) this.baseScrollSpeed += 0.1;
                    }
                },
                () => {
                    this.isGameOver = true;
                    this.inputManager.setGameOver(true);
                    this.uiManager.showGameOver();
                    this.uiManager.setNitroEffect(false); // Clean up UI
                    this.soundManager.stopEngine();
                    this.soundManager.playGameOver();
                },
                () => {
                    this.activateBoost();
                },
                isBoosted // Pass boost status for invincibility
            );
        }

        // --- Global Visual Updates ---
        // Sync environment lighting even during countdown/pause
        this.sceneManager.updateTimeOfDay(this.score);

        // Camera Follow (always update, even when paused)
        this.updateCamera();

        // Update Scene (Clouds, etc.)
        this.sceneManager.update(delta);

        // Update Headlights & emissives based on night progress
        this.entityManager.setNightFactor(this.sceneManager.nightIntensity);

        this.sceneManager.render();
    }
}

// Start
new Game();
