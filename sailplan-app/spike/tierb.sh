#!/usr/bin/env bash
# Tier B walk — ticket 13. Forces the OS states a 3-hour run would wait for.
set -u
PKG=com.loganmartlew.sailplan.dev

probe() { # probe <label>
  echo "===== $(date -u +%H:%M:%S) PROBE $1 ====="
  adb shell dumpsys activity processes 2>/dev/null \
    | grep -E "Proc #|$PKG" | grep -B0 -A0 "$PKG" | head -6
  echo "--- oom_adj ---"
  pid=$(adb shell pidof $PKG | tr -d '\r')
  [ -n "$pid" ] && adb shell cat /proc/$pid/oom_score_adj 2>/dev/null | tr -d '\r' || echo "NO PROCESS"
  echo "--- frozen? ---"
  [ -n "$pid" ] && adb shell cat /proc/$pid/cgroup 2>/dev/null | tr -d '\r' | head -3
  [ -n "$pid" ] && adb shell "cat /sys/fs/cgroup/uid_*/pid_$pid/cgroup.freeze 2>/dev/null" | tr -d '\r'
  echo "--- fgs ---"
  adb shell dumpsys activity services $PKG 2>/dev/null | grep -cE "isForeground=true"
  echo "--- standby bucket / idle ---"
  adb shell am get-standby-bucket $PKG | tr -d '\r'
  adb shell dumpsys deviceidle get deep | tr -d '\r'
  echo "--- socket ---"
  adb shell "cat /proc/net/tcp6 /proc/net/tcp 2>/dev/null | grep -c ':277E'" | tr -d '\r'
  echo
}

echo "##### PHASE 0 baseline, screen on, foreground app"
probe phase0

echo "##### PHASE 1 battery unplugged + screen off"
adb shell dumpsys battery unplug
adb shell input keyevent 26
sleep 90
probe phase1-90s

echo "##### PHASE 2 deep Doze forced"
adb shell dumpsys deviceidle enable deep
adb shell dumpsys deviceidle force-idle
sleep 5
adb shell dumpsys deviceidle get deep
sleep 180
probe phase2-185s

echo "##### PHASE 3 standby bucket restricted + off battery-optimisation whitelist"
adb shell cmd deviceidle whitelist -$PKG
adb shell am set-standby-bucket $PKG restricted
sleep 180
probe phase3-180s

echo "##### PHASE 4 wake up"
adb shell dumpsys deviceidle unforce
adb shell dumpsys battery reset
adb shell input keyevent 26
sleep 5
adb shell input keyevent 82
sleep 10
probe phase4
echo "##### DONE $(date -u +%H:%M:%S)"
