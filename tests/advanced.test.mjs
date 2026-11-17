import test from 'node:test';
import assert from 'node:assert/strict';
import { midiToFrequency } from '../src/music.js';
import { scoreMelodyPerformance, parseMusicXML, generatePracticePattern, answerStudyQuestion } from '../src/advanced.js';
import { createInitialState, hydrateState, addCustomDrill, removeCustomDrill, backupState, restoreBackup } from '../src/learning.js';

const melody=[60,62,64,65].map(midi=>({midi,durationBeats:1}));
function framesFor(notes=melody,{start=1000,bpm=120,drop=[]}={}) {
 const frames=[];let elapsed=0;
 for(let i=0;i<notes.length;i++){
  if(!drop.includes(i))for(const frac of [.25,.35,.45,.55,.65,.75])frames.push({time:start+(elapsed+frac*notes[i].durationBeats)*60000/bpm,hz:midiToFrequency(notes[i].midi),confidence:.98});
  elapsed+=notes[i].durationBeats;
 }
 return frames;
}
test('scoring a whole melody uses each sung note and actual time-stamped voiced frames',()=>{
 const result=scoreMelodyPerformance({notes:melody,bpm:120,startAt:1000,frames:framesFor()});
 assert.equal(result.scorable,true,JSON.stringify(result));
 assert.equal(result.coveragePercent,100);
 assert.ok(result.scorePercent>=95);
 assert.equal(result.noteResults.length,4);
 assert.equal(result.voicedFrames,24);
});
test('melody analysis cannot mark unvoiced, spoofed or incomplete performances as successful',()=>{
 const insufficient=scoreMelodyPerformance({notes:melody,bpm:120,startAt:1000,frames:framesFor(melody,{drop:[0,1]})});
 assert.equal(insufficient.scorable,false);
 const wrong=scoreMelodyPerformance({notes:melody,bpm:120,startAt:1000,frames:framesFor().map(frame=>({...frame,hz:frame.hz*2**(2/12)}))});
 assert.equal(wrong.scorable,true);
 assert.ok(wrong.scorePercent<55);
 assert.throws(()=>scoreMelodyPerformance({notes:[],bpm:120,startAt:0,frames:[]}),/notes|melody/i);
});
test('MusicXML import parses a monophonic score with beat durations and rejects unsupported polyphony or entities',()=>{
 const xml=`<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>First phrase</work-title></work><part-list/><part id="P1"><measure number="1"><attributes><divisions>2</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note><note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
 const result=parseMusicXML(xml);
 assert.equal(result.title,'First phrase');
 assert.deepEqual(result.melodyNotes.map(n=>[n.midi,n.durationBeats]),[[60,1],[70,0.5]]);
 assert.throws(()=>parseMusicXML(xml.replace('<note><pitch>','<note><chord/><pitch>')),/polyphon|chord/i);
 assert.throws(()=>parseMusicXML(xml.replace('<score-partwise','<!DOCTYPE foo><score-partwise')),/entity|doctype/i);
});
test('custom drill presets are validated, generated, portable and removable',()=>{
 let state=createInitialState();assert.deepEqual(state.customDrills,[]);
 state=addCustomDrill(state,{title:'My five-note workout',rootMidi:60,pattern:'pentachord',bpm:84});
 assert.equal(state.customDrills.length,1);
 assert.deepEqual(generatePracticePattern(state.customDrills[0]).map(n=>n.midi),[60,62,64,65,67,65,64,62,60]);
 assert.equal(restoreBackup(backupState(state)).customDrills.length,1);
 state=removeCustomDrill(state,state.customDrills[0].id);
 assert.equal(state.customDrills.length,0);
 assert.throws(()=>addCustomDrill(state,{title:'unsafe',rootMidi:-999,pattern:'pentachord',bpm:50}),/range|note|midi/i);
});
test('saved learner state is reconciled with new curriculum without fabricated mastery',()=>{
 const old=createInitialState();const skipped={...old,skills:old.skills.slice(0,3),lessons:old.lessons.slice(0,10),customDrills:undefined};
 const revived=hydrateState(skipped);
 assert.equal(revived.lessons.length,createInitialState().lessons.length);
 assert.equal(revived.skills.length,createInitialState().skills.length);
 assert.equal(revived.customDrills.length,0);
 assert.ok(revived.skills.every(skill=>skill.attemptsCount===0));
});
test('the offline study guide cites actual local lessons without inventing an answer',()=>{
 const state=createInitialState();
 const answer=answerStudyQuestion('How do I identify a major third?',state);
 assert.ok(answer.text.length>40);
 assert.ok(answer.references.length>0);
 assert.ok(answer.references.some(r=>r.includes('third')||r.includes('interval')));
 const unavailable=answerStudyQuestion('Explain the metallurgy of turbine blades',state);
 assert.equal(unavailable.references.length,0);
 assert.match(unavailable.text,/not found|cannot locate|no matching/i);
});

test('pitch contour analysis detects sequential pitched phrases and compares melodic shape',async()=>{
 const {extractPitchContour,comparePitchContours}=await import('../src/advanced.js');
 const rate=22050,n=rate*3;
 const samples=Float32Array.from({length:n},(_,i)=>{
  const midi=i<rate?60:i<rate*2?62:64;
  return .6*Math.sin(2*Math.PI*midiToFrequency(midi)*i/rate);
 });
 const contour=extractPitchContour(samples,rate,{hopMs:220});
 assert.ok(contour.length>=8,`Only ${contour.length} voiced analysis points`);
 assert.ok(Math.abs(contour[0].midi-60)<.25);
 assert.ok(Math.abs(contour.at(-1).midi-64)<.25);
 const matching=comparePitchContours([60,62,64],[65,67,69]);
 assert.ok(matching.similarityPercent>=95,'Transposed contour should match shape');
 const different=comparePitchContours([60,62,64],[60,58,55]);
 assert.ok(different.similarityPercent<75,'Opposing melodic contour should not match');
});

test('rhythm patterns measure observed tap offsets relative to the selected rhythm and tempo',async()=>{
 const {RHYTHM_PATTERNS,rhythmTapOffset}=await import('../src/advanced.js');
 assert.ok(RHYTHM_PATTERNS.offbeat.onsets.length>=4);
 // At 120 BPM a regular beat is 500ms; offbeats are at 250, 750, ...
 assert.ok(Math.abs(rhythmTapOffset(1250,1000,120,'offbeat',0))<1);
 assert.ok(Math.abs(rhythmTapOffset(1000,1000,120,'quarter',0))<1);
 assert.ok(Math.abs(rhythmTapOffset(1100,1000,120,'quarter',25)-75)<1);
 assert.throws(()=>rhythmTapOffset(1000,1000,120,'not-a-pattern'),/pattern/i);
});

test('repertoire looping keeps phrase markers inside the actual melody',async()=>{
 const {addRepertoire,updateRepertoire}=await import('../src/learning.js');
 let state=addRepertoire(createInitialState(),{title:'Personal fragment',melodyNotes:melody});
 const item=state.repertoire.at(-1);
 state=updateRepertoire(state,item.id,{loopStartNote:2,loopEndNote:4});
 assert.equal(state.repertoire.at(-1).loopStartNote,2);
 assert.equal(state.repertoire.at(-1).loopEndNote,4);
 assert.throws(()=>updateRepertoire(state,item.id,{loopStartNote:4,loopEndNote:2}),/loop|start|end/i);
});

test('full-phrase microphone evidence records a melody attempt, while partial coverage is refused',async()=>{
 const {recordAttempt}=await import('../src/learning.js');
 const state=createInitialState();
 const lesson=state.lessons.find(l=>l.interactionType==='sight-sing'&&l.demonstrationNotes.length>=3);
 const frames=framesFor(lesson.demonstrationNotes,{start:1000,bpm:lesson.targetBpm});
 const reading=scoreMelodyPerformance({notes:lesson.demonstrationNotes,bpm:lesson.targetBpm,startAt:1000,frames});
 assert.equal(reading.scorable,true,JSON.stringify(reading));
 const next=recordAttempt(state,{kind:'melody',source:'microphone',noteResults:reading.noteResults,lessonSlug:lesson.slug});
 assert.equal(next.attempts[0].source,'microphone');
 assert.ok(next.attempts[0].scorePercent>=90);
 assert.match(next.attempts[0].evidenceNotes,/melody notes/i);
 assert.throws(()=>recordAttempt(state,{kind:'melody',source:'simulated',noteResults:reading.noteResults,lessonSlug:lesson.slug}),/microphone/i);
 assert.throws(()=>recordAttempt(state,{kind:'melody',source:'microphone',noteResults:reading.noteResults.slice(0,1),lessonSlug:lesson.slug}),/melody note evidence/i);
});
