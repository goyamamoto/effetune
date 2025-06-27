class FDNReverbPlugin extends PluginBase {
    constructor() {
        super('FDN Reverb', 'Feedback Delay Network reverb using FFT processing');

        // Parameter defaults (short keys for external storage)
        this.rt = 1.20;   // Reverb Time (0.20-10.00s)
        this.dt = 8;      // Density (4-8 lines)
        this.bd = 20.0;   // Base Delay (10.0-60.0ms)
        this.ds = 5.0;    // Delay Spread (0.0-25.0ms)
        this.df = 100;    // Diffusion (0-100%)
        this.wm = 30;     // Wet Mix (0-100%)
        this.dm = 100;    // Dry Mix (0-100%)

        this.registerProcessor(`
            if (!parameters.enabled) return data;

            const channelCount = parameters.channelCount;
            const blockSize = parameters.blockSize;
            const sampleRate = parameters.sampleRate;

            // --- Simple FFT implementation ---
            function initFFT(size) {
                const cos = new Float32Array(size);
                const sin = new Float32Array(size);
                const rev = new Uint32Array(size);
                const bits = Math.log2(size);
                for (let i = 0; i < size; i++) {
                    let j = 0, x = i;
                    for (let b = 0; b < bits; b++) { j = (j << 1) | (x & 1); x >>= 1; }
                    rev[i] = j;
                }
                for (let i = 0; i < size; i++) {
                    const angle = -2 * Math.PI * i / size;
                    cos[i] = Math.cos(angle);
                    sin[i] = Math.sin(angle);
                }
                return { size, cos, sin, rev };
            }

            function fft(obj, real, imag) {
                const { size, cos, sin, rev } = obj;
                for (let i = 0; i < size; i++) {
                    const j = rev[i];
                    if (j > i) {
                        let t = real[i]; real[i] = real[j]; real[j] = t;
                        t = imag[i]; imag[i] = imag[j]; imag[j] = t;
                    }
                }
                for (let len = 2; len <= size; len <<= 1) {
                    const half = len >> 1;
                    const step = size / len;
                    for (let i = 0; i < size; i += len) {
                        for (let j = 0; j < half; j++) {
                            const idx = j * step;
                            const cr = cos[idx];
                            const sr = sin[idx];
                            const a = i + j;
                            const b = a + half;
                            const tr = real[b] * cr - imag[b] * sr;
                            const ti = real[b] * sr + imag[b] * cr;
                            real[b] = real[a] - tr;
                            imag[b] = imag[a] - ti;
                            real[a] += tr;
                            imag[a] += ti;
                        }
                    }
                }
            }

            function ifft(obj, real, imag) {
                for (let i = 0; i < obj.size; i++) imag[i] = -imag[i];
                fft(obj, real, imag);
                const inv = 1 / obj.size;
                for (let i = 0; i < obj.size; i++) { real[i] *= inv; imag[i] = -imag[i] * inv; }
            }

            if (!context.initialized || context.sampleRate !== sampleRate) {
                context.sampleRate = sampleRate;
                context.prevHash = '';
                context.initialized = true;
            }

            const hash = [parameters.rt, parameters.dt, parameters.bd, parameters.ds, parameters.df].join(':');

            if (context.prevHash !== hash) {
                const length = Math.max(1, Math.round(sampleRate * parameters.rt));
                const impulse = new Float32Array(length);
                impulse[0] = 1.0;

                const density = parameters.dt;
                const baseDelay = parameters.bd * sampleRate * 0.001;
                const spread = parameters.ds * sampleRate * 0.001;
                const diffusion = parameters.df * 0.01;
                const hadamard = [
                    [1,1,1,1,1,1,1,1],[1,-1,1,-1,1,-1,1,-1],
                    [1,1,-1,-1,1,1,-1,-1],[1,-1,-1,1,1,-1,-1,1],
                    [1,1,1,1,-1,-1,-1,-1],[1,-1,1,-1,-1,1,-1,1],
                    [1,1,-1,-1,-1,-1,1,1],[1,-1,-1,1,-1,1,1,-1]
                ];
                const delayLines = new Array(density);
                const positions = new Uint32Array(density);
                const feedbackGains = new Float32Array(density);
                const lineDelay = new Float32Array(density);
                for (let i = 0; i < density; i++) {
                    const d = baseDelay + spread * (i / (density - 1));
                    lineDelay[i] = d;
                    const len = Math.max(1, Math.round(d));
                    delayLines[i] = new Float32Array(len);
                    feedbackGains[i] = Math.pow(0.001, len / (sampleRate * parameters.rt));
                }
                const invSqrt = 1 / Math.sqrt(density);
                for (let n = 0; n < length; n++) {
                    const outputs = new Float32Array(density);
                    for (let l = 0; l < density; l++) {
                        const buf = delayLines[l];
                        const pos = positions[l];
                        const read = (pos + buf.length - 1) % buf.length;
                        outputs[l] = buf[read];
                    }
                    const mix = new Float32Array(density);
                    for (let row = 0; row < density; row++) {
                        let sum = 0;
                        const hadRow = hadamard[row];
                        for (let col = 0; col < density; col++) sum += hadRow[col] * outputs[col];
                        mix[row] = sum * invSqrt * diffusion;
                    }
                    for (let l = 0; l < density; l++) {
                        const buf = delayLines[l];
                        const pos = positions[l];
                        buf[pos] = impulse[n] + mix[l] * feedbackGains[l];
                        positions[l] = (pos + 1) % buf.length;
                    }
                    let sum = 0;
                    for (let l = 0; l < density; l++) sum += outputs[l];
                    impulse[n] = sum * invSqrt;
                }

                let fftSize = 1;
                while (fftSize < impulse.length + blockSize) fftSize <<= 1;
                context.fft = initFFT(fftSize);
                context.fftSize = fftSize;
                context.Hr = new Float32Array(fftSize).fill(0);
                context.Hi = new Float32Array(fftSize).fill(0);
                context.Hr.set(impulse);
                fft(context.fft, context.Hr, context.Hi);
                context.overlap = new Array(channelCount);
                for (let ch = 0; ch < channelCount; ch++) {
                    context.overlap[ch] = new Float32Array(fftSize - blockSize).fill(0);
                }
                context.prevHash = hash;
            }

            const fftSize = context.fftSize;
            const Hr = context.Hr;
            const Hi = context.Hi;
            const wm = parameters.wm * 0.01;
            const dm = parameters.dm * 0.01;
            for (let ch = 0; ch < channelCount; ch++) {
                const offset = ch * blockSize;
                const real = new Float32Array(fftSize).fill(0);
                const imag = new Float32Array(fftSize).fill(0);
                real.set(data.subarray(offset, offset + blockSize));
                real.set(context.overlap[ch], blockSize);
                fft(context.fft, real, imag);
                for (let k = 0; k < fftSize; k++) {
                    const r = real[k];
                    const i = imag[k];
                    const hr = Hr[k];
                    const hi = Hi[k];
                    real[k] = r * hr - i * hi;
                    imag[k] = r * hi + i * hr;
                }
                ifft(context.fft, real, imag);
                for (let i = 0; i < blockSize; i++) {
                    const wet = real[i] + context.overlap[ch][i];
                    data[offset + i] = data[offset + i] * dm + wet * wm;
                }
                context.overlap[ch].set(real.subarray(blockSize));
            }
            return data;
        `);
    }

    getParameters() {
        return {
            type: this.constructor.name,
            enabled: this.enabled,
            rt: this.rt,
            dt: this.dt,
            bd: this.bd,
            ds: this.ds,
            df: this.df,
            wm: this.wm,
            dm: this.dm
        };
    }

    setParameters(params) {
        if (params.rt !== undefined) this.rt = Math.max(0.20, Math.min(10.00, Number(params.rt)));
        if (params.dt !== undefined) this.dt = Math.max(4, Math.min(8, Math.floor(Number(params.dt))));
        if (params.bd !== undefined) this.bd = Math.max(10.0, Math.min(60.0, Number(params.bd)));
        if (params.ds !== undefined) this.ds = Math.max(0.0, Math.min(25.0, Number(params.ds)));
        if (params.df !== undefined) this.df = Math.max(0, Math.min(100, Math.floor(Number(params.df))));
        if (params.wm !== undefined) this.wm = Math.max(0, Math.min(100, Math.floor(Number(params.wm))));
        if (params.dm !== undefined) this.dm = Math.max(0, Math.min(100, Math.floor(Number(params.dm))));
        this.updateParameters();
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'plugin-parameter-ui';
        container.appendChild(this.createParameterControl('Reverb Time', 0.20, 10.00, 0.01, this.rt, (v) => this.setParameters({ rt: v }), 's'));
        container.appendChild(this.createParameterControl('Density', 4, 8, 1, this.dt, (v) => this.setParameters({ dt: v }), 'lines'));
        container.appendChild(this.createParameterControl('Base Delay', 10.0, 60.0, 0.1, this.bd, (v) => this.setParameters({ bd: v }), 'ms'));
        container.appendChild(this.createParameterControl('Delay Spread', 0.0, 25.0, 0.1, this.ds, (v) => this.setParameters({ ds: v }), 'ms'));
        container.appendChild(this.createParameterControl('Diffusion', 0, 100, 1, this.df, (v) => this.setParameters({ df: v }), '%'));
        container.appendChild(this.createParameterControl('Wet Mix', 0, 100, 1, this.wm, (v) => this.setParameters({ wm: v }), '%'));
        container.appendChild(this.createParameterControl('Dry Mix', 0, 100, 1, this.dm, (v) => this.setParameters({ dm: v }), '%'));
        return container;
    }
}

window.FDNReverbPlugin = FDNReverbPlugin;
