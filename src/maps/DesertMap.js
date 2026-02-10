import * as THREE from 'three';

export class DesertMap {
    constructor(scene, roadWidth, roadLength) {
        this.scene = scene;
        this.roadWidth = roadWidth;
        this.roadLength = roadLength;
    }

    createLevel(context) {
        // --- Road & Ground ---
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0xedc9af, // Desert Sand
            roughness: 1.0,
            metalness: 0
        });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1500), groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        context.groundMesh = ground;
        this.scene.add(ground);

        // Road
        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x4d4d4d, // Slightly lighter/wrought road
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
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const lineSpacing = 12;
        for (let z = -150; z < 450; z += lineSpacing) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.005, z);
            line.receiveShadow = true;
            context.roadLines.push(line);
            this.scene.add(line);
        }

        // --- Desert Environment ---
        const startZ = -150;
        const endZ = 450;
        const range = endZ - startZ;

        for (let i = 0; i < 40; i++) {
            const zPos = startZ + Math.random() * range;
            const side = Math.random() > 0.5 ? 1 : -1;
            const xOffset = side * (this.roadWidth / 2 + 10 + Math.random() * 50);

            if (Math.random() > 0.4) {
                this.spawnCactus(xOffset, zPos, context);
            } else {
                this.spawnDune(xOffset, zPos, context);
            }
        }
    }

    spawnCactus(x, z, context) {
        const cactusGroup = new THREE.Group();
        const mainColor = 0x2d5a27;
        const trunkHeight = 3 + Math.random() * 3;
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, trunkHeight, 8);
        const cactusMat = new THREE.MeshStandardMaterial({ color: mainColor });
        const trunk = new THREE.Mesh(trunkGeo, cactusMat);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        cactusGroup.add(trunk);
        cactusGroup.position.set(x, 0, z);
        context.buildings.push(cactusGroup);
        this.scene.add(cactusGroup);
    }

    spawnDune(x, z, context) {
        const width = 20 + Math.random() * 30;
        const height = 10 + Math.random() * 15;
        const depth = 30 + Math.random() * 40;
        const duneGeo = new THREE.SphereGeometry(1, 16, 12);
        duneGeo.scale(width, height, depth);
        const duneMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 1.0 });
        const dune = new THREE.Mesh(duneGeo, duneMat);
        dune.position.set(x, -height * 0.2, z);
        dune.receiveShadow = true;
        dune.castShadow = true;
        context.buildings.push(dune);
        this.scene.add(dune);
    }
}
