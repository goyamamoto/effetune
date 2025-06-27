const { PerformanceObserver } = require('perf_hooks');
const constants = require('./constants');

let observer = null;

function startMonitoring() {
  if (observer) {
    return;
  }
  observer = new PerformanceObserver((list) => {
    const entry = list.getEntries()[0];
    const mainWindow = constants.getMainWindow();
    const data = {
      kind: entry.detail ? entry.detail.kind : 0,
      duration: entry.duration,
    };
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('gc-event', data);
    }
    console.log(`GC event: kind=${data.kind} duration=${data.duration.toFixed(2)}ms`);
  });
  observer.observe({ entryTypes: ['gc'] });
}

module.exports = { startMonitoring };
