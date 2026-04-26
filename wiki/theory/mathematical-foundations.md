# Mathematical foundations

The core mathematics ArcasBoat uses to represent a hull surface. This page is a concise reference, not a textbook — we cite where deeper treatments live.

---

## 1. Parametric curves and surfaces

A hull is a **parametric surface**: a smooth map

$$
\mathbf{S}(u, v) : [0,1]^2 \to \mathbb{R}^3
$$

that takes two abstract parameters (think: "how far along the hull, and how far around the girth") and returns a 3D point. The whole design workflow is about choosing a family of such maps that we can edit intuitively.

### Polynomial basis

The most primitive family is polynomial:
$$
\mathbf{S}(u, v) = \sum_{i}\sum_{j} \mathbf{P}_{ij}\, u^i v^j
$$
with **control points** $\mathbf{P}_{ij}$. This is rarely used directly because high-degree polynomials oscillate. Instead we use **piecewise polynomial** bases.

---

## 2. Bézier curves

A degree-$n$ Bézier curve:
$$
\mathbf{C}(t) = \sum_{i=0}^{n} B_{i,n}(t)\, \mathbf{P}_i, \qquad B_{i,n}(t) = \binom{n}{i}(1-t)^{n-i} t^i
$$

Properties we care about:
- **Endpoint interpolation:** the curve passes through $\mathbf{P}_0$ and $\mathbf{P}_n$.
- **Convex hull property:** the curve lies inside the convex hull of its control points — useful for bounding boxes.
- **Affine invariance:** scaling / rotating the control points scales / rotates the curve.
- **Degree coupling:** with $n+1$ control points you get a degree-$n$ curve. Adding control points raises the degree — often undesirable.

Bézier surfaces (tensor products) are used but suffer from the degree-coupling problem; for real hulls we use B-splines instead.

---

## 3. B-splines

A B-spline curve of degree $p$ with knot vector $U = \{u_0, \dots, u_m\}$ and control points $\mathbf{P}_0, \dots, \mathbf{P}_n$:
$$
\mathbf{C}(u) = \sum_{i=0}^{n} N_{i,p}(u)\, \mathbf{P}_i
$$
where $N_{i,p}$ are the Cox–de Boor basis functions, defined recursively:
$$
N_{i,0}(u) = \begin{cases} 1 & u_i \le u < u_{i+1} \\ 0 & \text{otherwise} \end{cases}
$$
$$
N_{i,p}(u) = \frac{u - u_i}{u_{i+p} - u_i} N_{i,p-1}(u) \;+\; \frac{u_{i+p+1} - u}{u_{i+p+1} - u_{i+1}} N_{i+1,p-1}(u)
$$

Properties:
- **Local support.** Moving control point $\mathbf{P}_i$ only changes the curve over $p+2$ knot spans. Crucial for interactive editing.
- **Degree independent of control-point count.** Adding detail (more control points) doesn't increase wiggles.
- **Continuity controllable by knot multiplicity.** Kinks, corners, and smooth interpolation are all achievable.

For hulls we typically use **cubic** B-splines (degree 3, $C^2$ continuity) with either uniform or clamped knot vectors.

### B-spline surface (tensor product)
$$
\mathbf{S}(u, v) = \sum_{i=0}^{n}\sum_{j=0}^{m} N_{i,p}(u)\, N_{j,q}(v)\, \mathbf{P}_{ij}
$$

---

## 4. NURBS (Non-Uniform Rational B-Splines)

NURBS generalize B-splines by adding per-control-point **weights** $w_i$:
$$
\mathbf{C}(u) = \frac{\sum_i N_{i,p}(u)\, w_i\, \mathbf{P}_i}{\sum_i N_{i,p}(u)\, w_i}
$$

Advantages for hulls:
- **Exact representation of conics** (circles, ellipses, hyperbolas). Useful for bow rounds.
- **Weights give local "tightness" control** independent of control-point position.
- **Industry standard** — STEP, IGES, and most CAD interchange formats assume NURBS.

Most kayak hulls don't strictly require NURBS (weights are often all 1, reducing to a B-spline). But supporting NURBS interop with Rhino and other CAD tools is desirable.

---

## 5. Subdivision surfaces

Alternative: define a coarse polygon mesh ("control cage"), then apply a subdivision rule (Catmull–Clark, Loop) iteratively to smooth it.

- **Pro:** beginner-friendly UX (DELFTship uses this).
- **Pro:** handles arbitrary topology well (good for stern shapes with skegs).
- **Con:** not exact NURBS; hydrostatic integration on subdivided meshes introduces sampling error.
- **Con:** less standard in naval-architecture interchange.

Likely approach for ArcasBoat: **NURBS as the canonical representation**, with a subdivision-surface UX layer as an option for less-technical users.

---

## 6. Lofting — the BearBoat idiom

Rather than directly manipulating a 2D control-point grid, BearBoat-style design uses **lofting**:

1. User defines a small number of **longitudinal control curves** (e.g., sheer line, chine line, keel line, deck center line).
2. Software **interpolates transverse stations** by slicing these curves at regular length intervals.
3. A smooth surface is fit through the stations.

Mentally: you sketch the "silhouettes" in plan and profile, and the hull surface is derived. This is closer to how kayak designers actually think.

The ArcasBoat API will expose **both**:
- Raw NURBS control nets for CAD-minded users and agents.
- Longitudinal-curve lofting for kayak-native workflows.

Both produce the same underlying NURBS surface; they are alternative views.

See [hull-geometry-representation.md](hull-geometry-representation.md) for how lofting maps to the station / waterline / buttock grids that naval architects use.

---

## 7. Fairness

A "fair" hull has smoothly varying curvature — no humps, bumps, or inflection points except where intended. Unfair surfaces are ugly visually and hydrodynamically (they shed unintended eddies).

### How we measure fairness

- **Curvature combs** along key curves (stations, waterlines).
- **Gaussian curvature maps** on the surface.
- **Energy functionals** — integrate (κ₁² + κ₂²) over the surface; lower is fairer.
- **Second-derivative continuity** at knot boundaries.

ArcasBoat's editor renders curvature combs live. The [visualization.md](../project/visualization.md) page describes the UI surface.

### How we enforce fairness

- Default to **cubic** ($C^2$) splines.
- Hard constraints at bow/stern (tangency, curvature continuity).
- Optional "fairing pass" that finds the nearest fair surface to the current design, measured by a bending-energy functional.

---

## 8. Meshing

For rendering and numerical integration we tessellate the parametric surface into triangles.

- **Uniform $u,v$ sampling** is the baseline.
- **Curvature-adaptive sampling** gives better fidelity at the bow/stern where curvature is high.
- For hydrostatic volumes we can integrate **analytically** from the parametric surface using the divergence theorem, avoiding the mesh entirely for volume / moment calculations. Mesh is kept for rendering + wetted surface / stability.

---

## 9. Numerical integration

Several calculations require integration over the hull:

| Quantity | Integration |
|---|---|
| Volume displacement | Divergence theorem on closed surface, or Simpson over sectional areas |
| Waterplane area | Integrate the waterline curve's enclosed area at waterplane height |
| Wetted surface area | Sum triangle areas below waterplane |
| Longitudinal center of buoyancy (LCB) | First moment of displaced volume |
| BM_T, BM_L (metacentric radii) | Second moment of waterplane area / displaced volume |

We prefer Simpson's rule (1/3 and 3/8 variants) when integrating along evenly-spaced stations — it's the naval-architecture tradition and numerically solid.

---

## 10. Further reading

- Piegl & Tiller — *The NURBS Book* (the canonical reference).
- Farin — *Curves and Surfaces for CAGD*.
- Rogers — *An Introduction to NURBS*.
- For lofting specifically: Rogers & Adams, *Mathematical Elements for Computer Graphics*.

---

## Related

- [hull-geometry-representation.md](hull-geometry-representation.md)
- [../project/architecture.md](../project/architecture.md) — geometry kernel
- [../project/visualization.md](../project/visualization.md) — curvature combs, fairness displays
