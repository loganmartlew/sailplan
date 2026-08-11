# Architecture

How SailPlan is put together: the layers, the provider/startup chain, and how
data flows from SQLite to the screen.

## Layers

SailPlan is **feature-sliced**. Cross-cutting concerns sit at the top level;
everything domain-specific lives inside a `features/<name>/` slice.

```
┌─────────────────────────────────────────────────────────────┐
│ app/                Expo Router screens (thin composition)   │
├─────────────────────────────────────────────────────────────┤
│ features/<name>/    Domain logic, data access, UI, state     │
│   api  model  components  hooks  context  store  util        │
├─────────────────────────────────────────────────────────────┤
│ components/         Shared UI: ui/ (primitives) form/ (RHF)   │
│ hooks/              App-wide hooks (useForm, useAlert, ...)   │
│ lib/                db, format, constants, icons, utils, kv   │
├─────────────────────────────────────────────────────────────┤
│ schema.ts + drizzle/   SQLite schema and generated migrations│
└─────────────────────────────────────────────────────────────┘
```

**Rule of thumb:** screens compose, features implement. A file under `app/`
should read like a layout that pulls components and hooks from `features/`. If
you find yourself writing a DB query or domain math in `app/`, it belongs in a
feature slice instead.

See [conventions.md](conventions.md) for the anatomy of a feature slice.

## Provider & startup chain

The root layout ([`app/_layout.tsx`](../app/_layout.tsx)) wraps the app in a
fixed chain. Each layer must succeed before the next renders:

```
RootLayout
└─ AppProviders                 (components/AppProviders.tsx)
   ├─ QueryClientProvider       react-query client (mounted; used sparingly)
   ├─ BoatProfileProvider       active boat profile  → React Context + MMKV
   ├─ SettingsProvider          units & prefs        → React Context + MMKV
   └─ ThemeProvider + StatusBar light/dark navigation theme
      └─ MigrationGate          runs Drizzle migrations; blocks until done
         └─ BoatProfileGate     forces a boat profile to be selected/created
            └─ GestureHandlerRootView
               └─ Tabs          Plan · Marks · Courses · Sails · Settings
                  └─ tabBar     CaptureRecordingBar + BottomTabBar
```

Consequences worth knowing:

- **The capture layer is chrome, not a screen.** While a recording is running,
  `CaptureRecordingBar` floats over screen content just above the tab bar via
  the `Tabs` `tabBar` prop, so it is present on every tab and belongs to no
  screen. Scroll surfaces use `useCaptureInset()` so their final item can clear
  the pill. It renders nothing when not recording. Recording state lives in
  `features/capture/store/captureRecordingStore`, never in a screen's `useState`
  — a screen-local flag disagrees with the real recording the moment the sailor
  navigates away.
- **Migrations run at startup.** `MigrationGate` calls `useMigrations(db,
  migrations)` and renders a "Migration in progress…" screen until success. A
  migration error is shown inline. See [data-layer.md](data-layer.md).
- **A boat profile is always active.** `BoatProfileGate` guarantees a selected
  profile before the main UI renders. Most queries filter by the active
  `boatProfileId`, so "the current boat" is an ambient assumption throughout the
  app. The active profile id is persisted in MMKV and hydrated on launch.
- **Settings/units are ambient too.** `useSettings()` exposes unit preferences
  (speed, distance, area, coordinate format) read across the app.

## Navigation

Five bottom tabs, each an Expo Router route group:

| Tab      | Route group    | Purpose                                          |
| -------- | -------------- | ------------------------------------------------ |
| Plan     | `app/(plan)/`  | The core flow: wind + course → bearings/TWA/sail |
| Marks    | `app/marks/`   | CRUD for geographic marks                         |
| Courses  | `app/courses/` | CRUD for courses (ordered lists of marks)        |
| Sails    | `app/sails/`   | Sails, their polars, and TWA limits              |
| Settings | `app/settings/`| Units, appearance, defaults, about               |

Full tree in [routing.md](routing.md).

## Data flow

Data lives in a local SQLite database. There is no backend.

```
schema.ts ──► Drizzle ORM ──► expo-sqlite (sailplan.db)
                  ▲                    │
                  │                    ▼
   feature api/ (queries & mutations)  │
                  │                    │
       useLiveQuery(...) ◄─────────────┘   reactive: re-runs on write
                  │
                  ▼
        feature components / screens
```

- **Reads** are usually reactive: a feature's `api/` exposes `useX()` hooks built
  on Drizzle's `useLiveQuery`, which automatically re-runs when a referenced
  table changes — no manual invalidation. One-shot reads use plain `async`
  functions (`getX`).
- **Writes** are plain `async` functions in `api/` (`createX`, `updateX`,
  `deleteX`) that run Drizzle mutations. After a write, open live queries update
  themselves.
- **Preferences and the active boat profile** are stored in MMKV (via
  `react-native-mmkv`) and surfaced through React Context, not SQLite.
- **Transient UI state** (currently only the plan's wind inputs) uses a `zustand`
  store keyed by boat profile.

Details and examples in [data-layer.md](data-layer.md).

## The plan pipeline (the app's reason to exist)

The Plan tab turns wind + geometry into guidance. At a high level:

```
marks (from/to) ──► coordsToBearing ──► bearing (°)
wind direction (TWD) + bearing ──► getTwa ──► { TWA angle, tack }
TWA + wind speed (TWS) + sails/polars/limits ──► suggestSails ──► top sail(s)
```

- Bearing and TWA math: [`features/coordinate`](../features/coordinate/README.md).
- Plan orchestration and state: [`features/plan`](../features/plan/README.md).
- Sail ranking: [`features/sailSuggestion`](../features/sailSuggestion/README.md),
  built on polar interpolation in
  [`features/sailPolar`](../features/sailPolar/README.md).

## Build-time wiring worth knowing

- **`.sql` migrations are inlined** into the JS bundle via
  `babel-plugin-inline-import` (`babel.config.js`) with `sql` added to Metro's
  `sourceExts` (`metro.config.js`), so `drizzle/migrations.js` can `import` them.
- **NativeWind** is wired through Babel (`jsxImportSource: 'nativewind'`) and
  Metro (`withNativeWind`, input `global.css`).
- **React Compiler** and **typed routes** are enabled experiments in
  `app.config.js`.
- **App identity** (name, package, version code) is computed per `APP_VARIANT` in
  `app.config.js`.
