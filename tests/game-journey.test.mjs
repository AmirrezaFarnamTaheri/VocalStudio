import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as music from '../src/music.js';
import * as learning from '../src/learning.js';
import * as catalog from '../src/catalog.js';
import * as gameCore from '../src/games-core.js';
import * as gameScreen from '../src/games-screen.js';

function harness() {
 const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/^import .*?;\s*$/gm,'').split("document.addEventListener('click',handleClick);")[0];
 const root={innerHTML:''},toast={textContent:'',className:''},calls=[];
 const ctx=vm.createContext({...music,...learning,...catalog,...gameCore,...gameScreen,
  document:{documentElement:{dataset:{}},getElementById:id=>id==='app'?root:id==='toast'?toast:null,querySelector:()=>null,querySelectorAll:()=>[]},
  audio:{tone(){calls.push('tone')},melody(){calls.push('melody');return 2.4},stopTones(){},stopMic(){},sample(){return {hz:0,confidence:0,rms:0}}},
  drawGameScene(){},saveStudioState:async()=>{},console,setTimeout,clearTimeout,Blob,URL,TextEncoder,
  performance:{now:()=>1400},navigator:{},window:{scrollTo(){}} });
 vm.runInContext(src,ctx);
 return {eval:expr=>vm.runInContext(expr,ctx),calls,root};
}

test('the next keyboard challenge automatically plays the new reference note',()=>{
 const h=harness();
 h.eval("tab='games';game=createGameSession({mode:'note-runner',source:'keys',tonicMidi:60,maxMidi:72});game=startGame(game,1000);gameCueUntil=0;render()");
 const midi=h.eval('targetAt(game).midi');
 h.eval(`gameKeyInput(${midi})`);
 assert.equal(h.eval('game.index'),1);
 assert.equal(h.calls.length,2, 'answer note and next reference note both sound');
 assert.equal(h.eval('gameCueUntil'),2030);
 assert.match(h.root.innerHTML,/Playing the reference note/);
});

test('rehearing a melody defers the clock, and a reply cannot score over the cue',()=>{
 const h=harness();
 h.eval("tab='games';game=createGameSession({mode:'echo-cave',source:'keys',tonicMidi:60,maxMidi:72});game=startGame(game,1000);gameCueUntil=0;gameHear();render()");
 assert.ok(h.eval('game.targetStartedAt')>1000);
 assert.match(h.root.innerHTML,/Playing the reference note/);
 const midi=h.eval('targetAt(game).midi');
 h.eval(`gameKeyInput(${midi})`);
 assert.equal(h.eval('game.index'),0,'key input during the replay must be ignored');
});

test('repeating Hear while a cue is already playing never stacks sounds or grants duplicate time',()=>{
 const h=harness();
 h.eval("tab='games';game=createGameSession({mode:'note-runner',source:'keys',tonicMidi:60,maxMidi:72});game=startGame(game,1000);gameCueUntil=0;gameHear()");
 const before=h.eval('game.targetStartedAt');
 h.eval('gameHear()');
 assert.equal(h.eval('game.targetStartedAt'),before,'overlapping cues cannot extend the clock twice');
});

test('game focus mode keeps an obvious exit and an accessible toggle',()=>{
 const h=harness();
 h.eval("tab='games';game=createGameSession({mode:'sky-steps',source:'keys',tonicMidi:60,maxMidi:72});game=startGame(game,1000);gameCueUntil=0;render()");
 assert.match(h.root.innerHTML,/data-action="game-focus"/);
 h.eval('gameFocus=true;render()');
 assert.match(h.root.innerHTML,/Leave focus view/);
 assert.match(h.root.innerHTML,/All games/);
 h.eval('leaveGame()');
 assert.equal(h.eval('gameFocus'),false);
});

test('double-clicking Start does not open competing microphone sessions',async()=>{
 const h=harness();
 h.eval("tab='games';gameInput='microphone';globalThis.starts=0;audio.startMic=()=>{globalThis.starts++;return new Promise(resolve=>{globalThis.completeMic=resolve})}");
 const first=h.eval('beginGame()');const second=h.eval('beginGame()');
 assert.equal(h.eval('globalThis.starts'),1,'only one permission request should be pending');
 h.eval('globalThis.completeMic()');await Promise.all([first,second]);
 assert.equal(h.eval('game!==null'),true);
 h.eval('leaveGame()');
});
