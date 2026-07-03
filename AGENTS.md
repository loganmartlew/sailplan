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
| `polars/`        | A standalone Node script that generates random polar CSVs for test data.   | [see below](#the-polars-folder)         |

**Almost all work happens in `sailplan-app/`.** Start with its
[`AGENTS.md`](sailplan-app/AGENTS.md), which links into a full
[`docs/`](sailplan-app/docs/) suite (architecture, conventions, data layer, a
sailing **domain glossary**, feature catalogue, UI, testing, routing).

## The `polars/` folder

A throwaway utility, not shipped with the app.

- `generate-polars.js` — Node script that writes `polars_random.csv`, a grid of
  random `(TWS, TWA, speed)` polar points. Used to hand-feed test data into the
  app's polar import. Run with `node generate-polars.js`.
- Not part of the app build, has no dependency on `sailplan-app/`, and has no
  tests.

## Ground rules for agents

- **Work in `sailplan-app/`** unless the task is explicitly about the polar
  generator. Its `AGENTS.md` documents commands, conventions, and gotchas.
- **Read the domain glossary early.** The domain is specialised (TWA, TWS,
  polars, tacks, wind zones). See
  [`sailplan-app/docs/domain-glossary.md`](sailplan-app/docs/domain-glossary.md).
- **Match existing patterns.** The app is consistently feature-sliced; mirror
  the nearest existing feature rather than inventing structure.
