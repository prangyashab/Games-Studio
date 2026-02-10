import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class GameEntities {
    constructor(scene) {
        this.scene = scene;
        this.playerCar = null;
        this.enemyCar = null;
        this.road = null;
        this.props = []; // Buildings, lights, etc.
        this.points = [];
        this.roadLength = 200;
        this.roadWidth = 10;

        this.carBaseY = 0.5; // Will update after loading
    }

    async loadAssets(onProgress) {
        const loadingManager = new THREE.LoadingManager();
        loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            if (onProgress) onProgress(itemsLoaded / itemsTotal);
        };

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

        const gltfLoader = new GLTFLoader(loadingManager);
        gltfLoader.setDRACOLoader(dracoLoader);

        // Load Car Model
        return new Promise((resolve, reject) => {
            gltfLoader.load(
                'https://threejs.org/examples/models/gltf/ferrari.glb',
                (gltf) => {
                    this.playerCar = gltf.scene;
                    this.setupCar(this.playerCar, 0xffff00); // Yellow/Red original
                    this.scene.add(this.playerCar);

                    // Clone for Enemy
                    this.enemyCar = this.playerCar.clone();
                    this.setupCar(this.enemyCar, 0x0000ff); // Blue
                    this.enemyCar.position.set(3, 0.5, 50); // Initial pos
                    this.scene.add(this.enemyCar);

                    this.buildLevel();
                    resolve();
                },
                undefined,
                (error) => {
                    console.error("Error loading model, using fallback", error);
                    this.createFallbackCar();
                    this.buildLevel();
                    resolve(); // Resolve anyway to start game
                }
            );
        });
    }

    setupCar(carModel, colorHex) {
        carModel.scale.set(0.6, 0.6, 0.6);
        carModel.rotation.y = Math.PI; // Face forward

        carModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (colorHex && child.name.includes("body")) { // Simple tint attempt
                    // child.material.color.setHex(colorHex);
                }
            }
        });

        // Calc Y
        const box = new THREE.Box3().setFromObject(carModel);
        this.carBaseY = -box.min.y;
        carModel.position.y = this.carBaseY;
    }

    createFallbackCar() {
        const geometry = new THREE.BoxGeometry(2, 1, 4);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.playerCar = new THREE.Mesh(geometry, material);
        this.playerCar.castShadow = true;
        this.playerCar.position.y = 0.5;
        this.scene.add(this.playerCar);

        this.enemyCar = this.playerCar.clone();
        this.enemyCar.material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        this.enemyCar.position.set(3, 0.5, 50);
        this.scene.add(this.enemyCar);

        this.carBaseY = 0.5;
    }

    buildLevel() {
        // Ground
        const groundGeo = new THREE.PlaneGeometry(600, 800);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x448844,
            roughness: 0.8,
            metalness: 0.1
        }); // More natural Green
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.position.z = 100; // Center it somewhat
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Road
        const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.roadLength);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x555555 }); // Dark Gray
        this.road = new THREE.Mesh(roadGeo, roadMat);
        this.road.rotation.x = -Math.PI / 2;
        this.road.position.z = this.roadLength / 2 - 20; // Extend forward
        this.road.receiveShadow = true;
        this.scene.add(this.road);

        // Initial Props Loop
        for (let i = 0; i < 20; i++) {
            // Alternate between buildings and trees
            if (i % 2 === 0) {
                this.spawnBuilding(-this.roadWidth - 5 - Math.random() * 10, i * 25);
                this.spawnBuilding(this.roadWidth + 5 + Math.random() * 10, i * 25);
            } else {
                this.spawnTree(-this.roadWidth - 8 - Math.random() * 15, i * 25);
                this.spawnTree(this.roadWidth + 8 + Math.random() * 15, i * 25);
            }
        }

        // Road Lines
        this.roadLines = [];
        for (let i = 0; i < 40; i++) {
            const line = new THREE.Mesh(
                new THREE.PlaneGeometry(0.3, 4),
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );
            line.rotation.x = -Math.PI / 2;
            line.position.z = i * 8;
            line.position.y = 0.01;
            this.scene.add(line);
            this.roadLines.push(line);
        }

        // Collectible Points (Coins)
        for (let i = 0; i < 10; i++) {
            const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
            const coinMat = new THREE.MeshStandardMaterial({
                color: 0xffd700,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0xffd700,
                emissiveIntensity: 0.4
            });
            const point = new THREE.Mesh(coinGeo, coinMat);
            point.rotation.x = Math.PI / 2; // Flat on face initially
            point.position.set((Math.random() - 0.5) * 8, 0.6, 50 + i * 20);
            point.castShadow = true;
            this.scene.add(point);
            this.points.push(point);
        }
    }

    spawnBuilding(x, z) {
        const height = 15 + Math.random() * 30;
        const width = 6 + Math.random() * 4;
        const depth = 6 + Math.random() * 4;

        const buildingGroup = new THREE.Group();

        // Main Body
        const curatedColors = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x2d3436, 0x636e72];
        const color = curatedColors[Math.floor(Math.random() * curatedColors.length)];

        const bodyGeo = new THREE.BoxGeometry(width, height, depth);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        buildingGroup.add(body);

        // Roof Cap
        const capHeight = 1;
        const capGeo = new THREE.BoxGeometry(width + 0.5, capHeight, depth + 0.5);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x1e272e });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = height / 2 + capHeight / 2;
        cap.castShadow = true;
        buildingGroup.add(cap);

        // Decorative Bands
        const bandGeo = new THREE.BoxGeometry(width + 0.2, 0.4, depth + 0.2);
        const bandMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7 });
        for (let i = 0; i < 3; i++) {
            const band = new THREE.Mesh(bandGeo, bandMat);
            band.position.y = (height / 2) - (i + 1) * (height / 4);
            buildingGroup.add(band);
        }

        // Window Grid
        const windowColor = 0xffffcc;
        const windowGeo = new THREE.PlaneGeometry(0.6, 0.8);
        const windowMat = new THREE.MeshStandardMaterial({
            color: windowColor,
            emissive: windowColor,
            emissiveIntensity: 1.0
        });

        const rows = Math.floor(height / 4);
        const cols = Math.floor(width / 2);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Front windows
                const winFront = new THREE.Mesh(windowGeo, windowMat);
                winFront.position.set(
                    (c - (cols - 1) / 2) * 1.5,
                    (r - (rows - 1) / 2) * 3.5,
                    depth / 2 + 0.05
                );
                buildingGroup.add(winFront);

                // Back windows
                const winBack = winFront.clone();
                winBack.position.z = -depth / 2 - 0.05;
                winBack.rotation.y = Math.PI;
                buildingGroup.add(winBack);
            }
        }

        buildingGroup.position.set(x, height / 2, z);
        this.scene.add(buildingGroup);
        this.props.push(buildingGroup);
    }

    spawnTree(x, z) {
        const treeGroup = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 2, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d3a1a });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);

        // Leaves (Cones)
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
        for (let i = 0; i < 3; i++) {
            const leafGeo = new THREE.ConeGeometry(1.5 - i * 0.3, 2, 8);
            const leaves = new THREE.Mesh(leafGeo, leafMat);
            leaves.position.y = 2 + i * 1.2;
            leaves.castShadow = true;
            leaves.receiveShadow = true;
            treeGroup.add(leaves);
        }

        treeGroup.position.set(x, 0, z);
        this.scene.add(treeGroup);
        this.props.push(treeGroup);
    }

    update(deltaTime, speed) {
        // Move Environment Backward (simulate car moving forward)
        const moveDist = speed * deltaTime * 60; // Approximate scale

        // Move Road Lines
        this.roadLines.forEach(line => {
            line.position.z -= moveDist;
            if (line.position.z < -10) {
                line.position.z += 320; // Recycle to back
            }
        });

        // Move Props (Buildings)
        this.props.forEach(prop => {
            prop.position.z -= moveDist;
            if (prop.position.z < -20) {
                prop.position.z += 300;
                prop.position.x = (prop.position.x > 0 ? 1 : -1) * (15 + Math.random() * 5); // randomize x slightly
                // Randomize height again would require new geometry, skip for perf
            }
        });

        // Move Points
        this.points.forEach(point => {
            point.position.z -= moveDist;
            point.rotation.z += deltaTime * 5; // Spin the coin
            if (point.position.z < -10) {
                this.recyclePoint(point);
            }
        });

        // Enemy specific update is handled in GameLogic usually, 
        // but simple z-movement relative to player can be here
        // We will manage Enemy logic in GameLogic mostly
    }

    recyclePoint(point) {
        point.visible = true;
        point.position.z = 200 + Math.random() * 100;
        point.position.x = (Math.random() - 0.5) * 8;
    }
}
