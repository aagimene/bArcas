# Architecture

High-level shape of the system. Concrete tech choices are candidates, not commitments — see [roadmap.md](roadmap.md).

---

## Layered view

```
┌─────────────────────────────────────────────────────────────┐
│ Clients                                                     │
│   • Browser UI (React + WebGPU/WebGL)                       │
│   • MCP server (AI agents via Claude, etc.)                 │
│   • CLI / Python SDK (scripting, tests, reference designs)  │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTP + WebSocket
                           │  (REST for CRUD, WS for live metrics)
┌──────────────────────────▼──────────────────────────────────┐
│ API Layer                                                   │
│   • Resource model: hulls, sessions, comparisons, exports   │
│   • Design operations (create, modify control net, loft…)   │
│   • Analysis operations (hydrostatics, drag, stability)     │
│   • Command log / event-sourced history                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ Core engine                                                 │
│   • Geometry kernel (B-spline/NURBS, lofting, meshing)      │
│   • Hydrostatics solver                                     │
│   • Resistance estimator (empirical + thin-ship)            │
│   • Stability solver                                        │
│   • Exporters: STEP, IGES, Parasolid, STL, 3MF, OBJ, DXF,   │
│     CSV offsets, JSON (see export-formats.md)               │
│   • Mold ops: offset surface, parting line, mold split       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ Storage                                                     │
│   • Hull documents (JSON — control nets, metadata)          │
│   • Event log (append-only design history)                  │
│   • Reference library (Coaster, K1s, Greenland, …)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Component responsibilities

### Geometry kernel
- Represents a hull as one or more parametric surfaces (NURBS preferred; B-spline acceptable).
- Provides a **control net** that design actions manipulate.
- Lofts transverse stations to a surface.
- Meshes the surface for rendering and for numerical integration.
- See [theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md).

### Hydrostatics solver
- Given a hull mesh and a waterplane, compute: volume displaced, LCB, VCB, waterplane area, BM_T, BM_L, KB, metacentric heights.
- Integrates by sectional area curve or by direct mesh volume (divergence theorem on a closed mesh).
- See [theory/hydrostatics.md](../theory/hydrostatics.md).

### Resistance estimator
- **Frictional:** ITTC 1957 line applied to wetted surface area.
- **Wave-making:** two paths — (a) Michell's integral (thin-ship, fast, approximate); (b) empirical fit for slender displacement hulls.
- **Form / residual:** small correction factor; reported as "empirical" with citation.
- Returns drag vs. speed curve. See [theory/drag-and-resistance.md](../theory/drag-and-resistance.md).

### Stability solver
- Computes large-angle stability (GZ curve) by heeling the hull through angles and solving for the waterline at each angle that preserves displacement.
- Reports: initial GM_T, max GZ and angle, angle of vanishing stability, range of positive stability.
- See [theory/stability.md](../theory/stability.md).

### Exporters and mold-prep ops
- STEP / IGES / Parasolid for CAM (CNC plug milling).
- STL / 3MF / OBJ for 3D printing of plugs or mold sections.
- DXF for 2D CNC of auxiliary parts (bulkheads, parting-line templates).
- CSV offsets, JSON hull document, Michlet `.in` for interchange.
- **Mold ops:** offset the hull surface by a shell thickness, define a parting line, split into half-molds, generate alignment features. Required for the composite-plug → composite-mold workflow.
- Rationale and format details: [export-formats.md](export-formats.md).

### API layer
- See [api-design.md](api-design.md) for the resource model and example calls.

### Command log / history
- Every design action is appended to a per-hull event log.
- Undo/redo is "replay to index N."
- AI-agent proposals are speculative commits — previewed, then either accepted or dropped.

---

## Tech choices (candidate, not committed)

| Layer | Candidate | Why / tradeoff |
|---|---|---|
| Frontend framework | React + TypeScript | Mature ecosystem, good TS story |
| 3D rendering | WebGPU (via [three.js WebGPURenderer](https://threejs.org/) or raw `wgpu`) | Modern GPU compute + render; WebGL2 fallback for older browsers |
| Geometry kernel | OpenCASCADE (OCCT) via WASM | OCC gives us a battle-tested kernel with STEP/IGES/BREP out of the box — given the export-format requirement, this is almost certainly the right call. Rust-native NURBS alternatives would force us to reimplement STEP export, which is a lot of work. |
| Backend language | Python (FastAPI) initially; Rust later for hot paths | Python is fastest to build the analysis pipeline; Rust for CFD/heavy math if needed |
| Storage | Postgres (metadata) + object storage (hull documents) | Standard |
| AI integration | [Model Context Protocol](https://modelcontextprotocol.io) server | Matches Claude Code, Claude desktop, other MCP clients |

Rationale is stored with each choice. Nothing here is final.

---

## Data model (sketch)

```
Hull
├── id, name, created_at, forked_from_id
├── parametric_config (rocker, beam, LOA, stations, …)
├── control_nets: [ControlNet, …]   # one per surface patch
├── displacement_condition: {loaded_weight_kg, waterplane_height, trim, …}
├── design_log: EventLog
└── tags, notes

ControlNet
├── surface_id
├── u_count, v_count, degree_u, degree_v
├── points: [[x, y, z, w], …]       # weighted for NURBS
└── knot_vectors

Comparison
├── id, name
├── hull_ids: [UUID, …]
├── aligned_on: "stem" | "LCG" | "waterline"
└── overlay_metrics: ["GZ", "drag@5kn", …]

Analysis (cached, derived)
├── hull_id @ config_hash
├── hydrostatics: {displacement, LCB, Cp, Cb, Cwp, WSA, …}
├── stability_curve: [(heel_deg, GZ), …]
└── drag_curve:     [(speed_kn, total_drag_N, components), …]
```

Key insight: the **hull document** is tiny (control nets + metadata). All the *derived* artifacts — mesh, stations, drag curve, stability curve — are computed on demand and cached by a hash of the hull + config.

---

## Related

- [api-design.md](api-design.md)
- [ai-agent-integration.md](ai-agent-integration.md)
- [visualization.md](visualization.md)
- [../theory/README.md](../theory/README.md)
