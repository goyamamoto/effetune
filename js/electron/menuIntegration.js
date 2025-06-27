/**
 * Menu integration module for EffeTune
 * Provides application menu functionality when running in Electron
 */

/**
 * Update the application menu with translated labels
 * This method is called when translations are loaded
 * @param {boolean} isElectron - Whether running in Electron environment
 */
export function updateApplicationMenu(isElectron) {
  if (!isElectron || !window.uiManager) return;
  
  try {
    // Get the t function from UIManager
    const t = window.uiManager.t.bind(window.uiManager);
    
    // Create a menu template with translated labels
    const menuTemplate = {
      file: {
        label: t('menu.file'),
        submenu: [
          { label: t('menu.file.save') },
          { label: t('menu.file.saveAs') },
          { type: 'separator' },
          { label: t('menu.file.openMusicFile') },
          { label: t('menu.file.processAudioFiles') },
          { type: 'separator' },
          { label: t('menu.file.exportPreset') },
          { label: t('menu.file.importPreset') },
          { type: 'separator' },
          { label: t('menu.file.quit') }
        ]
      },
      edit: {
        label: t('menu.edit'),
        submenu: [
          { label: t('menu.edit.undo') },
          { label: t('menu.edit.redo') },
          { type: 'separator' },
          { label: t('menu.edit.cut') },
          { label: t('menu.edit.copy') },
          { label: t('menu.edit.paste') },
          { type: 'separator' },
          { label: t('menu.edit.delete') },
          { label: t('menu.edit.selectAll') }
        ]
      },
      view: {
        label: t('menu.view'),
        submenu: [
          { label: t('menu.view.reload') },
          { type: 'separator' },
          { label: t('menu.view.resetZoom') },
          { label: t('menu.view.zoomIn') },
          { label: t('menu.view.zoomOut') },
          { type: 'separator' },
          { label: t('menu.view.toggleFullscreen') }
        ]
      },
      settings: {
        label: t('menu.settings'),
        submenu: [
          { label: t('menu.settings.audioDevices') },
          { label: t('menu.settings.performanceBenchmark') },
          { label: t('menu.settings.frequencyResponseMeasurement') },
          { label: t('menu.settings.gcMonitor') }
        ]
      },
      help: {
        label: t('menu.help'),
        submenu: [
          { label: t('menu.help.help') },
          { type: 'separator' },
          { label: t('menu.help.about') }
        ]
      }
    };
    
    // Send the menu template to the main process to update the application menu
    window.electronAPI.updateApplicationMenu(menuTemplate)
      .then(result => {
        if (!result.success) {
          console.error('Failed to update application menu:', result.error);
        }
      })
      .catch(error => {
        console.error('Error updating application menu:', error);
      });
  } catch (error) {
    console.error('Error creating menu template:', error);
  }
}