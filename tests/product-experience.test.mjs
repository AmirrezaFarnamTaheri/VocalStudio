import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState, updatePreferences, selectAcademyLessons, recordRoutineSession, removeRoutine, addRoutine, backupState, restoreBackup, hydrateState, validateBackup} from '../src/learning.js';

test('academy search, stage, readiness and pagination produce a predictable subset', () => {
 const s=createInitialState();
 const all=selectAcademyLessons(s,{limit:12});
 assert.equal(all.total,61);
 assert.equal(all.lessons.length,12);
 const searched=selectAcademyLessons(s,{query:'major scale',limit:100});
 assert.ok(searched.total>0);
 assert.ok(searched.lessons.every(l=>`${l.title} ${l.objective} ${l.track}`.toLowerCase().includes('major scale')));
 const stage=selectAcademyLessons(s,{stage:0,limit:100});
 assert.ok(stage.lessons.length>0 && stage.lessons.every(l=>l.stage===0));
 const ready=selectAcademyLessons(s,{readyOnly:true,limit:100});
 assert.ok(ready.total>0 && ready.lessons.every(l=>l.ready));
 assert.equal(selectAcademyLessons(s,{query:'not-a-real-topic'}).total,0);
});

test('practice routine records real checked steps without changing skill evidence',()=>{
 const s=createInitialState();
 const original=s.routines[0];
 const after=recordRoutineSession(s,{routineId:original.id,completedStepIndexes:[0,2],reflection:'First practice',elapsedSeconds:125},new Date('2026-11-16T10:00:00.000Z'));
 assert.equal(s.practiceSessions.length,0);
 assert.equal(after.practiceSessions.length,1);
 assert.equal(after.practiceSessions[0].completedSteps,2);
 assert.equal(after.practiceSessions[0].totalSteps,original.stepsJson.length);
 assert.equal(after.practiceSessions[0].durationSeconds,125);
 assert.equal(after.attempts.length,0);
 assert.ok(after.skills.every(x=>x.masteryState==='not-started'));
 const recovered=restoreBackup(backupState(after));
 assert.deepEqual(recovered.practiceSessions,after.practiceSessions);
 assert.deepEqual(hydrateState(after).practiceSessions,after.practiceSessions);
});

test('routine sessions refuse imaginary progress, invalid checked steps and corrupted backups',()=>{
 const s=createInitialState(),id=s.routines[0].id;
 assert.throws(()=>recordRoutineSession(s,{routineId:id,completedStepIndexes:[]}),/complete at least/i);
 assert.throws(()=>recordRoutineSession(s,{routineId:id,completedStepIndexes:[30]}),/step/i);
 assert.throws(()=>recordRoutineSession(s,{routineId:id,completedStepIndexes:[1,1]}),/duplicate/i);
 assert.throws(()=>recordRoutineSession(s,{routineId:999,completedStepIndexes:[0]}),/routine/i);
 const bundle=backupState(s);
 bundle.practiceSessions=[{id:1,routineTitle:'Bad',completedSteps:-1,totalSteps:2,createdAt:'tomorrow'}];
 assert.throws(()=>validateBackup(bundle),/practice session/i);
});

test('personal routines require meaningful steps and can be removed without touching bundled routines',()=>{
 const initial=createInitialState();
 assert.throws(()=>addRoutine(initial,{title:'Empty',stepsJson:[]}),/step/i);
 const s=addRoutine(initial,{title:'My session',stepsJson:['Listen','Hum gently'],durationMinutes:8});
 const added=s.routines.at(-1);
 assert.equal(added.category,'Custom');
 assert.equal(removeRoutine(s,added.id).routines.some(x=>x.id===added.id),false);
 assert.throws(()=>removeRoutine(s,initial.routines[0].id),/built-in/i);
});

test('comfortable vocal range preferences reject inverted or missing range',()=>{
 const s=createInitialState();
 assert.throws(()=>updatePreferences(s,{comfortableLowNote:'G4',comfortableHighNote:'C4'}),/range/i);
 assert.equal(updatePreferences(s,{comfortableLowNote:'D3',comfortableHighNote:'A4'}).preferences.comfortableLowNote,'D3');
});
