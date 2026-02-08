export class Input {
    constructor() {
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            space: false,
            shift: false,
            reset: false
        };

        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));
    }

    handleKey(e, isPressed) {
        const key = e.key.toLowerCase();

        // Movement
        if (key === 'w' || key === 'arrowup') this.keys.up = isPressed;
        if (key === 's' || key === 'arrowdown') this.keys.down = isPressed;
        if (key === 'a' || key === 'arrowleft') this.keys.left = isPressed;
        if (key === 'd' || key === 'arrowright') this.keys.right = isPressed;

        // Actions
        if (key === ' ' || key === 'space') this.keys.space = isPressed;
        if (key === 'shift') this.keys.shift = isPressed;
        if (key === 'e') this.keys.shift = isPressed; // Alt key for items

        // Meta
        if (key === 'r' && isPressed) this.keys.reset = true;
        else if (key === 'r' && !isPressed) this.keys.reset = false;
    }
}
