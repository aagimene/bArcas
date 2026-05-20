# Export formats — CNC, 3D printing, and composite molds

A core requirement: bArcas designs must be exportable into the file formats needed by downstream CAM, 3D-printing, and mold-making workflows. We are **explicitly not** supporting skin-on-frame or strip-built construction as a downstream workflow. The target build paths are:

1. **CNC-milled plugs** — cut from foam or tooling board, used to lay up a composite mold or as a male plug for composite layup.
2. **3D-printed plugs or mold sections** — typically FDM or large-format SLA for plugs; smaller parts for prototypes and fixtures.
3. **Composite molds** — made off the plug, then used for layup (wet, prepreg, infusion).
4. **Thermoforming / rotomolding molds** (future) — require specific draft and parting-line handling; phase 3+.

---

## Required export formats

### Solid-model exchange (CAM / mold making)

| Format | Ext | Purpose | Notes |
|---|---|---|---|
| **STEP (ISO 10303, AP214/AP242)** | `.step`, `.stp` | **Primary CAM interchange.** Solid + surface + assembly. | Required. Every modern CAM package reads STEP. Our canonical "real CAD" export. |
| **IGES** | `.igs`, `.iges` | Legacy CAD interchange | Required. Still demanded by some older CNC / pattern shops. Surface-only OK. |
| **Parasolid** | `.x_t`, `.x_b` | Native kernel format for SolidWorks, NX, Solid Edge | Nice-to-have. Many shops work natively in Parasolid. |
| **ACIS SAT** | `.sat` | Native kernel format for AutoCAD / Inventor, some older tools | Optional. Lower priority than STEP/IGES. |

### Mesh / 3D printing

| Format | Ext | Purpose | Notes |
|---|---|---|---|
| **STL** | `.stl` | De-facto 3D-printing standard. Triangle soup. | Required. Binary STL preferred; ASCII as option. |
| **3MF** | `.3mf` | Modern 3D-printing format — metadata, units, colors, multi-material | Required. Supported by Bambu Studio, PrusaSlicer, Cura, etc. Preferred over STL when the downstream tool supports it. |
| **OBJ** | `.obj` | General mesh interchange | Required. Good for visualization / rendering downstream. |
| **PLY** | `.ply` | Scan / mesh interchange with vertex attributes | Nice-to-have. Useful for curvature-colored meshes. |
| **glTF / GLB** | `.gltf`, `.glb` | Modern web-3D interchange | Nice-to-have. Good for the "share this hull on the web" export. |

### 2D plans (for auxiliary CNC / drawings)

| Format | Ext | Purpose | Notes |
|---|---|---|---|
| **DXF** | `.dxf` | 2D CNC / drafting | Required. Not for hulls (3D), but for auxiliary parts: bulkheads, seats, cockpit rims, parting-line templates. |
| **PDF (drawings)** | `.pdf` | Dimensioned lines plan, offsets table | Nice-to-have. Human-readable "blueprint." |
| **SVG** | `.svg` | Web-friendly 2D | Nice-to-have. |

### Data / numeric

| Format | Ext | Purpose | Notes |
|---|---|---|---|
| **CSV offsets** | `.csv` | Tabular hull offsets (station × waterline × buttock) | Required. Classical naval-architecture interchange. |
| **JSON hull document** | `.json` | bArcas-native format — full control nets, parameters, history | Required. "Save / share a hull" format. |
| **Michlet `.in`** | `.in` | Michlet's offset input format | Nice-to-have. Handy for validating our Michell implementation against Lazauskas's. |

---

## What "export a hull" actually means

The **primary hull surface** is a NURBS surface (or a small collection of them — see [../theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md)). Everything downstream is a derived artifact. Key derivations:

1. **Surface** (2-manifold) — the raw NURBS.
2. **Solid body** — the surface thickened or capped to produce a closed volume. For CAM, we typically want a solid plug, not just a thin shell.
3. **Mesh** — the surface tessellated to triangles at a specified tolerance.
4. **Mold shell** — a solid offset outward from the hull surface by the mold thickness, closed at the parting surface.
5. **Mold halves** — the mold shell split along a parting line, with tabs/bosses for alignment.

Each of these can be exported in one or more of the formats above.

---

## Plug workflow (CNC-milled composite plug)

Designer's path from bArcas → finished plug:

1. Design hull in bArcas. Iterate. Fix it at a specific version.
2. **Export hull as STEP** (as a solid body, trimmed at deck/sheer, with keel flat or pedestal added for machining).
3. Import STEP into CAM (Fusion 360, Mastercam, RhinoCAM).
4. Generate toolpaths for roughing + finishing on foam or MDF plug stock.
5. Mill the plug on a 3–5 axis CNC.
6. Fair, prime, and polish the plug by hand.
7. Lay up composite mold over the plug.

bArcas's job ends at step 2. Step 1 needs to produce a STEP that CAM can directly use — with sensible tolerances, single closed solid, proper units (mm or m declared in the STEP header).

---

## 3D-printed plug / mold workflow

1. Design hull.
2. **Export hull as 3MF or STL** — mesh at a tolerance matching the printer (typically 0.05–0.2 mm chord deviation).
3. For large kayak plugs, the hull is much larger than any single printer → **split into sections along Y-planes** (typically 200–500 mm sections for FDM). bArcas provides a built-in split operation.
4. Add alignment features (dovetails, keyways) at the split planes — also an bArcas operation.
5. Print, assemble, fair, use as plug for composite mold *or* as a direct thermoformable buck.

We should support STL and 3MF on equal footing. 3MF carries units and metadata; STL doesn't (ambiguous units is a real problem — always tell the user what they're exporting in).

---

## Composite mold workflow (from digital plug)

If the designer prefers to skip the physical plug:

1. Design hull.
2. **Offset the hull surface outward** by the mold shell thickness (e.g., 8 mm for a GRP mold).
3. Trim the offset shell along the parting line (usually the sheer, or a plane through the widest hull section).
4. Split into half-molds.
5. Export each half as STEP or STL for CNC or 3D-printing.

bArcas needs to provide:
- **Surface offsetting** with controllable thickness.
- **Parting-line definition** (user-drawn curve on the surface, or automatic "widest point by heading" algorithm).
- **Mold-split operation** producing two or more separate solids.
- **Flange and alignment feature generation** (phase 2+).

---

## Future: thermoforming and rotomolding molds

Phase 3+ targets. Requirements we'll add:

### Thermoforming
- **Positive mold** (male) or **negative** (female) depending on process.
- **Draft angles** ≥ 3–5° on all surfaces for release. Need a "draft-angle map" that flags surfaces below threshold.
- **Uniform wall thickness** consideration — sharp detail vanishes when sheet stretches.
- **Vent holes** at depressions.

### Rotomolding
- **Female mold** in two or more halves.
- **No undercuts** — must clear along the parting direction.
- **Parting line at widest horizontal section** typically.
- **Thin, uniform wall** in the molded part, no structural draft needed like thermoforming but still release draft.

These constraints need validation tools in the app: "check mold-release feasibility," "report minimum draft on hull," "flag undercut regions."

---

## Fidelity / tolerance budget

| Export target | Typical tolerance |
|---|---|
| CNC plug (foam / tooling board) | ±0.1 mm surface; STEP exact |
| CNC mold (aluminum / tooling board) | ±0.05 mm; STEP exact |
| 3D printing (FDM plug) | 0.1–0.2 mm chord deviation; STL/3MF |
| 3D printing (SLA) | 0.025–0.1 mm; STL/3MF |
| Visual/web glTF | 0.5 mm or coarser |

bArcas's mesher must take a **target chord deviation** (not a fixed triangle count) so the user can match their downstream process.

---

## API sketch

Every export is an API call (see [api-design.md](api-design.md)):

```
POST /hulls/{id}/exports
{
  "format": "step" | "iges" | "x_t" | "stl" | "3mf" | "obj" | "dxf" | "csv_offsets" | "json",
  "kind":   "hull_solid" | "hull_surface" | "mold_shell" | "mold_half" | "plug" | "offsets" | "lines_plan",
  "options": {
    "tolerance_mm": 0.1,
    "units": "mm" | "m" | "in",
    "split_planes": [...],            // for multi-section printing
    "offset_thickness_mm": 8.0,        // for mold shells
    "parting_line": "<curve ref>"      // for mold splits
  }
}
→ 202 { "export_id": "...", "download_url_when_ready": "..." }
```

Exports are asynchronous — STEP generation from a complex NURBS can take seconds; we stream status via WebSocket.

---

## Library and implementation notes

Likely implementation approach:
- **OpenCASCADE (OCCT)** via WASM — mature STEP / IGES / BREP support, open-source (LGPL).
- Alternative: **CAD Exchanger SDK** (commercial), high-fidelity.
- **Mesh export** — roll our own (simple) or use an existing library like `pygmsh` / `meshio` on the server.
- **3MF** — reference implementation from 3MF Consortium.
- **STEP validation** — required for professional downstream users; we test against published STEP validators.

---

## Related

- [architecture.md](architecture.md)
- [api-design.md](api-design.md)
- [roadmap.md](roadmap.md)
- [../theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md)
