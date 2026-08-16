# 15 — Span editing: one act, four uses

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8. User stories 50–55, 67.

**What to build:** Trimming an end, cutting a bad patch out of the middle, and
changing sail mid-leg are all **the same act: moving a divider**. Sailing through
a wind hole or someone's dirty air costs a slice of a leg rather than the whole
leg, and a peel does not force the leg to be discarded. One mechanism to learn
instead of four, and every edit has an obvious undo — deleting a divider merges
the blocks back together.

```
[ not used ][   J1   ][ not used ][   J1   ][ not used ]
  the hoist                a cut                the drop
```

*(From the accepted round-5 prototype — it encodes the decision more precisely
than prose can.)*

**Blocked by:** `14`.

**Status:** done

- [x] Every block carries **one sail or nothing**; null is "not used" and needs
      no other representation
- [x] Any number of cuts; every block resizable, splittable and removable
- [x] **Deleting a divider merges the blocks back** — the universal undo
- [x] Drag the band to move the nearest divider, **or** nudge a selected block's
      edges by ±5 s / ±15 s, so the sailor can be precise on a phone
- [x] Minimum block **15 s**; splitting a block that cannot yield two 15 s halves
      is refused
- [x] A block too short to hold a bin **says so**, rather than being carefully
      trimmed and silently contributing nothing
- [x] **Spans claim time, not rows.** Dragging a divider writes span rows only
      and never rewrites sample rows
- [x] Assigning a sail to a block is the same interaction as the rest — not a
      separate mode
- [x] Verified on a device that the interaction is usable one-handed, at the real
      scale of 1–4 points per leg

## Verification

- 17 August 2026 — exercised on a physical ASUS AI2302 in the Android
  development build, using a materialised 4:31 sailed leg. Assigned and cleared
  a sail, nudged an edge, dragged the nearest divider, split repeatedly, and
  deleted a divider to merge back. The controls remained reachable and readable
  one-handed with three and four blocks. The test leg was restored to its
  original unconfirmed null-sail spans afterwards.
- The pager now accurately labels its pre-promotion raw count as samples.
  Ticket 18 will replace that with its derived 1–4 polar-point count as part of
  promotion.
