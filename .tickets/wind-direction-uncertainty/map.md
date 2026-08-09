# Wind-direction uncertainty for leg guidance and sail selection

Label: wayfinder:map

## Destination

An implementation-ready product and technical specification for optional TWD
uncertainty: how it changes per-leg TWA/tack guidance and when uncertain wind
adds alternate course-leg sail suggestions.

## Notes

- This map plans the feature; it does not implement it.
- Use the `grilling` and `domain-modeling` skills for decision tickets and
  consult `CONTEXT.md`, `sailplan-app/features/plan/README.md`, and
  `sailplan-app/features/sailSuggestion/README.md`.
- TWD uncertainty is symmetric around a central, most-likely TWD and does not
  imply the timing of an oscillating shift.
- The uncertainty UI is opt-in. When disabled, its controls are hidden; its
  previous value is retained transiently per boat profile.
- Show central TWA plus the possible TWA range in both course and single-leg
  planning. Preserve today's boundary in which sail suggestions appear only
  on course legs.
- The central-TWD sail remains the primary suggestion. Add alternate sails
  when it becomes unusable or materially outperformed somewhere in the full
  possible range. Do not add a robustness indicator or course-wide summary.

## Decisions so far

## Not yet specified

- Exact input control, default spread, allowed spread, validation, and compact
  presentation while uncertainty is enabled.
- Exact course-leg card and suggestion-breakdown treatment for the central
  TWA, possible TWA range, possible tack change, and shift-dependent sails.
- How many alternate sails may be surfaced and how changeover conditions are
  explained without implying a probability distribution.
- Detailed test matrix, fixtures, and accuracy thresholds needed to trust the
  range-aware result.
- Final specification structure and handoff boundaries once the product and
  technical decisions have resolved.

## Out of scope

- Adding sail suggestions to single-leg planning. The capability is currently
  absent despite `sailplan-app/docs/routing.md` describing the route as showing
  a sail; track and implement it as a separate feature.
- A timed oscillation model, shift forecasting, or probabilities for wind
  directions within the range.
- TWS uncertainty, persisted forecasts/history, and a course-wide sail-change
  summary.
- Implementing the feature as part of this planning effort.
