/**
 * Michell Wave Resistance Numerical Integrator
 * 
 * Michell's integral (1898) calculates the wave resistance of a thin ship
 * moving at constant velocity.
 * 
 * R_w = (4/pi) * rho * g^2 / v^2 * Integral_1^infinity [ (lambda^2 / sqrt(lambda^2 - 1)) * (I^2 + J^2) d(lambda) ]
 * 
 * Where I and J are integrals over the centerplane (x, z) of the hull's slope function:
 * I = Integral [ f_x(x,z) * exp(-k0 * lambda^2 * z) * cos(k0 * lambda * x) dx dz ]
 * J = Integral [ f_x(x,z) * exp(-k0 * lambda^2 * z) * sin(k0 * lambda * x) dx dz ]
 * 
 * k0 = g / v^2
 * f_x(x,z) is the partial derivative of the hull half-breadth y with respect to x.
 */

// Constants
const G = 9.80665; // Gravity (m/s^2)
const RHO = 1025;  // Density of seawater (kg/m^3)

/**
 * The Wigley Hull Analytical Form.
 * A parabolic hull defined by:
 * y(x,z) = B/2 * (1 - (2x/L)^2) * (1 - (z/T)^2)
 * for -L/2 <= x <= L/2 and 0 <= z <= T (where z is depth positive downwards)
 * 
 * @param {number} x - Longitudinal position (-L/2 to L/2)
 * @param {number} z - Depth (0 to T)
 * @param {number} L - Length
 * @param {number} B - Beam
 * @param {number} T - Draft
 * @returns {number} The half-breadth y
 */
export function getWigleyY(x, z, L, B, T) {
  const termX = 1.0 - Math.pow(2.0 * x / L, 2);
  const termZ = 1.0 - Math.pow(z / T, 2);
  return (B / 2.0) * termX * termZ;
}

/**
 * Analytical derivative of the Wigley hull with respect to x (f_x)
 */
export function getWigleySlopeX(x, z, L, B, T) {
  // y = B/2 * (1 - 4x^2/L^2) * (1 - z^2/T^2)
  // dy/dx = B/2 * (-8x/L^2) * (1 - z^2/T^2)
  const termZ = 1.0 - Math.pow(z / T, 2);
  return (B / 2.0) * (-8.0 * x / (L * L)) * termZ;
}

/**
 * Core Numerical Integrator for Michell's Wave Resistance
 * 
 * @param {number} velocity - Speed of the vessel in m/s
 * @param {number} L - Length of hull
 * @param {number} T - Draft of hull
 * @param {Function} slopeFunc - Function(x, z) returning dy/dx
 * @returns {number} Wave resistance in Newtons
 */
export function calculateMichellResistance(velocity, L, T, slopeFunc) {
  // Protect against zero velocity
  if (velocity <= 0.01) return 0;

  const k0 = G / (velocity * velocity);
  
  // Numerical Integration Parameters
  // These dictate the precision and performance of the solver.
  const lambdaMin = 1.0001; // Can't start exactly at 1 due to singularity (lambda^2 - 1)
  const lambdaMax = 10.0;   // High frequency waves drop off exponentially due to exp(-k0 * lambda^2 * z)
  const numLambda = 100;
  const dLambda = (lambdaMax - lambdaMin) / numLambda;

  const numX = 50; // Panels in longitudinal direction
  const dX = L / numX;
  
  const numZ = 20; // Panels in vertical direction
  const dZ = T / numZ;

  let totalResistance = 0.0;

  // Outer integral over lambda (from 1 to infinity, truncated at lambdaMax)
  for (let l = 0; l < numLambda; l++) {
    const lambda = lambdaMin + l * dLambda + (dLambda / 2); // Midpoint rule
    const lambda2 = lambda * lambda;
    
    // I and J integrals
    let I = 0.0;
    let J = 0.0;

    // Double integral over the hull centerplane (x, z)
    // x goes from -L/2 to L/2
    // z goes from 0 to T (depth)
    for (let iz = 0; iz < numZ; iz++) {
      const z = iz * dZ + (dZ / 2);
      const depthFactor = Math.exp(-k0 * lambda2 * z);

      for (let ix = 0; ix < numX; ix++) {
        const x = -L/2 + ix * dX + (dX / 2);
        
        const slope = slopeFunc(x, z);
        const waveTermX = k0 * lambda * x;

        // Area of this integration panel
        const area = dX * dZ;

        I += slope * depthFactor * Math.cos(waveTermX) * area;
        J += slope * depthFactor * Math.sin(waveTermX) * area;
      }
    }

    // Accumulate the lambda integral
    const lambdaFactor = (lambda2 / Math.sqrt(lambda2 - 1.0));
    totalResistance += lambdaFactor * (I*I + J*J) * dLambda;
  }

  const factor = (4.0 / Math.PI) * RHO * (G * G) / (velocity * velocity);
  return factor * totalResistance;
}
