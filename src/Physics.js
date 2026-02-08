import * as CANNON from 'cannon-es';

export class Physics {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -20, 0); // Higher gravity for arcade feel
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.defaultContactMaterial.friction = 0.0; // We handle friction manually for drifting

        // Create a default material
        this.defaultMaterial = new CANNON.Material('default');
        const defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.3,
                restitution: 0.0, // No bounce
            }
        );
        this.world.addContactMaterial(defaultContactMaterial);
    }

    update(dt) {
        this.world.step(1 / 60, dt, 3);
    }
}
