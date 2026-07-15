// RimTown Chiptune Music Engine - 8-bit NES-style procedural BGM
// Uses Web Audio API to synthesize chiptune music in real-time
// Supports day/night/dawn/evening tracks + custom audio file override

class ChiptuneEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.volume = 0.2;
        this.muted = false;
        this.playing = false;
        this.currentTrack = null;
        this._schedulerTimer = null;
        this._nextNoteTime = 0;
        this._currentStep = 0;
        this._tempo = 140; // BPM
        this._customTracks = {}; // { day: AudioBuffer, night: AudioBuffer, ... }
        this._customSource = null;
        this._initialized = false;
    }

    // Must be called from a user gesture (click/tap)
    init() {
        if (this._initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.volume * this.volume; // 平方感知曲線,方波不再刺耳
        this.masterGain.connect(this.ctx.destination);
        this._initialized = true;
    }

    // v4.4.1 8-bit UI 音效(短促方波,跟隨 BGM 靜音/音量設定)
    sfx(name) {
        if (!this._initialized || this.muted || !this.ctx) return;
        const seqs = {
            click: [[880, 0.045]],
            open:  [[523, 0.05], [784, 0.07]],
            close: [[784, 0.05], [523, 0.07]],
            coin:  [[988, 0.05], [1319, 0.10]],
            send:  [[660, 0.04], [880, 0.05]],
        };
        const seq = seqs[name] || seqs.click;
        let t = this.ctx.currentTime;
        const peak = Math.max(0.0002, this.volume * this.volume * 0.6);
        for (const [freq, dur] of seq) {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'square';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(this.ctx.destination);
            o.start(t); o.stop(t + dur + 0.02);
            t += dur * 0.85;
        }
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.masterGain && !this.muted) {
            this.masterGain.gain.setTargetAtTime(this.volume * this.volume, this.ctx.currentTime, 0.05);
        }
        localStorage.setItem('rimtown_bgm_volume', this.volume);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume * this.volume, this.ctx.currentTime, 0.05);
        }
        localStorage.setItem('rimtown_bgm_muted', this.muted ? '1' : '0');
        return this.muted;
    }

    loadSettings() {
        const v = localStorage.getItem('rimtown_bgm_volume');
        if (v !== null) this.volume = parseFloat(v);
        this.muted = localStorage.getItem('rimtown_bgm_muted') === '1';
    }

    // Play a track by phase name: 'dawn', 'morning', 'afternoon', 'evening', 'night'
    play(phase) {
        if (!this._initialized) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        // Normalize phases
        const trackName = (phase === 'morning' || phase === 'afternoon') ? 'day' : (phase === 'dawn' ? 'dawn' : (phase === 'evening' ? 'evening' : 'night'));
        if (this.currentTrack === trackName && this.playing) return;
        this.stop();
        this.currentTrack = trackName;
        this.playing = true;

        // If custom audio file is loaded for this track, use it
        if (this._customTracks[trackName]) {
            this._playCustom(trackName);
            return;
        }
        // Otherwise use procedural synthesis
        this._currentStep = 0;
        this._nextNoteTime = this.ctx.currentTime;
        this._scheduleNotes();
    }

    stop() {
        this.playing = false;
        this.currentTrack = null;
        if (this._schedulerTimer) {
            clearInterval(this._schedulerTimer);
            this._schedulerTimer = null;
        }
        if (this._customSource) {
            try { this._customSource.stop(); } catch(e) {}
            this._customSource = null;
        }
    }

    // Load a custom audio file for a specific track
    async loadCustomTrack(phase, url) {
        if (!this._initialized) this.init();
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        const audioBuf = await this.ctx.decodeAudioData(buf);
        const trackName = (phase === 'morning' || phase === 'afternoon') ? 'day' : (phase === 'dawn' ? 'dawn' : (phase === 'evening' ? 'evening' : 'night'));
        this._customTracks[trackName] = audioBuf;
    }

    _playCustom(trackName) {
        const source = this.ctx.createBufferSource();
        source.buffer = this._customTracks[trackName];
        source.loop = true;
        source.connect(this.masterGain);
        source.start();
        this._customSource = source;
    }

    // =============================
    // Procedural Chiptune Synthesis
    // =============================

    _scheduleNotes() {
        const lookAhead = 0.1; // seconds
        const scheduleInterval = 50; // ms

        this._schedulerTimer = setInterval(() => {
            if (!this.playing) return;
            while (this._nextNoteTime < this.ctx.currentTime + lookAhead) {
                this._playStep(this._nextNoteTime);
                const stepDuration = 60 / this._tempo / 4; // 16th notes
                this._nextNoteTime += stepDuration;
                this._currentStep++;
            }
        }, scheduleInterval);
    }

    _playStep(time) {
        const track = this._getTrackData();
        const len = track.melody.length;
        const step = this._currentStep % len;
        const stepDuration = 60 / this._tempo / 4;

        // Melody (pulse wave)
        const note = track.melody[step];
        if (note > 0) {
            this._playPulse(note, time, stepDuration * 0.8, 0.25, track.pulseWidth || 0.25);
        }

        // Bass (triangle wave) - plays every 4 steps
        if (step % 4 === 0) {
            const bassNote = track.bass[Math.floor(step / 4) % track.bass.length];
            if (bassNote > 0) {
                this._playTriangle(bassNote, time, stepDuration * 3.5, 0.3);
            }
        }

        // Arpeggio / harmony (pulse wave, quieter)
        if (track.arp && step % 2 === 0) {
            const arpNote = track.arp[Math.floor(step / 2) % track.arp.length];
            if (arpNote > 0) {
                this._playPulse(arpNote, time, stepDuration * 1.5, 0.1, 0.5);
            }
        }

        // Drums (noise channel)
        if (track.drums) {
            const drumStep = step % track.drums.length;
            const drum = track.drums[drumStep];
            if (drum === 'k') this._playKick(time);
            else if (drum === 's') this._playSnare(time);
            else if (drum === 'h') this._playHiHat(time);
        }
    }

    // NES-style pulse wave (square with variable duty cycle)
    _playPulse(freq, time, duration, vol, duty) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        // Approximate pulse via harmonics of square wave
        osc.type = duty <= 0.25 ? 'square' : 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + duration + 0.01);
    }

    // NES-style triangle wave (bass)
    _playTriangle(freq, time, duration, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + duration + 0.01);
    }

    // Kick drum using short sine sweep
    _playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.15);
    }

    // Snare drum using noise burst
    _playSnare(time) {
        const bufSize = this.ctx.sampleRate * 0.08;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buf;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        source.connect(gain);
        gain.connect(this.masterGain);
        source.start(time);
    }

    // Hi-hat using high-freq noise
    _playHiHat(time) {
        const bufSize = this.ctx.sampleRate * 0.03;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start(time);
    }

    // ============================
    // Track Data - NES Pokémon style
    // ============================

    _getTrackData() {
        switch (this.currentTrack) {
            case 'day': return this._dayTrack();
            case 'night': return this._nightTrack();
            case 'dawn': return this._dawnTrack();
            case 'evening': return this._eveningTrack();
            default: return this._dayTrack();
        }
    }

    // Note frequencies (C4=262, etc.)
    // C D E F G A B
    static N = {
        C3:131, D3:147, E3:165, F3:175, G3:196, A3:220, B3:247,
        C4:262, D4:294, E4:330, F4:349, G4:392, A4:440, B4:494,
        C5:523, D5:587, E5:659, F5:698, G5:784, A5:880, B5:988,
        C6:1047
    };

    // Upbeat adventure theme - like Pokémon town
    _dayTrack() {
        const N = ChiptuneEngine.N;
        return {
            tempo: 150,
            melody: [
                N.E5, 0, N.G5, 0, N.A5, 0, N.G5, 0,
                N.E5, 0, N.D5, 0, N.C5, 0, N.D5, 0,
                N.E5, 0, N.G5, 0, N.A5, 0, N.B5, 0,
                N.A5, 0, N.G5, 0, N.E5, 0, 0, 0,
                N.C5, 0, N.D5, 0, N.E5, 0, N.G5, 0,
                N.A5, 0, N.G5, 0, N.E5, 0, N.D5, 0,
                N.C5, 0, N.E5, 0, N.D5, 0, N.C5, 0,
                N.D5, 0, N.E5, 0, 0, 0, 0, 0,
            ],
            bass: [
                N.C3, N.C3, N.G3, N.G3,
                N.A3, N.A3, N.E3, N.E3,
                N.F3, N.F3, N.C3, N.C3,
                N.G3, N.G3, N.G3, N.G3,
            ],
            arp: [
                N.C4, N.E4, N.G4, N.E4,
                N.A3, N.C4, N.E4, N.C4,
                N.F3, N.A3, N.C4, N.A3,
                N.G3, N.B3, N.D4, N.B3,
            ],
            drums: [
                'k',0,'h',0, 's',0,'h',0,
                'k',0,'h',0, 's',0,'h','h',
                'k',0,'h',0, 's',0,'h',0,
                'k','k','h',0, 's',0,'h','h',
            ],
            pulseWidth: 0.25,
        };
    }

    // Calm night theme - slower, minor key, like Pokémon night music
    _nightTrack() {
        const N = ChiptuneEngine.N;
        this._tempo = 100;
        return {
            melody: [
                N.E4, 0, 0, N.G4, 0, 0, N.A4, 0,
                0, 0, N.G4, 0, 0, N.E4, 0, 0,
                N.D4, 0, 0, N.E4, 0, 0, N.C4, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                N.A4, 0, 0, N.G4, 0, 0, N.E4, 0,
                0, 0, N.D4, 0, 0, N.C4, 0, 0,
                N.D4, 0, 0, N.E4, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
            ],
            bass: [
                N.A3, 0, N.E3, 0,
                N.D3, 0, N.A3, 0,
                N.A3, 0, N.E3, 0,
                N.D3, 0, N.E3, 0,
            ],
            arp: [
                N.A3, N.C4, N.E4, 0,
                N.D3, N.F3, N.A3, 0,
                N.A3, N.C4, N.E4, 0,
                N.E3, N.G3, N.B3, 0,
            ],
            drums: [
                'k',0,0,0, 0,0,'h',0,
                0,0,0,0, 's',0,0,0,
                'k',0,0,0, 0,0,'h',0,
                0,0,0,0, 0,0,0,0,
            ],
            pulseWidth: 0.5,
        };
    }

    // Dawn - gentle awakening theme
    _dawnTrack() {
        const N = ChiptuneEngine.N;
        this._tempo = 120;
        return {
            melody: [
                N.C5, 0, N.E5, 0, 0, 0, N.G5, 0,
                0, 0, N.E5, 0, N.D5, 0, 0, 0,
                N.C5, 0, 0, 0, N.D5, 0, N.E5, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
                N.G4, 0, N.C5, 0, 0, 0, N.E5, 0,
                0, 0, N.D5, 0, N.C5, 0, 0, 0,
                N.E5, 0, 0, 0, N.D5, 0, N.C5, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
            ],
            bass: [
                N.C3, 0, N.G3, 0,
                N.F3, 0, N.C3, 0,
                N.C3, 0, N.G3, 0,
                N.F3, 0, N.G3, 0,
            ],
            arp: [
                N.C4, N.E4, N.G4, 0,
                N.F3, N.A3, N.C4, 0,
                N.C4, N.E4, N.G4, 0,
                N.G3, N.B3, N.D4, 0,
            ],
            drums: [
                'k',0,0,0, 0,0,0,0,
                0,0,0,0, 'h',0,0,0,
                'k',0,0,0, 0,0,0,0,
                0,0,0,0, 0,0,0,0,
            ],
            pulseWidth: 0.25,
        };
    }

    // Evening - warm, winding-down theme
    _eveningTrack() {
        const N = ChiptuneEngine.N;
        this._tempo = 115;
        return {
            melody: [
                N.G4, 0, N.A4, 0, N.B4, 0, 0, 0,
                N.A4, 0, N.G4, 0, N.E4, 0, 0, 0,
                N.D4, 0, N.E4, 0, N.G4, 0, 0, 0,
                N.E4, 0, N.D4, 0, 0, 0, 0, 0,
                N.G4, 0, N.B4, 0, N.A4, 0, 0, 0,
                N.G4, 0, N.E4, 0, N.D4, 0, 0, 0,
                N.C4, 0, N.D4, 0, N.E4, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0,
            ],
            bass: [
                N.C3, 0, N.G3, 0,
                N.A3, 0, N.E3, 0,
                N.F3, 0, N.C3, 0,
                N.G3, 0, N.G3, 0,
            ],
            arp: [
                N.C4, N.E4, N.G4, N.E4,
                N.A3, N.C4, N.E4, N.C4,
                N.F3, N.A3, N.C4, N.A3,
                N.G3, N.B3, N.D4, N.B3,
            ],
            drums: [
                'k',0,0,0, 'h',0,0,0,
                0,0,0,0, 's',0,0,0,
                'k',0,0,0, 'h',0,0,0,
                0,0,0,0, 0,0,0,0,
            ],
            pulseWidth: 0.25,
        };
    }
}
