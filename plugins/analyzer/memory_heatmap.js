class MemoryHeatmapPlugin extends PluginBase {
  constructor() {
    super('Memory Heatmap', 'Visualize JS heap usage over time');
    this.history = [];
    this.maxPoints = 60; // Number of samples shown
    this.sampleInterval = 1000; // ms
    this.canvas = null;
    this.ctx = null;
    this.intervalId = null;
  }

  getParameters() {
    return { ...super.getParameters() };
  }

  createUI() {
    const container = document.createElement('div');
    container.className = 'plugin-parameter-ui memory-heatmap-plugin-ui';

    this.canvas = document.createElement('canvas');
    this.canvas.width = 300;
    this.canvas.height = 100;
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.startMonitoring();
    return container;
  }

  startMonitoring() {
    if (this.intervalId) return;
    this.fetchAndDraw();
    this.intervalId = setInterval(() => this.fetchAndDraw(), this.sampleInterval);
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async fetchAndDraw() {
    try {
      const result = await window.electronAPI.getMemoryInfo();
      if (!result || !result.success) return;
      const memInfo = result.memInfo;
      const used = memInfo.heapUsed || memInfo.rss || 0;
      const usedMB = used / (1024 * 1024);
      this.history.push(usedMB);
      if (this.history.length > this.maxPoints) this.history.shift();
      this.draw();
    } catch (e) {
      console.error('MemoryHeatmapPlugin fetch error', e);
    }
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);
    const max = Math.max(...this.history, 1);
    const barWidth = width / this.maxPoints;
    for (let i = 0; i < this.history.length; i++) {
      const val = this.history[this.history.length - 1 - i];
      const ratio = val / max;
      const hue = (1 - ratio) * 120; // green to red
      ctx.fillStyle = `hsl(${hue},100%,50%)`;
      const x = width - (i + 1) * barWidth;
      ctx.fillRect(x, height - ratio * height, barWidth - 1, ratio * height);
      if (i > 0) {
        const prev = this.history[this.history.length - i];
        if (prev - val > 5) { // Drop >5MB indicates GC
          ctx.fillStyle = 'cyan';
          ctx.fillRect(x, 0, barWidth - 1, 4);
        }
      }
    }
  }

  cleanup() {
    this.stopMonitoring();
  }
}

if (typeof window !== 'undefined') {
  window.MemoryHeatmapPlugin = MemoryHeatmapPlugin;
}
