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
        // Load the compiled WASM module built by `wasm-pack`.
        // The path is resolved relative to the application root.
        // The WASM package is located in the repository root under `wasm/`.
        // When this script is executed as an external file the relative base
        // path for dynamic imports becomes `plugins/resonator`. Therefore we
        // need to traverse two directories up to correctly resolve the module
        // path from the application root.
        this.registerWasmProcessor(
            '../../wasm/horn_resonator_plus_wasm/pkg/horn_resonator_plus_wasm_bg.wasm'
        );
    }
}

// Export the class
window.HornResonatorPlusWasmPlugin = HornResonatorPlusWasmPlugin;
