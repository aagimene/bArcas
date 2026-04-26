# Paddler dynamics

The paddler is part of the hydrodynamic system — typically 40–60% of the total mass, a major contributor to the inertia tensor, and the sole source of propulsion and control. This page sketches what we model and what we defer.

---

## The paddler as a lumped mass (phase 1)

The simplest useful model:
- Paddler treated as a point mass $m_P$ at a known location $(x_P, y_P, z_P)$ in the boat's body frame.
- Optionally: represent the upper body separately from the lower body to capture leaning.

Contributes to:
- Total displacement (paddler weight adds to displaced water volume).
- LCG (load longitudinal center of gravity).
- KG (load vertical center of gravity), which enters $GM = KM - KG$. See [stability.md](stability.md).
- Inertia tensor, which enters dynamic roll period, pitch period.

User-editable in the app: paddler mass, sitting height, fore-aft seat position, gear mass.

---

## Propulsion

Paddle stroke produces a time-varying thrust roughly synchronized with the stroke cycle. For design purposes we usually assume **constant equivalent thrust** equal to the mean drag at cruise speed — we design the hull, not the stroke.

If we do want stroke dynamics (phase 3+):
- **Surge oscillation** — the hull accelerates during the stroke and decelerates in the recovery. Mean speed is a time-averaged equilibrium.
- **Yaw oscillation** — each stroke pushes the stern slightly to one side. The hull's directional stability damps this.
- **Pitch oscillation** — paddler torso rotates; reaction pitches the hull slightly.

---

## Leaning and edging

Paddlers intentionally lean the boat for:
- **Turn initiation** — weighting one rail shortens the effective waterline on that side, loosening the grip of the keel, allowing easier turning.
- **Wave management** — leaning away from waves presents a less-grabbing edge.
- **Balance recovery** — leaning to re-center CG over the hull.

In our static model, edging changes $KG$'s lateral component. In a dynamic model, it couples to roll, yaw, and the righting moment.

---

## Paddler as a control system

At scales finer than "edge the boat," the paddler is a closed-loop controller:
- Senses balance via vestibular + proprioception.
- Applies hip, knee, thigh inputs to counteract roll.
- Uses paddle strokes for corrective yaw and surge.

A detailed model of paddler-boat coupling is a research topic, not a design tool. We're not modeling it. We *are* however reporting numbers that paddlers can interpret: roll period, $GM$, secondary stability at typical heel, GZ at flooding angle.

---

## Where paddler dynamics meets design

| Design choice | Effect on paddler experience |
|---|---|
| Cockpit fore-aft position | LCG → trim; boat feels bow-heavy / stern-heavy |
| Seat height | $KG$ → initial stability; higher seat = "tippier" |
| Thigh-brace contact | Controllability; tight contact = strong edging, loose = passive riding |
| Beam at seat | Affects paddle entry angle; too wide = awkward catch |
| Deck shape behind paddler | Affects lay-back rolls (Greenland technique) |

ArcasBoat's UI exposes these as designer variables; our modeling stays static.

---

## Phase-1 deliverables

- Paddler mass and seat position as first-class inputs to hydrostatics.
- Paddler CG rendered visibly in the 3D view.
- Stability numbers computed *with* the paddler CG, not just the bare hull.

---

## Related

- [stability.md](stability.md)
- [seakeeping.md](seakeeping.md)
- [../variables/design-variables.md](../variables/design-variables.md)
