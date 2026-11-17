import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as learning from '../src/learning.js';
import {createInitialState, updatePreferences} from '../src/learning.js';
import * as music from '../src/music.js';
import * as catalog from '../src/catalog.js';
import {createPortableBackup, shouldReplaceRecordings, checkLocalStorage} from '../src/store.js';

function appHarness(save,extras={}){
 const code=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*?;\s*$/gm,'').split("document.addEventListener('click',handleClick);")[0];
 const elements={app:{innerHTML:''},toast:{textContent:'',className:''}};
 const document={documentElement:{dataset:{}},getElementById:id=>elements[id]||null,querySelector(){return null},querySelectorAll(){return []}};
 const context=vm.createContext({...learning,...music,...catalog,document,console,setTimeout,clearTimeout,setInterval,clearInterval,updatePreferences,
  createInitialState,saveStudioState:save,window:{scrollTo(){}},navigator:{},performance:{now:()=>10000},
  audio:{tone(){},melody(){},click(){},stopTones(){},stopMic(){},sample(){return {hz:0,confidence:0}}},...extras});
 vm.runInContext(code,context);
 return {eval:code=>vm.runInContext(code,context)};
}

test('rapid independent preferences changes serialize and both survive local save',async()=>{
 const harness=appHarness(async()=>{await new Promise(r=>setTimeout(r,8));});
 await harness.eval("Promise.all([commit(s=>updatePreferences(s,{learnerName:'Sora'})),commit(s=>updatePreferences(s,{dailyDurationMinutes:25}))])");
 assert.equal(harness.eval('state.preferences.learnerName'),'Sora');
 assert.equal(harness.eval('state.preferences.dailyDurationMinutes'),25);
});

test('leaving a recording screen stops and SAVES rather than silently discarding a clip',()=>{
 const harness=appHarness(async()=>{});
 const state=harness.eval(`tab='library';librarySection='recordings';recordingVersion=10;let calls=0;recordCtrl={stop:()=>{calls++;}};setTab('academy');({calls,version:recordingVersion,screen:tab})`);
 assert.equal(state.calls,1);
 assert.equal(state.version,10);
 assert.equal(state.screen,'academy');
});

test('a journal-only export omits recordings and restore policy preserves existing clips',async()=>{
 const b=await createPortableBackup(createInitialState(),{includeRecordings:false});
 assert.equal(Object.hasOwn(b,'recordings'),false);
 assert.equal(shouldReplaceRecordings(b),false);
 assert.equal(shouldReplaceRecordings({...b,recordings:[]}),true);
});

test('local storage check reports successful readback and quota without disturbing saved state',async()=>{
 const records=new Map([['current',{important:'saved'}]]);
 const db={transaction(){const tx={oncomplete:null,onerror:null,onabort:null,objectStore(){return {
   put(value,key){records.set(key,value);queueMicrotask(()=>tx.oncomplete?.())},
   get(key){const req={onsuccess:null,onerror:null,result:records.get(key)};queueMicrotask(()=>{req.onsuccess?.();});return req},
   delete(key){records.delete(key)},
  }}};return tx;}};
 const health=await checkLocalStorage({openDatabase:async()=>db,storage:{persisted:async()=>true,estimate:async()=>({usage:1024,quota:4096})}});
 assert.equal(health.readWrite,true);
 assert.equal(health.persisted,true);
 assert.equal(health.usageBytes,1024);
 assert.deepEqual(records.get('current'),{important:'saved'});
 assert.equal(records.size,1);
});

test('vocal-rest mode refuses a scored pitch capture even when mic monitoring is open',async()=>{
 const harness=appHarness(async()=>{});
 harness.eval("state=updatePreferences(state,{vocalComfortStatus:'resting'});micOn=true;");
 await assert.rejects(harness.eval('capturePitch()'),/vocal rest|resting/i);
});

test('storage retention request only reports browser confirmation, never a false success',async()=>{
 const {requestLocalPersistence}=await import('../src/store.js');
 assert.equal(await requestLocalPersistence({persist:async()=>true}),true);
 assert.equal(await requestLocalPersistence({persist:async()=>false}),false);
 assert.equal(await requestLocalPersistence({persist:async()=>{throw Error('denied')}}),false);
 assert.equal(await requestLocalPersistence({}),null);
});

test('storage diagnostics are available from the personal Settings interface',()=>{
 const harness=appHarness(async()=>{});
 const html=harness.eval("tab='settings';render();document.getElementById('app').innerHTML");
 assert.match(html,/Storage health/);
 assert.match(html,/data-action="check-storage"/);
 assert.match(html,/data-action="retain-storage"/);
 assert.match(html,/Audio privacy/);
});


test('storage retention request is initiated during the original button interaction',async()=>{
 const calls=[];let complete;
 const harness=appHarness(async()=>{}, {
  checkLocalStorage:()=>new Promise(resolve=>{calls.push('read');complete=resolve;}),
  requestLocalPersistence:()=>{calls.push('retain');return Promise.resolve(true);},
 });
 const pending=harness.eval('verifyStorage({requestRetention:true})');
 assert.deepEqual(calls,['retain','read']);
 complete({readWrite:true,persisted:false,usageBytes:0,quotaBytes:1024});
 await pending;
 assert.equal(harness.eval('storageCheck.persisted'),true);
});
