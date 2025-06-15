class HQPitchShifterPlugin extends PluginBase {
    constructor() {
        super('HQ Pitch Shifter', 'Phase vocoder pitch shifter with higher quality');

        this.ps = 0;  // semitones
        this.ft = 0;  // cents
        this.ws = 40; // window size in ms
        this.os = 8;  // oversampling factor

        this.registerProcessor(HQPitchShifterPlugin.processorFunction);
    }

    static processorFunction = `
        const TWO_PI = Math.PI * 2;
        const {
            ps, ft, ws, os, channelCount, blockSize, sampleRate
        } = parameters;

        let pitchFactor = 1.0;
        if (ps !== 0 || ft !== 0) {
            pitchFactor = Math.pow(2, ps / 12 + ft / 1200);
            if (!(pitchFactor > 0 && pitchFactor < Infinity)) pitchFactor = 1.0;
        }
        if (!parameters.enabled || pitchFactor === 1.0) {
            return data;
        }

        const frameSize = 1 << Math.round(Math.log2(ws * sampleRate / 1000));
        const hop = frameSize / os;
        const freqPerBin = sampleRate / frameSize;
        const expct = TWO_PI * hop / frameSize;

        // initialize context on first run or when frame size changes
        if (!context.initialized || context.frameSize !== frameSize || context.channelCount !== channelCount) {
            context.frameSize = frameSize;
            context.hop = hop;
            context.channelCount = channelCount;
            context.os = os;
            context.rover = new Array(channelCount).fill(0);
            context.inFIFO = new Array(channelCount);
            context.outFIFO = new Array(channelCount);
            context.outputAccum = new Array(channelCount);
            context.lastPhase = new Array(channelCount);
            context.sumPhase = new Array(channelCount);
            context.anaMagn = new Array(channelCount);
            context.anaFreq = new Array(channelCount);
            context.synMagn = new Array(channelCount);
            context.synFreq = new Array(channelCount);
            for (let ch = 0; ch < channelCount; ch++) {
                context.inFIFO[ch] = new Float32Array(frameSize);
                context.outFIFO[ch] = new Float32Array(frameSize);
                context.outputAccum[ch] = new Float32Array(frameSize * 2);
                context.lastPhase[ch] = new Float32Array(frameSize / 2 + 1);
                context.sumPhase[ch] = new Float32Array(frameSize / 2 + 1);
                context.anaMagn[ch] = new Float32Array(frameSize);
                context.anaFreq[ch] = new Float32Array(frameSize);
                context.synMagn[ch] = new Float32Array(frameSize);
                context.synFreq[ch] = new Float32Array(frameSize);
            }
            context.window = new Float32Array(frameSize);
            for (let i = 0; i < frameSize; i++) {
                context.window[i] = 0.5 - 0.5 * Math.cos(TWO_PI * i / frameSize);
            }
            context.fftReal = new Float32Array(frameSize);
            context.fftImag = new Float32Array(frameSize);
            context.initialized = true;
        }

        function fft(real, imag) {
            const n = real.length;
            const bits = Math.log2(n);
            for (let i = 0; i < n; i++) {
                const j = reverseBits(i, bits);
                if (j > i) {
                    const tr = real[i]; real[i] = real[j]; real[j] = tr;
                    const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
                }
            }
            for (let size = 2; size <= n; size <<= 1) {
                const half = size >> 1;
                const tableStep = n / size;
                for (let i = 0; i < n; i += size) {
                    for (let j = 0; j < half; j++) {
                        const k = j * tableStep;
                        const cos_w = Math.cos(TWO_PI * k / n);
                        const sin_w = Math.sin(TWO_PI * k / n);
                        const xr = real[i + j + half];
                        const xi = imag[i + j + half];
                        const tr = xr * cos_w - xi * sin_w;
                        const ti = xr * sin_w + xi * cos_w;
                        real[i + j + half] = real[i + j] - tr;
                        imag[i + j + half] = imag[i + j] - ti;
                        real[i + j] += tr;
                        imag[i + j] += ti;
                    }
                }
            }
        }

        function ifft(real, imag) {
            for (let i = 0; i < real.length; i++) imag[i] = -imag[i];
            fft(real, imag);
            for (let i = 0; i < real.length; i++) {
                real[i] = real[i] / real.length;
                imag[i] = -imag[i] / real.length;
            }
        }

        function reverseBits(x, bits) {
            let y = 0;
            for (let i = 0; i < bits; i++) {
                y = (y << 1) | (x & 1);
                x >>= 1;
            }
            return y;
        }

        const finalOutput = new Float32Array(data.length);

        for (let ch = 0; ch < channelCount; ch++) {
            const inOffset = ch * blockSize;
            const inFIFO = context.inFIFO[ch];
            const outFIFO = context.outFIFO[ch];
            const outputAccum = context.outputAccum[ch];
            const lastPhase = context.lastPhase[ch];
            const sumPhase = context.sumPhase[ch];
            const anaMagn = context.anaMagn[ch];
            const anaFreq = context.anaFreq[ch];
            const synMagn = context.synMagn[ch];
            const synFreq = context.synFreq[ch];
            let rover = context.rover[ch];

            for (let i = 0; i < blockSize; i++) {
                inFIFO[rover] = data[inOffset + i];
                finalOutput[inOffset + i] = outFIFO[rover];
                outFIFO[rover] = 0;
                rover++;
                if (rover >= frameSize) {
                    rover = 0;

                    for (let k = 0; k < frameSize; k++) {
                        context.fftReal[k] = inFIFO[k] * context.window[k];
                        context.fftImag[k] = 0;
                    }
                    fft(context.fftReal, context.fftImag);

                    for (let k = 0; k <= frameSize / 2; k++) {
                        const real = context.fftReal[k];
                        const imag = context.fftImag[k];
                        const magn = 2 * Math.hypot(real, imag);
                        let phase = Math.atan2(imag, real);
                        let delta = phase - lastPhase[k];
                        lastPhase[k] = phase;
                        delta -= k * expct;
                        const qpd = Math.round(delta / Math.PI);
                        delta -= Math.PI * qpd;
                        delta = os * delta / TWO_PI;
                        delta = k * freqPerBin + delta * freqPerBin;
                        anaMagn[k] = magn;
                        anaFreq[k] = delta;
                    }
                    synMagn.fill(0);
                    synFreq.fill(0);
                    for (let k = 0; k <= frameSize / 2; k++) {
                        let index = Math.floor(k * pitchFactor);
                        if (index <= frameSize / 2) {
                            synMagn[index] += anaMagn[k];
                            synFreq[index] = anaFreq[k] * pitchFactor;
                        }
                    }
                    for (let k = 0; k <= frameSize / 2; k++) {
                        const magn = synMagn[k];
                        let tmp = synFreq[k];
                        tmp -= k * freqPerBin;
                        tmp = tmp / freqPerBin;
                        tmp = TWO_PI * tmp / os + k * expct;
                        sumPhase[k] += tmp;
                        const phase = sumPhase[k];
                        context.fftReal[k] = magn * Math.cos(phase);
                        context.fftImag[k] = magn * Math.sin(phase);
                        if (k > 0 && k < frameSize / 2) {
                            context.fftReal[frameSize - k] = context.fftReal[k];
                            context.fftImag[frameSize - k] = -context.fftImag[k];
                        }
                    }
                    ifft(context.fftReal, context.fftImag);

                    for (let k = 0; k < frameSize; k++) {
                        outputAccum[k] += context.window[k] * context.fftReal[k] * (1 / (frameSize / 2));
                    }
                    for (let k = 0; k < hop; k++) {
                        outFIFO[k] = outputAccum[k];
                    }
                    outputAccum.copyWithin(0, hop);
                    outputAccum.fill(0, frameSize);
                    inFIFO.copyWithin(0, hop);
                }
            }
            context.rover[ch] = rover;
        }
        data.set(finalOutput);
        return data;
    `;

    getParameters() {
        return {
            type: this.constructor.name,
            ps: this.ps,
            ft: this.ft,
            ws: this.ws,
            os: this.os,
            enabled: this.enabled
        };
    }

    setParameters(params) {
        if (params.ps !== undefined) {
            const v = Math.round(params.ps);
            this.ps = v < -12 ? -12 : (v > 12 ? 12 : v);
        }
        if (params.ft !== undefined) {
            const v = Math.round(params.ft);
            this.ft = v < -50 ? -50 : (v > 50 ? 50 : v);
        }
        if (params.ws !== undefined) {
            const size = parseFloat(params.ws);
            if (!isNaN(size)) {
                const v = Math.round(size);
                this.ws = v < 20 ? 20 : (v > 100 ? 100 : v);
            }
        }
        if (params.os !== undefined) {
            const v = parseInt(params.os, 10);
            this.os = v < 2 ? 2 : (v > 16 ? 16 : v);
        }
        if (params.enabled !== undefined) this.enabled = params.enabled;
        this.updateParameters();
    }

    setPitch(value) { this.setParameters({ ps: value }); }
    setFine(value) { this.setParameters({ ft: value }); }
    setWindowSize(value) { this.setParameters({ ws: value }); }
    setOverSampling(value) { this.setParameters({ os: value }); }

    createUI() {
        const container = document.createElement('div');
        container.className = 'pitch-shift-plugin-ui plugin-parameter-ui';
        container.appendChild(this.createParameterControl(
            'Pitch Shift', -12, 12, 1, this.ps,
            this.setPitch.bind(this), 'semitones'
        ));
        container.appendChild(this.createParameterControl(
            'Fine Tune', -50, 50, 1, this.ft,
            this.setFine.bind(this), 'cents'
        ));
        container.appendChild(this.createParameterControl(
            'Window Size', 20, 100, 1, this.ws,
            this.setWindowSize.bind(this), 'ms'
        ));
        container.appendChild(this.createParameterControl(
            'Oversample', 2, 16, 1, this.os,
            this.setOverSampling.bind(this)
        ));
        return container;
    }
}

window.HQPitchShifterPlugin = HQPitchShifterPlugin;
