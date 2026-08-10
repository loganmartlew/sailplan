# Prototype Via Points in Course Plan results

Type: prototype
Status: resolved
Blocked by: 01

## Question

Should a Course Plan present every Leg Segment as a top-level guidance card, or group Leg Segments beneath their sailor-recognised Mark-to-Mark Leg, and how should the read-only Plan Map link to Edit Saved Course?

Compare both approaches with Legs containing zero, one, and several Via Points. Include custom Plan start/finish locations and show the recalculation experience after returning from a saved Course edit.

## Answer

Use **B — Mark-to-Mark groups** for Course Plan results. A sailor-recognised
Course Mark-to-Mark Leg is the primary result unit; it owns its Leg Segment
guidance. Within the Leg, show Segments as lighter timeline rows rather than
nested bordered cards, while retaining each Segment's bearing, TWA, tack, and
sail call. Keep the read-only Plan Map and its explicit **Edit saved course**
path, including the recalculation return state after a saved Course change.

Do not use C — Route journal as the primary Plan-results view: its prev/next
guidance would overlap the existing Leg-detail experience. That interaction may
be appropriate inside Leg detail, outside this ticket's Plan-results decision.

## Comments

- Prototype asset: [standalone Plan-results Via Points mockup](../prototypes/plan-results/index.html) — run `python3 -m http.server 8000` from `prototypes/plan-results/`, then open `http://localhost:8000/?variant=segments`. Variants: `segments`, `legs`, and `route`; the floating switcher also supports left/right arrow keys.
