# Hull terminology (naval architecture)

General small-craft and naval-architecture vocabulary, as ArcasBoat uses it. Kayak-specific terms are in [kayak-anatomy.md](kayak-anatomy.md).

Where a term has multiple accepted names, the **bold** one is ArcasBoat's preferred.

---

## Axes and planes

- **Bow** — the front of the boat.
- **Stern** — the back of the boat.
- **Port** — left, facing forward.
- **Starboard** — right, facing forward.
- **Amidships / midship** — roughly half-way along the LWL.
- **Fore** — toward the bow.
- **Aft** — toward the stern.
- **Beam** — transverse (left-right) direction; also the widest transverse dimension.
- **Depth** — top-to-bottom dimension of the hull structure.
- **Baseline** — a horizontal reference plane, typically at the lowest point of the hull, used for measuring heights.
- **Center plane / center line** — the vertical longitudinal plane on which the hull is symmetric.
- **Waterline** — an intersection of the hull with a horizontal plane. The **design waterline** is the one at intended displacement.
- **Waterplane** — the horizontal plane at the current waterline height.
- **Forward perpendicular (FP)** — vertical reference line at the foremost waterline point.
- **Aft perpendicular (AP)** — vertical reference line at the aftermost waterline point (or for some traditions: at the rudder post).
- **Midship section** — the station halfway between FP and AP.

---

## Lengths and widths

- **LOA — Length Overall** — the full length from bow-most to stern-most point, regardless of waterline.
- **LWL — Length on Waterline** — the length measured on the design waterline.
- **LBP / LPP — Length Between Perpendiculars** — distance from FP to AP. Kayakers usually ignore the distinction; LWL is the useful number.
- **Beam (B)** — maximum width of the hull (usually above water).
- **BWL — Waterline Beam** — maximum width at the design waterline.
- **B_max** — maximum beam, often equal to or slightly greater than BWL.
- **Draft (T)** — vertical distance from waterline to deepest part of the hull.
- **Freeboard** — vertical distance from waterline to deck at a given station.
- **Depth of hull (D)** — baseline to deck.

---

## Geometry features

- **Keel** — the longitudinal center-bottom of the hull. The "keel line" is its profile.
- **Stem** — the forward curve of the hull from keel to sheer. A "raked stem" is swept forward at the waterline; a "plumb stem" is vertical.
- **Stern profile** — the corresponding profile aft. Kayaks rarely have distinct "transom" or "counter" features but canoes and sea kayaks can have slightly cut-off sterns.
- **Sheer / sheer line** — the top edge of the hull, where deck meets side.
- **Gunwale** (gun-ul) — on an open boat, the top edge of the hull side. On a decked kayak, roughly equivalent to the sheer.
- **Chine** — the longitudinal line where the bottom of the hull meets the side.
  - **Hard chine** — a sharp crease (common on stitch-and-glue plywood designs).
  - **Soft chine** — a rounded transition (common on composite and most production kayaks).
  - **Multi-chine** — multiple creases, simulating a rounder shape with flat panels.
- **Tumblehome** — inward curvature of the hull sides above the widest point; sides bend inward as they rise.
- **Flare** — outward curvature of the hull sides above the widest point; sides widen as they rise.
- **Deadrise** — angle of the hull bottom relative to horizontal at a given station. Flat bottom = 0° deadrise. V-bottom = large deadrise.
- **Rocker** — longitudinal curvature of the keel line in profile. "More rocker" = more bow-and-stern rise. Major determinant of turning vs. tracking.
- **Rise of floor** — how quickly the bottom rises from the keel at a given section (similar but not identical to deadrise).
- **Entry / entrance** — the bow end of the hull below the waterline. **Entry half-angle** = the angle the waterline makes with the center plane at the bow.
- **Run / exit** — the stern end of the hull below the waterline. Run affects separation, pressure recovery, and wave-making.
- **Midbody / parallel middlebody** — the section of the hull where cross-section is roughly constant. Long parallel middlebody = inefficient at kayak scale (usually absent).

---

## Buoyancy / stability terms

- **Displacement (Δ or ∇)** — the weight (mass) or volume of water displaced. Equal to boat + load mass.
- **Trim** — fore-aft angle. Positive trim = stern down; negative = bow down. Depends on convention — we explicitly use "bow up positive" or "bow down positive" per context.
- **List / heel** — transverse tilt angle.
- **Center of buoyancy (B, CB)** — centroid of the displaced volume.
  - **LCB** — longitudinal component.
  - **VCB / KB** — vertical component (measured from baseline).
  - **TCB** — transverse component (zero at upright for symmetric hulls).
- **Center of gravity (G, CG)** — centroid of the boat's mass (including load).
  - **LCG**, **VCG / KG**, **TCG**.
- **Metacenter (M)** — the geometric pivot point for small heel angles.
  - **BM_T, BM_L** — metacentric radii (transverse, longitudinal). From [hydrostatics.md](../theory/hydrostatics.md).
- **GM — metacentric height** — $GM = KM - KG$. The single most used small-angle stability number.
- **GZ — righting arm** — horizontal distance from G to buoyancy line of action at a given heel. Defines large-angle stability.
- **AVS — angle of vanishing stability** — heel angle where GZ first returns to zero going positive-to-negative.

---

## Hull coefficients

- **C_B — block coefficient** — $V / (L \cdot B \cdot T)$.
- **C_P — prismatic coefficient** — $V / (L \cdot A_m)$.
- **C_M — midship coefficient** — $A_m / (B \cdot T)$.
- **C_WP — waterplane-area coefficient** — $A_{wp} / (L \cdot B)$.
- **C_VP — vertical prismatic coefficient** — $V / (A_{wp} \cdot T)$.

---

## Motion

- **Surge** — fore-aft translation.
- **Sway** — side-to-side translation.
- **Heave** — vertical translation.
- **Roll** — rotation about longitudinal axis.
- **Pitch** — rotation about transverse axis.
- **Yaw** — rotation about vertical axis.

6 degrees of freedom. Seakeeping = roll/pitch/heave; maneuvering = sway/yaw with surge coupling.

---

## Hydrodynamic terms

- **Wake** — the disturbed water behind the hull.
- **Kelvin wake** — the classic V-shaped wave pattern trailing a surface vessel.
- **Entry, run, parallel middlebody** — longitudinal regions of the underwater hull.
- **Wetted surface** — area of the hull below the waterplane.
- **Form drag** — drag due to hull shape beyond flat-plate friction.
- **Wave-making drag / resistance** — drag from energy radiated as surface waves.
- **Induced drag** — drag associated with lift (relevant for skegs, rudders).
- **Squat** — the hull sinks bodily and trims bow-up at speed.

---

## References

- Lewis, *Principles of Naval Architecture* (SNAME) — canonical.
- Chapelle, *American Small Sailing Craft* — traditional small-craft vocabulary.
- Winters, *The Shape of the Canoe* — canoe/kayak-specific usage.

See also [../research/kayak-design-literature.md](../research/kayak-design-literature.md).

---

## Related

- [kayak-anatomy.md](kayak-anatomy.md)
- [../theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md)
- [../theory/hydrostatics.md](../theory/hydrostatics.md)
