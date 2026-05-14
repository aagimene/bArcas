// Loft prototype — Phase A: layout skeleton with a placeholder lofted mesh
// and read-only renderings of the side view and cross-section. Editing
// (spine, sections, chines, add/remove stations) lands in phases B–E.
//
// Coordinates throughout: X = longitudinal (+X bow), Y = transverse
// (+Y stbd), Z = vertical (+Z up). Stations stored starboard-only;
// port is mirrored across Y = 0.

import * as THREE       from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass }       from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

// ── Constants ────────────────────────────────────────────────────────────
// Declared before state so stationsPlaceholder() can reference them without
// hitting the temporal dead zone.

const DEFAULT_DECK_N    = 0.30; // default deck-top height above keel, metres
const DEFAULT_HALF_BEAM = 0.30; // reference half-beam for display scale

// ── State ────────────────────────────────────────────────────────────────

// ── Default starting state ────────────────────────────────────────────────
// Spine: piecewise cubic Bezier with on-curve knots (C1 collinear handles).
//   knots[0] = stern (aftLen=0), knots[last] = bow (foreLen=0).
//   Interior knots share `angle` for both handles (C1).
// DeckLine: cubic Bezier stern→bow with two free off-curve handles.
//   Endpoints coincide exactly with spine endpoints (deck=keel at tips).
// Stations: cross-section shapes at arc-length fractions s ∈ (0,1) along rocker.
//   No deckPt — deck height driven globally by deckLine.
// Simple starting hull: one station at midship, no shape knots on rocker.
// deckLine.handles[] — off-curve control handles for the deck Bezier.
//   Curve passes through stern/bow endpoints. Handles attract (don't constrain).
//   Click near deck curve to add a handle; right-click a handle to delete.
const state = {
  length: 4.8,
  loftRes: '24',
  xSubdiv: 4,
  selectedStation: 0,
  spine: {
    knots: [
      { x: -2.4, z: 0.04, angle: Math.atan2(-0.08, 1.0), aftLen: 0, foreLen: 1.1 },
      { x:  2.4, z: 0.04, angle: Math.atan2( 0.08, 1.0), aftLen: 1.1, foreLen: 0 },
    ],
  },
  // Deck line: same piecewise cubic Bezier with on-curve knots as rocker.
  // At s=0 and s=1 the deck coincides with the keel (bow/stern converge).
  // Interior knots arch the deck above the keel.
  deckLine: {
    knots: [
      { x: -2.4, z: 0.04, angle: Math.atan2( 0.30, 1.0), aftLen: 0,   foreLen: 1.0 },
      { x:  0,   z: 0.38, angle: 0,                       aftLen: 1.0, foreLen: 1.0 },
      { x:  2.4, z: 0.04, angle: Math.atan2(-0.30, 1.0), aftLen: 1.0, foreLen: 0   },
    ],
  },
  stations: [
    { s: 0.5, points: [
      {b:0,n:0,chine:false}, {b:0.55,n:0.13,chine:false},
      {b:1,n:0.53,chine:false}, {b:0.55,n:0.9,chine:false}, {b:0,n:1,chine:false},
    ]},
  ],
  beamLine: {
    sternHandle: {dx: 1.0, dy: 0.1},
    bowHandle:   {dx: -1.0, dy: 0.1},
    peaks: [{x: 0, y: 0.28, hdx: 0.8, hdy: 0}],
  },
  showLoftMesh: true,
  meshOpacity: 70,
  spineRadius: 0.005,
  spineSharpness: 0,
  sideRef: { url: null, worldX: -2.6, worldZ: 0.5, worldW: 5.2, worldH: 0.8, opacity: 0.3 },
  topRef:  { url: null, worldX: -2.6, worldY: -0.4, worldW: 5.2, worldH: 0.8, opacity: 0.3 },
};

// ── Rocker spine: piecewise cubic Bézier with on-curve knots ─────────────
//
// spine.knots[] is an array of on-curve knots. Each knot:
//   { x, z, angle, aftLen, foreLen }
// angle — tangent direction at the knot (radians, from +X axis).
// aftLen — length of the incoming handle (0 for the first knot).
// foreLen — length of the outgoing handle (0 for the last knot).
// C1 continuity: both handles share the same `angle` at each interior knot.
//
// Deck line: cubic Bezier from spine.knots[0] to spine.knots[last] with two
// free off-curve handles h1, h2. Endpoints coincide with rocker endpoints.
// Deck line defines hull height; no per-station deckPt needed.

// Point on a cubic Bézier at parameter t. Returns {x, y} where y=z,
// matching the {x,y} convention in the sampled-spine pipeline.
function cubicBezierPt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.z + 3*u*u*t*p1.z + 3*u*t*t*p2.z + t*t*t*p3.z,
  };
}

// Control handles for knot k: incoming (aft) and outgoing (fore) positions.
function knotHandles(k) {
  const ca = Math.cos(k.angle), sa = Math.sin(k.angle);
  return {
    aft:  { x: k.x - ca * k.aftLen,  z: k.z - sa * k.aftLen  },
    fore: { x: k.x + ca * k.foreLen, z: k.z + sa * k.foreLen },
  };
}

// Sample the piecewise cubic Bezier rocker (N-1 segments from knots[]).
// Returns {pts:[{x,y}], arc:[], total} — y stores z throughout.
function sampledSpine(knots, steps = 64) {
  const segs = knots.length - 1;
  const perSeg = Math.ceil(steps / segs);
  const pts = [];
  for (let i = 0; i < segs; i++) {
    const k0 = knots[i], k1 = knots[i + 1];
    const P1 = knotHandles(k0).fore;
    const P2 = knotHandles(k1).aft;
    for (let j = (i === 0 ? 0 : 1); j <= perSeg; j++)
      pts.push(cubicBezierPt(k0, P1, P2, k1, j / perSeg));
  }
  const arc = [0];
  for (let i = 1; i < pts.length; i++)
    arc.push(arc[i-1] + Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y));
  return { pts, arc, total: arc[arc.length-1] };
}

// Evaluate the rocker at arc-length fraction s ∈ [0,1].
// Returns { p:{x,z}, tx, tz }.
function spineAt(sampled, s) {
  const { pts, arc, total } = sampled;
  const target = Math.max(0, Math.min(total, s * total));
  let lo = 0, hi = arc.length - 1;
  while (hi - lo > 1) { const mid = (lo+hi)>>1; if (arc[mid] <= target) lo=mid; else hi=mid; }
  const t = arc[hi] === arc[lo] ? 0 : (target - arc[lo]) / (arc[hi] - arc[lo]);
  const p = { x: pts[lo].x + t*(pts[hi].x-pts[lo].x), z: pts[lo].y + t*(pts[hi].y-pts[lo].y) };
  const dx = pts[hi].x - pts[lo].x, dz = pts[hi].y - pts[lo].y;
  const len = Math.hypot(dx,dz) || 1;
  return { p, tx: dx/len, tz: dz/len };
}

// Sample the deck line — reuses sampledSpine since the knot format is identical.
function sampledDeckLine(state) {
  return sampledSpine(state.deckLine.knots, 64);
}

// Insert an on-curve knot at Bezier parameter `t` on segment `segIdx` of
// any knots[] array (rocker or deck line) via De Casteljau subdivision.
function insertKnot(knots, segIdx, t) {
  const k0 = knots[segIdx], k1 = knots[segIdx+1];
  const P0 = k0, P1 = knotHandles(k0).fore, P2 = knotHandles(k1).aft, P3 = k1;
  const lerp = (a,b,t) => ({ x:a.x+t*(b.x-a.x), z:(a.z??a.y)+t*((b.z??b.y)-(a.z??a.y)) });
  const Q1 = lerp(P0,P1,t), Q2 = lerp(P1,P2,t), Q3 = lerp(P2,P3,t);
  const R1 = lerp(Q1,Q2,t), R2 = lerp(Q2,Q3,t);
  const M  = lerp(R1,R2,t); // new on-curve knot
  // Update k0's foreLen (Q1 direction stays same, just shorter by t)
  k0.foreLen *= t;
  // New knot at M: aft handle = R1, fore handle = R2, C1 (collinear)
  const aftDx = M.x-R1.x, aftDz = M.z-R1.z;
  const foreDx = R2.x-M.x, foreDz = R2.z-M.z;
  const newKnot = {
    x: M.x, z: M.z,
    angle: Math.atan2(foreDz, foreDx),
    aftLen:  Math.hypot(aftDx,  aftDz),
    foreLen: Math.hypot(foreDx, foreDz),
  };
  // Update k1's aftLen (same direction, scaled by (1-t))
  k1.aftLen *= (1-t);
  knots.splice(segIdx+1, 0, newKnot);
}

// Default cross-section shape (b=beam fraction, n=height fraction).
function defaultSection() {
  return [
    { b: 0,    n: 0,    chine: false },
    { b: 0.55, n: 0.13, chine: false },
    { b: 1.0,  n: 0.53, chine: false },
    { b: 0.55, n: 0.90, chine: false },
    { b: 0,    n: 1.0,  chine: false },
  ];
}

// ── Geometry helpers ──────────────────────────────────────────────────────

function naturalCubicSecondDerivs(y) {
  const n = y.length;
  const M = new Array(n).fill(0);
  if (n < 3) return M;
  const c = new Array(n).fill(0);
  const d = new Array(n).fill(0);
  c[1] = 1 / 4;
  d[1] = (6 * (y[0] - 2 * y[1] + y[2])) / 4;
  for (let i = 2; i < n - 1; i++) {
    const m = 4 - c[i - 1];
    c[i] = 1 / m;
    d[i] = (6 * (y[i - 1] - 2 * y[i] + y[i + 1]) - d[i - 1]) / m;
  }
  for (let i = n - 2; i >= 1; i--) M[i] = d[i] - c[i] * M[i + 1];
  return M;
}

function sampleSpline(points, xKey, yKey, samplesPerSpan = 16) {
  const n = points.length;
  if (n < 3) return points.map(p => ({ x: p[xKey], y: p[yKey] }));
  const xs = points.map(p => p[xKey]);
  const ys = points.map(p => p[yKey]);
  const Mx = naturalCubicSecondDerivs(xs);
  const My = naturalCubicSecondDerivs(ys);
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < samplesPerSpan; k++) {
      const s = k / samplesPerSpan, omS = 1 - s;
      const ax = (omS ** 3 - omS) / 6, bx = (s ** 3 - s) / 6;
      out.push({
        x: omS * xs[i] + s * xs[i + 1] + ax * Mx[i] + bx * Mx[i + 1],
        y: omS * ys[i] + s * ys[i + 1] + ax * My[i] + bx * My[i + 1],
      });
    }
  }
  out.push({ x: xs[n - 1], y: ys[n - 1] });
  return out;
}

// Sample a starboard-only section to N transverse points by arc-length
// equal spacing along the spline through the control points.
function sampleSection(section, N) {
  const dense = sampleSpline(section, 'b', 'n', 24);
  const arc = [0];
  for (let i = 1; i < dense.length; i++) {
    const db = dense[i].x - dense[i - 1].x;
    const dn = dense[i].y - dense[i - 1].y;
    arc.push(arc[i - 1] + Math.hypot(db, dn));
  }
  const total = arc[arc.length - 1] || 1;
  const out = new Array(N);
  for (let k = 0; k < N; k++) {
    const target = (k / (N - 1)) * total;
    let lo = 0, hi = arc.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arc[mid] <= target) lo = mid; else hi = mid;
    }
    const t = arc[hi] === arc[lo] ? 0 : (target - arc[lo]) / (arc[hi] - arc[lo]);
    out[k] = {
      b: dense[lo].x + t * (dense[hi].x - dense[lo].x),
      n: dense[lo].y + t * (dense[hi].y - dense[lo].y),
    };
  }
  return out;
}

// ── Composite spine: stern keel + rocker + bow keel ─────────────────────
//
// The loft spine is a three-segment composite:
//
//   stern tip  ← stern sheer keel (reversed) ← rocker(sternStartS)
//   → rocker(bowStartS) → bow sheer keel → bow tip
//
// S ∈ [0, sternFrac]       = stern sheer-end keel (tip → junction)
// S ∈ [sternFrac, 1-bowFrac] = main hull rocker
// S ∈ [1-bowFrac, 1]       = bow sheer-end keel (junction → tip)
//
// sternFrac / bowFrac are arc-length fractions of the total composite.

// Bottom sheer keel: [junction, ...stations[].bottomPt, tip]
// Sample the beam-line piecewise Bézier (X-Y plan view).
// Endpoints are the rocker knots (stern/bow); peaks are interior anchors.
function sampledBeamLine(state) {
  const st = state.spine.knots[0];
  const bw = state.spine.knots[state.spine.knots.length - 1];
  const bl = state.beamLine;
  // Build the list of anchor/handle tuples:
  // [ { p, hOut }, peak..., { p, hIn } ]
  const sorted = [...bl.peaks].sort((a, b) => a.x - b.x);
  const nodes = [
    { p: { x: st.x, y: 0 }, hOut: { x: st.x + bl.sternHandle.dx, y: bl.sternHandle.dy } },
    ...sorted.map(pk => ({
      p:    { x: pk.x,        y: pk.y        },
      hIn:  { x: pk.x - pk.hdx, y: pk.y - pk.hdy },
      hOut: { x: pk.x + pk.hdx, y: pk.y + pk.hdy },
    })),
    { p: { x: bw.x, y: 0 }, hIn: { x: bw.x + bl.bowHandle.dx, y: bl.bowHandle.dy } },
  ];
  const pts = [];
  for (let seg = 0; seg < nodes.length - 1; seg++) {
    const P0 = nodes[seg].p,   P3 = nodes[seg + 1].p;
    const P1 = nodes[seg].hOut ?? P0;
    const P2 = nodes[seg + 1].hIn ?? P3;
    const steps = 24;
    for (let j = (seg === 0 ? 0 : 1); j <= steps; j++) {
      const t = j / steps, u = 1 - t;
      pts.push({
        x: u**3*P0.x + 3*u**2*t*P1.x + 3*u*t**2*P2.x + t**3*P3.x,
        y: u**3*P0.y + 3*u**2*t*P1.y + 3*u*t**2*P2.y + t**3*P3.y,
      });
    }
  }
  return pts;
}

// Evaluate half-beam at world X by linear interpolation in the sampled pts.
function beamEvalAt(beamPts, wx) {
  if (!beamPts.length) return 0;
  if (wx <= beamPts[0].x) return Math.max(0, beamPts[0].y);
  if (wx >= beamPts[beamPts.length - 1].x) return Math.max(0, beamPts[beamPts.length - 1].y);
  let lo = 0, hi = beamPts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beamPts[m].x <= wx) lo = m; else hi = m; }
  const t = (wx - beamPts[lo].x) / (beamPts[hi].x - beamPts[lo].x);
  return Math.max(0, beamPts[lo].y + t * (beamPts[hi].y - beamPts[lo].y));
}

// Natural cubic spline through (sₖ, vₖ) at non-uniform knots — used for
// longitudinal b/n interpolation between stations. Returns an evaluator f(s).
// Natural BCs: M_0 = M_{n-1} = 0. Tridiagonal solve via Thomas.
function naturalCubicNonUniform(ss, vs) {
  const n = ss.length;
  if (n === 1) return (_) => vs[0];
  if (n === 2) {
    return (s) => {
      const t = (s - ss[0]) / (ss[1] - ss[0]);
      return vs[0] + t * (vs[1] - vs[0]);
    };
  }
  const h = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = ss[i + 1] - ss[i];
  const a = new Array(n).fill(0);
  const b = new Array(n).fill(1);
  const c = new Array(n).fill(0);
  const d = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    a[i] = h[i - 1];
    b[i] = 2 * (h[i - 1] + h[i]);
    c[i] = h[i];
    d[i] = 6 * ((vs[i + 1] - vs[i]) / h[i] - (vs[i] - vs[i - 1]) / h[i - 1]);
  }
  // Boundary rows already enforce M_0 = M_{n-1} = 0 (b=1, d=0).
  // Forward sweep
  for (let i = 1; i < n; i++) {
    const m = a[i] / b[i - 1];
    b[i] -= m * c[i - 1];
    d[i] -= m * d[i - 1];
  }
  // Back substitution
  const M = new Array(n).fill(0);
  M[n - 1] = d[n - 1] / b[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    M[i] = (d[i] - c[i] * M[i + 1]) / b[i];
  }
  return (s) => {
    if (s <= ss[0])     return vs[0];
    if (s >= ss[n - 1]) return vs[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ss[mid] <= s) lo = mid; else hi = mid;
    }
    const H = ss[hi] - ss[lo];
    const A = (ss[hi] - s) / H;
    const B = (s - ss[lo]) / H;
    const C = (1 / 6) * (A * A * A - A) * H * H;
    const D = (1 / 6) * (B * B * B - B) * H * H;
    return A * vs[lo] + B * vs[hi] + C * M[lo] + D * M[hi];
  };
}

// Loft mesh: degenerate rows at stern/bow (s=0, s=1), station cross-sections
// in between. Keel from rocker Bezier directly. Deck from deck line Bezier.
// Cross-section shapes (b,n) interpolated via natural cubic splines between
// stations. Densification resamples at uniform arc-length fractions along the
// rocker — keel/deck always come from the Bezier, never re-splined.
function buildLoft(state) {
  const N = parseInt(state.loftRes, 10) || 24;
  const xSubdiv = Math.max(1, parseInt(state.xSubdiv, 10) || 1);

  const spSampled   = sampledSpine(state.spine.knots,   64);
  const deckSampled = sampledSpine(state.deckLine.knots, 64);
  const beamPts     = sampledBeamLine(state);

  // Tips use a full cross-section shape (not all-zero) so the b/n splines
  // for the deck column (k=N-1) stay near n=1 everywhere. Convergence to a
  // single point at bow/stern is handled by halfB→0 and height→0 there.
  const sortedSt = [...state.stations]
    .filter(st => st.s > 1e-6 && st.s < 1 - 1e-6)
    .sort((a, b) => a.s - b.s);
  // Use the nearest station's section shape at each tip (or default if none).
  const tipSamples = (nearestSt) =>
    sampleSection(nearestSt ? nearestSt.points : defaultSection(), N);
  const tip0 = tipSamples(sortedSt[0]);
  const tip1 = tipSamples(sortedSt[sortedSt.length - 1]);

  // Base rows: tips + interior stations.
  const baseSt = [
    { s: 0, samples: tip0 },
    ...sortedSt.map(st => ({ s: st.s, samples: sampleSection(st.points, N) })),
    { s: 1, samples: tip1 },
  ];
  const M = baseSt.length;
  const baseS = baseSt.map(b => b.s);

  // Build b/n splines for cross-section shape interpolation.
  const bSplines = [], nSplines = [];
  for (let k = 0; k < N; k++) {
    bSplines[k] = naturalCubicNonUniform(baseS, baseSt.map(b => b.samples[k].b));
    nSplines[k] = naturalCubicNonUniform(baseS, baseSt.map(b => b.samples[k].n));
  }

  // Dense longitudinal sampling — keel and deck from curves directly.
  const Mdense = xSubdiv > 1 ? (M - 1) * xSubdiv + 1 : M;
  const denseRows = [];
  for (let i = 0; i < Mdense; i++) {
    const s = i / (Mdense - 1);
    const { p: keel } = spineAt(spSampled,   s);
    const { p: deck } = spineAt(deckSampled, s);
    const height = Math.max(0.001, deck.z - keel.z);
    const halfB  = beamEvalAt(beamPts, keel.x);
    const samples = Array.from({ length: N }, (_, k) => ({
      b: Math.max(0, bSplines[k](s)),
      n: Math.max(0, Math.min(1, nSplines[k](s))),
    }));
    const maxB = Math.max(...samples.map(s => s.b), 1e-9);
    denseRows.push(samples.map(({ b, n }) => ({
      x: keel.x,
      y: (b / maxB) * halfB,
      z: keel.z + n * height,
    })));
  }

  // Starboard mesh + port mirror — ruled quad strips between adjacent rows.
  // spineRadius translates each half outward in Y so the keel/deck centerline
  // edges land at ±r, giving a constant-width spine loop around the hull.
  const r = Math.max(0, state.spineRadius || 0);

  const positions = [];
  const indices   = [];
  for (let i = 0; i < Mdense; i++)
    for (let k = 0; k < N; k++)
      positions.push(denseRows[i][k].x, denseRows[i][k].z, denseRows[i][k].y + r);

  for (let i = 0; i < Mdense - 1; i++) {
    for (let k = 0; k < N - 1; k++) {
      const a = i * N + k, b = i * N + k + 1;
      const c = (i + 1) * N + k, d = (i + 1) * N + k + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const stbdVertCount = Mdense * N;
  for (let i = 0; i < Mdense; i++)
    for (let k = 0; k < N; k++)
      positions.push(denseRows[i][k].x, denseRows[i][k].z, -(denseRows[i][k].y + r));

  for (let i = 0; i < Mdense - 1; i++) {
    for (let k = 0; k < N - 1; k++) {
      const a = stbdVertCount + i * N + k, b = stbdVertCount + i * N + k + 1;
      const c = stbdVertCount + (i + 1) * N + k, d = stbdVertCount + (i + 1) * N + k + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // ── Spine closure strips ────────────────────────────────────────────────
  // When spineRadius > 0 the two half-meshes have their centerline edges at
  // y = +r (starboard) and y = −r (port). Connect them with a flat strip at
  // the keel (k=0, n=0) and at the deck (k=N-1, n=1), closing the hull into
  // a watertight shell. Re-uses existing vertex indices — no new positions.
  //
  // Keel strip winding → outward normal faces away from hull bottom (downward).
  // Deck strip winding → outward normal faces away from hull deck (upward).
  // spineSharpness (future): controls strip cross-section from flat→elliptical.
  if (r > 0) {
    for (let i = 0; i < Mdense - 1; i++) {
      // Keel edge (k = 0)
      const Ak = i * N,              Bk = stbdVertCount + i * N;
      const Ck = (i + 1) * N,       Dk = stbdVertCount + (i + 1) * N;
      indices.push(Ak, Bk, Dk);
      indices.push(Ak, Dk, Ck);

      // Deck edge (k = N-1)
      const Ad = i * N + N - 1,              Bd = stbdVertCount + i * N + N - 1;
      const Cd = (i + 1) * N + N - 1,        Dd = stbdVertCount + (i + 1) * N + N - 1;
      indices.push(Ad, Dd, Bd);
      indices.push(Ad, Cd, Dd);
    }
  }

  // Expose dense rows for SVG wireframe and station row data for selection.
  const stationRows = sortedSt.map((st, i) => {
    const { p: keel } = spineAt(spSampled,   st.s);
    const { p: deck } = spineAt(deckSampled, st.s);
    const height = Math.max(0.001, deck.z - keel.z);
    const halfB  = beamEvalAt(beamPts, keel.x);
    const samples = sampleSection(st.points, N);
    const maxB = Math.max(...samples.map(s => s.b), 1e-9);
    return {
      s: st.s,
      points: samples.map(({ b, n }) => ({
        x: keel.x,
        y: (b / maxB) * halfB,
        z: keel.z + n * height,
      })),
    };
  });

  return { positions, indices, rows: denseRows, stationRows, N, M: Mdense };
}

// Sample the lofted section in (b, n) at any normalized arc length s.
// Used when adding a new station: the new station is seeded with a section
// matching the *current* loft at that s, so the surface is unchanged at
// the moment of insertion (per the plan's seed-from-current-loft rule).
//
// Returns an array of { b, n, chine: false } control points, count =
// `numPoints` (default 7), distributed evenly along the section's
// arc length, with the first point clamped to the keel (0, 0).
function sectionAtS(state, targetS, numPoints = 7) {
  // targetS is a rocker arc-length fraction s ∈ (0, 1).
  // Interpolates the cross-section b/n shape at that position from the
  // current stations using natural cubic splines.
  const N_DENSE = 96;
  const sortedSt = [...state.stations].filter(st => st.s > 1e-6 && st.s < 1-1e-6).sort((a,b)=>a.s-b.s);
  const baseSt = [
    { s: 0, samples: Array.from({length: N_DENSE}, ()=>({b:0,n:0})) },
    ...sortedSt.map(st => ({ s: st.s, samples: sampleSection(st.points, N_DENSE) })),
    { s: 1, samples: Array.from({length: N_DENSE}, ()=>({b:0,n:0})) },
  ];
  const ss = baseSt.map(b => b.s);
  const samps = baseSt.map(b => b.samples);

  // Evaluate per-transverse-index splines at targetS.
  const dense = new Array(N_DENSE);
  for (let k = 0; k < N_DENSE; k++) {
    const bSpline = naturalCubicNonUniform(ss, samps.map(samp => samp[k].b));
    const nSpline = naturalCubicNonUniform(ss, samps.map(samp => samp[k].n));
    dense[k] = { b: bSpline(targetS), n: nSpline(targetS) };
  }

  // Resample the dense (b, n) curve down to numPoints by equal arc length.
  const arc = [0];
  for (let i = 1; i < N_DENSE; i++) {
    const db = dense[i].b - dense[i - 1].b;
    const dn = dense[i].n - dense[i - 1].n;
    arc.push(arc[i - 1] + Math.hypot(db, dn));
  }
  const total = arc[arc.length - 1] || 1;

  const points = new Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const target = (i / (numPoints - 1)) * total;
    let lo = 0;
    while (lo < N_DENSE - 1 && arc[lo + 1] < target) lo++;
    const hi = Math.min(N_DENSE - 1, lo + 1);
    const t = arc[hi] === arc[lo] ? 0 : (target - arc[lo]) / (arc[hi] - arc[lo]);
    points[i] = {
      b: Math.max(0, dense[lo].b + t * (dense[hi].b - dense[lo].b)),
      n: dense[lo].n + t * (dense[hi].n - dense[lo].n),
      chine: false,
    };
  }
  // Anchor: keel point at (0, 0) (locked to the spine, model-wide rule);
  // deck-end at b = 0 (centerline closure on top).
  points[0] = { b: 0, n: 0,   chine: false }; // keel
  points[numPoints - 1] = { b: 0, n: 1.0, chine: false }; // deck
  return points;
}

// ── Three.js setup ───────────────────────────────────────────────────────

const threeHost = document.getElementById('three-host');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(threeHost.clientWidth, threeHost.clientHeight);
threeHost.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
// Dark slate background so the light gridlines and the orange hull pop.
scene.background = new THREE.Color(0x0b1220);

const camera = new THREE.PerspectiveCamera(
  35, threeHost.clientWidth / Math.max(1, threeHost.clientHeight), 0.05, 100
);
const defaultCamPos = new THREE.Vector3(4.5, 2.6, 3.4);
camera.position.copy(defaultCamPos);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.05, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
// Standard CAD/3D-modelling mouse map: middle = pan, right = orbit, scroll = zoom.
// Left is kept as orbit too so single-button mice still work.
controls.mouseButtons = {
  LEFT:   THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT:  THREE.MOUSE.ROTATE,
};

// Reset view on double-click.
renderer.domElement.addEventListener('dblclick', () => {
  camera.position.copy(defaultCamPos);
  controls.target.set(0, -0.05, 0);
  controls.update();
});

// Lighting — low ambient so AO has something to bite, strong key light
// from above-front, modest fill from the rear-opposite side, plus a small
// back rim light for hull-edge separation against the dark background.
scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc7d2fe, 0.45);
fillLight.position.set(-2.5, 1.5, -2);
scene.add(fillLight);
const rimLight  = new THREE.DirectionalLight(0xfde68a, 0.55);
rimLight.position.set(-1.5, 2, 3.5);
scene.add(rimLight);

// Key-light spherical orbit — shift+drag on the 3D canvas to reposition.
// azimuth = horizontal angle, elevation = vertical angle (0=horizon, π/2=top).
const KEY_LIGHT_DIST = 6.5;
const KEY_LIGHT_DEFAULTS = { az: 0.69, el: 0.89 };
const keyLightAngles = { ...KEY_LIGHT_DEFAULTS };
function applyKeyLightPosition() {
  const { az, el } = keyLightAngles;
  keyLight.position.set(
    KEY_LIGHT_DIST * Math.cos(el) * Math.cos(az),
    KEY_LIGHT_DIST * Math.sin(el),
    KEY_LIGHT_DIST * Math.cos(el) * Math.sin(az)
  );
}
applyKeyLightPosition();

// Grid planes live in the main scene so they depth-test against the hull
// and intersect visually in 3D rather than always rendering on top.

// Horizontal reference grid at Z = 0 (waterline plane).
const grid = new THREE.GridHelper(8, 16, 0xe2e8f0, 0x64748b);
grid.position.y = 0;
grid.material.transparent = true;
grid.material.opacity = 0.65;
grid.material.depthWrite = false;
scene.add(grid);

// Centerline plane grid (longitudinal-vertical bisecting plane).
const centerGrid = new THREE.GridHelper(6, 12, 0xa5b4fc, 0x475569);
centerGrid.rotation.x = Math.PI / 2;
centerGrid.material.transparent = true;
centerGrid.material.opacity = 0.45;
centerGrid.material.depthWrite = false;
centerGrid.position.y = 0;
scene.add(centerGrid);

// Bright centerline at the intersection of the two grid planes.
const centerlineMat  = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9, depthWrite: false });
const centerlineGeom = new THREE.BufferGeometry();
const centerlineLine = new THREE.Line(centerlineGeom, centerlineMat);
scene.add(centerlineLine);

// Hull mesh group.
const hullGroup = new THREE.Group();
scene.add(hullGroup);

// Single double-sided material with inside / outside colors discriminated
// via gl_FrontFacing in a shader injection. Two physical meshes broke the
// SSAOPass normal-pass (it re-renders the scene with MeshNormalMaterial,
// FrontSide-only, so two meshes sharing geometry produce a degenerate
// normal buffer). One mesh, double-sided, fixes that.
const insideColorUniform = { value: new THREE.Color(0xffc0cb) };
const hullMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0xffffff),
  side: THREE.DoubleSide,
  metalness: 0.05,
  roughness: 0.6,
  flatShading: false,
});
hullMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.insideColor = insideColorUniform;
  shader.fragmentShader =
    'uniform vec3 insideColor;\n' +
    shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n' +
      'if (!gl_FrontFacing) { diffuseColor.rgb = insideColor; }'
    );
};
const hullWireMaterial = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.25 });

// Station-band group (highlight where stations live on the hull).
const bandGroup = new THREE.Group();
scene.add(bandGroup);

let lastLoft = null; // updated by rebuildHull(); read by renderSideView()

function rebuildHull() {

  // Clear previous.
  while (hullGroup.children.length) {
    const child = hullGroup.children.pop();
    child.geometry?.dispose();
  }
  while (bandGroup.children.length) {
    const child = bandGroup.children.pop();
    child.geometry?.dispose();
  }

  const loft = buildLoft(state);

  // Single double-sided hull mesh. Inside / outside colors are picked
  // per-fragment via gl_FrontFacing in the shader.
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(loft.positions, 3));
  geom.setIndex(loft.indices);
  geom.computeVertexNormals();
  hullGroup.add(new THREE.Mesh(geom, hullMaterial));

  // Wireframe overlay (subtle).
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geom), hullWireMaterial);
  hullGroup.add(wire);

  // Centerline reference line in 3D, half a metre above and below for context.
  const half = state.length / 2;
  centerlineGeom.setFromPoints([
    new THREE.Vector3(-half, 0, 0),
    new THREE.Vector3( half, 0, 0),
  ]);

  // Station bands: thin closed loops at each station (interior + sheer).
  // The unified-station selection index maps directly to loft.stationRows.
  const N = loft.N;
  loft.stationRows.forEach((entry, idx) => {
    const row = entry.points;
    const isSelected = idx === state.selectedStation;
    const color = isSelected ? 0xfde68a : 0xb45309;
    const opacity = isSelected ? 1.0 : 0.6;
    const linewidth = isSelected ? 2.5 : 1.0;
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth });
    const linePts = [];
    for (let k = 0; k < N; k++) linePts.push(new THREE.Vector3(row[k].x, row[k].z, row[k].y));
    for (let k = N - 1; k >= 0; k--) linePts.push(new THREE.Vector3(row[k].x, row[k].z, -row[k].y));
    linePts.push(linePts[0].clone());
    const g = new THREE.BufferGeometry().setFromPoints(linePts);
    bandGroup.add(new THREE.Line(g, mat));
  });

  lastLoft = loft;
  return loft;
}

rebuildHull(); // populates lastLoft

// ── Post-processing: ambient occlusion ───────────────────────────────────
//
// SSAOPass — screen-space AO. The user-facing knobs (collapsible advanced
// panel below) are the actual SSAOPass parameters; ranges go intentionally
// far past sensible defaults so the look can be pushed to extremes.

const _w0 = threeHost.clientWidth, _h0 = threeHost.clientHeight;
const composer = new EffectComposer(renderer);
composer.setPixelRatio(window.devicePixelRatio);
composer.setSize(_w0, _h0);

composer.addPass(new RenderPass(scene, camera));

const ssaoPass = new SSAOPass(scene, camera, _w0, _h0);
// Defaults tuned for kayak-scale geometry (boat ~5 m): kernel radius
// generous enough to sample neighborhoods comparable to hull curvature,
// max distance wide enough to count gunwale-corner-style depth steps.
ssaoPass.kernelRadius = 0.2;
ssaoPass.minDistance  = 0.00001;
ssaoPass.maxDistance  = 0.5;

// Replace SSAOPass's internal blendMaterial with one that does
// pow(mask, contrast) before the multiply-blend with the beauty pass.
// SSAOPass's stock blendMaterial just copies the mask straight out, so a
// "0.9" occlusion value dims the pixel by 10% — invisible. With pow(0.9, 4)
// it dims by ~34%; pow(0.9, 16) by ~81%. Contrast > 1 darkens crevices
// non-linearly without changing the underlying SSAO algorithm.
const aoContrastUniform = { value: 4.0 };
ssaoPass.blendMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse:   { value: null },
    aoContrast: aoContrastUniform,
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float aoContrast;
    varying vec2 vUv;
    void main() {
      vec3 ao = texture2D(tDiffuse, vUv).rgb;
      gl_FragColor = vec4(pow(ao, vec3(aoContrast)), 1.0);
    }
  `,
  transparent: true,
  depthTest:  false,
  depthWrite: false,
  blending:           THREE.CustomBlending,
  blendSrc:           THREE.DstColorFactor,
  blendDst:           THREE.ZeroFactor,
  blendEquation:      THREE.AddEquation,
  blendSrcAlpha:      THREE.DstAlphaFactor,
  blendDstAlpha:      THREE.ZeroFactor,
  blendEquationAlpha: THREE.AddEquation,
});
composer.addPass(ssaoPass);

// Debug-visibility boost for the SSAO-only / Blur output modes. The stock
// SSAOPass output for those modes is the raw mask, which is hard to read
// when contrast is in pow-amplified ranges. This pass applies the same
// pow curve in screen space, but only when one of those modes is active
// (boost = 1.0 = passthrough otherwise).
//
// Note: ShaderPass *clones* the uniforms object when you hand it a plain
// shader descriptor, so we take a reference to the cloned uniform after
// construction — `aoVisPass.uniforms.boost` — and write its `.value`.
const aoVisPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    boost:    { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float boost;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(pow(c.rgb, vec3(boost)), c.a);
    }
  `,
});
composer.addPass(aoVisPass);
const aoVisBoostUniform = aoVisPass.uniforms.boost;  // reference into the cloned uniform set

composer.addPass(new OutputPass());

// Resize handling.
const resizeObserver = new ResizeObserver(() => {
  const w = threeHost.clientWidth, h = threeHost.clientHeight;
  if (w > 0 && h > 0) {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    ssaoPass.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
});
resizeObserver.observe(threeHost);

// ── Key-light orbit: shift+drag on the 3D canvas ─────────────────────────
// Horizontal drag = azimuth, vertical drag = elevation.
// OrbitControls gets the event first; we intercept in capture phase and
// consume shift+pointer so the camera doesn't also rotate.
{
  let lightDrag = null;
  const RATE = 0.006; // radians per pixel

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!e.shiftKey || e.button !== 0) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    lightDrag = { x: e.clientX, y: e.clientY, az: keyLightAngles.az, el: keyLightAngles.el };
    renderer.domElement.setPointerCapture(e.pointerId);
  }, true);

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!lightDrag) return;
    const dx = e.clientX - lightDrag.x;
    const dy = e.clientY - lightDrag.y;
    keyLightAngles.az = lightDrag.az - dx * RATE;
    keyLightAngles.el = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, lightDrag.el - dy * RATE));
    applyKeyLightPosition();
  }, true);

  renderer.domElement.addEventListener('pointerup',     () => { lightDrag = null; }, true);
  renderer.domElement.addEventListener('pointercancel', () => { lightDrag = null; }, true);
}

// Render loop. Grids live in the main scene now and depth-test against
// the hull so they intersect properly instead of overlaying it.
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  composer.render();
}
animate();

// ── SVG side view ────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, content) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (content != null) e.textContent = content;
  return e;
};

const topSvg     = document.getElementById('top-view');
const sideSvg    = document.getElementById('side-view');
const sectionSvg = document.getElementById('section-view');

// Side view scale constants — also used by drag-handler coordinate math.
// Deck-top n value for any station kind (interior, sheer station). Always
// st.points[last].n in the new model — endpoints no longer exist as stations.
function deckNOf(st) {
  return st.points[st.points.length - 1].n;
}

const SIDE_SCALE_X = 100; // px/m horizontal
const SIDE_SCALE_Z = 200; // px/m vertical (exaggerated so rocker is visible)

// ── Viewport state for zoom / pan ─────────────────────────────────────────
// Side view: stored as the SVG viewBox (minX, minY, W, H).
const SIDE_VP_DEFAULT = { minX: -340, minY: -140, W: 680, H: 240 };
const sideVP = { ...SIDE_VP_DEFAULT };

function applySideViewBox() {
  sideSvg.setAttribute('viewBox',
    `${sideVP.minX.toFixed(2)} ${sideVP.minY.toFixed(2)} ${sideVP.W.toFixed(2)} ${sideVP.H.toFixed(2)}`);
}

// Top view: an extra zoom + pan offset applied on top of the isotropic auto-fit.
const topVP = { zoom: 1, offX: 0, offY: 0 };

// ── Top view (plan view, X-Y vertical orientation) ────────────────────────
// World X (longitudinal) maps to SVG Y (hull runs vertically, bow at top).
// World Y (beam/transverse) maps to SVG X (beam expands horizontally).

// Computed dynamically in renderTopView() to fill the pane.
let TOP_SCALE_X = 50;
let TOP_SCALE_Y = 320;

function renderTopView() {
  topSvg.innerHTML = '';
  // Scale factor: divide SVG-unit sizes by this so control points stay
  // constant pixel size regardless of zoom level.
  const tf = topVP.zoom;
  // Reference image (behind everything else).
  if (state.topRef?.url) {
    const r = state.topRef;
    // Top view: SVG X = worldY * SCALE, SVG Y = -worldX * SCALE (bow at top).
    // The image top-left in SVG: x = portEdge(worldY) * scale, y = -bowEdge(worldX) * scale
    const imgEl = document.createElementNS(SVG_NS, 'image');
    imgEl.setAttribute('href', r.url);
    // SVG x = worldY (portEdge) * scale; worldY port edge = r.worldY (negative = port)
    imgEl.setAttribute('x',      (r.worldY * TOP_SCALE_Y).toFixed(1));
    // SVG y = -worldX (bowEdge) * scale; bow edge = r.worldX + r.worldW (stern+length=bow)
    imgEl.setAttribute('y',      (-(r.worldX + r.worldW) * TOP_SCALE_X).toFixed(1));
    imgEl.setAttribute('width',  (r.worldH * TOP_SCALE_Y).toFixed(1));   // beam maps to SVG X
    imgEl.setAttribute('height', (r.worldW * TOP_SCALE_X).toFixed(1));   // length maps to SVG Y
    imgEl.setAttribute('opacity', r.opacity);
    imgEl.setAttribute('preserveAspectRatio', 'none');
    imgEl.setAttribute('data-drag', 'ref-top');
    topSvg.appendChild(imgEl);
  }
  const xOfT = (wy) =>  wy * TOP_SCALE_Y;
  const yOfT = (wx) => -wx * TOP_SCALE_X;
  const p2s  = (wx, wy) => `${xOfT(wy).toFixed(2)},${yOfT(wx).toFixed(2)}`;
  const pD   = (pts) => 'M ' + pts.map(p => `${xOfT(p.y).toFixed(2)} ${yOfT(p.x).toFixed(2)}`).join(' L ');

  const beamPts = sampledBeamLine(state);

  // ── Uniform px/m scale: real aspect ratio, letterboxed ──────────────
  // Both axes share one scale so 1 m along X (longitudinal, screen Y) and
  // 1 m along Y (transverse, screen X) render at the same pixel size.
  {
    const knots = state.spine.knots;
    const stX = knots[0].x, bwX = knots[knots.length-1].x;
    const maxB = Math.max(...beamPts.map(p => p.y), 0.05);
    const padX = 0.25, padY = 0.06;  // world-unit padding (metres)
    const bbox  = topSvg.getBoundingClientRect();
    const paneH = Math.max(bbox.height > 10 ? bbox.height : topSvg.parentElement.clientHeight - 44, 100);
    const paneW = Math.max(bbox.width  > 10 ? bbox.width  : topSvg.clientWidth, 60);
    const Lx = (bwX - stX) + 2 * padX;            // metres needed vertically
    const Ly = (maxB + padY) * 2;                 // metres needed horizontally
    const s = Math.min(paneW / Ly, paneH / Lx);   // px/m, isotropic
    TOP_SCALE_X = s;
    TOP_SCALE_Y = s;
    const vbW = paneW;
    const vbH = paneH;
    const cxX = (stX + bwX) / 2;                  // world X centre of hull
    // Base fit centre in SVG coords, then apply topVP zoom/pan on top.
    const baseCX = 0;
    const baseCY = -cxX * s;
    const fitCX  = baseCX + topVP.offX;
    const fitCY  = baseCY + topVP.offY;
    const zW     = vbW / topVP.zoom;
    const zH     = vbH / topVP.zoom;
    topSvg.setAttribute('viewBox',
      `${(fitCX - zW / 2).toFixed(1)} ${(fitCY - zH / 2).toFixed(1)} ${zW.toFixed(1)} ${zH.toFixed(1)}`);
  }

  const sternKnot = state.spine.knots[0];
  const bowKnot   = state.spine.knots[state.spine.knots.length-1];
  // Centreline reference (Y=0 axis, vertical line).
  topSvg.appendChild(el('line', {
    x1: 0, y1: yOfT(sternKnot.x) + 10,
    x2: 0, y2: yOfT(bowKnot.x)   - 10,
    class: 'water',
  }));

  // Hull silhouette: starboard (wy>0) + port mirror (wy<0).
  const stbd = beamPts.map(p => p2s(p.x,  p.y));
  const port  = [...beamPts].reverse().map(p => p2s(p.x, -p.y));
  topSvg.appendChild(el('polygon', { points: [...stbd, ...port].join(' '), class: 'silhouette' }));

  // Beam curves: starboard solid, port ghosted.
  topSvg.appendChild(el('path', { class: 'beam-curve',        d: pD(beamPts) }));
  topSvg.appendChild(el('path', { class: 'beam-curve mirror', d: pD(beamPts.map(p => ({ x: p.x, y: -p.y }))) }));

  // ── Mesh overlay ─────────────────────────────────────────────────────
  if (state.showLoftMesh && lastLoft) {
    const opacity = state.meshOpacity / 100;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('style', `opacity:${opacity}`);
    // Longitudinal lines (k fixed, i varies) — trace hull outline from above.
    for (let k = 0; k < (lastLoft.rows[0]?.length || 0); k++) {
      const stbdD = lastLoft.rows.map(r => r[k] ? `${xOfT( r[k].y).toFixed(1)} ${yOfT(r[k].x).toFixed(1)}` : null).filter(Boolean);
      const portD  = lastLoft.rows.map(r => r[k] ? `${xOfT(-r[k].y).toFixed(1)} ${yOfT(r[k].x).toFixed(1)}` : null).filter(Boolean);
      if (stbdD.length > 1) g.appendChild(el('path', { class: 'loft-mesh-line', d: 'M ' + stbdD.join(' L ') }));
      if (portD.length  > 1) g.appendChild(el('path', { class: 'loft-mesh-line', d: 'M ' + portD.join(' L ') }));
    }
    // Transverse lines (i fixed, k varies) — station widths.
    for (let i = 0; i < lastLoft.rows.length; i++) {
      const row = lastLoft.rows[i];
      const stbdPts = row.map(v => `${xOfT( v.y).toFixed(1)} ${yOfT(v.x).toFixed(1)}`);
      const portPts = [...row].reverse().map(v => `${xOfT(-v.y).toFixed(1)} ${yOfT(v.x).toFixed(1)}`);
      g.appendChild(el('path', { class: 'loft-mesh-line', d: 'M ' + [...stbdPts, ...portPts].join(' L ') + ' Z' }));
    }
    topSvg.appendChild(g);
  }

  // ── Bézier control points ─────────────────────────────────────────────
  const bl    = state.beamLine;
  const sorted = [...bl.peaks].sort((a, b) => a.x - b.x);

  const nodes = [
    { p: { x: sternKnot.x, y: 0 }, hOut: { x: sternKnot.x + bl.sternHandle.dx, y: bl.sternHandle.dy }, id: 'stern' },
    ...sorted.map((pk, i) => ({
      p:    { x: pk.x, y: pk.y },
      hIn:  { x: pk.x - pk.hdx, y: pk.y - pk.hdy },
      hOut: { x: pk.x + pk.hdx, y: pk.y + pk.hdy },
      id:   String(i),
    })),
    { p: { x: bowKnot.x, y: 0 }, hIn: { x: bowKnot.x + bl.bowHandle.dx, y: bl.bowHandle.dy }, id: 'bow' },
  ];

  nodes.forEach(nd => {
    const cx = xOfT(nd.p.y), cy = yOfT(nd.p.x);
    const isEndpt = nd.id === 'stern' || nd.id === 'bow';
    const dragAnchor = isEndpt ? `beam-endpt-${nd.id}` : 'beam-peak';

    for (const [key, drag] of [['hIn', 'beam-handle-in'], ['hOut', 'beam-handle-out']]) {
      if (!nd[key]) continue;
      const hx = xOfT(nd[key].y), hy = yOfT(nd[key].x);
      topSvg.appendChild(el('line',   { x1: cx, y1: cy, x2: hx, y2: hy, class: 'handle-line' }));
      topSvg.appendChild(el('circle', { cx: hx, cy: hy, r: 10/tf,  class: 'handle-hit',   'data-drag': drag, 'data-idx': nd.id }));
      topSvg.appendChild(el('circle', { cx: hx, cy: hy, r: 3.5/tf, class: 'spine-handle', 'data-drag': drag, 'data-idx': nd.id }));
    }
    topSvg.appendChild(el('circle', { cx, cy, r: 14/tf, class: 'spine-hit',    'data-drag': dragAnchor, 'data-idx': nd.id }));
    topSvg.appendChild(el('circle', { cx, cy, r: 5/tf,  class: 'spine-anchor', 'data-drag': dragAnchor, 'data-idx': nd.id }));
  });

  // ── Station marks ────────────────────────────────────────────────────
  const spSampled = sampledSpine(state.spine.knots, 64);
  const sortedStTop = [...state.stations].sort((a, b) => a.s - b.s);
  sortedStTop.forEach((st, i) => {
    const kx = spineAt(spSampled, st.s).p.x;
    const halfB = beamEvalAt(beamPts, kx);
    const isSel = i === state.selectedStation;
    topSvg.appendChild(el('line', {
      x1: xOfT(-halfB - 0.05), y1: yOfT(kx), x2: xOfT(halfB + 0.05), y2: yOfT(kx),
      class: 'station-hit', 'data-drag': 'station', 'data-idx': String(i),
    }));
    topSvg.appendChild(el('line', {
      x1: xOfT(-halfB), y1: yOfT(kx), x2: xOfT(halfB), y2: yOfT(kx),
      class: 'station-chord' + (isSel ? ' selected' : ''),
    }));
    topSvg.appendChild(el('circle', {
      cx: 0, cy: yOfT(kx), r: 3.5/tf,
      class: 'station-keel' + (isSel ? ' selected' : ''),
    }));
    topSvg.appendChild(el('text', {
      x: xOfT(halfB) + 8/tf, y: yOfT(kx) + 4/tf, class: 'station-label', 'font-size': 9/tf,
    }, String(i + 1)));
  });

  // Labels.
  topSvg.appendChild(el('text', { x: 0, y: yOfT(bowKnot.x)   - 8/tf,  class: 'label', 'text-anchor': 'middle', 'font-size': 9/tf }, 'bow'));
  topSvg.appendChild(el('text', { x: 0, y: yOfT(sternKnot.x) + 16/tf, class: 'label', 'text-anchor': 'middle', 'font-size': 9/tf }, 'stern'));

  // ── Coordinate-system badge (X-Y plane, top-down) ──────────────────────
  // Bottom-left corner of the viewBox.
}

// ── Side view ─────────────────────────────────────────────────────────────

function renderSideView() {
  applySideViewBox();
  sideSvg.innerHTML = '';
  // Scale factor: divide SVG-unit sizes by this so control points stay
  // constant pixel size regardless of zoom level.
  const sf = SIDE_VP_DEFAULT.W / sideVP.W;
  // Reference image (behind everything else).
  if (state.sideRef?.url) {
    const r = state.sideRef;
    const imgEl = document.createElementNS(SVG_NS, 'image');
    imgEl.setAttribute('href', r.url);
    imgEl.setAttribute('x',      (r.worldX * SIDE_SCALE_X).toFixed(1));
    imgEl.setAttribute('y',      (-r.worldZ * SIDE_SCALE_Z).toFixed(1));
    imgEl.setAttribute('width',  (r.worldW * SIDE_SCALE_X).toFixed(1));
    imgEl.setAttribute('height', (r.worldH * SIDE_SCALE_Z).toFixed(1));
    imgEl.setAttribute('opacity', r.opacity);
    imgEl.setAttribute('preserveAspectRatio', 'none');
    imgEl.setAttribute('data-drag', 'ref-side');
    sideSvg.appendChild(imgEl);
  }
  const xOf = (x) => x * SIDE_SCALE_X;
  const yOf = (z) => -z * SIDE_SCALE_Z;

  const spSampled   = sampledSpine(state.spine.knots,   64);
  const deckSampled = sampledSpine(state.deckLine.knots, 64);
  const pt2str = p => `${xOf(p.x).toFixed(2)},${yOf(p.z).toFixed(2)}`;
  const pathD  = pts => 'M ' + pts.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L ');

  // Waterline.
  sideSvg.appendChild(el('line', { x1: -340, y1: yOf(0), x2: 340, y2: yOf(0), class: 'water' }));
  sideSvg.appendChild(el('text', {
    x: 320, y: yOf(0) - 3, class: 'label', 'text-anchor': 'end', 'font-size': 9/sf,
  }, 'WL (Z = 0)'));

  // ── Hull silhouette and curves from mesh ────────────────────────────
  let keelPts = [], perimPts = [];
  if (lastLoft) {
    const N = lastLoft.N;
    keelPts  = lastLoft.rows.map(r => ({ x: r[0].x, z: r[0].z }));
    perimPts = lastLoft.rows.map(r => ({ x: r[N-1].x, z: r[N-1].z }));
  }
  const silPts = [
    ...perimPts.map(pt2str),
    ...[...keelPts].reverse().map(pt2str),
  ];
  sideSvg.appendChild(el('polygon', { points: silPts.join(' '), class: 'silhouette' }));
  sideSvg.appendChild(el('path', { class: 'keel', d: pathD(keelPts) }));
  sideSvg.appendChild(el('path', { class: 'deck-pts-line', d: pathD(perimPts) }));

  // ── Deck line: on-curve knots, same structure as rocker ──────────────
  // Handles drawn before curve so curve renders on top.
  state.deckLine.knots.forEach((k, ki) => {
    const { aft, fore } = knotHandles(k);
    if (k.aftLen > 0)
      sideSvg.appendChild(el('line', { x1: xOf(k.x), y1: yOf(k.z), x2: xOf(aft.x),  y2: yOf(aft.z),  class: 'deck-handle-line' }));
    if (k.foreLen > 0)
      sideSvg.appendChild(el('line', { x1: xOf(k.x), y1: yOf(k.z), x2: xOf(fore.x), y2: yOf(fore.z), class: 'deck-handle-line' }));
    if (k.aftLen > 0) {
      sideSvg.appendChild(el('circle', { cx: xOf(aft.x), cy: yOf(aft.z), r: 10/sf, class: 'handle-hit', 'data-drag': 'deck-aft', 'data-idx': String(ki) }));
      sideSvg.appendChild(el('circle', { cx: xOf(aft.x), cy: yOf(aft.z), r: 3.5/sf, class: 'deck-handle', 'data-drag': 'deck-aft', 'data-idx': String(ki) }));
    }
    if (k.foreLen > 0) {
      sideSvg.appendChild(el('circle', { cx: xOf(fore.x), cy: yOf(fore.z), r: 10/sf, class: 'handle-hit', 'data-drag': 'deck-fore', 'data-idx': String(ki) }));
      sideSvg.appendChild(el('circle', { cx: xOf(fore.x), cy: yOf(fore.z), r: 3.5/sf, class: 'deck-handle', 'data-drag': 'deck-fore', 'data-idx': String(ki) }));
    }
    const isEndpt = ki === 0 || ki === state.deckLine.knots.length - 1;
    sideSvg.appendChild(el('circle', { cx: xOf(k.x), cy: yOf(k.z), r: 14/sf, class: 'handle-hit', 'data-drag': 'deck-knot', 'data-idx': String(ki) }));
    sideSvg.appendChild(el('circle', { cx: xOf(k.x), cy: yOf(k.z), r: 5/sf, class: 'deck-knot' + (isEndpt ? '' : ' shape-knot'), 'data-drag': 'deck-knot', 'data-idx': String(ki) }));
  });
  // Deck line curve.
  sideSvg.appendChild(el('path', {
    class: 'deck-bezier',
    d: 'M ' + deckSampled.pts.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.y).toFixed(2)}`).join(' L '),
  }));

  // ── Rocker spine: N-knot piecewise Bezier ───────────────────────────
  sideSvg.appendChild(el('path', {
    class: 'spine-line',
    d: 'M ' + spSampled.pts.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.y).toFixed(2)}`).join(' L '),
  }));
  // Draw each knot with its handles.
  state.spine.knots.forEach((k, ki) => {
    const { aft, fore } = knotHandles(k);
    if (k.aftLen > 0)
      sideSvg.appendChild(el('line', { x1: xOf(k.x), y1: yOf(k.z), x2: xOf(aft.x),  y2: yOf(aft.z),  class: 'handle-line' }));
    if (k.foreLen > 0)
      sideSvg.appendChild(el('line', { x1: xOf(k.x), y1: yOf(k.z), x2: xOf(fore.x), y2: yOf(fore.z), class: 'handle-line' }));
    // Handle dots.
    if (k.aftLen > 0) {
      sideSvg.appendChild(el('circle', { cx: xOf(aft.x), cy: yOf(aft.z), r: 10/sf, class: 'handle-hit', 'data-drag': 'knot-aft', 'data-idx': String(ki) }));
      sideSvg.appendChild(el('circle', { cx: xOf(aft.x), cy: yOf(aft.z), r: 3.5/sf, class: 'spine-handle', 'data-drag': 'knot-aft', 'data-idx': String(ki) }));
    }
    if (k.foreLen > 0) {
      sideSvg.appendChild(el('circle', { cx: xOf(fore.x), cy: yOf(fore.z), r: 10/sf, class: 'handle-hit', 'data-drag': 'knot-fore', 'data-idx': String(ki) }));
      sideSvg.appendChild(el('circle', { cx: xOf(fore.x), cy: yOf(fore.z), r: 3.5/sf, class: 'spine-handle', 'data-drag': 'knot-fore', 'data-idx': String(ki) }));
    }
    // On-curve knot dot.
    const isEndpt = ki === 0 || ki === state.spine.knots.length-1;
    sideSvg.appendChild(el('circle', { cx: xOf(k.x), cy: yOf(k.z), r: 14/sf, class: 'spine-hit', 'data-drag': 'knot', 'data-idx': String(ki) }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(k.x), cy: yOf(k.z), r: 5/sf,
      class: 'spine-anchor' + (isEndpt ? '' : ' shape-knot'),
      'data-drag': 'knot', 'data-idx': String(ki),
    }));
    // Endpoint labels.
    if (ki === 0)
      sideSvg.appendChild(el('text', { x: xOf(k.x), y: yOf(0) + 22/sf, class: 'label', 'text-anchor': 'middle', 'font-size': 9/sf }, 'stern'));
    if (ki === state.spine.knots.length-1)
      sideSvg.appendChild(el('text', { x: xOf(k.x), y: yOf(0) + 22/sf, class: 'label', 'text-anchor': 'middle', 'font-size': 9/sf }, 'bow'));
  });

  // ── Stations: keel (bottom) + deck (top) + chord line ──────────────
  const sortedStSide = [...state.stations].sort((a, b) => a.s - b.s);
  sortedStSide.forEach((st, i) => {
    const { p: kp } = spineAt(spSampled,   st.s);
    const { p: dp } = spineAt(deckSampled, st.s);
    const dz = dp.z;
    const isSel = i === state.selectedStation;
    const sel = isSel ? ' selected' : '';
    // Chord line keel→deck.
    sideSvg.appendChild(el('line', {
      x1: xOf(kp.x), y1: yOf(kp.z), x2: xOf(kp.x), y2: yOf(dz),
      class: 'station-line' + sel,
    }));
    // Keel (bottom) dot — draggable, slides along rocker.
    sideSvg.appendChild(el('circle', { cx: xOf(kp.x), cy: yOf(kp.z), r: 14/sf, class: 'station-hit', 'data-drag': 'station', 'data-idx': String(i) }));
    sideSvg.appendChild(el('circle', { cx: xOf(kp.x), cy: yOf(kp.z), r: 5/sf, class: 'station-keel' + sel, 'data-drag': 'station', 'data-idx': String(i) }));
    // Deck (top) dot — read-only, shows where deck curve is.
    sideSvg.appendChild(el('circle', { cx: xOf(kp.x), cy: yOf(dz), r: 4/sf, class: 'station-deck-top' + sel, 'pointer-events': 'none' }));
    // Label above deck dot.
    sideSvg.appendChild(el('text', { x: xOf(kp.x), y: yOf(dz) - 8/sf, class: 'station-label', 'font-size': 9/sf, 'text-anchor': 'middle' }, String(i + 1)));
  });

  // ── Loft mesh overlay (if enabled) ───────────────────────────────────
  if (state.showLoftMesh && lastLoft) {
    const opacity = state.meshOpacity / 100;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('style', `opacity: ${opacity}`);

    // Draw wireframe from the loft mesh (M×N quad grid in 3D).
    // Project orthographically to side view (drop Y coordinate).
    if (lastLoft.rows && lastLoft.rows.length > 0) {
      // Draw longitudinal lines (M direction).
      for (let m = 0; m < lastLoft.rows.length; m++) {
        const row = lastLoft.rows[m];
        if (row.length < 2) continue;
        const pts = row.map(v => `${xOf(v.x).toFixed(2)} ${yOf(v.z).toFixed(2)}`);
        const path = el('path', {
          class: 'loft-mesh-line',
          d: 'M ' + pts.join(' L '),
        });
        group.appendChild(path);
      }
      // Draw transverse lines (N direction).
      for (let n = 0; n < (lastLoft.rows[0]?.length || 0); n++) {
        const pts = [];
        for (let m = 0; m < lastLoft.rows.length; m++) {
          if (n < lastLoft.rows[m].length) {
            pts.push(`${xOf(lastLoft.rows[m][n].x).toFixed(2)} ${yOf(lastLoft.rows[m][n].z).toFixed(2)}`);
          }
        }
        if (pts.length >= 2) {
          const path = el('path', {
            class: 'loft-mesh-line',
            d: 'M ' + pts.join(' L '),
          });
          group.appendChild(path);
        }
      }
    }
    sideSvg.appendChild(group);
  }
}

// Build the unified station list for the UI (interior + sheer; not the
// loft's synthetic-tip-augmented version). Each entry has:
//   { kind: 'interior' | 'bowSheer' | 'sternSheer', stationIdx, ref, label }
// where stationIdx is the index into the underlying array (state.stations
// or sheer.stations) and `ref` is the actual station object.
function listAllStations(state) {
  return [...state.stations]
    .sort((a, b) => a.s - b.s)
    .map((st, i) => ({ kind: 'interior', stationIdx: i, ref: st, label: String(i + 1) }));
}

// Section-view scale constants — also used by drag-handler coordinate math.
const SECTION_SCALE   = 600; // px/m  (reference, not used directly for b or n)
const SECTION_SCALE_N = SECTION_SCALE * DEFAULT_DECK_N;    // px/unit (n, normalised)
const SECTION_SCALE_B = SECTION_SCALE * DEFAULT_HALF_BEAM; // px/unit (b, normalised)

// Look up the currently selected station object (interior or sheer).
function selectedStationObj() {
  const unified = listAllStations(state);
  return unified[state.selectedStation] || null;
}

function renderSectionView() {
  sectionSvg.innerHTML = '';
  const bOf = (b) => b * SECTION_SCALE_B;
  const nOf = (n) => -n * SECTION_SCALE_N;

  const sel = selectedStationObj();
  if (!sel) {
    sectionSvg.appendChild(el('text', {
      x: 0, y: 0, class: 'label', 'text-anchor': 'middle',
    }, 'no station selected'));
    return;
  }
  const station = sel.ref;
  const lastIdx = station.points.length - 1;

  // Centerline (b = 0).
  sectionSvg.appendChild(el('line', {
    x1: 0, y1: -205, x2: 0, y2: 85, class: 'axis',
  }));
  sectionSvg.appendChild(el('text', { x: 5, y: -192, class: 'label' }, 'CL'));

  // Keel reference (n = 0).
  sectionSvg.appendChild(el('line', {
    x1: -195, y1: nOf(0), x2: 195, y2: nOf(0), class: 'axis',
  }));
  sectionSvg.appendChild(el('text', {
    x: 193, y: nOf(0) + 18, class: 'label', 'text-anchor': 'end',
  }, 'keel'));

  // Deck reference (n = 1).
  sectionSvg.appendChild(el('line', {
    x1: -195, y1: nOf(1), x2: 195, y2: nOf(1), class: 'axis deck-axis',
  }));
  sectionSvg.appendChild(el('text', {
    x: 193, y: nOf(1) - 6, class: 'label', 'text-anchor': 'end',
  }, 'deck'));

  // Closed-loop section.
  const dense = sampleSpline(station.points, 'b', 'n', 24);
  const stbdPath = 'M ' + dense.map(p => `${bOf( p.x).toFixed(2)} ${nOf(p.y).toFixed(2)}`).join(' L ');
  const portPath = 'M ' + dense.map(p => `${bOf(-p.x).toFixed(2)} ${nOf(p.y).toFixed(2)}`).join(' L ');
  sectionSvg.appendChild(el('path', { class: 'section-curve',  d: stbdPath }));
  sectionSvg.appendChild(el('path', { class: 'section-mirror', d: portPath }));

  // Control points. Keel (index 0) and deck-end (last) are locked.
  station.points.forEach((p, i) => {
    const isKeel       = i === 0;
    const isDeck       = i === lastIdx;
    const isCenterline = isKeel || isDeck;
    const cls = (isKeel ? 'keel ' : '') + (isDeck ? 'deck ' : '') + (isCenterline ? 'centerline ' : '');
    sectionSvg.appendChild(el('circle', {
      cx: bOf(p.b), cy: nOf(p.n), r: 22,
      class: ('ctrl-hit ' + cls).trim(),
      'data-drag': 'ctrl', 'data-idx': String(i),
    }));
    sectionSvg.appendChild(el('circle', {
      cx: bOf(p.b), cy: nOf(p.n), r: 9,
      class: ('ctrl-pt ' + cls + (p.chine ? 'chine' : '')).trim(),
      'data-drag': 'ctrl', 'data-idx': String(i),
    }));
  });

  if (station.points.length <= 5) {
    sectionSvg.appendChild(el('text', {
      x: 0, y: 72, class: 'label', 'text-anchor': 'middle',
    }, 'click · right-click to delete'));
  }

  // Coordinate-system badge (Y-Z plane, looking forward toward bow).
  {
    const ax = -193, ay = 80, L = 22;
    sectionSvg.appendChild(el('line', { x1: ax, y1: ay, x2: ax + L, y2: ay,     class: 'axis-arrow' }));
    sectionSvg.appendChild(el('line', { x1: ax, y1: ay, x2: ax,     y2: ay - L, class: 'axis-arrow' }));
    sectionSvg.appendChild(el('text', { x: ax + L + 3, y: ay + 7,     class: 'axis-label' }, '+Y'));
    sectionSvg.appendChild(el('text', { x: ax - 3,     y: ay - L - 3, class: 'axis-label', 'text-anchor': 'start' }, '+Z'));
  }
}

// ── Controls panel (Phase A: read-only-ish) ──────────────────────────────

const lengthEl   = document.getElementById('length');
const lengthOut  = document.getElementById('length-out');
const loftResEl  = document.getElementById('loft-res');
const stationsOl = document.getElementById('stations');
const stationLabel = document.getElementById('station-label');
const stationCount = document.querySelector('.station-count');

function renderStationList() {
  stationsOl.innerHTML = '';
  const unified = listAllStations(state);
  unified.forEach((entry, i) => {
    const st = entry.ref;
    const li = document.createElement('li');
    li.className =
      (i === state.selectedStation ? 'selected ' : '') +
      '';
    li.dataset.idx = String(i);
    const name = document.createElement('span');
    name.textContent = `St ${entry.label}  ·  s = ${st.s.toFixed(2)}`;
    const pips = document.createElement('span');
    pips.className = 'pips';
    pips.textContent = '●'.repeat(Math.min(st.points.length, 9));
    li.append(name, pips);
    li.addEventListener('click', () => selectStation(i));
    stationsOl.appendChild(li);
  });
  stationCount.textContent = `${state.stations.length} of ${MAX_INTERIOR}`;
}

function stationLabelFor(i) {
  const e = listAllStations(state)[i];
  return e ? `St ${e.label}` : '';
}

function selectStation(i) {
  const total = listAllStations(state).length;
  if (total === 0) return;
  state.selectedStation = ((i % total) + total) % total;
  stationLabel.textContent = stationLabelFor(state.selectedStation);
  renderStationList();
  renderSectionView();
  rebuildHull();
  renderSideView();

  renderTopView();
  syncStationButtons();
}

document.getElementById('prev-station').addEventListener('click', () => selectStation(state.selectedStation - 1));
document.getElementById('next-station').addEventListener('click', () => selectStation(state.selectedStation + 1));

// Bounds are loose guard rails so the loft never collapses to nothing.
const MAX_INTERIOR = 9;
const MIN_INTERIOR = 2;
const MAX_SHEER_STATIONS_PER_END = 5;

// + add station: contextual based on the currently selected entry.
//   - interior selected: add a new interior station at the largest rocker gap
//   - sheer selected:    add a new sheer station on the same end at the largest sheer gap
function addStation() {
  if (state.stations.length >= MAX_INTERIOR) return;
  // Insert at the midpoint of the largest gap in s-space.
  const sortedSs = [0, ...state.stations.map(st => st.s).sort((a, b) => a - b), 1];
  let maxGap = 0, gapStart = 0;
  for (let i = 0; i < sortedSs.length - 1; i++) {
    const g = sortedSs[i + 1] - sortedSs[i];
    if (g > maxGap) { maxGap = g; gapStart = sortedSs[i]; }
  }
  const newS = gapStart + maxGap / 2;
  const points = sectionAtS(state, newS, 7);
  state.stations.sort((a, b) => a.s - b.s);
  let insertIdx = state.stations.findIndex(st => st.s > newS);
  if (insertIdx === -1) insertIdx = state.stations.length;
  state.stations.splice(insertIdx, 0, { s: newS, points });
  state.selectedStation = insertIdx;

  stationLabel.textContent = stationLabelFor(state.selectedStation);
  rebuildHull();
  renderStationList();
  renderSideView();
  renderTopView();
  renderSectionView();
  syncStationButtons();
}

function removeStation() {
  const sortedSt = [...state.stations].sort((a, b) => a.s - b.s);
  const sel = sortedSt[state.selectedStation];
  if (!sel) return;
  if (state.stations.length <= MIN_INTERIOR) return;
  const idx = state.stations.indexOf(sel);
  state.stations.splice(idx, 1);
  const total = state.stations.length;
  state.selectedStation = Math.min(state.selectedStation, total - 1);
  stationLabel.textContent = stationLabelFor(state.selectedStation);

  rebuildHull();
  renderStationList();
  renderSideView();

  renderTopView();
  renderSectionView();
  syncStationButtons();
}

const addStationBtn    = document.getElementById('add-station');
const removeStationBtn = document.getElementById('remove-station');
addStationBtn.disabled    = false;
removeStationBtn.disabled = false;
addStationBtn.removeAttribute('title');
removeStationBtn.removeAttribute('title');
addStationBtn.addEventListener('click', addStation);
removeStationBtn.addEventListener('click', removeStation);

function syncStationButtons() {
  addStationBtn.disabled = state.stations.length >= MAX_INTERIOR;
  removeStationBtn.disabled = state.stations.length <= MIN_INTERIOR;
}
syncStationButtons();

// Length slider — proportionally rescales all X coordinates.
lengthEl.addEventListener('input', () => {
  const newL     = parseFloat(lengthEl.value);
  const sternX   = state.spine.knots[0].x;
  const bowX     = state.spine.knots[state.spine.knots.length-1].x;
  const currentL = bowX - sternX;
  if (currentL > 0) {
    const r = newL / currentL;
    const sx = v => v * r;

    // Rocker knots: scale X positions and handle lengths (X-component of angle*len).
    // Angle stays the same; foreLen/aftLen scale by r (they are longitudinal distances).
    state.spine.knots.forEach(k => {
      k.x = sx(k.x);
      k.foreLen *= r;
      k.aftLen  *= r;
    });

    // Deck line knots.
    state.deckLine.knots.forEach(k => { k.x = sx(k.x); k.foreLen *= r; k.aftLen *= r; });

    // Beam line peaks and handles.
    const bl = state.beamLine;
    bl.sternHandle.dx *= r;
    bl.bowHandle.dx   *= r;
    bl.peaks.forEach(pk => { pk.x = sx(pk.x); pk.hdx *= r; });
  }
  state.length = newL;
  lengthOut.textContent = newL.toFixed(2) + ' m';
  rebuildHull();
  renderSideView();
  renderTopView();
});

loftResEl.addEventListener('change', () => {
  state.loftRes = loftResEl.value;
  rebuildHull();
  // Wireframes in side/top views read lastLoft.rows — refresh now so the
  // overlay density updates immediately to match the 3D mesh.
  renderSideView();
  renderTopView();
});

const xSubdivEl = document.getElementById('x-subdiv');
xSubdivEl.value = String(state.xSubdiv);
xSubdivEl.addEventListener('change', () => {
  state.xSubdiv = parseInt(xSubdivEl.value, 10) || 1;
  rebuildHull();
  renderSideView();
  renderTopView();
});

// Spine radius — translates half-meshes ±r in Y.
const spineRadiusEl  = document.getElementById('spine-radius');
const spineRadiusOut = document.getElementById('spine-r-out');
const fmtR = (v) => (v * 1000).toFixed(0) + ' mm';
spineRadiusOut.textContent = fmtR(state.spineRadius);
spineRadiusEl.value = String(state.spineRadius);
spineRadiusEl.addEventListener('input', () => {
  state.spineRadius = parseFloat(spineRadiusEl.value);
  spineRadiusOut.textContent = fmtR(state.spineRadius);
  rebuildHull();
});

// Hull colors — outside is the material's .color (used on front-facing
// fragments); inside is the insideColor uniform injected into the shader.
const colorOutEl = document.getElementById('color-out');
const colorInEl  = document.getElementById('color-in');
hullMaterial.color.set(colorOutEl.value);
insideColorUniform.value.set(colorInEl.value);
colorOutEl.addEventListener('input', () => hullMaterial.color.set(colorOutEl.value));
colorInEl .addEventListener('input', () => insideColorUniform.value.set(colorInEl.value));

// ── Loft mesh overlay controls ────────────────────────────────────────────
const showMeshEl = document.getElementById('show-mesh');
const meshOpacityEl = document.getElementById('mesh-opacity');
const meshOpacityOut = document.getElementById('mesh-opacity-out');

// Sync controls to state defaults.
showMeshEl.checked         = state.showLoftMesh;
meshOpacityEl.value        = state.meshOpacity;
meshOpacityOut.textContent = state.meshOpacity.toFixed(0) + '%';

showMeshEl.addEventListener('change', () => {
  state.showLoftMesh = showMeshEl.checked;
  renderSideView();

  renderTopView();
});

meshOpacityEl.addEventListener('input', () => {
  state.meshOpacity = parseFloat(meshOpacityEl.value);
  meshOpacityOut.textContent = state.meshOpacity.toFixed(0) + '%';
  renderSideView();

  renderTopView();
});

// ── Ambient occlusion — direct SSAOPass parameter knobs ──────────────────
//
// All four sliders + the output selector talk straight to the SSAOPass
// fields. Ranges are intentionally permissive (kernel radius up to 10 m,
// max distance up to 10 m) so the look can be pushed to extremes.

const aoEnabledEl = document.getElementById('ao-enabled');
const aoKrEl      = document.getElementById('ao-kr');
const aoMnEl      = document.getElementById('ao-mn');
const aoMxEl      = document.getElementById('ao-mx');
const aoCtEl      = document.getElementById('ao-ct');
const aoOutSel    = document.getElementById('ao-output');
const aoKrOut     = document.getElementById('ao-kr-out');
const aoMnOut     = document.getElementById('ao-mn-out');
const aoMxOut     = document.getElementById('ao-mx-out');
const aoCtOut     = document.getElementById('ao-ct-out');
const aoResetBtn  = document.getElementById('ao-reset');

// AO defaults tuned for visible contour shading on a kayak hull. Combined
// with the lower ambient + stronger key light above, contours on the hull
// belly should read clearly.
const AO_DEFAULTS = {
  enabled:      true,
  kernelRadius: 0.35,
  minDistance:  0.0001,
  maxDistance:  0.6,
  contrast:     12.0,
  output:       0,   // Default (beauty + AO)
};

const aoOutputModes = [
  SSAOPass.OUTPUT.Default,
  SSAOPass.OUTPUT.SSAO,
  SSAOPass.OUTPUT.Blur,
  SSAOPass.OUTPUT.Beauty,
  SSAOPass.OUTPUT.Depth,
  SSAOPass.OUTPUT.Normal,
];

function fmtFixed(v, digits) {
  // Compact display: trim trailing zeros after the decimal.
  return parseFloat(v).toFixed(digits).replace(/\.?0+$/, '');
}

function syncAOLabels() {
  aoKrOut.textContent = fmtFixed(aoKrEl.value, 3) + ' m';
  aoMnOut.textContent = fmtFixed(aoMnEl.value, 5) + ' m';
  aoMxOut.textContent = fmtFixed(aoMxEl.value, 4) + ' m';
  aoCtOut.textContent = '×' + fmtFixed(aoCtEl.value, 1);
}

function applyAO() {
  ssaoPass.enabled      = aoEnabledEl.checked;
  ssaoPass.kernelRadius = parseFloat(aoKrEl.value);
  ssaoPass.minDistance  = parseFloat(aoMnEl.value);
  ssaoPass.maxDistance  = parseFloat(aoMxEl.value);
  const mode = parseInt(aoOutSel.value, 10);
  ssaoPass.output       = aoOutputModes[mode] ?? aoOutputModes[0];

  const contrast = parseFloat(aoCtEl.value);
  aoContrastUniform.value = contrast;
  // Boost the screen-space view of the raw mask only when SSAO-only or
  // Blur output mode is active — otherwise the Default mode would get
  // double-pow'd (blendMaterial already applies pow once).
  aoVisBoostUniform.value = (mode === 1 || mode === 2) ? contrast : 1.0;

  syncAOLabels();
}

[aoEnabledEl, aoKrEl, aoMnEl, aoMxEl, aoCtEl, aoOutSel].forEach(elx =>
  elx.addEventListener('input', applyAO)
);

aoResetBtn.addEventListener('click', () => {
  aoEnabledEl.checked = AO_DEFAULTS.enabled;
  aoKrEl.value        = AO_DEFAULTS.kernelRadius;
  aoMnEl.value        = AO_DEFAULTS.minDistance;
  aoMxEl.value        = AO_DEFAULTS.maxDistance;
  aoCtEl.value        = AO_DEFAULTS.contrast;
  aoOutSel.value      = String(AO_DEFAULTS.output);
  applyAO();
});

applyAO();

// ── Side-view drag handlers ──────────────────────────────────────────────
//
// Pointer Events for desktop & touch parity. Drag spine control points in
// (X, Z); drag station ticks along the spine arc length. Loft rebuilds live.

// Convert a pointer event to viewBox-local coordinates.
function svgToLocal(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// Map a target world X to a normalized arc-length parameter s along the
// spine. Assumes the spine is monotonic in X (true for kayak rocker — we
// enforce it during drag).
function spineXToS(sampled, targetX) {
  const { pts, arc, total } = sampled;
  if (targetX <= pts[0].x)              return 0;
  if (targetX >= pts[pts.length - 1].x) return 1;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].x <= targetX && targetX <= pts[i + 1].x) {
      const dx = pts[i + 1].x - pts[i].x;
      const t  = dx > 1e-9 ? (targetX - pts[i].x) / dx : 0;
      const a  = arc[i] + t * (arc[i + 1] - arc[i]);
      return Math.max(0, Math.min(1, a / total));
    }
  }
  return 1;
}

let drag = null;

// ── Top-view drag/click/delete ───────────────────────────────────────────

let topDrag = null;

// Delete the station at the unified-list index (works for interior, bow
// sheer, and stern sheer — never for tips, which are synthetic). Adjusts
// the selected-station index, rebuilds the hull, and re-renders all panes.
function deleteStation(unifiedIdx) {
  const sel = listAllStations(state)[unifiedIdx];
  if (!sel) return;
  if (state.stations.length <= 1) return;
  state.stations.splice(sel.stationIdx, 1);
  const newCount = listAllStations(state).length;
  if (state.selectedStation >= newCount) {
    state.selectedStation = Math.max(0, newCount - 1);
  }
  renderStationList();
  rebuildHull();
  renderSideView();
  renderTopView();
  renderSectionView();
}

function svgToLocalTop(e) {
  const pt = topSvg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const loc = pt.matrixTransform(topSvg.getScreenCTM().inverse());
  // Vertical orientation: SVG X = world Y * TOP_SCALE_Y, SVG Y = -world X * TOP_SCALE_X
  return { wx: -loc.y / TOP_SCALE_X, wy: loc.x / TOP_SCALE_Y };
}

topSvg.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const target = e.target.closest('[data-drag]');
  if (!target) return;
  e.preventDefault();
  topDrag = { kind: target.dataset.drag, id: target.dataset.idx, moved: false, pointerId: e.pointerId };
  if (topDrag.kind === 'station') selectStation(+topDrag.id);
  topSvg.setPointerCapture(e.pointerId);
});

topSvg.addEventListener('pointermove', (e) => {
  if (!topDrag) return;
  const { wx, wy } = svgToLocalTop(e);
  topDrag.moved = true;

  if (topDrag.kind === 'ref-top') {
    // wx = world Y (beam), wy = world X (longitudinal) — top view axes
    if (!topDrag.startWX) { topDrag.startWX = wx; topDrag.startWY = wy; topDrag.origX = state.topRef.worldX; topDrag.origY = state.topRef.worldY; }
    state.topRef.worldX = topDrag.origX + (wy - topDrag.startWY);
    state.topRef.worldY = topDrag.origY + (wx - topDrag.startWX);
    renderTopView();
    return;
  }

  const bl = state.beamLine;
  const sorted = [...bl.peaks].sort((a, b) => a.x - b.x);
  const peakIdx = (id) => bl.peaks.findIndex(p => p === sorted[+id]);

  if (topDrag.kind === 'beam-peak') {
    const pi = peakIdx(topDrag.id);
    if (pi >= 0) { bl.peaks[pi].x = wx; bl.peaks[pi].y = Math.max(0, wy); }
  } else if (topDrag.kind === 'beam-handle-out') {
    const sternKnot = state.spine.knots[0];
    const bowKnot   = state.spine.knots[state.spine.knots.length-1];
    if (topDrag.id === 'stern') {
      bl.sternHandle = { dx: wx - sternKnot.x, dy: wy };
    } else if (topDrag.id === 'bow') {
      bl.bowHandle = { dx: wx - bowKnot.x, dy: wy };
    } else {
      const pi = peakIdx(topDrag.id);
      if (pi >= 0) { bl.peaks[pi].hdx = wx - bl.peaks[pi].x; bl.peaks[pi].hdy = wy - bl.peaks[pi].y; }
    }
  } else if (topDrag.kind === 'beam-handle-in') {
    const sternKnot = state.spine.knots[0];
    const bowKnot   = state.spine.knots[state.spine.knots.length-1];
    if (topDrag.id === 'bow') {
      bl.bowHandle = { dx: wx - bowKnot.x, dy: wy };
    } else if (topDrag.id === 'stern') {
      bl.sternHandle = { dx: wx - sternKnot.x, dy: wy };
    } else {
      const pi = peakIdx(topDrag.id);
      if (pi >= 0) { bl.peaks[pi].hdx = -(wx - bl.peaks[pi].x); bl.peaks[pi].hdy = -(wy - bl.peaks[pi].y); }
    }
  } else if (topDrag.kind === 'station') {
    const sortedSt = [...state.stations].sort((a, b) => a.s - b.s);
    const idx = +topDrag.id;
    const st  = sortedSt[idx];
    if (!st) { rebuildHull(); renderTopView(); return; }
    const spSampled = sampledSpine(state.spine.knots, 32);
    const sRaw = spineXToS(spSampled, wx);
    const minS = idx === 0 ? 0.01 : sortedSt[idx-1].s + 0.01;
    const maxS = idx === sortedSt.length-1 ? 0.99 : sortedSt[idx+1].s - 0.01;
    st.s = Math.max(minS, Math.min(maxS, sRaw));
    renderStationList();
  }
  rebuildHull();
  renderSideView();
  renderTopView();
});

topSvg.addEventListener('pointerup',     () => { topDrag = null; });
topSvg.addEventListener('pointercancel', () => { topDrag = null; });

// ── Top-view zoom (wheel) and pan (middle-button or alt+left drag) ────────
let topPanDrag = null;
topSvg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const dz = e.deltaY < 0 ? 1.025 : 1 / 1.025;
  const pt = topSvg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const loc = pt.matrixTransform(topSvg.getScreenCTM().inverse());
  topVP.offX = loc.x - (loc.x - topVP.offX) / dz;
  topVP.offY = loc.y - (loc.y - topVP.offY) / dz;
  topVP.zoom = Math.max(0.1, Math.min(20, topVP.zoom * dz));
  renderTopView();
}, { passive: false });

// Pan: left-drag on background (no control target), or middle-button anywhere.
topSvg.addEventListener('pointerdown', (e) => {
  const isMiddle = e.button === 1;
  const isBackground = e.button === 0 && !e.target.closest('[data-drag]');
  if (!isMiddle && !isBackground) return;
  e.preventDefault();
  e.stopPropagation();
  topPanDrag = { startX: e.clientX, startY: e.clientY, startOffX: topVP.offX, startOffY: topVP.offY };
  topSvg.setPointerCapture(e.pointerId);
}, true);

topSvg.addEventListener('pointermove', (e) => {
  if (!topPanDrag) return;
  const bbox = topSvg.getBoundingClientRect();
  const vb   = topSvg.viewBox.baseVal;
  const scaleX = vb.width  / Math.max(1, bbox.width);
  const scaleY = vb.height / Math.max(1, bbox.height);
  topVP.offX = topPanDrag.startOffX - (e.clientX - topPanDrag.startX) * scaleX;
  topVP.offY = topPanDrag.startOffY - (e.clientY - topPanDrag.startY) * scaleY;
  renderTopView();
}, true);

topSvg.addEventListener('pointerup',     () => { topPanDrag = null; }, true);
topSvg.addEventListener('pointercancel', () => { topPanDrag = null; }, true);

document.getElementById('light-reset').addEventListener('click', () => {
  Object.assign(keyLightAngles, KEY_LIGHT_DEFAULTS);
  applyKeyLightPosition();
});

document.getElementById('top-reset').addEventListener('click', () => {
  topVP.zoom = 1; topVP.offX = 0; topVP.offY = 0;
  renderTopView();
});

// Click near beam curve to add peak.
topSvg.addEventListener('click', (e) => {
  if (e.target.closest('[data-drag]')) return;
  if (topDrag?.moved) return;
  const { wx, wy } = svgToLocalTop(e);
  const beamPts = sampledBeamLine(state);
  let best = Infinity;
  for (let i = 0; i < beamPts.length - 1; i++) {
    const a = beamPts[i], b = beamPts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx*dx + dy*dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((wx-a.x)*dx + (wy-a.y)*dy) / lenSq)) : 0;
    const d1 = Math.hypot(wx-(a.x+t*dx), wy-(a.y+t*dy));
    const d2 = Math.hypot(wx-(a.x+t*dx), wy+(a.y+t*dy));
    best = Math.min(best, d1, d2);
  }
  if (best <= 0.12) {
    // Click near the beam curve → insert a beam peak.
    const half = state.length / 2;
    const insertAt = state.beamLine.peaks.findIndex(p => p.x > wx);
    state.beamLine.peaks.splice(insertAt < 0 ? state.beamLine.peaks.length : insertAt, 0,
      { x: wx, y: Math.max(0.01, Math.abs(wy)), hdx: half * 0.2, hdy: 0 });
    rebuildHull();
    renderTopView();
    return;
  }

});

// Right-click handler: delete a beam peak OR a station, depending on the target.
topSvg.addEventListener('contextmenu', (e) => {
  const peak = e.target.closest('[data-drag="beam-peak"]');
  if (peak) {
    e.preventDefault();
    if (state.beamLine.peaks.length <= 1) return;
    const sorted = [...state.beamLine.peaks].sort((a, b) => a.x - b.x);
    const pk = sorted[+peak.dataset.idx];
    const pi = state.beamLine.peaks.indexOf(pk);
    if (pi >= 0) state.beamLine.peaks.splice(pi, 1);
    rebuildHull();
    renderTopView();
    return;
  }
  const stationT = e.target.closest('[data-drag="station"]');
  if (stationT) {
    e.preventDefault();
    deleteStation(+stationT.dataset.idx);
    return;
  }
});

// ── Side-view drag/click/delete ──────────────────────────────────────────

sideSvg.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const target = e.target.closest('[data-drag]');
  if (!target) return;
  e.preventDefault();
  const kind = target.dataset.drag;
  const idx  = +target.dataset.idx;
  const { x, y } = svgToLocal(sideSvg, e);
  drag = {
    kind, idx, moved: false, pointerId: e.pointerId,
    startWx: x / SIDE_SCALE_X,
    startWz: -y / SIDE_SCALE_Z,
  };
  if (kind === 'station') selectStation(idx);
  sideSvg.setPointerCapture(e.pointerId);
});

sideSvg.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = svgToLocal(sideSvg, e);
  const wx = x / SIDE_SCALE_X;
  const wz = -y / SIDE_SCALE_Z;
  drag.moved = true;

  if (drag.kind === 'ref-side') {
    if (!drag.startWX) { drag.startWX = wx; drag.startWZ = wz; drag.origX = state.sideRef.worldX; drag.origZ = state.sideRef.worldZ; }
    state.sideRef.worldX = drag.origX + (wx - drag.startWX);
    state.sideRef.worldZ = drag.origZ + (wz - drag.startWZ);
    renderSideView();
    return;
  }

  if (drag.kind === 'knot') {
    // Move on-curve knot; handles move with it.
    const k = state.spine.knots[drag.idx];
    if (!k) return;
    k.x = wx; k.z = wz;
    const knots = state.spine.knots;
    state.length = knots[knots.length-1].x - knots[0].x;
    lengthEl.value = state.length.toFixed(2);
    lengthOut.textContent = state.length.toFixed(2) + ' m';
    rebuildHull(); renderSideView(); renderTopView();
  } else if (drag.kind === 'knot-fore') {
    // Drag outgoing handle — updates angle and foreLen; aftLen stays.
    const k = state.spine.knots[drag.idx];
    if (!k) return;
    const dx = wx - k.x, dz = wz - k.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.005) { k.angle = Math.atan2(dz, dx); k.foreLen = len; }
    rebuildHull(); renderSideView(); renderTopView();
  } else if (drag.kind === 'knot-aft') {
    // Drag incoming handle — updates angle (shared C1) and aftLen; foreLen stays.
    const k = state.spine.knots[drag.idx];
    if (!k) return;
    const dx = wx - k.x, dz = wz - k.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.005) { k.angle = Math.atan2(-dz, -dx); k.aftLen = len; }
    rebuildHull(); renderSideView(); renderTopView();
  } else if (drag.kind === 'deck-knot') {
    const k = state.deckLine.knots[drag.idx];
    if (k) { k.x = wx; k.z = wz; }
    rebuildHull(); renderSideView();
  } else if (drag.kind === 'deck-fore') {
    const k = state.deckLine.knots[drag.idx];
    if (!k) return;
    const dx = wx - k.x, dz = wz - k.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.005) { k.angle = Math.atan2(dz, dx); k.foreLen = len; }
    rebuildHull(); renderSideView();
  } else if (drag.kind === 'deck-aft') {
    const k = state.deckLine.knots[drag.idx];
    if (!k) return;
    const dx = wx - k.x, dz = wz - k.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.005) { k.angle = Math.atan2(-dz, -dx); k.aftLen = len; }
    rebuildHull(); renderSideView();
  } else if (drag.kind === 'station') {
    // Slide station along rocker by matching X position to arc-length.
    const sortedSt = [...state.stations].sort((a, b) => a.s - b.s);
    const st = sortedSt[drag.idx];
    if (!st) return;
    const spSampled = sampledSpine(state.spine.knots, 32);
    const s = spineXToS(spSampled, wx);
    const lo = drag.idx === 0 ? 0.01 : sortedSt[drag.idx-1].s + 0.01;
    const hi = drag.idx === sortedSt.length-1 ? 0.99 : sortedSt[drag.idx+1].s - 0.01;
    st.s = Math.max(lo, Math.min(hi, s));
    renderStationList(); rebuildHull(); renderSideView(); renderTopView();
  }
});

function endDrag(e) {
  if (!drag) return;
  if (drag.pointerId != null && sideSvg.hasPointerCapture(drag.pointerId)) {
    sideSvg.releasePointerCapture(drag.pointerId);
  }
  drag = null;
}
sideSvg.addEventListener('pointerup',     endDrag);
sideSvg.addEventListener('pointercancel', endDrag);

// ── Side-view zoom (wheel) and pan (middle-button or alt+left drag) ───────
let sidePanDrag = null;
sideSvg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const dz = e.deltaY < 0 ? 1.025 : 1 / 1.025;
  const { x: mx, y: my } = svgToLocal(sideSvg, e);
  sideVP.minX = mx - (mx - sideVP.minX) / dz;
  sideVP.minY = my - (my - sideVP.minY) / dz;
  sideVP.W   /= dz;
  sideVP.H   /= dz;
  renderSideView();
}, { passive: false });

// Pan: left-drag on background (no control target), or middle-button anywhere.
sideSvg.addEventListener('pointerdown', (e) => {
  const isMiddle = e.button === 1;
  const isBackground = e.button === 0 && !e.target.closest('[data-drag]');
  if (!isMiddle && !isBackground) return;
  e.preventDefault();
  e.stopPropagation();
  sidePanDrag = {
    screenX: e.clientX, screenY: e.clientY,
    vpMinX: sideVP.minX, vpMinY: sideVP.minY,
  };
  sideSvg.setPointerCapture(e.pointerId);
}, true);

sideSvg.addEventListener('pointermove', (e) => {
  if (!sidePanDrag) return;
  // Convert pixel delta to SVG units using current viewport scale.
  const bbox   = sideSvg.getBoundingClientRect();
  const scaleX = sideVP.W / Math.max(1, bbox.width);
  const scaleY = sideVP.H / Math.max(1, bbox.height);
  sideVP.minX  = sidePanDrag.vpMinX - (e.clientX - sidePanDrag.screenX) * scaleX;
  sideVP.minY  = sidePanDrag.vpMinY - (e.clientY - sidePanDrag.screenY) * scaleY;
  renderSideView();
}, true);

sideSvg.addEventListener('pointerup',     () => { sidePanDrag = null; }, true);
sideSvg.addEventListener('pointercancel', () => { sidePanDrag = null; }, true);

document.getElementById('side-reset').addEventListener('click', () => {
  Object.assign(sideVP, SIDE_VP_DEFAULT);
  renderSideView();
});

// ── State export / import ─────────────────────────────────────────────────

// ── Reference image controls ──────────────────────────────────────────────

function wireRefImage(viewKey, fileId, opacityId, opacityOutId, wId, hId, xId, yId, clearId, renderFn) {
  const refState = () => state[viewKey];
  const fmtPct = v => Math.round(v * 100) + '%';

  document.getElementById(fileId).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      refState().url = ev.target.result;
      renderFn();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  const opEl = document.getElementById(opacityId);
  const opOut = document.getElementById(opacityOutId);
  opEl.addEventListener('input', () => {
    refState().opacity = parseFloat(opEl.value);
    opOut.textContent = fmtPct(refState().opacity);
    renderFn();
  });
  opOut.textContent = fmtPct(refState().opacity);

  document.getElementById(wId).addEventListener('input', (e) => { refState().worldW = parseFloat(e.target.value) || 0.1; renderFn(); });
  document.getElementById(hId).addEventListener('input', (e) => { refState().worldH = parseFloat(e.target.value) || 0.1; renderFn(); });
  document.getElementById(xId).addEventListener('input', (e) => { refState().worldX = parseFloat(e.target.value) || 0;   renderFn(); });
  document.getElementById(yId).addEventListener('input', (e) => {
    const k = viewKey === 'sideRef' ? 'worldZ' : 'worldY';
    refState()[k] = parseFloat(e.target.value) || 0;
    renderFn();
  });

  document.getElementById(clearId).addEventListener('click', () => {
    refState().url = null;
    renderFn();
  });
}

wireRefImage('sideRef',
  'side-ref-file', 'side-ref-opacity', 'side-ref-opacity-out',
  'side-ref-w', 'side-ref-h', 'side-ref-x', 'side-ref-z',
  'side-ref-clear', renderSideView);

wireRefImage('topRef',
  'top-ref-file', 'top-ref-opacity', 'top-ref-opacity-out',
  'top-ref-w', 'top-ref-h', 'top-ref-x', 'top-ref-y',
  'top-ref-clear', renderTopView);

document.getElementById('export-state').addEventListener('click', () => {
  // Serialise the full state object (all hull geometry + UI settings).
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'loft-state.json'; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-state').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      // Shallow-merge top-level keys so we keep any new keys not in the file.
      Object.assign(state, parsed);
      const n = listAllStations(state).length;
      if (state.selectedStation >= n) state.selectedStation = Math.max(0, n - 1);
      // Sync UI controls that mirror state.
      loftResEl.value  = state.loftRes;
      xSubdivEl.value  = String(state.xSubdiv);
      lengthEl.value   = state.length.toFixed(2);
      lengthOut.textContent = state.length.toFixed(2) + ' m';
      rebuildHull();
      renderStationList();
      renderSideView();
      renderTopView();
      renderSectionView();
    } catch (err) {
      alert('Could not parse JSON: ' + err.message);
    }
    // Reset the file input so re-importing the same file works.
    e.target.value = '';
  };
  reader.readAsText(file);
});

// Click near rocker → insert on-curve knot; click near deck curve → insert handle.
sideSvg.addEventListener('click', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('[data-drag]')) return;
  if (drag && drag.moved) return;
  const { x, y } = svgToLocal(sideSvg, e);
  const wx = x / SIDE_SCALE_X, wz = -y / SIDE_SCALE_Z;

  // Check rocker proximity first.
  const knots = state.spine.knots;
  let rDist = Infinity, rSeg = -1, rT = 0;
  for (let i = 0; i < knots.length - 1; i++) {
    const k0 = knots[i], k1 = knots[i+1];
    const P1 = knotHandles(k0).fore, P2 = knotHandles(k1).aft;
    for (let j = 0; j < 32; j++) {
      const t0 = j/32;
      const p0 = cubicBezierPt(k0, P1, P2, k1, t0);
      const p1 = cubicBezierPt(k0, P1, P2, k1, (j+1)/32);
      const dx = p1.x-p0.x, dz = p1.y-p0.y;
      const ll = dx*dx+dz*dz;
      const tt = ll>0 ? Math.max(0,Math.min(1,((wx-p0.x)*dx+(wz-p0.y)*dz)/ll)) : 0;
      const d = Math.hypot(wx-(p0.x+tt*dx), wz-(p0.y+tt*dz));
      if (d < rDist) { rDist = d; rSeg = i; rT = t0 + tt/32; }
    }
  }

  // Check deck line proximity (same segment-scan as rocker).
  const dkKnots = state.deckLine.knots;
  let dDist = Infinity, dSeg = -1, dT = 0;
  for (let i = 0; i < dkKnots.length - 1; i++) {
    const k0 = dkKnots[i], k1 = dkKnots[i+1];
    const P1 = knotHandles(k0).fore, P2 = knotHandles(k1).aft;
    for (let j = 0; j < 32; j++) {
      const t0 = j/32;
      const p0 = cubicBezierPt(k0, P1, P2, k1, t0);
      const p1 = cubicBezierPt(k0, P1, P2, k1, (j+1)/32);
      const dx = p1.x-p0.x, dz = p1.y-p0.y;
      const ll = dx*dx+dz*dz;
      const tt = ll>0 ? Math.max(0,Math.min(1,((wx-p0.x)*dx+(wz-p0.y)*dz)/ll)) : 0;
      const d = Math.hypot(wx-(p0.x+tt*dx), wz-(p0.y+tt*dz));
      if (d < dDist) { dDist = d; dSeg = i; dT = t0 + tt/32; }
    }
  }

  const THRESH = 0.12;
  if (rDist <= THRESH && rDist <= dDist) {
    insertKnot(state.spine.knots, rSeg, rT);
    rebuildHull(); renderSideView(); renderTopView();
  } else if (dDist <= THRESH && dDist < rDist) {
    insertKnot(state.deckLine.knots, dSeg, dT);
    rebuildHull(); renderSideView();
  }
});

// Right-click: delete interior knot on rocker or deck line (endpoints protected).
sideSvg.addEventListener('contextmenu', (e) => {
  const t = e.target.closest('[data-drag]');
  if (!t) return;
  const idx = +t.dataset.idx;
  if (t.dataset.drag === 'knot') {
    const knots = state.spine.knots;
    if (idx === 0 || idx === knots.length - 1) return;
    e.preventDefault();
    knots.splice(idx, 1);
    rebuildHull(); renderSideView(); renderTopView();
  } else if (t.dataset.drag === 'deck-knot') {
    const knots = state.deckLine.knots;
    if (idx === 0 || idx === knots.length - 1) return;
    e.preventDefault();
    knots.splice(idx, 1);
    rebuildHull(); renderSideView();
  }
});

// ── Cross-section drag / add / delete handlers ───────────────────────────
//
// Drag any non-keel control point in (b, n). Clicking empty space inserts a
// new control point in the segment closest to the click. Right-click a
// point to delete (the keel — index 0 — and final two-point sections are
// protected). The keel is locked at (0, 0) by definition of the model.

let sectionDrag = null;

sectionSvg.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return; // ignore right/middle clicks (contextmenu handles delete)
  const target = e.target.closest('[data-drag]');
  if (!target) return;
  e.preventDefault();
  sectionDrag = { idx: +target.dataset.idx, pointerId: e.pointerId, moved: false };
  sectionSvg.setPointerCapture(e.pointerId);
});

sectionSvg.addEventListener('pointermove', (e) => {
  if (!sectionDrag) return;
  const sel = selectedStationObj();
  if (!sel) return;
  const station = sel.ref;
  const i       = sectionDrag.idx;
  const lastIdx = station.points.length - 1;
  if (i === 0 || i === lastIdx) return; // keel and deck-end both locked
  const isCenterline = i === lastIdx;   // (never true now, kept for safety)
  const { x, y } = svgToLocal(sectionSvg, e);
  const n = -y / SECTION_SCALE_N;
  if (isCenterline) {
    station.points[i].b = 0;
    station.points[i].n = n;
  } else {
    station.points[i].b = Math.max(0, x / SECTION_SCALE_B);
    station.points[i].n = n;
  }
  sectionDrag.moved = true;
  renderSectionView();
  rebuildHull();
  renderSideView();

  renderTopView();
});

function endSectionDrag() {
  if (!sectionDrag) return;
  if (sectionDrag.pointerId != null && sectionSvg.hasPointerCapture(sectionDrag.pointerId)) {
    sectionSvg.releasePointerCapture(sectionDrag.pointerId);
  }
  sectionDrag = null;
}
sectionSvg.addEventListener('pointerup',     endSectionDrag);
sectionSvg.addEventListener('pointercancel', endSectionDrag);

// Click empty space to add a new control point. Disabled for endpoint
// (stem) stations — those are 2 points by spec. Disabled for clicks on
// the port mirror (it's read-only).
sectionSvg.addEventListener('click', (e) => {
  if (e.target.closest('[data-drag]')) return;
  if (sectionDrag && sectionDrag.moved) return;
  const sel = selectedStationObj();
  if (!sel) return;
  const station = sel.ref;
  const { x, y } = svgToLocal(sectionSvg, e);
  const b = x / SECTION_SCALE_B;
  const n = -y / SECTION_SCALE_N;
  if (b < 0) return;
  const insertIdx = nearestSegmentInsertIdx(station.points, b, n);
  station.points.splice(insertIdx, 0, { b, n, chine: false });
  renderStationList();
  renderSectionView();
  rebuildHull();
  renderSideView();

  renderTopView();
});

// Right-click a control point to delete it. Keel (idx 0) and deck-end
// (last idx) are protected on every station; bow / stern stems are
// fully protected. Sections must keep at least 3 points so the natural
// cubic spline still resolves.
sectionSvg.addEventListener('contextmenu', (e) => {
  const target = e.target.closest('[data-drag]');
  if (!target) return;
  e.preventDefault();
  const i = +target.dataset.idx;
  const sel = selectedStationObj();
  if (!sel) return;
  const station = sel.ref;
  if (i === 0 || i === station.points.length - 1) return;
  if (station.points.length <= 3) return;
  station.points.splice(i, 1);
  renderStationList();
  renderSectionView();
  rebuildHull();
  renderSideView();

  renderTopView();
});

// Find the index at which a new (b, n) should be inserted into a section's
// control-point list to land in the segment closest to the click. Returns
// the insertion index (so splice(idx, 0, newPt) puts it between the chosen
// segment's two existing endpoints).
function nearestSegmentInsertIdx(points, clickB, clickN) {
  let bestI = 0, bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], c = points[i + 1];
    const dx = c.b - a.b, dy = c.n - a.n;
    const lenSq = dx * dx + dy * dy;
    let t = ((clickB - a.b) * dx + (clickN - a.n) * dy) / (lenSq || 1);
    t = Math.max(0, Math.min(1, t));
    const px = a.b + t * dx, py = a.n + t * dy;
    const dist = Math.hypot(clickB - px, clickN - py);
    if (dist < bestDist) {
      bestDist = dist;
      bestI = i;
    }
  }
  return bestI + 1;
}

// ── Initial render ───────────────────────────────────────────────────────

lengthOut.textContent = state.length.toFixed(2) + ' m';
stationLabel.textContent = stationLabelFor(state.selectedStation);
renderStationList();
renderSideView();
renderTopView();
renderSectionView();

window.addEventListener('resize', () => { renderTopView(); renderSideView(); });
