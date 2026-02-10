export class SoundManager {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.context.createGain();
        this.volume = 0.75; // 50% of max (1.5)
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.context.destination);

        this.engineOscCheck = null;
        this.isMuted = false;
    }

    setVolume(vol) {
        // Range 0 to 1.5 so 100% is louder
        this.volume = vol * 1.5;
        if (!this.isMuted) {
            this.masterGain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.1);
        }
    }

    toggleMute(forceState) {
        if (typeof forceState === 'boolean') {
            this.isMuted = forceState;
        } else {
            this.isMuted = !this.isMuted;
        }

        if (this.isMuted) {
            this.masterGain.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
        } else {
            this.masterGain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.1);
        }
        return this.isMuted;
    }

    unlock() {
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    startEngine() {
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
        if (this.engineNode) return;

        // Use Noise instead of a Tone for a smoother "wind/road" sound
        const bufferSize = this.context.sampleRate * 2.0; // 2 seconds loop
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            // White noise
            data[i] = Math.random() * 2 - 1;
        }

        this.engineNode = this.context.createBufferSource();
        this.engineNode.buffer = buffer;
        this.engineNode.loop = true;

        // Lowpass filter to make it a deep rumble/whoosh
        this.engineFilter = this.context.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 200; // Start muffled

        this.engineGain = this.context.createGain();
        this.engineGain.gain.value = 0.25; // Boosted base engine volume as requested

        this.engineNode.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineNode.start();
    }

    setEnginePitch(multiplier) {
        if (this.engineFilter) {
            // Instead of pitch, we open the filter to simulate air rushing faster
            // Base 200Hz + up to 400Hz more
            const targetFreq = 200 + (multiplier * 400);
            this.engineFilter.frequency.setTargetAtTime(targetFreq, this.context.currentTime, 0.2);

            // Slightly increase volume with speed
            const targetVol = 0.05 + (multiplier * 0.05);
            this.engineGain.gain.setTargetAtTime(targetVol, this.context.currentTime, 0.2);
        }
    }

    stopEngine() {
        if (this.engineNode) {
            try { this.engineNode.stop(); } catch (e) { }
            this.engineNode = null;
        }
        // Cleanup other ref if it exists from previous version
        if (this.engineOsc2) {
            try { this.engineOsc2.stop(); } catch (e) { }
            this.engineOsc2 = null;
        }
    }

    playCoin() {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2000, this.context.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.context.currentTime + 0.15);
    }

    playBoost() {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.context.currentTime);
        osc.frequency.linearRampToValueAtTime(600, this.context.currentTime + 0.3);

        gain.gain.setValueAtTime(0.2, this.context.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.context.currentTime + 0.3);

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.context.currentTime + 0.35);
    }

    playGameOver() {
        // Funny "Wah-wah-wah-waaah" sound
        const now = this.context.currentTime;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(this.masterGain);

        // Wah 1
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);

        // Wah 2
        osc.frequency.setValueAtTime(300, now + 0.3);
        osc.frequency.linearRampToValueAtTime(200, now + 0.6);
        gain.gain.setValueAtTime(0.3, now + 0.3);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);

        // Wah 3 (Long)
        osc.frequency.setValueAtTime(200, now + 0.6);
        osc.frequency.linearRampToValueAtTime(100, now + 1.2);
        gain.gain.setValueAtTime(0.3, now + 0.6);
        gain.gain.linearRampToValueAtTime(0, now + 1.2);

        osc.start(now);
        osc.stop(now + 1.3);
    }

    playCountdown(isFinal = false) {
        const now = this.context.currentTime;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'sine';
        // 3-2-1 are lower, "GO" is a bright high beep
        osc.frequency.setValueAtTime(isFinal ? 1200 : 600, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + (isFinal ? 0.4 : 0.2));

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + (isFinal ? 0.5 : 0.3));
    }
}
