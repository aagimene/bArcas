# AI Agent Integration

ArcasBoat treats AI agents as first-class users. The constraint "every design action has an API call" exists specifically so agents can drive the tool.

---

## What we want agents to do

| Task | Agent example |
|---|---|
| **Explore** the design space | "Given a 5.2m length cap, sweep beam from 0.48 to 0.62m in 20 steps and report drag at 5 knots." |
| **Optimize** to constraints | "Minimize total drag at 5 knots subject to initial GM_T ≥ 0.12 m and displacement = 110 kg." |
| **Explain** a design | "Why does hull A have higher wetted surface area than hull B despite shorter LOA?" |
| **Propose** a hull from a description | "Design an imitation Coaster — 12'6", soft chines, medium rocker, playful sea kayak for surf and rock gardens." |
| **Critique** a design | "Review this hull for obvious problems in hydrostatic fairness." |
| **Narrate** comparisons | "Compare this hull to a Nordkapp and a Coaster; explain which conditions favor each." |

All of these are expressible as sequences of API calls. See [api-design.md](api-design.md).

---

## Integration surfaces

### 1. MCP server (primary)

A [Model Context Protocol](https://modelcontextprotocol.io) server exposes curated tools:

```
arcas.list_hulls
arcas.get_hull(id)                         → metadata + parameters
arcas.get_hydrostatics(id, condition)
arcas.get_drag_curve(id, speed_range, method)
arcas.get_stability_curve(id, heel_range)
arcas.create_hull(template, params)
arcas.fork_hull(id)
arcas.propose(id, ops[]) → proposal_id + preview
arcas.commit_proposal(proposal_id)
arcas.reject_proposal(proposal_id)
arcas.compare(hull_ids[], aligned_on, metrics[])
arcas.library_list()                       → reference hulls (Coaster, K1, …)
```

The MCP tools are thin wrappers over REST calls — same semantics, different transport.

### 2. Direct REST + Python SDK

Anything the MCP server does, a Python script can do directly. This matters for:
- Batch sweeps that don't fit an LLM's context.
- Evolutionary / gradient-based optimizers where the "agent" is a numerical routine, not an LLM.
- Reproducible research (scripts in repos, not chat transcripts).

### 3. "Preview-before-commit" loop

Agents should never silently mutate a user's hull. Every proposed change goes through `propose → preview → commit` (see [api-design.md](api-design.md)). The UI renders agent proposals as a *ghost overlay* on the hull so the user can see the effect and accept/reject.

### 4. Structured introspection

Agents work better when the world is structured. We expose:
- **Provenance:** every number comes with `{value, unit, method, assumptions, citation}`.
- **Deltas:** `arcas.get_delta(hull_id, from_event, to_event)` returns what changed and its effect on metrics.
- **Sensitivity:** `arcas.get_sensitivity(hull_id, param)` returns ∂(drag, GM, …)/∂param.

The last one is useful to agents because it lets them plan multi-step changes without exhausting tool calls.

---

## Safety and scope

- **Agents operate on their own hulls by default.** Shared/user-owned hulls require explicit grant.
- **Destructive ops require confirmation.** `delete_hull` cannot be called by an agent without an out-of-band user confirm. Same for anything that mutates the shared library.
- **Rate limits per agent key.** Prevents runaway optimizer loops.
- **Audit log.** Every agent action is tagged with the agent identity for later review.

---

## What agents are *not* for (initially)

- **Not the primary designer.** Humans are; agents assist.
- **Not autonomous overnight runs** in phase 1. The loop is interactive.
- **Not a replacement for theory.** If the drag curve has a suspicious wiggle, the agent flags it — it does not hide it by smoothing.

---

## Example agent session (imagined)

```
user:  "Clone the Coaster reference hull and make it 5% faster at 4 knots 
        without reducing initial stability."

agent: [calls arcas.fork_hull(library/coaster) → hull_id=h-42]
       [calls arcas.get_drag_curve(h-42, ...) → baseline]
       [calls arcas.get_hydrostatics(h-42) → GM_T baseline = 0.21 m]
       
       "Baseline drag at 4 kn = 38.2 N. Target: ≤36.3 N with GM_T ≥ 0.21 m.
        Proposing: reduce beam at stations 5–8 by 2%, increase prismatic 
        coefficient via fuller ends."
        
       [calls arcas.propose(h-42, [ops...]) → proposal p-9]

       "Preview: drag at 4 kn = 36.0 N (−5.8%), GM_T = 0.215 m (+2%).
        Wetted surface decreased 1.9%, LCB moved forward 4mm. 
        Commit?"

user:  "Commit."

agent: [calls arcas.commit_proposal(p-9)]
```

This is the target UX.

---

## Related

- [api-design.md](api-design.md)
- [architecture.md](architecture.md)
- [../features/ai-workflow.md](../features/ai-workflow.md)
