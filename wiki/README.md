# bArcas Wiki

A research and design wiki for **bArcas** — a browser-based, API-first, visual kayak hull design tool.

> *Arcas was the son of Callisto (the Great Bear / Ursa constellation) and Zeus. He is the namesake we inherit from BearBoat, whose ancestor BearBoatSP was used to design the Ursa kayaks that inspired the Mariner Coaster.*

---

## How this wiki is organized

| Section | Purpose |
|---|---|
| [Project](project/overview.md) | Vision, architecture, API, export formats, AI integration, roadmap |
| [Research](research/bearboat-history.md) | Prior art — BearBoat lineage, other hull design tools, literature |
| [Theory](theory/README.md) | Math, hydrostatics, hydrodynamics, drag, stability, seakeeping |
| [Terminology](terminology/hull-terms.md) | Naval architecture and kayak-specific vocabulary |
| [Variables](variables/design-variables.md) | What we design, what we compute, what we simulate |
| [Designs](designs/README.md) | History of kayak hull designs, by category |
| [Features](features/showcase-gallery.md) | Showcase, comparison, AI workflows |

---

## Quick-start reading order

1. **Why this exists** → [project/overview.md](project/overview.md)
2. **What a kayak hull actually is** → [terminology/kayak-anatomy.md](terminology/kayak-anatomy.md)
3. **How we describe it mathematically** → [theory/hull-geometry-representation.md](theory/hull-geometry-representation.md)
4. **What forces act on it** → [theory/hydrostatics.md](theory/hydrostatics.md), [theory/drag-and-resistance.md](theory/drag-and-resistance.md)
5. **What designers optimize for** → [designs/README.md](designs/README.md)
6. **How the app lets you design** → [project/api-design.md](project/api-design.md)

---

## Core principles

- **API-first.** Every design action is a documented, idempotent API call. The UI is one of several clients; AI agents are another. See [project/api-design.md](project/api-design.md).
- **Physics you can see.** Hydrostatic/hydrodynamic quantities render alongside the hull in real time, not on a separate "analysis" tab. See [project/visualization.md](project/visualization.md).
- **Compare, don't replace.** Every hull is first-class and comparable. No "current model" singleton — side-by-side is the default. See [features/side-by-side-comparison.md](features/side-by-side-comparison.md).
- **Honor the lineage.** We cite BearBoat, Mariner, Winters, Killing, and Greenland traditions explicitly; this is a tool *for* the kayak-design community, not a black box. See [research/bearboat-history.md](research/bearboat-history.md).
- **Manufacturable output.** Every hull must be exportable in formats that feed directly into CNC, 3D printing, and composite-mold workflows — STEP, IGES, STL, 3MF, and friends. Strip / SOF are explicitly out of scope. See [project/export-formats.md](project/export-formats.md).

---

## Status

Stage 0 — **Research & Design**. This wiki is the first deliverable. No code yet.

See [project/roadmap.md](project/roadmap.md) for planned phases.
