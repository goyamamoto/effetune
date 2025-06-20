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

        this.co = 600;  // Crossover frequency (Hz)
        this.ln = 70;   // Horn length (cm)
        this.th = 3.0;  // Throat diameter (cm)
        this.mo = 60;   // Mouth diameter (cm)
        this.cv = 40;   // Curve (%)
        this.dp = 0.03; // Damping loss (dB/meter)
        this.tr = 0.99; // Throat reflection coefficient
        this.wg = 30.0; // Output signal gain (dB)

        // Physical constants
        const C = 343;   // Speed of sound in air (m/s)
        const RHO_C = 413; // Characteristic impedance of air (Pa*s/m^3)

        this.registerProcessor(`
            // --- Define constants required within this processor's scope ---
            const C = 343;     // Speed of sound in air (m/s)
            const RHO_C = 413; // Characteristic impedance of air (Pa*s/m^3)
            const PI = Math.PI;
            const TWO_PI = 2 * PI;
            const SQRT2 = Math.SQRT2;
            const EPS = 1e-9;   // Small epsilon value to prevent division by zero or instability
            const DC_OFFSET = 1e-25; // Small DC offset to stabilize filters
            const WASM_BASE64 = ""
            'AGFzbQEAAAABLwdgAX8AYAJ/fwF/YAF/AX9gAABgAn9/AGAAAX9gEH19fX19fX19fX19fX19fX0AApQB' +
            'BBZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxDmFyZ3Nfc2l6ZXNfZ2V0AAEWd2FzaV9zbmFwc2hvdF9wcmV2' +
            'aWV3MQhhcmdzX2dldAABFndhc2lfc25hcHNob3RfcHJldmlldzEJcHJvY19leGl0AAADZW52H2Vtc2Ny' +
            'aXB0ZW5fbm90aWZ5X21lbW9yeV9ncm93dGgAAAMPDgMEAAYEAwUCAAECBQACBAUBcAECAgUHAQGAAoCA' +
            'AgYJAX8BQYCNwAILB6ABDQZtZW1vcnkCAARpbml0AAUGbWFsbG9jAAsFc2V0X1IABgpzZXRfY29lZmZz' +
            'AAcHcHJvY2VzcwAIGV9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUBAAZfc3RhcnQACRBfX2Vycm5vX2xv' +
            'Y2F0aW9uAAoEZnJlZQAMCXN0YWNrU2F2ZQAPDHN0YWNrUmVzdG9yZQAQCnN0YWNrQWxsb2MAEQkHAQBB' +
            'AQsBBArxTQ4DAAELhAMBCH9BjAggATYCAEGICCAANgIAQZAIIABBAnQiBhALNgIAQZQIIAFBAnQiAxAL' +
            'Igc2AgBBmAggAxALIgg2AgAgAUEASgRAIABBAWohBANAIAcgAkECdCIJaiAEQQQQDTYCACAIIAlqIARB' +
            'BBANNgIAIAJBAWoiAiABRw0ACwtBnAggBkEEaiICEAs2AgBBoAggAhALNgIAQaQIIAFBBBANNgIAQagI' +
            'IAFBBBANNgIAQawIIAFBBBANNgIAQbAIIAMQCyIENgIAQbQIIAMQCyIGNgIAQbgIIAMQCyIHNgIAQbwI' +
            'IAMQCyIINgIAIAFBAEoEQANAIAQgBUECdCICakEBQRAQDTYCACACIAZqQQFBEBANNgIAIAIgB2pBAUEQ' +
            'EA02AgAgAiAIakEBQRAQDTYCACAFQQFqIgUgAUcNAAsLQQAhAkHACCADEAsiAzYCAEHECCABQQQQDTYC' +
            'ACABQQBKBEADQCADIAJBAnRqIABBBBANNgIAIAJBAWoiAiABRw0ACwsL0QEBB38CQEGICCgCACIDQQBM' +
            'DQBBkAgoAgAhBCADQQFrQQNPBEAgA0F8cSEHA0AgBCACQQJ0IgFqIAAgAWoqAgA4AgAgBCABQQRyIgZq' +
            'IAAgBmoqAgA4AgAgBCABQQhyIgZqIAAgBmoqAgA4AgAgBCABQQxyIgFqIAAgAWoqAgA4AgAgAkEEaiEC' +
            'IAVBBGoiBSAHRw0ACwsgA0EDcSIDRQ0AQQAhAQNAIAQgAkECdCIFaiAAIAVqKgIAOAIAIAJBAWohAiAB' +
            'QQFqIgEgA0cNAAsLC4IBAEHMCCABOAIAQcgIIAA4AgBB0AggAjgCAEHUCCADOAIAQdgIIAQ4AgBB3Agg' +
            'BTgCAEHgCCAGOAIAQeQIIAc4AgBB6AggCDgCAEHsCCAJOAIAQfAIIAo4AgBB9AggCzgCAEH4CCAMOAIA' +
            'QfwIIA04AgBBgAkgDjgCAEGACCAPOAIAC8kJAiZ/GX0CQEGMCCgCACIRQQBMDQAgAUEATA0AQaAIKAIA' +
            'IgtBiAgoAgAiCUECdCICaiESQZwIKAIAIgwgAmohE0GACCoCACE6QcwIKgIAITtB3AgqAgAhPEHQCCoC' +
            'ACE9QcgIKgIAITNBkAgoAgAhFEH4CCoCACE0QfQIKgIAITVB8AgqAgAhNkHsCCoCACE3QegIKgIAIThB' +
            '5AgqAgAhOUGsCCgCACEVQagIKAIAIRZBpAgoAgAhF0HECCgCACEYQcAIKAIAIRlBvAgoAgAhGkG4CCgC' +
            'ACEbQbQIKAIAIRxBsAgoAgAhHUGYCCgCACEeQZQIKAIAIR9B4AgqAgCMIT5B2AgqAgCMIT9B1AgqAgCM' +
            'IUBBgAkqAgCMIS5B/AgqAgCMIS8gCUEBaiICQX5xISAgAkEBcSEhA0AgFSANQQJ0IgJqIiIqAgAhMSAC' +
            'IBZqIiMqAgAhMCACIBdqIiQqAgAhKCACIBhqIiUoAgAhCiACIBlqKAIAISYgAiAaaigCACEFIAIgG2oo' +
            'AgAhBiACIBxqKAIAIQcgAiAdaigCACEIIAIgHmooAgAhDiACIB9qKAIAIQJBACEQA0AgMCEyICghMCAA' +
            'IBAgEWwgDWpBAnRqIicqAgAhKCAIKgIEISwgCCAIKgIAIik4AgQgCCoCDCEqIAggCCoCCCIrOAIMIAgg' +
            'KDgCACAIIC4gKpQgLyArlCA3ICyUIDkgKJQgOCAplJKSkpIiLDgCCCAHKgIEISkgByAHKgIAIio4AgQg' +
            'ByoCDCErIAcgByoCCCItOAIMIAcgLDgCACAHIC4gK5QgLyAtlCA3ICmUIDkgLJQgOCAqlJKSkpIiLDgC' +
            'CCAGKgIEISkgBiAGKgIAIio4AgQgBioCDCErIAYgBioCCCItOAIMIAYgKDgCACAGIC4gK5QgLyAtlCA0' +
            'ICmUIDYgKJQgNSAqlJKSkpIiKDgCCCAFKgIEISkgBSAFKgIAIio4AgQgBSoCDCErIAUgBSoCCCItOAIM' +
            'IAUgKDgCACAFIC4gK5QgLyAtlCA0ICmUIDYgKJQgNSAqlJKSkpIiKTgCCEEAIQMgCUEASgRAA0AgA0EC' +
            'dCEEIAwgA0EBaiIDQQJ0Ig9qIDMgAiAEaioCACIoICggDiAPaioCACIokyAEIBRqKgIAlCIqkpQ4AgAg' +
            'BCALaiAzICggKpKUOAIAIAMgCUcNAAsLIBIgPyAylCA9IBMqAgAiMpQgMCBAlJKSIig4AgAgDCA7IDwg' +
            'CyoCAJQgMSA+lJIiMZQgKZI4AgACQCAJQQBIDQBBACEDQQAhDyAJBEADQCACIANBAnQiBGogBCAMaioC' +
            'ADgCACAEIA5qIAQgC2oqAgA4AgAgAiAEQQRyIgRqIAQgDGoqAgA4AgAgBCAOaiAEIAtqKgIAOAIAIANB' +
            'AmohAyAPQQJqIg8gIEcNAAsLICFFDQAgAiADQQJ0IgNqIAMgDGoqAgA4AgAgAyAOaiADIAtqKgIAOAIA' +
            'CyAmIApBAnRqIgMqAgAhKSADICw4AgAgJyApIDIgKJIgOpSSOAIAIApBAWoiCkEAIAkgCksbIQogEEEB' +
            'aiIQIAFHDQALICUgCjYCACAkICg4AgAgIyAwOAIAICIgMTgCACANQQFqIg0gEUcNAAsLC3MBBH8jAEEQ' +
            'ayIAJAACQCAAQQxqIABBCGoQAEUEQCAAIAAoAgxBAnQiAkETakFwcWsiASQAIAEgACgCCEEPakFwcWsi' +
            'AyQAIAEgAmpBADYCACABIAMQAQ0BIAAoAgwaA0AMAAsAC0HHABACAAtBxwAQAgALBQBBhAkL8iwBC38j' +
            'AEEQayILJAACQAJAAkACQAJAAkACQAJAAkACQAJAIABB9AFNBEBBiAkoAgAiBUEQIABBC2pBeHEgAEEL' +
            'SRsiBkEDdiIAdiIBQQNxBEACQCABQX9zQQFxIABqIgJBA3QiAUGwCWoiACABQbgJaigCACIBKAIIIgNG' +
            'BEBBiAkgBUF+IAJ3cTYCAAwBCyADIAA2AgwgACADNgIICyABQQhqIQAgASACQQN0IgJBA3I2AgQgASAC' +
            'aiIBIAEoAgRBAXI2AgQMDAsgBkGQCSgCACIHTQ0BIAEEQAJAQQIgAHQiAkEAIAJrciABIAB0cSIAQQAg' +
            'AGtxQQFrIgAgAEEMdkEQcSIAdiIBQQV2QQhxIgIgAHIgASACdiIAQQJ2QQRxIgFyIAAgAXYiAEEBdkEC' +
            'cSIBciAAIAF2IgBBAXZBAXEiAXIgACABdmoiAUEDdCIAQbAJaiICIABBuAlqKAIAIgAoAggiA0YEQEGI' +
            'CSAFQX4gAXdxIgU2AgAMAQsgAyACNgIMIAIgAzYCCAsgACAGQQNyNgIEIAAgBmoiCCABQQN0IgEgBmsi' +
            'A0EBcjYCBCAAIAFqIAM2AgAgBwRAIAdBeHFBsAlqIQFBnAkoAgAhAgJ/IAVBASAHQQN2dCIEcUUEQEGI' +
            'CSAEIAVyNgIAIAEMAQsgASgCCAshBCABIAI2AgggBCACNgIMIAIgATYCDCACIAQ2AggLIABBCGohAEGc' +
            'CSAINgIAQZAJIAM2AgAMDAtBjAkoAgAiCkUNASAKQQAgCmtxQQFrIgAgAEEMdkEQcSIAdiIBQQV2QQhx' +
            'IgIgAHIgASACdiIAQQJ2QQRxIgFyIAAgAXYiAEEBdkECcSIBciAAIAF2IgBBAXZBAXEiAXIgACABdmpB' +
            'AnRBuAtqKAIAIgIoAgRBeHEgBmshBCACIQEDQAJAIAEoAhAiAEUEQCABKAIUIgBFDQELIAAoAgRBeHEg' +
            'BmsiASAEIAEgBEkiARshBCAAIAIgARshAiAAIQEMAQsLIAIoAhghCSACIAIoAgwiA0cEQCACKAIIIgBB' +
            'mAkoAgBJGiAAIAM2AgwgAyAANgIIDAsLIAJBFGoiASgCACIARQRAIAIoAhAiAEUNAyACQRBqIQELA0Ag' +
            'ASEIIAAiA0EUaiIBKAIAIgANACADQRBqIQEgAygCECIADQALIAhBADYCAAwKC0F/IQYgAEG/f0sNACAA' +
            'QQtqIgBBeHEhBkGMCSgCACIIRQ0AQQAgBmshBAJAAkACQAJ/QQAgBkGAAkkNABpBHyAGQf///wdLDQAa' +
            'IABBCHYiACAAQYD+P2pBEHZBCHEiAHQiASABQYDgH2pBEHZBBHEiAXQiAiACQYCAD2pBEHZBAnEiAnRB' +
            'D3YgACABciACcmsiAEEBdCAGIABBFWp2QQFxckEcagsiB0ECdEG4C2ooAgAiAUUEQEEAIQAMAQtBACEA' +
            'IAZBAEEZIAdBAXZrIAdBH0YbdCECA0ACQCABKAIEQXhxIAZrIgUgBE8NACABIQMgBSIEDQBBACEEIAEh' +
            'AAwDCyAAIAEoAhQiBSAFIAEgAkEddkEEcWooAhAiAUYbIAAgBRshACACQQF0IQIgAQ0ACwsgACADckUE' +
            'QEEAIQNBAiAHdCIAQQAgAGtyIAhxIgBFDQMgAEEAIABrcUEBayIAIABBDHZBEHEiAHYiAUEFdkEIcSIC' +
            'IAByIAEgAnYiAEECdkEEcSIBciAAIAF2IgBBAXZBAnEiAXIgACABdiIAQQF2QQFxIgFyIAAgAXZqQQJ0' +
            'QbgLaigCACEACyAARQ0BCwNAIAAoAgRBeHEgBmsiAiAESSEBIAIgBCABGyEEIAAgAyABGyEDIAAoAhAi' +
            'AQR/IAEFIAAoAhQLIgANAAsLIANFDQAgBEGQCSgCACAGa08NACADKAIYIQcgAyADKAIMIgJHBEAgAygC' +
            'CCIAQZgJKAIASRogACACNgIMIAIgADYCCAwJCyADQRRqIgEoAgAiAEUEQCADKAIQIgBFDQMgA0EQaiEB' +
            'CwNAIAEhBSAAIgJBFGoiASgCACIADQAgAkEQaiEBIAIoAhAiAA0ACyAFQQA2AgAMCAsgBkGQCSgCACIB' +
            'TQRAQZwJKAIAIQACQCABIAZrIgJBEE8EQEGQCSACNgIAQZwJIAAgBmoiAzYCACADIAJBAXI2AgQgACAB' +
            'aiACNgIAIAAgBkEDcjYCBAwBC0GcCUEANgIAQZAJQQA2AgAgACABQQNyNgIEIAAgAWoiASABKAIEQQFy' +
            'NgIECyAAQQhqIQAMCgsgBkGUCSgCACICSQRAQZQJIAIgBmsiATYCAEGgCUGgCSgCACIAIAZqIgI2AgAg' +
            'AiABQQFyNgIEIAAgBkEDcjYCBCAAQQhqIQAMCgtBACEAIAZBL2oiBAJ/QeAMKAIABEBB6AwoAgAMAQtB' +
            '7AxCfzcCAEHkDEKAoICAgIAENwIAQeAMIAtBDGpBcHFB2KrVqgVzNgIAQfQMQQA2AgBBxAxBADYCAEGA' +
            'IAsiAWoiBUEAIAFrIghxIgEgBk0NCUHADCgCACIDBEBBuAwoAgAiByABaiIJIAdNDQogAyAJSQ0KC0HE' +
            'DC0AAEEEcQ0EAkACQEGgCSgCACIDBEBByAwhAANAIAMgACgCACIHTwRAIAcgACgCBGogA0sNAwsgACgC' +
            'CCIADQALC0EAEA4iAkF/Rg0FIAEhBUHkDCgCACIAQQFrIgMgAnEEQCABIAJrIAIgA2pBACAAa3FqIQUL' +
            'IAUgBk0NBSAFQf7///8HSw0FQcAMKAIAIgAEQEG4DCgCACIDIAVqIgggA00NBiAAIAhJDQYLIAUQDiIA' +
            'IAJHDQEMBwsgBSACayAIcSIFQf7///8HSw0EIAUQDiICIAAoAgAgACgCBGpGDQMgAiEACwJAIABBf0YN' +
            'ACAGQTBqIAVNDQBB6AwoAgAiAiAEIAVrakEAIAJrcSICQf7///8HSwRAIAAhAgwHCyACEA5Bf0cEQCAC' +
            'IAVqIQUgACECDAcLQQAgBWsQDhoMBAsgACICQX9HDQUMAwtBACEDDAcLQQAhAgwFCyACQX9HDQILQcQM' +
            'QcQMKAIAQQRyNgIACyABQf7///8HSw0BIAEQDiECQQAQDiEAIAJBf0YNASAAQX9GDQEgACACTQ0BIAAg' +
            'AmsiBSAGQShqTQ0BC0G4DEG4DCgCACAFaiIANgIAQbwMKAIAIABJBEBBvAwgADYCAAsCQAJAAkBBoAko' +
            'AgAiBARAQcgMIQADQCACIAAoAgAiASAAKAIEIgNqRg0CIAAoAggiAA0ACwwCC0GYCSgCACIAQQAgACAC' +
            'TRtFBEBBmAkgAjYCAAtBACEAQcwMIAU2AgBByAwgAjYCAEGoCUF/NgIAQawJQeAMKAIANgIAQdQMQQA2' +
            'AgADQCAAQQN0IgFBuAlqIAFBsAlqIgM2AgAgAUG8CWogAzYCACAAQQFqIgBBIEcNAAtBlAkgBUEoayIA' +
            'QXggAmtBB3FBACACQQhqQQdxGyIBayIDNgIAQaAJIAEgAmoiATYCACABIANBAXI2AgQgACACakEoNgIE' +
            'QaQJQfAMKAIANgIADAILIAAtAAxBCHENACABIARLDQAgAiAETQ0AIAAgAyAFajYCBEGgCSAEQXggBGtB' +
            'B3FBACAEQQhqQQdxGyIAaiIBNgIAQZQJQZQJKAIAIAVqIgIgAGsiADYCACABIABBAXI2AgQgAiAEakEo' +
            'NgIEQaQJQfAMKAIANgIADAELQZgJKAIAIAJLBEBBmAkgAjYCAAsgAiAFaiEBQcgMIQACQAJAAkACQAJA' +
            'AkADQCABIAAoAgBHBEAgACgCCCIADQEMAgsLIAAtAAxBCHFFDQELQcgMIQADQCAEIAAoAgAiAU8EQCAB' +
            'IAAoAgRqIgMgBEsNAwsgACgCCCEADAALAAsgACACNgIAIAAgACgCBCAFajYCBCACQXggAmtBB3FBACAC' +
            'QQhqQQdxG2oiByAGQQNyNgIEIAFBeCABa0EHcUEAIAFBCGpBB3EbaiIFIAYgB2oiBmshACAEIAVGBEBB' +
            'oAkgBjYCAEGUCUGUCSgCACAAaiIANgIAIAYgAEEBcjYCBAwDC0GcCSgCACAFRgRAQZwJIAY2AgBBkAlB' +
            'kAkoAgAgAGoiADYCACAGIABBAXI2AgQgACAGaiAANgIADAMLIAUoAgQiBEEDcUEBRgRAIARBeHEhCQJA' +
            'IARB/wFNBEAgBSgCCCIBIARBA3YiA0EDdEGwCWpGGiABIAUoAgwiAkYEQEGICUGICSgCAEF+IAN3cTYC' +
            'AAwCCyABIAI2AgwgAiABNgIIDAELIAUoAhghCAJAIAUgBSgCDCICRwRAIAUoAggiASACNgIMIAIgATYC' +
            'CAwBCwJAIAVBFGoiBCgCACIBDQAgBUEQaiIEKAIAIgENAEEAIQIMAQsDQCAEIQMgASICQRRqIgQoAgAi' +
            'AQ0AIAJBEGohBCACKAIQIgENAAsgA0EANgIACyAIRQ0AAkAgBSgCHCIBQQJ0QbgLaiIDKAIAIAVGBEAg' +
            'AyACNgIAIAINAUGMCUGMCSgCAEF+IAF3cTYCAAwCCyAIQRBBFCAIKAIQIAVGG2ogAjYCACACRQ0BCyAC' +
            'IAg2AhggBSgCECIBBEAgAiABNgIQIAEgAjYCGAsgBSgCFCIBRQ0AIAIgATYCFCABIAI2AhgLIAUgCWoi' +
            'BSgCBCEEIAAgCWohAAsgBSAEQX5xNgIEIAYgAEEBcjYCBCAAIAZqIAA2AgAgAEH/AU0EQCAAQXhxQbAJ' +
            'aiEBAn9BiAkoAgAiAkEBIABBA3Z0IgBxRQRAQYgJIAAgAnI2AgAgAQwBCyABKAIICyEAIAEgBjYCCCAA' +
            'IAY2AgwgBiABNgIMIAYgADYCCAwDC0EfIQQgAEH///8HTQRAIABBCHYiASABQYD+P2pBEHZBCHEiAXQi' +
            'AiACQYDgH2pBEHZBBHEiAnQiAyADQYCAD2pBEHZBAnEiA3RBD3YgASACciADcmsiAUEBdCAAIAFBFWp2' +
            'QQFxckEcaiEECyAGIAQ2AhwgBkIANwIQIARBAnRBuAtqIQECQEGMCSgCACICQQEgBHQiA3FFBEBBjAkg' +
            'AiADcjYCACABIAY2AgAMAQsgAEEAQRkgBEEBdmsgBEEfRht0IQQgASgCACECA0AgAiIBKAIEQXhxIABG' +
            'DQMgBEEddiECIARBAXQhBCABIAJBBHFqIgMoAhAiAg0ACyADIAY2AhALIAYgATYCGCAGIAY2AgwgBiAG' +
            'NgIIDAILQZQJIAVBKGsiAEF4IAJrQQdxQQAgAkEIakEHcRsiAWsiCDYCAEGgCSABIAJqIgE2AgAgASAI' +
            'QQFyNgIEIAAgAmpBKDYCBEGkCUHwDCgCADYCACAEIANBJyADa0EHcUEAIANBJ2tBB3EbakEvayIAIAAg' +
            'BEEQakkbIgFBGzYCBCABQdAMKQIANwIQIAFByAwpAgA3AghB0AwgAUEIajYCAEHMDCAFNgIAQcgMIAI2' +
            'AgBB1AxBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIANJDQALIAEgBEYNAyABIAEo' +
            'AgRBfnE2AgQgBCABIARrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUGwCWohAAJ/QYgJKAIAIgFB' +
            'ASACQQN2dCICcUUEQEGICSABIAJyNgIAIAAMAQsgACgCCAshASAAIAQ2AgggASAENgIMIAQgADYCDCAE' +
            'IAE2AggMBAtBHyEAIAJB////B00EQCACQQh2IgAgAEGA/j9qQRB2QQhxIgB0IgEgAUGA4B9qQRB2QQRx' +
            'IgF0IgMgA0GAgA9qQRB2QQJxIgN0QQ92IAAgAXIgA3JrIgBBAXQgAiAAQRVqdkEBcXJBHGohAAsgBCAA' +
            'NgIcIARCADcCECAAQQJ0QbgLaiEBAkBBjAkoAgAiA0EBIAB0IgVxRQRAQYwJIAMgBXI2AgAgASAENgIA' +
            'DAELIAJBAEEZIABBAXZrIABBH0YbdCEAIAEoAgAhAwNAIAMiASgCBEF4cSACRg0EIABBHXYhAyAAQQF0' +
            'IQAgASADQQRxaiIFKAIQIgMNAAsgBSAENgIQCyAEIAE2AhggBCAENgIMIAQgBDYCCAwDCyABKAIIIgAg' +
            'BjYCDCABIAY2AgggBkEANgIYIAYgATYCDCAGIAA2AggLIAdBCGohAAwFCyABKAIIIgAgBDYCDCABIAQ2' +
            'AgggBEEANgIYIAQgATYCDCAEIAA2AggLQZQJKAIAIgAgBk0NAEGUCSAAIAZrIgE2AgBBoAlBoAkoAgAi' +
            'ACAGaiICNgIAIAIgAUEBcjYCBCAAIAZBA3I2AgQgAEEIaiEADAMLQYQJQTA2AgBBACEADAILAkAgB0UN' +
            'AAJAIAMoAhwiAEECdEG4C2oiASgCACADRgRAIAEgAjYCACACDQFBjAkgCEF+IAB3cSIINgIADAILIAdB' +
            'EEEUIAcoAhAgA0YbaiACNgIAIAJFDQELIAIgBzYCGCADKAIQIgAEQCACIAA2AhAgACACNgIYCyADKAIU' +
            'IgBFDQAgAiAANgIUIAAgAjYCGAsCQCAEQQ9NBEAgAyAEIAZqIgBBA3I2AgQgACADaiIAIAAoAgRBAXI2' +
            'AgQMAQsgAyAGQQNyNgIEIAMgBmoiAiAEQQFyNgIEIAIgBGogBDYCACAEQf8BTQRAIARBeHFBsAlqIQAC' +
            'f0GICSgCACIBQQEgBEEDdnQiBHFFBEBBiAkgASAEcjYCACAADAELIAAoAggLIQEgACACNgIIIAEgAjYC' +
            'DCACIAA2AgwgAiABNgIIDAELQR8hACAEQf///wdNBEAgBEEIdiIAIABBgP4/akEQdkEIcSIAdCIBIAFB' +
            'gOAfakEQdkEEcSIBdCIFIAVBgIAPakEQdkECcSIFdEEPdiAAIAFyIAVyayIAQQF0IAQgAEEVanZBAXFy' +
            'QRxqIQALIAIgADYCHCACQgA3AhAgAEECdEG4C2ohAQJAAkAgCEEBIAB0IgVxRQRAQYwJIAUgCHI2AgAg' +
            'ASACNgIADAELIARBAEEZIABBAXZrIABBH0YbdCEAIAEoAgAhBgNAIAYiASgCBEF4cSAERg0CIABBHXYh' +
            'BSAAQQF0IQAgASAFQQRxaiIFKAIQIgYNAAsgBSACNgIQCyACIAE2AhggAiACNgIMIAIgAjYCCAwBCyAB' +
            'KAIIIgAgAjYCDCABIAI2AgggAkEANgIYIAIgATYCDCACIAA2AggLIANBCGohAAwBCwJAIAlFDQACQCAC' +
            'KAIcIgBBAnRBuAtqIgEoAgAgAkYEQCABIAM2AgAgAw0BQYwJIApBfiAAd3E2AgAMAgsgCUEQQRQgCSgC' +
            'ECACRhtqIAM2AgAgA0UNAQsgAyAJNgIYIAIoAhAiAARAIAMgADYCECAAIAM2AhgLIAIoAhQiAEUNACAD' +
            'IAA2AhQgACADNgIYCwJAIARBD00EQCACIAQgBmoiAEEDcjYCBCAAIAJqIgAgACgCBEEBcjYCBAwBCyAC' +
            'IAZBA3I2AgQgAiAGaiIDIARBAXI2AgQgAyAEaiAENgIAIAcEQCAHQXhxQbAJaiEAQZwJKAIAIQECf0EB' +
            'IAdBA3Z0IgYgBXFFBEBBiAkgBSAGcjYCACAADAELIAAoAggLIQUgACABNgIIIAUgATYCDCABIAA2Agwg' +
            'ASAFNgIIC0GcCSADNgIAQZAJIAQ2AgALIAJBCGohAAsgC0EQaiQAIAALpQwBB38CQCAARQ0AIABBCGsi' +
            'AiAAQQRrKAIAIgFBeHEiAGohBQJAIAFBAXENACABQQNxRQ0BIAIgAigCACIBayICQZgJKAIASQ0BIAAg' +
            'AWohAEGcCSgCACACRwRAIAFB/wFNBEAgAigCCCIEIAFBA3YiAUEDdEGwCWpGGiAEIAIoAgwiA0YEQEGI' +
            'CUGICSgCAEF+IAF3cTYCAAwDCyAEIAM2AgwgAyAENgIIDAILIAIoAhghBgJAIAIgAigCDCIBRwRAIAIo' +
            'AggiAyABNgIMIAEgAzYCCAwBCwJAIAJBFGoiBCgCACIDDQAgAkEQaiIEKAIAIgMNAEEAIQEMAQsDQCAE' +
            'IQcgAyIBQRRqIgQoAgAiAw0AIAFBEGohBCABKAIQIgMNAAsgB0EANgIACyAGRQ0BAkAgAigCHCIEQQJ0' +
            'QbgLaiIDKAIAIAJGBEAgAyABNgIAIAENAUGMCUGMCSgCAEF+IAR3cTYCAAwDCyAGQRBBFCAGKAIQIAJG' +
            'G2ogATYCACABRQ0CCyABIAY2AhggAigCECIDBEAgASADNgIQIAMgATYCGAsgAigCFCIDRQ0BIAEgAzYC' +
            'FCADIAE2AhgMAQsgBSgCBCIBQQNxQQNHDQBBkAkgADYCACAFIAFBfnE2AgQgAiAAQQFyNgIEIAAgAmog' +
            'ADYCAA8LIAIgBU8NACAFKAIEIgFBAXFFDQACQCABQQJxRQRAQaAJKAIAIAVGBEBBoAkgAjYCAEGUCUGU' +
            'CSgCACAAaiIANgIAIAIgAEEBcjYCBCACQZwJKAIARw0DQZAJQQA2AgBBnAlBADYCAA8LQZwJKAIAIAVG' +
            'BEBBnAkgAjYCAEGQCUGQCSgCACAAaiIANgIAIAIgAEEBcjYCBCAAIAJqIAA2AgAPCyABQXhxIABqIQAC' +
            'QCABQf8BTQRAIAUoAggiBCABQQN2IgFBA3RBsAlqRhogBCAFKAIMIgNGBEBBiAlBiAkoAgBBfiABd3E2' +
            'AgAMAgsgBCADNgIMIAMgBDYCCAwBCyAFKAIYIQYCQCAFIAUoAgwiAUcEQCAFKAIIIgNBmAkoAgBJGiAD' +
            'IAE2AgwgASADNgIIDAELAkAgBUEUaiIEKAIAIgMNACAFQRBqIgQoAgAiAw0AQQAhAQwBCwNAIAQhByAD' +
            'IgFBFGoiBCgCACIDDQAgAUEQaiEEIAEoAhAiAw0ACyAHQQA2AgALIAZFDQACQCAFKAIcIgRBAnRBuAtq' +
            'IgMoAgAgBUYEQCADIAE2AgAgAQ0BQYwJQYwJKAIAQX4gBHdxNgIADAILIAZBEEEUIAYoAhAgBUYbaiAB' +
            'NgIAIAFFDQELIAEgBjYCGCAFKAIQIgMEQCABIAM2AhAgAyABNgIYCyAFKAIUIgNFDQAgASADNgIUIAMg' +
            'ATYCGAsgAiAAQQFyNgIEIAAgAmogADYCACACQZwJKAIARw0BQZAJIAA2AgAPCyAFIAFBfnE2AgQgAiAA' +
            'QQFyNgIEIAAgAmogADYCAAsgAEH/AU0EQCAAQXhxQbAJaiEBAn9BiAkoAgAiA0EBIABBA3Z0IgBxRQRA' +
            'QYgJIAAgA3I2AgAgAQwBCyABKAIICyEAIAEgAjYCCCAAIAI2AgwgAiABNgIMIAIgADYCCA8LQR8hBCAA' +
            'Qf///wdNBEAgAEEIdiIBIAFBgP4/akEQdkEIcSIEdCIBIAFBgOAfakEQdkEEcSIDdCIBIAFBgIAPakEQ' +
            'dkECcSIBdEEPdiADIARyIAFyayIBQQF0IAAgAUEVanZBAXFyQRxqIQQLIAIgBDYCHCACQgA3AhAgBEEC' +
            'dEG4C2ohBwJAAkACQEGMCSgCACIDQQEgBHQiAXFFBEBBjAkgASADcjYCACAHIAI2AgAgAiAHNgIYDAEL' +
            'IABBAEEZIARBAXZrIARBH0YbdCEEIAcoAgAhAQNAIAEiAygCBEF4cSAARg0CIARBHXYhASAEQQF0IQQg' +
            'AyABQQRxaiIHQRBqKAIAIgENAAsgByACNgIQIAIgAzYCGAsgAiACNgIMIAIgAjYCCAwBCyADKAIIIgAg' +
            'AjYCDCADIAI2AgggAkEANgIYIAIgAzYCDCACIAA2AggLQagJQagJKAIAQQFrIgBBfyAAGzYCAAsLowMC' +
            'An8BfgJAAn9BACAARQ0AGiAArSABrX4iBKciAiAAIAFyQYCABEkNABpBfyACIARCIIinGwsiABALIgFF' +
            'DQAgAUEEay0AAEEDcUUNAAJAIABFDQAgAUEAOgAAIAAgAWoiAkEBa0EAOgAAIABBA0kNACABQQA6AAIg' +
            'AUEAOgABIAJBA2tBADoAACACQQJrQQA6AAAgAEEHSQ0AIAFBADoAAyACQQRrQQA6AAAgAEEJSQ0AIAFB' +
            'ACABa0EDcSICaiIDQQA2AgAgAyAAIAJrQXxxIgBqIgJBBGtBADYCACAAQQlJDQAgA0EANgIIIANBADYC' +
            'BCACQQhrQQA2AgAgAkEMa0EANgIAIABBGUkNACADQQA2AhggA0EANgIUIANBADYCECADQQA2AgwgAkEQ' +
            'a0EANgIAIAJBFGtBADYCACACQRhrQQA2AgAgAkEca0EANgIAIAAgA0EEcUEYciIAayICQSBJDQAgACAD' +
            'aiEAA0AgAEIANwMYIABCADcDECAAQgA3AwggAEIANwMAIABBIGohACACQSBrIgJBH0sNAAsLCyABC2wB' +
            'An9BhAgoAgAiASAAQQNqQXxxIgJqIQACQCACQQAgACABTRsNACAAPwBBEHRLBEAgAD8AQRB0a0H//wNq' +
            'QRB2QABBf0YEf0EABUEAEANBAQtFDQELQYQIIAA2AgAgAQ8LQYQJQTA2AgBBfwsEACMACwYAIAAkAAsQ' +
            'ACMAIABrQXBxIgAkACAACwsMAQBBgggLBYA/gAZQ' +
            '';
            const wasmBytes = Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0));
            if (!context.wasm) {
                const module = new WebAssembly.Module(wasmBytes);
                const instance = new WebAssembly.Instance(module, {});
                context.wasm = instance.exports;
            }
            const wasmMemF32 = new Float32Array(context.wasm.memory.buffer);

            // If the plugin is disabled, bypass processing.
            if (!parameters.en) return data;

            const sr  = parameters.sampleRate;
            const chs = parameters.channelCount;
            const bs  = parameters.blockSize;

            // --- Determine if recalculation of internal state is needed ---
            const needsRecalc = !context.initialized ||
                                context.sr  !== sr ||
                                context.chs !== chs ||
                                // List of parameters that necessitate recalculation
                                ['ln','th','mo','cv','dp','tr','co','wg']
                                .some(key => context[key] !== parameters[key]);

            /* ---------- 1. Recalculate geometry & filter coefficients if needed -------- */
            if (needsRecalc) {
                // Update context with current parameters
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

                // --- Horn Geometry Calculation ---
                const dx = C / sr; // Spatial step size based on sample rate
                const L  = context.ln / 100; // Horn length in meters
                const N  = Math.max(1, Math.round(L / dx)); // Number of waveguide segments
                context.N = N;

                const curveExponent = Math.pow(10, context.cv / 100); // Curve parameter exponent
                const throatRadius = context.th / 200; // Throat radius [m]
                const mouthRadius = context.mo / 200;  // Mouth radius [m]

                // Allocate or resize impedance and reflection coefficient arrays if N changed
                if (!context.Z || context.Z.length !== N + 1) {
                    context.Z = new Float32Array(N + 1); // Impedance at section boundaries
                    context.R = new Float32Array(N);     // Reflection coefficients between sections
                }
                const Z = context.Z;
                const R = context.R;

                // Calculate impedance Z at each section boundary (0 to N)
                for (let i = 0; i <= N; i++) {
                    let radius; // Radius at boundary i
                    if (i === 0) {
                        radius = throatRadius;
                    } else if (i === N) {
                        radius = mouthRadius;
                    } else {
                        radius = throatRadius + (mouthRadius - throatRadius) * Math.pow(i / N, curveExponent); // Interpolate radius
                    }
                    const area = PI * Math.max(EPS, radius * radius); // Section area
                    Z[i] = RHO_C / area; // Characteristic impedance
                }

                // Calculate reflection coefficient R between sections i and i+1 (0 to N-1)
                for (let i = 0; i < N; i++) {
                    const Z_i = Z[i];
                    const Z_i1 = Z[i+1];
                    const sumZ = Z_i + Z_i1;
                    R[i] = (sumZ < EPS) ? 0 : (Z_i1 - Z_i) / sumZ; // Reflection coefficient
                }

                // Damping gain per segment
                context.g = Math.pow(10, -context.dp * dx / 20);
                // Throat reflection coefficient (base)
                context.trCoeff = context.tr;

                /* ---- Throat Reflection Filter (frequency-dependent) ---- */
                const effectiveThroatRadius = throatRadius;
                const fc_throat = (effectiveThroatRadius > EPS) ? C / (TWO_PI * effectiveThroatRadius) : sr / 4;
                const f_norm_th = Math.min(fc_throat, sr * 0.45) / sr;
                const pole_th = 0.99 * Math.exp(-TWO_PI * f_norm_th);
                context.rt_b0 = 1 - pole_th;
                context.rt_a1 = -pole_th;
                if (!context.rt_y1_states || context.rt_y1_states.length !== chs) {
                    context.rt_y1_states = new Float32Array(chs).fill(0);
                } else {
                    context.rt_y1_states.fill(0);
                }

                /* ---- Mouth Reflection Filter H_R(z) Design (2nd Order) ---- */
                // Approximates frequency-dependent reflection using a two-pole filter.
                const effectiveMouthRadius = mouthRadius;
                const fc_mouth = (effectiveMouthRadius > EPS) ? C / (TWO_PI * effectiveMouthRadius) : sr / 4; // Heuristic cutoff
                const f_norm = Math.min(fc_mouth, sr * 0.45) / sr;
                const pole = 0.99 * Math.exp(-TWO_PI * f_norm);
                // context.rm_b0 = -(1 - pole) * (1 - pole);
                context.rm_a1 = -2 * pole;
                context.rm_a2 = pole * pole;
                context.rm_b0 = -1 - context.rm_a1 -  context.rm_a2;

                // Allocate or resize state buffers for mouth reflection filter
                if (!context.rm_y1_states || context.rm_y1_states.length !== chs) {
                    context.rm_y1_states = new Float32Array(chs).fill(0); // y[n-1]
                    context.rm_y2_states = new Float32Array(chs).fill(0); // y[n-2]
                } else {
                    context.rm_y1_states.fill(0);
                    context.rm_y2_states.fill(0);
                }

                // --- Waveguide delay line buffer initialization ---
                if (!context.fwd || context.fwd.length !== chs || context.fwd[0]?.length !== N + 1) {
                    context.fwd = Array.from({length: chs}, () => new Float32Array(N + 1).fill(0));
                    context.rev = Array.from({length: chs}, () => new Float32Array(N + 1).fill(0));
                } else {
                    for(let ch = 0; ch < chs; ++ch) { // Clear buffers
                        context.fwd[ch].fill(0);
                        context.rev[ch].fill(0);
                    }
                }
                // Temporary buffers for wave propagation calculation
                if (!context.fw_temp || context.fw_temp.length !== N + 1) {
                    context.fw_temp = new Float32Array(N + 1);
                    context.rv_temp = new Float32Array(N + 1);
                }

                /* ---- Crossover Filter (Linkwitz-Riley 4th order) Initialization ---- */
                const crossoverFreq = Math.max(20, Math.min(sr * 0.5 - 1, context.co)); // Clamp frequency
                const omega = Math.tan(crossoverFreq * PI / sr); // Prewarp
                const omega2 = omega * omega;
                const k = SQRT2 * omega; // Butterworth factor
                const den = omega2 + k + 1.0;
                const invDen = (den < EPS) ? 1.0 : 1.0 / den; // Inverse denominator

                // Calculate coefficients (Direct Form II)
                const b0_lp = omega2 * invDen;
                const b1_lp = 2.0 * b0_lp;
                const b2_lp = b0_lp;
                const b0_hp = invDen;
                const b1_hp = -2.0 * b0_hp;
                const b2_hp = b0_hp;
                const a1_c = 2.0 * (omega2 - 1.0) * invDen;
                const a2_c = (omega2 - k + 1.0) * invDen;
                context.lrCoeffs = { b0_lp, b1_lp, b2_lp, b0_hp, b1_hp, b2_hp, a1_c, a2_c };

                // Initialize crossover filter states
                const createCrossoverStage = () => Array.from({length: chs}, () => ({x1: DC_OFFSET, x2: -DC_OFFSET, y1: DC_OFFSET, y2: -DC_OFFSET}));
                if (!context.lrStates || !context.lrStates.low || context.lrStates.low[0].length !== chs) {
                    context.lrStates = {
                        low: [ createCrossoverStage(), createCrossoverStage() ], // 2 stages LP
                        high: [ createCrossoverStage(), createCrossoverStage() ] // 2 stages HP
                    };
                } else {
                    for (let stage = 0; stage < 2; ++stage) { // Reset states
                        for (let ch = 0; ch < chs; ++ch) {
                            context.lrStates.low[stage][ch] = {x1: DC_OFFSET, x2: -DC_OFFSET, y1: DC_OFFSET, y2: -DC_OFFSET};
                            context.lrStates.high[stage][ch] = {x1: DC_OFFSET, x2: -DC_OFFSET, y1: DC_OFFSET, y2: -DC_OFFSET};
                        }
                    }
                }

                // Initialize low-band delay buffer (delay = N samples)
                if (!context.lowDelay || context.lowDelay.length !== chs || context.lowDelay[0]?.length !== N) {
                    context.lowDelay = Array.from({length: chs}, () => new Float32Array(N).fill(0));
                    context.lowDelayIdx = new Uint32Array(chs).fill(0); // Reset indices
                } else {
                    for(let ch = 0; ch < chs; ++ch) { // Reset delay buffer
                        context.lowDelay[ch].fill(0);
                    }
                context.lowDelayIdx.fill(0); // Reset indices
                }

                // Pre-compute output gain in linear scale
                context.outputGain = Math.pow(10, context.wg / 20);
                if (!context.wasmInitialized) {
                    context.wasm.init(context.N, chs);
                    context.ptrR = context.wasm._malloc(context.N * 4);
                    wasmMemF32.set(context.R, context.ptrR / 4);
                    context.wasm.set_R(context.ptrR);
                    context.wasmInitialized = true;
                } else if (context.prevN !== context.N) {
                    context.wasm._free(context.ptrR);
                    context.ptrR = context.wasm._malloc(context.N * 4);
                    context.wasm.init(context.N, chs);
                    wasmMemF32.set(context.R, context.ptrR / 4);
                    context.wasm.set_R(context.ptrR);
                } else {
                    wasmMemF32.set(context.R, context.ptrR / 4);
                    context.wasm.set_R(context.ptrR);
                }
                context.wasm.set_coeffs(context.g, context.trCoeff,
                    context.rm_b0, context.rm_a1, context.rm_a2,
                    context.rt_b0, context.rt_a1,
                    context.lrCoeffs.b0_lp, context.lrCoeffs.b1_lp, context.lrCoeffs.b2_lp,
                    context.lrCoeffs.b0_hp, context.lrCoeffs.b1_hp, context.lrCoeffs.b2_hp,
                    context.lrCoeffs.a1_c, context.lrCoeffs.a2_c,
                    context.outputGain);
                context.prevN = context.N;

                context.initialized = true;
            } // End of needsRecalc block

            /* ------------------ 2. Sample processing loop ---------------- */
            const dataSize = bs * chs;
            if (!context.ptrData || context.dataSize !== dataSize) {
                if (context.ptrData) context.wasm._free(context.ptrData);
                context.ptrData = context.wasm._malloc(dataSize * 4);
                context.dataSize = dataSize;
            }
            wasmMemF32.set(data, context.ptrData / 4);
            context.wasm.process(context.ptrData, bs);
            data.set(wasmMemF32.subarray(context.ptrData / 4, context.ptrData / 4 + dataSize));
            return data;
    }
        `);

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
            co: this.co
        };
    }

    /**
     * Sets the parameters of the plugin.
     * @param {object} p - New parameter values.
     */
    setParameters(p) {
        let up = false;
        const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

        // Geometry & Damping Parameters
        if (p.ln !== undefined && !isNaN(p.ln))
            { this.ln = clamp(+p.ln, 20, 120); up = true; }
        if (p.th !== undefined && !isNaN(p.th))
            { this.th = clamp(+p.th, 0.5, 50); up = true; }
        if (p.mo !== undefined && !isNaN(p.mo))
            { this.mo = clamp(+p.mo, 5, 200);  up = true; }
        if (p.cv !== undefined && !isNaN(p.cv))
            { this.cv = clamp(+p.cv, -100, 100); up = true; }
        if (p.dp !== undefined && !isNaN(p.dp))
            { this.dp = clamp(+p.dp, 0, 10);   up = true; }
        if (p.wg !== undefined && !isNaN(p.wg))
            { this.wg = clamp(+p.wg, -36, 36); up = true; }

        // Reflection & Crossover Parameters
        if (p.tr !== undefined && !isNaN(p.tr)) // Throat Reflection
            { this.tr = clamp(+p.tr, 0, 0.99); up = true; }
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

        // Add sliders using the base class createParameterControl helper
        c.appendChild(this.createParameterControl('Crossover', 20, 5000, 10, this.co, (v) => this.setParameters({ co: v }), 'Hz'));
        c.appendChild(this.createParameterControl('Horn Length', 20, 120, 1, this.ln, (v) => this.setParameters({ ln: v }), 'cm'));
        c.appendChild(this.createParameterControl('Throat Dia.', 0.5, 50, 0.1, this.th, (v) => this.setParameters({ th: v }), 'cm'));
        c.appendChild(this.createParameterControl('Mouth Dia.', 5, 200, 0.5, this.mo, (v) => this.setParameters({ mo: v }), 'cm'));
        c.appendChild(this.createParameterControl('Curve', -100, 100, 1, this.cv, (v) => this.setParameters({ cv: v }), '%'));
        c.appendChild(this.createParameterControl('Damping', 0, 10, 0.01, this.dp, (v) => this.setParameters({ dp: v }), 'dB/m'));
        c.appendChild(this.createParameterControl('Throat Refl.', 0, 0.99, 0.01, this.tr, (v) => this.setParameters({ tr: v })));
        c.appendChild(this.createParameterControl('Output Gain', -36, 36, 0.1, this.wg, (v) => this.setParameters({ wg: v }), 'dB'));

        return c;
    }
}

// Export the class
window.HornResonatorPlusPlugin = HornResonatorPlusPlugin;
