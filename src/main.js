import * as THREE from 'three';

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
        this.maxSpeed = 120;
        this.acceleration = 80;
        this.handling = 2.5;

        // ==================== 輸入狀態 ====================
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        // ==================== 初始化各個組件 ====================
        this.setupLights();
        this.createTrack();
        this.createCar();
        this.createEnvironment();
        this.setupInput();
        this.createHUD();

        // ==================== 響應式處理 ====================
        window.addEventListener('resize', () => this.onResize());

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
        const fill = new THREE.DirectionalLight(0x4488ff, 0.4);
        fill.position.set(-50, 30, -50);
        this.scene.add(fill);
    }

    // ==================== 創建賽道 ====================
    createTrack() {
        // 賽道材質 - 深色柏油路面
        const trackMaterial = new THREE.MeshStandardMaterial({
            color: 0x333344,
            roughness: 0.8,
            metalness: 0.1
        });

        // 創建圓形賽道
        const trackShape = new THREE.Shape();
        const outerRadius = this.trackRadius + this.trackWidth / 2;
        const innerRadius = this.trackRadius - this.trackWidth / 2;

        // 外圈
        trackShape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
        // 內圈（孔洞）
        const holePath = new THREE.Path();
        holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
        trackShape.holes.push(holePath);

        // 擠出賽道幾何體
        const trackGeometry = new THREE.ExtrudeGeometry(trackShape, {
            depth: 0.3,
            bevelEnabled: false
        });
        trackGeometry.rotateX(-Math.PI / 2);

        const track = new THREE.Mesh(trackGeometry, trackMaterial);
        track.position.y = 0;
        track.receiveShadow = true;
        this.scene.add(track);

        // 賽道中心線
        this.createTrackLines();

        // 賽道邊界
        this.createTrackBorders();

        // 起點/終點線
        this.createStartLine();
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

    // ==================== 賽道邊界 ====================
    createTrackBorders() {
        // 外邊界 - 紅白相間護欄
        const outerRadius = this.trackRadius + this.trackWidth / 2 + 1;
        const innerRadius = this.trackRadius - this.trackWidth / 2 - 1;
        const postCount = 40;

        for (let i = 0; i < postCount; i++) {
            const angle = (i / postCount) * Math.PI * 2;
            const isRed = i % 2 === 0;

            // 外側護欄柱
            this.createBarrierPost(
                Math.cos(angle) * outerRadius,
                Math.sin(angle) * outerRadius,
                isRed ? 0xff3333 : 0xffffff
            );

            // 內側護欄柱
            this.createBarrierPost(
                Math.cos(angle) * innerRadius,
                Math.sin(angle) * innerRadius,
                isRed ? 0x3333ff : 0xffffff
            );
        }
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

    // ==================== 起點/終點線 ====================
    createStartLine() {
        const lineWidth = this.trackWidth;
        const lineDepth = 2;

        // 格子旗圖案
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

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 1);

        const lineMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide
        });

        const lineGeometry = new THREE.PlaneGeometry(lineWidth, lineDepth);  // 交換寬高
        const startLine = new THREE.Mesh(lineGeometry, lineMaterial);
        startLine.rotation.x = -Math.PI / 2;
        startLine.position.set(this.trackRadius, 0.35, 0);
        this.scene.add(startLine);

        // 起點拱門
        this.createStartArch();
    }

    // ==================== 起點拱門 ====================
    createStartArch() {
        const archMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.2,
            side: THREE.DoubleSide  // 確保雙面可見
        });

        // 創建拱門 Group，以便整體旋轉
        const archGroup = new THREE.Group();

        const halfWidth = this.trackWidth / 2 + 2;
        const archHeight = 8;

        // 在本地座標中，柱子沿著 X 軸排列（左右）
        // 左柱（X 負方向）
        const pillarGeo = new THREE.BoxGeometry(1, archHeight, 1);
        const leftPillar = new THREE.Mesh(pillarGeo, archMaterial);
        leftPillar.position.set(-halfWidth, archHeight / 2, 0);
        leftPillar.castShadow = true;
        archGroup.add(leftPillar);

        // 右柱（X 正方向）
        const rightPillar = new THREE.Mesh(pillarGeo, archMaterial);
        rightPillar.position.set(halfWidth, archHeight / 2, 0);
        rightPillar.castShadow = true;
        archGroup.add(rightPillar);

        // 橫樑 - 沿著 X 軸方向
        const beamWidth = this.trackWidth + 6;
        const beamGeo = new THREE.BoxGeometry(beamWidth, 1.5, 1);  // X 方向是寬
        const beam = new THREE.Mesh(beamGeo, archMaterial);
        beam.position.set(0, archHeight, 0);
        beam.castShadow = true;
        archGroup.add(beam);

        // 設置拱門位置在賽道起點
        // 起點位於 (trackRadius, 0, 0)
        // 在此位置，賽道切線方向是 +Z（順時針）
        // 拱門橫樑現在沿著本地 X 軸，當放置到世界座標時
        // X 軸會橫跨賽道（從圓心向外的方向）
        archGroup.position.set(this.trackRadius, 0, 0);

        this.scene.add(archGroup);

        // CITIC CLSA 贊助商 Logo 添加到拱門上
        this.addSponsorLogo();
    }

    // ==================== 添加贊助商 Logo ====================
    addSponsorLogo() {
        const textureLoader = new THREE.TextureLoader();

        // 載入 CLSA logo
        textureLoader.load('/clsa-logo.png', (texture) => {
            // 拱門上的 logo
            const logoMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide
            });

            // 計算合適的尺寸 (保持比例)
            const logoWidth = 12;
            const logoHeight = 3;

            // 拱門橫樑 logo - 橫樑沿著 X 軸，所以 logo 應該在 Z 方向的前後
            const logoGeo = new THREE.PlaneGeometry(logoWidth, logoHeight);

            // 前側 logo（面向車輛來的方向，-Z）
            const logoFront = new THREE.Mesh(logoGeo, logoMaterial);
            logoFront.position.set(this.trackRadius, 8, -0.6);
            logoFront.rotation.y = Math.PI;  // 面向 -Z 方向
            this.scene.add(logoFront);

            // 後側 logo（面向車輛去的方向，+Z）
            const logoBack = new THREE.Mesh(logoGeo, logoMaterial);
            logoBack.position.set(this.trackRadius, 8, 0.6);
            // 不旋轉，預設面向 +Z 方向
            this.scene.add(logoBack);

            // 在賽道周圍放置贊助商廣告牌
            this.createSponsorBillboards(texture);
        });
    }

    // ==================== 創建贊助商廣告牌 ====================
    createSponsorBillboards(logoTexture) {
        const billboardCount = 8;

        // 創建材質時不使用 DoubleSide，這樣可以確保正確的面朝向
        const billboardMaterial = new THREE.MeshBasicMaterial({
            map: logoTexture,
            transparent: true,
            side: THREE.FrontSide
        });

        for (let i = 0; i < billboardCount; i++) {
            const angle = (i / billboardCount) * Math.PI * 2;
            const distance = this.trackRadius + this.trackWidth / 2 + 10;

            // 廣告牌幾何體
            const billboardGeo = new THREE.PlaneGeometry(10, 3);
            const billboard = new THREE.Mesh(billboardGeo, billboardMaterial);

            // 設置位置（賽道外側）
            billboard.position.x = Math.cos(angle) * distance;
            billboard.position.z = Math.sin(angle) * distance;
            billboard.position.y = 4;

            // 讓廣告牌面向賽道中心
            // Plane 的預設法線是 +Z，所以旋轉 Y 使其面向圓心
            billboard.rotation.y = angle + Math.PI;

            this.scene.add(billboard);
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

        // 車輪
        this.wheels = [];
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.6
        });

        const wheelPositions = [
            { x: -1.1, y: 0.4, z: 1.3 },   // 前左
            { x: 1.1, y: 0.4, z: 1.3 },    // 前右
            { x: -1.1, y: 0.4, z: -1.3 },  // 後左
            { x: 1.1, y: 0.4, z: -1.3 }    // 後右
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
        // 拱門在 z=0，車輛起點在拱門後方（z 為負值）
        // 這樣往 +Z 方向開就會通過拱門
        this.car.position.set(this.trackRadius, 0.5, -10);
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
        if (this.keys.forward) {
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

        // 更新車輛位置
        // 車輛模型前方是 +Z，當 rotation.y = 0 時面向 +Z
        // rotation.y 增加時車輛左轉（面向角度增加的方向）
        const moveX = Math.sin(this.carAngle) * this.carSpeed * dt;
        const moveZ = Math.cos(this.carAngle) * this.carSpeed * dt;

        this.car.position.x += moveX;
        this.car.position.z += moveZ;
        this.car.rotation.y = this.carAngle;

        // 車輪旋轉
        const wheelRotation = this.carSpeed * dt * 0.5;
        this.wheels.forEach(wheel => {
            wheel.rotation.x += wheelRotation;
        });

        // 保持車輛在賽道上（簡單邊界檢測）
        this.keepCarOnTrack();
    }

    // ==================== 保持車輛在賽道上 ====================
    keepCarOnTrack() {
        const distFromCenter = Math.sqrt(
            this.car.position.x ** 2 + this.car.position.z ** 2
        );

        const innerBound = this.trackRadius - this.trackWidth / 2;
        const outerBound = this.trackRadius + this.trackWidth / 2;

        if (distFromCenter < innerBound || distFromCenter > outerBound) {
            // 減速並推回賽道
            this.carSpeed *= 0.9;

            const angle = Math.atan2(this.car.position.z, this.car.position.x);
            const targetDist = distFromCenter < innerBound ? innerBound + 1 : outerBound - 1;

            this.car.position.x = Math.cos(angle) * targetDist;
            this.car.position.z = Math.sin(angle) * targetDist;
        }
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
