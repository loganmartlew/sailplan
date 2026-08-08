# SailPlan — Workspace Guide

> Agent orientation for the SailPlan repository. This file is harness-agnostic
> (`AGENTS.md`). `CLAUDE.md` points here so Claude Code picks it up natively;
> Cursor, Copilot, Zed, Aider, and others read `AGENTS.md` directly.

## What this repository is

SailPlan is a mobile app for sailors. Given the wind and a course of marks, it
tells you the **bearing** to each mark, the **true wind angle (TWA)** you'll sail
it at, which **tack** you'll be on, and which **sail** to fly. It also stores
marks, courses, boat profiles, sail polars, and TWA limits.

## Repository layout

This is a VS Code multi-root workspace (`sailplan.code-workspace`) with two
folders:

| Folder           | What it is                                                                 | Docs                                    |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| `sailplan-app/`  | **The product.** Expo / React Native (Android) app. Do your work here.     | [`sailplan-app/AGENTS.md`](sailplan-app/AGENTS.md) |
| `polars/`        | Standalone Node generator for polar test data + eval fixtures.             | [see below](#the-polars-folder)         |
| `nmea-sim/`      | Standalone Node NMEA 0183 simulator — a B&G Zeus 3 on your desk.           | [`nmea-sim/README.md`](nmea-sim/README.md) |

**Almost all work happens in `sailplan-app/`.** Start with its
[`AGENTS.md`](sailplan-app/AGENTS.md), which links into a full
[`docs/`](sailplan-app/docs/) suite (architecture, conventions, data layer, a
sailing **domain glossary**, feature catalogue, UI, testing, routing).

## The `polars/` folder

Test-data generation for the app's polar import **and** for the
sail-suggestion evaluation harness. Not shipped with the app.

- `fleet.js` — **the boat's true polar**, plus the seeded PRNG and speed
  interpolation. Shared with `nmea-sim/` so the fixture generator and the NMEA
  simulator can never disagree about what the boat can do. Change it and both
  move together.
- `generate-polars.js` — seeded Node script that writes the fixture variants
  in `fixtures/` (CSV + ground-truth manifest per variant). Run with
  `node generate-polars.js [variant…]`; output is deterministic and committed.
- `fixtures/` — the generated fixture suite (`noisy-log`, `clean-grid`,
  `with-limits`, `upwind`), consumed by the app's opt-in accuracy sweep
  (`npm run eval:suggestions` in `sailplan-app/`) and importable into the app.
  See
  [`sailplan-app/docs/sail-suggestion/package-e-eval-harness.md`](sailplan-app/docs/sail-suggestion/package-e-eval-harness.md).
- `polars_random.csv` — legacy unseeded dataset (the round-2 accuracy review
  was measured on it); kept for hand-feeding the import, no longer
  regenerated.
- Not part of the app build and has no dependency on `sailplan-app/` (the
  app's eval harness reads `fixtures/`, not the other way around).

## The `nmea-sim/` folder

A dependency-free Node TCP server that speaks the NMEA 0183 the boat's B&G
Zeus 3 puts on the wire — so the ingestion feature can be built and tested on
a desk instead of on the water. Three modes: **replay** a real Navico capture,
**sail** a scripted course at a known polar and ship the ground truth, and
**inject faults** (dropouts, split sentences, one field going stale while the
rest keep flowing). Plus `hotspot.sh`, which turns this box into the plotter's
access point so the no-internet-WiFi trap is reproducible.

`node nmea-sim.js --help`, and see [`nmea-sim/README.md`](nmea-sim/README.md).
Built for [`.tickets/nmea-ingestion`](.tickets/nmea-ingestion/map.md) ticket
`14`. Not part of the app build.

## Ground rules for agents

- **Work in `sailplan-app/`** unless the task is explicitly about the polar
  generator. Its `AGENTS.md` documents commands, conventions, and gotchas.
- **Read the domain context early.** The domain is specialised (TWA, TWS,
  polars, tacks, wind zones). See [`CONTEXT.md`](CONTEXT.md).
- **Match existing patterns.** The app is consistently feature-sliced; mirror
  the nearest existing feature rather than inventing structure.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.tickets/`. See
`docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: [`CONTEXT.md`](CONTEXT.md) + `docs/adr/` at the repo root.
See `docs/agents/domain.md`.
