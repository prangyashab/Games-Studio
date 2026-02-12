export class InputManager {
    constructor() {
        this.moveLeft = false;
        this.moveRight = false;
        this.isGameOver = false;
        this.controlMode = 'buttons'; // 'buttons' or 'swipe'

        // Swipe properties
        this.touchStartX = 0;
        this.touchCurrentX = 0;
        this.isTouching = false;

        this.initKeyboard();
        this.initTouch();
        this.initTilt();
    }

    setGameOver(state) {
        this.isGameOver = state;
        if (state) {
            this.moveLeft = false;
            this.moveRight = false;
            this.isTouching = false;
        }
    }

    setControlMode(mode) {
        this.controlMode = mode;
        this.moveLeft = false;
        this.moveRight = false;
        this.isTouching = false;

        // Request permission for iOS 13+ devices
        if (mode === 'tilt' && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        // Permission granted
                    }
                })
                .catch(console.error);
        }
    }

    initKeyboard() {
        window.addEventListener('keydown', (event) => {
            if (this.isGameOver) return;
            if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { this.moveLeft = true; }
            else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { this.moveRight = true; }
        });

        window.addEventListener('keyup', (event) => {
            if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { this.moveLeft = false; }
            else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { this.moveRight = false; }
        });
    }

    initTouch() {
        const leftButton = document.getElementById('left-button');
        const rightButton = document.getElementById('right-button');

        // Button Controls
        if (leftButton) {
            leftButton.addEventListener('pointerdown', (e) => {
                if (!this.isGameOver && this.controlMode === 'buttons') { e.preventDefault(); this.moveLeft = true; }
            }, { passive: false });
            leftButton.addEventListener('pointerup', (e) => { this.moveLeft = false; });
            leftButton.addEventListener('pointerleave', (e) => { this.moveLeft = false; });
        }

        if (rightButton) {
            rightButton.addEventListener('pointerdown', (e) => {
                if (!this.isGameOver && this.controlMode === 'buttons') { e.preventDefault(); this.moveRight = true; }
            }, { passive: false });
            rightButton.addEventListener('pointerup', (e) => { this.moveRight = false; });
            rightButton.addEventListener('pointerleave', (e) => { this.moveRight = false; });
        }

        // Swipe Controls - Global listeners
        window.addEventListener('touchstart', (e) => {
            if (this.isGameOver || this.controlMode !== 'swipe') return;
            this.isTouching = true;
            this.touchStartX = e.touches[0].clientX;
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (this.isGameOver || this.controlMode !== 'swipe' || !this.isTouching) return;

            this.touchCurrentX = e.touches[0].clientX;
            const diffX = this.touchCurrentX - this.touchStartX;

            // Threshold for sensitive steering
            const threshold = 15;
            if (diffX < -threshold) {
                this.moveLeft = true;
                this.moveRight = false;
            } else if (diffX > threshold) {
                this.moveRight = true;
                this.moveLeft = false;
            } else {
                this.moveLeft = false;
                this.moveRight = false;
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            if (this.controlMode !== 'swipe') return;
            this.isTouching = false;
            this.moveLeft = false;
            this.moveRight = false;
        });

        window.addEventListener('touchcancel', () => {
            if (this.controlMode !== 'swipe') return;
            this.isTouching = false;
            this.moveLeft = false;
            this.moveRight = false;
        });
    }

    initTilt() {
        window.addEventListener('deviceorientation', (e) => {
            if (this.isGameOver || this.controlMode !== 'tilt') return;

            const tilt = e.gamma; // Left/Right tilt in degrees
            if (tilt === null) return;

            const threshold = 7; // Sensitivity threshold in degrees

            if (tilt < -threshold) {
                this.moveLeft = true;
                this.moveRight = false;
            } else if (tilt > threshold) {
                this.moveRight = true;
                this.moveLeft = false;
            } else {
                this.moveLeft = false;
                this.moveRight = false;
            }
        });
    }
}
