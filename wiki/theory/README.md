# Theory

This section collects the math and physics ArcasBoat needs to implement. Each page aims to be honest about assumptions and validity ranges — we want the app to cite the same way this wiki does.

---

## Reading order

1. [mathematical-foundations.md](mathematical-foundations.md) — B-splines, NURBS, lofting. How we represent shape.
2. [hull-geometry-representation.md](hull-geometry-representation.md) — Stations, waterlines, buttocks, the body plan, offsets.
3. [hydrostatics.md](hydrostatics.md) — Displacement, buoyancy, coefficients (Cp, Cb, Cwp, …), LCB/VCB.
4. [stability.md](stability.md) — Metacenter, GM, GZ curves, initial vs secondary stability.
5. [hydrodynamics.md](hydrodynamics.md) — Reynolds number, Froude number, flow regimes.
6. [drag-and-resistance.md](drag-and-resistance.md) — Total resistance = friction + wave-making + form + induced. What we estimate and how.
7. [wave-making.md](wave-making.md) — Michell's integral, thin-ship theory, the "hull speed" myth, kayak-scale behavior.
8. [seakeeping.md](seakeeping.md) — Motion in waves, pitch and heave, coupled modes.
9. [paddler-dynamics.md](paddler-dynamics.md) — The paddler is part of the system; propulsion, weight transfer, leaning.

---

## Scope of ambition

At kayak scale (LOA 3–7 m, Reynolds ~10⁶–10⁷, Froude ~0.2–0.6):

- **Hydrostatics is exact (up to numerical integration).** We can trust our numbers.
- **Static stability is well-understood.** GZ curves at large heel are reliable within the usual displacement-hull assumptions.
- **Frictional resistance is empirical but accurate.** ITTC 1957 is fine for kayak-scale hulls.
- **Wave-making resistance is approximate.** Thin-ship (Michell) is good enough for most kayak hulls; slender-body corrections help; full CFD is better but not needed for design iteration.
- **Seakeeping is approximate.** Strip theory is available; CFD is not practical inside a design loop.
- **Paddler dynamics is a hard problem we won't solve fully.** We'll model the paddler as a lumped CG and offer simple stroke/thrust idealizations.

---

## Invariant we want to preserve

Every quantity ArcasBoat shows has three attached fields:
- **value** (with units)
- **method** (the formula/algorithm used)
- **assumptions** (what it takes for the number to be meaningful)

This is the honesty guarantee in [project/vision-and-goals.md](../project/vision-and-goals.md#g4-honest-physics).
