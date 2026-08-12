# SailPlan App — Agent Guide

> Primary orientation for working in `sailplan-app/`. Harness-agnostic
> (`AGENTS.md`); `CLAUDE.md` is a pointer to this file. Deeper topics live in
> [`docs/`](docs/) — this file is the map.

SailPlan is an **Expo / React Native app for Android** that helps sailors plan a
race. Enter the wind, pick a course, and it computes the bearing, true wind
angle, tack, and best sail for every leg.

## Quickstart commands

Run these from `sailplan-app/`:

| Task                         | Command                                        |
| ---------------------------- | ---------------------------------------------- |
| Install deps                 | `npm install`                                  |
| Run on Android (dev build)   | `npm run android`                              |
| Run on iOS (dev build)       | `npm run ios` *(iOS is unsupported; see below)*|
| Lint                         | `npm run lint`                                 |
| Tests (watch)                | `npm test`                                     |
| Tests (once)                 | `npx jest`                                     |
| Generate a Drizzle migration | `npx drizzle-kit generate`                     |
| Prebuild native project      | `npm run prebuild:development`                 |

- **Build with JDK 17.** `export JAVA_HOME=/usr/lib/jvm/temurin-17-jdk` (Fedora
  package `temurin-17-jdk`). On a machine whose default `java` is newer,
  incremental builds appear to work — the native configure step is already done
  and skipped — and then `npm run prebuild:development` wipes it and
  `:app:configureCMakeDebug` fails, reporting only
  `WARNING: A restricted method in java.lang.System has been called`, which
  names neither Java nor the real problem. `ANDROID_HOME` must be set too
  (`/home/logan/Android/Sdk`); a non-interactive shell does not source
  `.zshrc`.
- The app targets **Android only** (`app.config.js` → `platforms: ['android']`).
  The `ios` script exists but the app is not built or tested for iOS.
- Commands are wrapped in `cross-env APP_VARIANT=development`. The variant
  (`development` / `preview` / production) changes the app name and package id —
  see `app.config.js`.
- There is **no dev server workflow you can verify headlessly**; this is a
  native app that runs on a device/emulator. Don't claim a change "runs" from a
  build alone — say what you actually verified (lint, tests, types).

## Tech stack

| Concern            | Choice                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| Framework          | Expo (SDK 55) + React Native 0.83, React 19, **React Compiler enabled**   |
| Routing            | `expo-router` (file-based, **typed routes** on)                           |
| Database           | SQLite via `expo-sqlite` + **Drizzle ORM**                                |
| Reactive data      | Drizzle `useLiveQuery` (auto-refetches on write)                          |
| Key-value / prefs  | `react-native-mmkv` (via React Context)                                   |
| Transient state    | `zustand` (only the plan feature)                                         |
| Styling            | **NativeWind** (Tailwind for RN) + `tailwind.config.js`                   |
| UI primitives      | `@rn-primitives/*` wrapped in `components/ui` (shadcn-style)              |
| Forms              | `react-hook-form` + **Zod** resolvers                                     |
| Charts             | `victory-native` + `@shopify/react-native-skia`                           |
| Maps               | `react-native-maps` (Google Maps)                                         |
| Tests              | Jest via `jest-expo`                                                       |

`@tanstack/react-query` is installed and its provider is mounted, but data
access is done almost entirely through Drizzle `useLiveQuery`, not react-query.

## Architecture in one screen

```
app/                 Expo Router screens (thin — compose features, no logic)
components/           Cross-feature UI: ui/ (primitives), form/ (RHF inputs)
features/<name>/      Feature slices — where the real code lives
  ├── api/            DB reads/writes + useLiveQuery hooks (Drizzle)
  ├── model/          Types + Zod schemas (mirror Drizzle-inferred types)
  ├── components/     Feature-specific React components
  ├── hooks/          Feature-specific hooks
  ├── context/        React Context providers (boatProfile, settings)
  ├── store/          zustand stores (plan only)
  ├── util/           Pure functions (math, mappers, guards) + __tests__/
  └── index.ts        Public barrel — import features via this
hooks/                App-wide hooks (useForm, useAlert, useConfirm, ...)
lib/                  Cross-cutting: db, format, constants, icons, utils, kv
schema.ts             Drizzle table + relations definitions (single source)
drizzle/              Generated SQL migrations (bundled into the app)
```

Screens are thin. A screen wires together components and hooks from `features/`;
domain logic and data access belong in a feature slice, never in `app/`.

Full detail: [`docs/architecture.md`](docs/architecture.md).

## Conventions (the important ones)

- **Import via the `~` alias**, rooted at `sailplan-app/`: `~/lib/db`,
  `~/features/mark`, `~/components/ui`. Configured in `tsconfig.json` +
  `components.json`.
- **Import features through their barrel** (`~/features/mark`), not deep paths —
  except a few cross-feature type imports that reach into `model/` directly.
- **Models mirror the DB.** In `model/*.ts`, types come from
  `typeof table.$inferSelect` / `$inferInsert`, and a matching Zod schema is
  declared alongside. Add columns in `schema.ts` first.
- **Data access lives in `api/`.** `useX()` hooks wrap `useLiveQuery` for
  reactive reads; plain `async` functions do one-shot reads/writes.
- **Forms** use the local `useForm` wrapper (`hooks/useForm.tsx`) +
  `zodResolver` + the inputs in `components/form/`.
- **Styling** is Tailwind classes via NativeWind `className`; merge classes with
  `cn()` from `~/lib/utils`.
- **Icons** are re-exported from `~/lib/icons` (Lucide, wrapped so `className`
  works). Add new ones there.
- **TypeScript is `strict`.** Match the existing functional-component style.

Full detail: [`docs/conventions.md`](docs/conventions.md).

## Gotchas

- **`schema.ts` → migration.** Changing `schema.ts` requires
  `npx drizzle-kit generate`; migrations in `drizzle/` are bundled and applied at
  startup by `MigrationGate` (inline-imported as `.sql` — see `babel.config.js`
  and `metro.config.js`).
- **Startup gates.** The tree is wrapped `AppProviders → MigrationGate →
  BoatProfileGate`. Nothing renders until migrations succeed and a boat profile
  is selected. Most data is scoped to the **active boat profile**.
- **Typed routes.** `expo-router` typed routes are on; route strings are
  type-checked. `router.push` params are passed as **serialized JSON strings**
  (see the plan feature's `serialize*PlanData`).
- **`useLiveQuery` re-runs on any write** to referenced tables — no manual cache
  invalidation. Pass a deps array when the query depends on variables.

## Documentation map

| Doc                                            | Read it when you need…                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md) | The big picture: layers, providers, data flow, startup  |
| [`docs/conventions.md`](docs/conventions.md)   | How to write code that fits: patterns, naming, forms    |
| [`docs/data-layer.md`](docs/data-layer.md)     | Schema, migrations, `useLiveQuery`, MMKV, settings      |
| [`../CONTEXT.md`](../CONTEXT.md)               | **Sailing terms** and how they map to code/tables       |
| [`docs/features.md`](docs/features.md)         | What each feature slice does                            |
| [`docs/ui.md`](docs/ui.md)                     | Theming, `components/ui`, `components/form`, icons       |
| [`docs/routing.md`](docs/routing.md)           | The screen/route tree                                   |
| [`docs/testing.md`](docs/testing.md)           | Test setup and conventions                              |

Non-obvious feature internals have their own README:
[`features/sailSuggestion`](features/sailSuggestion/README.md),
[`features/plan`](features/plan/README.md),
[`features/coordinate`](features/coordinate/README.md),
[`features/sailPolar`](features/sailPolar/README.md).
