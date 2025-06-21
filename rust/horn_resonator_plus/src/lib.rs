use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct HornResonatorPlus {
    sample_rate: f32,
    channels: usize,
    n: usize,
    r: Vec<f32>,
    g: f32,
    fwd: Vec<[Vec<f32>; 2]>, // [channels][2][n+1]
    rev: Vec<[Vec<f32>; 2]>, // [channels][2][n+1]
    buf_idx: Vec<usize>,
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
            fwd: vec![[vec![0.0; n + 1], vec![0.0; n + 1]]; channels],
            rev: vec![[vec![0.0; n + 1], vec![0.0; n + 1]]; channels],
            buf_idx: vec![0; channels],
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
            let fwd_ch = &mut self.fwd[ch];
            let rev_ch = &mut self.rev[ch];
            let mut buf_idx = self.buf_idx[ch];
            let ld_line = &mut self.low_delay[ch];
            let mut ld_idx = self.low_delay_idx[ch];
            let mut rm_y1 = self.rm_y1[ch];
            let mut rm_y2 = self.rm_y2[ch];

            for i in 0..bs {
                let input_sample = input[offset + i];

                // obtain current and next buffers using ping-pong index
                let (fwd_cur, fwd_nxt) = if buf_idx == 0 {
                    let (a, b) = fwd_ch.split_at_mut(1);
                    (&mut a[0], &mut b[0])
                } else {
                    let (b, a) = fwd_ch.split_at_mut(1);
                    (&mut a[0], &mut b[0])
                };
                let (rev_cur, rev_nxt) = if buf_idx == 0 {
                    let (a, b) = rev_ch.split_at_mut(1);
                    (&mut a[0], &mut b[0])
                } else {
                    let (b, a) = rev_ch.split_at_mut(1);
                    (&mut a[0], &mut b[0])
                };

                // Inject input at throat
                fwd_cur[0] = input_sample + rev_cur[0];

                // propagate waves
                for j in 0..n {
                    let rj = self.r[j];
                    let f_in = fwd_cur[j];
                    let r_in = rev_cur[j + 1];
                    let diff = rj * (f_in - r_in);
                    rev_nxt[j] = self.g * (r_in + diff);
                    fwd_nxt[j + 1] = self.g * (f_in + diff);
                }

                // mouth reflection
                let fw_n = fwd_nxt[n];
                let mouth = self.rm_b0 * fw_n - self.rm_a1 * rm_y1 - self.rm_a2 * rm_y2;
                rev_nxt[n] = mouth;
                rm_y2 = rm_y1;
                rm_y1 = mouth;

                let high = fw_n + mouth;
                let output_low = input_sample; // placeholder low-pass path
                let low = ld_line[ld_idx];
                ld_line[ld_idx] = output_low;
                ld_idx += 1;
                if ld_idx >= n { ld_idx = 0; }

                output[offset + i] = high * self.output_gain + low;

                // swap buffers for next iteration
                buf_idx ^= 1;
            }

            self.low_delay_idx[ch] = ld_idx;
            self.rm_y1[ch] = rm_y1;
            self.rm_y2[ch] = rm_y2;
            self.buf_idx[ch] = buf_idx;
        }
    }
}
