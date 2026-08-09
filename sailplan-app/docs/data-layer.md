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

See [`../../CONTEXT.md`](../../CONTEXT.md) for what TWS/TWA/polar/etc. mean.

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
`expo-drizzle-studio-plugin` for inspecting the DB in dev. Custom SQL that can't
come from a schema diff (a data backfill, say) gets its own migration via
`npx drizzle-kit generate --custom` — that is the sanctioned escape hatch, not
editing a generated file.

#### Adding a foreign key rebuilds the whole table

SQLite cannot add a `FOREIGN KEY` constraint to an existing table, so
drizzle-kit emits a **12-step table rebuild** instead of an `ALTER TABLE`:
`PRAGMA foreign_keys=OFF`, `CREATE TABLE __new_x`, `INSERT INTO __new_x(…)
SELECT … FROM x`, `DROP TABLE x`, `RENAME`. See
[`drizzle/0006_busy_red_hulk.sql`](../drizzle/0006_busy_red_hulk.sql), which did
this to `course` to add `courseGroupId`. A column with no `.references()` is a
plain `ALTER TABLE … ADD` instead (see `0003`, `0008`).

Rows **are** copied, so a rebuild is not data loss by default. The hazards are
narrower, and both matter because `MigrationGate` blocks the UI until migrations
apply — a migration that throws is an app that will not open on a real device:

- **A new column plus a new foreign key in the same migration will fail.** The
  generated `INSERT … SELECT` names the new column on *both* sides, selecting it
  from the old table where it does not exist yet. Split it: add the plain column
  in one migration, the `.references()` column in the next.
- **The rebuild is a `DROP TABLE` with no transaction guarantee around the
  sequence.** A failure between the drop and the rename leaves the table gone.

So: prefer to add foreign keys while a table is small, **read the generated SQL**
whenever a migration touches an existing table, and test it against a populated
database rather than an empty one.

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
entry. See also [`../../CONTEXT.md`](../../CONTEXT.md) for coordinate formats.

## zustand — transient plan state

The only zustand store is the plan wind input, keyed **per boat profile** so each
boat remembers its last-entered wind:

```ts
// features/plan/store/planStore.ts
usePlanState() // → { currentState: { twd, tws } | null, add(partial) }
```

`add` merges a partial update against the active profile's existing state. This
is intentionally not persisted to SQLite — it's ephemeral planning input.
