import * as THREE from 'three';

export class SnowMap {
    constructor(scene, roadWidth, roadLength) {
        this.scene = scene;
        this.roadWidth = roadWidth;
        this.roadLength = roadLength;
    }

    createLevel(context) {
        // --- Snow ground & Frosty road ---
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1500), groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        context.groundMesh = ground;
        this.scene.add(ground);

        const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1.0 });
        const road = new THREE.Mesh(new THREE.PlaneGeometry(this.roadWidth, this.roadLength * 1.5), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        context.roadMesh = road;
        this.scene.add(road);

        // --- Basic placeholders ---
        console.log("SnowMap initialized (minimal placeholder)");
    }
}
