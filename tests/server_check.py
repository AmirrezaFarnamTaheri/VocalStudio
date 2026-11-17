"""Local source launcher must serve only application assets, not arbitrary project files."""
from pathlib import Path
from contextlib import closing
import socket, subprocess, sys, time, urllib.request, urllib.error

ROOT=Path(__file__).resolve().parents[1]
with closing(socket.socket()) as sock:
    sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
proc=subprocess.Popen([sys.executable,str(ROOT/'run.py'),'--no-browser','--port',str(port)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(45):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/',timeout=.8) as r:
                assert 'Vocal Studio' in r.read().decode()
                break
        except Exception:time.sleep(.1)
    else:raise AssertionError('Local launcher did not start')
    for path in ('/src/app.js','/styles.css','/src/microphone-worklet.js'):
        with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}',timeout=3) as r:assert r.status==200
    for path in ('/run.py','/README.md','/tests/learning.test.mjs','/../../run.py','/backup.json'):
        try:urllib.request.urlopen(f'http://127.0.0.1:{port}{path}',timeout=3)
        except urllib.error.HTTPError as e:assert e.code==404,(path,e.code)
        else:raise AssertionError(f'Private or non-app file exposed: {path}')
    print('Local server asset allowlist passed.')
finally:
    proc.terminate()
    proc.wait(timeout=3)
