// Loft prototype — Phase A: layout skeleton with a placeholder lofted mesh
// and read-only renderings of the side view and cross-section. Editing
// (spine, sections, chines, add/remove stations) lands in phases B–E.
//
// Coordinates throughout: X = longitudinal (+X bow), Y = transverse
// (+Y stbd), Z = vertical (+Z up). Stations stored starboard-only;
// port is mirrored across Y = 0.

import * as THREE       from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── State ────────────────────────────────────────────────────────────────

const state = {
  length: 5.2,
  loftRes: 'med',
  selectedStation: 2,   // index into stations[]
  // Spine: 2D control points in (X, Z). Endpoints are the bow/stern; interior
  // points shape the rocker. Phase A: hand-tuned placeholder, not editable.
  spine: spinePlaceholder(5.2),
  // Stations: each has a position s along the spine arc length (normalized
  // 0..1 between the endpoints) and a starboard-only section in (b, n).
  stations: stationsPlaceholder(),
};

function spinePlaceholder(L) {
  // Mild rocker: keel-line dips ~0.04 m at midship.
  const half = L / 2;
  return [
    { x: -half,        z:  0.04 }, // stern point
    { x: -half * 0.6,  z: -0.02 },
    { x:  0,           z: -0.04 },
    { x:  half * 0.6,  z: -0.02 },
    { x:  half,        z:  0.04 }, // bow point
  ];
}

function stationsPlaceholder() {
  // 5 interior stations evenly spaced in normalized arc length, each with
  // a U-shape body section that gets fuller at midship and tapers at ends.
  // Sections stored starboard-only (b ≥ 0). Sample count varies by station
  // to demonstrate the per-section reparameterization story.
  const stationParams = [0.15, 0.32, 0.50, 0.68, 0.85];
  return stationParams.map((s, i) => {
    // Beam scales with a smooth fish-form taper, depth roughly constant.
    const taper = Math.sin(Math.PI * s);          // 0 at ends, 1 at midship
    const beam  = 0.16 + 0.14 * taper;            // half-beam (b max), m
    const depth = 0.18 + 0.05 * taper;            // depth, m
    return {
      s,
      points: defaultSection(beam, depth),
    };
  });
}

function defaultSection(halfBeam, depth) {
  // Symmetric U-shape, starboard half only (b ≥ 0). Local "up" n̂ points
  // from the spine (keel) into the hull, so n = 0 is the keel and n grows
  // upward to the gunwale at n = depth.
  return [
    { b: 0,                n: 0,                chine: false }, // keel (on spine)
    { b: halfBeam * 0.45,  n: depth * 0.05,     chine: false },
    { b: halfBeam * 0.85,  n: depth * 0.35,     chine: false },
    { b: halfBeam,         n: depth * 0.80,     chine: false },
    { b: halfBeam * 0.97,  n: depth,            chine: false }, // gunwale
  ];
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

// Sample the spine in (X, Z) and accumulate arc length for parameterization.
function sampledSpine(spine, samplesPerSpan = 32) {
  const pts = sampleSpline(spine, 'x', 'z', samplesPerSpan);
  const arc = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    arc.push(arc[i - 1] + Math.hypot(dx, dy));
  }
  const total = arc[arc.length - 1];
  return { pts, arc, total };
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

// Build a placeholder loft mesh. For Phase A we just sample each station
// at its given s, project to world coordinates using the spine frame, and
// stitch quads. No longitudinal interpolation yet — phase B does that.
function buildPlaceholderLoft(state) {
  const sampled = sampledSpine(state.spine, 32);
  const spine = { ctrl: state.spine, sampled };

  const res = { low: { N: 32 }, med: { N: 64 }, high: { N: 128 } }[state.loftRes];
  const N = res.N;

  // Endpoint stations are degenerate (single point at s=0 and s=1).
  const allStations = [
    { s: 0, points: null }, // bow/stern degenerate
    ...state.stations,
    { s: 1, points: null },
  ];

  // Generate world-frame points: rows (one per station) × N samples
  // (transverse). Endpoint rows are N copies of the spine endpoint.
  const rows = allStations.map(st => {
    const { p, tx, tz } = spineAt(spine, st.s);
    // Local frame: tangent (tx, 0, tz), local up = (-tz, 0, tx) rotated
    // 90° in X-Z keeps n̂ in centerline plane and pointing roughly +Z.
    const nx = -tz, nz = tx; // 90° CCW in X-Z
    if (!st.points) {
      // Degenerate: every sample is the spine endpoint itself.
      const pt = { x: p.x, y: 0, z: p.z };
      return new Array(N).fill(pt);
    }
    const samples = sampleSection(st.points, N);
    return samples.map(s => ({
      x: p.x + s.n * nx,
      y: s.b,                         // transverse (starboard +)
      z: p.z + s.n * nz,
    }));
  });

  // Build a starboard mesh (quad strip) from rows, then mirror for port.
  const positions = [];
  const indices   = [];
  const rowCount  = rows.length;

  // Push starboard vertices.
  for (let i = 0; i < rowCount; i++) {
    for (let k = 0; k < N; k++) {
      positions.push(rows[i][k].x, rows[i][k].z, rows[i][k].y);
      // Three.js default: Y up. We map our Z (vertical) → Three.js Y, and
      // our Y (transverse) → Three.js Z.
    }
  }
  for (let i = 0; i < rowCount - 1; i++) {
    for (let k = 0; k < N - 1; k++) {
      const a = i       * N + k;
      const b = i       * N + k + 1;
      const c = (i + 1) * N + k;
      const d = (i + 1) * N + k + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  // Port mirror (negate transverse / Three.js Z).
  const stbdVertCount = rowCount * N;
  for (let i = 0; i < rowCount; i++) {
    for (let k = 0; k < N; k++) {
      positions.push(rows[i][k].x, rows[i][k].z, -rows[i][k].y);
    }
  }
  for (let i = 0; i < rowCount - 1; i++) {
    for (let k = 0; k < N - 1; k++) {
      const a = stbdVertCount + i       * N + k;
      const b = stbdVertCount + i       * N + k + 1;
      const c = stbdVertCount + (i + 1) * N + k;
      const d = stbdVertCount + (i + 1) * N + k + 1;
      // Reversed winding so port faces outward.
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  return { positions, indices, rows, spine };
}

// ── Three.js setup ───────────────────────────────────────────────────────

const threeHost = document.getElementById('three-host');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(threeHost.clientWidth, threeHost.clientHeight);
threeHost.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
scene.background = null;

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
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
keyLight.position.set(2, 4, 1.5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc7d2fe, 0.4);
fillLight.position.set(-2, 1, -2);
scene.add(fillLight);

// Reference grid at Z = 0 (waterline-ish).
const grid = new THREE.GridHelper(8, 16, 0x94a3b8, 0xe2e8f0);
grid.position.y = 0;
scene.add(grid);

// Centerline plane outline (a thin line marking Y = 0 from -L/2 to +L/2).
const centerlineMat  = new THREE.LineBasicMaterial({ color: 0xcbd5e1 });
const centerlineGeom = new THREE.BufferGeometry();
const centerlineLine = new THREE.Line(centerlineGeom, centerlineMat);
scene.add(centerlineLine);

// Hull mesh group.
const hullGroup = new THREE.Group();
scene.add(hullGroup);

const hullMaterial = new THREE.MeshStandardMaterial({
  color: 0xf59e0b, metalness: 0.05, roughness: 0.6, side: THREE.DoubleSide,
  flatShading: false,
});
const hullWireMaterial = new THREE.LineBasicMaterial({ color: 0xb45309, transparent: true, opacity: 0.35 });

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

  const loft = buildPlaceholderLoft(state);

  // Hull mesh.
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(loft.positions, 3));
  geom.setIndex(loft.indices);
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, hullMaterial);
  hullGroup.add(mesh);

  // Wireframe overlay (subtle).
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geom), hullWireMaterial);
  hullGroup.add(wire);

  // Centerline reference line in 3D, half a metre above and below for context.
  const half = state.length / 2;
  centerlineGeom.setFromPoints([
    new THREE.Vector3(-half, 0, 0),
    new THREE.Vector3( half, 0, 0),
  ]);

  // Station bands: draw each interior station as a thin loop following its
  // section, both starboard and port halves.
  const N = loft.rows[0].length;
  const interior = loft.rows.slice(1, -1); // skip degenerate endpoints
  interior.forEach((row, idx) => {
    const isSelected = idx === state.selectedStation;
    const color = isSelected ? 0xb45309 : 0xfbbf24;
    const opacity = isSelected ? 1.0 : 0.55;
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const linePts = [];
    // Starboard
    for (let k = 0; k < N; k++) linePts.push(new THREE.Vector3(row[k].x, row[k].z, row[k].y));
    // Mirror back (port) to close the loop visually.
    for (let k = N - 1; k >= 0; k--) linePts.push(new THREE.Vector3(row[k].x, row[k].z, -row[k].y));
    linePts.push(linePts[0].clone());
    const g = new THREE.BufferGeometry().setFromPoints(linePts);
    bandGroup.add(new THREE.Line(g, mat));
  });

  return loft;
}

let lastLoft = rebuildHull();

// Resize handling.
const resizeObserver = new ResizeObserver(() => {
  const w = threeHost.clientWidth, h = threeHost.clientHeight;
  if (w > 0 && h > 0) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
});
resizeObserver.observe(threeHost);

// Render loop.
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
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

function renderSideView() {
  sideSvg.innerHTML = '';
  const SCALE_X = 100; // px/m horizontal
  const SCALE_Z = 200; // px/m vertical (exaggerate so rocker is visible)
  const xOf = (x) => x * SCALE_X;
  const yOf = (z) => -z * SCALE_Z;

  // Waterline (Z = 0).
  sideSvg.appendChild(el('line', {
    x1: -340, y1: yOf(0), x2: 340, y2: yOf(0), class: 'water',
  }));
  sideSvg.appendChild(el('text', {
    x: 320, y: yOf(0) - 3, class: 'label', 'text-anchor': 'end',
  }, 'WL (Z = 0)'));

  // Hull silhouette: trace top (sheer) and bottom (keel) seen from beam.
  // Sheer = max-Z over all stations at each X; keel = spine line.
  const half = state.length / 2;
  const samples = 80;
  const sheerPath = [];
  const keelPath  = [];
  for (let i = 0; i <= samples; i++) {
    const s = i / samples;
    const sp = spineAt({ ctrl: state.spine, sampled: sampledSpine(state.spine, 32) }, s);
    keelPath.push({ x: sp.p.x, z: sp.p.z });
    // Sheer height at this s: linear-interpolate the gunwale-n from neighboring stations.
    const stations = state.stations;
    let sheerN = 0;
    if (s <= stations[0].s) sheerN = stations[0].points[stations[0].points.length - 1].n;
    else if (s >= stations[stations.length - 1].s) sheerN = stations[stations.length - 1].points.slice(-1)[0].n;
    else {
      for (let j = 0; j < stations.length - 1; j++) {
        const a = stations[j], b = stations[j + 1];
        if (s >= a.s && s <= b.s) {
          const t = (s - a.s) / (b.s - a.s);
          const aN = a.points[a.points.length - 1].n;
          const bN = b.points[b.points.length - 1].n;
          sheerN = aN + t * (bN - aN);
          break;
        }
      }
    }
    // Sheer in world Z: spine.z + sheerN (n is local up; here local up ≈ Z for mild rocker).
    sheerPath.push({ x: sp.p.x, z: sp.p.z + sheerN });
  }
  // Silhouette polygon: sheer forward then keel back.
  const silPts = [
    ...sheerPath.map(p => `${xOf(p.x).toFixed(2)},${yOf(p.z).toFixed(2)}`),
    ...keelPath.slice().reverse().map(p => `${xOf(p.x).toFixed(2)},${yOf(p.z).toFixed(2)}`),
  ];
  sideSvg.appendChild(el('polygon', { points: silPts.join(' '), class: 'silhouette' }));

  // Sheer line and keel line drawn explicitly.
  sideSvg.appendChild(el('path', {
    class: 'sheer',
    d: 'M ' + sheerPath.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L '),
  }));
  sideSvg.appendChild(el('path', {
    class: 'keel',
    d: 'M ' + keelPath.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L '),
  }));

  // Spine control polyline + control points.
  sideSvg.appendChild(el('path', {
    class: 'spine-line',
    d: 'M ' + state.spine.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L '),
  }));
  for (const p of state.spine) {
    sideSvg.appendChild(el('circle', {
      cx: xOf(p.x), cy: yOf(p.z), r: 4, class: 'spine-pt',
    }));
  }

  // Station markers along the spine.
  state.stations.forEach((st, i) => {
    const sp = spineAt({ ctrl: state.spine, sampled: sampledSpine(state.spine, 32) }, st.s);
    const isSel = i === state.selectedStation;
    const cls = 'station-tick' + (isSel ? ' selected' : '');
    // Vertical hash mark
    sideSvg.appendChild(el('line', {
      x1: xOf(sp.p.x), y1: yOf(sp.p.z) - 12,
      x2: xOf(sp.p.x), y2: yOf(sp.p.z) + 6,
      class: 'station' + (isSel ? ' selected' : ''),
    }));
    // Tick dot
    sideSvg.appendChild(el('circle', {
      cx: xOf(sp.p.x), cy: yOf(sp.p.z) - 12, r: 3.5, class: cls,
    }));
    sideSvg.appendChild(el('text', {
      x: xOf(sp.p.x), y: yOf(sp.p.z) - 16, class: 'station-label',
    }, String(i + 1)));
  });

  // Endpoints (bow/stern).
  ['bow', 'stern'].forEach((label) => {
    const isBow = label === 'bow';
    const x = isBow ? half : -half;
    sideSvg.appendChild(el('text', {
      x: xOf(x), y: yOf(0) + 18, class: 'label', 'text-anchor': 'middle',
    }, label));
  });
}

function renderSectionView() {
  sectionSvg.innerHTML = '';
  const SCALE = 600; // px/m — section is small so big scale
  const bOf = (b) => b * SCALE;
  const nOf = (n) => -n * SCALE; // n is up; SVG y down

  const station = state.stations[state.selectedStation];

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

  // Sample dense curves for both halves.
  const dense = sampleSpline(station.points, 'b', 'n', 24);
  const stbdPath = 'M ' + dense.map(p => `${bOf(p.x).toFixed(2)} ${nOf(p.y).toFixed(2)}`).join(' L ');
  const portPath = 'M ' + dense.map(p => `${bOf(-p.x).toFixed(2)} ${nOf(p.y).toFixed(2)}`).join(' L ');
  sectionSvg.appendChild(el('path', { class: 'section-curve',  d: stbdPath }));
  sectionSvg.appendChild(el('path', { class: 'section-mirror', d: portPath }));

  // Control points (starboard half).
  for (const p of station.points) {
    sectionSvg.appendChild(el('circle', {
      cx: bOf(p.b), cy: nOf(p.n),
      r: 4,
      class: 'ctrl-pt' + (p.chine ? ' chine' : ''),
    }));
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
  state.stations.forEach((st, i) => {
    const li = document.createElement('li');
    li.className = (i === state.selectedStation) ? 'selected' : '';
    li.dataset.idx = String(i);
    const name = document.createElement('span');
    name.textContent = `St ${i + 1}  s = ${st.s.toFixed(2)}`;
    const pips = document.createElement('span');
    pips.className = 'pips';
    pips.textContent = '●'.repeat(Math.min(st.points.length, 9));
    li.append(name, pips);
    li.addEventListener('click', () => selectStation(i));
    stationsOl.appendChild(li);
  });
  stationCount.textContent = `${state.stations.length} of ${state.stations.length}`;
}

function selectStation(i) {
  state.selectedStation = ((i % state.stations.length) + state.stations.length) % state.stations.length;
  stationLabel.textContent = String(state.selectedStation + 1);
  renderStationList();
  renderSectionView();
  renderSideView();
  rebuildHull();
}

document.getElementById('prev-station').addEventListener('click', () => selectStation(state.selectedStation - 1));
document.getElementById('next-station').addEventListener('click', () => selectStation(state.selectedStation + 1));

lengthEl.addEventListener('input', () => {
  state.length = parseFloat(lengthEl.value);
  lengthOut.textContent = state.length.toFixed(2) + ' m';
  // Rescale spine endpoints proportionally; interior keeps its rocker shape.
  state.spine = spinePlaceholder(state.length);
  renderSideView();
  rebuildHull();
});

loftResEl.addEventListener('change', () => {
  state.loftRes = loftResEl.value;
  rebuildHull();
});

// ── Initial render ───────────────────────────────────────────────────────

lengthOut.textContent = state.length.toFixed(2) + ' m';
stationLabel.textContent = String(state.selectedStation + 1);
renderStationList();
renderSideView();
renderSectionView();
