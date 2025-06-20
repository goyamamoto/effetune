#include <stdlib.h>
#include <emscripten/emscripten.h>

struct FilterState { float x1, x2, y1, y2; };

static int N = 0;
static int CHS = 0;
static float *R = NULL;
static float **fwd = NULL;
static float **rev = NULL;
static float *fw_temp = NULL;
static float *rv_temp = NULL;
static float g_damp = 0.0f;
static float trCoeff = 0.0f;

static float rm_b0, rm_a1, rm_a2;
static float *rm_y1 = NULL;
static float *rm_y2 = NULL;

static float rt_b0, rt_a1;
static float *rt_y1 = NULL;

static float b0_lp,b1_lp,b2_lp,b0_hp,b1_hp,b2_hp,a1_c,a2_c;
static struct FilterState **lp1 = NULL;
static struct FilterState **lp2 = NULL;
static struct FilterState **hp1 = NULL;
static struct FilterState **hp2 = NULL;

static float **lowDelay = NULL;
static unsigned *lowDelayIdx = NULL;
static float outputGain = 1.0f;

EMSCRIPTEN_KEEPALIVE
void init(int n, int chs) {
    N = n; CHS = chs;
    R = (float*)malloc(sizeof(float)*N);
    fwd = (float**)malloc(sizeof(float*)*CHS);
    rev = (float**)malloc(sizeof(float*)*CHS);
    for(int c=0;c<CHS;c++){
        fwd[c] = (float*)calloc(N+1,sizeof(float));
        rev[c] = (float*)calloc(N+1,sizeof(float));
    }
    fw_temp = (float*)malloc(sizeof(float)*(N+1));
    rv_temp = (float*)malloc(sizeof(float)*(N+1));

    rm_y1 = (float*)calloc(CHS,sizeof(float));
    rm_y2 = (float*)calloc(CHS,sizeof(float));
    rt_y1 = (float*)calloc(CHS,sizeof(float));

    lp1 = (struct FilterState**)malloc(sizeof(struct FilterState*)*CHS);
    lp2 = (struct FilterState**)malloc(sizeof(struct FilterState*)*CHS);
    hp1 = (struct FilterState**)malloc(sizeof(struct FilterState*)*CHS);
    hp2 = (struct FilterState**)malloc(sizeof(struct FilterState*)*CHS);
    for(int c=0;c<CHS;c++){
        lp1[c] = (struct FilterState*)calloc(1,sizeof(struct FilterState));
        lp2[c] = (struct FilterState*)calloc(1,sizeof(struct FilterState));
        hp1[c] = (struct FilterState*)calloc(1,sizeof(struct FilterState));
        hp2[c] = (struct FilterState*)calloc(1,sizeof(struct FilterState));
    }

    lowDelay = (float**)malloc(sizeof(float*)*CHS);
    lowDelayIdx = (unsigned*)calloc(CHS,sizeof(unsigned));
    for(int c=0;c<CHS;c++){
        lowDelay[c] = (float*)calloc(N,sizeof(float));
    }
}

EMSCRIPTEN_KEEPALIVE
void set_R(float* arr) {
    for(int i=0;i<N;i++) R[i] = arr[i];
}

EMSCRIPTEN_KEEPALIVE
void set_coeffs(float g, float tc,
                float rb0,float ra1,float ra2,
                float rtb0,float rta1,
                float b0lp,float b1lp,float b2lp,
                float b0hp,float b1hp,float b2hp,
                float a1c,float a2c,
                float outGain){
    g_damp = g;
    trCoeff = tc;
    rm_b0 = rb0; rm_a1 = ra1; rm_a2 = ra2;
    rt_b0 = rtb0; rt_a1 = rta1;
    b0_lp=b0lp;b1_lp=b1lp;b2_lp=b2lp;
    b0_hp=b0hp;b1_hp=b1hp;b2_hp=b2hp;
    a1_c=a1c;a2_c=a2c;
    outputGain = outGain;
}

static inline void process_channel(float* data, int bs, int ch){
    float* fw = fwd[ch];
    float* rv = rev[ch];
    struct FilterState* lp_s1 = lp1[ch];
    struct FilterState* lp_s2 = lp2[ch];
    struct FilterState* hp_s1 = hp1[ch];
    struct FilterState* hp_s2 = hp2[ch];
    float* delay = lowDelay[ch];
    unsigned idx = lowDelayIdx[ch];
    float rm_y1c = rm_y1[ch];
    float rm_y2c = rm_y2[ch];
    float rt_y1c = rt_y1[ch];

    for(int i=0;i<bs;i++){
        float in = data[i*CHS + ch];
        float y1_lp = b0_lp*in + b1_lp*lp_s1->x1 + b2_lp*lp_s1->x2 - a1_c*lp_s1->y1 - a2_c*lp_s1->y2;
        lp_s1->x2 = lp_s1->x1; lp_s1->x1 = in; lp_s1->y2 = lp_s1->y1; lp_s1->y1 = y1_lp;
        float outLow = b0_lp*y1_lp + b1_lp*lp_s2->x1 + b2_lp*lp_s2->x2 - a1_c*lp_s2->y1 - a2_c*lp_s2->y2;
        lp_s2->x2 = lp_s2->x1; lp_s2->x1 = y1_lp; lp_s2->y2 = lp_s2->y1; lp_s2->y1 = outLow;
        float y1_hp = b0_hp*in + b1_hp*hp_s1->x1 + b2_hp*hp_s1->x2 - a1_c*hp_s1->y1 - a2_c*hp_s1->y2;
        hp_s1->x2 = hp_s1->x1; hp_s1->x1 = in; hp_s1->y2 = hp_s1->y1; hp_s1->y1 = y1_hp;
        float outHigh = b0_hp*y1_hp + b1_hp*hp_s2->x1 + b2_hp*hp_s2->x2 - a1_c*hp_s2->y1 - a2_c*hp_s2->y2;
        hp_s2->x2 = hp_s2->x1; hp_s2->x1 = y1_hp; hp_s2->y2 = hp_s2->y1; hp_s2->y1 = outHigh;

        for(int j=0;j<N;j++){
            float f_in = fw[j];
            float r_in = rv[j+1];
            float scatter = R[j]*(f_in - r_in);
            fw_temp[j+1] = g_damp*(f_in + scatter);
            rv_temp[j]   = g_damp*(r_in + scatter);
        }

        float fwN = fw_temp[N];
        float reflected = rm_b0*fwN - rm_a1*rm_y1c - rm_a2*rm_y2c;
        rv_temp[N] = reflected;
        rm_y2c = rm_y1c;
        rm_y1c = reflected;

        float throatF = rt_b0*rv_temp[0] - rt_a1*rt_y1c;
        rt_y1c = throatF;
        fw_temp[0] = outHigh + trCoeff*throatF;

        for(int j=0;j<=N;j++){
            fw[j] = fw_temp[j];
            rv[j] = rv_temp[j];
        }

        float delayed = delay[idx];
        delay[idx] = outLow;
        idx++; if(idx>=N) idx=0;

        float outSample = (fwN + reflected)*outputGain + delayed;
        data[i*CHS + ch] = outSample;
    }

    lowDelayIdx[ch] = idx;
    rm_y1[ch] = rm_y1c;
    rm_y2[ch] = rm_y2c;
    rt_y1[ch] = rt_y1c;
}

EMSCRIPTEN_KEEPALIVE
void process(float* data, int bs){
    for(int ch=0; ch<CHS; ch++)
        process_channel(data, bs, ch);
}
