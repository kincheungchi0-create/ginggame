import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class World {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;

        this.initLights();
        this.initEnvironment();
        // Initialize the actual racing track
        this.createTrack();
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 4096;
        dirLight.shadow.mapSize.height = 4096;
        this.scene.add(dirLight);

        const topLight = new THREE.HemisphereLight(0x00f2ff, 0x7000ff, 0.5);
        this.scene.add(topLight);
    }

    initEnvironment() {
        // Basic Ground for now, will replace with space skybox later
        const groundMaterial = new CANNON.Material('ground');
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.physicsWorld.addBody(groundBody);

        // Visible ground for debugging
        const groundGeo = new THREE.PlaneGeometry(500, 500);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x333355, side: THREE.DoubleSide });
        const groundMesh = new THREE.Mesh(groundGeo, groundMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = -0.1;
        groundMesh.receiveShadow = true;
        this.scene.add(groundMesh);

        // Sky
        const skyGeo = new THREE.SphereGeometry(1000, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x000000) },
                bottomColor: { value: new THREE.Color(0x1a0033) },
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
            fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize( vWorldPosition + offset ).y;
          gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
        }
      `,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }

    createTrack() {
        // Define Track Points (Figure 8 / Loop)
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(50, 0, 80),
            new THREE.Vector3(120, 10, 50), // Elevation
            new THREE.Vector3(150, 0, 0),
            new THREE.Vector3(120, -10, -50), // Dip
            new THREE.Vector3(50, 0, -80),
            new THREE.Vector3(0, 0, -40),
            new THREE.Vector3(-50, 0, 20),
            new THREE.Vector3(-80, 10, 80),
            new THREE.Vector3(-50, 0, 120),
            new THREE.Vector3(0, 0, 0)
        ];

        const curve = new THREE.CatmullRomCurve3(points);
        curve.closed = true;
        this.trackPoints = curve.getPoints(400); // Expose for AI
        const trackPoints = this.trackPoints;
        const trackWidth = 25; // Wider track

        // Visual Mesh Construction
        const trackGeo = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        const indices = [];

        // Iterate points to build ribbon
        for (let i = 0; i < trackPoints.length; i++) {
            const p = trackPoints[i];
            const nextP = trackPoints[(i + 1) % trackPoints.length];
            const tangent = new THREE.Vector3().subVectors(nextP, p).normalize();
            const up = new THREE.Vector3(0, 1, 0);

            // Calculate side vector
            // Simple Up vector might fail on loops, but fine for now
            const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(trackWidth / 2);

            const left = p.clone().add(side);
            left.y += 0.5; // Raise track slightly above ground
            const right = p.clone().sub(side);
            right.y += 0.5;

            vertices.push(left.x, left.y, left.z);
            vertices.push(right.x, right.y, right.z);

            // Rainbow Colors based on index
            const color = new THREE.Color().setHSL(i / trackPoints.length, 1.0, 0.6);
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);

            if (i < trackPoints.length - 1) {
                const base = i * 2;
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            } else {
                // Close loop
                const base = i * 2;
                const nextBase = 0;
                indices.push(base, base + 1, nextBase);
                indices.push(base + 1, nextBase + 1, nextBase);
            }
        }

        trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        trackGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        trackGeo.setIndex(indices);
        trackGeo.computeVertexNormals();

        const trackMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.3,
            metalness: 0.2,
            emissive: 0x444444, // Stronger glow
            emissiveIntensity: 0.5,
            side: THREE.DoubleSide
        });

        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        trackMesh.receiveShadow = true;
        this.scene.add(trackMesh);

        // Physics Barriers (Invisible walls)
        // We create boxes along the edge
        for (let i = 0; i < trackPoints.length; i += 4) { // Optimize: not every point
            const p = trackPoints[i];
            const nextP = trackPoints[(i + 4) % trackPoints.length];

            // Skip wall if gap is too large (rare in high density)
            // ...

            // Actually, let's just make the visual mesh also have a physics trimesh if possible?
            // Cannon Trimesh is expensive. Boxes are better.
            // Let's create side walls.

            const center = new THREE.Vector3().lerpVectors(p, nextP, 0.5);
            const dist = p.distanceTo(nextP);

            const tangent = new THREE.Vector3().subVectors(nextP, p).normalize();
            const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(trackWidth / 2 + 1);
            const angle = Math.atan2(tangent.x, tangent.z);

            // Wall 1
            const w1Body = new CANNON.Body({ mass: 0 });
            w1Body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 2, dist / 2 + 0.5)));
            w1Body.position.set(center.x + side.x, center.y + 2, center.z + side.z);

            // Quaternion from Axis Angle is tricky for generic orientation
            // Simple Y-rotation:
            const q = new CANNON.Quaternion();
            q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
            w1Body.quaternion.copy(q);

            this.physicsWorld.addBody(w1Body);

            // Wall 2
            const w2Body = new CANNON.Body({ mass: 0 });
            w2Body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 2, dist / 2 + 0.5)));
            w2Body.position.set(center.x - side.x, center.y + 2, center.z - side.z);
            w2Body.quaternion.copy(q);

            this.physicsWorld.addBody(w2Body);

            // Floor physics?
            // We need a Trimesh for the floor to handle elevation changes properly.
            // Plane is flat.
        }

        // Create Trimesh for floor physics (Essential for elevation)
        // Needs vertices and indices from geo
        // Cannon-es Trimesh needs simple array
        const cannonIndices = [];
        for (let i = 0; i < indices.length; i++) cannonIndices.push(indices[i]);

        const cannonVertices = [];
        for (let i = 0; i < vertices.length; i++) cannonVertices.push(vertices[i]);

        const trimeshShape = new CANNON.Trimesh(cannonVertices, cannonIndices);
        const trackBody = new CANNON.Body({ mass: 0 });
        trackBody.addShape(trimeshShape);
        this.physicsWorld.addBody(trackBody);
    }
}
