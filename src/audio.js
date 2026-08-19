export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.volume = 0.55;
    this.enabled = true;
    this.lastHitAt = 0;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value)));
    if (this.master) this.master.gain.value = this.volume * 0.28;
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
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * 0.28;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  tone({ frequency = 220, endFrequency = frequency, duration = 0.08, type = "sine", gain = 0.15, delay = 0 }) {
    if (!this.enabled || !this.context || !this.master) return;
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
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noise({ duration = 0.08, gain = 0.05, frequency = 900, type = "bandpass", q = 0.8, delay = 0 }) {
    if (!this.enabled || !this.context || !this.master) return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const fade = 1 - index / data.length;
      data[index] = (Math.random() * 2 - 1) * fade;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const now = this.context.currentTime + delay;
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(now);
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

  hit(kind = "melee") {
    const now = performance.now();
    if (now - this.lastHitAt < 35) return;
    this.lastHitAt = now;
    const ranged = kind === "rail" || kind === "reflect";
    this.tone({ frequency: ranged ? 260 : 125, endFrequency: ranged ? 95 : 62, duration: ranged ? 0.055 : 0.065, type: "square", gain: ranged ? 0.04 : 0.055 });
    this.noise({ duration: ranged ? 0.045 : 0.075, gain: 0.035, frequency: ranged ? 2400 : 720, type: "bandpass", q: 0.9 });
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
}

export const audio = new AudioEngine();
