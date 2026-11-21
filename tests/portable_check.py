"""Executable portable distribution smoke test; network stays on loopback."""
from pathlib import Path
from argparse import ArgumentParser
import socket, subprocess, sys, tempfile, time, urllib.request, zipfile
ROOT=Path(__file__).resolve().parents[1]
parser=ArgumentParser()
parser.add_argument('--artifact',type=Path)
args=parser.parse_args()
with tempfile.TemporaryDirectory() as directory:
    target=args.artifact.resolve() if args.artifact else Path(directory)/'VocalStudio.pyz'
    if not args.artifact:
        subprocess.run([sys.executable,str(ROOT/'build_portable.py'),str(target)],check=True,capture_output=True,text=True)
    assert target.is_file() and target.stat().st_size>5000
    with zipfile.ZipFile(target) as archive:
        expected = {'__main__.py', 'index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'assets/icon.svg',
                    *(asset.relative_to(ROOT).as_posix() for asset in ROOT.glob('src/*.js'))}
        assert len(archive.namelist()) == len(expected) and set(archive.namelist()) == expected, 'Portable asset inventory changed'
        for name in archive.namelist():
            if name!='__main__.py':
                assert archive.read(name)==(ROOT/name).read_bytes(),f'Portable asset does not match source: {name}'
    sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
    proc=subprocess.Popen([sys.executable,str(target),'--no-browser','--port',str(port)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/',timeout=1) as response:
                    html=response.read().decode();assert 'Vocal Studio' in html
                    assert "connect-src 'self'" in response.headers['Content-Security-Policy']
                break
            except Exception:
                time.sleep(.15)
        else:raise AssertionError('Portable archive did not start a local server')
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/src/advanced.js',timeout=3) as response:
            assert 'scoreMelodyPerformance' in response.read().decode()
        with socket.create_connection(('127.0.0.1',port),timeout=3) as connection:
            connection.sendall(b'HEAD / HTTP/1.0\r\nHost: localhost\r\n\r\n')
            response=b''
            while True:
                chunk=connection.recv(8192)
                if not chunk:break
                response+=chunk
            headers,body=response.split(b'\r\n\r\n',1)
            assert b'200 OK' in headers
            assert body==b'', 'HTTP HEAD must not return response body'
        try:urllib.request.urlopen(f'http://127.0.0.1:{port}/does-not-exist',timeout=3)
        except urllib.error.HTTPError as error:assert error.code==404
        else:raise AssertionError('Unknown archive paths should return 404')
        print('Portable ZIP application passed: startup, offline assets, CSP, unknown-path handling.')
    finally:
        proc.terminate()
        try:proc.wait(timeout=3)
        except subprocess.TimeoutExpired:proc.kill()
