// Bruitages synthétisés en WebAudio (aucun fichier son)
(function () {
  L.Audio = {
    ctx: null, muted: false,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
      } catch (e) { this.ctx = null; }
    },
    tone(type, f1, f2, dur, vol = 0.25, delay = 0) {
      const c = this.ctx, t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    },
    hiss(dur, f1, f2, vol = 0.4, type = 'lowpass', delay = 0) {
      const c = this.ctx, t = c.currentTime + delay;
      const s = c.createBufferSource(); s.buffer = this.noise;
      const fl = c.createBiquadFilter(); fl.type = type;
      fl.frequency.setValueAtTime(f1, t);
      fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(this.master);
      s.start(t); s.stop(t + dur + 0.05);
    },
    play(n, size = 1) {
      if (!this.ctx || this.muted) return;
      try {
        switch (n) {
          case 'boom':
            this.hiss(0.5 + size * 0.5, 1800, 60, 0.7);
            this.tone('sine', 120, 30, 0.5 + size * 0.3, 0.6);
            break;
          case 'shoot': this.hiss(0.35, 600, 3000, 0.25, 'bandpass'); break;
          case 'throw': this.hiss(0.2, 900, 2400, 0.15, 'bandpass'); break;
          case 'jump': this.tone('sine', 280, 640, 0.18, 0.2); break;
          case 'jump2': this.tone('sine', 220, 900, 0.3, 0.2); break;
          case 'cluck':
            this.tone('square', 900, 520, 0.07, 0.08);
            this.tone('square', 1000, 560, 0.09, 0.08, 0.09);
            break;
          case 'splash': this.hiss(0.6, 2500, 300, 0.35, 'bandpass'); this.tone('sine', 500, 120, 0.25, 0.15); break;
          case 'slap': this.hiss(0.12, 3000, 800, 0.6, 'highpass'); this.tone('triangle', 200, 80, 0.12, 0.3); break;
          case 'pop': this.tone('square', 1200, 300, 0.08, 0.12); this.hiss(0.15, 4000, 1500, 0.2, 'highpass'); break;
          case 'tp': this.tone('sine', 200, 1800, 0.4, 0.2); this.tone('triangle', 400, 2400, 0.4, 0.1, 0.05); break;
          case 'zzz': this.tone('sawtooth', 110, 90, 0.6, 0.06); this.tone('sawtooth', 100, 80, 0.6, 0.06, 0.7); break;
          case 'turn': this.tone('triangle', 660, 660, 0.1, 0.12); this.tone('triangle', 880, 880, 0.14, 0.12, 0.1); break;
          case 'tick': this.tone('square', 1500, 1500, 0.04, 0.06); break;
          case 'fuse': this.hiss(0.4, 5000, 3000, 0.15, 'highpass'); break;
          case 'vortex': this.tone('sawtooth', 60, 400, 2.2, 0.12); break;
          case 'plane': this.tone('sawtooth', 160, 120, 1.2, 0.05); this.tone('sawtooth', 164, 118, 1.2, 0.05); break;
          case 'bling': this.tone('sine', 1760, 1760, 0.12, 0.08); break;
          case 'disco':
            [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.09, 0.07, i * 0.08));
            break;
          case 'piano':
            [262, 330, 392, 523].forEach((f, i) => this.tone('triangle', f, f * 0.99, 1.2, 0.08, i * 0.12));
            break;
          case 'pianocrash':
            [131, 139, 147, 156, 165, 175].forEach((f) => this.tone('triangle', f * 2, f * 2, 1.4, 0.07));
            break;
          case 'win':
            [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.15, i * 0.14));
            break;
        }
      } catch (e) { /* ignore */ }
    },
  };
})();
