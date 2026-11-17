"""Build a self-contained, dependency-free Python zipapp for Vocal Studio.

The resulting VocalStudio.pyz runs a private loopback HTTP server directly from
its own archive; no extraction, npm installation, or backend is required.
"""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
from datetime import datetime, timezone
import argparse
import hashlib
import os

ROOT = Path(__file__).resolve().parent
FILES = [
    'index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'assets/icon.svg',
    *[str(f.relative_to(ROOT)).replace('\\', '/') for f in sorted((ROOT / 'src').glob('*.js'))]
]

BOOTSTRAP = r'''"""Entrypoint for the offline Vocal Studio portable archive."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import mimetypes
import sys
import threading
from urllib.parse import unquote, urlsplit
import webbrowser
from zipfile import ZipFile

ASSETS = set(%s)
CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

class Handler(BaseHTTPRequestHandler):
    def _serve(self, send_body=True):
        raw = unquote(urlsplit(self.path).path)
        path = 'index.html' if raw in ('', '/') else raw.lstrip('/')
        if path not in ASSETS:
            self.send_error(404, 'Not part of Vocal Studio')
            return
        with ZipFile(sys.argv[0], 'r') as archive:
            payload = archive.read(path)
        media_type = {
            '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
            '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
        }.get('.' + path.rsplit('.', 1)[-1], 'application/octet-stream')
        self.send_response(200)
        self.send_header('Content-Type', media_type + '; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        if send_body:
            self.wfile.write(payload)

    def do_GET(self):
        self._serve(True)

    def do_HEAD(self):
        self._serve(False)

    def log_message(self, format, *args):
        print('Vocal Studio:', format %% args)


def main():
    parser = argparse.ArgumentParser(description='Vocal Studio portable offline application')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError as error:
        parser.error('Cannot start local server: ' + str(error))
    url = 'http://127.0.0.1:%%d/' %% server.server_port
    print('Vocal Studio is running privately at ' + url, flush=True)
    print('Keep this terminal open while learning; Ctrl+C stops it.', flush=True)
    if not args.no_browser:
        threading.Timer(.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Stopping Vocal Studio.', flush=True)
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
''' % repr(FILES)


def main():
    parser = argparse.ArgumentParser(description='Bundle Vocal Studio as a self-contained Python archive.')
    parser.add_argument('output', nargs='?', default=str(ROOT / 'VocalStudio.pyz'))
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        epoch = int(os.environ.get('SOURCE_DATE_EPOCH', '1704067200'))
        timestamp = datetime.fromtimestamp(epoch, timezone.utc)
        if not 1980 <= timestamp.year <= 2107:
            raise ValueError('ZIP timestamps require years 1980–2107')
    except (ValueError, OverflowError, OSError) as error:
        parser.error(f'Invalid SOURCE_DATE_EPOCH: {error}')
    with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name in ['__main__.py', *sorted(FILES)]:
            info = ZipInfo(name, timestamp.timetuple()[:6])
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = ZIP_DEFLATED
            content = BOOTSTRAP.encode('utf-8') if name == '__main__.py' else (ROOT / name).read_bytes()
            archive.writestr(info, content, compresslevel=9)
    checksum = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + '.sha256').write_text(f'{checksum}  {output.name}\n', encoding='utf-8')
    print(f'Created {output} ({output.stat().st_size:,} bytes, {len(FILES)} app assets)')

if __name__ == '__main__':
    main()
