# Plan results Via Points prototype

Throwaway, standalone browser prototype for the Wayfinder ticket **Prototype Via Points in Course Plan results**.

Run from this directory:

```sh
python3 -m http.server 8000
```

Then open [http://localhost:8000/index.html?variant=segments](http://localhost:8000/index.html?variant=segments).

Variants are URL-stable and keyboard-switchable (left/right arrows):

- `?variant=segments` — every Leg Segment is a top-level guidance card.
- `?variant=legs` — Leg Segments are grouped as lighter timeline rows under Course Mark-to-Mark Legs.
- `?variant=route` — a route journal focuses guidance on one active segment.

Use **Plan map** to inspect the read-only Plan route, then **Edit saved course** and save the simulated Via Point insertion to see the recalculation return state. No production data is changed or persisted.
