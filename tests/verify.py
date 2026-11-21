"""Run the full local verification suite without changing learner data."""
from argparse import ArgumentParser
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = ArgumentParser()
parser.add_argument('--channel', default='msedge' if sys.platform == 'win32' else 'chromium')
args = parser.parse_args()
env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
commands = [
    ['node', str(ROOT / 'tests/syntax-check.mjs')],
    ['node', '--test', *map(str, sorted((ROOT / 'tests').glob('*.test.mjs')))],
    *[[sys.executable, str(ROOT / 'tests' / name)] for name in ['server_check.py', 'build_check.py', 'portable_check.py']],
    *[[sys.executable, str(ROOT / 'tests' / name), '--channel', args.channel] for name in ['browser_check.py', 'visual_check.py', 'media_check.py']],
]
for command in commands:
    print('Running:', ' '.join(command), flush=True)
    subprocess.run(command, cwd=ROOT, env=env, check=True)
print('All verification checks passed.')
