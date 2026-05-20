# Computed hydrostatics

Variables the app *computes* from geometry + displacement condition. All are derived (never user-set directly) and live at predictable API endpoints (see [../project/api-design.md](../project/api-design.md#derivations-as-gets-with-query-params)).

---

## Scalar hydrostatics (per displacement condition)

| Variable | Symbol | Unit | Definition |
|---|---|---|---|
| Displaced volume | V, ∇ | m³ | Volume of hull below waterplane |
| Displaced mass | Δ | kg | ρ · V (water density × volume) |
| Waterline length | LWL | m | Length on the current waterplane |
| Waterline beam | BWL | m | Max width on the current waterplane |
| Max draft | T | m | Max depth below waterplane |
| Waterplane area | A_wp | m² | Area of the waterplane polygon |
| Wetted surface area | S, WSA | m² | Area of hull surface below waterplane |
| Longitudinal CB | LCB | m from midships | Centroid of volume along x |
| Vertical CB (from keel) | KB, VCB | m | Centroid of volume along z |
| Transverse CB | TCB | m | 0 at upright for symmetric hull |
| LCF — longitudinal center of flotation | LCF | m | Centroid of waterplane area |
| Transverse metacentric radius | BM_T | m | I_T / V |
| Longitudinal metacentric radius | BM_L | m | I_L / V |
| Transverse metacentric height | GM_T | m | KB + BM_T − KG |
| Longitudinal metacentric height | GM_L | m | KB + BM_L − KG |
| Immersion (TPCI) | — | kg/cm | ρ · A_wp · 0.01 |
| Moment to change trim 1 cm (MCT 1 cm) | MCT | kg·m / cm | Related to GM_L |
| Entry half-angle | α_entry | deg | Angle of waterline at bow |
| Exit half-angle | α_exit | deg | Angle of waterline at stern |

---

## Hull coefficients

| Coefficient | Symbol | Formula |
|---|---|---|
| Block | C_B | V / (L · B · T) |
| Prismatic | C_P | V / (L · A_m) |
| Midship | C_M | A_m / (B · T) |
| Waterplane area | C_WP | A_wp / (L · B) |
| Vertical prismatic | C_VP | V / (A_wp · T) |
| Length-to-beam ratio | L/B | L / B |
| Volumetric Froude number | Fr_∇ | U / √(g · V^(1/3)), reported at user-supplied U |

---

## Curves (vs waterline height)

The "hydrostatic curves" or Bonjean curves sheet. Each curve is parameterized by waterline height z_wl:

- V(z_wl)
- A_wp(z_wl)
- LCB(z_wl)
- KB(z_wl)
- LCF(z_wl)
- BM_T(z_wl), BM_L(z_wl)

Useful for exploring how the hull behaves under different load conditions.

---

## Sectional area curve

A(x) — cross-sectional area at each station x, at current waterplane. This is the input to Michell's integral for wave-making (see [../theory/wave-making.md](../theory/wave-making.md)) and is visually informative in its own right.

bArcas renders it as a live chart below the 3D view.

---

## Numerical method

bArcas computes hydrostatic integrals from the NURBS surface analytically where possible:

- **Volume / moments**: divergence theorem on the trimmed hull surface below the waterplane. Uses Gaussian quadrature on the parametric surface. Error bounded analytically.
- **Waterplane area / LCF / I_T / I_L**: integrate over the waterline loop (a closed curve on the hull at height z_wl).
- **Wetted surface area**: sum of triangle areas in the tessellation below waterplane. Mesh-dependent; tolerance settable.

Fallback method when surfaces are complex or mixed: Simpson's rule on sectional areas (classical).

---

## Caching

Every scalar is cached keyed by `(hull_event_log_hash, condition_hash)`. Moving a single control point invalidates only that cache line, recomputation is fast (sub-100ms for typical hulls).

---

## Related

- [../theory/hydrostatics.md](../theory/hydrostatics.md)
- [../theory/stability.md](../theory/stability.md)
- [performance-metrics.md](performance-metrics.md)
