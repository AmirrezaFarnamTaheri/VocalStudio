import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as learning from '../src/learning.js';
import * as music from '../src/music.js';
import * as catalog from '../src/catalog.js';
import * as session from '../src/session.js';
import {previewPortableBackup} from '../src/store.js';

function harness(extras={}) {
  const elements={app:{innerHTML:''},toast:{textContent:'',className:''}};
  const context=vm.createContext({...learning,...music,...catalog,...session,previewPortableBackup,
    document:{documentElement:{dataset:{}},getElementById:id=>elements[id]??null,querySelector:()=>null,querySelectorAll:()=>[],body:{classList:{toggle(){}}}},
    window:{scrollTo(){}},navigator:{},console,setTimeout,clearTimeout,setInterval,clearInterval,
    performance:{now:()=>10000},audio:{stopMic(){},stopTones(){},tone(){},sample:()=>({hz:0,confidence:0})},
    saveStudioState:async s=>s,saveRoutineDraft:async()=>{},saveLocalValue:async()=>{},loadLocalValue:async()=>null,
    ...extras});
  const code=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*?;\s*$/gm,'').split("document.addEventListener('click',handleClick);")[0];
  vm.runInContext(code,context);
  return {run:code=>vm.runInContext(code,context),elements};
}

test('Today offers optional setup without duplicate hero actions or developer-facing labels',()=>{
  const h=harness();h.run('render()');
  assert.match(h.elements.app.innerHTML,/data-action="setup-open"/);
  assert.doesNotMatch(h.elements.app.innerHTML,/Evidence-aware|class="kicker"|hero-art/);
  assert.equal((h.elements.app.innerHTML.match(/data-action="first-recommend"/g)||[]).length,1);
});

test('routine progress is saved as a draft, recovered without overnight elapsed time, and completed atomically',async()=>{
  const drafts=[],writes=[];let clock=10000;
  const h=harness({performance:{now:()=>clock},saveRoutineDraft:async draft=>drafts.push(draft),saveStudioState:async(s,options)=>{writes.push(options);return s;}});
  h.run('openRoutine(state.routines[0].id);routineChecked.add(0);routineReflection="Worked gently"');
  clock=20000;
  await h.run('persistRoutineDraft()');
  assert.equal(drafts.at(-1).reflection,'Worked gently');
  assert.equal(drafts.at(-1).elapsedSeconds,10);
  await h.run('closeRoutine()');
  assert.equal(h.run('state.practiceSessions.length'),0);
  clock+=8*60*60*1000;
  await h.run('resumeRoutine()');
  assert.equal(h.run('routineChecked.has(0)'),true);
  assert.equal(h.run('routineElapsed'),10,'resuming after eight hours must not count time away');
  await h.run('finishRoutine()');
  assert.equal(writes.at(-1).completeRoutine,true);
  assert.equal(h.run('state.practiceSessions.length'),1);
  assert.equal(h.run('routineDraft'),null);
});

test('a failed recording save keeps the clip available for retry instead of losing it',async()=>{
  const blob=new Blob(['synthetic voice'],{type:'audio/webm'});let calls=0;
  const h=harness({console:{error(){}},saveRecording:async()=>{if(++calls===1)throw Error('Storage full');},listRecordings:async()=>[],audio:{recordVoice:async()=>({result:Promise.resolve(blob)}),stopMic(){},sample:()=>({hz:0,confidence:0})}});
  h.run('state.preferences.recordingConsentOptIn=true');
  await h.run('startVoiceRecording()');await h.run('recordingSave');
  assert.equal(h.run('pendingRecording.blob.size'),blob.size);
  await h.run('Promise.all([retryRecordingSave(),retryRecordingSave()])');
  assert.equal(h.run('pendingRecording'),null);
  assert.equal(calls,2);
});

test('restore preview names replacement and cancel does not touch saved data',async()=>{
  const writes=[];
  const h=harness({saveStudioState:async s=>{writes.push(s);return s;},restorePortableBackup:async()=>{writes.push('restore');}});
  h.run('restoreSelection={bundle:backupState(state),summary:previewPortableBackup(backupState(state))};render()');
  assert.match(h.elements.app.innerHTML,/Your saved recordings will be kept/);
  assert.match(h.elements.app.innerHTML,/data-action="restore-apply"/);
  assert.match(h.elements.app.innerHTML,/data-action="restore-cancel"/);
  await h.run("handleClick({target:{closest:()=>({dataset:{action:'restore-cancel'}})}})");
  assert.equal(h.run('restoreSelection'),null);
  assert.deepEqual(writes,[]);
});

test('repeated save clicks record one lesson attempt',async()=>{
  const h=harness();
  h.run("openLesson('lesson-warm-gentle-humming');reflectionChecks.add(0)");
  await h.run('Promise.all([saveLesson(),saveLesson()])');
  assert.equal(h.run('state.attempts.length'),1);
});

test('reset blocks competing saves and clears local draft state',async()=>{
  let release;const paused=new Promise(resolve=>{release=resolve;});
  const h=harness({writer:{assert(){},writable:true},clearPersonalData:async()=>{await paused;return learning.createInitialState();}});
  h.run('routineDraft=makeRoutineDraft(state.routines[0],{checked:[0]})');
  const reset=h.run('resetStudio()');
  assert.equal(h.run('restoring'),true);
  await assert.rejects(h.run("commit(s=>updatePreferences(s,{learnerName:'Stale save'}))"),/wait/i);
  release();await reset;
  assert.equal(h.run('restoring'),false);
  assert.equal(h.run('routineDraft'),null);
  assert.equal(h.run('state.preferences.learnerName'),'Solo Vocalist');
});

test('storage quota failures remain visible until dismissed',async()=>{
  const h=harness({console:{error(){}}});
  h.run("fail(Object.assign(Error('Quota exceeded'),{name:'QuotaExceededError'}))");
  assert.match(h.elements.toast.textContent,/Storage is full/);
  assert.equal(h.run('showToast.timer'),undefined);
  h.run("showToast('saved')");
  assert.match(h.elements.toast.textContent,/Storage is full/);
  await h.run("handleClick({target:{closest:()=>({dataset:{action:'dismiss-error'}})}})");
  h.run("showToast('saved')");
  assert.equal(h.elements.toast.textContent,'saved');
});

test('ordinary errors do not suppress subsequent successful save notifications',()=>{
  const h=harness({console:{error(){}}});
  h.run("fail(Error('Choose an audio file first'))");
  h.run("showToast('Learning evidence saved locally.')");
  assert.equal(h.elements.toast.textContent,'Learning evidence saved locally.');
});

test('closing a routine with no progress clears the draft instead of blocking other routines',async()=>{
  const saved=[];
  const h=harness({saveLocalValue:async(key,value)=>{saved.push([key,value]);}});
  h.run('openRoutine(state.routines[0].id)');
  await h.run('closeRoutine()');
  assert.deepEqual(saved,[['routine-draft',null]]);
  assert.equal(h.run('routineDraft'),null);
});
