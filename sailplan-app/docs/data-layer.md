# Data Layer

SailPlan stores everything locally. There is no server. Three storage mechanisms:

| Storage         | Used for                                   | Accessed via                       |
| --------------- | ------------------------------------------ | ---------------------------------- |
| SQLite (Drizzle)| Domain data (marks, courses, sails, …)     | `~/lib/db` + feature `api/`        |
| MMKV            | Preferences + active boat profile id       | React Context (`useSettings`, …)   |
| zustand         | Transient plan wind inputs                 | `usePlanState` (plan feature)      |

## SQLite via Drizzle

### The database handle

```ts
// lib/db.ts
export const expoDb = openDatabaseSync('sailplan.db', { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });
```

`enableChangeListener: true` is what makes `useLiveQuery` reactive — writes emit
change events that re-run open queries.

### Schema

All tables and relations are defined in one file: [`schema.ts`](../schema.ts).
Drizzle `relations()` power the nested `db.query.*.findMany({ with: … })` API.

```
boatProfile ─┬─< sail ─┬─< sailPolar
             │         └─< sailTwaLimit
             │
courseGroup ─┴─< course ─< courseMark >─ mark
```

| Table          | Key columns                                              | Notes                                        |
| -------------- | -------------------------------------------------------- | -------------------------------------------- |
| `boatProfile`  | `id`, `name`                                             | The active profile scopes most sail data     |
| `mark`         | `id`, `name`, `latitude`, `longitude`                   | A geographic point                           |
| `sail`         | `id`, `name`, `color`, `sailArea?`, `symmetrical`, `masthead`, `boatProfileId` | Belongs to a boat profile |
| `sailPolar`    | `id`, `tws`, `twa`, `speed`, `sailId`                   | One polar data point (see glossary)          |
| `sailTwaLimit` | `id`, `tws`, `minTwa?`, `maxTwa?`, `sailId`             | Usable TWA band at a wind speed              |
| `course`       | `id`, `name`, `courseGroupId?`                           | An ordered set of marks                      |
| `courseMark`   | `id`, `courseId`, `markId`, `order`, `direction?`       | Join row; `order` sequences the legs         |
| `courseGroup`  | `id`, `name`                                             | Optional grouping of courses                 |

See [domain-glossary.md](domain-glossary.md) for what TWS/TWA/polar/etc. mean.

### Migrations

Drizzle Kit config: [`drizzle.config.ts`](../drizzle.config.ts) (`dialect:
sqlite`, `driver: expo`, schema `./schema.ts`, out `./drizzle`).

Workflow when you change `schema.ts`:

1. Edit [`schema.ts`](../schema.ts).
2. `npx drizzle-kit generate` → writes a numbered `.sql` file into `drizzle/` and
   updates `drizzle/meta` + `drizzle/migrations.js`.
3. The migration is **bundled into the app**: `.sql` files are inline-imported
   (Babel `inline-import` plugin + Metro `sql` source ext) and referenced by
   `drizzle/migrations.js`.
4. At startup, [`MigrationGate`](../components/MigrationGate.tsx) runs
   `useMigrations(db, migrations)` and blocks the UI until they apply.

Do **not** hand-edit generated migration files. `MigrationGate` also wires up
`expo-drizzle-studio-plugin` for inspecting the DB in dev.

### Reading & writing

Reactive reads use `useLiveQuery`; one-shot reads/writes are plain `async`. Both
live in each feature's `api/`. Example, and a boat-profile-scoped join:

```ts
// reactive
export function useMarks() {
  return useLiveQuery(db.query.mark.findMany({ orderBy: [asc(mark.name)] }));
}

// scoped join with a deps array (re-runs when the id changes)
useLiveQuery(
  db.select({ /* … */ })
    .from(sailPolar)
    .innerJoin(sail, eq(sailPolar.sailId, sail.id))
    .where(eq(sail.boatProfileId, activeBoatProfileId)),
  [activeBoatProfileId],
);
```

Notes:

- `useLiveQuery` returns `{ data, error, ... }`; `data` is `undefined` until the
  first run — guard for it.
- Pass a **deps array** when the query depends on a variable (like the active
  boat profile id), or it won't re-run when that variable changes.
- No cache invalidation is needed; writes propagate to live queries
  automatically via the change listener.

## MMKV — preferences & active profile

MMKV is a fast synchronous key-value store. A single instance lives in
[`lib/kv.ts`](../lib/kv.ts). It's consumed through the typed hooks
(`useMMKVString`, `useMMKVNumber`) inside Context providers, not read directly by
components.

- **Active boat profile:** `BoatProfileProvider` persists the selected profile id
  under `boatProfileID` and hydrates it on launch
  (`features/boatProfile/context/BoatProfileContext.tsx`). Read it with
  `useBoatProfile()`.
- **Settings:** `SettingsProvider` stores each preference under a
  `settings.<name>` key and exposes them via `useSettings()`.

## Settings & units

Settings are defined in [`features/settings/model/settings.ts`](../features/settings/model/settings.ts)
as Zod enums plus a `DEFAULT_SETTINGS` object:

| Setting              | Type / values                | Default |
| -------------------- | ---------------------------- | ------- |
| `speedUnit`          | `kn` `km/h` `m/s` `mi/h`     | `kn`    |
| `areaUnit`           | `m^2` `ft^2`                 | `m^2`   |
| `distanceUnit`       | `nm` `km` `mi`               | `nm`    |
| `coordFormat`        | `DMS` `DMM`                  | `DMS`   |
| `hemisphereLatitude` | `N` `S`                      | `S`     |
| `hemisphereLongitude`| `E` `W`                      | `E`     |
| `mapZoom`            | number                       | `0.15`  |
| `polarChartType`     | `polar` `scatter`            | `polar` |

Consume settings with `useSettings()`; each has a matching setter
(`setSpeedUnit`, …). Formatting/conversion helpers that respect the chosen units
live in [`lib/format.ts`](../lib/format.ts) (`formatAngle`, speed/area/distance
formatters). Defaults for hemisphere/coordinate format seed new coordinate
entry. See also [domain-glossary.md](domain-glossary.md) for coordinate formats.

## zustand — transient plan state

The only zustand store is the plan wind input, keyed **per boat profile** so each
boat remembers its last-entered wind:

```ts
// features/plan/store/planStore.ts
usePlanState() // → { currentState: { twd, tws } | null, add(partial) }
```

`add` merges a partial update against the active profile's existing state. This
is intentionally not persisted to SQLite — it's ephemeral planning input.
