const { PerformanceObserver, constants: perfConstants } = require('perf_hooks');

const gcKinds = {
  [perfConstants.NODE_PERFORMANCE_GC_MINOR]: 'minor',
  [perfConstants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
  [perfConstants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
  [perfConstants.NODE_PERFORMANCE_GC_WEAKCB]: 'weakcb'
};

let mainWindow = null;

function setMainWindow(win) {
  mainWindow = win;
}

function startMonitoring() {
  const obs = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      const kind = gcKinds[entry.kind] || 'unknown';
      const data = { kind, duration: entry.duration };
      console.log(`GC ${kind}: ${entry.duration.toFixed(2)} ms`);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('gc-event', data);
      }
    });
  });
  try {
    obs.observe({ entryTypes: ['gc'], buffered: false });
  } catch (err) {
    console.warn('GC monitoring not supported:', err.message || err);
  }
}

module.exports = {
  startMonitoring,
  setMainWindow
};
