class HumGeneratorPlugin extends PluginBase {
    constructor() {
        super('Hum Generator', 'High-precision power hum noise generator');
        
        // Parameters - using the specification's naming
        this.fr = 50.0;      // Frequency (Hz) - 10-120 Hz
        this.tp = 'Standard'; // Type - Standard, Rich, Dirty
        this.hm = 50;        // Harmonics (%) - 0-100%
        this.tn = 10.0;      // Tone (kHz) - 1.0-20.0 kHz
        this.in = 1.0;       // Instability (%) - 0-10%
        this.lv = -40.0;     // Level (dB) - -80 to 0 dB

        this.registerProcessor(`
            if (!parameters.enabled) return data;

            const { channelCount, blockSize, sampleRate } = parameters;
            const { fr, tp, hm, tn, in: instability, lv } = parameters;
            
            if (channelCount === 0 || sampleRate <= 0) {
                return data;
            }

            // Initialize context
            if (!context.initialized || context.lastChannelCount !== channelCount) {
                // LFO states for instability
                context.lfoPhase1 = 0.0;
                context.lfoPhase2 = 0.0;
                
                // Oscillator state
                context.oscillatorPhase = 0.0;
                
                // Harmonic shaper states (for comb filter)
                context.delayBuffers = Array.from({ length: channelCount }, () => new Float32Array(Math.ceil(sampleRate / 20))); // Max delay for 20Hz
                context.delayPositions = new Array(channelCount).fill(0);
                
                // Filter states for each channel
                context.harmonicFilterStates = Array.from({ length: channelCount }, () => ({ x1: 0, x2: 0, y1: 0, y2: 0 }));
                context.toneFilterStates = Array.from({ length: channelCount }, () => ({ x1: 0, x2: 0, y1: 0, y2: 0 }));
                
                context.lastChannelCount = channelCount;
                context.initialized = true;
            }

            // LFO frequencies for instability (using two LFOs at different rates)
            const lfo1Freq = 0.3; // 0.3 Hz
            const lfo2Freq = 0.7; // 0.7 Hz
            const lfo1Inc = 2.0 * Math.PI * lfo1Freq / sampleRate;
            const lfo2Inc = 2.0 * Math.PI * lfo2Freq / sampleRate;
            
            // Biquad filter coefficient calculation helpers
            function calculateLowpassCoeffs(f0, Q, sr) {
                const w0 = 2 * Math.PI * f0 / sr;
                const cosW0 = Math.cos(w0);
                const alpha = Math.sin(w0) / (2 * Q);
                const a0Inv = 1 / (1 + alpha);
                
                return {
                    b0: (1 - cosW0) / 2 * a0Inv,
                    b1: (1 - cosW0) * a0Inv,
                    b2: (1 - cosW0) / 2 * a0Inv,
                    a1: -2 * cosW0 * a0Inv,
                    a2: (1 - alpha) * a0Inv
                };
            }
            
            function processBiquad(input, state, coeffs) {
                const output = coeffs.b0 * input + coeffs.b1 * state.x1 + coeffs.b2 * state.x2 
                             - coeffs.a1 * state.y1 - coeffs.a2 * state.y2;
                
                // Add denormal offset
                const denormalizedOutput = output + 1.0e-25;
                
                // Clamp to prevent instability
                const clampedOutput = Math.max(-10.0, Math.min(10.0, denormalizedOutput));
                
                // Update states
                state.x2 = state.x1;
                state.x1 = input;
                state.y2 = state.y1;
                state.y1 = clampedOutput;
                
                return clampedOutput;
            }

            // Calculate filter coefficients
            const harmonicsCutoff = 200 + Math.pow(hm / 100, 2) * 10000; // 200Hz to 10200Hz
            const harmonicsCoeffs = calculateLowpassCoeffs(harmonicsCutoff, 0.707, sampleRate);
            
            const toneCutoff = tn * 1000; // Convert kHz to Hz
            const toneCoeffs = calculateLowpassCoeffs(toneCutoff, 1.0, sampleRate);
            
            // Final gain from Level parameter
            const finalGain = Math.pow(10, lv / 20);
            
            // Comb filter delay for harmonic shaping (Standard type only)
            const combDelayTime = tp === 'Standard' ? 1 / (2 * fr) : 0; // Half period delay
            const combDelaySamples = Math.floor(combDelayTime * sampleRate);
            
            for (let i = 0; i < blockSize; i++) {
                // Update LFO phases
                context.lfoPhase1 += lfo1Inc;
                context.lfoPhase2 += lfo2Inc;
                if (context.lfoPhase1 >= 2 * Math.PI) context.lfoPhase1 -= 2 * Math.PI;
                if (context.lfoPhase2 >= 2 * Math.PI) context.lfoPhase2 -= 2 * Math.PI;
                
                // Calculate LFO values for instability
                const lfo1 = Math.sin(context.lfoPhase1);
                const lfo2 = Math.sin(context.lfoPhase2);
                const combinedLfo = (lfo1 + lfo2) * 0.5;
                
                // Apply frequency modulation (instability)
                const instabilityAmount = instability / 100.0;
                const modulatedFreq = fr * (1 + combinedLfo * instabilityAmount * 0.02); // Max ±2% frequency deviation
                
                // Generate oscillator (sawtooth wave)
                const phaseInc = 2 * Math.PI * modulatedFreq / sampleRate;
                context.oscillatorPhase += phaseInc;
                if (context.oscillatorPhase >= 2 * Math.PI) context.oscillatorPhase -= 2 * Math.PI;
                
                // Generate sawtooth wave
                let oscillatorOutput = (context.oscillatorPhase / Math.PI) - 1; // -1 to 1 sawtooth
                
                // Process each channel
                for (let ch = 0; ch < channelCount; ch++) {
                    let wetSignal = oscillatorOutput;
                    
                    // 2. Harmonic Shaper (Type)
                    if (tp === 'Standard') {
                        // Comb filter to remove even harmonics
                        const delayBuffer = context.delayBuffers[ch];
                        const delayPos = context.delayPositions[ch];
                        
                        if (combDelaySamples > 0 && combDelaySamples < delayBuffer.length) {
                            const delayedSample = delayBuffer[delayPos];
                            delayBuffer[delayPos] = wetSignal;
                            context.delayPositions[ch] = (delayPos + 1) % delayBuffer.length;
                            
                            // Mix with inverted delayed signal
                            wetSignal = (wetSignal - delayedSample) * 0.5;
                        }
                    }
                    // Rich and Dirty types: no processing (pass through)
                    
                    // 3. Harmonic Dampener (Harmonics)
                    wetSignal = processBiquad(wetSignal, context.harmonicFilterStates[ch], harmonicsCoeffs);
                    
                    // 4. Distortion (Type: Dirty)
                    if (tp === 'Dirty') {
                        const drive = 1.0 + (hm / 100.0 * 3.0);
                        wetSignal = Math.tanh(wetSignal * drive);
                    }
                    
                    // 5. Tone Control
                    wetSignal = processBiquad(wetSignal, context.toneFilterStates[ch], toneCoeffs);
                    
                    // 6. Amplitude & Mixing
                    // Apply amplitude modulation (instability)
                    const amplitudeModulation = 1 + combinedLfo * instabilityAmount * 0.1; // Max ±10% amplitude variation
                    wetSignal *= amplitudeModulation;
                    
                    // Apply final gain
                    wetSignal *= finalGain;
                    
                    // Mix with dry signal
                    const sampleIndex = ch * blockSize + i;
                    data[sampleIndex] += wetSignal;
                }
            }
            
            return data;
        `);
    }

    getParameters() {
        return {
            type: this.constructor.name,
            fr: this.fr,
            tp: this.tp,
            hm: this.hm,
            tn: this.tn,
            in: this.in,
            lv: this.lv,
            enabled: this.enabled
        };
    }

    setParameters(params) {
        if (params.fr !== undefined) {
            const value = parseFloat(params.fr);
            if (!isNaN(value)) {
                this.fr = Math.max(10.0, Math.min(120.0, value));
            }
        }
        if (params.tp !== undefined) {
            if (['Standard', 'Rich', 'Dirty'].includes(params.tp)) {
                this.tp = params.tp;
            }
        }
        if (params.hm !== undefined) {
            const value = parseInt(params.hm, 10);
            if (!isNaN(value)) {
                this.hm = Math.max(0, Math.min(100, value));
            }
        }
        if (params.tn !== undefined) {
            const value = parseFloat(params.tn);
            if (!isNaN(value)) {
                this.tn = Math.max(1.0, Math.min(20.0, value));
            }
        }
        if (params.in !== undefined) {
            const value = parseFloat(params.in);
            if (!isNaN(value)) {
                this.in = Math.max(0.0, Math.min(10.0, value));
            }
        }
        if (params.lv !== undefined) {
            const value = parseFloat(params.lv);
            if (!isNaN(value)) {
                this.lv = Math.max(-80.0, Math.min(0.0, value));
            }
        }
        this.updateParameters();
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'hum-generator-plugin-ui plugin-parameter-ui';

        // Frequency control
        container.appendChild(this.createParameterControl(
            'Frequency', 10.0, 120.0, 0.1, this.fr,
            (value) => this.setParameters({ fr: value }), 'Hz'
        ));

        // Type selection (radio buttons)
        const typeRow = document.createElement('div');
        typeRow.className = 'parameter-row';
        const typeLabel = document.createElement('label');
        typeLabel.textContent = 'Type:';
        typeRow.appendChild(typeLabel);

        const typeGroup = document.createElement('div');
        typeGroup.className = 'radio-group';
        
        ['Standard', 'Rich', 'Dirty'].forEach(type => {
            const radioId = `${this.id}-${this.name}-type-${type}`;
            const radioLabel = document.createElement('label');
            radioLabel.htmlFor = radioId;
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.id = radioId;
            radio.name = `${this.id}-${this.name}-type`;
            radio.value = type;
            radio.checked = this.tp === type;
            radio.autocomplete = 'off';
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.setParameters({ tp: type });
                }
            });
            
            radioLabel.appendChild(radio);
            radioLabel.appendChild(document.createTextNode(type));
            typeGroup.appendChild(radioLabel);
        });
        
        typeRow.appendChild(typeGroup);
        container.appendChild(typeRow);

        // Harmonics control
        container.appendChild(this.createParameterControl(
            'Harmonics', 0, 100, 1, this.hm,
            (value) => this.setParameters({ hm: value }), '%'
        ));

        // Tone control
        container.appendChild(this.createParameterControl(
            'Tone', 1.0, 20.0, 0.1, this.tn,
            (value) => this.setParameters({ tn: value }), 'kHz'
        ));

        // Instability control
        container.appendChild(this.createParameterControl(
            'Instability', 0.0, 10.0, 0.1, this.in,
            (value) => this.setParameters({ in: value }), '%'
        ));

        // Level control
        container.appendChild(this.createParameterControl(
            'Level', -80.0, 0.0, 0.1, this.lv,
            (value) => this.setParameters({ lv: value }), 'dB'
        ));

        return container;
    }
}

// Register plugin
window.HumGeneratorPlugin = HumGeneratorPlugin;