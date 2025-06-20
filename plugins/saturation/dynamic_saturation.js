class DynamicSaturationPlugin extends PluginBase {
    constructor() {
        super('Dynamic Saturation', 'Simulates distortion caused by speaker cone movement');

        // Initialize parameters with default values
        this.sd = 3.0;   // sd: Speaker Drive (0.0-10.0)
        this.ss = 2.0;   // ss: Speaker Stiffness (0.0-10.0)
        this.sp = 1.0;   // sp: Speaker Damping (0.0-10.0)
        this.sm = 1.0;   // sm: Speaker Mass (0.1-5.0)
        this.dd = 1.5;   // dd: Distortion Drive (0.0-10.0)
        this.db = 0.1;   // db: Distortion Bias (-1.0-1.0)
        this.dm = 100.0; // dm: Distortion Mix (0-100%)
        this.cm = 20.0;  // cm: Cone Motion Mix (0-100%)
        this.og = 0.0;   // og: Output Gain (-18.0-18.0 dB)

        // Register processor with our speaker cone simulation
        this.registerProcessor(`
            if (!parameters.enabled) return data;
        
            const {
                sd: spkDrive,
                ss: spkStiff,
                sp: spkDamp,
                sm: spkMass,
                dd: dstDrive,
                db: dstBias,
                dm: dstMix,
                cm: coneMix,
                og: outGain,
                channelCount,
                blockSize,
                sampleRate
            } = parameters;
        
            const dt_half = 0.5 * (48000 / sampleRate);
        
            const dstMixRatio = dstMix * 0.01;
            const coneMixRatio = coneMix * 0.01;
            const gainLinear = 10**(outGain * 0.05);
            const invSpkMass = 1.0 / spkMass;
            const dstBiasTerm = Math.tanh(dstDrive * dstBias);
        
            if (!context.initialized || context.channelCount !== channelCount) {
                context.xpos = new Float32Array(channelCount);
                context.vel = new Float32Array(channelCount);
                context.channelCount = channelCount;
                context.initialized = true;
            }
        
            const xpos = context.xpos;
            const vel = context.vel;
        
            for (let ch = 0; ch < channelCount; ch++) {
                const offset = ch * blockSize;
                let x = xpos[ch];
                let v = vel[ch];
        
                for (let i = 0; i < blockSize; i++) {
                    const dataIndex = offset + i;
                    const inputSample = data[dataIndex];
        
                    const a = (spkDrive * inputSample - spkStiff * x - spkDamp * v) * invSpkMass;
                    const vHalf = v + a * dt_half;
        
                    const xNew = x + vHalf * (48000 / sampleRate);
        
                    const aNew = (spkDrive * inputSample - spkStiff * xNew - spkDamp * vHalf) * invSpkMass;
                    const vNew = vHalf + aNew * dt_half;
        
                    x = xNew;
                    v = vNew;
        
                    const wetDist = Math.tanh(dstDrive * (x + dstBias)) - dstBiasTerm;
                    const xNl = x + dstMixRatio * (wetDist - x);
                    const coneDelta = (xNl - x) * coneMixRatio;
        
                    let outputSample = inputSample + coneDelta;
                    outputSample *= gainLinear;
        
                    data[dataIndex] = outputSample;
                }
                xpos[ch] = x;
                vel[ch] = v;
            }
        
            return data;
        `);
    }

    setParameters(params) {
        let graphNeedsUpdate = false;
        if (params.sd !== undefined) {
            this.sd = Math.max(0, Math.min(10, params.sd));
        }
        if (params.ss !== undefined) {
            this.ss = Math.max(0, Math.min(10, params.ss));
        }
        if (params.sp !== undefined) {
            this.sp = Math.max(0, Math.min(10, params.sp));
        }
        if (params.sm !== undefined) {
            this.sm = Math.max(0.1, Math.min(5, params.sm));
        }
        if (params.dd !== undefined) {
            this.dd = Math.max(0, Math.min(10, params.dd));
            graphNeedsUpdate = true;
        }
        if (params.db !== undefined) {
            this.db = Math.max(-1, Math.min(1, params.db));
            graphNeedsUpdate = true;
        }
        if (params.dm !== undefined) {
            this.dm = Math.max(0, Math.min(100, params.dm));
            graphNeedsUpdate = true;
        }
        if (params.cm !== undefined) {
            this.cm = Math.max(0, Math.min(100, params.cm));
        }
        if (params.og !== undefined) {
            this.og = Math.max(-18, Math.min(18, params.og));
        }
        if (params.enabled !== undefined) {
            this.enabled = params.enabled;
        }
        this.updateParameters();
        if (graphNeedsUpdate) {
            this.updateTransferGraph();
        }
    }

    // Individual parameter setters
    setSd(value) { this.setParameters({ sd: value }); }
    setSs(value) { this.setParameters({ ss: value }); }
    setSp(value) { this.setParameters({ sp: value }); }
    setSm(value) { this.setParameters({ sm: value }); }
    setDd(value) { this.setParameters({ dd: value }); }
    setDb(value) { this.setParameters({ db: value }); }
    setDm(value) { this.setParameters({ dm: value }); }
    setCm(value) { this.setParameters({ cm: value }); }
    setOg(value) { this.setParameters({ og: value }); }

    getParameters() {
        return {
            type: this.constructor.name,
            sd: this.sd,
            ss: this.ss,
            sp: this.sp,
            sm: this.sm,
            dd: this.dd,
            db: this.db,
            dm: this.dm,
            cm: this.cm,
            og: this.og,
            enabled: this.enabled
        };
    }

    updateTransferGraph() {
        const canvas = this.canvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += width / 4) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += height / 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('in', width / 2, height - 5);
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('out', 0, 0);
        ctx.restore();
        ctx.fillStyle = '#666';
        ctx.font = '20px Arial';
        ctx.fillText('-6dB', width * 0.25, height - 5);
        ctx.fillText('-6dB', width * 0.75, height - 5);
        ctx.save();
        ctx.translate(20, height * 0.25);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('-6dB', 0, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(20, height * 0.75);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('-6dB', 0, 0);
        ctx.restore();
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const mixRatio = this.dm / 100;
        
        for (let i = 0; i < width; i++) {
            const x = (i / width) * 2 - 1;
            const wet = Math.tanh(this.dd * (x + this.db)) - Math.tanh(this.dd * this.db);
            const y = (1 - mixRatio) * x + mixRatio * wet;
            const canvasY = ((1 - y) / 2) * height;
            
            if (i === 0) {
                ctx.moveTo(i, canvasY);
            } else {
                ctx.lineTo(i, canvasY);
            }
        }
        ctx.stroke();
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'dynamic-saturation-plugin-ui plugin-parameter-ui';

        // Use base helper to create controls
        container.appendChild(this.createParameterControl(
            'Speaker Damping', 0.1, 2.0, 0.01, this.sd,
            this.setSd.bind(this)
        ));
        container.appendChild(this.createParameterControl(
            'Speaker Stiffness', 1, 10000, 1, this.ss,
            this.setSs.bind(this)
        ));
        container.appendChild(this.createParameterControl(
            'Speaker Position', -1, 1, 0.02, this.sp,
            this.setSp.bind(this)
        ));
        container.appendChild(this.createParameterControl(
            'Speaker Mass', 0.001, 0.1, 0.001, this.sm,
            this.setSm.bind(this)
        ));
        container.appendChild(this.createParameterControl(
            'Distortion Drive', 0, 1, 0.01, this.dd,
            this.setDd.bind(this)
        ));
        container.appendChild(this.createParameterControl(
            'Distortion Bias', -1, 1, 0.02, this.db,
            this.setDb.bind(this)
        ));
        container.appendChild(this.createParameterControl(
            'Distortion Mix', 0, 100, 1, this.dm,
            this.setDm.bind(this), '%'
        ));

        // Graph container for canvas and labels
        const graphContainer = document.createElement('div');
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        canvas.style.width = '100%';
        canvas.style.height = '200px';
        canvas.style.backgroundColor = '#222';
        this.canvas = canvas;
        this.updateTransferGraph(); // Initial graph draw
        graphContainer.appendChild(canvas);
        container.appendChild(graphContainer);

        // Cone Motion Mix control
        container.appendChild(this.createParameterControl(
            'Cone Motion Mix', 0, 100, 1, this.cm,
            this.setCm.bind(this), '%'
        ));

        // Output Gain control
        container.appendChild(this.createParameterControl(
            'Output Gain', -18, 18, 0.1, this.og,
            this.setOg.bind(this), 'dB'
        ));

        return container;
    }
}

// Register the plugin globally
window.DynamicSaturationPlugin = DynamicSaturationPlugin; 