# Routing

SailPlan uses **Expo Router** file-based routing with **typed routes** enabled.
Files in `app/` map to screens; `_layout.tsx` files define navigators. Screens
are thin — they compose components/hooks from `features/` (see
[architecture.md](architecture.md)).

## Screen tree

```
app/
├── _layout.tsx                     Root: providers + gates + bottom Tabs
│
├── (plan)/                         ── Tab: Plan (the core flow) ──
│   ├── _layout.tsx
│   ├── index.tsx                   Pick course + enter wind (PlanCourse)
│   ├── course/plan.tsx             Planned course → per-leg cards
│   ├── leg/plan.tsx                Single leg detail (bearing/TWA/sail)
│   └── leg/map.tsx                 Leg on a map
│
├── marks/                          ── Tab: Marks ──
│   ├── _layout.tsx
│   ├── index.tsx                   Mark list
│   ├── new.tsx                     Create a mark
│   ├── [markId].tsx                View/edit a mark
│   └── map.tsx                     Marks on a map
│
├── courses/                        ── Tab: Courses ──
│   ├── _layout.tsx
│   ├── index.tsx                   Course list (grouped)
│   ├── (course)/new.tsx            Create a course
│   ├── (course)/[courseId].tsx     View/edit a course + its marks
│   └── courseGroups/[courseGroupId].tsx   Course group detail
│
├── sails/                          ── Tab: Sails ──
│   ├── _layout.tsx
│   ├── index.tsx                   Sail list (active boat profile)
│   ├── new.tsx                     Create a sail
│   └── [sailId]/
│       ├── index.tsx               Sail detail
│       ├── polar-chart.tsx         Polar/scatter chart for the sail
│       └── twa-limits.tsx          Edit TWA limits
│
└── settings/                       ── Tab: Settings ──
    ├── _layout.tsx
    ├── index.tsx                   Settings home
    ├── units.tsx                   Speed/area/distance/coordinate units
    ├── appearance.tsx              Theme (light/dark)
    ├── defaults.tsx                Default hemispheres / coordinate format
    └── about.tsx                   About / links
```

The five tabs themselves are configured in [`app/_layout.tsx`](../app/_layout.tsx)
(`Tabs.Screen` per group, with icons from `~/lib/icons`).

## Conventions

- **Route groups** `(name)/` organise files without adding a path segment — e.g.
  `(plan)` is the Plan tab's root, `(course)` groups course create/detail.
- **Dynamic segments** `[param]` become typed params: `[markId]`, `[sailId]`,
  `[courseId]`, `[courseGroupId]`.
- **Typed routes** are on (`app.config.js` → `experiments.typedRoutes`), so route
  strings passed to `router.push` / `<Link>` are type-checked. Regenerate types
  by running the app if a new route isn't recognised.
- **Passing objects between screens:** params are strings, so complex payloads
  are serialized to JSON via a Zod schema and parsed on arrival — see
  `serializeCoursePlanData` / `serializeLegPlanData` in the
  [plan feature](../features/plan/README.md) and
  [conventions.md](conventions.md#passing-data-between-screens).
- Screens render behind the startup gates (migrations + boat profile) — see
  [architecture.md](architecture.md#provider--startup-chain).
