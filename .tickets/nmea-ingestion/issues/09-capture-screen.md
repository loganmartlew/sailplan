# 09 — The capture screen: the in-race surface

Type: prototype
Status: open
Blocked by: 02
Map: [map.md](../map.md)

## Question

The one screen that has to work **on a heeling boat, one-handed, possibly wet,
possibly in the dark, while racing**. Everything else in this feature is used
sitting down afterwards.

Prototype what it looks like and how it behaves.

1. **Declaring the sail.** Founding decision 4's assertion — *"we're on the #3
   right now"* — is the only thing you're expected to do during a race, and it
   must be near-zero effort. How is it presented? A row of large sail buttons
   (sails already carry a `color`, which is a gift here)? A single button
   opening a picker? What confirms the tap landed, given you won't be looking
   closely?
2. **Wrong taps.** Can an assertion be undone in the moment, or is correcting
   it purely a review-time job?
3. **Start and stop.** How does a session begin — explicit start, or does
   connecting start it? What prevents an accidental stop mid-race? Does it need
   a name up front, or can that wait until review?
4. **Connection state.** Connected, connecting, dropped-and-retrying,
   dead — how is each shown, and how loudly? A silently dead connection that
   records nothing for an hour is the worst outcome this feature has.
5. **Confidence that it's working.** What single glance tells you data is
   genuinely arriving? Live TWS/TWA readout, a sample counter, a rolling
   sparkline — enough to trust it without watching it.
6. **The notification.** `02` confirms a foreground service is required — of
   type **`connectedDevice`** — so a persistent notification is
   non-negotiable, not a design choice. That makes it a real surface worth
   designing rather than an artefact to minimise.

   What does it say? And can the sail assertion be made **from the
   notification itself** via action buttons, which would mean never unlocking
   the phone at all? Worth prototyping seriously, because it may be a better
   answer to question 1 than anything on the screen — and because the
   notification is the only part of this feature guaranteed to be visible
   while recording. Note the practical limit of roughly three action buttons,
   which may not cover a full sail wardrobe.
7. **Screen off.** The expected state is pocketed with the screen off. What's
   the flow to check on it and get back out again quickly?

Deliver a rough, throwaway artifact to react to — layout sketches or a
non-functional RN screen. Do not build the real thing.

## Answer

<!-- filled on resolution -->
