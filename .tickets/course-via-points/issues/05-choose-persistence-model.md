# Choose the Course route-point persistence model

Type: grilling
Status: open
Blocked by: 01

## Question

What persistence model should represent ordered Course Marks and Via Points while enforcing their different roles, supporting either local coordinates or a live Mark reference, preserving multiple occurrences of the same Mark, and making Leg/Leg Segment queries and transactional route edits coherent?

Use the `codebase-design` vocabulary, inspect the existing Drizzle schema and Course APIs, and record the rejected alternatives and migration consequences. This decision should determine whether an ADR is warranted.
