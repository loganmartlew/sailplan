# 23 — An interactive review map

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8. User stories 56, 57.
Revises ticket [`16`](16-review-map.md).

**What to build:** Let the sailor zoom the inline review track and expand it
fullscreen, so "where was this data actually gathered?" is a question the review
screen can answer.

**Blocked by:** nothing. Independent of `21` and `22`.

**Status:** built — pending on-device verification (see Comments)

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

## Decisions

Settled 18 August 2026, before implementation.

- **Inline gets pinch-zoom, not pan.** The review map lives inside the session
  screen's vertical `ScrollView`. A pannable map there is a gesture fight: a
  vertical drag is ambiguous, and whichever way it resolves, a third of the
  review screen becomes a place where scrolling does not work. Pinch is
  unambiguous — the `ScrollView` never claims a two-finger gesture. Panning
  lives fullscreen, where the map owns the whole surface.
- **Fullscreen is a second `MapView`, opened at the inline map's exact region
  — not a route.** React Native cannot move a mounted view between parents:
  `@rn-primitives/portal` stores portalled children and re-renders them under
  `PortalHost`, so portalling unmounts and remounts, exactly as `<Modal>` does.
  One instance is therefore only achievable by parking the map permanently in
  the portal and re-gluing it to a placeholder on every scroll, which trades one
  glitch per expand for jitter on every scroll. Instead the fullscreen map
  mounts at the identical region and stays invisible until `onMapLoaded`, so the
  track is already where it was when the frame starts growing. A pushed route
  was rejected separately: it would re-query the database and draw the *stored*
  spans, disagreeing with the draft band the sailor is editing (`draftSpans` is
  unsaved state in `SailedLegReviewPager`).
- **Expanding never refits.** Any `fitToCoordinates` on open is exactly the jump
  the animation exists to avoid. Hold the centre and scale each delta by its own
  dimension's growth, so degrees-per-pixel is unchanged on both axes: the track
  keeps its scale and the added height reveals more water around it. (Holding
  `longitudeDelta` outright would only be right if the width never changed; the
  inline map is inset by the card's padding, so it does.)
- **Auto-fit is latched, not timed.** Once the sailor zooms, the camera is
  theirs until they ask for a frame — recenter, or the leg ⟷ course toggle. A
  timed resume just delays the yank until it is startling.

## Acceptance criteria

- [x] Pinch-zoom works on the inline map, and scrolling the review screen with a
      thumb on the map still scrolls the screen
- [x] Auto-fit fires on mount/layout, on focus change, and on recenter — and
      **not** on span edits. Today's `useEffect(frameTrack, [frameCoordinates])`
      re-frames whenever a divider moves, which would yank the camera out from
      under a zoomed-in sailor
- [x] A recenter control refits the current focus
- [x] An expand control grows the map to fullscreen, animating from its measured
      inline frame (`measureInWindow` at press time, not layout — the frame is
      stale after a scroll), and collapses back into it
- [x] The track does not move when expanding or collapsing: the fullscreen map
      opens at the inline map's exact region, is revealed only once loaded, and
      each delta is scaled by its own dimension's growth
- [x] Fullscreen carries the leg ⟷ course toggle and the same sail-coloured
      span rendering, including unsaved draft spans
- [x] Camera state is local to the map; leaving and returning to a leg does not
      surprise the sailor with a remembered viewport
- [x] Nothing in review reads map state
- [x] Still correct across GPS gaps — no line drawn across a >5 s discontinuity,
      at any zoom

## Comments

Raised 18 August 2026 from the first real race: the track could not be expanded
or zoomed, so there was no way to see what data had been gathered where.

Two criteria are already satisfied by existing code and need tests rather than
work: `ReviewTrackMap` is mounted with `key={leg.ordinal}`, so the camera resets
per leg; and `buildReviewTrack` splits segments on timestamps before any camera
exists, so gap correctness is zoom-independent by construction.

Built 18 August 2026. `reviewMapCamera.ts` holds the two rules worth testing —
the framing latch and the region rescale — and `ReviewTrackMapCanvas.tsx` is the
one track renderer both frames share, so inline and fullscreen cannot drift.

`regionForCoordinates` closes the one hole where the track could still have
jumped: a fast press after mount, before the inline map has reported a region,
used to open the fullscreen frame on a fresh fit. It now derives the fit the
inline map is about to settle on and opens on that instead.

Three deliberate additions beyond the criteria: the hardware back press
collapses the overlay (a fullscreen surface on Android with no back route is a
trap), the 600 ms reveal backstop above, and a recenter control inside
fullscreen as well as inline — having panned the fullscreen frame, the sailor
needs the way back that the inline frame already has.

Four things the test suite cannot reach, because the repo has no component or
device harness, and which want a look on the water:

- that a single-finger drag starting on the inline map still scrolls the review
  screen (the map is `scrollEnabled={false}`, which should leave the drag to the
  `ScrollView`, but the arbitration is a native one)
- that the expand animation reads as continuous — the fullscreen canvas is laid
  out at window size throughout and kept centred while only its clipping frame
  grows, so the track should not move at all
- that `onMapReady`/`onMapLoaded` fire promptly enough that the 600 ms reveal
  backstop is never the thing that shows the overlay
- that the camera resets per leg. This is `key={leg.ordinal}` on the consumer
  (`SailedLegReviewPager.tsx`), so it is a remount rather than logic, and there
  is nothing to assert without a component harness
