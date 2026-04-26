# The Mariner Coaster — design analysis

A detailed look at the **Mariner Coaster**, our canonical comparison target. The user has identified this as the specific boat they want to reproduce parametrically and compare against.

This page documents what we know about the Coaster's dimensions and design decisions, and lays out the variables ArcasBoat should visualize for a "Coaster-style" hull.

> **Caveat.** Mariner Kayaks has been quiet about detailed geometry; published specs are limited. Specific numbers below are from memory of Mariner's public materials and Sea Kayaker magazine coverage — they should be verified against primary sources before we ship a reference hull. Where precise numbers are uncertain, the *direction* (long/short, high/low, more/less than typical) is usually clear.

---

## What the Coaster is

A **short sea kayak** — 12'6" (3.81 m) — designed for day trips, surf, rock gardens, and play. Not an expedition boat; not a pure race boat. It's a deliberate miniature: a full sea kayak in proportions and features (skeg-less, decked, composite, spray-skirted) but short.

Historically positioned by Mariner as the "other" sea kayak: fun, maneuverable, and seaworthy rather than fast or capacious.

---

## Known / approximate dimensions

| Dimension | Approximate |
|---|---|
| LOA | 12' 6" / 3.81 m |
| Beam (max) | 26" / 0.66 m |
| Depth | 11" / 0.28 m |
| Cockpit | Keyhole, ~32" × 17" (0.81 × 0.43 m) |
| Weight (hull, glass layup) | ~42 lb / 19 kg |
| Hatches | Small fore and aft day-hatch style |
| Skeg / rudder | None (by design) |

These are approximate; the app's reference hull will explicitly say "Coaster-style, parametric reconstruction."

---

## Design decisions — why it is the way it is

### 1. **Short length** — 3.81 m (12'6")

Unusual for a sea kayak. Consequences:

- **Much easier to maneuver** — pivot turns, sweep strokes, broken-water play.
- **Much easier to transport** — fits inside many SUVs and trucks.
- **Lighter.**
- **Slower** at cruise — less LWL means lower "hull speed" and more wave-making at any given paddling speed.
- **Less capacity** — minimal cargo space.

The Coaster is specifically *not* trying to be fast.

### 2. **Moderate-to-wide beam for its length** — 0.66 m

L/B ≈ 3.81 / 0.66 ≈ 5.8. That's noticeably beamier than a touring sea kayak (L/B 8–11). Consequences:

- **High initial stability for a sea kayak.**
- **Forgiving in surf** — the paddler can brace aggressively without the boat going flat.
- **Relatively high wetted surface** per unit displacement — contributing to drag.

### 3. **Soft chines with pronounced flare**

Characteristic Mariner cross-section: a rounded bottom transitioning through a soft shoulder to flared topsides. When the boat heels:
- Initial waterplane narrows (as the rounded bottom lifts).
- Flare then submerges, rapidly widening the effective waterline and providing strong **secondary stability**.
- The transition feels "firm" rather than "loose" — the boat holds an edge.

This is **good for surf**. The paddler can lean the boat aggressively through a wave and get a reliable response.

### 4. **Moderate rocker**

Enough rocker to turn quickly (which a short boat already does) and to ride up over waves. Not so much that tracking is gone — a Coaster still goes where you point it.

### 5. **Skeg-less**

Mariner designs the Coaster's directional stability into the hull shape rather than adding a skeg. The asymmetry of under-hull profile (a bit finer aft, fuller forward) and the rocker distribution yield a tracking balance that's stable in calm and responsive in wind without needing deployable control.

Tradeoffs: in strong crosswind, a skeg-less boat may be harder to hold on line than a skeg-equipped one. But for surf play, a skeg box is one more thing to damage.

### 6. **Moderate deck volume**

Enough to be seaworthy (water sheds off, bow resurfaces after wave burial). Not so high that windage dominates. A normal foredeck peak; flatter afterdeck.

### 7. **Low cockpit coaming, moderate cockpit**

Fits a spray skirt, fits a paddler, doesn't impede rolling.

---

## Typical on-water feel

From paddler reports (Sea Kayaker reviews, forum posts):

- **Turns quickly** — pivot on a stroke.
- **Stable enough** for intermediate paddlers at rest.
- **Holds an edge firmly** when leaned for turning.
- **Plays well in small surf** — accelerates onto waves but doesn't planing-surf like a surfski.
- **Slow at cruise** compared to full-length boats — perhaps 2.0 m/s comfortable, 2.3 m/s hard.
- **Forgiving in rough water** — the flared topsides and firm secondary feel reassuring.

---

## What ArcasBoat's "Coaster-style" reference looks like

A parametric reconstruction:

| Parameter | Value |
|---|---|
| LOA | 3.81 m |
| LWL | ~3.55 m |
| Beam (max) | 0.66 m |
| BWL | 0.58 m |
| Depth | 0.28 m |
| Design displacement (paddler 80 kg + gear 15 kg + boat 19 kg) | 114 kg |
| Draft (design) | ~0.10 m |
| Cp | ~0.57 |
| C_WP | ~0.78 |
| L/B | 5.77 |
| Rocker bow | 0.06 m |
| Rocker stern | 0.04 m |
| Cross-section (midship) | Soft-chine, semi-round bottom with ~15° flare above shoulder |
| Entry half-angle | ~22° |
| Appendages | None |

This is a starting point; the user is expected to tune it.

---

## Metrics ArcasBoat should visualize when comparing a Coaster-style to other boats

- **Drag curves** — side-by-side with a K1, a Nordkapp, a surfski. The Coaster's short LWL shows up as rising drag above ~2 m/s.
- **GZ curves** — Coaster's flared topsides give a characteristic "late peak, late AVS" shape versus a narrower touring boat.
- **Sectional area curve** — Coaster is stubby and relatively full; compare to a long K1's peaked-and-fine SAC.
- **3D overlay** — with aligned waterlines, the Coaster's short length is visually striking.
- **Pivot-turn visualization** (phase 3+) — how fast yaw develops per stroke force applied.

---

## Why the Coaster is a great first comparison target

1. **Short and distinctive** — visually differentiated from longer hulls, so comparisons are easy to see.
2. **Well-known** — lots of community discussion to validate against.
3. **Deliberately non-optimized-for-speed** — a good case study of "design for the *real* use case, not for maximum paper speed."
4. **Family connection** — directly in the BearBoat/Ursa/Mariner lineage that ArcasBoat honors.
5. **Teaches the tradeoff lattice** — every design decision is visibly a trade. Length for maneuverability; beam for stability; soft chine for forgiveness; no skeg for simplicity.

This is *the* reference hull for testing ArcasBoat's comparison UX.

---

## Open questions

- Exact LWL, displacement at common paddler weights, Cp, LCB — need primary sources (Mariner documentation, Sea Kayaker review tables).
- Specific rocker distribution along LOA.
- Deck volume above waterline — affects reserve buoyancy calculation.
- Waterplane shape — how much it narrows toward ends.

Resolving these is an early task for the reference-library work in phase 2.

---

## Related

- [ursa-and-mariner.md](ursa-and-mariner.md)
- [sea-kayaks.md](sea-kayaks.md)
- [../research/bearboat-history.md](../research/bearboat-history.md)
- [../features/side-by-side-comparison.md](../features/side-by-side-comparison.md)
- [../variables/performance-metrics.md](../variables/performance-metrics.md)
