import * as THREE from 'three';

export class Minimap {
    constructor(trackPoints) {
        this.trackPoints = trackPoints;
        this.canvas = null;
        this.ctx = null;
        this.container = null;

        // Track bounds for scaling
        this.bounds = this.calculateBounds();
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.playerPositions = [];
        this.botPositions = [];

        this.createMinimapDOM();
        this.drawTrack();
    }

    calculateBounds() {
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        this.trackPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
        });

        // Add padding
        const padding = 20;
        return {
            minX: minX - padding,
            maxX: maxX + padding,
            minZ: minZ - padding,
            maxZ: maxZ + padding,
            width: maxX - minX + padding * 2,
            height: maxZ - minZ + padding * 2
        };
    }

    createMinimapDOM() {
        // Container
        this.container = document.createElement('div');
        this.container.id = 'minimap-container';
        this.container.innerHTML = `
            <div class="minimap-frame">
                <canvas id="minimap-canvas" width="200" height="200"></canvas>
                <div class="minimap-overlay"></div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #minimap-container {
                position: fixed;
                bottom: 30px;
                right: 30px;
                z-index: 100;
                pointer-events: none;
            }
            
            .minimap-frame {
                width: 200px;
                height: 200px;
                border-radius: 50%;
                overflow: hidden;
                border: 3px solid rgba(0, 242, 255, 0.8);
                box-shadow: 
                    0 0 20px rgba(0, 242, 255, 0.4),
                    inset 0 0 30px rgba(0, 0, 0, 0.5);
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(10px);
                position: relative;
            }
            
            #minimap-canvas {
                width: 100%;
                height: 100%;
                display: block;
            }
            
            .minimap-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                border-radius: 50%;
                background: radial-gradient(
                    circle at center,
                    transparent 60%,
                    rgba(0, 0, 0, 0.3) 100%
                );
                pointer-events: none;
            }
            
            @keyframes minimap-pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.7; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(this.container);

        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Calculate scale
        const canvasSize = 200;
        const scaleX = canvasSize / this.bounds.width;
        const scaleZ = canvasSize / this.bounds.height;
        this.scale = Math.min(scaleX, scaleZ) * 0.9;
        this.offsetX = canvasSize / 2;
        this.offsetY = canvasSize / 2;
    }

    worldToMap(x, z) {
        const centerX = (this.bounds.minX + this.bounds.maxX) / 2;
        const centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;

        return {
            x: (x - centerX) * this.scale + this.offsetX,
            y: (z - centerZ) * this.scale + this.offsetY
        };
    }

    drawTrack() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, 200, 200);

        // Draw track path
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let started = false;
        this.trackPoints.forEach(point => {
            const mapped = this.worldToMap(point.x, point.z);
            if (!started) {
                ctx.moveTo(mapped.x, mapped.y);
                started = true;
            } else {
                ctx.lineTo(mapped.x, mapped.y);
            }
        });

        ctx.closePath();
        ctx.stroke();

        // Draw track inner glow
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    update(playerPos, botPositions = []) {
        // Redraw track
        this.drawTrack();

        const ctx = this.ctx;

        // Draw bots
        botPositions.forEach((pos, index) => {
            const mapped = this.worldToMap(pos.x, pos.z);

            // Bot indicator
            ctx.beginPath();
            ctx.fillStyle = ['#ff4444', '#ff8800', '#ffff00'][index % 3];
            ctx.arc(mapped.x, mapped.y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Bot border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw player (larger, with glow)
        if (playerPos) {
            const mapped = this.worldToMap(playerPos.x, playerPos.z);

            // Glow
            ctx.beginPath();
            ctx.fillStyle = 'rgba(0, 200, 255, 0.4)';
            ctx.arc(mapped.x, mapped.y, 10, 0, Math.PI * 2);
            ctx.fill();

            // Player indicator
            ctx.beginPath();
            ctx.fillStyle = '#00ddff';
            ctx.arc(mapped.x, mapped.y, 6, 0, Math.PI * 2);
            ctx.fill();

            // Player border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    dispose() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
