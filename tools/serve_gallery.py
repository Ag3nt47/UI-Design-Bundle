"""Serve the repository's local visual catalog without third-party dependencies."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    address = ("127.0.0.1", 8099)
    print("UI gallery: http://127.0.0.1:8099/gallery/", flush=True)
    ThreadingHTTPServer(address, partial(SimpleHTTPRequestHandler, directory=str(root))).serve_forever()
