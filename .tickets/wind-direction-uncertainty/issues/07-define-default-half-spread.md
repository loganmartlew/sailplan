# Define the default half-spread on first enabling uncertainty

Type: grilling
Status: open
Blocked by:

## Question

Issue 03 settles the control — an on/off toggle plus a symmetric `± spread`
stepper in `5°` steps — and issue 02 fixes the valid domain at `0°–40°`. Issue
04 makes `twdSpread` a `PlanState` field retained transiently per boat profile.
What value does the stepper start at the first time a boat profile enables
uncertainty, before any retained value exists?

The choice is not cosmetic: issue 01 gates an alternate on a qualifying
interval of `max(5°, 20% of 2s)`, so a default that is too narrow makes the
feature appear to do nothing on first use, while one that is too wide surfaces
alternates a user has not asked to consider. It also interacts with whether
the default is a fixed constant or is derived from anything already known
about the boat profile or the entered TWD.
