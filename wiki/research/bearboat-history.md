# BearBoat, BearBoatSP, BearBoatXL — history and lineage

bArcas descends directly from the BearBoat family of kayak-design programs. This page captures what we know about that lineage and why it matters.

> **Caveat.** Much of the public record for BearBoatSP lives in kayak-builder forums (Kayak Building Bulletin Board, paddling.com archives, Sea Kayaker magazine back-issues) and on personal builder sites. Where a claim here needs a citation and we don't have one, we say so inline. This page will grow more precise as we work through the PDF manual at `resources/bearboatxl/260116BearboatXL_Manual.pdf`.

---

## Robert Livingston

Robert "Bob" Livingston was a Seattle-area kayak designer and builder. He designed the **Ursa** series of kayaks. The Ursa designs were influential in the Pacific Northwest sea-kayaking community and directly inspired Matt Broze at Mariner Kayaks — most famously the **Coaster**, but also shaping the broader Mariner design philosophy.

Livingston's approach was mathematically careful: instead of carving out a hull shape and fairing by eye, he parameterized hulls as lofted B-spline/spline surfaces and computed hydrostatics / stability numerically. He wrote **BearBoatSP** as his personal design tool.

---

## BearBoatSP

- Authored by Robert Livingston.
- "SP" has been variously interpreted — the manual is the authoritative reference once we parse it.
- Classic Mac / early-Windows software (original releases predate 2000).
- Workflow: define a hull as a set of longitudinal control curves; software lofts transverse stations; computes hydrostatics, stability, and resistance estimates.
- Output: offset tables, station molds (for strip-built or stitch-and-glue construction), displacement curves.

The design loop that BearBoatSP institutionalized — parametric control curves → lofted stations → hydrostatic readout — is the template bArcas inherits.

---

## BearBoatXL

- Modern port of BearBoatSP.
- Lives as a standalone macOS (and possibly Windows) application.
- `resources/bearboatxl/BearboatXL.zip` in this repo is the macOS binary.
- `resources/bearboatxl/260116BearboatXL_Manual.pdf` is the user manual.
- The date code `260116` in the filename suggests a 2016 manual release (YYMMDD or DDMMYY) — to be confirmed.

We intentionally do **not** run the binary during this research phase. When we do need to cross-check BearBoatXL behavior, we run it directly from `~/Applications`.

---

## The Ursa → Mariner → Coaster thread

1. Livingston designs the **Ursa** kayaks using BearBoatSP.
2. Matt & Cam Broze (Mariner Kayaks, Seattle) are influenced by the Ursa designs. Mariner Kayaks becomes a respected small-shop sea-kayak builder with designs emphasizing seaworthiness, balanced handling, and realistic conditions.
3. The **Mariner Coaster** is designed within this tradition — a short (≈12'6"), relatively beamy sea kayak intended for play in surf and rock gardens while still being ocean-capable. See [../designs/coaster-analysis.md](../designs/coaster-analysis.md).
4. Later Mariner designs (Express, Elan, II, II XL) extend the line.

See [../designs/ursa-and-mariner.md](../designs/ursa-and-mariner.md) for the design genealogy.

### Which program designed which hull?

The historical record on the kayak side splits between two NURB-era programs of the same
generation:

- **BearBoatSP** (Livingston, Seattle) — confirmed to have been used for the **Ursa** designs.
- **Nautilus / ProSurf** (Hollister, Jamestown RI) — community claim is that several
  **Mariner Kayaks** production hulls were designed in this family. Plausible (timing,
  feature-fit, and the fact that Nautilus shipped kayak-class samples as early as 1990),
  but **not yet directly documented in this repo**. See
  [nautilus-system.md](nautilus-system.md#mariner--bearboat--nautilus--what-we-know-and-what-we-dont)
  for the open question. Both programs share the same underlying NURB-surface formalism,
  so a hull moving from one to the other loses very little.

---

## Why bArcas cites this lineage explicitly

Three reasons.

1. **Technical.** BearBoatSP's control-curve lofting is a proven formalism for kayak hulls. It is more opinionated (and more appropriate) than a general-purpose NURBS modeler like Rhino. We should understand *why* before we replace it.
2. **Cultural.** The kayak-building community takes provenance seriously — builders know which design inspired which, and who designed what. A tool that erases that history is a tool they won't trust. bArcas explicitly surfaces "forked from" relationships on every hull.
3. **Greek-myth-cute.** Ursa is Callisto (the Great Bear). Arcas is her son. "bArcas descends from BearBoat" is both accurate and a nice naming story.

---

## What we want from the manual

When we parse `260116BearboatXL_Manual.pdf`, we are looking for:

- **Control curve formulation.** Are they cubic B-splines? NURBS? What degree? What knot sequences?
- **Number of stations / fairing conventions.** How many transverse cuts does BearBoat loft through?
- **Hydrostatic integration method.** Simpson's rule on sectional areas? Direct mesh?
- **Resistance model.** Which formulas? What assumptions?
- **Stability model.** Heeled waterplane solve? What accuracy?
- **Output conventions.** Offset table spacing, station mold format, DXF layer conventions.
- **UI idioms.** What does BearBoat call things? We'd rather match than invent.

These will be extracted and placed in [../theory/](../theory/) pages with citations back to the manual.

---

## Sources & Citations

The history discussed here draws from primary software documentation and the archival records of the kayak design community:

1. **BearBoat & BearBoatXL Official Site:** Robert Livingston's software releases, manuals, and mathematical overviews are maintained at [bearboat.net](http://www.bearboat.net/).
2. **The Ursa Micro & Mariner Coaster History:** The direct lineage from Livingston's Ursa Micro to the Broze brothers' Coaster is documented by Mariner Kayaks in their [official Coaster history](http://www.marinerkayaks.com/mkhtml/coaster.html).
3. **Mythological Origin:** The naming connection between Ursa (the Great Bear) and Arcas is drawn from [Greek Mythology (Callisto and Arcas)](https://en.wikipedia.org/wiki/Arcas).
4. **Community Discussions:** Numerous threads on forums like [West Coast Paddler](https://www.westcoastpaddler.com/) preserve the oral history of BearBoatSP's use among amateur builders.

---

## Related

- [existing-hull-design-software.md](existing-hull-design-software.md)
- [kayak-design-literature.md](kayak-design-literature.md)
- [../designs/ursa-and-mariner.md](../designs/ursa-and-mariner.md)
- [../designs/coaster-analysis.md](../designs/coaster-analysis.md)
