#!/usr/bin/env bash
#
# The rig that turns this Fedora box into the plotter's WiFi access point.
#
# The Zeus 3 runs as an access point with no internet behind it (ticket `01`).
# Android *validates* every network it joins, finds no internet, and — if the
# phone has working mobile data — quietly keeps routing through mobile, so the
# app's socket to 10.42.0.1 never connects. Ticket `02` established the fix
# (`interface: 'wifi'` on the socket); this script is how you reproduce the bug
# before writing the fix, and how you prove the fix works afterwards.
#
# Two conditions for the reproduction to be faithful (research/12, Q5):
#   1. the test phone must have WORKING MOBILE DATA — without it Android has
#      nowhere else to route and the bug hides
#   2. the phone must NOT have tapped "stay connected" on the no-internet
#      prompt for this SSID — that choice is sticky. Forget the network to
#      reset it.
#
# Needs sudo (nmcli, nft). Run it yourself; it is not something an agent can
# do for you.
#
#   sudo ./hotspot.sh up          # bring the AP up, print the address
#   sudo ./hotspot.sh status
#   sudo ./hotspot.sh blackhole   # peer vanishes: packets dropped, no RST
#   sudo ./hotspot.sh restore
#   sudo ./hotspot.sh down
#
# NetworkManager's hotspot mode is `ipv4.method=shared`, which NATs clients
# out through whatever default route this box has — so out of the box the
# phone gets working internet over the AP and the trap above CANNOT be
# reproduced. `up` therefore isolates the AP by default (see `isolate_on`).
# `SHARED=1 sudo ./hotspot.sh up` opts back into a normal, internet-bearing
# hotspot, which is only useful for sanity-checking the AP itself.

set -euo pipefail

SSID="${SSID:-ZeusSim}"
PASSWORD="${PASSWORD:-sailplan123}"
PORT="${PORT:-10110}"
CON_NAME="Hotspot"
NFT_TABLE="nmeasim"
ISO_TABLE="nmeasim_iso"
SHARED="${SHARED:-0}"

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "hotspot.sh: needs root — re-run with sudo" >&2
    exit 1
  fi
}

wifi_device() {
  nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="wifi"{print $1; exit}'
}

# The Zeus 3 is an access point with nothing behind it. NetworkManager's shared
# mode is the opposite — it masquerades clients out through the box's default
# route — so the absence of internet has to be manufactured, and it IS the test:
# without it Android validates the network, keeps it as the default route, and
# the `interface: 'wifi'` bug hides.
#
# Forwarding is what carries the captive-portal probe, so dropping it is the
# decisive rule. DNS to the box's own dnsmasq goes too, so the phone sees a
# plain "no internet" rather than suspecting a captive portal. DHCP (port 67)
# is deliberately left alone — the phone still needs an address.
isolate_on() {
  local dev="$1"
  nft list table inet "$ISO_TABLE" >/dev/null 2>&1 && return
  nft add table inet "$ISO_TABLE"
  nft add chain inet "$ISO_TABLE" iso_fwd "{ type filter hook forward priority -10; }"
  nft add rule inet "$ISO_TABLE" iso_fwd iifname "$dev" drop
  nft add rule inet "$ISO_TABLE" iso_fwd oifname "$dev" drop
  nft add chain inet "$ISO_TABLE" in "{ type filter hook input priority -10; }"
  nft add rule inet "$ISO_TABLE" in iifname "$dev" udp dport 53 drop
  nft add rule inet "$ISO_TABLE" in iifname "$dev" tcp dport 53 drop
}

isolate_off() {
  if nft list table inet "$ISO_TABLE" >/dev/null 2>&1; then
    nft delete table inet "$ISO_TABLE"
  fi
  return 0
}

cmd_up() {
  need_root
  local dev
  dev="$(wifi_device)"
  [ -n "$dev" ] || { echo "hotspot.sh: no wifi device found" >&2; exit 1; }

  echo "bringing up '$SSID' on $dev …"
  nmcli device wifi hotspot ifname "$dev" ssid "$SSID" password "$PASSWORD"

  # NetworkManager's shared mode runs dnsmasq and hands the box 10.42.0.1/24.
  sleep 1
  if [ "$SHARED" = "1" ]; then
    isolate_off
    echo "  ⚠ SHARED=1 — clients WILL have internet. The item-5 trap cannot"
    echo "    reproduce in this mode."
  else
    isolate_on "$dev"
  fi
  cmd_status
  cat <<EOF

  SSID      $SSID
  password  $PASSWORD

  On the phone: join '$SSID', DISMISS the "no internet" prompt (do not tap
  "stay connected"), leave mobile data ON, then point the app at:

      10.42.0.1:$PORT

  Then, on this box:

      node nmea-sim.js sail --script scripts/nasty.json

  If the app cannot connect while a laptop on the same SSID can, you have
  reproduced the trap — and \`interface: 'wifi'\` is the fix to test.

  Ticket \`13\`'s spike screen is reachable over adb (USB works while the
  phone is on this AP — adb is not routed over WiFi):

      adb shell am start -a android.intent.action.VIEW -d "sailplan://spike"
EOF
}

cmd_down() {
  need_root
  cmd_restore || true
  isolate_off || true
  nmcli connection down "$CON_NAME" 2>/dev/null || echo "hotspot was not up"
  echo "hotspot down"
}

cmd_status() {
  local dev ip
  dev="$(wifi_device)"
  ip="$(ip -4 -o addr show "$dev" 2>/dev/null | awk '{print $4}' || true)"
  echo "  device    ${dev:-none}"
  echo "  address   ${ip:-none}"
  echo "  clients   $(grep -c . /var/lib/NetworkManager/dnsmasq-"$dev".leases 2>/dev/null || echo 0)"
  if [ "$(id -u)" -ne 0 ]; then
    echo "  internet  unknown — nft needs root; re-run with sudo"
  elif nft list table inet "$ISO_TABLE" >/dev/null 2>&1; then
    echo "  internet  ISOLATED (no forwarding, no DNS — as the boat is)"
  else
    echo "  internet  SHARED — clients can reach the internet"
  fi
  if nft list table inet "$NFT_TABLE" >/dev/null 2>&1; then
    echo "  port $PORT  BLACK-HOLED"
  else
    echo "  port $PORT  open"
  fi
}

# A true black hole, distinct from the `silence` fault in a script: there, TCP
# is healthy and only the data stops. Here the packets vanish with no RST and
# no FIN, so the phone notices only after TCP retransmit timeout — minutes —
# or after an app-level heartbeat. This is what "the phone left the boat"
# actually looks like, and it is the failure that silently costs a race.
cmd_blackhole() {
  need_root
  nft list table inet "$NFT_TABLE" >/dev/null 2>&1 && { echo "already black-holed"; return; }
  nft add table inet "$NFT_TABLE"
  nft add chain inet "$NFT_TABLE" out '{ type filter hook output priority 0; }'
  nft add chain inet "$NFT_TABLE" in '{ type filter hook input priority 0; }'
  nft add rule inet "$NFT_TABLE" out tcp sport "$PORT" drop
  nft add rule inet "$NFT_TABLE" in tcp dport "$PORT" drop
  echo "port $PORT black-holed — packets dropped silently, no RST."
  echo "the app should NOT notice for a long time. That is the point."
}

cmd_restore() {
  need_root
  if nft list table inet "$NFT_TABLE" >/dev/null 2>&1; then
    nft delete table inet "$NFT_TABLE"
    echo "port $PORT restored"
  else
    echo "nothing to restore"
  fi
}

case "${1:-status}" in
  up) cmd_up ;;
  down) cmd_down ;;
  status) cmd_status ;;
  blackhole) cmd_blackhole ;;
  restore) cmd_restore ;;
  *)
    echo "usage: sudo ./hotspot.sh {up|down|status|blackhole|restore}" >&2
    exit 1
    ;;
esac
