# Conventions

Patterns to follow so new code matches the codebase. When in doubt, open the
nearest existing feature and mirror it — the `mark` feature is a clean,
representative CRUD example.

## The `~` import alias

`~` resolves to the `sailplan-app/` root (`tsconfig.json` → `paths: { "~/*":
["*"] }`; also declared in `components.json`).

```ts
import { db } from '~/lib/db';
import { Mark, useMarks } from '~/features/mark';
import { Button, Text } from '~/components/ui';
```

Use `~` for anything outside the current feature. Relative imports (`./`, `../`)
are fine **within** a feature.

## Anatomy of a feature slice

Every feature lives in `features/<name>/` and exposes a public API through
`index.ts`. Not every folder is present in every feature — include only what you
need.

```
features/<name>/
├── index.ts        Public barrel — re-exports the feature's public surface
├── api/            Data access: useLiveQuery hooks + async read/write functions
├── model/          Types + Zod schemas (mirror the Drizzle table)
├── components/     Feature-specific React components
├── hooks/          Feature-specific hooks
├── context/        React Context provider(s), if the feature owns app state
├── store/          zustand store(s) — only `plan` uses this
└── util/           Pure functions (math, mappers, guards) + __tests__/
```

Import features **through the barrel**: `import { useMarks } from
'~/features/mark'`. The one exception is a handful of cross-feature *type*
imports that reach directly into another feature's `model/` (e.g.
`~/features/sailPolar/model/interpolation`) to avoid pulling in components.

## `model/` — types + schema mirror the database

Types are derived from the Drizzle table, and a Zod schema is declared next to
them. Add the column in `schema.ts` first, then reflect it here.

```ts
// features/mark/model/mark.ts
import { z } from 'zod';
import { mark } from '~/schema';

export type Mark = typeof mark.$inferSelect;
export type MarkInsert = typeof mark.$inferInsert;

export const markSchema: z.ZodType<Mark> = z.object({ /* ...columns... */ });
export const markInsertSchema: z.ZodType<MarkInsert> = z.object({ /* ... */ });
```

- `$inferSelect` = a full row; `$inferInsert` = the shape you insert.
- The Zod schema is typed `z.ZodType<Mark>` so it stays in lockstep with the DB
  type — TypeScript errors if they drift.
- Zod schemas are used for form validation and for (de)serializing data passed
  between screens as route params.

## `api/` — data access

Two shapes live here:

**Reactive read hooks** wrap Drizzle `useLiveQuery` and re-run automatically when
the underlying table changes:

```ts
// features/mark/api/getMarks.ts
export function useMarks() {
  return useLiveQuery(db.query.mark.findMany({ orderBy: [asc(mark.name)] }));
}
```

**One-shot functions** are plain `async` for imperative reads and all writes:

```ts
export async function getMark(id: number) { /* findFirst → row | null */ }
export async function createMark(insert: MarkInsert): Promise<Mark> { /* insert().returning() */ }
```

Conventions:

- Name hooks `useX` / `useXs`, one-shot reads `getX` / `getXs`, writes
  `createX` / `updateX` / `deleteX` / `importX`.
- Mutations use `.returning()` and return the affected row(s).
- Scope queries to the **active boat profile** where the data belongs to a boat
  (sails, polars, TWA limits). See [data-layer.md](data-layer.md).

## Components

- Functional components, named exports, `interface XProps` for props.
- Styling is Tailwind classes via NativeWind `className`; compose/merge with
  `cn()` from `~/lib/utils`.
- Use the shared kit: primitives from `~/components/ui`, form inputs from
  `~/components/form`, icons from `~/lib/icons`. See [ui.md](ui.md).

## Forms

Use the local `useForm` wrapper, not `react-hook-form` directly.

```ts
// hooks/useForm.tsx returns [Form, formApi]
const [Form, { handleSubmit, watch }] = useForm<Values>({
  resolver: zodResolver(schema),
  defaultValues: { /* ... */ },
});

return (
  <Form className="flex gap-6">
    <TextInput<Values> name="name" label="Name" required />
    <Button onPress={handleSubmit(onSubmit)}><Text>Save</Text></Button>
  </Form>
);
```

- `useForm` returns a `[Form, formApi]` tuple; `Form` is a `FormProvider` +
  `View`, so form inputs read context automatically.
- Validate with a Zod schema via `zodResolver`.
- Prefer the typed inputs in `components/form/` (`TextInput`, `NumberInput`,
  `SelectInput`, `ToggleGroup`, `ColorPickerInput`, `StepperNumberInput`), which
  are generic over the form value type and wire into RHF for you. Drop to
  `Controller` only for bespoke inputs (see `PlanCourse.tsx`).

## Passing data between screens

Expo Router params are strings. Complex objects are serialized to JSON through a
Zod schema and parsed on the other side:

```ts
// features/plan/model/coursePlanData.ts
export const serializeCoursePlanData = (d: CoursePlanData) =>
  JSON.stringify(coursePlanDataSchema.parse(d));
export const deserializeCoursePlanData = (s: string) =>
  coursePlanDataSchema.parse(JSON.parse(s));
```

Follow this pattern (`serializeX` / `deserializeX` in `model/`) rather than
hand-rolling `JSON.stringify` at the call site.

## Naming & style

- **TypeScript is `strict`.** No implicit `any`; keep types honest.
- Files: components `PascalCase.tsx`; utils/api/models `camelCase.ts`; tests in
  `__tests__/` named `*.test.ts` (a couple of legacy `*-test.ts` exist).
- Barrels (`index.ts`) `export *` from the files that make up the public surface.
- Follow the surrounding code's formatting (single quotes, trailing commas). Run
  `npm run lint` before finishing.
