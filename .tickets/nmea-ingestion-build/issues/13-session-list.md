# 13 — The session list

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8. User stories 42, 43.

**What to build:** Past capture sessions are listed by date with duration, sample
count and wind range, so the sailor can find the race they are thinking of. A
session that captured nothing usable opens to a plain explanation rather than an
empty screen — so they know whether to blame the boat, the network or the wind.

This is the entry point review is reached through, and the surface where a
session's health becomes visible.

**Blocked by:** `02`, `05`.

**Status:** done

- [x] Sessions listed by date with duration, sample count and wind range
- [x] Three states: **good**, **failed** (opens to a dead end explaining why
      nothing is usable), and **empty**
- [x] The failure explanation is drawn from `05`'s per-sentence-type reject
      counters and per-field stale counters — session health, not a generic
      message
- [x] The session's wind-frame classification is surfaced; **`ground` warns**,
      because a ground-referenced true wind bakes tidal current into every polar
- [x] Sessions whose TWS sits below ~6 kn are flagged **low confidence** on
      wind-shear grounds. This flag is **derived at read time, never stored** —
      freezing "~6 kn" into a column is the same formula-versioning trap `05`
      rejected
- [x] Reads sensibly with one session, and with dozens
