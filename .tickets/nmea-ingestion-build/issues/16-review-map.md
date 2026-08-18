# 16 — The review map

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8. User stories 56, 57.

**What to build:** A read-only track that follows the pager, drawing each span in
its own colour, so the sailor can recognise the leg on the water — without the
map becoming another thing to navigate. A chip switches between this leg and the
whole course, so orienting yourself is a per-glance choice rather than a
remembered mode.

**Blocked by:** `14`.

**Status:** done — read-only rule since revised by
[`23`](23-interactive-review-map.md)

- [x] The map is **read-only** and follows the pager
- [x] Each sail-attribution span draws in its own colour, matching the span row
- [x] A chip on the map switches focus-leg ⟷ whole-course
- [x] Standard road/land basemap behind the GPS track — reversed from the
      original "GPS only, no chart tiles, no land" on 17 August 2026: a bare
      track gave no sense of place. `nmea-ingestion/issues/10` updated to match.
- [x] The focused leg's from/to course marks are drawn, and every ordered mark
      under whole-course focus — added beyond the original criteria, kept
      because orienting on a mark is the point of the whole-course view
      (`reviewMapMarks.ts`)
- [x] It never becomes a second navigable surface: no selection, no
      panning-driven state, nothing to get lost in
- [x] Reads correctly when a leg has no GPS fix for part of its range (TTL-null
      `lat`/`lon`) and across a >5 s discontinuity — no line drawn across a gap
