import { Car } from './Car.js';
import * as CANNON from 'cannon-es';

export class PlayerCar extends Car {
    constructor(scene, physicsWorld, input) {
        super(scene, physicsWorld);
        this.input = input;

        // Tuning params
        this.maxForce = 800;
        this.maxSteer = 0.5;
        this.brakeForce = 30;

        // Drift params
        this.isDrifting = false;
        this.driftDirection = 0; // -1 left, 1 right
        this.driftTime = 0;

        // Item params
        this.currentItem = null;
    }

    setItem(item) {
        this.currentItem = item;
        // TODO: Update UI to show item icon
        console.log("Held Item:", item);
    }

    useItem() {
        if (!this.currentItem) return;

        console.log("Used Item:", this.currentItem);
        if (this.itemManager) {
            this.itemManager.activateItem(this.currentItem, this);
        }

        this.currentItem = null;
    }

    update(dt) {
        super.update();

        let engineForce = 0;
        let steerValue = 0;
        let brakeForce = 0;

        // Item Input
        if (this.input.keys.shift && this.currentItem) { // Shift to use item
            // Debounce? assuming one frame press or clear immediately
            this.useItem();
            this.input.keys.shift = false; // Hack to prevent spam
        }

        // Movement Inputs
        if (this.input.keys.up) engineForce = -this.maxForce;
        if (this.input.keys.down) engineForce = this.maxForce;

        const steerInput = (this.input.keys.left ? 1 : 0) - (this.input.keys.right ? 1 : 0);

        // Drift Logic
        if (this.input.keys.space && !this.isDrifting && Math.abs(steerInput) > 0.1) {
            // Start Drift
            this.startDrift(steerInput);
        } else if (!this.input.keys.space && this.isDrifting) {
            // End Drift
            this.endDrift();
        }

        // Steering logic
        if (this.isDrifting) {
            // While drifting, steering affects angle but we slide
            // We actually want to counter-steer visually or lock steering?
            // Mario Kart style: Steer into turn = tight drift, Steer out = wide drift
            const driftSteer = this.driftDirection * (this.maxSteer + 0.1);
            // Modulate with input
            steerValue = driftSteer + (steerInput * 0.2);
            this.driftTime += dt;

            // TODO: Sparks based on driftTime
        } else {
            steerValue = steerInput * this.maxSteer;
        }

        // Brake / Reverse acts differently
        if (this.input.keys.space && !this.isDrifting && Math.abs(steerInput) < 0.1) {
            // Brake only if not moving sideways significantly or just stopped?
            // For now standard brake
            brakeForce = this.brakeForce;
        }

        this.setInputs(engineForce, steerValue, brakeForce);
    }

    startDrift(dir) {
        this.isDrifting = true;
        this.driftDirection = dir > 0 ? 1 : -1;
        this.driftTime = 0;

        // HOP!
        this.chassisBody.velocity.y += 5;

        // Reduce Friction for back wheels?
        // For now we just rely on steering hack. 
        // Ideally we change traction.
        this.setDriftFriction(true);
    }

    endDrift() {
        this.isDrifting = false;
        this.setDriftFriction(false);

        // Boost if driftTime > threshold
        if (this.driftTime > 1.5) {
            // Fire Boost
            console.log("BOOST!");
            const forward = new CANNON.Vec3(0, 0, 1);
            this.chassisBody.quaternion.vmult(forward, forward);
            this.chassisBody.velocity.vadd(forward.scale(-20), this.chassisBody.velocity);
        }
        this.driftTime = 0;
    }

    setDriftFriction(isDrifting) {
        // Access wheels and change their sliding friction?
        // RaycastVehicle has 'frictionSlip' in wheelInfos
        const slip = isDrifting ? 4 : 1.4; // Higher slip means easier to slide? Or lower?
        // Low friction slip = more slide. High = more grip.
        // Wait, Cannon frictionSlip: "Friction slip is the result of the friction coefficient between the tire and the ground."
        // Actually usually lower value = more slide.

        for (let i = 2; i < 4; i++) { // Rear wheels
            this.vehicle.wheelInfos[i].frictionSlip = isDrifting ? 2 : 1.4;
        }
    }
}
