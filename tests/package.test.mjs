import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=path=>readFileSync(join(root,path),'utf8');

test('offline cache includes every imported production module and the microphone worklet',()=>{
 const code=read('sw.js');
 for(const asset of ['src/app.js','src/catalog.js','src/base-catalog.js','src/music.js','src/learning.js','src/store.js','src/audio.js','src/diagnostics.js','src/advanced.js','src/advanced-catalog.js','src/microphone-worklet.js']){
  assert.ok(code.includes(`./${asset}`),`Missing offline precache: ${asset}`);
  assert.ok(existsSync(join(root,asset)),`Missing source file: ${asset}`);
 }
 assert.ok(code.includes("new URL(request.url).origin!==self.location.origin"));
});

test('local launcher binds loopback only and refuses remote dependencies',()=>{
 const source=read('run.py');
 assert.ok(source.includes("('127.0.0.1',args.port)"));
 assert.ok(source.includes("connect-src 'self'"));
 assert.ok(!read('index.html').includes('https://'));
 assert.ok(!read('index.html').includes('http://'));
});
