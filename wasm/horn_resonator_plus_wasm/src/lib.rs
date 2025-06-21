use wasm_bindgen::prelude::*;

const C: f32 = 343.0;
const RHO_C: f32 = 413.0;
const PI: f32 = std::f32::consts::PI;
const TWO_PI: f32 = 2.0 * PI;
const SQRT2: f32 = std::f32::consts::SQRT_2;
const EPS: f32 = 1e-9;
const DC_OFFSET: f32 = 1e-25;

#[wasm_bindgen]
#[derive(Clone)]
pub struct Parameters {
    pub en: bool,
    pub ln: f32,
    pub th: f32,
    pub mo: f32,
    pub cv: f32,
    pub dp: f32,
    pub tr: f32,
    pub co: f32,
    pub wg: f32,
    pub sample_rate: f32,
    pub channel_count: usize,
    pub block_size: usize,
}

#[wasm_bindgen]
pub struct Context {
    initialized: bool,
    sr: f32,
    chs: usize,
    n: usize,
    z: Vec<f32>,
    r: Vec<f32>,
    g: f32,
    tr_coeff: f32,
    rt_b0: f32,
    rt_a1: f32,
    rt_y1: Vec<f32>,
    rm_b0: f32,
    rm_a1: f32,
    rm_a2: f32,
    rm_y1: Vec<f32>,
    rm_y2: Vec<f32>,
    fwd: Vec<[Vec<f32>;2]>,
    rev: Vec<[Vec<f32>;2]>,
    buf_idx: Vec<usize>,
    lr_coeffs: [f32;8],
    lr_low: Vec<[f32;8]>,
    lr_high: Vec<[f32;8]>,
    low_delay: Vec<Vec<f32>>,
    low_delay_idx: Vec<usize>,
    output_gain: f32,
    ln: f32,
    th: f32,
    mo: f32,
    cv: f32,
    dp: f32,
    tr: f32,
    co: f32,
    wg: f32,
}

#[wasm_bindgen]
impl Context {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Context {
        Context {
            initialized: false,
            sr: 0.0,
            chs: 0,
            n: 0,
            z: Vec::new(),
            r: Vec::new(),
            g: 0.0,
            tr_coeff: 0.0,
            rt_b0: 0.0,
            rt_a1: 0.0,
            rt_y1: Vec::new(),
            rm_b0: 0.0,
            rm_a1: 0.0,
            rm_a2: 0.0,
            rm_y1: Vec::new(),
            rm_y2: Vec::new(),
            fwd: Vec::new(),
            rev: Vec::new(),
            buf_idx: Vec::new(),
            lr_coeffs: [0.0;8],
            lr_low: Vec::new(),
            lr_high: Vec::new(),
            low_delay: Vec::new(),
            low_delay_idx: Vec::new(),
            output_gain: 1.0,
            ln: 0.0,
            th: 0.0,
            mo: 0.0,
            cv: 0.0,
            dp: 0.0,
            tr: 0.0,
            co: 0.0,
            wg: 0.0,
        }
    }

    fn needs_recalc(&self, p: &Parameters) -> bool {
        !self.initialized ||
        (self.sr - p.sample_rate).abs() > 0.1 ||
        self.chs != p.channel_count ||
        (self.ln - p.ln).abs() > 0.001 ||
        (self.th - p.th).abs() > 0.001 ||
        (self.mo - p.mo).abs() > 0.001 ||
        (self.cv - p.cv).abs() > 0.001 ||
        (self.dp - p.dp).abs() > 0.0001 ||
        (self.tr - p.tr).abs() > 0.0001 ||
        (self.co - p.co).abs() > 0.001 ||
        (self.wg - p.wg).abs() > 0.001
    }

    fn recalc(&mut self, p: &Parameters) {
        self.sr = p.sample_rate;
        self.chs = p.channel_count;
        self.ln = p.ln;
        self.th = p.th;
        self.mo = p.mo;
        self.cv = p.cv;
        self.dp = p.dp;
        self.tr = p.tr;
        self.co = p.co;
        self.wg = p.wg;

        let dx = C / self.sr;
        let l = self.ln / 100.0;
        let n = ((l / dx).round() as usize).max(1);
        self.n = n;
        self.z.resize(n+1, 0.0);
        self.r.resize(n, 0.0);

        let curve_exp = 10f32.powf(self.cv / 100.0);
        let throat_r = self.th / 200.0;
        let mouth_r = self.mo / 200.0;
        for i in 0..=n {
            let radius = if i==0 {
                throat_r
            } else if i==n {
                mouth_r
            } else {
                throat_r + (mouth_r - throat_r) * (i as f32 / n as f32).powf(curve_exp)
            };
            let area = PI * (radius*radius).max(EPS);
            self.z[i] = RHO_C / area;
        }
        for i in 0..n {
            let sum = self.z[i] + self.z[i+1];
            self.r[i] = if sum < EPS {0.0} else {(self.z[i+1] - self.z[i]) / sum};
        }
        self.g = 10f32.powf(-self.dp * dx / 20.0);
        self.tr_coeff = self.tr;

        let fc_th = if throat_r > EPS { C / (TWO_PI * throat_r) } else { self.sr/4.0 };
        let f_norm_th = fc_th.min(self.sr * 0.45)/self.sr;
        let pole_th = 0.99 * (-TWO_PI*f_norm_th).exp();
        self.rt_b0 = 1.0 - pole_th;
        self.rt_a1 = -pole_th;
        self.rt_y1 = vec![0.0; self.chs];

        let fc_m = if mouth_r > EPS { C / (TWO_PI*mouth_r) } else { self.sr/4.0 };
        let f_norm = fc_m.min(self.sr*0.45)/self.sr;
        let pole = 0.99 * (-TWO_PI*f_norm).exp();
        self.rm_a1 = -2.0*pole;
        self.rm_a2 = pole*pole;
        self.rm_b0 = -1.0 - self.rm_a1 - self.rm_a2;
        self.rm_y1 = vec![0.0; self.chs];
        self.rm_y2 = vec![0.0; self.chs];

        self.fwd = (0..self.chs).map(|_| [vec![0.0; n+1], vec![0.0; n+1]]).collect();
        self.rev = (0..self.chs).map(|_| [vec![0.0; n+1], vec![0.0; n+1]]).collect();
        self.buf_idx = vec![0; self.chs];

        let co = self.co.max(20.0).min(self.sr*0.5 - 1.0);
        let omega = (co*PI/self.sr).tan();
        let omega2 = omega*omega;
        let k = SQRT2*omega;
        let den = omega2 + k + 1.0;
        let inv_den = if den < EPS {1.0} else {1.0/den};
        let b0_lp = omega2*inv_den;
        let b1_lp = 2.0*b0_lp;
        let b2_lp = b0_lp;
        let b0_hp = inv_den;
        let b1_hp = -2.0*b0_hp;
        let b2_hp = b0_hp;
        let a1_c = 2.0*(omega2 - 1.0)*inv_den;
        let a2_c = (omega2 - k + 1.0)*inv_den;
        self.lr_coeffs = [b0_lp,b1_lp,b2_lp,b0_hp,b1_hp,b2_hp,a1_c,a2_c];
        self.lr_low = vec![[DC_OFFSET,-DC_OFFSET,DC_OFFSET,-DC_OFFSET,DC_OFFSET,-DC_OFFSET,DC_OFFSET,-DC_OFFSET]; self.chs];
        self.lr_high = self.lr_low.clone();

        self.low_delay = vec![vec![0.0; n]; self.chs];
        self.low_delay_idx = vec![0; self.chs];

        self.output_gain = 10f32.powf(self.wg / 20.0);
        self.initialized = true;
    }

    #[wasm_bindgen]
    pub fn process(&mut self, data: &mut [f32], params: &Parameters, _time: f64) {
        if !params.en { return; }
        if self.needs_recalc(params) { self.recalc(params); }
        let chs = self.chs; let bs = params.block_size; let n = self.n;
        for ch in 0..chs {
            let mut buf_idx = self.buf_idx[ch];
            let mut fwd_curr = &mut self.fwd[ch][buf_idx];
            let mut rev_curr = &mut self.rev[ch][buf_idx];
            let mut fwd_next = &mut self.fwd[ch][buf_idx^1];
            let mut rev_next = &mut self.rev[ch][buf_idx^1];
            let mut rm_y1 = self.rm_y1[ch];
            let mut rm_y2 = self.rm_y2[ch];
            let mut rt_y1 = self.rt_y1[ch];
            let mut lp = self.lr_low[ch];
            let mut hp = self.lr_high[ch];
            let mut delay_idx = self.low_delay_idx[ch];
            let mut delay_buf = &mut self.low_delay[ch];
            for i in 0..bs {
                let idx = ch*bs + i;
                let input = data[idx];
                let b0_lp=self.lr_coeffs[0]; let b1_lp=self.lr_coeffs[1]; let b2_lp=self.lr_coeffs[2];
                let b0_hp=self.lr_coeffs[3]; let b1_hp=self.lr_coeffs[4]; let b2_hp=self.lr_coeffs[5];
                let a1_c=self.lr_coeffs[6]; let a2_c=self.lr_coeffs[7];

                let y1_lp = b0_lp*input + b1_lp*lp[0] + b2_lp*lp[1] - a1_c*lp[2] - a2_c*lp[3];
                lp[1]=lp[0]; lp[0]=input; lp[3]=lp[2]; lp[2]=y1_lp;
                let output_low = b0_lp*y1_lp + b1_lp*lp[4] + b2_lp*lp[5] - a1_c*lp[6] - a2_c*lp[7];
                lp[5]=lp[4]; lp[4]=y1_lp; lp[7]=lp[6]; lp[6]=output_low;

                let y1_hp = b0_hp*input + b1_hp*hp[0] + b2_hp*hp[1] - a1_c*hp[2] - a2_c*hp[3];
                hp[1]=hp[0]; hp[0]=input; hp[3]=hp[2]; hp[2]=y1_hp;
                let output_high = b0_hp*y1_hp + b1_hp*hp[4] + b2_hp*hp[5] - a1_c*hp[6] - a2_c*hp[7];
                hp[5]=hp[4]; hp[4]=y1_hp; hp[7]=hp[6]; hp[6]=output_high;

                for j in (0..n-1).step_by(2) {
                    let rj=self.r[j];
                    let f_in=fwd_curr[j];
                    let r_in=rev_curr[j+1];
                    let diff=rj*(f_in - r_in);
                    fwd_next[j+1]=self.g*(f_in + diff);
                    rev_next[j]=self.g*(r_in + diff);

                    let rj=self.r[j+1];
                    let f_in=fwd_curr[j+1];
                    let r_in=rev_curr[j+2];
                    let diff=rj*(f_in - r_in);
                    fwd_next[j+2]=self.g*(f_in + diff);
                    rev_next[j+1]=self.g*(r_in + diff);
                }
                if n%2==1 {
                    let j=n-1;
                    let rj=self.r[j];
                    let f_in=fwd_curr[j];
                    let r_in=rev_curr[j+1];
                    let diff=rj*(f_in - r_in);
                    fwd_next[j+1]=self.g*(f_in + diff);
                    rev_next[j]=self.g*(r_in + diff);
                }
                let fw_n = fwd_next[n];
                let refl = self.rm_b0*fw_n - self.rm_a1*rm_y1 - self.rm_a2*rm_y2;
                rev_next[n]=refl;
                rm_y2=rm_y1;
                rm_y1=refl;
                let throat_f = self.rt_b0*rev_next[0] - self.rt_a1*rt_y1;
                rt_y1=throat_f;
                fwd_next[0]=output_high + self.tr_coeff*throat_f;
                buf_idx^=1;
                let tmp_fwd=fwd_curr; fwd_curr=fwd_next; fwd_next=tmp_fwd;
                let tmp_rev=rev_curr; rev_curr=rev_next; rev_next=tmp_rev;

                let transmitted=fw_n + refl;
                let delayed=delay_buf[delay_idx];
                delay_buf[delay_idx]=output_low;
                delay_idx+=1; if delay_idx>=n {delay_idx=0;}
                data[idx]=transmitted*self.output_gain + delayed;
            }
            self.rm_y1[ch]=rm_y1;
            self.rm_y2[ch]=rm_y2;
            self.rt_y1[ch]=rt_y1;
            self.lr_low[ch]=lp;
            self.lr_high[ch]=hp;
            self.low_delay_idx[ch]=delay_idx;
            self.buf_idx[ch]=buf_idx;
        }
    }
}

