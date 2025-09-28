class ModalResonatorPlugin extends PluginBase {
    constructor() {
        super('Modal Resonator', 'True modal (2nd order IIR) resonator with up to 5 modes');

        this.en = true;
        this.rs = Array(5).fill(null).map((_, i) => ({
            en: true,
            fr: this._getInitialFreq(i),   // log(Hz)
            dc: this._getInitialDecay(i),  // ms (T60)
            lp: this._getInitialLpf(i),    // log(Hz)
            hp: this._getInitialHpf(i),    // log(Hz)
            gn: [0, -3, -6, -9, -12][i]    // dB
        }));
        this.mx  = 25;   // Dry/Wet %
        this.sr  = 0;    // selected resonator tab
        this.lim = 0.00; // soft limiter strength (0..0.8 推奨)
        this.det = 0.00; // stereo detune cents (0..20 推奨)
        this.pos = 0.15; // excitation position 0..1（0=端, 0.5=中央）

        this.registerProcessor(
            `if (!parameters.en) return data;

const sampleRate   = parameters.sampleRate;
const channelCount = parameters.channelCount;
const blockSize    = parameters.blockSize;

// Equal-power Dry/Wet
const t = Math.min(1, Math.max(0, parameters.mx * 0.01));
const theta = t * 1.5707963267948966; // pi/2
const dryGain = Math.cos(theta);
const wetGain = Math.sin(theta);

// Limiter / Detune / Position
const limiterK = Math.max(0, Math.min(0.99, parameters.lim || 0)); // 0..0.99
const detCents = Math.max(0, Math.min(50, parameters.det || 0));   // 0..50c
const pos      = Math.max(0, Math.min(1, parameters.pos == null ? 0.15 : parameters.pos)); // 0..1

// 1-pole HPF/LPF (output shaping)
function processHPF(x, st, alpha) {
    const y = alpha * (st.yPrev + x - st.xPrev);
    st.xPrev = x;
    st.yPrev = y;
    return y;
}
function processLPF(x, st, alpha) {
    const y = st.yPrev + (1 - alpha) * (x - st.yPrev);
    st.yPrev = y;
    return y;
}

// Init / Reinit
if (!context.initialized ||
    context.sampleRate !== sampleRate ||
    context.channelCount !== channelCount ||
    context.blockSize !== blockSize) {

    context.sampleRate = sampleRate;
    context.channelCount = channelCount;
    context.blockSize = blockSize;

    context.modes = new Array(channelCount);
    context.hpfStates = new Array(channelCount);
    context.lpfStates = new Array(channelCount);

    for (let ch = 0; ch < channelCount; ch++) {
        context.modes[ch] = new Array(5);
        context.hpfStates[ch] = new Array(5);
        context.lpfStates[ch] = new Array(5);
        for (let r = 0; r < 5; r++) {
            context.modes[ch][r] = {
                d1: 0.0, d2: 0.0,      // DF2T state
                a1: 0.0, a2: 0.0,      // last coeffs at block start
                b0: 0.0, b1: 0.0, b2: 0.0,
                ta1: 0.0, ta2: 0.0,    // targets at block end
                tb0: 0.0, tb1: 0.0, tb2: 0.0,
                g: 1.0, tg: 1.0        // output gain (start/end)
            };
            context.hpfStates[ch][r] = { xPrev: 0.0, yPrev: 0.0 };
            context.lpfStates[ch][r] = { yPrev: 0.0 };
        }
    }
    context.accum = new Float32Array(blockSize);
    context.initialized = true;
}

// Coeffs: true modal (poles-only 2nd-order IIR)
// T60[ms] -> r = exp(-ln(1000)/(fs*T60))
const LN1000 = 6.907755278982137;
const TWO_PI = 6.283185307179586;
const R_MIN = 0.0001, R_MAX = 0.999999; // stability clamp
const DENORM = 1e-30; // denormal guard

// Nyquist-aware clamp
const fMax = Math.max(100, 0.49 * sampleRate);
const fMin = 20;

const resonators = new Array(5);
let anyModeEnabled = false;
for (let r = 0; r < 5; r++) {
    const p = parameters.rs[r];
    if (!p || !p.en) { resonators[r] = null; continue; }

    let f0  = Math.max(fMin, Math.min(fMax, Math.exp(p.fr)));
    const T60 = Math.max(0.001, p.dc * 0.001); // seconds

    // base w0 (detuneはチャンネル毎に後段で適用)
    const w0Base = TWO_PI * f0 / sampleRate;

    // pole radius
    let rad = Math.exp(-LN1000 / (sampleRate * T60));
    rad = Math.max(R_MIN, Math.min(R_MAX, rad));

    // output shapers (Nyquist-aware)
    const hpfHz    = Math.max(fMin, Math.min(fMax, Math.exp(p.hp)));
    const lpfHz    = Math.max(fMin, Math.min(fMax, Math.exp(p.lp)));
    const alphaHPF = Math.exp(-TWO_PI * hpfHz / sampleRate);
    const alphaLPF = Math.exp(-TWO_PI * lpfHz / sampleRate);

    // user gain (dB -> linear)
    const gUser = Math.pow(10, p.gn / 20);

    // store base values
    resonators[r] = { rad, w0Base, alphaHPF, alphaLPF, gUser };
    anyModeEnabled = true;
}

// Early dry path if no mode active or Wet=0
if (!anyModeEnabled || wetGain === 0) {
    if (dryGain !== 1) {
        for (let ch = 0; ch < channelCount; ch++) {
            const offset = ch * blockSize;
            for (let i = 0; i < blockSize; i++) data[offset + i] *= dryGain;
        }
    }
    if (limiterK > 0) {
        for (let ch = 0; ch < channelCount; ch++) {
            const offset = ch * blockSize;
            for (let i = 0; i < blockSize; i++) {
                const x = data[offset + i];
                data[offset + i] = x / (1 + limiterK * Math.abs(x));
            }
        }
    }
    return data;
}

const accum = context.accum;

// Main process
for (let ch = 0; ch < channelCount; ch++) {
    const offset = ch * blockSize;
    accum.fill(0.0);

    // channel-based detune factor in cents distributed around center
    let detFactor = 0;
    if (channelCount > 1 && detCents > 0) {
        const mid = (channelCount - 1) * 0.5;
        detFactor = (ch - mid) / (mid === 0 ? 1 : mid); // -1..+1 for 2ch
    }

    for (let r = 0; r < 5; r++) {
        const base = resonators[r];
        if (!base) continue;

        const st    = context.modes[ch][r];
        const hpfSt = context.hpfStates[ch][r];
        const lpfSt = context.lpfStates[ch][r];

        // per-channel detuned w0
        let w0 = base.w0Base;
        if (detFactor !== 0) {
            const ratio = Math.pow(2, (detCents * detFactor) / 1200); // cents -> ratio
            const fDet  = Math.min(fMax, Math.max(fMin, (w0 * sampleRate / TWO_PI) * ratio));
            w0 = TWO_PI * fDet / sampleRate;
        }

        // denominator coeffs from (rad, w0)
        const a1_t = -2 * base.rad * Math.cos(w0);
        const a2_t = base.rad * base.rad;

        // peak normalize at w0: |H(e^{jw0})| = 1 -> numerator b0 only
        const radicand = Math.max(1e-20, 1 + base.rad*base.rad - 2 * base.rad * Math.cos(2 * w0));
        const b0_t = (1 - base.rad) * Math.sqrt(radicand);
        const b1_t = 0.0, b2_t = 0.0;

        // -------- participation factor (excitation position) --------
        // Mk = |sin(pi * (k+1) * pos)|
        const k = r; // 0-based mode index
        const Mk = Math.abs(Math.sin(Math.PI * (k + 1) * pos));

        // set targets (gain includes user gain and participation)
        st.ta1 = a1_t;   st.ta2 = a2_t;
        st.tb0 = b0_t;   st.tb1 = b1_t;   st.tb2 = b2_t;
        st.tg  = base.gUser * Mk;

        // -------- Block-internal linear interpolation --------
        const a1_s = st.a1, a2_s = st.a2, b0_s = st.b0, b1_s = st.b1, b2_s = st.b2, g_s = st.g;
        const da1  = (st.ta1 - a1_s) / blockSize;
        const da2  = (st.ta2 - a2_s) / blockSize;
        const db0  = (st.tb0 - b0_s) / blockSize;
        const db1  = (st.tb1 - b1_s) / blockSize;
        const db2  = (st.tb2 - b2_s) / blockSize;
        const dg   = (st.tg  - g_s ) / blockSize;

        let a1 = a1_s, a2 = a2_s, b0 = b0_s, b1 = b1_s, b2 = b2_s, g = g_s;
        let d1 = st.d1, d2 = st.d2;

        for (let i = 0; i < blockSize; i++) {
            const x = data[offset + i] + DENORM; // denormal guard

            const y_bp = b0 * x + d1;    // DF2T
            d1 = b1 * x - a1 * y_bp + d2;
            d2 = b2 * x - a2 * y_bp;

            const afterHPF = processHPF(y_bp, hpfSt, base.alphaHPF);
            const afterLPF = processLPF(afterHPF, lpfSt, base.alphaLPF);
            accum[i] += afterLPF * g;

            // advance coeffs linearly within block
            a1 += da1; a2 += da2; b0 += db0; b1 += db1; b2 += db2; g += dg;
        }

        // commit end-of-block values and clear denormals
        st.a1 = st.ta1; st.a2 = st.ta2; st.b0 = st.tb0; st.b1 = st.tb1; st.b2 = st.tb2; st.g = st.tg;
        st.d1 = Math.abs(d1) < DENORM ? 0.0 : d1;
        st.d2 = Math.abs(d2) < DENORM ? 0.0 : d2;
    }

    // Dry/Wet mix (+ optional soft limiter)
    for (let i = 0; i < blockSize; i++) {
        const dry = data[offset + i];
        let y = dry * dryGain + accum[i] * wetGain;
        if (limiterK > 0) {
            y = y / (1 + limiterK * Math.abs(y));
        }
        data[offset + i] = y;
    }
}

return data;`
        );
    }

    // --- defaults (compat) ---
    _getInitialFreq(index) {
        const freqValues = [950, 1850, 2950, 4200, 6300];
        return Number(Math.log(freqValues[index]).toFixed(2));
    }
    _getInitialDecay(index) {
        return [15, 12, 10, 8, 6][index]; // ms (T60)
    }
    _getInitialLpf(index) {
        const lpfValues = [1330, 2590, 4130, 5880, 8800];
        return Number(Math.log(lpfValues[index]).toFixed(2));
    }
    _getInitialHpf(index) {
        const hpfValues = [330, 650, 1030, 1470, 2200];
        return Number(Math.log(hpfValues[index]).toFixed(2));
    }

    getParameters() {
        return {
            type: this.constructor.name,
            enabled: this.enabled,
            en: this.en,
            rs: this.rs,
            mx: this.mx,
            sr: this.sr,
            lim: this.lim,
            det: this.det,
            pos: this.pos
        };
    }

    setParameters(params) {
        let updated = false;

        if (params.en !== undefined) { this.en = !!params.en; updated = true; }
        if (params.mx !== undefined) {
            const v = Number(params.mx);
            if (!isNaN(v)) { this.mx = Math.max(0, Math.min(100, v)); updated = true; }
        }
        if (params.sr !== undefined) {
            const idx = Number(params.sr);
            if (!isNaN(idx) && idx >= 0 && idx < 5) { this.sr = Math.floor(idx); updated = true; }
        }
        if (params.lim !== undefined) {
            const v = Number(params.lim);
            if (!isNaN(v)) { this.lim = Math.max(0, Math.min(0.99, v)); updated = true; }
        }
        if (params.det !== undefined) {
            const v = Number(params.det);
            if (!isNaN(v)) { this.det = Math.max(0, Math.min(50, v)); updated = true; }
        }
        if (params.pos !== undefined) {
            const v = Number(params.pos);
            if (!isNaN(v)) { this.pos = Math.max(0, Math.min(1, v)); updated = true; }
        }
        if (params.rs !== undefined && Array.isArray(params.rs)) {
            params.rs.forEach((r, i) => {
                if (i < this.rs.length && r) {
                    if (r.en !== undefined) this.rs[i].en = !!r.en;
                    if (r.fr !== undefined) { const v = Number(r.fr); if (!isNaN(v)) this.rs[i].fr = Math.max(3.00, Math.min(9.90, v)); }
                    if (r.dc !== undefined) { const v = Number(r.dc); if (!isNaN(v)) this.rs[i].dc = Math.max(1, Math.min(500, v)); }
                    if (r.lp !== undefined) { const v = Number(r.lp); if (!isNaN(v)) this.rs[i].lp = Math.max(3.00, Math.min(9.90, v)); }
                    if (r.hp !== undefined) { const v = Number(r.hp); if (!isNaN(v)) this.rs[i].hp = Math.max(3.00, Math.min(9.90, v)); }
                    if (r.gn !== undefined) { const v = Number(r.gn); if (!isNaN(v)) this.rs[i].gn = Math.max(-18, Math.min(18, v)); }
                }
            });
            updated = true;
        }
        if (params.resonatorIndex !== undefined && params.resonatorParams) {
            const i = Number(params.resonatorIndex);
            if (!isNaN(i) && i >= 0 && i < 5) {
                const r = this.rs[i], p = params.resonatorParams;
                if (p.en !== undefined) { r.en = !!p.en; updated = true; }
                if (p.fr !== undefined) { const v = Number(p.fr); if (!isNaN(v)) { r.fr = Math.max(3.00, Math.min(9.90, v)); updated = true; } }
                if (p.dc !== undefined) { const v = Number(p.dc); if (!isNaN(v)) { r.dc = Math.max(1, Math.min(500, v));   updated = true; } }
                if (p.lp !== undefined) { const v = Number(p.lp); if (!isNaN(v)) { r.lp = Math.max(3.00, Math.min(9.90, v)); updated = true; } }
                if (p.hp !== undefined) { const v = Number(p.hp); if (!isNaN(v)) { r.hp = Math.max(3.00, Math.min(9.90, v)); updated = true; } }
                if (p.gn !== undefined) { const v = Number(p.gn); if (!isNaN(v)) { r.gn = Math.max(-18, Math.min(18, v));    updated = true; } }
            }
        }

        if (updated) this.updateParameters();
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'plugin-parameter-ui';
        container.id = this.id;

        const resonatorContainer = document.createElement('div');
        resonatorContainer.className = 'modal-resonator-container';

        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'modal-resonator-frame';

        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'modal-resonator-tabs';

        const contentContainer = document.createElement('div');

        const createResonatorRow = (label, min, max, step, value, param, resonatorIndex) => {
            const row = document.createElement('div');
            row.className = 'parameter-row';

            const sliderId = `${this.id}-${this.name}-res${resonatorIndex}-${param}-slider`;
            const inputId  = `${this.id}-${this.name}-res${resonatorIndex}-${param}-input`;

            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.htmlFor = sliderId;
            row.appendChild(labelEl);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = sliderId;
            slider.name = sliderId;
            slider.min = min;
            slider.max = max;
            slider.step = step;
            slider.value = value;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = inputId;
            input.name = inputId;

            if (param === 'fr' || param === 'lp' || param === 'hp') {
                input.min = Math.round(Math.exp(min));
                input.max = Math.round(Math.exp(max));
                input.step = 1;
                input.value = Math.round(Math.exp(value));
            } else {
                input.min = min;
                input.max = max;
                input.step = step;
                input.value = value;
            }

            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (param === 'fr' || param === 'lp' || param === 'hp') {
                    input.value = Math.round(Math.exp(val));
                } else {
                    input.value = val;
                }
                const params = {};
                params[param] = val;
                this.setParameters({ resonatorIndex, resonatorParams: params });
            });

            input.addEventListener('input', (e) => {
                let inputVal = parseFloat(e.target.value);
                let paramVal;
                if (isNaN(inputVal)) {
                    inputVal = (param === 'fr' || param === 'lp' || param === 'hp')
                        ? Math.round(Math.exp(this.rs[resonatorIndex][param]))
                        : this.rs[resonatorIndex][param];
                }
                if (param === 'fr' || param === 'lp' || param === 'hp') {
                    const minHz = Math.round(Math.exp(min));
                    const maxHz = Math.round(Math.exp(max));
                    inputVal = Math.max(minHz, Math.min(maxHz, inputVal));
                    paramVal = Math.log(inputVal);
                    paramVal = Math.max(min, Math.min(max, parseFloat(paramVal.toFixed(2))));
                    e.target.value = Math.round(inputVal);
                } else {
                    paramVal = Math.max(min, Math.min(max, inputVal));
                    e.target.value = paramVal;
                }
                slider.value = paramVal;
                const params = {};
                params[param] = paramVal;
                this.setParameters({ resonatorIndex, resonatorParams: params });
            });

            row.appendChild(slider);
            row.appendChild(input);
            return row;
        };

        for (let i = 0; i < 5; i++) {
            const tab = document.createElement('button');
            tab.className = `modal-resonator-tab ${i === this.sr ? 'active' : ''}`;
            tab.textContent = `Resonator ${i + 1}`;
            tab.onclick = () => {
                const pluginUI = document.getElementById(this.id);
                if (!pluginUI) return;
                pluginUI.querySelectorAll('.modal-resonator-tab').forEach(el => el.classList.remove('active'));
                pluginUI.querySelectorAll('.modal-resonator-content').forEach(el => el.classList.remove('active'));
                tab.classList.add('active');
                const content = pluginUI.querySelector(`.modal-resonator-content[data-index="${i}"]`);
                if (content) content.classList.add('active');
                this.setParameters({ sr: i });
            };
            tabsContainer.appendChild(tab);

            const content = document.createElement('div');
            content.className = `modal-resonator-content ${i === this.sr ? 'active' : ''}`;
            content.setAttribute('data-index', i);

            const paramUI = document.createElement('div');
            paramUI.className = 'plugin-parameter-ui';
            content.appendChild(paramUI);

            const resonator = this.rs[i];

            const enableRow = document.createElement('div');
            enableRow.className = 'parameter-row';
            const enableId = `${this.id}-${this.name}-res${i}-enable`;
            const enableLabel = document.createElement('label');
            enableLabel.textContent = 'Enable:';
            enableLabel.htmlFor = enableId;
            enableRow.appendChild(enableLabel);

            const enableCheckbox = document.createElement('input');
            enableCheckbox.type = 'checkbox';
            enableCheckbox.id = enableId;
            enableCheckbox.name = enableId;
            enableCheckbox.checked = resonator.en;
            enableCheckbox.onchange = (e) => {
                this.setParameters({ resonatorIndex: i, resonatorParams: { en: e.target.checked } });
            };
            enableRow.appendChild(enableCheckbox);
            paramUI.appendChild(enableRow);

            paramUI.appendChild(createResonatorRow('Freq (Hz):', 3.00, 9.90, 0.01, resonator.fr, 'fr', i));
            paramUI.appendChild(createResonatorRow('Decay T60 (ms):', 1, 500, 1, resonator.dc, 'dc', i));
            paramUI.appendChild(createResonatorRow('LPF Freq (Hz):', 3.00, 9.90, 0.01, resonator.lp, 'lp', i));
            paramUI.appendChild(createResonatorRow('HPF Freq (Hz):', 3.00, 9.90, 0.01, resonator.hp, 'hp', i));
            paramUI.appendChild(createResonatorRow('Gain (dB):', -18, 18, 0.1, resonator.gn, 'gn', i));

            contentContainer.appendChild(content);
        }

        settingsContainer.appendChild(tabsContainer);
        settingsContainer.appendChild(contentContainer);
        resonatorContainer.appendChild(settingsContainer);
        container.appendChild(resonatorContainer);

        // Mix Control
        const mixRow = document.createElement('div');
        mixRow.className = 'parameter-row';
        const mixLabel = document.createElement('label');
        mixLabel.textContent = 'Mix (%):';
        mixLabel.htmlFor = `${this.id}-${this.name}-mix-slider`;
        const mixSlider = document.createElement('input');
        mixSlider.type = 'range';
        mixSlider.id = `${this.id}-${this.name}-mix-slider`;
        mixSlider.name = `${this.id}-${this.name}-mix-slider`;
        mixSlider.min = 0; mixSlider.max = 100; mixSlider.step = 1; mixSlider.value = this.mx;
        const mixValue = document.createElement('input');
        mixValue.type = 'number';
        mixValue.id = `${this.id}-${this.name}-mix-value`;
        mixValue.name = `${this.id}-${this.name}-mix-value`;
        mixValue.min = 0; mixValue.max = 100; mixValue.step = 1; mixValue.value = this.mx;

        const mixHandler = (e) => {
            const value = parseFloat(e.target.value);
            mixSlider.value = value;
            mixValue.value = value;
            this.setParameters({ mx: value });
        };
        mixSlider.addEventListener('input', mixHandler);
        mixValue.addEventListener('input', mixHandler);
        mixRow.appendChild(mixLabel);
        mixRow.appendChild(mixSlider);
        mixRow.appendChild(mixValue);
        container.appendChild(mixRow);

        // Limiter Control (0..0.8)
        const limRow = document.createElement('div');
        limRow.className = 'parameter-row';
        const limLabel = document.createElement('label');
        limLabel.textContent = 'Limiter (0..0.8):';
        limLabel.htmlFor = `${this.id}-${this.name}-lim-slider`;
        const limSlider = document.createElement('input');
        limSlider.type = 'range';
        limSlider.id = `${this.id}-${this.name}-lim-slider`;
        limSlider.name = `${this.id}-${this.name}-lim-slider`;
        limSlider.min = 0; limSlider.max = 0.8; limSlider.step = 0.01; limSlider.value = this.lim;
        const limValue = document.createElement('input');
        limValue.type = 'number';
        limValue.id = `${this.id}-${this.name}-lim-value`;
        limValue.name = `${this.id}-${this.name}-lim-value`;
        limValue.min = 0; limValue.max = 0.8; limValue.step = 0.01; limValue.value = this.lim;
        const limHandler = (e) => {
            const value = Math.max(0, Math.min(0.8, parseFloat(e.target.value)));
            limSlider.value = value;
            limValue.value = value;
            this.setParameters({ lim: value });
        };
        limSlider.addEventListener('input', limHandler);
        limValue.addEventListener('input', limHandler);
        limRow.appendChild(limLabel);
        limRow.appendChild(limSlider);
        limRow.appendChild(limValue);
        container.appendChild(limRow);

        // Detune Control (cents 0..20)
        const detRow = document.createElement('div');
        detRow.className = 'parameter-row';
        const detLabel = document.createElement('label');
        detLabel.textContent = 'Detune (cents):';
        detLabel.htmlFor = `${this.id}-${this.name}-det-slider`;
        const detSlider = document.createElement('input');
        detSlider.type = 'range';
        detSlider.id = `${this.id}-${this.name}-det-slider`;
        detSlider.name = `${this.id}-${this.name}-det-slider`;
        detSlider.min = 0; detSlider.max = 20; detSlider.step = 0.1; detSlider.value = this.det;
        const detValue = document.createElement('input');
        detValue.type = 'number';
        detValue.id = `${this.id}-${this.name}-det-value`;
        detValue.name = `${this.id}-${this.name}-det-value`;
        detValue.min = 0; detValue.max = 20; detValue.step = 0.1; detValue.value = this.det;
        const detHandler = (e) => {
            const value = Math.max(0, Math.min(20, parseFloat(e.target.value)));
            detSlider.value = value;
            detValue.value = value;
            this.setParameters({ det: value });
        };
        detSlider.addEventListener('input', detHandler);
        detValue.addEventListener('input', detHandler);
        detRow.appendChild(detLabel);
        detRow.appendChild(detSlider);
        detRow.appendChild(detValue);
        container.appendChild(detRow);

        // Excitation Position (0..1)
        const posRow = document.createElement('div');
        posRow.className = 'parameter-row';
        const posLabel = document.createElement('label');
        posLabel.textContent = 'Excitation Pos (0..1):';
        posLabel.htmlFor = `${this.id}-${this.name}-pos-slider`;
        const posSlider = document.createElement('input');
        posSlider.type = 'range';
        posSlider.id = `${this.id}-${this.name}-pos-slider`;
        posSlider.name = `${this.id}-${this.name}-pos-slider`;
        posSlider.min = 0; posSlider.max = 1; posSlider.step = 0.001; posSlider.value = this.pos;
        const posValue = document.createElement('input');
        posValue.type = 'number';
        posValue.id = `${this.id}-${this.name}-pos-value`;
        posValue.name = `${this.id}-${this.name}-pos-value`;
        posValue.min = 0; posValue.max = 1; posValue.step = 0.001; posValue.value = this.pos;
        const posHandler = (e) => {
            const value = Math.max(0, Math.min(1, parseFloat(e.target.value)));
            posSlider.value = value;
            posValue.value = value;
            this.setParameters({ pos: value });
        };
        posSlider.addEventListener('input', posHandler);
        posValue.addEventListener('input', posHandler);
        posRow.appendChild(posLabel);
        posRow.appendChild(posSlider);
        posRow.appendChild(posValue);
        container.appendChild(posRow);

        return container;
    }
}

window.ModalResonatorPlugin = ModalResonatorPlugin;