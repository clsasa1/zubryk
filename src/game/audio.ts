const SCALE = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440, 523.25];
const MELODY = [0, 2, 4, 2, 3, 2, 1, 0, 4, 3, 2, 0, 1, 2, 4, 7];

class FestAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private step = 0;
  private level = 0;
  private muted = false;
  private alive = false;

  ensure() {
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!this.ctx) {
      const ctx = new Ctor();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;
      comp.connect(ctx.destination);
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      this.master = master;
      const music = ctx.createGain();
      music.gain.value = 0.62;
      music.connect(master);
      this.music = music;
      const sfx = ctx.createGain();
      sfx.gain.value = 1;
      sfx.connect(master);
      this.sfx = sfx;
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
      this.last = performance.now();
      const loop = (t: number) => {
        const dt = Math.min(0.05, (t - this.last) / 1000);
        this.last = t;
        this.advance(dt);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void this.ctx?.resume();
      });
    }
    this.alive = true;
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.9;
  }

  setLevel(level: number) {
    this.level = Math.max(0, Math.min(8, level));
  }

  tap() {
    this.ensure();
    this.tone(740, 0.05, "sine", 0.12, 0, false);
    this.blip(1800, 0.03, 0.04);
  }

  hello() {
    this.ensure();
    [523, 659, 784].forEach((f, i) => this.bell(f, 0.16, i * 0.07));
  }

  correct(level: number) {
    this.ensure();
    const wobble = 0.97 + Math.random() * 0.06;
    const base = (440 + level * 32) * wobble;
    this.bell(base, 0.22, 0);
    this.bell(base * 1.25, 0.2, 0.07);
    this.bell(base * 1.5, 0.26, 0.14);
    this.blip(2400 + level * 80, 0.05, 0.02);
    if (level >= 3) this.bell(base * 2, 0.18, 0.2);
    if (level === 2 || level === 4 || level === 6 || level === 8) this.fanfare();
  }

  wrong() {
    this.ensure();
    this.thump(180, 0.22);
    this.tone(233, 0.18, "triangle", 0.12, 0.05, false);
    this.tone(175, 0.24, "sine", 0.1, 0.1, false);
  }

  fanfare() {
    this.ensure();
    [392, 523.25, 659.25, 784, 1046].forEach((f, i) => this.bell(f, 0.28, i * 0.08));
    this.blip(1600, 0.08, 0.32);
  }

  private advance(dt: number) {
    if (!this.alive || this.muted || !this.ctx || this.level < 1) return;
    const beat = this.level >= 7 ? 0.11 : this.level >= 4 ? 0.135 : 0.17;
    this.acc += dt;
    while (this.acc >= beat) {
      this.acc -= beat;
      this.pulse();
      this.step = (this.step + 1) % 16;
    }
  }

  private pulse() {
    const lv = this.level;
    const s = this.step;
    const root = SCALE[0] ?? 146;
    const fifth = SCALE[3] ?? 220;
    if (s % 4 === 0) {
      this.tone(s % 8 === 0 ? root : fifth, 0.22, "sine", 0.16, 0, true);
      this.thump(s % 8 === 0 ? 90 : 70, 0.12, true);
    }
    if (lv >= 2 && s % 2 === 1) this.hat();
    if (lv >= 3 && s % 8 === 4) this.tone(root / 2, 0.24, "triangle", 0.1, 0, true);
    if (lv >= 4 && s % 2 === 0) {
      const idx = MELODY[s % MELODY.length] ?? 0;
      const freq = SCALE[Math.min(SCALE.length - 1, idx + (lv >= 6 ? 2 : 0))] ?? 294;
      this.bell(freq, 0.16, 0, true);
    }
    if (lv >= 5 && s % 8 === 0) {
      this.tone(root * 2, 0.32, "sine", 0.06, 0, true);
      this.tone((SCALE[2] ?? 196) * 2, 0.32, "sine", 0.05, 0, true);
    }
    if (lv >= 7 && s % 4 === 2) this.blip(1400, 0.06, 0, true);
    if (lv >= 8 && s % 4 === 0) this.tone(880, 0.09, "triangle", 0.05, 0, true);
  }

  private dest(musicBus: boolean) {
    return musicBus ? this.music : this.sfx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay: number, musicBus = false) {
    const ctx = this.ctx;
    const dest = this.dest(musicBus);
    if (!ctx || !dest || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  private bell(freq: number, dur: number, delay: number, musicBus = false) {
    this.tone(freq, dur, "sine", musicBus ? 0.1 : 0.28, delay, musicBus);
    this.tone(freq * 2.01, dur * 0.7, "triangle", musicBus ? 0.04 : 0.1, delay, musicBus);
    this.tone(freq * 0.5, dur * 0.5, "sine", musicBus ? 0.04 : 0.08, delay, musicBus);
  }

  private blip(freq: number, dur: number, delay: number, musicBus = false) {
    const ctx = this.ctx;
    const dest = this.dest(musicBus);
    if (!ctx || !dest || !this.noise || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 8;
    const amp = ctx.createGain();
    const t = ctx.currentTime + delay;
    amp.gain.setValueAtTime(musicBus ? 0.08 : 0.2, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private thump(freq: number, dur: number, musicBus = false) {
    const ctx = this.ctx;
    const dest = this.dest(musicBus);
    if (!ctx || !dest || !this.noise || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq * 4;
    const amp = ctx.createGain();
    const t = ctx.currentTime;
    amp.gain.setValueAtTime(musicBus ? 0.18 : 0.35, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
    this.tone(freq, dur, "sine", musicBus ? 0.1 : 0.18, 0, musicBus);
  }

  private hat() {
    const ctx = this.ctx;
    const dest = this.music;
    if (!ctx || !dest || !this.noise || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 5000;
    const amp = ctx.createGain();
    const t = ctx.currentTime;
    amp.gain.setValueAtTime(0.09, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(dest);
    src.start(t);
    src.stop(t + 0.06);
  }
}

export const fest = new FestAudio();
