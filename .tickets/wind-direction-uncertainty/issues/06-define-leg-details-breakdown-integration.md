# Define how alternates and the existing suggestion breakdown coexist

Type: grilling
Status: open
Blocked by: 03

## Question

On the leg-details screen, the accepted design (issue 03) adds a TWA band and
one case card per shift scenario above `SuggestionBreakdown`, which still ranks
every evaluated sail at the central TWA only and hides its raw breakdown behind
a `Details` toggle. Should the case cards sit above an untouched breakdown,
replace its head with the ranked list demoted behind `Details`, or dissolve
into `SailEvaluationCard` as a per-sail "wins from 130°–145°" annotation — and
what does the chosen shape require of the per-sail evaluation data?
