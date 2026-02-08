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
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 100, 500);

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
        this.maxSpeed = 80; // Slower speed
        this.acceleration = 40; // Slower acceleration
        this.handling = 2.5;

        // ==================== 輸入狀態 ====================
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        // ==================== 初始化各個組件 ====================
        this.brandingTextures = this.createBrandingTextures();
        this.setupLights();
        this.createTrack();
        this.createCar();
        this.createEnvironment();
        this.setupInput();
        this.createHUD();

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
        // 環境光
        const ambient = new THREE.AmbientLight(0x404080, 0.5);
        this.scene.add(ambient);

        // 主方向光（太陽）
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 300;
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        this.scene.add(sun);

        // 補光
        const fill = new THREE.DirectionalLight(0x4488ff, 0.8); // Brighter fill
        fill.position.set(-50, 30, -50);
        this.scene.add(fill);

        // Extra light for bridge
        const bridgeLight = new THREE.PointLight(0xffffff, 1, 100);
        bridgeLight.position.set(0, 40, 0);
        this.scene.add(bridgeLight);
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

    // ==================== 創建賽道 (Figure-8) ====================
    createTrack() {
        // 1. 生成 8 字型路徑
        const points = [];
        const segments = 400; // More segments for smoother curve
        const size = 120;

        for (let i = 0; i <= segments; i++) {
            const t = (i / segments) * Math.PI * 2;
            const x = (size * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
            const z = (size * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
            const y = (Math.sin(t) + 1) * 15; // Increased height slightly to 30 max
            points.push(new THREE.Vector3(x, y, z));
        }

        this.trackCurve = new THREE.CatmullRomCurve3(points);
        this.trackCurve.closed = true;

        // 2. 自定義賽道 Mesh 生成 (Triangle Strip) - 解決扭曲問題
        const trackWidth = 22;
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

        // 4. 裝飾
        this.createTrackDecorations();
        this.createSkyBanners(); // Add sky banners
        this.createOverheadBanners(); // Add overhead banners across the track

        // 5. 起點
        this.createStartLine();

        // 6. 初始化 Minimap
        this.initMinimap();
    }

    createTrackDecorations() {
        if (!this.trackLayout) return;

        const barrierGeo = new THREE.BoxGeometry(0.5, 1.2, 2.5);
        const barrierMat = new THREE.MeshStandardMaterial({
            map: this.brandingTextures.main,
            color: 0xffffff
        });

        // Alternate material for GTJAI
        const gtjaiMat = new THREE.MeshStandardMaterial({
            map: this.brandingTextures.gtjai,
            color: 0xffffff,
            transparent: true // PNG might have transparency
        });

        const lightGeo = new THREE.SphereGeometry(0.2);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // 使用我們生成的 trackLayout 來放置，保證完美對齊
        for (let i = 0; i < this.trackLayout.length; i += 2) { // 減少密度
            const layout = this.trackLayout[i];
            const tangent = layout.tangent;

            // Perform alternate branding (every 4th barrier is GTJAI)
            const mat = (i % 8 === 0) ? gtjaiMat : barrierMat;

            // 左側護欄
            const bLeft = new THREE.Mesh(barrierGeo, mat);
            bLeft.position.copy(layout.pLeft);
            bLeft.position.y += 0.6; // 放置在路面上方
            // 面向賽道切線方向
            bLeft.lookAt(bLeft.position.clone().add(tangent));
            this.scene.add(bLeft);

            // 右側護欄
            const bRight = new THREE.Mesh(barrierGeo, mat);
            bRight.position.copy(layout.pRight);
            bRight.position.y += 0.6;
            bRight.lookAt(bRight.position.clone().add(tangent));
            this.scene.add(bRight);

            // 調整：讓護欄稍微往內或者往外一點，避免壓在路邊緣
            // 這裡把它們移出去一點點
            bLeft.position.add(layout.binormal.clone().multiplyScalar(0.5));
            bRight.position.add(layout.binormal.clone().multiplyScalar(-0.5));

            // Lights (Lower frequency)
            if (i % 10 === 0) {
                const lLeft = new THREE.Mesh(lightGeo, lightMat);
                lLeft.position.copy(bLeft.position);
                lLeft.position.y += 1.2;
                this.scene.add(lLeft);

                const lRight = new THREE.Mesh(lightGeo, lightMat);
                lRight.position.copy(bRight.position);
                lRight.position.y += 1.2;
                this.scene.add(lRight);
            }
        }

        // 交叉點的大型 Logo decals
        this.createDecals();
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
        // 中央虛線
        const dashCount = 60;
        const dashLength = 3;
        const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        for (let i = 0; i < dashCount; i++) {
            const angle = (i / dashCount) * Math.PI * 2;
            const nextAngle = ((i + 0.3) / dashCount) * Math.PI * 2;

            const curve = new THREE.EllipseCurve(
                0, 0,
                this.trackRadius, this.trackRadius,
                angle, nextAngle,
                false
            );

            const points = curve.getPoints(5);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            // 創建細長矩形作為虛線
            const dashGeo = new THREE.PlaneGeometry(0.3, dashLength);
            const dash = new THREE.Mesh(dashGeo, dashMaterial);

            const midAngle = (angle + nextAngle) / 2;
            dash.position.x = Math.cos(midAngle) * this.trackRadius;
            dash.position.z = Math.sin(midAngle) * this.trackRadius;
            dash.position.y = 0.32;
            dash.rotation.x = -Math.PI / 2;
            dash.rotation.z = -midAngle + Math.PI / 2;

            this.scene.add(dash);
        }
    }

    // ==================== 賽道邊界與護欄 ====================
    createTrackBorders() {
        // 外邊界 - 紅白相間護欄 + 品牌廣告
        const outerRadius = this.trackRadius + this.trackWidth / 2 + 1;
        const innerRadius = this.trackRadius - this.trackWidth / 2 - 1;
        const postCount = 40;

        // 護欄板幾何體 (Plane)
        // 計算兩柱之間的弦長和角度
        const segmentAngle = (Math.PI * 2) / postCount;

        // 外圈板寬
        const outerChord = 2 * outerRadius * Math.sin(segmentAngle / 2);
        const outerPanelGeo = new THREE.PlaneGeometry(outerChord * 1.05, 1.5); // 稍微加寬以覆蓋縫隙

        // 內圈板寬
        const innerChord = 2 * innerRadius * Math.sin(segmentAngle / 2);
        const innerPanelGeo = new THREE.PlaneGeometry(innerChord * 1.05, 1.5);

        // 材質
        const borderBanners = this.brandingTextures.allBanners;

        // Pre-create materials for checking performance (though creating inside loop is fine if count is small, caching is better)
        // Let's create an array of materials
        const borderMats = borderBanners.map(tex => new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));

        for (let i = 0; i < postCount; i++) {
            const angle = (i / postCount) * Math.PI * 2;
            const nextAngle = ((i + 1) / postCount) * Math.PI * 2;
            const midAngle = (angle + nextAngle) / 2;
            const isRed = i % 2 === 0;

            // 1. 護欄柱
            this.createBarrierPost(
                Math.cos(angle) * outerRadius,
                Math.sin(angle) * outerRadius,
                isRed ? 0xff3333 : 0xffffff
            );

            this.createBarrierPost(
                Math.cos(angle) * innerRadius,
                Math.sin(angle) * innerRadius,
                isRed ? 0x3333ff : 0xffffff
            );

            // 2. 品牌護欄板 (連接柱子)
            // Cycle through all banners
            const panelMat = borderMats[i % borderMats.length];

            // 外側護欄板
            const outerPanel = new THREE.Mesh(outerPanelGeo, panelMat);
            // 位置在弦的中點
            const outerMidDist = outerRadius * Math.cos(segmentAngle / 2);
            outerPanel.position.set(
                Math.cos(midAngle) * outerMidDist,
                1.0,
                Math.sin(midAngle) * outerMidDist
            );
            // 旋轉面向圓心 (Plane預設面朝+Z)
            outerPanel.rotation.y = -midAngle + Math.PI / 2;
            // 讓Logo面向賽道內部 (外圈板，正面朝內)
            outerPanel.lookAt(0, 1.0, 0);
            this.scene.add(outerPanel);

            // 內側護欄板
            const innerPanel = new THREE.Mesh(innerPanelGeo, panelMat);
            const innerMidDist = innerRadius * Math.cos(segmentAngle / 2);
            innerPanel.position.set(
                Math.cos(midAngle) * innerMidDist,
                1.0,
                Math.sin(midAngle) * innerMidDist
            );
            // 內圈板，需要面向外 (朝向賽道)
            innerPanel.lookAt(0, 1.0, 0);
            innerPanel.rotation.y += Math.PI; // 轉180度朝外
            this.scene.add(innerPanel);
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
    createBarrierPost(x, z, color) {
        const postGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
        const postMat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.5,
            metalness: 0.3
        });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0.75, z);
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
        // 面向切線 (平面默認面向Z，旋轉90度變平)
        line.rotation.x = -Math.PI / 2;
        // Z 旋轉對齊跑道 - 旋轉 90 度 (Math.PI/2)
        const angle = Math.atan2(tangent.x, tangent.z);
        // Previously: line.rotation.z = -angle + Math.PI/2;
        // Requested rotate 90 degree again:
        line.rotation.z = -angle;

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


    // Old assets removal
    // createTrackLines, createTrackBorders, createRoadDecals, createApexBillboards, createStartArch, addSponsorLogo, createSponsorBillboards
    // These methods can be removed or emptied as they are replaced by new decorations
    createTrackLines() { }
    createTrackBorders() { }
    createRoadDecals() { }
    createApexBillboards() { }
    createStartArch() { }
    addSponsorLogo() { }
    createSponsorBillboards(tex) { }

    // ==================== 天空懸浮廣告 ====================
    // ==================== 天空懸浮廣告 ====================
    createSkyBanners() {
        if (!this.trackCurve) return;

        this.skyBannerGroup = new THREE.Group();
        this.scene.add(this.skyBannerGroup);

        const count = 12; // Number of floating banners
        const height = 60; // Height in the sky
        const radius = this.trackRadius + 40; // Wider than track

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Texture
            const tex = this.brandingTextures.allBanners[i % this.brandingTextures.allBanners.length];

            // Default size
            const baseHeight = 20;
            const baseWidth = 35; // Default 16:9 approx

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
            mesh.lookAt(0, height, 0);
            mesh.rotation.x = 0.1; // Tilt down slightly

            this.skyBannerGroup.add(mesh);
        }
    }

    // ==================== 賽道上方橫幅 ====================
    createOverheadBanners() {
        if (!this.trackCurve) return;

        const bannerCount = 10;
        const bannerWidth = 30;
        const bannerHeight = 5;

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

            const rightPole = new THREE.Mesh(poleGeo, poleMat);
            rightPole.position.set(bannerWidth / 2, 6, 0);
            group.add(rightPole);

            // 2. Crossbar / Banner
            // Use a base height, and scale width by aspect ratio
            const baseH = 8;
            const baseW = 20;

            // Cycle textures
            const tex = this.brandingTextures.allBanners[i % this.brandingTextures.allBanners.length];

            // Use PlaneGeometry for the image part to avoid stretching on sides of box
            const bannerGeo = new THREE.PlaneGeometry(1, 1);
            const bannerMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
            const banner = new THREE.Mesh(bannerGeo, bannerMat);

            // Determine Aspect Ratio
            if (tex.image && tex.image.width) {
                const aspect = tex.image.width / tex.image.height;
                banner.scale.set(baseH * aspect, baseH, 1);
            } else {
                banner.scale.set(baseW, baseH, 1);
            }

            banner.position.y = 8;

            // Add a backing box for structure
            const boxW = banner.scale.x + 1; // slightly wider
            const boxGeo = new THREE.BoxGeometry(boxW, baseH + 0.5, 0.2);
            const boxMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(0, 8, -0.11); // Behind the plane
            group.add(box);

            group.add(banner);

            // Adjust pole spacing to match banner width
            leftPole.position.x = -boxW / 2 + 0.5;
            rightPole.position.x = boxW / 2 - 0.5;

            this.scene.add(group);
        }
    }

    // ==================== 創建車輛 ====================
    createCar() {
        this.car = new THREE.Group();

        // 車身主體 - 流線型設計
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            metalness: 0.9,
            roughness: 0.1
        });

        // 主車身
        const bodyGeo = new THREE.BoxGeometry(2.2, 0.8, 4.5);
        const body = new THREE.Mesh(bodyGeo, bodyMaterial);
        body.position.y = 0.6;
        body.castShadow = true;
        this.car.add(body);

        // 車頂/座艙
        const cabinGeo = new THREE.BoxGeometry(1.8, 0.6, 2);
        const cabinMat = new THREE.MeshStandardMaterial({
            color: 0x111122,
            metalness: 0.9,
            roughness: 0.1
        });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 1.1, -0.3);
        cabin.castShadow = true;
        this.car.add(cabin);

        // 前擋風玻璃
        const windshieldGeo = new THREE.BoxGeometry(1.7, 0.5, 0.1);
        const windshieldMat = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            metalness: 0.1,
            roughness: 0.1,
            transparent: true,
            opacity: 0.5
        });
        const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
        windshield.position.set(0, 1.1, 0.7);
        windshield.rotation.x = 0.3;
        this.car.add(windshield);

        // 車輪 - Bigger and wider for better grip look
        this.wheels = [];
        const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 24);
        const wheelMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.6
        });

        const wheelPositions = [
            { x: -1.2, y: 0.55, z: 1.3 },   // 前左
            { x: 1.2, y: 0.55, z: 1.3 },    // 前右
            { x: -1.2, y: 0.55, z: -1.3 },  // 後左
            { x: 1.2, y: 0.55, z: -1.3 }    // 後右
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
        leftTail.position.set(-0.7, 0.6, -2.3);
        this.car.add(leftTail);

        const rightTail = new THREE.Mesh(tailLightGeo, tailLightMat);
        rightTail.position.set(0.7, 0.6, -2.3);
        this.car.add(rightTail);

        // 頭燈
        const headLightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
        const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });

        const leftHead = new THREE.Mesh(headLightGeo, headLightMat);
        leftHead.position.set(-0.7, 0.6, 2.3);
        this.car.add(leftHead);

        const rightHead = new THREE.Mesh(headLightGeo, headLightMat);
        rightHead.position.set(0.7, 0.6, 2.3);
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
        // this.car.position.y += 0.5; // Removed to lower car to ground
        this.car.rotation.order = 'YXZ'; // Important for slope

        // Initial rotation: look at tangent
        if (this.trackCurve) {
            const t = this.trackCurve.getTangent(0);
            this.car.lookAt(startPos.clone().add(t));
            this.carAngle = this.car.rotation.y;
        }
        this.car.rotation.y = 0;  // 車頭朝向 +Z
        this.carAngle = 0;

        this.scene.add(this.car);

        // 初始化相機位置在車輛後方
        this.camera.position.set(this.trackRadius, 6, -10 - 12);  // 車輛後方 12 單位
    }

    // ==================== 創建環境 ====================
    createEnvironment() {
        // 地面
        const groundGeo = new THREE.PlaneGeometry(500, 500);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x1a2a1a,
            roughness: 1,
            metalness: 0
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 中央草坪
        const innerGrassGeo = new THREE.CircleGeometry(this.trackRadius - this.trackWidth / 2 - 2, 64);
        const grassMat = new THREE.MeshStandardMaterial({
            color: 0x2d4a2d,
            roughness: 0.9
        });
        const innerGrass = new THREE.Mesh(innerGrassGeo, grassMat);
        innerGrass.rotation.x = -Math.PI / 2;
        innerGrass.position.y = 0.05;
        innerGrass.receiveShadow = true;
        this.scene.add(innerGrass);

        // 天空球
        const skyGeo = new THREE.SphereGeometry(400, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0a0a20) },
                bottomColor: { value: new THREE.Color(0x2a1a40) }
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
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        // 星星
        this.createStars();

        // 場景裝飾物
        this.createScenery();
    }

    // ==================== 創建星星 ====================
    createStars() {
        const starsGeo = new THREE.BufferGeometry();
        const starCount = 1000;
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const radius = 350 + Math.random() * 50;

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi));
            positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
        }

        starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const starsMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.5,
            transparent: true,
            opacity: 0.8
        });

        const stars = new THREE.Points(starsGeo, starsMat);
        this.scene.add(stars);
    }

    // ==================== 場景裝飾 ====================
    createScenery() {
        // 在賽道外部添加一些樹木
        const treePositions = [];
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const distance = this.trackRadius + this.trackWidth / 2 + 15 + Math.random() * 20;
            treePositions.push({
                x: Math.cos(angle) * distance,
                z: Math.sin(angle) * distance
            });
        }

        treePositions.forEach(pos => {
            this.createTree(pos.x, pos.z);
        });
    }

    // ==================== 創建樹木 ====================
    createTree(x, z) {
        const tree = new THREE.Group();

        // 樹幹
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        tree.add(trunk);

        // 樹冠
        const foliageGeo = new THREE.ConeGeometry(2, 4, 8);
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 5;
        foliage.castShadow = true;
        tree.add(foliage);

        tree.position.set(x, 0, z);
        this.scene.add(tree);
    }

    // ==================== 創建 HUD ====================
    createHUD() {
        // 速度顯示
        this.speedElement = document.getElementById('speed-value');
        this.lapElement = document.getElementById('lap-value');
        this.timeElement = document.getElementById('time-value');

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
        // Scale factor: Track is approx 240 wide (size=120). Map is 150.
        // Scale = 150 / 300 = 0.5
        const scale = 0.4;
        const cx = w / 2;
        const cy = h / 2;

        points.forEach((p, i) => {
            const mx = cx + p.x * scale;
            const my = cy + p.z * scale; // Map Z to Y
            if (i === 0) ctx.moveTo(mx, my);
            else ctx.lineTo(mx, my);
        });

        ctx.stroke();

        // Draw Car
        const carPos = this.car.position;
        ctx.fillStyle = '#E31E26';
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
    }

    // ==================== 輸入處理 ====================
    setupInput() {
        // 鍵盤控制
        document.addEventListener('keydown', (e) => {
            if (this.paused && e.key !== 'Escape') return;

            switch (e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
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

        // 創建觸控控制容器 - 只有方向控制
        const touchContainer = document.createElement('div');
        touchContainer.id = 'touch-controls';
        touchContainer.innerHTML = `
            <div id="joystick-left">
                <div id="joystick-base-left">
                    <div id="joystick-knob-left">◀</div>
                </div>
                <span class="direction-label">LEFT</span>
            </div>
            <div id="touch-info">
                <span>🏎️ 自動加速中</span>
            </div>
            <div id="joystick-right">
                <div id="joystick-base-right">
                    <div id="joystick-knob-right">▶</div>
                </div>
                <span class="direction-label">RIGHT</span>
            </div>
        `;
        document.body.appendChild(touchContainer);

        // 添加觸控控制樣式
        const style = document.createElement('style');
        style.textContent = `
            #touch-controls {
                position: fixed;
                bottom: 20px;
                left: 0;
                right: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 20px;
                pointer-events: none;
                z-index: 1000;
            }
            
            #joystick-left, #joystick-right {
                display: flex;
                flex-direction: column;
                align-items: center;
                pointer-events: auto;
            }
            
            #joystick-base-left, #joystick-base-right {
                width: 80px;
                height: 80px;
                background: rgba(0, 255, 136, 0.3);
                border: 3px solid rgba(0, 255, 136, 0.8);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.1s, background 0.1s;
            }
            
            #joystick-base-left:active, #joystick-base-right:active {
                transform: scale(0.9);
                background: rgba(0, 255, 136, 0.6);
            }
            
            #joystick-knob-left, #joystick-knob-right {
                font-size: 32px;
                color: white;
                text-shadow: 0 0 10px rgba(0, 255, 136, 0.8);
            }
            
            .direction-label {
                color: rgba(255, 255, 255, 0.8);
                font-size: 14px;
                margin-top: 8px;
                font-weight: bold;
            }
            
            #touch-info {
                background: rgba(0, 0, 0, 0.5);
                padding: 10px 20px;
                border-radius: 20px;
                border: 2px solid rgba(0, 255, 136, 0.5);
            }
            
            #touch-info span {
                color: #00ff88;
                font-size: 14px;
                font-weight: bold;
            }
            
            @media (min-width: 768px) and (hover: hover) {
                #touch-controls {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);

        // 左方向按鈕
        const leftBtn = document.getElementById('joystick-base-left');
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys.left = true;
        }, { passive: false });
        leftBtn.addEventListener('touchend', () => {
            this.keys.left = false;
        });

        // 右方向按鈕
        const rightBtn = document.getElementById('joystick-base-right');
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keys.right = true;
        }, { passive: false });
        rightBtn.addEventListener('touchend', () => {
            this.keys.right = false;
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

        // 倒計時
        this.showCountdown(() => {
            this.started = true;
            this.clock.start();
        });
    }

    // ==================== 倒計時 ====================
    showCountdown(callback) {
        const overlay = document.createElement('div');
        overlay.id = 'countdown-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 150px;
            font-weight: bold;
            color: #00ff88;
            text-shadow: 0 0 30px #00ff88;
            z-index: 1000;
            pointer-events: none;
        `;
        document.body.appendChild(overlay);

        let count = 3;
        const countInterval = setInterval(() => {
            overlay.textContent = count > 0 ? count : 'GO!';
            overlay.style.transform = 'scale(1.5)';
            setTimeout(() => overlay.style.transform = 'scale(1)', 200);

            if (count <= 0) {
                clearInterval(countInterval);
                setTimeout(() => {
                    overlay.remove();
                    callback();
                }, 500);
            }
            count--;
        }, 1000);
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

        if (shouldAccelerate) {
            this.carSpeed += this.acceleration * dt;
            if (this.carSpeed > this.maxSpeed) this.carSpeed = this.maxSpeed;
        } else if (this.keys.backward) {
            this.carSpeed -= this.acceleration * 1.5 * dt;
            if (this.carSpeed < -this.maxSpeed * 0.4) this.carSpeed = -this.maxSpeed * 0.4;
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

        // 2. Track Constraint (Keep on track)
        // Find the closest point on curve near current carT
        // We assume the car moves forward/backward along the track mostly
        // Optimize: scan small window around carT
        if (this.trackCurve && this.trackLength > 0) {
            const range = 0.05; // Search range (5% of track)
            let bestT = this.carT;
            let minDistSq = Infinity;
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

            // Apply XZ update
            this.car.position.x = nextPos.x;
            this.car.position.z = nextPos.z;

            // 3. Update Y Position (Raycast + Fallback)
            this.updateCarHeight(curvePt);
        }

        // 4. Update Rotation
        this.car.rotation.y = this.carAngle;

        // Wheels
        const wheelRotation = this.carSpeed * dt * 0.35; // Adjusted for larger wheels
        this.wheels.forEach(wheel => {
            wheel.rotation.x += wheelRotation;
        });
    }

    updateCarHeight(curvePt) {
        this.raycaster = this.raycaster || new THREE.Raycaster();

        // Raycast down from high up
        const rayOrigin = this.car.position.clone();
        rayOrigin.y = 50;
        this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));

        const hits = this.raycaster.intersectObject(this.trackMesh);

        let validHit = null;

        if (hits.length > 0) {
            // Find the hit that is closest to our expected curve height
            // This prevents jumping to the bridge when we are below it, or falling through when on top
            let minDiff = Infinity;

            for (const hit of hits) {
                // Check if this hit is plausible relative to curve height
                // The track thickness is small, elevation differences at crossing are large (~15 units)
                const diff = Math.abs(hit.point.y - curvePt.y);

                // Allow some tolerance for banking/slopes, but reject the other layer
                if (diff < 8 && diff < minDiff) {
                    minDiff = diff;
                    validHit = hit;
                }
            }
        }

        if (validHit) {
            const hit = validHit;
            const targetY = hit.point.y; // Adjusted for ground-level origin
            this.car.position.y += (targetY - this.car.position.y) * 0.5; // Faster response

            // Align to normal
            const n = hit.face.normal.clone();
            const targetRot = new THREE.Object3D();
            targetRot.position.copy(this.car.position);
            const fwd = new THREE.Vector3(Math.sin(this.carAngle), 0, Math.cos(this.carAngle));
            const fwdProj = fwd.clone().sub(n.clone().multiplyScalar(fwd.dot(n))).normalize();
            targetRot.up.copy(n);
            targetRot.lookAt(targetRot.position.clone().add(fwdProj));
            this.car.quaternion.slerp(targetRot.quaternion, 0.2);
        } else {
            // Raycast missed or all hits invalid
            // Use curve height + offset
            const targetY = curvePt.y; // Adjusted for ground-level origin
            // Snap faster if we lost tracking
            this.car.position.y = targetY;

            // Reset rotation to flat if flying
            const targetRot = new THREE.Object3D();
            targetRot.position.copy(this.car.position);
            const fwd = new THREE.Vector3(Math.sin(this.carAngle), 0, Math.cos(this.carAngle));
            targetRot.lookAt(targetRot.position.clone().add(fwd));
            this.car.quaternion.slerp(targetRot.quaternion, 0.1);
        }
    }

    // Deprecated
    keepCarOnTrack() { }

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
            this.car.rotation.x = 0;
            this.car.rotation.z = 0;
        } else {
            this.car.position.set(0, 5, 0);
        }
    }

    // ==================== 保持車輛在賽道上 (Updated for Figure-8) ====================
    keepCarOnTrack() {
        // Since we use Raycast for ground, "Off Track" means raycast missed (handled above)
        // Or we can check distance to curve.

        // This function was enforcing circular boundary. Remove it or replace.
        // For Figure 8, boundaries are complex. 
        // We rely on the visual track width (mesh). 
        // If raycast fails, we fall.
    }

    // ==================== 更新相機 ====================
    updateCamera() {
        // 第三人稱跟隨相機
        const cameraDistance = 12;
        const cameraHeight = 6;

        // 相機在車輛後方 (車輛前方是 +sin, +cos，所以後方是相反)
        const idealX = this.car.position.x - Math.sin(this.carAngle) * cameraDistance;
        const idealZ = this.car.position.z - Math.cos(this.carAngle) * cameraDistance;
        const idealY = this.car.position.y + cameraHeight;

        // 平滑相機移動
        this.camera.position.x += (idealX - this.camera.position.x) * 0.1;
        this.camera.position.z += (idealZ - this.camera.position.z) * 0.1;
        this.camera.position.y += (idealY - this.camera.position.y) * 0.1;

        // 看向車輛前方一點
        const lookAtPoint = new THREE.Vector3(
            this.car.position.x + Math.sin(this.carAngle) * 5,
            this.car.position.y + 1,
            this.car.position.z + Math.cos(this.carAngle) * 5
        );
        this.camera.lookAt(lookAtPoint);
    }

    // ==================== 更新 HUD ====================
    updateHUD() {
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
            this.gameTime += this.clock.getDelta();
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            const ms = Math.floor((this.gameTime % 1) * 100);
            this.timeElement.textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }
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
            this.updateCamera();

            // Rotate sky banners
            if (this.skyBannerGroup) {
                this.skyBannerGroup.rotation.y += dt * 0.05; // Slow rotation
            }
        }

        this.updateHUD();
        this.renderer.render(this.scene, this.camera);
    }
}

// 初始化遊戲
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new RacingGame());
} else {
    new RacingGame();
}


