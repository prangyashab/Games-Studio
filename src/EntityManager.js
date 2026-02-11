import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CityMap } from './maps/CityMap.js';
import { DesertMap } from './maps/DesertMap.js';
import { SnowMap } from './maps/SnowMap.js';
import { CyberCityMap } from './maps/CyberCityMap.js';

export class EntityManager {
    constructor(scene, roadLength, roadWidth) {
        this.scene = scene;
        this.roadLength = roadLength;
        this.roadWidth = roadWidth;
        this.sceneryRecycleDistance = 150;

        this.currentMapType = 'city';
        this.cityMap = new CityMap(scene, roadWidth, roadLength);
        this.desertMap = new DesertMap(scene, roadWidth, roadLength);
        this.snowMap = new SnowMap(scene, roadWidth, roadLength);
        this.cyberCityMap = new CyberCityMap(scene, roadWidth, roadLength);

        // Entities
        this.carModel = null;
        this.enemyModel = null; // Separate model for enemies
        this.enemyCars = []; // Array to support multiple enemies if needed
        this.points = [];
        this.roadLines = [];
        this.buildings = [];
        this.kerbs = [];
        this.boosts = [];
        this.pedestrians = []; // New pedestrian list
        this.footpaths = []; // New footpath list
        this.extras = []; // Extra map-specific meshes to clear
        this.snowSystem = null; // Particle system for snow

        // Constants / Config
        this.carBaseY = 0;
        this.kerbWidth = 0.3;
        this.pointRadius = 0.3;
        this.buildingSpacing = 25; // Balanced spacing for performance
        this.lightSpacing = 40;

        // State
        this.playerBox = new THREE.Box3();
        this.enemyBox = new THREE.Box3();
        this.pointBox = new THREE.Box3();
        this.boostBox = new THREE.Box3();

        // distinct color logic
        this.availableColors = [
            0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff,
            0xffa500, 0x800080, 0x008000, 0x000080, 0xffc0cb, 0x40E0D0
        ];
        this.lastColorIndex = -1;
    }

    getDistinctColor() {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * this.availableColors.length);
        } while (newIndex === this.lastColorIndex);

        this.lastColorIndex = newIndex;
        return new THREE.Color(this.availableColors[newIndex]);
    }

    async loadAssets(onProgress) {
        // Immediately show 10% so it doesn't stay at 0%
        if (onProgress) onProgress(0.1);

        const loadingManager = new THREE.LoadingManager();
        loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            // Map actual progress (0 to 1) into (0.1 to 1.0) range
            const p = 0.1 + (itemsLoaded / itemsTotal) * 0.9;
            if (onProgress) onProgress(p);
        };

        const loader = new GLTFLoader(loadingManager);
        const dracoLoader = new DRACOLoader(loadingManager);
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        loader.setDRACOLoader(dracoLoader);

        return new Promise((resolve, reject) => {
            // Load Player Car (Ferrari)
            const p1 = new Promise(r => loader.load('https://threejs.org/examples/models/gltf/ferrari.glb', (gltf) => {
                this.setupPlayerCar(gltf.scene);
                r();
            }, (xhr) => {
                // Individual file progress for smoother feedback
                if (xhr.lengthComputable && onProgress) {
                    const fileP = (xhr.loaded / xhr.total) * 0.5; // Weight car as 50%
                    onProgress(0.1 + fileP);
                }
            }, (err) => {
                console.error("Player car failed", err);
                this.createFallbackCar();
                r();
            }));

            p1.then(() => {
                this.createLevel();
                if (onProgress) onProgress(1.0); // Complete
                resolve();
            });
        });
    }

    setupEnemyModel(model) {
        this.enemyModel = model;
        // Adjust scale/rotation if needed for this specific model
        // User reported it's too small, so increasing significantly.
        // Assuming original model unit is meters or similar. 
        this.enemyModel.scale.set(1.5, 1.5, 1.5);

        this.enemyModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
    }

    setupPlayerCar(model) {
        this.carModel = model;
        this.carModel.scale.set(0.8, 0.8, 0.8);

        const box = new THREE.Box3().setFromObject(this.carModel);
        this.carBaseY = -box.min.y + 0.01;

        this.carModel.position.set(0, this.carBaseY, 0);
        this.carModel.rotation.y = Math.PI; // Face forward

        this.carModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;

                // Clone material
                const newMat = node.material.clone();
                const name = node.name.toLowerCase();

                // Exclude obvious non-body parts
                const isWheel = name.includes('wheel') || name.includes('tire') || name.includes('rim') || name.includes('brake');
                const isGlass = name.includes('glass') || name.includes('window') || name.includes('windshield') || newMat.opacity < 0.9;
                const isInterior = name.includes('interior') || name.includes('seat') || name.includes('dashboard') || name.includes('steering');
                const isLight = name.includes('light') || name.includes('lamp');

                // Determine if it is likely the body
                // The main body usually has the largest surface area or specific material properties
                // Heuristic: If it's not excluded, and it's metallic/shiny, OR explicitly named body/paint
                let isBody = (name.includes('body') || name.includes('paint') || name.includes('chassis') || name.includes('main'));

                // Fallback: If not named, guess by material type (shiny paint)
                if (!isBody && !isWheel && !isGlass && !isInterior && !isLight) {
                    if (newMat.metalness > 0.4 && newMat.roughness < 0.6) {
                        isBody = true;
                    }
                }

                if (isBody) {
                    if (this.mapType === 'snow') {
                        // Force Red
                        newMat.color.set(0xff0000);
                        newMat.emissive.set(0x000000); // Clear any emissive
                    } else {
                        newMat.color.set(0x222222); // Dark Charcoal
                    }
                }

                node.material = newMat;
            }
        });
        this.scene.add(this.carModel);
        this.addHeadlights(this.carModel, true);
        this.setupNitroExhaust(this.carModel);
    }

    addHeadlights(car, isPlayer = false) {
        // Create 2 spot lights for headlights
        car.userData.headlights = [];
        const headlightColor = 0xffffdf;
        const intensity = 0; // Start off

        // Left
        // Increased angle and distance for better road visibility
        const leftHeadlight = new THREE.SpotLight(headlightColor, intensity, 100, Math.PI / 3, 0.5, 1);
        leftHeadlight.position.set(0.6, 0.5, -1.8);
        const leftTarget = new THREE.Object3D();
        leftTarget.position.set(0.6, 0.0, -30); // Aim further down the road
        car.add(leftHeadlight);
        car.add(leftTarget);
        leftHeadlight.target = leftTarget;

        // Right
        const rightHeadlight = new THREE.SpotLight(headlightColor, intensity, 100, Math.PI / 3, 0.5, 1);
        rightHeadlight.position.set(-0.6, 0.5, -1.8);
        const rightTarget = new THREE.Object3D();
        rightTarget.position.set(-0.6, 0.0, -30); // Aim further down the road
        car.add(rightHeadlight);
        car.add(rightTarget);
        rightHeadlight.target = rightTarget;

        car.userData.headlights.push(leftHeadlight, rightHeadlight);
    }

    setupNitroExhaust(car) {
        car.userData.exhaustFlames = [];

        // Create 2 exhaust flames
        const positions = [[-0.4, 0.4, 1.8], [0.4, 0.4, 1.8]];

        positions.forEach(pos => {
            const flameGeo = new THREE.ConeGeometry(0.12, 1.2, 8);
            flameGeo.rotateX(-Math.PI / 2); // Point backward

            const flameMat = new THREE.MeshBasicMaterial({
                color: 0x00d2ff, // Outer glow blue
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending
            });

            const flame = new THREE.Mesh(flameGeo, flameMat);
            flame.position.set(...pos);
            flame.scale.set(1, 1, 1);

            // Inner core flame
            const coreGeo = new THREE.ConeGeometry(0.06, 0.8, 8);
            coreGeo.rotateX(-Math.PI / 2);
            const coreMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            flame.add(core);

            car.add(flame);
            car.userData.exhaustFlames.push(flame);
        });
    }

    setNitroExhaust(active) {
        if (!this.carModel || !this.carModel.userData.exhaustFlames) return;

        this.carModel.userData.exhaustFlames.forEach(flame => {
            if (active) {
                flame.material.opacity = 0.8;
                flame.children[0].material.opacity = 0.9;

                // Pulsing scale
                const pulse = 1.0 + Math.sin(Date.now() * 0.04) * 0.2;
                flame.scale.set(pulse, pulse, pulse * 1.5);

                // Shift color slightly for heat effect
                flame.material.color.setHSL(0.55 + Math.sin(Date.now() * 0.01) * 0.05, 1, 0.5);
            } else {
                flame.material.opacity = 0;
                flame.children[0].material.opacity = 0;
            }
        });
    }

    createFallbackCar() {
        const geo = new THREE.BoxGeometry(2, 1, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.carModel = new THREE.Mesh(geo, mat);
        this.carBaseY = 0.51;
        this.carModel.position.set(0, this.carBaseY, 0);
        this.scene.add(this.carModel);
    }

    spawnEnemy() {
        if (!this.carModel) return;

        // Use the Ferrari model (this.carModel) as requested
        const enemy = this.carModel.clone();

        const distinctColor = this.getDistinctColor();
        enemy.traverse((node) => {
            if (node.isMesh) {
                // Heuristic for Ferrari model:
                // Parts are often named. Let's try to find "Body" or similar, 
                // OR fallback to metalness but exclude very specific known parts if possible.
                // In standard GLTF Ferrari example:
                // "body" is the main red part. "glass" is windows. "wheel" etc.

                // We will clone material first
                const newMat = node.material.clone();

                // Check for body-like properties or names
                // The example Ferrari usually has a red material. We can check if original color is red-ish?
                // Or just use the metalness check again but lets be more careful.
                const isBody = (node.name.toLowerCase().includes('body') ||
                    (newMat.metalness > 0.4 && newMat.roughness < 0.6));

                if (isBody) {
                    newMat.color.set(distinctColor);
                }

                node.material = newMat;
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });


        const lanes = [-3, 0, 3];
        const laneX = lanes[Math.floor(Math.random() * lanes.length)];

        enemy.position.set(laneX, this.carBaseY, this.roadLength * 0.7);
        enemy.rotation.y = Math.PI; // Face player

        this.addHeadlights(enemy);
        this.enemyCars.push(enemy);
        this.scene.add(enemy);
        console.log("Spawned enemy Ferrari at", laneX);
    }

    setMap(type) {
        this.currentMapType = type;
    }

    createLevel() {
        // Clear existing map-specific entities if any (on restart)
        this.buildings.forEach(b => this.scene.remove(b));
        this.footpaths.forEach(f => this.scene.remove(f));
        this.roadLines.forEach(l => this.scene.remove(l));
        this.pedestrians.forEach(p => this.scene.remove(p));
        this.kerbs.forEach(k => this.scene.remove(k));

        if (this.roadMesh) this.scene.remove(this.roadMesh);
        if (this.groundMesh) this.scene.remove(this.groundMesh);
        if (this.skylineBillboards) this.skylineBillboards.forEach(b => this.scene.remove(b));
        if (this.extras) this.extras.forEach(e => this.scene.remove(e));

        // Reset spawn collision hooks
        delete this.spawnBuildingPairAt;

        this.buildings = [];
        this.footpaths = [];
        this.roadLines = [];
        this.pedestrians = [];
        this.kerbs = [];
        this.skylineBillboards = [];
        this.extras = [];

        // Clear Snow System
        if (this.snowSystem) {
            this.scene.remove(this.snowSystem);
            this.snowSystem = null;
        }

        // Generate map
        switch (this.currentMapType) {
            case 'desert': this.desertMap.createLevel(this); break;
            case 'snow': this.snowMap.createLevel(this); break;
            case 'cybercity': this.cyberCityMap.createLevel(this); break;
            default: this.cityMap.createLevel(this); break;
        }

        // Apply car color based on map type (force update)
        this.updateCarColor();

        // --- COMMON ENTITIES (Shared across all maps) ---

        // keep common entities (points, boosts, enemies).

        // --- Points (Gold Coins) ---
        const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        const coinMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0xffd700,
            emissiveIntensity: 0.4
        });

        // Only spawn initial if they don't exist
        if (this.points.length === 0) {
            for (let i = 0; i < 15; i++) {
                const p = new THREE.Mesh(coinGeo, coinMat);
                p.rotation.x = Math.PI / 2;
                this.resetPoint(p, true);
                this.points.push(p);
                this.scene.add(p);
            }
        }

        // Initial Enemy
        if (this.enemyCars.length === 0) {
            this.spawnEnemy();
        }

        // --- Boosts ---
        if (this.boosts.length === 0) {
            for (let i = 0; i < 1; i++) {
                const b = this.createBoostMesh();
                this.resetBoost(b, true);
                this.boosts.push(b);
                this.scene.add(b);
            }
        }
    }

    spawnBuildingPairAt(zPos) {
        // Left
        const bL = this.createBuildingMesh();
        const buildingWidth = bL.userData.width || 8;
        // Calculation: roadWidth/2 + sideWalkWidth (5) + buildingWidth/2 + buffer (2)
        const xL = -(this.roadWidth / 2 + 5 + buildingWidth / 2 + 2 + Math.random() * 3);
        bL.position.set(xL, bL.userData.height / 2, zPos);
        this.buildings.push(bL);
        this.scene.add(bL);

        // Right
        const bR = this.createBuildingMesh();
        const xR = (this.roadWidth / 2 + 5 + buildingWidth / 2 + 2 + Math.random() * 3);
        bR.position.set(xR, bR.userData.height / 2, zPos);
        this.buildings.push(bR);
        this.scene.add(bR);
    }

    spawnSkylineBillboard(zPos) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Simple Building Silhouette Gradient
        const grad = ctx.createLinearGradient(0, 512, 0, 0);
        grad.addColorStop(0, '#2c3e50');
        grad.addColorStop(1, '#34495e');
        ctx.fillStyle = grad;
        ctx.fillRect(40, 50, 176, 462);

        // Add random windows
        ctx.fillStyle = '#f1c40f';
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 4; c++) {
                if (Math.random() > 0.3) ctx.fillRect(60 + c * 35, 80 + r * 25, 20, 15);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);

        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = 80 + Math.random() * 100;
        sprite.position.set(side * dist, 50, zPos);
        sprite.scale.set(40, 100, 1);

        this.skylineBillboards.push(sprite);
        this.scene.add(sprite);
    }

    spawnBackdropBuilding(zPos) {
        // Reduced frequency of 3D backdrop buildings to favor billboards
        if (Math.random() > 0.5) return;

        for (let side = -1; side <= 1; side += 2) {
            const b = this.createBuildingMesh(true);
            const dist = 50 + Math.random() * 40;
            b.position.set(side * dist, b.userData.height / 2, zPos);
            this.buildings.push(b);
            this.scene.add(b);
        }
    }

    spawnBuildingPair(index) {
        // Legacy method, replaced by spawnBuildingPairAt
    }

    createBuildingMesh(isLarge = false) {
        const w = (6 + Math.random() * 4) * (isLarge ? 2 : 1);
        const h = (15 + Math.random() * 30) * (isLarge ? 2.5 : 1);
        const d = (6 + Math.random() * 4) * (isLarge ? 2 : 1);

        const group = new THREE.Group();

        // Body
        const curatedColors = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x2d3436, 0x636e72];
        const color = curatedColors[Math.floor(Math.random() * curatedColors.length)];
        const bodyGeo = new THREE.BoxGeometry(w, h, d);
        const bodyMat = new THREE.MeshStandardMaterial({ color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Roof Cap
        const capColor = (this.currentMapType === 'snow') ? 0xffffff : 0x1e272e;
        const capGeo = new THREE.BoxGeometry(w + 0.5, 1, d + 0.5);
        const capMat = new THREE.MeshStandardMaterial({ color: capColor });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = h / 2 + 0.5;
        group.add(cap);

        // Windows Optimization: Use one geometry for ALL windows per building
        const rows = Math.floor(h / 5);
        const cols = Math.floor(w / 2);

        const windowGeometries = [];
        const winPlaneGeo = new THREE.PlaneGeometry(0.6, 0.8);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Front Side
                const geoFront = winPlaneGeo.clone();
                geoFront.applyMatrix4(new THREE.Matrix4().makeTranslation(
                    (c - (cols - 1) / 2) * 1.5,
                    (r - (rows - 1) / 2) * 4,
                    d / 2 + 0.05
                ));
                windowGeometries.push(geoFront);

                // Back Side
                const geoBack = winPlaneGeo.clone();
                geoBack.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI));
                geoBack.applyMatrix4(new THREE.Matrix4().makeTranslation(
                    (c - (cols - 1) / 2) * 1.5,
                    (r - (rows - 1) / 2) * 4,
                    -d / 2 - 0.05
                ));
                windowGeometries.push(geoBack);
            }
        }

        if (windowGeometries.length > 0) {
            // Since we don't have BufferGeometryUtils.mergeGeometries easily, 
            // we'll manually merge or just use a small number of groups. 
            // In Three.js, we can use a simpler approach: create one large mesh 
            // if we have a merge utility, but since we don't, I'll use a very efficient loop 
            // or just a single mesh with merged data.

            // Actually, for now, let's use a simpler optimization:
            // Only add windows if building is close enough or use a simpler texture.
            // But I will manually merge the vertices/indices for peak performance.

            const mergedGeo = this.mergeSimpleGeometries(windowGeometries);
            const winMat = new THREE.MeshStandardMaterial({
                color: 0xffffcc,
                emissive: 0xffffcc,
                emissiveIntensity: 1.0
            });
            const windowsMesh = new THREE.Mesh(mergedGeo, winMat);
            group.add(windowsMesh);
        }

        // Store info for positioning
        group.userData = { height: h, width: w };
        return group;
    }

    mergeSimpleGeometries(geos) {
        // Manual merge of PlaneGeometries to avoid dependencies
        const combinedVertices = [];
        const combinedNormals = [];
        const combinedUvs = [];
        const combinedIndices = [];
        let vertexOffset = 0;

        geos.forEach(geo => {
            const pos = geo.attributes.position.array;
            const norm = geo.attributes.normal.array;
            const uv = geo.attributes.uv.array;
            const idx = geo.index.array;

            for (let i = 0; i < pos.length; i++) combinedVertices.push(pos[i]);
            for (let i = 0; i < norm.length; i++) combinedNormals.push(norm[i]);
            for (let i = 0; i < uv.length; i++) combinedUvs.push(uv[i]);
            for (let i = 0; i < idx.length; i++) combinedIndices.push(idx[i] + vertexOffset);

            vertexOffset += geo.attributes.position.count;
        });

        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.Float32BufferAttribute(combinedVertices, 3));
        merged.setAttribute('normal', new THREE.Float32BufferAttribute(combinedNormals, 3));
        merged.setAttribute('uv', new THREE.Float32BufferAttribute(combinedUvs, 2));
        merged.setIndex(combinedIndices);
        return merged;
    }

    spawnTreePairAt(zPos) {
        const leftTree = this.createTree();
        const xL = -(this.roadWidth / 2 + 5 + 1 + Math.random() * 3);
        leftTree.position.set(xL, 0, zPos);
        this.buildings.push(leftTree);
        this.scene.add(leftTree);

        const rightTree = this.createTree();
        const xR = (this.roadWidth / 2 + 5 + 1 + Math.random() * 3);
        rightTree.position.set(xR, 0, zPos);
        this.buildings.push(rightTree);
        this.scene.add(rightTree);
    }

    spawnTreePair(index) {
        // Legacy
    }

    updateCarColor() {
        if (!this.carModel) return;

        this.carModel.traverse((node) => {
            if (node.isMesh) {
                // Heuristic: Check name OR material properties
                const name = node.name.toLowerCase();
                const mat = node.material;

                // Exclude obvious non-body parts
                const isWheel = name.includes('wheel') || name.includes('tire') || name.includes('rim') || name.includes('brake');
                const isGlass = name.includes('glass') || name.includes('window') || name.includes('windshield') || mat.opacity < 0.9;
                const isInterior = name.includes('interior') || name.includes('seat') || name.includes('dashboard') || name.includes('steering');
                const isLight = name.includes('light') || name.includes('lamp');

                // Determine if it is likely the body
                let isBody = (name.includes('body') || name.includes('paint') || name.includes('chassis') || name.includes('main'));

                if (!isBody && !isWheel && !isGlass && !isInterior && !isLight) {
                    // Force guess if it looks like car paint (shiny, not too rough)
                    if (mat.metalness > 0.4 && mat.roughness < 0.6) {
                        isBody = true;
                    }
                }

                if (isBody) {
                    if (this.currentMapType === 'snow') {
                        node.material.color.set(0xff2a2a); // Lighter Red
                        node.material.metalness = 0.6; // Reduce metalness for brighter look
                        node.material.roughness = 0.3; // Reduce gloss slightly
                        // Keep subtle emissive for night visibility but lighter
                        if (node.material.emissive) {
                            node.material.emissive.set(0x550000);
                            node.material.emissiveIntensity = 0.4;
                        }
                    } else if (this.currentMapType === 'cybercity') {
                        node.material.color.set(0x00ffff); // Electric Cyan
                        node.material.metalness = 0.9;
                        node.material.roughness = 0.1;
                        if (node.material.emissive) {
                            node.material.emissive.set(0x00aaaa); // Strong Cyan Glow
                            node.material.emissiveIntensity = 0.8;
                        }
                    } else {
                        // Default / Desert / City - Standard Black Car
                        node.material.color.set(0x111111); // Deep Black
                        node.material.metalness = 0.6;
                        node.material.roughness = 0.4;
                        if (node.material.emissive) {
                            node.material.emissive.set(0x000000); // No glow
                            node.material.emissiveIntensity = 0.0;
                        }
                    }
                }
            }
        });
    }

    createTree() {
        const group = new THREE.Group();
        // Merge tree geometries for performance
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
        trunkGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 1, 0));

        const leafColor = (this.currentMapType === 'snow') ? 0xffffff : 0x2d5a27;
        const leafMat = new THREE.MeshStandardMaterial({ color: leafColor });
        const leafGeos = [];
        for (let i = 0; i < 3; i++) {
            const lGeo = new THREE.ConeGeometry(1.5 - i * 0.3, 2, 8);
            lGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 2 + i * 1.2, 0));
            leafGeos.push(lGeo);
        }

        const mergedLeaves = this.mergeSimpleGeometries(leafGeos);
        const leaves = new THREE.Mesh(mergedLeaves, leafMat);
        leaves.castShadow = true;

        const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5d3a1a }));
        trunk.castShadow = true;

        group.add(trunk);
        group.add(leaves);
        return group;
    }

    spawnPedestrian(zPos) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const x = side * (this.roadWidth / 2 + 1 + Math.random() * 3);

        const p = this.createPerson();
        p.position.set(x, 0, zPos);
        // Random walking speed and direction
        p.userData = {
            speed: (0.5 + Math.random()) * 0.05,
            dir: Math.random() > 0.5 ? 1 : -1
        };
        this.pedestrians.push(p);
        this.scene.add(p);
    }

    createBoostMesh() {
        const group = new THREE.Group();
        const red = 0xff4757;

        // Main Bottle Body
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: red,
            metalness: 0.9,
            roughness: 0.1,
            emissive: red,
            emissiveIntensity: 0.5
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);

        // Bottle Neck
        const neckGeo = new THREE.CylinderGeometry(0.12, 0.2, 0.2, 12);
        const neck = new THREE.Mesh(neckGeo, bodyMat);
        neck.position.y = 0.5;
        group.add(neck);

        // Bottle Cap
        const capGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.5 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = 0.65;
        group.add(cap);

        // Label Area (Silver strip)
        const labelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.3, 12);
        const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8 });
        const label = new THREE.Mesh(labelGeo, labelMat);
        group.add(label);

        // Glowing Aura Sprite (For visibility)
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 71, 87, 0.8)');
        grad.addColorStop(1, 'rgba(255, 71, 87, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.5, 1.5, 1);
        group.add(sprite);

        return group;
    }

    createPerson() {
        const group = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.8, 0.2);
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const skinColor = [0xffdbac, 0xf1c27d, 0xe0ac69, 0x8d5524][Math.floor(Math.random() * 4)];
        const shirtColor = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf1c40f][Math.floor(Math.random() * 4)];

        const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: shirtColor }));
        body.position.y = 0.8;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: skinColor }));
        head.position.y = 1.35;
        head.castShadow = true;
        group.add(head);

        return group;
    }

    resetPoint(point, initial = false) {
        const laneWidth = this.roadWidth / 2 - this.kerbWidth - 1;
        point.position.x = (Math.random() * 2 - 1) * laneWidth;
        point.position.y = this.pointRadius + 0.1;

        // Improved recycling logic
        if (initial) {
            point.position.z = (Math.random() * this.roadLength) - (this.roadLength * 0.4);
        } else {
            // Recycle just ahead of the visible road end to keep stream constant
            // roadLength is 200. Recycle at -100. Spawn at +100 to +150.
            point.position.z = this.roadLength * 0.6 + Math.random() * 30;
        }
        point.visible = true;
    }

    resetBoost(boost, initial = false) {
        const laneWidth = this.roadWidth / 2 - this.kerbWidth - 1;
        boost.position.x = (Math.random() * 2 - 1) * laneWidth;
        boost.position.y = this.pointRadius + 0.5;

        if (initial) {
            boost.position.z = (Math.random() * this.roadLength) - (this.roadLength * 0.4);
        } else {
            // Spawn much further ahead to make collecting rare
            // Was roadLength * 0.8 + 100 which is ~260-360
            // New: roadLength * 2 + random 300 = ~600-900. 
            // This creates a large gap between boosts.
            boost.position.z = this.roadLength * 2 + Math.random() * 300;
        }
        boost.visible = true;
    }

    update(deltaTime, scrollSpeed, enemySpeed, input, scoreCallback, gameOverCallback, boostCallback) {
        const dist = scrollSpeed; // distance to move scenery

        // Update Snow
        if (this.currentMapType === 'snow') {
            this.updateSnow(deltaTime);
        } else if (this.currentMapType === 'desert') {
            this.desertMap.update(deltaTime);
        }

        // Move Scenery
        this.moveCollection(this.roadLines, dist, 8);
        this.moveCollection(this.pedestrians, dist, 0);
        this.moveCollection(this.skylineBillboards, dist, 0);
        this.moveCollection(this.footpaths, dist, 0);

        // Update Pedestrians
        const timeScale = deltaTime / 0.016;
        this.pedestrians.forEach(p => {
            p.position.z += (p.userData.dir * p.userData.speed) * timeScale;
        });
        this.moveCollection(this.buildings, dist, this.buildingSpacing * 2);
        // this.moveCollection(this.points, dist, 50); // Points handled separately

        // Move & Rotate Points (Spinning Coins)
        this.points.forEach(p => {
            // Always move points, even if collected (invisible), so they can be recycled
            p.position.z -= dist;
            if (p.visible) p.rotation.z += 0.1 * timeScale; // Rotate cylinder on its vertical axis

            if (p.position.z < -this.sceneryRecycleDistance) {
                this.resetPoint(p);
            }
        });

        // Move & Rotate Boosts
        this.boosts.forEach(b => {
            // Always move boosts, even if collected (invisible)
            b.position.z -= dist;
            if (b.visible) {
                b.rotation.y += 0.1 * timeScale;
                b.rotation.x += 0.05 * timeScale;
            }

            if (b.position.z < -this.sceneryRecycleDistance) {
                this.resetBoost(b);
            }
        });

        // Move Enemies
        this.enemyCars.forEach(enemy => {
            enemy.position.z -= (dist + enemySpeed); // Enemy speed + scroll
            if (enemy.position.z < -this.sceneryRecycleDistance) {
                // Respawn
                const lanes = [-3, 0, 3];
                enemy.position.x = lanes[Math.floor(Math.random() * lanes.length)];
                enemy.position.z = this.roadLength * 0.7 + Math.random() * 50;

                // Distinct Color again!
                const freshColor = this.getDistinctColor();
                enemy.traverse((node) => {
                    if (node.isMesh) {
                        const newMat = node.material.clone();
                        // Same heuristic
                        const isBody = (node.name.toLowerCase().includes('body') ||
                            (newMat.metalness > 0.4 && newMat.roughness < 0.6));
                        if (isBody) {
                            newMat.color.set(freshColor);
                        }
                        node.material = newMat;
                    }
                });
            }
        });

        // Player Movement
        if (this.carModel) {
            // Scale movement by delta time (normalized to 60fps)
            const timeScale = deltaTime / 0.016;
            const moveSpeed = 0.15 * timeScale;
            let limit = this.roadWidth / 2 - 1;

            // Stricter limit for Desert map to prevent visual clipping with sand
            if (this.currentMapType === 'desert') {
                limit = this.roadWidth / 2 - 1.5;
            }
            // +X is Left, -X is Right (per user fix)
            if (input.moveLeft && this.carModel.position.x < limit) this.carModel.position.x += moveSpeed;
            if (input.moveRight && this.carModel.position.x > -limit) this.carModel.position.x -= moveSpeed;

            // Skid Effect: Rotate car slightly based on lateral position relative to limit
            // Normalized position (-1 to 1)
            const lateralPos = this.carModel.position.x / limit;
            const skidThreshold = 0.8;

            if (Math.abs(lateralPos) > skidThreshold) {
                // Skidding!
                const skidAmount = (Math.abs(lateralPos) - skidThreshold) * 2.0; // 0 to ~0.4
                // Rotate opposite to movement direction or just amplify the turn?
                // Visual skidding usually means the car is angled slightly differently than its velocity.
                // Here we just rotate it to loop 'loose'.
                // If on left edge (limit), car x is positive. Rotate slightly.
                const skidAngle = -lateralPos * 0.3 * skidAmount;
                this.carModel.rotation.y = Math.PI + skidAngle;

                // Maybe add some dust? (handled in update loop if we want, or just stick to visual rotation for now)
            } else {
                // Return to normal
                this.carModel.rotation.y = THREE.MathUtils.lerp(this.carModel.rotation.y, Math.PI, 0.1);
            }

            this.playerBox.setFromObject(this.carModel);
        }

        // Collisions
        this.checkCollisions(scoreCallback, gameOverCallback, boostCallback);
    }

    moveCollection(items, dist, respawnGap) {
        items.forEach(item => {
            item.position.z -= dist;
            // Total range is from -150 to 450 (600 units)
            if (item.position.z < -150) {
                item.position.z += 600;
            }
        });
    }

    updateSnow(deltaTime) {
        if (!this.snowSystem) return;

        const positions = this.snowSystem.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
            // Y position
            positions[i] -= deltaTime * 10; // Fall speed
            if (positions[i] < 0) {
                positions[i] = 100; // Reset to top
            }
        }
        this.snowSystem.geometry.attributes.position.needsUpdate = true;
    }


    setNightFactor(factor) {
        let headlightIntensity = factor * 12; // Brighter headlights
        let windowIntensity = 0.2 + factor * 2.5;

        // Force headlights on for cybercity map (always dark)
        if (this.currentMapType === 'cybercity') {
            headlightIntensity = 15; // Max brightness
            windowIntensity = 3.0;
        }

        // Player Headlights
        if (this.carModel && this.carModel.userData.headlights) {
            this.carModel.userData.headlights.forEach(hl => {
                hl.intensity = headlightIntensity;
                // No bulb mesh to update
            });
        }

        // Enemy Headlights
        this.enemyCars.forEach(car => {
            if (car.userData.headlights) {
                car.userData.headlights.forEach(hl => hl.intensity = headlightIntensity);
            }
        });

        // Building Windows
        this.buildings.forEach(b => {
            b.traverse(node => {
                if (node.isMesh && node.material.emissive) {
                    node.material.emissiveIntensity = windowIntensity;
                }
            });
        });
    }

    checkCollisions(scoreCallback, gameOverCallback, boostCallback) {
        if (!this.carModel) return;

        // Points
        this.points.forEach(p => {
            if (!p.visible) return;
            this.pointBox.setFromObject(p);
            if (this.playerBox.intersectsBox(this.pointBox)) {
                p.visible = false;
                scoreCallback(1);
            }
        });

        // Boosts
        this.boosts.forEach(b => {
            if (!b.visible) return;
            this.boostBox.setFromObject(b);
            if (this.playerBox.intersectsBox(this.boostBox)) {
                b.visible = false; // Consume boost
                if (boostCallback) boostCallback();
            }
        });

        // Enemies
        this.enemyCars.forEach(e => {
            this.enemyBox.setFromObject(e);
            const pBox = this.playerBox.clone().expandByScalar(-0.2); // Be slightly forgiving
            if (pBox.intersectsBox(this.enemyBox)) {
                gameOverCallback();
            }
        });
    }

    reset() {
        this.carModel.position.set(0, this.carBaseY, 0);
        this.points.forEach(p => this.resetPoint(p, true));

        // Reset Enemies
        this.enemyCars.forEach(e => {
            const lanes = [-3, 0, 3];
            e.position.x = lanes[Math.floor(Math.random() * lanes.length)];
            e.position.z = this.roadLength * 0.7;
        });
    }
}
