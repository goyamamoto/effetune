class MemoryHeatmapPlugin extends PluginBase {
    constructor() {
        super('Memory Heatmap', 'Visualize JS heap usage and detect GC events');
        this.interval = 1000; // sampling interval in ms
        this.samples = [];
        this.gcEvents = [];
        this.timerId = null;
        this.canvas = null;
        this.ctx = null;
        this.maxSamples = 512;
        this.lastUsage = null;
        this.registerProcessor(MemoryHeatmapPlugin.processorFunction);
        this.observer = null;
    }

    static processorFunction = `
        return data; // pass-through
    `;

    getParameters() {
        return {
            ...super.getParameters(),
            interval: this.interval
        };
    }

    setParameters(params) {
        super.setParameters(params);
        if (params.interval !== undefined) {
            this.setInterval(params.interval);
        }
    }

    setInterval(value) {
        this.interval = Math.max(200, value);
        if (this.timerId) {
            clearInterval(this.timerId);
            this.startSampling();
        }
        this.updateParameters();
    }

    createUI() {
        if (this.observer) {
            this.observer.disconnect();
        }
        const container = document.createElement('div');
        container.className = 'memory-heatmap-ui';

        const intervalControl = this.createParameterControl(
            'Interval', 200, 5000, 100, this.interval,
            (v) => this.setInterval(v), 'ms'
        );
        container.appendChild(intervalControl);

        const canvas = document.createElement('canvas');
        canvas.width = this.maxSamples;
        canvas.height = 100;
        canvas.style.width = '512px';
        canvas.style.height = '100px';
        container.appendChild(canvas);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        if (this.observer == null) {
            this.observer = new IntersectionObserver(this.handleVisibility.bind(this));
        }
        this.observer.observe(canvas);
        this.startSampling();
        return container;
    }

    handleVisibility(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                this.startSampling();
            } else {
                this.stopSampling();
            }
        });
    }

    startSampling() {
        if (this.timerId) return;
        this.timerId = setInterval(() => this.sampleMemory(), this.interval);
    }

    stopSampling() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    sampleMemory() {
        if (!performance.memory) return;
        const used = performance.memory.usedJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        const ratio = used / limit;
        if (this.lastUsage !== null && used < this.lastUsage - 10 * 1024 * 1024) {
            this.gcEvents.push(this.samples.length);
        }
        this.lastUsage = used;
        this.samples.push(ratio);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
            this.gcEvents = this.gcEvents.map(i => i - 1).filter(i => i >= 0);
        }
        this.draw();
    }

    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        ctx.drawImage(this.canvas, -1, 0);
        ctx.clearRect(width - 1, 0, 1, height);
        const ratio = this.samples[this.samples.length - 1];
        const hue = (1 - ratio) * 120;
        ctx.fillStyle = `hsl(${hue},100%,50%)`;
        ctx.fillRect(width - 1, 0, 1, height);
        if (this.gcEvents.includes(this.samples.length - 1)) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(width - 1, 0, 1, height);
        }
    }

    cleanup() {
        this.stopSampling();
        if (this.observer && this.canvas) {
            this.observer.unobserve(this.canvas);
            this.observer.disconnect();
            this.observer = null;
        }
        this.canvas = null;
        this.ctx = null;
        this.samples = [];
        this.gcEvents = [];
        this.lastUsage = null;
    }
}

window.MemoryHeatmapPlugin = MemoryHeatmapPlugin;
