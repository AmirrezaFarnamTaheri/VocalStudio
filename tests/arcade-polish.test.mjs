import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameSession, startGame, stepGame, deferGameForCue, gameKeyboardNotes, targetAt } from '../src/games-core.js';
import { gameStage, gamesLanding } from '../src/games-screen.js';

function session(mode='note-runner',source='microphone') {
 return startGame(createGameSession({mode,source,difficulty:'easy',tonicMidi:60,maxMidi:65,seed:123}),1000);
}

test('replaying a melody gives the learner enough time instead of consuming their attempt',()=>{
 const before=session('echo-cave');
 const heard=deferGameForCue(before,3100);
 assert.equal(heard.targetStartedAt,4100);
 assert.equal(heard.startedAt,4100);
 assert.equal(heard.index,0);
 const after=stepGame(heard,{hz:0,confidence:0,rms:0},12500);
 assert.equal(after.index,0, 'replaying must not cause an unfair timeout');
 assert.equal(after.phase,'playing');
 assert.equal(before.targetStartedAt,1000,'original session is unchanged');
});

test('replaying a count-in preserves relative timing of the next boat',()=>{
 const g=session('rhythm-river');
 const shifted=deferGameForCue(g,1100);
 const beat=shifted.startedAt+targetAt(shifted).offsetMs;
 assert.equal(beat, g.startedAt+targetAt(g).offsetMs+1100);
 assert.equal(stepGame(shifted,{kind:'tap'},beat).correct,1);
});

test('rhythm microphone timing correction uses a bounded observed event time',()=>{
 const g=session('rhythm-river');
 const expected=g.startedAt+targetAt(g).offsetMs;
 const delayedAt=expected+300;
 const corrected=stepGame(g,{kind:'onset',atMs:expected+20},delayedAt);
 assert.equal(corrected.correct,1,'corrected onset within timing window is accepted');
 const rejected=stepGame(g,{kind:'onset',atMs:expected-2000},delayedAt);
 assert.equal(rejected.correct,0,'stale timestamps cannot claim an old beat');
});

test('manual keys and game options never exceed the learner’s configured range',()=>{
 const g=session('sky-steps','keys');
 assert.deepEqual(gameKeyboardNotes(g).map(n=>n.midi),[60,62,64,65]);
 const html=gameStage(g);
 assert.equal((html.match(/data-action="game-key"/g)||[]).length,4);
 assert.doesNotMatch(html,/data-midi="67"/);
 const landing=gamesLanding({selected:'sky-steps',tonic:60,comfortableLow:60,comfortableHigh:65,source:'keys'});
 assert.match(landing,/value="60"/);
 assert.doesNotMatch(landing,/value="72"/);
});

test('the playable screen explains listening state, keyboard mappings and accessible feedback',()=>{
 const g=session('note-runner','keys');
 const html=gameStage(g,{listening:true});
 assert.match(html,/Playing the reference note/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/A\/S\/D\/F/);
 assert.match(html,/data-action="game-key"[^>]*disabled/);
});

test('each game has a distinctive illustrated preview rather than an identical symbol card',()=>{
 const html=gamesLanding({selected:'note-runner',source:'keys'});
 for(const mode of ['note-runner','sky-steps','echo-cave','tone-garden','rhythm-river']){
  assert.match(html,new RegExp(`class="arcade-world arcade-world--${mode}`));
 }
 assert.match(html,/data-action="game-select"/);
 assert.match(html,/aria-pressed="true"/);
});
