/** Fast, dependency-free UI contract tests. This does not replace an actual browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as music from '../src/music.js';
import * as learning from '../src/learning.js';
import * as catalog from '../src/catalog.js';

function makeSandbox(){
 const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
   .replace(/^import .*?;\s*$/gm,'')
   .split("document.addEventListener('click',handleClick);")[0];
 const root={innerHTML:''},toast={textContent:'',className:''};
 const elements={app:root,toast};
 const document={
  documentElement:{dataset:{}},
  getElementById(id){return elements[id]??null;},
  querySelectorAll(){return [];},
  querySelector(){return null;},
  body:{append(){}},
 };
 const audio={tone(){},melody(){},click(){},stopTones(){},stopMic(){},sample(){return {hz:0,confidence:0};}};
 const data={...music,...learning,...catalog,document,audio,
  saveStudioState:async x=>x,loadStudioState:async()=>learning.createInitialState(),
  listRecordings:async()=>[],clearPersonalData:async()=>learning.createInitialState(),
  setTimeout,clearTimeout,setInterval,clearInterval,console,
  performance:{now:()=>0},URL,Blob,TextEncoder,
  window:{scrollTo(){}},navigator:{},location:{protocol:'http:'},
 };
 const context=vm.createContext(data);
 vm.runInContext(source,context,{filename:'app.js'});
 return {context,document,root,evalScript:expr=>vm.runInContext(expr,context)};
}

test('each of the six main application screens renders with independent initial state',()=>{
 const app=makeSandbox();
 for(const [tab,heading] of [['today','Start with one good note'],['academy','Learn music, one skill at a time'],['studio','The Practice Studio'],['library','Library & repertoire'],['progress','Progress'],['settings','Settings']]){
  app.evalScript(`tab=${JSON.stringify(tab)};render();`);
  assert.ok(app.root.innerHTML.includes(heading),`${tab} screen does not show its content`);
  assert.ok(app.root.innerHTML.includes('PERSONAL MUSIC SCHOOL'),`${tab} lost navigation`);
 }
 assert.ok(!app.root.innerHTML.includes('Server error'));
});

test('theory quiz interface requires actual answers and saves the observed score',async()=>{
 const app=makeSandbox();
 app.evalScript('openLesson("theory-major-scale")');
 assert.match(app.root.innerHTML,/QUESTION 1 OF 4/);
 const questions=app.evalScript('currentLesson().quizQuestions');
 for(let i=0;i<questions.length;i++){
  const answer=questions[i].answer;
  await app.evalScript(`handleClick({target:{closest(){return {dataset:{action:'answer-theory',index:'${answer}'}}}}})`);
  assert.ok(app.root.innerHTML.includes(questions[i].explanation));
  await app.evalScript("handleClick({target:{closest(){return {dataset:{action:'next-theory'}}}}})");
 }
 assert.match(app.root.innerHTML,/Quiz complete: 4\/4/);
 await app.evalScript('saveLesson()');
 assert.equal(app.evalScript('state.attempts.length'),1);
 assert.equal(app.evalScript('state.attempts[0].scorePercent'),100);
 assert.equal(app.evalScript('state.attempts[0].kind'),'knowledge');
});
