import { Car } from './Car.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class BotCar extends Car {
    constructor(scene, physicsWorld, waypoints) {
        super(scene, physicsWorld);
        this.waypoints = waypoints; // Array of Vector3
        this.currentWaypointIndex = 0;

        // Changing visual color for bot
        this.chassisMesh.material.color.setHex(0xff0000);

        // params
        this.maxSpeed = 25; // Slower than player
        this.steerSkill = 0.5;
    }

    update(dt) {
        super.update();

        if (!this.waypoints || this.waypoints.length === 0) return;

        // AI Logic
        const pos = this.chassisBody.position;
        const target = this.waypoints[this.currentWaypointIndex];

        // Distance check
        const dx = pos.x - target.x;
        const dz = pos.z - target.z;
        const dist = Math.sqrt(dx * dx + dz * dz); // Ignore Y for waypoint check

        if (dist < 20) {
            this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
        }

        // Steering - calculate direction to target in local space
        const relativeTarget = new CANNON.Vec3(target.x - pos.x, target.y - pos.y, target.z - pos.z);
        const carInvQuat = this.chassisBody.quaternion.inverse();
        const localTarget = new CANNON.Vec3();
        carInvQuat.vmult(relativeTarget, localTarget);

        // In local space: +Z is forward, +X is right
        // We need to steer based on local X position of target
        let steer = 0;
        const steerAmount = Math.min(Math.abs(localTarget.x) / 20, 0.6); // Proportional steering

        if (localTarget.z > 0) {
            // Target is ahead
            if (localTarget.x > 1) steer = -steerAmount; // Target to right, steer right
            else if (localTarget.x < -1) steer = steerAmount; // Target to left, steer left
        } else {
            // Target is behind, turn around
            steer = localTarget.x > 0 ? -0.5 : 0.5;
        }

        // Throttle - always full gas for racing!
        let engine = -1000; // Forward force
        if (Math.abs(steer) > 0.4) engine = -600; // Slow down on sharp turns

        this.setInputs(engine, steer, 0);
    }
}
