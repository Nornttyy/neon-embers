export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.volume = 0.55;
    this.musicVolume = 0.26;
    this.enabled = true;
    this.lastHitAt = 0;
    this.noiseBuffer = null;
    this.musicPlaying = false;
    this.musicPaused = false;
    this.musicStep = 0;
    this.musicNextTime = 0;
    this.musicTimer = 0;
    this.sampleBuffers = { bladeSwing: [], bladeHit: [], hammerHit: [] };
    this.sampleLastIndex = {};
    this.sampleLoadPromise = null;
    this.sampleVoices = 0;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value)));
    if (this.sfxBus && this.context) this.sfxBus.gain.setTargetAtTime(this.volume * 0.24, this.context.currentTime, 0.025);
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
      this.sfxBus.gain.value = this.volume * 0.24;
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = 0.0001;
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const noiseData = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1;
      void this.loadSamples();
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

  loadSamples() {
    if (!this.context) return Promise.resolve();
    if (this.sampleLoadPromise) return this.sampleLoadPromise;
    const files = {
      bladeSwing: ["blade-swing-1.ogg", "blade-swing-2.ogg", "blade-swing-3.ogg"],
      bladeHit: ["blade-hit-1.ogg", "blade-hit-2.ogg", "blade-hit-3.ogg"],
      hammerHit: ["hammer-hit-1.ogg", "hammer-hit-2.ogg"],
    };
    this.sampleLoadPromise = Promise.all(Object.entries(files).flatMap(([group, names]) => names.map(async (name) => {
      try {
        const response = await fetch(`assets/audio/${name}`);
        if (!response.ok) return;
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.sampleBuffers[group].push(buffer);
      } catch {
        // Sample loading is optional; procedural fallbacks keep combat audible offline.
      }
    })));
    return this.sampleLoadPromise;
  }

  playSample(group, { gain = 0.45, rate = 1, variance = 0.035, delay = 0 } = {}) {
    if (!this.enabled || !this.context || !this.sfxBus || this.sampleVoices >= 6) return false;
    const buffers = this.sampleBuffers[group];
    if (!buffers?.length) return false;
    let index = Math.floor(Math.random() * buffers.length);
    if (buffers.length > 1 && index === this.sampleLastIndex[group]) index = (index + 1) % buffers.length;
    this.sampleLastIndex[group] = index;
    const source = this.context.createBufferSource();
    const envelope = this.context.createGain();
    const now = this.context.currentTime + delay;
    source.buffer = buffers[index];
    source.playbackRate.value = Math.max(0.72, rate + (Math.random() * 2 - 1) * variance);
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(source.buffer.duration / source.playbackRate.value, 0.72));
    source.connect(envelope);
    envelope.connect(this.sfxBus);
    this.sampleVoices += 1;
    source.addEventListener("ended", () => { this.sampleVoices = Math.max(0, this.sampleVoices - 1); }, { once: true });
    source.start(now);
    return true;
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
      this.noise({ duration: finish ? 0.18 : 0.13, gain: finish ? 0.065 : 0.045, frequency: 310, type: "lowpass", q: 0.45 });
      this.tone({ frequency: finish ? 132 : 168, endFrequency: 58, duration: finish ? 0.17 : 0.12, type: "triangle", gain: finish ? 0.065 : 0.045 });
      return;
    }
    const twin = kind === "twin";
    const sampled = this.playSample("bladeSwing", {
      gain: finish ? 0.34 : twin ? 0.25 : 0.29,
      rate: (twin ? 1.12 : 0.96) + combo * 0.045,
      variance: 0.025,
    });
    if (!sampled) this.noise({
      duration: finish ? 0.14 : 0.1,
      gain: finish ? 0.055 : 0.038,
      frequency: twin ? 1750 : 1280,
      type: "bandpass",
      q: 0.65,
    });
    this.tone({ frequency: twin ? 760 : 590, endFrequency: 310, duration: 0.065, type: "sine", gain: 0.018 });
  }

  hit(kind = "blade", { heavy = false, killed = false } = {}) {
    const now = performance.now();
    if (now - this.lastHitAt < 28) return;
    this.lastHitAt = now;
    const ranged = kind === "rail" || kind === "reflect";
    if (ranged) {
      this.noise({ duration: 0.045, gain: 0.065, frequency: 2900, type: "highpass", q: 0.5, attack: 0.001 });
      this.tone({ frequency: 280, endFrequency: 76, duration: 0.075, type: "square", gain: 0.075 });
      return;
    }

    const hammer = kind === "hammer";
    const twin = kind === "twin";
    const weight = heavy ? 1.12 : 1;
    const sampled = this.playSample(hammer ? "hammerHit" : "bladeHit", {
      gain: (hammer ? 0.5 : twin ? 0.34 : 0.4) * weight,
      rate: hammer ? 0.88 : twin ? 1.08 : 0.98,
      variance: hammer ? 0.035 : 0.025,
    });
    if (!sampled) this.noise({
      duration: hammer ? 0.1 : 0.06,
      gain: (hammer ? 0.11 : 0.08) * weight,
      frequency: hammer ? 360 : 1450,
      type: hammer ? "lowpass" : "bandpass",
      q: 0.55,
      attack: 0.001,
    });
    if (hammer || heavy) this.tone({
      frequency: hammer ? 105 : 132,
      endFrequency: hammer ? 39 : 55,
      duration: hammer ? 0.15 : 0.1,
      type: "sine",
      gain: hammer ? 0.085 : 0.052,
    });
    if (killed && heavy) this.tone({ frequency: 82, endFrequency: 38, duration: 0.14, type: "sine", gain: 0.045, delay: 0.015 });
  }

  guard(perfect = false) {
    const sampled = this.playSample("bladeHit", { gain: perfect ? 0.42 : 0.32, rate: perfect ? 1.16 : 0.88, variance: 0.018 });
    if (perfect) {
      this.tone({ frequency: 960, endFrequency: 1420, duration: 0.14, type: "sine", gain: 0.06 });
    } else {
      this.tone({ frequency: 172, endFrequency: 88, duration: 0.09, type: "triangle", gain: 0.045 });
    }
    if (!sampled) this.noise({ duration: 0.055, gain: 0.045, frequency: perfect ? 2600 : 650, type: "bandpass", q: 0.65 });
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
    const target = Math.max(0.0001, this.musicVolume * 0.095 * activity);
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

    if ([0, 4, 8, 12].includes(step) || (step === 15 && bar % 2 === 1)) {
      this.musicTone({ note: 48, endNote: 25, duration: 0.12, gain: step === 0 ? 0.64 : 0.52, type: "sine", when: time });
    }
    if (step === 4 || step === 12) {
      this.musicNoise({ duration: 0.09, gain: 0.2, frequency: 1150, type: "bandpass", when: time });
    }
    if ([2, 6, 10, 14].includes(step)) {
      this.musicNoise({ duration: step === 14 ? 0.055 : 0.022, gain: step === 14 ? 0.12 : 0.082, frequency: 5600, when: time });
    }

    const bassPattern = [0, 0, 7, 0, 3, 7, 10, 7];
    if (step % 2 === 0) {
      const bassNote = root + bassPattern[(step / 2) % bassPattern.length];
      this.musicTone({ note: bassNote, endNote: bassNote - 12, duration: 0.17, gain: step % 4 === 0 ? 0.25 : 0.2, type: "sawtooth", when: time });
    }

    const arpPattern = [12, 15, 19, 22, 19, 15, 24, 22];
    if ([1, 3, 6, 9, 11, 14].includes(step)) {
      const arpIndex = [1, 3, 6, 9, 11, 14].indexOf(step);
      const arpNote = root + arpPattern[(arpIndex + bar * 2) % arpPattern.length];
      this.musicTone({ note: arpNote, endNote: arpNote - 5, duration: 0.095, gain: 0.082, type: "square", when: time });
    }

    if (step === 0 || step === 8) {
      this.musicTone({ note: root + 24, endNote: root + 12, duration: 0.16, gain: 0.14, type: "sawtooth", when: time });
      this.musicTone({ note: root + 31, endNote: root + 19, duration: 0.15, gain: 0.075, type: "triangle", when: time + 0.008 });
    }
    if (step === 0) {
      this.musicTone({ note: root + 12, duration: 1.42, gain: 0.043, type: "triangle", when: time });
      this.musicTone({ note: root + 19, duration: 1.4, gain: 0.026, type: "sine", when: time + 0.012 });
    }
  }

  scheduleMusic() {
    if (!this.musicPlaying || !this.context) return;
    const sixteenth = 60 / 136 / 4;
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
