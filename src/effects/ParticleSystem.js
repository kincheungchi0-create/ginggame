import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particleGroups = [];
        
        // Create reusable geometries and materials
        this.createSparkMaterial();
        this.createSmokeMaterial();
        this.createBoostMaterial();
    }

    createSparkMaterial() {
        this.sparkMaterial = new THREE.PointsMaterial({
            color: 0xffaa00,
            size: 0.3,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    createSmokeMaterial() {
        this.smokeMaterial = new THREE.PointsMaterial({
            color: 0x888888,
            size: 0.8,
            transparent: true,
            opacity: 0.6,
            blending: THREE.NormalBlending,
            depthWrite: false
        });
    }

    createBoostMaterial() {
        this.boostMaterial = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.5,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    // Create drift sparks effect
    createDriftSparks(position, direction, intensity = 1) {
        const particleCount = Math.floor(10 * intensity);
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x + (Math.random() - 0.5) * 0.5;
            positions[i * 3 + 1] = position.y + 0.1;
            positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5;

            velocities.push({
                x: direction.x * 2 + (Math.random() - 0.5) * 2,
                y: Math.random() * 3 + 1,
                z: direction.z * 2 + (Math.random() - 0.5) * 2
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const sparkColor = intensity > 1.5 ? 0xff3300 : (intensity > 1 ? 0xff6600 : 0xffaa00);
        const material = this.sparkMaterial.clone();
        material.color.setHex(sparkColor);

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleGroups.push({
            particles,
            velocities,
            life: 0.5,
            maxLife: 0.5,
            type: 'sparks',
            gravity: 8
        });

        return particles;
    }

    // Create tire smoke for drifting
    createTireSmoke(position, amount = 5) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(amount * 3);
        const velocities = [];

        for (let i = 0; i < amount; i++) {
            positions[i * 3] = position.x + (Math.random() - 0.5) * 0.3;
            positions[i * 3 + 1] = position.y + 0.2;
            positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.3;

            velocities.push({
                x: (Math.random() - 0.5) * 0.5,
                y: Math.random() * 1.5 + 0.5,
                z: (Math.random() - 0.5) * 0.5
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = this.smokeMaterial.clone();
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleGroups.push({
            particles,
            velocities,
            life: 1.2,
            maxLife: 1.2,
            type: 'smoke',
            gravity: -0.2 // Smoke rises
        });

        return particles;
    }

    // Create boost trail effect
    createBoostTrail(position, direction, intensity = 1) {
        const particleCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x + (Math.random() - 0.5) * 0.8;
            positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.3;
            positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.8;

            velocities.push({
                x: -direction.x * 8 + (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 1,
                z: -direction.z * 8 + (Math.random() - 0.5) * 2
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = this.boostMaterial.clone();
        material.size = 0.4 + intensity * 0.2;
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleGroups.push({
            particles,
            velocities,
            life: 0.4,
            maxLife: 0.4,
            type: 'boost',
            gravity: 0
        });

        return particles;
    }

    // Create item collection sparkle
    createItemSparkle(position) {
        const particleCount = 30;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            velocities.push({
                x: Math.cos(angle) * speed,
                y: Math.random() * 5 + 2,
                z: Math.sin(angle) * speed
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffff00,
            size: 0.4,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleGroups.push({
            particles,
            velocities,
            life: 0.8,
            maxLife: 0.8,
            type: 'sparkle',
            gravity: 6
        });

        return particles;
    }

    // Create explosion effect (for shell hits)
    createExplosion(position, color = 0xff4400) {
        const particleCount = 50;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 5 + Math.random() * 8;
            velocities.push({
                x: Math.sin(phi) * Math.cos(theta) * speed,
                y: Math.cos(phi) * speed * 0.5 + 3,
                z: Math.sin(phi) * Math.sin(theta) * speed
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: color,
            size: 0.6,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        this.particleGroups.push({
            particles,
            velocities,
            life: 1.0,
            maxLife: 1.0,
            type: 'explosion',
            gravity: 5
        });

        return particles;
    }

    update(dt) {
        for (let i = this.particleGroups.length - 1; i >= 0; i--) {
            const group = this.particleGroups[i];
            group.life -= dt;

            if (group.life <= 0) {
                this.scene.remove(group.particles);
                group.particles.geometry.dispose();
                group.particles.material.dispose();
                this.particleGroups.splice(i, 1);
                continue;
            }

            // Update particle positions
            const positions = group.particles.geometry.attributes.position.array;
            const velocities = group.velocities;

            for (let j = 0; j < velocities.length; j++) {
                positions[j * 3] += velocities[j].x * dt;
                positions[j * 3 + 1] += velocities[j].y * dt;
                positions[j * 3 + 2] += velocities[j].z * dt;

                // Apply gravity
                velocities[j].y -= group.gravity * dt;
            }

            group.particles.geometry.attributes.position.needsUpdate = true;

            // Fade out
            const alpha = group.life / group.maxLife;
            group.particles.material.opacity = alpha;

            // Grow particles for smoke
            if (group.type === 'smoke') {
                group.particles.material.size += dt * 0.5;
            }
        }
    }

    dispose() {
        this.particleGroups.forEach(group => {
            this.scene.remove(group.particles);
            group.particles.geometry.dispose();
            group.particles.material.dispose();
        });
        this.particleGroups = [];
    }
}
