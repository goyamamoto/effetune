use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct HornResonatorPlus {
    sample_rate: f32,
    channels: usize,
    n: usize,
    r: Vec<f32>,
    g: f32,
    fwd: Vec<Vec<f32>>, // [channels][n+1]
    rev: Vec<Vec<f32>>, // [channels][n+1]
    rm_b0: f32,
    rm_a1: f32,
    rm_a2: f32,
    rm_y1: Vec<f32>,
    rm_y2: Vec<f32>,
    output_gain: f32,
    low_delay: Vec<Vec<f32>>, // [channels][n]
    low_delay_idx: Vec<usize>,
}

#[wasm_bindgen]
impl HornResonatorPlus {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, channels: usize, n: usize) -> HornResonatorPlus {
        HornResonatorPlus {
            sample_rate,
            channels,
            n,
            r: vec![0.0; n],
            g: 1.0,
            fwd: vec![vec![0.0; n + 1]; channels],
            rev: vec![vec![0.0; n + 1]; channels],
            rm_b0: 0.0,
            rm_a1: 0.0,
            rm_a2: 0.0,
            rm_y1: vec![0.0; channels],
            rm_y2: vec![0.0; channels],
            output_gain: 1.0,
            low_delay: vec![vec![0.0; n]; channels],
            low_delay_idx: vec![0; channels],
        }
    }

    pub fn set_reflection(&mut self, idx: usize, value: f32) {
        if idx < self.n {
            self.r[idx] = value;
        }
    }

    pub fn set_damping(&mut self, g: f32) {
        self.g = g;
    }

    pub fn set_mouth_filter(&mut self, b0: f32, a1: f32, a2: f32) {
        self.rm_b0 = b0;
        self.rm_a1 = a1;
        self.rm_a2 = a2;
    }

    pub fn set_output_gain(&mut self, gain: f32) {
        self.output_gain = gain;
    }

    pub fn process(&mut self, input: &[f32], output: &mut [f32]) {
        let bs = input.len() / self.channels;
        let n = self.n;
        for ch in 0..self.channels {
            let offset = ch * bs;
            let fwd = &mut self.fwd[ch];
            let rev = &mut self.rev[ch];
            let ld_line = &mut self.low_delay[ch];
            let mut ld_idx = self.low_delay_idx[ch];
            let mut rm_y1 = self.rm_y1[ch];
            let mut rm_y2 = self.rm_y2[ch];

            for i in 0..bs {
                let input_sample = input[offset + i];
                fwd[0] = input_sample + rev[0];

                for j in 0..n {
                    let rj = self.r[j];
                    let f_in = fwd[j];
                    let r_in = rev[j + 1];
                    let diff = rj * (f_in - r_in);
                    rev[j] = self.g * (r_in + diff);
                    fwd[j + 1] = self.g * (f_in + diff);
                }

                let fw_n = fwd[n];
                let mouth = self.rm_b0 * fw_n - self.rm_a1 * rm_y1 - self.rm_a2 * rm_y2;
                rev[n] = mouth;
                rm_y2 = rm_y1;
                rm_y1 = mouth;

                let high = fw_n + mouth;
                let low = ld_line[ld_idx];
                ld_line[ld_idx] = input_sample;
                ld_idx += 1;
                if ld_idx >= n { ld_idx = 0; }

                output[offset + i] = high * self.output_gain + low;
            }

            self.low_delay_idx[ch] = ld_idx;
            self.rm_y1[ch] = rm_y1;
            self.rm_y2[ch] = rm_y2;
        }
    }
}
