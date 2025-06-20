#!/bin/bash
set -e
clang --target=wasm32 -O3 -nostdlib -Wl,--no-entry -Wl,--export-all -msimd128 -o horn_resonator_plus.wasm horn_resonator_plus.c
