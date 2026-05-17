// Loft prototype — Phase A: layout skeleton with a placeholder lofted mesh
// and read-only renderings of the side view and cross-section. Editing
// (spine, sections, chines, add/remove stations) lands in phases B–E.
//
// Coordinates throughout: X = longitudinal (+X bow), Y = transverse
// (+Y stbd), Z = vertical (+Z up). Stations stored starboard-only;
// port is mirrored across Y = 0.

import * as THREE       from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Removed post-processing imports.

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
  // Render mode + per-mode parameters (persisted via JSON export).
  render: {
    mode: 'shaded', // shaded | normals | matcap | checker
    matcap:  { base: '#3a5a8a', highlight: '#dceaff' },
    checker: { size: 0.10, light: '#f1f5f9', dark: '#1f2937' },
  },
  ao:     { enabled: true, kernelRadius: 0.35, minDistance: 0.0001, maxDistance: 0.6, contrast: 12.0, output: 0 },
  keyLight: { az: 0.69, el: 0.89 },
  viewports: {
    side:    { zoom: 1, offX: 0, offY: 0 },
    top:     { zoom: 1, offX: 0, offY: 0 },
    section: { zoom: 1, offX: 0, offY: 0 },
  },
  layout: { colPct: 25, rowPct: 66, drawerHidden: false },
  // Per-view layer toggles.  When off, layer elements grey out (CSS) and
  // become non-interactive (pointer-events: none).  Click-to-add suppressed
  // by JS checking the relevant flag.  Persisted via JSON export.
  layers: {
    side:    { keel: true, deck: true, stations: true, refImage: true, gizmo: true },
    top:     { beam: true, stations: true, refImage: true, gizmo: true },
    section: { controls: true, refImage: true },
  },
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

// Interpolate y from a sampledSpine result at a specific x.  The curve is
// assumed monotonic in x (true for rocker and deck — the user can't make
// either loop back).  Binary-search the sample array for the bracketing
// pair, then linearly interpolate y.  Used by buildLoft() so that the deck
// height at each loft row is sampled at the row's actual X — not at the
// same arc-length s as the keel, which would pick the wrong point on the
// deck curve whenever its shape differs from the keel's.
function curveYAtX(sampled, x) {
  const pts = sampled.pts;
  if (pts.length === 0) return 0;
  if (x <= pts[0].x) return pts[0].y;
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (pts[m].x <= x) lo = m; else hi = m;
  }
  const dx = pts[hi].x - pts[lo].x;
  const t = dx > 1e-12 ? (x - pts[lo].x) / dx : 0;
  return pts[lo].y + t * (pts[hi].y - pts[lo].y);
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
    const { p: keel } = spineAt(spSampled, s);
    // Sample the deck at the row's actual X — not at arc-length s — so the
    // deck row of the loft traces the green deck Bezier exactly.  Using
    // spineAt(deckSampled, s) would pick the deck point at the same arc-
    // length fraction along the deck, whose x usually differs from keel.x
    // whenever the curves have different shapes.
    const deckZ  = curveYAtX(deckSampled, keel.x);
    const height = Math.max(0.001, deckZ - keel.z);
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
    // Two triangles per tip, connecting the four spine-edge corners:
    //   stbd-keel (k=0), stbd-deck (k=N-1), port-keel, port-deck.
    // The tip row collapses to a flat rectangle of width 2r in world-Y.
    // A fan of N-1 triangles was used before but caused z-fighting because
    // intermediate k vertices share the same (x, z) position — all world-Y
    // is 0 at tips (halfB=0), so only the spine-edge vertices differ.
    const tipFace = (rowI, outwardForward) => {
      const sK = rowI * N,               sD = rowI * N + (N - 1);
      const pK = stbdVertCount + rowI * N, pD = stbdVertCount + rowI * N + (N - 1);
      if (outwardForward) {
        // Bow — outward normal is +x, CCW from +x.
        indices.push(sK, pK, pD);
        indices.push(sK, pD, sD);
      } else {
        // Stern — outward normal is -x, CCW from -x.
        indices.push(pK, sK, sD);
        indices.push(pK, sD, pD);
      }
    };
    tipFace(0, false);             // stern
    tipFace(Mdense - 1, true);     // bow
  }

  // Expose dense rows for SVG wireframe and station row data for selection.
  const stationRows = sortedSt.map((st, i) => {
    const { p: keel } = spineAt(spSampled, st.s);
    const deckZ       = curveYAtX(deckSampled, keel.x);  // same fix as the dense loft
    const height = Math.max(0.001, deckZ - keel.z);
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
  // Re-apply the current render mode so freshly-created meshes pick up the
  // correct material (matcap/checker/normals instead of the default hullMaterial).
  if (typeof applyRenderMode === 'function') applyRenderMode();
  return loft;
}

rebuildHull(); // populates lastLoft

// ── Resize handling ────────────────────────────────────────────────────────
const resizeObserver = new ResizeObserver(() => {
  const w = threeHost.clientWidth, h = threeHost.clientHeight;
  if (w > 0 && h > 0) {
    renderer.setSize(w, h);
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
  renderer.render(scene, camera);
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

function computeImageTransform(r, t1, t2) {
  if (!r.p1 || !r.p2 || !r.nativeW || !r.nativeH) return '';
  const dx = r.p2.x - r.p1.x;
  const dy = r.p2.y - r.p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';
  
  const dxT = t2.x - t1.x;
  const dyT = t2.y - t1.y;
  const lenT = Math.hypot(dxT, dyT);
  
  const s = lenT / len;
  const a1 = Math.atan2(dy, dx);
  const a2 = Math.atan2(dyT, dxT);
  const da = a2 - a1;
  
  const a = s * Math.cos(da);
  const b = s * Math.sin(da);
  const c = -s * Math.sin(da);
  const d = s * Math.cos(da);
  
  const e = t1.x - (a * r.p1.x + c * r.p1.y);
  const f = t1.y - (b * r.p1.x + d * r.p1.y);
  
  return `matrix(${a.toFixed(5)} ${b.toFixed(5)} ${c.toFixed(5)} ${d.toFixed(5)} ${e.toFixed(5)} ${f.toFixed(5)})`;
}

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
    console.log('[renderTopView] bbox:', bbox.width, bbox.height,
                'parent:', topSvg.parentElement?.clientWidth, topSvg.parentElement?.clientHeight,
                'parent.parent:', topSvg.parentElement?.parentElement?.clientWidth, topSvg.parentElement?.parentElement?.clientHeight);
    const paneH = Math.max(bbox.height > 10 ? bbox.height : topSvg.parentElement.clientHeight, 100);
    const paneW = Math.max(bbox.width  > 10 ? bbox.width  : topSvg.parentElement.clientWidth, 60);
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
    imgEl.setAttribute('width', r.nativeW);
    imgEl.setAttribute('height', r.nativeH);
    imgEl.setAttribute('opacity', r.opacity);
    
    let t1, t2;
    if (r.worldT1 && r.worldT2) {
      t1 = { x: xOfT(r.worldT1.x), y: yOfT(r.worldT1.y) };
      t2 = { x: xOfT(r.worldT2.x), y: yOfT(r.worldT2.y) };
    } else {
      const knots = state.spine.knots;
      const sternX = knots[0].x;
      const bowX = knots[knots.length - 1].x;
      t1 = { x: xOfT(0), y: yOfT(sternX) };
      t2 = { x: xOfT(0), y: yOfT(bowX) };
    }
    
    imgEl.setAttribute('transform', computeImageTransform(r, t1, t2));
    topSvg.appendChild(imgEl);
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

  // ── Station-add line: longitudinal centerline (world Y = 0). Click → add ──
  {
    const x1 = 0, x2 = 0;
    const y1 = yOfT(sternKnot.x), y2 = yOfT(bowKnot.x);
    topSvg.appendChild(el('line', {
      x1, y1, x2, y2, class: 'station-add-line',
    }));
    topSvg.appendChild(el('line', {
      x1, y1, x2, y2, class: 'station-add-hit',
      'data-drag-action': 'add-station',
    }));
  }

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

  // ── Station-add line: longitudinal centerline through the loft ──────
  // Visible when the stations layer is active.  Click → insert a new
  // station at that X with section shape interpolated from the current
  // loft (so the lofted surface is unchanged at the moment of insertion).
  {
    const sp = state.spine.knots;
    const stX = sp[0].x, bwX = sp[sp.length-1].x;
    const dkS_ = sampledSpine(state.deckLine.knots, 32);
    // Midline z = average of keel z and deck z along the length.
    const midZ = (sp.reduce((a,k) => a + k.z, 0) / sp.length
                + state.deckLine.knots.reduce((a,k) => a + k.z, 0) / state.deckLine.knots.length) / 2;
    void dkS_; // silence unused
    const x1 = xOf(stX), x2 = xOf(bwX), y = yOf(midZ);
    sideSvg.appendChild(el('line', {
      x1, y1: y, x2, y2: y, class: 'station-add-line',
    }));
    sideSvg.appendChild(el('line', {
      x1, y1: y, x2, y2: y, class: 'station-add-hit',
      'data-drag-action': 'add-station',
    }));
  }

  // ── Stations: keel (bottom) + deck (top) + chord line ──────────────
  const sortedStSide = [...state.stations].sort((a, b) => a.s - b.s);
  sortedStSide.forEach((st, i) => {
    const { p: kp } = spineAt(spSampled, st.s);
    // Deck Z at the station's actual X (same fix as buildLoft).
    const dz = curveYAtX(deckSampled, kp.x);
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
  let Hm, Bm, keelZ;
  {
    const spS = sampledSpine(state.spine.knots,   64);
    const dkS = sampledSpine(state.deckLine.knots, 64);
    const xAt = spineAt(spS, station.s).p.x;
    keelZ = spineAt(spS, station.s).p.z;
    Hm  = Math.max(0.005, spineAt(dkS, station.s).p.z - keelZ);
    Bm  = Math.max(0.005, beamEvalAt(sampledBeamLine(state), xAt));
    const maxB = Math.max(1e-9, ...station.points.map(p => p.b));
    SECTION_SCALE_N = Math.max(40, Math.min(900, SECTION_SCALE_B * (Hm / Bm) * maxB));
  }
  applySectionViewBox();

  if (state.sectionRef && state.sectionRef.url) {
    const r = state.sectionRef;
    const imgEl = document.createElementNS(SVG_NS, 'image');
    imgEl.setAttribute('href', r.url);
    imgEl.setAttribute('width', r.nativeW);
    imgEl.setAttribute('height', r.nativeH);
    imgEl.setAttribute('opacity', r.opacity);
    
    let t1, t2;
    if (r.worldT1 && r.worldT2) {
      t1 = { x: 0, y: -((r.worldT1.y - keelZ) / Hm) * SECTION_SCALE_N };
      t2 = { x: 0, y: -((r.worldT2.y - keelZ) / Hm) * SECTION_SCALE_N };
    } else {
      const spKnots = state.spine.knots;
      const dkPts = sampledSpine(state.deckLine.knots, 16).pts;
      const maxZ = Math.max(...dkPts.map(p => p.y));
      const minZ = Math.min(...spKnots.map(k => k.z));
      t1 = { x: 0, y: -((minZ - keelZ) / Hm) * SECTION_SCALE_N };
      t2 = { x: 0, y: -((maxZ - keelZ) / Hm) * SECTION_SCALE_N };
    }
    
    imgEl.setAttribute('transform', computeImageTransform(r, t1, t2));
    sectionSvg.appendChild(imgEl);
  }


  // True screen→SVG scale factor.  sectionVP.zoom alone is not enough because
  // SECTION_SCALE_N (and therefore the viewBox height) also changes when the
  // H/B aspect ratio or max-b shift — those changes alter the "meet" letterbox
  // scale independently of zoom.  Read the actual ratio from the DOM instead.
  //
  // Inline element styles (style="stroke-width:…") beat CSS class rules, which
  // beat SVG presentation attributes.  All non-geometric sizes must use style=
  // (not attribute) to override the CSS; circle r is a geometry attribute in
  // SVG 1.1 and is NOT overridden by CSS, so r/sf as an attribute works fine.
  const sVB   = sectionSvg.viewBox.baseVal;   // set synchronously by applySectionViewBox
  const sBbox = sectionSvg.getBoundingClientRect(); // CSS-determined dimensions (flex layout)
  const sf = (sBbox.width > 1 && sVB.width > 0)
    ? Math.min(sBbox.width / sVB.width, sBbox.height / sVB.height)
    : sectionVP.zoom;

  const bOf = (b) => b * SECTION_SCALE_B;
  const nOf = (n) => -n * SECTION_SCALE_N;

  // Helper: inline style string for a stroke-width value in screen-constant pixels.
  // Must use style= (not attribute) because CSS class rules beat SVG attributes.
  const sw = (w) => `stroke-width:${w / sf}`;
  // Helper: inline style for font-size in screen-constant pixels.
  const fs = (px) => `font-size:${px / sf}px`;

  // Centerline (b = 0). Spans the full vertical viewBox extent.
  const clTop = -SECTION_SCALE_N - SECTION_VB_PAD_TOP + 5;
  const clBot =  SECTION_VB_PAD_BOT - 5;
  sectionSvg.appendChild(el('line', {
    x1: 0, y1: clTop, x2: 0, y2: clBot, class: 'axis', style: sw(2.2),
  }));
  sectionSvg.appendChild(el('text', {
    x: 5/sf, y: clTop + 13/sf, class: 'label', style: fs(11),
  }, 'CL'));

  // Keel reference (n = 0).
  sectionSvg.appendChild(el('line', {
    x1: -195, y1: nOf(0), x2: 195, y2: nOf(0), class: 'axis', style: sw(2.2),
  }));
  sectionSvg.appendChild(el('text', {
    x: 193, y: nOf(0) + 18/sf, class: 'label', 'text-anchor': 'end', style: fs(11),
  }, 'keel'));

  // Deck reference (n = 1).
  sectionSvg.appendChild(el('line', {
    x1: -195, y1: nOf(1), x2: 195, y2: nOf(1), class: 'axis deck-axis', style: sw(2.2),
  }));
  sectionSvg.appendChild(el('text', {
    x: 193, y: nOf(1) - 6/sf, class: 'label', 'text-anchor': 'end', style: fs(11),
  }, 'deck'));

  // Closed-loop section — same Bezier sampler buildLoft uses.
  const dense = sampleSection(station.points, 256);
  const stbdPath = 'M ' + dense.map(p => `${bOf( p.b).toFixed(2)} ${nOf(p.n).toFixed(2)}`).join(' L ');
  const portPath = 'M ' + dense.map(p => `${bOf(-p.b).toFixed(2)} ${nOf(p.n).toFixed(2)}`).join(' L ');
  sectionSvg.appendChild(el('path', { class: 'section-curve',  d: stbdPath, style: sw(2.5) }));
  sectionSvg.appendChild(el('path', { class: 'section-mirror', d: portPath, style: sw(1.5) }));

  // Tangent handles (drawn first so they sit underneath the knot circles).
  deriveSectionHandles(station.points);
  station.points.forEach((p, i) => {
    const h = sectionKnotHandles(p);
    if (i > 0) {
      const ax = bOf(h.aft.b), ay = nOf(h.aft.n);
      sectionSvg.appendChild(el('line', {
        x1: bOf(p.b), y1: nOf(p.n), x2: ax, y2: ay,
        class: 'section-handle-line', style: sw(1.4),
      }));
      sectionSvg.appendChild(el('circle', {
        cx: ax, cy: ay, r: 14/sf, class: 'handle-hit',
        'data-drag': 'ctrl-aft', 'data-idx': String(i),
      }));
      sectionSvg.appendChild(el('circle', {
        cx: ax, cy: ay, r: 5/sf, class: 'section-handle',
        style: sw(1.4),
        'data-drag': 'ctrl-aft', 'data-idx': String(i),
      }));
    }
    if (i < lastIdx) {
      const fx = bOf(h.fore.b), fy = nOf(h.fore.n);
      sectionSvg.appendChild(el('line', {
        x1: bOf(p.b), y1: nOf(p.n), x2: fx, y2: fy,
        class: 'section-handle-line', style: sw(1.4),
      }));
      sectionSvg.appendChild(el('circle', {
        cx: fx, cy: fy, r: 14/sf, class: 'handle-hit',
        'data-drag': 'ctrl-fore', 'data-idx': String(i),
      }));
      sectionSvg.appendChild(el('circle', {
        cx: fx, cy: fy, r: 5/sf, class: 'section-handle',
        style: sw(1.4),
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
      cx: bOf(p.b), cy: nOf(p.n), r: 22/sf,
      class: ('ctrl-hit ' + cls).trim(),
      'data-drag': 'ctrl', 'data-idx': String(i),
    }));
    sectionSvg.appendChild(el('circle', {
      cx: bOf(p.b), cy: nOf(p.n), r: 9/sf,
      class: ('ctrl-pt ' + cls + (p.chine ? 'chine' : '')).trim(),
      style: sw(2),
      'data-drag': 'ctrl', 'data-idx': String(i),
    }));
  });

  if (station.points.length <= 5) {
    sectionSvg.appendChild(el('text', {
      x: 0, y: SECTION_VB_PAD_BOT - 13/sf, class: 'label',
      'text-anchor': 'middle', style: fs(10),
    }, 'click · right-click to delete'));
  }
  // Axis badge is a static HTML SVG pinned to the pane corner (see index.html).
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
// Insert a station at arc-length fraction s ∈ (0, 1).  Shape is seeded from
// sectionAtS() so the loft is unchanged at the moment of insertion (modulo
// the small re-interpolation drift from the new station appearing in the
// b/n spline base).  Returns true if inserted, false if too close to a tip
// or an existing station.
function addStationAtS(s) {
  if (state.stations.length >= MAX_INTERIOR) return false;
  if (s < 0.02 || s > 0.98) return false;
  const minGap = 0.015;
  for (const st of state.stations) {
    if (Math.abs(st.s - s) < minGap) return false;
  }
  const points = sectionAtS(state, s, 7);
  state.stations.sort((a, b) => a.s - b.s);
  let insertIdx = state.stations.findIndex(st => st.s > s);
  if (insertIdx === -1) insertIdx = state.stations.length;
  state.stations.splice(insertIdx, 0, { s, points });
  state.selectedStation = insertIdx;
  stationLabel.textContent = stationLabelFor(state.selectedStation);
  rebuildHull();
  renderStationList();
  renderSideView();
  renderTopView();
  renderSectionView();
  syncStationButtons();
  return true;
}

function addStation() {
  // Insert at the midpoint of the largest gap in s-space.
  const sortedSs = [0, ...state.stations.map(st => st.s).sort((a, b) => a - b), 1];
  let maxGap = 0, gapStart = 0;
  for (let i = 0; i < sortedSs.length - 1; i++) {
    const g = sortedSs[i + 1] - sortedSs[i];
    if (g > maxGap) { maxGap = g; gapStart = sortedSs[i]; }
  }
  addStationAtS(gapStart + maxGap / 2);
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

// ── Render Mode ─────────────────────────────────────────────────────────
//
// Four modes:
//   shaded   — physical lighting (hullMaterial) with inside/outside colours
//   normals  — world-space normal vectors as colour (curvature check)
//   matcap   — procedural matcap sphere texture, user picks base + highlight
//   checker  — world-space cubic checkerboard, user picks square size + 2 colours
//
// matcap + checker are "textured" curvature-inspection modes.  The matcap
// texture is a procedurally-generated CanvasTexture regenerated whenever
// the user picks new colours.  The checker uses the standard PBR material
// with onBeforeCompile injecting world-position-driven checker colours
// into the diffuseColor — so it still gets lit nicely while the pattern
// reveals deformation/curvature.

const renderModeSel    = document.getElementById('render-mode');
const matcapBaseEl     = document.getElementById('matcap-base');
const matcapHiEl       = document.getElementById('matcap-highlight');
const checkerSizeEl    = document.getElementById('checker-size');
const checkerSizeOut   = document.getElementById('checker-size-out');
const checkerLightEl   = document.getElementById('checker-light');
const checkerDarkEl    = document.getElementById('checker-dark');

const normalMaterial   = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

// ── Matcap (procedural sphere texture) ──────────────────────────────────
const matcapTexture = (() => {
  const tex = new THREE.CanvasTexture(document.createElement('canvas'));
  tex.colorSpace = THREE.SRGBColorSpace ?? THREE.sRGBEncoding;
  return tex;
})();
function rebuildMatcapTexture() {
  const size = 256;
  const c = matcapTexture.image;
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  // Sphere — vertical gradient top→bottom (highlight at top, base at middle, dark at base).
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, state.render.matcap.highlight);
  grad.addColorStop(0.55, state.render.matcap.base);
  grad.addColorStop(1.0, '#0a0a0a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  // Small specular highlight upper-left.
  const spec = ctx.createRadialGradient(size * 0.35, size * 0.3, 2, size * 0.35, size * 0.3, size * 0.32);
  spec.addColorStop(0, 'rgba(255,255,255,0.55)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = spec;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  matcapTexture.needsUpdate = true;
}
const matcapMaterial = new THREE.MeshMatcapMaterial({
  matcap: matcapTexture, side: THREE.DoubleSide,
});

// ── Checker (shader injection on a PBR material) ────────────────────────
const checkerUniforms = {
  uCheckSize:  { value: 0.10 },
  uCheckLight: { value: new THREE.Color('#f1f5f9') },
  uCheckDark:  { value: new THREE.Color('#1f2937') },
};
const checkerMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff, side: THREE.DoubleSide,
  metalness: 0.0, roughness: 0.65,
});
checkerMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uCheckSize  = checkerUniforms.uCheckSize;
  shader.uniforms.uCheckLight = checkerUniforms.uCheckLight;
  shader.uniforms.uCheckDark  = checkerUniforms.uCheckDark;
  shader.vertexShader =
    'varying vec3 vCheckPos;\n' +
    shader.vertexShader.replace(
      '#include <fog_vertex>',
      '#include <fog_vertex>\nvCheckPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );
  shader.fragmentShader =
    'varying vec3 vCheckPos;\n' +
    'uniform float uCheckSize;\n' +
    'uniform vec3 uCheckLight;\n' +
    'uniform vec3 uCheckDark;\n' +
    shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n' +
      'float chk = mod(floor(vCheckPos.x / uCheckSize) + ' +
                    'floor(vCheckPos.y / uCheckSize) + ' +
                    'floor(vCheckPos.z / uCheckSize), 2.0);\n' +
      'diffuseColor.rgb = mix(uCheckLight, uCheckDark, chk);'
    );
};

// ── Apply + sync ────────────────────────────────────────────────────────
function applyRenderMode() {
  const mode = state.render.mode;
  let mat;
  if      (mode === 'normals') mat = normalMaterial;
  else if (mode === 'matcap')  mat = matcapMaterial;
  else if (mode === 'checker') mat = checkerMaterial;
  else                          mat = hullMaterial;
  hullGroup.children.forEach(mesh => { if (mesh.isMesh) mesh.material = mat; });
  // Show only the option block matching the current mode.
  document.querySelectorAll('.render-mode-opts').forEach(div => {
    div.style.display = (div.dataset.renderMode === mode) ? '' : 'none';
  });
}
function applyMatcap() {
  rebuildMatcapTexture();
}
function applyChecker() {
  checkerUniforms.uCheckSize.value = state.render.checker.size;
  checkerUniforms.uCheckLight.value.set(state.render.checker.light);
  checkerUniforms.uCheckDark .value.set(state.render.checker.dark);
  checkerSizeOut.textContent = (state.render.checker.size * 100).toFixed(0) + ' cm';
}
function syncRenderInputsFromState() {
  renderModeSel.value   = state.render.mode;
  matcapBaseEl.value    = state.render.matcap.base;
  matcapHiEl.value      = state.render.matcap.highlight;
  checkerSizeEl.value   = String(state.render.checker.size);
  checkerLightEl.value  = state.render.checker.light;
  checkerDarkEl.value   = state.render.checker.dark;
}

renderModeSel.addEventListener('change', () => {
  state.render.mode = renderModeSel.value;
  applyRenderMode();
});
matcapBaseEl.addEventListener('input', () => {
  state.render.matcap.base = matcapBaseEl.value; applyMatcap();
});
matcapHiEl.addEventListener('input', () => {
  state.render.matcap.highlight = matcapHiEl.value; applyMatcap();
});
checkerSizeEl.addEventListener('input', () => {
  state.render.checker.size = parseFloat(checkerSizeEl.value); applyChecker();
});
checkerLightEl.addEventListener('input', () => {
  state.render.checker.light = checkerLightEl.value; applyChecker();
});
checkerDarkEl.addEventListener('input', () => {
  state.render.checker.dark = checkerDarkEl.value; applyChecker();
});

// Initial: push defaults into UI, build the matcap, set checker uniforms, apply.
syncRenderInputsFromState();
applyMatcap();
applyChecker();
applyRenderMode();

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
  const isBackground = e.button === 0 && !e.target.closest('[data-drag]') && !e.target.closest('[data-scale-axis]') && !e.target.closest('[data-drag-action]');
  if (!isMiddle && !isBackground) return;
  e.preventDefault();
  e.stopPropagation();
  topPanDrag = { startX: e.clientX, startY: e.clientY, startOffX: topVP.offX, startOffY: topVP.offY };
  topSvg.setPointerCapture(e.pointerId);
}, true);

topSvg.addEventListener('pointermove', (e) => {
  if (!topPanDrag || scaleDrag) return;
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
  // Click on the station-add line (only when stations layer is active)?
  if (e.target.closest('[data-drag-action="add-station"]')) {
    if (!state.layers.top.stations) return;
    const spS = sampledSpine(state.spine.knots, 64);
    addStationAtS(spineXToS(spS, wx));
    return;
  }
  if (!state.layers.top.beam) return; // beam layer off → no click-to-add
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

// Scale around the hull centre so the gizmo doesn't translate the hull.
// Also: handles are stored as (angle, aftLen, foreLen) — under a non-uniform
// scale by r along one world axis only, the handle's component along that
// axis scales by r while the perpendicular component stays the same.  The
// equivalent (new angle, new length) is computed below.  C1 continuity is
// preserved because aft and fore share the same angle/factor transform.
//
//   For an X-only scale by r:
//     handle direction (cos a, sin a) → (cos a · r, sin a)
//     new angle = atan2(sin a, cos a · r)
//     length factor = sqrt((cos a · r)² + sin² a)
//
//   For a Z-only scale by r:
//     handle direction (cos a, sin a) → (cos a, sin a · r)
//     new angle = atan2(sin a · r, cos a)
//     length factor = sqrt(cos² a + (sin a · r)²)
//
function _scaleSpineKnotX(k, r, cx) {
  k.x = cx + (k.x - cx) * r;
  const ca = Math.cos(k.angle), sa = Math.sin(k.angle);
  const f = Math.hypot(ca * r, sa);
  k.angle  = Math.atan2(sa, ca * r);
  k.aftLen  *= f;
  k.foreLen *= f;
}
function _scaleSpineKnotZ(k, r, cz) {
  k.z = cz + (k.z - cz) * r;
  const ca = Math.cos(k.angle), sa = Math.sin(k.angle);
  const f = Math.hypot(ca, sa * r);
  k.angle  = Math.atan2(sa * r, ca);
  k.aftLen  *= f;
  k.foreLen *= f;
}

function applyScaleX(r) {
  if (!(r > 0) || !isFinite(r)) return;
  const knots = state.spine.knots;
  const cx = (knots[0].x + knots[knots.length - 1].x) / 2;
  knots.forEach(k => _scaleSpineKnotX(k, r, cx));
  state.deckLine.knots.forEach(k => _scaleSpineKnotX(k, r, cx));
  // Beam line — peaks have x positions; sternHandle/bowHandle store dx as
  // an X offset from the stern/bow knot, so just scale the delta by r.
  const bl = state.beamLine;
  bl.sternHandle.dx *= r;
  bl.bowHandle.dx   *= r;
  bl.peaks.forEach(pk => { pk.x = cx + (pk.x - cx) * r; pk.hdx *= r; });
  state.length *= r;
  lengthEl.value        = state.length.toFixed(2);
  lengthOut.textContent = fmtLength(state.length);
}

function applyScaleY(r) {
  if (!(r > 0) || !isFinite(r)) return;
  // The hull is mirrored across y=0 (port = -stbd), so the hull's Y centre
  // is literally the world Y=0.  Direct multiplication is the correct
  // around-centre scale.
  const bl = state.beamLine;
  bl.sternHandle.dy *= r;
  bl.bowHandle.dy   *= r;
  bl.peaks.forEach(pk => { pk.y *= r; pk.hdy *= r; });
}

function applyScaleZ(r) {
  if (!(r > 0) || !isFinite(r)) return;
  const sp = state.spine.knots, dk = state.deckLine.knots;
  const allZ = [...sp.map(k => k.z), ...dk.map(k => k.z)];
  const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;
  sp.forEach(k => _scaleSpineKnotZ(k, r, cz));
  dk.forEach(k => _scaleSpineKnotZ(k, r, cz));
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
function attachScaleGizmoPointer(svg, view) {
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (state.layers[view] && !state.layers[view].gizmo) return;
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

attachScaleGizmoPointer(sideSvg, 'side');
attachScaleGizmoPointer(topSvg, 'top');
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
  const isBackground = e.button === 0 && !e.target.closest('[data-drag]') && !e.target.closest('[data-scale-axis]') && !e.target.closest('[data-drag-action]');
  if (!isMiddle && !isBackground) return;
  e.preventDefault();
  e.stopPropagation();
  sidePanDrag = { startX: e.clientX, startY: e.clientY, startOffX: sideVP.offX, startOffY: sideVP.offY };
  sideSvg.setPointerCapture(e.pointerId);
}, true);

sideSvg.addEventListener('pointermove', (e) => {
  if (!sidePanDrag || scaleDrag) return;
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

const refEditorModal = document.getElementById('ref-editor-modal');
const refEditorCanvas = document.getElementById('ref-editor-canvas');
const refEditorCtx = refEditorCanvas.getContext('2d');
const refRotSlider = document.getElementById('ref-rot');
const refRotOut = document.getElementById('ref-rot-out');
const refEditorApply = document.getElementById('ref-editor-apply');
const refEditorCancel = document.getElementById('ref-editor-cancel');
const refCropBox = document.getElementById('ref-crop-box');
const refCanvasContainer = document.getElementById('ref-canvas-container');

let refEditorImg = null;
let refEditorViewKey = null;
let refEditorRenderFn = null;
let refRot = 0;

function openRefEditor(img, viewKey, renderFn) {
  refEditorImg = img;
  refEditorViewKey = viewKey;
  refEditorRenderFn = renderFn;
  refEditorModal.showModal();
}

const refSvg = document.getElementById('ref-editor-svg');
const refAlignLine = document.getElementById('ref-align-line');

let refP1_native = { x: 0, y: 0 };
let refP2_native = { x: 0, y: 0 };

function updateRefOverlay() {
  document.getElementById('ref-p1-group').setAttribute('transform', `translate(${refP1_native.x}, ${refP1_native.y})`);
  document.getElementById('ref-p2-group').setAttribute('transform', `translate(${refP2_native.x}, ${refP2_native.y})`);
  refAlignLine.setAttribute('x1', refP1_native.x);
  refAlignLine.setAttribute('y1', refP1_native.y);
  refAlignLine.setAttribute('x2', refP2_native.x);
  refAlignLine.setAttribute('y2', refP2_native.y);
}

function drawRefCanvas() {
  if (!refEditorImg) return;
  const w = refEditorImg.naturalWidth;
  const h = refEditorImg.naturalHeight;
  const MAX_SIZE = 600;
  
  const flipH = document.getElementById('ref-flip-h').checked;
  const flipV = document.getElementById('ref-flip-v').checked;
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  
  if (refEditorViewKey === 'sideRef') {
    refSvg.style.display = 'none';
    refCropBox.style.display = 'block';
    document.getElementById('ref-editor-controls').style.display = 'flex';
    
    const rad = refRot * Math.PI / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const cw = w * cos + h * sin;
    const ch = w * sin + h * cos;
    
    let scale = 1;
    if (cw > MAX_SIZE || ch > MAX_SIZE) {
      scale = MAX_SIZE / Math.max(cw, ch);
    }
    
    refEditorCanvas.width = cw * scale;
    refEditorCanvas.height = ch * scale;
    refCanvasContainer.style.width = refEditorCanvas.width + 'px';
    refCanvasContainer.style.height = refEditorCanvas.height + 'px';
    
    refEditorCtx.save();
    refEditorCtx.translate(refEditorCanvas.width / 2, refEditorCanvas.height / 2);
    refEditorCtx.rotate(rad);
    refEditorCtx.scale(scale * sx, scale * sy);
    refEditorCtx.drawImage(refEditorImg, -w/2, -h/2);
    refEditorCtx.restore();
  } else {
    refSvg.style.display = 'block';
    refCropBox.style.display = 'none';
    document.getElementById('ref-editor-controls').style.display = 'none';

    let scale = 1;
    if (w > MAX_SIZE || h > MAX_SIZE) {
      scale = MAX_SIZE / Math.max(w, h);
    }
    
    refEditorCanvas.width = w * scale;
    refEditorCanvas.height = h * scale;
    refCanvasContainer.style.width = refEditorCanvas.width + 'px';
    refCanvasContainer.style.height = refEditorCanvas.height + 'px';
    
    refEditorCtx.save();
    refEditorCtx.translate(refEditorCanvas.width / 2, refEditorCanvas.height / 2);
    refEditorCtx.scale(scale * sx, scale * sy);
    refEditorCtx.drawImage(refEditorImg, -w/2, -h/2);
    refEditorCtx.restore();

    refSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    
    const isf = 1 / scale;
    document.getElementById('ref-p1').setAttribute('r', 8 * isf);
    document.getElementById('ref-p2').setAttribute('r', 8 * isf);
    document.getElementById('ref-p1').setAttribute('stroke-width', 2 * isf);
    document.getElementById('ref-p2').setAttribute('stroke-width', 2 * isf);
    document.getElementById('ref-p1-label').setAttribute('font-size', 14 * isf);
    document.getElementById('ref-p2-label').setAttribute('font-size', 14 * isf);
    document.getElementById('ref-p1-label').setAttribute('x', 14 * isf);
    document.getElementById('ref-p2-label').setAttribute('x', 14 * isf);
    refAlignLine.setAttribute('stroke-width', 2 * isf);

    updateRefOverlay();
  }
}

refRotSlider.addEventListener('input', () => {
  refRot = parseFloat(refRotSlider.value);
  refRotOut.textContent = refRot.toFixed(1) + '°';
  drawRefCanvas();
});
document.getElementById('ref-flip-h').addEventListener('change', drawRefCanvas);
document.getElementById('ref-flip-v').addEventListener('change', drawRefCanvas);

let cropDrag = null;
refCropBox.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const dir = e.target.dataset.dir || 'move';
  const bounds = refCanvasContainer.getBoundingClientRect();
  const cropBounds = refCropBox.getBoundingClientRect();
  cropDrag = {
    dir,
    startX: e.clientX,
    startY: e.clientY,
    origL: cropBounds.left - bounds.left,
    origT: cropBounds.top - bounds.top,
    origW: cropBounds.width,
    origH: cropBounds.height,
  };
});
window.addEventListener('pointermove', (e) => {
  if (!cropDrag) return;
  e.preventDefault();
  const dx = e.clientX - cropDrag.startX;
  const dy = e.clientY - cropDrag.startY;
  let { origL: l, origT: t, origW: w, origH: h } = cropDrag;
  
  const contW = refEditorCanvas.width;
  const contH = refEditorCanvas.height;

  if (cropDrag.dir === 'move') {
    l = Math.max(0, Math.min(contW - w, l + dx));
    t = Math.max(0, Math.min(contH - h, t + dy));
  } else {
    if (cropDrag.dir.includes('e')) { w = Math.min(contW - l, Math.max(20, w + dx)); }
    if (cropDrag.dir.includes('s')) { h = Math.min(contH - t, Math.max(20, h + dy)); }
    if (cropDrag.dir.includes('w')) {
      const maxDx = w - 20;
      const actDx = Math.min(maxDx, Math.max(-l, dx));
      l += actDx; w -= actDx;
    }
    if (cropDrag.dir.includes('n')) {
      const maxDy = h - 20;
      const actDy = Math.min(maxDy, Math.max(-t, dy));
      t += actDy; h -= actDy;
    }
  }
  
  refCropBox.style.left = (l / contW * 100) + '%';
  refCropBox.style.top = (t / contH * 100) + '%';
  refCropBox.style.width = (w / contW * 100) + '%';
  refCropBox.style.height = (h / contH * 100) + '%';
});
window.addEventListener('pointerup', () => { cropDrag = null; });
window.addEventListener('pointercancel', () => { cropDrag = null; });

refEditorCancel.addEventListener('click', () => {
  refEditorModal.close();
});

let refDragHandle = null;
refSvg.addEventListener('pointerdown', (e) => {
  const g = e.target.closest('g');
  if (g && g.id === 'ref-p1-group') refDragHandle = 'p1';
  else if (g && g.id === 'ref-p2-group') refDragHandle = 'p2';
  if (refDragHandle) {
    e.preventDefault();
    refSvg.setPointerCapture(e.pointerId);
  }
});

refSvg.addEventListener('pointermove', (e) => {
  if (!refDragHandle) return;
  e.preventDefault();
  const pt = refSvg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const loc = pt.matrixTransform(refSvg.getScreenCTM().inverse());
  if (refDragHandle === 'p1') { refP1_native.x = loc.x; refP1_native.y = loc.y; }
  if (refDragHandle === 'p2') { refP2_native.x = loc.x; refP2_native.y = loc.y; }
  updateRefOverlay();
});

refSvg.addEventListener('pointerup', () => { refDragHandle = null; });
refSvg.addEventListener('pointercancel', () => { refDragHandle = null; });

refEditorApply.addEventListener('click', () => {
  const r = state[refEditorViewKey];
  
  if (refEditorViewKey === 'sideRef') {
    const cropL = parseFloat(refCropBox.style.left) / 100 || 0.1;
    const cropT = parseFloat(refCropBox.style.top) / 100 || 0.1;
    const cropW = parseFloat(refCropBox.style.width) / 100 || 0.8;
    const cropH = parseFloat(refCropBox.style.height) / 100 || 0.8;
    
    const sx = cropL * refEditorCanvas.width;
    const sy = cropT * refEditorCanvas.height;
    const sw = cropW * refEditorCanvas.width;
    const sh = cropH * refEditorCanvas.height;
    
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(refEditorCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    
    r.url = cropCanvas.toDataURL('image/png');
    r.nativeAspect = sw / sh;
    
    const spKnots = state.spine.knots;
    const sternX = spKnots[0].x, bowX = spKnots[spKnots.length - 1].x;
    const hullLen = bowX - sternX;
    
    const dkPts = sampledSpine(state.deckLine.knots, 16).pts;
    const maxZ = Math.max(...dkPts.map(p => p.y));
    const minZ = Math.min(...spKnots.map(k => k.z));
    r.worldW = hullLen;
    r.worldH = maxZ - minZ;
    if (hullLen / r.worldH > r.nativeAspect) {
      r.worldH = hullLen / r.nativeAspect;
    } else {
      r.worldW = r.worldH * r.nativeAspect;
    }
    r.worldX = sternX;
    r.worldZ = maxZ;
  } else {
    const flipH = document.getElementById('ref-flip-h').checked;
    const flipV = document.getElementById('ref-flip-v').checked;
    
    if (flipH || flipV) {
      const tmp = document.createElement('canvas');
      tmp.width = refEditorImg.naturalWidth;
      tmp.height = refEditorImg.naturalHeight;
      const tctx = tmp.getContext('2d');
      tctx.translate(flipH ? tmp.width : 0, flipV ? tmp.height : 0);
      tctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tctx.drawImage(refEditorImg, 0, 0);
      r.url = tmp.toDataURL('image/png');
    } else {
      r.url = refEditorImg.src;
    }
    
    r.nativeW = refEditorImg.naturalWidth;
    r.nativeH = refEditorImg.naturalHeight;
    r.p1 = { x: refP1_native.x, y: refP1_native.y };
    r.p2 = { x: refP2_native.x, y: refP2_native.y };
    
    if (refEditorViewKey === 'topRef') {
      const sK = state.spine.knots;
      r.worldT1 = { x: 0, y: sK[0].x };
      r.worldT2 = { x: 0, y: sK[sK.length - 1].x };
    } else if (refEditorViewKey === 'sectionRef') {
      const spKnots = state.spine.knots;
      const dkPts = sampledSpine(state.deckLine.knots, 16).pts;
      const maxZ = Math.max(...dkPts.map(p => p.y));
      const minZ = Math.min(...spKnots.map(k => k.z));
      r.worldT1 = { x: 0, y: minZ };
      r.worldT2 = { x: 0, y: maxZ };
    }
  }
  
  refEditorModal.close();
  if (refEditorRenderFn) refEditorRenderFn();
});

function wireRefImage(viewKey, fileId, opacityId, opacityOutId, clearId, renderFn) {
  const refState = () => state[viewKey] || (state[viewKey] = { url: null, opacity: 0.3 });
  const fmtPct = v => Math.round(v * 100) + '%';

  document.getElementById(fileId).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        
        document.getElementById('ref-flip-h').checked = false;
        document.getElementById('ref-flip-v').checked = false;
        
        // Load existing points if available, else default
        const r = refState();
        if (r.p1 && r.p2) {
            refP1_native = { ...r.p1 };
            refP2_native = { ...r.p2 };
        } else {
            if (viewKey === 'sectionRef') {
                refP1_native = { x: w / 2, y: h * 0.9 }; // Bottom
                refP2_native = { x: w / 2, y: h * 0.1 }; // Top
            } else if (viewKey === 'topRef') {
                refP1_native = { x: w / 2, y: h * 0.9 }; // Stern (bottom)
                refP2_native = { x: w / 2, y: h * 0.1 }; // Bow (top)
            } else {
                refP1_native = { x: w * 0.1, y: h / 2 }; // Stern (left)
                refP2_native = { x: w * 0.9, y: h / 2 }; // Bow (right)
            }
        }
        
        const helpP = document.getElementById('ref-editor-help');
        if (viewKey === 'sideRef') {
            refRotSlider.value = 0;
            refRot = 0;
            refRotOut.textContent = '0°';
            refCropBox.style.left = '10%';
            refCropBox.style.top = '10%';
            refCropBox.style.width = '80%';
            refCropBox.style.height = '80%';
            helpP.textContent = "Rotate the image and drag the crop box to tightly enclose the hull in this view.";
        } else {
            if (viewKey === 'sectionRef') {
                document.getElementById('ref-p1-label').textContent = 'Keel';
                document.getElementById('ref-p2-label').textContent = 'Deck';
                helpP.textContent = "Align the Keel (bottom) and Deck (top) points.";
            } else {
                document.getElementById('ref-p1-label').textContent = 'Stern';
                document.getElementById('ref-p2-label').textContent = 'Bow';
                helpP.textContent = "Align the Stern (rear) and Bow (front) points.";
            }
        }
        
        openRefEditor(img, viewKey, renderFn);
        drawRefCanvas();
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
  // Ensure state has the section
  const s = refState();
  if (s.opacity === undefined) s.opacity = 0.3;
  opOut.textContent = fmtPct(s.opacity);

  document.getElementById(clearId).addEventListener('click', () => {
    refState().url = null;
    renderFn();
  });
}

wireRefImage('sideRef', 'side-ref-file', 'side-ref-opacity', 'side-ref-opacity-out', 'side-ref-clear', renderSideView);
wireRefImage('topRef',  'top-ref-file',  'top-ref-opacity',  'top-ref-opacity-out',  'top-ref-clear',  renderTopView);
wireRefImage('sectionRef', 'section-ref-file', 'section-ref-opacity', 'section-ref-opacity-out', 'section-ref-clear', renderSectionView);

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

// ── Per-view layer toggles ──────────────────────────────────────────────
//
// One small ≡ chip per view (in the pane title) opens a popover with a
// checkbox per layer.  Each layer carries a small coloured dot keyed to
// the layer's identity (consistent across all views: blue=keel/rocker,
// green=deck, teal=beam, purple=stations, neutral=ref-image, amber=gizmo,
// dark=section curve).  Toggling a layer:
//   - Sets data-layer-X="off|on" on the corresponding SVG (CSS does the
//     greying + pointer-events lock automatically).
//   - Persists to state.layers.
//   - Suppresses click-to-add via state-check in the click handlers.

const LAYER_DEFS = {
  side: [
    { id: 'keel',     label: 'Rocker (keel)', color: '#2563eb' },
    { id: 'deck',     label: 'Deck line',     color: '#16a34a' },
    { id: 'stations', label: 'Stations',      color: '#7c3aed' },
    { id: 'refImage', label: 'Reference image', color: '#94a3b8' },
    { id: 'gizmo',    label: 'Scale gizmo',   color: '#f59e0b' },
  ],
  top: [
    { id: 'beam',     label: 'Beam line',     color: '#0891b2' },
    { id: 'stations', label: 'Stations',      color: '#7c3aed' },
    { id: 'refImage', label: 'Reference image', color: '#94a3b8' },
    { id: 'gizmo',    label: 'Scale gizmo',   color: '#f59e0b' },
  ],
  section: [
    { id: 'controls', label: 'Section curve', color: '#1f2937' },
    { id: 'refImage', label: 'Reference image', color: '#94a3b8' },
  ],
};

const VIEW_SVG_ID = { side: 'side-view', top: 'top-view', section: 'section-view' };

function applyLayerStateToSVG(view) {
  const svg = document.getElementById(VIEW_SVG_ID[view]);
  if (!svg) return;
  const layers = state.layers[view] || {};
  for (const def of LAYER_DEFS[view]) {
    svg.dataset['layer' + def.id[0].toUpperCase() + def.id.slice(1)] = layers[def.id] ? 'on' : 'off';
  }
}
function applyAllLayerStates() {
  Object.keys(LAYER_DEFS).forEach(applyLayerStateToSVG);
}

// Build (or rebuild) the popover for a view.
function buildLayerPopover(view) {
  let pop = document.getElementById('layers-pop-' + view);
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'layers-pop-' + view;
    pop.className = 'layers-popover';
    document.body.appendChild(pop);
  }
  pop.innerHTML = '';
  for (const def of LAYER_DEFS[view]) {
    const on = !!state.layers[view][def.id];
    const row = document.createElement('label');
    row.className = 'layer-row' + (on ? '' : ' off');
    row.innerHTML =
      `<span class="layer-dot" style="background:${def.color}"></span>` +
      `<span class="layer-name">${def.label}</span>` +
      `<input type="checkbox" ${on ? 'checked' : ''}>`;
    const cb = row.querySelector('input');
    cb.addEventListener('change', () => {
      state.layers[view][def.id] = cb.checked;
      row.classList.toggle('off', !cb.checked);
      applyLayerStateToSVG(view);
    });
    pop.appendChild(row);
  }
  return pop;
}

// Wire up the ≡ button on each pane.  Click toggles its popover; clicks
// outside any popover close all of them.
function positionPopover(pop, btn) {
  const r = btn.getBoundingClientRect();
  pop.style.top  = (r.bottom + 4) + 'px';
  pop.style.left = Math.max(8, r.right - 175) + 'px';
}
document.querySelectorAll('.layers-btn').forEach(btn => {
  const view = btn.dataset.layersView;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = buildLayerPopover(view);
    const isOpen = pop.classList.contains('open');
    document.querySelectorAll('.layers-popover.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.layers-btn.open').forEach(b => b.classList.remove('open'));
    if (!isOpen) {
      positionPopover(pop, btn);
      pop.classList.add('open');
      btn.classList.add('open');
    }
  });
});
document.addEventListener('click', (e) => {
  if (e.target.closest('.layers-btn') || e.target.closest('.layers-popover')) return;
  document.querySelectorAll('.layers-popover.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.layers-btn.open').forEach(b => b.classList.remove('open'));
});

// Initial: apply state to all SVGs.  (Re-applied by syncUIFromState too.)
applyAllLayerStates();
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
  // Colors push into inputs and Three.js
  syncColorInputsFromState();
  applyColors();
  // Render mode + matcap + checker
  syncRenderInputsFromState();
  applyMatcap();
  applyChecker();
  applyRenderMode();
  // Key light — already aliased into state, just re-apply.
  applyKeyLightPosition();
  // Pane resizer percentages + drawer state
  applyLayoutFromState();
  // Per-view layer toggles
  if (typeof applyAllLayerStates === 'function') applyAllLayerStates();
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
  // Click on the station-add line (only when stations layer is active)?
  if (e.target.closest('[data-drag-action="add-station"]')) {
    if (!state.layers.side.stations) return;
    const spS = sampledSpine(state.spine.knots, 64);
    addStationAtS(spineXToS(spS, wx));
    return;
  }

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
  // Suppress click-to-add when the relevant layer is off.
  const keelOn = !!state.layers.side.keel;
  const deckOn = !!state.layers.side.deck;
  if (keelOn && rDist <= THRESH && rDist <= dDist) {
    insertKnot(state.spine.knots, rSeg, rT);
    rebuildHull(); renderSideView(); renderTopView(); renderSectionView();
  } else if (deckOn && dDist <= THRESH && dDist < rDist) {
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
  if (sectionPanMoved) { sectionPanMoved = false; return; }
  if (!state.layers.section.controls) return; // section curve layer off
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
let sectionPanMoved = false; // suppresses click-to-add after a pan drag
sectionSvg.addEventListener('pointerdown', (e) => {
  const isMiddle = e.button === 1;
  const isBackground = e.button === 0 && !e.target.closest('[data-drag]') && !e.target.closest('[data-scale-axis]');
  if (!isMiddle && !isBackground) return;
  e.preventDefault(); e.stopPropagation();
  sectionPanMoved = false;
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
  sectionPanMoved = true;
  renderSectionView();
}, true);
sectionSvg.addEventListener('pointerup',     () => { sectionPanDrag = null; }, true);
sectionSvg.addEventListener('pointercancel', () => { sectionPanDrag = null; sectionPanMoved = false; }, true);

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

syncUIFromState();
renderStationList();

// Ensure panes are properly laid out before initial render.
// SVG elements with `flex: 1` and no intrinsic height report 0×0 from
// getBoundingClientRect() until the browser paints — but their parent
// pane containers get sized by the CSS grid layout.  The ResizeObserver
// fires at exactly that moment, so we use it as the primary trigger.
let initialRenderDone = false;
function doInitialRender() {
  if (initialRenderDone) return;
  // Check *parent* containers, not the SVGs themselves.
  const allReady = [sideSvg, topSvg, sectionSvg].every(svg => {
    const p = svg.parentElement;
    return p && p.clientWidth > 10 && p.clientHeight > 10;
  });
  if (allReady) {
    initialRenderDone = true;
    sideFit = null; topFit = null;
    renderSideView();
    renderTopView();
    renderSectionView();
  }
}

window.addEventListener('resize', () => { 
  sideFit = null; topFit = null; 
  if (initialRenderDone) {
    renderTopView(); renderSideView(); renderSectionView();
  }
});

const paneResizeObserver = new ResizeObserver(() => {
  if (!initialRenderDone) {
    // First resize event — the grid just laid out the panes.
    doInitialRender();
    return;
  }
  sideFit = null; topFit = null;
  renderSideView(); renderTopView(); renderSectionView();
});
paneResizeObserver.observe(sideSvg.parentElement);
paneResizeObserver.observe(topSvg.parentElement);
paneResizeObserver.observe(sectionSvg.parentElement);

// Fallback: poll on every animation frame until the parents are sized
// and doInitialRender succeeds.  Without this, if the ResizeObserver's
// first callback fires before layout settles (parents still 0×0), no
// further size change ever triggers it and the 2D views stay blank.
(function retryInit() {
  if (initialRenderDone) return;
  doInitialRender();
  if (!initialRenderDone) requestAnimationFrame(retryInit);
})();
