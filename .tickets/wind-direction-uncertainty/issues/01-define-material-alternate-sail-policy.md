# Define when uncertain wind warrants an alternate sail

Type: grilling
Status: resolved

## Question

What precise product rule should add a range-dependent alternate sail while
keeping the central-TWD sail primary—including TWA-limit violations, the
material predicted-speed threshold, the amount of the range over which an
advantage must persist, low-confidence or missing polar data, fallback cases,
and competition among more than one alternate?

## Answer

At the central, most-likely TWD, the highest-ranked finite sail remains the
**primary sail**. Existing runners-up at that TWD are not uncertainty
alternates. A different sail is a **range-dependent alternate** only when it
becomes the highest-ranked eligible sail throughout a qualifying interval on
the lower-TWD or higher-TWD side of the possible range and independently
satisfies one of these triggers throughout that interval:

1. **Configured-limit trigger:** the primary is outside its applicable TWA
   limits while the candidate is inside its own applicable TWA limits. Both
   sails must have limits at the evaluated TWS; missing limits mean unknown,
   not inside.
2. **Predicted-speed trigger:** the candidate's predicted speed is at least
   10% greater than the primary's. Both estimates must meet the configured
   moderate-confidence threshold or better, and a candidate with configured
   limits must be inside them. Missing or low-confidence polar evidence cannot
   establish this trigger.

The candidate must remain the local ranking winner as TWA, wind zone, limit
score, and guards are reevaluated along the interval. Thus raw speed alone
cannot surface a sail that the normal engine would reject in favour of another
sail.

For a validated TWD uncertainty half-spread `s`, the full possible TWD range
has width `2s`. A qualifying interval on either side must be contiguous and
have width at least:

```text
max(5 degrees, 20% of 2s)
```

One trigger must meet that persistence threshold by itself. Adjacent
limit-based and speed-based intervals cannot be joined. Consequently, when a
side of the possible range is narrower than 5 degrees, that side cannot
produce an alternate.

Surface at most one **lower-TWD alternate** and one **higher-TWD alternate**.
These sides refer to TWD, not TWA. If the same sail wins both sides, return it
once with both qualifying regions. When several sails qualify on one side,
choose in this order:

1. configured-limit qualification before speed-only qualification;
2. wider continuous qualifying interval;
3. larger qualifying speed advantage;
4. better central-TWD rank as the deterministic final tie-breaker.

A finite central `best available`/fallback leader remains the primary and can
receive alternates under the same rules. The speed trigger still requires
moderate-confidence evidence. If the central evaluation has no finite leader,
return neither a primary nor uncertainty alternates; uncertainty does not
manufacture a recommendation from missing evidence.
