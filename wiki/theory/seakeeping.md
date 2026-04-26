# Seakeeping

How a hull behaves in waves — pitch, heave, roll, and their coupling. Out of primary scope for phase 1; documented here so we know what we're deferring.

---

## Why kayaks care about seakeeping

Paddlers don't move in flat water. A sea kayak's "on-the-water feel" is dominated by how it moves in waves, not by still-water drag. Specifically:

- **Pitch damping** — how the bow rides over a short chop.
- **Heave response** — vertical bouncing on swell.
- **Roll** — coupling with beam seas.
- **Directional stability in waves** — weathercocking, broaching.
- **Surf behavior** — planing and broaching on following seas.

None of this comes out of still-water hydrostatics. It all requires solving the hull's motion equations in a wave field.

---

## The governing model — 6-DoF rigid body in waves

Treating the hull as a rigid body with mass $m$, inertia tensor $I$, center of gravity $\mathbf{r}_G$:

$$
m\ddot{\mathbf{x}} = \mathbf{F}_\text{grav} + \mathbf{F}_\text{hydro}(\mathbf{x}, \dot{\mathbf{x}}, \eta(t), \dots)
$$

Hydrodynamic forces split into:
- **Radiation** — forces the hull generates by its own motion (added mass, damping).
- **Diffraction** — forces from the incident wave field on the hull held fixed.
- **Froude–Krylov** — forces from the incident wave pressure field integrated over the hull.

---

## Strip theory

Classical approximation: slice the hull into transverse strips, solve 2D potential-flow problems at each strip (added mass, wave damping), sum along length.

- Originally Korvin-Kroukovsky & Jacobs, 1957; Salvesen-Tuck-Faltinsen, 1970.
- Good for **long, slender** hulls at moderate Froude numbers — kayaks qualify.
- Outputs: motion transfer functions (heave and pitch RAOs), added resistance in waves.

Strip theory is the most reasonable engine for a kayak-scale seakeeping module: moderate cost, well-understood accuracy, broadly available open-source implementations.

---

## Roll

Roll doesn't come out cleanly from strip theory (2D strips don't roll well). For roll we usually add:
- **Linear roll damping** coefficient, estimated from bilge geometry and empirical factors.
- **Nonlinear damping** from viscous effects and eddy shedding — hard to predict without tests.
- **Coupling** to heave/pitch/yaw at large motions.

For kayaks, paddler body motion swamps hull roll dynamics. A full kayak seakeeping model really needs the paddler as a second body.

---

## What ArcasBoat will eventually compute (phase 3+)

- **Motion RAOs** (response amplitude operators) in regular waves of frequency $\omega$ and heading $\mu$.
- **Short-term statistics** in a sea state (significant wave height, spectrum shape).
- **Added resistance in waves** — how much extra drag the chop costs.
- **Broaching susceptibility** — stability derivatives in following seas.
- **Bow-immersion / green-water risk** in head seas.

All of this reports with wider uncertainty bands than still-water numbers. Seakeeping is genuinely harder than hydrostatics.

---

## What phase 1 does instead

Static hydrostatic reports plus *qualitative* flags:
- "Low reserve buoyancy forward" (from volume profile above waterline).
- "High bow volume above waterline" (good for head seas).
- "Low amidships freeboard" (risk in beam seas).
- "High rocker" (better in waves, costs flat-water speed).

Honest about being qualitative.

---

## Related

- [hydrodynamics.md](hydrodynamics.md)
- [paddler-dynamics.md](paddler-dynamics.md)
- [../designs/surfski.md](../designs/surfski.md)
