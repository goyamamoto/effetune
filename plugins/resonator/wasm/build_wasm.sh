#!/usr/bin/env bash
set -euo pipefail

# Determine the appropriate clang compiler for WebAssembly.
if command -v wasm32-wasi-clang >/dev/null 2>&1; then
    CC=wasm32-wasi-clang
    SYSROOT=""
elif [[ -n "${WASI_SDK_PATH:-}" ]] && [[ -x "${WASI_SDK_PATH}/bin/clang" ]]; then
    CC="${WASI_SDK_PATH}/bin/clang"
    SYSROOT="--sysroot=${WASI_SDK_PATH}/share/wasi-sysroot"
else
    CC=clang
    SYSROOT=""
    echo "Using system clang. Set WASI_SDK_PATH or install wasi-sdk for best results." >&2
fi

$CC --target=wasm32-wasi -O3 -nostdlib $SYSROOT \
    -Wl,--no-entry -Wl,--export-all -msimd128 \
    horn_resonator_plus.c -lc -lm \
    -o horn_resonator_plus.wasm
