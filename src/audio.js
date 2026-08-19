export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.volume = 0.55;
    this.musicVolume = 0.32;
    this.enabled = true;
    this.lastHitAt = 0;
    this.noiseBuffer = null;
    this.musicPlaying = false;
    this.musicPaused = false;
    this.musicStep = 0;
    this.musicNextTime = 0;
    this.musicTimer = 0;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value)));
    if (this.sfxBus && this.context) this.sfxBus.gain.setTargetAtTime(this.volume * 0.36, this.context.currentTime, 0.025);
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, Number(value)));
    this.updateMusicGain();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createDynamicsCompressor();
      this.master.threshold.value = -20;
      this.master.knee.value = 12;
      this.master.ratio.value = 6;
      this.master.attack.value = 0.003;
      this.master.release.value = 0.16;
      this.sfxBus = this.context.createGain();
      this.sfxBus.gain.value = this.volume * 0.36;
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = 0.0001;
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const noiseData = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1;
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  tone({ frequency = 220, endFrequency = frequency, duration = 0.08, type = "sine", gain = 0.15, delay = 0 }) {
    if (!this.enabled || !this.context || !this.sfxBus) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.sfxBus);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noise({ duration = 0.08, gain = 0.05, frequency = 900, type = "bandpass", q = 0.8, delay = 0, attack = 0.004 }) {
    if (!this.enabled || !this.context || !this.sfxBus || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const now = this.context.currentTime + delay;
    source.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.sfxBus);
    const maxOffset = Math.max(0, this.noiseBuffer.duration - duration - 0.01);
    source.start(now, Math.random() * maxOffset, duration);
    source.stop(now + duration + 0.01);
  }

  shoot(kind = "pulse") {
    const sounds = {
      pulse: [480, 220, 0.065, "square", 0.08],
      grenade: [130, 55, 0.16, "sawtooth", 0.16],
      arc: [780, 180, 0.12, "sawtooth", 0.08],
      beam: [620, 420, 0.09, "triangle", 0.06],
      rail: [820, 115, 0.11, "square", 0.075],
      drone: [330, 170, 0.055, "square", 0.045],
    };
    const [frequency, endFrequency, duration, type, gain] = sounds[kind] || sounds.pulse;
    this.tone({ frequency, endFrequency, duration, type, gain });
    if (kind === "rail" || kind === "beam") this.noise({ duration: 0.055, gain: 0.028, frequency: 2100, type: "highpass", q: 0.4 });
  }

  melee(kind = "blade", combo = 0) {
    const finish = combo === 2;
    if (kind === "hammer") {
      this.noise({ duration: finish ? 0.24 : 0.17, gain: finish ? 0.11 : 0.075, frequency: 260, type: "lowpass", q: 0.5 });
      this.tone({ frequency: finish ? 145 : 185, endFrequency: 52, duration: finish ? 0.2 : 0.14, type: "sawtooth", gain: finish ? 0.1 : 0.065 });
      return;
    }
    const twin = kind === "twin";
    this.noise({
      duration: finish ? 0.19 : twin ? 0.105 : 0.14,
      gain: finish ? 0.075 : 0.045,
      frequency: twin ? 1850 : 1320,
      type: "bandpass",
      q: 0.7,
    });
    this.tone({
      frequency: (twin ? 620 : 470) + combo * 55,
      endFrequency: twin ? 260 : 180,
      duration: finish ? 0.16 : 0.1,
      type: "triangle",
      gain: finish ? 0.06 : 0.035,
    });
  }

  hit(kind = "blade", { heavy = false, killed = false } = {}) {
    const now = performance.now();
    if (now - this.lastHitAt < 28) return;
    this.lastHitAt = now;
    const ranged = kind === "rail" || kind === "reflect";
    if (ranged) {
      this.noise({ duration: 0.052, gain: 0.095, frequency: 3100, type: "highpass", q: 0.55, attack: 0.001 });
      this.tone({ frequency: 310, endFrequency: 72, duration: 0.085, type: "square", gain: 0.105 });
      this.tone({ frequency: 1180, endFrequency: 510, duration: 0.045, type: "triangle", gain: 0.045 });
      return;
    }

    const hammer = kind === "hammer";
    const twin = kind === "twin";
    const weight = heavy ? 1.24 : 1;
    this.noise({
      duration: hammer ? 0.13 : 0.075,
      gain: (hammer ? 0.17 : 0.13) * weight,
      frequency: hammer ? 390 : twin ? 1900 : 1450,
      type: hammer ? "lowpass" : "bandpass",
      q: hammer ? 0.45 : 0.7,
      attack: 0.001,
    });
    this.noise({ duration: 0.026, gain: 0.105 * weight, frequency: 3600, type: "highpass", q: 0.4, attack: 0.001 });
    this.tone({
      frequency: hammer ? 112 : twin ? 168 : 142,
      endFrequency: hammer ? 38 : 52,
      duration: hammer ? 0.19 : 0.12,
      type: hammer ? "sawtooth" : "square",
      gain: (hammer ? 0.2 : 0.15) * weight,
    });
    this.tone({
      frequency: hammer ? 285 : twin ? 920 : 720,
      endFrequency: hammer ? 92 : twin ? 430 : 310,
      duration: hammer ? 0.14 : 0.105,
      type: "triangle",
      gain: (hammer ? 0.09 : 0.075) * weight,
      delay: 0.006,
    });
    if (killed) this.tone({ frequency: heavy ? 96 : 125, endFrequency: 32, duration: 0.2, type: "sine", gain: 0.16, delay: 0.012 });
  }

  guard(perfect = false) {
    if (perfect) {
      this.tone({ frequency: 980, endFrequency: 1480, duration: 0.16, type: "sine", gain: 0.085 });
      this.tone({ frequency: 520, endFrequency: 760, duration: 0.13, type: "triangle", gain: 0.055, delay: 0.025 });
      this.noise({ duration: 0.07, gain: 0.035, frequency: 3200, type: "highpass", q: 0.5 });
    } else {
      this.tone({ frequency: 185, endFrequency: 92, duration: 0.11, type: "square", gain: 0.065 });
      this.noise({ duration: 0.09, gain: 0.045, frequency: 520, type: "bandpass", q: 0.8 });
    }
  }

  reload() {
    this.tone({ frequency: 420, endFrequency: 360, duration: 0.045, type: "square", gain: 0.035 });
    this.tone({ frequency: 610, endFrequency: 820, duration: 0.07, type: "triangle", gain: 0.04, delay: 0.085 });
  }

  skill(kind = "pulseSlash") {
    const low = kind === "barrier";
    this.tone({ frequency: low ? 180 : 330, endFrequency: low ? 520 : 980, duration: 0.28, type: "triangle", gain: 0.09 });
    this.noise({ duration: 0.22, gain: 0.045, frequency: low ? 480 : 1500, type: "bandpass", q: 0.55 });
  }

  pickup() {
    this.tone({ frequency: 620, endFrequency: 980, duration: 0.07, type: "sine", gain: 0.055 });
  }

  levelUp() {
    this.tone({ frequency: 330, endFrequency: 880, duration: 0.28, type: "triangle", gain: 0.11 });
  }

  dash() {
    this.tone({ frequency: 240, endFrequency: 70, duration: 0.18, type: "sawtooth", gain: 0.09 });
    this.noise({ duration: 0.15, gain: 0.04, frequency: 1100, type: "bandpass", q: 0.45 });
  }

  hurt() {
    this.tone({ frequency: 140, endFrequency: 45, duration: 0.22, type: "square", gain: 0.13 });
    this.noise({ duration: 0.13, gain: 0.06, frequency: 360, type: "lowpass", q: 0.5 });
  }

  explosion() {
    this.tone({ frequency: 90, endFrequency: 32, duration: 0.28, type: "sawtooth", gain: 0.18 });
    this.noise({ duration: 0.3, gain: 0.1, frequency: 260, type: "lowpass", q: 0.45 });
  }

  midi(note) {
    return 440 * 2 ** ((note - 69) / 12);
  }

  updateMusicGain(fade = 0.08) {
    if (!this.context || !this.musicBus) return;
    const now = this.context.currentTime;
    const activity = this.musicPlaying ? (this.musicPaused ? 0.22 : 1) : 0;
    const target = Math.max(0.0001, this.musicVolume * 0.13 * activity);
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(Math.max(0.0001, this.musicBus.gain.value), now);
    this.musicBus.gain.exponentialRampToValueAtTime(target, now + fade);
  }

  musicTone({ note, duration = 0.18, gain = 0.1, type = "triangle", when, endNote = note }) {
    if (!this.context || !this.musicBus) return;
    const start = when ?? this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(this.midi(note), start);
    oscillator.frequency.exponentialRampToValueAtTime(this.midi(endNote), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.018, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.musicBus);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  musicNoise({ duration = 0.04, gain = 0.08, frequency = 4200, type = "highpass", when }) {
    if (!this.context || !this.musicBus || !this.noiseBuffer) return;
    const start = when ?? this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.55;
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.musicBus);
    const maxOffset = Math.max(0, this.noiseBuffer.duration - duration - 0.01);
    source.start(start, Math.random() * maxOffset, duration);
    source.stop(start + duration + 0.01);
  }

  scheduleMusicStep(time, absoluteStep) {
    const step = absoluteStep % 16;
    const bar = Math.floor(absoluteStep / 16) % 4;
    const roots = [38, 41, 34, 36];
    const root = roots[bar];

    if ([0, 4, 8, 12].includes(step) || (step === 14 && bar % 2 === 1)) {
      this.musicTone({ note: 47, endNote: 26, duration: 0.13, gain: step === 0 ? 0.58 : 0.46, type: "sine", when: time });
    }
    if (step === 4 || step === 12) {
      this.musicNoise({ duration: 0.09, gain: 0.2, frequency: 1150, type: "bandpass", when: time });
    }
    if (step % 2 === 1) {
      this.musicNoise({ duration: 0.026, gain: step % 4 === 3 ? 0.11 : 0.075, frequency: 5200, when: time });
    }

    const bassPattern = [0, 0, 7, 0, 3, 7, 10, 7];
    if (step % 2 === 0) {
      const bassNote = root + bassPattern[(step / 2) % bassPattern.length];
      this.musicTone({ note: bassNote, endNote: bassNote - 12, duration: 0.21, gain: 0.2, type: "sawtooth", when: time });
    }

    const arpPattern = [12, 15, 19, 22, 19, 15, 24, 22];
    if (step % 2 === 1) {
      const arpNote = root + arpPattern[((step - 1) / 2) % arpPattern.length];
      this.musicTone({ note: arpNote, endNote: arpNote - 5, duration: 0.105, gain: 0.07, type: "square", when: time });
    }

    if (step === 0) {
      this.musicTone({ note: root + 12, duration: 1.85, gain: 0.052, type: "triangle", when: time });
      this.musicTone({ note: root + 19, duration: 1.82, gain: 0.032, type: "sine", when: time + 0.012 });
    }
  }

  scheduleMusic() {
    if (!this.musicPlaying || !this.context) return;
    const sixteenth = 60 / 112 / 4;
    const horizon = this.context.currentTime + 0.48;
    while (this.musicNextTime < horizon) {
      this.scheduleMusicStep(this.musicNextTime, this.musicStep);
      this.musicNextTime += sixteenth;
      this.musicStep += 1;
    }
  }

  startMusic() {
    this.unlock();
    if (!this.context || !this.musicBus) return;
    if (!this.musicPlaying) {
      this.musicPlaying = true;
      this.musicPaused = false;
      this.musicStep = 0;
      this.musicNextTime = this.context.currentTime + 0.06;
      this.scheduleMusic();
      this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
    } else {
      this.musicPaused = false;
    }
    this.updateMusicGain(0.18);
  }

  pauseMusic() {
    if (!this.musicPlaying) return;
    this.musicPaused = true;
    this.updateMusicGain(0.12);
  }

  resumeMusic() {
    if (!this.musicPlaying) {
      this.startMusic();
      return;
    }
    this.musicPaused = false;
    this.updateMusicGain(0.16);
  }

  stopMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    this.musicPlaying = false;
    this.musicPaused = false;
    this.updateMusicGain(0.22);
  }

  endRun(victory) {
    this.stopMusic();
    if (victory) {
      [50, 55, 62, 67].forEach((note, index) => this.tone({
        frequency: this.midi(note), endFrequency: this.midi(note + 7), duration: 0.22,
        type: "triangle", gain: 0.08, delay: index * 0.105,
      }));
    } else {
      this.tone({ frequency: 155, endFrequency: 42, duration: 0.48, type: "sawtooth", gain: 0.14 });
      this.noise({ duration: 0.32, gain: 0.075, frequency: 310, type: "lowpass", q: 0.45 });
    }
  }
}

export const audio = new AudioEngine();
