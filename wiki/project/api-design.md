# API Design

**Hard rule: every design action has a corresponding API call.** The UI is a client of the API. AI agents are clients of the API. They share one surface.

This document sketches the resource model, verb conventions, and representative calls. Concrete URL schemes will be firmed up during phase 1.

---

## Principles

1. **Resource-oriented.** A hull is a resource. A comparison is a resource. An analysis result is a resource.
2. **Idempotent where possible.** `set_control_point(hull_id, idx, xyz)` is idempotent. `nudge_control_point(hull_id, idx, delta)` is not — and is therefore a *convenience layer* over the idempotent primitive, never a primitive itself.
3. **Deterministic IDs where possible.** Content-hash cached analyses; explicit UUIDs for user-owned resources.
4. **Explicit units.** All lengths in meters, angles in radians, masses in kg, speeds in m/s at the API boundary. The UI translates to feet/knots/degrees for display.
5. **No hidden state.** There is no "currently selected hull" in the API. Every call names the hull it acts on.
6. **Events, not mutations.** Modifications are logged as events. The current state is a fold of the event log.

---

## Resources (sketch)

```
/hulls                       # list, create
/hulls/{id}                  # read, delete, patch metadata
/hulls/{id}/control_nets     # list, create
/hulls/{id}/control_nets/{net_id}
/hulls/{id}/control_nets/{net_id}/points/{i}/{j}   # set (idempotent)
/hulls/{id}/parameters       # GET/PATCH high-level params (LOA, beam, rocker…)
/hulls/{id}/events           # append-only design history
/hulls/{id}/mesh             # GET derived mesh (cached)
/hulls/{id}/stations         # GET derived station offsets
/hulls/{id}/hydrostatics     # GET derived, ?condition=<config>
/hulls/{id}/stability_curve  # GET derived, ?heel_range=...
/hulls/{id}/drag_curve       # GET derived, ?speed_range=...&method=ittc+michell
/hulls/{id}/exports          # POST to create (STL, DXF, OBJ, CSV, offsets)

/comparisons                 # list, create
/comparisons/{id}            # read, delete, patch

/library                     # read-only reference hulls (Coaster-like, K1-like, …)

/agents/proposals            # AI-agent speculative changesets (preview before commit)
```

---

## Representative design actions → API calls

| Design action | API call |
|---|---|
| Create a blank hull from parametric template | `POST /hulls  {template: "sea_kayak", loa: 5.2, beam: 0.55, rocker: 0.06}` |
| Set a control point | `PUT /hulls/{id}/control_nets/{net}/points/{i}/{j}  {x, y, z, w}` |
| Sweep a transverse station wider | `POST /hulls/{id}/ops/scale_station  {station_idx, axis: "y", factor: 1.05}` |
| Add rocker at bow | `POST /hulls/{id}/ops/adjust_rocker  {at: "bow", delta_m: 0.02}` |
| Change displacement condition | `PATCH /hulls/{id}/displacement_condition  {loaded_weight_kg: 110}` |
| Duplicate a hull for A/B | `POST /hulls  {fork_from: "{id}"}` |
| Export solid for CNC plug | `POST /hulls/{id}/exports  {format: "step", kind: "hull_solid", options: {units: "mm", tolerance_mm: 0.05}}` |
| Export printable mesh | `POST /hulls/{id}/exports  {format: "3mf", kind: "hull_surface", options: {tolerance_mm: 0.15, split_planes: [...]}}` |
| Generate a composite mold shell | `POST /hulls/{id}/ops/mold_shell {offset_mm: 8, parting_line: "sheer"}` |
| Export one mold half | `POST /hulls/{id}/exports {format: "step", kind: "mold_half", options: {half: "port"}}` |

High-level operations like `adjust_rocker` decompose into a series of `set_control_point` calls internally — but are first-class API calls so that the UI (and agents) can operate at the level designers actually think.

---

## Derivations as GETs with query params

A pattern we enforce: anything *derived* from the hull geometry is a GET with query parameters.

```http
GET /hulls/abc123/drag_curve?speed_min=0&speed_max=3.5&method=ittc+michell&condition=default
```

Why:
- Cacheable on the server side (keyed by hull event-log hash + query hash).
- Cacheable on the client side (standard HTTP caching).
- AI agents can re-fetch the same analysis trivially.
- No side effects.

---

## Events / design history

```
POST /hulls/{id}/events
{
  "op": "set_control_point",
  "net_id": "hull_primary",
  "i": 3, "j": 5,
  "xyz": [1.20, 0.22, 0.05]
}
→ 200
{
  "event_id": "e-89af",
  "applied_at": "2026-04-19T17:22:01Z",
  "resulting_hash": "h-a9c2"
}
```

- Every mutating call returns an `event_id` and a `resulting_hash`.
- `GET /hulls/{id}/events?since=e-89af` gives the tail of the log.
- Undo is `DELETE /hulls/{id}/events/e-89af` (soft — actually appends an inverse event).

---

## AI-agent proposals

Agents need to **preview** changes before committing.

```
POST /agents/proposals
{
  "hull_id": "abc123",
  "ops": [
    {"op": "adjust_rocker", "at": "bow", "delta_m": 0.015},
    {"op": "scale_station", "station_idx": 8, "axis": "y", "factor": 0.97}
  ]
}
→ 201
{
  "proposal_id": "p-7f41",
  "preview": {
    "hydrostatics": {...},
    "drag_curve_delta": {...},
    "stability_curve_delta": {...}
  }
}

POST /agents/proposals/p-7f41/commit
POST /agents/proposals/p-7f41/reject
```

This gives agents a safe "try before you commit" loop. Humans get the same workflow via the UI's "ghosted preview" mode.

---

## Versioning

- **API version in URL:** `/v1/hulls/...`
- **Hull document has a schema version.** Migrations are explicit; old hulls keep opening.
- Breaking changes → new `/v2`, parallel deployment. We do not mutate `/v1` semantics once released.

---

## SDKs

Planned:
- **TypeScript SDK** (first-class; the web UI uses it internally).
- **Python SDK** (for scripting, reference designs, and research scripts).
- **MCP server** (exposes a curated subset of the API as MCP tools for Claude and other agents). See [ai-agent-integration.md](ai-agent-integration.md).

---

## Related

- [architecture.md](architecture.md)
- [ai-agent-integration.md](ai-agent-integration.md)
- [export-formats.md](export-formats.md)
- [../variables/design-variables.md](../variables/design-variables.md)
