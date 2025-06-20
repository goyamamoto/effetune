// Placeholder wrapper for wasm-bindgen output.
// After building the Rust crate, replace this file with the generated bindings.
export async function initWasm() {
    if (globalThis.hrpWasm) return globalThis.hrpWasm;
    const wasmUrl = new URL('./horn_resonator_plus_bg.wasm', import.meta.url);
    const wasm = await fetch(wasmUrl);
    const { instance } = await WebAssembly.instantiateStreaming(wasm);
    globalThis.hrpWasm = instance.exports;
    return globalThis.hrpWasm;
}

export function process(context, data, parameters) {
    if (!globalThis.hrpWasm) {
        return data;
    }
    globalThis.hrpWasm.process(data, context, parameters);
    return data;
}
