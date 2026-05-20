# bArcas — bArcas

A research-and-design repository for **bArcas**: a browser-based, API-first, visual kayak hull design tool, and a modern spiritual successor to **BearBoatXL** (a port of Robert Livingston's BearBoatSP, the software used to design the Ursa kayaks that inspired the Mariner Coaster).

> *Arcas was the son of Callisto (the Great Bear / Ursa constellation) and Zeus. He is the namesake we inherit from BearBoat, whose ancestor BearBoatSP was used to design the Ursa kayaks that inspired the Mariner Coaster.*

## Status

**Stage 0 — Research & Design.** The main deliverable for this phase is the [wiki/](wiki/), which captures vision, architecture, API sketch, theory, terminology, reference designs, and feature plans in enough detail that an engineer can pick up Phase 1 cold. Alongside it, [prototypes/](prototypes/) holds small, self-contained interactive explorations of individual concepts.

See [wiki/project/roadmap.md](wiki/project/roadmap.md) for staged plans.

## What's in here

| Path | Contents |
|---|---|
| [wiki/](wiki/) | Project docs, theory, terminology, design history, feature sketches. Start at [wiki/README.md](wiki/README.md). |
| [prototypes/](prototypes/) | Small interactive concept demos (vanilla HTML/JS, no build). Live at `aagimene.github.io/bArcas/prototypes/<name>/`. |
| [resources/bearboatxl/](resources/bearboatxl/) | Archived primary sources from prior art: the BearboatXL manual PDF and original distribution zip. |
| [CLAUDE.md](CLAUDE.md) | Guidance for Claude Code instances working in this repo. |

## Where to start reading

1. **Why this exists** → [wiki/project/overview.md](wiki/project/overview.md)
2. **Vision and success criteria** → [wiki/project/vision-and-goals.md](wiki/project/vision-and-goals.md)
3. **Architecture sketch** → [wiki/project/architecture.md](wiki/project/architecture.md)
4. **API design** → [wiki/project/api-design.md](wiki/project/api-design.md)
5. **Required export formats** → [wiki/project/export-formats.md](wiki/project/export-formats.md)
6. **Roadmap** → [wiki/project/roadmap.md](wiki/project/roadmap.md)

### Michell Prototype (New Phase)
- **Michell Prototype Plan** → [wiki/project/michell-prototype.md](wiki/project/michell-prototype.md)
- **Michell TODO** → [wiki/project/michell-todo.md](wiki/project/michell-todo.md)
- **Clarifications & AI Directives** → [wiki/project/michell-clarifications.md](wiki/project/michell-clarifications.md)
- **Future Directions** → [wiki/project/future-directions.md](wiki/project/future-directions.md)

## Core principles

- **API-first.** Every design action is a documented, idempotent API call. The UI is one of several clients; AI agents are another.
- **Physics you can see.** Hydrostatic and hydrodynamic quantities render alongside the hull in real time, not on a separate "analysis" tab.
- **Compare, don't replace.** Every hull is first-class and comparable. No "current model" singleton — side-by-side is the default.
- **Honor the lineage.** BearBoat, Mariner, Winters, Killing, and Greenland traditions are cited explicitly.
- **Manufacturable output.** Every hull is exportable in formats that feed CNC, 3D printing, and composite-mold workflows — STEP, IGES, STL, 3MF, DXF, and friends. Strip-built and skin-on-frame construction are explicitly out of scope as downstream targets.

## Out of scope

bArcas is **not** a CFD package, a structural / FEA designer, a construction-planning tool, a strip-build or skin-on-frame planner, or a general-purpose boat designer. Hull shape only. See [wiki/project/overview.md](wiki/project/overview.md#what-arcasboat-is-not) for the full list.
