// plugins/resonator/horn_resonator_plus.js

/**
 * HornResonatorPlusPlugin simulates the acoustic resonance of a horn
 * using a digital waveguide model with frequency-dependent mouth reflection
 * and adjustable throat reflection.
 */
class HornResonatorPlusPlugin extends PluginBase {
    /**
     * Initializes the Horn Resonator plugin.
     */
    constructor() {
        super('Horn Resonator Plus', 'Horn resonance emulator (enhanced)');

        this.co = 600;  // Crossover frequency (Hz)
        this.ln = 70;   // Horn length (cm)
        this.th = 3.0;  // Throat diameter (cm)
        this.mo = 60;   // Mouth diameter (cm)
        this.cv = 40;   // Curve (%)
        this.dp = 0.03; // Damping loss (dB/meter)
        this.tr = 0.99; // Throat reflection coefficient
        this.wg = 30.0; // Output signal gain (dB)

        this.registerProcessor(`
            if (!parameters.en) return data;
            if (!wasm) return data;

            const sr  = parameters.sampleRate;
            const chs = parameters.channelCount;
            const bs  = parameters.blockSize;

            const needsReinit = !context.initialized ||
                                context.sr !== sr ||
                                context.chs !== chs ||
                                context.bs !== bs ||
                                ['ln','th','mo','cv','dp','tr','co','wg']
                                .some(k => context[k] !== parameters[k]);

            if (needsReinit) {
                wasm.exports.hrp_setup(sr, chs, bs, parameters.ln, parameters.th, parameters.mo,
                    parameters.cv, parameters.dp, parameters.tr, parameters.co, parameters.wg);
                context.sr = sr; context.chs = chs; context.bs = bs;
                ['ln','th','mo','cv','dp','tr','co','wg'].forEach(k => { context[k] = parameters[k]; });
                context.bufPtr = wasm.exports.hrp_get_buffer();
                context.buffer = new Float32Array(wasm.memory.buffer, context.bufPtr, chs * bs);
                context.initialized = true;
            }

            context.buffer.set(data);
            wasm.exports.hrp_process(context.bufPtr);
            data.set(context.buffer.subarray(0, chs * bs));
            return data;
        `, 'plugins/resonator/wasm/horn_resonator_plus.wasm');
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
        c.className = 'plugin-parameter-ui horn-resonator-plus-ui';

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
window.HornResonatorPlusPlugin = HornResonatorPlusPlugin;
