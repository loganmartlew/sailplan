# 11 — Connection UX: finding the plotter and staying on it

Type: grilling
Status: open
Blocked by: 02, 12
Note: unblocked — decide on the research below; validate later with `14`.
Map: [map.md](../map.md)

## Question

Everything else assumes a working socket. This ticket owns getting one, and
the specific ways Android makes that annoying.

1. **Endpoint configuration.** `01` confirms discovery exists: UDP multicast
   `239.2.1.1:2052` (JSON, 1 Hz) and Bonjour `_nmea-0183._tcp`, with TCP on
   port **10110**. Critically, the GoFree Tier 1 spec treats the port as
   *dynamic and announced* — 10110 is a default, not a guarantee — which argues
   for supporting discovery rather than only a typed-in address. `12` found
   **kplex's `gofree.c` implements exactly this discovery**, so there's a
   working reference to read rather than deriving it from the spec. Decide:
   typed address, discovery, or discovery with manual override.
2. **Remembering it.** Is the endpoint a setting (MMKV, like other prefs), a
   per-boat-profile value, or per-session? A boat's plotter address may not be
   stable across DHCP leases.
3. **The no-internet WiFi trap — largely answered, confirm and decide the UX.**
   `02` and `12` reached the same conclusion independently: pass
   **`interface: 'wifi'`** when connecting with `react-native-tcp-socket`. `12`
   read `TcpSocketModule.java` and confirmed it calls
   `ConnectivityManager.requestNetwork` with `TRANSPORT_WIFI` while
   deliberately **not** requesting `NET_CAPABILITY_INTERNET` — precisely what
   matches an unvalidated network. `13` step 5 verifies it on hardware.

   What's left is UX, not mechanism: what does the app show when the phone is
   on the right WiFi but traffic is still going elsewhere, and does it need to
   say anything about mobile data at all? Note `12`'s finding that a user who
   taps **"stay connected"** on Android's no-internet prompt permanently hides
   the behaviour — so your own phone may stop reproducing a bug that still
   affects a fresh install.
4. **Reconnection.** Founding decision 6 requires auto-reconnect. What's the
   backoff, when does the app give up, and how does it distinguish "plotter
   rebooted" from "phone left the boat"?
5. **Failure that's visible.** A connection that dies silently mid-race is the
   worst failure mode here. Does the foreground-service notification change
   state? Does the phone vibrate? Getting this wrong costs a whole race of
   data — and you won't get that race back.
6. **Testing without a boat.** `12` settles the simulation approach — use it.
   In particular, the no-internet trap in question 3 should be reproducible
   with a phone hotspot that has mobile data off, so this ticket should not
   need boat access at all.

## Answer

<!-- filled on resolution -->
