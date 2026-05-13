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

// ── Default starting state (user-modelled kayak shape) ───────────────────
// Generated from saved_files/dumbstart.json via the Export JSON button.
// To update: shape in the editor → Export JSON → paste geometry fields here.
const state = {
  length: 4.802480116117168,
  loftRes: '24',
  xSubdiv: 4,
  selectedStation: 1,
  spine: {"stern":{"x":-2.4264831068398243,"z":0.06160801887512207},"sternHandle":{"dx":1.230199495224722,"dz":-0.11421245098114013},"paddler":{"x":0,"z":-0.04},"paddlerAngle":-0.01139060029726415,"paddlerAftLen":0.6797328096093938,"paddlerForeLen":0.7416010725396657,"bow":{"x":2.3759970092773437,"z":0.09066193580627441},"bowHandle":{"dx":-0.8408212280273437,"dz":-0.098433198928833}},
  stations: [{"s":0.22743304081072982,"deckPt":{"x":-1.3246282958984374,"z":0.1741647148132324},"kind":"interior","points":[{"b":0,"n":0,"chine":false},{"b":0.55,"n":0.13,"chine":false},{"b":1,"n":0.53,"chine":false},{"b":0.55,"n":0.9,"chine":false},{"b":0,"n":1,"chine":false}],"deckLocal":{"along":0.0017501895782796126,"perp":0.1913840194125781}},{"s":0.40072270318561265,"deckPt":{"x":-0.5720346832275391,"z":0.17567228317260747},"kind":"interior","points":[{"b":0,"n":0,"chine":false},{"b":0.55,"n":0.13,"chine":false},{"b":1,"n":0.53,"chine":false},{"b":0.55,"n":0.9,"chine":false},{"b":0,"n":1,"chine":false}],"deckLocal":{"along":-0.07157127981572027,"perp":0.21206550456153264}},{"s":0.47953775859189696,"deckPt":{"x":-0.2061689376831054,"z":0.2109705734252929},"kind":"interior","points":[{"b":0,"n":0,"chine":false},{"b":0.644879150390625,"n":0.14643620385064018,"chine":false},{"b":0.9032260470920139,"n":0.2564714855617947,"chine":false},{"b":1.0353635152180989,"n":0.47361458672417533,"chine":false},{"b":1.0476221720377603,"n":0.662581041124132,"chine":false},{"b":0.6575403425428602,"n":0.900765143500434,"chine":false},{"b":0,"n":1,"chine":false}],"deckLocal":{"along":-0.08552769652633475,"perp":0.24913859731621069}},{"s":0.5616359112496526,"deckPt":{"x":0.3091895141085924,"z":0.31477905536334005},"kind":"interior","points":[{"b":0,"n":0,"chine":false},{"b":0.55,"n":0.13,"chine":false},{"b":1,"n":0.53,"chine":false},{"b":0.55,"n":0.9,"chine":false},{"b":0,"n":1,"chine":false}],"deckLocal":{"along":0.03805897021046631,"perp":0.35553389752136344}},{"s":0.5816359112496526,"deckPt":{"x":0.44372650250445034,"z":0.30600559126609866},"kind":"interior","points":[{"b":0,"n":0,"chine":false},{"b":0.55,"n":0.13,"chine":false},{"b":1,"n":0.53,"chine":false},{"b":0.55,"n":0.9,"chine":false},{"b":0,"n":1,"chine":false}],"deckLocal":{"along":0.07920427853744086,"perp":0.34525449102462263}},{"s":0.7092932476204413,"deckPt":{"x":0.9652226257324219,"z":0.251933650970459},"kind":"interior","points":[{"b":0,"n":0,"chine":false},{"b":0.55,"n":0.13,"chine":false},{"b":1,"n":0.53,"chine":false},{"b":0.55,"n":0.9,"chine":false},{"b":0,"n":1,"chine":false}],"deckLocal":{"along":-0.005029132579379751,"perp":0.2754765653018636}},{"s":0.7922205528243991,"deckPt":{"x":1.3456944906694648,"z":0.19612352771692942},"kind":"interior","points":[{"b":0,"n":0,"chine":false},{"b":0.55,"n":0.13,"chine":false},{"b":1,"n":0.53,"chine":false},{"b":0.55,"n":0.9,"chine":false},{"b":0,"n":1,"chine":false}],"deckLocal":{"along":-0.02154996075734265,"perp":0.19893889181346072}},{"s":0.8644388497476737,"deckPt":{"x":1.6881523132324219,"z":0.1863013648986816},"kind":"interior","points":[{"b":0,"n":0,"chine":false},{"b":0.55,"n":0.13,"chine":false},{"b":1,"n":0.53,"chine":false},{"b":0.55,"n":0.9,"chine":false},{"b":0,"n":1,"chine":false}],"deckLocal":{"along":-0.02539737342863739,"perp":0.16374141455732807}}],
  bowSheer: {"startS":0.925,"deckEndPt":{"x":1.9974455136722722,"z":0.3490331993268828},"tip":{"x":2.3408204650878908,"z":0.3088098907470703},"stations":[{"t":0.5755138599474631,"bottomPt":{"x":2.2034783203829407,"z":0.19276785893525428},"topPt":{"x":2.1978743775118468,"z":0.2664861778744635},"points":[{"b":0,"n":0,"chine":false},{"b":0.55,"n":0.13,"chine":false},{"b":1,"n":0.53,"chine":false},{"b":0.55,"n":0.9,"chine":false},{"b":0,"n":1,"chine":false}],"bottomLocal":{"dx":0.18620704040613933,"dz":0.14087061780235954},"topLocal":{"dx":0.18060309753504544,"dz":0.21458893674156876}}],"tipLocal":{"dx":0.32354918511108943,"dz":0.2569126496141756},"deckEndLocal":{"dx":-0.019825766304529147,"dz":0.2971359581939881}},
  sternSheer: {"startS":0.075,"deckEndPt":{"x":-2.0472134125339507,"z":0.32751336965364936},"tip":{"x":-2.4247622651319936,"z":0.2348604335289149},"stations":[{"t":0.02,"bottomPt":{"x":-2.070403213036441,"z":0.06508845228959606},"topPt":{"x":-2.0509482081911483,"z":0.21082677264024302},"points":[{"b":0,"n":0,"chine":false},{"b":0.3104553646511502,"n":0.249518797132704,"chine":false},{"b":0.7657459682888454,"n":0.3285963694254557,"chine":false},{"b":1.0027225070529513,"n":0.5133912404378255,"chine":false},{"b":0.9629458957248264,"n":0.911669921875,"chine":false},{"b":0,"n":1,"chine":false}],"bottomLocal":{"dx":-0.00338251120537425,"dz":0.03471267875437603},"topLocal":{"dx":0.016072493639918584,"dz":0.180450999105023}}],"tipLocal":{"dx":-0.35774156330092666,"dz":0.20448465999369486},"deckEndLocal":{"dx":0.01980728929711617,"dz":0.2971375961184293}},
  beamLine: {"sternHandle":{"dx":1.1088784354769023,"dy":0.32106409252809665},"bowHandle":{"dx":-0.03616913716369963,"dy":0.03909700350479787},"peaks":[{"x":0.6797328096093938,"y":0.3,"hdx":0.6848874150428853,"hdy":-0.1251194667020078},{"x":1.9858151008068836,"y":0.06734946434359206,"hdx":0.3856003453045136,"hdy":-0.020187888261300385}]},
  showLoftMesh: true,
  meshOpacity: 70,
  spineRadius: 0.005,
  spineSharpness: 0,
  sideRef: { url: null, worldX: -2.6, worldZ: 0.5, worldW: 5.2, worldH: 0.8, opacity: 0.3 },
  topRef:  { url: null, worldX: -2.6, worldY: -0.4, worldW: 5.2, worldH: 0.8, opacity: 0.3 },
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
  // Interior stations on the rocker. Each station owns:
  //   s        — fraction along the rocker (keel point lives on the curve)
  //   deckPt   — free 2D point in side view (X-Z); the section is lofted
  //              along the chord from keelPt to deckPt with world Y as the
  //              across-axis. Lazily filled by reconcileStationDeckPts() on
  //              first build (depends on the deck spline, which is set up
  //              after stations in the state literal).
  //   points   — closed-loop cross-section in the local (b, n) frame.
  const interiorParams = [0.15, 0.32, 0.50, 0.68, 0.85];
  return interiorParams.map((s) => ({
    s,
    deckPt: null, // filled by reconcileStationDeckPts
    kind:   'interior',
    points: defaultSection(),
  }));
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
        points:   defaultSection(),
      },
    ],
  };
}

// Deckline endpoints are the deckEndPt of each sheer (not the convergence tip).
function sheerTip(state, _spSampled, end) {
  return (end === 'bow' ? state.bowSheer : state.sternSheer).deckEndPt;
}

// Build a natural-cubic spline evaluator f(x) → z for the deck line.
// The interior control points are now the interior stations' own deckPts —
// the deck line passes through every station's deck point automatically,
// so dragging a station's deck point reshapes the deck line directly.
function buildDeckSpline(state, spSampled) {
  const spt = sheerTip(state, spSampled, 'stern');
  const bpt = sheerTip(state, spSampled, 'bow');
  const interior = state.stations
    .filter(st => st.deckPt && Number.isFinite(st.deckPt.x) && Number.isFinite(st.deckPt.z))
    .map(st => ({ x: st.deckPt.x, z: st.deckPt.z }));
  const pts = [spt, ...interior, bpt]
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

// For every interior station that doesn't yet have a deckPt, default it to
// the deck-line height at the same X as the keel. After this each station
// has a (keelPt, deckPt) pair the loft can use as its chord — the user can
// drag the deck point freely to tilt the section.
function reconcileStationDeckPts(state) {
  const sampled  = sampledSpine(state.spine, 64);
  const deckEval = buildDeckSpline(state, sampled);
  state.stations.forEach(st => {
    if (st.deckPt && Number.isFinite(st.deckPt.x) && Number.isFinite(st.deckPt.z)) return;
    const keel = spineAt({ ctrl: state.spine, sampled }, st.s).p;
    st.deckPt = { x: keel.x, z: deckEval(keel.x) };
  });
}

// ── Local-frame storage for station control points ───────────────────────
//
// Interior station deckPt is stored as (along, perp) in the Frenet frame
// at keel-s: along = projection onto rocker tangent t̂, perp = onto n̂ = (-tz,tx).
// Sheer station bottomPt/topPt/tip/deckEndPt are stored as (dx, dz) offsets
// relative to the sheer junction point spineAt(sheer.startS).p.
// When the rocker moves, recomputeFromLocalFrames() re-derives every world
// coordinate so the whole boat follows the spine shape.

// Fill in any missing locals from current world positions (lazy init + post-drag sync).
function reconcileLocalFrames(state) {
  const sp = sampledSpine(state.spine, 64);
  state.stations.forEach(st => {
    if (st.deckLocal && Number.isFinite(st.deckLocal.along)) return;
    if (!st.deckPt || !Number.isFinite(st.deckPt.x)) return;
    const { p, tx, tz } = spineAt({ ctrl: state.spine, sampled: sp }, st.s);
    const dx = st.deckPt.x - p.x, dz = st.deckPt.z - p.z;
    st.deckLocal = { along: dx * tx + dz * tz, perp: -dx * tz + dz * tx };
  });
  for (const end of ['bow', 'stern']) {
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const jPt = spineAt({ ctrl: state.spine, sampled: sp }, sheer.startS).p;
    const rel = (pt) => ({ dx: pt.x - jPt.x, dz: pt.z - jPt.z });
    if (!sheer.tipLocal)      sheer.tipLocal      = rel(sheer.tip);
    if (!sheer.deckEndLocal)  sheer.deckEndLocal  = rel(sheer.deckEndPt);
    sheer.stations.forEach(sst => {
      if (!sst.bottomLocal) sst.bottomLocal = rel(sst.bottomPt);
      if (!sst.topLocal)    sst.topLocal    = rel(sst.topPt);
    });
  }
}

// Re-derive every world point from its stored local coordinates.
// Called inside rebuildHull so any spine change is automatically reflected.
function recomputeFromLocalFrames(state) {
  const sp = sampledSpine(state.spine, 64);
  state.stations.forEach(st => {
    if (!st.deckLocal) return;
    const { p, tx, tz } = spineAt({ ctrl: state.spine, sampled: sp }, st.s);
    const { along, perp } = st.deckLocal;
    st.deckPt = {
      x: p.x + along * tx  - perp * tz,
      z: p.z + along * tz  + perp * tx,
    };
  });
  for (const end of ['bow', 'stern']) {
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const jPt = spineAt({ ctrl: state.spine, sampled: sp }, sheer.startS).p;
    const abs = (loc) => ({ x: jPt.x + loc.dx, z: jPt.z + loc.dz });
    if (sheer.tipLocal)     sheer.tip      = abs(sheer.tipLocal);
    if (sheer.deckEndLocal) sheer.deckEndPt = abs(sheer.deckEndLocal);
    sheer.stations.forEach(sst => {
      if (sst.bottomLocal) sst.bottomPt = abs(sst.bottomLocal);
      if (sst.topLocal)    sst.topPt    = abs(sst.topLocal);
    });
  }
}

// Force all locals to be recomputed from current world pts on next build.
// Used after the length slider scales world positions en-masse.
function invalidateLocalFrames(state) {
  state.stations.forEach(st => { st.deckLocal = null; });
  for (const sheer of [state.bowSheer, state.sternSheer]) {
    sheer.tipLocal = null;
    sheer.deckEndLocal = null;
    sheer.stations.forEach(sst => { sst.bottomLocal = null; sst.topLocal = null; });
  }
}

// ── X-ordering guards ──────────────────────────────────────────────────────
//
// Simple rule: a control point's X cannot exceed its +X neighbour's X, nor
// be less than its −X neighbour's X. Each helper returns
//   { lo: X-of-(−X)-neighbour, hi: X-of-(+X)-neighbour }
// where lo/hi are the IMMEDIATE neighbours along its own control line. If
// the point has no neighbour on a side (e.g. it's the outermost), that
// side is undefined (returned as ±Infinity).

const EPS_X = 0.005;  // 5 mm minimum gap between neighbours

function clampToXNeighbours(wx, { lo, hi }) {
  return Math.max((lo ?? -Infinity) + EPS_X, Math.min((hi ?? Infinity) - EPS_X, wx));
}

// Interior station deck pt: neighbours are the adjacent stations' deck pts.
// (Endpoints — first/last station — have no neighbour on the outer side.)
function interiorDeckXNeighbours(state, stationIdx) {
  const lo = stationIdx > 0 ? state.stations[stationIdx - 1].deckPt?.x : null;
  const hi = stationIdx < state.stations.length - 1 ? state.stations[stationIdx + 1].deckPt?.x : null;
  return { lo, hi };
}

// Sheer station bottom (keel) pt: neighbours along the sheer keel line are
// the junction (toward boat centre) and the tip (toward boat end), with any
// other sheer-station bottom pts in between sorted by t.
// Returns the immediate ±X neighbours.
function sheerKeelXNeighbours(state, end, sIdx) {
  const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
  const sp = sampledSpine(state.spine, 64);
  const jX = spineAt({ ctrl: state.spine, sampled: sp }, sheer.startS).p.x;
  // Order along the sheer: t=0 (junction) → t=1 (tip).
  const sorted = [...sheer.stations].sort((a, b) => a.t - b.t);
  const idxInSorted = sorted.indexOf(sheer.stations[sIdx]);
  const prevX = idxInSorted > 0 ? sorted[idxInSorted - 1].bottomPt.x : jX;
  const nextX = idxInSorted < sorted.length - 1 ? sorted[idxInSorted + 1].bottomPt.x : sheer.tip.x;
  // For bow: junction has smaller X, tip has larger X → lo=prev, hi=next.
  // For stern: junction has larger X, tip has smaller X → lo=next, hi=prev.
  if (end === 'bow') return { lo: prevX, hi: nextX };
  return { lo: nextX, hi: prevX };
}

// Sheer station top (deck) pt: neighbours along the deck-perimeter line are,
// from boat centre outward: deckEndPt → other sheer-station topPts (sorted
// by t) → tip.
function sheerDeckXNeighbours(state, end, sIdx) {
  const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
  const innerX = sheer.deckEndPt.x;
  const sorted = [...sheer.stations].sort((a, b) => a.t - b.t);
  const idxInSorted = sorted.indexOf(sheer.stations[sIdx]);
  const prevX = idxInSorted > 0 ? sorted[idxInSorted - 1].topPt.x : innerX;
  const nextX = idxInSorted < sorted.length - 1 ? sorted[idxInSorted + 1].topPt.x : sheer.tip.x;
  if (end === 'bow') return { lo: prevX, hi: nextX };
  return { lo: nextX, hi: prevX };
}

// Sheer tip: outboard of every sheer-station pt; no outer neighbour.
function sheerTipXNeighbours(state, end) {
  const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
  if (sheer.stations.length === 0) return { lo: null, hi: null };
  const allX = sheer.stations.flatMap(s => [s.bottomPt.x, s.topPt.x]);
  if (end === 'bow') return { lo: Math.max(...allX), hi: null };
  return { lo: null, hi: Math.min(...allX) };
}

// Helper: compute deckLocal for an interior station from a world deck position.
function worldToDeckLocal(state, stIdx, wx, wz) {
  const st = state.stations[stIdx];
  const sp = sampledSpine(state.spine, 64);
  const { p, tx, tz } = spineAt({ ctrl: state.spine, sampled: sp }, st.s);
  const dx = wx - p.x, dz = wz - p.z;
  return { along: dx * tx + dz * tz, perp: -dx * tz + dz * tx };
}

// Helper: compute a sheer-local offset from a world point.
function worldToSheerLocal(state, end, wx, wz) {
  const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
  const sp = sampledSpine(state.spine, 64);
  const jPt = spineAt({ ctrl: state.spine, sampled: sp }, sheer.startS).p;
  return { dx: wx - jPt.x, dz: wz - jPt.z };
}

// n: normalized 0=keel, 1=deck. b: normalized 0=centerline, 1=hull edge.
// Both are multiplied by their respective physical extents in buildLoft.
function defaultSection() {
  return [
    { b: 0,    n: 0,    chine: false }, // keel (centerline)
    { b: 0.55, n: 0.13, chine: false },
    { b: 1.0,  n: 0.53, chine: false }, // beam-max
    { b: 0.55, n: 0.90, chine: false },
    { b: 0,    n: 1.0,  chine: false }, // deck (centerline)
  ];
}

// Beam line: piecewise cubic Bézier in the X-Y plane (plan view).
// Endpoints are pinned to the convergence tips (b=0 there). Each interior
// peak stores an anchor (x, y) and a single outgoing handle (hdx, hdy);
// the incoming handle is symmetric: C1 continuity.
function defaultBeamLine(L = 5.2) {
  const half = L / 2;
  // Kayak-like plan: parallel midsection between two anchored peaks at
  // ±35% of half-length, both at full half-beam (0.30 m). Long horizontal
  // handles flatten the curve through the midship. Tips taper smoothly.
  return {
    sternHandle: { dx:  half * 0.55, dy: 0 }, // outgoing from stern tip
    bowHandle:   { dx: -half * 0.55, dy: 0 }, // outgoing from bow tip (toward stern)
    peaks: [
      { x: -half * 0.35, y: 0.30, hdx: half * 0.30, hdy: 0 },
      { x:  half * 0.35, y: 0.30, hdx: half * 0.30, hdy: 0 },
    ],
  };
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

// Sample the beam-line piecewise Bézier (X-Y plane, plan view).
// Returns an array of {x, y} points, x increasing from stern to bow.
// Endpoints are the convergence tips; peaks are the interior anchors.
function sampledBeamLine(state) {
  const st = state.sternSheer.tip, bw = state.bowSheer.tip;
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
    out.push({
      S, kind: 'sternSheer',
      samples:  sampleSection(sst.points, N),
      bottomPt: sst.bottomPt,   // chord endpoints used directly by buildLoft
      topPt:    sst.topPt,
    });
  });

  // Interior rocker stations.
  state.stations.forEach(st => {
    if (st.s <= lengths.sternStartS + 1e-6) return;
    if (st.s >= lengths.bowStartS   - 1e-6) return;
    out.push({
      S: interiorStationS(st.s, lengths),
      kind: 'interior',
      samples: sampleSection(st.points, N),
      deckPt: st.deckPt,    // (keelPt, deckPt) chord drives section tilt
    });
  });

  // Bow sheer-end stations.
  state.bowSheer.stations.forEach(sst => {
    const S = sheerStationS('bow', sst.t, lengths);
    if (S <= 1 - bowFrac + 1e-6 || S >= 1 - 1e-6) return;
    out.push({
      S, kind: 'bowSheer',
      samples:  sampleSection(sst.points, N),
      bottomPt: sst.bottomPt,
      topPt:    sst.topPt,
    });
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
  const N = parseInt(state.loftRes, 10) || 24;

  const spSampled     = sampledSpine(state.spine, 64);
  const deckEvalLoft  = buildDeckSpline(state, spSampled);
  const bowKSampled   = sampledSheerKeel(state, 'bow',   spSampled);
  const bowTSampled   = sampledTopSheer (state, 'bow',   spSampled);
  const sternKSampled = sampledSheerKeel(state, 'stern', spSampled);
  const sternTSampled = sampledTopSheer (state, 'stern', spSampled);

  const allSt = unifiedStations(state, lengths, N);
  const M     = allSt.length;

  const beamPts = sampledBeamLine(state);

  const rows = allSt.map(st => {
    if (st.kind === 'bowSheer' || st.kind === 'sternSheer') {
      // Chord runs from the user-controlled bottomPt (keel) to topPt (deck).
      // Beam half-width is sampled at the chord-X for each n so the section
      // tilts correctly with the chord just like interior pink stations.
      const botPt = st.bottomPt;
      const topPt = st.topPt;
      const dx = topPt.x - botPt.x, dz = topPt.z - botPt.z;
      const maxB = Math.max(...st.samples.map(s => s.b), 1e-9);
      return st.samples.map(({ b, n }) => {
        const cx = botPt.x + n * dx;
        return { x: cx, y: (b / maxB) * beamEvalAt(beamPts, cx), z: botPt.z + n * dz };
      });
    }
    if (st.kind === 'tip') {
      const { p } = compositeAt(state, lengths, st.S);
      return st.samples.map(() => ({ x: p.x, y: 0, z: p.z }));
    }
    // Interior stations: chord from keelPt (on rocker) to deckPt (free in X-Z).
    const { p } = compositeAt(state, lengths, st.S);
    const dPt = st.deckPt || { x: p.x, z: p.z + 0.3 };
    const dx  = dPt.x - p.x, dz = dPt.z - p.z;
    const maxB = Math.max(...st.samples.map(s => s.b), 1e-9);
    return st.samples.map(({ b, n }) => {
      const cx    = p.x + n * dx;
      const halfB = beamEvalAt(beamPts, cx);
      return { x: cx, y: (b / maxB) * halfB, z: p.z + n * dz };
    });
  });

  // ── Longitudinal (X) densification ──────────────────────────────────
  // Fit per-column cubic splines through the base rows' world positions
  // at their composite S, then resample at xSubdiv× density. xSubdiv=1
  // disables densification and uses base rows directly.
  const xSubdiv = Math.max(1, parseInt(state.xSubdiv, 10) || 1);
  let denseRows = rows;
  if (xSubdiv > 1 && M >= 2) {
    const baseS = allSt.map(st => st.S);
    const M2 = (M - 1) * xSubdiv + 1;
    denseRows = new Array(M2);
    for (let i = 0; i < M2; i++) denseRows[i] = new Array(N);
    for (let k = 0; k < N; k++) {
      const xs = rows.map(r => r[k].x);
      const ys = rows.map(r => r[k].y);
      const zs = rows.map(r => r[k].z);
      const fx = naturalCubicNonUniform(baseS, xs);
      const fy = naturalCubicNonUniform(baseS, ys);
      const fz = naturalCubicNonUniform(baseS, zs);
      for (let i = 0; i < M2; i++) {
        const t = i / (M2 - 1);
        const S = baseS[0] + t * (baseS[M - 1] - baseS[0]);
        denseRows[i][k] = { x: fx(S), y: fy(S), z: fz(S) };
      }
    }
  }
  const Mdense = denseRows.length;

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

  const stationRows = allSt
    .filter(st => st.kind !== 'tip')
    .map(st => {
      let projFn;
      if (st.kind === 'bowSheer' || st.kind === 'sternSheer') {
        const botPt = st.bottomPt, topPt = st.topPt;
        const dx = topPt.x - botPt.x, dz = topPt.z - botPt.z;
        projFn = ({ b, n }) => {
          const cx = botPt.x + n * dx;
          return { x: cx, y: b * beamEvalAt(beamPts, cx), z: botPt.z + n * dz };
        };
      } else {
        const { p } = compositeAt(state, lengths, st.S);
        const dPt = st.deckPt || { x: p.x, z: p.z + 0.3 };
        const dx = dPt.x - p.x, dz = dPt.z - p.z;
        projFn = ({ b, n }) => {
          const cx = p.x + n * dx;
          return { x: cx, y: b * beamEvalAt(beamPts, cx), z: p.z + n * dz };
        };
      }
      return { kind: st.kind, S: st.S, points: st.samples.map(projFn) };
    });

  // Expose the densified rows so SVG wireframe overlays match the 3D mesh.
  return { positions, indices, rows: denseRows, stationRows, lengths, N, M: Mdense };
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
  // 1. Fill missing deckPts (new stations) from deck spline.
  reconcileStationDeckPts(state);
  // 2. Fill missing local-frame coordinates from current world pts.
  reconcileLocalFrames(state);
  // 3. Re-derive all world pts from locals — picks up any spine/rocker change.
  recomputeFromLocalFrames(state);
  // 4. Snap deck n-values to exactly 1.0.
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
    const stX = state.sternSheer.tip.x, bwX = state.bowSheer.tip.x;
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

  // Centreline reference (Y=0 axis, vertical line).
  topSvg.appendChild(el('line', {
    x1: 0, y1: yOfT(state.sternSheer.tip.x) + 10,
    x2: 0, y2: yOfT(state.bowSheer.tip.x)   - 10,
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
  const stPt = state.sternSheer.tip, bwPt = state.bowSheer.tip;
  const bl    = state.beamLine;
  const sorted = [...bl.peaks].sort((a, b) => a.x - b.x);

  const nodes = [
    { p: { x: stPt.x, y: 0 }, hOut: { x: stPt.x + bl.sternHandle.dx, y: bl.sternHandle.dy }, id: 'stern' },
    ...sorted.map((pk, i) => ({
      p:    { x: pk.x, y: pk.y },
      hIn:  { x: pk.x - pk.hdx, y: pk.y - pk.hdy },
      hOut: { x: pk.x + pk.hdx, y: pk.y + pk.hdy },
      id:   String(i),
    })),
    { p: { x: bwPt.x, y: 0 }, hIn: { x: bwPt.x + bl.bowHandle.dx, y: bl.bowHandle.dy }, id: 'bow' },
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

  // ── Station marks (matching side-view chord style: magenta) ─────────
  const spSampled = sampledSpine(state.spine, 64);
  const unified   = listAllStations(state);
  unified.forEach((entry, i) => {
    let kx;
    if (entry.kind === 'interior') {
      kx = spineAt({ ctrl: state.spine, sampled: spSampled }, entry.ref.s).p.x;
    } else {
      const end   = entry.kind === 'bowSheer' ? 'bow' : 'stern';
      const kSamp = sampledSheerKeel(state, end, spSampled);
      kx = sampleAlong(kSamp, entry.ref.t).p.x;
    }
    const halfB = beamEvalAt(beamPts, kx);
    const isSel = i === state.selectedStation;
    // Wide invisible hit strip across the beam — drag anywhere along the
    // station line to slide it along X.
    topSvg.appendChild(el('line', {
      x1: xOfT(-halfB - 0.05), y1: yOfT(kx),
      x2: xOfT( halfB + 0.05), y2: yOfT(kx),
      class: 'station-hit',
      'data-drag': 'station', 'data-idx': String(i),
    }));
    // Visible station chord — colour-matched to its end (pink for interior,
    // orange for bow sheer, purple for stern sheer).
    const endCls = entry.kind === 'bowSheer' ? ' chord-bow'
                 : entry.kind === 'sternSheer' ? ' chord-stern' : '';
    topSvg.appendChild(el('line', {
      x1: xOfT(-halfB), y1: yOfT(kx), x2: xOfT(halfB), y2: yOfT(kx),
      class: 'station-chord' + endCls + (isSel ? ' selected' : ''),
    }));
    // Centerline marker dot.
    topSvg.appendChild(el('circle', {
      cx: 0, cy: yOfT(kx), r: 3.5/tf,
      class: 'station-keel' + (isSel ? ' selected' : ''),
    }));
    topSvg.appendChild(el('text', {
      x: xOfT(halfB) + 8/tf, y: yOfT(kx) + 4/tf, class: 'station-label',
    }, entry.label));
  });

  // Labels.
  topSvg.appendChild(el('text', { x: 0, y: yOfT(state.bowSheer.tip.x)  - 8/tf, class: 'label', 'text-anchor': 'middle' }, 'bow'));
  topSvg.appendChild(el('text', { x: 0, y: yOfT(state.sternSheer.tip.x) + 16/tf, class: 'label', 'text-anchor': 'middle' }, 'stern'));

  // ── Coordinate-system badge (X-Y plane, top-down) ──────────────────────
  // Bottom-left corner of the viewBox.
  const vb = topSvg.viewBox.baseVal;
  const ax = vb.x + 14/tf, ay = vb.y + vb.height - 14/tf;
  const L = 28/tf;
  topSvg.appendChild(el('line', { x1: ax, y1: ay, x2: ax + L, y2: ay,     class: 'axis-arrow' }));
  topSvg.appendChild(el('line', { x1: ax, y1: ay, x2: ax,     y2: ay - L, class: 'axis-arrow' }));
  topSvg.appendChild(el('text', { x: ax + L + 4/tf, y: ay + 4/tf,    class: 'axis-label' }, '+Y (port)'));
  topSvg.appendChild(el('text', { x: ax - 4/tf,     y: ay - L - 2/tf, class: 'axis-label', 'text-anchor': 'start' }, '+X (bow)'));
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

  // Coordinate-system badge (X-Z plane).
  {
    const ax = -332, ay = 110, L = 28;
    sideSvg.appendChild(el('line', { x1: ax, y1: ay, x2: ax + L, y2: ay,     class: 'axis-arrow' }));
    sideSvg.appendChild(el('line', { x1: ax, y1: ay, x2: ax,     y2: ay - L, class: 'axis-arrow' }));
    sideSvg.appendChild(el('text', { x: ax + L + 4, y: ay + 4,     class: 'axis-label' }, '+X (bow)'));
    sideSvg.appendChild(el('text', { x: ax - 4,     y: ay - L - 2, class: 'axis-label', 'text-anchor': 'start' }, '+Z (up)'));
  }

  // ── Four explicit hull-profile curves ───────────────────────────────
  // keel (rocker, blue), deck line (green), bow sheer (orange), stern
  // sheer (purple). All rendered + editable directly. The silhouette
  // polygon is assembled from the four curves so the hull fill stays in
  // sync with what the user edits.

  const lengths = compositeLengths(state);

  const sternDeckEndPt = state.sternSheer.deckEndPt;
  const bowDeckEndPt   = state.bowSheer.deckEndPt;
  const spSampled      = sampledSpine(state.spine, 64);

  const pt2str = p => `${xOf(p.x).toFixed(2)},${yOf(p.z).toFixed(2)}`;
  const pathD  = pts => 'M ' + pts.map(p => `${xOf(p.x).toFixed(2)} ${yOf(p.z).toFixed(2)}`).join(' L ');

  // ── Mesh-sourced keel + deck edges ───────────────────────────────────
  // rows[i][0]     = keel-centerline vertex (b=0, n=0) for each loft row
  // rows[i][N-1]   = deck-centerline vertex (b=0, n=1) for each loft row
  // Both are projected to side-view X-Z, matching the rendered mesh.
  // Split the keel edge into three colour-coded segments using the
  // composite arc-length fractions stored in lastLoft.lengths.
  let perimPts = [], sternKeelPts = [], rockerPts = [], bowKeelPts = [];
  if (lastLoft) {
    const Md = lastLoft.M, N = lastLoft.N;
    const sf = lastLoft.lengths.sternFrac;
    const bf = lastLoft.lengths.bowFrac;
    const jS = Math.round(sf * (Md - 1));        // row index of stern→rocker junction
    const jB = Math.round((1 - bf) * (Md - 1));  // row index of rocker→bow junction

    perimPts     = lastLoft.rows.map(r => ({ x: r[N - 1].x, z: r[N - 1].z }));
    const keelPts = lastLoft.rows.map(r => ({ x: r[0].x, z: r[0].z }));
    sternKeelPts = keelPts.slice(0, jS + 1);
    rockerPts    = keelPts.slice(jS, jB + 1);
    bowKeelPts   = keelPts.slice(jB);
  }

  // Silhouette: top = deck edge (stern→bow), bottom = keel edge (bow→stern).
  const silPts = [
    ...perimPts.map(pt2str),
    ...[...bowKeelPts].reverse().map(pt2str),
    ...[...rockerPts].reverse().map(pt2str),
    ...[...sternKeelPts].reverse().map(pt2str),
  ];
  sideSvg.appendChild(el('polygon', { points: silPts.join(' '), class: 'silhouette' }));

  sideSvg.appendChild(el('path', { class: 'keel',              d: pathD(rockerPts) }));
  sideSvg.appendChild(el('path', { class: 'stern-sheer-curve', d: pathD(sternKeelPts) }));
  sideSvg.appendChild(el('path', { class: 'bow-sheer-curve',   d: pathD(bowKeelPts) }));
  sideSvg.appendChild(el('path', { class: 'deck-pts-line',     d: pathD(perimPts) }));

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
    sideSvg.appendChild(el('circle', { cx: xOf(p.x), cy: yOf(p.z), r: 10/sf, class: 'handle-hit', 'data-drag': id }));
    sideSvg.appendChild(el('circle', { cx: xOf(p.x), cy: yOf(p.z), r: 3.5/sf, class: 'spine-handle', 'data-drag': id }));
  }

  // Anchor points (large): stern, paddler, bow.
  const anchorDots = [
    ['anchor-stern',   sp.stern  ],
    ['anchor-paddler', sp.paddler],
    ['anchor-bow',     sp.bow    ],
  ];
  for (const [id, p] of anchorDots) {
    const isPaddler = id === 'anchor-paddler';
    sideSvg.appendChild(el('circle', { cx: xOf(p.x), cy: yOf(p.z), r: 14/sf, class: 'spine-hit', 'data-drag': id }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(p.x), cy: yOf(p.z), r: 5/sf,
      class: 'spine-anchor' + (isPaddler ? ' paddler' : ''),
      'data-drag': id,
    }));
  }

  // Build the unified station list once for rendering (with the same
  // ordering as buildLoft → state.selectedStation indexes into it).
  const unified = listAllStations(state);

  // Interior station chord overlays + control points. Each station has a
  // keel point (on the rocker, slides via 's') and a deck point (free in
  // X-Z). The chord between them is the section's local up-axis.
  unified.forEach((entry, i) => {
    if (entry.kind !== 'interior') return;
    const sp = spineAt(spine, entry.ref.s);
    const dPt = entry.ref.deckPt || { x: sp.p.x, z: sp.p.z + 0.3 };
    const isSel = i === state.selectedStation;

    // Chord overlay line: keel → deck.
    sideSvg.appendChild(el('line', {
      x1: xOf(sp.p.x), y1: yOf(sp.p.z),
      x2: xOf(dPt.x),  y2: yOf(dPt.z),
      class: 'station-chord' + (isSel ? ' selected' : ''),
    }));

    // Keel control point — solid teal, slides along rocker.
    sideSvg.appendChild(el('circle', {
      cx: xOf(sp.p.x), cy: yOf(sp.p.z), r: 14/sf,
      class: 'station-hit',
      'data-drag': 'station', 'data-idx': String(i),
    }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(sp.p.x), cy: yOf(sp.p.z), r: 5/sf,
      class: 'station-keel' + (isSel ? ' selected' : ''),
      'data-drag': 'station', 'data-idx': String(i),
    }));

    // Deck control point — diamond, free X-Z drag.
    sideSvg.appendChild(el('circle', {
      cx: xOf(dPt.x), cy: yOf(dPt.z), r: 14/sf,
      class: 'station-deck-hit',
      'data-drag': 'station-deck', 'data-idx': String(i),
    }));
    sideSvg.appendChild(el('rect', {
      x: xOf(dPt.x) - 5/sf, y: yOf(dPt.z) - 5/sf, width: 10/sf, height: 10/sf,
      transform: `rotate(45 ${xOf(dPt.x)} ${yOf(dPt.z)})`,
      class: 'station-deck' + (isSel ? ' selected' : ''),
      'data-drag': 'station-deck', 'data-idx': String(i),
    }));

    // Label above the keel.
    sideSvg.appendChild(el('text', {
      x: xOf(sp.p.x), y: yOf(sp.p.z) + 16/sf, class: 'station-label',
    }, entry.label));
  });

  // Endpoint labels follow the actual spine endpoints (which are the same
  // draggable spine control points as any other).
  sideSvg.appendChild(el('text', {
    x: xOf(state.spine.stern.x), y: yOf(0) + 22/sf, class: 'label', 'text-anchor': 'middle',
  }, 'stern'));
  sideSvg.appendChild(el('text', {
    x: xOf(state.spine.bow.x), y: yOf(0) + 22/sf, class: 'label', 'text-anchor': 'middle',
  }, 'bow'));
  sideSvg.appendChild(el('text', {
    x: xOf(state.spine.paddler.x), y: yOf(state.spine.paddler.z) - 12/sf,
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

      // Chord overlay: keel sheer point → deck sheer point.
      sideSvg.appendChild(el('line', {
        x1: xOf(sst.bottomPt.x), y1: yOf(sst.bottomPt.z),
        x2: xOf(sst.topPt.x),    y2: yOf(sst.topPt.z),
        class: `station-chord chord-${end}` + (isSel ? ' selected' : ''),
      }));

      // Keel (bottom) control point — same blue as hull keel points.
      sideSvg.appendChild(el('circle', {
        cx: xOf(sst.bottomPt.x), cy: yOf(sst.bottomPt.z), r: 14/sf,
        class: 'station-hit',
        'data-drag': `sheer-bot-${end}`, 'data-idx': String(sIdx), 'data-uni': String(uniIdx),
      }));
      sideSvg.appendChild(el('circle', {
        cx: xOf(sst.bottomPt.x), cy: yOf(sst.bottomPt.z), r: 5/sf,
        class: 'station-keel' + (isSel ? ' selected' : ''),
        'data-drag': `sheer-bot-${end}`, 'data-idx': String(sIdx), 'data-uni': String(uniIdx),
      }));

      // Deck (top) control point — same pink diamond as hull deck points.
      sideSvg.appendChild(el('circle', {
        cx: xOf(sst.topPt.x), cy: yOf(sst.topPt.z), r: 14/sf,
        class: 'station-deck-hit',
        'data-drag': `sheer-top-${end}`, 'data-idx': String(sIdx), 'data-uni': String(uniIdx),
      }));
      sideSvg.appendChild(el('rect', {
        x: xOf(sst.topPt.x) - 5/sf, y: yOf(sst.topPt.z) - 5/sf, width: 10/sf, height: 10/sf,
        transform: `rotate(45 ${xOf(sst.topPt.x)} ${yOf(sst.topPt.z)})`,
        class: 'station-deck' + (isSel ? ' selected' : ''),
        'data-drag': `sheer-top-${end}`, 'data-idx': String(sIdx), 'data-uni': String(uniIdx),
      }));
    });

    // Convergence tip — ring, draggable.
    sideSvg.appendChild(el('circle', {
      cx: xOf(sheer.tip.x), cy: yOf(sheer.tip.z), r: 14/sf,
      class: 'stem-hit', 'data-drag': `sheer-tip-${end}`,
    }));
    sideSvg.appendChild(el('circle', {
      cx: xOf(sheer.tip.x), cy: yOf(sheer.tip.z), r: 6/sf,
      class: `${botClass} tip`, 'data-drag': `sheer-tip-${end}`,
    }));

    // deckEndPt and sheer-start tick removed — no longer exposed as user
    // controls. deckEndPt stays in the model as a spline endpoint; it is
    // positioned by editing the sheer-station topPts.
  }

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

  renderTopView();
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
    const r = newL / currentL;  // scale factor for all longitudinal X positions
    const sx = v => v * r;      // scale a world-X value
    const sdx = v => v * r;     // scale a relative dx handle offset

    // Rocker spine — X positions and handle X-offsets.
    const sp = state.spine;
    sp.stern.x        = sx(sp.stern.x);
    sp.paddler.x      = sx(sp.paddler.x);
    sp.bow.x          = sx(sp.bow.x);
    sp.sternHandle.dx = sdx(sp.sternHandle.dx);
    sp.bowHandle.dx   = sdx(sp.bowHandle.dx);
    sp.paddlerAftLen  = sdx(sp.paddlerAftLen);
    sp.paddlerForeLen = sdx(sp.paddlerForeLen);
    // Z values intentionally not scaled — rocker depth is independent of length.

    // Interior station deck points (keel `s` param is dimensionless, unchanged).
    state.stations.forEach(st => {
      if (st.deckPt) st.deckPt.x = sx(st.deckPt.x);
    });

    // Sheer ends — all world-X positions scale; Z (height) does not.
    for (const sheer of [state.bowSheer, state.sternSheer]) {
      sheer.tip.x      = sx(sheer.tip.x);
      sheer.deckEndPt.x = sx(sheer.deckEndPt.x);
      sheer.stations.forEach(sst => {
        sst.bottomPt.x = sx(sst.bottomPt.x);
        sst.topPt.x    = sx(sst.topPt.x);
      });
    }

    // Beam line — peak X positions and handle X-offsets; Y (beam width) unchanged.
    const bl = state.beamLine;
    bl.sternHandle.dx = sdx(bl.sternHandle.dx);
    bl.bowHandle.dx   = sdx(bl.bowHandle.dx);
    bl.peaks.forEach(pk => {
      pk.x   = sx(pk.x);
      pk.hdx = sdx(pk.hdx);
    });
  }
  state.length = newL;
  lengthOut.textContent = newL.toFixed(2) + ' m';
  // World pts were all just scaled; locals must be recomputed from them
  // (they were relative to the old spine/junction positions).
  invalidateLocalFrames(state);
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

// ── Top-view drag/click/delete ───────────────────────────────────────────

let topDrag = null;

// Delete the station at the unified-list index (works for interior, bow
// sheer, and stern sheer — never for tips, which are synthetic). Adjusts
// the selected-station index, rebuilds the hull, and re-renders all panes.
function deleteStation(unifiedIdx) {
  const sel = listAllStations(state)[unifiedIdx];
  if (!sel) return;
  if (sel.kind === 'interior') {
    if (state.stations.length <= 1) return;
    state.stations.splice(sel.stationIdx, 1);
  } else if (sel.kind === 'bowSheer') {
    if (state.bowSheer.stations.length <= 1) return;
    state.bowSheer.stations.splice(sel.stationIdx, 1);
  } else if (sel.kind === 'sternSheer') {
    if (state.sternSheer.stations.length <= 1) return;
    state.sternSheer.stations.splice(sel.stationIdx, 1);
  } else {
    return;
  }
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
    if (topDrag.id === 'stern') {
      bl.sternHandle = { dx: wx - state.sternSheer.tip.x, dy: wy };
    } else if (topDrag.id === 'bow') {
      bl.bowHandle = { dx: wx - state.bowSheer.tip.x, dy: wy };
    } else {
      const pi = peakIdx(topDrag.id);
      if (pi >= 0) { bl.peaks[pi].hdx = wx - bl.peaks[pi].x; bl.peaks[pi].hdy = wy - bl.peaks[pi].y; }
    }
  } else if (topDrag.kind === 'beam-handle-in') {
    if (topDrag.id === 'bow') {
      bl.bowHandle = { dx: wx - state.bowSheer.tip.x, dy: wy };
    } else if (topDrag.id === 'stern') {
      bl.sternHandle = { dx: wx - state.sternSheer.tip.x, dy: wy };
    } else {
      const pi = peakIdx(topDrag.id);
      if (pi >= 0) { bl.peaks[pi].hdx = -(wx - bl.peaks[pi].x); bl.peaks[pi].hdy = -(wy - bl.peaks[pi].y); }
    }
  } else if (topDrag.kind === 'station') {
    // Slide a station along X. Both points in the (keel, deck) pair move
    // together: the keel snaps onto its keel curve (rocker for interior;
    // sheer keel for sheer stations); the deck point translates by the
    // same (Δx, Δz) so the chord stays rigid.
    const sel = listAllStations(state)[+topDrag.id];
    if (!sel) { rebuildHull(); renderTopView(); return; }
    if (sel.kind === 'interior') {
      const sampled = sampledSpine(state.spine, 32);
      const spine   = { ctrl: state.spine, sampled };
      const idx = sel.stationIdx;
      const st  = state.stations[idx];
      const oldKeel = spineAt(spine, st.s).p;
      const sRaw = spineXToS(spine, wx);
      const lo  = state.sternSheer.startS + 0.02;
      const hi  = state.bowSheer.startS   - 0.02;
      const minS = idx === 0
        ? lo : Math.max(lo, state.stations[idx - 1].s + 0.02);
      const maxS = idx === state.stations.length - 1
        ? hi : Math.min(hi, state.stations[idx + 1].s + 0.02);
      st.s = Math.max(minS, Math.min(maxS, sRaw));
      // deckLocal is in the Frenet frame at s — rebuildHull's
      // recomputeFromLocalFrames derives the new world deckPt automatically.
    } else {
      // Sheer station: snap the keel point onto the sheer keel curve at
      // click X, then translate the deck point by the same offset.
      const end   = sel.kind === 'bowSheer' ? 'bow' : 'stern';
      const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
      const sst   = sheer.stations[sel.stationIdx];
      const spSampled = sampledSpine(state.spine, 64);
      const kSamp = sampledSheerKeel(state, end, spSampled);
      const wxClamped = clampToXNeighbours(wx, sheerKeelXNeighbours(state, end, sel.stationIdx));
      // Closest point on sheer keel curve to clamped wx (in X).
      let bestI = 0, bestD = Infinity;
      for (let i = 0; i < kSamp.pts.length; i++) {
        const d = Math.abs(kSamp.pts[i].x - wxClamped);
        if (d < bestD) { bestD = d; bestI = i; }
      }
      const newBot = { x: kSamp.pts[bestI].x, z: kSamp.pts[bestI].y };
      const dxBot = newBot.x - sst.bottomPt.x;
      const dzBot = newBot.z - sst.bottomPt.z;
      sst.bottomPt = newBot;
      sst.topPt = { x: sst.topPt.x + dxBot, z: sst.topPt.z + dzBot };
      sst.bottomLocal = worldToSheerLocal(state, end, sst.bottomPt.x, sst.bottomPt.z);
      sst.topLocal    = worldToSheerLocal(state, end, sst.topPt.x,    sst.topPt.z);
      // Re-derive t from bottomPt.x (junction → tip).
      const junctionX = spineAt({ ctrl: state.spine, sampled: spSampled }, sheer.startS).p.x;
      const span = (sheer.tip.x - junctionX) || 1e-6;
      sst.t = Math.max(0.02, Math.min(0.98, (newBot.x - junctionX) / span));
      sheer.stations.sort((a, b) => a.t - b.t);
    }
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

  // Otherwise, treat this click as "add a station at this longitudinal X".
  // Pick which kind of station (interior / bow sheer / stern sheer) by where
  // wx falls in the rocker / sheer regions.
  const SP = sampledSpine(state.spine, 64);
  const spineObj = { ctrl: state.spine, sampled: SP };
  const sternJoinX = spineAt(spineObj, state.sternSheer.startS).p.x;
  const bowJoinX   = spineAt(spineObj, state.bowSheer.startS).p.x;
  // Don't allow adding inside the tip caps.
  const sternTipX  = state.sternSheer.tip.x;
  const bowTipX    = state.bowSheer.tip.x;
  if (wx <= sternTipX + 0.05 || wx >= bowTipX - 0.05) return;

  if (wx > sternJoinX && wx < bowJoinX) {
    // Interior. Use the same neighbour-interpolation as the side view click.
    const sternX = state.sternSheer.deckEndPt.x;
    const bowX   = state.bowSheer.deckEndPt.x;
    const neighbours = [
      { x: sternX, s: state.sternSheer.startS },
      ...state.stations.map(st => ({ x: st.deckPt.x, s: st.s })),
      { x: bowX,   s: state.bowSheer.startS   },
    ].sort((a, b) => a.x - b.x);
    let lo = 0;
    while (lo < neighbours.length - 2 && neighbours[lo + 1].x < wx) lo++;
    const A = neighbours[lo], B = neighbours[lo + 1];
    const span = (B.x - A.x) || 1e-6;
    const frac = Math.max(0, Math.min(1, (wx - A.x) / span));
    const newS = A.s + frac * (B.s - A.s);
    const sLo  = state.sternSheer.startS + 0.02;
    const sHi  = state.bowSheer.startS   - 0.02;
    const sClamped = Math.max(sLo, Math.min(sHi, newS));
    // Top view has no Z; place deckPt at the deck-spline height at this X.
    const deckEvalC = buildDeckSpline(state, SP);
    state.stations.push({
      s:      sClamped,
      deckPt: { x: wx, z: deckEvalC(wx) },
      kind:   'interior',
      points: defaultSection(),
    });
    state.stations.sort((a, b) => a.s - b.s);
  } else {
    // Sheer region.
    const end   = wx >= bowJoinX ? 'bow' : 'stern';
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const kSamp = sampledSheerKeel(state, end, SP);
    const tSamp = sampledTopSheer (state, end, SP);
    // Closest curve points to wx (X-only).
    const nearestAt = (samp) => {
      let bI = 0, bD = Infinity;
      for (let i = 0; i < samp.pts.length; i++) {
        const d = Math.abs(samp.pts[i].x - wx);
        if (d < bD) { bD = d; bI = i; }
      }
      return { p: { x: samp.pts[bI].x, z: samp.pts[bI].y }, t: samp.arc[bI] / (samp.total || 1) };
    };
    const bot = nearestAt(kSamp);
    const top = nearestAt(tSamp);
    const t   = Math.max(0.05, Math.min(0.95, bot.t));
    sheer.stations.push({
      t,
      bottomPt: bot.p,
      topPt:    top.p,
      points:   defaultSection(),
    });
    sheer.stations.sort((a, b) => a.t - b.t);
  }
  rebuildHull();
  renderSideView();
  renderTopView();
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

  if (kind === 'station' || kind === 'sheer-station' || kind === 'station-deck') {
    selectStation(idx);
  } else if (kind.startsWith('sheer-bot-') || kind.startsWith('sheer-top-')) {
    // Sheer control points carry their unified idx in data-uni.
    const uni = parseInt(target.dataset.uni, 10);
    if (!isNaN(uni)) selectStation(uni);
  }
  sideSvg.setPointerCapture(e.pointerId);
});

sideSvg.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = svgToLocal(sideSvg, e);
  let wx = x / SIDE_SCALE_X;
  const wz = -y / SIDE_SCALE_Z;
  drag.moved = true;

  if (drag.kind === 'ref-side') {
    if (!drag.startWX) { drag.startWX = wx; drag.startWZ = wz; drag.origX = state.sideRef.worldX; drag.origZ = state.sideRef.worldZ; }
    state.sideRef.worldX = drag.origX + (wx - drag.startWX);
    state.sideRef.worldZ = drag.origZ + (wz - drag.startWZ);
    renderSideView();
    return;
  }

  if (drag.kind.startsWith('sheer-bot-') || drag.kind.startsWith('sheer-top-')) {
    const isBot = drag.kind.startsWith('sheer-bot-');
    const end   = drag.kind.endsWith('-bow') ? 'bow' : 'stern';
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const sst   = sheer.stations[drag.idx];
    if (!sst) return;
    if (isBot) wx = clampToXNeighbours(wx, sheerKeelXNeighbours(state, end, drag.idx));
    else       wx = clampToXNeighbours(wx, sheerDeckXNeighbours(state, end, drag.idx));
    if (isBot) { sst.bottomPt = { x: wx, z: wz }; sst.bottomLocal = worldToSheerLocal(state, end, wx, wz); }
    else       { sst.topPt    = { x: wx, z: wz }; sst.topLocal    = worldToSheerLocal(state, end, wx, wz); }
    // Re-derive t from bottomPt.x for ordering.
    const sampled = sampledSpine(state.spine, 64);
    const junctionX = spineAt({ ctrl: state.spine, sampled }, sheer.startS).p.x;
    const span = (sheer.tip.x - junctionX) || 1e-6;
    sst.t = Math.max(0.02, Math.min(0.98, (sst.bottomPt.x - junctionX) / span));
    sheer.stations.sort((a, b) => a.t - b.t);
    drag.moved = true;
    rebuildHull();
    renderSideView();

    renderTopView();
  } else if (drag.kind === 'sheer-tip-bow' || drag.kind === 'sheer-tip-stern') {
    const end = drag.kind === 'sheer-tip-bow' ? 'bow' : 'stern';
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    wx = clampToXNeighbours(wx, sheerTipXNeighbours(state, end));
    sheer.tip      = { x: wx, z: wz };
    sheer.tipLocal = worldToSheerLocal(state, end, wx, wz);
    drag.moved = true;
    rebuildHull();
    renderSideView();

    renderTopView();
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

    renderTopView();
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

    renderTopView();
  } else if (drag.kind === 'station-deck') {
    // Free X-Z drag of the station's deck point.
    const sel = listAllStations(state)[drag.idx];
    if (!sel || sel.kind !== 'interior') return;
    const stationIdx = sel.stationIdx;
    const st = state.stations[stationIdx];
    // Don't let the deck point pass below the keel or cross X-neighbours.
    const sampled = sampledSpine(state.spine, 32);
    const keel    = spineAt({ ctrl: state.spine, sampled }, st.s).p;
    wx = clampToXNeighbours(wx, interiorDeckXNeighbours(state, stationIdx));
    st.deckPt    = { x: wx, z: Math.max(keel.z + 0.02, wz) };
    st.deckLocal = worldToDeckLocal(state, stationIdx, st.deckPt.x, st.deckPt.z);
    rebuildHull();
    renderSideView();
    renderTopView();
    renderSectionView();
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
      // Clamp selectedStation in case the imported state has fewer stations.
      const n = listAllStations(state).length;
      if (state.selectedStation >= n) state.selectedStation = Math.max(0, n - 1);
      // Fill in any deckPts that weren't saved (backward-compat).
      reconcileStationDeckPts(state);
      reconcileDeckPoints(state);
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

  // ── Resolve the click against every editable curve ─────────────────
  // For each curve we find the nearest point whose X is in that curve's
  // domain, then pick the global winner within the click threshold. The
  // domain restrictions prevent a click at the bow region from getting
  // routed to a stern curve (or vice versa) just because the curves'
  // numeric distances happen to compare favourably elsewhere.
  const SP   = sampledSpine(state.spine, 64);
  const xRng = (pts) => {
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) { if (p.x < lo) lo = p.x; if (p.x > hi) hi = p.x; }
    return [lo, hi];
  };
  const nearestOnSampled = (samp) => {
    // samp is { pts: [{x,y}], arc: [...], total } — y here is world Z.
    const [lo, hi] = xRng(samp.pts);
    if (wx < lo - 0.05 || wx > hi + 0.05) return { dist: Infinity, t: 0 };
    let bestD = Infinity, bestT = 0;
    for (let i = 0; i < samp.pts.length - 1; i++) {
      const a = samp.pts[i], b = samp.pts[i + 1];
      const dx = b.x - a.x, dz = b.y - a.y;
      const ll = dx*dx + dz*dz;
      let tt = ll > 0 ? ((wx-a.x)*dx + (wz-a.y)*dz) / ll : 0;
      tt = Math.max(0, Math.min(1, tt));
      const px = a.x + tt*dx, pz = a.y + tt*dz;
      const d = Math.hypot(wx - px, wz - pz);
      if (d < bestD) {
        bestD = d;
        const aT = samp.arc[i]     / (samp.total || 1);
        const bT = samp.arc[i + 1] / (samp.total || 1);
        bestT = aT + tt * (bT - aT);
      }
    }
    return { dist: bestD, t: bestT };
  };

  // Candidate curves with their insertion handlers.
  const candidates = [];

  // Deck line (only the interior open span, excluding tip caps).
  {
    const sternEnd = state.sternSheer.deckEndPt;
    const bowEnd   = state.bowSheer.deckEndPt;
    if (wx > sternEnd.x + 0.02 && wx < bowEnd.x - 0.02) {
      const deckEvalC = buildDeckSpline(state, SP);
      const deckZ = deckEvalC(wx);
      // The deck spline now passes through the station deck points. A
      // click near it inserts a new interior station whose deckPt is the
      // click location, with the keel point chosen on the rocker so its
      // 's' is the same fraction between the neighbours' 's' as the
      // click is between the neighbours' deckPt.x.
      candidates.push({
        dist: Math.abs(wz - deckZ),
        kind: 'station-from-deck',
        run:  () => {
          // Build neighbour list along the deck line: stern endpoint
          // (anchored at sternSheer.startS) → interior stations → bow
          // endpoint (anchored at bowSheer.startS), sorted by x.
          const sternX = state.sternSheer.deckEndPt.x;
          const bowX   = state.bowSheer.deckEndPt.x;
          const neighbours = [
            { x: sternX, s: state.sternSheer.startS },
            ...state.stations.map(st => ({ x: st.deckPt.x, s: st.s })),
            { x: bowX,   s: state.bowSheer.startS   },
          ].sort((a, b) => a.x - b.x);
          // Find the segment the click falls in.
          let lo = 0;
          while (lo < neighbours.length - 2 && neighbours[lo + 1].x < wx) lo++;
          const A = neighbours[lo], B = neighbours[lo + 1];
          const span = (B.x - A.x) || 1e-6;
          const frac = Math.max(0, Math.min(1, (wx - A.x) / span));
          const newS = A.s + frac * (B.s - A.s);
          const sLo  = state.sternSheer.startS + 0.02;
          const sHi  = state.bowSheer.startS   - 0.02;
          const sClamped = Math.max(sLo, Math.min(sHi, newS));
          state.stations.push({
            s:      sClamped,
            deckPt: { x: wx, z: wz },
            kind:   'interior',
            points: defaultSection(),
          });
          state.stations.sort((a, b) => a.s - b.s);
        },
      });
    }
  }

  // Bow sheer keel + top sheer — only when click is in the bow region.
  // Stern sheer — only when click is in the stern region.
  for (const end of ['bow', 'stern']) {
    const sheer = end === 'bow' ? state.bowSheer : state.sternSheer;
    const tipX  = sheer.tip.x;
    const junction = spineAt({ ctrl: state.spine, sampled: SP }, sheer.startS).p;
    const lo = Math.min(tipX, junction.x), hi = Math.max(tipX, junction.x);
    if (wx < lo - 0.05 || wx > hi + 0.05) continue;

    const kSamp = sampledSheerKeel(state, end, SP);
    const tSamp = sampledTopSheer (state, end, SP);
    const onKeel = nearestOnSampled(kSamp);
    const onTop  = nearestOnSampled(tSamp);
    const pick = onKeel.dist <= onTop.dist ? onKeel : onTop;
    candidates.push({
      dist: pick.dist,
      kind: `sheer-${end}`,
      run:  () => {
        const t = Math.max(0.05, Math.min(0.95, pick.t));
        const bPt = sampleAlong(kSamp, t).p;
        const tPt = sampleAlong(tSamp, t).p;
        sheer.stations.push({
          t,
          bottomPt: { x: bPt.x, z: bPt.z },
          topPt:    { x: tPt.x, z: tPt.z },
          points:   defaultSection(),
        });
        // Sort so neighbour-comparison logic works regardless of t order.
        sheer.stations.sort((a, b) => a.t - b.t);
      },
    });
  }

  // Pick the closest qualifying candidate.
  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates.length === 0 || candidates[0].dist > 0.12) return;
  candidates[0].run();
  rebuildHull();
  renderSideView();
  renderTopView();
});

sideSvg.addEventListener('contextmenu', (e) => {
  // Interior station: right-click either the keel pt or the deck pt.
  const interiorT = e.target.closest('[data-drag="station"],[data-drag="station-deck"]');
  if (interiorT) {
    e.preventDefault();
    deleteStation(+interiorT.dataset.idx);
    return;
  }
  // Sheer station: right-click the bottomPt or topPt.
  const sheerT = e.target.closest('[data-drag^="sheer-bot-"],[data-drag^="sheer-top-"]');
  if (sheerT) {
    e.preventDefault();
    const sIdx  = +sheerT.dataset.idx;
    const endS  = sheerT.dataset.drag.endsWith('-bow') ? 'bow' : 'stern';
    const kind  = endS === 'bow' ? 'bowSheer' : 'sternSheer';
    const uniIdx = listAllStations(state).findIndex(u => u.kind === kind && u.stationIdx === sIdx);
    if (uniIdx >= 0) deleteStation(uniIdx);
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
