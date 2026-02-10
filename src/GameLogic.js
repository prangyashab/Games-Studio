import * as THREE from 'three';

export class GameLogic {
    constructor(entities, sceneInit) {
        this.entities = entities;
        this.sceneInit = sceneInit;
        this.score = 0;
        this.isGameOver = false;

        // Settings
        this.speed = 0.5;
        this.laneWidth = 2.5;
        this.enemySpeed = 0.4;

        // Player state
        this.playerX = 0;
        this.targetLaneX = 0;

        // Enemy State
        this.enemyZ = 50;

        this.scoreEl = document.getElementById('score');
    }

    update(deltaTime, input) {
        if (this.isGameOver) return;

        // Player Movement (Slide left/right)
        const moveSpeed = 10 * deltaTime;

        if (input.left) this.playerX -= moveSpeed;
        if (input.right) this.playerX += moveSpeed;

        // Clamp player X
        const maxOffset = 3.5;
        if (this.playerX > maxOffset) this.playerX = maxOffset;
        if (this.playerX < -maxOffset) this.playerX = -maxOffset;

        // Update Player Mesh Position
        if (this.entities.playerCar) {
            this.entities.playerCar.position.x = this.playerX;

            // Camera Follow
            const targetCamX = this.playerX * 0.5;
            this.sceneInit.camera.position.x += (targetCamX - this.sceneInit.camera.position.x) * 0.1;
            this.sceneInit.camera.lookAt(
                this.entities.playerCar.position.x * 0.2,
                1,
                this.entities.playerCar.position.z + 10
            );
        }

        // Enemy Logic
        this.updateEnemy(deltaTime);

        // Collision & Scoring
        this.checkCollisions();
    }

    updateEnemy(deltaTime) {
        if (!this.entities.enemyCar) return;

        // Move enemy towards player z (technically player stays at 0, world moves)
        // But for visual effect, let's keep enemy moving relative to player

        this.entities.enemyCar.position.z -= (this.speed + this.enemySpeed) * deltaTime * 60;

        if (this.entities.enemyCar.position.z < -10) {
            // Respawn Enemy
            this.entities.enemyCar.position.z = 100 + Math.random() * 50;
            this.entities.enemyCar.position.x = (Math.random() - 0.5) * 6; // Random Lane
        }
    }

    checkCollisions() {
        if (!this.entities.playerCar) return;

        const playerBox = new THREE.Box3().setFromObject(this.entities.playerCar);
        // Slightly shrink box for fairer gameplay
        playerBox.expandByScalar(-0.1);

        // Check Enemy
        if (this.entities.enemyCar) {
            const enemyBox = new THREE.Box3().setFromObject(this.entities.enemyCar);
            if (playerBox.intersectsBox(enemyBox)) {
                this.isGameOver = true;
                this.speed = 0;
                return;
            }
        }

        // Check Points
        this.entities.points.forEach(point => {
            if (!point.visible) return;

            const pointBox = new THREE.Box3().setFromObject(point);
            if (playerBox.intersectsBox(pointBox)) {
                point.visible = false;
                this.score += 10;
                this.scoreEl.innerText = `Score: ${this.score}`;

                // Respawn point further
                setTimeout(() => {
                    this.entities.recyclePoint(point);
                }, 1000);
            }
        });
    }
}
