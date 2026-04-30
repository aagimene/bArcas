# Prototypes

Small, self-contained interactive explorations of single concepts from kayak / hull design. Each prototype lives in its own directory, ships as static HTML+CSS+JS (no build step), and may get scrapped or rewritten as the main app takes shape.

## Index

- [stability/](stability/) — editable hull cross-section with live KB / BM / KM / GM / GZ, primary and secondary stability metrics, and an annotated GZ-curve plot.
- [loft/](loft/) — 3D hull lofted from a curved spine (rocker) and a set of cross-sections, with a rotatable Three.js view, side-view rocker editor, and cross-section editor. ([plan](loft-plan.md))

## Conventions

- **Vanilla HTML + CSS + JS, ES modules.** No bundler, no framework. A prototype should be readable end-to-end in a single sitting.
- **SI units in physics, formatted units in display.** Metres, kilograms, radians internally; metres / kg / degrees / knots in the UI.
- **Hover for definition, click for equation.** Anywhere a derived value appears, hovering its name shows the short definition and clicking the value shows the equation, current inputs, and result.
- **Mobile-friendly.** Pointer Events for drag interactions; layouts collapse to a single column on narrow screens.

## Local preview

```sh
cd prototypes/stability
python3 -m http.server 8000
# open http://localhost:8000
```

(Or open `index.html` directly — no build step. A local HTTP server is only needed if a future prototype starts importing other modules.)

## Deployment

Served by GitHub Pages from `main` at the repo root. Each prototype's URL is:

```
https://aagimene.github.io/bArcas/prototypes/<name>/
```
