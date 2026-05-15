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
  xSubdiv: 16,
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
  // Persisted UI / render state — every UI control writes here so export
  // captures the full session and import restores it. Defaults here drive the
  // initial UI on a fresh load.
  colors: { outside: '#ffffff', inside: '#ffc0cb' },
  ao:     { enabled: true, kernelRadius: 0.35, minDistance: 0.0001, maxDistance: 0.6, contrast: 12.0, output: 0 },
  keyLight: { az: 0.69, el: 0.89 },
  viewports: {
    side:    { zoom: 1, offX: 0, offY: 0 },
    top:     { zoom: 1, offX: 0, offY: 0 },
    section: { zoom: 1, offX: 0, offY: 0 },
  },
  layout: { colPct: 50, rowPct: 55, drawerHidden: false },
};

// Deep-merge `src` into `dst` in place. Objects are recursed (preserving
// reference identity on `dst`); arrays and primitives are replaced wholesale.
// Used by the JSON import so local aliases like sideVP === state.viewports.side
// continue to point at the same nested object after re-loading.
function deepAssign(dst, src) {
  if (!src || typeof src !== 'object') return;
  for (const k of Object.keys(src)) {
    const sv = src[k];
    const dv = dst[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && dv && typeof dv === 'object' && !Array.isArray(dv)) {
      deepAssign(dv, sv);
    } else {
      dst[k] = sv;
    }
  }
}

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

// Fill in (angle, aftLen, foreLen) for any section knot that lacks them, so
// older saved sections still load. Endpoint angles are fixed: keel heads
// outward (+b) so angle=0; deck-tip heads back to the centerline so angle=π.
// Interior knot angles are derived from neighbour chord direction; handle
// lengths default to one-third of the adjacent segment length.
function deriveSectionHandles(points) {
  const np = points.length;
  for (let i = 0; i < np; i++) {
    const p = points[i];
    if (p.angle != null && p.aftLen != null && p.foreLen != null) continue;
    const prev = points[i - 1] || points[0];
    const next = points[i + 1] || points[np - 1];
    let angle;
    if      (i === 0)        angle = 0;
    else if (i === np - 1)   angle = Math.PI;
    else                     angle = Math.atan2(next.n - prev.n, next.b - prev.b);
    const segPrev = Math.hypot(p.b - prev.b, p.n - prev.n);
    const segNext = Math.hypot(next.b - p.b, next.n - p.n);
    p.angle   = angle;
    p.aftLen  = (i === 0)        ? 0 : segPrev / 3;
    p.foreLen = (i === np - 1)   ? 0 : segNext / 3;
  }
}

// Handle endpoints for a section knot in (b, n) space. Mirrors knotHandles()
// for the rocker — same on-curve-knot + tangent-angle + aft/fore-length model.
function sectionKnotHandles(k) {
  const ca = Math.cos(k.angle), sa = Math.sin(k.angle);
  return {
    aft:  { b: k.b - ca * k.aftLen,  n: k.n - sa * k.aftLen  },
    fore: { b: k.b + ca * k.foreLen, n: k.n + sa * k.foreLen },
  };
}

// Sample a starboard-only cross-section to N transverse points by arc-length
// equal spacing. Curve is a piecewise cubic Bezier through on-curve knots
// with C1-continuous tangent handles (angle/aftLen/foreLen) — same model as
// the rocker and deck-line, so authoring feels consistent across all views.
function sampleSection(section, N) {
  const pts = section;
  const np  = pts.length;
  if (np < 2) return Array.from({length: N}, () => ({b: 0, n: 0}));

  // Defensive: ensure handles exist (older JSON / fresh-inserted knots).
  deriveSectionHandles(pts);

  // Build a dense polyline from piecewise cubic Beziers.
  const dense = [];
  for (let i = 0; i < np - 1; i++) {
    const k0 = pts[i], k1 = pts[i + 1];
    const h0 = sectionKnotHandles(k0);
    const h1 = sectionKnotHandles(k1);
    const c1 = h0.fore;
    const c2 = h1.aft;
    const steps = 24;
    for (let s = 0; s < steps; s++) {
      const t = s / steps, u = 1 - t;
      dense.push({
        b: u*u*u*k0.b + 3*u*u*t*c1.b + 3*u*t*t*c2.b + t*t*t*k1.b,
        n: u*u*u*k0.n + 3*u*u*t*c1.n + 3*u*t*t*c2.n + t*t*t*k1.n,
      });
    }
  }
  dense.push({ b: pts[np-1].b, n: pts[np-1].n });

  // Arc-length resample to N points.
  const arc = [0];
  for (let i = 1; i < dense.length; i++) {
    const db = dense[i].b - dense[i-1].b, dn = dense[i].n - dense[i-1].n;
    arc.push(arc[i-1] + Math.hypot(db, dn));
  }
  const total = arc[arc.length-1] || 1;
  const out = new Array(N);
  for (let k = 0; k < N; k++) {
    const target = (k / (N-1)) * total;
    let lo = 0, hi = arc.length - 1;
    while (hi - lo > 1) { const m = (lo+hi)>>1; if (arc[m] <= target) lo = m; else hi = m; }
    const t = arc[hi] === arc[lo] ? 0 : (target - arc[lo]) / (arc[hi] - arc[lo]);
    out[k] = { b: dense[lo].b + t * (dense[hi].b - dense[lo].b),
               n: dense[lo].n + t * (dense[hi].n - dense[lo].n) };
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
    // ── Tip end caps ────────────────────────────────────────────────────
    // When deck.z ≠ keel.z at the tip, the hull doesn't converge to a single
    // point — there's a vertical edge between starboard and port tip columns.
    // Close each tip with a strip of triangles from k=0 to k=N-1.
    const tipFace = (rowI, outwardForward) => {
      for (let k = 0; k < N - 1; k++) {
        const sA = rowI * N + k,   sB = rowI * N + k + 1;
        const pA = stbdVertCount + rowI * N + k,
              pB = stbdVertCount + rowI * N + k + 1;
        if (outwardForward) {
          // Bow tip: outward normal is +x. CCW when viewed from +x.
          indices.push(sA, pA, pB);
          indices.push(sA, pB, sB);
        } else {
          // Stern tip: outward normal is -x. CCW when viewed from -x.
          indices.push(pA, sA, sB);
          indices.push(pA, sB, pB);
        }
      }
    };
    tipFace(0, false);             // stern
    tipFace(Mdense - 1, true);     // bow
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
// Alias into state so light orbit changes are persisted via JSON export.
const keyLightAngles = state.keyLight;
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

// SVG namespace — declared early because the 3D gizmo overlay (below) and
// the el() helper (further down) both use it. Must precede any synchronous
// call to updateThreeGizmo() (animate() invokes it on its first synchronous
// pass).
const SVG_NS = 'http://www.w3.org/2000/svg';

// ── 3D scale gizmo overlay ────────────────────────────────────────────────
//
// A small SVG pinned to the bottom-left of the 3D pane. Axes are projected
// from the Three.js camera's current orientation so the gizmo rotates with
// the view. Cube handles are large rotated squares.
//
// THREE.js coordinate mapping (see buildLoft): THREE_X=our X, THREE_Y=our Z
// (up), THREE_Z=our Y (beam/starboard). So world axis unit vectors in THREE
// space are: X→(1,0,0), Z-up→(0,1,0), Y-beam→(0,0,1).

const THREE_GIZMO_AXES = [
  { axis: 'X', threeDir: new THREE.Vector3(1, 0, 0), color: '#2563eb' },
  { axis: 'Z', threeDir: new THREE.Vector3(0, 1, 0), color: '#16a34a' },
  { axis: 'Y', threeDir: new THREE.Vector3(0, 0, 1), color: '#0891b2' },
];

const threeGizmoSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
threeGizmoSvg.setAttribute('viewBox', '0 0 110 110');
Object.assign(threeGizmoSvg.style, {
  position: 'absolute', bottom: '32px', left: '12px',
  width: '110px', height: '110px',
  overflow: 'visible', pointerEvents: 'none',
});
threeHost.appendChild(threeGizmoSvg);

function updateThreeGizmo() {
  threeGizmoSvg.innerHTML = '';
  const CX = 55, CY = 55, ARM = 42, HS = 7; // SVG pixels

  // Project each world axis direction through the camera's view matrix.
  const projected = THREE_GIZMO_AXES.map(a => {
    const camDir = a.threeDir.clone().transformDirection(camera.matrixWorldInverse);
    // camDir.x → screen right (+), camDir.y → screen up (+)
    return { ...a, sx: camDir.x, sy: -camDir.y, depth: camDir.z };
  });

  // Paint back-to-front (largest depth first = behind camera = draw first).
  projected.sort((a, b) => b.depth - a.depth);

  for (const d of projected) {
    const ex = CX + d.sx * ARM;
    const ey = CY + d.sy * ARM;

    // Axis line
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', CX); line.setAttribute('y1', CY);
    line.setAttribute('x2', ex.toFixed(1)); line.setAttribute('y2', ey.toFixed(1));
    line.setAttribute('stroke', d.color); line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.style.pointerEvents = 'none';
    threeGizmoSvg.appendChild(line);

    // Hit area (larger, interactive)
    const hit = document.createElementNS(SVG_NS, 'rect');
    hit.setAttribute('x', ex - HS * 2); hit.setAttribute('y', ey - HS * 2);
    hit.setAttribute('width', HS * 4);  hit.setAttribute('height', HS * 4);
    hit.setAttribute('fill', 'transparent');
    hit.dataset.scaleAxis = d.axis;
    hit.dataset.scaleDirX = d.sx.toFixed(4);
    hit.dataset.scaleDirY = d.sy.toFixed(4);
    hit.style.cursor = 'crosshair';
    hit.style.pointerEvents = 'all';
    threeGizmoSvg.appendChild(hit);

    // Cube handle: rotated square (diamond)
    const deg = Math.atan2(d.sy, d.sx) * 180 / Math.PI + 45;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', ex - HS); rect.setAttribute('y', ey - HS);
    rect.setAttribute('width', HS * 2); rect.setAttribute('height', HS * 2);
    rect.setAttribute('fill', d.color);
    rect.setAttribute('transform', `rotate(${deg.toFixed(1)},${ex.toFixed(1)},${ey.toFixed(1)})`);
    rect.style.pointerEvents = 'none';
    threeGizmoSvg.appendChild(rect);

    // Axis label
    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x', (ex + d.sx * (HS + 5)).toFixed(1));
    txt.setAttribute('y', (ey + d.sy * (HS + 5) + 1).toFixed(1));
    txt.setAttribute('fill', d.color); txt.setAttribute('font-size', '10');
    txt.setAttribute('text-anchor', d.sx > 0.1 ? 'start' : d.sx < -0.1 ? 'end' : 'middle');
    txt.setAttribute('dominant-baseline', 'middle');
    txt.style.pointerEvents = 'none';
    txt.style.fontFamily = 'system-ui, sans-serif';
    txt.textContent = d.axis;
    threeGizmoSvg.appendChild(txt);
  }

  // Centre dot
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', CX); dot.setAttribute('cy', CY); dot.setAttribute('r', '3');
  dot.setAttribute('fill', '#fff'); dot.setAttribute('stroke', '#666');
  dot.setAttribute('stroke-width', '1');
  dot.style.pointerEvents = 'none';
  threeGizmoSvg.appendChild(dot);
}

// Wire scale drag for the 3D gizmo SVG.
attachScaleGizmoPointer(threeGizmoSvg);

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
  if (typeof updateThreeGizmo === 'function') updateThreeGizmo();
}
animate();

// ── SVG side view ────────────────────────────────────────────────────────

// SVG_NS declared above (before 3D gizmo overlay).
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

// Side / top view zoom-pan state lives inside `state` so JSON export
// captures the current view. The locals are aliases — same object reference.
// sideFit is computed once (or when reset/resize); subsequent edits don't
// shift the viewBox so anchored elements (ref image) don't drift on screen.
let SIDE_SCALE = 100; // px/m for both X and Z
let sideFit = null;   // { scale, baseCX, baseCY, paneW, paneH }
const sideVP = state.viewports.side;

// Top view: an extra zoom + pan offset applied on top of the isotropic auto-fit.
const topVP = state.viewports.top;
let topFit = null; // { scale, baseCX, baseCY, paneW, paneH }

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
  const xOfT = (wy) =>  wy * TOP_SCALE_Y;
  const yOfT = (wx) => -wx * TOP_SCALE_X;
  const p2s  = (wx, wy) => `${xOfT(wy).toFixed(2)},${yOfT(wx).toFixed(2)}`;
  const pD   = (pts) => 'M ' + pts.map(p => `${xOfT(p.y).toFixed(2)} ${yOfT(p.x).toFixed(2)}`).join(' L ');

  const beamPts = sampledBeamLine(state);

  // ── Uniform px/m scale: real aspect ratio, letterboxed ──────────────
  // Both axes share one scale so 1 m along X (longitudinal, screen Y) and
  // 1 m along Y (transverse, screen X) render at the same pixel size.
  {
    const bbox  = topSvg.getBoundingClientRect();
    const paneH = Math.max(bbox.height > 10 ? bbox.height : topSvg.parentElement.clientHeight - 44, 100);
    const paneW = Math.max(bbox.width  > 10 ? bbox.width  : topSvg.clientWidth, 60);
    const stale = !topFit || topFit.paneW !== paneW || topFit.paneH !== paneH;
    if (stale) {
      const knots = state.spine.knots;
      const stX = knots[0].x, bwX = knots[knots.length-1].x;
      const maxB = Math.max(...beamPts.map(p => p.y), 0.05);
      const padX = 0.25, padY = 0.06;
      const Lx = (bwX - stX) + 2 * padX;
      const Ly = (maxB + padY) * 2;
      const s  = Math.min(paneW / Ly, paneH / Lx);
      const cxX = (stX + bwX) / 2;
      topFit = { scale: s, baseCX: 0, baseCY: -cxX * s, paneW, paneH };
    }
    TOP_SCALE_X = topFit.scale;
    TOP_SCALE_Y = topFit.scale;
    const fitCX = topFit.baseCX + topVP.offX;
    const fitCY = topFit.baseCY + topVP.offY;
    const zW = paneW / topVP.zoom;
    const zH = paneH / topVP.zoom;
    topSvg.setAttribute('viewBox',
      `${(fitCX - zW / 2).toFixed(1)} ${(fitCY - zH / 2).toFixed(1)} ${zW.toFixed(1)} ${zH.toFixed(1)}`);
  }

  // Reference image (behind everything else; uses freshly-computed TOP_SCALE).
  if (state.topRef?.url) {
    const r = state.topRef;
    const imgEl = document.createElementNS(SVG_NS, 'image');
    imgEl.setAttribute('href', r.url);
    imgEl.setAttribute('x',      (r.worldY * TOP_SCALE_Y).toFixed(1));
    imgEl.setAttribute('y',      (-(r.worldX + r.worldW) * TOP_SCALE_X).toFixed(1));
    imgEl.setAttribute('width',  (r.worldH * TOP_SCALE_Y).toFixed(1));
    imgEl.setAttribute('height', (r.worldW * TOP_SCALE_X).toFixed(1));
    imgEl.setAttribute('opacity', r.opacity);
    imgEl.setAttribute('data-drag', 'ref-top');
    topSvg.appendChild(imgEl);
    for (let xi = 0; xi <= 1; xi++) for (let zi = 0; zi <= 1; zi++) {
      const cx = xOfT(xi === 0 ? r.worldY : r.worldY + r.worldH);
      const cy = yOfT(zi === 0 ? r.worldX + r.worldW : r.worldX);
      topSvg.appendChild(el('circle', {
        cx, cy, r: 6/tf, class: 'ref-corner',
        'data-drag': 'ref-top-corner', 'data-xi': String(xi), 'data-zi': String(zi),
      }));
    }
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

  // Scale gizmo — Y (beam) and X (length) axes at hull centre.
  {
    appendScaleGizmo2D(topSvg, xOfT(0), yOfT(0), tf, [
      { axis: 'Y', svgDirX:  1, svgDirY:  0, screenDirX:  1, screenDirY:  0, color: '#0891b2' },
      { axis: 'X', svgDirX:  0, svgDirY: -1, screenDirX:  0, screenDirY: -1, color: '#2563eb' },
    ]);
  }
}

// ── Scale gizmo helper (2D SVG views) ────────────────────────────────────
//
// GIZMO_ARM: screen pixels of each axis arm. Defined here so appendScaleGizmo2D
// can use it directly; the drag system below re-references it as well.
const GIZMO_ARM = 60;
//
// Draws two or three scale axes at (gcx, gcy) in SVG coordinates.
// Each axis has a square handle at the positive tip; dragging along the
// axis direction scales the hull along that world axis.
//
// axes: [{ axis:'X'|'Y'|'Z', svgDirX, svgDirY, screenDirX, screenDirY, color }]
//   svgDir*     – unit vector in SVG user-space pointing toward the positive tip
//   screenDir*  – unit vector in screen pixels pointing the same way
//   (for all unrotated SVG views these are the same, but stored separately
//    in case a view is ever rotated later)
//
function appendScaleGizmo2D(svg, gcx, gcy, sf, axes) {
  const arm = GIZMO_ARM / sf;   // arm length in SVG user-space units
  const hs  = 5 / sf;           // half-size of square handle
  const sw  = 1.5 / sf;         // line stroke-width
  const fs  = 8 / sf;           // label font-size

  const g = el('g', { class: 'scale-gizmo' });

  for (const ax of axes) {
    const ex = gcx + ax.svgDirX * arm;
    const ey = gcy + ax.svgDirY * arm;

    // Axis line (non-interactive)
    g.appendChild(el('line', {
      x1: gcx, y1: gcy, x2: ex, y2: ey,
      stroke: ax.color, 'stroke-width': sw, 'stroke-linecap': 'round',
      style: 'pointer-events:none',
    }));

    // Large transparent hit area
    g.appendChild(el('rect', {
      x: ex - 3 * hs, y: ey - 3 * hs,
      width: 6 * hs, height: 6 * hs,
      fill: 'transparent',
      'data-scale-axis': ax.axis,
      'data-scale-dir-x': ax.screenDirX.toFixed(4),
      'data-scale-dir-y': ax.screenDirY.toFixed(4),
      style: 'cursor:ew-resize; pointer-events:all',
    }));

    // Visible square handle (rotated 45° → diamond)
    const deg = Math.atan2(ax.svgDirY, ax.svgDirX) * 180 / Math.PI + 45;
    g.appendChild(el('rect', {
      x: ex - hs, y: ey - hs, width: 2 * hs, height: 2 * hs,
      fill: ax.color,
      transform: `rotate(${deg.toFixed(1)},${ex},${ey})`,
      style: 'pointer-events:none',
    }));

    // Axis label
    const lx = ex + ax.svgDirX * (hs * 2 + 2 / sf);
    const ly = ey + ax.svgDirY * (hs * 2 + 2 / sf);
    g.appendChild(el('text', {
      x: lx, y: ly, fill: ax.color,
      'font-size': fs,
      'text-anchor': ax.svgDirX > 0.1 ? 'start' : ax.svgDirX < -0.1 ? 'end' : 'middle',
      'dominant-baseline': 'middle',
      style: 'pointer-events:none; user-select:none; font-family:system-ui,sans-serif',
    }, ax.axis));
  }

  // Centre dot
  g.appendChild(el('circle', {
    cx: gcx, cy: gcy, r: 3 / sf,
    fill: '#fff', stroke: '#888', 'stroke-width': 0.8 / sf,
    style: 'pointer-events:none',
  }));

  svg.appendChild(g);
}

// ── Side view ─────────────────────────────────────────────────────────────

function renderSideView() {
  sideSvg.innerHTML = '';

  // ── Auto-fit (cached): recompute only on first render, reset, or resize ──
  {
    const bbox  = sideSvg.getBoundingClientRect();
    const paneW = Math.max(bbox.width  > 10 ? bbox.width  : sideSvg.parentElement.clientWidth,  60);
    const paneH = Math.max(bbox.height > 10 ? bbox.height : sideSvg.parentElement.clientHeight, 40);
    const stale = !sideFit || sideFit.paneW !== paneW || sideFit.paneH !== paneH;
    if (stale) {
      const spS = sampledSpine(state.spine.knots,   64);
      const dkS = sampledSpine(state.deckLine.knots, 64);
      let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
      [...spS.pts, ...dkS.pts].forEach(p => {
        if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
        if (p.y < zMin) zMin = p.y; if (p.y > zMax) zMax = p.y;
      });
      const pad = 0.3;
      xMin -= pad; xMax += pad; zMin -= pad; zMax += pad;
      const scale  = Math.min(paneW / (xMax - xMin), paneH / (zMax - zMin));
      const baseCX =  (xMin + xMax) / 2 * scale;
      const baseCY = -(zMin + zMax) / 2 * scale;
      sideFit = { scale, baseCX, baseCY, paneW, paneH };
    }
    SIDE_SCALE = sideFit.scale;
    const fitCX = sideFit.baseCX + sideVP.offX;
    const fitCY = sideFit.baseCY + sideVP.offY;
    const zW = paneW / sideVP.zoom;
    const zH = paneH / sideVP.zoom;
    sideSvg.setAttribute('viewBox',
      `${(fitCX - zW/2).toFixed(1)} ${(fitCY - zH/2).toFixed(1)} ${zW.toFixed(1)} ${zH.toFixed(1)}`);
  }

  // Scale factor for constant-pixel control point sizes.
  const sf = sideVP.zoom;
  const xOf = (x) => x * SIDE_SCALE;
  const yOf = (z) => -z * SIDE_SCALE;
  // Reference image (behind everything else).
  if (state.sideRef?.url) {
    const r = state.sideRef;
    const imgEl = document.createElementNS(SVG_NS, 'image');
    imgEl.setAttribute('href', r.url);
    imgEl.setAttribute('x',      (r.worldX * SIDE_SCALE).toFixed(1));
    imgEl.setAttribute('y',      (-r.worldZ * SIDE_SCALE).toFixed(1));
    imgEl.setAttribute('width',  (r.worldW * SIDE_SCALE).toFixed(1));
    imgEl.setAttribute('height', (r.worldH * SIDE_SCALE).toFixed(1));
    imgEl.setAttribute('opacity', r.opacity);
    imgEl.setAttribute('data-drag', 'ref-side');
    sideSvg.appendChild(imgEl);
    // Corner handles for scaling (aspect-ratio constrained).
    // xi: 0=left, 1=right;  zi: 0=top (higher Z), 1=bottom (lower Z)
    for (let xi = 0; xi <= 1; xi++) for (let zi = 0; zi <= 1; zi++) {
      const cx = xOf(xi === 0 ? r.worldX : r.worldX + r.worldW);
      const cy = yOf(zi === 0 ? r.worldZ : r.worldZ - r.worldH);
      sideSvg.appendChild(el('circle', {
        cx, cy, r: 6/sf, class: 'ref-corner',
        'data-drag': 'ref-side-corner', 'data-xi': String(xi), 'data-zi': String(zi),
      }));
    }
  }
  const spSampled   = sampledSpine(state.spine.knots,   64);
  const deckSampled = sampledSpine(state.deckLine.knots, 64);
  const pt2str = p => `${xOf(p.x).toFixed(2)},${yOf(p.z).toFixed(2)}`;
  const pathD  = pts => 'M ' + pts.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L ');

  // Waterline.
  const vb = sideSvg.viewBox.baseVal;
  sideSvg.appendChild(el('line', { x1: vb.x, y1: yOf(0), x2: vb.x+vb.width, y2: yOf(0), class: 'water' }));
  sideSvg.appendChild(el('text', {
    x: vb.x+vb.width-3/sf, y: yOf(0) - 3/sf, class: 'label', 'text-anchor': 'end', 'font-size': 9/sf,
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

  // Scale gizmo — X (longitudinal) and Z (height) axes at hull centre.
  {
    const spKnots = state.spine.knots;
    const dkKnots = state.deckLine.knots;
    const zMin = Math.min(...spKnots.map(k => k.z));
    const zMax = Math.max(...dkKnots.map(k => k.z));
    const zMid = (zMin + zMax) / 2;
    appendScaleGizmo2D(sideSvg, xOf(0), yOf(zMid), sf, [
      { axis: 'X', svgDirX:  1, svgDirY:  0, screenDirX:  1, screenDirY:  0, color: '#2563eb' },
      { axis: 'Z', svgDirX:  0, svgDirY: -1, screenDirX:  0, screenDirY: -1, color: '#16a34a' },
    ]);
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

// Section-view scale constants. SECTION_SCALE_B (b axis = beam) is fixed;
// SECTION_SCALE_N (n axis = height) is recomputed on every renderSectionView()
// to give the visible section the same H/B aspect ratio as the actual hull
// at the selected station's longitudinal position.
const SECTION_SCALE   = 600; // px/m  (reference, not used directly for b or n)
let   SECTION_SCALE_N = SECTION_SCALE * DEFAULT_DECK_N;    // px/unit (n, dynamic)
const SECTION_SCALE_B = SECTION_SCALE * DEFAULT_HALF_BEAM; // px/unit (b, fixed)

// Look up the currently selected station object (interior or sheer).
function selectedStationObj() {
  const unified = listAllStations(state);
  return unified[state.selectedStation] || null;
}

// Section view viewBox is computed dynamically from SECTION_SCALE_N so the
// deck (n=1) and keel (n=0) reference lines stay visible no matter how tall
// or short the live aspect makes the section.
const SECTION_VB_PAD_TOP = 30;   // pixel headroom above the deck
const SECTION_VB_PAD_BOT = 85;   // pixel room below the keel for the badge / hint
const SECTION_VB_W       = 400;  // fixed pane width in viewBox pixels
const SECTION_VB_MIN_X   = -200;
const sectionVP = state.viewports.section;
function applySectionViewBox() {
  const baseH    = SECTION_SCALE_N + SECTION_VB_PAD_TOP + SECTION_VB_PAD_BOT;
  const baseMinY = -SECTION_SCALE_N - SECTION_VB_PAD_TOP;
  const cx = (SECTION_VB_MIN_X + SECTION_VB_W/2) + sectionVP.offX;
  const cy = (baseMinY + baseH/2) + sectionVP.offY;
  const zW = SECTION_VB_W / sectionVP.zoom;
  const zH = baseH        / sectionVP.zoom;
  sectionSvg.setAttribute('viewBox',
    `${(cx - zW/2).toFixed(1)} ${(cy - zH/2).toFixed(1)} ${zW.toFixed(1)} ${zH.toFixed(1)}`);
}

function renderSectionView() {
  sectionSvg.innerHTML = '';

  const sel = selectedStationObj();
  if (!sel) {
    applySectionViewBox();
    sectionSvg.appendChild(el('text', {
      x: 0, y: 0, class: 'label', 'text-anchor': 'middle',
    }, 'no station selected'));
    return;
  }
  const station = sel.ref;
  const lastIdx = station.points.length - 1;

  // Live aspect: use the actual half-beam (B) and height (H) at this station's
  // longitudinal position so the displayed cross-section always matches the
  // real H/halfB ratio. The b axis stays at b * SECTION_SCALE_B (so the
  // editor's width visibly tracks the section's max-b — as the loft's
  // auto-stretch maps that point to halfB, max-b is the section's effective
  // scale relative to halfB). To keep the display's aspect correct as max-b
  // changes, SECTION_SCALE_N picks up the same max-b factor — the section
  // view shrinks/grows uniformly while H/halfB stays the apparent aspect.
  {
    const spS = sampledSpine(state.spine.knots,   64);
    const dkS = sampledSpine(state.deckLine.knots, 64);
    const xAt = spineAt(spS, station.s).p.x;
    const Hm  = Math.max(0.005, spineAt(dkS, station.s).p.z - spineAt(spS, station.s).p.z);
    const Bm  = Math.max(0.005, beamEvalAt(sampledBeamLine(state), xAt));
    const maxB = Math.max(1e-9, ...station.points.map(p => p.b));
    SECTION_SCALE_N = Math.max(40, Math.min(900, SECTION_SCALE_B * (Hm / Bm) * maxB));
  }
  applySectionViewBox();

  const bOf = (b) => b * SECTION_SCALE_B;
  const nOf = (n) => -n * SECTION_SCALE_N;

  // Centerline (b = 0). Spans the full vertical viewBox extent.
  const clTop = -SECTION_SCALE_N - SECTION_VB_PAD_TOP + 5;
  const clBot =  SECTION_VB_PAD_BOT - 5;
  sectionSvg.appendChild(el('line', {
    x1: 0, y1: clTop, x2: 0, y2: clBot, class: 'axis',
  }));
  sectionSvg.appendChild(el('text', { x: 5, y: clTop + 13, class: 'label' }, 'CL'));

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

  // Closed-loop section — same Bezier sampler buildLoft uses.
  const dense = sampleSection(station.points, 256);
  const stbdPath = 'M ' + dense.map(p => `${bOf( p.b).toFixed(2)} ${nOf(p.n).toFixed(2)}`).join(' L ');
  const portPath = 'M ' + dense.map(p => `${bOf(-p.b).toFixed(2)} ${nOf(p.n).toFixed(2)}`).join(' L ');
  sectionSvg.appendChild(el('path', { class: 'section-curve',  d: stbdPath }));
  sectionSvg.appendChild(el('path', { class: 'section-mirror', d: portPath }));

  // Tangent handles (drawn first so they sit underneath the knot circles).
  deriveSectionHandles(station.points);
  station.points.forEach((p, i) => {
    const h = sectionKnotHandles(p);
    if (i > 0) {
      const ax = bOf(h.aft.b), ay = nOf(h.aft.n);
      sectionSvg.appendChild(el('line', {
        x1: bOf(p.b), y1: nOf(p.n), x2: ax, y2: ay, class: 'section-handle-line',
      }));
      sectionSvg.appendChild(el('circle', {
        cx: ax, cy: ay, r: 14, class: 'handle-hit',
        'data-drag': 'ctrl-aft', 'data-idx': String(i),
      }));
      sectionSvg.appendChild(el('circle', {
        cx: ax, cy: ay, r: 5, class: 'section-handle',
        'data-drag': 'ctrl-aft', 'data-idx': String(i),
      }));
    }
    if (i < lastIdx) {
      const fx = bOf(h.fore.b), fy = nOf(h.fore.n);
      sectionSvg.appendChild(el('line', {
        x1: bOf(p.b), y1: nOf(p.n), x2: fx, y2: fy, class: 'section-handle-line',
      }));
      sectionSvg.appendChild(el('circle', {
        cx: fx, cy: fy, r: 14, class: 'handle-hit',
        'data-drag': 'ctrl-fore', 'data-idx': String(i),
      }));
      sectionSvg.appendChild(el('circle', {
        cx: fx, cy: fy, r: 5, class: 'section-handle',
        'data-drag': 'ctrl-fore', 'data-idx': String(i),
      }));
    }
  });

  // On-curve knots. Keel (index 0) and deck-end (last) are locked at (0, *).
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
      x: 0, y: SECTION_VB_PAD_BOT - 13, class: 'label', 'text-anchor': 'middle',
    }, 'click · right-click to delete'));
  }

  // Coordinate-system badge (Y-Z plane, looking forward toward bow).
  // Pinned to the bottom-left of the dynamic viewBox.
  {
    const ax = -193, ay = SECTION_VB_PAD_BOT - 5, L = 22;
    sectionSvg.appendChild(el('line', { x1: ax, y1: ay, x2: ax + L, y2: ay,     class: 'axis-arrow' }));
    sectionSvg.appendChild(el('line', { x1: ax, y1: ay, x2: ax,     y2: ay - L, class: 'axis-arrow' }));
    sectionSvg.appendChild(el('text', { x: ax + L + 3, y: ay + 7,     class: 'axis-label' }, '+Y'));
    sectionSvg.appendChild(el('text', { x: ax - 3,     y: ay - L - 3, class: 'axis-label', 'text-anchor': 'start' }, '+Z'));
  }
}

// ── Unit conversion helpers ──────────────────────────────────────────────
// fmtLength(metres) → "4.80 m  ·  15.75 ft  ·  15' 9″"
function fmtLength(m) {
  const ft = m * 3.28083989501;
  const ftInt = Math.floor(ft);
  const inches = (ft - ftInt) * 12;
  const inchRounded = Math.round(inches * 16) / 16; // 1/16" precision
  let ftInDisp;
  if (Math.abs(inchRounded - 12) < 1e-6) ftInDisp = `${ftInt + 1}' 0″`;
  else ftInDisp = `${ftInt}' ${inchRounded.toFixed(2).replace(/\.?0+$/, '')}″`;
  return `${m.toFixed(2)} m  ·  ${ft.toFixed(2)} ft  ·  ${ftInDisp}`;
}
// fmtMM(metres) → "10 mm  ·  0.394″"
function fmtMM(m) {
  const mm = m * 1000;
  const inches = m * 39.3700787;
  return `${mm.toFixed(0)} mm  ·  ${inches.toFixed(3)}″`;
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
  lengthOut.textContent = fmtLength(newL);
  rebuildHull();
  renderSideView();
  renderTopView();
  renderSectionView();
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
const fmtR = (v) => fmtMM(v);
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
function applyColors() {
  hullMaterial.color.set(state.colors.outside);
  insideColorUniform.value.set(state.colors.inside);
}
function syncColorInputsFromState() {
  colorOutEl.value = state.colors.outside;
  colorInEl.value  = state.colors.inside;
}
colorOutEl.addEventListener('input', () => { state.colors.outside = colorOutEl.value; applyColors(); });
colorInEl .addEventListener('input', () => { state.colors.inside  = colorInEl.value;  applyColors(); });
syncColorInputsFromState();
applyColors();

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
  const ao = state.ao;
  ssaoPass.enabled      = ao.enabled;
  ssaoPass.kernelRadius = ao.kernelRadius;
  ssaoPass.minDistance  = ao.minDistance;
  ssaoPass.maxDistance  = ao.maxDistance;
  ssaoPass.output       = aoOutputModes[ao.output] ?? aoOutputModes[0];
  aoContrastUniform.value = ao.contrast;
  aoVisBoostUniform.value = (ao.output === 1 || ao.output === 2) ? ao.contrast : 1.0;
  syncAOLabels();
}

aoEnabledEl.addEventListener('input', () => { state.ao.enabled      = aoEnabledEl.checked;            applyAO(); });
aoKrEl     .addEventListener('input', () => { state.ao.kernelRadius = parseFloat(aoKrEl.value);       applyAO(); });
aoMnEl     .addEventListener('input', () => { state.ao.minDistance  = parseFloat(aoMnEl.value);       applyAO(); });
aoMxEl     .addEventListener('input', () => { state.ao.maxDistance  = parseFloat(aoMxEl.value);       applyAO(); });
aoCtEl     .addEventListener('input', () => { state.ao.contrast     = parseFloat(aoCtEl.value);       applyAO(); });
aoOutSel   .addEventListener('input', () => { state.ao.output       = parseInt(aoOutSel.value, 10);   applyAO(); });

aoResetBtn.addEventListener('click', () => {
  state.ao.enabled      = AO_DEFAULTS.enabled;
  state.ao.kernelRadius = AO_DEFAULTS.kernelRadius;
  state.ao.minDistance  = AO_DEFAULTS.minDistance;
  state.ao.maxDistance  = AO_DEFAULTS.maxDistance;
  state.ao.contrast     = AO_DEFAULTS.contrast;
  state.ao.output       = AO_DEFAULTS.output;
  syncAOInputsFromState();
  applyAO();
});

function syncAOInputsFromState() {
  aoEnabledEl.checked = state.ao.enabled;
  aoKrEl.value        = state.ao.kernelRadius;
  aoMnEl.value        = state.ao.minDistance;
  aoMxEl.value        = state.ao.maxDistance;
  aoCtEl.value        = state.ao.contrast;
  aoOutSel.value      = String(state.ao.output);
}

// Initial: push state defaults into inputs, then apply.
syncAOInputsFromState();
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
  topDrag = {
    kind: target.dataset.drag, id: target.dataset.idx, moved: false, pointerId: e.pointerId,
    xi: target.dataset.xi !== undefined ? +target.dataset.xi : undefined,
    zi: target.dataset.zi !== undefined ? +target.dataset.zi : undefined,
  };
  if (topDrag.kind === 'station') selectStation(+topDrag.id);
  topSvg.setPointerCapture(e.pointerId);
});

topSvg.addEventListener('pointermove', (e) => {
  if (!topDrag) return;
  const { wx, wy } = svgToLocalTop(e);
  topDrag.moved = true;

  if (topDrag.kind === 'ref-top') {
    // wx = worldX (longitudinal), wy = worldY (beam)
    if (!topDrag.startWX) { topDrag.startWX = wx; topDrag.startWY = wy; topDrag.origX = state.topRef.worldX; topDrag.origY = state.topRef.worldY; }
    state.topRef.worldX = topDrag.origX + (wx - topDrag.startWX);
    state.topRef.worldY = topDrag.origY + (wy - topDrag.startWY);
    renderTopView();
    return;
  }

  if (topDrag.kind === 'ref-top-corner') {
    const r = state.topRef;
    if (!topDrag.anchorSet) {
      topDrag.anchorSet = true;
      // zi=0(bow end)→anchor stern, zi=1(stern end)→anchor bow
      topDrag.anchorWx = topDrag.zi === 0 ? r.worldX         : r.worldX + r.worldW;
      // xi=0(port)→anchor stbd, xi=1(stbd)→anchor port
      topDrag.anchorWy = topDrag.xi === 0 ? r.worldY + r.worldH : r.worldY;
    }
    const newW = Math.max(0.05, Math.abs(wx - topDrag.anchorWx)); // length
    const newH = r.nativeAspect ? newW * r.nativeAspect : newW;   // beam
    r.worldW = newW;
    r.worldH = newH;
    r.worldX = topDrag.zi === 0 ? topDrag.anchorWx         : topDrag.anchorWx - newW;
    r.worldY = topDrag.xi === 0 ? topDrag.anchorWy - newH   : topDrag.anchorWy;
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
  // Beam-line and station drags shift the live H/B aspect at the selected
  // station — keep the cross-section view in sync so its apparent height
  // tracks the new beam width in real time.
  renderSectionView();
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
  topFit = null;
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
    renderSectionView();
    return;
  }

});

// Right-click handler: delete a beam peak OR a station, depending on the target.
function tryTopDelete(e) {
  const peak = e.target.closest('[data-drag="beam-peak"]');
  if (peak) {
    e.preventDefault();
    if (state.beamLine.peaks.length <= 1) return;
    const sorted = [...state.beamLine.peaks].sort((a, b) => a.x - b.x);
    const pk = sorted[+peak.dataset.idx];
    const pi = state.beamLine.peaks.indexOf(pk);
    if (pi >= 0) state.beamLine.peaks.splice(pi, 1);
    rebuildHull(); renderTopView(); renderSectionView();
    return;
  }
  const stationT = e.target.closest('[data-drag="station"]');
  if (stationT) {
    e.preventDefault();
    deleteStation(+stationT.dataset.idx);
  }
}
topSvg.addEventListener('contextmenu', tryTopDelete);
topSvg.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey) tryTopDelete(e); });

// ── Scale gizmo — drag system ─────────────────────────────────────────────
//
// Scale ratio = (GIZMO_ARM + screen-delta-along-axis) / GIZMO_ARM.
// GIZMO_ARM is declared near appendScaleGizmo2D above.

function applyScaleX(r) {
  if (!(r > 0) || !isFinite(r)) return;
  state.spine.knots.forEach(k    => { k.x *= r; k.foreLen *= r; k.aftLen *= r; });
  state.deckLine.knots.forEach(k => { k.x *= r; k.foreLen *= r; k.aftLen *= r; });
  const bl = state.beamLine;
  bl.sternHandle.dx *= r; bl.bowHandle.dx *= r;
  bl.peaks.forEach(pk => { pk.x *= r; pk.hdx *= r; });
  state.length *= r;
  lengthEl.value        = state.length.toFixed(2);
  lengthOut.textContent = fmtLength(state.length);
}

function applyScaleY(r) {
  if (!(r > 0) || !isFinite(r)) return;
  const bl = state.beamLine;
  bl.sternHandle.dy *= r; bl.bowHandle.dy *= r;
  bl.peaks.forEach(pk => { pk.y *= r; pk.hdy *= r; });
}

function applyScaleZ(r) {
  if (!(r > 0) || !isFinite(r)) return;
  state.spine.knots.forEach(k    => { k.z *= r; });
  state.deckLine.knots.forEach(k => { k.z *= r; });
}

// scaleDrag: active scale-gizmo drag state.
// dirX/dirY: screen-space unit vector toward the positive axis tip.
// prevR: accumulated ratio (used to compute the incremental change each frame).
let scaleDrag = null;

document.addEventListener('pointermove', (e) => {
  if (!scaleDrag) return;
  const dx = e.clientX - scaleDrag.startX;
  const dy = e.clientY - scaleDrag.startY;
  const delta = dx * scaleDrag.dirX + dy * scaleDrag.dirY;
  const r  = Math.max(0.05, (GIZMO_ARM + delta) / GIZMO_ARM);
  const dr = r / scaleDrag.prevR;
  scaleDrag.prevR = r;
  if (Math.abs(dr - 1) < 1e-6) return;
  if      (scaleDrag.axis === 'X') { applyScaleX(dr); sideFit = null; topFit = null; }
  else if (scaleDrag.axis === 'Y')   applyScaleY(dr);
  else if (scaleDrag.axis === 'Z')   applyScaleZ(dr);
  rebuildHull();
  renderSideView(); renderTopView(); renderSectionView();
  updateThreeGizmo();
}, true);

document.addEventListener('pointerup',     () => { scaleDrag = null; }, true);
document.addEventListener('pointercancel', () => { scaleDrag = null; }, true);

// Attach a capture-phase pointerdown listener to a SVG so that clicks on
// [data-scale-axis] elements start a scale drag and stop further propagation
// (preventing the pan handler from treating the click as a background tap).
function attachScaleGizmoPointer(svg) {
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const target = e.target.closest('[data-scale-axis]');
    if (!target) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    scaleDrag = {
      axis  : target.dataset.scaleAxis,
      dirX  : parseFloat(target.dataset.scaleDirX),
      dirY  : parseFloat(target.dataset.scaleDirY),
      startX: e.clientX,
      startY: e.clientY,
      prevR : 1,
    };
    svg.setPointerCapture(e.pointerId);
  }, true);
}

attachScaleGizmoPointer(sideSvg);
attachScaleGizmoPointer(topSvg);
// Section view intentionally has no scale gizmo: scaling is meaningless in
// normalised (b, n) section space — Y/Z scaling lives on top/side/3D views.

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
    startWx: x / SIDE_SCALE, startWz: -y / SIDE_SCALE,
    xi: target.dataset.xi !== undefined ? +target.dataset.xi : undefined,
    zi: target.dataset.zi !== undefined ? +target.dataset.zi : undefined,
  };
  if (kind === 'station') selectStation(idx);
  sideSvg.setPointerCapture(e.pointerId);
});

sideSvg.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = svgToLocal(sideSvg, e);
  const wx = x / SIDE_SCALE;
  const wz = -y / SIDE_SCALE;
  drag.moved = true;

  if (drag.kind === 'ref-side') {
    if (!drag.startWX) { drag.startWX = wx; drag.startWZ = wz; drag.origX = state.sideRef.worldX; drag.origZ = state.sideRef.worldZ; }
    state.sideRef.worldX = drag.origX + (wx - drag.startWX);
    state.sideRef.worldZ = drag.origZ + (wz - drag.startWZ);
    renderSideView();
    return;
  }

  if (drag.kind === 'ref-side-corner') {
    const r = state.sideRef;
    if (!drag.anchorSet) {
      drag.anchorSet = true;
      // Anchor = opposite corner: xi=0(left)→anchor right, xi=1(right)→anchor left
      drag.anchorWx = drag.xi === 0 ? r.worldX + r.worldW : r.worldX;
      // zi=0(top)→anchor bottom, zi=1(bottom)→anchor top
      drag.anchorWz = drag.zi === 0 ? r.worldZ - r.worldH : r.worldZ;
    }
    const newW = Math.max(0.05, Math.abs(wx - drag.anchorWx));
    const newH = r.nativeAspect ? newW / r.nativeAspect : newW;
    r.worldW = newW;
    r.worldH = newH;
    r.worldX = drag.xi === 0 ? drag.anchorWx - newW : drag.anchorWx;
    r.worldZ = drag.zi === 0 ? drag.anchorWz + newH : drag.anchorWz;
    renderSideView();
    return;
  }

  if (drag.kind === 'knot') {
    // Move on-curve knot; handles move with it.
    const knots = state.spine.knots;
    const k = knots[drag.idx];
    if (!k) return;
    k.x = wx; k.z = wz;
    // Pair endpoints: bow/stern tip X is shared with the deck line endpoint.
    const dkKnots = state.deckLine.knots;
    if (drag.idx === 0)              dkKnots[0].x = wx;
    if (drag.idx === knots.length-1) dkKnots[dkKnots.length-1].x = wx;
    state.length = knots[knots.length-1].x - knots[0].x;
    lengthEl.value = state.length.toFixed(2);
    lengthOut.textContent = fmtLength(state.length);
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
    const dkKnots = state.deckLine.knots;
    const k = dkKnots[drag.idx];
    if (!k) return;
    k.x = wx; k.z = wz;
    // Pair endpoints: bow/stern tip X is shared with the rocker endpoint.
    const spKnots = state.spine.knots;
    if (drag.idx === 0)                k.x = spKnots[0].x = wx;
    if (drag.idx === dkKnots.length-1) k.x = spKnots[spKnots.length-1].x = wx;
    state.length = spKnots[spKnots.length-1].x - spKnots[0].x;
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
  // Section view depends on the live H/B aspect at the selected station —
  // re-render so the cross-section's apparent height tracks Z/beam edits.
  renderSectionView();
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
  const loc = (() => { const pt = sideSvg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(sideSvg.getScreenCTM().inverse()); })();
  sideVP.offX = loc.x - (loc.x - sideVP.offX) / dz;
  sideVP.offY = loc.y - (loc.y - sideVP.offY) / dz;
  sideVP.zoom = Math.max(0.1, Math.min(20, sideVP.zoom * dz));
  renderSideView();
}, { passive: false });

sideSvg.addEventListener('pointerdown', (e) => {
  const isMiddle = e.button === 1;
  const isBackground = e.button === 0 && !e.target.closest('[data-drag]');
  if (!isMiddle && !isBackground) return;
  e.preventDefault();
  e.stopPropagation();
  sidePanDrag = { startX: e.clientX, startY: e.clientY, startOffX: sideVP.offX, startOffY: sideVP.offY };
  sideSvg.setPointerCapture(e.pointerId);
}, true);

sideSvg.addEventListener('pointermove', (e) => {
  if (!sidePanDrag) return;
  const vb = sideSvg.viewBox.baseVal;
  const bbox = sideSvg.getBoundingClientRect();
  const scaleX = vb.width  / Math.max(1, bbox.width);
  const scaleY = vb.height / Math.max(1, bbox.height);
  sideVP.offX = sidePanDrag.startOffX - (e.clientX - sidePanDrag.startX) * scaleX;
  sideVP.offY = sidePanDrag.startOffY - (e.clientY - sidePanDrag.startY) * scaleY;
  renderSideView();
}, true);

sideSvg.addEventListener('pointerup',     () => { sidePanDrag = null; }, true);
sideSvg.addEventListener('pointercancel', () => { sidePanDrag = null; }, true);

document.getElementById('side-reset').addEventListener('click', () => {
  sideFit = null;
  sideVP.zoom = 1; sideVP.offX = 0; sideVP.offY = 0;
  renderSideView();
});

// ── State export / import ─────────────────────────────────────────────────

// ── Reference image controls ──────────────────────────────────────────────

function wireRefImage(viewKey, fileId, opacityId, opacityOutId, clearId, renderFn) {
  const refState = () => state[viewKey];
  const fmtPct = v => Math.round(v * 100) + '%';

  document.getElementById(fileId).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const r = refState();
        r.url = url;
        r.nativeAspect = img.naturalWidth / img.naturalHeight;
        // Auto-position to cover the hull on first load.
        const spKnots = state.spine.knots;
        const sternX = spKnots[0].x, bowX = spKnots[spKnots.length - 1].x;
        const hullLen = bowX - sternX;
        if (viewKey === 'sideRef') {
          r.worldW = hullLen;
          r.worldH = r.worldW / r.nativeAspect;
          r.worldX = sternX;
          // Top edge at highest deck point + small pad.
          const dkPts = sampledSpine(state.deckLine.knots, 16).pts;
          r.worldZ = Math.max(...dkPts.map(p => p.y)) + 0.05 + r.worldH;
        } else {
          r.worldW = hullLen;
          r.worldH = r.worldW * r.nativeAspect;
          r.worldX = sternX;
          r.worldY = -r.worldH / 2;
        }
        renderFn();
      };
      img.src = url;
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

  document.getElementById(clearId).addEventListener('click', () => {
    refState().url = null;
    renderFn();
  });
}

wireRefImage('sideRef', 'side-ref-file', 'side-ref-opacity', 'side-ref-opacity-out', 'side-ref-clear', renderSideView);
wireRefImage('topRef',  'top-ref-file',  'top-ref-opacity',  'top-ref-opacity-out',  'top-ref-clear',  renderTopView);

// Resizable view-pane dividers. Pane percentages live in state.layout so a
// JSON export captures the workspace shape.
const mainEl = document.querySelector('main');
function applyLayoutFromState() {
  mainEl.style.setProperty('--col-pct', `${state.layout.colPct.toFixed(1)}%`);
  mainEl.style.setProperty('--row-pct', `${state.layout.rowPct.toFixed(1)}%`);
  const pane = document.querySelector('.pane-controls');
  const btn  = document.getElementById('drawer-toggle');
  pane.classList.toggle('hidden', !!state.layout.drawerHidden);
  btn.textContent = state.layout.drawerHidden ? '◀' : '▶';
}
{
  const initResizer = (el, axis) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const onMove = (ev) => {
        const rect = mainEl.getBoundingClientRect();
        if (axis === 'v') {
          state.layout.colPct = Math.max(10, Math.min(90, ((ev.clientX - rect.left) / rect.width) * 100));
        } else {
          state.layout.rowPct = Math.max(10, Math.min(90, ((ev.clientY - rect.top) / rect.height) * 100));
        }
        applyLayoutFromState();
        sideFit = null; topFit = null;
        renderSideView(); renderTopView();
        // Resize three.js canvas too (ResizeObserver should catch it, but force it).
        window.dispatchEvent(new Event('resize'));
      };
      const onUp = () => {
        el.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      el.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  };
  initResizer(document.querySelector('.resizer-v'), 'v');
  initResizer(document.querySelector('.resizer-h'), 'h');
}

// Controls drawer toggle (chevron flips direction).
{
  const btn  = document.getElementById('drawer-toggle');
  btn.addEventListener('click', () => {
    state.layout.drawerHidden = !state.layout.drawerHidden;
    applyLayoutFromState();
  });
}

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
      // Deep-merge so nested objects (viewports, keyLight, ao, colors, refs)
      // keep their identity — local aliases like sideVP/keyLightAngles must
      // continue pointing at the same nested object after the import.
      deepAssign(state, parsed);
      const n = listAllStations(state).length;
      if (state.selectedStation >= n) state.selectedStation = Math.max(0, n - 1);
      syncUIFromState();
      // The auto-fit caches depend on hull bounds and may be stale.
      sideFit = null; topFit = null;
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

// Push every state field into the corresponding UI control and Three.js
// object. Called once at init and again after JSON import so the visible
// UI always matches `state`. Programmatic .value assignment doesn't fire
// 'input'/'change' events — that's intentional, the work below is the
// canonical source of truth.
function syncUIFromState() {
  // Sliders / dropdowns
  lengthEl.value         = state.length.toFixed(2);
  lengthOut.textContent  = fmtLength(state.length);
  loftResEl.value        = state.loftRes;
  xSubdivEl.value        = String(state.xSubdiv);
  spineRadiusEl.value    = String(state.spineRadius);
  spineRadiusOut.textContent = fmtR(state.spineRadius);
  showMeshEl.checked     = state.showLoftMesh;
  meshOpacityEl.value    = state.meshOpacity;
  meshOpacityOut.textContent = state.meshOpacity.toFixed(0) + '%';
  // Reference image opacity sliders + labels
  document.getElementById('side-ref-opacity').value    = state.sideRef.opacity ?? 0.3;
  document.getElementById('side-ref-opacity-out').textContent = Math.round((state.sideRef.opacity ?? 0.3) * 100) + '%';
  document.getElementById('top-ref-opacity').value     = state.topRef.opacity  ?? 0.3;
  document.getElementById('top-ref-opacity-out').textContent  = Math.round((state.topRef.opacity  ?? 0.3) * 100) + '%';
  // Colors + AO push into inputs and Three.js
  syncColorInputsFromState();
  applyColors();
  syncAOInputsFromState();
  applyAO();
  // Key light — already aliased into state, just re-apply.
  applyKeyLightPosition();
  // Pane resizer percentages + drawer state
  applyLayoutFromState();
  // Station label/count display
  stationLabel.textContent = stationLabelFor(state.selectedStation);
}

// Click near rocker → insert on-curve knot; click near deck curve → insert handle.
sideSvg.addEventListener('click', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('[data-drag]')) return;
  if (drag && drag.moved) return;
  const { x, y } = svgToLocal(sideSvg, e);
  const wx = x / SIDE_SCALE, wz = -y / SIDE_SCALE;

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
    rebuildHull(); renderSideView(); renderTopView(); renderSectionView();
  } else if (dDist <= THRESH && dDist < rDist) {
    insertKnot(state.deckLine.knots, dSeg, dT);
    rebuildHull(); renderSideView(); renderSectionView();
  }
});

// Right-click: delete interior knot on rocker or deck line (endpoints protected).
function trySideDelete(e) {
  const t = e.target.closest('[data-drag]');
  if (!t) return;
  const idx = +t.dataset.idx;
  if (t.dataset.drag === 'knot') {
    const knots = state.spine.knots;
    if (idx === 0 || idx === knots.length - 1) return;
    e.preventDefault();
    knots.splice(idx, 1);
    rebuildHull(); renderSideView(); renderTopView(); renderSectionView();
  } else if (t.dataset.drag === 'deck-knot') {
    const knots = state.deckLine.knots;
    if (idx === 0 || idx === knots.length - 1) return;
    e.preventDefault();
    knots.splice(idx, 1);
    rebuildHull(); renderSideView(); renderSectionView();
  }
}
sideSvg.addEventListener('contextmenu', trySideDelete);
sideSvg.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey) trySideDelete(e); });

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
  sectionDrag = {
    kind: target.dataset.drag,
    idx: +target.dataset.idx,
    pointerId: e.pointerId,
    moved: false,
  };
  sectionSvg.setPointerCapture(e.pointerId);
});

sectionSvg.addEventListener('pointermove', (e) => {
  if (!sectionDrag) return;
  const sel = selectedStationObj();
  if (!sel) return;
  const station = sel.ref;
  const i       = sectionDrag.idx;
  const lastIdx = station.points.length - 1;
  const { x, y } = svgToLocal(sectionSvg, e);
  const b = x / SECTION_SCALE_B;
  const n = -y / SECTION_SCALE_N;

  if (sectionDrag.kind === 'ctrl') {
    // Move on-curve knot. Keel (idx 0) and deck-end (last) are locked.
    if (i === 0 || i === lastIdx) return;
    station.points[i].b = Math.max(0, b);
    station.points[i].n = n;
  } else if (sectionDrag.kind === 'ctrl-fore') {
    // Drag outgoing handle: updates angle (shared) + foreLen; aftLen stays.
    const k = station.points[i];
    if (!k) return;
    const db = b - k.b, dn = n - k.n;
    const len = Math.hypot(db, dn);
    if (len > 0.005) { k.angle = Math.atan2(dn, db); k.foreLen = len; }
  } else if (sectionDrag.kind === 'ctrl-aft') {
    // Drag incoming handle: updates angle (shared, flipped) + aftLen.
    const k = station.points[i];
    if (!k) return;
    const db = b - k.b, dn = n - k.n;
    const len = Math.hypot(db, dn);
    if (len > 0.005) { k.angle = Math.atan2(-dn, -db); k.aftLen = len; }
  } else {
    return;
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
  const target = e.target.closest('[data-drag="ctrl"]');
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

// Section view zoom (wheel) and pan (middle-button or left-drag on background).
sectionSvg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const dz = e.deltaY < 0 ? 1.05 : 1 / 1.05;
  const pt = sectionSvg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const loc = pt.matrixTransform(sectionSvg.getScreenCTM().inverse());
  sectionVP.offX = loc.x - (loc.x - sectionVP.offX) / dz;
  sectionVP.offY = loc.y - (loc.y - sectionVP.offY) / dz;
  sectionVP.zoom = Math.max(0.1, Math.min(20, sectionVP.zoom * dz));
  renderSectionView();
}, { passive: false });

let sectionPanDrag = null;
sectionSvg.addEventListener('pointerdown', (e) => {
  const isMiddle = e.button === 1;
  const isBackground = e.button === 0 && !e.target.closest('[data-drag]');
  if (!isMiddle && !isBackground) return;
  e.preventDefault(); e.stopPropagation();
  sectionPanDrag = { startX: e.clientX, startY: e.clientY, startOffX: sectionVP.offX, startOffY: sectionVP.offY };
  sectionSvg.setPointerCapture(e.pointerId);
}, true);
sectionSvg.addEventListener('pointermove', (e) => {
  if (!sectionPanDrag) return;
  const vb = sectionSvg.viewBox.baseVal;
  const bbox = sectionSvg.getBoundingClientRect();
  const scaleX = vb.width  / Math.max(1, bbox.width);
  const scaleY = vb.height / Math.max(1, bbox.height);
  sectionVP.offX = sectionPanDrag.startOffX - (e.clientX - sectionPanDrag.startX) * scaleX;
  sectionVP.offY = sectionPanDrag.startOffY - (e.clientY - sectionPanDrag.startY) * scaleY;
  renderSectionView();
}, true);
sectionSvg.addEventListener('pointerup',     () => { sectionPanDrag = null; }, true);
sectionSvg.addEventListener('pointercancel', () => { sectionPanDrag = null; }, true);

document.getElementById('section-reset').addEventListener('click', () => {
  sectionVP.zoom = 1; sectionVP.offX = 0; sectionVP.offY = 0;
  renderSectionView();
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

// Single source of truth: push state into every UI control and Three.js
// uniform/material. Replaces the scattered "sync .value/.textContent = state.X"
// calls that lived in this section before.
syncUIFromState();
renderStationList();

// Defer first render one frame so the CSS grid has finished laying out and
// getBoundingClientRect() returns real pane dimensions for sideFit/topFit.
requestAnimationFrame(() => {
  renderSideView();
  renderTopView();
  renderSectionView();
});

window.addEventListener('resize', () => { sideFit = null; topFit = null; renderTopView(); renderSideView(); });

// Invalidate fit caches whenever the panes change size (e.g. resizer drag,
// drawer open/close, initial layout settle).
const paneResizeObserver = new ResizeObserver(() => {
  sideFit = null; topFit = null;
  renderSideView(); renderTopView();
});
paneResizeObserver.observe(sideSvg.parentElement);
paneResizeObserver.observe(topSvg.parentElement);
