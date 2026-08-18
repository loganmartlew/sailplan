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

- **The inline map takes no touches at all.** First tried as pinch-zoom inline
  with panning reserved for fullscreen — the review map lives inside the session
  screen's vertical `ScrollView`, where a pannable map is a gesture fight and a
  third of the review screen stops scrolling. Tried on device, pinch alone read
  as broken rather than restrained: 224 px is not enough frame for a zoom to
  land somewhere useful, and the map still competed for touches it could do
  nothing with. So `16`'s read-only thumbnail stands after all, and **all**
  interaction moves behind the expand control. Only the controls floated over
  the inline map take touches.
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

- [x] The inline map stays read-only — `pointerEvents='none'`, no pan, no zoom —
      so the review screen scrolls normally under a thumb anywhere on it
- [x] Auto-fit fires on mount/layout, on focus change, and on recenter — and
      **not** on span edits. Today's `useEffect(frameTrack, [frameCoordinates])`
      re-frames whenever a divider moves, which would yank the camera out from
      under a zoomed-in sailor
- [x] A recenter control refits the current focus
- [x] An expand control grows the map to fullscreen, animating from its measured
      inline frame (`measureInWindow` at press time, not layout — the frame is
      stale after a scroll), and collapses back into it
- [x] The track does not move when expanding or collapsing: the fullscreen map
      opens at the inline map's exact region, fades in over 220 ms once it has
      drawn (`onMapLoaded`), and each delta is scaled by its own dimension's
      growth
- [x] The leg ⟷ course chips and the fullscreen controls fade in only once the
      frame has finished growing, and fade out before it starts shrinking
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

Three things the test suite cannot reach, because the repo has no component or
device harness, and which want a look on the water:

- that the expand animation reads as continuous — the fullscreen canvas is laid
  out at window size throughout and kept centred while only its clipping frame
  grows, so the track should not move at all
- that `onMapReady`/`onMapLoaded` fire promptly enough that the 600 ms reveal
  backstop is never the thing that shows the overlay
- that the camera resets per leg. This is `key={leg.ordinal}` on the consumer
  (`SailedLegReviewPager.tsx`), so it is a remount rather than logic, and there
  is nothing to assert without a component harness

## Second pass, 18 August 2026

From the first run on device:

- **The inline map opened on the whole world.** The framing latch counted a fit
  that never landed: `fitToCoordinates` before the native map is ready is a
  silent no-op, so the map marked itself framed and then refused the `onMapReady`
  fit that would have worked. The latch now needs the frame to be `ready` before
  anything counts as framed, and the inline map carries an `initialRegion`
  derived from the track so there is no world-sized frame to see even for one
  draw.
- **Inline touch removed entirely** — see the revised decision above.
- **The expand flash** was `onMapReady` firing before any tile had drawn, so the
  overlay appeared blank over the inline map. Reveal now waits for `onMapLoaded`
  and fades in over 140 ms, with the backstop raised to 900 ms for iOS, which
  does not send that event.
- **The collapse landing** was measured on the bordered box rather than the map
  inside it, and measured once at press time. It is now the map's own rect,
  re-measured on the way out as well as in, so a scroll between opening and
  closing cannot leave the frame shrinking towards where the map used to be.

## Third pass, 18 August 2026

- **The frame no longer waits for the map.** Holding the animation until
  `onMapLoaded` made the expand control feel dead for as long as the tiles took.
  Growing an empty frame instead was worse — the animation ran while there was
  nothing in it to see, so the map simply appeared at full size. Superseded by
  the warm-up below.
- **The frame lands where the inline map is**, by measuring the portal host's
  own window position and subtracting it — `measureInWindow` reports window
  coordinates while the frame is laid out inside the host, and a status bar or
  header between the two origins was landing it high by exactly that much.
- Chips and fullscreen controls sit tighter to the edges.

## Fourth pass, 18 August 2026

**The fullscreen map warms up before it is needed.** Everything tried so far
traded the wait against the animation: wait for tiles and the control feels
dead, grow without them and the animation plays to an empty frame. Both come
from mounting the map on the press.

It is now mounted as soon as the inline map is ready, parked at full size,
invisible and inert, loading the tiles the grown frame will need. The inline
map's region is pushed to it — rescaled to its own frame — every time the
inline camera settles, so at the moment of the press there is no camera work
left to do: the frame snaps onto the inline map and grows, around a map that
already has something in it.

The cost is a second `MapView` alive per reviewed leg. That is the price of the
animation; if it shows up as memory pressure on older Android, the thing to
give up is the warm-up, and with it the expansion animation.

### Do not measure during layout

Measuring the inline map from its own `onLayout` to seed the overlay's origin
crashed the screen on a page turn: under Fabric `measureInWindow` can call back
synchronously, so the `setState` in it landed inside the commit phase and React
threw `Should not already be working.` — leaving the screen scrollable but
inert.

Only the press needs a real rect, and it already measures for itself. While
warming, the frame is parked at full size and invisible, so where it would
collapse to does not arise.
