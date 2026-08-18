# 23 — An interactive review map

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8. User stories 56, 57.
Revises ticket [`16`](16-review-map.md).

**What to build:** Let the sailor pan, zoom and open the review track fullscreen,
so "where was this data actually gathered?" is a question the review screen can
answer.

**Blocked by:** nothing. Independent of `21` and `22`.

**Status:** ready-for-agent

## Why this reverses `16`

Ticket `16` deliberately made the map a read-only thumbnail — "it never becomes a
second navigable surface: no selection, no panning-driven state, nothing to get
lost in". `ReviewTrackMap.tsx` implements that with `pointerEvents='none'`,
`scrollEnabled`/`zoomEnabled` false, in a fixed 224 px box.

After the first real race that reads as too strict. A 224 px non-zoomable strip
cannot show whether the GPS track covers the leg it is filed under — which is
exactly the judgement review exists to support. This is the same kind of
reversal as `16`'s basemap change on 17 August 2026, and for the same reason:
the map has to be legible before it can be trusted.

The part of `16`'s rule worth keeping is the narrow one: **the map holds no
state that the rest of review depends on.** Panning is a glance, not a mode. No
selection, nothing to get lost in, nothing to undo.

## Acceptance criteria

- [ ] Pan and zoom work on the inline map
- [ ] Auto-fit fires on mount and on focus change, and **not** while the sailor
      is panning — today's `useEffect(frameTrack, [frameCoordinates])` would
      otherwise yank the camera back mid-gesture
- [ ] A recenter control refits the current focus
- [ ] An expand control opens the track fullscreen, carrying the leg ⟷ course
      toggle and the same sail-coloured span rendering
- [ ] Camera state is local to the map; leaving and returning to a leg does not
      surprise the sailor with a remembered viewport
- [ ] Nothing in review reads map state
- [ ] Still correct across GPS gaps — no line drawn across a >5 s discontinuity,
      at any zoom

## Comments

Raised 18 August 2026 from the first real race: the track could not be expanded
or zoomed, so there was no way to see what data had been gathered where.
