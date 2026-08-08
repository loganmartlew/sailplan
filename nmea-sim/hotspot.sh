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

set -euo pipefail

SSID="${SSID:-ZeusSim}"
PASSWORD="${PASSWORD:-sailplan123}"
PORT="${PORT:-10110}"
CON_NAME="Hotspot"
NFT_TABLE="nmeasim"

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "hotspot.sh: needs root — re-run with sudo" >&2
    exit 1
  fi
}

wifi_device() {
  nmcli -t -f DEVICE,TYPE device | awk -F: '$2=="wifi"{print $1; exit}'
}

cmd_up() {
  need_root
  local dev
  dev="$(wifi_device)"
  [ -n "$dev" ] || { echo "hotspot.sh: no wifi device found" >&2; exit 1; }

  echo "bringing up '$SSID' on $dev …"
  nmcli device wifi hotspot ifname "$dev" ssid "$SSID" password "$PASSWORD"

  # NetworkManager's shared mode runs dnsmasq and hands the box 10.42.0.1/24.
  # There is deliberately no upstream route: that absence IS the test.
  sleep 1
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
EOF
}

cmd_down() {
  need_root
  cmd_restore || true
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
