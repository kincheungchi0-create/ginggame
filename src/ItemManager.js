import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class ItemManager {
    constructor(scene, physicsWorld, playerCar) {
        this.scene = scene;
        this.world = physicsWorld;
        this.playerCar = playerCar;

        this.boxes = [];
        this.activeItems = [];

        // Create Item Box visual template
        const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xff0000,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });
        this.boxTemplate = new THREE.Mesh(boxGeo, boxMat);

        // Initialize Item Boxes on track
        this.spawnItemBoxes();
    }

    spawnItemBoxes() {
        // Spawn some boxes at specific locations (e.g., start line, after loop)
        const positions = [
            new CANNON.Vec3(0, 2, 20),
            new CANNON.Vec3(50, 2, 80),
            new CANNON.Vec3(120, 12, 50)
        ];

        positions.forEach(pos => {
            this.createBox(pos);
        });
    }

    createBox(pos) {
        const shape = new CANNON.Box(new CANNON.Vec3(0.75, 0.75, 0.75));
        const body = new CANNON.Body({ mass: 0, isTrigger: true }); // Trigger sensor
        body.addShape(shape);
        body.position.copy(pos);

        body.itemName = "ItemBox"; // Tag

        this.world.addBody(body);

        const mesh = this.boxTemplate.clone();
        mesh.position.copy(pos);
        this.scene.add(mesh);

        const box = { body, mesh, active: true, respawnTimer: 0 };
        this.boxes.push(box);

        // Collision Listener
        body.addEventListener('collide', (e) => {
            if (!box.active) return;
            if (e.body === this.playerCar.chassisBody) {
                this.collectBox(box);
            }
        });
    }

    collectBox(box) {
        console.log("Item Box Collected!");
        box.active = false;
        box.mesh.visible = false;
        box.respawnTimer = 5; // 5 seconds to respawn

        // Give Item to Player
        this.giveRandomItem();
    }

    giveRandomItem() {
        const items = ["Mushroom", "GreenShell", "Banana"];
        const item = items[Math.floor(Math.random() * items.length)];
        console.log("Got Item:", item);
        this.playerCar.setItem(item);
    }

    activateItem(item, car) {
        if (item === "Mushroom") {
            // Instant Boost
            const forward = new CANNON.Vec3(0, 0, 1);
            car.chassisBody.quaternion.vmult(forward, forward);
            car.chassisBody.velocity.vadd(forward.scale(-30), car.chassisBody.velocity);
        } else if (item === "GreenShell") {
            this.spawnGreenShell(car);
        }
    }

    spawnGreenShell(car) {
        const forward = new CANNON.Vec3(0, 0, 1);
        car.chassisBody.quaternion.vmult(forward, forward);
        forward.scale(-1, forward); // Forward is -Z relative to car?

        const pos = car.chassisBody.position.clone();
        pos.vadd(forward.scale(3), pos); // Start in front
        pos.y += 0.5;

        const shape = new CANNON.Sphere(0.3);
        const body = new CANNON.Body({ mass: 10 });
        body.addShape(shape);
        body.position.copy(pos);
        body.linearDamping = 0; // Keep moving
        body.velocity.copy(forward.scale(40)); // Fast

        this.world.addBody(body);

        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.3),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        this.scene.add(mesh);

        this.activeItems.push({ body, mesh, type: "GreenShell", life: 5 });
    }

    update(dt) {
        // Rotate Boxes
        this.boxes.forEach(box => {
            if (box.active) {
                box.mesh.rotation.x += dt;
                box.mesh.rotation.y += dt;
            } else {
                box.respawnTimer -= dt;
                if (box.respawnTimer <= 0) {
                    box.active = true;
                    box.mesh.visible = true;
                }
            }
        });

        // Update Active Items (Projectiles)
        for (let i = this.activeItems.length - 1; i >= 0; i--) {
            const item = this.activeItems[i];
            item.mesh.position.copy(item.body.position);
            item.mesh.quaternion.copy(item.body.quaternion);

            item.life -= dt;
            if (item.life <= 0) {
                // Destroy
                this.world.removeBody(item.body);
                this.scene.remove(item.mesh);
                this.activeItems.splice(i, 1);
            }
        }
    }
}
