#include <math.h>
#include <stdint.h>
#include <stdlib.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif
#define TWO_PI (2.0f * (float)M_PI)
#define SQRT2 1.41421356237f
#define EPS 1e-9f

#define MAX_CH 2
#define MAX_N 400

typedef struct { float x1, x2, y1, y2; } Stage;

typedef struct {
    int sr, chs, bs;
    int N;
    float R[MAX_N];
    float g;
    float trCoeff;
    float fwd[2][MAX_CH][MAX_N+1];
    float rev[2][MAX_CH][MAX_N+1];
    uint8_t bufIdx[MAX_CH];
    float rm_b0, rm_a1, rm_a2;
    float rm_y1[MAX_CH];
    float rm_y2[MAX_CH];
    float rt_b0, rt_a1;
    float rt_y1[MAX_CH];
    Stage lp1[MAX_CH];
    Stage lp2[MAX_CH];
    Stage hp1[MAX_CH];
    Stage hp2[MAX_CH];
    float lowDelay[MAX_CH][MAX_N];
    int lowDelayIdx[MAX_CH];
    float b0_lp, b1_lp, b2_lp, b0_hp, b1_hp, b2_hp, a1_c, a2_c;
    float outputGain;
} HRPContext;

static HRPContext ctx;
#define MAX_BUFFER (MAX_CH * 4096)
static float io_buffer[MAX_BUFFER];

float* hrp_get_buffer() { return io_buffer; }

float powf10(float x){ return powf(10.0f, x); }

void hrp_setup(int sr, int chs, int bs, float ln, float th, float mo, float cv,
               float dp, float tr, float co, float wg) {
    if (chs > MAX_CH) chs = MAX_CH;
    ctx.sr = sr; ctx.chs = chs; ctx.bs = bs;
    float dx = 343.0f / sr;
    float L = ln / 100.0f;
    int N = (int)roundf(L / dx);
    if (N < 1) N = 1;
    if (N > MAX_N) N = MAX_N;
    ctx.N = N;
    float curveExponent = powf10(cv / 100.0f);
    float throatRadius = th / 200.0f;
    float mouthRadius  = mo / 200.0f;
    float Z[MAX_N+1];
    for (int i=0;i<=N;i++){
        float radius;
        if(i==0) radius = throatRadius;
        else if(i==N) radius = mouthRadius;
        else radius = throatRadius + (mouthRadius-throatRadius)*powf((float)i/N, curveExponent);
        float area = (float)M_PI * fmaxf(EPS, radius*radius);
        Z[i] = 413.0f / area;
    }
    for(int i=0;i<N;i++){
        float sum = Z[i]+Z[i+1];
        ctx.R[i] = (sum<EPS)?0.0f:(Z[i+1]-Z[i])/sum;
    }
    ctx.g = powf10(-dp * dx / 20.0f);
    ctx.trCoeff = tr;
    float fc_throat = (throatRadius>EPS)?343.0f/(TWO_PI*throatRadius):sr/4.0f;
    float f_norm_th = fminf(fc_throat, sr*0.45f)/sr;
    float pole_th = 0.99f * expf(-TWO_PI * f_norm_th);
    ctx.rt_b0 = 1 - pole_th;
    ctx.rt_a1 = -pole_th;
    for(int ch=0; ch<chs; ch++) ctx.rt_y1[ch]=0;
    float fc_mouth = (mouthRadius>EPS)?343.0f/(TWO_PI*mouthRadius):sr/4.0f;
    float f_norm = fminf(fc_mouth, sr*0.45f)/sr;
    float pole = 0.99f * expf(-TWO_PI * f_norm);
    ctx.rm_a1 = -2*pole;
    ctx.rm_a2 = pole*pole;
    ctx.rm_b0 = -1 - ctx.rm_a1 - ctx.rm_a2;
    for(int ch=0; ch<chs; ch++){ ctx.rm_y1[ch]=0; ctx.rm_y2[ch]=0; }
    for(int ch=0; ch<chs; ch++){
        for(int b=0;b<=N;b++){ ctx.fwd[0][ch][b]=ctx.fwd[1][ch][b]=0; ctx.rev[0][ch][b]=ctx.rev[1][ch][b]=0; }
        ctx.bufIdx[ch]=0;
        for(int i=0;i<N;i++) ctx.lowDelay[ch][i]=0;
        ctx.lowDelayIdx[ch]=0;
        ctx.lp1[ch]=(Stage){0,0,0,0};
        ctx.lp2[ch]=(Stage){0,0,0,0};
        ctx.hp1[ch]=(Stage){0,0,0,0};
        ctx.hp2[ch]=(Stage){0,0,0,0};
    }
    float crossoverFreq = fmaxf(20.0f, fminf(sr*0.5f-1.0f, co));
    float omega = tanf(crossoverFreq * (float)M_PI / sr);
    float omega2 = omega*omega;
    float k = SQRT2 * omega;
    float den = omega2 + k + 1.0f;
    float invDen = (den<EPS)?1.0f:1.0f/den;
    ctx.b0_lp = omega2 * invDen;
    ctx.b1_lp = 2.0f * ctx.b0_lp;
    ctx.b2_lp = ctx.b0_lp;
    ctx.b0_hp = invDen;
    ctx.b1_hp = -2.0f * ctx.b0_hp;
    ctx.b2_hp = ctx.b0_hp;
    ctx.a1_c = 2.0f*(omega2-1.0f)*invDen;
    ctx.a2_c = (omega2 - k + 1.0f)*invDen;
    ctx.outputGain = powf10(wg/20.0f);
}

void hrp_process(float* data){
    int chs = ctx.chs; int bs = ctx.bs; int N = ctx.N;
    float *R = ctx.R; float g=ctx.g; float trCoeff=ctx.trCoeff;
    for(int ch=0; ch<chs; ch++){
        int channelOffset = ch*bs;
        int bufIndex = ctx.bufIdx[ch];
        float *fw_current = ctx.fwd[bufIndex][ch];
        float *rv_current = ctx.rev[bufIndex][ch];
        float *fw_next = ctx.fwd[bufIndex^1][ch];
        float *rv_next = ctx.rev[bufIndex^1][ch];
        float rm_y1 = ctx.rm_y1[ch];
        float rm_y2 = ctx.rm_y2[ch];
        float rt_y1 = ctx.rt_y1[ch];
        Stage lp1 = ctx.lp1[ch];
        Stage lp2 = ctx.lp2[ch];
        Stage hp1 = ctx.hp1[ch];
        Stage hp2 = ctx.hp2[ch];
        int lowIdx = ctx.lowDelayIdx[ch];
        float* lowLine = ctx.lowDelay[ch];
        for(int i=0;i<bs;i++){
            float input = data[channelOffset+i];
            float y1_lp = ctx.b0_lp*input + ctx.b1_lp*lp1.x1 + ctx.b2_lp*lp1.x2 - ctx.a1_c*lp1.y1 - ctx.a2_c*lp1.y2;
            lp1.x2 = lp1.x1; lp1.x1=input; lp1.y2=lp1.y1; lp1.y1=y1_lp;
            float outputLow = ctx.b0_lp*y1_lp + ctx.b1_lp*lp2.x1 + ctx.b2_lp*lp2.x2 - ctx.a1_c*lp2.y1 - ctx.a2_c*lp2.y2;
            lp2.x2 = lp2.x1; lp2.x1=y1_lp; lp2.y2=lp2.y1; lp2.y1=outputLow;
            float y1_hp = ctx.b0_hp*input + ctx.b1_hp*hp1.x1 + ctx.b2_hp*hp1.x2 - ctx.a1_c*hp1.y1 - ctx.a2_c*hp1.y2;
            hp1.x2 = hp1.x1; hp1.x1=input; hp1.y2=hp1.y1; hp1.y1=y1_hp;
            float outputHigh = ctx.b0_hp*y1_hp + ctx.b1_hp*hp2.x1 + ctx.b2_hp*hp2.x2 - ctx.a1_c*hp2.y1 - ctx.a2_c*hp2.y2;
            hp2.x2 = hp2.x1; hp2.x1=y1_hp; hp2.y2=hp2.y1; hp2.y1=outputHigh;
            for(int j=0;j<N;j++){
                float Rj = R[j];
                float f_in = fw_current[j];
                float r_in = rv_current[j+1];
                float diff = Rj*(f_in - r_in);
                fw_next[j+1] = g*(f_in + diff);
                rv_next[j] = g*(r_in + diff);
            }
            float fwN = fw_next[N];
            float reflected = ctx.rm_b0*fwN - ctx.rm_a1*rm_y1 - ctx.rm_a2*rm_y2;
            rv_next[N] = reflected;
            rm_y2 = rm_y1; rm_y1 = reflected;
            float throatFiltered = ctx.rt_b0*rv_next[0] - ctx.rt_a1*rt_y1;
            rt_y1 = throatFiltered;
            fw_next[0] = outputHigh + trCoeff*throatFiltered;
            bufIndex ^= 1;
            fw_current = ctx.fwd[bufIndex][ch];
            rv_current = ctx.rev[bufIndex][ch];
            fw_next = ctx.fwd[bufIndex^1][ch];
            rv_next = ctx.rev[bufIndex^1][ch];
            float transmittedHighFreq = fwN + reflected;
            float delayedLowFreq = lowLine[lowIdx];
            lowLine[lowIdx] = outputLow;
            lowIdx++; if(lowIdx>=N) lowIdx=0;
            data[channelOffset+i] = transmittedHighFreq*ctx.outputGain + delayedLowFreq;
        }
        ctx.rm_y1[ch]=rm_y1; ctx.rm_y2[ch]=rm_y2; ctx.rt_y1[ch]=rt_y1;
        ctx.lp1[ch]=lp1; ctx.lp2[ch]=lp2; ctx.hp1[ch]=hp1; ctx.hp2[ch]=hp2;
        ctx.lowDelayIdx[ch]=lowIdx; ctx.bufIdx[ch]=bufIndex;
    }
}

