// plugins/resonator/horn_resonator_plus_wasm.js

/**
 * HornResonatorPlusWasmPlugin attempts to load a WebAssembly implementation of
 * the horn resonator processor. If the WASM module fails to load, it falls back
 * to the JavaScript processor defined in HornResonatorPlusPlugin.
 */
class HornResonatorPlusWasmPlugin extends HornResonatorPlusPlugin {
    constructor() {
        super();
        this.name = 'Horn Resonator Plus (WASM)';
        this.description = 'Horn resonance emulator (WASM)';
        // Try to register the WASM processor. If loading fails, the JS processor
        // from the parent class will continue to be used.
        // Load the compiled WASM module built by `wasm-pack`. The path is
        // resolved relative to plugin-base.js (in the plugins directory),
        // so use "../wasm" to reach the root-level wasm folder.
        this.registerWasmProcessor(
            '../wasm/horn_resonator_plus_wasm/pkg/horn_resonator_plus_wasm_bg.wasm'
        );
    }
}

// Export the class
window.HornResonatorPlusWasmPlugin = HornResonatorPlusWasmPlugin;
