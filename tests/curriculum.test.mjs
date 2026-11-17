import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, recordAttempt } from '../src/learning.js';

test('self-learning catalogue offers at least 36 usable lessons across seven domains',()=>{
 const s=createInitialState();
 assert.ok(s.lessons.length>=36,`Only ${s.lessons.length} lessons`);
 assert.ok(new Set(s.lessons.map(l=>l.track)).size>=7);
 for(const l of s.lessons){
  assert.ok(s.skills.some(sk=>sk.slug===l.skillSlug),`No skill for ${l.slug}`);
  assert.ok(l.objective?.length>=20&&l.explanation?.length>=60,`Thin lesson ${l.slug}`);
  assert.ok(l.vocalSafetyNote?.length>=20,`Missing safety guidance ${l.slug}`);
  assert.ok(Array.isArray(l.demonstrationNotes),`Missing note content ${l.slug}`);
 }
});

test('theory quiz is scored using learner answers',()=>{
 const s=createInitialState();const lesson=s.lessons.find(l=>l.interactionType==='theory-quiz');
 assert.ok(lesson,'Missing theory quiz');
 const next=recordAttempt(s,{lessonSlug:lesson.slug,kind:'knowledge',correct:3,total:4});
 assert.equal(next.attempts[0].source,'interactive');
 assert.equal(next.attempts[0].scorePercent,75);
});

test('all lesson content has safe, valid interactions and a non-cyclic prerequisite graph',()=>{
 const s=createInitialState();const lessons=new Set(),skills=new Map(s.skills.map(x=>[x.slug,x]));
 assert.equal(skills.size,s.skills.length,'Duplicate skill IDs');
 for(const l of s.lessons){
   assert.ok(!lessons.has(l.slug),`Duplicate lesson ID ${l.slug}`);lessons.add(l.slug);
   assert.ok(['pitch-match','solfege-sing','sight-sing','guided-reflection','interval-ear','rhythm-tap','theory-quiz','melody-dictation'].includes(l.interactionType),`Unknown interaction ${l.slug}`);
   assert.ok(l.demonstrationNotes.length>0&&l.demonstrationNotes.every(n=>Number.isFinite(n.midi)&&n.midi>=24&&n.midi<=100&&n.durationBeats>0&&n.durationBeats<=16),`Unsafe or invalid score ${l.slug}`);
   if(['theory-quiz','melody-dictation'].includes(l.interactionType)){
      assert.ok(l.quizQuestions.length>=3,`No multiple-choice questions for ${l.slug}`);
      for(const q of l.quizQuestions){
        assert.equal(q.options.length,4,`Missing answer options in ${l.slug}`);
        assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4&&q.question.length>10&&q.explanation.length>15,`Invalid knowledge question in ${l.slug}`);
      }
   }
   if(l.quizIntervals){assert.equal(l.quizIntervals.length,4);assert.equal(new Set(l.quizIntervals).size,4);}
 }
 const visiting=new Set(),visited=new Set();
 function walk(slug){if(visited.has(slug))return;assert.ok(skills.has(slug),`Unknown prerequisite ${slug}`);assert.ok(!visiting.has(slug),`Cycle at ${slug}`);visiting.add(slug);for(const child of skills.get(slug).prerequisites)walk(child);visiting.delete(slug);visited.add(slug);}
 for(const k of skills.keys())walk(k);
});
