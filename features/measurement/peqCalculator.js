/**
 * PEQ Parameter Calculator
 * Calculates parametric EQ correction parameters based on frequency response measurements.
 */
import { 
  PEQCalculator as ModernPEQCalculator, 
  smoothLog, 
  findPeaksDips, 
  peqResponse, 
  errorFunctionLogSpace, 
  fitPEQ, 
  processCollisions, 
  designPEQ, 
  createDefaultBands 
} from './peq-calculator/peq-calculator.js';

// Re-export the modern implementation as legacy class
class PEQCalculator extends ModernPEQCalculator {
  // Constructor to ensure backward compatibility
  constructor() {
    super();
  }
}

// Export for module usage
export { 
  PEQCalculator, 
  smoothLog, 
  findPeaksDips, 
  peqResponse, 
  errorFunctionLogSpace, 
  fitPEQ, 
  processCollisions, 
  designPEQ, 
  createDefaultBands 
};

// Register the calculator class globally for backward compatibility
if (typeof window !== 'undefined') {
  window.PEQCalculator = PEQCalculator;
}