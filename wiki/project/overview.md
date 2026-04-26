# Project Overview

**ArcasBoat** is a browser-based, visual, API-first kayak hull design app. It is a modern spiritual successor to BearBoatXL, which is itself a port of Robert Livingston's **BearBoatSP** — the software Livingston used to design the Ursa kayaks, which in turn inspired the Mariner Kayaks family (including the **Coaster**).

---

## Why the name "ArcasBoat"

| Name | Who | Relation |
|---|---|---|
| Callisto | Greek mythological figure, transformed into the Great Bear | The constellation **Ursa** |
| Arcas | Callisto's son (father: Zeus), later the constellation Ursa Minor | The descendant of Ursa |
| BearBoat | Robert Livingston's software | Named for "Ursa"/bear; produced the Ursa kayaks |
| **ArcasBoat** | This project | Descendant of BearBoat — the "Arcas" to BearBoat's "Ursa" |

The name is an explicit homage to the lineage. See [research/bearboat-history.md](../research/bearboat-history.md).

---

## Why this project exists

BearBoatXL is a real, working piece of software. But:

1. **Desktop-only.** No shareable web workflow. Designs live as local files.
2. **Not user-friendly.** It assumes deep familiarity with Livingston's workflow and terminology.
3. **No modern rendering.** 2D offsets and stations, limited 3D. No hardware-accelerated interactive view.
4. **No programmatic interface.** Every action is manual. An AI agent cannot drive it.
5. **Limited comparison.** You generally work on one hull at a time.

ArcasBoat addresses all five:

1. **Browser-native.** Hulls live in the cloud; sharing is a URL.
2. **CAD-like UX.** Interaction modeled on modern 3D CAD (Fusion 360, Onshape, Rhino).
3. **WebGL / WebGPU.** Hardware-accelerated rendering, live visualization of drag/stability fields.
4. **API-first.** Every design action has an API call. AI agents and scripts drive design identically to a human.
5. **Side-by-side is default.** Comparison is the organizing principle, not an afterthought.

See [project/vision-and-goals.md](vision-and-goals.md) for the deeper "what success looks like."

---

## What ArcasBoat is NOT

- **Not a CFD package.** We estimate drag using empirical formulas (Savitsky, ITTC, Michell) plus optional thin-ship / strip-theory solvers. If you need RANS CFD, export to OpenFOAM.
- **Not a structural designer.** No stringer/frame layout, no laminate schedule, no finite-element stress analysis. Hull shape only (for now).
- **Not a construction-planning tool.** We export CAD/CAM/3D-printing formats (STEP, IGES, STL, 3MF, DXF, offsets) — but we don't plan toolpaths, laminate schedules, or cure cycles. Actual construction workflows live downstream. See [export-formats.md](export-formats.md).
- **Not a strip-build or skin-on-frame planner.** The target downstream workflows are CNC-milled plugs, 3D-printed plugs/molds, composite molds, and (later) thermoforming/rotomolding molds. Strip / SOF are out of scope.
- **Not a general-purpose boat designer.** Canoes are a likely adjacent scope; SUPs maybe; sailboats, powerboats, and ships are explicitly out.

---

## Primary users

| User | Need |
|---|---|
| **Hobbyist composite builders** | Design a hull, export STEP for CNC plug or STL/3MF for 3D-printed plug sections, build a mold, lay up a boat |
| **Small-shop kayak builders** | Iterate designs, export STEP/IGES directly to CAM for plug milling, share with clients |
| **Professional kayak designers** | Iterate quickly, compare hulls, hand off production-ready CAD |
| **Researchers / students** | Study hydrostatics and drag on real hull shapes |
| **AI agents** | Explore the design space programmatically, propose candidates |

The AI-agent user is a first-class citizen, not an afterthought. See [project/ai-agent-integration.md](ai-agent-integration.md).

---

## Related pages

- [vision-and-goals.md](vision-and-goals.md)
- [architecture.md](architecture.md)
- [api-design.md](api-design.md)
- [export-formats.md](export-formats.md)
- [ai-agent-integration.md](ai-agent-integration.md)
- [visualization.md](visualization.md)
- [roadmap.md](roadmap.md)
- [../research/bearboat-history.md](../research/bearboat-history.md)
