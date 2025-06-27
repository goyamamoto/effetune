// Simple GC visualization overlay for Electron
if (window.electronAPI && window.electronIntegration && window.electronIntegration.isElectron) {
  const overlay = document.createElement('div');
  overlay.className = 'gc-overlay';
  overlay.style.position = 'fixed';
  overlay.style.bottom = '10px';
  overlay.style.right = '10px';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.color = '#0f0';
  overlay.style.fontSize = '12px';
  overlay.style.fontFamily = 'monospace';
  overlay.style.padding = '4px 6px';
  overlay.style.zIndex = '2000';
  overlay.style.pointerEvents = 'none';
  overlay.textContent = 'Waiting for GC...';
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(overlay);
  });

  window.electronAPI.onGcEvent((data) => {
    overlay.textContent = `GC kind=${data.kind} duration=${data.duration.toFixed(1)}ms`;
    overlay.style.opacity = '1';
    clearTimeout(overlay._hideTimer);
    overlay._hideTimer = setTimeout(() => {
      overlay.style.opacity = '0.4';
    }, 2000);
  });
}
