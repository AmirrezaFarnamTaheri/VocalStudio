"""Run the offline Vocal Studio browser interface on loopback only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
import argparse
from urllib.parse import unquote, urlsplit
from build_portable import FILES
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent
ALLOWED_ASSETS = set(FILES)

class LocalHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _is_asset(self):
        raw = unquote(urlsplit(self.path).path)
        name = 'index.html' if raw in ('', '/') else raw.lstrip('/')
        return name in ALLOWED_ASSETS

    def do_GET(self):
        if not self._is_asset():
            self.send_error(404, 'Not part of Vocal Studio')
            return
        super().do_GET()

    def do_HEAD(self):
        if not self._is_asset():
            self.send_error(404, 'Not part of Vocal Studio')
            return
        super().do_HEAD()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("Local app:", fmt % args)


def main():
    parser=argparse.ArgumentParser(description="Start Vocal Studio locally without cloud or npm.")
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),LocalHandler)
    url=f'http://127.0.0.1:{server.server_port}/'
    print('Vocal Studio is running locally at',url)
    print('No internet connection or cloud services are used. Press Ctrl+C to stop.')
    if not args.no_browser:threading.Timer(.4,lambda:webbrowser.open(url)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:print('\nStopping Vocal Studio.')
    finally:server.server_close()

if __name__=='__main__':main()
