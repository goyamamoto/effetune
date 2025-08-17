// plugins/resonator/horn_resonator_plus.js

/**
 * HornResonatorPlusPlugin simulates the acoustic resonance of a horn
 * using a digital waveguide model with frequency-dependent mouth reflection
 * and adjustable throat reflection.
 */
class HornResonatorPlusPlugin extends PluginBase {
    /**
     * Initializes the Horn Resonator plugin.
     */
    constructor() {
        super('Horn Resonator Plus', 'Horn resonance emulator (enhanced)');

        // Default parameters
        this.co = 600;   // Crossover frequency (Hz)
        this.ln = 70;    // Horn length (cm)
        this.th = 3.0;   // Throat diameter (cm)
        this.mo = 60;    // Mouth diameter (cm)
        this.cv = 40;    // Curve (%)
        this.dp = 0.03;  // Damping loss (dB/meter)
        this.tr = 0.99;  // Throat reflection coefficient
        this.wg = 30.0;  // Output signal gain (dB)
        this.bl = 1.0;   // Blend between Bessel-fitted and simple mouth filter

        // Physical constants
        const C = 343;   // Speed of sound in air (m/s)
        const RHO_C = 413; // Characteristic impedance of air (Pa*s/m^3)

        this.registerProcessor(`
            // -------- Constants inside processor scope --------
            const C = 343;      // Speed of sound in air (m/s)
            const RHO_C = 413;  // Characteristic impedance of air (Pa*s/m^3)
            const PI = Math.PI;
            const TWO_PI = 2 * PI;
            const SQRT2 = Math.SQRT2;
            const EPS = 1e-9;   // Small epsilon value to prevent division by zero or instability
            const DC_OFFSET = 1e-25; // Small DC offset to stabilize filters

            // -------- Utility: polynomial Horner and Bessel J1/Y1 approximations --------
            function hHorner(arr, v) { let z = 0; for (let i = 0; i < arr.length; ++i) z = z * v + arr[i]; return z; }

            // Approximate Bessel J1(x). Coeffs adapted for numeric stability across ranges.
            function hBesselJ1(x) {
                const W = 0.636619772; // 2/PI
                const ax = Math.abs(x);
                const a1 = [72362614232.0, -7895059235.0, 242396853.1, -2972611.439, 15704.48260, -30.16036606];
                const a2 = [144725228442.0, 2300535178.0, 18583304.74, 99447.43394, 376.9991397, 1.0];
                const b1 = [1.0, 0.00183105, -3.516396496e-5, 2.457520174e-6, -2.40337019e-7];
                const b2 = [0.04687499995, -2.002690873e-4, 8.449199096e-6, -8.8228987e-7, 1.05787412e-7];
                let y = x * x;
                if (ax < 8.0) {
                    return x * hHorner(a1.slice().reverse(), y) / hHorner(a2.slice().reverse(), y);
                }
                y = 64.0 / y;
                const xx = ax - 2.356194491;
                let ans = Math.sqrt(W / ax) * (Math.cos(xx) * hHorner(b1.slice().reverse(), y) - Math.sin(xx) * hHorner(b2.slice().reverse(), y) * 8 / ax);
                return x < 0 ? -ans : ans;
            }

            // Approximate Bessel Y1(x). Coeffs adapted for numeric stability across ranges.
            function hBesselY1(x) {
                const W = 0.636619772; // 2/PI
                if (x < 8.0) {
                    const y = x * x;
                    const a1 = [-0.4900604943e13, 0.1275274390e13, -0.5153438139e11, 0.7349264551e9, -0.4237922726e7, 0.8511937935e4];
                    const a2 = [2.49958057e13, 4.244419664e11, 3.733650367e9, 2.245904002e7, 1.02042605e5, 3.549632885e2, 1.0];
                    const term1 = x * hHorner(a1.slice().reverse(), y);
                    const term2 = hHorner(a2.slice().reverse(), y);
                    return term1 / term2 + W * (hBesselJ1(x) * Math.log(x) - 1 / x);
                }
                const y = 64.0 / (x * x);
                const xx = x - 2.356194491;
                const b1 = [1.0, 0.00183105, -3.516396496e-5, 2.457520174e-6, -2.40337019e-7];
                const b2 = [0.04687499995, -2.002690873e-4, 8.449199096e-6, -8.8228987e-7, 1.05787412e-7];
                return Math.sqrt(W / x) * (Math.sin(xx) * hHorner(b1.slice().reverse(), y) + Math.cos(xx) * hHorner(b2.slice().reverse(), y) * 8 / x);
            }

            // -------- Complex arithmetic helpers (arrays [re, im]) --------
            const cAdd = (a,b)=>[a[0]+b[0], a[1]+b[1]];
            const cSub = (a,b)=>[a[0]-b[0], a[1]-b[1]];
            const cMul = (a,b)=>[a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]];
            const cConj= (a)=>[a[0], -a[1]];
            const cAbs2= (a)=>a[0]*a[0]+a[1]*a[1];
            const cDiv = (a,b)=>{
                const d = cAbs2(b) + EPS;
                return [(a[0]*b[0]+a[1]*b[1])/d, (a[1]*b[0]-a[0]*b[1])/d];
            };
            const e_jw = (w)=>[Math.cos(w), Math.sin(w)];

            // Solve 2x2 normal equations (real symmetric positive definite)
            function solve2x2(S11,S12,S22,t1,t2){
                const det = S11*S22 - S12*S12;
                if (Math.abs(det) < 1e-12) return [0,0];
                const inv = 1.0/det;
                return [ ( S22*t1 - S12*t2)*inv, (-S12*t1 + S11*t2)*inv ];
            }

            // -------- Passive clamp helper: compute convex mix toward -1 --------
            function computePassiveMix(b0, a1, a2, sr) {
                // Base log grid
                const fmin = 5.0;
                const fmax = Math.max(40.0, 0.45 * sr);
                const K = 160; // dense for higher-Q safety
                const grid = [];
                for (let i = 0; i < K; i++) {
                    const t = i / (K - 1);
                    grid.push(fmin * Math.pow(fmax / fmin, t));
                }
                // Add local dense probes near the resonant angle if a2 > 0 (complex poles)
                if (a2 > 0 && a2 < 0.999999) {
                    const r = Math.sqrt(a2);
                    const cosw0 = -a1 / (2 * r);
                    if (cosw0 > -1 && cosw0 < 1) {
                        const w0 = Math.acos(cosw0);
                        const f0 = (w0 * sr) / TWO_PI;
                        const cand = [0.8, 0.9, 0.95, 1.0, 1.05, 1.1, 1.25, 1.4].map(m => f0 * m);
                        for (const f of cand) {
                            if (f > fmin && f < fmax) grid.push(f);
                        }
                        if (r > 0.985) { // very sharp
                            [0.975, 1.025, 1.075, 1.125].forEach(m => {
                                const f = f0 * m;
                                if (f > fmin && f < fmax) grid.push(f);
                            });
                        }
                    }
                }
                grid.sort((a,b)=>a-b);

                let maxMag = 0.0;
                for (const f of grid) {
                    const w = TWO_PI * f / sr;
                    const cw = Math.cos(w),  sw = Math.sin(w);
                    const c2 = Math.cos(2*w), s2 = Math.sin(2*w);
                    const den_re = 1 + a1*cw + a2*c2;
                    const den_im = -a1*sw - a2*s2;
                    const den_mag = Math.hypot(den_re, den_im) + EPS;
                    const Hmag = Math.abs(b0) / den_mag;
                    if (Hmag > maxMag) maxMag = Hmag;
                }
                if (!isFinite(maxMag) || maxMag <= 0) return 1.0;
                return Math.min(1.0, 1.0 / (maxMag + 1e-6)); // s ∈ (0,1]
            }

            // -------- Bessel-based normalized radiation impedance z(ka) ≈ R + jX --------
            // For a circular piston in an infinite baffle, exact formulas involve Struve H1.
            // We adopt a practical approximation using J1, Y1 with low-frequency blending:
            //   R_lf ≈ (ka)^2 / 2,  X_lf ≈ (8/(3π)) * ka   (valid for ka << 1)
            // Then blend toward the J1/Y1-based form as ka grows.
            function normalizedRadiationImpedance(ka){
                if (ka < 1e-6) return [0.0, 0.0]; // z ~ 0 => Γ ≈ -1 at DC
                const J1 = hBesselJ1(2*ka);
                const Y1 = hBesselY1(2*ka);

                // Baseline
                let zr = 1 - (J1 / ka);
                let zi = - (Y1 / ka);

                // Low-frequency correction blend (improves behavior for ka ≲ 0.6)
                if (ka < 0.6) {
                    const R_lf = 0.5 * ka * ka;
                    const X_lf = (8.0 / (3.0 * Math.PI)) * ka;
                    const w = Math.max(0, Math.min(1, (0.6 - ka)/0.6)); // w→1 at ka→0
                    zr = zr*(1-w) + R_lf*w;
                    zi = zi*(1-w) + X_lf*w;
                }
                return [zr, zi];
            }

            // -------- Early exit if disabled --------
            if (!parameters.en) return data;

            const sr  = parameters.sampleRate;
            const chs = parameters.channelCount;
            const bs  = parameters.blockSize;

            // Determine if state/coefficients must be recalculated
            const needsRecalc = !context.initialized ||
                                context.sr  !== sr ||
                                context.chs !== chs ||
                                ['ln','th','mo','cv','dp','tr','co','wg','bl']
                                .some(key => context[key] !== parameters[key]);

            /* ---------- 1) Recalculate geometry & filters if needed ---------- */
            if (needsRecalc) {
                // Cache parameters in context
                context.sr  = sr;
                context.chs = chs;
                context.ln = parameters.ln;
                context.th = parameters.th;
                context.mo = parameters.mo;
                context.cv = parameters.cv;
                context.dp = parameters.dp;
                context.tr = parameters.tr;
                context.co = parameters.co;
                context.wg = parameters.wg;
                context.bl = parameters.bl;

                // ---- Horn geometry discretization ----
                const dx = C / sr;              // spatial step via CFL (one sample per dx)
                const L  = context.ln / 100;    // horn length [m]
                const N  = Math.max(1, Math.round(L / dx)); // number of segments
                context.N = N;

                const curveExponent = Math.pow(10, context.cv / 100); // flare exponent
                const throatRadius = context.th / 200; // [m] (diameter in cm -> radius in m)
                const mouthRadius  = context.mo / 200; // [m]

                // Allocate impedance and reflection arrays
                if (!context.Z || context.Z.length !== N + 1) {
                    context.Z = new Float32Array(N + 1); // impedance at section boundaries
                    context.R = new Float32Array(N);     // reflection between sections
                }
                const Z = context.Z;
                const R = context.R;

                // Boundary impedance Z[i] from local cross-sectional area
                for (let i = 0; i <= N; i++) {
                    let radius;
                    if (i === 0) {
                        radius = throatRadius;
                    } else if (i === N) {
                        radius = mouthRadius;
                    } else {
                        // Power interpolation controlled by curveExponent
                        radius = throatRadius + (mouthRadius - throatRadius) * Math.pow(i / N, curveExponent);
                    }
                    const area = PI * Math.max(EPS, radius * radius);
                    Z[i] = RHO_C / area;
                }

                // Local reflection coefficients between adjacent sections
                for (let i = 0; i < N; i++) {
                    const Zi = Z[i];
                    const Zi1 = Z[i+1];
                    const sumZ = Zi + Zi1;
                    R[i] = (sumZ < EPS) ? 0 : (Zi1 - Zi) / sumZ;
                }

                // Per-segment attenuation from dp [dB/m]
                context.g = Math.pow(10, -context.dp * dx / 20);
                // Base throat reflection scalar
                context.trCoeff = context.tr;

                /* ---- Throat reflection filter (frequency-shaped) ----
                   A gentle 1st-order low-pass on the returning wave: low frequencies reflect more. */
                const effectiveThroatRadius = throatRadius;
                const fc_throat = (effectiveThroatRadius > EPS) ? C / (TWO_PI * effectiveThroatRadius) : sr / 4;
                const f_norm_th = Math.min(fc_throat, sr * 0.45) / sr;
                const pole_th = 0.99 * Math.exp(-TWO_PI * f_norm_th); // inside unit circle
                context.rt_b0 = 1 - pole_th;
                context.rt_a1 = -pole_th;
                if (!context.rt_y1_states || context.rt_y1_states.length !== chs) {
                    context.rt_y1_states = new Float32Array(chs).fill(0);
                } else {
                    context.rt_y1_states.fill(0);
                }

                /* ---- Mouth reflection filter H_R(z) design (multi-point Bessel fit) ----
                   We fit a 2nd-order IIR of the form:
                       H_R(z) = b0 / (1 + a1 z^-1 + a2 z^-2)
                   subject to DC constraint H_R(1) = -1, while least-squares fitting
                   the complex reflection Γ(f) over multiple frequency samples. */
                const effectiveMouthRadius = mouthRadius;
                const a_mouth = effectiveMouthRadius;
                const nyq = 0.5 * sr;
                const fc_mouth = (a_mouth > EPS) ? C / (TWO_PI * a_mouth) : sr / 4;

                // --- Improved frequency sampling for LS fit ---
                const fc_ref = Math.min(fc_mouth, 0.30 * sr); // keep reference safely inside band
                const fmin = Math.max(1.0, 0.05 * fc_ref);
                const fmax = Math.min(0.45 * sr, 6.0 * fc_ref);
                const Nfit = 40; // 36–48 recommended
                const freqs = [];
                for (let i = 0; i < Nfit; i++) {
                    const t = i / (Nfit - 1);
                    freqs.push(fmin * Math.pow(fmax / fmin, t));
                }
                // Anchor multiples around fc_mouth
                [0.25, 0.5, 1.0, 2.0, 4.0].forEach(m => {
                    const f = m * fc_mouth;
                    if (f > fmin && f < fmax && !freqs.some(x => Math.abs(x - f) < 1e-6)) freqs.push(f);
                });
                freqs.sort((a,b)=>a-b);

                // Build normal equations for a1, a2 with weights centered at fc_ref (log-Gaussian)
                let S11=0, S22=0, S12=0, T1=0, T2=0;
                for (let k=0;k<freqs.length;k++){
                    const f = freqs[k];
                    const w = TWO_PI * f / sr;
                    const ka = TWO_PI * f * a_mouth / C;

                    // Radiation impedance z = R + jX
                    const z = normalizedRadiationImpedance(ka);
                    // Reflection Γ = (z - 1) / (z + 1)
                    const Gamma = (( )=>{
                        const num = cSub(z, [1,0]);
                        const den = cAdd(z, [1,0]);
                        return cDiv(num, den);
                    })();

                    const ejw  = e_jw(-w);
                    const ej2w = e_jw(-2*w);

                    const A1 = cAdd( cMul(Gamma, ejw),  [1,0] );
                    const A2 = cAdd( cMul(Gamma, ej2w), [1,0] );
                    const b  = cMul( [-1,0], cAdd(Gamma, [1,0]) ); // - (Γ + 1)

                    // Log-Gaussian weight around fc_ref (σ ≈ 0.5 oct)
                    const d = Math.log2( (f+1e-6) / (fc_ref+1e-6) );
                    const weight = 0.5 + Math.exp( - (d*d) / (0.5*0.5) );

                    const A1A1 = cAbs2(A1);
                    const A2A2 = cAbs2(A2);
                    const A1A2 = ( cMul( cConj(A1), A2 ) )[0]; // real part
                    const A1b  = ( cMul( cConj(A1), b  ) )[0];
                    const A2b  = ( cMul( cConj(A2), b  ) )[0];

                    S11 += weight * A1A1;
                    S22 += weight * A2A2;
                    S12 += weight * A1A2;
                    T1  += weight * A1b;
                    T2  += weight * A2b;
                }

                // Solve for a1, a2
                let [bessel_a1, bessel_a2] = solve2x2(S11,S12,S22,T1,T2);

                // Stabilize: ensure poles inside unit circle (|p| < 0.995).
                const discr = bessel_a1*bessel_a1 - 4*bessel_a2;
                if (discr >= 0) {
                    // Real roots
                    let r1 = (-bessel_a1 + Math.sqrt(discr)) / 2;
                    let r2 = (-bessel_a1 - Math.sqrt(discr)) / 2;
                    const maxR = Math.max(Math.abs(r1), Math.abs(r2));
                    if (maxR >= 0.995) {
                        const s = 0.995 / (maxR + 1e-9);
                        bessel_a1 *= s;
                        bessel_a2 *= s*s;
                    }
                } else {
                    // Complex conjugate roots; modulus r = sqrt(a2) if a2 > 0
                    const r = Math.sqrt(Math.abs(bessel_a2));
                    if (r >= 0.995) {
                        const s = 0.995 / (r + 1e-9);
                        bessel_a1 *= s;      // scale a1 linearly
                        bessel_a2 *= s*s;    // scale a2 quadratically to scale pole radius
                    }
                }

                // Enforce DC reflection of -1: H_R(1) = b0 / (1 + a1 + a2) = -1  => b0 = -(1 + a1 + a2)
                const bessel_b0 = -1 - bessel_a1 - bessel_a2;

                // ---- Simple 2-pole model for bright emphasis (kept for blending) ----
                const f_norm_mouth = Math.min(fc_mouth, sr * 0.45) / sr;
                const poleSimple = 0.99 * Math.exp(-TWO_PI * f_norm_mouth);
                const simple_a1 = -2 * poleSimple;
                const simple_a2 = poleSimple * poleSimple;
                const simple_b0 = -1 - simple_a1 - simple_a2;

                // Blend (0 = physically fitted, 1 = simple bright model)
                const blend = Math.max(0, Math.min(1, parameters.bl));
                context.bl    = blend;
                context.rm_a1 = bessel_a1 * (1 - blend) + simple_a1 * blend;
                context.rm_a2 = bessel_a2 * (1 - blend) + simple_a2 * blend;
                context.rm_b0 = bessel_b0 * (1 - blend) + simple_b0 * blend;

                // Passive clamp: precompute convex mix factor s ∈ (0,1]
                context.rm_mix = computePassiveMix(context.rm_b0, context.rm_a1, context.rm_a2, sr);

                // Allocate mouth reflection filter states
                if (!context.rm_y1_states || context.rm_y1_states.length !== chs) {
                    context.rm_y1_states = new Float32Array(chs).fill(0); // y[n-1]
                    context.rm_y2_states = new Float32Array(chs).fill(0); // y[n-2]
                } else {
                    context.rm_y1_states.fill(0);
                    context.rm_y2_states.fill(0);
                }

                // ---- Waveguide delay-line buffers (double-buffered forward/reverse) ----
                const needsNewBuffers =
                    !context.fwd || context.fwd.length !== chs ||
                    !context.fwd[0] || context.fwd[0][0]?.length !== N + 1;

                if (needsNewBuffers) {
                    context.fwd = Array.from({length: chs}, () => [
                        new Float32Array(N + 1).fill(0),
                        new Float32Array(N + 1).fill(0)
                    ]);
                    context.rev = Array.from({length: chs}, () => [
                        new Float32Array(N + 1).fill(0),
                        new Float32Array(N + 1).fill(0)
                    ]);
                    context.bufIdx = new Uint8Array(chs).fill(0);
                } else {
                    for (let ch = 0; ch < chs; ++ch) {
                        context.fwd[ch][0].fill(0);
                        context.fwd[ch][1].fill(0);
                        context.rev[ch][0].fill(0);
                        context.rev[ch][1].fill(0);
                    }
                    context.bufIdx.fill(0);
                }

                /* ---- 4th-order Linkwitz-Riley crossover initialization ---- */
                const crossoverFreq = Math.max(20, Math.min(sr * 0.5 - 1, context.co));
                const omega = Math.tan(crossoverFreq * PI / sr); // bilinear prewarp (one-pole prototype)
                const omega2 = omega * omega;
                const k = SQRT2 * omega; // Butterworth factor
                const den = omega2 + k + 1.0;
                const invDen = (den < EPS) ? 1.0 : 1.0 / den;

                // 2nd-order sections (same for LP and HP; LR4 = cascade of Butterworths)
                const b0_lp = omega2 * invDen;
                const b1_lp = 2.0 * b0_lp;
                const b2_lp = b0_lp;
                const b0_hp = invDen;
                const b1_hp = -2.0 * b0_hp;
                const b2_hp = b0_hp;
                const a1_c = 2.0 * (omega2 - 1.0) * invDen;
                const a2_c = (omega2 - k + 1.0) * invDen;
                context.lrCoeffs = { b0_lp, b1_lp, b2_lp, b0_hp, b1_hp, b2_hp, a1_c, a2_c };

                // Initialize crossover filter DF-II states: [x1_1, x2_1, y1_1, y2_1, x1_2, x2_2, y1_2, y2_2]
                const initStage = () => new Float32Array([
                    DC_OFFSET, -DC_OFFSET, DC_OFFSET, -DC_OFFSET,
                    DC_OFFSET, -DC_OFFSET, DC_OFFSET, -DC_OFFSET
                ]);
                const createCrossoverArray = () => Array.from({length: chs}, () => initStage());
                if (!context.lrStates || !context.lrStates.low || context.lrStates.low.length !== chs) {
                    context.lrStates = {
                        low: createCrossoverArray(),
                        high: createCrossoverArray()
                    };
                } else {
                    for (let ch = 0; ch < chs; ++ch) {
                        context.lrStates.low[ch] = initStage();
                        context.lrStates.high[ch] = initStage();
                    }
                }

                // Low-band pure delay of N samples (to align with waveguide travel time)
                if (!context.lowDelay || context.lowDelay.length !== chs || context.lowDelay[0]?.length !== N) {
                    context.lowDelay = Array.from({length: chs}, () => new Float32Array(N).fill(0));
                    context.lowDelayIdx = new Uint32Array(chs).fill(0);
                } else {
                    for(let ch = 0; ch < chs; ++ch) {
                        context.lowDelay[ch].fill(0);
                    }
                    context.lowDelayIdx.fill(0);
                }

                // Output gain (linear)
                context.outputGain = Math.pow(10, context.wg / 20);

                context.initialized = true;
            } // end needsRecalc

            /* ------------------ 2) Sample processing loop ------------------ */
            const N = context.N;
            const R = context.R;
            const g = context.g;
            const trCoeff = context.trCoeff;

            const fwd = context.fwd; // [chs][2][N+1]
            const rev = context.rev; // [chs][2][N+1]

            // Mouth reflection filter (2nd-order IIR, DF-I form with output recursion)
            const rm_b0 = context.rm_b0;
            const rm_a1 = context.rm_a1;
            const rm_a2 = context.rm_a2;
            const rm_y1_states = context.rm_y1_states;
            const rm_y2_states = context.rm_y2_states;

            // Throat reflection filter (1st-order IIR on returning wave)
            const rt_b0 = context.rt_b0;
            const rt_a1 = context.rt_a1;
            const rt_y1_states = context.rt_y1_states;

            // Crossover filter coefficients and states
            const { b0_lp, b1_lp, b2_lp, b0_hp, b1_hp, b2_hp, a1_c, a2_c } = context.lrCoeffs;
            const lpStates = context.lrStates.low;
            const hpStates = context.lrStates.high;

            // Low-band delay
            const lowDelay = context.lowDelay;
            const lowDelayIdx = context.lowDelayIdx;

            const outputGain = context.outputGain;

            // ---- Per-channel processing ----
            for (let ch = 0; ch < chs; ch++) {
                const channelOffset = ch * bs;
                let bufIndex = context.bufIdx[ch];
                let fw_current = fwd[ch][bufIndex];
                let rv_current = rev[ch][bufIndex];
                let fw_next    = fwd[ch][bufIndex ^ 1];
                let rv_next    = rev[ch][bufIndex ^ 1];

                // Load mouth filter states
                let rm_y1 = rm_y1_states[ch];
                let rm_y2 = rm_y2_states[ch];

                // Load throat filter state
                let rt_y1 = rt_y1_states[ch];

                const lpState = lpStates[ch];
                const hpState = hpStates[ch];

                let currentLowDelayWriteIdx = lowDelayIdx[ch];
                const currentLowDelayLine = lowDelay[ch];

                // ---- Per-sample loop ----
                for (let i = 0; i < bs; i++) {
                    const inputSample = data[channelOffset + i];

                    // ---- 4th-order Linkwitz-Riley split ----
                    let y1_lp, y1_hp;
                    let outputLow, outputHigh;

                    // Low-pass, stage 1 (DF-II transposed)
                    y1_lp = b0_lp * inputSample + b1_lp * lpState[0] + b2_lp * lpState[1] - a1_c * lpState[2] - a2_c * lpState[3];
                    lpState[1] = lpState[0]; lpState[0] = inputSample; lpState[3] = lpState[2]; lpState[2] = y1_lp;
                    // Low-pass, stage 2
                    outputLow = b0_lp * y1_lp + b1_lp * lpState[4] + b2_lp * lpState[5] - a1_c * lpState[6] - a2_c * lpState[7];
                    lpState[5] = lpState[4]; lpState[4] = y1_lp; lpState[7] = lpState[6]; lpState[6] = outputLow;

                    // High-pass, stage 1
                    y1_hp = b0_hp * inputSample + b1_hp * hpState[0] + b2_hp * hpState[1] - a1_c * hpState[2] - a2_c * hpState[3];
                    hpState[1] = hpState[0]; hpState[0] = inputSample; hpState[3] = hpState[2]; hpState[2] = y1_hp;
                    // High-pass, stage 2
                    outputHigh = b0_hp * y1_hp + b1_hp * hpState[4] + b2_hp * hpState[5] - a1_c * hpState[6] - a2_c * hpState[7];
                    hpState[5] = hpState[4]; hpState[4] = y1_hp; hpState[7] = hpState[6]; hpState[6] = outputHigh;

                    // ---- Scatter waves along the horn (energy-conserving junctions) ----
                    for (let j = 0, Rj, f_in, r_in, scatterDiff; j < N - 1; j += 2) {
                        // Even junction j
                        Rj = R[j];
                        f_in = fw_current[j];
                        r_in = rv_current[j + 1];
                        scatterDiff = Rj * (f_in - r_in);
                        fw_next[j + 1] = g * (f_in + scatterDiff);
                        rv_next[j]     = g * (r_in + scatterDiff);

                        // Odd junction j+1
                        Rj = R[j + 1];
                        f_in = fw_current[j + 1];
                        r_in = rv_current[j + 2];
                        scatterDiff = Rj * (f_in - r_in);
                        fw_next[j + 2] = g * (f_in + scatterDiff);
                        rv_next[j + 1] = g * (r_in + scatterDiff);
                    }
                    if (N & 1) {
                        // Last junction if N is odd
                        const j = N - 1;
                        const Rj = R[j];
                        const f_in = fw_current[j];
                        const r_in = rv_current[j + 1];
                        const scatterDiff = Rj * (f_in - r_in);
                        fw_next[j + 1] = g * (f_in + scatterDiff);
                        rv_next[j]     = g * (r_in + scatterDiff);
                    }

                    // ---- Mouth boundary (index N): frequency-dependent reflection with passive clamp ----
                    const fwN = fw_next[N]; // incoming forward wave at the mouth boundary

                    // Raw 2nd-order IIR enforcing DC reflection of -1 via b0
                    const yMouth = rm_b0 * fwN - rm_a1 * rm_y1 - rm_a2 * rm_y2;
                    // Passive convex mixing toward -1 to keep |Γ|≤~1 over scanned band
                    const sMix = (context.rm_mix === undefined) ? 1.0 : context.rm_mix;
                    const reflectedMouthWave = sMix * yMouth + (1 - sMix) * (-fwN);
                    rv_next[N] = reflectedMouthWave;
                    // Update mouth filter states with UNMIXED output to preserve recursion
                    rm_y2 = rm_y1;
                    rm_y1 = yMouth;

                    // ---- Throat boundary (index 0): input injection + low-shelved reflection ----
                    // Low frequencies reflect more due to the first-order LP on returning wave.
                    const throatFiltered = rt_b0 * rv_next[0] - rt_a1 * rt_y1;
                    rt_y1 = throatFiltered;
                    fw_next[0] = outputHigh + trCoeff * throatFiltered;

                    // ---- Swap double buffers ----
                    bufIndex ^= 1;
                    fw_current = fwd[ch][bufIndex];
                    rv_current = rev[ch][bufIndex];
                    fw_next    = fwd[ch][bufIndex ^ 1];
                    rv_next    = rev[ch][bufIndex ^ 1];

                    // ---- Form output ----
                    const transmittedHighFreq = fwN + reflectedMouthWave; // boundary pressure proxy
                    const delayedLowFreq = currentLowDelayLine[currentLowDelayWriteIdx];
                    currentLowDelayLine[currentLowDelayWriteIdx] = outputLow; // write current low
                    currentLowDelayWriteIdx++;
                    if (currentLowDelayWriteIdx >= N) currentLowDelayWriteIdx = 0;

                    data[channelOffset + i] = transmittedHighFreq * outputGain + delayedLowFreq;
                } // end sample loop

                // Store updated states
                rm_y1_states[ch] = rm_y1;
                rm_y2_states[ch] = rm_y2;
                rt_y1_states[ch] = rt_y1;
                lowDelayIdx[ch]  = currentLowDelayWriteIdx;
                context.bufIdx[ch] = bufIndex;
            } // end channel loop

            return data;
        `);
    }

    /**
     * Retrieves the current parameter values.
     * @returns {object} Current parameter settings.
     */
    getParameters() {
        return {
            type: this.constructor.name,
            enabled: this.enabled,
            en: this.enabled,
            ln: this.ln, th: this.th, mo: this.mo,
            cv: this.cv,
            dp: this.dp, wg: this.wg,
            tr: this.tr,
            co: this.co,
            bl: this.bl
        };
    }

    /**
     * Sets the parameters of the plugin.
     * @param {object} p - New parameter values.
     */
    setParameters(p) {
        let up = false;
        const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

        // Geometry & damping
        if (p.ln !== undefined && !isNaN(p.ln)) { this.ln = clamp(+p.ln, 20, 120); up = true; }
        if (p.th !== undefined && !isNaN(p.th)) { this.th = clamp(+p.th, 0.5, 50); up = true; }
        if (p.mo !== undefined && !isNaN(p.mo)) { this.mo = clamp(+p.mo, 5, 200);  up = true; }
        if (p.cv !== undefined && !isNaN(p.cv)) { this.cv = clamp(+p.cv, -100, 100); up = true; }
        if (p.dp !== undefined && !isNaN(p.dp)) { this.dp = clamp(+p.dp, 0, 10);   up = true; }
        if (p.wg !== undefined && !isNaN(p.wg)) { this.wg = clamp(+p.wg, -36, 36); up = true; }
        if (p.bl !== undefined && !isNaN(p.bl)) { this.bl = clamp(+p.bl, 0, 1);     up = true; }

        // Reflection & crossover
        if (p.tr !== undefined && !isNaN(p.tr)) { this.tr = clamp(+p.tr, 0, 0.99);  up = true; }
        if (p.co !== undefined && !isNaN(p.co)) { this.co = clamp(+p.co, 20, 5000); up = true; }

        if (up) this.updateParameters();
    }

    /**
     * Creates the HTML user interface for the plugin.
     * @returns {HTMLElement} The root element of the UI.
     */
    createUI() {
        const c = document.createElement('div');
        c.className = 'plugin-parameter-ui horn-resonator-plus-ui';

        // Sliders (keep labels consistent with original UI)
        c.appendChild(this.createParameterControl('Crossover', 20, 5000, 10, this.co, (v) => this.setParameters({ co: v }), 'Hz'));
        c.appendChild(this.createParameterControl('Horn Length', 20, 120, 1, this.ln, (v) => this.setParameters({ ln: v }), 'cm'));
        c.appendChild(this.createParameterControl('Throat Dia.', 0.5, 50, 0.1, this.th, (v) => this.setParameters({ th: v }), 'cm'));
        c.appendChild(this.createParameterControl('Mouth Dia.', 5, 200, 0.5, this.mo, (v) => this.setParameters({ mo: v }), 'cm'));
        c.appendChild(this.createParameterControl('Curve', -100, 100, 1, this.cv, (v) => this.setParameters({ cv: v }), '%'));
        c.appendChild(this.createParameterControl('Damping', 0, 10, 0.01, this.dp, (v) => this.setParameters({ dp: v }), 'dB/m'));
        c.appendChild(this.createParameterControl('Throat Refl.', 0, 0.99, 0.01, this.tr, (v) => this.setParameters({ tr: v })));
        c.appendChild(this.createParameterControl('Output Gain', -36, 36, 0.1, this.wg, (v) => this.setParameters({ wg: v }), 'dB'));
        c.appendChild(this.createParameterControl('Brightness', 0, 1, 0.01, this.bl, (v) => this.setParameters({ bl: v })));

        return c;
    }
}

// Export the class
window.HornResonatorPlusPlugin = HornResonatorPlusPlugin;
