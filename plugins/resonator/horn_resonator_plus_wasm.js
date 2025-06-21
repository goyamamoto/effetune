// plugins/resonator/horn_resonator_plus_wasm.js

/**
 * HornResonatorPlusWasmPlugin loads the WebAssembly implementation of the
 * horn resonator processor. Parameters and UI largely mirror the JS version
 * but processing is delegated to a WASM module.
 */
class HornResonatorPlusWasmPlugin extends PluginBase {
    constructor() {
        super('Horn Resonator Plus (WASM)', 'Horn resonance emulator (WASM)');

        this.co = 600;  // Crossover frequency (Hz)
        this.ln = 70;   // Horn length (cm)
        this.th = 3.0;  // Throat diameter (cm)
        this.mo = 60;   // Mouth diameter (cm)
        this.cv = 40;   // Curve (%)
        this.dp = 0.03; // Damping loss (dB/meter)
        this.tr = 0.99; // Throat reflection coefficient
        this.wg = 30.0; // Output signal gain (dB)

        // Load the WASM processor implemented in Rust
        this.registerWasmProcessor('wasm/horn_resonator_plus_wasm/horn_resonator_plus_wasm.wasm');
    }

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

    setParameters(p) {
        let up = false;
        const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

        if (p.ln !== undefined && !isNaN(p.ln)) { this.ln = clamp(+p.ln, 20, 120); up = true; }
        if (p.th !== undefined && !isNaN(p.th)) { this.th = clamp(+p.th, 0.5, 50); up = true; }
        if (p.mo !== undefined && !isNaN(p.mo)) { this.mo = clamp(+p.mo, 5, 200); up = true; }
        if (p.cv !== undefined && !isNaN(p.cv)) { this.cv = clamp(+p.cv, -100, 100); up = true; }
        if (p.dp !== undefined && !isNaN(p.dp)) { this.dp = clamp(+p.dp, 0, 10); up = true; }
        if (p.wg !== undefined && !isNaN(p.wg)) { this.wg = clamp(+p.wg, -36, 36); up = true; }
        if (p.tr !== undefined && !isNaN(p.tr)) { this.tr = clamp(+p.tr, 0, 0.99); up = true; }
        if (p.co !== undefined && !isNaN(p.co)) { this.co = clamp(+p.co, 20, 5000); up = true; }

        if (up) this.updateParameters();
    }

    createUI() {
        const c = document.createElement('div');
        c.className = 'plugin-parameter-ui horn-resonator-plus-ui';

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
window.HornResonatorPlusWasmPlugin = HornResonatorPlusWasmPlugin;
