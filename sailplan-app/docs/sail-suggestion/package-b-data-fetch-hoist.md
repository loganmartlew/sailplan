# Package B — Data-fetch hoist (implementation plan)

> Covers finding **3.1** from [`improvements.md`](./improvements.md).
> Independent of Package A (zero file overlap with the scoring core) and can
> ship before, after, or in parallel with it — but must **not** be bundled
> into A's PR. Single biggest efficiency win available.

## Problem being solved

`app/(plan)/course/plan.tsx` renders one `CourseLegCard` per leg. Each card
calls `useSailSuggestions(twa, tws)`, which calls
`useSailSuggestionData(boatProfileId)`, which mounts **three `useLiveQuery`
subscriptions** (sails, polars-with-join, limits-with-join). For an N-leg
course that is:

- **3 × N live SQLite subscriptions** fetching *identical* data (the queries
  depend only on the boat profile, never on the leg),
- 3 × N re-executions on **any** write to `sail`, `sailPolar`, or
  `sailTwaLimit` (e.g. adding one polar point via the card's own "+ Polar"
  dialog re-runs 30 queries on a 10-leg course),
- N separate `buildSailSuggestionData` map-building passes over the same rows.

## Requirements

1. Exactly **one** set of the three live queries per course-plan screen,
   regardless of leg count.
2. Each leg still recomputes its own suggestions from `(twa, tws)` — the
   engine call stays per-leg, pure, and memoised.
3. Reactivity is preserved: adding a sail/polar/limit still updates every
   card, via the single shared subscription.
4. The card gets access to the **whole** `SailSuggestionResult` (not just
   `suggested`) — Package C needs it for the breakdown sheet.
5. No behaviour change in what is suggested.

## Design

**Chosen approach: lift the data hook into the screen and pass data down as a
prop.** A React context provider was considered and rejected for now: there is
exactly one consumer (`plan.tsx` → `CourseLegCard`), the prop path is one
level deep, and the workspace convention is that screens wire together feature
hooks. If a second screen ever needs per-leg suggestions, promote this to a
`SailSuggestionDataProvider` in `features/sailSuggestion/context/` — the hook
split below makes that a drop-in change.

### 1. Split the hook (feature: `sailSuggestion`)

Keep `useSailSuggestionData(boatProfileId)` exactly as is — it is already the
"fetch once" primitive. Replace `useSailSuggestions` (data + compute fused)
with a pure compute hook:

```ts
// hooks/useSailSuggestions.ts
export function useSailSuggestions(
  data: SailSuggestionData | null,
  twa: number | null,
  tws: number | null,
): SailSuggestionResult | null {
  return useMemo(() => {
    if (!data || twa === null || tws === null) return null;
    return suggestSails(twa, tws, data.sails, data.allPolars, data.allLimits);
  }, [data, twa, tws]);
}
```

- No `useBoatProfile`, no queries — pure derivation. (With the React Compiler
  enabled the `useMemo` is arguably redundant, but it documents intent and
  costs nothing.)
- Export `SailSuggestionData` (the type) from the feature barrel — the screen
  and card prop need to name it. `useSailSuggestionData` is already exported.
- The old fused signature `useSailSuggestions(twa, tws)` has exactly one
  consumer (`CourseLegCard`), so this is a clean break — no deprecation
  shim needed.

### 2. Fetch once in the screen

`app/(plan)/course/plan.tsx`:

```tsx
const { boatProfile } = useBoatProfile();               // existing provider
const suggestionData = useSailSuggestionData(boatProfile?.id ?? null);
// …
<CourseLegCard … suggestionData={suggestionData} />
```

`useBoatProfile` comes from `~/features/boatProfile` (the provider is already
mounted above every screen via `BoatProfileGate`).

### 3. Consume in the card

`features/plan/components/CourseLegCard.tsx`:

```tsx
interface CourseLegCardProps {
  // …existing props…
  suggestionData: SailSuggestionData | null;
}

const sailSuggestions = useSailSuggestions(suggestionData, twa.angle, tws);
const suggested = sailSuggestions?.suggested ?? [];
```

Keep `sailSuggestions` (the full result) in scope — Package C wires it into
the breakdown sheet. Rendering is unchanged: `null` data continues to render
"No Suggestions", same as today's loading state.

## Query-count accounting (before → after)

| Course size | Live subscriptions today | After |
| ----------- | ------------------------ | ----- |
| 5 legs      | 15                       | 3     |
| 10 legs     | 30                       | 3     |
| Re-runs when one polar point is added (10 legs) | 30 queries + 10 map builds | 3 queries + 1 map build |

## Testing & verification

- `suggestSails` itself is untouched — no engine test changes.
- The new `useSailSuggestions` is a trivial memo wrapper; cover it only if a
  hook-testing setup already exists (don't introduce one for this).
- `npm run lint`, `npx tsc --noEmit`, `npx jest`.
- On-device sanity (no headless option for this app): open a multi-leg course
  plan, confirm suggestions render per leg, then add a polar point from a
  card's "+ Polar" dialog and confirm all cards refresh. State exactly what
  was verified in the PR.

## Files touched

```
features/sailSuggestion/hooks/useSailSuggestions.ts   signature change (pure compute)
features/sailSuggestion/index.ts                      +export type SailSuggestionData
features/plan/components/CourseLegCard.tsx            prop instead of self-fetch
app/(plan)/course/plan.tsx                            single useSailSuggestionData call
features/sailSuggestion/README.md                     data-layer section: hook split
features/plan/README.md                               leg-card data-flow diagram line
```

## Out of scope

Anything inside `suggestSails` (Package A), rendering more of the result
(Package C), and memoising `buildSailSuggestionData` beyond what the single
call site already achieves.
