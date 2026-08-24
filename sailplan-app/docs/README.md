# SailPlan Docs

Documentation for the SailPlan app, written to be read by both humans and AI
coding agents. Start with [`../AGENTS.md`](../AGENTS.md) for the quickstart and
map; use these docs for depth.

## Index

| Doc                                        | Covers                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| [architecture.md](architecture.md)         | Layers, provider tree, startup gates, how data flows                   |
| [conventions.md](conventions.md)           | Feature-slice anatomy, api/model patterns, forms, naming, the `~` alias|
| [data-layer.md](data-layer.md)             | Drizzle schema, migrations, `useLiveQuery`, MMKV, settings & units     |
| [`../../CONTEXT.md`](../../CONTEXT.md)     | Sailing vocabulary (TWA, TWS, polar, tack, wind zone…) mapped to code  |
| [features.md](features.md)                 | Catalogue of every `features/` slice and its responsibility            |
| [ui.md](ui.md)                             | NativeWind theming, `components/ui`, `components/form`, icons, helper text |
| [routing.md](routing.md)                   | The Expo Router screen tree                                            |
| [testing.md](testing.md)                   | Jest setup and test conventions                                        |
| [sail-suggestion/](sail-suggestion/README.md) | Suggestion-engine review findings + per-package implementation plans |

## Feature-level docs

Some features have non-obvious internal logic and carry their own README:

- [`features/sailSuggestion/README.md`](../features/sailSuggestion/README.md) —
  the sail-ranking pipeline (evaluation → guards → ranking → selection)
- [`features/plan/README.md`](../features/plan/README.md) — bearing → TWA → tack
  → directions, and the per-boat-profile plan store
- [`features/coordinate/README.md`](../features/coordinate/README.md) — bearing
  and TWA math, coordinate formats (DMS/DMM), tack determination
- [`features/sailPolar/README.md`](../features/sailPolar/README.md) — bilinear
  polar interpolation (IDW fallback) and confidence scoring

## How to keep these docs useful

- These docs describe **intent and structure**, not every line — code is the
  source of truth for behaviour. When code and docs disagree, fix whichever is
  wrong and note it.
- When you add a feature, add a row to [features.md](features.md). When you
  change a cross-cutting pattern, update [conventions.md](conventions.md).
- Prefer updating an existing doc over adding a new one; keep the set small.
