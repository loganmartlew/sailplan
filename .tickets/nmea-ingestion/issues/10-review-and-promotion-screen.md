# 10 — The review and promotion screen

Type: prototype
Status: open
Blocked by: 05, 12
Map: [map.md](../map.md)

## Question

The after-the-race surface, where a recorded session becomes polar points.
Prototype it.

1. **Seeing the session.** What's the primary view of a few thousand samples —
   a time-series of speed/TWS/TWA, the GPS track on a map (`react-native-maps`
   is already in the app), a polar scatter, or several linked together? What
   makes a two-hour race legible on a phone screen?
2. **Scrubbing and zooming.** How do you navigate two hours of data and select
   a stretch precisely, on a touch screen, with fingers?
3. **Sail assertions in review.** Founding decision 4 makes review the source
   of truth. How are assertions shown on the timeline, corrected, moved,
   deleted, and added where you forgot one during the race?
4. **The proposals.** `07`'s auto-proposed points need to be shown *against
   your existing polar* so you can judge them — the app already has
   `PolarPlotChart` and `ScatterChart`. Proposed versus existing must be
   instantly distinguishable. Do you accept per-point, per-bin, or wholesale?
5. **The manual path.** Founding decision 7 requires hand-selection as a
   fallback. Select a stretch → see its stats → assign a sail → promote. How
   does that flow sit alongside the proposals without becoming a second app?
6. **Reversal.** The provenance column makes promotion undoable. Where does
   "undo this session's contribution" live, and how is it made safe?
7. **Session list.** How do you find a session at all — list by date, with
   what summary? What does an empty or failed session look like?

Rough and throwaway. The point is to react to it, not to ship it. Use `12`'s
simulated data to populate it — this prototype needs a plausible two-hour
session to be judged at all, and waiting for a real one would stall it.

## Answer

<!-- filled on resolution -->
