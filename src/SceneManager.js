import * as THREE from 'three';

export class SceneManager {
    constructor(canvasId, roadLength) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.roadLength = roadLength;

        // Settings
        this.scene.background = new THREE.Color(0xa0d7e6);
        this.scene.fog = new THREE.Fog(0xa0d7e6, 150, 600);

        // Renderer Config - BALANCED PERFORMANCE
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Cap pixel ratio at 1.2 to significantly reduce fragment shader load on mobile
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        const container = document.getElementById(canvasId);
        if (container) {
            container.innerHTML = '';
            container.appendChild(this.renderer.domElement);
        }

        this.initLights();
        this.initSky();
        this.initHDRI();

        this.currentTimePhase = 'morning';
        this.nightIntensity = 0;

        // Speed Lines (Airflow Effect)
        this.speedLines = [];
        this.createSpeedLines();

        this.mapType = 'city';

        try {
            this.updateTimeOfDay(0);
        } catch (e) {
            console.warn('Initial TimeOfDay update failed:', e);
        }

        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    initLights() {
        // Soft sky/ground ambient lighting - 1.0 intensity
        // Ground color 0x888888 ensures shadowed sides of buildings/cars aren't pitch black
        // Brightened ground color to 0xaaaaaa to kill the pitch-black shadows
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 1.0);
        this.scene.add(this.hemiLight);

        // Main "Sun" Light - Directional
        this.sun = new THREE.DirectionalLight(0xffffff, 2.8);
        this.sun.position.set(20, 100, 20);
        this.sun.castShadow = true;

        // Tightened Shadow Camera - Optimized Resolution
        this.sun.shadow.mapSize.width = 512; // Reduced from 1024 for mobile perf
        this.sun.shadow.mapSize.height = 512;
        this.sun.shadow.camera.near = 100;
        this.sun.shadow.camera.far = 1500;
        this.sun.shadow.camera.left = -50;
        this.sun.shadow.camera.right = 50;
        this.sun.shadow.camera.top = 60;
        this.sun.shadow.camera.bottom = -60;
        this.sun.shadow.bias = -0.0005; // Slightly deeper bias to prevent acne at better resolution
        this.sun.shadow.normalBias = 0.05;
        this.sun.shadow.radius = 4; // Softer edges hide jitter effectively

        this.scene.add(this.sun);
        this.scene.add(this.sun.target);
    }

    initHDRI() {
        // HDRI environment reflections are REMOVED to keep materials (road/cars) looking matte and professional.
    }

    initSky() {
        // Large Sky Sphere (Moved much further: Radius 1500)
        const skyGeo = new THREE.SphereGeometry(1500, 32, 15);
        this.skyMat = new THREE.MeshBasicMaterial({
            side: THREE.BackSide,
            vertexColors: true,
            fog: false
        });

        const colors = [];
        for (let i = 0; i < skyGeo.attributes.position.count; i++) {
            colors.push(1, 1, 1);
        }
        skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        this.sky = new THREE.Mesh(skyGeo, this.skyMat);
        this.scene.add(this.sky);

        // Sun & Moon System (Moved way back to Z=+900 to stay behind buildings)
        this.celestialGroup = new THREE.Group();
        this.celestialGroup.position.z = 900;
        this.scene.add(this.celestialGroup);

        // Sun (Larger and more dominant)
        const sunGeo = new THREE.SphereGeometry(45, 32, 32);
        this.sunMeshMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
        this.sunMesh = new THREE.Mesh(sunGeo, this.sunMeshMat);
        this.sunMesh.position.set(0, 1000, 0); // Position at top for Z-axis rotation sweep
        this.celestialGroup.add(this.sunMesh);

        // Sun Glow (High-intensity bloom effect)
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Hot core
        gradient.addColorStop(0.1, 'rgba(255, 255, 220, 0.9)');
        gradient.addColorStop(0.4, 'rgba(255, 230, 150, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 200, 50, 0)'); // Soft edge
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);

        const glowTex = new THREE.CanvasTexture(canvas);
        glowTex.needsUpdate = true;
        const glowMat = new THREE.SpriteMaterial({
            map: glowTex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.sunGlow = new THREE.Sprite(glowMat);
        this.sunGlow.scale.set(400, 400, 1);
        this.sunMesh.add(this.sunGlow);

        // Moon (Larger and glowing)
        const moonGeo = new THREE.SphereGeometry(25, 32, 32);
        this.moonMeshMat = new THREE.MeshBasicMaterial({ color: 0xecf0f1, fog: false });
        this.moonMesh = new THREE.Mesh(moonGeo, this.moonMeshMat);
        this.moonMesh.position.set(0, -1000, 0); // Opposite to sun
        this.celestialGroup.add(this.moonMesh);

        // Moon Glow
        const moonGlowMat = new THREE.SpriteMaterial({
            map: glowTex,
            color: 0x82ccdd,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.moonGlow = new THREE.Sprite(moonGlowMat);
        this.moonGlow.scale.set(200, 200, 1);
        this.moonMesh.add(this.moonGlow);

        // Stars (Transparent for transitions)
        this.stars = new THREE.Group();
        this.scene.add(this.stars);
        const starMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            fog: false,
            transparent: true,
            opacity: 0
        });
        const starGeo = new THREE.SphereGeometry(1, 4, 4);
        for (let i = 0; i < 500; i++) {
            const star = new THREE.Mesh(starGeo, starMat);
            const r = 1400;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            star.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
            this.stars.add(star);
        }
        this.stars.visible = false;

        // Shooting Star
        const shootingStarGeo = new THREE.BoxGeometry(0.5, 0.5, 30);
        this.shootingStarMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false });
        this.shootingStar = new THREE.Mesh(shootingStarGeo, this.shootingStarMat);
        this.scene.add(this.shootingStar);
        this.shootingStarActive = false;

        // Clouds (Improved distribution)
        this.clouds = new THREE.Group();
        this.scene.add(this.clouds);
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, fog: false });

        for (let i = 0; i < 40; i++) {
            const cloudGroup = new THREE.Group();
            const numParts = 2 + Math.floor(Math.random() * 3);
            for (let j = 0; j < numParts; j++) {
                const cloudPart = new THREE.Mesh(
                    new THREE.BoxGeometry(15 + Math.random() * 15, 4, 10 + Math.random() * 10),
                    cloudMat.clone()
                );
                cloudPart.position.set(j * 8, Math.random() * 2, Math.random() * 4);
                cloudGroup.add(cloudPart);
            }
            cloudGroup.position.set(
                (Math.random() - 0.5) * 1200,
                120 + Math.random() * 60,
                (Math.random() - 0.5) * 1200
            );
            this.clouds.add(cloudGroup);
        }
    }

    createSpeedLines() {
        this.speedLines = [];
    }

    setMapType(type) {
        this.mapType = type;
        // Reset fog if needed
        if (type === 'snow') {
            this.scene.fog = new THREE.Fog(0xddeeff, 100, 500); // Dense white/blue fog
        } else if (type === 'desert') {
            this.scene.fog = new THREE.Fog(0xe6c288, 100, 700); // Yellow/Sand fog, slightly further
        } else {
            this.scene.fog = new THREE.Fog(0xa0d7e6, 150, 600);
        }
        // Force update of colors even if score hasn't changed
        this._lastScore = -1;
        this.updateTimeOfDay(0);
    }

    updateSpeedLineEffect(speedMultiplier, isBoosted) {
        // Dynamic FOV Zoom Effect
        const targetFOV = isBoosted ? 95 : 75;

        if (Math.abs(this.camera.fov - targetFOV) > 0.01) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.1);
            this.camera.updateProjectionMatrix();
        }

        // CAMERA SHAKE when boosted
        if (isBoosted) {
            const shake = 0.04;
            this.camera.position.x += (Math.random() - 0.5) * shake;
            this.camera.position.y += (Math.random() - 0.5) * shake;
        }
    }

    updateTimeOfDay(score) {
        if (this._lastScore === score) return;
        this._lastScore = score;

        // Init temp objects if not exist (lazy init to keep constructor clean)
        if (!this._c1) {
            this._c1 = new THREE.Color();
            this._c2 = new THREE.Color();
            this._cMixed = new THREE.Color();
            this._cBottom = new THREE.Color();
            this._cTop = new THREE.Color();
            this._cSun = new THREE.Color();
        }

        // Adjust cycle speed per map
        let effectiveScore = score;
        if (this.mapType === 'desert') {
            effectiveScore = score * 0.5; // 2x Slower cycle for Desert
        }

        // Faster cycle: 15 points per transition, 20 points for night
        const cycle = 80;
        const normalizedScore = effectiveScore % cycle;

        let targetPhase, nextPhase, lerpFactor;

        if (normalizedScore < 15) {
            // 0-15: Morning to Afternoon
            targetPhase = 'morning'; nextPhase = 'afternoon';
            lerpFactor = normalizedScore / 15;
        } else if (normalizedScore < 30) {
            // 15-30: Afternoon to Evening
            targetPhase = 'afternoon'; nextPhase = 'evening';
            lerpFactor = (normalizedScore - 15) / 15;
        } else if (normalizedScore < 45) {
            // 30-45: Evening to Night
            targetPhase = 'evening'; nextPhase = 'night';
            lerpFactor = (normalizedScore - 30) / 15;
        } else if (normalizedScore < 65) {
            // 45-65: FULL NIGHT (Stay dark for 20 points)
            targetPhase = 'night'; nextPhase = 'night';
            lerpFactor = 0;
        } else {
            // 65-80: Night to Morning
            targetPhase = 'night'; nextPhase = 'morning';
            lerpFactor = (normalizedScore - 65) / 15;
        }

        const getPhaseSettings = (phase) => {
            if (this.mapType === 'snow') {
                switch (phase) {
                    case 'afternoon': return {
                        skyTop: 0x8899aa, skyBottom: 0xddeeff, // Overcast snow day
                        sunI: 1.5, sunC: 0xffffee, hemiI: 1.5, rot: 0, glow: 0.8
                    };
                    case 'evening': return {
                        skyTop: 0x2c3e50, skyBottom: 0xbdc3c7,
                        sunI: 1.2, sunC: 0xffaa88, hemiI: 1.2, rot: Math.PI / 3, glow: 1.0
                    };
                    case 'night': return {
                        skyTop: 0x050510, skyBottom: 0x111122,
                        sunI: 0.5, sunC: 0xaaccff, hemiI: 0.6, rot: Math.PI, glow: 0.0
                    };
                    default: return { // morning
                        skyTop: 0x778899, skyBottom: 0xcceff0,
                        sunI: 1.5, sunC: 0xffeedd, hemiI: 1.5, rot: -Math.PI / 3, glow: 1.0
                    };
                }
            } else if (this.mapType === 'desert') {
                switch (phase) {
                    case 'afternoon': return {
                        skyTop: 0x4aa3df, skyBottom: 0xffeebb, // Bright blue to hot yellow
                        sunI: 2.5, sunC: 0xffffcc, hemiI: 1.8, rot: 0, glow: 1.5
                    };
                    case 'evening': return {
                        skyTop: 0x8e44ad, skyBottom: 0xe67e22, // Purple to orange
                        sunI: 2.0, sunC: 0xff6b6b, hemiI: 1.5, rot: Math.PI / 3, glow: 1.8
                    };
                    case 'night': return {
                        skyTop: 0x000000, skyBottom: 0x1a1a2e, // Deep dark desert night
                        sunI: 0.8, sunC: 0xccccff, hemiI: 0.8, rot: Math.PI, glow: 0.0
                    };
                    default: return { // morning
                        skyTop: 0x3498db, skyBottom: 0xf1c40f, // Blue to gold
                        sunI: 2.0, sunC: 0xfffacd, hemiI: 1.6, rot: -Math.PI / 3, glow: 1.2
                    };
                }
            } else if (this.mapType === 'cybercity') {
                switch (phase) {
                    case 'afternoon': return {
                        skyTop: 0x2b0055, skyBottom: 0xff00ff, // Deep Purple to Neon Pink
                        sunI: 0.8, sunC: 0x00ffff, hemiI: 1.0, rot: 0, glow: 0.5
                    };
                    case 'evening': return {
                        skyTop: 0x12002f, skyBottom: 0xff00aa,
                        sunI: 0.6, sunC: 0xff00ff, hemiI: 0.8, rot: Math.PI / 3, glow: 0.8
                    };
                    case 'night': return {
                        skyTop: 0x000000, skyBottom: 0x0a0a2a, // Pure Black to Dark Blue
                        sunI: 0.2, sunC: 0x000044, hemiI: 0.4, rot: Math.PI, glow: 0.0 // Very dark, let emissive materials shine
                    };
                    default: return { // morning
                        skyTop: 0x001133, skyBottom: 0x00d4ff, // Dark Blue to Cyan
                        sunI: 1.0, sunC: 0x00ffff, hemiI: 1.2, rot: -Math.PI / 3, glow: 0.6
                    };
                }
            }

            switch (phase) {
                case 'afternoon': return {
                    skyTop: 0x00b4d8, skyBottom: 0x90e0ef,
                    sunI: 3.8, sunC: 0xfff3b0, hemiI: 2.2, rot: 0, glow: 1.2 // Top center
                };
                case 'evening': return {
                    skyTop: 0x6a0572, skyBottom: 0xff7e5f,
                    sunI: 3.5, sunC: 0xfb8500, hemiI: 1.8, rot: Math.PI / 3, glow: 1.5 // Right
                };
                case 'night': return {
                    skyTop: 0x000033, skyBottom: 0x111144, // Brighter night sky
                    sunI: 1.0, sunC: 0xaaccff, hemiI: 1.2, rot: Math.PI, glow: 0.1 // Moon at Top - clearer visibility
                };
                default: return { // morning
                    skyTop: 0x3a86ff, skyBottom: 0xcaf0f8,
                    sunI: 3.5, sunC: 0xffcc33, hemiI: 2.5, rot: -Math.PI / 3, glow: 1.8 // Left
                };
            }
        };

        const current = getPhaseSettings(targetPhase);
        const next = getPhaseSettings(nextPhase);

        if (!current || !next) return;

        const clampedLerp = THREE.MathUtils.clamp(lerpFactor, 0, 1);

        // Interpolate colors using reused objects
        this._c1.setHex(current.skyTop);
        this._c2.setHex(next.skyTop);
        const topColor = this._cTop.copy(this._c1).lerp(this._c2, clampedLerp); // Store result in _cTop

        this._c1.setHex(current.skyBottom);
        this._c2.setHex(next.skyBottom);
        const bottomColor = this._cBottom.copy(this._c1).lerp(this._c2, clampedLerp); // Store result in _cBottom

        this._c1.setHex(current.sunC);
        this._c2.setHex(next.sunC);
        const sunColor = this._cSun.copy(this._c1).lerp(this._c2, clampedLerp); // Store in _cSun

        const sunIntensity = THREE.MathUtils.lerp(current.sunI, next.sunI, clampedLerp);
        const hemiIntensity = THREE.MathUtils.lerp(current.hemiI, next.hemiI, clampedLerp);
        const celestialRotation = THREE.MathUtils.lerp(current.rot, next.rot, clampedLerp);
        const glowOpacity = THREE.MathUtils.lerp(current.glow, next.glow, clampedLerp);

        // Update Vertex Colors for Gradient Effect
        if (this.sky) {
            const pos = this.sky.geometry.attributes.position;
            const colors = this.sky.geometry.attributes.color;
            for (let i = 0; i < pos.count; i++) {
                const y = pos.getY(i);
                // Adjusted for the new 1500 radius (-1500 to 1500)
                const nY = THREE.MathUtils.smoothstep((y + 1500) / 3000, 0, 1);

                // Optimized reuse of color object inside loop
                // this._cMixed.copy(bottomColor).lerp(topColor, nY); 
                // Using .copy() on shared objects is safe here because we set it immediately

                // Manual lerp for max speed in tight loop
                const r = bottomColor.r + (topColor.r - bottomColor.r) * nY;
                const g = bottomColor.g + (topColor.g - bottomColor.g) * nY;
                const b = bottomColor.b + (topColor.b - bottomColor.b) * nY;

                colors.setXYZ(i, r, g, b);
            }
            colors.needsUpdate = true;
        }

        if (this.scene.fog) {
            this.scene.fog.color.copy(bottomColor);
        }

        if (this.sun) {
            this.sun.intensity = sunIntensity;
            this.sun.color.copy(sunColor);

            // Sync Directional Light position with visual sun
            if (this.sunMesh && this.celestialGroup) {
                this.celestialGroup.updateMatrixWorld(true);
                const worldPos = new THREE.Vector3(); // Vector3 alloc is generally fast, but could reuse if really needed
                this.sunMesh.getWorldPosition(worldPos);
                this.sun.position.copy(worldPos);

                // Safety check for sun target
                if (this.sun.target) {
                    this.sun.target.position.set(0, 0, 0);
                    if (!this.sun.target.parent) this.scene.add(this.sun.target);
                    this.sun.target.updateMatrixWorld();
                }
            }
        }
        if (this.hemiLight) {
            this.hemiLight.intensity = hemiIntensity;
        }

        // Update Sun/Moon mesh colors
        if (this.sunMeshMat) this.sunMeshMat.color.copy(sunColor);
        if (this.sunGlow) this.sunGlow.material.color.copy(sunColor);
        if (this.moonMeshMat) {
            // Constant color, no need to alloc
            this.moonMeshMat.color.setHex(0xecf0f1);
        }

        // Animate Celestial Bodies (Left to Right Sweep)
        if (this.celestialGroup) {
            this.celestialGroup.rotation.z = celestialRotation;
        }

        // Adjust sun glow visibility
        if (this.sunGlow) {
            this.sunGlow.material.opacity = glowOpacity;
        }

        // Star visibility & Night progress (based on 80 point cycle)
        let nF = 0; // nightFactor
        if (normalizedScore >= 30 && normalizedScore < 45) nF = (normalizedScore - 30) / 15;
        else if (normalizedScore >= 45 && normalizedScore < 65) nF = 1;
        else if (normalizedScore >= 65 && normalizedScore < 80) nF = 1 - (normalizedScore - 65) / 15;

        this.nightIntensity = nF;

        if (this.stars) {
            this.stars.visible = normalizedScore > 30;
            this.stars.children.forEach(s => {
                s.material.opacity = nF;
            });
        }

        // Keep clouds visible and colored by sky
        if (this.clouds) {
            // this._cMixed reuse
            this._cMixed.setHex(0xffffff).lerp(bottomColor, 0.4);

            this.clouds.children.forEach(group => {
                group.children.forEach(c => {
                    if (c.material) c.material.color.copy(this._cMixed);
                });
            });
        }
    }

    update(deltaTime) {
        // Slowly move clouds
        if (this.clouds) {
            this.clouds.children.forEach(group => {
                group.position.z -= deltaTime * 5;
                if (group.position.z < -600) group.position.z = 600;
            });
        }

        // Shooting Star Logic
        if (this.stars && this.stars.visible) {
            if (!this.shootingStarActive && Math.random() < 0.005) {
                this.shootingStarActive = true;
                this.shootingStar.position.set(
                    (Math.random() - 0.5) * 800,
                    400 + Math.random() * 200,
                    900
                );
                this.shootingStar.rotation.z = Math.random() * Math.PI;
                this.shootingStarMat.opacity = 1;
            }

            if (this.shootingStarActive) {
                this.shootingStar.position.x += deltaTime * 500;
                this.shootingStar.position.y -= deltaTime * 300;
                this.shootingStarMat.opacity -= deltaTime * 1.5;

                if (this.shootingStarMat.opacity <= 0) {
                    this.shootingStarActive = false;
                }
            }
        } else {
            this.shootingStarMat.opacity = 0;
            this.shootingStarActive = false;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
