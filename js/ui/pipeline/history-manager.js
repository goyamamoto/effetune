/**
 * HistoryManager - Handles undo/redo functionality and state management
 */
import { applySerializedState } from '../../utils/serialization-utils.js';

export class HistoryManager {
    /**
     * Create a new HistoryManager instance
     * @param {Object} pipelineManager - The pipeline manager instance
     */
    constructor(pipelineManager) {
        this.pipelineManager = pipelineManager;
        this.audioManager = pipelineManager.audioManager;
        
        // Undo/Redo history
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 100;
        this.isUndoRedoOperation = false;
        this.undoRedoTimeoutId = null;
        this.specialSaveOverride = false;
    }
    
    /**
     * Save current pipeline state to history
     */
    saveState() {
        // Skip if this is an undo/redo operation
        if (this.isUndoRedoOperation) {
            // Special case: Preset loading needs to save state even with flag set
            if (this.specialSaveOverride) {
                this.specialSaveOverride = false;
            } else {
                return;
            }
        }
        
        // Create a deep copy of the current pipeline state
        const state = this.audioManager.pipeline.map(plugin =>
            this.pipelineManager.core.getSerializablePluginState(plugin, true, false, false)
        );
        
        // If we're not at the end of the history, truncate it
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add new state to history
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        // Check if pipeline is empty - for Electron file saving only
        if (this.audioManager.pipeline.length === 0) {
            // Create default plugins
            const defaultPlugins = [
                { name: 'Volume', enabled: true, parameters: { volume: -6 } },
                { name: 'Level Meter', enabled: true, parameters: {} }
            ];
            
            // Save default plugins state to file (but not to history)
            if (window.electronIntegration && window.electronIntegration.isElectron) {
                // Save to file using the savePipelineState function from app.js
                if (window.savePipelineState) {
                    window.savePipelineState(defaultPlugins);
                }
            }
        }
        
        // Save pipeline state to file if in Electron environment
        if (window.electronIntegration && window.electronIntegration.isElectron) {
            // Get current pipeline state in the new format (with name/enabled/parameters)
            const pipelineState = this.audioManager.pipeline.map(plugin =>
                this.pipelineManager.core.getSerializablePluginState(plugin, false, true, true)
            );
            
            // Save to file using the savePipelineState function from app.js
            if (window.savePipelineState) {
                window.savePipelineState(pipelineState);
            }
        }
    }
    
    /**
     * Undo the last operation
     */
    undo() {
        if (this.historyIndex <= 0) {
            return; // Nothing to undo
        }
        
        this.historyIndex--;
        this.loadStateFromHistory();
    }
    
    /**
     * Redo the last undone operation
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1) {
            return; // Nothing to redo
        }
        
        // State must exist to perform redo
        if (!this.history[this.historyIndex + 1]) {
            return;
        }
        
        this.historyIndex++;
        this.loadStateFromHistory();
    }
    
    /**
     * Load a state from history
     */
    loadStateFromHistory() {
        this.isUndoRedoOperation = true;
        
        // Clear any existing undo/redo timeout
        if (this.undoRedoTimeoutId) {
            clearTimeout(this.undoRedoTimeoutId);
        }
        
        try {
            const state = this.history[this.historyIndex];
            if (!state) {
                return;
            }
            
            // Clean up existing plugins before removing them
            this.audioManager.pipeline.forEach(plugin => {
                if (typeof plugin.cleanup === 'function') {
                    plugin.cleanup();
                }
            });
            
            // Clear current pipeline and expanded plugins
            this.audioManager.pipeline.length = 0;
            this.pipelineManager.expandedPlugins.clear();
            
            // Load plugins from state
            state.forEach(pluginState => {
                const plugin = this.pipelineManager.pluginManager.createPlugin(pluginState.nm);
                if (plugin) {
                    // Use applySerializedState to properly handle all properties including bus settings
                    applySerializedState(plugin, pluginState);
                    
                    this.audioManager.pipeline.push(plugin);
                    // Expand all plugins (same as loadPreset)
                    this.pipelineManager.expandedPlugins.add(plugin);
                }
            });
            
            // Update UI with force rebuild flag
            this.pipelineManager.core.updatePipelineUI(true);
            
            // Update worklet directly without rebuilding pipeline
            this.pipelineManager.core.updateWorkletPlugins();
            
            // Ensure master bypass is OFF after loading state (same as loadPreset)
            this.pipelineManager.core.enabled = true;
            this.audioManager.setMasterBypass(false);
            const masterToggle = document.querySelector('.toggle-button.master-toggle');
            if (masterToggle) {
                masterToggle.classList.remove('off');
            }
            
        } finally {
            // Instead of immediate reset, use a timeout to keep the flag active
            // This prevents saveState being called from updateParameters right after undo/redo
            this.undoRedoTimeoutId = setTimeout(() => {
                this.isUndoRedoOperation = false;
                this.undoRedoTimeoutId = null;
            }, 1000);
        }
    }
}