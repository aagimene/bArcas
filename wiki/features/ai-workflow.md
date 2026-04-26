# AI-driven design workflows

What it actually looks like, day to day, to design a kayak with an AI agent in the loop. Complements [../project/ai-agent-integration.md](../project/ai-agent-integration.md) (which covers the integration surface) with **user-facing workflow patterns**.

---

## Workflow 1 — "Design an imitation X"

User's own example: *"I want to make an imitation Coaster."*

### Interaction
```
user:   I want to make an imitation Coaster. Start from the 
        reference hull and show me the numbers.

agent:  [arcas.fork_hull("library/coaster-style") → h-new]
        [arcas.get_hydrostatics(h-new)]
        [arcas.get_drag_curve(h-new, 0, 3.5)]
        [arcas.get_stability_curve(h-new, 0, 120)]

        Forked. Here's the Coaster-style baseline:
        • LOA 3.81 m, BWL 0.58 m, LWL 3.55 m
        • Displacement 114 kg (paddler 80 + gear 15 + boat 19)
        • Cp 0.57, GM_T 0.13 m, AVS 121°
        • Drag @ 2.5 m/s = 34.2 N

        What do you want to change?

user:   [adjusts control points in the 3D view]

agent:  [observes event log, computes delta]

        You moved the bow rocker up 12 mm. Effects:
        • LCB forward 3 mm
        • WSA down 0.8%
        • Drag @ 2.5 m/s down 0.3 N (0.9%)
        • GM_T unchanged

        Want me to keep hunting for small rocker changes 
        that reduce drag without changing stability?
```

The agent is the **co-pilot**. The user is in the driver's seat, directly editing; the agent observes, narrates, suggests.

---

## Workflow 2 — "Optimize under constraints"

```
user:   Starting from hull A, minimize drag at 4 knots, 
        subject to: GM_T ≥ 0.12 m, displacement = 114 kg, 
        LOA ≤ 4.2 m, paddler seat position unchanged.

agent:  [runs a bounded search — typically gradient-based on 
         a parameterized subset of design variables]

        After 28 candidates:
        • Best: drag @ 4 kn = 28.9 N (baseline 34.2 N, −15%)
        • All constraints satisfied
        • Key changes: LOA +0.35m, BWL -0.04m, bow sharper 
          (entry angle 18° → 14°)
        
        Show you a ghosted overlay comparing to baseline?
```

The agent runs a numerical optimization using the ArcasBoat API as its cost-function evaluator. Each candidate is a real hull evaluated with real hydrostatics.

At phase 2 this is a **hosted service**; at phase 1 it's at least possible via scripted Python + SDK.

---

## Workflow 3 — "Critique this hull"

```
user:   Look at hull B. Anything obviously wrong?

agent:  [arcas.get_hydrostatics(B), .get_stability_curve(B), 
         .get_drag_curve(B), .get_fairness_report(B)]

        Flags:
        1. Waterplane asymmetric fore/aft — LCB is 120 mm 
           forward of LCF at design displacement. The boat will 
           trim bow-down with any forward load shift.
        2. Cp = 0.48 — quite low for this L/B. Drag curve 
           shows a pronounced hump at Fr = 0.32.
        3. Mid-hull control point (i=5, j=2) creates a visible 
           knuckle in the sheer line; fairness penalty.
        4. GM_T = 0.04 m is lower than typical for this beam. 
           Check seat height — you have the paddler CG at 0.48 m 
           above baseline; normal is 0.38 – 0.43 m.

        Want me to fix (1) and (3) as a proposal?
```

This is the **review** mode. Valuable even without any optimization.

---

## Workflow 4 — "Describe this hull in words"

```
user:   What kind of kayak is this, in the vocabulary 
        of the canoe/kayak design community?

agent:  This is a short, moderate-beam sea kayak (LOA 3.95 m, 
        L/B 6.1, Cp 0.58). Soft-chined cross-section with 
        mild flare above the shoulder. Moderate bow rocker, 
        minimal stern rocker. Strong secondary stability, 
        middling initial.
        
        Closest reference in the library: Coaster-style 
        (similar proportions, slightly more forward volume 
        here). Feels like a day-boat / surf-play design, 
        in the Mariner / British-school tradition.
```

Natural-language rendering of hull character is a small UX win but a real one.

---

## Workflow 5 — Parameter sweeps

```
user:   Sweep bow rocker from 0.02 m to 0.10 m in steps 
        of 0.01 m. Report drag at 2.5 m/s and GM_T for each.

agent:  [arcas.fork_hull + arcas.propose in a loop]
        [returns a Comparison of 9 hulls]

        Done. Here's the comparison. Observations:
        • Drag minimum at rocker = 0.04 m.
        • GM_T nearly constant (±2%).
        • At rocker = 0.08 m, drag is 6% higher but 
          turning-circle (estimated) is 15% smaller.

        Pareto front: rocker 0.04 m (fastest) and 
        0.08 m (most maneuverable). Between them is a 
        straight trade.
```

Produces a first-class **Comparison** resource (see [side-by-side-comparison.md](side-by-side-comparison.md)).

---

## Workflow 6 — Converting a sketch / reference photo into a starting hull (phase 3+)

Speculative but aligned with the app's direction:

```
user:   [uploads a lines plan image or a photograph]
        Build a starting hull that matches this.

agent:  [computer-vision pass extracts silhouette / 
         stations from the image]
        [fits a parametric hull to the extracted curves]
        [presents preview]
```

Sub-goal: the user-provided image is a **reference**, not a spec; the user refines from there.

---

## Workflow 7 — "What would happen if..."

Counterfactual exploration:

```
user:   If I made this 20 cm longer, what would happen?

agent:  [propose: scale LOA to current + 0.20, preserve other 
         parametric constraints]
        [preview diff]

        LOA 3.81 → 4.01 m. Effects:
        • Displacement unchanged (re-fit to same load)
        • LWL +0.18 m
        • LCB roughly unchanged
        • WSA +4% (more wetted length)
        • Drag @ 2.5 m/s down 1.8 N (5%) — longer is faster here
        • GM_T slightly lower (narrower waterplane to hold 
          same displacement)
        • Rocker distribution: unchanged in shape, extended 
          over 20 cm more length
        
        Commit?
```

Counterfactuals are a killer feature: "explain by simulation."

---

## Safety rails for agent-driven workflows

- **Propose-before-commit** on every mutation. See [../project/api-design.md](../project/api-design.md#ai-agent-proposals).
- **User can always inspect** the event log and undo.
- **No secret numbers.** Every metric the agent reports is the same metric the user can read in the UI.
- **Scope granted per-hull.** An agent given access to hull A cannot touch hull B.
- **Audit log.** All agent actions recorded with agent identity.

---

## The agent is not the designer

We're deliberate: **the human is the designer**. The agent is:
- A calculator (fast, accurate).
- A literature review (fast, cited).
- A critic (honest, unbiased).
- A tireless parameter sweeper.
- A notes-keeper that can translate numerical diffs into sentences.

The agent is *not*:
- The one with taste.
- The one who knows what kind of boat this should be.
- The one who decides when it's "done."

ArcasBoat's role is to make the agent maximally useful without displacing the human's judgment.

---

## Related

- [../project/ai-agent-integration.md](../project/ai-agent-integration.md)
- [../project/api-design.md](../project/api-design.md)
- [showcase-gallery.md](showcase-gallery.md)
- [side-by-side-comparison.md](side-by-side-comparison.md)
