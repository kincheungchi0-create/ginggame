export class RaceHUD {
    constructor() {
        this.container = null;
        this.elements = {};
        this.currentLap = 1;
        this.totalLaps = 3;
        this.position = 1;
        this.totalRacers = 4;
        this.currentItem = null;
        this.countdownValue = 3;
        this.isCountingDown = false;

        this.createHUDDOM();
        this.addStyles();
    }

    createHUDDOM() {
        this.container = document.createElement('div');
        this.container.id = 'race-hud';
        this.container.innerHTML = `
            <!-- Speed & Time (Top Left) -->
            <div class="hud-panel speed-panel glass">
                <div class="speed-display">
                    <span id="hud-speed" class="speed-value">0</span>
                    <span class="speed-unit">KM/H</span>
                </div>
                <div class="speed-bar-container">
                    <div id="speed-bar" class="speed-bar"></div>
                </div>
            </div>
            
            <!-- Lap Counter (Top Center) -->
            <div class="hud-panel lap-panel glass">
                <span class="lap-label">LAP</span>
                <span id="hud-lap" class="lap-value">1</span>
                <span class="lap-separator">/</span>
                <span class="lap-total">${this.totalLaps}</span>
            </div>
            
            <!-- Position (Top Right) -->
            <div class="hud-panel position-panel glass">
                <span id="hud-position" class="position-value">1</span>
                <span class="position-suffix">ST</span>
                <div class="position-total">/ ${this.totalRacers}</div>
            </div>
            
            <!-- Time (Below Lap) -->
            <div class="hud-panel time-panel glass">
                <span class="time-label">TIME</span>
                <span id="hud-time" class="time-value">00:00.00</span>
            </div>
            
            <!-- Item Box (Bottom Center) -->
            <div class="hud-panel item-panel glass" id="item-panel">
                <div class="item-frame">
                    <div id="item-icon" class="item-icon"></div>
                    <div class="item-roulette" id="item-roulette"></div>
                </div>
                <span class="item-hint">SHIFT to use</span>
            </div>
            
            <!-- Countdown Overlay -->
            <div id="countdown-overlay" class="countdown-overlay">
                <span id="countdown-text" class="countdown-text">3</span>
            </div>
            
            <!-- Race Position Banner -->
            <div id="position-banner" class="position-banner hidden">
                <span id="position-banner-text"></span>
            </div>
            
            <!-- Drift Meter -->
            <div class="hud-panel drift-panel glass" id="drift-panel">
                <span class="drift-label">DRIFT</span>
                <div class="drift-meter-container">
                    <div id="drift-meter" class="drift-meter"></div>
                    <div class="drift-markers">
                        <span class="marker blue"></span>
                        <span class="marker orange"></span>
                        <span class="marker red"></span>
                    </div>
                </div>
            </div>
            
            <!-- Boost Indicator -->
            <div id="boost-indicator" class="boost-indicator hidden">
                <span>🚀 BOOST!</span>
            </div>
        `;

        document.body.appendChild(this.container);

        // Cache elements
        this.elements = {
            speed: document.getElementById('hud-speed'),
            speedBar: document.getElementById('speed-bar'),
            lap: document.getElementById('hud-lap'),
            position: document.getElementById('hud-position'),
            time: document.getElementById('hud-time'),
            itemPanel: document.getElementById('item-panel'),
            itemIcon: document.getElementById('item-icon'),
            itemRoulette: document.getElementById('item-roulette'),
            countdown: document.getElementById('countdown-overlay'),
            countdownText: document.getElementById('countdown-text'),
            positionBanner: document.getElementById('position-banner'),
            positionBannerText: document.getElementById('position-banner-text'),
            driftPanel: document.getElementById('drift-panel'),
            driftMeter: document.getElementById('drift-meter'),
            boostIndicator: document.getElementById('boost-indicator')
        };
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #race-hud {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 50;
                font-family: 'Orbitron', 'Inter', sans-serif;
            }
            
            .hud-panel.glass {
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                padding: 15px 25px;
                transition: all 0.3s ease;
            }
            
            /* Speed Panel */
            .speed-panel {
                position: absolute;
                top: 30px;
                left: 30px;
                min-width: 180px;
            }
            
            .speed-display {
                display: flex;
                align-items: baseline;
                gap: 8px;
            }
            
            .speed-value {
                font-size: 3rem;
                font-weight: 900;
                color: #00f2ff;
                text-shadow: 0 0 20px rgba(0, 242, 255, 0.5);
                line-height: 1;
            }
            
            .speed-unit {
                font-size: 0.9rem;
                color: #888;
                letter-spacing: 2px;
            }
            
            .speed-bar-container {
                height: 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                margin-top: 10px;
                overflow: hidden;
            }
            
            .speed-bar {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #00f2ff, #7000ff);
                border-radius: 3px;
                transition: width 0.15s ease-out;
            }
            
            /* Lap Panel */
            .lap-panel {
                position: absolute;
                top: 30px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .lap-label {
                font-size: 0.8rem;
                color: #888;
                letter-spacing: 3px;
            }
            
            .lap-value {
                font-size: 2.5rem;
                font-weight: 900;
                color: #fff;
            }
            
            .lap-separator, .lap-total {
                font-size: 1.5rem;
                color: #666;
            }
            
            /* Position Panel */
            .position-panel {
                position: absolute;
                top: 30px;
                right: 30px;
                text-align: center;
            }
            
            .position-value {
                font-size: 4rem;
                font-weight: 900;
                color: #ffd700;
                text-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
                line-height: 1;
            }
            
            .position-suffix {
                font-size: 1.5rem;
                color: #ffd700;
                vertical-align: super;
            }
            
            .position-total {
                font-size: 1rem;
                color: #666;
                margin-top: 5px;
            }
            
            /* Time Panel */
            .time-panel {
                position: absolute;
                top: 110px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .time-label {
                font-size: 0.7rem;
                color: #666;
                letter-spacing: 2px;
                margin-right: 10px;
            }
            
            .time-value {
                font-size: 1.8rem;
                font-weight: 700;
                color: #fff;
                font-variant-numeric: tabular-nums;
            }
            
            /* Item Panel */
            .item-panel {
                position: absolute;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .item-panel.has-item {
                opacity: 1;
            }
            
            .item-frame {
                width: 80px;
                height: 80px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-radius: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.3);
                position: relative;
                overflow: hidden;
            }
            
            .item-icon {
                font-size: 40px;
                opacity: 0;
                transition: all 0.3s ease;
            }
            
            .item-panel.has-item .item-icon {
                opacity: 1;
                animation: item-bounce 0.5s ease;
            }
            
            @keyframes item-bounce {
                0% { transform: scale(0) rotate(-180deg); }
                50% { transform: scale(1.3) rotate(10deg); }
                100% { transform: scale(1) rotate(0); }
            }
            
            .item-roulette {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: none;
            }
            
            .item-panel.rolling .item-roulette {
                display: block;
                animation: roulette-spin 0.1s linear infinite;
            }
            
            @keyframes roulette-spin {
                0% { background-position: 0 0; }
                100% { background-position: 0 100px; }
            }
            
            .item-hint {
                display: block;
                text-align: center;
                font-size: 0.7rem;
                color: #666;
                margin-top: 10px;
                letter-spacing: 1px;
            }
            
            /* Countdown */
            .countdown-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.5);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            
            .countdown-overlay.active {
                opacity: 1;
            }
            
            .countdown-text {
                font-size: 15rem;
                font-weight: 900;
                color: #fff;
                text-shadow: 
                    0 0 50px rgba(0, 242, 255, 0.8),
                    0 0 100px rgba(112, 0, 255, 0.5);
                animation: countdown-pulse 1s ease infinite;
            }
            
            @keyframes countdown-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            .countdown-text.go {
                color: #00ff00;
                text-shadow: 0 0 50px rgba(0, 255, 0, 0.8);
            }
            
            /* Position Banner */
            .position-banner {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px 60px;
                background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.8), transparent);
                font-size: 3rem;
                font-weight: 900;
                color: #ffd700;
                text-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
                animation: banner-slide 2s ease forwards;
            }
            
            @keyframes banner-slide {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                40% { transform: translate(-50%, -50%) scale(1); }
                80% { opacity: 1; }
                100% { opacity: 0; }
            }
            
            /* Drift Panel */
            .drift-panel {
                position: absolute;
                bottom: 30px;
                left: 30px;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .drift-panel.active {
                opacity: 1;
            }
            
            .drift-label {
                font-size: 0.7rem;
                color: #888;
                letter-spacing: 2px;
                display: block;
                margin-bottom: 8px;
            }
            
            .drift-meter-container {
                width: 150px;
                height: 8px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                position: relative;
                overflow: visible;
            }
            
            .drift-meter {
                height: 100%;
                width: 0%;
                border-radius: 4px;
                background: #00aaff;
                transition: width 0.1s ease-out, background 0.2s ease;
            }
            
            .drift-meter.blue { background: #00aaff; }
            .drift-meter.orange { background: #ff8800; }
            .drift-meter.red { background: #ff3300; }
            
            .drift-markers {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
            }
            
            .drift-markers .marker {
                position: absolute;
                top: -3px;
                width: 2px;
                height: 14px;
                background: #fff;
                opacity: 0.5;
            }
            
            .drift-markers .marker.blue { left: 33%; background: #00aaff; }
            .drift-markers .marker.orange { left: 66%; background: #ff8800; }
            .drift-markers .marker.red { left: 90%; background: #ff3300; }
            
            /* Boost Indicator */
            .boost-indicator {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 15px 40px;
                background: linear-gradient(90deg, #00f2ff, #7000ff);
                border-radius: 50px;
                font-size: 2rem;
                font-weight: 900;
                color: #fff;
                text-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
                animation: boost-flash 0.5s ease;
            }
            
            @keyframes boost-flash {
                0% { transform: translate(-50%, -50%) scale(0); }
                50% { transform: translate(-50%, -50%) scale(1.2); }
                100% { transform: translate(-50%, -50%) scale(1); }
            }
            
            .hidden {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    updateSpeed(speed, maxSpeed = 200) {
        const displaySpeed = Math.round(speed);
        this.elements.speed.textContent = displaySpeed;

        const percentage = Math.min((speed / maxSpeed) * 100, 100);
        this.elements.speedBar.style.width = `${percentage}%`;

        // Color change at high speed
        if (percentage > 80) {
            this.elements.speed.style.color = '#ff3300';
            this.elements.speedBar.style.background = 'linear-gradient(90deg, #ff3300, #ff0000)';
        } else if (percentage > 60) {
            this.elements.speed.style.color = '#ff8800';
            this.elements.speedBar.style.background = 'linear-gradient(90deg, #ff8800, #ff3300)';
        } else {
            this.elements.speed.style.color = '#00f2ff';
            this.elements.speedBar.style.background = 'linear-gradient(90deg, #00f2ff, #7000ff)';
        }
    }

    updateTime(timeMs) {
        const minutes = Math.floor(timeMs / 60000);
        const seconds = Math.floor((timeMs % 60000) / 1000);
        const ms = Math.floor((timeMs % 1000) / 10);

        this.elements.time.textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }

    updateLap(current, total = this.totalLaps) {
        this.currentLap = current;
        this.totalLaps = total;
        this.elements.lap.textContent = current;

        // Flash on lap change
        this.elements.lap.parentElement.style.animation = 'none';
        setTimeout(() => {
            this.elements.lap.parentElement.style.animation = 'lap-flash 0.5s ease';
        }, 10);
    }

    updatePosition(position) {
        this.position = position;

        const suffixes = ['ST', 'ND', 'RD', 'TH'];
        const suffix = position <= 3 ? suffixes[position - 1] : suffixes[3];

        this.elements.position.textContent = position;
        this.elements.position.nextElementSibling.textContent = suffix;

        // Color based on position
        const colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#888888'];
        const color = colors[Math.min(position - 1, 3)];
        this.elements.position.style.color = color;
    }

    setItem(itemType) {
        this.currentItem = itemType;

        const icons = {
            'Mushroom': '🍄',
            'GreenShell': '🟢',
            'RedShell': '🔴',
            'Banana': '🍌',
            'Star': '⭐',
            'Lightning': '⚡'
        };

        this.elements.itemIcon.textContent = icons[itemType] || '❓';
        this.elements.itemPanel.classList.add('has-item');
        this.elements.itemPanel.classList.remove('rolling');
    }

    clearItem() {
        this.currentItem = null;
        this.elements.itemIcon.textContent = '';
        this.elements.itemPanel.classList.remove('has-item');
    }

    startItemRoulette() {
        this.elements.itemPanel.classList.add('rolling');
        this.elements.itemPanel.classList.add('has-item');
    }

    updateDrift(driftTime, maxDrift = 3) {
        const percentage = Math.min((driftTime / maxDrift) * 100, 100);

        if (driftTime > 0) {
            this.elements.driftPanel.classList.add('active');
            this.elements.driftMeter.style.width = `${percentage}%`;

            // Color stages
            if (percentage > 90) {
                this.elements.driftMeter.className = 'drift-meter red';
            } else if (percentage > 66) {
                this.elements.driftMeter.className = 'drift-meter orange';
            } else if (percentage > 33) {
                this.elements.driftMeter.className = 'drift-meter blue';
            } else {
                this.elements.driftMeter.className = 'drift-meter';
            }
        } else {
            this.elements.driftPanel.classList.remove('active');
            this.elements.driftMeter.style.width = '0%';
        }
    }

    showBoost() {
        this.elements.boostIndicator.classList.remove('hidden');
        setTimeout(() => {
            this.elements.boostIndicator.classList.add('hidden');
        }, 800);
    }

    async startCountdown(onComplete = null) {
        this.isCountingDown = true;
        this.elements.countdown.classList.add('active');

        for (let i = 3; i >= 1; i--) {
            this.elements.countdownText.textContent = i;
            this.elements.countdownText.classList.remove('go');
            await this.delay(1000);
        }

        this.elements.countdownText.textContent = 'GO!';
        this.elements.countdownText.classList.add('go');
        await this.delay(500);

        this.elements.countdown.classList.remove('active');
        this.isCountingDown = false;

        if (onComplete) onComplete();
    }

    showPositionBanner(position) {
        const suffixes = ['ST', 'ND', 'RD', 'TH'];
        const suffix = position <= 3 ? suffixes[position - 1] : suffixes[3];

        this.elements.positionBannerText.textContent = `${position}${suffix} PLACE!`;
        this.elements.positionBanner.classList.remove('hidden');

        setTimeout(() => {
            this.elements.positionBanner.classList.add('hidden');
        }, 2000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
    }

    dispose() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
