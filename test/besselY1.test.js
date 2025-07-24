const assert = require('assert');

function hHorner(arr, v) { let z = 0; for (let i = 0; i < arr.length; ++i) z = z * v + arr[i]; return z; }
function hBesselJ1(x) {
    const W = 0.636619772;
    const ax = Math.abs(x);
    const a1 = [72362614232.0, -7895059235.0, 242396853.1, -2972611.439, 15704.48260, -30.16036606];
    const a2 = [144725228442.0, 2300535178.0, 18583304.74, 99447.43394, 376.9991397, 1.0];
    const b1 = [1.0, 0.00183105, -3.516396496e-6, 2.457520174e-8, -2.40337019e-10];
    const b2 = [0.04687499995, -2.002690873e-4, 8.449199096e-6, -8.8228987e-8, 1.05787412e-8];
    let y = x * x;
    if (ax < 8.0) {
        return x * hHorner(a1.slice().reverse(), y) / hHorner(a2.slice().reverse(), y);
    }
    y = 64.0 / y;
    const xx = ax - 2.356194491;
    let ans = Math.sqrt(W / ax) * (Math.cos(xx) * hHorner(b1.slice().reverse(), y) - Math.sin(xx) * hHorner(b2.slice().reverse(), y) * 8 / ax);
    return x < 0 ? -ans : ans;
}
function hBesselY1(x) {
    const W = 0.636619772;
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

function almostEqual(a, b, tol = 1e-6) { return Math.abs(a - b) < tol; }

assert.ok(almostEqual(hBesselY1(1), -0.7812128213));
assert.ok(almostEqual(hBesselY1(3), 0.3246744248));
assert.ok(almostEqual(hBesselY1(10), 0.2490154242));
console.log('All tests passed');
