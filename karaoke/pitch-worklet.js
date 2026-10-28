// Cambio de tono de la voz (más grave o más aguda) para la Sala de Karaoke.
// Línea de retardo con dos lecturas que se cruzan suavemente: barato y sin demora notable.
class PitchShift extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'ratio', defaultValue: 1, minValue: 0.5, maxValue: 2 }]; }
  constructor() {
    super();
    this.N = 8192; this.buf = new Float32Array(this.N); this.w = 0; this.ph = 0;
    this.win = Math.round(sampleRate * 0.04);   // ventana de 40 ms
  }
  read(d) {
    let p = this.w - d; while (p < 0) p += this.N;
    const i = Math.floor(p), f = p - i, a = this.buf[i % this.N], b = this.buf[(i + 1) % this.N];
    return a + (b - a) * f;
  }
  process(inputs, outputs, params) {
    const inp = inputs[0] && inputs[0][0], out = outputs[0];
    if (!inp) return true;
    const ratio = params.ratio[0], step = (1 - ratio) / this.win;
    for (let i = 0; i < inp.length; i++) {
      this.buf[this.w] = inp[i];
      let y = inp[i];
      if (Math.abs(ratio - 1) > 0.001) {
        this.ph += step; if (this.ph >= 1) this.ph -= 1; if (this.ph < 0) this.ph += 1;
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
