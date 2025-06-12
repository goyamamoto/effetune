class LatencyMonitorPlugin extends PluginBase {
    constructor() {
        super('Latency Monitor', 'Monitors audio latency');
        this.inputLatency = null;
        this.processingLatency = null;
        this.outputLatency = null;
        this.displayIntervalId = null;
        this.processingSamples = [];
        // moving average of up to five samples from updates every three seconds
        this.maxProcessingSamples = 5;
        this.outputSamples = [];
        this.maxOutputSamples = 10; // average output latency over roughly thirty seconds
        this.processingListener = null;
        this.listenerAttached = false;
        this.displayElements = {};
        this.lastElementLag = null;
        this.lastAudioElement = null;
    }

    // Retrieve output latency using platform information when possible
    getOutputLatency(ctx, audioElement) {
        let latency = NaN;

        if (typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0) {
            latency = ctx.baseLatency;
        }

        if (typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0) {
            latency = !Number.isFinite(latency) || ctx.outputLatency > latency ? ctx.outputLatency : latency;
        }

        if (typeof ctx.getOutputTimestamp === 'function') {
            const ts = ctx.getOutputTimestamp();
            if (ts && ts.performanceTime != null && ts.contextTime != null) {
                const diff = ts.performanceTime / 1000 - ts.contextTime;
                if (Number.isFinite(diff) && diff > 0) {
                    latency = !Number.isFinite(latency) || diff > latency ? diff : latency;
                }
            }
        }

        if (audioElement !== this.lastAudioElement) {
            this.lastElementLag = null;
            this.lastAudioElement = audioElement;
        }

        let elementLag = NaN;
        if (audioElement && typeof audioElement.currentTime === 'number') {
            const diff = audioElement.currentTime - ctx.currentTime;
            if (Number.isFinite(diff) && diff > 0 && diff < 1) {
                elementLag = diff;
                this.lastElementLag = diff;
            }
        }
        if (!Number.isFinite(elementLag) && Number.isFinite(this.lastElementLag)) {
            elementLag = this.lastElementLag;
        }
        if (Number.isFinite(elementLag)) {
            latency = (Number.isFinite(latency) ? latency : 0) + elementLag;
        }
        return latency;
    }

    // Retrieve input latency if provided by browser APIs
    getInputLatency(ctx) {
        if (typeof ctx.inputLatency === 'number' && ctx.inputLatency > 0) {
            return ctx.inputLatency; // seconds
        }

        const track = window.audioManager?.ioManager?.stream?.getAudioTracks?.()[0];
        if (track && track.getSettings) {
            const settings = track.getSettings();
            if (typeof settings.latency === 'number' && settings.latency > 0) {
                return settings.latency; // seconds
            }
        }

        return NaN;
    }

    startMonitoring() {
        if (this.displayIntervalId) return;
        this.processingListener = (data) => {
            // data.processingTime is in microseconds
            this.processingSamples.push(data.processingTime);
            if (this.processingSamples.length > this.maxProcessingSamples) {
                this.processingSamples.shift();
            }
            const sum = this.processingSamples.reduce((a, b) => a + b, 0);
            this.processingLatency = sum / this.processingSamples.length;
        };

        this.listenerAttached = false;
        const attachListener = () => {
            if (!this.listenerAttached && window.audioManager) {
                window.audioManager.addEventListener('processingLatency', this.processingListener);
                this.listenerAttached = true;
            }
        };
        attachListener();

        this.displayIntervalId = setInterval(() => {
            attachListener();
            const ctx = window.audioContext;
            const audioEl = window.audioManager?.ioManager?.audioElement;
            if (audioEl !== this.lastAudioElement) {
                this.lastElementLag = null;
                this.lastAudioElement = audioEl;
            }
            if (ctx) {
                const outputLatency = this.getOutputLatency(ctx, audioEl);
                if (Number.isFinite(outputLatency) && outputLatency > 0) {
                    const outputUs = outputLatency * 1e6;
                    this.outputSamples.push(outputUs);
                    if (this.outputSamples.length > this.maxOutputSamples) {
                        this.outputSamples.shift();
                    }
                    const sum = this.outputSamples.reduce((a, b) => a + b, 0);
                    this.outputLatency = sum / this.outputSamples.length;
                }
                const inputLatency = this.getInputLatency(ctx);
                if (Number.isFinite(inputLatency) && inputLatency > 0) {
                    this.inputLatency = inputLatency * 1e6;
                }
            }
            this.updateDisplay();
        }, 3000);
    }

    stopMonitoring() {
        if (this.displayIntervalId) {
            clearInterval(this.displayIntervalId);
            this.displayIntervalId = null;
        }
        if (this.processingListener && this.listenerAttached && window.audioManager) {
            window.audioManager.removeEventListener('processingLatency', this.processingListener);
            this.listenerAttached = false;
            this.processingListener = null;
        }
    }

    updateDisplay() {
        if (this.displayElements.input) {
            if (this.inputLatency != null) {
                const ms = this.inputLatency / 1000;
                this.displayElements.input.textContent = `${ms.toFixed(2)} ms`;
            } else {
                this.displayElements.input.textContent = 'N/A';
            }
        }
        if (this.displayElements.processing) {
            if (this.processingLatency != null) {
                const ms = this.processingLatency / 1000;
                this.displayElements.processing.textContent = `${ms.toFixed(2)} ms`;
            } else {
                this.displayElements.processing.textContent = 'N/A';
            }
        }
        if (this.displayElements.output) {
            if (this.outputLatency != null) {
                const ms = this.outputLatency / 1000;
                this.displayElements.output.textContent = `${ms.toFixed(2)} ms`;
            } else {
                this.displayElements.output.textContent = 'N/A';
            }
        }
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'latency-monitor-plugin-ui';
        const inputRow = document.createElement('div');
        inputRow.className = 'latency-row';
        const inputLabel = document.createElement('span');
        inputLabel.textContent = 'Input Latency: ';
        const inputValue = document.createElement('span');
        this.displayElements.input = inputValue;
        inputRow.appendChild(inputLabel);
        inputRow.appendChild(inputValue);
        const procRow = document.createElement('div');
        procRow.className = 'latency-row';
        const procLabel = document.createElement('span');
        procLabel.textContent = 'Processing Latency: ';
        const procValue = document.createElement('span');
        this.displayElements.processing = procValue;
        procRow.appendChild(procLabel);
        procRow.appendChild(procValue);
        const outRow = document.createElement('div');
        outRow.className = 'latency-row';
        const outLabel = document.createElement('span');
        outLabel.textContent = 'Output Latency: ';
        const outValue = document.createElement('span');
        this.displayElements.output = outValue;
        outRow.appendChild(outLabel);
        outRow.appendChild(outValue);
        container.appendChild(inputRow);
        container.appendChild(procRow);
        container.appendChild(outRow);
        this.startMonitoring();
        return container;
    }

    cleanup() {
        this.stopMonitoring();
    }

    getParameters() {
        return {
            type: this.constructor.name,
            enabled: this.enabled
        };
    }

    setParameters(params) {
        if (params.enabled !== undefined) {
            this.enabled = params.enabled;
        }
        this.updateParameters();
    }
}

window.LatencyMonitorPlugin = LatencyMonitorPlugin;
