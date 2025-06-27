class MemoryMonitorPlugin extends PluginBase {
    constructor() {
        super('Memory Monitor', 'Visualize JS heap usage over time');
        this.samples = [];
        this.maxSamples = 300; // Number of columns in the heatmap
        this.intervalMs = 1000; // Sampling interval
        this.maxMemory = 0;
        this.gcIndices = [];
        this.timer = null;
        this.canvas = null;
        this.ctx = null;
        this.observer = null;

        // Register a pass-through processor
        this.registerProcessor(`
            return data;
        `);
    }

    // Return parameters (none beyond base)
    getParameters() {
        return {
            ...super.getParameters()
        };
    }

    setParameters(params) {
        super.setParameters(params);
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'plugin-parameter-ui memory-monitor';

        const graphContainer = document.createElement('div');
        graphContainer.className = 'graph-container';

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.maxSamples;
        this.canvas.height = 80;
        this.ctx = this.canvas.getContext('2d');
        graphContainer.appendChild(this.canvas);

        container.appendChild(graphContainer);

        if (this.observer == null) {
            this.observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.start();
                    } else {
                        this.stop();
                    }
                });
            });
        }
        this.observer.observe(this.canvas);

        return container;
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => {
            let used = 0;
            if (performance && performance.memory) {
                used = performance.memory.usedJSHeapSize / (1024 * 1024);
            }
            this.samples.push(used);
            if (this.samples.length > this.maxSamples) {
                this.samples.shift();
                this.gcIndices = this.gcIndices.map(i => i - 1).filter(i => i >= 0);
            }
            const len = this.samples.length;
            if (len >= 2 && this.samples[len - 2] - used > 1) {
                this.gcIndices.push(len - 1);
            }
            this.maxMemory = Math.max(this.maxMemory, used);
            this.draw();
        }, this.intervalMs);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    draw() {
        if (!this.ctx) return;
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const maxMem = this.maxMemory || 1;
        for (let i = 0; i < this.samples.length; i++) {
            const mem = this.samples[i];
            const intensity = mem / maxMem;
            const hue = (1 - intensity) * 120; // Green to red
            const barHeight = (mem / maxMem) * canvas.height;
            ctx.fillStyle = `hsl(${hue},100%,50%)`;
            ctx.fillRect(i, canvas.height - barHeight, 1, barHeight);
            if (this.gcIndices.includes(i)) {
                ctx.fillStyle = 'blue';
                ctx.fillRect(i, 0, 1, canvas.height);
            }
        }
    }

    cleanup() {
        this.stop();
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.MemoryMonitorPlugin = MemoryMonitorPlugin;
}
