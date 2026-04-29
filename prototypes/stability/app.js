// Primary-stability prototype
// Prismatic-hull cross-section. All physics in SI. The hull section is
// represented as an open polyline from port gunwale → keel → starboard
// gunwale; the polygon-area / centroid / clip routines treat it as
// implicitly closed (line from last point back to first), which is the
// "open-deck" assumption.

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCALE = 280;          // px per metre in the hull-view SVG
const RHO_WATER = 1000;     // kg/m³
const G_ACC = 9.81;         // m/s²
const REF_URL = 'https://man.fas.org/dod-101/navy/docs/swos/dca/stg4-01.html';

const MARKER_TIPS = {
  K: {
    label: 'K — Keel (body-frame reference)',
    desc: 'The keel reference: the lowest point of the hull on the centerline. All K-prefixed distances — KB, KG, KM — are measured vertically upward from K in the body (boat-fixed) frame. K tracks the center control point as the hull is reshaped.',
  },
  B: {
    label: 'B — Centre of buoyancy',
    desc: 'The centroid of the displaced (submerged) volume. The buoyant force acts vertically upward through B. As the hull heels, B shifts toward the immersed side — this shift is what generates the righting moment.',
  },
  G: {
    label: 'G — Centre of gravity',
    desc: 'The centroid of the boat\'s total mass (hull + crew + gear). Gravity acts vertically downward through G. Its height KG is set by the loaded condition (slider). Raising G reduces GM and stability.',
  },
  M: {
    label: 'M — Metacentre',
    desc: 'For small heel angles, the vertical line of buoyancy action passes through a fixed point M on the body\'s centerline. KM = KB + BM. GM = KM − KG: positive ⇒ initially stable, negative ⇒ unstable. M is a small-angle approximation; it moves at large heel.',
  },
};

const state = {
  length: 5.0,
  mass: 100,
  KG: 0.20,
  heel: 0,
  hullPoints: defaultHull(),
};

function defaultHull() {
  // Symmetric kayak-ish section: beam ≈ 0.55 m, depth ≈ 0.30 m, U-shape
  return [
    { x: -0.275, y: 0.30 },  // port gunwale
    { x: -0.265, y: 0.18 },
    { x: -0.225, y: 0.08 },
    { x: -0.140, y: 0.02 },
    { x:  0.000, y: 0.00 },  // keel (body-frame origin)
    { x:  0.140, y: 0.02 },
    { x:  0.225, y: 0.08 },
    { x:  0.265, y: 0.18 },
    { x:  0.275, y: 0.30 },  // starboard gunwale
  ];
}

// ── Natural cubic spline (parametric, unit-spaced knots) ─────────────────
// Solves for second derivatives with natural BCs (M_0 = M_{n-1} = 0) via
// the Thomas algorithm, then samples each span. Used to smooth the hull
// outline; the densified polyline is fed into BOTH rendering and the
// area/centroid/waterline math so visual and physics agree.

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

function densifyHull(points, samplesPerSpan = 16) {
  const n = points.length;
  if (n < 3) return points.slice();
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
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

// ── Geometry primitives ──────────────────────────────────────────────────

function rot(p, t) {
  const c = Math.cos(t), s = Math.sin(t);
  return { x: c * p.x - s * p.y, y: s * p.x + c * p.y };
}
const rotAll = (pts, t) => pts.map(p => rot(p, t));

// Positive heel = boat tilts to starboard (CW from stern view in physics frame).
// In our +x=stbd, +y=up frame, that's a NEGATIVE rotation angle.
const bodyToWorld = (p, heelDeg) => rot(p, -heelDeg * Math.PI / 180);
const worldToBody = (p, heelDeg) => rot(p, +heelDeg * Math.PI / 180);

function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function polyCentroid(pts) {
  const a = polyArea(pts);
  if (Math.abs(a) < 1e-12) return { x: 0, y: 0 };
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const cr = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cr;
    cy += (p.y + q.y) * cr;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

// Clip closed polygon against the half-plane y ≤ y_w. Sutherland–Hodgman.
function clipBelow(poly, y_w) {
  const n = poly.length;
  if (n === 0) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const curr = poly[i];
    const prev = poly[(i - 1 + n) % n];
    const ci = curr.y <= y_w;
    const pi = prev.y <= y_w;
    if (ci) {
      if (!pi) {
        const t = (y_w - prev.y) / (curr.y - prev.y);
        out.push({ x: prev.x + t * (curr.x - prev.x), y: y_w });
      }
      out.push(curr);
    } else if (pi) {
      const t = (y_w - prev.y) / (curr.y - prev.y);
      out.push({ x: prev.x + t * (curr.x - prev.x), y: y_w });
    }
  }
  return out;
}

// Bisect on waterline height in world frame so submerged area = target.
function solveWaterline(worldPoly, targetArea) {
  const ys = worldPoly.map(p => p.y);
  let lo = Math.min(...ys) - 0.005;
  let hi = Math.max(...ys) + 0.005;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const a = Math.abs(polyArea(clipBelow(worldPoly, mid)));
    if (a < targetArea) lo = mid; else hi = mid;
  }
  const y_w = (lo + hi) / 2;
  const submerged = clipBelow(worldPoly, y_w);
  return { y_w, submerged, area: Math.abs(polyArea(submerged)) };
}

// Intersections of waterline with the open hull polyline (deck closure excluded).
function waterlineHits(worldPoly, y_w) {
  const hits = [];
  for (let i = 0; i < worldPoly.length - 1; i++) {
    const a = worldPoly[i], b = worldPoly[i + 1];
    if ((a.y <= y_w && b.y > y_w) || (a.y > y_w && b.y <= y_w)) {
      const t = (y_w - a.y) / (b.y - a.y);
      hits.push({ x: a.x + t * (b.x - a.x), y: y_w });
    }
  }
  hits.sort((u, v) => u.x - v.x);
  return hits;
}

// ── Stability ────────────────────────────────────────────────────────────

function compute(st) {
  const bodyPoly = densifyHull(st.hullPoints);
  const bodyArea = Math.abs(polyArea(bodyPoly));
  const targetVolume = st.mass / RHO_WATER;
  const targetArea = targetVolume / st.length;

  if (targetArea >= bodyArea) {
    return { error: 'awash', bodyArea, targetArea };
  }

  const worldPoly = bodyPoly.map(p => bodyToWorld(p, st.heel));
  const { y_w, submerged, area: subArea } = solveWaterline(worldPoly, targetArea);
  if (submerged.length < 3) return { error: 'no submerged area' };

  const B_world = polyCentroid(submerged);
  const B_body = worldToBody(B_world, st.heel);

  // K is the keel reference: lowest centerline point of the hull. By the
  // symmetric-edit invariant (setPointSymmetric), the middle control point
  // is locked to x = 0, so its y is the keel height in the body frame.
  const centerIdx = (st.hullPoints.length - 1) / 2 | 0;
  const keelY = st.hullPoints[centerIdx].y;
  const K_body = { x: 0, y: keelY };
  const K_world = bodyToWorld(K_body, st.heel);

  const G_body = { x: 0, y: keelY + st.KG };
  const G_world = bodyToWorld(G_body, st.heel);

  const KB = B_body.y - K_body.y;

  const hits = waterlineHits(worldPoly, y_w);
  const b_wl = hits.length >= 2
    ? Math.abs(hits[hits.length - 1].x - hits[0].x)
    : 0;

  // Prismatic hull, rectangular waterplane: I_T = L·b³/12, V = L·A_sub
  const BM = (b_wl ** 3) / (12 * subArea);
  const KM = KB + BM;
  const GM = KM - st.KG;

  const M_body = { x: 0, y: keelY + KM };
  const M_world = bodyToWorld(M_body, st.heel);

  const GZ = B_world.x - G_world.x;
  const V_sub = subArea * st.length;
  const Delta = RHO_WATER * V_sub;

  return {
    error: null,
    bodyArea, subArea, V_sub, Delta,
    y_w, b_wl,
    K_body, K_world, B_body, B_world, G_body, G_world, M_body, M_world,
    KB, BM, KM, KG: st.KG, GM, GZ,
    worldPoly, submerged, hits,
  };
}

// ── Variable metadata ────────────────────────────────────────────────────

const fmt = (v, u, d = 4) => v == null || isNaN(v) ? '—' : v.toFixed(d) + (u ? ' ' + u : '');

const VARS = [
  { key: 'L', name: 'L', desc: 'Hull length',
    short: 'Length of the prismatic hull along its long axis.',
    long:  'The hull is assumed prismatic — the cross-section is constant along this length. So the hull volume is V = A_section · L, and the displaced volume is V_sub = A_sub · L.',
    value: (r, st) => fmt(st.length, 'm', 2) },

  { key: 'mass', name: 'm', desc: 'Loaded mass',
    short: 'Total mass of boat + crew + gear (slider).',
    value: (r, st) => fmt(st.mass, 'kg', 1) },

  { key: 'rho', name: 'ρ', desc: 'Water density (constant)',
    short: 'Mass per unit volume of fresh water (1000 kg/m³).',
    value: () => '1000 kg/m³' },

  { key: 'K', name: 'K', desc: 'Keel — body-frame reference',
    short: MARKER_TIPS.K.desc,
    value: (r) => `(0, ${r.K_body.y.toFixed(3)}) m` },

  { key: 'B', name: 'B', desc: 'Centre of buoyancy',
    short: MARKER_TIPS.B.desc,
    equation: 'B = centroid of submerged cross-section\nB_body = worldToBody( centroid(submerged polygon) )',
    inputs: (r) => [
      ['submerged area', fmt(r.subArea, 'm²', 5)],
      ['B_world.x',      fmt(r.B_world.x, 'm', 4)],
      ['B_world.y',      fmt(r.B_world.y, 'm', 4)],
    ],
    output: (r) => `B_body = (${fmt(r.B_body.x, 'm', 4)}, ${fmt(r.B_body.y, 'm', 4)})`,
    value:  (r) => `(${r.B_body.x.toFixed(3)}, ${r.B_body.y.toFixed(3)}) m` },

  { key: 'G', name: 'G', desc: 'Centre of gravity',
    short: MARKER_TIPS.G.desc,
    equation: 'G_body = (0, KG)  — fixed in body frame, set by slider',
    inputs: (r, st) => [['KG', fmt(st.KG, 'm', 3)]],
    output: (r) => `G_body = (0, ${fmt(r.G_body.y, 'm', 4)})`,
    value:  (r) => `(0, ${r.G_body.y.toFixed(3)}) m` },

  { key: 'M', name: 'M', desc: 'Metacentre',
    short: MARKER_TIPS.M.desc,
    equation: 'M_body = (0, KM) = (0, KB + BM)',
    inputs: (r) => [['KB', fmt(r.KB, 'm', 4)], ['BM', fmt(r.BM, 'm', 4)]],
    output: (r) => `M_body = (0, ${fmt(r.KM, 'm', 4)})`,
    value:  (r) => `(0, ${r.KM.toFixed(3)}) m` },

  { key: 'A_sub', name: 'A_sub', desc: 'Submerged section area',
    short: 'Cross-sectional area below the waterline.',
    long:  'Solved so that A_sub · L · ρ = m, balancing buoyancy against weight.',
    equation: 'A_sub = m / (ρ · L)',
    inputs: (r, st) => [['m', fmt(st.mass, 'kg', 1)], ['ρ', '1000 kg/m³'], ['L', fmt(st.length, 'm', 2)]],
    output:  (r) => fmt(r.subArea, 'm²', 5),
    value:   (r) => fmt(r.subArea, 'm²', 5) },

  { key: 'V_sub', name: 'V_sub', desc: 'Displaced volume',
    short: 'Volume of water displaced by the submerged hull.',
    equation: 'V_sub = A_sub · L',
    inputs: (r, st) => [['A_sub', fmt(r.subArea, 'm²', 5)], ['L', fmt(st.length, 'm', 2)]],
    output:  (r) => fmt(r.V_sub, 'm³', 5),
    value:   (r) => fmt(r.V_sub, 'm³', 5) },

  { key: 'Delta', name: 'Δ', desc: 'Displacement (mass)',
    short: 'Mass of water displaced — equal to the loaded mass at equilibrium.',
    equation: 'Δ = ρ · V_sub',
    inputs: (r) => [['ρ', '1000 kg/m³'], ['V_sub', fmt(r.V_sub, 'm³', 5)]],
    output:  (r) => fmt(r.Delta, 'kg', 2),
    value:   (r) => fmt(r.Delta, 'kg', 2) },

  { key: 'b', name: 'b', desc: 'Waterline beam',
    short: 'Width of the waterplane: distance between the two waterline-hull intersections (world frame).',
    value: (r) => fmt(r.b_wl, 'm', 4) },

  { key: 'KB', name: 'KB', desc: 'Height of B above K',
    short: 'Vertical body-frame distance from the keel reference K to the centre of buoyancy B.',
    equation: 'KB = (B in body frame).y − K.y',
    inputs: (r) => [['B_body.y', fmt(r.B_body.y, 'm', 4)], ['K.y', '0.0000 m']],
    output:  (r) => fmt(r.KB, 'm', 4),
    value:   (r) => fmt(r.KB, 'm', 4) },

  { key: 'BM', name: 'BM', desc: 'Metacentric radius',
    short: 'Vertical distance from B up to the metacentre M.',
    long:  'BM = I_T / V_sub, where I_T is the transverse moment of inertia of the waterplane about its centroidal longitudinal axis. For a prismatic hull with rectangular waterplane (length L, beam b): I_T = L·b³/12 and V_sub = L·A_sub, so BM simplifies to b³ / (12·A_sub).',
    equation: 'BM = I_T / V_sub = b³ / (12 · A_sub)',
    inputs: (r) => [['b',     fmt(r.b_wl, 'm', 4)], ['A_sub', fmt(r.subArea, 'm²', 5)]],
    output:  (r) => fmt(r.BM, 'm', 4),
    value:   (r) => fmt(r.BM, 'm', 4) },

  { key: 'KM', name: 'KM', desc: 'Height of M above K',
    short: 'Vertical body-frame distance from keel to metacentre.',
    equation: 'KM = KB + BM',
    inputs: (r) => [['KB', fmt(r.KB, 'm', 4)], ['BM', fmt(r.BM, 'm', 4)]],
    output:  (r) => fmt(r.KM, 'm', 4),
    value:   (r) => fmt(r.KM, 'm', 4) },

  { key: 'KG', name: 'KG', desc: 'Height of G above K',
    short: 'Vertical position of the centre of gravity above the keel reference (slider).',
    value: (r, st) => fmt(st.KG, 'm', 3) },

  { key: 'GM', name: 'GM', desc: 'Metacentric height',
    short: 'KM − KG. Positive ⇒ initially stable; the larger, the stiffer.',
    long:  'GM is the single most important small-angle stability number. The initial restoring moment is W·GM·sin θ ≈ W·GM·θ for small heel θ. Negative GM means upright is unstable — the boat heels away from upright.',
    equation: 'GM = KM − KG',
    inputs: (r) => [['KM', fmt(r.KM, 'm', 4)], ['KG', fmt(r.KG, 'm', 4)]],
    output:  (r) => fmt(r.GM, 'm', 4),
    value:   (r) => fmt(r.GM, 'm', 4) },

  { key: 'GZ', name: 'GZ', desc: 'Righting arm',
    short: 'Horizontal distance from G to the line of buoyancy through B.',
    long:  'The restoring moment that pushes the boat back to upright is W·GZ. For small heel angles, GZ ≈ GM·sin θ. Here we compute it directly as the world-frame horizontal offset between G and B, which holds at any heel.',
    equation: 'GZ = B_world.x − G_world.x',
    inputs: (r) => [['B_world.x', fmt(r.B_world.x, 'm', 4)], ['G_world.x', fmt(r.G_world.x, 'm', 4)]],
    output:  (r) => fmt(r.GZ, 'm', 4),
    value:   (r) => fmt(r.GZ, 'm', 4) },

  // ── Secondary-stability metrics (derived from the GZ curve) ────────────
  { key: 'GZ30', name: 'GZ@30°', desc: 'Righting arm at 30° heel',
    short: 'GZ evaluated at exactly 30° of heel — a common single-number proxy for secondary stability.',
    long:  'Where GM characterizes stability at zero heel, GZ@30° characterizes it well past the small-angle regime. Recommended by some small-craft assessments (e.g. ISO 12217 for sailboats) as a sanity check that the hull still has a strong righting arm at moderate heel.',
    equation: 'GZ(30°) — interpolated from the GZ curve',
    inputs: (r) => [['curve sample at 30°', r.secondary?.GZ30 == null ? '—' : fmt(r.secondary.GZ30, 'm', 4)]],
    output:  (r) => fmt(r.secondary?.GZ30, 'm', 4),
    value:   (r) => fmt(r.secondary?.GZ30, 'm', 4) },

  { key: 'GZpeak', name: 'GZ_peak', desc: 'Peak righting arm (secondary)',
    short: 'Maximum value of GZ over the positive lobe of the curve. The hull is at its strongest "lock-in" here.',
    long:  'Peak GZ is the most direct measure of secondary stability: it is the largest restoring lever the hull can produce at any heel. Higher peak ⇒ harder to push past the lean-and-hold point. Driven primarily by topside shape (flare ↑, tumblehome ↓).',
    equation: 'GZ_peak = max φ∈[0, AVS] GZ(φ)',
    inputs: (r) => [['samples', '76 in 0°–150°'], ['φ at peak', r.secondary?.phiPeak == null ? '—' : r.secondary.phiPeak.toFixed(1) + '°']],
    output:  (r) => fmt(r.secondary?.peakGZ, 'm', 4),
    value:   (r) => fmt(r.secondary?.peakGZ, 'm', 4) },

  { key: 'phiPeak', name: 'φ_peak', desc: 'Heel at peak GZ',
    short: 'The heel angle at which GZ is largest — i.e. where the boat "feels most locked in" on edge.',
    long:  'A low φ_peak means the hull develops its full righting arm quickly (good for a beginner-friendly hull); a high φ_peak means the hull keeps gaining righting moment well into a lean (rewards leaned turns). Traditional sea kayaks tend to peak around 25°–40°.',
    value: (r) => r.secondary?.phiPeak == null ? '—' : r.secondary.phiPeak.toFixed(1) + '°' },

  { key: 'AVS', name: 'AVS', desc: 'Angle of vanishing stability',
    short: 'The first heel past upright at which GZ crosses zero. Beyond AVS the boat wants to roll the rest of the way over.',
    long:  'AVS sets the absolute outer limit of static stability: at this heel the righting arm has decayed to zero, and any further heel produces a capsizing rather than a righting moment. Driven mostly by reserve buoyancy in the topsides / deck. Traditional sea kayaks often have AVS in the 90°–150° range; SUPs much less.',
    equation: 'AVS = first φ > 0 where GZ(φ) = 0  (after GZ has been positive)',
    inputs: (r) => {
      const s = r.secondary || {};
      return [
        ['GZ_peak',      s.peakGZ == null ? '—' : fmt(s.peakGZ, 'm', 4)],
        ['sweep range',  '0° – 150°'],
        ['reached?',     s.reachedAVS ? 'yes' : 'no, GZ still > 0 at sweep end'],
      ];
    },
    output:  (r) => r.secondary?.AVS == null ? '> 150° (not reached)' : r.secondary.AVS.toFixed(1) + '°',
    value:   (r) => r.secondary?.AVS == null ? '> 150°' : r.secondary.AVS.toFixed(1) + '°' },

  { key: 'A_GZ', name: 'A_GZ', desc: 'Area under GZ curve (energy reserve)',
    short: 'Integral of GZ over the positive lobe (m·rad). Times Δ·g it is the energy needed to roll the hull from upright to AVS.',
    long:  'Sometimes called dynamic stability. Where peak GZ measures how hard the hull pushes back, A_GZ measures the total work a wave or paddler error must do to capsize it — a "reserve" account. A hull with modest peak but wide range can have more A_GZ than one with a tall, narrow peak.',
    equation: 'A_GZ = ∫₀^AVS GZ(φ) dφ      (trapezoidal, φ in radians)',
    inputs: (r) => {
      const s = r.secondary || {};
      const energy = (s.A_GZ != null && r.Delta) ? r.Delta * G_ACC * s.A_GZ : null;
      return [
        ['lobe end',          s.AVS == null ? `${s.sweepMax?.toFixed(0) ?? '—'}° (sweep)` : s.AVS.toFixed(1) + '°'],
        ['Δ·g·A_GZ (energy)', energy == null ? '—' : fmt(energy, 'J', 1)],
      ];
    },
    output:  (r) => fmt(r.secondary?.A_GZ, 'm·rad', 4),
    value:   (r) => fmt(r.secondary?.A_GZ, 'm·rad', 4) },
];

// ── SVG helpers ──────────────────────────────────────────────────────────

const hullSvg = document.getElementById('hull-view');
const gzSvg   = document.getElementById('gz-curve');

function el(tag, attrs = {}, ...children) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

const sx = (x) => x * SCALE;
const sy = (y) => -y * SCALE;        // physics +y is up; SVG +y is down

function arrowDefs() {
  return el('defs', {},
    el('marker', { id: 'gz-arrow-h', viewBox: '0 0 10 10', refX: 9, refY: 5,
                   markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#f59e0b' })));
}

// ── Hull view render ─────────────────────────────────────────────────────

function renderHull(r) {
  hullSvg.innerHTML = '';
  hullSvg.appendChild(arrowDefs());

  if (r.error) {
    hullSvg.appendChild(el('text',
      { x: 0, y: 0, 'text-anchor': 'middle', 'font-size': 14, fill: '#991b1b' },
      r.error === 'awash'
        ? 'Hull is awash — section area too small for this mass / length.'
        : 'No submerged area.'));
    // still draw the (un-submerged) hull so user can see what they're editing
    drawHullOutline(r);
    drawControlPoints();
    return;
  }

  // Water (large rectangle below waterline)
  hullSvg.appendChild(el('rect', {
    x: -10000, y: sy(r.y_w), width: 20000, height: 20000, class: 'water',
  }));

  // Submerged region
  if (r.submerged.length >= 3) {
    const d = r.submerged.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`
    ).join(' ') + ' Z';
    hullSvg.appendChild(el('path', { d, class: 'submerged' }));
  }

  drawHullOutline(r);

  // Waterline (only the visible segment between intersections, extended)
  if (r.hits.length >= 2) {
    const a = r.hits[0], b = r.hits[r.hits.length - 1];
    hullSvg.appendChild(el('line', {
      x1: sx(a.x) - 40, y1: sy(a.y),
      x2: sx(b.x) + 40, y2: sy(b.y),
      class: 'waterline',
    }));
  }

  // Body vertical line K → M (rotated; extended slightly past M)
  const kx = r.K_world.x, ky = r.K_world.y;
  const mx = r.M_world.x, my = r.M_world.y;
  const dxv = mx - kx, dyv = my - ky;
  const lenv = Math.hypot(dxv, dyv);
  if (lenv > 1e-4) {
    const ext = 0.04;
    const ux = dxv / lenv, uy = dyv / lenv;
    hullSvg.appendChild(el('line', {
      x1: sx(kx - ux * ext), y1: sy(ky - uy * ext),
      x2: sx(mx + ux * ext), y2: sy(my + uy * ext),
      class: 'body-vertical',
    }));
  }

  // Gravity vertical (downward through G in world frame)
  hullSvg.appendChild(el('line', {
    x1: sx(r.G_world.x), y1: sy(r.G_world.y + 0.06),
    x2: sx(r.G_world.x), y2: sy(r.G_world.y - 0.30),
    class: 'gravity-line',
  }));

  // Buoyancy vertical (upward through B in world frame)
  hullSvg.appendChild(el('line', {
    x1: sx(r.B_world.x), y1: sy(r.B_world.y - 0.02),
    x2: sx(r.B_world.x), y2: sy(r.B_world.y + 0.40),
    class: 'buoyancy-line',
  }));

  // GZ horizontal arrow at G's vertical level, from G to directly below/above B
  if (Math.abs(r.GZ) > 1e-4) {
    const arrow = el('line', {
      x1: sx(r.G_world.x), y1: sy(r.G_world.y),
      x2: sx(r.B_world.x), y2: sy(r.G_world.y),
      class: 'gz-arrow',
      'marker-end': 'url(#gz-arrow-h)',
    });
    hullSvg.appendChild(arrow);
    const labelX = (sx(r.G_world.x) + sx(r.B_world.x)) / 2;
    hullSvg.appendChild(el('text', {
      x: labelX, y: sy(r.G_world.y) - 7, 'text-anchor': 'middle', class: 'gz-label',
    }, `GZ = ${r.GZ.toFixed(3)} m`));
  }

  // K, B, G, M markers
  drawMarker('K', r.K_world, 'k');
  drawMarker('B', r.B_world, 'b');
  drawMarker('G', r.G_world, 'g');
  drawMarker('M', r.M_world, 'm');

  drawControlPoints();
}

function drawHullOutline(r) {
  const pts = (r.worldPoly || densifyHull(state.hullPoints).map(p => bodyToWorld(p, state.heel)))
    .map(p => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ');
  hullSvg.appendChild(el('polyline', { points: pts, class: 'hull' }));
}

function drawMarker(letter, p, cls) {
  // Transparent hit-area circle (larger radius) so hover is easy to trigger
  hullSvg.appendChild(el('circle', {
    cx: sx(p.x), cy: sy(p.y), r: 14,
    class: 'hull-tip', 'data-marker-key': letter,
    fill: 'transparent', stroke: 'none',
  }));
  hullSvg.appendChild(el('circle', {
    cx: sx(p.x), cy: sy(p.y), r: 4.5, class: 'marker marker-' + cls,
    style: 'pointer-events: none',
  }));
  hullSvg.appendChild(el('text', {
    x: sx(p.x) + 9, y: sy(p.y) + 4,
    class: 'marker-label hull-tip', 'data-marker-key': letter,
  }, letter));
}

function drawControlPoints() {
  const n = state.hullPoints.length;
  state.hullPoints.forEach((p, i) => {
    const wp = bodyToWorld(p, state.heel);
    const isCenter = i === (n - 1) - i;
    hullSvg.appendChild(el('circle', {
      cx: sx(wp.x), cy: sy(wp.y), r: 6,
      class: 'control-point' + (isCenter ? ' control-point-center' : ''),
      'data-idx': i,
    }));
  });
}

// Symmetric edit: dragging point i also mirrors its pair across x = 0.
// Port-side points (i < center) are clamped to x ≤ 0; starboard to x ≥ 0;
// the center point is locked to x = 0 (vertical motion only).
function setPointSymmetric(idx, pos) {
  const n = state.hullPoints.length;
  const mirror = n - 1 - idx;
  if (idx === mirror) {
    state.hullPoints[idx] = { x: 0, y: pos.y };
    return;
  }
  const isPort = idx < mirror;
  let x = pos.x;
  if (isPort && x > 0) x = 0;
  if (!isPort && x < 0) x = 0;
  state.hullPoints[idx]    = { x:  x, y: pos.y };
  state.hullPoints[mirror] = { x: -x, y: pos.y };
}

// ── GZ curve render ──────────────────────────────────────────────────────

function renderGZCurve(curve, secondary) {
  gzSvg.innerHTML = '';
  const xMin = 25, xMax = 295, yMid = 0;
  const angleMin = -150, angleMax = 150;

  const valid = curve.filter(c => c.GZ != null);
  if (valid.length === 0) return;
  const maxAbs = Math.max(...valid.map(c => Math.abs(c.GZ)), 0.05);

  const xOf = (deg) => xMin + (deg - angleMin) / (angleMax - angleMin) * (xMax - xMin);
  const yOf = (gz)  => yMid - gz / maxAbs * 90;

  // Grid
  const gridGZ = [-maxAbs, -maxAbs/2, 0, maxAbs/2, maxAbs];
  for (const gz of gridGZ) {
    gzSvg.appendChild(el('line', {
      x1: xMin, y1: yOf(gz), x2: xMax, y2: yOf(gz),
      class: gz === 0 ? 'axis' : 'grid',
    }));
    gzSvg.appendChild(el('text', {
      x: xMin - 4, y: yOf(gz) + 3, 'text-anchor': 'end', class: 'label',
    }, gz.toFixed(2)));
  }
  // Vertical axis at heel = 0
  gzSvg.appendChild(el('line', { x1: xOf(0), y1: yOf(maxAbs)-2, x2: xOf(0), y2: yOf(-maxAbs)+2, class: 'axis' }));

  // Heel-axis ticks
  for (const deg of [-150, -90, -45, 0, 45, 90, 150]) {
    gzSvg.appendChild(el('line', {
      x1: xOf(deg), y1: yOf(-maxAbs), x2: xOf(deg), y2: yOf(-maxAbs)+3, class: 'axis',
    }));
    gzSvg.appendChild(el('text', {
      x: xOf(deg), y: yOf(-maxAbs) + 13, 'text-anchor': 'middle', class: 'label',
    }, deg + '°'));
  }

  // Shaded area under positive lobe (0 → AVS, or sweep end)
  const lobeEnd = secondary?.AVS != null ? secondary.AVS : (secondary?.sweepMax ?? angleMax);
  const lobePts = valid.filter(c => c.heel >= 0 && c.heel <= lobeEnd && c.GZ > 0);
  if (lobePts.length >= 2) {
    let d = `M ${xOf(0).toFixed(2)} ${yOf(0).toFixed(2)}`;
    for (const c of lobePts) d += ` L ${xOf(c.heel).toFixed(2)} ${yOf(c.GZ).toFixed(2)}`;
    d += ` L ${xOf(lobeEnd).toFixed(2)} ${yOf(0).toFixed(2)} Z`;
    gzSvg.appendChild(el('path', { d, class: 'area' }));
  }

  // Curve
  const d = valid.map((c, i) =>
    `${i === 0 ? 'M' : 'L'} ${xOf(c.heel).toFixed(2)} ${yOf(c.GZ).toFixed(2)}`
  ).join(' ');
  gzSvg.appendChild(el('path', { d, class: 'curve' }));

  // GM tangent at origin: GZ ≈ GM·sinφ → near 0, slope dGZ/dφ = GM (m/rad).
  // Draw a short tangent over ±20° to highlight that GM is the slope.
  if (lastResult && !lastResult.error && lastResult.GM != null) {
    const GM = lastResult.GM;
    const phi = 20 * Math.PI / 180;
    const span = GM * phi; // m, GZ at +20° linearized
    gzSvg.appendChild(el('line', {
      x1: xOf(-20), y1: yOf(-span),
      x2: xOf( 20), y2: yOf( span),
      class: 'gm-tangent',
    }));
    gzSvg.appendChild(el('text', {
      x: xOf(20) + 2, y: yOf(span) + 3, class: 'annot gm',
    }, 'GM slope'));
  }

  // Peak GZ marker
  if (secondary?.peakGZ != null) {
    const px = xOf(secondary.phiPeak), py = yOf(secondary.peakGZ);
    gzSvg.appendChild(el('circle', { cx: px, cy: py, r: 3.5, class: 'marker-peak' }));
    gzSvg.appendChild(el('text', {
      x: px, y: py - 6, 'text-anchor': 'middle', class: 'annot peak',
    }, `peak ${secondary.peakGZ.toFixed(3)} m @ ${secondary.phiPeak.toFixed(0)}°`));
  }

  // AVS marker (vertical dashed line)
  if (secondary?.AVS != null) {
    gzSvg.appendChild(el('line', {
      x1: xOf(secondary.AVS), y1: yOf(maxAbs),
      x2: xOf(secondary.AVS), y2: yOf(-maxAbs),
      class: 'marker-avs',
    }));
    gzSvg.appendChild(el('text', {
      x: xOf(secondary.AVS) + 2, y: yOf(-maxAbs) - 3, class: 'annot avs',
    }, `AVS ${secondary.AVS.toFixed(0)}°`));
  }

  // Current heel marker
  const cur = valid.reduce(
    (best, c) => Math.abs(c.heel - state.heel) < Math.abs(best.heel - state.heel) ? c : best
  );
  gzSvg.appendChild(el('circle', {
    cx: xOf(cur.heel), cy: yOf(cur.GZ), r: 4.5, class: 'marker-current',
  }));

  // Axis labels
  gzSvg.appendChild(el('text', { x: xMax + 2, y: yOf(0) - 3, class: 'label' }, 'heel'));
  gzSvg.appendChild(el('text', { x: xOf(0) + 4, y: yOf(maxAbs) - 4, class: 'label' }, 'GZ (m)'));
}

// ── Variables table & equation panel ─────────────────────────────────────

const varsBody = document.getElementById('vars-body');
const eqPanel  = document.getElementById('equation-panel');

function renderVars(r) {
  varsBody.innerHTML = '';
  for (const v of VARS) {
    const tr = document.createElement('tr');
    tr.dataset.varKey = v.key;

    const tdName = document.createElement('td');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'var-name';
    nameSpan.tabIndex = 0;
    nameSpan.textContent = v.name;
    nameSpan.dataset.varKey = v.key;
    tdName.appendChild(nameSpan);
    const desc = document.createElement('span');
    desc.className = 'var-desc';
    desc.textContent = v.desc;
    tdName.appendChild(desc);

    const tdVal = document.createElement('td');
    const valSpan = document.createElement('span');
    valSpan.className = 'var-value';
    valSpan.tabIndex = 0;
    valSpan.textContent = v.value(r, state);
    valSpan.dataset.varKey = v.key;
    tdVal.appendChild(valSpan);

    tr.append(tdName, tdVal);
    varsBody.appendChild(tr);
  }
}

function renderEquation(varKey, r) {
  const v = VARS.find(x => x.key === varKey);
  if (!v) return;

  const parts = [`<h4>${v.name} — ${escapeHtml(v.desc)}</h4>`];
  parts.push(`<p>${escapeHtml(v.long || v.short || '')}</p>`);
  if (v.equation) {
    parts.push(`<pre>${escapeHtml(v.equation)}</pre>`);
    if (v.inputs) {
      parts.push('<dl>');
      for (const [k, val] of v.inputs(r, state)) {
        parts.push(`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(val)}</dd>`);
      }
      parts.push('</dl>');
      parts.push(`<pre>= ${escapeHtml(v.output(r, state))}</pre>`);
    }
  } else {
    parts.push(`<p class="hint">Direct input or measurement (no closed-form equation).</p>`);
  }
  parts.push(`<p class="hint">See: <a href="${REF_URL}" target="_blank" rel="noopener">U.S. Navy stability primer</a></p>`);
  eqPanel.innerHTML = parts.join('');

  varsBody.querySelectorAll('tr').forEach(
    tr => tr.classList.toggle('active', tr.dataset.varKey === varKey)
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// ── Tooltip ──────────────────────────────────────────────────────────────

const tip = document.getElementById('tooltip');
function showTip(target, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  // measure after content is in
  const tr = tip.getBoundingClientRect();
  let left = r.left + window.scrollX;
  let top  = r.bottom + 6 + window.scrollY;
  if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8;
  if (left < 8) left = 8;
  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
}
function hideTip() { tip.hidden = true; }

// ── Drag handling for control points ─────────────────────────────────────

let drag = null;

hullSvg.addEventListener('pointerdown', (e) => {
  const t = e.target;
  if (t.classList && t.classList.contains('control-point')) {
    drag = { idx: parseInt(t.dataset.idx, 10), pointerId: e.pointerId };
    t.classList.add('dragging');
    hullSvg.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
});

hullSvg.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const pt = hullSvg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const sp = pt.matrixTransform(hullSvg.getScreenCTM().inverse());
  const wx = sp.x / SCALE;
  const wy = -sp.y / SCALE;
  setPointSymmetric(drag.idx, worldToBody({ x: wx, y: wy }, state.heel));
  rerender();
});

function endDrag(e) {
  if (drag && (!e || e.pointerId === drag.pointerId)) {
    hullSvg.querySelectorAll('.control-point.dragging').forEach(c => c.classList.remove('dragging'));
    if (e) hullSvg.releasePointerCapture(e.pointerId);
    drag = null;
  }
}
hullSvg.addEventListener('pointerup', endDrag);
hullSvg.addEventListener('pointercancel', endDrag);

// ── Sliders ──────────────────────────────────────────────────────────────

function bindSlider(id, outId, key, fmtFn) {
  const inp = document.getElementById(id);
  const out = document.getElementById(outId);
  inp.value = state[key];
  out.textContent = fmtFn(state[key]);
  inp.addEventListener('input', () => {
    state[key] = parseFloat(inp.value);
    out.textContent = fmtFn(state[key]);
    rerender();
  });
}
bindSlider('length', 'length-out', 'length', v => v.toFixed(1) + ' m');
bindSlider('mass',   'mass-out',   'mass',   v => v.toFixed(0) + ' kg');
bindSlider('kg',     'kg-out',     'KG',     v => v.toFixed(3) + ' m');
bindSlider('heel',   'heel-out',   'heel',   v => (v > 0 ? '+' : '') + v.toFixed(0) + '°');

document.getElementById('reset').addEventListener('click', () => {
  state.hullPoints = defaultHull();
  rerender();
});

// ── Hover & click delegation ─────────────────────────────────────────────

document.body.addEventListener('mouseover', (e) => {
  const n = e.target.closest && e.target.closest('.var-name');
  if (n) {
    const v = VARS.find(x => x.key === n.dataset.varKey);
    if (v) showTip(n, `<strong>${escapeHtml(v.name)} — ${escapeHtml(v.desc)}</strong><br>${escapeHtml(v.short || v.long || '')}`);
    return;
  }
  const m = e.target.closest && e.target.closest('.hull-tip');
  if (m) {
    const t = MARKER_TIPS[m.dataset.markerKey];
    if (t) showTip(m, `<strong>${escapeHtml(t.label)}</strong><br>${escapeHtml(t.desc)}`);
  }
});
document.body.addEventListener('mouseout', (e) => {
  if (e.target.closest && (e.target.closest('.var-name') || e.target.closest('.hull-tip'))) hideTip();
});
document.body.addEventListener('click', (e) => {
  const v = e.target.closest && e.target.closest('.var-value');
  if (v) {
    activeVar = v.dataset.varKey;
    if (lastResult && !lastResult.error) renderEquation(activeVar, lastResult);
  }
});

// ── Status, GZ-curve cache, render loop ─────────────────────────────────

const statusEl = document.getElementById('status');
let lastResult = null;
let activeVar = 'GM';
let cachedCurveKey = null;
let cachedCurve = null;

function curveKey(st) {
  return [st.length, st.mass, st.KG, ...st.hullPoints.flatMap(p => [p.x.toFixed(5), p.y.toFixed(5)])].join('|');
}
function ensureCurve() {
  const key = curveKey(state);
  if (key === cachedCurveKey) return cachedCurve;
  cachedCurveKey = key;
  const angles = [];
  for (let a = -150; a <= 150; a += 2) angles.push(a);
  cachedCurve = angles.map(deg => {
    const r = compute({ ...state, heel: deg });
    return { heel: deg, GZ: r.error ? null : r.GZ };
  });
  return cachedCurve;
}

// Secondary-stability metrics derived from the positive-heel side of the GZ curve.
// AVS = first heel > 0 where GZ crosses from + to −.
// Peak GZ and the angle where it occurs (within the positive lobe).
// A_GZ = ∫ GZ dphi (m·rad) over the positive lobe — energy reserve per unit weight.
// GZ30 = GZ at 30° — common secondary scalar for small craft.
function secondaryMetrics(curve) {
  const pos = curve.filter(c => c.heel >= 0 && c.GZ != null)
                   .sort((a, b) => a.heel - b.heel);
  const empty = { peakGZ: null, phiPeak: null, AVS: null, range: null,
                  A_GZ: null, GZ30: null, reachedAVS: false,
                  sweepMax: pos.length ? pos[pos.length - 1].heel : 0 };
  if (pos.length < 2) return empty;
  let avs = null;
  let wasPositive = false;
  for (let i = 0; i < pos.length - 1; i++) {
    if (pos[i].GZ > 0) wasPositive = true;
    if (wasPositive && pos[i].GZ > 0 && pos[i + 1].GZ <= 0) {
      const t = pos[i].GZ / (pos[i].GZ - pos[i + 1].GZ);
      avs = pos[i].heel + t * (pos[i + 1].heel - pos[i].heel);
      break;
    }
  }
  const sweepMax = pos[pos.length - 1].heel;
  const lobeEnd = avs == null ? sweepMax : avs;
  let peakGZ = -Infinity, phiPeak = null;
  for (const c of pos) {
    if (c.heel > lobeEnd) break;
    if (c.GZ > peakGZ) { peakGZ = c.GZ; phiPeak = c.heel; }
  }
  if (peakGZ <= 0) { peakGZ = null; phiPeak = null; }
  let A = 0;
  for (let i = 0; i < pos.length - 1; i++) {
    const a = pos[i], b = pos[i + 1];
    if (a.heel >= lobeEnd) break;
    const aGZ = Math.max(0, a.GZ);
    const bHeel = Math.min(b.heel, lobeEnd);
    const f = (bHeel - a.heel) / (b.heel - a.heel);
    const bGZ = Math.max(0, a.GZ + f * (b.GZ - a.GZ));
    const dphi = (bHeel - a.heel) * Math.PI / 180;
    A += 0.5 * (aGZ + bGZ) * dphi;
    if (b.heel > lobeEnd) break;
  }
  let GZ30 = null;
  for (let i = 0; i < pos.length - 1; i++) {
    if (pos[i].heel <= 30 && pos[i + 1].heel >= 30) {
      const t = (30 - pos[i].heel) / (pos[i + 1].heel - pos[i].heel);
      GZ30 = pos[i].GZ + t * (pos[i + 1].GZ - pos[i].GZ);
      break;
    }
  }
  return {
    peakGZ, phiPeak, AVS: avs, range: avs,
    A_GZ: A, GZ30, reachedAVS: avs != null, sweepMax,
  };
}

function rerender() {
  const r = compute(state);
  const curve = ensureCurve();
  if (!r.error) r.secondary = secondaryMetrics(curve);
  lastResult = r;
  renderHull(r);
  if (!r.error) {
    renderVars(r);
    renderEquation(activeVar, r);
    statusEl.className = 'status ' + (r.GM > 0 ? 'stable' : 'unstable');
    statusEl.textContent = statusSentence(r);
  } else {
    statusEl.className = 'status awash';
    statusEl.textContent = r.error === 'awash'
      ? 'Hull is awash — section is too small to support this mass at this length. Increase length or beam, or reduce mass.'
      : 'No solution.';
    varsBody.innerHTML = '';
    eqPanel.innerHTML = '<p class="hint">No solution — adjust inputs.</p>';
  }
  renderGZCurve(curve, r.secondary);
}

function qualPrimary(GM) {
  if (GM <= 0)        return 'unstable';
  if (GM < 0.05)      return 'tender';
  if (GM < 0.12)      return 'moderate';
  if (GM < 0.20)      return 'firm';
  return 'stiff';
}
function qualSecondary(peak) {
  if (peak == null)   return 'none';
  if (peak < 0.05)    return 'weak';
  if (peak < 0.10)    return 'moderate';
  if (peak < 0.18)    return 'strong';
  return 'very strong';
}

function statusSentence(r) {
  const s = r.secondary || {};
  if (r.GM <= 0) {
    return `Initially unstable — GM = ${r.GM.toFixed(3)} m. The boat heels away from upright.`;
  }
  const stiffness = r.Delta * G_ACC * r.GM;
  let txt = `Primary stability ${qualPrimary(r.GM)} (GM = ${r.GM.toFixed(3)} m, restoring stiffness ≈ ${stiffness.toFixed(1)} N·m/rad). `;
  if (s.peakGZ != null) {
    txt += `Secondary ${qualSecondary(s.peakGZ)} — peak GZ = ${s.peakGZ.toFixed(3)} m at ${s.phiPeak.toFixed(0)}°`;
    if (s.reachedAVS) {
      txt += `, AVS ≈ ${s.AVS.toFixed(0)}°.`;
    } else {
      txt += `; positive past ${s.sweepMax.toFixed(0)}° (AVS not reached in sweep).`;
    }
  } else {
    txt += `Secondary GZ never positive in sweep.`;
  }
  return txt;
}

rerender();
