import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Car {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.world = physicsWorld;

        this.createBody();
        this.createVehicle();
    }

    createBody() {
        // Chassis
        const chassisWidth = 1.4;
        const chassisHeight = 0.4;
        const chassisLength = 2.8;

        const chassisShape = new CANNON.Box(new CANNON.Vec3(chassisWidth / 2, chassisHeight / 2, chassisLength / 2));
        this.chassisBody = new CANNON.Body({ mass: 150 });
        this.chassisBody.addShape(chassisShape);
        this.chassisBody.position.set(0, 5, 0);

        // Visual
        const chassisGeo = new THREE.BoxGeometry(chassisWidth, chassisHeight, chassisLength);
        const chassisMat = new THREE.MeshStandardMaterial({ color: 0x7000ff, roughness: 0.3, metalness: 0.8 });
        this.chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        this.chassisMesh.castShadow = true;
        this.scene.add(this.chassisMesh);
    }

    createVehicle() {
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1
        });

        const wheelOptions = {
            radius: 0.4,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 1.4,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 1),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        // Add wheels
        const chassisWidth = 1.4;
        const chassisLength = 2.8;
        const wPoints = [
            [-chassisWidth / 2, -0.1, chassisLength / 2], // FL
            [chassisWidth / 2, -0.1, chassisLength / 2],  // FR
            [-chassisWidth / 2, -0.1, -chassisLength / 2], // RL
            [chassisWidth / 2, -0.1, -chassisLength / 2]   // RR
        ];

        wPoints.forEach((p) => {
            wheelOptions.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
            this.vehicle.addWheel(wheelOptions);
        });

        this.vehicle.addToWorld(this.world);

        // Wheel Visuals
        this.wheelMeshes = [];
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 20);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

        this.vehicle.wheelInfos.forEach(() => {
            const mesh = new THREE.Mesh(wheelGeo, wheelMat);
            mesh.castShadow = true;
            this.scene.add(mesh);
            this.wheelMeshes.push(mesh);
        });
    }

    update() {
        this.chassisMesh.position.copy(this.chassisBody.position);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);

        // Sync logic for wheels
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            const m = this.wheelMeshes[i];

            if (m) {
                m.position.copy(t.position);
                m.quaternion.copy(t.quaternion);
            }
        }
    }

    setInputs(engine, steer, brake) {
        this.vehicle.applyEngineForce(engine, 2);
        this.vehicle.applyEngineForce(engine, 3);

        this.vehicle.setSteeringValue(steer, 0);
        this.vehicle.setSteeringValue(steer, 1);

        for (let i = 0; i < 4; i++) {
            this.vehicle.setBrake(brake, i);
        }
    }

    getPosition() {
        return this.chassisBody.position;
    }

    getQuaternion() {
        return this.chassisMesh.quaternion;
    }
}
