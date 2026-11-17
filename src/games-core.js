/** Deterministic, device-independent game rules. No audio or DOM dependencies. */
import { centsBetween, midiToFrequency } from './music.js';

export const GAME_MODES=Object.freeze({
 'note-runner':{id:'note-runner',title:'Note Runner',short:'Sing through the gates',description:'Guide a glowing marble through solfège gates. Hold the right pitch to open each passage.',learningGoal:'Pitch matching and scale degrees',instructions:'Listen to each note, then sing it steadily to open the gate. Keep the sound comfortable.',color:'#ecad72',icon:'◉',kind:'pitch'},
 'sky-steps':{id:'sky-steps',title:'Sky Steps',short:'Climb a melody',description:'Build a staircase of floating islands by singing notes higher and lower.',learningGoal:'Melodic direction and pitch transitions',instructions:'Hear the next step, then sing its note to raise your star to the next island.',color:'#b3c6ff',icon:'✧',kind:'pitch'},
 'echo-cave':{id:'echo-cave',title:'Echo Cave',short:'Remember the melody',description:'Crystal lights remember a tiny melody. Listen, then sing the notes back in order.',learningGoal:'Tonal memory and short melodic patterns',instructions:'Choose Hear pattern, listen carefully, then match the highlighted notes in sequence.',color:'#d5a6ff',icon:'◇',kind:'pitch'},
 'tone-garden':{id:'tone-garden',title:'Tone Garden',short:'Grow notes with your voice',description:'Keep a gentle, steady pitch to awaken a garden of glowing flowers.',learningGoal:'Sustained pitch and steady vocal control',instructions:'Sing softly and steadily. Hold the target note without pushing for volume.',color:'#9fe1bb',icon:'❀',kind:'pitch'},
 'rhythm-river':{id:'rhythm-river',title:'Rhythm River',short:'Keep the boats on beat',description:'Send little lantern boats downriver by singing a short “ta”, clapping, or tapping in time.',learningGoal:'Pulse and timing precision',instructions:'Follow the count-in. On the glowing beat, gently say “ta”, clap, or tap Space. There is no need to sing loudly.',color:'#98d9e6',icon:'≋',kind:'rhythm'}
});
export const DIFFICULTIES=Object.freeze({
 easy:{id:'easy',title:'Gentle',toleranceCents:85,holdMs:400,windowMs:240,timeoutMs:11000,beatMs:890,minimumConfidence:.68},
 steady:{id:'steady',title:'Steady',toleranceCents:60,holdMs:600,windowMs:170,timeoutMs:8400,beatMs:760,minimumConfidence:.74},
 challenge:{id:'challenge',title:'Challenge',toleranceCents:40,holdMs:850,windowMs:120,timeoutMs:6500,beatMs:650,minimumConfidence:.82}
});
const SCALE=[0,2,4,5,7,9,11,12];
const NAMES=['Do','Re','Mi','Fa','Sol','La','Ti','Do'];
export function gameKeyboardNotes(session){
 return SCALE.map((semitones,i)=>({midi:session.tonicMidi+semitones,label:NAMES[i],key:['A','S','D','F','G','H','J','K'][i]})).filter(n=>n.midi<=(session.maxMidi??session.tonicMidi+12));
}
/** Allow the learner to hear a cue without spending the time allowed to respond. */
export function deferGameForCue(session,durationMs){
 if(session.phase!=='playing'||!Number.isFinite(durationMs)||durationMs<=0)return session;
 const ms=bounded(durationMs,0,16000);
 return {...session,startedAt:session.startedAt+ms,targetStartedAt:session.targetStartedAt+ms,lastAt:(session.lastAt??session.targetStartedAt)+ms};
}
function rand(seed){let x=(Number(seed)>>>0)||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
const bounded=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
function pitchTargets(mode,difficulty,tonic,seed,maxMidi=tonic+12){
 const rng=rand(seed);const base=SCALE.map((s,i)=>({midi:tonic+s,label:NAMES[i],degree:i})).filter(n=>n.midi<=maxMidi);
 const pick=i=>base[i%base.length];
 if(mode==='sky-steps'){
  const order=difficulty==='easy'?[0,1,2,3,4,3,2,1]:difficulty==='steady'?[0,2,3,5,7,4,3,0]:[0,3,6,2,7,4,1,0];
  return order.map(i=>({...pick(i)}));
 }
 if(mode==='echo-cave'){
  const allowed=difficulty==='easy'?[0,1,2,4]:difficulty==='steady'?[0,1,2,3,4,5]:[0,1,2,3,4,5,6,7];
  return Array.from({length:difficulty==='easy'?6:difficulty==='steady'?8:10},(_,i)=>({...pick(allowed[i===0?0:Math.floor(rng()*allowed.length)])}));
 }
 if(mode==='tone-garden'){
  const order=difficulty==='easy'?[0,2,4,3,0]:difficulty==='steady'?[0,3,5,4,2,0]:[0,4,6,5,3,7,0];
  return order.map(i=>({...pick(i)}));
 }
 const allowed=difficulty==='easy'?[0,1,2,3,4]:difficulty==='steady'?[0,1,2,3,4,5,6]:[0,1,2,3,4,5,6,7];
 return Array.from({length:difficulty==='easy'?7:difficulty==='steady'?9:11},(_,i)=>({...pick(allowed[i===0?0:Math.floor(rng()*allowed.length)])}));
}
export function createGameSession({mode='note-runner',difficulty='easy',tonicMidi=60,source='microphone',seed=1,a4=440,maxMidi=tonicMidi+12}={}){
 if(!GAME_MODES[mode])throw Error('Unknown game mode');
 if(!DIFFICULTIES[difficulty])throw Error('Unknown game difficulty');
 if(!['microphone','keys'].includes(source))throw Error('Unsupported game input');
 if(!Number.isInteger(tonicMidi)||tonicMidi<40||tonicMidi>72)throw Error('Choose a comfortable tonic');
 if(!Number.isFinite(a4)||a4<415||a4>466)throw Error('Invalid reference pitch');
 if(!Number.isInteger(maxMidi)||maxMidi<tonicMidi||maxMidi>96)throw Error('Invalid comfortable upper note');
 const config={...DIFFICULTIES[difficulty]};
 const targets=mode==='rhythm-river'?Array.from({length:difficulty==='easy'?8:difficulty==='steady'?10:12},(_,i)=>({kind:'beat',label:`Beat ${i+1}`,offsetMs:1300+i*config.beatMs,midi:tonicMidi})):pitchTargets(mode,difficulty,tonicMidi,seed,maxMidi);
 return {mode,difficulty,source,tonicMidi,maxMidi,a4,config,targets,phase:'ready',index:0,correct:0,misses:0,wrongHits:0,score:0,heldMs:0,accuracyMs:0,startedAt:null,lastAt:null,targetStartedAt:null,endedAt:null,eventId:0,event:'',lastInputMidi:null,lastCents:null};
}
export function startGame(session,now){if(session.phase!=='ready')return session;if(!Number.isFinite(now))throw Error('Invalid game clock');return {...session,phase:'playing',startedAt:now,targetStartedAt:now,lastAt:now,event:'',eventId:0};}
export function targetAt(session){return session.targets[session.index]??null;}
function nextTarget(session,success,now,cents=0){
 const nextIndex=session.index+1;
 const score=success?session.score+Math.round(100+Math.max(0,40-Math.abs(cents)*.45)):session.score;
 return {...session,index:nextIndex,correct:session.correct+(success?1:0),misses:session.misses+(success?0:1),score,heldMs:0,lastCents:success?cents:null,targetStartedAt:now,lastAt:now,event:success?'success':'miss',eventId:session.eventId+1,phase:nextIndex>=session.targets.length?'finished':'playing',endedAt:nextIndex>=session.targets.length?now:null};
}
export function extractGameInput(sample,mode){
 if(GAME_MODES[mode]?.kind==='rhythm')return {kind:'level',rms:Number(sample?.rms)||0};
 return {hz:Number(sample?.hz)||0,confidence:Number(sample?.confidence)||0,rms:Number(sample?.rms)||0};
}
export function stepGame(session,input,now){
 if(session.phase!=='playing'||!Number.isFinite(now))return session;
 const target=targetAt(session);if(!target)return {...session,phase:'finished',endedAt:now};
 if(session.mode==='rhythm-river'){
  const targetTime=session.startedAt+target.offsetMs;
  const rawAt=Number(input?.atMs);
  const observedAt=Number.isFinite(rawAt)&&rawAt>0&&Math.abs(now-rawAt)<=350?rawAt:now;
  if((input?.kind==='onset'||input?.kind==='tap')&&Math.abs(observedAt-targetTime)<=session.config.windowMs)return nextTarget(session,true,now,Math.abs(observedAt-targetTime)*.25);
  if(now>targetTime+session.config.windowMs)return nextTarget(session,false,now);
  return {...session,lastAt:now,event:''};
 }
 const delta=bounded(now-(session.lastAt??now),0,125);
 if(session.source==='keys'){
  if(input?.kind!=='key')return {...session,lastAt:now};
  if(input.midi===target.midi)return nextTarget(session,true,now,0);
  return {...session,lastAt:now,wrongHits:session.wrongHits+1,event:'wrong',eventId:session.eventId+1};
 }
 const valid=Number.isFinite(input?.hz)&&input.hz>0&&Number.isFinite(input?.confidence)&&input.confidence>=session.config.minimumConfidence&&Number.isFinite(input?.rms)&&input.rms>.003;
 const cents=valid?centsBetween(input.hz,midiToFrequency(target.midi,session.a4)):Infinity;
 const inTune=valid&&Math.abs(cents)<=session.config.toleranceCents;
 const needed=session.mode==='tone-garden'?Math.round(session.config.holdMs*2.6):session.config.holdMs;
 const heldMs=inTune?session.heldMs+delta:Math.max(0,session.heldMs-delta*1.6);
 if(heldMs>=needed)return nextTarget(session,true,now,cents);
 if(now-session.targetStartedAt>session.config.timeoutMs+(session.mode==='tone-garden'?3000:0))return nextTarget(session,false,now);
 return {...session,heldMs,lastAt:now,lastInputMidi:valid?Math.round(69+12*Math.log2(input.hz/session.a4)):null,lastCents:valid?cents:null,event:''};
}
export function gameSummary(session){
 if(session.phase!=='finished')throw Error('Finish the game before recording the result');
 return {mode:session.mode,difficulty:session.difficulty,source:session.source,correct:session.correct,total:session.targets.length,score:session.score,durationSeconds:bounded(Math.round((session.endedAt-session.startedAt)/1000),0,3600)};
}
export function gameStars(session){const ratio=session.correct/session.targets.length;return ratio>=.9?3:ratio>=.65?2:ratio>=.35?1:0;}
