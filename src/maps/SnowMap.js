import * as THREE from 'three';

export class SnowMap {
    constructor(scene, roadWidth, roadLength) {
        this.scene = scene;
        this.roadWidth = roadWidth;
        this.roadLength = roadLength;
        this.buildingSpacing = 25;
    }

    createLevel(context) {
        // --- Snow Ground ---
        // Off-white snow ground to reduce glare (was 0xffffff)
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0xe5e5e5,
            roughness: 1.0,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1600), groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        context.groundMesh = ground;
        this.scene.add(ground);

        // --- Icy Road ---
        // Slightly bluish grey for cold feel
        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x444444, // Medium Grey
            roughness: 0.9,
            metalness: 0.0
        });
        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(this.roadWidth, this.roadLength * 1.5),
            roadMat
        );
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        context.roadMesh = road;
        this.scene.add(road);

        // --- Road Lines ---
        const lineGeo = new THREE.PlaneGeometry(0.3, 4);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const lineSpacing = 12;
        for (let z = -150; z < 450; z += lineSpacing) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.005, z);
            line.receiveShadow = true;
            context.roadLines.push(line);
            this.scene.add(line);
        }

        // --- Snow Covered Footpaths ---
        const footGeo = new THREE.PlaneGeometry(5, 50);
        const footMat = new THREE.MeshStandardMaterial({
            color: 0xdcdcdc, // Darker snow for path distinction
            roughness: 0.9
        });
        for (let z = -150; z < 450; z += 50) {
            for (let side = -1; side <= 1; side += 2) {
                const foot = new THREE.Mesh(footGeo, footMat);
                foot.rotation.x = -Math.PI / 2;
                foot.position.set(side * (this.roadWidth / 2 + 2.5), 0.02, z);
                foot.receiveShadow = true;
                context.footpaths.push(foot);
                this.scene.add(foot);
            }
        }

        // --- Snow Particles (Snowfall) ---
        const particleCount = 6000; // Increased significantly
        const particlesGeo = new THREE.BufferGeometry();
        const positions = [];

        for (let i = 0; i < particleCount; i++) {
            // Random positions in a large box around the player/road
            const x = (Math.random() - 0.5) * 400;
            const y = Math.random() * 100; // Height
            const z = (Math.random() - 0.5) * 600 + 150; // Spread along road
            positions.push(x, y, z);
        }

        particlesGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        // Create a simple circular snowflake texture
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(16, 16, 10, 0, Math.PI * 2);
        ctx.fill();

        const snowTex = new THREE.CanvasTexture(canvas);
        const snowMat = new THREE.PointsMaterial({
            color: 0xffffff, size: 0.5, map: snowTex,
            transparent: true, opacity: 0.8, depthWrite: false
        });

        const snowSystem = new THREE.Points(particlesGeo, snowMat);
        context.snowSystem = snowSystem;
        this.scene.add(snowSystem);


        // --- Skyline Billboards (Setup but maybe obscured by fog/snow) ---
        context.skylineBillboards = []; // Reset billboards
        for (let i = 0; i < 60; i++) {
            context.spawnSkylineBillboard((i / 60) * 1200 - 600);
        }

        // --- Scenery Population ---
        // Override the spawn hook to use snow-specific logic
        context.spawnBuildingPairAt = (zPos) => {
            this.spawnSnowySceneryAt(zPos, context);
        };

        // Initial population
        const startZ = -150;
        const endZ = this.roadLength;
        const spacing = 20; // Reduced spacing for tighter density

        for (let z = startZ; z < endZ; z += spacing) {
            this.spawnSnowySceneryAt(z, context);
        }
    }

    spawnSnowySceneryAt(zPos, entityManager) {
        // "keep the same contunes houses like we have"
        // Reduce gap significantly by forcing spawn

        const rand = Math.random();

        if (rand < 0.10) {
            // Big Building (Rare - 10%)
            this.spawnBigBuildingPair(zPos, entityManager);
        } else {
            // Small Proper House (Very Common - 90% chance roughly)
            // We want to fill the gap so we almost always spawn a house or trees

            // 85% chance of house, 15% chance of trees
            if (Math.random() < 0.85) {
                this.spawnSmallHousePair(zPos, entityManager);
            } else {
                entityManager.spawnTreePairAt(zPos);
            }
        }

        // 2. Snowmen ("man in snop maps in between")
        // Scatter them randomly near the road/footpath
        if (Math.random() > 0.4) {
            this.spawnSnowman(zPos, entityManager);
        }

        // 3. Backdrop
        entityManager.spawnBackdropBuilding(zPos);
    }

    spawnBigBuildingPair(zPos, entityManager) {
        // Keep existing logic for big buildings
        const bL = entityManager.createBuildingMesh(true);
        const xL = -(this.roadWidth / 2 + 25 + Math.random() * 10);
        bL.position.set(xL, bL.userData.height / 2, zPos);
        entityManager.buildings.push(bL);
        this.scene.add(bL);

        const bR = entityManager.createBuildingMesh(true);
        const xR = (this.roadWidth / 2 + 25 + Math.random() * 10);
        bR.position.set(xR, bR.userData.height / 2, zPos);
        entityManager.buildings.push(bR);
        this.scene.add(bR);
    }

    spawnSmallHousePair(zPos, entityManager) {
        // Left House
        if (Math.random() > 0.2) {
            const hL = this.createSmallHouseMesh();
            const houseDepth = hL.userData.depth || 10;

            // Setback from ROAD EDGE
            // Footpath is 5 wide. So min setback should be > 5.
            const setback = 10 + Math.random() * 8;
            const roadEdgeX = -(this.roadWidth / 2);
            const xL = roadEdgeX - setback;

            hL.position.set(xL, 0, zPos);
            hL.rotation.y = Math.PI / 2; // Door faces Road (+X)

            // Driveway Logic
            // Start: Road Edge (roadEdgeX)
            // End: House Door (xL + houseDepth/2)
            // Start is closer to 0 (e.g. -5). End is further (e.g. -15).
            // Length = |roadEdgeX - (xL + houseDepth/2)|

            const doorWorldX = xL + houseDepth / 2;
            // Overlap road slightly (+1) and go under door slightly (-0.5)
            // But wait, doorWorldX is the face. We want to go UP TO the face.
            const startX = roadEdgeX; // Start exactly at road edge
            const endX = doorWorldX - 1.0; // Stop just before door, or under porch

            const driveLen = Math.abs(startX - endX);
            const driveCenter = (startX + endX) / 2;

            const driveGeo = new THREE.PlaneGeometry(driveLen, 3.5);
            const driveMat = new THREE.MeshStandardMaterial({
                color: 0x444444, // Darker asphalt
                roughness: 1.0
            });
            const way = new THREE.Mesh(driveGeo, driveMat);
            way.rotation.x = -Math.PI / 2;
            way.position.set(driveCenter, 0.04, zPos); // Slightly higher than footpath (0.02)

            this.scene.add(way);
            entityManager.footpaths.push(way);
            entityManager.buildings.push(hL);
            this.scene.add(hL);
        }

        // Right House
        if (Math.random() > 0.2) {
            const hR = this.createSmallHouseMesh();
            const houseDepth = hR.userData.depth || 10;

            const setback = 10 + Math.random() * 8;
            const roadEdgeX = (this.roadWidth / 2);
            const xR = roadEdgeX + setback;

            hR.position.set(xR, 0, zPos);
            hR.rotation.y = -Math.PI / 2; // Door faces Road (-X)

            // Driveway Logic
            // Start: Road Edge. End: House Door (xR - houseDepth/2)
            const doorWorldX = xR - houseDepth / 2;
            const startX = roadEdgeX; // Start exactly at road edge
            const endX = doorWorldX + 1.0;

            const driveLen = Math.abs(endX - startX);
            const driveCenter = (startX + endX) / 2;

            const driveGeo = new THREE.PlaneGeometry(driveLen, 3.5);
            const driveMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1.0 });
            const way = new THREE.Mesh(driveGeo, driveMat);
            way.rotation.x = -Math.PI / 2;
            way.position.set(driveCenter, 0.04, zPos);

            this.scene.add(way);
            entityManager.footpaths.push(way);
            entityManager.buildings.push(hR);
            this.scene.add(hR);
        }
    }

    spawnSnowman(zPos, entityManager) {
        const side = Math.random() > 0.5 ? 1 : -1;
        // Position on the footpath or slightly off it
        // Road(10)/2 = 5. Footpath is at ~7.5.
        const dist = 6 + Math.random() * 4;
        const x = side * dist;

        const snowman = this.createSnowmanMesh();
        snowman.position.set(x, 0, zPos + (Math.random() - 0.5) * 5);
        // Face somewhat towards road or random
        snowman.lookAt(0, 0, zPos);

        entityManager.buildings.push(snowman); // Treat as scenery (building list handles z-move)
        this.scene.add(snowman);
    }

    createSnowmanMesh() {
        const group = new THREE.Group();
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });

        // Base
        const bot = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), snowMat);
        bot.position.y = 0.5;
        bot.castShadow = true;
        group.add(bot);

        // Middle
        const mid = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), snowMat);
        mid.position.y = 1.3;
        mid.castShadow = true;
        group.add(mid);

        // Head
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), snowMat);
        top.position.y = 1.9;
        top.castShadow = true;
        group.add(top);

        // Nose (Carrot)
        const noseGeo = new THREE.ConeGeometry(0.05, 0.3, 8);
        noseGeo.rotateX(Math.PI / 2); // Point out
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xffa500 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 1.9, 0.3);
        group.add(nose);

        // Eyes (Coal)
        const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 1.95, 0.25);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 1.95, 0.25);
        group.add(leftEye);
        group.add(rightEye);

        // Arms (Twigs) - Simple lines or cylinders
        const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8);
        armGeo.rotateZ(Math.PI / 2);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const arms = new THREE.Mesh(armGeo, armMat);
        arms.position.set(0, 1.35, 0);
        group.add(arms);

        // Hat (Top hat)
        const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        hatBrim.position.y = 2.15;
        group.add(hatBrim);
        const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        hatTop.position.y = 2.35;
        group.add(hatTop);

        return group;
    }

    createSmallHouseMesh() {
        // "Proper House" / "Mansion-like" - Larger, 2-story, detailed
        const group = new THREE.Group();

        const width = 10 + Math.random() * 4;
        const depth = 8 + Math.random() * 4;
        const height = 7 + Math.random() * 3;

        group.userData.depth = depth; // Store for positioning

        // Walls
        const wallColors = [
            0xf5f5dc, // Beige
            0xadd8e6, // Light Blue
            0x98fb98, // Pale Green
            0xffdab9, // Peach Puff
            0xe6e6fa, // Lavender
            0xffffe0, // Light Yellow
            0xb0e0e6  // Powder Blue
        ];
        const wallColor = wallColors[Math.floor(Math.random() * wallColors.length)];
        const wallsMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });

        const walls = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallsMat);
        walls.position.y = height / 2;
        walls.castShadow = true;
        walls.receiveShadow = true;
        group.add(walls);

        // Roof 
        const roofHeight = 4;
        const roofGeo = new THREE.ConeGeometry(Math.max(width, depth) * 0.8, roofHeight, 4);
        const roofColor = 0x2f3542; // Dark slate
        const roofMat = new THREE.MeshStandardMaterial({ color: roofColor });
        const roof = new THREE.Mesh(roofGeo, roofMat);

        roof.position.y = height + roofHeight / 2;
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(1.2, 1, 1.2);
        group.add(roof);

        // Snow on roof
        const snowCapGeo = new THREE.ConeGeometry(Math.max(width, depth) * 0.8, roofHeight * 0.85, 4);
        const snowCap = new THREE.Mesh(snowCapGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
        snowCap.position.y = height + roofHeight / 2 + 0.2;
        snowCap.rotation.y = Math.PI / 4;
        snowCap.scale.set(1.15, 1, 1.15);
        group.add(snowCap);

        // Door Frame
        const frameGeo = new THREE.BoxGeometry(2.6, 4.4, 0.4);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(0, 2.2, depth / 2); // Center Z=0, extends to +/- 0.2. Front face +0.2 relative to pos.
        // Wall front face is depth/2. Frame pos depth/2. Frame Front is depth/2 + 0.2.
        group.add(frame);

        // Door
        const doorGeo = new THREE.PlaneGeometry(2.0, 4.0);
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        // Door Plane Z: Needs to be in front of Frame back but behind Frame Front?
        // Frame Front is depth/2 + 0.2.
        // Let's put door at depth/2 + 0.21 (Just in front of frame to avoid z-fight with frame internals)
        // OR slightly recessed? Recessed is better. Frame extends 0.2 out.
        // Let's put Door at depth/2 + 0.1. (Inside frame).

        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 2.0, depth / 2 + 0.21); // Keep sticking out slightly to be safe for now
        group.add(door);

        // Windows
        const winMat = new THREE.MeshStandardMaterial({
            color: 0x87ceeb,
            emissive: 0x111122,
            roughness: 0.2,
            metalness: 0.8
        });
        const winGeo = new THREE.PlaneGeometry(1.8, 1.8);
        const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

        const levels = [2.5, 5.5];
        const sideOffset = width / 4;

        levels.forEach(yLevel => {
            if (yLevel < height - 1) {
                // Frame - Box(..., 0.2) -> extends +/- 0.1 from position.
                // Position at depth/2. Front face at depth/2 + 0.1.
                // Window Plane - Previously depth/2 + 0.1 (Flush fighting).
                // New Pose: depth/2 + 0.11 (Slightly IN FRONT of frame?) No, recessed.
                // Let's put Frame at depth/2 + 0.1 (So extends 0 to 0.2 relative to wall).
                // Put Window at depth/2 + 0.11.

                // Let's adjust frame pos to depth/2. Front is depth/2 + 0.1.
                // Put Window at depth/2 + 0.11 (Slightly in front of frame face? No that protrudes).
                // Put Window at depth/2 + 0.05 (Inside frame).

                // Left Window
                const w1 = new THREE.Mesh(winGeo, winMat);
                w1.position.set(-sideOffset, yLevel, depth / 2 + 0.05); // Recessed inside frame

                const f1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.2), trimMat);
                f1.position.set(-sideOffset, yLevel, depth / 2);
                group.add(f1);
                group.add(w1);

                // Right Window
                const w2 = new THREE.Mesh(winGeo, winMat);
                w2.position.set(sideOffset, yLevel, depth / 2 + 0.05);

                const f2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.2), trimMat);
                f2.position.set(sideOffset, yLevel, depth / 2);
                group.add(f2);
                group.add(w2);
            }
        });

        // Center Window
        if (height > 6) {
            const wTop = new THREE.Mesh(winGeo, winMat);
            wTop.position.set(0, 6.0, depth / 2 + 0.05);
            const fTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.2), trimMat);
            fTop.position.set(0, 6.0, depth / 2);
            group.add(fTop);
            group.add(wTop);
        }

        // Chimney
        const chimGeo = new THREE.BoxGeometry(1.2, 3, 1.2);
        const chim = new THREE.Mesh(chimGeo, new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
        chim.position.set(width / 3, height + 2, depth / 4);
        group.add(chim);

        // Optional: Garage
        if (Math.random() > 0.5) {
            const extW = 5;
            const extH = 4;
            const extD = depth;
            const ext = new THREE.Mesh(new THREE.BoxGeometry(extW, extH, extD), wallsMat);
            ext.position.set(width / 2 + extW / 2, extH / 2, 0);
            group.add(ext);

            // Garage Door
            const garMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const garage = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3), garMat);
            garage.position.set(width / 2 + extW / 2, 1.5, depth / 2 + 0.05);
            group.add(garage);

            // Small Roof
            const extRoof = new THREE.Mesh(new THREE.BoxGeometry(extW + 0.5, 0.5, extD + 0.5), roofMat);
            extRoof.position.set(width / 2 + extW / 2, extH, 0);
            group.add(extRoof);
        }

        return group;
    }
}
