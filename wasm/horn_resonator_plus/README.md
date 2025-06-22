# HornResonatorPlus WASM Module

This crate contains a minimal core of the HornResonatorPlus plugin rewritten in Rust.
The function `process_waveguide` handles the heavy wave propagation loop and is
exposed to JavaScript via `wasm-bindgen`.

## Building

To generate the WebAssembly module run:

```bash
wasm-pack build --release --target bundler
```

The generated files will appear in `pkg/`. Copy the `.wasm` and JS glue code to
`plugins/resonator/` so that the plugin can load them at runtime.
```
