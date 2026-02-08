export class RaceManager {
    constructor(trackPoints, totalLaps = 3) {
        this.trackPoints = trackPoints;
        this.totalLaps = totalLaps;

        this.racers = []; // { id, name, body, lap, lapProgress, lastCheckpoint, finished }
        this.checkpoints = this.createCheckpoints();
        this.raceStarted = false;
        this.raceFinished = false;
        this.startTime = 0;

        this.onLapComplete = null;
        this.onRaceFinish = null;
        this.onPositionChange = null;
    }

    createCheckpoints() {
        const checkpoints = [];
        const numCheckpoints = 20; // Divide track into 20 checkpoints
        const step = Math.floor(this.trackPoints.length / numCheckpoints);

        for (let i = 0; i < numCheckpoints; i++) {
            const point = this.trackPoints[i * step];
            checkpoints.push({
                index: i,
                position: { x: point.x, z: point.z },
                radius: 30 // Detection radius
            });
        }

        return checkpoints;
    }

    addRacer(id, name, body, isPlayer = false) {
        const racer = {
            id,
            name,
            body,
            isPlayer,
            lap: 1,
            lapProgress: 0,
            lastCheckpoint: 0,
            checkpointsPassed: new Set([0]),
            finished: false,
            finishTime: 0,
            bestLapTime: Infinity,
            currentLapStart: 0
        };

        this.racers.push(racer);
        return racer;
    }

    startRace() {
        this.raceStarted = true;
        this.raceFinished = false;
        this.startTime = Date.now();

        this.racers.forEach(racer => {
            racer.lap = 1;
            racer.lapProgress = 0;
            racer.lastCheckpoint = 0;
            racer.checkpointsPassed = new Set([0]);
            racer.finished = false;
            racer.finishTime = 0;
            racer.currentLapStart = Date.now();
        });
    }

    update() {
        if (!this.raceStarted || this.raceFinished) return;

        this.racers.forEach(racer => {
            if (racer.finished) return;

            this.updateRacerCheckpoints(racer);
        });

        // Update positions
        this.updatePositions();
    }

    updateRacerCheckpoints(racer) {
        const pos = racer.body.position;

        // Find nearest checkpoint
        let nearestCheckpoint = -1;
        let nearestDist = Infinity;

        for (let i = 0; i < this.checkpoints.length; i++) {
            const cp = this.checkpoints[i];
            const dx = pos.x - cp.position.x;
            const dz = pos.z - cp.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < cp.radius && dist < nearestDist) {
                nearestDist = dist;
                nearestCheckpoint = i;
            }
        }

        if (nearestCheckpoint === -1) return;

        // Check if this is a valid progression
        const lastCP = racer.lastCheckpoint;
        const numCheckpoints = this.checkpoints.length;

        // Check for forward progression
        const diff = (nearestCheckpoint - lastCP + numCheckpoints) % numCheckpoints;

        // Only allow forward progression (within reasonable range)
        if (diff > 0 && diff < numCheckpoints / 2) {
            racer.checkpointsPassed.add(nearestCheckpoint);
            racer.lastCheckpoint = nearestCheckpoint;

            // Calculate lap progress (0-1)
            racer.lapProgress = nearestCheckpoint / numCheckpoints;

            // Check for lap completion (crossed start/finish line)
            if (nearestCheckpoint === 0 && racer.checkpointsPassed.size >= numCheckpoints * 0.7) {
                this.completeLap(racer);
            }
        }
    }

    completeLap(racer) {
        const lapTime = Date.now() - racer.currentLapStart;

        if (lapTime < racer.bestLapTime) {
            racer.bestLapTime = lapTime;
        }

        racer.lap++;
        racer.checkpointsPassed = new Set([0]);
        racer.currentLapStart = Date.now();

        if (this.onLapComplete && racer.isPlayer) {
            this.onLapComplete(racer.lap - 1, lapTime, racer.bestLapTime);
        }

        // Check for race finish
        if (racer.lap > this.totalLaps) {
            this.finishRacer(racer);
        }
    }

    finishRacer(racer) {
        racer.finished = true;
        racer.finishTime = Date.now() - this.startTime;
        racer.lap = this.totalLaps; // Cap at total laps

        if (racer.isPlayer && this.onRaceFinish) {
            const position = this.getPosition(racer.id);
            this.onRaceFinish(position, racer.finishTime, racer.bestLapTime);
        }

        // Check if all racers finished
        if (this.racers.every(r => r.finished)) {
            this.raceFinished = true;
        }
    }

    updatePositions() {
        // Sort racers by: finished > lap > lapProgress
        const sorted = [...this.racers].sort((a, b) => {
            // Finished racers first, by finish time
            if (a.finished && b.finished) {
                return a.finishTime - b.finishTime;
            }
            if (a.finished) return -1;
            if (b.finished) return 1;

            // Then by lap
            if (a.lap !== b.lap) {
                return b.lap - a.lap;
            }

            // Then by progress within lap
            return b.lapProgress - a.lapProgress;
        });

        // Check for position changes
        sorted.forEach((racer, index) => {
            const newPosition = index + 1;
            const oldPosition = this.getPosition(racer.id);

            if (newPosition !== oldPosition && this.onPositionChange && racer.isPlayer) {
                this.onPositionChange(newPosition, newPosition < oldPosition);
            }
        });

        this._sortedRacers = sorted;
    }

    getPosition(racerId) {
        if (!this._sortedRacers) {
            this.updatePositions();
        }

        for (let i = 0; i < this._sortedRacers.length; i++) {
            if (this._sortedRacers[i].id === racerId) {
                return i + 1;
            }
        }
        return this.racers.length;
    }

    getPlayerPosition() {
        const player = this.racers.find(r => r.isPlayer);
        if (!player) return 1;
        return this.getPosition(player.id);
    }

    getPlayerLap() {
        const player = this.racers.find(r => r.isPlayer);
        return player ? Math.min(player.lap, this.totalLaps) : 1;
    }

    getRaceTime() {
        if (!this.raceStarted) return 0;
        return Date.now() - this.startTime;
    }

    getAllPositions() {
        if (!this._sortedRacers) {
            this.updatePositions();
        }

        return this._sortedRacers.map(racer => ({
            x: racer.body.position.x,
            z: racer.body.position.z
        }));
    }

    getBotPositions() {
        return this.racers
            .filter(r => !r.isPlayer)
            .map(racer => ({
                x: racer.body.position.x,
                z: racer.body.position.z
            }));
    }

    reset() {
        this.raceStarted = false;
        this.raceFinished = false;
        this.startTime = 0;
        this._sortedRacers = null;

        this.racers.forEach(racer => {
            racer.lap = 1;
            racer.lapProgress = 0;
            racer.lastCheckpoint = 0;
            racer.checkpointsPassed = new Set([0]);
            racer.finished = false;
            racer.finishTime = 0;
            racer.bestLapTime = Infinity;
            racer.currentLapStart = 0;
        });
    }
}
