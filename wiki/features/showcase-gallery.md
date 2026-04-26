# Showcase gallery

A public, browsable gallery of hulls — reference designs shipped with ArcasBoat, plus user-shared designs.

---

## Why a showcase matters

A kayak designer doesn't want to start from zero. They want to:

- See exemplar designs for their target category.
- Fork a good starting point.
- Compare their work-in-progress against established designs.
- Share their finished design with others.

The showcase is the "front door" that makes this possible.

---

## What the showcase contains

### Reference hulls (shipped with the app)

A curated library of parametric reconstructions:

- Greenland-style qajaq
- Traditional touring (Nordkapp-style)
- Coaster-style (short playful sea kayak) — see [../designs/coaster-analysis.md](../designs/coaster-analysis.md)
- Expedition (British school, North American school)
- K1-style (ICF-legal sprint)
- Surfski-style (ocean racer)
- Recreational
- Whitewater (creeker, playboat)

Each reference hull has:
- A description of what it represents.
- The real-world design it's inspired by (explicitly parametric reconstruction, not a copy).
- Full hydrostatic / drag / stability analyses.
- Citations to [../designs/](../designs/) pages for deeper reading.

### User-shared hulls

Users can publish their designs to the showcase with:
- A name and description.
- Cover rendering (hero image).
- Tags (sea-kayak, surf, expedition, ...).
- Optional "fork of" attribution.
- Privacy settings (public, unlisted, private).

### Comparison collections

Not just individual hulls — curated *comparison* pages. Example:

- "The short sea kayak spectrum" — Coaster, Romany Surf, Delphin, Avocet at aligned scale, with overlaid stability and drag curves.
- "K1 evolution 1990–2020" — how the ICF rule changes reshaped hulls.
- "Greenland qajaq replicas" — ethnographic measurements rendered.

Curated comparison pages are essentially structured blog posts backed by live ArcasBoat data.

---

## Gallery UX

- **Card grid** — hero render + key specs (LOA, Beam, displacement, Cp).
- **Filters** — by category, LOA range, beam range, Cp range, tags.
- **Sort** — by popularity, recency, or metric (longest, narrowest, fastest at 2 m/s, etc.).
- **Search** — by name, designer, tags.
- **"Fork" button** — one-click creates a copy the user can edit.
- **"Compare" button** — add to an active comparison. See [side-by-side-comparison.md](side-by-side-comparison.md).

---

## Per-hull showcase page

A public URL per hull. Contents:

1. **Hero render** — interactive 3D view.
2. **Dimensions table** — parametric summary.
3. **Hydrostatics** — at design condition.
4. **Drag curve** — with method & assumptions.
5. **Stability curve**.
6. **Sectional area curve**.
7. **Provenance** — designer, forked from, tags, date created.
8. **Description / notes** — markdown, written by designer.
9. **Fork / compare / export** buttons (export respects permissions).
10. **History** — if public, a design-event timeline ("2026-03-01: decreased bow rocker by 10mm, WSA down 1.8%").

---

## Reference-hull structure (phase 2 work)

Each reference hull ships as a **versioned, citable artifact**:

```
reference-library/
├── coaster-style/
│   ├── v1/
│   │   ├── hull.json           # ArcasBoat-native
│   │   ├── hull.step           # CAD export
│   │   ├── hull.stl            # mesh
│   │   ├── metadata.yml        # provenance, citations, versions
│   │   └── README.md           # design notes, differences from original
│   └── v2/                     # as we refine over time
│       └── ...
├── nordkapp-style/
│   └── ...
└── ...
```

Users can cite "ArcasBoat reference hull coaster-style v1.2" in papers and forum posts.

---

## Permissions model

- **Public** — anyone with the URL can view, fork, export mesh/STL. Exporting solid CAD (STEP) may or may not be allowed per-hull (designer's choice).
- **Unlisted** — same as public but not indexed / searchable.
- **Private** — owner-only.
- **Shared** — explicit user grants.

Reference-library hulls are public with permissive fork/export defaults.

---

## What the gallery is not

- Not a marketplace (no commerce in phase 1–3).
- Not a paddler-review site (we're about geometry, not on-water reviews).
- Not a manufacturer catalog.

Focus: **designs**, not products.

---

## Related

- [side-by-side-comparison.md](side-by-side-comparison.md)
- [ai-workflow.md](ai-workflow.md)
- [../designs/README.md](../designs/README.md)
- [../project/api-design.md](../project/api-design.md) — the `/library` and `/comparisons` endpoints
