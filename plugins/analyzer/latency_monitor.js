class LatencyMonitorPlugin extends PluginBase {
    constructor() {
        super('Latency Monitor', 'Monitors audio latency');
        this.inputLatency = 0;
        this.processingLatency = 0;
        this.outputLatency = 0;
        this.displayIntervalId = null;
        this.processingSamples = [];
        this.maxProcessingSamples = 10; // 1 second of 100ms samples
        this.processingListener = null;
        this.displayElements = {};
    }

    // Retrieve output latency using platform information when possible
    getOutputLatency(ctx) {
        if (typeof ctx.getOutputTimestamp === 'function') {
            const ts = ctx.getOutputTimestamp();
            if (ts && ts.performanceTime !== undefined) {
                const diff = ts.performanceTime - performance.now();
                return diff > 0 ? diff / 1000 : 0; // seconds
            }
        }
        if (typeof ctx.outputLatency === 'number') {
            return ctx.outputLatency; // seconds
        }
        return 0;
    }

    // Retrieve input latency if provided, otherwise estimate using base latency
    getInputLatency(ctx, outputLatency) {
        if (typeof ctx.inputLatency === 'number') {
            return ctx.inputLatency; // seconds
        }
        const track = window.audioManager?.ioManager?.stream?.getAudioTracks?.()[0];
        if (track && track.getSettings) {
            const settings = track.getSettings();
            if (typeof settings.latency === 'number') {
                return settings.latency; // seconds
            }
        }
        const baseLat = ctx.baseLatency || 0;
        return Math.max(0, baseLat - outputLatency);
    }

    startMonitoring() {
        if (this.displayIntervalId) return;
        this.processingListener = (data) => {
            this.processingSamples.push(data.processingTime);
            if (this.processingSamples.length > this.maxProcessingSamples) {
                this.processingSamples.shift();
            }
            const sum = this.processingSamples.reduce((a, b) => a + b, 0);
            this.processingLatency = sum / this.processingSamples.length;
        };
        if (window.audioManager) {
            window.audioManager.addEventListener('processingLatency', this.processingListener);
        }

        this.displayIntervalId = setInterval(() => {
            const ctx = window.audioContext;
            if (ctx) {
                const outputLatency = this.getOutputLatency(ctx);
                const inputLatency = this.getInputLatency(ctx, outputLatency);
                this.inputLatency = inputLatency * 1000;
                this.outputLatency = outputLatency * 1000;
            }
            this.updateDisplay();
        }, 1000);
    }

    stopMonitoring() {
        if (this.displayIntervalId) {
            clearInterval(this.displayIntervalId);
            this.displayIntervalId = null;
        }
        if (this.processingListener && window.audioManager) {
            window.audioManager.removeEventListener('processingLatency', this.processingListener);
            this.processingListener = null;
        }
    }

    updateDisplay() {
        if (this.displayElements.input) {
            this.displayElements.input.textContent = `${this.inputLatency.toFixed(2)} ms`;
        }
        if (this.displayElements.processing) {
            this.displayElements.processing.textContent = `${this.processingLatency.toFixed(2)} ms`;
        }
        if (this.displayElements.output) {
            this.displayElements.output.textContent = `${this.outputLatency.toFixed(2)} ms`;
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
