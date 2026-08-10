# Course detail + map-sheet — throwaway prototype

This standalone HTML prototype keeps **Course Detail** as the default read-only
route view. Its inline course map expands into a map sheet; editing is explicit
and transactional: **Edit saved Course → draft → Save Course / Cancel draft**.

From the repository root, run:

```sh
python3 -m http.server 8000 --directory .tickets/course-via-points/prototypes/course-detail-structure
```

Open <http://localhost:8000/?variant=thread>. The preserved shareable Course
Detail layouts are `?variant=thread`, `?variant=decks`, and `?variant=canvas`.
Use the scenario chips for no Via Points, a headland detour, a multi-point
channel, and overlapping Legs. The floating control or left/right arrows switch
layouts; arrows leave focused text fields alone.

Everything is in memory. This is prototype evidence only: it does not claim a
route is navigable or safe, and it neither decides nor implements production
behaviour.
