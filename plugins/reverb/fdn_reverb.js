class FDNReverbPlugin extends PluginBase {
    constructor() {
        super('FDN Reverb', 'Feedback Delay Network reverb with Hadamard matrix');

        // Initialize parameters with defaults (using shortened names for external storage)
        this.rt = 1.20;   // rt: Reverb Time (0.20-10.00s)
        this.dt = 8;      // dt: Density (4-8 lines)
        this.pd = 10.0;   // pd: Pre Delay (0.0-100.0ms)
        this.bd = 20.0;   // bd: Base Delay (10.0-60.0ms)
        this.ds = 5.0;    // ds: Delay Spread (0.0-25.0ms)
        this.hd = 6.0;    // hd: HF Damp (0.0-12.0dB/s)
        this.lc = 100;    // lc: Low Cut (20-500Hz)
        this.md = 3.0;    // md: Mod Depth (0.0-10.0ct)
        this.mr = 0.30;   // mr: Mod Rate (0.10-5.00Hz)
        this.df = 100;    // df: Diffusion (0-100%)
        this.wm = 30;     // wm: Wet Mix (0-100%)
        this.dm = 100;    // dm: Dry Mix (0-100%)
        this.sw = 100;    // sw: Stereo Width (0-200%)

        // Register processor function
        this.registerProcessor(`
            // Skip processing if disabled
            if (!parameters.enabled) return data;

            const channelCount = parameters.channelCount;
            const blockSize = parameters.blockSize;
            const sampleRate = parameters.sampleRate;
            
            const TWO_PI = 6.283185307179586; // 2 * Math.PI

            // Cache parameters locally for minor potential performance gain and readability
            const p_rt = parameters.rt;
            const p_dt = parameters.dt; // Already an integer due to setParameters
            const p_pd = parameters.pd;
            const p_bd = parameters.bd;
            const p_ds = parameters.ds;
            const p_hd = parameters.hd;
            const p_lc = parameters.lc; // Already an integer
            const p_md = parameters.md;
            const p_mr = parameters.mr;
            const p_df = parameters.df; // Already an integer
            const p_wm = parameters.wm; // Already an integer
            const p_dm = parameters.dm; // Already an integer
            const p_sw = parameters.sw; // Already an integer

            if (!context.initialized || context.sampleRate !== sampleRate) {
                context.sampleRate = sampleRate;
                context.hadamard = [
                    [1, 1, 1, 1, 1, 1, 1, 1], [1, -1, 1, -1, 1, -1, 1, -1],
                    [1, 1, -1, -1, 1, 1, -1, -1], [1, -1, -1, 1, 1, -1, -1, 1],
                    [1, 1, 1, 1, -1, -1, -1, -1], [1, -1, 1, -1, -1, 1, -1, 1],
                    [1, 1, -1, -1, -1, -1, 1, 1], [1, -1, -1, 1, -1, 1, 1, -1]
                ];
                context.delayLines = new Array(8); // Max density
                context.delayPositions = new Uint32Array(8);
                context.lfoPhases = new Float32Array(8);
                context.lfoOffsets = new Float32Array(8);
                context.lpfStates = new Float32Array(8).fill(0.0);
                context.hpfStates = new Float32Array(8).fill(0.0);
                context.delayTimeRandomOffsetsMs = new Float32Array(8);
                const MAX_RANDOM_DELAY_OFFSET_MS = 3.0;
                for (let k = 0; k < 8; k++) {
                    context.delayTimeRandomOffsetsMs[k] = (Math.random() - 0.5) * 2.0 * MAX_RANDOM_DELAY_OFFSET_MS;
                }
                const maxDelayTimeSeconds = 0.175; 
                const maxDelaySamplesPerLine = Math.ceil(sampleRate * maxDelayTimeSeconds); 
                for (let i = 0; i < 8; i++) {
                    context.delayLines[i] = new Float32Array(maxDelaySamplesPerLine).fill(0.0);
                    context.lfoPhases[i] = Math.random() * TWO_PI;
                    context.lfoOffsets[i] = (i * TWO_PI) / 8.0;
                }
                context.initialized = true;
            }

            if (!context.preDelayBuffer || context.preDelayBuffer.length !== channelCount) {
                const maxPreDelaySamples = Math.ceil(sampleRate * 0.1); // Max pre-delay is 100ms
                context.preDelayBuffer = new Array(channelCount);
                for (let ch = 0; ch < channelCount; ch++) {
                    context.preDelayBuffer[ch] = {
                        buffer: new Float32Array(maxPreDelaySamples).fill(0.0),
                        pos: 0
                    };
                }
            }

            const preDelaySamples = (p_pd * sampleRate * 0.001) | 0; // ms to samples, floor
            const baseDelaySamplesParam = p_bd * sampleRate * 0.001; // ms to samples
            const spreadSamplesParam = p_ds * sampleRate * 0.001;   // ms to samples
            const densityLines = p_dt; 
            const diffusionAmount = p_df * 0.01; 

            const modDepthAsFraction = Math.pow(2.0, p_md / 1200.0) - 1.0; 
            const modRateHz = p_mr;            
            const reverbTimeSeconds = p_rt;

            // HF Damp LPF Coefficient Calculation
            const HF_DAMP_UI_MAX = 12.0;
            const HF_DAMP_FC_AT_UI_MIN = 20000.0; 
            const HF_DAMP_FC_AT_UI_MAX = 500.0;  
            
            let temp_hd_norm = p_hd / HF_DAMP_UI_MAX;
            // Clamp hfDampNormalized to [0.0, 1.0]
            const hfDampNormalized = temp_hd_norm < 0.0 ? 0.0 : (temp_hd_norm > 1.0 ? 1.0 : temp_hd_norm);
            const hfDampCutoffHz = HF_DAMP_FC_AT_UI_MIN * Math.pow(HF_DAMP_FC_AT_UI_MAX / HF_DAMP_FC_AT_UI_MIN, hfDampNormalized);
            
            let lpfAlphaForHfDamp = 0.0; 
            if (sampleRate > 0.00001) { // Check sampleRate to avoid division by zero or tiny numbers
                if (hfDampCutoffHz <= 1.0) { 
                    const cutoff_val = hfDampCutoffHz < 0.1 ? 0.1 : hfDampCutoffHz; // Equivalent to Math.max(0.1, hfDampCutoffHz)
                    const expVal = Math.exp(-TWO_PI * cutoff_val / sampleRate);
                    lpfAlphaForHfDamp = expVal > 0.99999 ? 0.99999 : expVal; // Equivalent to Math.min(0.99999, expVal)
                } else if (hfDampCutoffHz < sampleRate * 0.495) {
                    const expVal = Math.exp(-TWO_PI * hfDampCutoffHz / sampleRate);
                    // Clamp expVal to [0.000001, 0.99999]
                    lpfAlphaForHfDamp = expVal < 0.000001 ? 0.000001 : (expVal > 0.99999 ? 0.99999 : expVal);
                }
            }
            
            // Low Cut HPF Coefficient Calculation
            const lowCutHz = p_lc; 
            let hpfAlphaForLowCut = 0.0; 
            let apply_hpf = false;
            if (lowCutHz > 1.0 && sampleRate > 0.00001) {
                const expVal = Math.exp(-TWO_PI * lowCutHz / sampleRate);
                // Clamp expVal to [0.0, 0.99999]
                hpfAlphaForLowCut = expVal < 0.0 ? 0.0 : (expVal > 0.99999 ? 0.99999 : expVal);
                apply_hpf = true;
            }

            const wetMix = p_wm * 0.01;
            const dryMix = p_dm * 0.01;
            const stereoWidthParam = p_sw * 0.01; 

            // Manage context-cached arrays for unmodulated delay times and feedback gains.
            // These are calculated per block if dependencies change.
            if (!context.unmodulatedDelayTimesSamples_block || context.unmodulatedDelayTimesSamples_block.length !== densityLines) {
                context.unmodulatedDelayTimesSamples_block = new Float32Array(densityLines);
            }
            const unmodulatedDelayTimesSamples = context.unmodulatedDelayTimesSamples_block;
            
            if (!context.feedbackGains_block || context.feedbackGains_block.length !== densityLines) {
                context.feedbackGains_block = new Float32Array(densityLines);
            }
            const feedbackGains = context.feedbackGains_block;
            
            for (let k = 0; k < densityLines; k++) { // Use 'k' to avoid confusion with outer loop 'i'
                let deterministicLineDelay = baseDelaySamplesParam;
                if (densityLines > 1) { // Avoid division by zero if densityLines is 1 (min is 4 here)
                    const linearRatio = k / (densityLines - 1.0); 
                    const spreadFactor = Math.pow(linearRatio, 0.8); 
                    deterministicLineDelay += (spreadSamplesParam * spreadFactor);
                }
                const randomOffsetSamples = context.delayTimeRandomOffsetsMs[k] * sampleRate * 0.001;
                let lineDelayWithRandomness = deterministicLineDelay + randomOffsetSamples;
                unmodulatedDelayTimesSamples[k] = lineDelayWithRandomness < 1.0 ? 1.0 : lineDelayWithRandomness;
            }
            
            const FEEDBACK_GAIN_CLAMP = 0.99999; 
            for (let k = 0; k < densityLines; k++) { // Use 'k'
                const currentUnmodulatedDelaySamples = unmodulatedDelayTimesSamples[k];
                let edlfg_floor = currentUnmodulatedDelaySamples | 0; // floor for positive numbers
                let effectiveDelayLengthForGain = edlfg_floor < 1 ? 1 : edlfg_floor;

                if (reverbTimeSeconds > 0.001 && sampleRate > 0.00001 && effectiveDelayLengthForGain > 0) {
                    feedbackGains[k] = Math.pow(0.001, effectiveDelayLengthForGain / (sampleRate * reverbTimeSeconds));
                } else {
                    feedbackGains[k] = 0.0; 
                }
                let fg_val = feedbackGains[k];
                feedbackGains[k] = fg_val < -FEEDBACK_GAIN_CLAMP ? -FEEDBACK_GAIN_CLAMP : (fg_val > FEEDBACK_GAIN_CLAMP ? FEEDBACK_GAIN_CLAMP : fg_val);
            }
                        
            const lfoIncrement = (sampleRate > 0.00001) ? (TWO_PI * modRateHz / sampleRate) : 0.0;

            const invSqrtDensity = (densityLines > 0) ? (1.0 / Math.sqrt(densityLines)) : 1.0;

            const lTapActualCount = (densityLines + 1) / 2 | 0; 
            const rTapActualCount = densityLines / 2 | 0;     
            const invSqrtLTapCount = (lTapActualCount > 0) ? (1.0 / Math.sqrt(lTapActualCount)) : 0.0;
            const invSqrtRTapCount = (rTapActualCount > 0) ? (1.0 / Math.sqrt(rTapActualCount)) : 0.0;
            
            // Allocate/resize FDN processing arrays in context if densityLines changed
            if (!context.fdnOutputs_block_cache || context.fdnOutputs_block_cache.length !== densityLines) {
                context.fdnOutputs_block_cache = new Float32Array(densityLines);
                context.hadamardMixingOutput_block_cache = new Float32Array(densityLines);
            }
            // Use these context-cached arrays within the sample loop
            const fdnOutputs_currentSample = context.fdnOutputs_block_cache;
            const hadamardMixingOutput_currentSample = context.hadamardMixingOutput_block_cache;


            for (let i = 0; i < blockSize; i++) { 
                // Update LFO phases for all 8 potential lines
                for (let lineIdx = 0; lineIdx < 8; lineIdx++) { 
                    context.lfoPhases[lineIdx] += lfoIncrement;
                    if (context.lfoPhases[lineIdx] >= TWO_PI) {
                        context.lfoPhases[lineIdx] -= TWO_PI;
                    }
                }
                
                for (let ch = 0; ch < channelCount; ch++) {
                    const channelGlobalOffset = ch * blockSize + i; 
                    const currentInputSample = data[channelGlobalOffset];
                    
                    const preDelayLine = context.preDelayBuffer[ch];
                    const preDelayBuffer = preDelayLine.buffer;
                    const preDelayBufferLength = preDelayBuffer.length;
                    let fdnTankInput; 
            
                    if (preDelaySamples > 0 && preDelayBufferLength > 0) {
                        const readPos = (preDelayLine.pos - preDelaySamples + preDelayBufferLength) % preDelayBufferLength;
                        fdnTankInput = preDelayBuffer[readPos];
                    } else {
                        fdnTankInput = currentInputSample; 
                    }
                    preDelayBuffer[preDelayLine.pos] = currentInputSample; 
                    preDelayLine.pos = (preDelayLine.pos + 1) % preDelayBufferLength;
                    
                    // FDN read stage
                    for (let line = 0; line < densityLines; line++) {
                        const delayLineBuffer = context.delayLines[line];
                        const allocatedBufferLength = delayLineBuffer.length; 
                        const writePos = context.delayPositions[line]; 
                        
                        const lfoValue = Math.sin(context.lfoPhases[line] + context.lfoOffsets[line]);
                        const baseDelayForLine = unmodulatedDelayTimesSamples[line]; 
                        const modulatedDelay = baseDelayForLine * (1.0 + modDepthAsFraction * lfoValue);
                        
                        let localClampedDelay = modulatedDelay < 0.0 ? 0.0 : modulatedDelay;
                        const upperClampLimit = allocatedBufferLength - 1.00001; 
                        localClampedDelay = localClampedDelay > upperClampLimit ? upperClampLimit : localClampedDelay;
                        const readPosFloat = localClampedDelay;

                        const readPosInt = readPosFloat | 0; // floor for positive numbers
                        const fraction = readPosFloat - readPosInt;
                        
                        // Original modulo logic is robust for positive results
                        const idx0 = (writePos - 1 - readPosInt + allocatedBufferLength) % allocatedBufferLength;
                        const idx1 = (writePos - 1 - (readPosInt + 1) + allocatedBufferLength) % allocatedBufferLength; 
                                                
                        const sample0 = delayLineBuffer[idx0];
                        const sample1 = delayLineBuffer[idx1];
                        fdnOutputs_currentSample[line] = sample0 + (sample1 - sample0) * fraction; // Optimized lerp
                    }
                    
                    // Hadamard mixing stage using fast transform when possible
                    if (densityLines === 4) {
                        const x0 = fdnOutputs_currentSample[0];
                        const x1 = fdnOutputs_currentSample[1];
                        const x2 = fdnOutputs_currentSample[2];
                        const x3 = fdnOutputs_currentSample[3];
                        const a0 = x0 + x1;
                        const a1 = x0 - x1;
                        const a2 = x2 + x3;
                        const a3 = x2 - x3;
                        hadamardMixingOutput_currentSample[0] = (a0 + a2) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[1] = (a1 + a3) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[2] = (a0 - a2) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[3] = (a1 - a3) * invSqrtDensity * diffusionAmount;
                    } else if (densityLines === 8) {
                        const x0 = fdnOutputs_currentSample[0];
                        const x1 = fdnOutputs_currentSample[1];
                        const x2 = fdnOutputs_currentSample[2];
                        const x3 = fdnOutputs_currentSample[3];
                        const x4 = fdnOutputs_currentSample[4];
                        const x5 = fdnOutputs_currentSample[5];
                        const x6 = fdnOutputs_currentSample[6];
                        const x7 = fdnOutputs_currentSample[7];
                        const a0 = x0 + x1;
                        const a1 = x0 - x1;
                        const a2 = x2 + x3;
                        const a3 = x2 - x3;
                        const a4 = x4 + x5;
                        const a5 = x4 - x5;
                        const a6 = x6 + x7;
                        const a7 = x6 - x7;
                        const b0 = a0 + a2;
                        const b1 = a1 + a3;
                        const b2 = a0 - a2;
                        const b3 = a1 - a3;
                        const b4 = a4 + a6;
                        const b5 = a5 + a7;
                        const b6 = a4 - a6;
                        const b7 = a5 - a7;
                        hadamardMixingOutput_currentSample[0] = (b0 + b4) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[1] = (b1 + b5) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[2] = (b2 + b6) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[3] = (b3 + b7) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[4] = (b0 - b4) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[5] = (b1 - b5) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[6] = (b2 - b6) * invSqrtDensity * diffusionAmount;
                        hadamardMixingOutput_currentSample[7] = (b3 - b7) * invSqrtDensity * diffusionAmount;
                    } else {
                        for (let row = 0; row < densityLines; row++) {
                            let sum = 0.0;
                            const hadamardRow = context.hadamard[row];
                            for (let col = 0; col < densityLines; col++) {
                                sum += hadamardRow[col] * fdnOutputs_currentSample[col];
                            }
                            hadamardMixingOutput_currentSample[row] = (sum * invSqrtDensity) * diffusionAmount;
                        }
                    }
                    
                    // FDN write stage (feedback, filtering, writing to delay lines)
                    for (let line = 0; line < densityLines; line++) {
                        const delayLineBuffer = context.delayLines[line];
                        const allocatedBufferLength = delayLineBuffer.length;
                        const writePos = context.delayPositions[line];
                        let signalToFilter = fdnTankInput + hadamardMixingOutput_currentSample[line] * feedbackGains[line];
                        
                        if (p_hd > 0.01 && lpfAlphaForHfDamp > 0.000001 && lpfAlphaForHfDamp < 0.999999) { 
                            context.lpfStates[line] = (1.0 - lpfAlphaForHfDamp) * signalToFilter + lpfAlphaForHfDamp * context.lpfStates[line];
                            signalToFilter = context.lpfStates[line];
                        }
                        
                        if (apply_hpf) { 
                            const inputToHpf = signalToFilter;
                            const lpfComponentForHpf = (1.0 - hpfAlphaForLowCut) * inputToHpf + hpfAlphaForLowCut * context.hpfStates[line];
                            signalToFilter = inputToHpf - lpfComponentForHpf; 
                            context.hpfStates[line] = lpfComponentForHpf; 
                        }
                        
                        delayLineBuffer[writePos] = signalToFilter;
                        context.delayPositions[line] = (writePos + 1) % allocatedBufferLength;
                    }
                    
                    // Output tapping and mixing
                    let lTapSum = 0.0;
                    let rTapSum = 0.0;
                    for (let line = 0; line < densityLines; line++) {
                        if (line % 2 === 0) { 
                            lTapSum += fdnOutputs_currentSample[line]; 
                        } else { 
                            rTapSum += fdnOutputs_currentSample[line];
                        }
                    }

                    const lTapWet = lTapSum * invSqrtLTapCount; // invSqrtLTapCount will be 0.0 if lTapActualCount is 0, making lTapWet 0.0
                    const rTapWet = rTapSum * invSqrtRTapCount; // Same for rTapWet
                    
                    let wetSignalForThisChannel = 0.0;
                    if (channelCount === 1) { 
                        wetSignalForThisChannel = (lTapWet + rTapWet) * 0.5; 
                    } else { 
                        const monoMixComponent = (lTapWet + rTapWet) * 0.5;
                        let temp_m_s_factor = stereoWidthParam * 0.5; // stereoWidthParam is [0,2], so factor is [0,1]
                        // The original Math.max/min clamp for mixToStereoFactor is technically redundant if p_sw is correctly clamped [0,200].
                        // However, to preserve exact behavior including this (potentially redundant) clamp:
                        const mixToStereoFactor = temp_m_s_factor < 0.0 ? 0.0 : (temp_m_s_factor > 1.0 ? 1.0 : temp_m_s_factor);
                        
                        if (ch === 0) { // Left channel
                            wetSignalForThisChannel = monoMixComponent * (1.0 - mixToStereoFactor) + lTapWet * mixToStereoFactor;
                        } else { // Right channel (or any other subsequent channel)
                            wetSignalForThisChannel = monoMixComponent * (1.0 - mixToStereoFactor) + rTapWet * mixToStereoFactor;
                        }
                    }
                    data[channelGlobalOffset] = currentInputSample * dryMix + wetSignalForThisChannel * wetMix;
                } 
            } 
            return data;
        `);
    }

    // Get current parameters
    getParameters() {
        return {
            type: this.constructor.name,
            enabled: this.enabled,
            rt: this.rt,      // Reverb Time
            dt: this.dt,      // Density
            pd: this.pd,      // Pre Delay
            bd: this.bd,      // Base Delay
            ds: this.ds,      // Delay Spread
            hd: this.hd,      // HF Damp
            lc: this.lc,      // Low Cut
            md: this.md,      // Mod Depth
            mr: this.mr,      // Mod Rate
            df: this.df,      // Diffusion
            wm: this.wm,      // Wet Mix
            dm: this.dm,      // Dry Mix
            sw: this.sw       // Stereo Width
        };
    }

    // Set parameters with validation
    setParameters(params) {
        if (params.rt !== undefined) this.rt = Math.max(0.20, Math.min(10.00, Number(params.rt)));
        if (params.dt !== undefined) this.dt = Math.max(4, Math.min(8, Math.floor(Number(params.dt))));
        if (params.pd !== undefined) this.pd = Math.max(0.0, Math.min(100.0, Number(params.pd)));
        if (params.bd !== undefined) this.bd = Math.max(10.0, Math.min(60.0, Number(params.bd)));
        if (params.ds !== undefined) this.ds = Math.max(0.0, Math.min(25.0, Number(params.ds)));
        if (params.hd !== undefined) this.hd = Math.max(0.0, Math.min(12.0, Number(params.hd)));
        if (params.lc !== undefined) this.lc = Math.max(20, Math.min(500, Math.floor(Number(params.lc))));
        if (params.md !== undefined) this.md = Math.max(0.0, Math.min(10.0, Number(params.md)));
        if (params.mr !== undefined) this.mr = Math.max(0.10, Math.min(5.00, Number(params.mr)));
        if (params.df !== undefined) this.df = Math.max(0, Math.min(100, Math.floor(Number(params.df))));
        if (params.wm !== undefined) this.wm = Math.max(0, Math.min(100, Math.floor(Number(params.wm))));
        if (params.dm !== undefined) this.dm = Math.max(0, Math.min(100, Math.floor(Number(params.dm))));
        if (params.sw !== undefined) this.sw = Math.max(0, Math.min(200, Math.floor(Number(params.sw))));
        this.updateParameters();
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'plugin-parameter-ui';

        // Use the base class createParameterControl helper
        container.appendChild(this.createParameterControl('Reverb Time', 0.20, 10.00, 0.01, this.rt, (value) => this.setParameters({ rt: value }), 's'));
        container.appendChild(this.createParameterControl('Density', 4, 8, 1, this.dt, (value) => this.setParameters({ dt: value }), 'lines'));
        container.appendChild(this.createParameterControl('Pre Delay', 0.0, 100.0, 0.1, this.pd, (value) => this.setParameters({ pd: value }), 'ms'));
        container.appendChild(this.createParameterControl('Base Delay', 10.0, 60.0, 0.1, this.bd, (value) => this.setParameters({ bd: value }), 'ms'));
        container.appendChild(this.createParameterControl('Delay Spread', 0.0, 25.0, 0.1, this.ds, (value) => this.setParameters({ ds: value }), 'ms'));
        container.appendChild(this.createParameterControl('HF Damp', 0.0, 12.0, 0.1, this.hd, (value) => this.setParameters({ hd: value }), 'dB/s'));
        container.appendChild(this.createParameterControl('Low Cut', 20, 500, 1, this.lc, (value) => this.setParameters({ lc: value }), 'Hz'));
        container.appendChild(this.createParameterControl('Mod Depth', 0.0, 10, 0.1, this.md, (value) => this.setParameters({ md: value }), 'ct'));
        container.appendChild(this.createParameterControl('Mod Rate', 0.10, 5.00, 0.01, this.mr, (value) => this.setParameters({ mr: value }), 'Hz'));
        container.appendChild(this.createParameterControl('Diffusion', 0, 100, 1, this.df, (value) => this.setParameters({ df: value }), '%'));
        container.appendChild(this.createParameterControl('Wet Mix', 0, 100, 1, this.wm, (value) => this.setParameters({ wm: value }), '%'));
        container.appendChild(this.createParameterControl('Dry Mix', 0, 100, 1, this.dm, (value) => this.setParameters({ dm: value }), '%'));
        container.appendChild(this.createParameterControl('Stereo Width', 0, 200, 1, this.sw, (value) => this.setParameters({ sw: value }), '%'));

        return container;
    }
}

// Register the plugin globally
window.FDNReverbPlugin = FDNReverbPlugin;