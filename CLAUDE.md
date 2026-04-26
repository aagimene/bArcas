# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

**Stage 0 — Research & Design. There is no source code yet.** The deliverable for this phase is the [wiki/](wiki/) directory: a research-and-design corpus describing what the project is and how it will be built. Treat the wiki as the authoritative spec. When asked to "implement" something, first check whether the wiki already specifies the resource model, math, units, or terminology — and if it does, follow it.

## Project identity

- **Product name:** ArcasBoat (used throughout the wiki and any user-facing copy).
- **Repository / package name:** `bArcas`.
- These are intentionally different. Don't "fix" one to match the other.

ArcasBoat is a browser-based, API-first, visual kayak hull design tool — a modern spiritual successor to **BearBoatXL** (which is itself a port of Robert Livingston's **BearBoatSP**, the software used to design the Ursa kayaks that inspired the Mariner Coaster). The lineage is load-bearing: the project is named for it and cites it explicitly.

## Repository layout

```
wiki/        Research, design docs, theory, terminology, reference designs.
             This IS the main Phase-0 deliverable.
prototypes/  Small, self-contained interactive concept demos (vanilla
             HTML/CSS/JS, no build step). Each lives in its own subdirectory
             and is intentionally throw-away — code may be scrapped when
             the main app starts. Served by GitHub Pages from main at
             aagimene.github.io/bArcas/prototypes/<name>/. See
             prototypes/README.md for conventions (SI internally, hover
             for definitions, click for equations, mobile-friendly).
resources/   Read-only reference material from prior art.
             resources/bearboatxl/ contains the BearboatXL manual PDF and
             the original BearboatXL.zip. Do not edit; treat as archived
             primary sources. Cite by relative path when referencing.
```

The wiki is organized into seven sections — start at [wiki/README.md](wiki/README.md) for the index. The most load-bearing pages for any future engineering work are:

- [wiki/project/overview.md](wiki/project/overview.md) — what ArcasBoat is (and isn't).
- [wiki/project/architecture.md](wiki/project/architecture.md) — layered system sketch, candidate tech, data model.
- [wiki/project/api-design.md](wiki/project/api-design.md) — resource model, verb conventions, the "every design action is an API call" rule.
- [wiki/project/export-formats.md](wiki/project/export-formats.md) — required CAD/CAM/3D-printing formats and the downstream workflows they feed.
- [wiki/project/roadmap.md](wiki/project/roadmap.md) — phases and exit criteria.
- [wiki/theory/](wiki/theory/) — math/physics that the geometry kernel, hydrostatics, drag, and stability solvers must implement.

## Hard rules (do not violate without an explicit decision to change them)

These are stated across the wiki — collected here so they aren't re-litigated every conversation. From [wiki/project/roadmap.md](wiki/project/roadmap.md#principles-that-should-not-change) and [wiki/project/api-design.md](wiki/project/api-design.md#principles):

1. **Every design action has a corresponding API call.** The UI is built on the API, not parallel to it. AI agents share the same surface as the UI.
2. **Resource-oriented, idempotent where possible.** `set_control_point(hull_id, idx, xyz)` is a primitive; `nudge_control_point` is convenience over it, never a primitive.
3. **No hidden state in the API.** No "currently selected hull"; every call names the hull it acts on.
4. **Events, not mutations.** Modifications append to a per-hull event log; current state is a fold of the log. Undo = soft inverse event, not destructive.
5. **Explicit SI units at the API boundary.** Meters, radians, kilograms, m/s. The UI translates to feet/knots/degrees for display — never the API.
6. **Every reported physics number cites its formula** (ITTC 1957, Michell, Holtrop-Mennen, Savitsky, etc.) with assumptions and validity range. No hidden constants.
7. **Comparison is the default interaction mode.** No "current model" singleton — many-hull views are primary.
8. **Production-grade exports are mandatory.** STEP and STL are required for Phase-1 exit. See the [export-formats](wiki/project/export-formats.md) table for the full required/nice-to-have split.

## Explicit non-goals

Don't propose work in these directions without first flagging that they're out of scope:

- **Strip-built and skin-on-frame construction workflows.** Out of scope as downstream targets; the supported build paths are CNC plugs, 3D-printed plugs/mold sections, and composite molds (later: thermoforming, rotomolding).
- **Structural / FEA analysis, laminate schedules, toolpath planning.** Hull shape only.
- **RANS CFD.** Drag is estimated via empirical formulas (ITTC, Savitsky) and thin-ship integrals (Michell). Users wanting RANS export to OpenFOAM.
- **Racing-class rules certification** (e.g. ICF K1 legality).
- **Offline-first / desktop client.** Browser-native is a requirement.
- **General-purpose boat design.** Canoes are likely adjacent scope; SUPs maybe; sailboats / powerboats / ships are out.

## Naming and terminology

- Use established naval-architecture and kayak vocabulary as defined in [wiki/terminology/](wiki/terminology/) — don't coin new terms when an existing one fits.
- Reference designs (Coaster, Nordkapp, K1, Greenland qajaqs, Ursa, Mariner) are first-class citizens; cite them by name when relevant.

## Documentation conventions

When editing or adding wiki pages:

- Cross-link liberally with relative Markdown paths, matching the existing style (e.g. `[architecture.md](architecture.md)`, `[../theory/hydrostatics.md](../theory/hydrostatics.md)`).
- End most pages with a `## Related` section listing sibling docs.
- Keep the tone factual and citation-friendly — the wiki is meant to be readable by an engineer starting cold.
- Sentence-case headings; ATX (`#`) style; tables for comparative material (formats, users, candidate tech).

## When code work begins

Once Phase 1 starts, this file should be updated with: build/test/lint commands, the actual project structure, the chosen tech stack (the wiki lists candidates — React + TypeScript frontend, OpenCASCADE via WASM for the geometry kernel, Python/FastAPI backend with possible Rust hot paths, MCP server for agents — but **none are committed**), and conventions for SDK packaging. Until then, this section is a placeholder.
