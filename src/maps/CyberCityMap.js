import * as THREE from 'three';

export class CyberCityMap {
    constructor(scene, roadWidth, roadLength) {
        this.scene = scene;
        this.roadWidth = roadWidth;
        this.roadLength = roadLength;
    }

    createLevel(context) {
        // --- Dark Grid & Neon highlights ---
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5, metalness: 0.8 });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1500), groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        context.groundMesh = ground;
        this.scene.add(ground);

        const roadMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 1 });
        const road = new THREE.Mesh(new THREE.PlaneGeometry(this.roadWidth, this.roadLength * 1.5), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        context.roadMesh = road;
        this.scene.add(road);

        // --- Basic placeholders ---
        console.log("CyberCityMap initialized (minimal placeholder)");
    }
}
