
import * as THREE from 'three';

export class CyberCityMap {
    constructor(scene, roadWidth, roadLength) {
        this.scene = scene;
        this.roadWidth = roadWidth;
        this.roadLength = roadLength;
        this.buildingSpacing = 30; // Dense city
    }

    createLevel(context) {
        // --- Wet Asphalt Road ---
        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x222222, // Slightly darker
            roughness: 0.9, // Rougher surface for better headlight visibility (diffuse)
            metalness: 0.1, // Less metallic to prevent light scattering
            emissive: 0x000000, // No glow on road itself to contrast lights
            emissiveIntensity: 0
        });
        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(this.roadWidth, this.roadLength * 1.5),
            roadMat
        );
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        context.roadMesh = road;
        this.scene.add(road);

        // --- Neon Grid Ground ---
        // Create an infinite-looking grid below the city
        const gridHelper = new THREE.GridHelper(2000, 100, 0xff00ff, 0x00ffff);
        gridHelper.position.y = -0.1;
        this.scene.add(gridHelper);
        context.groundMesh = gridHelper; // Track for cleanup

        // Dark plane under grid to block void
        const groundMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.2;
        this.scene.add(ground);
        if (context.extras) context.extras.push(ground);


        // --- Neon Sidewalks ---
        const sidwalkWidth = 4;
        const sidewalkGeo = new THREE.PlaneGeometry(sidwalkWidth, this.roadLength * 1.5);
        const sidewalkMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.2,
            metalness: 0.5
        });


        // Emissive edges for sidewalks - EXTENDED LENGTH
        const extendedLength = this.roadLength * 10; // Much longer for continuous effect
        const edgeGeo = new THREE.PlaneGeometry(0.5, extendedLength);
        const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Cyan strips

        // Left Sidewalk
        const swL = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        swL.rotation.x = -Math.PI / 2;
        swL.position.set(-(this.roadWidth / 2 + sidwalkWidth / 2), 0.02, 0);
        swL.receiveShadow = true;
        this.scene.add(swL);
        context.footpaths.push(swL);

        const edgeL = new THREE.Mesh(edgeGeo, edgeMat);
        edgeL.rotation.x = -Math.PI / 2;
        edgeL.position.set(-(this.roadWidth / 2), 0.03, 0); // Inner edge
        this.scene.add(edgeL);
        if (!context.roadLines) context.roadLines = [];
        context.roadLines.push(edgeL);

        // Right Sidewalk
        const swR = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        swR.rotation.x = -Math.PI / 2;
        swR.position.set((this.roadWidth / 2 + sidwalkWidth / 2), 0.02, 0);
        swR.receiveShadow = true;
        this.scene.add(swR);
        context.footpaths.push(swR);

        const edgeR = new THREE.Mesh(edgeGeo, edgeMat);
        edgeR.rotation.x = -Math.PI / 2;
        edgeR.position.set((this.roadWidth / 2), 0.03, 0);
        this.scene.add(edgeR);
        context.roadLines.push(edgeR);

        // --- CENTER DASHED LINE ---
        const dashLength = 8;
        const gapLength = 4;
        const dashWidth = 0.3;
        const dashMat = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow center line

        for (let z = -extendedLength / 2; z < extendedLength / 2; z += (dashLength + gapLength)) {
            const dashGeo = new THREE.PlaneGeometry(dashWidth, dashLength);
            const dash = new THREE.Mesh(dashGeo, dashMat);
            dash.rotation.x = -Math.PI / 2;
            dash.position.set(0, 0.04, z); // Center of road
            this.scene.add(dash);
            context.roadLines.push(dash);
        }



        // --- Digital Rain / Particles ---
        this.createDigitalRain(context);

        // --- Populate Buildings ---
        // Override spawnBuildingPairAt
        context.spawnBuildingPairAt = (zPos) => {
            this.spawnCyberSceneryAt(zPos, context);
        };

        // Initial population
        const startZ = -150;
        const endZ = this.roadLength;
        for (let z = startZ; z < endZ; z += this.buildingSpacing) {
            this.spawnCyberSceneryAt(z, context);
        }

        // --- AUTO-ENABLE HEADLIGHTS FOR CYBER PUNK ---
        // Turn on player car headlights
        if (context.carModel && context.carModel.userData.headlights) {
            context.carModel.userData.headlights.forEach(hl => hl.intensity = 15);
        }

        // Turn on enemy car headlights
        if (context.enemyCars) {
            context.enemyCars.forEach(car => {
                if (car.userData.headlights) {
                    car.userData.headlights.forEach(hl => hl.intensity = 15);
                }
            });
        }
    }

    createDigitalRain(context) {
        const particleCount = 600; // Optimized for mobile smoothness
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        const color1 = new THREE.Color(0x00ffff);
        const color2 = new THREE.Color(0xff00ff);

        for (let i = 0; i < particleCount; i++) {
            positions.push(
                (Math.random() - 0.5) * 400, // X
                Math.random() * 150, // Y
                (Math.random() - 0.5) * 600 + 100 // Z
            );

            // Random mix of Cyan/Purple
            const col = Math.random() > 0.5 ? color1 : color2;
            colors.push(col.r, col.g, col.b);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Use a streak texture or simple line points
        const material = new THREE.PointsMaterial({
            size: 0.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const rainSystem = new THREE.Points(geometry, material);
        this.scene.add(rainSystem);
        context.snowSystem = rainSystem; // Reuse snowSystem slot for cleanup
    }

    spawnCyberSceneryAt(zPos, entityManager) {
        // Density Check
        if (Math.random() > 0.15) { // 85% chance (Reduced from 95% for mobile)
            this.spawnCyberBuildingPair(zPos, entityManager);
        }

        // Occasional Holographic Arches or Overhead Signs
        if (Math.random() < 0.2) {
            this.spawnOverheadSign(zPos, entityManager);
        }
    }

    spawnCyberBuildingPair(zPos, entityManager) {
        // Left Building
        const xL = -(this.roadWidth / 2 + 15 + Math.random() * 10);
        const bL = this.createCyberBuilding(true);
        bL.position.set(xL, bL.userData.height / 2, zPos);
        bL.rotation.y = Math.random() < 0.5 ? 0 : Math.PI; // Variation
        this.scene.add(bL);
        entityManager.buildings.push(bL);

        // Right Building
        const xR = (this.roadWidth / 2 + 15 + Math.random() * 10);
        const bR = this.createCyberBuilding(false);
        bR.position.set(xR, bR.userData.height / 2, zPos);
        bR.rotation.y = Math.random() < 0.5 ? 0 : Math.PI;
        this.scene.add(bR);
        entityManager.buildings.push(bR);
    }

    createCyberBuilding(isLeft) {
        const group = new THREE.Group();

        const width = 15 + Math.random() * 15;
        const depth = 15 + Math.random() * 15;
        const height = 40 + Math.random() * 60; // Very tall

        group.userData = { height, width, depth };

        // Core Building
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x111111, // Dark Metal
            roughness: 0.2,
            metalness: 0.8
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // --- Neon Features ---
        const neonColors = [0x00ffff, 0xff00ff, 0x9d00ff, 0x00ff00];
        const color = neonColors[Math.floor(Math.random() * neonColors.length)];

        // 1. Vertical Neon Strips
        const stripCount = Math.floor(Math.random() * 4);
        const stripGeo = new THREE.BoxGeometry(0.5, height, 0.5);
        const stripMat = new THREE.MeshBasicMaterial({ color: color });

        for (let i = 0; i < stripCount; i++) {
            const strip = new THREE.Mesh(stripGeo, stripMat);
            // Randomly place on faces
            const side = Math.random() > 0.5 ? 1 : -1;
            strip.position.set(side * (width / 2 + 0.1), 0, (Math.random() - 0.5) * depth * 0.8);
            group.add(strip);
        }

        // 2. Glowing Window Grid (Procedural Texture)
        if (Math.random() > 0.3) {
            const winW = width * 0.8;
            const winH = height * 0.8;
            const winGeo = new THREE.PlaneGeometry(winW, winH);

            // Create a canvas texture for windows
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, size, size);

            // Draw random windows
            ctx.fillStyle = Math.random() > 0.5 ? '#ffff00' : '#ffffff'; // Yellow or White light
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 4; c++) {
                    if (Math.random() > 0.4) {
                        ctx.fillRect(c * 32 + 4, r * 16 + 4, 20, 10);
                    }
                }
            }
            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;

            const winMat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });

            // Front Face
            const winMesh = new THREE.Mesh(winGeo, winMat);
            winMesh.position.set(0, 0, depth / 2 + 0.1);
            group.add(winMesh);
        }

        // 3. Holographic Billboard (Top)
        if (Math.random() > 0.7) {
            const signW = width * 0.8;
            const signH = 10;
            const signGeo = new THREE.PlaneGeometry(signW, signH);
            const signMat = new THREE.MeshBasicMaterial({
                color: color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.6
            });
            const sign = new THREE.Mesh(signGeo, signMat);
            sign.position.set(0, height / 2 + signH / 2 + 2, 0); // Float above
            // Add some text or pattern? Just a colored plane for now representing a "hologram"
            group.add(sign);
        }

        return group;
    }

    spawnOverheadSign(zPos, entityManager) {
        // Arch over the road
        const archWidth = 30; // Spans 3-lane road easily

        // Simple Torus Arc
        const geo = new THREE.TorusGeometry(archWidth / 2, 0.5, 8, 20, Math.PI);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Magenta Arch
        const arch = new THREE.Mesh(geo, mat);

        arch.position.set(0, 15, zPos);
        this.scene.add(arch);

        if (entityManager && entityManager.buildings) {
            entityManager.buildings.push(arch);
        }
    }
}
