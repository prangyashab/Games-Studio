import * as THREE from 'three';

export class DesertMap {
    constructor(scene, roadWidth, roadLength) {
        this.scene = scene;
        this.roadWidth = roadWidth;
        this.roadLength = roadLength;
    }

    createLevel(entityManager) {
        this.createGround(entityManager);
        this.createRoad(entityManager);

        // Initial scenery population
        for (let z = -200; z < this.roadLength; z += 30) {
            this.spawnSceneryAt(z, entityManager);
        }

        // Ensure entityManager has the correct spawn function hook
        entityManager.spawnBuildingPairAt = (zPos) => {
            this.spawnSceneryAt(zPos, entityManager);
        };

        // Initialize Sandstorm System
        this.sandstormSystem = this.createSandstormSystem();
        this.scene.add(this.sandstormSystem);
        entityManager.snowSystem = this.sandstormSystem; // Cleanup tracking
        this.sandstormTimer = 0;
        this.isSandstormActive = false;
    }

    createGround(entityManager) {
        // Desert sand color with some variation
        // Increase resolution to prevent interpolation clipping near road
        const groundGeo = new THREE.PlaneGeometry(2000, 2000, 128, 128);

        // Add some noise to vertices for dunes
        const posAttribute = groundGeo.attributes.position;
        // Increase safe zone significantly to prevent any visual encroachment on road
        const safeZone = this.roadWidth + 30; // Was +15, now +30

        for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i);
            // Skip road area (middle)
            if (Math.abs(x) > safeZone) {
                // Gentle dunes
                posAttribute.setZ(i, Math.sin(x * 0.05) * 3 + Math.cos(y * 0.05) * 3);
            } else {
                // Flatten and lower ground near road to ensure road sits on top
                posAttribute.setZ(i, -1.5); // Deeply lower to -1.5 to prevent ANY clipping
            }
        }
        groundGeo.computeVertexNormals();

        const groundMat = new THREE.MeshStandardMaterial({
            color: 0xe6c288, // Sand color
            roughness: 1.0,
            metalness: 0
        });

        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);
        entityManager.groundMesh = ground;
    }

    // ... in createRoad ...
    createSandstormSystem() {
        const particleCount = 1500;
        const geo = new THREE.BufferGeometry();
        const positions = [];

        for (let i = 0; i < particleCount; i++) {
            positions.push(
                (Math.random() - 0.5) * 400, // Wide X spread
                Math.random() * 20,          // Low to ground
                (Math.random() - 0.5) * 400  // Deep Z spread
            );
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xe6c288,
            size: 0.8,
            transparent: true,
            opacity: 0, // Start invisible
            fog: true
        });

        return new THREE.Points(geo, mat);
    }

    update(deltaTime) {
        if (!this.sandstormSystem) return;

        // Sandstorm Logic
        this.sandstormTimer += deltaTime;
        const cycleDuration = 20;

        // 0-15s CLEAR, 15-20s STORM.
        const cycleTime = this.sandstormTimer % 20;
        let targetOpacity = 0;

        if (cycleTime > 15 && cycleTime < 20) {
            targetOpacity = 0.6;
        } else {
            targetOpacity = 0;
        }

        // Lerp opacity
        this.sandstormSystem.material.opacity += (targetOpacity - this.sandstormSystem.material.opacity) * deltaTime * 2;

        // Animate particles
        const positions = this.sandstormSystem.geometry.attributes.position.array;
        const speed = (cycleTime > 15 && cycleTime < 20) ? 60 : 10;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += deltaTime * speed;
            if (positions[i] > 200) positions[i] = -200;
        }
        this.sandstormSystem.geometry.attributes.position.needsUpdate = true;
    }

    createRoad(entityManager) {
        // Worn desert highway
        const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.roadLength);
        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x6a6a6a, // Faded asphalt
            roughness: 0.9,
            metalness: 0.1
        });

        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.05; // Raise road slightly
        road.receiveShadow = true;
        this.scene.add(road);
        entityManager.roadMesh = road;

        // Faded road lines
        for (let i = 0; i < 30; i++) {
            const lineGeo = new THREE.PlaneGeometry(0.3, 4); // Shorter dashed lines
            const lineMat = new THREE.MeshBasicMaterial({ color: 0xdddddd }); // Faded white
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.08, i * 20 - 100); // Raise lines above road
            this.scene.add(line);
            entityManager.roadLines.push(line);
        }
    }

    spawnSceneryAt(zPos, entityManager) {
        // Desert has sparse vegetation and occasional structures

        // 1. Cacti / Desert Plants (Common)
        if (Math.random() > 0.4) {
            this.spawnCactus(zPos, entityManager);
        }

        // 2. Rocks (Common)
        if (Math.random() > 0.5) {
            this.spawnRock(zPos, entityManager);
        }

        // 3. Village Houses (Rare)
        if (Math.random() > 0.85) {
            this.spawnVillageHouse(zPos, entityManager);
        }

        // 4. "Camels" (Procedural Low Poly Animals) (Very Rare)
        if (Math.random() > 0.92) {
            this.spawnCamel(zPos, entityManager);
        }

        // 5. Dry Bushes (Very Common)
        if (Math.random() > 0.2) {
            this.spawnDryBush(zPos, entityManager);
        }
    }

    spawnCactus(zPos, entityManager) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = this.roadWidth / 2 + 5 + Math.random() * 40;
        const x = side * dist;

        const cactus = this.createCactusMesh();
        cactus.position.set(x, 0, zPos);
        // Random rotation and slight scale var
        cactus.rotation.y = Math.random() * Math.PI * 2;
        const s = 0.8 + Math.random() * 0.6;
        cactus.scale.set(s, s, s);

        entityManager.buildings.push(cactus);
        this.scene.add(cactus);
    }

    spawnDryBush(zPos, entityManager) {
        const side = Math.random() > 0.5 ? 1 : -1;
        // Closer to road
        const dist = this.roadWidth / 2 + 2 + Math.random() * 15;
        const x = side * dist;

        const bush = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown for dry twigs

        // A few intersecting spheres/boxes to look like tumbleweed
        for (let i = 0; i < 3; i++) {
            const geo = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.2, 0);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5);
            bush.add(mesh);
        }

        bush.position.set(x, 0.3, zPos);
        bush.rotation.set(Math.random(), Math.random(), Math.random());

        entityManager.buildings.push(bush);
        this.scene.add(bush);
    }

    spawnRock(zPos, entityManager) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = this.roadWidth / 2 + 8 + Math.random() * 50;
        const x = side * dist;

        const rockGeo = new THREE.DodecahedronGeometry(1 + Math.random(), 0);
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0xA0522D, // Sienna
            roughness: 0.9,
            metalness: 0
        });
        const rock = new THREE.Mesh(rockGeo, rockMat);

        rock.position.set(x, 0.5, zPos);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        const s = 1 + Math.random();
        rock.scale.set(s, s * 0.6, s); // Flattened rock

        entityManager.buildings.push(rock);
        this.scene.add(rock);
    }

    spawnVillageHouse(zPos, entityManager) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = this.roadWidth / 2 + 20 + Math.random() * 20;
        const x = side * dist;

        const house = this.createVillageHouseMesh();
        house.position.set(x, 0, zPos);
        // Face generally towards the road but with some variation
        const rot = (side === 1) ? -Math.PI / 2 : Math.PI / 2;
        house.rotation.y = rot + (Math.random() - 0.5) * 0.5;

        entityManager.buildings.push(house);
        this.scene.add(house);
    }

    spawnCamel(zPos, entityManager) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = this.roadWidth / 2 + 15 + Math.random() * 30;
        const x = side * dist;

        const camel = this.createCamelMesh();
        camel.position.set(x, 0, zPos);
        // Standing parallel to road or random
        camel.rotation.y = Math.random() * Math.PI * 2;

        entityManager.buildings.push(camel);
        this.scene.add(camel);
    }

    createCactusMesh() {
        const group = new THREE.Group();
        const green = 0x2e8b57; // SeaGreen
        const mat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.8 });

        // Main trunk (Safe geometry)
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 16);
        const trunk = new THREE.Mesh(trunkGeo, mat);
        trunk.position.y = 1;
        trunk.castShadow = true;
        group.add(trunk);

        // Arms (0 to 2 arms)
        const numArms = Math.floor(Math.random() * 3);
        const positions = [0.5, 1.2]; // Possible heights

        for (let i = 0; i < numArms; i++) {
            const armGroup = new THREE.Group();
            // Arm Horizontal
            const armH = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8), mat);
            armH.rotation.z = Math.PI / 2;
            armH.position.x = 0.3;

            // Arm Vertical
            const armV = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8), mat);
            armV.position.set(0.6, 0.3, 0);

            armGroup.add(armH);
            armGroup.add(armV);

            // Position on trunk
            armGroup.position.y = positions[i % 2];
            // Random side (left or right)
            if (Math.random() > 0.5) {
                armGroup.rotation.y = Math.PI;
            } else {
                armGroup.rotation.y = 0;
            }
            // Add some random rotation around Y to make it 3D
            armGroup.rotation.y += (Math.random() - 0.5);

            group.add(armGroup);
        }

        return group;
    }

    createVillageHouseMesh() {
        // Simple adobe/mud house style
        const group = new THREE.Group();

        const w = 6 + Math.random() * 3;
        const h = 4 + Math.random() * 2;
        const d = 5 + Math.random() * 3;

        const wallColor = 0xd2b48c; // Tan/Sand
        const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });

        const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        house.position.y = h / 2;
        house.castShadow = true;
        house.receiveShadow = true;
        group.add(house);

        // Door
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2a }); // Dark wood
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), doorMat);
        door.position.set(0, 1.1, d / 2 + 0.02);
        group.add(door);

        // Few small windows
        const winGeo = new THREE.PlaneGeometry(0.8, 0.8);
        const winMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Dark interior

        const w1 = new THREE.Mesh(winGeo, winMat);
        w1.position.set(-w / 3.5, h / 1.8, d / 2 + 0.02);
        group.add(w1);

        const w2 = new THREE.Mesh(winGeo, winMat);
        w2.position.set(w / 3.5, h / 1.8, d / 2 + 0.02);
        group.add(w2);

        // Wooden beams protruding (typical adobe style)
        const beamGeo = new THREE.CylinderGeometry(0.1, 0.1, d + 0.4, 6);
        beamGeo.rotateX(Math.PI / 2);
        const beamMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });

        for (let i = 0; i < 3; i++) {
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.set(-w / 2 + (i + 1) * (w / 4), h - 0.5, 0);
            group.add(beam);
        }

        return group;
    }

    createCamelMesh() {
        // Extremely simplified low-poly camel
        const group = new THREE.Group();
        const color = 0xC19A6B; // Camel color
        const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 1.0 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 2.0), mat);
        body.position.y = 1.2;
        body.castShadow = true;
        group.add(body);

        // Hump
        const hump = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), mat);
        hump.position.set(0, 1.9, 0);
        hump.castShadow = true;
        group.add(hump);

        // Neck
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), mat);
        neck.position.set(0, 2.0, 1.2);
        neck.rotation.x = Math.PI / 8;
        neck.castShadow = true;
        group.add(neck);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), mat);
        head.position.set(0, 2.6, 1.5);
        head.castShadow = true;
        group.add(head);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 1.2, 0.25);
        const legPos = [
            [-0.4, 0.6, 0.8], [0.4, 0.6, 0.8], // Front
            [-0.4, 0.6, -0.8], [0.4, 0.6, -0.8] // Back
        ];

        legPos.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(...pos);
            leg.castShadow = true;
            group.add(leg);
        });

        return group;
    }
}
