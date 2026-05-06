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

const DEFAULT_DECK_N = 0.30; // default deck-top height above keel, metres

// ── State ────────────────────────────────────────────────────────────────

const state = {
  length: 5.2,
  loftRes: 'med',
  selectedStation: 2,   // index into the unified station list (interior + sheer)
  spine: spinePlaceholder(5.2),
  // Interior stations only — closed-loop cross-sections perpendicular to the rocker.
  stations: stationsPlaceholder(),
  // Sheer profiles at the bow and stern. Each defines a curve in (dx, dz)
  // offsets relative to rocker(startS), forming the side-view profile of
  // the bow/stern stem. Sheer stations are closed-loop cross-sections placed
  // along the sheer profile (perpendicular to the sheer at that point), so
  // the loft passes through them just like interior stations on the rocker.
  bowSheer:   defaultSheer('bow'),
  sternSheer: defaultSheer('stern'),
  // Deck line — an explicit natural-cubic spline in world (X, Z) defining
  // the top edge of the hull. Its endpoints are locked to the tips of the
  // bow and stern sheer profiles; interior control points are freely
  // draggable. Each station's deck-end n is derived from this line, so
  // moving the deck line reshapes every station's top at once.
  deckLine: defaultDeckLine(),
  // Loft mesh overlay in side view
  showLoftMesh: true,
  meshOpacity: 70,
};

// ── Rocker spine: cubic Bézier with explicit tangent handles ─────────────
//
// The spine is two cubic Bézier segments joined at the paddler position:
//
//   Seg 1 (stern → paddler):  [stern, stern+sternHandle, paddler-dir*aftLen, paddler]
//   Seg 2 (paddler → bow):    [paddler, paddler+dir*foreLen, bow+bowHandle,  bow]
//
// "dir" is the unit vector at angle `paddlerAngle`. The two paddler handles
// are anti-parallel (same direction, independent lengths), giving C¹
// continuity with different fore/aft curve bias — the key design knob for
// rocker profile.  Stern and bow each have one free handle that controls
// how the curve arrives at / departs from the tip.
//
// sternHandle / bowHandle are stored as vectors (dx, dz) from their anchor.
// That matches the "drag handle endpoint" UX.

function spinePlaceholder(L) {
  const half = L / 2;
  return {
    stern:         { x: -half,  z:  0.04 },
    sternHandle:   { dx: half * 0.35, dz: -0.03 },  // outgoing from stern, aims at paddler

    paddler:       { x:  0,     z: -0.04 },          // seat / lowest point
    paddlerAngle:  0,                                 // tangent direction (radians)
    paddlerAftLen: half * 0.35,                       // handle length toward stern
    paddlerForeLen:half * 0.35,                       // handle length toward bow

    bow:           { x:  half,  z:  0.04 },
    bowHandle:     { dx: -half * 0.35, dz: -0.03 },  // incoming to bow, from paddler direction
  };
}

// Compute the four Bézier control-point positions from the spine model.
function spineHandles(sp) {
  const dir = { x: Math.cos(sp.paddlerAngle), z: Math.sin(sp.paddlerAngle) };
  return {
    sCtrl: { x: sp.stern.x   + sp.sternHandle.dx,           z: sp.stern.z   + sp.sternHandle.dz },
    pAft:  { x: sp.paddler.x - dir.x * sp.paddlerAftLen,    z: sp.paddler.z - dir.z * sp.paddlerAftLen },
    pFore: { x: sp.paddler.x + dir.x * sp.paddlerForeLen,   z: sp.paddler.z + dir.z * sp.paddlerForeLen },
    bCtrl: { x: sp.bow.x     + sp.bowHandle.dx,             z: sp.bow.z     + sp.bowHandle.dz },
  };
}

// Point on a cubic Bézier at parameter t. Returns {x, y} where y = z,
// matching the {x, y} convention used throughout the sampled-spine pipeline.
function cubicBezierPt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.z + 3*u*u*t*p1.z + 3*u*t*t*p2.z + t*t*t*p3.z,
  };
}

function stationsPlaceholder() {
  // Interior stations only. Each is a closed-loop cross-section in the
  // local (b, n) frame: first point at (b=0, n=0) is keel-on-centerline,
  // last point at (b=0, n=deck) is deck-on-centerline. Mirror to port
  // closes the hull along Y = 0.
  const interiorParams = [0.15, 0.32, 0.50, 0.68, 0.85];
  return interiorParams.map((s) => {
    const taper    = Math.sin(Math.PI * s);
    const halfBeam = 0.18 + 0.12 * taper;
    return { s, kind: 'interior', points: defaultSection(halfBeam) };
  });
}

// Sheer end: the bow / stern section that tapers from the last rocker
// cross-section to a single tip point. The "sheer keel line" is a natural
// cubic spline from the rocker junction (derived from startS, not stored)
// through any interior control points to the tip — the convergence point
// shared with the deck-line endpoint. Stations are closed-loop cross-
// sections, keel locked on the sheer keel line, deck from the global deck
// line. t ∈ (0, 1) on a station: 0 = junction, 1 = tip.
function defaultSheer(end, L = 5.2) {
  const half = L / 2;
  const tipZ = 0.04 + DEFAULT_DECK_N;
  const sign = end === 'stern' ? -1 : 1;
  // Two-line sheer: deckEndPt is where the global deckline meets the top
  // sheer; tip is the convergence point where both sheer lines meet.
  // Each station owns a bottomPt (bottom sheer spline control point) and
  // a topPt (top sheer spline control point), sharing the same t parameter.
  const deckEndPt = { x: sign * half * 0.84, z: tipZ * 0.95 };
  const tip       = { x: sign * half,         z: tipZ * 0.25 };
  return {
    startS: end === 'stern' ? 0.075 : 0.925,
    deckEndPt,
    tip,
    stations: [
      {
        t:        0.45,
        bottomPt: { x: sign * half * 0.917, z: tipZ * 0.16  },
        topPt:    { x: sign * half * 0.912, z: tipZ * 0.635 },
        points:   defaultSection(0.12),
      },
    ],
  };
}

// Closed-loop section: starboard half from keel-centerline up the side to
// the deck-centerline. The mirrored port half makes the full closed cross
// section. First and last points are constrained to the centerline (b=0).
// Deck line — interior control points only. The endpoints (at stern tip
// and bow tip) are computed from the sheer profiles and prepended /
// appended automatically when building the spline. Keep the X range
// inside the hull and the Z values above the keel at every station.
function defaultDeckLine() {
  return {
    points: [
      { x: -1.3, z: 0.29 },
      { x:  0,   z: 0.26 },  // gentle concave crown at midship
      { x:  1.3, z: 0.29 },
    ],
  };
}

// Deckline endpoints are the deckEndPt of each sheer (not the convergence tip).
function sheerTip(state, _spSampled, end) {
  return (end === 'bow' ? state.bowSheer : state.sternSheer).deckEndPt;
}

// Build a natural-cubic spline evaluator f(x) → z for the deck line,
// prepending the stern tip and appending the bow tip so the ends connect.
function buildDeckSpline(state, spSampled) {
  const spt = sheerTip(state, spSampled, 'stern');
  const bpt = sheerTip(state, spSampled, 'bow');
  const pts = [spt, ...state.deckLine.points, bpt]
    .slice()
    .sort((a, b) => a.x - b.x);
  const xs = pts.map(p => p.x);
  const zs = pts.map(p => p.z);
  return naturalCubicNonUniform(xs, zs);
}

// Derive the deck-end n for a station given its keel world position and
// the spine tangent direction at that point. n is the projection of the
// keel→deck vector onto the local up direction (tx ≈ 1 for mild rocker,
// so n ≈ deckZ − keelZ for typical kayaks).
// Find n such that the spine-normal ray from the keel point exactly hits
// the deck line:  keelZ + n·tx = deckEval(keelX − n·tz)
// For a horizontal spine (tz=0) this reduces to n = deckZ − keelZ.
// For a sloped spine the ray moves in X as it climbs, so we Newton-iterate.
// Converges in 3–4 steps for any realistic hull geometry.
function deckNFromLine(keelPx, keelPz, tx, tz, deckEval) {
  let n = tx > 1e-4
    ? (deckEval(keelPx) - keelPz) / tx   // good starting guess
    : Math.max(0.05, deckEval(keelPx) - keelPz);
  for (let i = 0; i < 6; i++) {
    const wx = keelPx - n * tz;
    const f  = keelPz + n * tx - deckEval(wx);
    if (Math.abs(f) < 1e-8) break;
    const h  = 1e-5;
    const df = tx + tz * (deckEval(wx + h) - deckEval(wx - h)) / (2 * h);
    if (Math.abs(df) < 1e-12) break;
    n -= f / df;
  }
  return Math.max(0.01, n);
}

// Snap every station's deck-end (last point) to exactly n=1.0.
// With normalized storage, no scaling is needed — the physical deck height
// is applied per-row in buildLoft when projecting to world space.
function reconcileDeckPoints(state) {
  const snapDeck = (points) => { points[points.length - 1].n = 1.0; };
  state.stations.forEach(st => snapDeck(st.points));
  state.bowSheer.stations.forEach(st  => snapDeck(st.points));
  state.sternSheer.stations.forEach(st => snapDeck(st.points));
}

// n values are normalized: 0 = keel, 1 = deck. Values outside [0,1] are
// valid (e.g. n=1.5 is 50% above the deck line). buildLoft multiplies by
// the physical deck height at each station when projecting to world space.
function defaultSection(halfBeam) {
  return [
    { b: 0,               n: 0,    chine: false }, // keel (centerline)
    { b: halfBeam * 0.55, n: 0.13, chine: false },
    { b: halfBeam,        n: 0.53, chine: false }, // beam-max
    { b: halfBeam * 0.55, n: 0.90, chine: false },
    { b: 0,               n: 1.0,  chine: false }, // deck (centerline)
  ];
}

// (stemProfileToSection removed — sheer ends now use world-space keel lines
//  and closed-loop cross-sections, not profile-projected b=0 slices.)

// ── Geometry helpers (shared placeholders for now) ───────────────────────

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

// Sample a parametric natural cubic spline through points[*].xKey, points[*].yKey
// at unit-spaced knots. Returns samplesPerSpan*(n-1)+1 points.
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
      const s = k / samplesPerSpan;
      const omS = 1 - s;
      const ax = (omS ** 3 - omS) / 6;
      const bx = (s ** 3 - s) / 6;
      out.push({
        x: omS * xs[i] + s * xs[i + 1] + ax * Mx[i] + bx * Mx[i + 1],
        y: omS * ys[i] + s * ys[i + 1] + ax * My[i] + bx * My[i + 1],
      });
    }
  }
  out.push({ x: xs[n - 1], y: ys[n - 1] });
  return out;
}

// Sample the Bézier rocker spine and accumulate arc length for
// parameterization. `steps` is split evenly over the two segments.
function sampledSpine(sp, steps = 64) {
  const { sCtrl, pAft, pFore, bCtrl } = spineHandles(sp);
  const half = Math.ceil(steps / 2);
  const pts  = [];
  for (let i = 0; i <= half; i++)
    pts.push(cubicBezierPt(sp.stern,   sCtrl, pAft,   sp.paddler, i / half));
  for (let i = 1; i <= half; i++)
    pts.push(cubicBezierPt(sp.paddler, pFore, bCtrl,  sp.bow,     i / half));
  const arc = [0];
  for (let i = 1; i < pts.length; i++)
    arc.push(arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, arc, total: arc[arc.length - 1] };
}

// Look up the (X, Z) point and tangent at normalized arc length s ∈ [0, 1].
function spineAt(spine, s) {
  const { pts, arc, total } = spine.sampled;
  const target = s * total;
  // Binary search for the interval.
  let lo = 0, hi = arc.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] <= target) lo = mid; else hi = mid;
  }
  const t = arc[hi] === arc[lo] ? 0 : (target - arc[lo]) / (arc[hi] - arc[lo]);
  const p = {
    x: pts[lo].x + t * (pts[hi].x - pts[lo].x),
    z: pts[lo].y + t * (pts[hi].y - pts[lo].y),
  };
  const dx = pts[hi].x - pts[lo].x;
  const dz = pts[hi].y - pts[lo].y;
  const len = Math.hypot(dx, dz) || 1;
  return { p, tx: dx / len, tz: dz / len };
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
function sampledSheerKeel(state, end, spSampled) {
  const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
  const { p: jp } = spineAt({ ctrl: state.spine, sampled: spSampled }, sheer.startS);
  const sortedSt = [...sheer.stations].sort((a, b) =>
    end === 'bow' ? a.bottomPt.x - b.bottomPt.x : b.bottomPt.x - a.bottomPt.x
  );
  const allPts = [{ x: jp.x, z: jp.z }, ...sortedSt.map(s => s.bottomPt), sheer.tip];
  const pts = sampleSpline(allPts, 'x', 'z', 24);
  const arc = [0];
  for (let i = 1; i < pts.length; i++)
    arc.push(arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, arc, total: arc[arc.length - 1] };
}

// Top sheer line: [deckEndPt, ...stations[].topPt, tip]
function sampledTopSheer(state, end, spSampled) {
  const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
  const sortedSt = [...sheer.stations].sort((a, b) =>
    end === 'bow' ? a.topPt.x - b.topPt.x : b.topPt.x - a.topPt.x
  );
  const allPts = [sheer.deckEndPt, ...sortedSt.map(s => s.topPt), sheer.tip];
  const pts = sampleSpline(allPts, 'x', 'z', 24);
  const arc = [0];
  for (let i = 1; i < pts.length; i++)
    arc.push(arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, arc, total: arc[arc.length - 1] };
}

// Evaluate a {pts, arc, total} sampled curve at arc-length fraction t ∈ [0,1].
// Returns { p: {x, z}, tx, tz } — same format as spineAt.
function sampleAlong(sampled, t) {
  const { pts, arc, total } = sampled;
  if (!pts.length) return { p: { x: 0, z: 0 }, tx: 1, tz: 0 };
  if (total < 1e-9) return { p: { x: pts[0].x, z: pts[0].y }, tx: 1, tz: 0 };
  const target = Math.max(0, Math.min(total, t * total));
  let lo = 0, hi = arc.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] <= target) lo = mid; else hi = mid;
  }
  const frac = arc[hi] === arc[lo] ? 0 : (target - arc[lo]) / (arc[hi] - arc[lo]);
  const p = {
    x: pts[lo].x + frac * (pts[hi].x - pts[lo].x),
    z: pts[lo].y + frac * (pts[hi].y - pts[lo].y),
  };
  const ddx = pts[hi].x - pts[lo].x;
  const ddz = pts[hi].y - pts[lo].y;
  const len = Math.hypot(ddx, ddz) || 1;
  return { p, tx: ddx / len, tz: ddz / len };
}

// Arc length of the rocker between two normalized parameters.
function rockerArcBetween(sampled, s0, s1) {
  return sampled.total * Math.abs(s1 - s0);
}

// Pre-compute all lengths for the composite spine.
function compositeLengths(state) {
  const rocSampled  = sampledSpine(state.spine, 64);
  const rocTotal    = rocSampled.total || 1e-9;
  const sternStartS = Math.max(0,                  Math.min(1, state.sternSheer.startS));
  const bowStartS   = Math.max(sternStartS + 0.05, Math.min(1, state.bowSheer.startS));

  const sternKeelSampled = sampledSheerKeel(state, 'stern', rocSampled);
  const bowKeelSampled   = sampledSheerKeel(state, 'bow',   rocSampled);

  const sternLen = sternKeelSampled.total;
  const mainLen  = rockerArcBetween(rocSampled, sternStartS, bowStartS);
  const bowLen   = bowKeelSampled.total;
  const totalLen = sternLen + mainLen + bowLen || 1e-9;

  const sternFrac = sternLen / totalLen;
  const bowFrac   = bowLen   / totalLen;

  return {
    rocSampled, rocTotal,
    sternStartS, bowStartS,
    sternKeelSampled, bowKeelSampled,
    sternLen, mainLen, bowLen, totalLen,
    sternFrac, bowFrac,
  };
}

// Evaluate the composite spine at S ∈ [0, 1].
function compositeAt(state, lengths, S) {
  S = Math.max(0, Math.min(1, S));
  const { sternFrac, bowFrac } = lengths;

  if (sternFrac > 1e-9 && S <= sternFrac) {
    // Stern sheer end — walk backward: S=0 → tip (t=1), S=sternFrac → junction (t=0).
    const r = sampleAlong(lengths.sternKeelSampled, 1 - S / sternFrac);
    return { p: r.p, tx: -r.tx, tz: -r.tz };   // negate: walking junction→tip reversed
  }
  if (bowFrac > 1e-9 && S >= 1 - bowFrac) {
    // Bow sheer end — walk forward: S=1-bowFrac → junction (t=0), S=1 → tip (t=1).
    return sampleAlong(lengths.bowKeelSampled, (S - (1 - bowFrac)) / bowFrac);
  }
  // Main hull rocker.
  const mainFrac = 1 - sternFrac - bowFrac;
  const rocS = mainFrac > 1e-9
    ? lengths.sternStartS + ((S - sternFrac) / mainFrac) * (lengths.bowStartS - lengths.sternStartS)
    : (lengths.sternStartS + lengths.bowStartS) * 0.5;
  return spineAt({ ctrl: state.spine, sampled: lengths.rocSampled }, rocS);
}

// Composite-S for an interior (rocker) station at spine parameter s.
// Maps s ∈ [sternStartS, bowStartS] → S ∈ [sternFrac, 1-bowFrac].
function interiorStationS(s, lengths) {
  const span = lengths.bowStartS - lengths.sternStartS;
  if (span <= 1e-9) return lengths.sternFrac;
  const mainFrac = 1 - lengths.sternFrac - lengths.bowFrac;
  return lengths.sternFrac + ((s - lengths.sternStartS) / span) * mainFrac;
}

// Composite-S for a sheer-end station at keel parameter t ∈ [0,1]
// (0 = junction on rocker, 1 = tip).
function sheerStationS(end, t, lengths) {
  if (end === 'bow')
    return (1 - lengths.bowFrac) + lengths.bowFrac * t;
  // stern: S=0 → tip (t=1), S=sternFrac → junction (t=0)
  return lengths.sternFrac * (1 - t);
}

// World position of a point along a sheer keel at parameter t ∈ [0,1].
// Used for sheer-station tick rendering in the side view.
function sampleSheerSegment(state, lengths, end, t) {
  return sampleAlong(
    end === 'bow' ? lengths.bowKeelSampled : lengths.sternKeelSampled,
    t,
  );
}

// Natural cubic spline through (sₖ, vₖ) at non-uniform knots — used for
// longitudinal interpolation between stations. Returns an evaluator f(s).
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

// Build the unified station list for the loft.
// Order: stern tip (S=0) → stern sheer-end stations → interior rocker
// stations → bow sheer-end stations → bow tip (S=1).
function unifiedStations(state, lengths, N) {
  const out = [];
  const { sternFrac, bowFrac } = lengths;
  const tip0 = Array.from({ length: N }, () => ({ b: 0, n: 0 }));
  const tip1 = Array.from({ length: N }, () => ({ b: 0, n: 0 }));

  // S=0: stern tip — single degenerate point.
  out.push({ S: 0, kind: 'tip', samples: tip0 });

  // Stern sheer-end stations (t=0 = junction, t=1 = tip → S walks 0..sternFrac).
  state.sternSheer.stations.forEach(sst => {
    const S = sheerStationS('stern', sst.t, lengths);
    if (S <= 1e-6 || S >= sternFrac - 1e-6) return;
    out.push({ S, kind: 'sternSheer', samples: sampleSection(sst.points, N) });
  });

  // Interior rocker stations.
  state.stations.forEach(st => {
    if (st.s <= lengths.sternStartS + 1e-6) return;
    if (st.s >= lengths.bowStartS   - 1e-6) return;
    out.push({ S: interiorStationS(st.s, lengths), kind: 'interior', samples: sampleSection(st.points, N) });
  });

  // Bow sheer-end stations.
  state.bowSheer.stations.forEach(sst => {
    const S = sheerStationS('bow', sst.t, lengths);
    if (S <= 1 - bowFrac + 1e-6 || S >= 1 - 1e-6) return;
    out.push({ S, kind: 'bowSheer', samples: sampleSection(sst.points, N) });
  });

  // S=1: bow tip — single degenerate point.
  out.push({ S: 1, kind: 'tip', samples: tip1 });

  out.sort((a, b) => a.S - b.S);
  return out;
}

// Loft mesh. No longitudinal interpolation: each station's cross-section
// is projected directly into world space and adjacent stations are connected
// with ruled quad strips. Tips are degenerate (all N points at one world
// position) so the hull naturally closes to a point at bow and stern.
function buildLoft(state) {
  const lengths = compositeLengths(state);
  const N = { low: 32, med: 64, high: 128 }[state.loftRes];

  const spSampled    = sampledSpine(state.spine, 64);
  const deckEvalLoft = buildDeckSpline(state, spSampled);
  const bowTSampled  = sampledTopSheer(state, 'bow',   spSampled);
  const sternTSampled = sampledTopSheer(state, 'stern', spSampled);

  const allSt = unifiedStations(state, lengths, N);
  const M     = allSt.length;

  const rows = allSt.map(st => {
    const { p, tx, tz } = compositeAt(state, lengths, st.S);
    const nx = -tz, nz = tx;
    let deckN_phys;
    if (st.kind === 'tip') {
      deckN_phys = 0;
    } else if (st.kind === 'bowSheer' || st.kind === 'sternSheer') {
      const isBow = st.kind === 'bowSheer';
      const tFrac = isBow
        ? (st.S - (1 - lengths.bowFrac))  / lengths.bowFrac
        : 1 - st.S / lengths.sternFrac;
      const tSamp = isBow ? bowTSampled : sternTSampled;
      const { p: topPt } = sampleAlong(tSamp, Math.max(0, Math.min(1, tFrac)));
      // Project (topPt − keelPt) onto the local rocker normal.
      deckN_phys = Math.max(0, (topPt.x - p.x) * nx + (topPt.z - p.z) * nz);
    } else {
      deckN_phys = deckNFromLine(p.x, p.z, tx, tz, deckEvalLoft);
    }
    return st.samples.map(({ b, n }) => {
      const nPhys = n * deckN_phys;
      return { x: p.x + nPhys * nx, y: b, z: p.z + nPhys * nz };
    });
  });

  // Starboard mesh + port mirror — ruled quad strips between adjacent rows.
  const positions = [];
  const indices   = [];
  for (let i = 0; i < M; i++)
    for (let k = 0; k < N; k++)
      positions.push(rows[i][k].x, rows[i][k].z, rows[i][k].y);

  for (let i = 0; i < M - 1; i++) {
    for (let k = 0; k < N - 1; k++) {
      const a = i * N + k, b = i * N + k + 1;
      const c = (i + 1) * N + k, d = (i + 1) * N + k + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const stbdVertCount = M * N;
  for (let i = 0; i < M; i++)
    for (let k = 0; k < N; k++)
      positions.push(rows[i][k].x, rows[i][k].z, -rows[i][k].y);

  for (let i = 0; i < M - 1; i++) {
    for (let k = 0; k < N - 1; k++) {
      const a = stbdVertCount + i * N + k, b = stbdVertCount + i * N + k + 1;
      const c = stbdVertCount + (i + 1) * N + k, d = stbdVertCount + (i + 1) * N + k + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const stationRows = allSt
    .filter(st => st.kind !== 'tip')
    .map(st => {
      const { p, tx, tz } = compositeAt(state, lengths, st.S);
      const nx = -tz, nz = tx;
      let deckN_phys;
      if (st.kind === 'bowSheer' || st.kind === 'sternSheer') {
        const isBow = st.kind === 'bowSheer';
        const tFrac = isBow
          ? (st.S - (1 - lengths.bowFrac))  / lengths.bowFrac
          : 1 - st.S / lengths.sternFrac;
        const tSamp = isBow ? bowTSampled : sternTSampled;
        const { p: topPt } = sampleAlong(tSamp, Math.max(0, Math.min(1, tFrac)));
        deckN_phys = Math.max(0, (topPt.x - p.x) * nx + (topPt.z - p.z) * nz);
      } else {
        deckN_phys = deckNFromLine(p.x, p.z, tx, tz, deckEvalLoft);
      }
      return {
        kind: st.kind, S: st.S,
        points: st.samples.map(({ b, n }) => {
          const nPhys = n * deckN_phys;
          return { x: p.x + nPhys * nx, y: b, z: p.z + nPhys * nz };
        }),
      };
    });

  return { positions, indices, rows, stationRows, lengths, N, M };
}

// Sample the lofted section in (b, n) at any normalized arc length s.
// Used when adding a new station: the new station is seeded with a section
// matching the *current* loft at that s, so the surface is unchanged at
// the moment of insertion (per the plan's seed-from-current-loft rule).
//
// Returns an array of { b, n, chine: false } control points, count =
// `numPoints` (default 7), distributed evenly along the section's
// arc length, with the first point clamped to the keel (0, 0).
function sectionAtS(state, sOrParam, numPoints = 7, kind = 'interior', end = null) {
  // For kind='interior': sOrParam is a rocker s ∈ (sternStartS, bowStartS).
  // For kind='sheer'   : sOrParam is t ∈ (0, 1) along bowSheer/sternSheer
  //                      (end='bow' or 'stern').
  const N_DENSE = 96;
  const lengths = compositeLengths(state);
  const allSt   = unifiedStations(state, lengths, N_DENSE);
  const ss      = allSt.map(st => st.S);
  const samps   = allSt.map(st => st.samples);

  // Composite S of the requested point.
  const targetS = (kind === 'sheer')
    ? sheerStationS(end, sOrParam, lengths)
    : interiorStationS(sOrParam, lengths);

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

// Reset view on double-click.
renderer.domElement.addEventListener('dblclick', () => {
  camera.position.copy(defaultCamPos);
  controls.target.set(0, -0.05, 0);
  controls.update();
});

// Lighting.
// Brighter lights to make up for the dark background.
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
keyLight.position.set(2, 4, 1.5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc7d2fe, 0.55);
fillLight.position.set(-2, 1, -2);
scene.add(fillLight);

// Grid planes live in their own scene so they are rendered AFTER the AO
// composer pass and appear correctly in every output mode (Normal, SSAO, etc).
const gridScene = new THREE.Scene();

// Horizontal reference grid at Z = 0 (waterline plane).
const grid = new THREE.GridHelper(8, 16, 0xe2e8f0, 0x64748b);
grid.position.y = 0;
grid.material.transparent = true;
grid.material.opacity = 0.85;
gridScene.add(grid);

// Centerline plane grid (longitudinal-vertical bisecting plane).
const centerGrid = new THREE.GridHelper(6, 12, 0xa5b4fc, 0x475569);
centerGrid.rotation.x = Math.PI / 2;
centerGrid.material.transparent = true;
centerGrid.material.opacity = 0.6;
centerGrid.position.y = 0;
gridScene.add(centerGrid);

// Bright centerline at the intersection of the two grid planes.
const centerlineMat  = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
const centerlineGeom = new THREE.BufferGeometry();
const centerlineLine = new THREE.Line(centerlineGeom, centerlineMat);
gridScene.add(centerlineLine);

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
  // Sync all station deck-ends to the deck line before lofting.
  reconcileDeckPoints(state);

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

// Render loop. Grid scene rendered after the composer so it appears on top
// in every AO output mode (Normal, SSAO, etc). clearDepth() preserves the
// color output while allowing grid lines to depth-test against each other.
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  composer.render();
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(gridScene, camera);
  renderer.autoClear = true;
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

function renderSideView() {
  sideSvg.innerHTML = '';
  const xOf = (x) => x * SIDE_SCALE_X;
  const yOf = (z) => -z * SIDE_SCALE_Z;

  // Sample the spine once for everything that needs it.
  const sampled = sampledSpine(state.spine, 32);
  const spine   = { ctrl: state.spine, sampled };

  // Waterline (Z = 0).
  sideSvg.appendChild(el('line', {
    x1: -340, y1: yOf(0), x2: 340, y2: yOf(0), class: 'water',
  }));
  sideSvg.appendChild(el('text', {
    x: 320, y: yOf(0) - 3, class: 'label', 'text-anchor': 'end',
  }, 'WL (Z = 0)'));

  // ── Four explicit hull-profile curves ───────────────────────────────
  // keel (rocker, blue), deck line (green), bow sheer (orange), stern
  // sheer (purple). All rendered + editable directly. The silhouette
  // polygon is assembled from the four curves so the hull fill stays in
  // sync with what the user edits.

  const lengths = compositeLengths(state);

  // Helper: dense world-space points of a sheer keel line.
  const sheerKeelWorldPts = (end) => {
    const kSampled = sampledSheerKeel(state, end, sampled);
    return kSampled.pts.map(p => ({ x: p.x, z: p.y }));
  };

  const sternSheerPts  = sheerKeelWorldPts('stern');
  const bowSheerPts    = sheerKeelWorldPts('bow');
  const sternTipPt     = state.sternSheer.tip;
  const bowTipPt       = state.bowSheer.tip;
  const sternDeckEndPt = state.sternSheer.deckEndPt;
  const bowDeckEndPt   = state.bowSheer.deckEndPt;
  const spSampledFull  = sampledSpine(state.spine, 64);
  const bowTopPts   = sampledTopSheer(state, 'bow',   spSampledFull).pts.map(p => ({ x: p.x, z: p.y }));
  const sternTopPts = sampledTopSheer(state, 'stern', spSampledFull).pts.map(p => ({ x: p.x, z: p.y }));

  // Rocker: sample the active portion (sternSheer.startS → bowSheer.startS)
  const rockerPts = [];
  for (let i = 0; i <= 60; i++) {
    const s = lengths.sternStartS + (i / 60) * (lengths.bowStartS - lengths.sternStartS);
    rockerPts.push(spineAt(spine, s).p);
  }
  // Keel path: stern keel ← stern sheer keel-end (same point) → rocker → bow sheer keel-end → bow keel
  // = stern rocker join + rocker + bow rocker join (sheer startS points are on the rocker)
  const sternJoin = rockerPts[0];
  const bowJoin   = rockerPts[rockerPts.length - 1];

  const spSampled = sampledSpine(state.spine, 64);
  const deckEval  = buildDeckSpline(state, spSampled);
  const deckSamplePts = [];
  for (let i = 0; i <= 60; i++) {
    const x = sternDeckEndPt.x + (i / 60) * (bowDeckEndPt.x - sternDeckEndPt.x);
    deckSamplePts.push({ x, z: deckEval(x) });
  }

  const pt2str = p => `${xOf(p.x).toFixed(2)},${yOf(p.z).toFixed(2)}`;
  const pathD  = pts => 'M ' + pts.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L ');

  // Silhouette traces: deckEndPt → deck → deckEndPt → topSheer → tip
  //   → bottomSheer(rev) → junction → rocker(rev) → junction
  //   → bottomSheer → tip → topSheer(rev) → deckEndPt
  const silPts = [
    ...deckSamplePts.map(pt2str),
    ...bowTopPts.map(pt2str),
    ...[...bowSheerPts].reverse().map(pt2str),
    ...[...rockerPts].reverse().map(pt2str),
    ...sternSheerPts.map(pt2str),
    ...[...sternTopPts].reverse().map(pt2str),
  ];
  sideSvg.appendChild(el('polygon', { points: silPts.join(' '), class: 'silhouette' }));

  sideSvg.appendChild(el('path', { class: 'keel',              d: pathD(rockerPts) }));
  sideSvg.appendChild(el('path', { class: 'stern-sheer-curve', d: pathD(sternSheerPts) }));
  sideSvg.appendChild(el('path', { class: 'bow-sheer-curve',   d: pathD(bowSheerPts) }));
  sideSvg.appendChild(el('path', { class: 'stern-top-sheer-curve', d: pathD(sternTopPts) }));
  sideSvg.appendChild(el('path', { class: 'bow-top-sheer-curve',   d: pathD(bowTopPts) }));
  sideSvg.appendChild(el('path', { class: 'deck-curve',        d: pathD(deckSamplePts) }));

  // ── Bézier rocker spine ──────────────────────────────────────────────
  const sp = state.spine;
  const h  = spineHandles(sp);

  // Handle lines (anchor → handle endpoint) drawn before the curve so the
  // curve renders on top.
  for (const [ax, az, hx, hz] of [
    [sp.stern.x,   sp.stern.z,   h.sCtrl.x, h.sCtrl.z],
    [sp.paddler.x, sp.paddler.z, h.pAft.x,  h.pAft.z ],
    [sp.paddler.x, sp.paddler.z, h.pFore.x, h.pFore.z],
    [sp.bow.x,     sp.bow.z,     h.bCtrl.x, h.bCtrl.z],
  ]) {
    sideSvg.appendChild(el('line', {
      x1: xOf(ax), y1: yOf(az), x2: xOf(hx), y2: yOf(hz),
      class: 'handle-line',
    }));
  }

  // Actual Bézier curve (rendered from sampled points — already computed).
  sideSvg.appendChild(el('path', {
    class: 'spine-line',
    d: 'M ' + sampled.pts.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.y).toFixed(2)}`).join(' L '),
  }));

  // Handle endpoint dots (small).
  const handleDots = [
    ['handle-stern',       h.sCtrl],
    ['handle-paddler-aft', h.pAft ],
    ['handle-paddler-fore',h.pFore],
    ['handle-bow',         h.bCtrl],
  ];
  for (const [id, p] of handleDots) {
    sideSvg.appendChild(el('circle', { cx: xOf(p.x), cy: yOf(p.z), r: 10, class: 'handle-hit', 'data-drag': id }));
    sideSvg.appendChild(el('circle', { cx: xOf(p.x), cy: yOf(p.z), r: 3.5, class: 'spine-handle', 'data-drag': id }));
  }

  // Anchor points (large): stern, paddler, bow.
  const anchorDots = [
    ['anchor-stern',   sp.stern  ],
    ['anchor-paddler', sp.paddler],
    ['anchor-bow',     sp.bow    ],
  ];
  for (const [id, p] of anchorDots) {
    const isPaddler = id === 'anchor-paddler';
    sideSvg.appendChild(el('circle', { cx: xOf(p.x), cy: yOf(p.z), r: 14, class: 'spine-hit', 'data-drag': id }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(p.x), cy: yOf(p.z), r: 5,
      class: 'spine-anchor' + (isPaddler ? ' paddler' : ''),
      'data-drag': id,
    }));
  }

  // Build the unified station list once for rendering (with the same
  // ordering as buildLoft → state.selectedStation indexes into it).
  const unified = listAllStations(state);

  // Interior station ticks along the rocker.
  unified.forEach((entry, i) => {
    if (entry.kind !== 'interior') return;
    const sp = spineAt(spine, entry.ref.s);
    const isSel = i === state.selectedStation;
    sideSvg.appendChild(el('line', {
      x1: xOf(sp.p.x), y1: yOf(sp.p.z) - 12,
      x2: xOf(sp.p.x), y2: yOf(sp.p.z) + 6,
      class: 'station' + (isSel ? ' selected' : ''),
    }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(sp.p.x), cy: yOf(sp.p.z) - 12, r: 14,
      class: 'station-hit',
      'data-drag': 'station', 'data-idx': String(i),
    }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(sp.p.x), cy: yOf(sp.p.z) - 12, r: 4.2,
      class: 'station-tick' + (isSel ? ' selected' : ''),
      'data-drag': 'station', 'data-idx': String(i),
    }));
    sideSvg.appendChild(el('text', {
      x: xOf(sp.p.x), y: yOf(sp.p.z) - 18, class: 'station-label',
    }, entry.label));
  });

  // Endpoint labels follow the actual spine endpoints (which are the same
  // draggable spine control points as any other).
  sideSvg.appendChild(el('text', {
    x: xOf(state.spine.stern.x), y: yOf(0) + 22, class: 'label', 'text-anchor': 'middle',
  }, 'stern'));
  sideSvg.appendChild(el('text', {
    x: xOf(state.spine.bow.x), y: yOf(0) + 22, class: 'label', 'text-anchor': 'middle',
  }, 'bow'));
  sideSvg.appendChild(el('text', {
    x: xOf(state.spine.paddler.x), y: yOf(state.spine.paddler.z) - 12,
    class: 'label paddler-label', 'text-anchor': 'middle',
  }, 'paddler'));

  // ── Sheer ends (bow + stern) ─────────────────────────────────────────
  for (const end of ['stern', 'bow']) {
    const sheer    = end === 'bow' ? state.bowSheer : state.sternSheer;
    const ep       = spineAt(spine, sheer.startS).p;
    const botClass = `sheer-ctrl-${end}`;
    const topClass = `sheer-top-ctrl-${end}`;

    sheer.stations.forEach((sst, sIdx) => {
      const uniIdx = unified.findIndex(u =>
        u.kind === (end === 'bow' ? 'bowSheer' : 'sternSheer') && u.stationIdx === sIdx
      );
      const isSel = uniIdx === state.selectedStation;

      // Bottom (keel) control point — solid fill.
      sideSvg.appendChild(el('circle', {
        cx: xOf(sst.bottomPt.x), cy: yOf(sst.bottomPt.z), r: 14,
        class: 'stem-hit', 'data-drag': `sheer-bot-${end}`, 'data-idx': String(sIdx),
      }));
      sideSvg.appendChild(el('circle', {
        cx: xOf(sst.bottomPt.x), cy: yOf(sst.bottomPt.z), r: 4.5,
        class: botClass + (isSel ? ' selected' : ''),
        'data-drag': `sheer-bot-${end}`, 'data-idx': String(sIdx),
      }));

      // Top (deck) control point — ring fill.
      sideSvg.appendChild(el('circle', {
        cx: xOf(sst.topPt.x), cy: yOf(sst.topPt.z), r: 14,
        class: 'stem-hit', 'data-drag': `sheer-top-${end}`, 'data-idx': String(sIdx),
      }));
      sideSvg.appendChild(el('circle', {
        cx: xOf(sst.topPt.x), cy: yOf(sst.topPt.z), r: 5,
        class: topClass + (isSel ? ' selected' : ''),
        'data-drag': `sheer-top-${end}`, 'data-idx': String(sIdx),
      }));

      // Station hit area at the midpoint of the bottomPt→topPt line.
      if (uniIdx >= 0) {
        const mx = (sst.bottomPt.x + sst.topPt.x) / 2;
        const mz = (sst.bottomPt.z + sst.topPt.z) / 2;
        sideSvg.appendChild(el('circle', {
          cx: xOf(mx), cy: yOf(mz), r: 14, class: 'sheer-station-hit',
          'data-drag': 'sheer-station', 'data-idx': String(uniIdx),
        }));
        sideSvg.appendChild(el('circle', {
          cx: xOf(mx), cy: yOf(mz), r: 3.5,
          class: 'sheer-station-tick' + (isSel ? ' selected' : ''),
          'data-drag': 'sheer-station', 'data-idx': String(uniIdx),
        }));
      }
    });

    // Convergence tip — ring, draggable.
    sideSvg.appendChild(el('circle', {
      cx: xOf(sheer.tip.x), cy: yOf(sheer.tip.z), r: 14,
      class: 'stem-hit', 'data-drag': `sheer-tip-${end}`,
    }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(sheer.tip.x), cy: yOf(sheer.tip.z), r: 6,
      class: `${botClass} tip`, 'data-drag': `sheer-tip-${end}`,
    }));

    // deckEndPt — green diamond, draggable.
    const dep = sheer.deckEndPt;
    sideSvg.appendChild(el('circle', {
      cx: xOf(dep.x), cy: yOf(dep.z), r: 14,
      class: 'deck-hit', 'data-drag': `sheer-deck-${end}`,
    }));
    sideSvg.appendChild(el('rect', {
      x: xOf(dep.x) - 5, y: yOf(dep.z) - 5, width: 10, height: 10,
      transform: `rotate(45 ${xOf(dep.x)} ${yOf(dep.z)})`,
      class: 'deck-ctrl', 'data-drag': `sheer-deck-${end}`,
    }));

    // Junction tick on rocker.
    sideSvg.appendChild(el('line', {
      x1: xOf(ep.x), y1: yOf(ep.z) + 10, x2: xOf(ep.x), y2: yOf(ep.z) - 10,
      class: 'sheer-start', 'data-drag': `sheer-start-${end}`,
    }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(ep.x), cy: yOf(ep.z), r: 14,
      class: 'sheer-start-hit', 'data-drag': `sheer-start-${end}`,
    }));
  }

  // ── Deck line interior control points ────────────────────────────────
  const deckTips = [
    { ...sternDeckEndPt, locked: true, idx: -1 },
    ...state.deckLine.points.map((p, i) => ({ ...p, locked: false, idx: i })),
    { ...bowDeckEndPt,   locked: true, idx: -2 },
  ];
  deckTips.forEach(({ x, z, locked, idx }) => {
    if (!locked) {
      sideSvg.appendChild(el('circle', {
        cx: xOf(x), cy: yOf(z), r: 14, class: 'deck-hit',
        'data-drag': 'deck-pt', 'data-idx': String(idx),
      }));
    }
    sideSvg.appendChild(el('rect', {
      x: xOf(x) - 4.5, y: yOf(z) - 4.5, width: 9, height: 9,
      transform: `rotate(45 ${xOf(x)} ${yOf(z)})`,
      class: 'deck-ctrl' + (locked ? ' locked' : ''),
      ...(locked ? {} : { 'data-drag': 'deck-pt', 'data-idx': String(idx) }),
    }));
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
  const out = [];
  // Stern sheer stations (closest to stern come first in display order).
  state.sternSheer.stations.forEach((st, i) => {
    out.push({ kind: 'sternSheer', stationIdx: i, ref: st, label: `Sn${i + 1}` });
  });
  state.stations.forEach((st, i) => {
    out.push({ kind: 'interior', stationIdx: i, ref: st, label: `${i + 1}` });
  });
  state.bowSheer.stations.forEach((st, i) => {
    out.push({ kind: 'bowSheer', stationIdx: i, ref: st, label: `Bw${i + 1}` });
  });
  return out;
}

// Section-view scale constants — also used by drag-handler coordinate math.
const SECTION_SCALE   = 600; // px/m  (b axis — physical metres)
const SECTION_SCALE_N = SECTION_SCALE * DEFAULT_DECK_N; // px/unit (n axis — normalised)

// Look up the currently selected station object (interior or sheer).
function selectedStationObj() {
  const unified = listAllStations(state);
  return unified[state.selectedStation] || null;
}

function renderSectionView() {
  sectionSvg.innerHTML = '';
  const bOf = (b) => b * SECTION_SCALE;
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
    x1: 0, y1: -240, x2: 0, y2: 120, class: 'axis',
  }));
  sectionSvg.appendChild(el('text', { x: 4, y: -230, class: 'label' }, 'centerline'));

  // Keel reference (n = 0).
  sectionSvg.appendChild(el('line', {
    x1: -340, y1: nOf(0), x2: 340, y2: nOf(0), class: 'axis',
  }));
  sectionSvg.appendChild(el('text', {
    x: 320, y: nOf(0) + 11, class: 'label', 'text-anchor': 'end',
  }, 'keel (n = 0)'));

  // Deck reference (n = 1).
  sectionSvg.appendChild(el('line', {
    x1: -340, y1: nOf(1), x2: 340, y2: nOf(1), class: 'axis deck-axis',
  }));
  sectionSvg.appendChild(el('text', {
    x: 320, y: nOf(1) - 4, class: 'label', 'text-anchor': 'end',
  }, 'deck (n = 1)'));

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
      cx: bOf(p.b), cy: nOf(p.n), r: 14,
      class: ('ctrl-hit ' + cls).trim(),
      'data-drag': 'ctrl', 'data-idx': String(i),
    }));
    sectionSvg.appendChild(el('circle', {
      cx: bOf(p.b), cy: nOf(p.n), r: 4.2,
      class: ('ctrl-pt ' + cls + (p.chine ? 'chine' : '')).trim(),
      'data-drag': 'ctrl', 'data-idx': String(i),
    }));
  });

  if (station.points.length <= 5) {
    sectionSvg.appendChild(el('text', {
      x: 0, y: 110, class: 'label', 'text-anchor': 'middle',
    }, 'click to add · right-click a point to delete'));
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
      (entry.kind === 'interior' ? '' : 'endpoint');
    li.dataset.idx = String(i);
    const name = document.createElement('span');
    if (entry.kind === 'interior') {
      name.textContent = `St ${entry.label}  ·  s = ${st.s.toFixed(2)}`;
    } else if (entry.kind === 'bowSheer') {
      name.textContent = `Bow sheer ${entry.stationIdx + 1}  ·  t = ${st.t.toFixed(2)}`;
    } else {
      name.textContent = `Stern sheer ${entry.stationIdx + 1}  ·  t = ${st.t.toFixed(2)}`;
    }
    const pips = document.createElement('span');
    pips.className = 'pips';
    pips.textContent = '●'.repeat(Math.min(st.points.length, 9));
    li.append(name, pips);
    li.addEventListener('click', () => selectStation(i));
    stationsOl.appendChild(li);
  });
  stationCount.textContent =
    `${state.stations.length} interior · ${state.bowSheer.stations.length + state.sternSheer.stations.length} sheer`;
}

function stationLabelFor(i) {
  const unified = listAllStations(state);
  const e = unified[i];
  if (!e) return '';
  if (e.kind === 'interior')   return `St ${e.label}`;
  if (e.kind === 'bowSheer')   return `Bow sheer ${e.stationIdx + 1}`;
  if (e.kind === 'sternSheer') return `Stern sheer ${e.stationIdx + 1}`;
  return '';
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
  const sel = listAllStations(state)[state.selectedStation];
  const kind = sel ? sel.kind : 'interior';

  if (kind === 'interior' || !sel) {
    if (state.stations.length >= MAX_INTERIOR) return;
    // Constrain to active rocker range (sternStartS, bowStartS).
    const lo = state.sternSheer.startS, hi = state.bowSheer.startS;
    const sortedSs = [lo, ...state.stations.map(st => st.s).filter(s => s > lo && s < hi).slice().sort((a, b) => a - b), hi];
    let maxGap = 0, gapStart = lo;
    for (let i = 0; i < sortedSs.length - 1; i++) {
      const g = sortedSs[i + 1] - sortedSs[i];
      if (g > maxGap) { maxGap = g; gapStart = sortedSs[i]; }
    }
    const newS  = gapStart + maxGap / 2;
    const points = sectionAtS(state, newS, 7, 'interior');
    state.stations.sort((a, b) => a.s - b.s);
    let insertIdx = state.stations.findIndex(st => st.s > newS);
    if (insertIdx === -1) insertIdx = state.stations.length;
    state.stations.splice(insertIdx, 0, { s: newS, kind: 'interior', points });

    // Re-derive selection: find the unified-index of the new interior station.
    const unified = listAllStations(state);
    state.selectedStation = unified.findIndex(e => e.kind === 'interior' && e.stationIdx === insertIdx);
  } else {
    // Add a sheer station on the same end as the current selection.
    const end   = kind === 'bowSheer' ? 'bow' : 'stern';
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    if (sheer.stations.length >= MAX_SHEER_STATIONS_PER_END) return;
    const sortedTs = [0, ...sheer.stations.map(st => st.t).slice().sort((a, b) => a - b), 1];
    let maxGap = 0, gapStart = 0;
    for (let i = 0; i < sortedTs.length - 1; i++) {
      const g = sortedTs[i + 1] - sortedTs[i];
      if (g > maxGap) { maxGap = g; gapStart = sortedTs[i]; }
    }
    const newT  = gapStart + maxGap / 2;
    const points = sectionAtS(state, newT, 7, 'sheer', end);
    sheer.stations.push({ t: newT, points });
    sheer.stations.sort((a, b) => a.t - b.t);

    const newIdx = sheer.stations.findIndex(s => s.t === newT);
    const unified = listAllStations(state);
    state.selectedStation = unified.findIndex(e =>
      e.kind === (end === 'bow' ? 'bowSheer' : 'sternSheer') && e.stationIdx === newIdx
    );
  }

  stationLabel.textContent = stationLabelFor(state.selectedStation);
  rebuildHull();
  renderStationList();
  renderSideView();
  renderSectionView();
  syncStationButtons();
}

function removeStation() {
  const sel = listAllStations(state)[state.selectedStation];
  if (!sel) return;

  if (sel.kind === 'interior') {
    if (state.stations.length <= MIN_INTERIOR) return;
    state.stations.splice(sel.stationIdx, 1);
  } else if (sel.kind === 'bowSheer') {
    state.bowSheer.stations.splice(sel.stationIdx, 1);
  } else if (sel.kind === 'sternSheer') {
    state.sternSheer.stations.splice(sel.stationIdx, 1);
  }
  const total = listAllStations(state).length;
  state.selectedStation = Math.min(state.selectedStation, total - 1);
  stationLabel.textContent = stationLabelFor(state.selectedStation);

  rebuildHull();
  renderStationList();
  renderSideView();
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
  const sel = listAllStations(state)[state.selectedStation];
  addStationBtn.disabled = false; // contextual; per-kind caps applied inside addStation
  removeStationBtn.disabled = !sel
    || (sel.kind === 'interior' && state.stations.length <= MIN_INTERIOR);
}
syncStationButtons();

// Length slider — proportionally rescales the spine X coordinates so the
// user's interior rocker shape is preserved (just stretched/compressed).
lengthEl.addEventListener('input', () => {
  const newL     = parseFloat(lengthEl.value);
  const currentL = state.spine.bow.x - state.spine.stern.x;
  if (currentL > 0) {
    const ratio = newL / currentL;
    const sp = state.spine;
    sp.stern.x          *= ratio;
    sp.paddler.x         *= ratio;
    sp.bow.x             *= ratio;
    sp.sternHandle.dx    *= ratio;
    sp.bowHandle.dx      *= ratio;
    sp.paddlerAftLen     *= ratio;
    sp.paddlerForeLen    *= ratio;
    // Z values and handle dz are intentionally not scaled — rocker depth
    // shouldn't stretch with hull length.
  }
  state.length = newL;
  lengthOut.textContent = newL.toFixed(2) + ' m';
  rebuildHull();
  renderSideView();
});

loftResEl.addEventListener('change', () => {
  state.loftRes = loftResEl.value;
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
});

meshOpacityEl.addEventListener('input', () => {
  state.meshOpacity = parseFloat(meshOpacityEl.value);
  meshOpacityOut.textContent = state.meshOpacity.toFixed(0) + '%';
  renderSideView();
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

// AO is off by default — SSAOPass output is too weak for kayak-scale
// crevices even with pow-amplified contrast. See loft-plan.md "TODO" for
// the planned fix. Users can still flip it on in the AO panel.
const AO_DEFAULTS = {
  enabled:      true,
  kernelRadius: 0.2,
  minDistance:  0.00001,
  maxDistance:  0.5,
  contrast:     4.0,
  output:       5,   // Normal — colored normal vectors
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
function spineXToS(spine, targetX) {
  const { pts, arc, total } = spine.sampled;
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
  if (kind.startsWith('sheer-bot-') || kind.startsWith('sheer-top-')) {
    const end   = kind.endsWith('-bow') ? 'bow' : 'stern';
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const sst   = sheer.stations[idx];
    if (sst) {
      const spS   = sampledSpine(state.spine, 64);
      const kSamp = sampledSheerKeel(state, end, spS);
      drag.tangent       = sampleAlong(kSamp, sst.t);
      drag.startBottomPt = { ...sst.bottomPt };
      drag.startTopPt    = { ...sst.topPt };
    }
  }
  if (kind === 'station' || kind === 'sheer-station') selectStation(idx);
  sideSvg.setPointerCapture(e.pointerId);
});

sideSvg.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = svgToLocal(sideSvg, e);
  const wx = x / SIDE_SCALE_X;
  const wz = -y / SIDE_SCALE_Z;
  drag.moved = true;

  if (drag.kind === 'deck-pt') {
    const idx = drag.idx;
    if (idx < 0) return; // locked endpoint
    state.deckLine.points[idx] = { x: wx, z: wz };
    drag.moved = true;
    rebuildHull();
    renderSideView();
  } else if (drag.kind.startsWith('sheer-bot-') || drag.kind.startsWith('sheer-top-')) {
    const isBot = drag.kind.startsWith('sheer-bot-');
    const end   = drag.kind.endsWith('-bow') ? 'bow' : 'stern';
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const sst   = sheer.stations[drag.idx];
    if (!sst) return;
    const dx = wx - drag.startWx, dz = wz - drag.startWz;
    const { tx: ttx, tz: ttz } = drag.tangent;
    const dl = dx * ttx + dz * ttz;
    const lx = dl * ttx, lz = dl * ttz;
    if (isBot) {
      sheer.stations[drag.idx].bottomPt = { x: drag.startBottomPt.x + dx, z: drag.startBottomPt.z + dz };
      sheer.stations[drag.idx].topPt    = { x: drag.startTopPt.x    + lx, z: drag.startTopPt.z    + lz };
    } else {
      sheer.stations[drag.idx].topPt    = { x: drag.startTopPt.x    + dx, z: drag.startTopPt.z    + dz };
      sheer.stations[drag.idx].bottomPt = { x: drag.startBottomPt.x + lx, z: drag.startBottomPt.z + lz };
    }
    drag.moved = true;
    rebuildHull();
    renderSideView();
  } else if (drag.kind === 'sheer-tip-bow' || drag.kind === 'sheer-tip-stern') {
    const end = drag.kind === 'sheer-tip-bow' ? 'bow' : 'stern';
    (end === 'bow' ? state.bowSheer : state.sternSheer).tip = { x: wx, z: wz };
    drag.moved = true;
    rebuildHull();
    renderSideView();
  } else if (drag.kind === 'sheer-deck-bow' || drag.kind === 'sheer-deck-stern') {
    const end = drag.kind === 'sheer-deck-bow' ? 'bow' : 'stern';
    (end === 'bow' ? state.bowSheer : state.sternSheer).deckEndPt = { x: wx, z: wz };
    drag.moved = true;
    rebuildHull();
    renderSideView();
  } else if (drag.kind === 'sheer-start-bow' || drag.kind === 'sheer-start-stern') {
    // Drag the join point along the rocker.
    const end   = drag.kind === 'sheer-start-bow' ? 'bow' : 'stern';
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const spSampled = sampledSpine(state.spine, 64);
    const spineObj  = { ctrl: state.spine, sampled: spSampled };
    const newS = spineXToS(spineObj, wx);
    if (newS == null) return;
    // Keep stern < bow with a small margin, and ensure interior stations stay valid.
    if (end === 'bow') {
      sheer.startS = Math.max(state.sternSheer.startS + 0.1, Math.min(1.0, newS));
    } else {
      sheer.startS = Math.max(0.0, Math.min(state.bowSheer.startS - 0.1, newS));
    }
    drag.moved = true;
    rebuildHull();
    renderSideView();
  } else if (drag.kind === 'sheer-station') {
    // Drag a sheer station along its sheer profile.
    const sel   = listAllStations(state)[drag.idx];
    if (!sel || (sel.kind !== 'bowSheer' && sel.kind !== 'sternSheer')) return;
    const end   = sel.kind === 'bowSheer' ? 'bow' : 'stern';
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const spSampled = sampledSpine(state.spine, 64);
    // Find nearest t along the sheer keel line (world-space, not offset-space).
    const keelSmp = sampledSheerKeel(state, end, spSampled);
    let bestT = 0, bestDist = Infinity;
    for (let i = 0; i < keelSmp.pts.length; i++) {
      const d = Math.hypot(wx - keelSmp.pts[i].x, wz - keelSmp.pts[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestT = keelSmp.total > 0 ? keelSmp.arc[i] / keelSmp.total : 0;
      }
    }
    bestT = Math.max(0.05, Math.min(0.95, bestT));
    sel.ref.t = bestT;
    sheer.stations.sort((a, b) => a.t - b.t);
    // Re-resolve selectedStation index (since sort may have shuffled).
    const newIdx = sheer.stations.findIndex(s => s === sel.ref);
    const unified = listAllStations(state);
    state.selectedStation = unified.findIndex(e =>
      e.kind === sel.kind && e.stationIdx === newIdx
    );
    drag.moved = true;
    rebuildHull();
    renderSideView();
    renderStationList();
  } else if (drag.kind.startsWith('anchor-') || drag.kind.startsWith('handle-')) {
    const sp = state.spine;
    if (drag.kind === 'anchor-stern') {
      sp.stern.x = wx; sp.stern.z = wz;
    } else if (drag.kind === 'anchor-bow') {
      sp.bow.x = wx; sp.bow.z = wz;
    } else if (drag.kind === 'anchor-paddler') {
      // Clamp paddler X strictly between stern and bow so arc-length
      // parameterization stays monotonic.
      sp.paddler.x = Math.max(sp.stern.x + 0.05, Math.min(sp.bow.x - 0.05, wx));
      sp.paddler.z = wz;
    } else if (drag.kind === 'handle-stern') {
      sp.sternHandle.dx = wx - sp.stern.x;
      sp.sternHandle.dz = wz - sp.stern.z;
    } else if (drag.kind === 'handle-bow') {
      sp.bowHandle.dx = wx - sp.bow.x;
      sp.bowHandle.dz = wz - sp.bow.z;
    } else if (drag.kind === 'handle-paddler-fore') {
      const dx = wx - sp.paddler.x, dz = wz - sp.paddler.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.01) {
        sp.paddlerAngle   = Math.atan2(dz, dx);
        sp.paddlerForeLen = len;
      }
    } else if (drag.kind === 'handle-paddler-aft') {
      const dx = wx - sp.paddler.x, dz = wz - sp.paddler.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.01) {
        // Aft handle points in -dir, so angle is flipped.
        sp.paddlerAngle  = Math.atan2(-dz, -dx);
        sp.paddlerAftLen = len;
      }
    }
    state.length = sp.bow.x - sp.stern.x;
    lengthEl.value = state.length.toFixed(2);
    lengthOut.textContent = state.length.toFixed(2) + ' m';
    rebuildHull();
    renderSideView();
  } else if (drag.kind === 'station') {
    // Interior station drag along the rocker. drag.idx is the unified index.
    const sel = listAllStations(state)[drag.idx];
    if (!sel || sel.kind !== 'interior') return;
    const sampled = sampledSpine(state.spine, 32);
    const spine   = { ctrl: state.spine, sampled };
    const s       = spineXToS(spine, wx);
    // Clamp inside the active rocker range and between neighbors.
    const lo = state.sternSheer.startS + 0.02;
    const hi = state.bowSheer.startS   - 0.02;
    const stationIdx = sel.stationIdx;
    const minS = stationIdx === 0
      ? lo : Math.max(lo, state.stations[stationIdx - 1].s + 0.02);
    const maxS = stationIdx === state.stations.length - 1
      ? hi : Math.min(hi, state.stations[stationIdx + 1].s - 0.02);
    state.stations[stationIdx].s = Math.max(minS, Math.min(maxS, s));
    renderStationList();
    rebuildHull();
    renderSideView();
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

// ── Side-view sheer profile editing ──────────────────────────────────────
//
// Click empty space near a sheer profile to add a control point. Right-
// click a sheer-pt to delete it (keel and 2-point minimum protected).
// The handler determines which end (bow / stern) by which profile is
// closest to the click.

sideSvg.addEventListener('click', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('[data-drag]')) return;
  if (drag && drag.moved) return;

  const { x, y } = svgToLocal(sideSvg, e);
  const wx = x / SIDE_SCALE_X, wz = -y / SIDE_SCALE_Z;

  const spSampled = sampledSpine(state.spine, 64);
  const spineObj  = { ctrl: state.spine, sampled: spSampled };

  // Check proximity to deck line first.
  {
    const spSampledC = sampledSpine(state.spine, 64);
    const deckEvalC  = buildDeckSpline(state, spSampledC);
    const deckZ      = deckEvalC(wx);
    const distToDeck = Math.abs(wz - deckZ);
    if (distToDeck < 0.10) {
      // Insert keeping points sorted by x.
      const insertIdx = state.deckLine.points.findIndex(p => p.x > wx);
      if (insertIdx === -1) state.deckLine.points.push({ x: wx, z: wz });
      else state.deckLine.points.splice(insertIdx, 0, { x: wx, z: wz });
      rebuildHull();
      renderSideView();
      return;
    }
  }

  // Click near bottom or top sheer line → insert a station with both pts.
  const spSampledC2 = sampledSpine(state.spine, 64);
  let best = { dist: Infinity, end: null, onTop: false };
  for (const end of ['bow', 'stern']) {
    for (const onTop of [false, true]) {
      const curve = onTop
        ? sampledTopSheer (state, end, spSampledC2)
        : sampledSheerKeel(state, end, spSampledC2);
      for (let i = 0; i < curve.pts.length - 1; i++) {
        const a = curve.pts[i], b = curve.pts[i + 1];
        const ddx = b.x - a.x, ddz = b.y - a.y;
        const lenSq = ddx*ddx + ddz*ddz;
        let tt = lenSq > 0 ? ((wx-a.x)*ddx + (wz-a.y)*ddz) / lenSq : 0;
        tt = Math.max(0, Math.min(1, tt));
        const d = Math.hypot(wx - (a.x + tt*ddx), wz - (a.y + tt*ddz));
        if (d < best.dist) best = { dist: d, end, onTop };
      }
    }
  }
  if (best.dist > 0.15) return;

  const sheerC = best.end === 'bow' ? state.bowSheer : state.sternSheer;
  const kSamp2 = sampledSheerKeel(state, best.end, spSampledC2);
  const tSamp2 = sampledTopSheer (state, best.end, spSampledC2);
  const clickedSamp = best.onTop ? tSamp2 : kSamp2;
  let bestT = 0, bestD = Infinity;
  for (let i = 0; i < clickedSamp.pts.length; i++) {
    const d = Math.hypot(wx - clickedSamp.pts[i].x, wz - clickedSamp.pts[i].y);
    if (d < bestD) { bestD = d; bestT = clickedSamp.arc[i] / (clickedSamp.total || 1); }
  }
  bestT = Math.max(0.05, Math.min(0.95, bestT));
  const bPt = sampleAlong(kSamp2, bestT).p;
  const tPt = sampleAlong(tSamp2, bestT).p;
  const insertAt = sheerC.stations.findIndex(s => s.t > bestT);
  sheerC.stations.splice(insertAt < 0 ? sheerC.stations.length : insertAt, 0, {
    t: bestT,
    bottomPt: { x: bPt.x, z: bPt.z },
    topPt:    { x: tPt.x, z: tPt.z },
    points:   defaultSection(0.10),
  });
  rebuildHull();
  renderSideView();
});

sideSvg.addEventListener('contextmenu', (e) => {
  // Deck-pt delete
  const dTarget = e.target.closest('[data-drag="deck-pt"]');
  if (dTarget) {
    e.preventDefault();
    const idx = +dTarget.dataset.idx;
    if (idx < 0 || state.deckLine.points.length <= 1) return;
    state.deckLine.points.splice(idx, 1);
    // Re-index isn't needed — we use natural array index
    rebuildHull();
    renderSideView();
    return;
  }
  const target = e.target.closest('[data-drag^="sheer-bot-"],[data-drag^="sheer-top-"]');
  if (!target) return;
  e.preventDefault();
  const sIdx  = +target.dataset.idx;
  const endS  = target.dataset.drag.endsWith('-bow') ? 'bow' : 'stern';
  const sheer = endS === 'bow' ? state.bowSheer : state.sternSheer;
  if (sheer.stations.length <= 1) return;
  sheer.stations.splice(sIdx, 1);
  rebuildHull();
  renderSideView();
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
    station.points[i].b = Math.max(0, x / SECTION_SCALE);
    station.points[i].n = n;
  }
  sectionDrag.moved = true;
  renderSectionView();
  rebuildHull();
  renderSideView();
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
  const b = x / SECTION_SCALE;
  const n = -y / SECTION_SCALE_N;
  if (b < 0) return;
  const insertIdx = nearestSegmentInsertIdx(station.points, b, n);
  station.points.splice(insertIdx, 0, { b, n, chine: false });
  renderStationList();
  renderSectionView();
  rebuildHull();
  renderSideView();
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
renderSectionView();
