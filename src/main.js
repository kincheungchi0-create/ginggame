import * as THREE from 'three';

// ==================== 音效管理器 ====================
class SoundManager {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.initialized = false;
        this.started = false;
    }

    init() {
        if (this.initialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.context.destination);

        this.initialized = true;
    }

    startEngine() {
        if (!this.initialized) this.init();
        if (this.started) return;

        // Engine Oscillator (Sawtooth for rough engine sound)
        this.engineOsc = this.context.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 100; // Idle RPM

        // Engine Filter (Lowpass to muffle the harsh sawtooth)
        this.engineFilter = this.context.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 400;

        // Engine Gain
        this.engineGain = this.context.createGain();
        this.engineGain.gain.value = 0.1;

        // Connections
        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineOsc.start();
        this.started = true;
    }

    updateEngine(speed, maxSpeed) {
        if (!this.started) return;

        const speedRatio = Math.abs(speed) / maxSpeed;

        // Pitch modulation
        // Idle: 80Hz, Max Redline: 400Hz
        const targetFreq = 80 + (speedRatio * 320);
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.context.currentTime, 0.1);

        // Filter modulation (opens up as you speed up)
        const targetFilter = 400 + (speedRatio * 1000);
        this.engineFilter.frequency.setTargetAtTime(targetFilter, this.context.currentTime, 0.1);

        // Volume wobble (tremolo) based on speed for realism? 
        // Or just volume increase
        // Let's add a slight random flutter or just keep it simple.
        this.engineGain.gain.setTargetAtTime(0.1 + (speedRatio * 0.2), this.context.currentTime, 0.1);
    }

    stopEngine() {
        if (this.engineOsc) {
            this.engineOsc.stop();
            this.engineOsc.disconnect();
            this.engineOsc = null;
        }
        this.started = false;
    }
}
// ==================== NPC 競爭者 ====================
class BotCar {
    constructor(scene, trackCurve, trackWidth, color = 0xff3333, startT = 0, sideOffset = 0) {
        this.scene = scene;
        this.trackCurve = trackCurve;
        this.trackWidth = trackWidth;
        this.carT = startT;
        this.sideOffset = sideOffset;
        this.carSpeed = 0;
        this.maxSpeed = 40 + Math.random() * 15; // 降低 NPC 速度
        this.acceleration = 25; // 降低 NPC 加速度
        this.trackLength = this.trackCurve.getLength();
        this.pushOffset = new THREE.Vector3(); // 用於碰撞反彈偏移
        this.boostTimer = 0; // 加速器計時
        this.carVelocityY = 0;
        this.gravity = -30; // 降低重力讓飛行時間更長
        this.lap = 1; // NPC 圈數追蹤

        this.mesh = this.createMesh(color);
        this.scene.add(this.mesh);

        this.wheels = [];
        this.mesh.traverse(obj => {
            if (obj.name === 'wheel') this.wheels.push(obj);
        });
    }

    createMesh(color) {
        const group = new THREE.Group();
        // Body (Taller Kart)
        const bodyGeo = new THREE.BoxGeometry(1.4, 0.5, 3.5);
        const bodyMat = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.6,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.6;
        body.castShadow = true;
        group.add(body);

        // Side Pods
        const sidePodGeo = new THREE.BoxGeometry(2.4, 0.4, 1.8);
        const sidePod = new THREE.Mesh(sidePodGeo, bodyMat);
        sidePod.position.set(0, 0.6, 0.2);
        sidePod.castShadow = true;
        group.add(sidePod);

        // Seat
        const seatGeo = new THREE.BoxGeometry(1.0, 1.4, 0.6);
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.set(0, 1.3, -0.6);
        seat.castShadow = true;
        group.add(seat);

        // Nose
        const noseGeo = new THREE.BoxGeometry(1.2, 0.3, 1.5);
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(0, 0.5, 2.0);
        nose.rotation.x = 0.3;
        nose.castShadow = true;
        group.add(nose);

        // Engine Rear
        const engineGeo = new THREE.BoxGeometry(1.2, 0.8, 1.0);
        const engineMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        const engine = new THREE.Mesh(engineGeo, engineMat);
        engine.position.set(0, 0.9, -1.8);
        engine.castShadow = true;
        group.add(engine);

        // Exhaust Pipes
        const pipeGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 16);
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 1.0 });
        const pipeL = new THREE.Mesh(pipeGeo, pipeMat);
        pipeL.rotation.x = Math.PI / 2 + 0.3;
        pipeL.position.set(-0.4, 1.3, -2.4);
        const pipeR = new THREE.Mesh(pipeGeo, pipeMat);
        pipeR.rotation.x = Math.PI / 2 + 0.3;
        pipeR.position.set(0.4, 1.3, -2.4);
        group.add(pipeL);
        group.add(pipeR);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.55, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
        const wheelPositions = [
            { x: -1.3, y: 0.65, z: 1.5 }, { x: 1.3, y: 0.65, z: 1.5 },
            { x: -1.3, y: 0.65, z: -1.5 }, { x: 1.3, y: 0.65, z: -1.5 }
        ];
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.name = 'wheel';
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            group.add(wheel);
        });

        // Lights
        const lightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
        const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const leftHead = new THREE.Mesh(lightGeo, headLightMat);
        leftHead.position.set(-0.8, 0.6, 2.55);
        group.add(leftHead);
        const rightHead = new THREE.Mesh(lightGeo, headLightMat);
        rightHead.position.set(0.8, 0.6, 2.55);
        group.add(rightHead);

        return group;
    }

    updateHeight(targetY, dt) {
        // 應用重力
        this.carVelocityY += this.gravity * dt;
        this.mesh.position.y += this.carVelocityY * dt;

        if (targetY !== undefined) {
            const floorY = targetY;
            if (this.mesh.position.y <= floorY + 0.3) {
                this.mesh.position.y = floorY;

                // 使用切線計算坡度帶來的向上速度
                const tangent = this.trackCurve.getTangentAt(this.carT);
                const slopeY = tangent.y;
                const hLen = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
                const slopeAngle = Math.atan2(slopeY, hLen);
                const launchVelY = Math.abs(this.carSpeed) * Math.sin(slopeAngle);

                if (launchVelY > 0) {
                    this.carVelocityY = Math.max(
                        this.carVelocityY * 0.6 + launchVelY * 0.4,
                        launchVelY
                    );
                } else if (this.carVelocityY > 8) {
                    this.mesh.position.y = floorY + 1.0; // 起飛！
                } else if (this.carVelocityY < -20) {
                    this.carVelocityY *= -0.15;
                } else {
                    this.carVelocityY = launchVelY;
                }
            }
        } else {
            if (this.mesh.position.y < -100) {
                this.mesh.position.y = 0;
                this.carVelocityY = 0;
            }
        }
    }

    update(dt, started, leaderProgress, rank) {
        if (!started) return;

        let effectiveMaxSpeed = this.maxSpeed;
        let effectiveAcceleration = this.acceleration;

        // 領先減速 - 前三名大幅減速
        if (rank !== undefined) {
            if (rank === 1) {
                effectiveMaxSpeed *= 0.5;  // 第一名減速 50%
                effectiveAcceleration *= 0.5;
            } else if (rank === 2) {
                effectiveMaxSpeed *= 0.65; // 第二名減速 35%
                effectiveAcceleration *= 0.65;
            } else if (rank === 3) {
                effectiveMaxSpeed *= 0.8;  // 第三名減速 20%
                effectiveAcceleration *= 0.8;
            }
        }

        // 落後加速 - 越落後速度越快
        if (leaderProgress !== undefined) {
            const myProgress = this.lap + this.carT;
            const gap = leaderProgress - myProgress;
            if (gap > 0.05) {
                const catchUpFactor = 1 + Math.min(gap * 2, 0.6);
                effectiveMaxSpeed *= catchUpFactor;
                effectiveAcceleration *= catchUpFactor;
            }
        }

        if (this.boostTimer > 0) {
            this.boostTimer -= dt;
            effectiveMaxSpeed = this.maxSpeed * 2.0;
            effectiveAcceleration = this.acceleration * 2.5;
            if (this.carSpeed < effectiveMaxSpeed * 0.85) this.carSpeed = effectiveMaxSpeed * 0.85;
        }

        this.carSpeed += effectiveAcceleration * dt;
        if (this.carSpeed > effectiveMaxSpeed) this.carSpeed = effectiveMaxSpeed;

        const oldT = this.carT;
        this.carT += (this.carSpeed * dt) / this.trackLength;
        if (this.carT > 1) {
            this.carT -= 1;
            this.lap++; // NPC 完成一圈
        }

        const pos = this.trackCurve.getPointAt(this.carT);
        const tangent = this.trackCurve.getTangentAt(this.carT).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

        // Preserve current Y for gravity physics
        const currentY = this.mesh.position.y;
        // Apply position
        this.mesh.position.copy(pos).add(side.clone().multiplyScalar(this.sideOffset));
        // Restore Y
        this.mesh.position.y = currentY;

        // 套用反彈偏移並逐漸衰減
        this.mesh.position.add(this.pushOffset);
        this.pushOffset.multiplyScalar(0.9);
        if (this.pushOffset.length() < 0.01) this.pushOffset.set(0, 0, 0);

        // Fix Orientation: Look forward relative to CURRENT position
        const lookTarget = this.mesh.position.clone().add(tangent);
        if (this.carVelocityY < -5) {
            lookTarget.y += this.carVelocityY * 0.05; // 空中掉落時車頭微垂
        }
        this.mesh.lookAt(lookTarget);

        // Rotate wheels
        const wheelRotation = this.carSpeed * dt * 0.35;
        this.wheels.forEach(wheel => {
            wheel.rotation.x += wheelRotation;
        });
    }
}

/**
 * 🏎️ HYPERION RACING - Clean 3D Racing Game
 * A simple, visually clean racing game with Three.js
 */

class RacingGame {
    constructor() {
        this.init();
    }

    init() {
        // ==================== 場景設置 ====================
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 300, 1500);

        // ==================== 相機設置 ====================
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 8, 15);
        this.camera.lookAt(0, 0, 0);

        // ==================== 渲染器設置 ====================
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        // ==================== 物理與工具 ====================
        this.raycaster = new THREE.Raycaster();
        this.pushOffset = new THREE.Vector3(); // 玩家賽車的反彈偏移

        // ==================== 時間追蹤 ====================
        this.clock = new THREE.Clock();
        this.gameTime = 0;
        this.lap = 1;
        this.maxLaps = 3;
        this.started = false;
        this.paused = false;

        // ==================== 賽道參數 ====================
        this.trackRadius = 80;
        this.trackWidth = 18;

        // ==================== 車輛狀態 ====================
        this.carSpeed = 0;
        this.carAngle = 0;
        this.carVelocityY = 0; // 垂直速度
        this.gravity = -30;    // 降低重力讓飛行時間更長
        this.maxSpeed = 50; // 降低玩家速度
        this.acceleration = 25; // 降低加速度
        this.handling = 3.5;
        this.bots = [];
        this.boostPads = [];
        this.playerBoostTimer = 0;

        // ==================== 輸入狀態 ====================
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        this.mobileAutoAccelerate = false;

        // ==================== 初始化各個組件 ====================
        this.brandingTextures = this.createBrandingTextures();
        this.setupLights();
        this.createTrack();
        this.createCar();
        this.createEnvironment();
        this.setupInput();
        this.createHUD();
        this.createBots();

        // ==================== 響應式處理 ====================
        window.addEventListener('resize', () => this.onResize());

        // ==================== 音效初始化 ====================
        this.soundManager = new SoundManager();

        // ==================== 開始動畫循環 ====================
        this.animate();

        // 顯示開始選單
        this.showMenu();
    }

    // ==================== 燈光設置 ====================
    setupLights() {
        // 環境光 - 明亮的日間
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambient);

        // 主方向光（太陽）
        const sun = new THREE.DirectionalLight(0xfff5e0, 1.5);
        sun.position.set(80, 150, 60);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 400;
        sun.shadow.camera.left = -150;
        sun.shadow.camera.right = 150;
        sun.shadow.camera.top = 150;
        sun.shadow.camera.bottom = -150;
        this.scene.add(sun);

        // 補光 - 天空藍色反射
        const fill = new THREE.DirectionalLight(0x8ec8f0, 0.6);
        fill.position.set(-50, 40, -50);
        this.scene.add(fill);

        // 額外補光
        const fill2 = new THREE.HemisphereLight(0x87CEEB, 0x3a7d44, 0.4);
        this.scene.add(fill2);
    }

    // ==================== 創建品牌素材 (CMBI) ====================
    createBrandingTextures() {
        // CMBI Logo (Red background, White text)
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#E31E26'; // CMBI Red
        ctx.fillRect(0, 0, 512, 128);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CMB International', 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 16;

        // Transparency version for decals
        const decalCanvas = document.createElement('canvas');
        decalCanvas.width = 512;
        decalCanvas.height = 512;
        const dCtx = decalCanvas.getContext('2d');
        // Transparent background
        dCtx.clearRect(0, 0, 512, 512);

        // Circle background
        dCtx.fillStyle = '#E31E26';
        dCtx.beginPath();
        dCtx.arc(256, 256, 200, 0, Math.PI * 2);
        dCtx.fill();

        dCtx.fillStyle = 'white';
        dCtx.font = 'bold 80px Arial';
        dCtx.textAlign = 'center';
        dCtx.textBaseline = 'middle';
        dCtx.fillText('CMBI', 256, 256);

        const decalTexture = new THREE.CanvasTexture(decalCanvas);
        decalTexture.anisotropy = 16;

        // Load new banners from public folder
        const loader = new THREE.TextureLoader();
        const t1 = loader.load('/1.jpg');
        const t2 = loader.load('/2.jpg');
        const t4 = loader.load('/4.jpg');
        const gtja = loader.load('/gtja.png');

        const t5 = loader.load('/5.jpeg');
        const t6 = loader.load('/6.jpeg');
        const t7 = loader.load('/7.jpeg');

        const extraBanners = [];
        // Load banners 8-25
        for (let i = 8; i <= 25; i++) {
            // Some might be jpg or jpeg, but we renamed them to jpeg or jpg?
            // Actually I renamed them to .jpeg in the mv command.
            // But wait, the user's files originally had various extensions. 
            // My mv command: mv ... public/8.jpeg
            // Yes, I renamed them all to .jpeg for consistency.
            const tex = loader.load(`/${i}.jpeg`);
            tex.anisotropy = 16;
            extraBanners.push(tex);
        }

        const baseBanners = [t1, t2, t4, gtja, t5, t6, t7];
        baseBanners.forEach(t => t.anisotropy = 16);

        const allBanners = [...baseBanners, ...extraBanners];

        return {
            main: texture,
            decal: decalTexture,
            gtjai: gtja,
            clsa: t1,
            citic: t2,
            banner3: t4,
            banner5: t5,
            banner6: t6,
            banner7: t7,
            allBanners: allBanners
        };
    }

    // ==================== 創建挑戰級長賽道 ====================
    createTrack() {
        // 1. 生成自定義控制點路徑
        const controlPoints = [
            new THREE.Vector3(0, 0, 300),       // 起點大直道
            new THREE.Vector3(150, 5, 300),     // 微上坡
            new THREE.Vector3(300, 2, 280),     // 平緩右彎
            // Roller Coaster steep climb and loop-like track
            new THREE.Vector3(450, 60, 150),    // 急速爬升 (Roller Coaster)
            new THREE.Vector3(500, 150, 0),     // 極高的高架橋
            new THREE.Vector3(300, 120, -120),  // 仍在空中盤旋
            new THREE.Vector3(200, 40, -200),   // 急速下坡
            new THREE.Vector3(250, 0, -350),    // 谷底直道
            new THREE.Vector3(100, 8, -380),    // 上坡
            new THREE.Vector3(-30, 20, -330),   // 丘陵彎
            new THREE.Vector3(-120, 10, -230),  // 下坡彎
            // 隧道位置
            new THREE.Vector3(-200, 5, -180),   // 將要進入隧道
            new THREE.Vector3(-300, 5, -100),   // 隧道中
            new THREE.Vector3(-450, 5, 0),      // 隧道中
            new THREE.Vector3(-400, 8, 130),    // 出隧道
            // ===== 跳台區段 =====
            new THREE.Vector3(-250, 3, 320),    // 接近
            new THREE.Vector3(-200, 5, 335),    // 仍然低
            new THREE.Vector3(-170, 28, 338),   // 上坡
            new THREE.Vector3(-150, 35, 335),   // 跳台頂
            new THREE.Vector3(-135, 28, 330),   // 邊緣
            new THREE.Vector3(-110, 5, 320),    // 下降
            new THREE.Vector3(-70, 0, 310),     // 著陸
            new THREE.Vector3(-30, 0, 300)      // 回到起點
        ];

        this.trackCurve = new THREE.CatmullRomCurve3(controlPoints);
        this.trackCurve.closed = true;

        const segments = 1200; // 更長的賽道需要更多分段

        // 2. 自定義賽道 Mesh 生成 (Triangle Strip) - 解決扭曲問題
        const trackWidth = 42; // 超寬賽道
        this.trackWidth = trackWidth; // Store for usage
        const curvePoints = this.trackCurve.getSpacedPoints(segments); // Uniform spacing

        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        // 用於裝飾物放置的數據緩存
        this.trackLayout = [];

        for (let i = 0; i < curvePoints.length; i++) {
            const p = curvePoints[i];

            // 計算穩定的切線和副法線
            // 使用下一個點來計算切線，最後一個點接回第一個
            const nextP = curvePoints[(i + 1) % curvePoints.length];
            const tangent = new THREE.Vector3().subVectors(nextP, p).normalize();

            // 強制 Up 向量為 (0, 1, 0)，確保路面不側傾
            const up = new THREE.Vector3(0, 1, 0);
            let binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

            // 如果切線完全垂直（極少見），做個保護
            if (binormal.lengthSq() === 0) {
                binormal.set(1, 0, 0);
            }

            binormal.multiplyScalar(trackWidth / 2);

            // 左/右頂點
            const pLeft = p.clone().add(binormal);
            const pRight = p.clone().sub(binormal);

            vertices.push(pLeft.x, pLeft.y, pLeft.z);
            vertices.push(pRight.x, pRight.y, pRight.z);


            // 法線 (全部朝上)
            normals.push(0, 1, 0);
            normals.push(0, 1, 0);

            // UVs
            const u = i / curvePoints.length * 40; // 重複紋理
            uvs.push(u, 0);
            uvs.push(u, 1);

            // 保存數據給裝飾物使用
            this.trackLayout.push({
                position: p,
                tangent: tangent,
                binormal: binormal.clone().normalize(), // Normalized logic direction
                pLeft: pLeft,
                pRight: pRight
            });

            // Indices
            if (i < curvePoints.length - 1) {
                const base = i * 2;
                // Triangle 1
                indices.push(base, base + 2, base + 1);
                // Triangle 2
                indices.push(base + 1, base + 2, base + 3);
            } else {
                // Close the loop
                const base = i * 2;
                indices.push(base, 0, base + 1);
                indices.push(base + 1, 0, 1);
            }
        }

        // ============ 添加地形凸起 (Bumps) ============
        // 在賽道特定位置加入尖銳的小山丘，讓高速行駛時車輛飛起
        const bumpZones = [
            { center: 0.12, width: 0.008, height: 7 },   // 早期小跳
            { center: 0.30, width: 0.006, height: 5 },   // 中段小跳
            { center: 0.48, width: 0.010, height: 9 },   // 大跳
            { center: 0.62, width: 0.007, height: 6 },   // 後段跳
        ];

        const totalVerts = curvePoints.length;
        for (const bump of bumpZones) {
            for (let i = 0; i < totalVerts; i++) {
                const t = i / totalVerts;
                const dist = Math.abs(t - bump.center);
                if (dist < bump.width) {
                    // 尖銳三角形凸起
                    const factor = 1.0 - (dist / bump.width);
                    const bumpH = bump.height * factor;
                    let bLeftIdx = i * 2;
                    let bRightIdx = i * 2 + 1;
                    vertices[bLeftIdx * 3 + 1] += bumpH;
                    vertices[bRightIdx * 3 + 1] += bumpH;
                }
            }
        }

        const trackGeometry = new THREE.BufferGeometry();
        trackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        trackGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        trackGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        trackGeometry.setIndex(indices);
        // computeVertexNormals might smooth edges too much for a road, but manual normals (0,1,0) are safer for flat shading logic
        // Let's actually recalculate them to be safe for lighting
        trackGeometry.computeVertexNormals();
        trackGeometry.computeBoundingBox();
        trackGeometry.computeBoundingSphere();

        const trackMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222, // Dark asphalt
            roughness: 0.6,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        this.trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
        this.trackMesh.receiveShadow = true;
        this.trackMesh.name = "TrackMesh"; // Helper for debug
        this.scene.add(this.trackMesh);

        // Track Physics Data
        this.trackLength = this.trackCurve.getLength();
        this.carT = 0; // Car's position parameter on curve (0 to 1)

        // 3. 獲取 Raycast 用的 Mesh
        this.collidableMeshes = [this.trackMesh];

        // ============ 建立隧道 ============
        // 假設賽道的 65% 到 75% 之間是隧道
        const tunnelStartIndex = Math.floor(curvePoints.length * 0.65);
        const tunnelEndIndex = Math.floor(curvePoints.length * 0.75);

        const tunnelGeo = new THREE.BufferGeometry();
        const tVerts = [];
        const tIndices = [];
        const tUvs = [];
        const tNormals = [];

        const tunnelRadius = trackWidth * 0.75;
        const archSegments = 16;

        for (let i = tunnelStartIndex; i <= tunnelEndIndex; i++) {
            const layout = this.trackLayout[i];
            if (!layout) continue;
            const p = layout.position;
            const b = layout.binormal.clone().normalize();

            for (let a = 0; a <= archSegments; a++) {
                const angle = Math.PI * (a / archSegments);
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);

                // Position around the curve point
                const archX = p.x - b.x * cosA * tunnelRadius;
                const archY = Math.max(p.y, p.y + sinA * tunnelRadius * 0.7 - 2);
                const archZ = p.z - b.z * cosA * tunnelRadius;

                tVerts.push(archX, archY, archZ);

                // Normal
                const nx = -b.x * cosA;
                const ny = sinA;
                const nz = -b.z * cosA;
                tNormals.push(nx, ny, nz);

                tUvs.push(i % 2, a / archSegments);
            }
        }

        const rings = tunnelEndIndex - tunnelStartIndex;
        for (let i = 0; i < rings; i++) {
            for (let a = 0; a < archSegments; a++) {
                const base = i * (archSegments + 1) + a;
                const nextRow = base + (archSegments + 1);

                // Inside triangles (Counter-clockwise considering we want to see inside)
                tIndices.push(base, nextRow, base + 1);
                tIndices.push(base + 1, nextRow, nextRow + 1);
            }
        }

        tunnelGeo.setAttribute('position', new THREE.Float32BufferAttribute(tVerts, 3));
        tunnelGeo.setAttribute('normal', new THREE.Float32BufferAttribute(tNormals, 3));
        tunnelGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUvs, 2));
        tunnelGeo.setIndex(tIndices);

        // 隧道外牆加上簡單的水泥材質
        const tunnelMat = new THREE.MeshStandardMaterial({
            color: 0x444455,
            metalness: 0.1,
            roughness: 0.9,
            side: THREE.DoubleSide
        });
        const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
        tunnelMesh.castShadow = true;
        tunnelMesh.receiveShadow = true;
        this.scene.add(tunnelMesh);

        // 4. 裝飾 - 創建超大護欄與標誌
        this.createTrackBorders();
        this.createTrackLines();
        this.createSkyBanners();
        // this.createFloorBanners(); // 依需求移除地面圖片
        this.createTreeBanners();
        // this.createRoadDecals(); // 依需求移除地面圖片

        // 5. 起點
        this.createStartLine();

        // 6. 加速帶
        this.createBoostPads();

        // 7. 初始化 Minimap
        this.initMinimap();

        // 8. 戰爭背景與 SpaceX 火箭
        this.createWarzoneAndSpaceX();
    }



    createBoostPads() {
        if (!this.trackLayout) return;

        // 載入加速帶貼圖
        const boostTexture = new THREE.TextureLoader().load('/accelerate.png');
        boostTexture.anisotropy = 16;

        const padGeo = new THREE.PlaneGeometry(30, 20); // 放大加速帶
        const padMat = new THREE.MeshBasicMaterial({
            map: boostTexture,
            transparent: true,
            side: THREE.DoubleSide
        });

        // 在賽道上每隔一段距離放置一個加速帶
        const interval = 80; // 每 80 個片段放置一個
        for (let i = interval; i < this.trackLayout.length; i += interval) {
            const layout = this.trackLayout[i];
            const pad = new THREE.Group();

            // 主底板 - 使用 accelerate.png
            const mesh = new THREE.Mesh(padGeo, padMat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = 0.08; // 稍微高於地面
            pad.add(mesh);

            pad.position.copy(layout.position);
            pad.lookAt(layout.position.clone().sub(layout.tangent)); // 旋轉 180 度

            this.scene.add(pad);
            this.boostPads.push({ mesh: pad, pos: layout.position.clone() });
        }
    }

    createDecals() {
        // Apex Billboards
        this.createApexBillboardAt(0);
        this.createApexBillboardAt(Math.PI);
    }

    createApexBillboardAt(t) {
        // Get position from curve
        if (!this.trackCurve) return;
        const pt = this.trackCurve.getPointAt(t / (Math.PI * 2)); // t is radians, getPointAt takes 0..1

        // Offset outwards
        const tangent = this.trackCurve.getTangentAt(t / (Math.PI * 2));
        const normal = new THREE.Vector3(0, 1, 0);
        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

        // Push out by track width + extra
        const offset = t === 0 ? -1 : 1; // Direction flip might be needed based on curve winding
        // At t=0, moving +z is ... wait.
        // Let's just push away from origin.
        const dirToOrigin = pt.clone().normalize();
        const billboardPos = pt.clone().add(dirToOrigin.multiplyScalar(20)); // Push OUT (away from center? no, push further OUT)
        // Correct logic: At Apex, tangent is along Z (approx). Normal is Y. Binormal is X.
        // We want to move along X (towards +/- infinity).
        // Let's just simple logic:
        const pos = pt.clone();
        pos.x += pos.x > 0 ? 30 : -30; // Push further out in X

        const group = new THREE.Group();
        group.position.copy(pos);
        group.lookAt(pt); // Face the track point

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.5, 0.5, 10);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 5;
        group.add(pole);

        // Board
        const boardGeo = new THREE.BoxGeometry(20, 8, 1);
        // Select random banner for crossover billboard
        const randTex = this.brandingTextures.allBanners[Math.floor(Math.random() * this.brandingTextures.allBanners.length)];
        const boardMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: randTex,
            emissive: 0xffffff,
            emissiveMap: randTex,
            emissiveIntensity: 0.5
        });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.y = 10;
        group.add(board);

        this.scene.add(group);
    }

    // ==================== 賽道標線 ====================
    createTrackLines() {
        // 中央虛線 - 沿著實際賽道曲線放置
        const dashCount = 80;
        const dashLength = 3;
        const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const dashGeo = new THREE.PlaneGeometry(0.3, dashLength);

        for (let i = 0; i < dashCount; i++) {
            const t = i / dashCount;
            const pt = this.trackCurve.getPointAt(t);
            const tangent = this.trackCurve.getTangentAt(t);

            const dash = new THREE.Mesh(dashGeo, dashMaterial);
            dash.position.set(pt.x, pt.y + 0.05, pt.z);
            dash.rotation.x = -Math.PI / 2;
            // 對齊切線方向
            dash.rotation.z = -Math.atan2(tangent.x, tangent.z);

            this.scene.add(dash);
        }
    }

    // ==================== 賽道邊界與超大護欄 ====================
    createTrackBorders() {
        if (!this.trackLayout) return;

        const barrierHeight = 4; // 護欄高度
        const halfWidth = this.trackWidth / 2 + 1.5;

        // 預計算所有材質的寬高比
        const borderBanners = this.brandingTextures.allBanners;
        if (!borderBanners || borderBanners.length === 0) return;

        const bannerData = borderBanners.map(tex => {
            // 若貼圖已載入則取其寬高比，否則預設 2:1
            const aspect = (tex.image && tex.image.width && tex.image.height)
                ? tex.image.width / tex.image.height
                : 2;
            return {
                mat: new THREE.MeshStandardMaterial({
                    map: tex,
                    side: THREE.DoubleSide,
                    roughness: 0.4,
                    metalness: 0.1,
                    envMapIntensity: 0.5
                }),
                aspect: aspect
            };
        });

        const lightGeo = new THREE.SphereGeometry(0.6, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });

        // 每隔一段距離放一個護欄面板，避免重疊閃爍
        const step = 6;
        for (let i = 0; i < this.trackLayout.length; i += step) {
            const layout = this.trackLayout[i];
            const binormal = layout.binormal;  // 指向賽道側方 (垂直於切線和上方向)
            const tangent = layout.tangent;    // 賽道前進方向
            const pt = layout.position;        // 賽道中心點

            const dataIdx = Math.floor(i / step) % bannerData.length;
            const data = bannerData[dataIdx];
            // 面板寬度 = 高度 × 寬高比，讓貼圖不變形
            const panelWidth = barrierHeight * data.aspect;

            // ===== 外側護欄 =====
            const outerPos = pt.clone().add(binormal.clone().multiplyScalar(halfWidth));
            const outerGeo = new THREE.PlaneGeometry(panelWidth, barrierHeight);
            const outerPanel = new THREE.Mesh(outerGeo, data.mat);
            // 面板中心的Y位置：地面 + 半個高度
            outerPanel.position.set(outerPos.x, outerPos.y + barrierHeight / 2, outerPos.z);
            // 面板法線 = 朝向賽道中心（-binormal 方向）
            const outerLookTarget = outerPanel.position.clone().sub(binormal);
            outerPanel.lookAt(outerLookTarget);
            this.scene.add(outerPanel);

            // ===== 內側護欄 =====
            const innerPos = pt.clone().sub(binormal.clone().multiplyScalar(halfWidth));
            const innerGeo = new THREE.PlaneGeometry(panelWidth, barrierHeight);
            const innerPanel = new THREE.Mesh(innerGeo, data.mat);
            innerPanel.position.set(innerPos.x, innerPos.y + barrierHeight / 2, innerPos.z);
            // 面板法線 = 朝向賽道中心（+binormal 方向）
            const innerLookTarget = innerPanel.position.clone().add(binormal);
            innerPanel.lookAt(innerLookTarget);
            this.scene.add(innerPanel);

            // ===== 護欄柱 =====
            if (Math.floor(i / step) % 3 === 0) {
                this.createBarrierPost(outerPos.x, outerPos.y, outerPos.z, 0xdd2222);
                this.createBarrierPost(innerPos.x, innerPos.y, innerPos.z, 0x2244dd);
            }

            // ===== 頂部警示燈（每4個面板一個）=====
            if (Math.floor(i / step) % 4 === 0) {
                const lOuter = new THREE.Mesh(lightGeo, lightMat);
                lOuter.position.set(outerPos.x, outerPos.y + barrierHeight + 0.6, outerPos.z);
                this.scene.add(lOuter);

                const lInner = new THREE.Mesh(lightGeo, lightMat);
                lInner.position.set(innerPos.x, innerPos.y + barrierHeight + 0.6, innerPos.z);
                this.scene.add(lInner);
            }
        }
    }

    // ==================== 賽道地面貼圖 (Decals) ====================
    // ==================== 賽道地面貼圖 (Decals) ====================
    createRoadDecals() {
        if (!this.trackCurve) return;

        const count = 60; // Increased density significantly
        const decalGeo = new THREE.PlaneGeometry(12, 6); // Slightly larger

        // Randomize order or just cycle
        const banners = this.brandingTextures.allBanners;

        for (let i = 0; i < count; i++) {
            // Distribute along the curve
            const t = (i / count);
            const point = this.trackCurve.getPointAt(t);
            const tangent = this.trackCurve.getTangentAt(t);

            const tex = banners[i % banners.length];

            const mat = new THREE.MeshLambertMaterial({
                map: tex,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                side: THREE.DoubleSide // Visible from both sides (though it's on ground)
            });

            const decal = new THREE.Mesh(decalGeo, mat);

            // Position slightly above ground
            decal.position.copy(point);
            decal.position.y += 0.05;

            // Orient flat on ground
            decal.rotation.x = -Math.PI / 2;

            // Rotate to align with track direction?
            // Tangent is direction vector.
            // ATom: If lay flat (RotX -90), the local Y is World Z (or something). 
            // Proper way: LookAt next point, then Rotate X -90.
            const nextPoint = this.trackCurve.getPointAt((t + 0.01) % 1);
            // decal.lookAt(nextPoint.x, decal.position.y, nextPoint.z); // Face forward in Y? No.

            // Manual rotation calc
            const angle = Math.atan2(tangent.x, tangent.z);
            decal.rotation.z = angle + Math.PI / 2; // Rotate 90 deg to span across the road? Or 0 to lie along?
            // User probably wants them to be readable as you drive over? 
            // Usually logos span across the road width (perpendicular to travel).

            this.scene.add(decal);
        }
    }

    // ==================== 彎道廣告牌 ====================
    createApexBillboards() {
        // 在主要切點位置放置發光廣告牌
        const locations = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]; // 四個方位
        const dist = this.trackRadius + 22; // 賽道外側

        locations.forEach((angle, index) => {
            // Cycle through available banners
            const banners = this.brandingTextures.allBanners;
            const texture = banners[index % banners.length];
            const group = new THREE.Group();

            // 位置
            group.position.set(
                Math.cos(angle + 0.2) * dist, // 稍微偏移
                0,
                Math.sin(angle + 0.2) * dist
            );

            // 面向賽道/車輛駛來方向
            // 在此圓形賽道，簡單面向圓心稍微偏一點即可
            group.lookAt(0, 0, 0);

            // 1. 支架
            const poleGeo = new THREE.CylinderGeometry(0.4, 0.4, 6);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = 3;
            group.add(pole);

            // 2. 燈箱本體
            const boxGeo = new THREE.BoxGeometry(14, 5, 1);
            const boxMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: texture,
                emissive: 0xffffff,
                emissiveMap: texture,
                emissiveIntensity: 0.8, // 自發光強度
                roughness: 0.1
            });
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.y = 6;
            group.add(box);

            this.scene.add(group);
        });
    }

    // ==================== 護欄柱 ====================
    createBarrierPost(x, y, z, color) {
        const height = 5;
        const postGeo = new THREE.CylinderGeometry(1.2, 1.2, height, 8);
        const postMat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.5,
            metalness: 0.3
        });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, y + height / 2, z);
        post.castShadow = true;
        this.scene.add(post);
    }

    // ==================== 起點 ====================
    createStartLine() {
        // Simple start line at t=0
        if (!this.trackCurve) return;

        const layout = this.trackLayout[0];
        const pt = layout.position;
        const tangent = layout.tangent;

        const lineGeo = new THREE.PlaneGeometry(20, 2);
        const texture = new THREE.CanvasTexture(this.createCheckerboardCanvas());
        texture.wrapS = THREE.RepeatWrapping;
        texture.repeat.set(4, 1);

        const lineMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const line = new THREE.Mesh(lineGeo, lineMat);

        line.position.copy(pt);
        line.position.y += 0.3;

        // Z 旋轉對齊跑道，然後 X 旋轉讓其平放
        // 我們使用 Quaternion 來進行精確的旋轉疊加
        const angle = Math.atan2(tangent.x, tangent.z);
        const qAngle = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

        // 將兩者結合，先平面旋轉再貼地
        line.quaternion.multiplyQuaternions(qAngle, qFlat);

        this.scene.add(line);
    }

    createCheckerboardCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const squareSize = 16;
        for (let x = 0; x < canvas.width; x += squareSize) {
            for (let y = 0; y < canvas.height; y += squareSize) {
                ctx.fillStyle = ((x + y) / squareSize) % 2 === 0 ? '#ffffff' : '#000000';
                ctx.fillRect(x, y, squareSize, squareSize);
            }
        }
        return canvas;
    }


    // Old stubs - 舊的存根方法已移除，功能已整合到其他地方
    createStartArch() { }

    // ==================== 天空懸浮廣告 ====================
    // ==================== 天空懸浮廣告 ====================
    createSkyBanners() {
        if (!this.trackCurve) return;

        this.skyBannerGroup = new THREE.Group();
        this.scene.add(this.skyBannerGroup);

        const count = 16; // Number of floating banners
        const height = 120; // Higher in the sky

        const curvePoints = this.trackCurve.getSpacedPoints(count);

        for (let i = 0; i < count; i++) {
            // Place them near track points but elevated
            const pt = curvePoints[i];
            const x = pt.x + (Math.random() - 0.5) * 100;
            const z = pt.z + (Math.random() - 0.5) * 100;

            // Texture
            const tex = this.brandingTextures.allBanners[i % this.brandingTextures.allBanners.length];

            // Default size
            const baseHeight = 40;
            const baseWidth = 70;

            // Mesh with dynamic aspect ratio
            const geo = new THREE.PlaneGeometry(1, 1); // Unit square, will scale
            const mat = new THREE.MeshBasicMaterial({
                map: tex,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9
            });
            const mesh = new THREE.Mesh(geo, mat);

            // Function to update scale based on texture
            const updateScale = () => {
                if (tex.image && tex.image.width && tex.image.height) {
                    const aspect = tex.image.width / tex.image.height;
                    mesh.scale.set(baseHeight * aspect, baseHeight, 1);
                } else {
                    mesh.scale.set(baseWidth, baseHeight, 1);
                }
            };

            // Check if already loaded
            if (tex.image && tex.image.width) {
                updateScale();
            } else {
                // Wait for load
                tex.addEventListener('load', updateScale); // Three.js texture event? 
                // Creating a new listener might be tricky if it's already cached.
                // Just in case, set default.
                mesh.scale.set(baseWidth, baseHeight, 1);

                // Poll check? Or just assume standard. 
                // Let's use a simpler heuristic: preset dimensions if known, or just fixed large size.
                // Or better: use a check in the animate loop? No too expensive.
                // Let's just use the image onload callback when we loaded them? Too late.
                // We'll leave the scale default and let ThreeJS handle UV mapping stretch, 
                // UNLESS user specifically wants original aspect ratio. 
                // Correction: The USER wants "original ratio".

                // Let's rely on the image property being available eventually.
                // We can check it later.
            }
            // For now, let's assume valid load or use a safe default. 
            // Better yet, just set UVs to cover? No, that stretches.
            // We want the MESH to be the right shape.

            // Let's try to fetch dimensions immediately if possible.
            // If they are not loaded, we use a 16:9 default.
            if (tex.image) {
                const w = tex.image.width || 16;
                const h = tex.image.height || 9;
                const aspect = w / h;
                mesh.scale.set(baseHeight * aspect, baseHeight, 1);
            } else {
                mesh.scale.set(baseWidth, baseHeight, 1);
            }

            mesh.position.set(x, height, z);
            // 面向賽道中心但保持圖片正向
            mesh.lookAt(0, height, 0);
            this.skyBannerGroup.add(mesh);
        }
    }

    // ==================== 賽道地面橫幅 (大型) ====================
    createFloorBanners() {
        if (!this.trackCurve) return;

        const bannerCount = 10;
        const bannerWidth = 30; // This variable was misplaced in the original snippet, moving it here.
        const bannerHeight = 5; // This variable was misplaced in the original snippet, moving it here.

        for (let i = 0; i < bannerCount; i++) {
            // Position along the curve (skip 0/1 to avoid start line clash if needed, but start line is at 0)
            // Let's offset them a bit: 0.05, 0.15, ...
            const t = (i / bannerCount + 0.05) % 1;

            const point = this.trackCurve.getPointAt(t);
            const tangent = this.trackCurve.getTangentAt(t);

            const group = new THREE.Group();
            group.position.copy(point);
            group.lookAt(point.clone().add(tangent));

            // 1. Pillars (Left/Right)
            const poleGeo = new THREE.CylinderGeometry(0.3, 0.3, 12);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });

            const leftPole = new THREE.Mesh(poleGeo, poleMat);
            leftPole.position.set(-bannerWidth / 2, 6, 0);
            group.add(leftPole);
            // 2. Banner on Floor
            // Use a base height (which is now length along track), and scale width by aspect ratio
            const baseLength = 8; // Length along the track

            // Cycle textures
            const tex = this.brandingTextures.allBanners[i % this.brandingTextures.allBanners.length];

            // Use PlaneGeometry
            const bannerGeo = new THREE.PlaneGeometry(1, 1);
            const bannerMat = new THREE.MeshLambertMaterial({
                map: tex,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -3 // Draw on top of other decals
            });
            const banner = new THREE.Mesh(bannerGeo, bannerMat);

            // Determine Aspect Ratio
            // We want the width to fit the track width (approx 18) if possible, 
            // OR consistent size.
            // Let's make them span the track width mostly.
            // Track width is 18.
            // If we fix width = 16, calculate length based on aspect.
            // Original logic: baseH = 8 (height), calculated width.
            // Now: We want it flat.
            // Let's fix the Width (across track) to be e.g. 14, and let Length (along track) vary?
            // Or fix Length (along track) and let Width vary?
            // Usually logos are wide.
            // Let's keep previous scaling logic but apply to X/Y on floor.

            const baseSize = 20;
            if (tex.image && tex.image.width) {
                const aspect = tex.image.width / tex.image.height;
                // If aspect > 1 (landscape), make it wide across track
                // If aspect < 1 (portrait), make it long along track?
                // Let's just scale strictly by aspect relative to a base "height" (which is Z in floor space? No Y in local space before rotation)

                // Let's just set scale.
                // We rotate X -90. So Local X is World X (Cross track?), Local Y is World -Z (Along track?)
                // Group looks at tangent. So Local Z is along track. Local X is cross track.
                // Wait, default lookAt behavior: Z axis points to target.
                // So Z is Tangent. X is Cross track. Y is Up.

                // We want banner to lie on X-Z plane.
                // We rotate X -90.
                // Original plane is X-Y.
                // Rotate X -90 => Plane becomes X-Z.
                // Local X (width) is still Cross Track.
                // Local Y (height) becomes -Z (Backwards along track).

                // So banner.scale.x is Cross Track Width.
                // banner.scale.y is Along Track Length.

                // We want to limit width to track width ~18.
                let w = baseSize * aspect;
                let h = baseSize;

                // Constrain width
                if (w > 32) {
                    const ratio = 32 / w;
                    w = 32;
                    h = h * ratio;
                }

                banner.scale.set(w, h, 1);
            } else {
                banner.scale.set(32, 16, 1);
            }

            // Lift slightly above ground
            banner.rotation.x = -Math.PI / 2;
            banner.position.y = 0.04;

            group.add(banner);

            this.scene.add(group);
        }
    }

    // ==================== 樹林區域廣告牌 ====================
    createTreeBanners() {
        if (!this.trackCurve) return;
        const curvePoints = this.trackCurve.getSpacedPoints(150);

        // Scatter banners randomly in the environment
        const count = 200;
        const width = 1600;
        const depth = 1600;

        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * width;
            const z = (Math.random() - 0.5) * depth;

            let tooClose = false;
            for (const pt of curvePoints) {
                const dx = x - pt.x;
                const dz = z - pt.z;
                if (dx * dx + dz * dz < 1225) { // 35 units distance sq
                    tooClose = true;
                    break;
                }
            }

            if (tooClose) continue;

            const group = new THREE.Group();
            group.position.set(x, 0, z);

            // Random rotation
            group.rotation.y = Math.random() * Math.PI * 2;

            // 1. Pole
            const poleGeo = new THREE.CylinderGeometry(0.3, 0.3, 10);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = 5;
            group.add(pole);

            // 2. Banner Board
            const tex = this.brandingTextures.allBanners[i % this.brandingTextures.allBanners.length];

            // Use PlaneGeometry
            const boardGeo = new THREE.PlaneGeometry(1, 1);
            const boardMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
            const board = new THREE.Mesh(boardGeo, boardMat);

            // Aspect
            if (tex.image && tex.image.width) {
                const aspect = tex.image.width / tex.image.height;
                board.scale.set(8 * aspect, 8, 1);
            } else {
                board.scale.set(12, 8, 1);
            }

            board.position.y = 9; // Top of pole
            group.add(board);

            this.scene.add(group);
        }
    }

    // ==================== 創建車輛 ====================
    createCar() {
        this.car = new THREE.Group();

        // 載入車身貼圖
        const carPicTexture = new THREE.TextureLoader().load('/carpic.png');
        carPicTexture.anisotropy = 16;

        // 車身主體 - 流線型設計
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            metalness: 0.9,
            roughness: 0.1
        });

        // 主車身 - 卡丁車造型 (Taller Kart)
        const bodyGeo = new THREE.BoxGeometry(1.4, 0.5, 3.5);

        // 車身貼圖材質
        const carPicMat = new THREE.MeshStandardMaterial({
            map: carPicTexture,
            metalness: 0.6,
            roughness: 0.3
        });

        // BoxGeometry 6個面的順序: +X, -X, +Y, -Y, +Z, -Z
        const bodyMaterials = [
            carPicMat,      // 右側 (+X)
            carPicMat,      // 左側 (-X)
            carPicMat,      // 頂面 (+Y)
            bodyMaterial,   // 底面 (-Y)
            bodyMaterial,   // 前面 (+Z)
            carPicMat       // 後面 (-Z)
        ];
        const body = new THREE.Mesh(bodyGeo, bodyMaterials);
        body.position.y = 0.6; // 較高底盤
        body.castShadow = true;
        this.car.add(body);

        // 側裙 (Side Pods)
        const sidePodGeo = new THREE.BoxGeometry(2.4, 0.4, 1.8);
        const sidePod = new THREE.Mesh(sidePodGeo, bodyMaterial);
        sidePod.position.set(0, 0.6, 0.2);
        sidePod.castShadow = true;
        this.car.add(sidePod);

        // 駕駛座靠背 (Taller Seat)
        const seatGeo = new THREE.BoxGeometry(1.0, 1.4, 0.6);
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.set(0, 1.3, -0.6);
        seat.castShadow = true;
        this.car.add(seat);

        // 卡丁車前鼻翼 (Front Nose)
        const noseGeo = new THREE.BoxGeometry(1.2, 0.3, 1.5);
        const nose = new THREE.Mesh(noseGeo, carPicMat);
        nose.position.set(0, 0.5, 2.0);
        nose.rotation.x = 0.3; // 向下傾斜
        nose.castShadow = true;
        this.car.add(nose);

        // 後置引擎部
        const engineGeo = new THREE.BoxGeometry(1.2, 0.8, 1.0);
        const engineMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        const engine = new THREE.Mesh(engineGeo, engineMat);
        engine.position.set(0, 0.9, -1.8);
        engine.castShadow = true;
        this.car.add(engine);

        // 卡丁車排氣管 (Exhaust Pipes)
        const pipeGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 16);
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 1.0 });
        const pipeL = new THREE.Mesh(pipeGeo, pipeMat);
        pipeL.rotation.x = Math.PI / 2 + 0.3;
        pipeL.position.set(-0.4, 1.3, -2.4);

        const pipeR = new THREE.Mesh(pipeGeo, pipeMat);
        pipeR.rotation.x = Math.PI / 2 + 0.3;
        pipeR.position.set(0.4, 1.3, -2.4);
        this.car.add(pipeL);
        this.car.add(pipeR);

        // 卡丁車旗幟 (Flag)
        const flagPoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8);
        const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
        const flagPole = new THREE.Mesh(flagPoleGeo, flagPoleMat);
        flagPole.position.set(-0.8, 2.5, -2.0); // 左後方高處
        this.car.add(flagPole);

        const flagGeo = new THREE.PlaneGeometry(1.2, 0.8);
        const flagMat = new THREE.MeshBasicMaterial({ map: carPicTexture, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(-0.2, 3.3, -2.0); // 旗幟本體在旗桿右側
        this.car.add(flag);

        // 車輪 - Bigger and wider
        this.wheels = [];
        const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.55, 32);
        const wheelMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.8,
            metalness: 0.2
        });

        const wheelPositions = [
            { x: -1.3, y: 0.65, z: 1.5 },   // 前左
            { x: 1.3, y: 0.65, z: 1.5 },    // 前右
            { x: -1.3, y: 0.65, z: -1.5 },  // 後左
            { x: 1.3, y: 0.65, z: -1.5 }    // 後右
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.castShadow = true;
            this.wheels.push(wheel);
            this.car.add(wheel);
        });

        // 車尾燈
        const tailLightGeo = new THREE.BoxGeometry(0.3, 0.15, 0.1);
        const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        const leftTail = new THREE.Mesh(tailLightGeo, tailLightMat);
        leftTail.position.set(-0.8, 0.6, -2.55);
        this.car.add(leftTail);

        const rightTail = new THREE.Mesh(tailLightGeo, tailLightMat);
        rightTail.position.set(0.8, 0.6, -2.55);
        this.car.add(rightTail);

        // 頭燈
        const headLightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
        const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });

        const leftHead = new THREE.Mesh(headLightGeo, headLightMat);
        leftHead.position.set(-0.8, 0.6, 2.55);
        this.car.add(leftHead);

        const rightHead = new THREE.Mesh(headLightGeo, headLightMat);
        rightHead.position.set(0.8, 0.6, 2.55);
        this.car.add(rightHead);

        // 霓虹底盤燈
        const glowGeo = new THREE.BoxGeometry(2, 0.1, 4);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x00f2ff,
            transparent: true,
            opacity: 0.6
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 0.15;
        this.car.add(glow);

        // 設置初始位置（賽道上）
        // 設置初始位置 - Use getPoint(0)
        const startPos = this.trackCurve ? this.trackCurve.getPoint(0) : new THREE.Vector3(0, 0, 0);
        this.car.position.copy(startPos);
        this.car.position.y += 1.0; // Raise slightly to avoid clipping ground
        this.car.rotation.order = 'YXZ'; // Important for slope

        // Initial rotation: look at tangent
        if (this.trackCurve) {
            const t = this.trackCurve.getTangent(0);
            this.car.lookAt(startPos.clone().add(t));
            this.carAngle = this.car.rotation.y;
        }

        this.scene.add(this.car);

        // 初始化相機位置在車輛後方
        this.camera.position.set(this.trackRadius, 6, -10 - 12);  // 車輛後方 12 單位
    }

    // ==================== 創建 NPC 競爭者 ====================
    createBots() {
        if (!this.trackCurve) return;

        const botConfigs = [
            { color: 0xff3333, startT: 0.02, offset: -8 },   // 紅色
            { color: 0x33ff33, startT: 0.04, offset: 8 },    // 綠色
            { color: 0x3388ff, startT: 0.06, offset: -4 },   // 藍色
            { color: 0xffaa00, startT: 0.08, offset: 4 },    // 橙色
            { color: 0xff33ff, startT: 0.10, offset: -12 },  // 紫色
            { color: 0x00ffcc, startT: 0.12, offset: 12 },   // 青綠色
            { color: 0xffff33, startT: 0.14, offset: -1 },   // 黃色
            { color: 0xff6633, startT: 0.16, offset: 0 },    // 橘紅色
            { color: 0x33ffff, startT: 0.18, offset: -15 },  // 水色
            { color: 0xcc33ff, startT: 0.20, offset: 15 },   // 深紫色
        ];

        for (const cfg of botConfigs) {
            const bot = new BotCar(
                this.scene,
                this.trackCurve,
                this.trackWidth,
                cfg.color,
                cfg.startT,
                cfg.offset
            );
            // 初始化 NPC 位置到賽道上正確的高度
            const initPos = this.trackCurve.getPointAt(cfg.startT);
            bot.mesh.position.y = initPos.y + 1;
            bot.carVelocityY = 0;
            this.bots.push(bot);
        }
    }

    // ==================== 創建環境 ====================
    createEnvironment() {
        // 地面 - 綠色草地（與深色柏油賽道區分）
        const groundGeo = new THREE.PlaneGeometry(6000, 6000);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x3a7d44,
            roughness: 0.95,
            metalness: 0
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 天空球 - 日間藍天
        const skyGeo = new THREE.SphereGeometry(900, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x4a90d9) },
                bottomColor: { value: new THREE.Color(0x87CEEB) },
                horizonColor: { value: new THREE.Color(0xd4e8f7) }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform vec3 horizonColor;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition).y;
                    vec3 col;
                    if (h > 0.3) {
                        col = mix(horizonColor, topColor, (h - 0.3) / 0.7);
                    } else if (h > 0.0) {
                        col = mix(horizonColor, horizonColor, h / 0.3);
                    } else {
                        col = mix(horizonColor, bottomColor, -h);
                    }
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        // 城市建築裝飾
        this.createScenery();
    }

    // 日間模式不需要星星
    createStars() {
        // 日間模式 - 不顯示星星
    }

    // ==================== 場景裝飾 (城市建築) ====================
    createScenery() {
        if (!this.trackCurve) return;
        const curvePoints = this.trackCurve.getSpacedPoints(150);

        // 在賽道周圍放置城市建築
        for (let i = 0; i < 300; i++) {
            const x = (Math.random() - 0.5) * 1800;
            const z = (Math.random() - 0.5) * 1800;

            let tooClose = false;
            for (const pt of curvePoints) {
                const dx = x - pt.x;
                const dz = z - pt.z;
                if (dx * dx + dz * dz < 1600) { // 40 units
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                this.createBuilding(x, z);
            }
        }
    }

    // ==================== 創建建築 ====================
    createBuilding(x, z) {
        const building = new THREE.Group();

        // 隨機建築尺寸
        const width = 4 + Math.random() * 10;
        const depth = 4 + Math.random() * 10;
        const height = 10 + Math.random() * 60;

        // 建築主體
        const bodyGeo = new THREE.BoxGeometry(width, height, depth);
        const shade = 0.55 + Math.random() * 0.3;
        const tint = Math.random();
        const bodyMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(
                shade * (0.85 + tint * 0.15),
                shade * (0.85 + tint * 0.1),
                shade * (0.9 + tint * 0.1)
            ),
            roughness: 0.7,
            metalness: 0.1
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = height / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        building.add(body);

        // 窗戶燈光 - 在建築側面加發光小方塊
        const windowColors = [0x88ccff, 0xaaddff, 0x99bbdd, 0xc0e0ff];
        const windowMat = new THREE.MeshStandardMaterial({
            color: windowColors[Math.floor(Math.random() * windowColors.length)],
            metalness: 0.9,
            roughness: 0.1
        });

        const windowRows = Math.floor(height / 3);
        const windowCols = Math.floor(width / 2.5);
        const windowGeo = new THREE.PlaneGeometry(1.0, 1.2);

        for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
                if (Math.random() > 0.4) { // 60% 的窗戶亮燈
                    const wy = 2 + row * 3;
                    const wx = -width / 2 + 1.5 + col * 2.5;

                    // 前側
                    const wFront = new THREE.Mesh(windowGeo, windowMat);
                    wFront.position.set(wx, wy, depth / 2 + 0.01);
                    building.add(wFront);

                    // 後側
                    const wBack = new THREE.Mesh(windowGeo, windowMat);
                    wBack.position.set(wx, wy, -depth / 2 - 0.01);
                    wBack.rotation.y = Math.PI;
                    building.add(wBack);
                }
            }
        }

        // 屋頂航空燈 (高樓才有)
        if (height > 35) {
            const lightGeo = new THREE.SphereGeometry(0.4, 8, 8);
            const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const topLight = new THREE.Mesh(lightGeo, lightMat);
            topLight.position.y = height + 0.5;
            building.add(topLight);
        }

        building.position.set(x, 0, z);
        building.rotation.y = Math.random() * Math.PI * 0.5;
        this.scene.add(building);
    }

    // ==================== 創建 HUD ====================
    createHUD() {
        // 速度顯示
        this.speedElement = document.getElementById('speed-value');
        this.lapElement = document.getElementById('lap-value');
        this.timeElement = document.getElementById('time-value');
        this.rankElement = document.getElementById('rank-value');

        // 如果 DOM 元素不存在，創建它們
        if (!this.speedElement) {
            this.createHUDElements();
        }

        // Minimap
        this.minimapCanvas = document.getElementById('minimap');
        if (this.minimapCanvas) {
            this.minimapCtx = this.minimapCanvas.getContext('2d');
        }
    }

    initMinimap() {
        if (!document.getElementById('minimap-container')) {
            const container = document.createElement('div');
            container.id = 'minimap-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 150px;
                height: 150px;
                background: rgba(0,0,0,0.5);
                border: 2px solid #E31E26;
                border-radius: 50%;
                overflow: hidden;
            `;

            const canvas = document.createElement('canvas');
            canvas.id = 'minimap';
            canvas.width = 150;
            canvas.height = 150;
            container.appendChild(canvas);

            document.body.appendChild(container);

            this.minimapCanvas = canvas;
            this.minimapCtx = canvas.getContext('2d');
        }
    }

    updateMinimap() {
        if (!this.minimapCtx || !this.trackCurve) return;

        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // Draw Track
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 10;
        ctx.beginPath();

        const points = this.trackCurve.getPoints(100);
        // Track bounds are approx -550 to 500. Minimap is 150x150.
        const scale = 0.12;
        const cx = w / 2;
        const cy = h / 2;

        points.forEach((p, i) => {
            const mx = cx + p.x * scale;
            const my = cy + p.z * scale; // Map Z to Y
            if (i === 0) ctx.moveTo(mx, my);
            else ctx.lineTo(mx, my);
        });

        ctx.stroke();

        // Draw Bots
        if (this.bots) {
            ctx.fillStyle = '#1E88E5'; // 藍色代表其他車輛
            this.bots.forEach(bot => {
                if (!bot.mesh) return;
                const bPos = bot.mesh.position;
                ctx.beginPath();
                ctx.arc(cx + bPos.x * scale, cy + bPos.z * scale, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw Player Car On Top
        const carPos = this.car.position;
        ctx.fillStyle = '#E31E26'; // 紅色代表玩家
        ctx.beginPath();
        ctx.arc(cx + carPos.x * scale, cy + carPos.z * scale, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    createHUDElements() {
        const hudContainer = document.createElement('div');
        hudContainer.id = 'game-hud';
        hudContainer.innerHTML = `
            <div class="hud-item speed-display">
                <span id="speed-value">0</span>
                <span class="hud-label">KM/H</span>
            </div>
            <div class="hud-item rank-display">
                <span class="hud-label">RANK</span>
                <span id="rank-value">1</span> / ${10 + 1}
            </div>
            <div class="hud-item lap-display">
                <span class="hud-label">LAP</span>
                <span id="lap-value">1</span> / ${this.maxLaps}
            </div>
            <div class="hud-item time-display">
                <span class="hud-label">TIME</span>
                <span id="time-value">00:00.00</span>
            </div>
        `;
        document.body.appendChild(hudContainer);

        this.speedElement = document.getElementById('speed-value');
        this.lapElement = document.getElementById('lap-value');
        this.timeElement = document.getElementById('time-value');
        this.rankElement = document.getElementById('rank-value');
    }

    // ==================== 輸入處理 ====================
    setupInput() {
        // 鍵盤控制
        document.addEventListener('keydown', (e) => {
            if (this.paused && e.key !== 'Escape') return;

            switch (e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    console.log("Forward Key Pressed");
                    this.keys.forward = true;
                    break;
                case 's':
                case 'arrowdown':
                    this.keys.backward = true;
                    break;
                case 'a':
                case 'arrowleft':
                    this.keys.left = true;
                    break;
                case 'd':
                case 'arrowright':
                    this.keys.right = true;
                    break;
                case 'escape':
                    this.togglePause();
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    this.keys.forward = false;
                    break;
                case 's':
                case 'arrowdown':
                    this.keys.backward = false;
                    break;
                case 'a':
                case 'arrowleft':
                    this.keys.left = false;
                    break;
                case 'd':
                case 'arrowright':
                    this.keys.right = false;
                    break;
            }
        });

        // 檢測是否為觸控設備
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            this.setupTouchControls();
        }
    }

    // ==================== 觸控控制（手機支援）====================
    setupTouchControls() {
        // 手機模式啟用自動加速
        this.mobileAutoAccelerate = true;
        this.joystickTurn = 0; // -1 (left) to 1 (right)

        // 創建觸控控制容器 - 搖桿
        const touchContainer = document.createElement('div');
        touchContainer.id = 'touch-controls';
        touchContainer.innerHTML = `
            <div id="joystick-zone">
                <div id="joystick-base">
                    <div id="joystick-knob"></div>
                </div>
            </div>
            <div id="touch-info">
                <span>🏎️ 自動加速中</span>
            </div>
        `;
        document.body.appendChild(touchContainer);

        // 添加觸控控制樣式
        const style = document.createElement('style');
        style.textContent = `
            #touch-controls {
                position: fixed;
                bottom: 30px;
                left: 30px;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                pointer-events: none;
                z-index: 1000;
            }
            
            #joystick-zone {
                width: 200px;
                height: 150px;
                display: flex;
                justify-content: flex-start;
                align-items: center;
                pointer-events: auto;
                touch-action: none; /* Prevent scrolling */
            }
            
            #joystick-base {
                width: 200px;
                height: 60px;
                background: rgba(0, 255, 136, 0.2);
                border: 2px solid rgba(0, 255, 136, 0.5);
                border-radius: 30px;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            #joystick-knob {
                width: 60px;
                height: 60px;
                background: rgba(0, 255, 136, 0.8);
                border-radius: 50%;
                position: absolute;
                box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
                transition: transform 0.1s;
                left: 50%;
                transform: translateX(-50%);
            }
            
            #touch-info {
                margin-top: 20px;
                background: rgba(0, 0, 0, 0.5);
                padding: 5px 15px;
                border-radius: 15px;
                border: 1px solid rgba(0, 255, 136, 0.3);
            }
            
            #touch-info span {
                color: #00ff88;
                font-size: 12px;
                font-weight: bold;
            }
            
            @media (min-width: 768px) and (hover: hover) {
                #touch-controls {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);

        // 搖桿邏輯
        const joystickZone = document.getElementById('joystick-zone');
        const joystickKnob = document.getElementById('joystick-knob');
        const maxRadius = 70; // (200 - 60) / 2 = 70. max drag distance
        let touchStartX = 0;
        let isDragging = false;

        const resetJoystick = () => {
            isDragging = false;
            this.joystickTurn = 0;
            joystickKnob.style.transform = `translateX(-50%)`;
            joystickKnob.style.left = '50%';
        };

        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDragging = true;
            touchStartX = e.touches[0].clientX;
        }, { passive: false });

        joystickZone.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();

            let currentX = e.touches[0].clientX;
            let deltaX = currentX - touchStartX;

            // limit to maxRadius
            if (deltaX > maxRadius) deltaX = maxRadius;
            if (deltaX < -maxRadius) deltaX = -maxRadius;

            this.joystickTurn = deltaX / maxRadius; // -1 to 1

            joystickKnob.style.transform = 'none'; // reset translateX
            joystickKnob.style.left = `calc(50% + ${deltaX}px - 30px)`; // -30px to center the 60px knob on the point
        }, { passive: false });

        joystickZone.addEventListener('touchend', () => {
            resetJoystick();
        });

        joystickZone.addEventListener('touchcancel', () => {
            resetJoystick();
        });
    }

    // ==================== 顯示選單 ====================
    showMenu() {
        const menu = document.getElementById('menu');
        const startBtn = document.getElementById('start-btn');

        if (menu) {
            menu.style.display = 'flex';
        }

        if (startBtn) {
            startBtn.onclick = () => this.startGame();
        }
    }

    // ==================== 開始遊戲 ====================
    startGame() {
        const menu = document.getElementById('menu');
        if (menu) {
            menu.style.display = 'none';
        }

        // Start Audio Context on user gesture
        if (this.soundManager) {
            this.soundManager.init();
            this.soundManager.startEngine();
        }

        // Ensure game has focus for keyboard input
        window.focus();

        // 倒計時
        // 倒計時
        this.showCountdown(() => {
            console.log("Countdown finished, GAME START!");
            this.started = true;
            this.clock.start();
            console.log("Game Clock Started. Initial Time:", this.gameTime);
        });
    }

    // ==================== 倒計時 ====================
    // ==================== 倒計時 ====================
    showCountdown(callback) {
        const overlay = document.createElement('div');
        overlay.id = 'countdown-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100 %;
            height: 100 %;
            display: flex;
            justify - content: center;
            align - items: center;
            font - size: 150px;
            font - weight: bold;
            color: #00ff88;
            text - shadow: 0 0 30px #00ff88;
            z - index: 1000;
            pointer - events: none;
            transition: transform 0.2s;
            `;
        document.body.appendChild(overlay);

        let count = 3;

        const updateCount = () => {
            if (count > 0) {
                overlay.textContent = count;
                overlay.style.transform = 'scale(1.5)';
                setTimeout(() => overlay.style.transform = 'scale(1)', 100);
                count--;
            } else {
                overlay.textContent = 'GO!';
                overlay.style.transform = 'scale(1.5)';
                setTimeout(() => overlay.style.transform = 'scale(1)', 100);

                clearInterval(this.countInterval);
                setTimeout(() => {
                    overlay.remove();
                    if (callback) callback();
                }, 800);
            }
        };

        // Run immediately
        updateCount();
        this.countInterval = setInterval(updateCount, 1000);
    }

    // ==================== 暫停切換 ====================
    togglePause() {
        this.paused = !this.paused;
    }

    // ==================== 更新車輛 ====================
    updateCar(dt) {
        if (!this.started || this.paused) return;

        // 加速/減速
        // 手機自動加速
        const shouldAccelerate = this.keys.forward || this.mobileAutoAccelerate;

        // 加速帶效果累加
        let effectiveMaxSpeed = this.maxSpeed;
        let effectiveAcceleration = this.acceleration;
        if (this.playerBoostTimer > 0) {
            this.playerBoostTimer -= dt;
            effectiveMaxSpeed = this.maxSpeed * 2.2; // 玩家加速更猛
            effectiveAcceleration = this.acceleration * 3;
            if (this.carSpeed < effectiveMaxSpeed * 0.7) this.carSpeed = effectiveMaxSpeed * 0.7;
        }

        if (shouldAccelerate) {
            this.carSpeed += effectiveAcceleration * dt;
            if (this.carSpeed > 0 && this.carSpeed < 1) console.log("Car Speeding up:", this.carSpeed);
            if (this.carSpeed > effectiveMaxSpeed) this.carSpeed = effectiveMaxSpeed;
        } else if (this.keys.backward) {
            this.carSpeed -= effectiveAcceleration * 1.5 * dt;
            if (this.carSpeed < -effectiveMaxSpeed * 0.4) this.carSpeed = -effectiveMaxSpeed * 0.4;
        } else {
            // 自然減速
            this.carSpeed *= 0.98;
            if (Math.abs(this.carSpeed) < 0.5) this.carSpeed = 0;
        }

        // 轉向（只有在移動時才能轉向）
        if (Math.abs(this.carSpeed) > 1) {
            const turnDirection = this.carSpeed > 0 ? 1 : -1;

            if (this.keys.left) {
                this.carAngle += this.handling * dt * turnDirection;
            }
            if (this.keys.right) {
                this.carAngle -= this.handling * dt * turnDirection;
            }
            if (this.joystickTurn) {
                // this.joystickTurn 是 -1 到 1 之間的值
                this.carAngle -= this.joystickTurn * this.handling * dt * turnDirection;
            }
        }

        // Update Car Position Physics
        this.updateCarPhysics(dt);

        // Update Engine Sound
        if (this.soundManager) {
            this.soundManager.updateEngine(this.carSpeed, this.maxSpeed);
        }
    }

    updateCarPhysics(dt) {
        // 1. Move Car in X/Z based on speed/angle
        const moveX = Math.sin(this.carAngle) * this.carSpeed * dt;
        const moveZ = Math.cos(this.carAngle) * this.carSpeed * dt;

        // Candidate position
        const nextPos = this.car.position.clone();
        nextPos.x += moveX;
        nextPos.z += moveZ;

        let bestT = this.carT;
        let minDistSq = 0;

        // 2. Track Constraint (Keep on track)
        // Find the closest point on curve near current carT
        // We assume the car moves forward/backward along the track mostly
        // Optimize: scan small window around carT
        if (this.trackCurve && this.trackLength > 0) {
            const range = 0.05; // Search range (5% of track)
            minDistSq = Infinity;
            const samples = 20;

            // Search direction based on speed to optimize
            const dir = this.carSpeed >= 0 ? 1 : -1;
            const startT = this.carT - (dir < 0 ? range : range * 0.2);

            for (let i = 0; i <= samples; i++) {
                let t = startT + (i / samples) * range;
                // Wrap t
                if (t < 0) t += 1;
                if (t > 1) t -= 1;

                const pt = this.trackCurve.getPointAt(t);
                // Compare only XZ distance (ignore Y for finding path projection)
                const dx = nextPos.x - pt.x;
                const dz = nextPos.z - pt.z;
                const dSq = dx * dx + dz * dz;

                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    bestT = t;
                }
            }
        }

        // Check for lap completion
        // If we jumped from high T (e.g. 0.95) to low T (e.g. 0.05), we completed a lap forward
        if (this.carT > 0.9 && bestT < 0.1) {
            this.lap++;
            if (this.lap > this.maxLaps) {
                this.lap = this.maxLaps;
                this.gameFinished();
            }
        }
        // If we went backward across finish line (0.05 -> 0.95), decrement lap?
        // Usually not needed unless we want to prevent cheating. 
        // Simple check: don't decrement below 1.
        else if (this.carT < 0.1 && bestT > 0.9) {
            if (this.lap > 1) this.lap--;
        }

        this.carT = bestT;

        const curvePt = this.trackCurve.getPointAt(this.carT);

        // Constrain width
        const limit = this.trackWidth / 2 - 2; // Margin for car size
        const distFromCurve = Math.sqrt(minDistSq); // XZ distance

        if (distFromCurve > limit) {
            // Determine direction from curve to car (XZ only)
            const dx = nextPos.x - curvePt.x;
            const dz = nextPos.z - curvePt.z;
            const angle = Math.atan2(dz, dx); // Angle from curve center to car

            // Clamp position
            nextPos.x = curvePt.x + Math.cos(angle) * limit;
            nextPos.z = curvePt.z + Math.sin(angle) * limit;

            // Reduce speed slightly on wall hit
            this.carSpeed *= 0.95;
        }

        // Apply updates
        this.car.position.x = nextPos.x;
        this.car.position.z = nextPos.z;

        // 套用反彈偏移並逐漸衰減
        if (this.pushOffset) {
            this.car.position.add(this.pushOffset);
            this.pushOffset.multiplyScalar(0.9);
            if (this.pushOffset.length() < 0.01) this.pushOffset.set(0, 0, 0);
        }

        // 3. Update Y Position (Raycast + Fallback)
        this.updateCarHeight(dt, curvePt);

        // 4. Update Rotation
        // We set carAngle based on rotation.y to keep it in sync
        this.car.rotation.y = this.carAngle;

        // Wheels
        const wheelRotation = this.carSpeed * dt * 0.35; // Adjusted for larger wheels
        this.wheels.forEach(wheel => {
            wheel.rotation.x += wheelRotation;
        });
    }

    updateCarHeight(dt, curvePt) {
        this.raycaster = this.raycaster || new THREE.Raycaster();

        const oldY = this.car.position.y;

        // 應用重力
        this.carVelocityY += this.gravity * dt;
        this.car.position.y += this.carVelocityY * dt;

        // Raycast down from high up
        const rayOrigin = this.car.position.clone();
        rayOrigin.y = 300;
        this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));

        const hits = this.raycaster.intersectObject(this.trackMesh);

        // 找到最接近車輛 XZ 平面下方的路面
        let validHit = null;
        if (hits.length > 0) {
            let bestDist = Infinity;
            for (const hit of hits) {
                // 選擇離車輛當前高度最近的、且在車輛下方的路面
                const hitY = hit.point.y;
                if (hitY <= this.car.position.y + 2) { // 允許略高於車輛（剛起飛時）
                    const dist = Math.abs(hitY - this.car.position.y);
                    if (dist < bestDist) {
                        bestDist = dist;
                        validHit = hit;
                    }
                }
            }
            // 如果沒找到，找任何最近的
            if (!validHit) {
                for (const hit of hits) {
                    const dist = Math.abs(hit.point.y - curvePt.y);
                    if (dist < bestDist) {
                        bestDist = dist;
                        validHit = hit;
                    }
                }
            }
        }

        let floorY = curvePt.y;
        if (validHit) {
            floorY = validHit.point.y;
        }

        const isGrounded = this.car.position.y <= floorY + 0.3;

        if (isGrounded) {
            this.car.position.y = floorY;

            // 使用賽道切線計算坡度帶來的向上速度
            const tangent = this.trackCurve.getTangentAt(this.carT);
            const slopeY = tangent.y; // 切線的 Y 分量
            const horizontalLen = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
            const slopeAngle = Math.atan2(slopeY, horizontalLen); // 坡度角

            // 車速產生的向上分量 = 前進速度 × sin(坡度角)
            const launchVelY = Math.abs(this.carSpeed) * Math.sin(slopeAngle);

            // 動量混合：保留 60% 上幀慣性 + 40% 坡度計算的新速度
            // 這確保上坡累積的速度不會在峰頂突然消失
            if (launchVelY > 0) {
                this.carVelocityY = Math.max(
                    this.carVelocityY * 0.6 + launchVelY * 0.4,
                    launchVelY
                );
            } else if (this.carVelocityY > 8) {
                // 地形開始下降但車仍有向上動量 → 起飛！
                this.car.position.y = floorY + 1.0; // 脫離地面
                // 保持 carVelocityY 不變，讓它自然飛
            } else if (this.carVelocityY < -20) {
                // 重落地
                this.carVelocityY *= -0.15;
                if (this.camera) this.camera.position.y -= 1.5;
            } else {
                this.carVelocityY = launchVelY;
            }

            // 對齊法線
            if (validHit) {
                const n = validHit.face.normal.clone();
                const targetRot = new THREE.Object3D();
                targetRot.position.copy(this.car.position);
                const fwd = new THREE.Vector3(Math.sin(this.carAngle), 0, Math.cos(this.carAngle));
                const fwdProj = fwd.clone().sub(n.clone().multiplyScalar(fwd.dot(n))).normalize();
                if (fwdProj.lengthSq() > 0.01) {
                    targetRot.up.copy(n);
                    targetRot.lookAt(targetRot.position.clone().add(fwdProj));
                    this.car.quaternion.slerp(targetRot.quaternion, 0.3);
                }
            } else {
                this.alignFallback(curvePt);
            }
        } else {
            // ✈️ 在空中飛行！
            const targetRot = new THREE.Object3D();
            targetRot.position.copy(this.car.position);
            // 車頭俯仰 = 垂直速度的比例
            const pitchDown = Math.max(-0.8, this.carVelocityY * 0.015);
            const fwd = new THREE.Vector3(
                Math.sin(this.carAngle),
                pitchDown,
                Math.cos(this.carAngle)
            ).normalize();
            targetRot.lookAt(targetRot.position.clone().add(fwd));
            this.car.quaternion.slerp(targetRot.quaternion, 0.08);
        }
    }

    alignFallback(curvePt) {
        const targetRot = new THREE.Object3D();
        targetRot.position.copy(this.car.position);
        const fwd = new THREE.Vector3(Math.sin(this.carAngle), 0, Math.cos(this.carAngle));
        targetRot.lookAt(targetRot.position.clone().add(fwd));
        this.car.quaternion.slerp(targetRot.quaternion, 0.1);
    }

    resetCar() {
        this.carSpeed = 0;
        this.carT = 0; // Reset track progress

        if (this.trackCurve) {
            const pt = this.trackCurve.getPointAt(0);
            const tangent = this.trackCurve.getTangentAt(0);

            this.car.position.copy(pt);
            this.car.position.y += 2;
            this.car.lookAt(pt.clone().add(tangent));
            this.carAngle = Math.atan2(tangent.x, tangent.z);

            // Reset Physics
            if (this.car) {
                this.car.rotation.x = 0;
                this.car.rotation.z = 0;
            }
        } else {
            this.car.position.set(0, 5, 0);
        }
    }

    keepCarOnTrack() { }

    updateCamera() {
        const cameraDistance = 12;
        const cameraHeight = 6;

        // Ensure car's world matrix is up to date this frame
        this.car.updateMatrixWorld(true);

        // Define offset relative to the car (Local Space)
        // Local +Z is forward, +Y is up. So behind is -Z.
        const localOffset = new THREE.Vector3(0, cameraHeight, -cameraDistance);
        const idealPos = localOffset.applyMatrix4(this.car.matrixWorld);

        // Smoothly interpolate camera position
        this.camera.position.lerp(idealPos, 0.1);

        // Define look target relative to the car
        const localLookTarget = new THREE.Vector3(0, 1.5, 10); // slightly up & ahead
        const idealLookAt = localLookTarget.applyMatrix4(this.car.matrixWorld);

        this.camera.lookAt(idealLookAt);
    }

    updateHUD(dt) {
        this.updateMinimap();

        // 速度
        const speedKmh = Math.abs(Math.round(this.carSpeed * 3.6));
        if (this.speedElement) {
            this.speedElement.textContent = speedKmh;
        }

        // 圈數
        if (this.lapElement) {
            this.lapElement.textContent = this.lap;
        }

        // 時間
        if (this.started && this.timeElement) {
            // Use dt passed from animate loop to accumulate time
            // Do NOT call getDelta() here as it resets the clock for the next frame
            this.gameTime += dt;

            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            const ms = Math.floor((this.gameTime % 1) * 100);
            this.timeElement.textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')} `;
        }

        // 排名計算
        if (this.started && this.rankElement) {
            const playerProgress = this.lap + this.carT;
            let rank = 1;
            this.bots.forEach(bot => {
                const botProgress = bot.lap + bot.carT;
                if (botProgress > playerProgress) rank++;
            });
            this.rankElement.textContent = rank;
        }
    }

    gameFinished() {
        this.started = false;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100 %;
            height: 100 %;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            flex - direction: column;
            justify - content: center;
            align - items: center;
            color: #00ff88;
            font - family: 'Orbitron', sans - serif;
            z - index: 2000;
            `;

        const title = document.createElement('h1');
        title.textContent = 'FINISHED!';
        title.style.fontSize = '80px';
        title.style.textShadow = '0 0 20px #00ff88';
        title.style.marginBottom = '20px';

        const finalRank = this.rankElement ? parseInt(this.rankElement.textContent) : 1;
        const totalCars = (this.bots ? this.bots.length : 10) + 1;

        let messageWord = '';
        let rankColor = '#ffffff';
        if (finalRank === 1) {
            messageWord = 'YOU ARE A RACING LEGEND! 🏆';
            rankColor = '#ffd700'; // Gold
        } else if (finalRank <= 3) {
            messageWord = 'GREAT JOB! PODIUM FINISH! 🥈🥉';
            rankColor = '#c0c0c0';
        } else if (finalRank <= totalCars / 2) {
            messageWord = 'NOT BAD! KEEP PUSHING! 🏎️💨';
            rankColor = '#ffffff';
        } else {
            messageWord = "DON'T GIVE UP! TRY AGAIN! 💪";
            rankColor = '#ff5555';
        }

        const rankDisplay = document.createElement('h2');
        rankDisplay.innerHTML = `Rank: <span style="color: ${rankColor}; font-size: 1.5em">${finalRank}</span> / ${totalCars} `;
        rankDisplay.style.color = '#ffffff';
        rankDisplay.style.marginTop = '10px';
        rankDisplay.style.fontSize = '40px';

        const msgDisplay = document.createElement('h3');
        msgDisplay.textContent = messageWord;
        msgDisplay.style.color = rankColor;
        msgDisplay.style.marginTop = '20px';
        msgDisplay.style.fontSize = '30px';
        msgDisplay.style.textShadow = `0 0 10px ${rankColor} `;

        const time = document.createElement('h2');
        time.textContent = `Total Time: ${this.timeElement.textContent} `;
        time.style.color = '#aaaaaa';
        time.style.marginTop = '30px';

        const btn = document.createElement('button');
        btn.textContent = 'Play Again';
        btn.style.cssText = `
            margin - top: 50px;
            padding: 15px 40px;
            font - size: 24px;
            background: #00ff88;
            color: #000;
            border: none;
            border - radius: 30px;
            cursor: pointer;
            font - weight: bold;
            transition: transform 0.2s, background 0.2s;
            `;
        btn.onmouseover = () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.background = '#00cc66';
        };
        btn.onmouseout = () => {
            btn.style.transform = 'scale(1)';
            btn.style.background = '#00ff88';
        };
        btn.onclick = () => location.reload();

        overlay.appendChild(title);
        overlay.appendChild(rankDisplay);
        overlay.appendChild(msgDisplay);
        overlay.appendChild(time);
        overlay.appendChild(btn);
        document.body.appendChild(overlay);

        if (this.soundManager) this.soundManager.stopEngine();
    }

    // ==================== 碰撞檢測 ====================
    checkCollisions() {
        if (!this.started || this.paused) return;

        const minDist = 4.2; // 增加碰撞檢測距離

        // 玩家與 NPC 碰撞
        const playerPos = this.car.position;
        this.bots.forEach(bot => {
            const botPos = bot.mesh.position;
            const dx = playerPos.x - botPos.x;
            const dz = playerPos.z - botPos.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.1;
                const nx = dx / dist;
                const nz = dz / dist;
                const force = (minDist - dist) * 0.8; // 輕微推開

                // 輕微反彈偏移
                this.pushOffset.x += nx * force;
                this.pushOffset.z += nz * force;
                bot.pushOffset.x -= nx * force;
                bot.pushOffset.z -= nz * force;

                // 輕微速度損耗
                this.carSpeed *= 0.85; // 保留 85% 速度
                bot.carSpeed *= 0.9;   // NPC 保留 90% 速度

                // 輕微相機震動
                this.camera.position.x += (Math.random() - 0.5) * 0.5;
                this.camera.position.y += (Math.random() - 0.5) * 0.5;
                this.camera.position.z += (Math.random() - 0.5) * 0.5;

                console.log("COLLISION! Bouncing...");
            }
        });

        // NPC 之間的碰撞
        for (let i = 0; i < this.bots.length; i++) {
            for (let j = i + 1; j < this.bots.length; j++) {
                const botA = this.bots[i];
                const botB = this.bots[j];
                const dx = botA.mesh.position.x - botB.mesh.position.x;
                const dz = botA.mesh.position.z - botB.mesh.position.z;
                const distSq = dx * dx + dz * dz;

                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq) || 0.1;
                    const nx = dx / dist;
                    const nz = dz / dist;
                    const force = (minDist - dist) * 0.6; // 輕微推開

                    botA.pushOffset.x += nx * force;
                    botA.pushOffset.z += nz * force;
                    botB.pushOffset.x -= nx * force;
                    botB.pushOffset.z -= nz * force;

                    botA.carSpeed *= 0.95; // NPC 互撞幾乎不減速
                    botB.carSpeed *= 0.95;
                }
            }
        }

        // 檢測加速帶
        this.boostPads.forEach(pad => {
            // 玩家檢測
            const pDistSq = this.car.position.distanceToSquared(pad.pos);
            if (pDistSq < 25) { // 5公尺內
                if (this.playerBoostTimer <= 0) console.log("BOOST PAD ACTIVATED!");
                this.playerBoostTimer = 2.0; // 2秒加速
            }

            // NPC 檢測
            this.bots.forEach(bot => {
                const bDistSq = bot.mesh.position.distanceToSquared(pad.pos);
                if (bDistSq < 25) {
                    bot.boostTimer = 2.0; // NPC 加速時間增加 (原 1.5)
                }
            });
        });
    }

    // ==================== 視窗大小調整 ====================
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // ==================== 主動畫循環 ====================
    animate() {
        requestAnimationFrame(() => this.animate());

        const dt = Math.min(this.clock.getDelta(), 0.1) || 0.016;

        if (!this.paused) {
            this.updateCar(dt);
            this.checkCollisions(); // 檢測碰撞
            this.updateCamera();
            this.updateWarzoneAndSpaceX(dt);

            // Rotate sky banners
            if (this.skyBannerGroup) {
                this.skyBannerGroup.rotation.y += dt * 0.05; // Slow rotation
            }

            // 計算領先者進度和各 NPC 排名
            const playerProgress = this.lap + this.carT;
            let leaderProgress = playerProgress;

            // 收集所有進度
            const botProgresses = this.bots.map(bot => ({
                bot,
                progress: bot.lap + bot.carT
            }));
            botProgresses.forEach(bp => {
                if (bp.progress > leaderProgress) leaderProgress = bp.progress;
            });

            // 按進度排序（高到低）計算排名
            botProgresses.sort((a, b) => b.progress - a.progress);

            // Update bots
            this.bots.forEach(bot => {
                const botRank = botProgresses.findIndex(bp => bp.bot === bot) + 1;
                bot.update(dt, this.started, leaderProgress, botRank);

                // 為 NPC 進行高度修正 (Raycast)
                if (this.trackMesh && this.raycaster) {
                    const rayOrigin = bot.mesh.position.clone();
                    rayOrigin.y = 100; // 從更高的地方射線
                    this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
                    const hits = this.raycaster.intersectObject(this.trackMesh);
                    if (hits.length > 0) {
                        bot.updateHeight(hits[0].point.y, dt);
                    } else {
                        bot.updateHeight(undefined, dt); // 空中
                    }
                }
            });
        }

        this.updateMinimap(); // 更新小地圖顯示所有車輛
        this.updateHUD(dt);
        this.renderer.render(this.scene, this.camera);
    }

    // ==================== 戰爭環境與 SpaceX 火箭 ====================
    createWarzoneAndSpaceX() {
        this.warObjects = [];
        this.explosions = [];

        // 1. SpaceX 火箭
        for (let i = 0; i < 5; i++) {
            const group = new THREE.Group();

            // 身體
            const bodyGeo = new THREE.CylinderGeometry(2, 2, 20, 16);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);

            // 頂部圓錐
            const coneGeo = new THREE.ConeGeometry(2, 6, 16);
            const coneMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.y = 13;

            // 噴火特效
            const flameGeo = new THREE.ConeGeometry(1.5, 8, 8);
            const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
            const flame = new THREE.Mesh(flameGeo, flameMat);
            flame.position.y = -14;
            flame.rotation.x = Math.PI;

            group.add(body, cone, flame);

            // 隨機初始位置
            group.position.set(
                (Math.random() - 0.5) * 800,
                Math.random() * 200,
                (Math.random() - 0.5) * 800
            );

            group.userData = {
                type: 'rocket',
                speedY: 30 + Math.random() * 60,
                flame: flame
            };

            this.scene.add(group);
            this.warObjects.push(group);
        }

        // 2. 飛機
        for (let i = 0; i < 10; i++) {
            const group = new THREE.Group();

            const bodyGeo = new THREE.CylinderGeometry(1.5, 1.5, 15, 8);
            bodyGeo.rotateX(Math.PI / 2);
            const mat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6 });
            const body = new THREE.Mesh(bodyGeo, mat);

            const wingGeo = new THREE.BoxGeometry(20, 0.5, 4);
            const wing = new THREE.Mesh(wingGeo, mat);
            wing.position.set(0, 0, 1);

            const tailGeo = new THREE.BoxGeometry(6, 4, 3);
            const tail = new THREE.Mesh(tailGeo, mat);
            tail.position.set(0, 1, -6);

            group.add(body, wing, tail);

            group.position.set(
                (Math.random() - 0.5) * 1200,
                80 + Math.random() * 150,
                (Math.random() - 0.5) * 1200
            );

            const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            group.lookAt(group.position.clone().add(dir));

            group.userData = {
                type: 'plane',
                dir: dir,
                speed: 100 + Math.random() * 100
            };

            this.scene.add(group);
            this.warObjects.push(group);
        }

        // 3. 戰車
        for (let i = 0; i < 25; i++) {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: 0x4a5d23 }); // 軍綠色

            const baseGeo = new THREE.BoxGeometry(6, 2, 8);
            const base = new THREE.Mesh(baseGeo, mat);
            base.position.y = 1;

            const turretGeo = new THREE.BoxGeometry(4, 1.5, 4);
            const turret = new THREE.Mesh(turretGeo, mat);
            turret.position.y = 2.75;

            const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 6);
            barrelGeo.rotateX(Math.PI / 2);
            const barrel = new THREE.Mesh(barrelGeo, mat);
            barrel.position.set(0, 2.75, 4.5);

            group.add(base, turret, barrel);

            const rad = 250 + Math.random() * 400;
            const ang = Math.random() * Math.PI * 2;
            group.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
            group.rotation.y = Math.random() * Math.PI * 2;

            this.scene.add(group);
        }

        // 4. 士兵
        for (let i = 0; i < 60; i++) {
            const group = new THREE.Group();
            const skinGeo = new THREE.SphereGeometry(0.4);
            const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
            const head = new THREE.Mesh(skinGeo, skinMat);
            head.position.y = 2.2;

            const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a5d23 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.9;

            group.add(head, body);

            const rad = 200 + Math.random() * 450;
            const ang = Math.random() * Math.PI * 2;
            group.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
            group.rotation.y = Math.random() * Math.PI * 2;

            this.scene.add(group);
        }
    }

    updateWarzoneAndSpaceX(dt) {
        if (!this.warObjects) return;

        const time = Date.now() * 0.001;

        // 更新飛行物體
        this.warObjects.forEach(obj => {
            const ud = obj.userData;
            if (ud.type === 'rocket') {
                obj.position.y += ud.speedY * dt;

                // 火焰跳動
                const scale = 1 + Math.sin(time * 20 + obj.position.y) * 0.3;
                ud.flame.scale.set(scale, scale, scale);

                // 飛太高就重置
                if (obj.position.y > 1000) {
                    obj.position.y = 0;
                    obj.position.x = (Math.random() - 0.5) * 800;
                    obj.position.z = (Math.random() - 0.5) * 800;
                }
            } else if (ud.type === 'plane') {
                obj.position.addScaledVector(ud.dir, ud.speed * dt);

                // 飛出界就重置
                if (Math.abs(obj.position.x) > 1200 || Math.abs(obj.position.z) > 1200) {
                    obj.position.set((Math.random() - 0.5) * 1200, 80 + Math.random() * 150, (Math.random() - 0.5) * 1200);
                    ud.dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    obj.lookAt(obj.position.clone().add(ud.dir));
                }
            }
        });

        // 隨機產生爆炸 (Bombing)
        if (Math.random() < 0.08) { // 每幀 8% 機率爆炸
            const explGroup = new THREE.Group();

            // 爆炸核心
            const eGeo = new THREE.SphereGeometry(2, 8, 8);
            const eMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 1 });
            const eMesh = new THREE.Mesh(eGeo, eMat);
            explGroup.add(eMesh);

            // 隨機在周圍爆炸
            const rad = 100 + Math.random() * 500;
            const ang = Math.random() * Math.PI * 2;
            explGroup.position.set(Math.cos(ang) * rad, Math.random() * 30, Math.sin(ang) * rad);

            this.scene.add(explGroup);
            this.explosions.push({ mesh: explGroup, mat: eMat, age: 0, maxAge: 0.5 + Math.random() * 0.5 });
        }

        // 更新爆炸特效
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.age += dt;
            const ratio = exp.age / exp.maxAge;

            if (ratio >= 1) {
                this.scene.remove(exp.mesh);
                exp.mat.dispose();
                exp.mesh.children[0].geometry.dispose();
                this.explosions.splice(i, 1);
            } else {
                const scale = 1 + ratio * 20; // 快速膨脹
                exp.mesh.scale.set(scale, scale, scale);
                exp.mat.opacity = 1 - ratio; // 淡出

                // 後期變成灰色煙霧
                if (ratio > 0.4) {
                    exp.mat.color.setHex(0x555555);
                }
            }
        }
    }
}

// 初始化遊戲
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new RacingGame());
} else {
    new RacingGame();
}
