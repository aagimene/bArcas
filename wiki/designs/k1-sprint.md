# K1 — flat-water sprint kayaks

Olympic-class flat-water sprint singles. Probably the most-optimized kayak hull on earth: purpose-built for going fast on perfectly flat water, over standard race distances.

---

## Context

The K1 is one of several **ICF-sanctioned classes**: K1 (single), K2 (double), K4 (four). Olympic distances are currently 200m, 500m, and 1000m (with distance sets shifting over time across men/women categories); there are also long-distance events.

Paddlers use a **double-bladed paddle**. K1s are distinct from C1 canoes (single-bladed, kneeling).

---

## Rules (current ICF — confirm against ICF rulebook)

| Rule | K1 |
|---|---|
| Maximum length | **5.20 m** |
| Minimum weight | **12 kg** (hull only) |
| Minimum width | **no minimum** (removed around 2000; previously 600 mm and earlier 510 mm) |
| Other | Cockpit opening may not be enclosed; open-deck construction governed by rule |

**The removal of the minimum width restriction** transformed K1 design. Before that, hulls were forced to 51 cm / 60 cm wide; after the rule change, designers raced to narrower beams. Modern K1s are 30–40 cm wide at their widest — **narrower than the paddler's hips**, requiring a tub in the hull to accommodate the paddler.

---

## What a K1 optimizes for

The racing problem is simple to state: **minimize time over a fixed distance on flat water.** That means minimizing resistance at the race's mean speed, given an ICF-legal hull and a paddler's sustainable power.

### Target speeds
- **Sprint finals (200m, 500m)** — elite men: 5.5–6.2 m/s (20–22 km/h).
- **1000m** — elite men: 5.0–5.4 m/s.
- Froude number: 0.75–0.87 on LWL ≈ 5.0 m. **Well above "hull speed."**

### What this implies

- **Maximum length.** 5.20 m is the cap; every competitive hull uses it.
- **Minimum beam** (subject to paddler hips and stability). Narrow → low wave-making.
- **High prismatic coefficient** (Cp 0.62–0.66). Racing hulls are fuller in the ends than sea kayaks, because at high Fr the wave system cares less about entry fineness and more about volume distribution that avoids creating a deep stern squat.
- **Low rocker** (near zero at speed). Flat water, no need to maneuver. Rocker costs wetted surface and drag.
- **Fine, wave-piercing bows** with vertical or slightly raked stems. Low bow volume minimizes wave-making.
- **Low freeboard** — saves weight and windage. Paddlers can reach the water easily.
- **Semi-hard chines on some designs** — a subtle feature that improves tracking.
- **Planing-like transitions** at the stern in some modern designs — the boat unstuck its wake, reducing stern squat.

### Stability is traded away

K1s have **very low initial stability** — typical GM_T values are small, often <0.05 m. Paddlers train their balance from childhood. Novices can't paddle a K1; even intermediate paddlers rarely can.

This is a deliberate tradeoff: initial stability requires waterplane width, which costs drag. Elite paddlers recover balance by paddle support and body adjustment.

### Paddler as integrated part

K1 design assumes a specific paddler weight class (typically 75–90 kg senior men). LCG and LCB are tuned for that weight. A heavier paddler will trim the boat differently and may need a different hull.

---

## Design variables K1s optimize

| Variable | Direction |
|---|---|
| LOA | Max (5.20 m) |
| LWL | Near LOA (minimal overhang) |
| Beam | Minimum for paddler hip clearance + stability floor |
| L/B | 13–17 |
| Cp | 0.62–0.66 |
| Rocker | Near zero |
| Entry half-angle | Very fine, 8–15° |
| Cross-section | Narrow V-like or semicircular |
| Wetted surface | Minimized for given V and stability |
| Mass | Minimum (12 kg) |

---

## Typical drag signature

- Frictional drag is a very significant fraction even at race speeds — the hull is long (large WSA) and Reynolds-moderated.
- Wave-making dominates above Fr ≈ 0.45.
- The drag curve **continues rising steeply** at race speed. A fitter paddler goes faster not because the hull "breaks" past a barrier, but because they can sustain higher power.

---

## Notable manufacturers and model lines (historical / current)

- **Nelo** (Portugal) — dominant force in K1 design for the past 20 years. Vanquish, Viper, MSHL and others.
- **Plastex / Vajda** (Hungary) — longtime K1 manufacturers.
- **Kirton** (UK) — historically significant.
- **Eurokayak**, **Hotwave**, **Epic** (formerly), **Plastex** — other significant marques.
- **Struer** (Denmark) — the "Mercedes of K1s" in an earlier era.

Design specifics vary, but all live within a very tight envelope set by ICF rules and race speeds.

---

## Marathon K1s — a relative

**Marathon / Long-distance** racing K1s are similar but relaxed — longer allowable length (historically), more stability tolerable (paddler can't stay at peak balance for a 2-hour race), sometimes wider beam.

---

## What ArcasBoat's K1-style reference hull looks like

A parametric starting point:
- LOA: 5.20 m (at the rule cap)
- LWL: 5.15 m
- Beam: 0.35 m
- Depth: 0.30 m
- Paddler mass: 80 kg
- Rocker: 0.01 m bow, 0.01 m stern (effectively flat)
- Entry half-angle: 10°
- Cp: 0.63
- Cross-section: soft V, narrowing to fine keel line

Not a real production K1 — a **didactic example** users can fork and compare.

---

## Related

- [../theory/drag-and-resistance.md](../theory/drag-and-resistance.md)
- [../theory/wave-making.md](../theory/wave-making.md)
- [../theory/stability.md](../theory/stability.md)
- [surfski.md](surfski.md) — the K1's ocean cousin
- [sea-kayaks.md](sea-kayaks.md) — the opposite end of the stability/speed tradeoff
