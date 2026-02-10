import * as THREE from 'three';
import { SceneInit } from './SceneInit.js';
import { GameEntities } from './GameEntities.js';
import { InputManager } from './InputManager.js';
import { GameLogic } from './GameLogic.js';

class Game {
    constructor() {
        this.sceneInit = new SceneInit('container');
        this.entities = new GameEntities(this.sceneInit.scene);
        this.input = new InputManager();
        this.logic = new GameLogic(this.entities, this.sceneInit);

        this.lastTime = 0;
        this.score = 0;
        this.isGameOver = false;

        this.init();
    }

    async init() {
        // Initialize Scene
        this.sceneInit.init();

        // Load Assets
        try {
            await this.entities.loadAssets((progress) => {
                const loadingEl = document.getElementById('loading');
                if (loadingEl) loadingEl.innerText = `Loading ${Math.round(progress * 100)}%...`;
            });

            // Hide loading screen
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.style.opacity = '0';
                setTimeout(() => loadingEl.style.display = 'none', 500);
            }

            // Start Game Loop
            this.animate(0);
        } catch (error) {
            console.error("Failed to load game assets:", error);
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.innerText = "Error loading game assets. Please refresh.";
        }
    }

    animate(time) {
        if (this.isGameOver) return;

        requestAnimationFrame((t) => this.animate(t));

        const deltaTime = (time - this.lastTime) / 1000 || 0;
        this.lastTime = time;

        // Update Game Logic
        this.logic.update(deltaTime, this.input);

        // Update Entities (Road, Buildings, etc.)
        this.entities.update(deltaTime, this.logic.speed);

        // Check specifics
        if (this.logic.isGameOver) {
            this.isGameOver = true;
            document.getElementById('game-over').style.display = 'block';
        }

        // Render
        this.sceneInit.render();
    }
}

// Start the game
window.onload = () => {
    new Game();
};
