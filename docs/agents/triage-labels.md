# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | --------------------- | ----------------------------------------- |
| `needs-triage`              | `needs-triage`         | Maintainer needs to evaluate this issue  |
| `needs-info`                | `needs-info`           | Waiting on reporter for more information |
| `ready-for-agent`           | `ready-for-agent`      | Fully specified, ready for an AFK agent  |
| `ready-for-human`           | `ready-for-human`      | Requires human implementation            |
| `wontfix`                   | `wontfix`              | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

This repo's local-markdown tracker records the label as a `Status:` line near the top of each issue file (see `issue-tracker.md`), using these same strings.

## Completion

The five roles above are triage states — they describe whether a ticket is
ready to be picked up, not whether it shipped. A build ticket that has been
implemented gets `Status: done`, and every checklist item in the ticket body
is checked off (`- [x]`) to match. `done` is not part of the triage vocabulary
and is never assigned by a skill doing triage — it is set by whoever finishes
the implementation.
