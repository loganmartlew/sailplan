# Plan Feature

The Plan tab is SailPlan's reason to exist: it turns **wind + geometry** into
per-leg guidance — the bearing to the next mark, the true wind angle (TWA) and
tack you'll sail it on, and the suggested sail.

New to the vocabulary (TWD, TWS, TWA, bearing, tack, leg)? Read the
[domain glossary](../../docs/domain-glossary.md) first.

## Two entry flows

| Flow            | Component                            | Produces                              |
| --------------- | ----------------------------------- | ------------------------------------- |
| **Plan a leg**  | `PlanLeg` → `/leg/plan`             | One leg between two marks             |
| **Plan a course** | `PlanCourse` → `/course/plan`      | A whole course (start → marks → finish) |

Both collect wind via `TrueWindInputCard`, then serialize their selection into a
route param and push to the planned view.

## Data flow

```
PlanLeg / PlanCourse (form: marks + wind)
        │  serializeLegPlanData / serializeCoursePlanData  (Zod → JSON string)
        ▼
router.push({ pathname, params: { planData } })
        │  deserialize on arrival
        ▼
planned screen → DirectionsCard / CourseLegCard (per leg)
        │
        ├─ coordsToBearing(from, to)         → bearing        (features/coordinate)
        ├─ getTwa(twd, bearing)              → { angle, tack } (features/coordinate)
        └─ useSailSuggestions(twa, tws)      → suggested sail  (features/sailSuggestion)
```

- Marks/course come from the form; **wind (TWD/TWS)** comes from the plan store.
- Objects crossing screens are serialized through Zod schemas — never hand-rolled
  JSON (see [`model/legPlanData.ts`](model/legPlanData.ts),
  [`model/coursePlanData.ts`](model/coursePlanData.ts) and
  [conventions](../../docs/conventions.md#passing-data-between-screens)).
- `DirectionsCard` shows bearing + TWA + tack for a leg;
  `CourseLegCard` does the same per leg of a course and surfaces the suggested
  sail.

## The wind store (`store/planStore.ts`)

Wind input is transient and **keyed per boat profile**, so each boat remembers
its last-entered wind without persisting to SQLite.

```ts
const { currentState, add } = usePlanState();
// currentState: { twd, tws } | null  (for the active boat profile)
add({ twd: 220 });   // merges against existing state for the active profile
```

- Backed by `zustand`; `usePlanState` scopes reads/writes to the active
  `boatProfile.id` (falls back to `0` when none).
- `add` takes a `Partial<{ twd, tws }>` and keeps the untouched field's previous
  value — pass only what changed.
- This is the **only** zustand store in the app; everything else is SQLite +
  live queries or MMKV. See [data-layer.md](../../docs/data-layer.md).

## Files

```
plan/
├── index.ts
├── model/
│   ├── legPlanData.ts       LegPlanData + serialize/deserialize (from/to marks)
│   └── coursePlanData.ts    CoursePlanData + serialize/deserialize (course + start/finish)
├── store/
│   └── planStore.ts         usePlanState — per-boat-profile wind (twd/tws)
└── components/
    ├── PlanLeg.tsx          Form: pick two marks + wind → /leg/plan
    ├── PlanCourse.tsx       Form: pick course + start/finish + wind → /course/plan
    ├── TrueWindInputCard.tsx  Wind (TWD/TWS) entry, writes the plan store
    ├── DirectionsCard.tsx   Bearing + TWA + tack for a leg
    ├── CourseLegCard.tsx    Per-leg card (bearing/TWA/suggested sail)
    ├── TackDirectionBadge.tsx  Port/starboard badge
    ├── CustomLocation.tsx   Start/finish location picker (mark or custom coords)
    └── CourseMarkListDialog.tsx
```

## Related

- Bearing/TWA math: [`features/coordinate`](../coordinate/README.md)
- Sail ranking: [`features/sailSuggestion`](../sailSuggestion/README.md)
- Screen wiring: [routing.md](../../docs/routing.md)
