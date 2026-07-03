# SailPlan

A mobile app for sailors. Enter the wind and pick a course, and SailPlan tells
you — for every leg — the **bearing** to the next mark, the **true wind angle
(TWA)** you'll sail it at, which **tack** you'll be on, and which **sail** to fly.
It also manages marks, courses, boat profiles, sail polars, and TWA limits.

Built with [Expo](https://expo.dev) / React Native. Ships on **Android**.

## Getting started

```bash
npm install
npm run android      # build & run on a connected Android device / emulator
```

Other useful scripts:

```bash
npm run lint         # expo lint
npm test             # jest --watchAll
npx jest             # run tests once
npx drizzle-kit generate   # generate a SQL migration after editing schema.ts
```

The app targets Android and uses a development [build/variant](./app.config.js)
by default (`APP_VARIANT=development`). It is not built or tested for iOS.

## Tech stack

Expo Router (file-based routing) · Drizzle ORM over `expo-sqlite` · NativeWind
(Tailwind) · `@rn-primitives` UI · `react-hook-form` + Zod · `victory-native`
charts · `react-native-maps`. See [`docs/`](./docs/) for the full picture.

## Project structure

```
app/          Expo Router screens
components/    Shared UI (ui/ primitives, form/ inputs)
features/     Feature slices — most of the code (api/model/components/util/...)
hooks/        App-wide hooks
lib/          Cross-cutting helpers (db, format, icons, constants)
schema.ts     Drizzle database schema
drizzle/      Generated migrations
```

## Documentation

- [`docs/`](./docs/) — architecture, conventions, data layer, **domain glossary**,
  features, UI, routing, testing.
- [`AGENTS.md`](./AGENTS.md) — guide for AI coding agents (also read by Claude
  Code, Cursor, Copilot, etc.).

## Related tools

The `../polars/` folder (in the workspace root) holds a small Node script for
generating random polar CSV test data.
