import * as THREE from 'three';

export class CityMap {
    constructor(scene, roadWidth, roadLength) {
        this.scene = scene;
        this.roadWidth = roadWidth;
        this.roadLength = roadLength;
        this.buildingSpacing = 25;
    }

    createLevel(context) {
        // --- Road & Ground ---
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x448844, roughness: 1.0, metalness: 0 });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 800), groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        context.groundMesh = ground;
        this.scene.add(ground);

        const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1.0, metalness: 0.0 });
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

        // --- Footpaths ---
        const footGeo = new THREE.PlaneGeometry(5, 50);
        const footMat = new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.8 });
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

        // --- Skyline Billboards ---
        context.skylineBillboards = [];
        for (let i = 0; i < 60; i++) {
            context.spawnSkylineBillboard((i / 60) * 1200 - 600);
        }

        // --- Buildings & Trees ---
        const startZ = -150;
        const endZ = 450;
        const range = endZ - startZ;
        const numBlocks = Math.floor(range / this.buildingSpacing);

        for (let i = 0; i < numBlocks; i++) {
            const zPos = startZ + i * this.buildingSpacing;
            context.spawnBuildingPairAt(zPos);
            if (i % 3 === 0) {
                context.spawnTreePairAt(zPos + this.buildingSpacing / 2);
            }
            context.spawnBackdropBuilding(zPos);
            context.spawnBackdropBuilding(zPos + this.buildingSpacing / 2);
            if (i % 4 === 0) {
                context.spawnPedestrian(zPos);
            }
        }
    }
}
