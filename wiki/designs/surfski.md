# Surfski

Ocean racing sit-on-tops. A different optimization problem from the K1: speed in rough water, not perfect flat water, and distance events rather than short sprints.

---

## Context

Surfskis originated in Australia as lifeguard rescue boats ("malibu skis") and evolved into open-ocean racers from the 1950s onward. The South African marathon scene (Durban, Cape Town) industrialized the modern surfski from the 1980s.

Distinctive features:
- **Sit-on-top** (not decked).
- **Molded seat bucket** with footwell.
- **Footwell drainage** — a venturi plug drains water that sloshes in.
- **Rudder**, foot-controlled.
- **Long and narrow** — closer to a K1 than to a sea kayak.

---

## Typical dimensions

| Class | LOA | Beam | Notes |
|---|---|---|---|
| **Spec (Elite / A-class)** | 5.8–6.5 m | 0.41–0.48 m | Main race category. ICF now has an "ocean racing" category with length limits. |
| **Intermediate / B-class** | 5.5–6.0 m | 0.45–0.50 m | Wider, more stable. |
| **Beginner** | 4.8–5.5 m | 0.50–0.60 m | Entry-level. |
| **SS (shorter-spec)** | 4.5–5.2 m | 0.45–0.52 m | Regional class. |

L/B is 11–14 for spec, often higher for elite. Cp is typically 0.62–0.66.

---

## What a surfski optimizes for

Unlike K1s (flat water, ~500m races), surfskis race:
- **Distances** of 10–50+ km.
- **Ocean conditions** — chop, swell, wind.
- **Downwind runs** — surfing each wave for a boost.

Requirements:

### Speed in calm water
Similar to a K1: narrow, fine entry, appropriate Cp. But...

### Seaworthiness
- **Positive pitch damping** — the bow should rise over swell, not spear through.
- **Reserve buoyancy** at bow, to avoid nose-in broaches.
- **Moderate rocker** — flat-water speed wants low rocker, but wave handling needs some.
- **Self-draining cockpit**.

### Downwind surfing ability
This is the **defining** surfski characteristic. Ocean racers pick up waves going their direction and accelerate past hull speed for seconds at a time. The hull needs to:

- Accelerate into a wave face when surfing.
- **Plane or semi-plane** on the wave — lift out of displacement mode briefly.
- Not broach when it does.
- Release cleanly at the bottom of the wave back to displacement mode.

This implies a hull with some **flat area aft** (a quasi-planing surface), relatively flat bottom behind midships, and rudder authority for directional control in a broaching moment.

### Stability
More than a K1 (must survive chop) but less than a sea kayak. Elite skis are still tippy — the "primary/secondary" stability split matters. High secondary stability lets paddlers edge the boat aggressively, which matters in surf.

---

## Design variables surfskis optimize

| Variable | Target |
|---|---|
| LOA | 5.2–6.5 m (spec ~6.3–6.5) |
| Beam | 0.41–0.50 m |
| L/B | 11–14 |
| Cp | 0.62–0.66 |
| Rocker | Moderate — more at bow than stern, some skis have asymmetric rocker |
| Bow volume | Generous, above waterline; pierces but then rises |
| Stern | Flatter, for downwind planing |
| Bucket position | Precisely tuned; LCG placement governs trim in calm vs swell |
| Rudder size | Generous; under-stern (surf rudder) or overstern (rudder behind hull) |

### Under-stern rudder
Modern competitive ocean racers almost universally use an **under-stern rudder** (mounted beneath the hull at the stern). It stays in the water through all conditions including wave crests, where an over-stern rudder can ventilate.

### Over-stern rudder
Beginner and intermediate skis use over-stern rudders — easier construction and maintenance, fine in less-demanding conditions.

---

## Drag signature

- At cruise speed (~2.5–3 m/s), drag looks like a long slender hull: mostly friction, growing wave-making.
- At peak downwind surfing (4–6+ m/s), the hull is briefly in semi-planing mode — drag curves from displacement theory are only part of the story.
- Surfski design optimizes a **time-averaged over a run**: fast enough to catch waves, stable enough to stay on them, forgiving enough to recover from misses.

---

## Notable manufacturers

- **Fenn** (South Africa) — longtime dominant brand, Mako and Swordfish designs.
- **Epic** (founded by Greg and Oscar Barton) — V series, including the V10 / V12 / V14 elite hulls.
- **Think** (NZ / South Africa) — Uno, Evo, Big EZ, Eze.
- **Stellar** — SES, SR, SEL series.
- **Nelo** — 520, 540, 560, 600 — also a K1 maker, crossover designs.
- **Kai Waa** — historical significance, still produces.

Design diversity within the spec class is significant — Fenn, Epic, and Nelo have visibly different signature shapes.

---

## Surfski vs K1 — a comparison

| | K1 (ICF) | Surfski (elite) |
|---|---|---|
| LOA cap | 5.20 m | 6.5 m (class-dependent) |
| Beam | Narrower | Slightly wider (for sea) |
| Rocker | Near zero | Moderate, often asymmetric |
| Cockpit | Sit-in tub | Sit-on bucket, foot well |
| Rudder | Optional, small | Always, under-stern preferred |
| Use | Flat water sprint | Open ocean distance / downwind |
| Stability | Very low | Low but higher than K1 |

---

## ArcasBoat's surfski-style reference hull

- LOA: 6.40 m
- Beam: 0.44 m
- L/B: 14.5
- Cp: 0.64
- Rocker: 0.06 m bow, 0.03 m stern
- Bucket: 3.4 m from stern
- Flat-ish stern section

---

## Related

- [k1-sprint.md](k1-sprint.md)
- [../theory/drag-and-resistance.md](../theory/drag-and-resistance.md)
- [../theory/seakeeping.md](../theory/seakeeping.md)
- [../theory/wave-making.md](../theory/wave-making.md)
