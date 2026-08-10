#!/usr/bin/env python3
"""Timestamped NMEA 0183 TCP capture — the field tool for ticket 04.

Usage:  python capture.py <ip> <port> <outfile>

Writes one line per sentence, prefixed with a millisecond epoch timestamp:

    1754812345.678 $WIMWV,045.0,T,12.3,N,A*1B

Reconnects automatically, so a dropout does not silently end the capture.
Connection events are written into the log as `###` marker lines, which
double as the session connection log that ticket 05 §5 wants.

Also serves as the independent fallback logger for ticket 21 (race day).
"""
import socket
import sys
import time


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__.strip())
        return 2

    host, port, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    n = 0
    print(f"capturing {host}:{port} -> {out}   (Ctrl-C to stop)")

    with open(out, "ab", buffering=0) as f:
        while True:
            try:
                f.write(f"### connecting {time.time():.3f}\n".encode())
                sock = socket.create_connection((host, port), timeout=10)
                f.write(f"### connected {time.time():.3f}\n".encode())
                print("\nconnected")
                buf = b""
                while True:
                    chunk = sock.recv(4096)
                    if not chunk:
                        raise ConnectionError("peer closed")
                    buf += chunk
                    while b"\n" in buf:
                        line, buf = buf.split(b"\n", 1)
                        line = line.rstrip(b"\r")
                        if not line:
                            continue
                        f.write(f"{time.time():.3f} ".encode() + line + b"\n")
                        n += 1
                        if n % 25 == 0:
                            print(f"\r{n} sentences", end="", flush=True)
            except KeyboardInterrupt:
                f.write(f"### stopped {time.time():.3f}\n".encode())
                print(f"\nstopped after {n} sentences -> {out}")
                return 0
            except Exception as exc:  # noqa: BLE001 — field tool, keep running
                f.write(f"### lost {time.time():.3f} {exc}\n".encode())
                print(f"\nlost ({exc}); retrying in 2s")
                time.sleep(2)


if __name__ == "__main__":
    sys.exit(main())
