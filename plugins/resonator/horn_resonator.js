// plugins/resonator/horn_resonator.js

/**
 * HornResonatorPlugin simulates the acoustic resonance of a horn
 * using a digital waveguide model with frequency-dependent mouth reflection
 * and adjustable throat reflection.
 */
class HornResonatorPlugin extends PluginBase {
    /**
     * Initializes the Horn Resonator plugin.
     */
    constructor() {
        super('Horn Resonator', 'Horn resonance emulator');

        this.co = 600;  // Crossover frequency (Hz)
        this.ln = 70;   // Horn length (cm)
        this.th = 3.0;  // Throat diameter (cm)
        this.mo = 60;   // Mouth diameter (cm)
        this.cv = 40;   // Curve (%)
        this.dp = 0.03; // Damping loss (dB/meter)
        this.tr = 0.99; // Throat reflection coefficient
        this.wg = 30.0; // Output signal gain (dB)

        // Physical constants
        const C = 343;   // Speed of sound in air (m/s)
        const RHO_C = 413; // Characteristic impedance of air (Pa*s/m^3)

        this.registerProcessor(`
            // --- Define constants required within this processor's scope ---
            const C = 343;     // Speed of sound in air (m/s)
            const RHO_C = 413; // Characteristic impedance of air (Pa*s/m^3)
            const PI = Math.PI;
            const TWO_PI = 2 * PI;
            const SQRT2 = Math.SQRT2;
            const EPS = 1e-9;   // Small epsilon value to prevent division by zero or instability
            const DC_OFFSET = 1e-25; // Small DC offset to stabilize filters

            // If the plugin is disabled, bypass processing.
            if (!parameters.en) return data;

            const sr  = parameters.sampleRate;
            const chs = parameters.channelCount;
            const bs  = parameters.blockSize;

            // --- Determine if recalculation of internal state is needed ---
            const needsRecalc = !context.initialized ||
                                context.sr  !== sr ||
                                context.chs !== chs ||
                                // List of parameters that necessitate recalculation
                                ['ln','th','mo','cv','dp','tr','co']
                                .some(key => context[key] !== parameters[key]);

            /* ---------- 1. Recalculate geometry & filter coefficients if needed -------- */
            if (needsRecalc) {
                // Update context with current parameters
                context.sr  = sr;
                context.chs = chs;
                context.ln = parameters.ln;
                context.th = parameters.th;
                context.mo = parameters.mo;
                context.cv = parameters.cv;
                context.dp = parameters.dp;
                context.tr = parameters.tr;
                context.co = parameters.co;

                // --- Horn Geometry Calculation ---
                const dx = C / sr; // Spatial step size based on sample rate
                const L  = context.ln / 100; // Horn length in meters
                const N  = Math.max(1, Math.round(L / dx)); // Number of waveguide segments
                context.N = N;

                const curveExponent = Math.pow(10, context.cv / 100); // Curve parameter exponent
                const throatRadius = context.th / 200; // Throat radius [m]
                const mouthRadius = context.mo / 200;  // Mouth radius [m]

                // Allocate or resize impedance and reflection coefficient arrays if N changed
                if (!context.Z || context.Z.length !== N + 1) {
                    context.Z = new Float32Array(N + 1); // Impedance at section boundaries
                    context.R = new Float32Array(N);     // Reflection coefficients between sections
                }
                const Z = context.Z;
                const R = context.R;

                // Calculate impedance Z at each section boundary (0 to N)
                for (let i = 0; i <= N; i++) {
                    let radius; // Radius at boundary i
                    if (i === 0) {
                        radius = throatRadius;
                    } else if (i === N) {
                        radius = mouthRadius;
                    } else {
                        radius = throatRadius + (mouthRadius - throatRadius) * Math.pow(i / N, curveExponent); // Interpolate radius
                    }
                    const area = PI * Math.max(EPS, radius * radius); // Section area
                    Z[i] = RHO_C / area; // Characteristic impedance
                }

                // Calculate reflection coefficient R between sections i and i+1 (0 to N-1)
                for (let i = 0; i < N; i++) {
                    const Z_i = Z[i];
                    const Z_i1 = Z[i+1];
                    const sumZ = Z_i + Z_i1;
                    R[i] = (sumZ < EPS) ? 0 : (Z_i1 - Z_i) / sumZ; // Reflection coefficient
                }

                // Damping gain per segment
                context.g = Math.pow(10, -context.dp * dx / 20);
                // Throat reflection coefficient
                context.trCoeff = context.tr;

                /* ---- Mouth Reflection Filter H_R(z) Design (Simplified 1st Order) ---- */
                // Approximates the frequency-dependent reflection at the horn mouth based on mouth radius.
                const effectiveMouthRadius = mouthRadius;
                const fc_mouth = (effectiveMouthRadius > EPS) ? C / (TWO_PI * effectiveMouthRadius) : sr / 4; // Heuristic cutoff
                const f_norm = Math.min(fc_mouth, sr * 0.45) / sr; // Normalized frequency
                const pole = 0.99 * Math.exp(-TWO_PI * f_norm); // Stable pole location
                // Coefficients for H_R(z) = b0 / (1 + a1*z^-1)
                context.rm_b0 = -(1 - pole); // Gain to approximate -1 reflection at DC
                context.rm_a1 = -pole;       // Stable pole

                // Allocate or resize state buffers for mouth reflection filter
                if (!context.rm_x1_states || context.rm_x1_states.length !== chs) {
                    context.rm_x1_states = new Float32Array(chs).fill(0); // Input history z^-1
                    context.rm_y1_states = new Float32Array(chs).fill(0); // Output history z^-1
                } else {
                    context.rm_x1_states.fill(0); // Reset states
                    context.rm_y1_states.fill(0);
                }

                // --- Waveguide delay line buffer initialization ---
                if (!context.fwd || context.fwd.length !== chs || context.fwd[0]?.length !== N + 1) {
                    context.fwd = Array.from({length: chs}, () => new Float32Array(N + 1).fill(0));
                    context.rev = Array.from({length: chs}, () => new Float32Array(N + 1).fill(0));
                } else {
                    for(let ch = 0; ch < chs; ++ch) { // Clear buffers
                        context.fwd[ch].fill(0);
                        context.rev[ch].fill(0);
                    }
                }
                // Temporary buffers for wave propagation calculation
                if (!context.fw_temp || context.fw_temp.length !== N + 1) {
                    context.fw_temp = new Float32Array(N + 1);
                    context.rv_temp = new Float32Array(N + 1);
                }

                /* ---- Crossover Filter (Linkwitz-Riley 4th order) Initialization ---- */
                const crossoverFreq = Math.max(20, Math.min(sr * 0.5 - 1, context.co)); // Clamp frequency
                const omega = Math.tan(crossoverFreq * PI / sr); // Prewarp
                const omega2 = omega * omega;
                const k = SQRT2 * omega; // Butterworth factor
                const den = omega2 + k + 1.0;
                const invDen = (den < EPS) ? 1.0 : 1.0 / den; // Inverse denominator

                // Calculate coefficients (Direct Form II)
                const b0_lp = omega2 * invDen;
                const b1_lp = 2.0 * b0_lp;
                const b2_lp = b0_lp;
                const b0_hp = invDen;
                const b1_hp = -2.0 * b0_hp;
                const b2_hp = b0_hp;
                const a1_c = 2.0 * (omega2 - 1.0) * invDen;
                const a2_c = (omega2 - k + 1.0) * invDen;
                context.lrCoeffs = { b0_lp, b1_lp, b2_lp, b0_hp, b1_hp, b2_hp, a1_c, a2_c };

                // Initialize crossover filter states as flat arrays
                // [x1_1, x2_1, y1_1, y2_1, x1_2, x2_2, y1_2, y2_2]
                const initStage = () => new Float32Array([
                    DC_OFFSET, -DC_OFFSET, DC_OFFSET, -DC_OFFSET,
                    DC_OFFSET, -DC_OFFSET, DC_OFFSET, -DC_OFFSET
                ]);
                const createCrossoverArray = () => Array.from({length: chs}, () => initStage());
                if (!context.lrStates || !context.lrStates.low || context.lrStates.low.length !== chs) {
                    context.lrStates = {
                        low: createCrossoverArray(),
                        high: createCrossoverArray()
                    };
                } else {
                    for (let ch = 0; ch < chs; ++ch) {
                        context.lrStates.low[ch] = initStage();
                        context.lrStates.high[ch] = initStage();
                    }
                }

                // Initialize low-band delay buffer (delay = N samples)
                if (!context.lowDelay || context.lowDelay.length !== chs || context.lowDelay[0]?.length !== N) {
                    context.lowDelay = Array.from({length: chs}, () => new Float32Array(N).fill(0));
                    context.lowDelayIdx = new Uint32Array(chs).fill(0); // Reset indices
                } else {
                    for(let ch = 0; ch < chs; ++ch) { // Reset delay buffer
                        context.lowDelay[ch].fill(0);
                    }
                    context.lowDelayIdx.fill(0); // Reset indices
                }

                context.initialized = true;
            } // End of needsRecalc block

            /* ------------------ 2. Sample processing loop ---------------- */
            const N = context.N;             // Number of waveguide segments
            const R = context.R;             // Reflection coefficient array [N]
            const g = context.g;             // Damping gain per segment
            const trCoeff = context.trCoeff; // Throat reflection coefficient

            const fwd = context.fwd; // [chs][N+1] Forward wave states
            const rev = context.rev; // [chs][N+1] Reverse wave states

            const fw_temp = context.fw_temp; // [N+1] Temp buffer for next forward wave
            const rv_temp = context.rv_temp; // [N+1] Temp buffer for next reverse wave

            // Mouth reflection filter coefficients and states
            const rm_b0 = context.rm_b0;
            const rm_a1 = context.rm_a1;
            const rm_x1_states = context.rm_x1_states; // [chs] Input history states
            const rm_y1_states = context.rm_y1_states; // [chs] Output history states

            // Crossover filter coefficients and states
            const { b0_lp, b1_lp, b2_lp, b0_hp, b1_hp, b2_hp, a1_c, a2_c } = context.lrCoeffs;
            const lpStates = context.lrStates.low;  // [chs][8] Low-pass states
            const hpStates = context.lrStates.high; // [chs][8] High-pass states

            // Low-band delay buffer and index array
            const lowDelay = context.lowDelay;       // [chs][N] Delay buffer
            const lowDelayIdx = context.lowDelayIdx; // [chs] Current write indices

            // Output gain (linear)
            const outputGain = Math.pow(10, parameters.wg / 20);

            // --- Channel Loop ---
            for (let ch = 0; ch < chs; ch++) {
                const channelOffset = ch * bs; // Offset for current channel in data buffer
                const fw_current = fwd[ch]; // Current forward wave states [N+1]
                const rv_current = rev[ch]; // Current reverse wave states [N+1]

                // --- Load channel-specific states ---
                let rm_x1 = rm_x1_states[ch]; // Mouth reflection filter states
                let rm_y1 = rm_y1_states[ch];

                const lpState = lpStates[ch];
                const hpState = hpStates[ch];

                let currentLowDelayWriteIdx = lowDelayIdx[ch]; // Low-band delay state
                const currentLowDelayLine = lowDelay[ch];

                // --- Sample Loop ---
                for (let i = 0; i < bs; i++) {
                    const inputSample = data[channelOffset + i]; // Get input sample

                    // --- Apply Crossover Filter (4th order LR) ---
                    let y1_lp, y1_hp;
                    let outputLow, outputHigh;

                    // Low-pass path - Stage 1 (DF-II Transposed)
                    y1_lp = b0_lp * inputSample + b1_lp * lpState[0] + b2_lp * lpState[1] - a1_c * lpState[2] - a2_c * lpState[3];
                    lpState[1] = lpState[0]; lpState[0] = inputSample; lpState[3] = lpState[2]; lpState[2] = y1_lp;
                    // Low-pass path - Stage 2
                    outputLow = b0_lp * y1_lp + b1_lp * lpState[4] + b2_lp * lpState[5] - a1_c * lpState[6] - a2_c * lpState[7];
                    lpState[5] = lpState[4]; lpState[4] = y1_lp; lpState[7] = lpState[6]; lpState[6] = outputLow;

                    // High-pass path - Stage 1
                    y1_hp = b0_hp * inputSample + b1_hp * hpState[0] + b2_hp * hpState[1] - a1_c * hpState[2] - a2_c * hpState[3];
                    hpState[1] = hpState[0]; hpState[0] = inputSample; hpState[3] = hpState[2]; hpState[2] = y1_hp;
                    // High-pass path - Stage 2
                    outputHigh = b0_hp * y1_hp + b1_hp * hpState[4] + b2_hp * hpState[5] - a1_c * hpState[6] - a2_c * hpState[7];
                    hpState[5] = hpState[4]; hpState[4] = y1_hp; hpState[7] = hpState[6]; hpState[6] = outputHigh;

                    // --- Propagate waves along the horn segments ---
                    // Calculate scattering at junctions j=0 to N-1 and apply damping (g).
                    for (let j = 0; j < N; j++) {
                        const Rj = R[j];           // Reflection coefficient at junction j
                        const f_in = fw_current[j];   // Forward wave arriving at j from left
                        const r_in = rv_current[j+1]; // Reverse wave arriving at j from right
                        const scatterDiff = Rj * (f_in - r_in); // Scattering difference term
                        fw_temp[j+1] = g * (f_in + scatterDiff); // Wave leaving j to the right
                        rv_temp[j] = g * (r_in + scatterDiff);   // Wave leaving j to the left
                    }

                    /* ---- Mouth Node Boundary Condition (j=N) ---- */
                    const fwN = fw_temp[N]; // Forward wave arriving at mouth boundary

                    // Apply 1st order mouth reflection filter H_R(z)
                    const reflectedMouthWave = rm_b0 * fwN - rm_a1 * rm_y1;
                    rv_temp[N] = reflectedMouthWave; // Update reverse wave at mouth

                    // Update mouth reflection filter states
                    rm_x1 = fwN;
                    rm_y1 = reflectedMouthWave;

                    /* ---- Throat Node Boundary Condition (j=0) ---- */
                    // Inject high-pass input signal and add throat reflection.
                    fw_temp[0] = outputHigh + trCoeff * rv_temp[0];

                    /* ---- Update Waveguide State for the Next Sample ---- */
                    fw_current.set(fw_temp);
                    rv_current.set(rv_temp);

                    /* ---- Calculate Output Signal ---- */
                    // High-frequency output is transmitted wave at mouth.
                    const transmittedHighFreq = fwN + reflectedMouthWave;

                    // --- Low-Frequency Path Delay and Mix ---
                    const delayedLowFreq = currentLowDelayLine[currentLowDelayWriteIdx]; // Read delayed low freq
                    currentLowDelayLine[currentLowDelayWriteIdx] = outputLow; // Write current low freq
                    currentLowDelayWriteIdx++; // Increment and wrap delay index
                    if (currentLowDelayWriteIdx >= N) {
                        currentLowDelayWriteIdx = 0;
                    }

                    // Combine processed high-frequency signal (with gain) and delayed low-frequency signal.
                    data[channelOffset + i] = transmittedHighFreq * outputGain + delayedLowFreq;

                } // --- End of Sample Loop ---

                // --- Store updated channel-specific states ---
                rm_x1_states[ch] = rm_x1;
                rm_y1_states[ch] = rm_y1;
                // Crossover states updated in-place
                lowDelayIdx[ch] = currentLowDelayWriteIdx; // Store updated delay index

            } // --- End of Channel Loop ---

            return data; // Return processed audio data
        `);
    }

    /**
     * Retrieves the current parameter values.
     * @returns {object} Current parameter settings.
     */
    getParameters() {
        return {
            type: this.constructor.name,
            enabled: this.enabled,
            en: this.enabled,
            ln: this.ln, th: this.th, mo: this.mo,
            cv: this.cv,
            dp: this.dp, wg: this.wg,
            tr: this.tr,
            co: this.co
        };
    }

    /**
     * Sets the parameters of the plugin.
     * @param {object} p - New parameter values.
     */
    setParameters(p) {
        let up = false;
        const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

        // Geometry & Damping Parameters
        if (p.ln !== undefined && !isNaN(p.ln))
            { this.ln = clamp(+p.ln, 20, 120); up = true; }
        if (p.th !== undefined && !isNaN(p.th))
            { this.th = clamp(+p.th, 0.5, 50); up = true; }
        if (p.mo !== undefined && !isNaN(p.mo))
            { this.mo = clamp(+p.mo, 5, 200);  up = true; }
        if (p.cv !== undefined && !isNaN(p.cv))
            { this.cv = clamp(+p.cv, -100, 100); up = true; }
        if (p.dp !== undefined && !isNaN(p.dp))
            { this.dp = clamp(+p.dp, 0, 10);   up = true; }
        if (p.wg !== undefined && !isNaN(p.wg))
            { this.wg = clamp(+p.wg, -36, 36); up = true; }

        // Reflection & Crossover Parameters
        if (p.tr !== undefined && !isNaN(p.tr)) // Throat Reflection
            { this.tr = clamp(+p.tr, 0, 0.99); up = true; }
        if (p.co !== undefined && !isNaN(p.co)) { this.co = clamp(+p.co, 20, 5000); up = true; }

        if (up) this.updateParameters();
    }

    /**
     * Creates the HTML user interface for the plugin.
     * @returns {HTMLElement} The root element of the UI.
     */
    createUI() {
        const c = document.createElement('div');
        c.className = 'plugin-parameter-ui horn-resonator-ui';

        // Add sliders using the base class createParameterControl helper
        c.appendChild(this.createParameterControl('Crossover', 20, 5000, 10, this.co, (v) => this.setParameters({ co: v }), 'Hz'));
        c.appendChild(this.createParameterControl('Horn Length', 20, 120, 1, this.ln, (v) => this.setParameters({ ln: v }), 'cm'));
        c.appendChild(this.createParameterControl('Throat Dia.', 0.5, 50, 0.1, this.th, (v) => this.setParameters({ th: v }), 'cm'));
        c.appendChild(this.createParameterControl('Mouth Dia.', 5, 200, 0.5, this.mo, (v) => this.setParameters({ mo: v }), 'cm'));
        c.appendChild(this.createParameterControl('Curve', -100, 100, 1, this.cv, (v) => this.setParameters({ cv: v }), '%'));
        c.appendChild(this.createParameterControl('Damping', 0, 10, 0.01, this.dp, (v) => this.setParameters({ dp: v }), 'dB/m'));
        c.appendChild(this.createParameterControl('Throat Refl.', 0, 0.99, 0.01, this.tr, (v) => this.setParameters({ tr: v })));
        c.appendChild(this.createParameterControl('Output Gain', -36, 36, 0.1, this.wg, (v) => this.setParameters({ wg: v }), 'dB'));

        return c;
    }
}

// Export the class
window.HornResonatorPlugin = HornResonatorPlugin;