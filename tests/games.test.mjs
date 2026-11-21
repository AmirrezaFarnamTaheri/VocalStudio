import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_MODES, createGameSession, startGame, stepGame, targetAt, gameSummary, extractGameInput } from '../src/games-core.js';
import { createInitialState, recordGameSession, backupState, restoreBackup, hydrateState, validateBackup } from '../src/learning.js';

const make=(mode='note-runner',source='microphone',difficulty='easy')=>startGame(createGameSession({mode,source,difficulty,tonicMidi:60,seed:17}),1000);

test('five distinct game modes have accessible descriptions and educational goals',()=>{
 assert.equal(Object.keys(GAME_MODES).length,5);
 for(const [id,mode] of Object.entries(GAME_MODES)){
  assert.equal(mode.id,id);
  assert.ok(mode.title&&mode.description&&mode.learningGoal&&mode.instructions&&mode.color);
  const game=make(id);
  assert.ok(game.targets.length>=5);
  assert.ok(game.targets.every(t=>Number.isInteger(t.midi)||t.kind==='beat'));
 }
});

test('game sessions are reproducible using a seed, stay in comfortable singing range and can vary with difficulty',()=>{
 const a=createGameSession({mode:'sky-steps',difficulty:'easy',tonicMidi:60,seed:24});
 const b=createGameSession({mode:'sky-steps',difficulty:'easy',tonicMidi:60,seed:24});
 const harder=createGameSession({mode:'sky-steps',difficulty:'challenge',tonicMidi:60,seed:24});
 assert.deepEqual(a.targets,b.targets);
 assert.ok(a.targets.every(t=>t.midi>=60&&t.midi<=72));
 assert.ok(harder.config.toleranceCents<a.config.toleranceCents);
 assert.ok(harder.config.holdMs>a.config.holdMs);
});

test('note game requires enough sustained confident pitch before advancing',()=>{
 let g=make();const note=targetAt(g).midi;
 g=stepGame(g,{hz:440*Math.pow(2,(note-69)/12),confidence:.5,rms:.2},1100);
 assert.equal(g.index,0);
 for(let t=1150;t<1700;t+=50)g=stepGame(g,{hz:440*Math.pow(2,(note-69)/12),confidence:.94,rms:.15},t);
 assert.equal(g.index,1);
 assert.equal(g.correct,1);
 assert.ok(g.score>0);
});

test('wrong pitch, silence and octave errors do not advance gates',()=>{
 let g=make();const note=targetAt(g).midi;
 for(let t=1100;t<1900;t+=50)g=stepGame(g,{hz:440*Math.pow(2,(note+12-69)/12),confidence:.99,rms:.22},t);
 assert.equal(g.index,0);
 for(let t=1950;t<2350;t+=50)g=stepGame(g,{hz:0,confidence:0,rms:0},t);
 assert.equal(g.index,0);
});

test('keyboard practice advances only on correct note but is never recorded as measured performance',()=>{
 let g=make('echo-cave','keys');
 const target=targetAt(g);
 g=stepGame(g,{kind:'key',midi:target.midi+2},1100);
 assert.equal(g.index,0);assert.equal(g.wrongHits,1);
 g=stepGame(g,{kind:'key',midi:target.midi},1200);
 assert.equal(g.index,1);
 const state=createInitialState();
 assert.throws(()=>recordGameSession(state,gameSummary({...g,phase:'finished'})),/microphone/i);
});

test('rhythm game scores onsets near the intended beat and misses late beats',()=>{
 let g=make('rhythm-river');
 assert.equal(g.targets[0].kind,'beat');
 const beatAt=g.startedAt+g.targets[0].offsetMs;
 g=stepGame(g,{kind:'onset'},beatAt);
 assert.equal(g.index,1);assert.equal(g.correct,1);
 g=stepGame(g,null,g.startedAt+g.targets[1].offsetMs+g.config.windowMs+30);
 assert.equal(g.index,2);assert.equal(g.misses,1);
});

test('voice input ignores unvoiced samples in pitch modes and detects rhythm onset by level',()=>{
 assert.equal(extractGameInput({hz:0,confidence:0.3,rms:0.5},'note-runner').hz,0);
 assert.equal(extractGameInput({hz:220,confidence:0.8,rms:0.1},'note-runner').hz,220);
 assert.equal(extractGameInput({hz:0,confidence:0,rms:0.1},'rhythm-river').kind,'level');
});

test('finished mic runs can be saved without granting curriculum mastery',()=>{
 let g=make('tone-garden');
 g={...g,phase:'finished',index:g.targets.length,correct:3,misses:2,score:310,endedAt:18000};
 const original=createInitialState();
 const saved=recordGameSession(original,gameSummary(g),new Date('2026-11-16T09:00:00.000Z'));
 assert.equal(saved.gameSessions.length,1);
 assert.equal(saved.attempts.length,0);
 assert.equal(saved.skills[0].masteryState,'not-started');
 assert.equal(saved.gameSessions[0].mode,'tone-garden');
 const backed=backupState(saved);
 assert.equal(restoreBackup(backed).gameSessions.length,1);
 assert.equal(hydrateState(saved).gameSessions.length,1);
});

test('invalid archived game sessions cannot restore',()=>{
 const saved=recordGameSession(createInitialState(),{mode:'note-runner',difficulty:'easy',source:'microphone',correct:5,total:8,score:500,durationSeconds:15},new Date());
 const bundle=backupState(saved);
 bundle.gameSessions[0].source='keys';
 assert.throws(()=>validateBackup(bundle),/game session/i);
});

test('old backups without game sessions remain compatible',()=>{
 const bundle=backupState(createInitialState());
 delete bundle.gameSessions;
 assert.equal(restoreBackup(bundle).gameSessions.length,0);
});

test('a narrow comfortable range never creates higher unsafe targets',()=>{
 for(const mode of Object.keys(GAME_MODES)){
  const g=createGameSession({mode,source:'microphone',tonicMidi:60,maxMidi:65,seed:2});
  assert.ok(g.targets.every(t=>t.midi<=65),mode);
 }
});

test('echo-memory round hides the answer while a player is recalling the phrase', async()=>{
 const {gameStage}=await import('../src/games-screen.js');
 const session=make('echo-cave','microphone');
 const html=gameStage(session);
 assert.match(html,/Echo the next note/);
 assert.match(html,/Note 1 of/);
 assert.doesNotMatch(html,/id="game-stage-prompt">Sing Do/);
});

test('keyboard controls are disabled until an audible cue finishes', async()=>{
 const {gameStage}=await import('../src/games-screen.js');
 const session=createGameSession({mode:'note-runner',source:'keys',tonicMidi:60});
 const html=gameStage(session);
 assert.match(html,/data-action="game-key"[^>]*disabled/);
 assert.match(html,/Listen to the cue/);
});

test('a complete microphone note-runner round scores a verified sequence then restores from backup',()=>{
 let g=make('note-runner','microphone','easy');
 let t=1000;
 for(let i=0;i<g.targets.length;i++){
  const midi=targetAt(g).midi,hz=440*Math.pow(2,(midi-69)/12);
  for(let j=0;j<15&&g.phase==='playing';j++){
   t+=65;g=stepGame(g,{hz,confidence:.97,rms:.11},t);
   if(g.index>i)break;
  }
 }
 assert.equal(g.phase,'finished');
 assert.equal(g.correct,g.targets.length);
 const state=recordGameSession(createInitialState(),gameSummary(g));
 const restored=restoreBackup(backupState(state));
 assert.equal(restored.gameSessions[0].correct,g.targets.length);
 assert.equal(restored.attempts.length,0);
});
