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
  selectedStation: 3,   // index into stations[] — midship of the default 5+2 layout
  // Spine: 2D control points in (X, Z). Endpoints are the bow/stern; interior
  // points shape the rocker. Phase A: hand-tuned placeholder, not editable.
  spine: spinePlaceholder(5.2),
  // Stations: each has a position s along the spine arc length (normalized
  // 0..1 between the endpoints) and a starboard-only section in (b, n).
  stations: stationsPlaceholder(),
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
  // Sections (kind 'interior') are closed loops in the local (b, n) frame:
  // first point at (b=0, n=0) is the keel-on-centerline, last point at
  // (b=0, n=deck) is the deck-on-centerline. Mirror to port closes the
  // hull both top and bottom along Y = 0.
  //
  // Bow / stern (kind 'endpoint') are stems — just the two centerline
  // points (keel and deck). With b=0 throughout the section the loft
  // collapses to a vertical edge at each end of the boat.
  const interiorParams = [0.15, 0.32, 0.50, 0.68, 0.85];
  const interior = interiorParams.map((s) => {
    const taper    = Math.sin(Math.PI * s);            // 0 at ends, 1 at midship
    const halfBeam = 0.18 + 0.12 * taper;
    return {
      s, kind: 'interior',
      points: defaultSection(halfBeam, DEFAULT_DECK_N),
    };
  });
  return [
    { s: 0, kind: 'endpoint', stemProfile: defaultStemProfile() },
    ...interior,
    { s: 1, kind: 'endpoint', stemProfile: defaultStemProfile() },
  ];
}

// Stem sheer profile: an ordered list of offsets (dx, dz) relative to the
// spine endpoint at that station. dx is longitudinal offset (+ toward bow),
// dz is vertical offset (+ upward). The bottom point is always (0, 0) —
// locked to the spine. The deck point is directly above by default. Adding
// intermediate points curves the stem profile in X-Z (visible in side view).
function defaultStemProfile() {
  return [
    { dx: 0, dz: 0 },            // keel-end — locked on spine
    { dx: 0, dz: DEFAULT_DECK_N },// deck-end — editable
  ];
}

// Closed-loop section: starboard half from keel-centerline up the side to
// the deck-centerline. The mirrored port half makes the full closed cross
// section. First and last points are constrained to the centerline (b=0).
function defaultSection(halfBeam, deckN) {
  return [
    { b: 0,                n: 0,             chine: false }, // keel (centerline)
    { b: halfBeam * 0.55,  n: 0.04,          chine: false },
    { b: halfBeam,         n: 0.16,          chine: false }, // beam-max
    { b: halfBeam * 0.55,  n: deckN - 0.03,  chine: false },
    { b: 0,                n: deckN,         chine: false }, // deck (centerline)
  ];
}

// Convert a stem sheer profile to a sampled (b=0, n) section for the loft
// pipeline. Each profile point (dx, dz) is an offset from the spine
// endpoint; n is computed by projecting onto the local-up direction
// (localNx, localNz), which is the spine tangent rotated 90° in X-Z.
function stemProfileToSection(stemProfile, localNx, localNz, N) {
  // Dense-sample the natural cubic through the profile in (dx, dz) space.
  const dense = sampleSpline(stemProfile, 'dx', 'dz', 24);
  const arc = [0];
  for (let i = 1; i < dense.length; i++)
    arc.push(arc[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  const total = arc[arc.length - 1] || 1;
  const samples = [];
  for (let k = 0; k < N; k++) {
    const target = (k / (N - 1)) * total;
    let lo = 0;
    while (lo < dense.length - 1 && arc[lo + 1] < target) lo++;
    const hi = Math.min(dense.length - 1, lo + 1);
    const t  = arc[hi] === arc[lo] ? 0 : (target - arc[lo]) / (arc[hi] - arc[lo]);
    const dx = dense[lo].x + t * (dense[hi].x - dense[lo].x);
    const dz = dense[lo].y + t * (dense[hi].y - dense[lo].y);
    samples.push({ b: 0, n: dx * localNx + dz * localNz });
  }
  return samples;
}

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

// Loft mesh. For each transverse sample index k, fit a natural cubic spline
// over normalized arc length s through the per-station (b_k, n_k) values
// (with degenerate endpoint stations contributing b=0, n=0). Sample those
// splines at M longitudinal positions, project to world via the spine
// frame, and stitch quads. Mirror starboard → port.
function buildLoft(state) {
  const sampled = sampledSpine(state.spine, 32);
  const spine = { ctrl: state.spine, sampled };

  const res = { low: { N: 32, M: 24 }, med: { N: 64, M: 36 }, high: { N: 128, M: 64 } }[state.loftRes];
  const N = res.N, M = res.M;

  // Sort stations by s (defensive — UI may not enforce ordering during drag).
  // state.stations now includes the bow & stern as 2-point stem stations
  // at s = 0 and s = 1, so we don't need synthetic degenerate endpoints.
  const stationsSorted = state.stations.slice().sort((a, b) => a.s - b.s);
  const ss             = stationsSorted.map(st => st.s);
  const stationSamples = stationsSorted.map(st => {
    if (st.kind === 'endpoint') {
      const { tx, tz } = spineAt(spine, st.s);
      return stemProfileToSection(st.stemProfile, -tz, tx, N);
    }
    return sampleSection(st.points, N);
  });

  // Per-transverse-index splines b_k(s), n_k(s).
  const bSplines = new Array(N);
  const nSplines = new Array(N);
  for (let k = 0; k < N; k++) {
    bSplines[k] = naturalCubicNonUniform(ss, stationSamples.map(samp => samp[k].b));
    nSplines[k] = naturalCubicNonUniform(ss, stationSamples.map(samp => samp[k].n));
  }

  // Sample at M longitudinal positions, build world-frame rows.
  const rows = new Array(M);
  for (let i = 0; i < M; i++) {
    const s = i / (M - 1);
    const { p, tx, tz } = spineAt(spine, s);
    const nx = -tz, nz = tx; // 90° CCW in X-Z; n̂ is local "up" perpendicular to spine
    const row = new Array(N);
    for (let k = 0; k < N; k++) {
      const b = bSplines[k](s);
      const n = nSplines[k](s);
      row[k] = {
        x: p.x + n * nx,
        y: b,
        z: p.z + n * nz,
      };
    }
    rows[i] = row;
  }

  // Starboard mesh + port mirror.
  const positions = [];
  const indices   = [];
  for (let i = 0; i < M; i++) {
    for (let k = 0; k < N; k++) {
      positions.push(rows[i][k].x, rows[i][k].z, rows[i][k].y);
    }
  }
  for (let i = 0; i < M - 1; i++) {
    for (let k = 0; k < N - 1; k++) {
      const a = i * N + k;
      const b = i * N + k + 1;
      const c = (i + 1) * N + k;
      const d = (i + 1) * N + k + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  const stbdVertCount = M * N;
  for (let i = 0; i < M; i++) {
    for (let k = 0; k < N; k++) {
      positions.push(rows[i][k].x, rows[i][k].z, -rows[i][k].y);
    }
  }
  for (let i = 0; i < M - 1; i++) {
    for (let k = 0; k < N - 1; k++) {
      const a = stbdVertCount + i * N + k;
      const b = stbdVertCount + i * N + k + 1;
      const c = stbdVertCount + (i + 1) * N + k;
      const d = stbdVertCount + (i + 1) * N + k + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Also project each station to world coords for 3D station bands +
  // side-view ticks. We tag each row with its station kind so renderers
  // can skip the bow / stern entries (those are degenerate stem-lines
  // already represented by the spine endpoints).
  const stationRows = stationsSorted.map((st, idx) => {
    const { p, tx, tz } = spineAt(spine, st.s);
    const nx = -tz, nz = tx;
    return {
      kind: st.kind,
      points: stationSamples[idx].map(({ b, n }) => ({
        x: p.x + n * nx, y: b, z: p.z + n * nz,
      })),
    };
  });

  return { positions, indices, rows, stationRows, spine, N, M };
}

// Sample the lofted section in (b, n) at any normalized arc length s.
// Used when adding a new station: the new station is seeded with a section
// matching the *current* loft at that s, so the surface is unchanged at
// the moment of insertion (per the plan's seed-from-current-loft rule).
//
// Returns an array of { b, n, chine: false } control points, count =
// `numPoints` (default 7), distributed evenly along the section's
// arc length, with the first point clamped to the keel (0, 0).
function sectionAtS(state, s, numPoints = 7) {
  const N_DENSE = 96;
  const stationsSorted = state.stations.slice().sort((a, b) => a.s - b.s);
  const ss             = stationsSorted.map(st => st.s);
  const spSampled      = sampledSpine(state.spine, 64);
  const spineObj       = { ctrl: state.spine, sampled: spSampled };
  const stationSamples = stationsSorted.map(st => {
    if (st.kind === 'endpoint') {
      const { tx, tz } = spineAt(spineObj, st.s);
      return stemProfileToSection(st.stemProfile, -tz, tx, N_DENSE);
    }
    return sampleSection(st.points, N_DENSE);
  });

  // Evaluate per-transverse-index splines at this s.
  const dense = new Array(N_DENSE);
  for (let k = 0; k < N_DENSE; k++) {
    const bSpline = naturalCubicNonUniform(ss, stationSamples.map(samp => samp[k].b));
    const nSpline = naturalCubicNonUniform(ss, stationSamples.map(samp => samp[k].n));
    dense[k] = { b: bSpline(s), n: nSpline(s) };
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
  points[0] = { b: 0, n: 0, chine: false };
  const last = numPoints - 1;
  points[last] = { b: 0, n: points[last].n, chine: false };
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

// Horizontal reference grid at Z = 0 (waterline plane).
// Three.js Y is up here, so the grid sits in the X-Z (Three.js) plane = the
// X-Y (world) plane = the waterline. Light lines on dark bg.
const grid = new THREE.GridHelper(8, 16, 0xe2e8f0, 0x64748b);
grid.position.y = 0;
grid.material.transparent = true;
grid.material.opacity = 0.85;
scene.add(grid);

// Centerline plane grid (the boat's longitudinal-vertical bisecting plane).
// In Three.js terms this is the X-Y plane at z = 0. Build it by rotating a
// horizontal GridHelper 90° about X. Slightly cooler color so the two
// reference planes are distinguishable at a glance.
const centerGrid = new THREE.GridHelper(6, 12, 0xa5b4fc, 0x475569);
centerGrid.rotation.x = Math.PI / 2;
centerGrid.material.transparent = true;
centerGrid.material.opacity = 0.6;
centerGrid.position.y = 0; // straddles the waterline
scene.add(centerGrid);

// Bright centerline at the intersection of the two grid planes — runs along
// the length of the boat at (Y_three=0, Z_three=0).
const centerlineMat  = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
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

  // Station bands: each interior station as a thin closed loop following
  // its section at its actual s, both starboard and port halves. Bow /
  // stern (kind 'endpoint') are degenerate stem lines already shown by
  // the spine endpoints in the side view, so we skip drawing bands for
  // them in the 3D view.
  const N = loft.N;
  loft.stationRows.forEach((entry, idx) => {
    if (entry.kind === 'endpoint') return;
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

  return loft;
}

let lastLoft = rebuildHull();

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

// Render loop.
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

const sideSvg    = document.getElementById('side-view');
const sectionSvg = document.getElementById('section-view');

// Side view scale constants — also used by drag-handler coordinate math.
// Return the deck-top n value for any station kind.
// For interior stations: the last control point's n.
// For endpoint stations: project the stemProfile's top point onto the local
// up direction (localNx, localNz) at that station's spine position.
function deckNOf(st, spine, localNx, localNz) {
  if (st.kind === 'endpoint') {
    const last = st.stemProfile[st.stemProfile.length - 1];
    return last.dx * localNx + last.dz * localNz;
  }
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

  // Sheer + keel silhouette traced along the spine.
  const samples = 80;
  const sheerPath = [];
  const keelPath  = [];
  const stations  = state.stations;
  for (let i = 0; i <= samples; i++) {
    const s  = i / samples;
    const sp = spineAt(spine, s);
    keelPath.push({ x: sp.p.x, z: sp.p.z });
    let sheerN;
    if (s <= stations[0].s) sheerN = deckNOf(stations[0], spine, -sp.tz, sp.tx);
    else if (s >= stations[stations.length - 1].s) sheerN = deckNOf(stations[stations.length - 1], spine, -sp.tz, sp.tx);
    else {
      sheerN = 0;
      for (let j = 0; j < stations.length - 1; j++) {
        const a = stations[j], b = stations[j + 1];
        if (s >= a.s && s <= b.s) {
          const t  = (s - a.s) / (b.s - a.s);
          // Sample spine local frame once for both aN and bN (approximation: same frame at this s)
          const aN = deckNOf(a, spine, -sp.tz, sp.tx);
          const bN = deckNOf(b, spine, -sp.tz, sp.tx);
          sheerN   = aN + t * (bN - aN);
          break;
        }
      }
    }
    // Sheer in world Z: project local n (up) using the spine's local frame.
    // For mild rocker, local up ≈ +Z, so this collapses to spine.z + sheerN.
    const nx = -sp.tz, nz = sp.tx;
    sheerPath.push({ x: sp.p.x + sheerN * nx, z: sp.p.z + sheerN * nz });
  }
  const silPts = [
    ...sheerPath.map(p => `${xOf(p.x).toFixed(2)},${yOf(p.z).toFixed(2)}`),
    ...keelPath.slice().reverse().map(p => `${xOf(p.x).toFixed(2)},${yOf(p.z).toFixed(2)}`),
  ];
  sideSvg.appendChild(el('polygon', { points: silPts.join(' '), class: 'silhouette' }));
  sideSvg.appendChild(el('path', {
    class: 'sheer',
    d: 'M ' + sheerPath.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L '),
  }));
  sideSvg.appendChild(el('path', {
    class: 'keel',
    d: 'M ' + keelPath.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L '),
  }));

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

  // Station markers along the spine — also draggable along arc length.
  // Bow / stern (kind 'endpoint') are visually represented by the spine
  // endpoint control points themselves, so we skip drawing extra ticks
  // there. Numbering shows interior position only (1..n_interior).
  let interiorIdx = 0;
  state.stations.forEach((st, i) => {
    if (st.kind === 'endpoint') return;
    interiorIdx += 1;
    const sp = spineAt(spine, st.s);
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
    }, String(interiorIdx)));
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

  // ── Stem sheer profile overlay (visible when an endpoint is selected) ──
  const selSt = state.stations[state.selectedStation];
  if (selSt && selSt.kind === 'endpoint') {
    const { p: ep } = spineAt(spine, selSt.s);

    // World-space profile points.
    const profileWorld = selSt.stemProfile.map(pt => ({
      x: ep.x + pt.dx, z: ep.z + pt.dz,
    }));

    // Draw the dense-sampled stem curve.
    const denseStem = sampleSpline(selSt.stemProfile, 'dx', 'dz', 24);
    sideSvg.appendChild(el('path', {
      class: 'stem-curve',
      d: 'M ' + denseStem.map(p => `${xOf(ep.x + p.x).toFixed(2)} ${yOf(ep.z + p.y).toFixed(2)}`).join(' L '),
    }));

    // Control points with hit halos.
    profileWorld.forEach((wp, i) => {
      const isKeel = i === 0;
      sideSvg.appendChild(el('circle', {
        cx: xOf(wp.x), cy: yOf(wp.z), r: 14,
        class: 'stem-hit' + (isKeel ? ' keel' : ''),
        'data-drag': 'stem-pt', 'data-idx': String(i),
      }));
      sideSvg.appendChild(el('circle', {
        cx: xOf(wp.x), cy: yOf(wp.z), r: 4.5,
        class: 'stem-pt' + (isKeel ? ' keel' : ''),
        'data-drag': 'stem-pt', 'data-idx': String(i),
      }));
    });

    // Hint along the side.
    sideSvg.appendChild(el('text', {
      x: xOf(ep.x) + (selSt.s === 0 ? -6 : 6),
      y: yOf(ep.z + DEFAULT_DECK_N / 2),
      class: 'label stem-hint',
      'text-anchor': selSt.s === 0 ? 'end' : 'start',
    }, 'sheer profile'));
  }
}

// Section-view scale constants — also used by drag-handler coordinate math.
const SECTION_SCALE = 600; // px/m

function renderSectionView() {
  sectionSvg.innerHTML = '';
  const bOf = (b) => b * SECTION_SCALE;
  const nOf = (n) => -n * SECTION_SCALE; // n is up; SVG y down

  const station    = state.stations[state.selectedStation];
  const isEndpoint = station.kind === 'endpoint';
  const lastIdx    = isEndpoint ? 1 : station.points.length - 1;

  // Centerline (b = 0).
  sectionSvg.appendChild(el('line', {
    x1: 0, y1: -240, x2: 0, y2: 120, class: 'axis',
  }));
  sectionSvg.appendChild(el('text', { x: 4, y: -230, class: 'label' }, 'centerline'));

  // Keel reference (n = 0, the spine in the local frame).
  sectionSvg.appendChild(el('line', {
    x1: -340, y1: nOf(0), x2: 340, y2: nOf(0), class: 'axis',
  }));
  sectionSvg.appendChild(el('text', {
    x: 320, y: nOf(0) + 11, class: 'label', 'text-anchor': 'end',
  }, 'keel (n = 0, on spine)'));

  if (isEndpoint) {
    // Stem station: the sheer profile is edited in the side view (orange
    // dots). Here we just show the projected local-frame outline (a nearly
    // vertical line at b=0) and direct the user to the side view.
    const spSampled = sampledSpine(state.spine, 64);
    const { tx, tz } = spineAt({ ctrl: state.spine, sampled: spSampled }, station.s);
    const localNx = -tz, localNz = tx;
    const nVals = station.stemProfile.map(pt => pt.dx * localNx + pt.dz * localNz);
    const nMin = Math.min(...nVals), nMax = Math.max(...nVals);
    sectionSvg.appendChild(el('line', {
      x1: bOf(0), y1: nOf(nMin), x2: bOf(0), y2: nOf(nMax),
      class: 'section-curve',
    }));
    sectionSvg.appendChild(el('text', {
      x: 0, y: nOf(nMax) - 12, class: 'label', 'text-anchor': 'middle',
    }, `deck n ≈ ${nMax.toFixed(3)} m`));
    sectionSvg.appendChild(el('text', {
      x: 0, y: 110, class: 'label', 'text-anchor': 'middle',
    }, 'stem station — edit sheer profile in the side view'));
  } else {
    // Closed-loop section: dense spline through all points (starts and
    // ends at b = 0 — the keel and deck centerlines).
    const dense = sampleSpline(station.points, 'b', 'n', 24);
    const stbdPath = 'M ' + dense.map(p => `${bOf( p.x).toFixed(2)} ${nOf(p.y).toFixed(2)}`).join(' L ');
    const portPath = 'M ' + dense.map(p => `${bOf(-p.x).toFixed(2)} ${nOf(p.y).toFixed(2)}`).join(' L ');
    sectionSvg.appendChild(el('path', { class: 'section-curve',  d: stbdPath }));
    sectionSvg.appendChild(el('path', { class: 'section-mirror', d: portPath }));
  }

  // Control points — interior stations only. Endpoints are edited in the
  // side view via the stem sheer profile; no ctrl-pt elements here.
  if (!isEndpoint) station.points.forEach((p, i) => {
    const isKeel       = i === 0;
    const isCenterline = isEndpoint || i === lastIdx;          // b locked to 0
    const cls = (isKeel ? 'keel ' : '') + (isCenterline ? 'centerline ' : '');
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
  }); // end if (!isEndpoint) forEach

  // Hint text — different for endpoints vs middle stations.
  if (isEndpoint) {
    sectionSvg.appendChild(el('text', {
      x: 0, y: 110, class: 'label', 'text-anchor': 'middle',
    }, 'stem station — edit sheer profile in the side view'));
  } else if (station.points.length <= 5) {
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
  let interiorIdx = 0;
  state.stations.forEach((st, i) => {
    const li = document.createElement('li');
    li.className = (i === state.selectedStation ? 'selected ' : '') +
                   (st.kind === 'endpoint' ? 'endpoint' : '');
    li.dataset.idx = String(i);
    const name = document.createElement('span');
    if (st.kind === 'endpoint') {
      name.textContent = (i === 0) ? 'Stern · s = 0.00' : 'Bow · s = 1.00';
    } else {
      interiorIdx += 1;
      name.textContent = `St ${interiorIdx}  ·  s = ${st.s.toFixed(2)}`;
    }
    const pips = document.createElement('span');
    pips.className = 'pips';
    const ptCount = st.kind === 'endpoint' ? st.stemProfile.length : st.points.length;
    pips.textContent = '●'.repeat(Math.min(ptCount, 9));
    li.append(name, pips);
    li.addEventListener('click', () => selectStation(i));
    stationsOl.appendChild(li);
  });
  const interiorCount = state.stations.length - 2;
  stationCount.textContent = `${interiorCount} interior · 2 ends`;
}

function stationLabelFor(i) {
  const st = state.stations[i];
  if (!st) return '';
  if (st.kind === 'endpoint') return (i === 0) ? 'Stern' : 'Bow';
  // Interior label: count interior stations preceding this index.
  let n = 0;
  for (let j = 0; j <= i; j++) if (state.stations[j].kind !== 'endpoint') n += 1;
  return String(n);
}

function selectStation(i) {
  state.selectedStation = ((i % state.stations.length) + state.stations.length) % state.stations.length;
  stationLabel.textContent = stationLabelFor(state.selectedStation);
  renderStationList();
  renderSectionView();
  renderSideView();
  rebuildHull();
  syncStationButtons();
}

document.getElementById('prev-station').addEventListener('click', () => selectStation(state.selectedStation - 1));
document.getElementById('next-station').addEventListener('click', () => selectStation(state.selectedStation + 1));

// ── Add / remove stations (phase D) ──────────────────────────────────────
//
// Adding: the new station is placed at the midpoint of the largest gap
// between adjacent station-knots (including the two degenerate endpoints
// at s = 0 and s = 1) so the auto-spread is sensible. The new section is
// seeded by sampling the *current* lofted geometry at that s, so the
// surface is identical at the moment of insertion (the loft just gets
// one extra knot pinning what was already there). After insertion the
// user can drag it around like any other station.
//
// Removing: deletes the currently selected station. The longitudinal
// cubic-spline gets one fewer constraint and re-fits, which can change
// the surface slightly — that's the natural consequence of fewer pinned
// sections, not a bug.

// Bounds are on *interior* stations only — bow / stern are always present.
const MAX_INTERIOR = 9;
const MIN_INTERIOR = 2;

function interiorCount() { return state.stations.length - 2; }

function addStation() {
  if (interiorCount() >= MAX_INTERIOR) return;
  // Largest gap between adjacent station knots (state.stations already
  // includes s = 0 stern and s = 1 bow as real entries).
  const sortedSs = state.stations.map(st => st.s).slice().sort((a, b) => a - b);
  let maxGap = 0, gapStart = 0;
  for (let i = 0; i < sortedSs.length - 1; i++) {
    const g = sortedSs[i + 1] - sortedSs[i];
    if (g > maxGap) { maxGap = g; gapStart = sortedSs[i]; }
  }
  const newS = gapStart + maxGap / 2;
  const points = sectionAtS(state, newS);

  state.stations.sort((a, b) => a.s - b.s);
  let insertIdx = state.stations.findIndex(st => st.s > newS);
  if (insertIdx === -1) insertIdx = state.stations.length;
  state.stations.splice(insertIdx, 0, { s: newS, kind: 'interior', points });
  state.selectedStation = insertIdx;
  stationLabel.textContent = stationLabelFor(state.selectedStation);

  renderStationList();
  renderSideView();
  renderSectionView();
  rebuildHull();
  syncStationButtons();
}

function removeStation() {
  const idx = state.selectedStation;
  const st  = state.stations[idx];
  if (!st || st.kind === 'endpoint') return;
  if (interiorCount() <= MIN_INTERIOR) return;
  state.stations.splice(idx, 1);
  state.selectedStation = Math.min(state.selectedStation, state.stations.length - 1);
  stationLabel.textContent = stationLabelFor(state.selectedStation);

  renderStationList();
  renderSideView();
  renderSectionView();
  rebuildHull();
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
  addStationBtn.disabled = interiorCount() >= MAX_INTERIOR;
  const sel = state.stations[state.selectedStation];
  removeStationBtn.disabled =
    interiorCount() <= MIN_INTERIOR || (sel && sel.kind === 'endpoint');
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
  renderSideView();
  rebuildHull();
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
  enabled: false,
  kernelRadius: 0.2,
  minDistance:  0.00001,
  maxDistance:  0.5,
  contrast:     4.0,
  output:       0,
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
  if (e.button !== 0) return; // primary button only
  const target = e.target.closest('[data-drag]');
  if (!target) return;
  e.preventDefault();
  drag = {
    kind: target.dataset.drag,
    idx:  +target.dataset.idx,
    moved: false,
    pointerId: e.pointerId,
  };
  if (drag.kind === 'station') selectStation(drag.idx);
  sideSvg.setPointerCapture(e.pointerId);
});

sideSvg.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = svgToLocal(sideSvg, e);
  const wx = x / SIDE_SCALE_X;
  const wz = -y / SIDE_SCALE_Z;
  drag.moved = true;

  if (drag.kind === 'stem-pt') {
    const i  = drag.idx;
    if (i === 0) return; // keel locked on spine
    const st = state.stations[state.selectedStation];
    if (!st || st.kind !== 'endpoint') return;
    const spSampled = sampledSpine(state.spine, 64);
    const { p: ep } = spineAt({ ctrl: state.spine, sampled: spSampled }, st.s);
    st.stemProfile[i] = { dx: wx - ep.x, dz: wz - ep.z };
    drag.moved = true;
    renderSideView();
    rebuildHull();
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
    renderSideView();
    rebuildHull();
  } else if (drag.kind === 'station') {
    const sampled = sampledSpine(state.spine, 32);
    const spine   = { ctrl: state.spine, sampled };
    const s       = spineXToS(spine, wx);
    // Keep stations strictly inside (0, 1) and ordered.
    const i       = drag.idx;
    const minS    = i === 0                              ? 0.01 : state.stations[i - 1].s + 0.01;
    const maxS    = i === state.stations.length - 1      ? 0.99 : state.stations[i + 1].s - 0.01;
    state.stations[i].s = Math.max(minS, Math.min(maxS, s));
    renderStationList();
    renderSideView();
    rebuildHull();
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

// ── Stem sheer profile editing (side view) ───────────────────────────────
//
// Click empty space near the stem to add a control point.
// Right-click a stem-pt to delete (keel protected; min 2 points).
// Drag a stem-pt to move it in (dx, dz) space.

sideSvg.addEventListener('click', (e) => {
  if (e.button !== 0) return;
  const st = state.stations[state.selectedStation];
  if (!st || st.kind !== 'endpoint') return;
  if (e.target.closest('[data-drag]')) return;
  if (drag && drag.moved) return;

  const { x, y } = svgToLocal(sideSvg, e);
  const wx = x / SIDE_SCALE_X, wz = -y / SIDE_SCALE_Z;

  const spSampled = sampledSpine(state.spine, 64);
  const spineObj  = { ctrl: state.spine, sampled: spSampled };
  const { p: ep } = spineAt(spineObj, st.s);
  const dx = wx - ep.x, dz = wz - ep.z;

  // Only add if click is near the existing stem curve.
  const pts = st.stemProfile;
  let minDist = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const ddx = b.dx - a.dx, ddz = b.dz - a.dz;
    const lenSq = ddx * ddx + ddz * ddz;
    let t = lenSq > 0 ? ((dx - a.dx) * ddx + (dz - a.dz) * ddz) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a.dx + t * ddx, pz = a.dz + t * ddz;
    minDist = Math.min(minDist, Math.hypot(dx - px, dz - pz));
  }
  const hitRadius = 0.12; // metres — snap zone
  if (minDist > hitRadius) return;

  // Insert in correct sorted order by dz.
  let insertIdx = pts.findIndex(p => p.dz > dz);
  if (insertIdx <= 0) insertIdx = 1;               // never before keel (0)
  if (insertIdx >= pts.length) insertIdx = pts.length - 1; // never after deck
  pts.splice(insertIdx, 0, { dx, dz });
  renderSideView();
  rebuildHull();
});

sideSvg.addEventListener('contextmenu', (e) => {
  const target = e.target.closest('[data-drag="stem-pt"]');
  if (!target) return;
  e.preventDefault();
  const i  = +target.dataset.idx;
  const st = state.stations[state.selectedStation];
  if (!st || st.kind !== 'endpoint') return;
  if (i === 0 || st.stemProfile.length <= 2) return; // protect keel + min 2
  st.stemProfile.splice(i, 1);
  renderSideView();
  rebuildHull();
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
  const i       = sectionDrag.idx;
  const station = state.stations[state.selectedStation];
  if (!station || station.kind === 'endpoint') return;
  if (i === 0) return; // keel locked at (0, 0) by the global rule
  const lastIdx      = station.points.length - 1;
  const isEndpoint   = station.kind === 'endpoint';
  const isCenterline = isEndpoint || i === lastIdx;
  const { x, y } = svgToLocal(sectionSvg, e);
  const n = -y / SECTION_SCALE;
  if (isCenterline) {
    // Centerline-locked: only n is editable; b stays at 0 so the deck
    // closes along the centerline plane.
    station.points[i].b = 0;
    station.points[i].n = n;
  } else {
    station.points[i].b = Math.max(0, x / SECTION_SCALE);
    station.points[i].n = n;
  }
  sectionDrag.moved = true;
  renderSectionView();
  rebuildHull();
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
  const station = state.stations[state.selectedStation];
  if (station.kind === 'endpoint') return;
  const { x, y } = svgToLocal(sectionSvg, e);
  const b = x / SECTION_SCALE;
  const n = -y / SECTION_SCALE;
  if (b < 0) return;
  const insertIdx = nearestSegmentInsertIdx(station.points, b, n);
  // nearestSegmentInsertIdx already returns a value in [1, points.length-1],
  // so the keel (0) and deck-end (last) are never displaced.
  station.points.splice(insertIdx, 0, { b, n, chine: false });
  renderStationList();
  renderSectionView();
  rebuildHull();
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
  const station = state.stations[state.selectedStation];
  if (station.kind === 'endpoint') return;
  if (i === 0 || i === station.points.length - 1) return;
  if (station.points.length <= 3) return;
  station.points.splice(i, 1);
  renderStationList();
  renderSectionView();
  rebuildHull();
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
