# Feature Catalogue

Every domain concern is a slice under `features/`. Import each through its
`index.ts` barrel (`~/features/<name>`). See [conventions.md](conventions.md) for
the anatomy of a slice.

| Feature          | Responsibility                                                                                     | Notable pieces                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **boatProfile**  | The active boat. Owns sails/polars/limits. Provides the profile Context + selection UI, persisted to MMKV. | `context/BoatProfileContext`, `useBoatProfile`, `BoatProfileGate`             |
| **coordinate**   | Coordinate math and entry: bearing, TWA/tack, DMS/DMM ↔ decimal conversion, coordinate input UI.   | `util/bearing` (`coordsToBearing`, `getTwa`), `util/mappers`, `CoordinateForm` · [README](../features/coordinate/README.md) |
| **course**       | CRUD for courses, course groups, and the canonical route: ordered Course Marks, Legs, Via Points, and derived Leg Segments, written through transactional intents. | `api/courseRoute` (`useCourseRoute`, `useCourseMarks`, intents), `api/markRouteUsage`, `util/mapCourseRoute`, `CourseForm`, `CourseMarks`, models `course`/`courseMark`/`courseViaPoint`/`courseRoute` |
| **map**          | Reusable map building blocks (marker, location-picker dialog) over `react-native-maps`.            | `MapMarker`, `SelectLocationDialog`                                            |
| **mark**         | CRUD for geographic marks, plus mark sharing (share/import via link/text).                         | `api/*Mark`, `MarkForm`, `util/sharing`, `MarkShareDialog`                     |
| **navigation**   | App navigation chrome: drawer content, drawer button, active-profile label.                        | `DrawerContent`, `DrawerButton`, `BoatProfileLabel`                            |
| **plan**         | **The core flow.** Turns wind + course into per-leg bearing/TWA/tack and the suggested sail. Holds the transient wind store. | `PlanCourse`, `PlanLeg`, `DirectionsCard`, `CourseLegCard`, `store/planStore` · [README](../features/plan/README.md) |
| **sail**         | CRUD for sails and sail detail UI (belongs to a boat profile).                                     | `api/*Sail`, `SailForm`, `SailDetails`, `SailListItem`                         |
| **sailPolar**    | Sail polar data: CRUD, CSV import, polar/scatter charts, and **grid-aware bilinear interpolation** (IDW fallback) with confidence. | `util/interpolation` (`estimateSailSpeed`), `PolarPlotChart`, `ScatterChart`, `SailPolarImportDialog` · [README](../features/sailPolar/README.md) |
| **sailSuggestion**| Ranks a boat's sails for a given TWA/TWS and returns the top picks. Pure pipeline + a React hook.  | `util/suggestSails`, `evaluateSail`, `rankSails`, guards · [README](../features/sailSuggestion/README.md) |
| **sailTwaLimit** | The usable TWA band per sail per wind speed: CRUD, upsert/ensure, preview UI.                       | `api/upsertSailTwaLimits`, `ensureSailTwaLimits`, `TwaLimitsPreviewCard`       |
| **settings**     | User preferences and units (speed/area/distance, coord format, hemispheres, map zoom, chart type). | `context/SettingsContext` (`useSettings`), `model/settings`                    |

## How they depend on each other

- **plan** is the integrator: it pulls **coordinate** (bearing/TWA), **course**
  and **mark** (the geometry), **sailSuggestion** (the sail pick), and
  **settings** (units).
- **sailSuggestion** depends on **sailPolar** (interpolation),
  **sailTwaLimit** (limit scoring), **sail**, and **boatProfile** (scoping).
- **boatProfile** and **settings** are ambient providers consumed widely (see
  [architecture.md](architecture.md#provider--startup-chain)).
- **map** and **coordinate** are shared utilities used by **mark**, **course**,
  and **plan**.

## Which features have their own README

Slices with non-obvious internal logic carry a dedicated README (the rest are
straightforward CRUD and are covered by this catalogue + the code):

- [sailSuggestion](../features/sailSuggestion/README.md) — ranking pipeline
- [plan](../features/plan/README.md) — plan orchestration & wind store
- [coordinate](../features/coordinate/README.md) — bearing/TWA/format math
- [sailPolar](../features/sailPolar/README.md) — polar interpolation
