# 19 — Manual stretch selection

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §9.8. User stories 76, 77.

**What to build:** When the proposals look wrong, the sailor hand-picks a stretch
and it counts. Their judgement wins — but they are told what they are
overriding, rather than being quietly allowed to promote a stretch the filter
would have rejected.

**Blocked by:** `18`.

**Status:** ready-for-agent

- [ ] A stretch can be hand-selected when the automatic proposals look wrong
- [ ] The steadiness test still runs, as a **warning, not a block**, naming what
      is being overridden (which band failed, and by how much)
- [ ] The identical binning / minimum-evidence / MAD / median path runs
      afterwards — manual selection shares the pipeline, it does not fork it
- [ ] **A manual edit changes which intervals belong to which sail; it never
      bypasses the steadiness mask** as a mask
- [ ] The sailor is never locked out by a filter they disagree with
