import { CATALOG } from './catalog.js';
import { midiToFrequency, midiToNoteName, noteNameToMidi, evaluatePitch, intervalName, transposeNotes, majorScale, SCALE_PATTERNS, SOLFEGE, clamp, staffStepForMidi, solfegeForMidi } from './music.js';
import { createInitialState, recordAttempt, recommendLessons, buildSkillReport, updatePreferences, updateRepertoire, addRepertoire, addRoutine, removeRoutine, recordRoutineSession, selectAcademyLessons, addCustomDrill, removeCustomDrill, recordGameSession, hydrateState } from './learning.js';
import { loadStudioState, saveStudioState, createPortableBackup, restorePortableBackup, clearPersonalData, saveRecording, listRecordings, getRecording, deleteRecording, recordingFilename, checkLocalStorage, requestLocalPersistence } from './store.js';
import { runDeviceSignalCheck } from './diagnostics.js';
import { writer, makeRoutineDraft, readRoutineDraft } from './session.js';
import { loadLocalValue, saveLocalValue, saveRoutineDraft, previewPortableBackup } from './store.js';
import { GAME_MODES, DIFFICULTIES, createGameSession, startGame, stepGame, targetAt, gameSummary, extractGameInput, deferGameForCue, gameKeyboardNotes } from './games-core.js';
import { drawGameScene } from './games-canvas.js';
import { gamesLanding, gameStage } from './games-screen.js';
import { audio } from './audio.js';
import { scoreMelodyPerformance, generatePracticePattern, DRILL_PATTERNS, parseMusicXML, answerStudyQuestion, comparePitchContours, RHYTHM_PATTERNS, rhythmTapOffset } from './advanced.js';

let routineDraft=null,draftTimer=null,draftQueue=Promise.resolve(),routineElapsed=0,routineSaving=false,recordingSave=Promise.resolve(),pendingRecording=null,recordingStarting=false,recordingSaving=false;
let setupOpen=false,setupDismissed=false,restoreSelection=null,restoring=false,booted=false,saveError='',savingLesson=null;
const root=document.getElementById('app');
const toastRegion=document.getElementById('toast');
const trackLabels={pitch:'Pitch & intonation',solfege:'Solfège', 'ear-training':'Ear training',rhythm:'Rhythm & meter',notation:'Notation & sight-singing','vocal-fundamentals':'Vocal technique','music-theory':'Music theory','performance':'Performance','creativity':'Creativity'};
const tabs=[['today','Today'],['academy','Academy'],['studio','Practice'],['games','Games'],['library','Library'],['progress','Progress'],['settings','Settings']];
let state=createInitialState(),tab='today',filter='all',progressFilter='all',academyQuery='',academyStage='all',academyReadyOnly=false,academyLimit=12,activeRoutineId=null,routineChecked=new Set(),routineStartedAt=0,routineReflection="",lessonSlug=null,activeNote=0,quiz=null,quizAnswers=[],rhythm={on:false,epoch:0,timer:null,offsets:[],pattern:'quarter',bpm:80},studioTarget=60,studioScale='major',studioKey=60,studioMode='pitch',pitchResult=null,pitchCapture=null,micTimer=null,micOn=false,micHistory=[],recordCtrl=null,recordingVersion=0,recordingItems=[],selectedRepId=1,librarySection='repertoire',searchTerm='',lessonSaved=false,theoryIndex=0,theorySelected=null,theoryAnswers=[],lessonReflection='',reflectionChecks=new Set(),melodyCapture=null,melodyResult=null,melodyTimeout=null,guideQuestion='',guideResponse=null,audioDevices=[],recordingAnalyses=new Map(),comparisonIds=new Set(),deviceCheck=null,deviceCheckRunning=false,storageCheck=null,storageCheckRunning=false;
let selectedGame='note-runner',gameDifficulty='easy',gameInput='microphone',gameTonic=55,gameFocus=false,gameStarting=false;
let game=null,gameOwnsMic=false,gameRaf=0,gameStartTimer=0,gameGeneration=0,gameSaved=false,gameLastTick=0,gameCueUntil=0,gameRmsArmed=true,gameLastOnset=0;
const safe=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moment=s=>s?new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const clip=(s,n=130)=>safe(String(s??'').slice(0,n));
function showToast(message,error=false,sticky=false){
 clearTimeout(showToast.timer);showToast.timer=undefined;
 if(saveError&&!error)return;
 toastRegion.textContent=message;toastRegion.className=`toast${error?' error':''}`;
 toastRegion.setAttribute?.('role',error?'alert':'status');
 if(error&&sticky){
  saveError=message;
  if(document.createElement){const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='btn sm';dismiss.textContent='Dismiss';dismiss.dataset.action='dismiss-error';toastRegion.append(dismiss);}
 }else showToast.timer=setTimeout(()=>{if(!saveError){toastRegion.textContent='';toastRegion.className='';}},4600);
}
function fail(error,recordingSaveFailed=false){
 console.error(error);
 const message=error?.name==='QuotaExceededError'?'Storage is full. Download a backup, remove unwanted clips, then try saving again.':error?.name==='NotAllowedError'?'Microphone access was denied. Allow microphone access in your browser settings, then try again.':error?.message||'This action could not finish. Your changes have not been saved; try again.';
 showToast(message,true,error?.name==='QuotaExceededError'||recordingSaveFailed);
}
let commitQueue=Promise.resolve();
function commit(change){
 const pending=commitQueue.then(async()=>{if(restoring)throw Error('Wait for the backup restore to finish.');const next=change(state);await saveStudioState(next);state=next;render();return next;});
 commitQueue=pending.catch(()=>{});
 return pending;
}
const currentLesson=()=>state.lessons.find(x=>x.slug===lessonSlug);
const currentTargetMidi=()=>lessonSlug?(currentLesson()?.demonstrationNotes[activeNote]?.midi??60):studioTarget;
function formatScore(score){return Number.isFinite(score)?`${score}%`:'Self-reported';}
function isReady(lesson){const skill=state.skills.find(s=>s.slug===lesson.skillSlug);return skill?.prerequisites.every(p=>['demonstrated','retained'].includes(state.skills.find(s=>s.slug===p)?.masteryState))??false;}
function setTab(next){if(!tabs.some(([id])=>id===next))return;if(tab==='games'&&next!=='games')leaveGame();if(next==='settings')void refreshAudioDevices();if(recordCtrl&&tab==='library'&&next!=='library'){recordCtrl.stop();recordCtrl=null;}closeLesson();tab=next;render();window.scrollTo({top:0,behavior:'auto'});}
function closeLesson(){if(melodyTimeout)clearTimeout(melodyTimeout);melodyTimeout=null;melodyCapture=null;melodyResult=null;lessonSlug=null;pitchResult=null;pitchCapture=null;lessonSaved=false;lessonReflection='';reflectionChecks=new Set();quizAnswers=[];quiz=null;theoryIndex=0;theorySelected=null;theoryAnswers=[];stopRhythm();if(micOn)stopMicrophone();}
function openLesson(slug){const lesson=state.lessons.find(x=>x.slug===slug);if(!lesson)return;closeLesson();lessonSlug=slug;activeNote=0;quiz=lesson.interactionType==='interval-ear'?newQuizPrompt():null;render();const dialog=document.querySelector('[role="dialog"]');dialog?.querySelector('[data-action="close-lesson"]')?.focus();}
function button(text,action,extras='',kind=''){return `<button type="button" class="btn ${kind}" data-action="${action}" ${extras}>${text}</button>`;}
function trackTag(track){return `<span class="track-tag">${safe(trackLabels[track]||track)}</span>`;}
function masteryLabel(state){return ({'not-started':'Not started','learning':'Learning','demonstrated':'Demonstrated','retained':'Retained'})[state]??'Learning';}
function header(){const report=buildSkillReport(state);const current=tabs.find(x=>x[0]===tab)?.[1]||'Today';return `<div class="topbar"><div class="top-label"><span class="breadcrumb-parent">Vocal Studio</span><span class="breadcrumb-separator">/</span><strong>${safe(current)}</strong></div><div class="top-right"><span class="pill"><span class="dot" aria-hidden="true"></span> On this device</span><span class="small muted">${report.totalAttempts} learning attempts</span><div class="avatar" title="${safe(state.preferences.learnerName)}">${safe(state.preferences.learnerName.trim().slice(0,1).toUpperCase()||'V')}</div></div></div>`;}
function navIcon(id){
 const paths={
  today:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  academy:'m2 8 10-5 10 5-10 5-10-5Zm4 3v6c4 3 8 3 12 0v-6M22 8v8',
  studio:'M9 17V5l11-2v12M9 8l11-2M9 17c0 2-2 3-4 3s-3-1-3-2 2-3 4-3 3 1 3 2Zm11-2c0 2-2 3-4 3s-3-1-3-2 2-3 4-3 3 1 3 2Z',
  games:'M7 7h10c3 0 5 11 3 12-2 1-4-3-5-3H9c-1 0-3 4-5 3C2 18 4 7 7 7Zm1 3v4m-2-2h4m6 0h.01m2 2h.01',
  library:'M3 4h5v16H3V4Zm7 0h4v16h-4V4Zm6 1 4-1 3 15-4 1-3-15Z',
  progress:'M3 3v18h18M7 16l5-5 4 2 5-7',
  settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M10 15v6'
 };
 return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[id]||paths.studio}"/></svg>`;
}
function sidebar(){
 return `<aside class="sidebar"><div class="brand"><div class="brand-mark" aria-hidden="true">${navIcon('studio')}</div><div><div class="brand-title">Vocal Studio</div><div class="brand-caption">PERSONAL MUSIC SCHOOL</div></div></div><nav class="nav-group" aria-label="Studio">${tabs.map(([id,label])=>`<button class="nav-button ${tab===id?'active':''}" type="button" data-action="tab" data-tab="${id}" ${tab===id?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${navIcon(id)}</span><span>${label}</span></button>`).join('')}</nav></aside>`;
}
function render(){
 document.documentElement.dataset.theme=state.preferences.themeMode;
 document.body?.classList?.toggle?.('game-focus',tab==='games'&&!!game&&gameFocus);
 root.innerHTML=`<div class="shell">${sidebar()}<div class="main">${header()}<main class="content" id="main-content">${sessionNotice()}${({today:todayView,academy:academyView,studio:studioView,games:gameWorldView,library:libraryView,progress:()=>progressView()+gameHistoryPanel(),settings:settingsView})[tab]()}</main><footer class="footer"><span>Vocal Studio · A space to practise and learn</span><span>Take your time. Sing with care.</span></footer></div></div>${lessonSlug?lessonModal():''}${activeRoutineId!==null?routineDock():''}${restoreSelection?restorePreviewView():''}`;
 if(booted&&!writer.writable)root.querySelectorAll?.('input,select,textarea,button[type="submit"]').forEach(el=>el.disabled=true);
 if(restoreSelection||restoring)root.querySelectorAll?.('.shell button,.shell input,.shell select,.shell textarea,.routine-dock button,.routine-dock input,.routine-dock textarea').forEach(el=>el.disabled=true);
 updatePitchUI();
 if(tab==='games'&&game&&typeof requestAnimationFrame==='function')requestAnimationFrame(now=>drawGameScene(document.getElementById('game-canvas'),game,{time:now}));
}
function tiles(){const r=buildSkillReport(state);return `<div class="grid three section summary-grid"><div class="card stat-card"><div class="stat-symbol" aria-hidden="true">◷</div><div><div class="num">${r.totalAttempts+(state.practiceSessions?.length||0)}</div><div class="meta">PRACTICE ENTRIES</div></div></div><div class="card stat-card"><div class="stat-symbol" aria-hidden="true">◎</div><div><div class="num">${r.demonstrated+r.retained}<span class="stat-denominator"> / ${r.totalSkills}</span></div><div class="meta">SKILLS DEMONSTRATED</div></div></div><div class="card stat-card"><div class="stat-symbol" aria-hidden="true">♫</div><div><div class="num">${r.measuredAttempts?`${r.averageScore}%`:'—'}</div><div class="meta">${r.measuredAttempts?'AVERAGE MEASURED SCORE':'NO MEASURED RESULTS YET'}</div></div></div></div>`;}
function todayView(){
 const rec=recommendLessons(state,new Date(),4),next=rec[0],latest=state.attempts.slice(0,3),history=state.attempts.length+(state.practiceSessions?.length||0);
 return `<section class="daily-start"><div><h1>${history?'Keep the music moving.':'Start with one good note.'}</h1><p>A little listening. A little singing. One useful step today.</p></div><div class="next-lesson"><span class="small muted">${next?.due?'Ready for a review':'Your next lesson'}</span><h2>${next?safe(next.title):'Explore at your own pace'}</h2><p>${next?`${safe(trackLabels[next.track])} · ${next.durationMinutes} min`:'Choose a lesson from the Academy.'}</p>${button(next?'Start this lesson':'Browse lessons',next?'first-recommend':'tab',next?'':'data-tab="academy"','primary big')}</div></section>
 ${setupView()}
 ${routineDraft&&activeRoutineId===null?`<section class="recovery-bar"><div><h2>Pick up your practice</h2><p>${safe(state.routines.find(r=>r.id===routineDraft.routineId)?.title||'Practice routine')} · ${routineDraft.checked.length} steps checked</p></div><div class="actions">${button('Resume practice','routine-resume','','primary')}${button('Discard draft','routine-discard')}</div></section>`:''}
 <div class="split section"><section><div class="section-header"><div><h2>More to explore</h2><p>${state.preferences.dailyDurationMinutes} minutes a day is a starting point, not a deadline.</p></div></div>${rec.slice(1).map(l=>`<div class="timeline-item"><div class="timeline-main">${trackTag(l.track)}<h3>${safe(l.title)}</h3><p>${l.due?'Due for review':l.track===state.preferences.activeGoalTrack?'Fits your learning focus':'Builds your foundations'} · ${l.durationMinutes} min</p></div>${button('Open lesson','lesson',`data-slug="${safe(l.slug)}"`,'sm')}</div>`).join('')}<div class="actions">${button('Browse all lessons','tab','data-tab="academy"')}${button('Practise with a routine','open-routines')}</div><p class="help-note">Stay in a comfortable range. Stop if singing hurts or feels tiring.</p></section><section><div class="section-header"><h2>Recent practice</h2>${button('See progress','tab','data-tab="progress"','sm ghost')}</div>${latest.length?latest.map(a=>`<div class="attempt"><div><h3>${clip(a.exerciseTitle,65)}</h3><p>${clip(a.evidenceNotes,105)}</p></div><div class="tiny activity-score"><strong>${formatScore(a.scorePercent)}</strong><div class="muted">${moment(a.createdAt)}</div></div></div>`).join(''):'<p class="empty">Your first lesson or routine will appear here.</p>'}<p class="help-note">Progress comes from returning, not from a perfect score.</p></section></div>`;
}
function lessonCard(l){const skill=state.skills.find(x=>x.slug===l.skillSlug),ready=l.ready??isReady(l);return `<article class="card lesson-card"><div class="row space">${trackTag(l.track)}<span class="lesson-stage">LEVEL ${l.stage}</span></div><div class="lesson-copy"><h3>${safe(l.title)}</h3><p>${clip(l.objective,145)}</p></div><div class="lesson-bottom"><span class="lesson-meta"><span class="status-dot ${ready?'ready':''}"></span> ${masteryLabel(skill?.masteryState)} · ${l.durationMinutes} min</span>${button('Open lesson','lesson',`data-slug="${safe(l.slug)}"`,'sm')}</div></article>`;}
function academyView(){const result=selectAcademyLessons(state,{track:filter,query:academyQuery,stage:academyStage,readyOnly:academyReadyOnly,limit:academyLimit});return `<section class="intro"><div><h1>Learn music, one skill at a time.</h1><p>Courses in singing, solfège, rhythm and musicianship. Search by topic or explore what fits your level.</p></div><span class="chip">${state.lessons.length} lessons · ${state.skills.length} skills</span></section><div class="academy-tools"><label class="academy-search"><span class="sr-only">Search lessons</span><span aria-hidden="true">⌕</span><input id="academy-query" data-action="academy-search" type="search" autocomplete="off" maxlength="120" placeholder="Search lessons or skills" aria-label="Search lessons" value="${safe(academyQuery)}"></label><label class="field stage-select">Level<select data-action="academy-stage" aria-label="Filter by level"><option value="all" ${academyStage==='all'?'selected':''}>All levels</option>${[0,1,2,3,4,5].map(x=>`<option value="${x}" ${String(academyStage)===String(x)?'selected':''}>Level ${x}</option>`).join('')}</select></label><label class="ready-filter"><input type="checkbox" data-action="academy-ready" ${academyReadyOnly?'checked':''}> Ready to study</label></div><div class="filterbar filterbar-spacious"><button class="filter ${filter==='all'?'active':''}" data-action="filter" data-filter="all" aria-pressed="${filter==='all'}">All topics</button>${Object.entries(trackLabels).map(([id,label])=>`<button class="filter ${filter===id?'active':''}" data-action="filter" data-filter="${id}" aria-pressed="${filter===id}">${safe(label)}</button>`).join('')}</div><div class="result-header"><div><strong>${result.total} ${result.total===1?'lesson':'lessons'}</strong><span class="muted"> · ${result.lessons.length} shown</span></div>${filter!=='all'||academyQuery||academyStage!=='all'||academyReadyOnly?button('Clear filters','academy-clear','','sm ghost'):''}</div><div class="grid three lesson-grid">${result.lessons.length?result.lessons.map(lessonCard).join(''):'<div class="empty empty-large">No lessons match. Try another keyword or remove a filter.</div>'}</div>${result.total>result.lessons.length?`<div class="load-more">${button(`Show more lessons (${result.total-result.lessons.length} remaining)`,'academy-more','','big')}</div>`:''}<p class="subtle small academy-footnote">Learning paths offer guidance, not gates. You can open any lesson at any time.</p>`;}
function staffSvg(notes,{transpose=0,width=640}={}){const arr=notes.slice(0,15);const origin=77,spacing=Math.min(51,(width-115)/Math.max(1,arr.length));let out=`<svg class="staff" viewBox="0 0 ${width} 133" role="img" aria-label="Melody staff with ${arr.length} notes">`;
 for(let j=0;j<5;j++)out+=`<line x1="42" y1="${25+j*17}" x2="${width-18}" y2="${25+j*17}" stroke="#9ca99e" stroke-width="1.2"/>`;
 out+=`<text x="17" y="86" font-size="61" fill="#526450">𝄞</text>`;
 for(let i=0;i<arr.length;i++){const n=arr[i],m=n.midi+transpose,x=origin+i*spacing;const staffStep=staffStepForMidi(m);const y=93-staffStep*8.5;let yy=y;if(yy<9)yy=9;if(yy>119)yy=119;
 for(let line=-2;line>=staffStep;line-=2){const ledgerY=93-line*8.5;out+=`<line x1="${x-14}" y1="${ledgerY}" x2="${x+15}" y2="${ledgerY}" stroke="#455b49"/>`;}
 for(let line=10;line<=staffStep;line+=2){const ledgerY=93-line*8.5;out+=`<line x1="${x-14}" y1="${ledgerY}" x2="${x+15}" y2="${ledgerY}" stroke="#455b49"/>`;}
 out+=`<ellipse cx="${x}" cy="${yy}" rx="8" ry="5.6" transform="rotate(-19 ${x} ${yy})" fill="#283d30"/><line x1="${x+7}" y1="${yy}" x2="${x+7}" y2="${yy-26}" stroke="#283d30" stroke-width="2"/>`;
 const name=midiToNoteName(m);if(name.includes('#')||name.includes('b'))out+=`<text x="${x-23}" y="${yy+4}" font-size="16" fill="#455b49">${name.includes('#')?'♯':'♭'}</text>`;
 out+=`<text x="${x}" y="125" text-anchor="middle" font-size="10" fill="#5c6e60">${safe(name)}</text>`;
 }
 return out+'</svg>';}
function studioView(){return `<section class="intro"><div><h1>The Practice Studio</h1><p>Explore notes, scales, interval hearing and rhythm. Turn on your microphone only when you want to practise singing.</p></div></section>${state.preferences.vocalComfortStatus==='resting'?'<div class="warning" role="status">Voice rest is selected. Use ear training, theory or rhythm today; sung pitch assessments are paused.</div>':''}<div class="filterbar">${[['pitch','Pitch lab'],['solfege','Solfège & scales'],['ear','Ear trainer'],['rhythm','Rhythm lab'],['keyboard','Virtual keyboard'],['builder','Custom drills'],['guide','Study guide']].map(([id,label])=>`<button class="filter ${studioMode===id?'active':''}" data-action="studio-mode" data-mode="${id}">${label}</button>`).join('')}</div>${studioMode==='pitch'?studioPitchView():studioMode==='solfege'?studioSolfegeView():studioMode==='ear'?studioEarView():studioMode==='rhythm'?studioRhythmView():studioMode==='builder'?studioBuilderView():studioMode==='guide'?studioGuideView():studioKeyboardView()}`;}
function gameWorldView(){
 const low=noteNameToMidi(state.preferences.comfortableLowNote),high=noteNameToMidi(state.preferences.comfortableHighNote);
 if(!game)gameTonic=Math.min(Math.max(gameTonic,low),Math.max(low,high-12));
 return game?gameStage(game,{resultSaved:gameSaved,listening:game.phase==='playing'&&performance.now()<gameCueUntil,focus:gameFocus}):gamesLanding({selected:selectedGame,difficulty:gameDifficulty,source:gameInput,tonic:gameTonic,comfortableLow:low,comfortableHigh:high,history:state.gameSessions||[],resting:state.preferences.vocalComfortStatus==='resting',starting:gameStarting});
}
function leaveGame(){
 gameGeneration++;
 if(gameStartTimer)clearTimeout(gameStartTimer);gameStartTimer=0;
 if(gameRaf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(gameRaf);gameRaf=0;
 if(gameOwnsMic){audio.stopMic();gameOwnsMic=false;}
 audio.stopTones();game=null;gameSaved=false;gameLastTick=0;gameCueUntil=0;gameFocus=false;
}
function gameHear({grantTime=true}={}){
 if(!game||game.phase==='finished')return;
 audio.stopTones(); // Cancel overlapping reference sounds before replaying.
 const cueAt=performance.now(),previouslyWaiting=Math.max(0,gameCueUntil-cueAt);
 let cueMs=630;
 if(game.mode==='rhythm-river'){
  for(let i=0;i<3;i++)audio.tone(i===0?84:79,{duration:.08,startAt:i*.44,volume:.1,type:'triangle'});
  cueMs=1100; // Avoid counting the speaker's count-in as a microphone beat.
 }else if(game.mode==='echo-cave'){
  const seconds=audio.melody(game.targets.map(n=>({midi:n.midi,durationBeats:.75})),{bpm:116,a4:state.preferences.a4ReferenceHz});
  cueMs=Math.ceil((Number.isFinite(seconds)?seconds:game.targets.length*.75*60/116)*1000)+240;
 }else if(targetAt(game))audio.tone(targetAt(game).midi,{duration:.48,volume:.11,a4:state.preferences.a4ReferenceHz});
 // A replay is part of learning, not time deducted from the user's attempt.
 if(game.phase==='playing'&&grantTime)game=deferGameForCue(game,Math.max(0,cueMs-previouslyWaiting));
 gameCueUntil=cueAt+cueMs;
 updateGameHud();
}
async function beginGame(){
 if(gameStarting)return;
 if(state.preferences.vocalComfortStatus==='resting'&&gameInput==='microphone')throw Error('Vocal rest is selected. Use the on-screen practice mode instead.');
 if(recordCtrl)throw Error('Finish your voice recording before starting a music game');
 gameStarting=true;
 leaveGame();
 const generation=gameGeneration;
 render();
 try{
  if(micOn)stopMicrophone();
  if(gameInput==='microphone'){
   await audio.startMic(state.preferences.audioInputDeviceId);
   if(generation!==gameGeneration){audio.stopMic();return;}
   gameOwnsMic=true;
  }
  const low=noteNameToMidi(state.preferences.comfortableLowNote);
  const high=noteNameToMidi(state.preferences.comfortableHighNote);
  const tonic=Math.min(Math.max(low,gameTonic),Math.max(low,high-12));
  game=createGameSession({mode:selectedGame,difficulty:gameDifficulty,source:gameInput,tonicMidi:tonic,maxMidi:high,seed:Date.now()>>>0,a4:state.preferences.a4ReferenceHz});
  gameSaved=false;gameRmsArmed=true;gameLastOnset=0;render();window.scrollTo({top:0,behavior:'auto'});
  const delay=game.mode==='echo-cave'?game.targets.length*410+600:game.mode==='rhythm-river'?120:750;
  if(game.mode!=='rhythm-river')gameHear();
  gameStartTimer=setTimeout(()=>{
   if(generation!==gameGeneration||!game)return;
   game=startGame(game,performance.now());render();
   if(game.mode==='rhythm-river'){gameHear({grantTime:false});render();}
  },delay);
  if(typeof requestAnimationFrame==='function')gameRaf=requestAnimationFrame(gameFrame);
 }finally{
  gameStarting=false;
  if(tab==='games'&&!game)render();
 }
}
function updateGameHud(){
 if(!game)return;
 const note=targetAt(game),percent=Math.round(game.index/game.targets.length*100);
 const h=document.getElementById('game-stage-progress');if(h)h.textContent=`${game.index} / ${game.targets.length} challenges`;
 const sc=document.getElementById('game-stage-score');if(sc)sc.textContent=`${game.score} points`;
 const bar=document.getElementById('game-stage-progress-bar');if(bar)bar.style.width=percent+'%';
 const progress=document.querySelector('.arcade-progress');if(progress)progress.setAttribute('aria-valuenow',String(percent));
 const listening=game.phase==='playing'&&performance.now()<gameCueUntil;
 const prompt=document.getElementById('game-stage-prompt');if(prompt)prompt.textContent=listening?'Playing the reference note…':game.mode==='rhythm-river'?'Follow the beat':game.mode==='echo-cave'?'Echo the next note':game.source==='keys'?`Find ${note?.label??'Do'}`:`Sing ${note?.label??'Do'}`;
 const held=document.getElementById('game-held');if(held)held.style.width=Math.round(Math.min(1,game.heldMs/(game.mode==='tone-garden'?game.config.holdMs*2.6:game.config.holdMs))*100)+'%';
 const current=document.getElementById('game-current-note');if(current)current.textContent=game.mode==='rhythm-river'?`Beat ${game.index+1}`:game.mode==='echo-cave'?`Note ${game.index+1} of ${game.targets.length}`:`${note?.label??'Do'} · ${midiToNoteName(note?.midi??60)}`;
 const observed=document.getElementById('game-stage-observed');if(observed)observed.textContent=listening?'Listen first, then respond':game.event==='wrong'?'Not quite — try another note':game.source==='keys'?'Practice with the buttons below':game.mode==='rhythm-river'?'Say a short “ta” or clap gently':Number.isFinite(game.lastCents)?`${game.lastCents>0?'+':''}${Math.round(game.lastCents)} cents`:'Listening for your note…';
}
async function finishGame(){
 if(!game)return;
 if(gameOwnsMic){audio.stopMic();gameOwnsMic=false;}
 audio.stopTones();
 if(game.source==='microphone'){
  const summary=gameSummary(game);
  const saveGeneration=gameGeneration;
  try{await commit(s=>recordGameSession(s,summary));if(saveGeneration===gameGeneration){gameSaved=true;render();}}catch(error){fail(error);render();}
 }else{gameSaved=false;render();}
}
function gameFrame(now){
 if(tab!=='games'||!game){gameRaf=0;return;}
 if(game.phase==='playing'&&now-gameLastTick>=95){
  gameLastTick=now;
  let input=null;
  if(game.source==='microphone'){
   const sample=audio.sample();
   if(game.mode==='rhythm-river'){
    const level=extractGameInput(sample,game.mode).rms;
    if(level<.013)gameRmsArmed=true;
    if(gameRmsArmed&&level>.033&&now-gameLastOnset>225){input={kind:'onset',atMs:now-state.preferences.latencyOffsetMs};gameRmsArmed=false;gameLastOnset=now;}
   }else if(now>=gameCueUntil)input=extractGameInput(sample,game.mode);
  }
  const before=game;game=now<gameCueUntil?game:stepGame(game,input,now);
  if(game.index!==before.index){
   if(game.phase==='finished')void finishGame();
   else if(game.mode!=='echo-cave'&&game.mode!=='rhythm-river')gameHear();
   render();
   const announcement=document.getElementById('game-announcement');if(announcement)announcement.textContent=before.index<game.index?game.event==='success'?'Note matched. Next challenge.':'New challenge.':'Ready';
  }else updateGameHud();
 }
 drawGameScene(document.getElementById('game-canvas'),game,{time:now});
 if(game?.phase==='finished'){gameRaf=0;return;}
 if(typeof requestAnimationFrame==='function')gameRaf=requestAnimationFrame(gameFrame);
}
function gameKeyInput(midi=null,kind='key'){
 if(!game||game.phase!=='playing'||game.source!=='keys'||performance.now()<gameCueUntil)return;
 if(kind==='key')audio.tone(midi,{duration:.3,volume:.1,a4:state.preferences.a4ReferenceHz});
 const before=game;game=stepGame(game,kind==='tap'?{kind:'tap'}:{kind:'key',midi},performance.now());
 if(game.index!==before.index){
  if(game.phase==='finished')void finishGame();
  else if(game.mode!=='echo-cave'&&game.mode!=='rhythm-river')gameHear();
  render();
 }
 else if(game.event==='wrong'){const a=document.getElementById('game-announcement');if(a)a.textContent='Try a different note.';}
 updateGameHud();
}
async function pauseGame(){
 if(!game||game.phase!=='playing')return;
 game={...game,phase:'paused',pausedAt:performance.now()};
 if(gameOwnsMic){audio.stopMic();gameOwnsMic=false;}
 audio.stopTones();render();
}
async function resumeGame(){
 if(!game||game.phase!=='paused')return;
 if(game.source==='microphone'){await audio.startMic(state.preferences.audioInputDeviceId);gameOwnsMic=true;}
 const elapsed=performance.now()-game.pausedAt;
 game={...game,phase:'playing',startedAt:game.startedAt+elapsed,targetStartedAt:game.targetStartedAt+elapsed,lastAt:performance.now()};
 game=deferGameForCue(game,300);gameCueUntil=performance.now()+300;gameRmsArmed=true;render();
}
function studioPitchView(){return `<div class="split"><div class="stack"><div class="card"><div class="card-top"><h3>Live intonation monitor</h3><span class="chip ${micOn?'success':''}">${micOn?'Microphone active':'Mic off'}</span></div><div class="control-row"><label class="field">Target note<select data-action="studio-target">${Array.from({length:25},(_,i)=>i+48).map(m=>`<option value="${m}" ${studioTarget===m?'selected':''}>${midiToNoteName(m)}</option>`).join('')}</select></label><label class="field">A4 reference<input type="number" min="415" max="466" value="${state.preferences.a4ReferenceHz}" data-action="studio-a4"></label></div><div class="actions">${button('♪ Hear target','play-target')}${button(micOn?'Stop microphone':'Enable microphone','toggle-mic', '',micOn?'danger':'good')}${button('Capture 3 seconds','capture-pitch',micOn?'':'disabled','primary')}</div><p class="meter-hint">Listen to the target, then sing gently for three seconds. Quiet or unclear input will not be scored.</p>${pitchMeter()}</div></div><aside class="stack"><div class="card"><h3>Capture feedback</h3><div id="capture-feedback" class="${pitchResult?'score-line':'empty'}">${pitchResult?`${pitchResult.deviationCents>0?'+':''}${pitchResult.deviationCents.toFixed(1)} cents · ${pitchResult.voicedFrames} voiced samples · ${Math.round(pitchResult.confidence*100)}% pitch confidence`:'No capture yet. Turn on your mic, then sing for three seconds.'}</div><div class="actions">${button('Save as pitch practice','save-studio-pitch',pitchResult?'':'disabled','primary')}</div><p class="help-note">Your pitch is measured against the note you selected, not a recording of another singer.</p></div><div class="card"><h3>Listen before you sing</h3><p>Hear the note, imagine its sound, then hum it gently. Try a nearby note if the target feels uncomfortable. Small, relaxed repetitions are enough.</p></div></aside></div>`;}
function pitchMeter(){return `<div class="meter" aria-live="polite"><div id="live-note" class="note">—</div><div id="live-cents" class="cents">Microphone inactive</div><div id="live-frequency" class="frequency">${midiToNoteName(currentTargetMidi())} target: ${midiToFrequency(currentTargetMidi(),state.preferences.a4ReferenceHz).toFixed(1)} Hz</div></div><div class="canvas-wrap"><canvas id="pitch-canvas" width="700" height="190" aria-label="Live pitch deviation over time"></canvas></div>`;}
function scaleNotes(){return (SCALE_PATTERNS[studioScale]??SCALE_PATTERNS.major).map(step=>studioKey+step);}
function studioSolfegeView(){const notes=scaleNotes();return `<div class="split"><div class="card"><h3>Scale & solfège laboratory</h3><p>Transpose, listen, and sing by scale degree. Choose your comfortable starting note.</p><div class="control-row"><label class="field">Tonic<select data-action="scale-key">${[48,50,52,53,55,57,60,62,64,65,67].map(m=>`<option value="${m}" ${m===studioKey?'selected':''}>${midiToNoteName(m)}</option>`).join('')}</select></label><label class="field">Scale<select data-action="scale-type">${Object.keys(SCALE_PATTERNS).map(id=>`<option value="${id}" ${studioScale===id?'selected':''}>${id==='naturalMinor'?'Natural minor':id==='pentatonic'?'Major pentatonic':'Major scale'}</option>`).join('')}</select></label></div><div class="section">${staffSvg(notes.map(m=>({midi:m})))}</div><div class="melody-notes">${notes.map(m=>`<button class="note-pill" data-action="play-note" data-midi="${m}">${state.preferences.solfegeSystem==='fixed-do'?SOLFEGE[(m%12+12)%12]:SOLFEGE[((m-studioKey)%12+12)%12]} · ${midiToNoteName(m)}</button>`).join('')}</div><div class="actions">${button('▶ Play scale','play-scale','','primary')}${button('Play descending','play-descending')}</div></div><div class="card"><h3>Listening method</h3><p>Hear the tonic, silently imagine each scale degree, then sing it back using your preferred solfège system. Begin slowly and focus on relative pitch relationships rather than volume.</p><div class="warning">A scale demonstration is not a scored performance. Use the Pitch lab or a guided lesson for verified practice evidence.</div></div></div>`;}
const EAR_CHOICES=[['Minor third',3],['Major third',4],['Perfect fourth',5],['Perfect fifth',7]];
function earChoices(){const custom=currentLesson()?.quizIntervals;return Array.isArray(custom)&&custom.length===4?custom.map(steps=>[intervalName(steps),steps]):EAR_CHOICES;}
function newQuizPrompt(){return {answer:Math.floor(Math.random()*earChoices().length),answered:null};}
function studioEarView(){return `<div class="split"><div class="card"><h3>Hear the interval</h3><p>Listen to two sequential notes and identify their relationship. Your choice is scored only after an answer.</p>${earQuizView(false)}</div><div class="card"><h3>Session results</h3><div class="stat-card"><div class="num">${quizAnswers.filter(a=>a).length}<span style="font-size:16px;color:var(--soft)"> / ${quizAnswers.length||0}</span></div><div class="meta">CORRECT RESPONSES</div></div><p>Complete at least four prompts to save your ear-training result to the local progress journal.</p>${button('Save ear training result','save-studio-ear',quizAnswers.length>=4?'':'disabled','primary full')}</div></div>`;}
function earQuizView(inLesson){if(!quiz)quiz=newQuizPrompt();const options=earChoices();return `<div class="actions">${button('♫ Play mystery interval','play-interval','','primary')}${button('New interval','next-interval',quiz.answered===null?'disabled':'')}</div><div class="quiz-options">${options.map(([label],i)=>`<button class="quiz-option ${quiz.answered===i?(i===quiz.answer?'correct':'wrong'):''}" data-action="answer-interval" data-index="${i}" ${quiz.answered!==null?'disabled':''}>${safe(label)}</button>`).join('')}</div><div class="${quiz.answered===null?'help-note':quiz.answered===quiz.answer?'score-line':'warning'}">${quiz.answered===null?'Listen first, then choose an interval.':quiz.answered===quiz.answer?`Correct — ${options[quiz.answer][0]} spans ${options[quiz.answer][1]} semitones.`:`The interval was ${options[quiz.answer][0]}. Replay it and compare with your choice.`}</div><p class="help-note">Answers this session: ${quizAnswers.length}${inLesson?' (at least four required before saving)':''}</p>`;}
function theoryQuizView(lesson){const questions=lesson.quizQuestions||[];if(!questions.length)return '<div class="warning">This lesson has no quiz yet. Try another lesson.</div>';if(theoryIndex>=questions.length){const count=theoryAnswers.filter(Boolean).length;return `<div class="score-line"><strong>Quiz complete: ${count}/${questions.length}</strong><p>Your answers are ready to save to your journal.</p></div>`;}
 const question=questions[theoryIndex];return `<p class="small muted">QUESTION ${theoryIndex+1} OF ${questions.length}</p><h3>${safe(question.question)}</h3><div class="quiz-options">${question.options.map((answer,i)=>`<button class="quiz-option ${theorySelected===i?(i===question.answer?'correct':'wrong'):''}" data-action="answer-theory" data-index="${i}" ${theorySelected!==null?'disabled':''}>${safe(answer)}</button>`).join('')}</div>${theorySelected===null?'<p class="help-note">Choose one answer to continue.</p>':`<div class="${theorySelected===question.answer?'score-line':'warning'}">${theorySelected===question.answer?'Correct.':'Not quite.'} ${safe(question.explanation)}</div><div class="actions">${button(theoryIndex===questions.length-1?'Finish quiz':'Next question →','next-theory','','primary')}</div>`}`;}
function studioRhythmView(){return `<div class="split"><div class="card"><h3>Pulse & timing lab</h3><p>Start the metronome, tap the steady beat, and compare your taps to the beat grid. Use spacebar or click the pad.</p>${rhythmControls()}</div><div class="card"><h3>Your tap evidence</h3>${rhythmEvidence()}${button('Save rhythm result','save-studio-rhythm',rhythm.offsets.length>=4?'':'disabled','primary full')}</div></div>`;}
function rhythmControls(){return `<div class="control-row"><label class="field">Tempo (BPM)<input data-action="tempo-input" id="tempo-input" type="number" min="40" max="180" value="${rhythm.bpm||80}"></label><label class="field">Rhythm pattern<select data-action="rhythm-pattern">${Object.entries(RHYTHM_PATTERNS).map(([id,p])=>`<option value="${id}" ${rhythm.pattern===id?'selected':''}>${safe(p.label)}</option>`).join('')}</select></label><div class="row" style="align-self:end">${button(rhythm.on?'Stop metronome':'Start metronome','toggle-rhythm','',rhythm.on?'danger':'good')}${button('Clear taps','clear-taps')}</div></div><div style="margin-top:16px"><button class="tap-pad" data-action="tap-beat" ${rhythm.on?'':'disabled'}>TAP THE BEAT<span class="small">Spacebar works too</span></button></div>`;}
function rhythmEvidence(){const a=rhythm.offsets;const mae=a.length?a.reduce((s,x)=>s+Math.abs(x),0)/a.length:0;return `<div class="stat-card"><div class="num">${a.length}</div><div class="meta">CAPTURED TAPS</div></div><div class="score-line">${a.length?`Mean absolute timing error: ${mae.toFixed(1)} ms`:'Tap at least four beats to collect measurable evidence.'}</div><p class="help-note">${a.slice(-10).map(n=>`${n>0?'+':''}${Math.round(n)}ms`).join(' · ')||'No tap measurements yet.'}</p><p class="help-note">Browser scheduling and audio output latency may affect millisecond accuracy.</p>`;}
function keyboardHtml(){const whites=[48,50,52,53,55,57,59,60,62,64,65,67,69,71,72];const blacks=[49,51,54,56,58,61,63,66,68,70];return `<div class="keyboard"><div class="piano-keys">${whites.map(m=>`<button class="key white" style="width:${100/whites.length}%" data-action="play-note" data-midi="${m}" aria-label="Play ${midiToNoteName(m)}">${midiToNoteName(m)}</button>`).join('')}${blacks.map(m=>{const lower=whites.findIndex(w=>w===m-1);return `<button class="key black" style="left:${(lower+1)/whites.length*100}%" data-action="play-note" data-midi="${m}" aria-label="Play ${midiToNoteName(m)}">${midiToNoteName(m)}</button>`;}).join('')}</div></div>`;}
function studioKeyboardView(){return `<div class="card"><h3>Reference keyboard</h3><p>Tap notes to hear a synthesized reference. Use headphones if your speaker audio leaks into the microphone during pitch practice.</p>${keyboardHtml()}<div class="actions">${button('Play C major','play-c-major','','primary')}${button('Stop sound','stop-tone')}</div></div>`;}
function studioBuilderView(){
 return `<div class="split"><div class="card"><h3>Make your own practice drill</h3><p>Generate a repeatable exercise without an internet service. Patterns transpose to your chosen tonic. Use a comfortable singing range.</p><form id="drill-form" class="stack"><label class="field">Drill name<input name="title" required maxlength="100" value="My pattern"></label><div class="control-row"><label class="field">Starting note<select name="rootMidi">${Array.from({length:36},(_,i)=>48+i).map(m=>`<option value="${m}" ${m===60?'selected':''}>${midiToNoteName(m)}</option>`).join('')}</select></label><label class="field">Tempo<input name="bpm" type="number" min="40" max="200" value="80"></label></div><label class="field">Pattern<select name="pattern">${Object.keys(DRILL_PATTERNS).map(name=>`<option value="${name}">${safe(name.replace(/([A-Z])/g,' $1'))}</option>`).join('')}</select></label><button class="btn primary" type="submit">Save custom drill</button></form></div><div class="card"><h3>Personal drill library</h3>${state.customDrills.length?state.customDrills.map(d=>`<div class="timeline-item"><div class="badge-icon">♫</div><div style="flex:1"><h4>${clip(d.title,90)}</h4><p>${midiToNoteName(d.rootMidi)} · ${safe(d.pattern)} · ${d.bpm} BPM</p></div><div class="actions">${button('Play','play-custom-drill',`data-id="${d.id}"`,'sm')}${button('Delete','remove-custom-drill',`data-id="${d.id}"`,'sm danger')}</div></div>`).join(''):'<p>No custom drills yet. Create one with the form to begin.</p>'}<div class="help-note">Custom drills are playback aids, not measured evidence of singing proficiency.</div></div></div>`;
}
function studioGuideView(){
 return `<div class="split"><div class="card"><h3>Offline study guide</h3><p>Search explanations from your bundled music lessons. This is a deterministic local reference tool, not a generative voice or medical coach.</p><form id="guide-form" class="stack"><label class="field">Your question<textarea name="question" maxlength="300" required placeholder="How do I identify a major third?">${safe(guideQuestion)}</textarea></label><button class="btn primary" type="submit">Find an explanation</button></form></div><div class="card"><h3>Library-based answer</h3>${guideResponse?`<p style="white-space:pre-line">${safe(guideResponse.text)}</p><div class="divider"></div><strong>Related local topics</strong><div class="actions">${guideResponse.references.map(ref=>{const l=state.lessons.find(x=>x.slug===ref)||state.lessons.find(x=>x.skillSlug===ref);return l?button(clip(l.title,44),'guide-reference',`data-slug="${safe(l.slug)}"`,'sm'):''}).join('')}</div>`:'<p>Ask about a musical topic; explanations are grounded in the lessons installed with Vocal Studio.</p>'}</div></div>`;
}
function melodyFeedback(){
 if(melodyCapture)return `<div class="warning">Capturing a full phrase. Follow the score in time, with a light, comfortable voice.</div>`;
 if(!melodyResult)return `<p class="help-note">No full-phrase measurement yet. Use a quiet room and headphones for reference sound.</p>`;
 const r=melodyResult;return `<div class="${r.scorable?'score-line':'warning'}">${safe(r.reason)}${r.scorable?` · ${r.scorePercent}% average measured pitch-center score`:''} · ${r.coveragePercent}% note coverage</div><div class="melody-results">${r.noteResults.map(n=>`<div class="melody-result"><strong>${safe(n.note)}</strong><span>${n.scorable?`${n.cents>0?'+':''}${n.cents}¢ · ${n.scorePercent}%`:'No confident evidence'}</span></div>`).join('')}</div><p class="help-note">This checks pitch centers against expected notes, not vocal health, tone quality or expressive musical timing.</p>`;
}
function melodyLessonView(lesson){
 return `<p>Study the full phrase, then sing it at the shown tempo. Feedback uses confident microphone frames from <em>each</em> note; a partial phrase is not graded as a pass.</p><div class="row wrap"><span class="chip">${lesson.demonstrationNotes.length} notes</span><span class="chip">${lesson.targetBpm} BPM</span></div><div class="actions">${button(micOn?'Stop microphone':'Enable microphone','toggle-mic','','good')}${button('Capture complete phrase','capture-melody',micOn&&!melodyCapture?'':'disabled','primary')}</div>${pitchMeter()}${melodyFeedback()}`;
}
function libraryView(){return `<section class="intro"><div><h1>Library & repertoire</h1><p>Study musical phrases, collect practice routines, explore a compact music glossary, and optionally keep recordings privately on this device.</p></div></section><div class="filterbar">${[['repertoire','Repertoire'],['routines','Routines'],['glossary','Knowledge library'],['recordings','Voice recordings']].map(([id,label])=>`<button class="filter ${librarySection===id?'active':''}" data-action="library-section" data-section="${id}">${label}</button>`).join('')}</div>${librarySection==='repertoire'?repertoireView():librarySection==='routines'?routinesView():librarySection==='recordings'?recordingsView():glossaryView()}`;}
function repertoireView(){const item=state.repertoire.find(x=>x.id===selectedRepId)??state.repertoire[0];if(!item)return `<div class="card">No repertoire items yet.</div>`;
 return `<div class="split"><div class="stack"><div class="card"><div class="card-top"><h3>Study scores</h3><span class="chip">${state.repertoire.length} pieces</span></div>${state.repertoire.map(r=>`<button class="timeline-item" style="width:100%;text-align:left;color:var(--text)" data-action="select-rep" data-id="${r.id}"><div class="badge-icon">♬</div><div><h4>${clip(r.title,80)}</h4><p>${clip(r.composerOrTradition,80)}</p></div><span class="chip ${r.id===item.id?'success':''}">${r.id===item.id?'Selected':'Open'}</span></button>`).join('')}</div><div class="card"><h3>Add a personal study melody</h3><p>Enter note names with beat durations, for example: <code>C4:1 D4:1 E4:2 G4:2</code>. Your melody is stored on this device.</p><form id="repertoire-form" class="stack"><label class="field">Title<input required name="title" type="text" maxlength="120" placeholder="My melody"></label><label class="field">Composer / source<input name="composer" type="text" maxlength="150" placeholder="Personal exercise"></label><label class="field">Notes and durations<textarea required name="notes" placeholder="C4:1 D4:1 E4:2 G4:2"></textarea></label><button class="btn primary" type="submit">Add to local library</button></form><div class="divider"></div><h3>Import a MusicXML score</h3><p class="help-note">Supports a single monophonic part with pitched notes and beat durations (uncompressed .xml or .musicxml). Polyphony, rests and dynamics are deliberately rejected rather than silently discarded.</p><label class="field">MusicXML file<input id="musicxml-file" type="file" accept=".musicxml,.xml,text/xml,application/xml"></label>${button('Import MusicXML','import-musicxml','','good')}</div></div><div class="stack"><div class="card"><div class="card-top"><div><div class="track-tag">Selected repertoire</div><h3>${clip(item.title,90)}</h3></div></div><p>${clip(item.composerOrTradition,120)} · ${clip(item.originalKey,40)}</p>${staffSvg(transposeNotes(item.melodyNotes,item.currentTransposeSemitones))}<form id="repertoire-edit-form" class="stack" style="margin-top:16px"><input type="hidden" name="id" value="${item.id}"><div class="control-row"><label class="field">Transpose (semitones)<input type="number" name="transpose" min="-24" max="24" value="${item.currentTransposeSemitones}"></label><label class="field">Tempo<input type="number" name="bpm" min="30" max="240" value="${item.targetBpm}"></label></div><div class="control-row"><label class="field">Loop start (note)<input type="number" min="1" max="${item.melodyNotes.length}" name="loopStartNote" value="${item.loopStartNote||1}"></label><label class="field">Loop end (note)<input type="number" min="1" max="${item.melodyNotes.length}" name="loopEndNote" value="${item.loopEndNote||item.melodyNotes.length}"></label></div><label class="field">Interpretation and practice notes<textarea name="annotations" maxlength="4000">${safe(item.annotations)}</textarea></label><div class="actions"><button type="submit" class="btn primary">Save repertoire notes</button>${button('♫ Hear phrase','play-repertoire')}${button('Loop selected phrase ×2','play-repertoire-loop')}${button('Delete this piece','delete-repertoire',`data-id="${item.id}"`,'danger')}</div></form></div></div></div>`;}
function routinesView(){return `<div class="split"><div class="stack">${state.routines.map(r=>`<article class="card routine-card"><div class="card-top"><div><span class="track-tag">${safe(r.category==='Custom'?'PERSONAL ROUTINE':'GUIDED PRACTICE')}</span><h3>${clip(r.title)}</h3></div><span class="chip">${r.durationMinutes} min</span></div><p>${clip(r.description,240)}</p><div class="routine-preview">${r.stepsJson.slice(0,3).map((step,i)=>`<div><span class="step-mark">${i+1}</span><span>${clip(step,165)}</span></div>`).join('')}${r.stepsJson.length>3?`<span class="tiny muted">+ ${r.stepsJson.length-3} more steps</span>`:''}</div><div class="actions">${button('Start routine','start-routine',`data-id="${r.id}"`,'primary')}${r.category==='Custom'?button('Delete','delete-routine',`data-id="${r.id}"`,'sm ghost'):''}</div></article>`).join('')}</div><aside class="card routine-creator"><div class="track-tag">MAKE IT YOURS</div><h3>Create a routine</h3><p>Build a repeatable practice checklist. Save completed sessions in your journal.</p><form id="routine-form" class="stack"><label class="field">Routine name<input required name="title" maxlength="120" placeholder="My evening practice"></label><label class="field">Duration in minutes<input name="duration" type="number" min="1" max="90" value="12"></label><label class="field">Steps, one per line<textarea required name="steps" placeholder="Listen to a reference note&#10;Practise Do–Re–Mi&#10;Write a reflection"></textarea></label><button class="btn primary full" type="submit">Save routine</button></form></aside></div>`;}
function glossaryView(){const entries=CATALOG.glossary.filter(e=>[e.term,e.summary,e.category].some(str=>str?.toLowerCase().includes(searchTerm.toLowerCase())));return `<div class="card"><label class="field">Search musical concepts<input type="text" id="glossary-query" placeholder="Search pitch, rhythm, tuning, technique…" value="${safe(searchTerm)}"></label></div><div class="grid two section">${entries.length?entries.map(e=>`<div class="card">${trackTag(e.category||'MUSIC')}<h3 style="margin-top:10px">${clip(e.term)}</h3><p>${clip(e.summary,1300)}</p><div class="help-note">${clip(e.measurableVsSubjective,500)}</div></div>`).join(''):'<div class="empty">No results. Try a different term.</div>'}</div>`;}
function recordingContourSvg(points){
 if(!Array.isArray(points)||points.length<2)return '<p class="help-note">Insufficient confident voiced pitch to visualize. Silence and noisy notes are omitted.</p>';
 const values=points.map(p=>p.midi),low=Math.floor(Math.min(...values))-1,high=Math.ceil(Math.max(...values))+1;
 const width=440,height=115;
 const xs=i=>10+i/Math.max(1,points.length-1)*(width-20),ys=p=>height-10-(p.midi-low)/Math.max(1,high-low)*(height-20);
 const line=points.map((p,i)=>`${xs(i).toFixed(1)},${ys(p).toFixed(1)}`).join(' ');
 return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Measured recording pitch contour; ${points.length} confident pitched frames" class="contour-svg"><line x1="10" y1="${height-10}" x2="${width-10}" y2="${height-10}" stroke="#687d70"/><polyline points="${line}" fill="none" stroke="#b8dfae" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="tiny muted">Observed approximate pitch range: ${midiToNoteName(low)}–${midiToNoteName(high)}. Gaps, expression and tone quality are not evaluated.</div>`;
}
function recordingsView(){
 const chosen=[...comparisonIds].filter(id=>recordingAnalyses.has(id));
 const comparison=chosen.length===2?comparePitchContours(recordingAnalyses.get(chosen[0]).contour,recordingAnalyses.get(chosen[1]).contour):null;
 return `<div class="split"><div class="card"><div class="card-top"><h3>Private voice recordings</h3><span class="chip">${recordingItems.length} saved clips</span></div><p>Optional recording is separate from pitch tracking. Clips stay in browser-local storage and can be exported with your backup.</p><div class="warning">Recording analysis describes relative pitch movement only. It does not diagnose vocal technique, strain or vocal health.</div><div class="actions">${button(recordCtrl?'Stop & save recording':'Record 20-second clip',recordCtrl?'stop-recording':'start-recording',state.preferences.recordingConsentOptIn?'':'disabled',recordCtrl?'danger':'primary')}${button('Open privacy settings','tab','data-tab="settings"')}</div><p class="help-note">${state.preferences.recordingConsentOptIn?'Recording consent enabled. Your browser will still request permission.':'Enable optional personal recording in Settings first.'}</p><div class="divider"></div><h3>Import a personal audio file</h3><p class="help-note">Supported audio types depend on the browser. Importing a file is an explicit local action; it is not microphone recording.</p><label class="field">Choose a personal audio clip<input id="import-audio-file" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"></label><div class="actions">${button('Import audio locally','import-audio','','good')}</div><div class="divider"></div><h3>Compare melodic shapes</h3><p>Select two recordings that you have analysed to compare their <em>relative</em> pitch contours (the comparison ignores overall transposition).</p>${comparison&&comparison.comparable?`<div class="score-line">Shape resemblance: ${comparison.similarityPercent}% · average ${comparison.meanSemitoneDifference} semitones different</div>`:comparison?`<div class="warning">${safe(comparison.reason)}</div>`:'<p class="help-note">Analyse clips first, then select any two for comparison.</p>'}</div><div class="card"><h3>Saved clips</h3>${recordingItems.length?recordingItems.map(item=>{const analysis=recordingAnalyses.get(item.id);return `<div class="recording-item"><div><div class="strong small">${clip(item.name,80)}</div><div class="tiny muted">${moment(item.createdAt)} · ${(item.size/1024).toFixed(0)} KB</div></div><div class="row wrap">${button('Listen','listen-recording',`data-id="${safe(item.id)}"`,'sm')}${button(analysis?'Reanalyse':'Analyse pitch','analyse-recording',`data-id="${safe(item.id)}"`,'sm')}${button(comparisonIds.has(item.id)?'Selected':'Compare','select-comparison',`data-id="${safe(item.id)}" ${analysis?'':'disabled'}`,'sm')}${button('Download','download-recording',`data-id="${safe(item.id)}"`,'sm')}${button('Delete','delete-recording',`data-id="${safe(item.id)}"`,'danger sm')}</div><div data-recording-slot="${safe(item.id)}" style="width:100%"></div>${analysis?`<div class="recording-analysis"><p class="tiny muted">${analysis.contour.length} voiced measurements · ${analysis.durationSeconds} seconds</p>${recordingContourSvg(analysis.contour)}</div>`:''}</div>`;}).join(''):'<div class="empty">No recordings saved.</div>'}</div></div>`;
}
function openRoutine(id){
 const routine=state.routines.find(r=>r.id===Number(id));if(!routine)return;
 if(activeRoutineId!==null&&(routineChecked.size||routineReflection.trim())){showToast('Finish or close your current practice first.',true);return;}
 if(routineDraft){if(routineDraft.routineId===routine.id){resumeRoutine();return;}showToast('Resume or discard your saved practice from Today first.',true);return;}
 activeRoutineId=routine.id;routineChecked=new Set();routineReflection='';routineElapsed=0;routineStartedAt=performance.now();render();
 document.querySelector('.routine-dock [data-action="routine-close"]')?.focus();
}
function persistRoutineDraft(){
 clearTimeout(draftTimer);draftTimer=null;
 const routine=state.routines.find(r=>r.id===activeRoutineId);if(!routine)return draftQueue;
 if(!routineChecked.size&&!routineReflection.trim()){
  const cleared=draftQueue.then(()=>saveLocalValue('routine-draft',null)).then(()=>{routineDraft=null;});
  draftQueue=cleared.catch(()=>{});return cleared;
 }
 const draft=makeRoutineDraft(routine,{checked:[...routineChecked],reflection:routineReflection,elapsedSeconds:Math.min(86400,routineElapsed+Math.max(0,(performance.now()-routineStartedAt)/1000))});
 const pending=draftQueue.then(()=>saveRoutineDraft(draft,state.routines)).then(()=>{routineDraft=draft;});
 draftQueue=pending.catch(()=>{});return pending;
}
function scheduleRoutineDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>persistRoutineDraft().catch(fail),500);}
async function closeRoutine(){
 if(routineSaving)return;
 await persistRoutineDraft();activeRoutineId=null;routineChecked=new Set();routineReflection='';routineStartedAt=0;routineElapsed=0;render();
}
function resumeRoutine(){
 if(!routineDraft)return;
 const draft=readRoutineDraft(routineDraft,state.routines);if(!draft)throw Error('This saved practice no longer matches its routine.');
 activeRoutineId=draft.routineId;routineChecked=new Set(draft.checked);routineReflection=draft.reflection;routineElapsed=draft.elapsedSeconds;routineStartedAt=performance.now();render();
 document.querySelector('.routine-dock [data-action="routine-close"]')?.focus();
}
async function finishRoutine(reflection=routineReflection){
 if(routineSaving)return;routineSaving=true;clearTimeout(draftTimer);draftTimer=null;
 try{
  await draftQueue;
  const routine=state.routines.find(r=>r.id===activeRoutineId);if(!routine)throw Error('The selected routine is unavailable');
  const payload={routineId:routine.id,completedStepIndexes:[...routineChecked],reflection,elapsedSeconds:routineElapsed+Math.max(0,(performance.now()-routineStartedAt)/1000)};
  const pending=commitQueue.then(async()=>{const next=recordRoutineSession(state,payload);await saveStudioState(next,{completeRoutine:true});state=next;});
  commitQueue=pending.catch(()=>{});await pending;
  routineDraft=null;activeRoutineId=null;routineChecked=new Set();routineReflection='';routineElapsed=0;render();showToast('Practice added to your journal.');
 }finally{routineSaving=false;}
}
function routineDock(){const r=state.routines.find(x=>x.id===activeRoutineId);if(!r)return '';return `<aside class="routine-dock" role="dialog" aria-label="Practice session"><div class="dock-header"><div><h3>${clip(r.title)}</h3><p>${routineChecked.size} of ${r.stepsJson.length} steps · ${r.durationMinutes} min guide</p></div><button class="close-btn" aria-label="Close practice session" data-action="routine-close">×</button></div><form id="routine-session-form"><div class="dock-steps">${r.stepsJson.map((step,i)=>`<label class="routine-step ${routineChecked.has(i)?'checked':''}"><input type="checkbox" class="routine-step-input" value="${i}" ${routineChecked.has(i)?'checked':''}><span>${safe(step)}</span></label>`).join('')}</div><label class="field dock-reflection">Notes (optional)<textarea name="reflection" maxlength="2000" rows="2" id="routine-reflection" placeholder="What did you notice today?">${safe(routineReflection)}</textarea></label><div class="dock-actions"><span class="small muted">Notes save as you type. Drafts stay in this browser.</span><button type="submit" class="btn primary" ${routineChecked.size?'':'disabled'}>Save session</button></div></form></aside>`;}
function gameHistoryPanel(){
 const rounds=state.gameSessions||[];
 if(!rounds.length)return '';
 return `<section class="section card"><div class="section-header"><div><h2>Music game rounds</h2><p>Fun, microphone-play results. These are not lesson mastery scores.</p></div>${button('Play a game','tab','data-tab="games"','sm')}</div>${rounds.slice(0,12).map(g=>`<div class="attempt"><div><h4>${safe(GAME_MODES[g.mode]?.title||'Music game')}</h4><p>${g.correct} of ${g.total} challenges · ${safe(DIFFICULTIES[g.difficulty]?.title||g.difficulty)} · Microphone</p></div><div class="tiny activity-score"><strong>${g.score} points</strong><div class="muted">${moment(g.createdAt)}</div></div></div>`).join('')}</section>`;
}
function progressView(){const report=buildSkillReport(state),rows=state.skills.filter(s=>progressFilter==='all'||s.track===progressFilter);return `<section class="intro"><div><h1>Your learning journey</h1><p>Track which musical skills you have explored, demonstrated over time, or retained. Subjective observations are clearly identified.</p></div>${button('Export a backup','download-backup','','primary')}</section>${tiles()}<section class="section"><div class="section-header"><div><h2>Skill development</h2><p>Retained mastery requires multiple successful attempts on different days.</p></div></div><div class="filterbar"><button class="filter ${progressFilter==='all'?'active':''}" data-action="filter" data-filter="all">All skills</button>${Object.entries(trackLabels).map(([id,label])=>`<button class="filter ${progressFilter===id?'active':''}" data-action="filter" data-filter="${id}">${safe(label)}</button>`).join('')}</div><div class="grid two">${rows.map(s=>`<div class="card"><div class="row space">${trackTag(s.track)}<span class="chip ${s.masteryState==='retained'?'success':''}">${masteryLabel(s.masteryState)}</span></div><h3 style="margin-top:12px">${clip(s.title,120)}</h3><div class="row space small muted"><span>${s.attemptsCount} attempt${s.attemptsCount===1?'':'s'}</span><span>${state.attempts.some(a=>a.skillSlug===s.slug&&Number.isFinite(a.scorePercent))?`${s.accuracyPercent}% measured average`:'No measured score yet'}</span></div><div class="progress-rail" style="margin:10px 0 8px"><div class="progress-fill" style="width:${s.accuracyPercent}%"></div></div><div class="help-note">${clip(s.evidenceSummary,220)}</div></div>`).join('')}</div></section><section class="section card"><div class="section-header"><div><h2>Practice journal</h2><p>${report.totalAttempts} lesson attempts · ${(state.practiceSessions||[]).length} practice sessions · ${report.measuredAttempts} measured results</p></div></div>${(state.practiceSessions||[]).slice(0,50).map(session=>`<div class="attempt"><div><h4>${clip(session.routineTitle,120)}</h4><p>${session.completedSteps} of ${session.totalSteps} practice steps completed · Self-reported session</p>${session.reflection?`<p><em>${clip(session.reflection,220)}</em></p>`:''}</div><div class="tiny activity-score"><strong>${session.durationSeconds>=60?`${Math.floor(session.durationSeconds/60)} min`:'Practice'}</strong><div class="muted">${moment(session.createdAt)}</div></div></div>`).join('')}${state.attempts.length?state.attempts.slice(0,100).map(a=>`<div class="attempt"><div><h4>${clip(a.exerciseTitle,140)}</h4><p>${clip(a.evidenceNotes,450)}</p>${a.selfReflection?`<p><em>${clip(a.selfReflection,220)}</em></p>`:''}</div><div class="tiny" style="min-width:120px;text-align:right"><strong>${formatScore(a.scorePercent)}</strong><div class="muted">${moment(a.createdAt)}</div><div class="muted">${safe(a.source)}</div></div></div>`).join(''):(state.practiceSessions||[]).length?'':'<div class="empty">Your first completed lesson or routine will appear here.</div>'}</section>`;}
function settingsView(){const p=state.preferences;return `<section class="intro"><div><h1>Personal settings</h1><p>Customize the learning environment. Your preferences, skill history, and optional recordings stay on this device.</p></div></section><div class="split settings-layout"><div class="stack"><div class="card"><h3>Learning profile</h3><form class="stack" id="preferences-form" style="margin-top:15px"><label class="field">Learner name<input name="learnerName" maxlength="60" type="text" value="${safe(p.learnerName)}"></label><div class="control-row"><label class="field">Main learning focus<select name="activeGoalTrack">${Object.entries(trackLabels).map(([id,label])=>`<option value="${id}" ${p.activeGoalTrack===id?'selected':''}>${safe(label)}</option>`).join('')}</select></label><label class="field">Daily practice minutes<input name="dailyDurationMinutes" type="number" min="3" max="90" value="${p.dailyDurationMinutes}"></label></div><div class="control-row"><label class="field">Solfège system<select name="solfegeSystem"><option value="movable-do" ${p.solfegeSystem==='movable-do'?'selected':''}>Movable Do</option><option value="fixed-do" ${p.solfegeSystem==='fixed-do'?'selected':''}>Fixed Do</option></select></label><label class="field">A4 tuning reference (Hz)<input name="a4ReferenceHz" type="number" min="415" max="466" step="1" value="${p.a4ReferenceHz}"></label></div><div class="control-row"><label class="field">Comfortable low note<input name="comfortableLowNote" value="${safe(p.comfortableLowNote)}" type="text" maxlength="4"></label><label class="field">Comfortable high note<input name="comfortableHighNote" value="${safe(p.comfortableHighNote)}" type="text" maxlength="4"></label></div><div class="control-row"><label class="field">Voice comfort today<select name="vocalComfortStatus"><option value="comfortable" ${p.vocalComfortStatus==='comfortable'?'selected':''}>Comfortable</option><option value="mild-fatigue" ${p.vocalComfortStatus==='mild-fatigue'?'selected':''}>Mild fatigue — practise gently</option><option value="resting" ${p.vocalComfortStatus==='resting'?'selected':''}>Resting — no vocal exercises</option></select></label><label class="field">Interface appearance<select name="themeMode"><option value="dark" ${p.themeMode==='dark'?'selected':''}>Dark studio</option><option value="light" ${p.themeMode==='light'?'selected':''}>Light studio</option></select></label></div><label class="check"><input name="octaveEquivalence" type="checkbox" ${p.octaveEquivalence?'checked':''}><span>Treat notes in other octaves as equivalent when matching pitch (off by default)</span></label><label class="check"><input name="recordingConsentOptIn" type="checkbox" ${p.recordingConsentOptIn?'checked':''}><span>Allow optional personal audio recordings (disabled by default)</span></label><div class="control-row"><label class="field">Microphone input (optional)<select name="audioInputDeviceId"><option value="">System default</option>${audioDevices.map(d=>`<option value="${safe(d.deviceId)}" ${d.deviceId===p.audioInputDeviceId?'selected':''}>${safe(d.label||'Microphone')}</option>`).join('')}</select></label><label class="field">Audio latency adjustment (ms)<input name="latencyOffsetMs" type="number" min="-300" max="300" value="${p.latencyOffsetMs}"></label></div><p class="help-note">Input names may become available only after granting microphone permission. A timing adjustment changes how phrase frames align with notes; it is not an automatic calibration.</p><button class="btn primary" type="submit">Save preferences</button></form></div></div><div class="stack"><div class="card"><h3>Backups & control</h3><p>Download a portable JSON backup of lessons completed, skill progress, repertoire, routines, settings, and (optionally) saved voice clips.</p><label class="check"><input id="include-recordings" type="checkbox" checked>Include voice recordings in backup (up to 24 MB total)</label><div class="actions">${button('Download local backup','download-backup','','primary')}</div><div class="divider"></div><label class="field">Restore from a Vocal Studio backup file<input id="restore-file" type="file" accept=".json,application/json"></label><p class="help-note">Restoration requires confirmation. A backup containing recordings replaces the clip library; a progress-only backup keeps existing clips.</p>${button('Preview selected backup','restore-backup','','good')}<div class="divider"></div>${button('Delete all personal data','reset-data','','danger')}<p class="help-note">This deletes progress and recordings from this browser profile. Export a backup first if you need one.</p></div><div class="card"><h3>Storage health</h3><p>Check whether this browser can save and retrieve local learning data. Request stronger retention if your browser supports it.</p><div class="actions">${button(storageCheckRunning?'Checking storage…':'Check local storage','check-storage',storageCheckRunning?'disabled':'','primary')}${button('Request storage retention','retain-storage',storageCheckRunning?'disabled':'','good')}</div>${storageCheck?`<div class="${storageCheck.error?'warning':'score-line'}" role="status"><strong>${storageCheck.error?'Storage check failed':'Local read/write verified'}</strong><p>${storageCheck.error?safe(storageCheck.error):storageCheck.persisted===true?'Browser retention granted; local backups are still recommended.':storageCheck.persisted===false?'Data is saved locally, but the browser may remove it under storage pressure. Back up your progress regularly.':'Browser did not report a storage retention guarantee. Back up your progress regularly.'}</p>${storageCheck.quotaBytes?`<p class="small">Approx. ${Math.round((storageCheck.usageBytes||0)/1024/1024)} MB used of ${Math.round(storageCheck.quotaBytes/1024/1024)} MB available to this origin.</p>`:''}</div>`:''}<p class="help-note">This check uses a temporary entry, does not change your lessons or recordings, and does not upload anything. Only an exported backup protects you if the browser profile is deleted.</p></div><div class="card"><h3>Audio privacy</h3><p>Live pitch detection processes microphone samples in memory. Samples are not retained as recordings. Optional clips use browser-local storage and are deleted only when you choose.</p><p>Before your first pitch lesson, check that the correct input is receiving sound. This only examines live sample levels and frequency confidence, and never saves voice.</p><div class="actions">${button(deviceCheckRunning?'Checking input…':'Check input for 3 seconds','check-device',deviceCheckRunning?'disabled':'','primary')}${button('Hear test tone','test-speaker','','good')}${micOn?button('Stop live monitoring','toggle-mic','','danger'):''}</div>${deviceCheck?`<div class="${deviceCheck.status==='pitched'?'score-line':'warning'}" role="status"><strong>${deviceCheck.status==='pitched'?'Pitch detected':deviceCheck.status==='silent'?'Input is quiet':'Input check'}</strong><p>${safe(deviceCheck.message)}</p><div class="small">Signal ${deviceCheck.signalPercent}% · ${deviceCheck.voicedFrames}/${deviceCheck.frames} confident pitch frames${deviceCheck.medianHz?` · approx. ${deviceCheck.medianHz} Hz`:''}</div></div>`:''}<p class="help-note">Hum gently or sustain a comfortable note during the check. Sound output and microphone input are tested separately. Browser permissions are required at <code>http://127.0.0.1</code>.</p></div></div></div>`;}
function lessonModal(){const l=currentLesson();if(!l)return '';return `<div class="lesson-modal" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="lesson-title" class="lesson-dialog"><div class="dialog-header"><div>${trackTag(l.track)}<h2 id="lesson-title">${safe(l.title)}</h2><div class="row wrap"><span class="chip">Stage ${l.stage}</span><span class="chip">${l.durationMinutes} min</span><span class="chip">${safe(l.keySignature)}</span></div></div><button class="close-btn" aria-label="Close lesson" data-action="close-lesson">×</button></div><div class="heading-rule"></div><div class="dialog-grid"><div class="stack"><div class="card"><h3>What you will learn</h3><p>${safe(l.objective)}</p><div class="heading-rule"></div><h3>Listen, understand, practise</h3><p>${safe(l.explanation)}</p>${['pitch-match','solfege-sing','sight-sing','guided-reflection'].includes(l.interactionType)?`<div class="warning">${safe(l.vocalSafetyNote)}</div>`:''}<div class="divider"></div><div class="track-tag">Musical demonstration</div>${l.interactionType==='melody-dictation'&&theoryIndex<l.quizQuestions.length?'<div class="warning">Notation and note names are hidden until you complete the listening quiz.</div>':staffSvg(l.demonstrationNotes)}<div class="melody-notes">${l.interactionType==='melody-dictation'&&theoryIndex<l.quizQuestions.length?'':l.demonstrationNotes.map((n,i)=>`<button class="note-pill ${i===activeNote?'active':''}" data-action="lesson-note" data-index="${i}">${safe(solfegeForMidi(n.midi,l.keySignature,state.preferences.solfegeSystem))} · ${safe(n.note)}</button>`).join('')}</div><div class="actions">${button('▶ Hear phrase','play-lesson-phrase','','primary')}${button('♪ Hear selected note','play-target')}</div></div><div class="card"><h3>Practice cues</h3>${l.hints.map(h=>`<p>• ${safe(h)}</p>`).join('')||'<p>Go slowly and focus on comfortable, accurate musical listening.</p>'}</div></div><div class="stack"><div class="card"><div class="card-top"><h3>Try it yourself</h3></div>${lessonInteraction(l)}<div class="divider"></div><label class="field">Practice reflection (optional)<textarea id="lesson-reflection" placeholder="What felt easy? What should you work on next?" maxlength="2000">${safe(lessonReflection)}</textarea></label><div class="actions">${button('Save practice','save-lesson',lessonSaved?'disabled':'','primary full')}</div>${lessonSaved?'<div class="score-line">Saved to your personal learning journal.</div>':''}</div></div></div></section></div>`;}
function lessonInteraction(l){if(l.interactionType==='guided-reflection'){return `<p>Reflect on what you genuinely notice. These are personal observations, not automatic technical measurements.</p>${['Practised at a comfortable volume and range','Breathing and posture felt relaxed','Stopped or adjusted when tired','Can explain the main learning objective'].map((txt,i)=>`<label class="check"><input type="checkbox" class="reflection-check" value="${i}" ${reflectionChecks.has(i)?'checked':''}><span>${txt}</span></label>`).join('')}<p class="help-note">Select at least one observation before saving.</p>`;}
 if(['theory-quiz','melody-dictation'].includes(l.interactionType))return `<p>Check your understanding with four scored questions. Only answers you select are counted.</p>${theoryQuizView(l)}`;
 if(l.interactionType==='interval-ear')return `<p>Answer four interval prompts. Every answer is recorded from your own choices.</p>${earQuizView(true)}`;
 if(['sight-sing','solfege-sing'].includes(l.interactionType))return melodyLessonView(l);
 if(l.interactionType==='rhythm-tap')return `<p>Start the beat, then tap at least four times. This measures your actual on-screen tap timing.</p>${rhythmControls()}${rhythmEvidence()}`;
 return `<p>Sing the selected note from the demonstration. First enable the microphone, then capture three seconds of real voice. This measures one note at a time, not an entire phrase or vocal technique.</p><div class="actions">${button(micOn?'Stop microphone':'Enable microphone','toggle-mic','',micOn?'danger':'good')}${button('Capture note','capture-pitch',micOn?'':'disabled','primary')}</div><div class="section">${pitchMeter()}</div><div id="capture-feedback" class="${pitchResult?'score-line':'help-note'}">${pitchResult?`Verified: ${pitchResult.deviationCents.toFixed(1)} cents, ${pitchResult.voicedFrames} voiced frames`:'No verified microphone capture yet.'}</div>`;}
function stopRhythm(){if(rhythm.timer){clearInterval(rhythm.timer);rhythm.timer=null;}rhythm.on=false;}
function startRhythm(){stopRhythm();rhythm.bpm=clamp(Number(document.getElementById('tempo-input')?.value)||rhythm.bpm||80,40,180);const beatMs=60000/rhythm.bpm;rhythm.epoch=performance.now();rhythm.on=true;audio.click(true);let count=1;rhythm.timer=setInterval(()=>{audio.click(count%4===0);count++;},beatMs);render();}
function tapBeat(){if(!rhythm.on)return;const now=performance.now();const delta=rhythmTapOffset(now,rhythm.epoch,rhythm.bpm,rhythm.pattern,state.preferences.latencyOffsetMs);rhythm.offsets.push(Math.round(delta*10)/10);if(rhythm.offsets.length>64)rhythm.offsets.shift();render();}
async function startMicrophone(){try{await audio.startMic(state.preferences.audioInputDeviceId);await refreshAudioDevices();micOn=true;micHistory=[];pitchResult=null;micTimer=setInterval(tickMic,90);render();showToast('Microphone enabled. Audio is analyzed only on this device.');}catch(err){micOn=false;fail(err);}}
function stopMicrophone(){if(melodyTimeout)clearTimeout(melodyTimeout);melodyTimeout=null;melodyCapture=null;if(micTimer)clearInterval(micTimer);micTimer=null;micOn=false;pitchCapture=null;audio.stopMic();render();}
function tickMic(){if(!micOn)return;const raw=audio.sample();const timestamp=performance.now();micHistory.push({...raw,time:timestamp});micHistory=micHistory.filter(x=>x.time>=timestamp-15_000);
 if(pitchCapture&&timestamp>=pitchCapture.started&&raw.hz>0&&raw.confidence>=.68)pitchCapture.samples.push({...raw,time:timestamp});
 if(melodyCapture&&timestamp>=melodyCapture.startAt)melodyCapture.frames.push({...raw,time:timestamp});
 updatePitchUI();
}
function updatePitchUI(){const latest=micHistory.at(-1),midi=currentTargetMidi(),target=midiToFrequency(midi,state.preferences.a4ReferenceHz);const score=evaluatePitch(latest,target,{toleranceCents:20,octaveEquivalence:state.preferences.octaveEquivalence});
 for(const el of document.querySelectorAll('#live-note'))el.textContent=score.scorable?score.detectedNote:'—';
 for(const el of document.querySelectorAll('#live-cents')){el.textContent=!micOn?'Microphone inactive':!score.scorable?'Listening · no confident voice':`${score.cents>0?'+':''}${score.cents.toFixed(1)} cents ${score.inTune?'· IN TUNE':''}`;el.className=`cents ${score.inTune?'good':''}`;}
 for(const el of document.querySelectorAll('#live-frequency'))el.textContent=`Target ${midiToNoteName(midi)} · ${target.toFixed(1)} Hz${latest?.hz?` | Detected ${latest.hz.toFixed(1)} Hz`:''}`;
 for(const canvas of document.querySelectorAll('#pitch-canvas')){const c=canvas.getContext('2d');if(!c)continue;const w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.fillStyle='#112019';c.fillRect(0,0,w,h);const center=h/2;
 c.fillStyle='rgba(121,179,134,.18)';c.fillRect(0,center-20,w,40);for(let off=-60;off<=60;off+=20){const y=center-off/60*(h*.44);c.strokeStyle=off===0?'#d3ae73':'#31463a';c.lineWidth=off===0?2:1;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 const points=micHistory.slice(-160);if(points.length){c.strokeStyle='#b8dfae';c.lineWidth=2.2;c.beginPath();let begun=false;points.forEach((p,i)=>{const evaled=evaluatePitch(p,target,{octaveEquivalence:state.preferences.octaveEquivalence});if(!evaled.scorable){begun=false;return;}const x=i/Math.max(1,points.length-1)*w,y=center-clamp(evaled.cents,-60,60)/60*(h*.44);if(!begun){c.moveTo(x,y);begun=true;}else c.lineTo(x,y);});c.stroke();}}
 }
async function capturePitch(){if(state.preferences.vocalComfortStatus==='resting')throw Error('Vocal rest is selected; use listening, rhythm, or theory exercises instead.');if(!micOn){showToast('Enable the microphone before capturing.',true);return;}if(pitchCapture){showToast('A capture is already running.');return;}pitchResult=null;const targetMidi=currentTargetMidi();audio.tone(targetMidi,{duration:.4,a4:state.preferences.a4ReferenceHz});showToast(`Listen, then sing ${midiToNoteName(targetMidi)} for three seconds…`);pitchCapture={started:performance.now()+620,samples:[],targetMidi};render();setTimeout(()=>{
 const capture=pitchCapture;if(!capture||capture.targetMidi!==targetMidi)return;pitchCapture=null;const target=midiToFrequency(targetMidi,state.preferences.a4ReferenceHz);const voiced=capture.samples.map(p=>({...evaluatePitch(p,target,{octaveEquivalence:state.preferences.octaveEquivalence}),time:p.time})).filter(p=>p.scorable&&Math.abs(p.cents)<=2400);
 if(voiced.length<12){pitchResult=null;showToast(`Not enough confident voiced samples (${voiced.length}/12). Try a quieter room and sustained note.`,true);render();return;}
 const ordered=voiced.map(x=>x.cents).sort((a,b)=>a-b),mid=Math.floor(ordered.length/2);const median=ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;const confidence=voiced.reduce((s,x)=>s+x.confidence,0)/voiced.length;
 pitchResult={source:'microphone',targetMidi,voicedFrames:voiced.length,confidence,deviationCents:median,targetNote:midiToNoteName(targetMidi)};
 render();showToast('Verified microphone pitch capture ready to save.');
 },3850);
}
async function captureMelody(){
 const lesson=currentLesson();if(!lesson||!['sight-sing','solfege-sing'].includes(lesson.interactionType))throw Error('Open a sight-singing or solfège phrase first');
 if(!micOn)throw Error('Enable your microphone first');if(melodyCapture)throw Error('A melody capture is already active');
 if(state.preferences.vocalComfortStatus==='resting')throw Error('Vocal rest is selected in Settings; choose a listening exercise instead');
 melodyResult=null;const durationMs=lesson.demonstrationNotes.reduce((sum,n)=>sum+n.durationBeats,0)*60000/lesson.targetBpm;
 const capture={lessonSlug:lesson.slug,notes:lesson.demonstrationNotes.map(n=>({...n})),bpm:lesson.targetBpm,startAt:performance.now()+950,frames:[]};
 melodyCapture=capture;audio.tone(capture.notes[0].midi,{duration:.3,a4:state.preferences.a4ReferenceHz});
 // A quiet click track provides the expected note timing; headphone use prevents leakage.
 const beats=Math.ceil(capture.notes.reduce((sum,n)=>sum+n.durationBeats,0));
 for(let beat=0;beat<beats;beat++)audio.tone(beat%4===0?84:79,{startAt:.95+beat*60/lesson.targetBpm,duration:.04,volume:.045,type:'triangle',a4:state.preferences.a4ReferenceHz});
 render();showToast(`Reference sounded. Begin the ${Math.ceil(durationMs/1000)}-second phrase after the cue.`);
 melodyTimeout=setTimeout(()=>{
  if(melodyCapture!==capture)return;melodyCapture=null;melodyTimeout=null;
  melodyResult=scoreMelodyPerformance({notes:capture.notes,bpm:capture.bpm,startAt:capture.startAt,frames:capture.frames,a4:state.preferences.a4ReferenceHz,latencyOffsetMs:state.preferences.latencyOffsetMs});
  render();showToast(melodyResult.scorable?'Phrase measured. Review individual notes and save your attempt.':'Not enough confident pitch data for a full phrase. Try again.',!melodyResult.scorable);
 },durationMs+1050);
}
function playInterval(){if(!quiz)quiz=newQuizPrompt();const steps=earChoices()[quiz.answer][1];audio.tone(60,{duration:.55,a4:state.preferences.a4ReferenceHz});audio.tone(60+steps,{duration:.8,startAt:.73,a4:state.preferences.a4ReferenceHz});}
async function saveAttempt(payload){await commit(s=>recordAttempt(s,payload));showToast('Learning evidence saved locally.');}
function getPitchPayload(lesson){if(!pitchResult||pitchResult.targetMidi!==currentTargetMidi())throw Error('Capture the currently selected note using your microphone first');return {lessonSlug:lesson.slug,kind:'pitch',source:'microphone',voicedFrames:pitchResult.voicedFrames,confidence:pitchResult.confidence,deviationCents:pitchResult.deviationCents,targetNote:pitchResult.targetNote,durationSeconds:4};}
async function saveLesson(){const lesson=currentLesson();if(!lesson||lessonSaved||savingLesson)return;savingLesson=lesson.slug;try{const reflection=lessonReflection;let payload;
 if(lesson.interactionType==='guided-reflection'){const checked=reflectionChecks.size;payload={kind:'reflection',checked,total:4};}
 else if(lesson.interactionType==='interval-ear'){if(quizAnswers.length<4)throw Error('Answer at least four intervals before saving');payload={kind:'ear',correct:quizAnswers.filter(Boolean).length,total:quizAnswers.length};}
 else if(lesson.interactionType==='rhythm-tap'){payload={kind:'rhythm',pattern:rhythm.pattern,offsetsMs:[...rhythm.offsets]};}
 else if(['theory-quiz','melody-dictation'].includes(lesson.interactionType)){if(theoryIndex<lesson.quizQuestions.length)throw Error('Complete all knowledge questions before saving');payload={kind:'knowledge',correct:theoryAnswers.filter(Boolean).length,total:theoryAnswers.length};}
 else if(['sight-sing','solfege-sing'].includes(lesson.interactionType)){if(!melodyResult?.scorable)throw Error('Capture a scorable complete melody first');payload={kind:'melody',source:'microphone',noteResults:melodyResult.noteResults};}
 else payload=getPitchPayload(lesson);
 await saveAttempt({...payload,lessonSlug:lesson.slug,reflection,durationSeconds:lesson.durationMinutes*60});if(lessonSlug===lesson.slug)lessonSaved=true;render();}finally{savingLesson=null;}}
async function saveStudioPitch(){const lesson=state.lessons.find(x=>x.interactionType==='pitch-match');if(!lesson)throw Error('Pitch lesson unavailable');await saveAttempt({...getPitchPayload(lesson),lessonSlug:lesson.slug});pitchResult=null;render();}
async function saveStudioEar(){const lesson=state.lessons.find(x=>x.interactionType==='interval-ear');if(quizAnswers.length<4)throw Error('Answer four interval prompts first');await saveAttempt({lessonSlug:lesson.slug,kind:'ear',correct:quizAnswers.filter(Boolean).length,total:quizAnswers.length});quizAnswers=[];quiz=newQuizPrompt();render();}
async function saveStudioRhythm(){const lesson=state.lessons.find(x=>x.interactionType==='rhythm-tap');await saveAttempt({lessonSlug:lesson.slug,kind:'rhythm',pattern:rhythm.pattern,offsetsMs:[...rhythm.offsets]});rhythm.offsets=[];render();}
async function downloadBackup(){await commitQueue;const include=(document.getElementById('restore-include-recordings')??document.getElementById('include-recordings'))?.checked??true;const saved=hydrateState(await loadStudioState());const bundle=await createPortableBackup(saved,{includeRecordings:include});const contents=JSON.stringify(bundle,null,2);const blob=new Blob([contents],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`vocal-studio-personal-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);showToast('Portable local backup downloaded.');}
async function verifyStorage({requestRetention=false}={}){
 if(storageCheckRunning)return;
 storageCheckRunning=true;render();
 try{
  // Ask during the user-initiated click, before asynchronous storage probing.
  const retentionPromise=requestRetention?requestLocalPersistence():null;
  const result=await checkLocalStorage();
  const retention=retentionPromise?await retentionPromise:null;
  storageCheck={...result,persisted:retention===null?result.persisted:retention};
  showToast('Browser-local data read and write verified.');
 }catch(error){storageCheck={error:error?.message||'Local storage unavailable'};throw error;}
 finally{storageCheckRunning=false;render();}
}
async function checkDeviceInput(){
 if(deviceCheckRunning)return;
 if(recordCtrl)throw Error('Finish your voice recording before checking the microphone');
 deviceCheckRunning=true;deviceCheck=null;render();
 try{
  deviceCheck=await runDeviceSignalCheck(audio,{deviceId:state.preferences.audioInputDeviceId,reuseActiveMic:micOn});
  await refreshAudioDevices();
  showToast(deviceCheck.status==='pitched'?'Microphone pitch detected.':deviceCheck.status==='silent'?'Very low microphone input detected.':'Microphone check complete.',deviceCheck.status!=='pitched');
 }finally{deviceCheckRunning=false;render();}
}
async function downloadPersonalRecording(id){
 const record=await getRecording(id);if(!record)throw Error('Recording no longer exists');
 const url=URL.createObjectURL(record.blob),link=document.createElement('a');
 link.href=url;link.download=recordingFilename(record);document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
 showToast('Recording downloaded to your computer.');
}
async function refreshAudioDevices(){try{
 audioDevices=await audio.availableInputs();
 if(tab!=='settings')return;
 // Updating device choices must not replace the entire settings form: its other
 // fields may contain unsaved edits made while device enumeration was pending.
 const selector=document.querySelector('#preferences-form select[name="audioInputDeviceId"]');
 if(!selector)return;
 const selected=selector.value;
 const defaultOption=document.createElement('option');defaultOption.value='';defaultOption.textContent='System default';
 const options=audioDevices.map(device=>{
  const option=document.createElement('option');option.value=device.deviceId;option.textContent=device.label||'Microphone';return option;
 });
 selector.replaceChildren(defaultOption,...options);
 selector.value=selected;
}catch{audioDevices=[];}}
async function refreshRecordings(){recordingItems=await listRecordings();if(tab==='library'&&librarySection==='recordings')render();}
async function startVoiceRecording(){
 if(!state.preferences.recordingConsentOptIn)throw Error('Enable optional personal recording in Settings first');
 if(pendingRecording)throw Error('Save or download your unsaved clip before recording again.');
 if(recordCtrl||recordingStarting)return;recordingStarting=true;
 let recording;
 try{recording=await audio.recordVoice({maxSeconds:20});}catch(err){if(!micOn)audio.stopMic();throw err;}finally{recordingStarting=false;}
 const version=++recordingVersion;recordCtrl=recording;showToast('Recording began. It stops automatically after 20 seconds.');render();
 recordingSave=recording.result.then(async blob=>{
  if(!micOn)audio.stopMic();if(version!==recordingVersion)return;recordCtrl=null;
  if(blob.size){pendingRecording={blob,name:`Voice practice · ${new Date().toLocaleString()}`,type:blob.type};await retryRecordingSave();}
  else showToast('No usable recording was captured.',true);
  render();
 }).catch(err=>{if(!micOn)audio.stopMic();if(version===recordingVersion){recordCtrl=null;fail(err,true);render();}});
}
async function retryRecordingSave(){
 if(!pendingRecording||recordingSaving)return;recordingSaving=true;const clip=pendingRecording;
 try{
  await saveRecording(clip.blob,clip.name);pendingRecording=null;
  await refreshRecordings();saveError='';showToast('Voice clip saved on this device.');render();
 }finally{recordingSaving=false;}
}
function sessionNotice(){
 if(restoring&&!restoreSelection)return '<p class="warning" role="status">Clearing your studio…</p>';
 if(pendingRecording)return `<section class="recovery-bar" role="alert"><div><h2>Your voice clip is not saved yet</h2><p>Keep this tab open. Try saving again or download the clip before leaving.</p></div><div class="actions">${button('Try saving again','recording-retry','','primary')}${button('Download clip','recording-download')}${button('Discard clip','recording-discard')}</div></section>`;
 if(!booted||writer.writable)return '';
 return `<section class="recovery-bar" role="status"><div><h2>This tab is read-only</h2><p>To protect your progress, use one studio tab at a time. Close the other tab, then continue here. A current browser with Web Locks support is required to save.</p></div>${button('Continue here','continue-here','','primary')}</section>`;
}
function setupView(){
 if(!setupOpen)return `<div class="setup-invite"><span>${setupDismissed?'Need to adjust your sound or range?':'New here? Take a moment to set up your studio.'}</span>${button(setupDismissed?'Studio setup':'Set up my studio','setup-open','','sm ghost')}</div>`;
 const p=state.preferences;
 return `<section class="setup-panel" aria-labelledby="setup-title"><div class="section-header"><h2 id="setup-title" tabindex="-1">Make yourself comfortable</h2>${button('Close setup','setup-open','','sm ghost')}</div><p>Your progress stays in this browser. Download a backup from Settings when you want a copy. These checks are optional.</p><div class="setup-audio"><div><h3>Check your sound</h3><p>Use headphones if you can. Listen first, then hum gently to check your microphone.</p><div class="actions">${button('Hear test tone','test-speaker')}${button(deviceCheckRunning?'Checking input…':'Check microphone','check-device',deviceCheckRunning?'disabled':'')}</div>${deviceCheck?`<p role="status">${safe(deviceCheck.message)}</p>`:''}<p class="help-note">The microphone check does not save your voice or assess vocal health.</p></div><form id="setup-form" class="stack"><h3>Choose your starting point</h3><div class="control-row"><label class="field">Comfortable low note<input type="text" name="comfortableLowNote" maxlength="4" value="${safe(p.comfortableLowNote)}" required></label><label class="field">Comfortable high note<input type="text" name="comfortableHighNote" maxlength="4" value="${safe(p.comfortableHighNote)}" required></label></div><p class="help-note">Use note names such as C3 and G4. This is a comfortable practice range, not your maximum range.</p><label class="field">What would you like to work on?<select name="activeGoalTrack">${Object.entries(trackLabels).map(([id,label])=>`<option value="${id}" ${p.activeGoalTrack===id?'selected':''}>${safe(label)}</option>`).join('')}</select></label><button type="submit" class="btn primary">Save my starting point</button></form></div><div class="actions">${button('Done for now','setup-dismiss')}${button('More audio settings','tab','data-tab="settings"','ghost')}</div></section>`;
}
function restorePreviewView(){
 const s=restoreSelection.summary;
 return `<div class="lesson-modal"><section class="lesson-dialog restore-dialog" role="dialog" aria-modal="true" aria-labelledby="restore-title"><h2 id="restore-title" tabindex="-1">Restore this backup?</h2><p>Your current progress, repertoire, routines, drills, and preferences will be replaced. Unfinished practice will be cleared.</p><dl class="restore-counts"><div><dt>Lesson attempts</dt><dd>${s.attempts}</dd></div><div><dt>Practice sessions</dt><dd>${s.sessions}</dd></div><div><dt>Pieces</dt><dd>${s.repertoire}</dd></div><div><dt>Routines</dt><dd>${s.routines}</dd></div></dl><p class="${s.replacesRecordings?'warning':'score-line'}">${s.replacesRecordings?`Your recording library will be replaced with ${s.recordings} clips from this backup.`:'Your saved recordings will be kept.'}</p>${s.exportedAt?`<p class="help-note">Backup date: ${safe(new Date(s.exportedAt).toLocaleString())}</p>`:''}<p>Want a copy of your current studio first? Download a backup before restoring. If audio exceeds 24 MB, export progress without audio and download clips separately.</p><label class="check"><input id="restore-include-recordings" type="checkbox" checked> Include recordings in the current-studio download</label><div class="actions">${button('Download current backup','download-backup',restoring?'disabled':'')}${button('Cancel','restore-cancel',restoring?'disabled':'')}${button(restoring?'Restoring…':'Restore this backup','restore-apply',restoring?'disabled':'','danger')}</div></section></div>`;
}
async function resetStudio(){
 if(restoring)return;writer.assert();
 if(recordingStarting||deviceCheckRunning||gameStarting||recordingSaving||routineSaving||savingLesson)throw Error('Wait for the current audio setup or save to finish before deleting data.');
 restoring=true;render();
 try{
  recordingVersion++;recordCtrl?.stop();recordCtrl=null;leaveGame();closeLesson();audio.stopMic();audio.stopTones();
  clearTimeout(draftTimer);draftTimer=null;await draftQueue;await recordingSave;await commitQueue;
  state=await clearPersonalData();pendingRecording=null;routineDraft=null;activeRoutineId=null;routineChecked=new Set();routineReflection='';routineElapsed=0;
  setupDismissed=false;setupOpen=false;recordingItems=[];recordingAnalyses.clear();comparisonIds.clear();filter='all';selectedRepId=state.repertoire[0]?.id??1;
  saveError='';showToast('All personal data deleted.');
 }finally{restoring=false;render();}
}
async function applyRestore(){
 if(!restoreSelection||restoring)return;writer.assert();if(recordingStarting||deviceCheckRunning||gameStarting||recordingSaving||routineSaving||savingLesson)throw Error('Wait for the current audio setup or save to finish before restoring.');restoring=true;render();
 try{
  clearTimeout(draftTimer);draftTimer=null;await draftQueue;
  if(recordCtrl){await recordCtrl.stop();recordCtrl=null;}
  await recordingSave;if(pendingRecording)throw Error('Save your unsaved clip, or download and discard it before restoring.');recordingVersion++;leaveGame();closeLesson();audio.stopTones();audio.stopMic();await commitQueue;
  state=await restorePortableBackup(restoreSelection.bundle);
  routineDraft=null;activeRoutineId=null;routineChecked=new Set();routineReflection='';routineElapsed=0;
  recordingAnalyses.clear();comparisonIds.clear();recordingItems=await listRecordings();selectedRepId=state.repertoire[0]?.id??1;restoreSelection=null;
  showToast('Your backup has been restored.');
 }finally{restoring=false;render();if(restoreSelection)document.getElementById('restore-title')?.focus();else document.querySelector('[data-action="restore-backup"]')?.focus();}
}
async function handleClick(event){const el=event.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;
 if(action==='modal-backdrop'){if(event.target===el){closeLesson();render();}return;}
 if(['tap-beat','toggle-rhythm'].includes(action))event.preventDefault();
 try{
 if(restoring&&action!=='dismiss-error')return;
 if(routineSaving&&['routine-close','routine-resume','routine-discard','delete-routine','start-routine'].includes(action))return;
 if(booted&&!writer.writable&&!['tab','continue-here','dismiss-error','download-backup','download-recording','lesson','close-lesson','setup-open','filter','academy-more','academy-clear','studio-mode','library-section','select-rep','play-note','play-target','play-scale','play-descending','play-c-major','stop-tone','play-lesson-phrase','play-repertoire','play-repertoire-loop','test-speaker','guide-reference'].includes(action))writer.assert();
 switch(action){
  case 'tab':setTab(el.dataset.tab);break;
  case 'game-select':{selectedGame=el.dataset.game in GAME_MODES?el.dataset.game:selectedGame;render();const heading=document.getElementById('arcade-selected-title');heading?.focus?.({preventScroll:true});heading?.scrollIntoView?.({block:'nearest'});break;}
  case 'game-start':await beginGame();break;
  case 'game-restart':await beginGame();break;
  case 'game-quit':leaveGame();render();break;
  case 'game-focus':gameFocus=!gameFocus;render();document.querySelector('[data-action=game-focus]')?.focus?.({preventScroll:true});break;
  case 'game-hear':if(game?.mode!=='rhythm-river'){gameHear();render();}break;
  case 'game-hear-pattern':if(game?.mode==='echo-cave'){gameHear();render();}break;
  case 'game-count-in':if(game?.mode==='rhythm-river'){gameHear();render();}break;
  case 'game-key':gameKeyInput(Number(el.dataset.midi));break;
  case 'game-tap':gameKeyInput(null,'tap');break;
  case 'game-pause':await pauseGame();break;
  case 'game-resume':await resumeGame();break;
  case 'filter':if(tab==='progress')progressFilter=el.dataset.filter;else{filter=el.dataset.filter;academyLimit=12;}render();break;
  case 'academy-more':academyLimit+=12;render();break;
  case 'academy-clear':academyQuery='';academyStage='all';academyReadyOnly=false;filter='all';academyLimit=12;render();break;
  case 'open-routines':librarySection='routines';setTab('library');break;
  case 'start-routine':openRoutine(el.dataset.id);break;
  case 'routine-close':await closeRoutine();break;
  case 'routine-resume':resumeRoutine();break;
  case 'routine-discard':if(confirm('Discard this unfinished practice? Completed sessions will be kept.')){await saveLocalValue('routine-draft',null);routineDraft=null;render();}break;
  case 'delete-routine':if(confirm('Delete this personal routine?')){if(Number(el.dataset.id)===activeRoutineId)await closeRoutine();await commit(s=>removeRoutine(s,el.dataset.id));if(routineDraft?.routineId===Number(el.dataset.id)){await saveLocalValue('routine-draft',null);routineDraft=null;render();}showToast('Routine removed.');}break;
  case 'lesson':openLesson(el.dataset.slug);break;
  case 'first-recommend':{const first=recommendLessons(state,new Date(),1)[0];if(first)openLesson(first.slug);else showToast('No suggested lesson in the current comfort mode.',true);break;}
  case 'close-lesson':closeLesson();render();break;
  case 'studio-mode':stopRhythm();studioMode=el.dataset.mode;quiz=newQuizPrompt();quizAnswers=[];render();break;
  case 'play-note':audio.tone(Number(el.dataset.midi),{a4:state.preferences.a4ReferenceHz});break;
  case 'play-target':audio.tone(currentTargetMidi(),{duration:.8,a4:state.preferences.a4ReferenceHz});break;
  case 'play-c-major':audio.melody(majorScale(60).map(midi=>({midi,durationBeats:1})),{bpm:92,a4:state.preferences.a4ReferenceHz});break;
  case 'stop-tone':audio.stopTones();break;
  case 'play-scale':audio.melody(scaleNotes().map(midi=>({midi,durationBeats:1})),{bpm:76,a4:state.preferences.a4ReferenceHz});break;
  case 'play-descending':audio.melody([...scaleNotes()].reverse().map(midi=>({midi,durationBeats:1})),{bpm:76,a4:state.preferences.a4ReferenceHz});break;
  case 'lesson-note':activeNote=Number(el.dataset.index);pitchResult=null;audio.tone(currentTargetMidi(),{a4:state.preferences.a4ReferenceHz});render();break;
  case 'play-lesson-phrase':{const lesson=currentLesson();audio.melody(lesson.demonstrationNotes,{bpm:lesson.targetBpm,a4:state.preferences.a4ReferenceHz});break;}
  case 'toggle-mic':if(micOn)stopMicrophone();else await startMicrophone();break;
  case 'check-device':await checkDeviceInput();break;
  case 'check-storage':await verifyStorage();break;
  case 'retain-storage':await verifyStorage({requestRetention:true});break;
  case 'test-speaker':audio.tone(69,{duration:1,a4:state.preferences.a4ReferenceHz,volume:.12});showToast('Playing a short A4 test tone.');break;
  case 'capture-pitch':await capturePitch();break;
  case 'capture-melody':await captureMelody();break;
  case 'guide-reference':openLesson(el.dataset.slug);break;
  case 'play-custom-drill':{const d=state.customDrills.find(x=>x.id===Number(el.dataset.id));if(!d)throw Error('Drill not found');audio.melody(generatePracticePattern(d),{bpm:d.bpm,a4:state.preferences.a4ReferenceHz});break;}
  case 'remove-custom-drill':if(confirm('Delete this personal drill?')){await commit(s=>removeCustomDrill(s,el.dataset.id));showToast('Custom drill removed.');}break;
  case 'import-audio':{const file=document.getElementById('import-audio-file')?.files?.[0];if(!file)throw Error('Choose an audio file first');if(!file.type.startsWith('audio/')||file.size>24*1024*1024||file.size<1)throw Error('Choose a supported audio file under 24 MB');await saveRecording(file,`Imported · ${file.name}`);await refreshRecordings();showToast('Personal audio imported into local recording storage.');break;}
  case 'import-musicxml':{const file=document.getElementById('musicxml-file')?.files?.[0];if(!file)throw Error('Choose a MusicXML file first');if(file.size>800000)throw Error('MusicXML file exceeds 800 KB');const score=parseMusicXML(await file.text());await commit(s=>addRepertoire(s,score));selectedRepId=state.repertoire.at(-1).id;showToast('Monophonic MusicXML phrase imported locally.');break;}
  case 'delete-repertoire':if(confirm('Delete this repertoire item from your personal library?')){await commit(s=>{const copy=structuredClone(s);copy.repertoire=copy.repertoire.filter(r=>r.id!==Number(el.dataset.id));return copy;});selectedRepId=state.repertoire[0]?.id??1;showToast('Repertoire item removed.');}break;
  case 'save-studio-pitch':await saveStudioPitch();break;
  case 'save-lesson':await saveLesson();break;
  case 'play-interval':playInterval();break;
  case 'answer-interval':{if(!quiz||quiz.answered!==null)return;quiz.answered=Number(el.dataset.index);quizAnswers.push(quiz.answered===quiz.answer);render();break;}
  case 'answer-theory':{const l=currentLesson(),q=l?.quizQuestions?.[theoryIndex],i=Number(el.dataset.index);if(l?.interactionType!=='theory-quiz'||!q||theorySelected!==null||!Number.isInteger(i)||i<0||i>=q.options.length)return;theorySelected=i;theoryAnswers.push(i===q.answer);render();break;}
  case 'next-theory':{const l=currentLesson();if(!l||l.interactionType!=='theory-quiz'||theorySelected===null)return;theoryIndex++;theorySelected=null;render();break;}
  case 'next-interval':if(quiz?.answered!==null){quiz=newQuizPrompt();render();}break;
  case 'save-studio-ear':await saveStudioEar();break;
  case 'toggle-rhythm':if(rhythm.on)stopRhythm();else startRhythm();render();break;
  case 'clear-taps':rhythm.offsets=[];render();break;
  case 'tap-beat':tapBeat();break;
  case 'save-studio-rhythm':await saveStudioRhythm();break;
  case 'library-section':if(recordCtrl&&librarySection==='recordings'&&el.dataset.section!=='recordings'){recordCtrl.stop();recordCtrl=null;}librarySection=el.dataset.section;await refreshRecordings();render();break;
  case 'select-rep':selectedRepId=Number(el.dataset.id);render();break;
  case 'play-repertoire':{const r=state.repertoire.find(r=>r.id===selectedRepId);if(r)audio.melody(r.melodyNotes,{bpm:r.targetBpm,a4:state.preferences.a4ReferenceHz,transpose:r.currentTransposeSemitones});break;}
  case 'play-repertoire-loop':{const r=state.repertoire.find(r=>r.id===selectedRepId);if(!r)throw Error('Open a repertoire item first');const a=r.loopStartNote||1,b=r.loopEndNote||r.melodyNotes.length;audio.melody(r.melodyNotes.slice(a-1,b),{bpm:r.targetBpm,a4:state.preferences.a4ReferenceHz,transpose:r.currentTransposeSemitones,repeat:2});break;}
  case 'start-recording':await startVoiceRecording();break;
  case 'stop-recording':recordCtrl?.stop();break;
  case 'analyse-recording':{const rec=await getRecording(el.dataset.id);if(!rec)throw Error('Recording does not exist');showToast('Analysing local recording pitch…');const result=await audio.analyseRecording(rec.blob);recordingAnalyses.set(el.dataset.id,result);render();showToast('Pitch contour extracted on your computer.');break;}
  case 'select-comparison':{const id=el.dataset.id;if(!recordingAnalyses.has(id))throw Error('Analyse the recording first');if(comparisonIds.has(id))comparisonIds.delete(id);else {if(comparisonIds.size>=2)comparisonIds.delete([...comparisonIds][0]);comparisonIds.add(id);}render();break;}
  case 'download-recording':await downloadPersonalRecording(el.dataset.id);break;
  case 'listen-recording':{const rec=await getRecording(el.dataset.id);if(!rec)throw Error('Clip no longer exists');const slot=document.querySelector(`[data-recording-slot="${CSS.escape(rec.id)}"]`);if(slot){slot.textContent='';const player=document.createElement('audio');player.controls=true;player.src=URL.createObjectURL(rec.blob);player.onended=()=>URL.revokeObjectURL(player.src);slot.append(player);player.play().catch(()=>{});}break;}
  case 'delete-recording':if(confirm('Delete this recording permanently from this device?')){await deleteRecording(el.dataset.id);recordingAnalyses.delete(el.dataset.id);comparisonIds.delete(el.dataset.id);await refreshRecordings();showToast('Recording deleted.');}break;
  case 'recording-retry':try{await retryRecordingSave();}catch(err){fail(err,true);}break;
  case 'recording-discard':if(confirm('Discard the unsaved clip? Download it first if you want to keep it.')){pendingRecording=null;saveError='';toastRegion.textContent='';toastRegion.className='';render();}break;
  case 'recording-download':if(pendingRecording){const url=URL.createObjectURL(pendingRecording.blob),link=document.createElement('a');link.href=url;link.download=recordingFilename(pendingRecording);document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);showToast('Clip download started. Keep this tab open until you have saved it.');}break;
  case 'download-backup':await downloadBackup();break;
  case 'restore-backup':{
   writer.assert();const file=document.getElementById('restore-file')?.files?.[0];if(!file)throw Error('Choose a Vocal Studio JSON backup file first');
   if(file.size>38*1024*1024)throw Error('Backup file is too large');
   const bundle=JSON.parse(await file.text());const summary=previewPortableBackup(bundle);restoreSelection={bundle,summary};render();document.getElementById('restore-title')?.focus();break;
  }
  case 'restore-cancel':if(!restoring){restoreSelection=null;render();document.querySelector('[data-action="restore-backup"]')?.focus();}break;
  case 'restore-apply':await applyRestore();break;
  case 'continue-here':if(await writer.acquire())await loadWorkspace();else showToast('Close the other tab first. If no other tab is open, use a current Edge, Chrome, or Firefox browser.',true);break;
  case 'dismiss-error':saveError='';toastRegion.textContent='';toastRegion.className='';break;
  case 'setup-open':setupOpen=!setupOpen;render();if(setupOpen){const heading=document.getElementById('setup-title');heading?.focus?.({preventScroll:true});heading?.scrollIntoView?.({block:'start'});}else document.querySelector('[data-action="setup-open"]')?.focus();break;
  case 'setup-dismiss':await saveLocalValue('setup-dismissed',true);setupDismissed=true;setupOpen=false;render();break;
  case 'reset-data':if(confirm('Permanently delete ALL local progress and saved voice recordings? This cannot be undone without a backup.'))await resetStudio();break;
 } }catch(err){fail(err);}
}
function handleChange(event){const el=event.target;if(!(el instanceof HTMLElement)||restoring)return;try{switch(el.dataset.action){
 case 'game-difficulty':if(el.value in DIFFICULTIES){gameDifficulty=el.value;render();}break;
 case 'game-input':if(['microphone','keys'].includes(el.value)){gameInput=el.value;render();}break;
 case 'game-tonic':gameTonic=Number(el.value);render();break;
 case 'academy-stage':academyStage=el.value;academyLimit=12;render();break;
  case 'academy-ready':academyReadyOnly=el.checked;academyLimit=12;render();break;
  case 'studio-target':studioTarget=Number(el.value);pitchResult=null;render();break;
 case 'scale-key':studioKey=Number(el.value);render();break;
 case 'scale-type':studioScale=el.value;render();break;
 case 'studio-a4':commit(s=>updatePreferences(s,{a4ReferenceHz:Number(el.value)})).catch(fail);break;
 case 'tempo-input':rhythm.bpm=clamp(Number(el.value)||80,40,180);rhythm.offsets=[];if(rhythm.on)startRhythm();render();break;
 case 'rhythm-pattern':if(!RHYTHM_PATTERNS[el.value])throw Error('Unknown rhythm pattern');rhythm.pattern=el.value;rhythm.offsets=[];if(rhythm.on)startRhythm();render();break;
 }}catch(err){fail(err);}}
async function handleSubmit(event){const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();if(restoring)return;const values=new FormData(form);
 try{if(booted)writer.assert();if(form.id==='setup-form'){await commit(s=>updatePreferences(s,Object.fromEntries(values.entries())));showToast('Your range and learning focus are saved.');}
  else if(form.id==='routine-session-form'){await finishRoutine(routineReflection);}
  else if(form.id==='drill-form'){
    await commit(s=>addCustomDrill(s,{title:values.get('title'),rootMidi:Number(values.get('rootMidi')),pattern:values.get('pattern'),bpm:Number(values.get('bpm'))}));showToast('Personal practice drill saved.');}
  else if(form.id==='guide-form'){
    guideQuestion=String(values.get('question')||'').slice(0,300);guideResponse=answerStudyQuestion(guideQuestion,state);render();}
  else if(form.id==='preferences-form'){
  const patch=Object.fromEntries(values.entries());patch.dailyDurationMinutes=Number(patch.dailyDurationMinutes);patch.a4ReferenceHz=Number(patch.a4ReferenceHz);patch.latencyOffsetMs=Number(patch.latencyOffsetMs);patch.octaveEquivalence=values.has('octaveEquivalence');patch.recordingConsentOptIn=values.has('recordingConsentOptIn');await commit(s=>updatePreferences(s,patch));showToast('Preferences saved on this device.');}
  else if(form.id==='repertoire-form'){
   const raw=String(values.get('notes')??'').trim();const tokens=raw.split(/[\s,;]+/).filter(Boolean);if(tokens.length<1||tokens.length>64)throw Error('Enter 1–64 note tokens');const melodyNotes=tokens.map(t=>{const m=t.match(/^([A-Ga-g][#b]?-?\d+)(?::(\d+(?:\.\d+)?))?$/);if(!m)throw Error(`Invalid note ${t}; use C4:1 D4:2`);const midi=noteNameToMidi(m[1]);const durationBeats=Number(m[2]||1);if(durationBeats<=0||durationBeats>32)throw Error('Note duration must be between 0 and 32 beats');return {note:midiToNoteName(midi),midi,durationBeats,solfege:'',fixedSolfege:''};});
   await commit(s=>addRepertoire(s,{title:values.get('title'),composerOrTradition:values.get('composer'),melodyNotes}));selectedRepId=state.repertoire.at(-1).id;render();showToast('Personal melody added to your local library.');}
  else if(form.id==='repertoire-edit-form'){await commit(s=>updateRepertoire(s,Number(values.get('id')),{currentTransposeSemitones:Number(values.get('transpose')),targetBpm:Number(values.get('bpm')),loopStartNote:Number(values.get('loopStartNote')),loopEndNote:Number(values.get('loopEndNote')),annotations:values.get('annotations')}));showToast('Repertoire study saved.');}
  else if(form.id==='routine-form'){await commit(s=>addRoutine(s,{title:values.get('title'),durationMinutes:Number(values.get('duration')),stepsJson:String(values.get('steps')||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)}));showToast('Personal practice routine saved.');}
 }catch(err){fail(err);}}
function handleInput(event){const el=event.target;if(restoring||(booted&&!writer.writable)||routineSaving)return;if(el?.classList?.contains('routine-step-input')){const i=Number(el.value);if(el.checked)routineChecked.add(i);else routineChecked.delete(i);const dock=el.closest('.routine-dock');const save=dock?.querySelector('button[type=submit]');if(save)save.disabled=routineChecked.size===0;const counter=dock?.querySelector('.dock-header p');if(counter){const r=state.routines.find(x=>x.id===activeRoutineId);counter.textContent=`${routineChecked.size} of ${r.stepsJson.length} steps · ${r.durationMinutes} min guide`;}el.closest('.routine-step')?.classList.toggle('checked',el.checked);persistRoutineDraft().catch(fail);return;}if(el?.id==='routine-reflection'){routineReflection=String(el.value).slice(0,2000);scheduleRoutineDraft();return;}if(el?.id==='academy-query'){academyQuery=String(el.value).slice(0,120);academyLimit=12;const focus=el.selectionStart;render();const query=document.getElementById('academy-query');query?.focus();query?.setSelectionRange(focus,focus);return;}if(el?.id==='lesson-reflection'){lessonReflection=String(el.value).slice(0,2000);return;}if(el?.classList?.contains('reflection-check')){const i=Number(el.value);if(el.checked)reflectionChecks.add(i);else reflectionChecks.delete(i);return;}if(el?.id==='glossary-query'){searchTerm=el.value;const caret=el.selectionStart;render();const input=document.getElementById('glossary-query');input?.focus();input?.setSelectionRange(caret,caret);}}
function handleKeyboard(event){
 const modal=document.querySelector('.restore-dialog')??document.querySelector('.lesson-dialog');
 if(modal&&event.key==='Tab'){
  const controls=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];
  const first=controls[0],last=controls.at(-1);
  if(!first){event.preventDefault();return;}
  if(event.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement))){event.preventDefault();last.focus();return;}
  if(!event.shiftKey&&(document.activeElement===last||!controls.includes(document.activeElement))){event.preventDefault();first.focus();return;}
 }
 if(restoring){if(event.key==='Escape')event.preventDefault();return;}
 if(tab==='games'&&game&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)&&!event.repeat){
  if(event.key==='Escape'){leaveGame();render();return;}
  if(game.source==='keys'&&game.phase==='playing'){
   if(game.mode==='rhythm-river'&&['Space','Enter'].includes(event.code)){event.preventDefault();gameKeyInput(null,'tap');return;}
   const positions=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK'];const i=positions.indexOf(event.code);
   if(i>=0){event.preventDefault();const note=gameKeyboardNotes(game).find(n=>n.key===['A','S','D','F','G','H','J','K'][i]);if(note)gameKeyInput(note.midi);return;}
  }
  if(event.code==='Space'&&game.source==='microphone'&&game.phase==='playing'){event.preventDefault();void pauseGame();return;}
 }
 if(event.key==='Escape'&&restoreSelection){if(!restoring){restoreSelection=null;render();document.querySelector('[data-action="restore-backup"]')?.focus();}return;}
 if(event.key==='Escape'&&activeRoutineId!==null&&!lessonSlug){if(!routineSaving)closeRoutine().catch(fail);return;}if(event.key==='Escape'&&lessonSlug){closeLesson();render();return;}if(event.code==='Space'&&!event.repeat&&rhythm.on&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)){event.preventDefault();tapBeat();}}
document.addEventListener('click',handleClick);
document.addEventListener('change',handleChange);
document.addEventListener('submit',handleSubmit);
document.addEventListener('input',handleInput);
document.addEventListener('keydown',handleKeyboard);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&tab==='games'&&game?.phase==='playing')void pauseGame();if(document.hidden&&activeRoutineId!==null&&!routineSaving&&!restoring)persistRoutineDraft().catch(fail);});
async function loadWorkspace(){
 state=hydrateState(await loadStudioState());if(!state||!Array.isArray(state.lessons))throw Error('Unable to read your saved progress. Try reopening this browser profile.');
 selectedRepId=state.repertoire[0]?.id??1;recordingItems=await listRecordings();
 routineDraft=readRoutineDraft(await loadLocalValue('routine-draft'),state.routines);setupDismissed=Boolean(await loadLocalValue('setup-dismissed'));
 booted=true;render();
}
(async()=>{try{
 await writer.acquire();await loadWorkspace();
 if('serviceWorker'in navigator&&['http:','https:'].includes(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>showToast('Offline setup did not finish. Keep the launcher running and reload to try again.',true));
}catch(error){console.error(error);root.innerHTML=`<main class="boot"><h1>Unable to open your studio</h1><p>${safe(error.message)}</p><p>Keep your browser data. Reopen the local launcher and try again.</p><a class="btn" href="./">Try again</a></main>`;}})();
window.addEventListener('beforeunload',event=>{if(pendingRecording||recordCtrl||recordingStarting||recordingSaving||draftTimer||routineSaving||savingLesson){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{audio.stopMic();audio.stopTones();void writer.release();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
