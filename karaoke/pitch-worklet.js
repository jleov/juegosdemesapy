// Tono y afinación automática (tipo Auto-Tune) de la voz para la Sala de Karaoke.
// - Cambio de tono: línea de retardo con dos lecturas que se cruzan suavemente (barato y sin demora notable).
// - Afinador: cada ~10 ms busca la nota que estás cantando (método YIN, a media velocidad para gastar poco)
//   y corrige hacia la nota más cercana; «speed» es cuánto tarda en llegar (rápido = efecto robot).
class PitchShift extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'ratio', defaultValue: 1, minValue: 0.5, maxValue: 2 },
      { name: 'tune', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'speed', defaultValue: 0.05, minValue: 0.001, maxValue: 0.5 },
    ];
  }
  constructor() {
    super();
    this.N = 8192; this.buf = new Float32Array(this.N); this.w = 0; this.ph = 0;
    this.win = Math.round(sampleRate * 0.04);   // ventana de 40 ms
    // afinador (trabaja a la mitad de muestras por segundo)
    this.dsr = sampleRate / 2;
    this.minLag = Math.floor(this.dsr / 1000); this.maxLag = Math.ceil(this.dsr / 75); this.W = Math.round(this.dsr * 0.02);
    this.dN = 2048; this.dec = new Float32Array(this.dN); this.dw = 0; this.half = 0; this.odd = false;
    this.x = new Float32Array(this.W + this.maxLag + 2); this.d = new Float32Array(this.maxLag + 2);
    this.hop = 0; this.corr = 1; this.corrT = 1;
  }
  read(d) {
    let p = this.w - d; while (p < 0) p += this.N;
    const i = Math.floor(p), f = p - i, a = this.buf[i % this.N], b = this.buf[(i + 1) % this.N];
    return a + (b - a) * f;
  }
  // frecuencia de la voz en Hz, o 0 si no hay una nota clara
  detect() {
    const { x, d, W, maxLag, minLag, dN } = this, L = W + maxLag;
    let p = this.dw - L; if (p < 0) p += dN;
    for (let i = 0; i < L; i++) x[i] = this.dec[(p + i) % dN];
    let e = 0; for (let i = 0; i < W; i++) e += x[i] * x[i];
    if (e / W < 1e-5) return 0;   // silencio
    let run = 0, best = -1;
    d[0] = 1;
    for (let t = 1; t <= maxLag; t++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = x[j] - x[j + t]; s += v * v; }
      run += s; d[t] = run > 0 ? s * t / run : 1;
    }
    for (let t = minLag; t < maxLag; t++) {
      if (d[t] < 0.15) { while (t + 1 < maxLag && d[t + 1] < d[t]) t++; best = t; break; }
    }
    if (best < 1) return 0;
    const a = d[best - 1], b = d[best], c = d[best + 1], den = a - 2 * b + c;
    return this.dsr / (best + (den ? 0.5 * (a - c) / den : 0));
  }
  process(inputs, outputs, params) {
    const inp = inputs[0] && inputs[0][0], out = outputs[0];
    if (!inp) return true;
    const base = params.ratio[0], tune = params.tune[0], speed = params.speed[0];
    const alpha = 1 - Math.exp(-1 / (speed * sampleRate));
    for (let i = 0; i < inp.length; i++) {
      const s = inp[i];
      this.buf[this.w] = s;
      if (tune > 0) {
        if (this.odd) { this.dec[this.dw] = (this.half + s) * 0.5; this.dw = (this.dw + 1) % this.dN; } else this.half = s;
        this.odd = !this.odd;
        if (++this.hop >= 512) {
          this.hop = 0;
          const f = this.detect();
          if (f > 0) { const m = 69 + 12 * Math.log2(f / 440); this.corrT = Math.pow(2, (Math.round(m) - m) * tune / 12); }
          else this.corrT = 1;
        }
      } else this.corrT = 1;
      this.corr += (this.corrT - this.corr) * alpha;
      const ratio = base * this.corr;
      let y = s;
      if (tune > 0 || Math.abs(ratio - 1) > 0.001) {
        this.ph += (1 - ratio) / this.win; if (this.ph >= 1) this.ph -= 1; if (this.ph < 0) this.ph += 1;
        const p2 = (this.ph + 0.5) % 1;
        const g1 = Math.sin(Math.PI * this.ph) ** 2, g2 = Math.sin(Math.PI * p2) ** 2;
        y = g1 * this.read(this.ph * this.win + 1) + g2 * this.read(p2 * this.win + 1);
      }
      for (let c = 0; c < out.length; c++) out[c][i] = y;
      this.w = (this.w + 1) % this.N;
    }
    return true;
  }
}
registerProcessor('pitch-shift', PitchShift);
