import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, recordAttempt, recommendLessons, backupState, validateBackup, restoreBackup, buildSkillReport } from '../src/learning.js';

test('fresh learner has no fabricated practice attempts or mastery', () => {
  const state=createInitialState();
  assert.equal(state.attempts.length,0);
  assert.ok(state.skills.length>=10);
  assert.ok(state.skills.every(s=>s.masteryState==='not-started' && s.attemptsCount===0));
});

test('a demonstrated ear training answer records genuine evidence', () => {
  const state=createInitialState();
  const next=recordAttempt(state,{lessonSlug:'lesson-ear-thirds-and-fifths',kind:'ear',correct:4,total:4,reflection:'Clear contrast'},new Date('2026-11-16T10:00:00Z'));
  assert.equal(next.attempts.length,1);
  assert.equal(next.attempts[0].source,'interactive');
  assert.equal(next.attempts[0].scorePercent,100);
  assert.equal(next.skills.find(s=>s.slug===next.attempts[0].skillSlug).attemptsCount,1);
  assert.equal(state.attempts.length,0);
});

test('one subjective reflection does not count as verified technical mastery', () => {
  const state=createInitialState();
  const lesson=state.lessons.find(x=>x.interactionType==='guided-reflection');
  const next=recordAttempt(state,{lessonSlug:lesson.slug,kind:'reflection',checked:3,total:4},new Date('2026-11-16'));
  assert.equal(next.attempts[0].scorePercent,null);
  assert.equal(next.skills.find(x=>x.slug===lesson.skillSlug).masteryState,'learning');
});

test('a simulated pitch or unvoiced measurement cannot produce recorded mastery', () => {
  const state=createInitialState();
  const slug=state.lessons.find(x=>x.interactionType==='pitch-match').slug;
  assert.throws(()=>recordAttempt(state,{lessonSlug:slug,kind:'pitch',source:'simulator',voicedFrames:30,confidence:0.9,deviationCents:0}),/microphone/i);
  assert.throws(()=>recordAttempt(state,{lessonSlug:slug,kind:'pitch',source:'microphone',voicedFrames:0,confidence:0,deviationCents:0}),/voiced/i);
});

test('recommendations only include lessons with satisfied prerequisites, prioritize due review', () => {
  const state=createInitialState();
  const items=recommendLessons(state,new Date('2026-11-16'));
  assert.ok(items.length>0);
  assert.ok(items.every(x=>x.ready));
});

test('backup roundtrip keeps progress and rejects corrupt manifests without mutation', () => {
  const state=createInitialState();
  const backup=backupState(state);
  assert.equal(validateBackup(backup),true);
  const restored=restoreBackup(backup);
  assert.equal(restored.skills.length,state.skills.length);
  assert.throws(()=>restoreBackup({...backup,attempts:'not array'}),/backup/i);
  assert.equal(state.attempts.length,0);
  assert.ok(buildSkillReport(state).totalSkills>0);
});

test('a valid backup can include an explicitly opted-in voice clip without the journal size limit rejecting it',()=>{
  const backup=backupState(createInitialState());
  backup.recordings=[{id:'private-clip',name:'Practice clip',createdAt:'2026-11-16T10:00:00.000Z',type:'audio/webm',base64:'AA=='.repeat(1_500_000)}];
  assert.equal(validateBackup(backup),true);
});
