# Existing hull design software

A survey of prior art. Grouped by intended use. For each, we note: what it does well, what it lacks relative to ArcasBoat's goals, and what we should learn from it.

---

## Kayak / small-craft specific

### BearBoatSP / BearBoatXL (Robert Livingston)
- **What it does well.** Purpose-built for kayak hulls. Parametric control curves lofted into stations. Computes hydrostatics and basic resistance. Exports offsets and station molds directly usable by strip builders.
- **What it lacks.** Desktop-only, non-web, no programmatic API, limited interactive 3D, no comparison workflow, steep learning curve.
- **What to learn.** The control-curve lofting formalism; the station-mold output pipeline; the community trust it has earned.
- See [bearboat-history.md](bearboat-history.md).

### Kayak Foundry (Ross Leidy)
- **What it does well.** Designed specifically for strip-built sea kayaks. Lofts a hull from deck/sheer/keel/waterline curves. Friendly to builders who think in terms of "stem profile, sheer line, keel line."
- **What it lacks.** Desktop Windows app, small user base, minimal programmatic API, older rendering.
- **What to learn.** The "design by curve family" approach — users describe the four or five signature longitudinal curves and the software lofts the rest.

### ProSurf / ProBasic / ProChine — the Nautilus System (New Wave Systems)
- **What it does well.** Full 3D NURB curve + surface hull design with **edit points on the surface** (Hollister's signature contribution since 1985), dynamic-curvature "K-curves" + Move%/Ooch-Point fine fairing, Gaussian-curvature color mapping, four bundled resistance models (**Holtrop, Delft 3, Kaper, DispMode/Savitsky-style**), hydrostatics, stability + cross-curves, constrained automatic hull variation (**Lackenby** "one-minus-prismatic" shift), ruling-line developable-plate layout. Ships with a kayak-class sample library going back to a 1990-dated `Greenland Kayak` SRF.
- **What it lacks.** Commercial, Windows desktop only (PE32 + InstallShield), no web, no programmatic API, no AI hooks.
- **What to learn.** Almost the entire interactive surface-editing vocabulary modern hull-design tools use — Nautilus either invented it or made it conventional. **Read [nautilus-system.md](nautilus-system.md) first.** Single most important takeaway: expose edit points *on* the surface in both local and global-interpolation modes; expose a Lackenby-style parametric variation as a first-class verb.
- **Lineage caveat.** Community lore (still to be confirmed) is that several Mariner Kayaks production hulls were designed in Nautilus; see [nautilus-system.md](nautilus-system.md#mariner--bearboat--nautilus--what-we-know-and-what-we-dont).

### CarvedBoat / strip-builder scripts
- A long tail of individual-builder scripts (Python, MATLAB, Excel) that generate offsets from simple parametric families. Useful reference material but not "products."

---

## General-purpose small-boat / yacht design

### DELFTship (formerly FreeShip+)
- **What it does well.** Free / open-source tiers. Subdivision-surface hull modeling (quad net refined to smooth surface — intuitive for beginners). Hydrostatics, stability, basic resistance. Large user community.
- **What it lacks.** Desktop-only, Windows-centric, limited scripting.
- **What to learn.** The subdivision-surface UX is genuinely friendly. Worth studying — it may be the right primary surface type for ArcasBoat, or at least a user-facing alternative to a raw B-spline net.
- License note: DELFTship is proprietary freeware; **FreeShip** is its GPL ancestor. We should be careful about any direct code reuse.

### FreeShip (GPL ancestor of DELFTship)
- Pascal / Delphi source, GPL-licensed. Academic-quality implementations of hydrostatics and Michlet integration.
- Useful as a reference for algorithms even if we don't reuse code directly.

### Rhinoceros 3D + Orca3D
- **Rhino** is a general NURBS modeler used by many professional yacht designers. **Orca3D** is a plugin that adds naval-architecture workflows (stations, hydrostatics, stability, resistance).
- **What it does well.** Industrial-strength NURBS. Deeply scriptable (Grasshopper, Python, C#).
- **What it lacks.** Desktop, proprietary, expensive, not web, not collaborative by default.
- **What to learn.** Grasshopper's node-based parametric design workflow is worth studying as inspiration for agent-driven design.

### Maxsurf (Bentley)
- **What it does well.** Professional naval-architecture suite. Relational Bezier hulls, resistance, seakeeping, structure.
- **What it lacks.** Ship/yacht oriented, very expensive, desktop.
- **What to learn.** Relational-geometry ideas (constraints between control points) — we may want similar in ArcasBoat.

### Michlet (Leo Lazauskas)
- Not a full designer; a solver. Computes Michell's thin-ship wave resistance from an offset file.
- **What to learn.** The offset-file format (input), and the Michell formulation itself, which we plan to re-implement inside ArcasBoat's drag estimator.

### SHIPFLOW, CAESES, NAPA, ShipConstructor
- Heavyweight commercial tools — industrial ship design, not kayak-scale. Reference only.

---

## CFD (downstream from hull design)

### OpenFOAM
- Open-source RANS / LES CFD framework. The standard "next step" when empirical resistance estimates aren't enough.
- **What to learn.** Export paths from ArcasBoat to OpenFOAM (STL of hull + OpenFOAM case dictionary).

### ANSYS Fluent, Star-CCM+
- Commercial CFD. Way beyond ArcasBoat scope; may be relevant as export targets for professional users.

---

## Adjacent 3D / parametric tools

### Fusion 360, Onshape, SolidWorks
- General parametric CAD. Not hull-design tools but relevant UX references for the interactive-3D experience we want.

### Grasshopper (Rhino plugin), Dynamo, Sverchok (Blender)
- Node-based parametric design. A good mental model for how an AI agent might "script" a hull: as a graph of operations, each with clear inputs and outputs.

### Blender
- Not a hull designer, but its subdivision-surface UX is excellent and its modifier stack is a parametric-design inspiration.

---

## What this tells us about ArcasBoat's position

Nothing in the market combines:
1. Kayak-specific workflows (stem/sheer/keel design, station molds).
2. Browser-native, collaborative.
3. API-first / agent-drivable.
4. Modern 3D rendering.
5. First-class comparison.

Point (3) is the biggest differentiator. Every existing tool assumes a human sits in front of it and clicks. None were designed for LLM agents to drive programmatically.

---

## Related

- [bearboat-history.md](bearboat-history.md)
- [nautilus-system.md](nautilus-system.md) — deep dive on the second primary-source lineage.
- [kayak-design-literature.md](kayak-design-literature.md)
- [../project/architecture.md](../project/architecture.md)
