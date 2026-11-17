import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=path=>readFileSync(join(root,path),'utf8');

test('offline cache includes every imported production module and the microphone worklet',()=>{
 const code=read('sw.js');
 for(const asset of readdirSync(join(root,'src')).filter(name=>name.endsWith('.js')).map(name=>`src/${name}`)){
  assert.ok(code.includes(`./${asset}`),`Missing offline precache: ${asset}`);
  assert.ok(existsSync(join(root,asset)),`Missing source file: ${asset}`);
 }
 assert.ok(code.includes("new URL(request.url).origin!==self.location.origin"));
});

test('offline activation leaves other applications caches alone',async()=>{
 const events={},deleted=[];
 const context=vm.createContext({self:{addEventListener:(name,callback)=>events[name]=callback,clients:{claim:async()=>{}}},caches:{keys:async()=>['unrelated-app','vocal-studio-personal-shell-v1'],delete:async name=>deleted.push(name)},Promise});
 vm.runInContext(read('sw.js'),context);
 let work;events.activate({waitUntil:promise=>{work=promise;}});await work;
 assert.deepEqual(deleted,['vocal-studio-personal-shell-v1']);
});

test('local launcher binds loopback only and refuses remote dependencies',()=>{
 const source=read('run.py');
 assert.ok(source.includes("('127.0.0.1',args.port)"));
 assert.ok(source.includes("connect-src 'self'"));
 assert.ok(!read('index.html').includes('https://'));
 assert.ok(!read('index.html').includes('http://'));
});
