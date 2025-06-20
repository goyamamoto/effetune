# Horn Resonator Plus (Rust)

This crate provides a simplified Rust implementation of the Horn Resonator Plus DSP algorithm. It is intended to be compiled to WebAssembly and called from the JavaScript plugin to accelerate processing.

## Building

```
wasm-pack build --target web
```

This produces `horn_resonator_plus_bg.wasm` and JavaScript bindings that can be loaded by the plugin. If the `wasm32-unknown-unknown` target is missing, install it with:

```
rustup target add wasm32-unknown-unknown
```

## Usage

After building, copy the generated `.wasm` and binding `.js` files to `plugins/resonator/wasm/` and load them from `horn_resonator_plus.js`.

