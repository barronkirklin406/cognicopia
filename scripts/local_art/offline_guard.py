"""
Cognicopia local art agent: the offline guard, shared by every Python piece.

Imported first, before any other library. From then on every network
connection is refused except one to this computer itself (127.0.0.1, ::1, or
a local socket file), name lookups for any other host are refused, and the
Hugging Face libraries are told they are offline. A prompt, a description or a
picture has nowhere to go but this computer. Standard library only.
"""
import os
import socket

LOCAL_NAMES = {"localhost", "127.0.0.1", "::1", "0:0:0:0:0:0:0:1"}
OFFLINE_ENV = ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_DATASETS_OFFLINE", "HF_HUB_DISABLE_TELEMETRY", "DO_NOT_TRACK", "DISABLE_TELEMETRY")


def is_local(host):
    if host is None:
        return True
    host = str(host).strip("[]").lower()
    return host in LOCAL_NAMES or host.startswith("127.")


def _refuse(what):
    raise OSError("Cognicopia offline guard: a network connection to %s was refused. The local art agent never uses the network." % (what,))


def install_guard():
    """Refuse every network connection except to this computer. Safe to call more than once."""
    for name in OFFLINE_ENV:
        os.environ[name] = "1"
    if getattr(socket, "_cognicopia_guard", False):
        return
    real_connect, real_connect_ex, real_sendto = socket.socket.connect, socket.socket.connect_ex, socket.socket.sendto
    real_getaddrinfo, real_create = socket.getaddrinfo, socket.create_connection

    def host_of(sock, address):
        if getattr(socket, "AF_UNIX", None) is not None and sock.family == socket.AF_UNIX:
            return None                                   # a local socket file
        return address[0] if isinstance(address, tuple) else address

    def connect(self, address):
        if is_local(host_of(self, address)):
            return real_connect(self, address)
        _refuse(address)

    def connect_ex(self, address):
        if is_local(host_of(self, address)):
            return real_connect_ex(self, address)
        _refuse(address)

    def sendto(self, data, *rest):
        address = rest[-1] if rest else None
        if address is None or is_local(host_of(self, address)):
            return real_sendto(self, data, *rest)
        _refuse(address)

    def getaddrinfo(host, *a, **k):
        if is_local(host):
            return real_getaddrinfo(host, *a, **k)
        raise socket.gaierror("Cognicopia offline guard: looking up %s was refused. The local art agent never uses the network." % (host,))

    def create_connection(address, *a, **k):
        if is_local(address[0] if isinstance(address, tuple) else address):
            return real_create(address, *a, **k)
        _refuse(address)

    socket.socket.connect, socket.socket.connect_ex, socket.socket.sendto = connect, connect_ex, sendto
    socket.getaddrinfo, socket.create_connection = getaddrinfo, create_connection
    socket._cognicopia_guard = True


def selftest():
    """Prove the guard: outside addresses and names are refused, this computer is allowed. Returns a dict with "ok"."""
    install_guard()
    results = {}
    for label, call in (("outside address", lambda: socket.create_connection(("192.0.2.10", 443), timeout=2)),
                        ("outside name", lambda: socket.getaddrinfo("huggingface.co", 443)),
                        ("raw socket", lambda: socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("198.51.100.7", 80))),
                        ("udp", lambda: socket.socket(socket.AF_INET, socket.SOCK_DGRAM).sendto(b"x", ("203.0.113.5", 53)))):
        try:
            call()
            results[label] = "ALLOWED"
        except OSError as e:
            results[label] = "refused" if "offline guard" in str(e) else "error: " + str(e)
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    try:
        c = socket.create_connection(("127.0.0.1", srv.getsockname()[1]), timeout=2)
        c.close()
        results["this computer"] = "allowed"
    except OSError as e:
        results["this computer"] = "error: " + str(e)
    finally:
        srv.close()
    results["ok"] = all(results[k] == "refused" for k in ("outside address", "outside name", "raw socket", "udp")) and results["this computer"] == "allowed"
    return results
