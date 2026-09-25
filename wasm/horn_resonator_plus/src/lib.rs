use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn process_waveguide(
    fwd: &mut [f32],
    rev: &mut [f32],
    r: &[f32],
    g: f32,
) {
    let n = r.len();
    if fwd.len() < n + 1 || rev.len() < n + 1 {
        return;
    }
    for j in 0..n {
        let f_in = fwd[j];
        let r_in = rev[j + 1];
        let scatter = r[j] * (f_in - r_in);
        fwd[j + 1] = g * (f_in + scatter);
        rev[j] = g * (r_in + scatter);
    }
}
