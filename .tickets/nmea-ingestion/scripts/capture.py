# ~/capture.py — usage: python capture.py <ip> <port> <outfile>
import socket, sys, time

host, port, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
n = 0
with open(out, "ab", buffering=0) as f:
    while True:
        try:
            f.write(f"### connecting {time.time():.3f}\n".encode())
            s = socket.create_connection((host, port), timeout=10)
            f.write(f"### connected {time.time():.3f}\n".encode())
            buf = b""
            while True:
                chunk = s.recv(4096)
                if not chunk:
                    raise ConnectionError("peer closed")
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    f.write(f"{time.time():.3f} ".encode() + line.rstrip(b"\r") + b"\n")
                    n += 1
                    if n % 50 == 0:
                        print(f"\r{n} sentences", end="", flush=True)
        except KeyboardInterrupt:
            raise
        except Exception as e:
            f.write(f"### lost {time.time():.3f} {e}\n".encode())
            time.sleep(2)