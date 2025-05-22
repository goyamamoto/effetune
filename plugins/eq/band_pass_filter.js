// Band Pass Filter Plugin implementation
// Combines hi-pass and low-pass filters with fixed -24dB/oct slopes.
const bandPassProcessorFunction = `
if (!parameters.enabled) return data;

const channelCount = parameters.channelCount;
const blockSize = parameters.blockSize;
const hpFreq = parameters.hf;
const lpFreq = parameters.lf;
const hpSlope = parameters.hs;
const lpSlope = parameters.ls;

context.hpf = context.hpf || {};
context.lpf = context.lpf || {};

// --- Hi Pass Processing ---
{
  const freq = hpFreq;
  const slope = hpSlope;
  const absSlope = slope < 0 ? -slope : slope;
  const numStages = absSlope === 0 ? 0 : absSlope / 12;

  let needsReinit = false;
  let needsCoeffRecalc = false;

  if (context.hpf.lastSlope !== slope) {
    context.hpf.lastSlope = slope;
    context.hpf.numStages = numStages;
    context.hpf.filterStates = null;
    needsReinit = true;
  }

  if (context.hpf.lastFreq !== freq) {
    context.hpf.lastFreq = freq;
    needsCoeffRecalc = true;
  }

  if (needsReinit || !context.hpf.filterStates || context.hpf.filterStates.length !== context.hpf.numStages) {
    const numStagesToInit = context.hpf.numStages;
    if (numStagesToInit > 0) {
      context.hpf.filterStates = new Array(numStagesToInit);
      const dcOffset = 1e-25;
      for (let s = 0; s < numStagesToInit; s++) {
        const state = {
          x1: new Float32Array(channelCount),
          x2: new Float32Array(channelCount),
          y1: new Float32Array(channelCount),
          y2: new Float32Array(channelCount)
        };
        for (let ch = 0; ch < channelCount; ch++) {
          state.x1[ch] = dcOffset;
          state.x2[ch] = -dcOffset;
          state.y1[ch] = dcOffset;
          state.y2[ch] = -dcOffset;
        }
        context.hpf.filterStates[s] = state;
      }
    } else {
      context.hpf.filterStates = [];
    }
    needsCoeffRecalc = true;
  }

  if (needsCoeffRecalc || !context.hpf.coeffs) {
    if (context.hpf.numStages > 0 && freq > 0) {
      const omega = Math.tan(Math.PI * freq / sampleRate);
      const omega2 = omega * omega;
      const sqrt2 = 1.4142135623730951;
      const n = 1 / (omega2 + sqrt2 * omega + 1);
      context.hpf.coeffs = {
        b0: n,
        b1: -2 * n,
        b2: n,
        a1: 2 * (omega2 - 1) * n,
        a2: (omega2 - sqrt2 * omega + 1) * n
      };
    } else {
      context.hpf.coeffs = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
    }
  }

  if (context.hpf.numStages !== 0) {
    const { b0, b1, b2, a1, a2 } = context.hpf.coeffs;
    const filterStates = context.hpf.filterStates;
    const activeNumStages = context.hpf.numStages;

    for (let ch = 0, offset = 0; ch < channelCount; ch++, offset += blockSize) {
      for (let i = 0; i < blockSize; i++) {
        let sample = data[offset + i];
        for (let s = 0; s < activeNumStages; s++) {
          const state = filterStates[s];
          const x1 = state.x1[ch];
          const x2 = state.x2[ch];
          const y1 = state.y1[ch];
          const y2 = state.y2[ch];
          const x_n = sample;
          const y_n = b0 * x_n + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
          state.x2[ch] = x1;
          state.x1[ch] = x_n;
          state.y2[ch] = y1;
          state.y1[ch] = y_n;
          sample = y_n;
        }
        data[offset + i] = sample;
      }
    }
  }
}

// --- Lo Pass Processing ---
{
  const freq = lpFreq;
  const slope = lpSlope;
  const absSlope = slope < 0 ? -slope : slope;
  const numStages = absSlope === 0 ? 0 : absSlope / 12;

  let needsReinit = false;
  let needsCoeffRecalc = false;

  if (context.lpf.lastSlope !== slope) {
    context.lpf.lastSlope = slope;
    context.lpf.numStages = numStages;
    context.lpf.filterStates = null;
    needsReinit = true;
  }

  if (context.lpf.lastFreq !== freq) {
    context.lpf.lastFreq = freq;
    needsCoeffRecalc = true;
  }

  if (needsReinit || !context.lpf.filterStates || context.lpf.filterStates.length !== context.lpf.numStages) {
    const numStagesToInit = context.lpf.numStages;
    if (numStagesToInit > 0) {
      context.lpf.filterStates = new Array(numStagesToInit);
      const dcOffset = 1e-25;
      for (let s = 0; s < numStagesToInit; s++) {
        const state = {
          x1: new Float32Array(channelCount),
          x2: new Float32Array(channelCount),
          y1: new Float32Array(channelCount),
          y2: new Float32Array(channelCount)
        };
        for (let ch = 0; ch < channelCount; ch++) {
          state.x1[ch] = dcOffset;
          state.x2[ch] = -dcOffset;
          state.y1[ch] = dcOffset;
          state.y2[ch] = -dcOffset;
        }
        context.lpf.filterStates[s] = state;
      }
    } else {
      context.lpf.filterStates = [];
    }
    needsCoeffRecalc = true;
  }

  if (needsCoeffRecalc || !context.lpf.coeffs) {
    if (context.lpf.numStages > 0) {
      const omega = Math.tan(Math.PI * freq / sampleRate);
      const omega2 = omega * omega;
      const sqrt2 = 1.4142135623730951;
      const n = 1 / (omega2 + sqrt2 * omega + 1);
      const b0 = omega2 * n;
      const b1 = 2 * b0;
      const b2 = b0;
      const a1 = 2 * (omega2 - 1) * n;
      const a2 = (omega2 - sqrt2 * omega + 1) * n;
      context.lpf.coeffs = { b0, b1, b2, a1, a2 };
    } else {
      context.lpf.coeffs = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
    }
  }

  if (context.lpf.numStages !== 0) {
    const { b0, b1, b2, a1, a2 } = context.lpf.coeffs;
    const filterStates = context.lpf.filterStates;
    const activeNumStages = context.lpf.numStages;

    for (let ch = 0, offset = 0; ch < channelCount; ch++, offset += blockSize) {
      for (let i = 0; i < blockSize; i++) {
        let sample = data[offset + i];
        for (let s = 0; s < activeNumStages; s++) {
          const state = filterStates[s];
          const x1 = state.x1[ch];
          const x2 = state.x2[ch];
          const y1 = state.y1[ch];
          const y2 = state.y2[ch];
          const x_n = sample;
          const y_n = b0 * x_n + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
          state.x2[ch] = x1;
          state.x1[ch] = x_n;
          state.y2[ch] = y1;
          state.y1[ch] = y_n;
          sample = y_n;
        }
        data[offset + i] = sample;
      }
    }
  }
}
return data;
`;

class BandPassFilterPlugin extends PluginBase {
  constructor() {
    super("Band Pass Filter", "Band-pass filter using cascaded hi/lo-pass filters");
    this.hf = 1000; // HPF frequency in Hz
    this.lf = 1000; // LPF frequency in Hz
    this.hs = -24;  // HPF slope in dB/oct
    this.ls = -24;  // LPF slope in dB/oct
    this.registerProcessor(bandPassProcessorFunction);
  }

  setHf(freq) { this.setParameters({ hf: freq }); }
  setLf(freq) { this.setParameters({ lf: freq }); }
  setHs(slope) { this.setParameters({ hs: slope }); }
  setLs(slope) { this.setParameters({ ls: slope }); }

  getParameters() {
    return {
      type: this.constructor.name,
      enabled: this.enabled,
      hf: this.hf,
      lf: this.lf,
      hs: this.hs,
      ls: this.ls
    };
  }

  setParameters(params) {
    if (params.enabled !== undefined) this.enabled = params.enabled;
    if (params.hf !== undefined) {
      const value = typeof params.hf === "number" ? params.hf : parseFloat(params.hf);
      this.hf = value < 1 ? 1 : (value > 40000 ? 40000 : value);
    }
    if (params.lf !== undefined) {
      const value = typeof params.lf === "number" ? params.lf : parseFloat(params.lf);
      this.lf = value < 1 ? 1 : (value > 40000 ? 40000 : value);
    }
    if (params.hs !== undefined) {
      const intSlope = typeof params.hs === "number" ? params.hs : parseInt(params.hs);
      const allowed = [0, -12, -24, -36, -48];
      this.hs = allowed.includes(intSlope) ? intSlope : -24;
    }
    if (params.ls !== undefined) {
      const intSlope = typeof params.ls === "number" ? params.ls : parseInt(params.ls);
      const allowed = [0, -12, -24, -36, -48];
      this.ls = allowed.includes(intSlope) ? intSlope : -24;
    }
    this.updateParameters();
  }

  createUI() {
    const container = document.createElement("div");
    container.className = "band-pass-filter-plugin-ui plugin-parameter-ui";

    // Helper to create a slope select box
    const createSlopeSelect = (current, onChange, filterType, canvasRef) => {
      const selectId = `${this.id}-${this.name}-${filterType.toLowerCase()}-slope`;
      
      const select = document.createElement("select");
      select.className = "slope-select";
      select.id = selectId;
      select.name = selectId;
      select.autocomplete = "off";
      
      const slopes = [0, -12, -24, -36, -48];
      slopes.forEach(slope => {
        const option = document.createElement("option");
        option.value = slope;
        option.textContent = slope === 0 ? "Off" : `${Math.abs(slope)}dB/oct`;
        option.selected = current === slope;
        select.appendChild(option);
      });
      select.addEventListener("change", e => {
        onChange(parseInt(e.target.value));
        // Draw graph using the passed canvas reference
        if (canvasRef) this.drawGraph(canvasRef);
      });
      return select;
    };

    // Create graph container and canvas *before* creating controls that need it
    const graphContainer = document.createElement("div");
    graphContainer.style.position = "relative";
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 480;
    canvas.style.width = "600px";
    canvas.style.height = "240px";
    graphContainer.appendChild(canvas);

    // Create HPF row
    const hpfRow = this.createParameterControl("HPF", 1, 40000, 1, this.hf,
      (value) => {
        this.setHf(value);
        this.drawGraph(canvas);
      },
      'Hz'
    );
    // Append the HPF slope selector to the row
    hpfRow.appendChild(createSlopeSelect(this.hs, v => this.setHs(v), "HPF", canvas));

    // Create LPF row
    const lpfRow = this.createParameterControl("LPF", 1, 40000, 1, this.lf,
      (value) => {
        this.setLf(value);
        this.drawGraph(canvas);
      },
      'Hz'
    );
    // Append the LPF slope selector to the row
    lpfRow.appendChild(createSlopeSelect(this.ls, v => this.setLs(v), "LPF", canvas));

    container.appendChild(hpfRow);
    container.appendChild(lpfRow);
    container.appendChild(graphContainer);
    this.drawGraph(canvas);
    return container;
  }

  drawGraph(canvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width, height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    const freqs = [2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    freqs.forEach(freq => {
      const x = width * (Math.log10(freq) - Math.log10(1)) / (Math.log10(40000) - Math.log10(1));
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      if (freq >= 1 && freq <= 40000) {
        ctx.fillStyle = "#666";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(freq >= 1000 ? `${freq/1000}k` : freq, x, height - 40);
      }
    });
    const dBs = [-60, -48, -36, -24, -12, 0, 12];
    dBs.forEach(db => {
      const y = height * (1 - (db + 60) / 72);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      if (db > -60 && db < 12) {
        ctx.fillStyle = "#666";
        ctx.font = "20px Arial";
        ctx.textAlign = "right";
        ctx.fillText(`${db}dB`, 80, y + 6);
      }
    });
    ctx.fillStyle = "#fff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Frequency (Hz)", width / 2, height - 5);
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Level (dB)", 0, 0);
    ctx.restore();

    const hpfNumStages = this.hs === 0 ? 0 : Math.abs(this.hs) / 12;
    const lpfNumStages = this.ls === 0 ? 0 : Math.abs(this.ls) / 12;
    ctx.beginPath();
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    for (let i = 0; i < width; i++) {
      const freq = Math.pow(10, Math.log10(1) + (i / width) * (Math.log10(40000) - Math.log10(1)));
      let hpfMag = 1;
      const wRatioHPF = freq / this.hf;
      if (hpfNumStages > 0) {
        let butterworth = 1;
        for (let s = 0; s < hpfNumStages; s++) {
          butterworth *= wRatioHPF * wRatioHPF / Math.sqrt(1 + Math.pow(wRatioHPF, 4));
        }
        hpfMag = butterworth;
      }
      let lpfMag = 1;
      const wRatioLPF = freq / this.lf;
      if (lpfNumStages > 0) {
        let butterworth = 1;
        for (let s = 0; s < lpfNumStages; s++) {
          butterworth *= 1 / Math.sqrt(1 + Math.pow(wRatioLPF, 4));
        }
        lpfMag = butterworth;
      }
      const response = 20 * Math.log10(hpfMag * lpfMag);
      const y = height * (1 - (response + 60) / 72);
      i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
    }
    ctx.stroke();
  }
}

window.BandPassFilterPlugin = BandPassFilterPlugin;
