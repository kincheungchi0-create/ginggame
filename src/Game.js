import * as THREE from 'three';
import { Physics } from './Physics.js';
import { World } from './World.js';
import { Input } from './Input.js';
import { UI } from './UI.js';
import { PlayerCar } from './PlayerCar.js'; // Will implement later
import { ItemManager } from './ItemManager.js';
import { BotCar } from './BotCar.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.input = new Input();
        this.ui = new UI();
        this.physics = new Physics();

        // Three.js Setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        // Fog disabled for debugging
        // this.scene.fog = new THREE.Fog(0x0a0a0a, 50, 300);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 20, 40);

        // World Setup
        this.world = new World(this.scene, this.physics.world);

        // State
        this.clock = new THREE.Clock();
        this.started = false;
        this.startTime = 0;
        this.playerCar = null;
        this.itemManager = null;

        // Bindings
        this.ui.onStart = () => this.start();
        window.addEventListener('resize', () => this.onResize());

        // Start Loop
        this.camera.lookAt(0, 0, 0);
        this.animate();
    }

    start() {
        if (this.started) return;
        this.started = true;
        this.startTime = Date.now();
        this.ui.showGameUI();

        console.log("Game started!");

        // Debug: Add a simple test cube at origin
        const testCube = new THREE.Mesh(
            new THREE.BoxGeometry(5, 5, 5),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        testCube.position.set(0, 2.5, 0);
        this.scene.add(testCube);
        console.log("Test cube added at origin");

        // Spawn Car
        try {
            this.playerCar = new PlayerCar(this.scene, this.physics.world, this.input);
            console.log("PlayerCar spawned at:", this.playerCar.chassisBody.position);
        } catch (e) {
            console.error("Error spawning PlayerCar:", e);
        }

        // Spawn Item Manager
        try {
            this.itemManager = new ItemManager(this.scene, this.physics.world, this.playerCar);
            this.playerCar.itemManager = this.itemManager; // Link back
            console.log("ItemManager initialized");
        } catch (e) {
            console.error("Error spawning ItemManager:", e);
        }

        // Spawn Bots
        this.bots = [];
        try {
            const startOffsets = [10, 30, 50]; // Different waypoint indices for spacing
            for (let i = 0; i < 3; i++) {
                const bot = new BotCar(this.scene, this.physics.world, this.world.trackPoints);
                // Position bot on track at different starting points
                const wpIndex = startOffsets[i];
                const wp = this.world.trackPoints[wpIndex];
                bot.chassisBody.position.set(wp.x, wp.y + 2, wp.z);
                bot.currentWaypointIndex = wpIndex + 5; // Start them looking ahead
                this.bots.push(bot);
            }
            console.log("Bots spawned:", this.bots.length);
        } catch (e) {
            console.error("Error spawning Bots:", e);
        }
    }

    update() {
        const dt = this.clock.getDelta();
        const time = this.started ? Date.now() - this.startTime : 0;

        // Physics
        this.physics.update(dt);
        if (this.itemManager) this.itemManager.update(dt);

        // Update Car
        if (this.playerCar) {
            this.playerCar.update(dt);

            // Update Camera
            const carPos = this.playerCar.getPosition();
            const carQuat = this.playerCar.getQuaternion();

            // Camera follow logic - behind the car
            // Car forward is -Z, so camera should be at +Z relative to car
            // But visually the car faces +Z direction, so camera at -Z
            const offset = new THREE.Vector3(0, 6, -12);
            offset.applyQuaternion(carQuat);
            const targetPos = new THREE.Vector3().copy(carPos).add(offset);

            // Look ahead of car (not at the car itself)
            const lookOffset = new THREE.Vector3(0, 2, 10);
            lookOffset.applyQuaternion(carQuat);
            const lookTarget = new THREE.Vector3().copy(carPos).add(lookOffset);

            this.camera.position.lerp(targetPos, 0.1);
            this.camera.lookAt(lookTarget);

            // Update UI speed
            const velocity = this.playerCar.vehicle.chassisBody.velocity;
            const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2) * 3.6; // km/h (ignoring Y)
            this.ui.update({
                speed: speed,
                time: time
            });
        }

        // Update Bots
        if (this.bots) {
            this.bots.forEach(bot => bot.update(dt));
        } else {
            // UI when not started?
            this.ui.update({
                speed: 0,
                time: 0
            });
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
