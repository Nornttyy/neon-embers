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

  tone({ frequency = 220, endFrequency = frequency, duration = 0.08, type = "sine", gain = 0.15 }) {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime;
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

  shoot(kind = "pulse") {
    const sounds = {
      pulse: [480, 220, 0.065, "square", 0.08],
      grenade: [130, 55, 0.16, "sawtooth", 0.16],
      arc: [780, 180, 0.12, "sawtooth", 0.08],
      beam: [620, 420, 0.09, "triangle", 0.06],
      drone: [330, 170, 0.055, "square", 0.045],
    };
    const [frequency, endFrequency, duration, type, gain] = sounds[kind] || sounds.pulse;
    this.tone({ frequency, endFrequency, duration, type, gain });
  }

  hit() {
    const now = performance.now();
    if (now - this.lastHitAt < 35) return;
    this.lastHitAt = now;
    this.tone({ frequency: 110, endFrequency: 70, duration: 0.035, type: "square", gain: 0.035 });
  }

  pickup() {
    this.tone({ frequency: 620, endFrequency: 980, duration: 0.07, type: "sine", gain: 0.055 });
  }

  levelUp() {
    this.tone({ frequency: 330, endFrequency: 880, duration: 0.28, type: "triangle", gain: 0.11 });
  }

  dash() {
    this.tone({ frequency: 240, endFrequency: 70, duration: 0.18, type: "sawtooth", gain: 0.09 });
  }

  hurt() {
    this.tone({ frequency: 140, endFrequency: 45, duration: 0.22, type: "square", gain: 0.13 });
  }

  explosion() {
    this.tone({ frequency: 90, endFrequency: 32, duration: 0.28, type: "sawtooth", gain: 0.18 });
  }
}

export const audio = new AudioEngine();
