# UI System

SailPlan styles with **NativeWind** (Tailwind for React Native) and builds on
**shadcn-style primitives** wrapping `@rn-primitives/*`. Two shared kits plus an
icon registry cover most UI needs.

## Styling: NativeWind + Tailwind

- Style with `className` Tailwind strings, exactly like web Tailwind. NativeWind
  compiles them to RN styles (wired via `babel.config.js` + `metro.config.js`,
  input `global.css`).
- Merge/condition classes with **`cn()`** from [`~/lib/utils`](../lib/utils.ts)
  (`clsx` + `tailwind-merge`):
  ```tsx
  <View className={cn('flex gap-4', isActive && 'bg-primary')} />
  ```
- Design tokens (colors, radii) are defined in
  [`tailwind.config.js`](../tailwind.config.js) as CSS variables and consumed as
  semantic classes: `bg-background`, `text-foreground`, `text-primary`,
  `bg-accent`, `text-muted-foreground`, `border-input`, etc. Prefer these tokens
  over literal colors so light/dark theming works.

## Theming (light/dark)

- Navigation theme objects live in [`lib/constants.ts`](../lib/constants.ts)
  (`LIGHT_THEME` / `DARK_THEME`, colors in `NAV_THEME`).
- The active scheme comes from `useColorScheme()`
  ([`lib/useColorScheme.ts`](../lib/useColorScheme.ts)), a thin wrapper over
  NativeWind's color scheme. `AppProviders` feeds it to `ThemeProvider` and the
  `StatusBar`.
- The chosen scheme is **persisted to AsyncStorage** under the key `theme`.
  `hooks/useAppTheme.ts` hydrates it at startup and the root layout waits for
  `isColorSchemeLoaded` before rendering (it also drives the splash screen). Note
  this is separate from the MMKV-backed `settings.*` preferences; the appearance
  screen toggles it via `setColorScheme`.

## `components/ui` — primitives

shadcn-style building blocks over `@rn-primitives`, exported from
[`~/components/ui`](../components/ui/index.ts): `Button`, `Text`, `Input`,
`Label`, `Select`, `Dialog`, `Toggle`, `ToggleGroup`, `Badge`, `Card`,
`Separator`, `ColorPicker`, `StepperInput`, plus `typography`.

Variants use `class-variance-authority`. `Button`, for example:

| Prop      | Values                                                                    | Default   |
| --------- | ------------------------------------------------------------------------- | --------- |
| `variant` | `default` `destructive` `outline` `secondary` `transparent` `ghost` `link`| `default` |
| `size`    | `default` `sm` `lg` `icon`                                                 | `default` |

```tsx
import { Button, Text } from '~/components/ui';
<Button variant="outline" size="sm" onPress={onPress}><Text>Label</Text></Button>
```

Note `Button` sets a `TextClassContext`, so its `<Text>` child is styled to match
the variant automatically — always put a `<Text>` inside a `Button`, don't pass a
raw string.

## `components/form` — form inputs

Typed inputs that wire `@rn-primitives`/`ui` into `react-hook-form`, exported
from [`~/components/form`](../components/form/index.ts): `TextInput`,
`NumberInput`, `StepperNumberInput`, `SelectInput`, `ToggleGroup`,
`ColorPickerInput`, `DisplayField`, and the shared `FormControlWrapper`.

- Each input is **generic over the form value type** and reads RHF context (they
  call `useFormContext`), so use them inside a `useForm` `Form`:
  ```tsx
  <TextInput<Values> name="name" label="Name" placeholder="Name" required />
  ```
- `name` is a typed `Path<Values>`; `FormControlWrapper` renders the label and
  validation error.
- For inputs not covered here, drop to `Controller` directly (see
  [`PlanCourse.tsx`](../features/plan/components/PlanCourse.tsx)).

See [conventions.md](conventions.md#forms) for the full form pattern.

## Icons

Icons are **Lucide** icons re-exported one-per-file from
[`~/lib/icons`](../lib/icons/index.tsx) so `className` (and thus theme colors)
works on them via NativeWind's `cssInterop`.

To add an icon, create `lib/icons/<Name>.tsx` mirroring the existing ones and add
it to `lib/icons/index.tsx`:

```tsx
// lib/icons/Wind.tsx
import { Wind } from 'lucide-react-native';
import { iconWithClassName } from './iconWithClassName';
iconWithClassName(Wind);
export { Wind };
```

Then use it: `import { Wind } from '~/lib/icons'` and style with
`className="text-primary"` or pass `color`/`size` props.

## Charts & maps

- **Charts** use `victory-native` + `@shopify/react-native-skia`. Polar data
  renders as either a radial `PolarPlotChart` or a `ScatterChart`
  (`polarChartType` setting) — see [`features/sailPolar`](../features/sailPolar/README.md).
- **Maps** use `react-native-maps` (Google Maps; API key in `app.config.js`).
  Reusable pieces live in the [`map` feature](features.md) (`MapMarker`,
  `SelectLocationDialog`).

## Portals & overlays

`AppProviders` mounts a `@rn-primitives` `PortalHost`, so dialogs, selects, and
other overlays render above the app. Use the `Dialog` primitive from
`components/ui` for modals.

## Helper text

Muted explanatory copy under a control is the easiest thing to add and the
hardest to notice accumulating. The test is **conditional vs. unconditional**:

- **Conditional text earns its place.** It appears because something is wrong,
  absent, or about to be destroyed: an edit that will silently contribute
  nothing (`SailSpanEditor`'s too-short-for-a-bin warning), an empty screen whose
  emptiness is baffling (`CaptureSessionReview`'s "no point of sail lasted for
  the three-minute minimum"), a claim about data validity invisible in the data
  itself (the ground-wind warning), a confirm dialogue naming what is lost. The
  sailor could not have worked these out by looking at the widget.
- **Unconditional text describing how a control works usually does not.** If it
  sits permanently under a control explaining what dragging its handle does, or
  narrates what a button will do before it is pressed, either the widget is
  already saying it or the widget should be redrawn until it does.

Corollaries:

- **Say it once, in one vocabulary.** If a fact already shows as a badge on a
  list row and a count in a heading, a third telling on the detail screen is
  noise — and re-wording it there ("Saved" for what elsewhere is "Edited") makes
  it read as a *different* fact.
- **Instructions belong where someone is stuck**, not ahead of time. Explain the
  bins-to-points ratio in the promotion empty state, where the sailor is asking
  why they got nothing — not permanently on the list screen, where they aren't
  asking yet.
- **Don't reassure against fears the app doesn't create.** Edits that save on
  leaving need no "your changes are saved"; nothing in the app deletes samples,
  so nothing needs to promise it won't.
- **Accessibility labels are not helper text.** Prefer putting the "drag the
  handle to move a divider" phrasing on `accessibilityLabel`, where it serves
  someone who cannot see the handle, over duplicating it in visible copy for
  someone who can.
