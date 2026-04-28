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
    desc: 'The chosen body-frame reference point. All K-prefixed distances — KB, KG, KM — are measured vertically upward from K in the body (boat-fixed) frame. K is fixed at the origin regardless of hull shape.',
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
  const bodyArea = Math.abs(polyArea(st.hullPoints));
  const targetVolume = st.mass / RHO_WATER;
  const targetArea = targetVolume / st.length;

  if (targetArea >= bodyArea) {
    return { error: 'awash', bodyArea, targetArea };
  }

  const worldPoly = st.hullPoints.map(p => bodyToWorld(p, st.heel));
  const { y_w, submerged, area: subArea } = solveWaterline(worldPoly, targetArea);
  if (submerged.length < 3) return { error: 'no submerged area' };

  const B_world = polyCentroid(submerged);
  const B_body = worldToBody(B_world, st.heel);

  // K is by definition the body-frame origin (chosen reference, classical convention)
  const K_body = { x: 0, y: 0 };
  const K_world = bodyToWorld(K_body, st.heel);

  const G_body = { x: 0, y: st.KG };
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

  const M_body = { x: 0, y: KM };
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
  const pts = (r.worldPoly || state.hullPoints.map(p => bodyToWorld(p, state.heel)))
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

function renderGZCurve(curve) {
  gzSvg.innerHTML = '';
  const xMin = 25, xMax = 295, yMid = 0;
  const angleMin = -90, angleMax = 90;

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
  for (const deg of [-90, -45, 0, 45, 90]) {
    gzSvg.appendChild(el('line', {
      x1: xOf(deg), y1: yOf(-maxAbs), x2: xOf(deg), y2: yOf(-maxAbs)+3, class: 'axis',
    }));
    gzSvg.appendChild(el('text', {
      x: xOf(deg), y: yOf(-maxAbs) + 13, 'text-anchor': 'middle', class: 'label',
    }, deg + '°'));
  }

  // Curve
  const d = valid.map((c, i) =>
    `${i === 0 ? 'M' : 'L'} ${xOf(c.heel).toFixed(2)} ${yOf(c.GZ).toFixed(2)}`
  ).join(' ');
  gzSvg.appendChild(el('path', { d, class: 'curve' }));

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
  for (let a = -90; a <= 90; a += 2) angles.push(a);
  cachedCurve = angles.map(deg => {
    const r = compute({ ...state, heel: deg });
    return { heel: deg, GZ: r.error ? null : r.GZ };
  });
  return cachedCurve;
}

function rerender() {
  const r = compute(state);
  lastResult = r;
  renderHull(r);
  if (!r.error) {
    renderVars(r);
    renderEquation(activeVar, r);
    if (r.GM > 0) {
      statusEl.className = 'status stable';
      const stiffness = r.Delta * G_ACC * r.GM;
      statusEl.textContent =
        `Initially stable — GM = ${r.GM.toFixed(3)} m. Restoring stiffness ≈ ${stiffness.toFixed(1)} N·m / rad.`;
    } else {
      statusEl.className = 'status unstable';
      statusEl.textContent =
        `Initially unstable — GM = ${r.GM.toFixed(3)} m. The boat heels away from upright.`;
    }
  } else {
    statusEl.className = 'status awash';
    statusEl.textContent = r.error === 'awash'
      ? 'Hull is awash — section is too small to support this mass at this length. Increase length or beam, or reduce mass.'
      : 'No solution.';
    varsBody.innerHTML = '';
    eqPanel.innerHTML = '<p class="hint">No solution — adjust inputs.</p>';
  }
  renderGZCurve(ensureCurve());
}

rerender();
