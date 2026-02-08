export class UI {
    constructor() {
        this.speedText = document.getElementById('speed');
        this.timeText = document.getElementById('time');
        this.menu = document.getElementById('menu');
        this.startBtn = document.getElementById('start-btn');
        this.hud = document.querySelector('.hud');

        this.onStart = null;

        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => {
                if (this.onStart) this.onStart();
            });
        }
    }

    showGameUI() {
        if (this.menu) this.menu.classList.add('hidden');
        if (this.hud) this.hud.classList.add('active');
    }

    update(stats) {
        if (this.speedText) {
            this.speedText.innerText = Math.round(stats.speed).toString();
        }

        if (this.timeText && stats.time !== undefined) {
            const minutes = Math.floor(stats.time / 60000).toString().padStart(2, '0');
            const seconds = Math.floor((stats.time % 60000) / 1000).toString().padStart(2, '0');
            const ms = Math.floor((stats.time % 1000) / 10).toString().padStart(2, '0');
            this.timeText.innerText = `${minutes}:${seconds}.${ms}`;
        }
    }
}
