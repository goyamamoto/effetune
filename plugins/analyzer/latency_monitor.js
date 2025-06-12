class LatencyMonitorPlugin extends PluginBase {
    constructor() {
        super('Latency Monitor', 'Monitors audio latency');
        this.inputLatency = 0;
        this.processingLatency = 0;
        this.outputLatency = 0;
        this.intervalId = null;
        this.displayIntervalId = null;
        this.processingSamples = [];
        this.maxProcessingSamples = 10; // 1 second of 100ms samples
        this.displayElements = {};
    }

    // Retrieve output latency from the AudioContext or estimate if unavailable
    getOutputLatency(ctx) {
        let outputLatency = 0;
        if (typeof ctx.getOutputTimestamp === 'function') {
            const ts = ctx.getOutputTimestamp();
            if (ts && ts.contextTime !== undefined) {
                outputLatency = Math.max(0, ts.contextTime - ctx.currentTime);
            }
        } else if (ctx.outputLatency) {
            outputLatency = ctx.outputLatency;
        }
        return outputLatency;
    }

    // Retrieve input latency if provided, otherwise estimate using base latency
    getInputLatency(ctx, outputLatency) {
        if (ctx.inputLatency !== undefined) {
            return ctx.inputLatency;
        }
        const baseLat = ctx.baseLatency || 0;
        return Math.max(0, baseLat - outputLatency);
    }

    startMonitoring() {
        if (this.intervalId) return;
        // Sample processing latency every 100 ms
        this.intervalId = setInterval(() => {
            const ctx = window.audioContext;
            if (!ctx) return;
            const outputLatency = this.getOutputLatency(ctx);
            const inputLatency = this.getInputLatency(ctx, outputLatency);
            const baseLat = ctx.baseLatency || 0;
            const processingSample = Math.max(0, baseLat - inputLatency - outputLatency);
            this.inputLatency = inputLatency * 1000;
            this.outputLatency = outputLatency * 1000;
            this.processingSamples.push(processingSample * 1000);
            if (this.processingSamples.length > this.maxProcessingSamples) {
                this.processingSamples.shift();
            }
            const sum = this.processingSamples.reduce((a, b) => a + b, 0);
            this.processingLatency = sum / this.processingSamples.length;
        }, 100);

        // Update displayed values once per second
        this.displayIntervalId = setInterval(() => {
            this.updateDisplay();
        }, 1000);
    }

    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.displayIntervalId) {
            clearInterval(this.displayIntervalId);
            this.displayIntervalId = null;
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
