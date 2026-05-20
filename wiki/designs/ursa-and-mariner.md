# Ursa and Mariner — Livingston and the Broze brothers

The design family directly upstream of bArcas's name. This page sets out what's known about the Ursa kayaks (Robert Livingston) and the Mariner Kayaks line that descended from them. See also [../research/bearboat-history.md](../research/bearboat-history.md) for Livingston's software.

> **Caveat.** Primary sources for Ursa/Mariner design decisions are scattered across forum posts, Sea Kayaker magazine back-issues, and the Mariner Kayaks website/archives. Where a claim here is a synthesis, not a direct quote, we mark it. This page should grow more precise over time.

---

## Robert Livingston and the Ursa kayaks

Livingston was a Seattle-area designer and builder, active from roughly the 1970s through the 2000s. His approach was to **design kayaks numerically** — control curves, lofted stations, computed hydrostatics — using his own software (**BearBoatSP**) that eventually became BearBoatXL.

The **Ursa** kayaks were his flagship designs. Characteristics (synthesis; to be verified against primary sources):

- Full-length sea kayaks in the 17–18 ft range (≈5.2–5.5 m).
- Designed around **realistic sea conditions** — not flat-water efficiency, not pure Greenland rolling, but handling in rough water with a paddler-in-the-loop.
- Soft chines, moderate rocker, balanced bow/stern volume.
- Built in fiberglass, often one-off or small production.
- Design intent: a boat you could paddle all day in real Pacific-Northwest conditions without fighting it.

The name "Ursa" (Latin for "she-bear") connects to the constellation and myth that give BearBoat and, now, bArcas their names.

---

## Mariner Kayaks and the Broze brothers

**Mariner Kayaks** was founded in Seattle in 1978 by Matt and Cam Broze, with design partner Tom Steinburn. The Broze brothers were close to Livingston's work and acknowledge his influence on Mariner's design philosophy.

Mariner's design ethic is distinctive in the sea-kayaking world:

- **Seaworthiness as first priority.** Mariner Kayaks are designed to behave well in rough water, not just to look fast on paper.
- **Neutral, predictable handling.** The weathercocking / lee-cocking balance of their hulls is carefully tuned; many Mariner designs have historically been **skeg-less** (directional stability designed into the hull, not added as a skeg).
- **Soft chines, moderate rocker, balanced volume.**
- **Realistic displacement conditions.** Boats designed around actual paddler-plus-gear loads, not optimistic race weights.

Matt Broze wrote a long-running "Deep Trouble" column in *Sea Kayaker* magazine — accident reports and analysis, reinforcing the idea that sea kayaks exist in dangerous conditions and must be designed accordingly.

---

## Mariner production line (approximate — verify against current Mariner Kayaks catalog)

The Mariner line has evolved over the years. Representative models:

- **Mariner Coaster** — 12'6" / 3.81 m — short play boat for surf, rock gardens, and day trips. See [coaster-analysis.md](coaster-analysis.md).
- **Mariner II / II XL** — classic touring sea kayak, ~17 ft / 5.2 m.
- **Mariner Express** — faster touring kayak, longer and narrower.
- **Mariner Elan** — versatile mid-size tourer.
- **Mariner Max / Max XL** — larger-volume expedition kayaks.

(This is from memory of the Mariner catalog across the decades. Current offerings should be cross-checked at marinerkayaks.com.)

---

## The design characteristics of the family

A Mariner/Ursa-descended boat typically has:

| Feature | Typical |
|---|---|
| **Hull cross-section** | Soft-chined, with a semi-U bottom transitioning to flared topsides |
| **Rocker** | Moderate — enough to turn without fighting it, not so much that tracking suffers |
| **Bow** | Sharp but not fine-to-the-point — full forward volume for reserve buoyancy in chop |
| **Stern** | Drawn-out, fine, with enough volume for tracking and wave-handling |
| **Chines** | Soft, often with a subtle shoulder at the widest section |
| **Topsides** | Mildly flared, giving secondary stability as the boat heels |
| **Deck** | Moderate to low, often with a peaked foredeck for water shedding |
| **Skeg / rudder** | Historically skeg-less on many models; directional stability designed in |
| **Stability** | Low-to-moderate initial, strong secondary |

The soft chine + flared topsides combination is characteristic: it gives a lively "catch" when you edge the boat (initial stability increases as the flare enters the water), without the bone-jarring hard-chine transition.

---

## Why this lineage matters to bArcas

Three reasons.

1. **Software lineage.** BearBoatSP → BearBoatXL → bArcas. The control-curve lofting approach is inherited.

2. **Design philosophy.** Mariner/Ursa designs value **honest** handling — the boat does what it says on the box, in real conditions. This aligns with bArcas's "honest physics" commitment.

3. **Reference target.** The Coaster is a specific, well-known, short sea kayak that makes a perfect first comparison target for the app (the user has explicitly picked it). See [coaster-analysis.md](coaster-analysis.md).

---

## What we do *not* do

We do **not** plan to:
- Reverse-engineer any specific Mariner or Ursa hull from photos or measurements.
- Ship exact copies of proprietary designs in the bArcas reference library.
- Publish hull measurements that Mariner Kayaks has not publicly released.

We *do* plan to:
- Ship a "**Coaster-style**" reference hull — a parametric reconstruction with the *characteristic* dimensions and shape decisions, clearly labeled as such.
- Document the design philosophy and tradeoffs, with attribution.

---

## Related

- [coaster-analysis.md](coaster-analysis.md)
- [sea-kayaks.md](sea-kayaks.md)
- [../research/bearboat-history.md](../research/bearboat-history.md)
- [history-of-kayak-design.md](history-of-kayak-design.md)
