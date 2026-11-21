import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as music from '../src/music.js';
import * as learning from '../src/learning.js';
import * as catalog from '../src/catalog.js';
import * as session from '../src/session.js';

function appHarness(){
 const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*?;\s*$/gm,'').split("document.addEventListener('click',handleClick);")[0];
 const root={innerHTML:''},toast={textContent:'',className:''};
 const document={documentElement:{dataset:{}},getElementById(id){return id==='app'?root:id==='toast'?toast:null;},querySelector(){return null;},querySelectorAll(){return []},body:{append(){}}};
 const globals={...music,...learning,...catalog,...session,saveRoutineDraft:async()=>{},saveLocalValue:async()=>{},document,console,setTimeout,clearTimeout,setInterval,clearInterval,URL,Blob,TextEncoder,
 audio:{tone(){},melody(){},click(){},stopTones(){},stopMic(){},sample(){return {hz:0,confidence:0}}},
 saveStudioState:async x=>x,clearPersonalData:async()=>learning.createInitialState(),listRecordings:async()=>[],navigator:{},window:{scrollTo(){}},performance:{now:()=>150000}};
 const context=vm.createContext(globals);vm.runInContext(source,context);return {root,eval:x=>vm.runInContext(x,context)};
}

test('academy presents bounded results, meaningful search and a stage filter',()=>{
 const h=appHarness();h.eval("tab='academy';render()");
 assert.match(h.root.innerHTML,/Search lessons/);
 assert.match(h.root.innerHTML,/data-action="academy-stage"/);
 assert.equal((h.root.innerHTML.match(/class="card lesson-card"/g)||[]).length,12);
 h.eval("academyQuery='octave';render()");
 assert.ok((h.root.innerHTML.match(/class="card lesson-card"/g)||[]).length<12);
 assert.match(h.root.innerHTML,/Clear filters/);
});

test('practice routine is a real guided checklist, and completed steps save to the personal journal',async()=>{
 const h=appHarness();h.eval("tab='library';librarySection='routines';render()");
 assert.match(h.root.innerHTML,/Start routine/);
 h.eval('openRoutine(1)');
 assert.match(h.root.innerHTML,/role="dialog"/);
 assert.match(h.root.innerHTML,/Practice session/);
 h.eval('routineChecked.add(0)');
 await h.eval("finishRoutine('A calm session')");
 assert.equal(h.eval('state.practiceSessions.length'),1);
 assert.equal(h.eval('state.practiceSessions[0].completedSteps'),1);
 assert.equal(h.eval('state.attempts.length'),0);
 assert.match(h.root.innerHTML,/Library/);
});

test('routine notes survive moving between tools and closing preserves a recoverable draft',async()=>{
 const h=appHarness();
 h.eval("tab='library';librarySection='routines';openRoutine(1)");
 h.eval("handleInput({target:{id:'routine-reflection',value:'Worked slowly and listened carefully.'}})");
 h.eval("setTab('studio')");
 assert.match(h.root.innerHTML,/Worked slowly and listened carefully\./);
 await h.eval('closeRoutine()');
 assert.equal(h.eval('routineDraft.reflection'),'Worked slowly and listened carefully.');
 h.eval('resumeRoutine()');
 assert.match(h.root.innerHTML,/Worked slowly and listened carefully\./);
});
