"""Portable builds must be reproducible and match the selected source assets."""
from pathlib import Path
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as directory:
    work = Path(directory)
    source = work / 'source'
    shutil.copytree(ROOT, source, ignore=shutil.ignore_patterns('.git', '__pycache__', 'node_modules', '.venv'))
    outputs = [work / 'first.pyz', work / 'second.pyz']
    env = {**os.environ, 'SOURCE_DATE_EPOCH': '1704067200'}
    for index, output in enumerate(outputs):
        if index:
            for asset in source.glob('src/*.js'):
                os.utime(asset, (1800000000, 1800000000))
        subprocess.run([sys.executable, str(source / 'build_portable.py'), str(output)], check=True, env=env)
    assert outputs[0].read_bytes() == outputs[1].read_bytes(), 'Source timestamps changed the build'
    digest = hashlib.sha256(outputs[0].read_bytes()).hexdigest()
    assert outputs[0].with_suffix('.pyz.sha256').read_text().strip() == f'{digest}  first.pyz'
    with zipfile.ZipFile(outputs[0]) as archive:
        expected = {'__main__.py', 'index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'assets/icon.svg',
                    *(asset.relative_to(source).as_posix() for asset in source.glob('src/*.js'))}
        assert len(archive.namelist()) == len(expected) and set(archive.namelist()) == expected, 'Portable asset inventory changed'
        for name in archive.namelist():
            if name != '__main__.py':
                assert archive.read(name) == (source / name).read_bytes(), f'Stale asset: {name}'
    print('Build passed: byte-for-byte reproducibility, SHA-256 checksum, source asset parity.')
