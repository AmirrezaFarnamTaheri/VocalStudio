import { CATALOG } from './catalog.js';
import { clamp, midiToNoteName, noteNameToMidi } from './music.js';
import { DRILL_PATTERNS, generatePracticePattern, RHYTHM_PATTERNS } from './advanced.js';

export const BACKUP_FORMAT='vocal-studio-personal-v1';
const MASTERY=['not-started','learning','demonstrated','retained'];
const TRACKS=['pitch','solfege','ear-training','rhythm','notation','vocal-fundamentals','music-theory','performance','creativity'];
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const string=(x,n=1000)=>typeof x==='string'?x.slice(0,n):'';
const dateOnly=(date)=>date.toISOString().slice(0,10);
const addDays=(date,days)=>{const d=new Date(date);d.setUTCDate(d.getUTCDate()+days);return dateOnly(d);};
const integer=(n,min,max,defaultValue)=>Number.isInteger(n)&&n>=min&&n<=max?n:defaultValue;
const number=(n,min,max,defaultValue)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max?n:defaultValue;
const clone=x=>structuredClone(x);

export function defaultPreferences(){return {learnerName:'Solo Vocalist',solfegeSystem:'movable-do',a4ReferenceHz:440,comfortableLowNote:'C3',comfortableHighNote:'G4',dailyDurationMinutes:12,themeMode:'light',micSensitivity:'normal',octaveEquivalence:false,recordingConsentOptIn:false,vocalComfortStatus:'comfortable',activeGoalTrack:'pitch',latencyOffsetMs:0,audioInputDeviceId:''};}
export function createInitialState(){
 return {schemaVersion:BACKUP_FORMAT,
  preferences:defaultPreferences(),
  skills:CATALOG.skills.map((skill,index)=>({...skill,id:index+1,masteryState:'not-started',accuracyPercent:0,attemptsCount:0,lastPracticedAt:'',nextReviewDueAt:'',evidenceSummary:'Not yet practised'})),
  lessons:CATALOG.lessons.map((lesson,index)=>({...lesson,id:index+1})),
  attempts:[],
  practiceSessions:[],
  gameSessions:[],
  customDrills:[],
  repertoire:CATALOG.repertoire.map((item,index)=>({...item,id:index+1,lastPracticedAt:''})),
  routines:CATALOG.routines.map((item,index)=>({...item,id:index+1}))
 };
}
export function updatePreferences(state,patch){
 const out=clone(state);const old=out.preferences;
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid preferences');
 out.preferences={...old,
  learnerName:patch.learnerName===undefined?old.learnerName:string(patch.learnerName,60)||old.learnerName,
  solfegeSystem:['movable-do','fixed-do'].includes(patch.solfegeSystem)?patch.solfegeSystem:old.solfegeSystem,
  a4ReferenceHz:number(patch.a4ReferenceHz,415,466,old.a4ReferenceHz),
  comfortableLowNote:/^[A-G](?:#|b)?[2-5]$/.test(patch.comfortableLowNote)?patch.comfortableLowNote:old.comfortableLowNote,
  comfortableHighNote:/^[A-G](?:#|b)?[3-6]$/.test(patch.comfortableHighNote)?patch.comfortableHighNote:old.comfortableHighNote,
  dailyDurationMinutes:integer(patch.dailyDurationMinutes,3,90,old.dailyDurationMinutes),
  themeMode:['dark','light'].includes(patch.themeMode)?patch.themeMode:old.themeMode,
  micSensitivity:['gentle','normal','strict'].includes(patch.micSensitivity)?patch.micSensitivity:old.micSensitivity,
  octaveEquivalence:typeof patch.octaveEquivalence==='boolean'?patch.octaveEquivalence:old.octaveEquivalence,
  recordingConsentOptIn:typeof patch.recordingConsentOptIn==='boolean'?patch.recordingConsentOptIn:old.recordingConsentOptIn,
  vocalComfortStatus:['comfortable','mild-fatigue','resting'].includes(patch.vocalComfortStatus)?patch.vocalComfortStatus:old.vocalComfortStatus,
  activeGoalTrack:TRACKS.includes(patch.activeGoalTrack)?patch.activeGoalTrack:old.activeGoalTrack,
  latencyOffsetMs:integer(patch.latencyOffsetMs,-300,300,old.latencyOffsetMs),audioInputDeviceId:patch.audioInputDeviceId===undefined?old.audioInputDeviceId:string(patch.audioInputDeviceId,200)};
 if(noteNameToMidi(out.preferences.comfortableLowNote)>=noteNameToMidi(out.preferences.comfortableHighNote))throw Error('Comfortable range must have a lower note below its upper note');
 return out;
}
function ensureMeasurement(payload,lesson){
 const kind=payload?.kind;
 const scoreBase={source:'interactive',scorePercent:null,measuredDeviationCents:null,confidencePercent:null,timingAccuracyPercent:null,evidenceNotes:''};
 if(kind==='pitch'){
  if(payload.source!=='microphone')throw Error('Real microphone input is required for measured pitch evidence');
  if(!['pitch-match','solfege-sing','sight-sing'].includes(lesson.interactionType))throw Error('This lesson is not a pitch assessment');
  if(!Number.isInteger(payload.voicedFrames)||payload.voicedFrames<12)throw Error('At least 12 voiced microphone frames are required');
  if(!Number.isFinite(payload.confidence)||payload.confidence<0.68||payload.confidence>1)throw Error('Insufficient voiced confidence');
  if(!Number.isFinite(payload.deviationCents)||Math.abs(payload.deviationCents)>2400)throw Error('Invalid cents deviation');
  const cents=payload.deviationCents;
  return {...scoreBase,source:'microphone',scorePercent:Math.round(clamp(100-Math.abs(cents)*18/Math.max(lesson.toleranceCents,8),0,100)),measuredDeviationCents:Math.round(cents*10)/10,confidencePercent:Math.round(payload.confidence*100),evidenceNotes:`${payload.voicedFrames} voiced microphone samples · ${cents.toFixed(1)} cents from ${string(payload.targetNote,10)||'target'} · ${Math.round(payload.confidence*100)}% detection confidence`};
 }
 if(kind==='ear'||kind==='knowledge'){
  if(kind==='ear'&&lesson.interactionType!=='interval-ear')throw Error('Not an ear training lesson');
  if(kind==='knowledge'&&!['theory-quiz','sight-sing','solfege-sing','guided-reflection','melody-dictation'].includes(lesson.interactionType))throw Error('Knowledge exercise not available');
  if(!Number.isInteger(payload.total)||payload.total<1||payload.total>100||!Number.isInteger(payload.correct)||payload.correct<0||payload.correct>payload.total)throw Error('Invalid answer counts');
  return {...scoreBase,scorePercent:Math.round(payload.correct/payload.total*100),evidenceNotes:`${payload.correct} of ${payload.total} answers correct`};
 }
 if(kind==='melody'){
  if(payload.source!=='microphone'||!['sight-sing','solfege-sing'].includes(lesson.interactionType))throw Error('Measured melody performance requires microphone evidence');
  const items=payload.noteResults;
  if(!Array.isArray(items)||items.length!==lesson.demonstrationNotes.length)throw Error('Invalid melody note evidence');
  const valid=items.filter((item,index)=>{
    if(!item||item.note!==midiToNoteName(lesson.demonstrationNotes[index].midi)||!Number.isInteger(item.voicedFrames)||item.voicedFrames<0||!Number.isInteger(item.index)||item.index!==index)throw Error('Untrusted melody note evidence');
    if(item.scorable===false)return false;
    if(item.scorable!==true||item.voicedFrames<3||!Number.isFinite(item.cents)||Math.abs(item.cents)>2400||!Number.isFinite(item.confidence)||item.confidence<.68||item.confidence>1)throw Error('Insufficient voiced melody evidence');
    return true;
  });
  const coverage=Math.round(valid.length/items.length*100);
  if(coverage<70||valid.length<3)throw Error('Insufficient full-melody microphone coverage');
  const score=Math.round(valid.reduce((sum,item)=>sum+clamp(100-Math.abs(item.cents)*.65,0,100),0)/valid.length);
  return {...scoreBase,source:'microphone',scorePercent:score,confidencePercent:Math.round(valid.reduce((s,n)=>s+n.confidence,0)/valid.length*100),measuredDeviationCents:Math.round(valid.reduce((s,n)=>s+n.cents,0)/valid.length*10)/10,evidenceNotes:`Measured ${valid.length}/${items.length} melody notes from ${valid.reduce((s,n)=>s+n.voicedFrames,0)} voiced microphone frames (${coverage}% coverage)`};
 }
 if(kind==='rhythm'){
  if(lesson.interactionType!=='rhythm-tap')throw Error('Not a rhythm exercise');
  if(!Array.isArray(payload.offsetsMs)||payload.offsetsMs.length<4||payload.offsetsMs.length>64||!payload.offsetsMs.every(x=>Number.isFinite(x)&&Math.abs(x)<2500))throw Error('Four or more actual rhythm taps are required');
  const pattern=payload.pattern||'quarter';if(!RHYTHM_PATTERNS[pattern])throw Error('Unsupported rhythm pattern');
  const mae=payload.offsetsMs.reduce((s,x)=>s+Math.abs(x),0)/payload.offsetsMs.length;
  return {...scoreBase,source:'rhythm-taps',scorePercent:Math.round(clamp(100-mae/2,0,100)),timingAccuracyPercent:Math.round(clamp(100-mae/2,0,100)),evidenceNotes:`${RHYTHM_PATTERNS[pattern].label} · ${payload.offsetsMs.length} taps · mean absolute timing error ${mae.toFixed(1)} ms`};
 }
 if(kind==='reflection'){
  if(lesson.interactionType!=='guided-reflection')throw Error('Reflection not supported for this lesson');
  if(!Number.isInteger(payload.checked)||!Number.isInteger(payload.total)||payload.checked<1||payload.checked>payload.total||payload.total>8)throw Error('Check at least one observation before saving');
  return {...scoreBase,source:'self-report',evidenceNotes:`${payload.checked}/${payload.total} personal observations recorded (not an objective voice assessment)`};
 }
 throw Error('Unsupported exercise evidence');
}
export function recordAttempt(state,payload,when=new Date()){
 const lesson=state.lessons.find(x=>x.slug===payload?.lessonSlug);
 if(!lesson)throw Error('Unknown lesson');
 const evidence=ensureMeasurement(payload,lesson);
 const out=clone(state);
 const existing=out.skills.find(s=>s.slug===lesson.skillSlug);
 if(!existing)throw Error('Missing skill for lesson');
 const newId=1+Math.max(0,...out.attempts.map(x=>x.id));
 const day=dateOnly(when);
 const attempt={id:newId,lessonSlug:lesson.slug,skillSlug:lesson.skillSlug,exerciseTitle:lesson.title,track:lesson.track,mode:'academy',kind:payload.kind,source:evidence.source,scorePercent:evidence.scorePercent,measuredDeviationCents:evidence.measuredDeviationCents,confidencePercent:evidence.confidencePercent,timingAccuracyPercent:evidence.timingAccuracyPercent,masteryOutcome:'learning',targetSummary:lesson.keySignature,evidenceNotes:evidence.evidenceNotes,selfReflection:string(payload.reflection,2000),durationSeconds:Math.max(0,Math.round(Number(payload.durationSeconds)||0)),createdAt:when.toISOString()};
 out.attempts.unshift(attempt);
 const sameSkill=out.attempts.filter(a=>a.skillSlug===existing.slug);
 const measured=sameSkill.filter(a=>Number.isFinite(a.scorePercent));
 const accuracy=measured.length?Math.round(measured.slice(0,10).reduce((s,a)=>s+a.scorePercent,0)/Math.min(measured.length,10)):0;
 const successful=measured.filter(a=>a.scorePercent>=82);
 const distinctDays=new Set(successful.map(a=>a.createdAt.slice(0,10))).size;
 let mastery='learning';
 if(successful.length>=2 && distinctDays>=2)mastery='demonstrated';
 if(successful.length>=4 && distinctDays>=3 && accuracy>=84)mastery='retained';
 existing.attemptsCount=sameSkill.length;
 existing.accuracyPercent=accuracy;
 existing.masteryState=mastery;
 existing.lastPracticedAt=day;
 existing.nextReviewDueAt=addDays(when,mastery==='retained'?7:mastery==='demonstrated'?3:1);
 existing.evidenceSummary=evidence.evidenceNotes;
 attempt.masteryOutcome=mastery;
 return out;
}
export function isLessonReady(state,lesson){const skill=state.skills.find(s=>s.slug===lesson.skillSlug);return Boolean(skill && skill.prerequisites.every(pr=>['demonstrated','retained'].includes(state.skills.find(s=>s.slug===pr)?.masteryState)));}
export function recommendLessons(state,when=new Date(),max=5){
 const today=dateOnly(when),rest=state.preferences.vocalComfortStatus==='resting';
 return state.lessons.map(lesson=>{
   const skill=state.skills.find(s=>s.slug===lesson.skillSlug);
   const ready=isLessonReady(state,lesson);
   const vocal=['pitch-match','solfege-sing','sight-sing','guided-reflection'].includes(lesson.interactionType);
   const eligible=ready&&(!rest||!vocal);
   const due=skill?.nextReviewDueAt&&skill.nextReviewDueAt<=today;
   const priority=(due?200:0)+(skill?.masteryState==='learning'?90:0)+(skill?.masteryState==='not-started'?70:0)+(lesson.track===state.preferences.activeGoalTrack?30:0)-lesson.stage*6;
   return {...lesson,ready,eligible,priority,due:Boolean(due)};
 }).filter(x=>x.eligible).sort((a,b)=>b.priority-a.priority||a.id-b.id).slice(0,max);
}
export function buildSkillReport(state){
 const totalSkills=state.skills.length;
 const measured=state.attempts.filter(a=>Number.isFinite(a.scorePercent));
 return {totalSkills,totalAttempts:state.attempts.length,measuredAttempts:measured.length,demonstrated:state.skills.filter(x=>x.masteryState==='demonstrated').length,retained:state.skills.filter(x=>x.masteryState==='retained').length,averageScore:measured.length?Math.round(measured.reduce((s,a)=>s+a.scorePercent,0)/measured.length):null};
}
export function updateRepertoire(state,id,patch){const out=clone(state);const item=out.repertoire.find(x=>x.id===Number(id));if(!item)throw Error('Repertoire item not found');if(!patch||typeof patch!=='object')throw Error('Invalid repertoire edit');
 if('annotations'in patch)item.annotations=string(patch.annotations,4000);
 if('currentTransposeSemitones'in patch)item.currentTransposeSemitones=integer(patch.currentTransposeSemitones,-24,24,item.currentTransposeSemitones);
 if('targetBpm'in patch)item.targetBpm=integer(patch.targetBpm,30,240,item.targetBpm);
 if('loopStartNote'in patch||'loopEndNote'in patch){
  const start='loopStartNote'in patch?patch.loopStartNote:(item.loopStartNote||1);
  const end='loopEndNote'in patch?patch.loopEndNote:(item.loopEndNote||item.melodyNotes.length);
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>item.melodyNotes.length||end<start)throw Error('Invalid phrase loop start or end');
  item.loopStartNote=start;item.loopEndNote=end;
 }
 if('phraseStartMeasure'in patch)item.phraseStartMeasure=integer(patch.phraseStartMeasure,1,999,item.phraseStartMeasure);
 if('phraseEndMeasure'in patch)item.phraseEndMeasure=integer(patch.phraseEndMeasure,item.phraseStartMeasure,999,item.phraseEndMeasure);
 if('preparationStatus'in patch)item.preparationStatus=string(patch.preparationStatus,100);
 item.lastPracticedAt=dateOnly(new Date());return out;}
export function addRepertoire(state,raw){const out=clone(state);if(!raw||typeof raw!=='object'||typeof raw.title!=='string'||!raw.title.trim())throw Error('Enter a title');const melody=Array.isArray(raw.melodyNotes)?raw.melodyNotes:[];
 if(melody.length>256||!melody.every(n=>Number.isInteger(n.midi)&&n.midi>=20&&n.midi<=110&&Number.isFinite(n.durationBeats)&&n.durationBeats>0&&n.durationBeats<=32))throw Error('Invalid melody');
 const item={id:1+Math.max(0,...out.repertoire.map(r=>r.id)),title:string(raw.title,120),composerOrTradition:string(raw.composerOrTradition||'Personal study',150),originalKey:string(raw.originalKey||'C Major',50),currentTransposeSemitones:0,targetBpm:integer(raw.targetBpm,30,240,76),phraseStartMeasure:1,phraseEndMeasure:4,loopStartNote:1,loopEndNote:Math.max(1,melody.length),melodyNotes:clone(melody),annotations:string(raw.annotations,4000),preparationStatus:'Studying',lastPracticedAt:''};out.repertoire.push(item);return out;}
export function addRoutine(state,raw){const out=clone(state);if(!raw||typeof raw.title!=='string'||!raw.title.trim())throw Error('Routine title required');if(!Array.isArray(raw.stepsJson)||raw.stepsJson.length<1||raw.stepsJson.length>12||raw.stepsJson.some(x=>typeof x!=='string'||!x.trim()))throw Error('A routine needs 1–12 meaningful steps');out.routines.push({id:1+Math.max(0,...out.routines.map(r=>r.id)),title:string(raw.title,120),category:'Custom',description:string(raw.description,500),durationMinutes:integer(raw.durationMinutes,1,90,10),targetKey:string(raw.targetKey||'C Major',40),targetBpm:integer(raw.targetBpm,30,240,80),stepsJson:raw.stepsJson.map(x=>string(x.trim(),160)),isFavorite:true});return out;}
export function addCustomDrill(state,raw){
 if(!raw||typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>100||!Number.isInteger(raw.rootMidi)||raw.rootMidi<36||raw.rootMidi>84||!DRILL_PATTERNS[raw.pattern]||!Number.isInteger(raw.bpm)||raw.bpm<40||raw.bpm>200)throw Error('Invalid drill title, note range, pattern or tempo');
 const out=clone(state);if(!Array.isArray(out.customDrills))out.customDrills=[];
 const drill={id:1+Math.max(0,...out.customDrills.map(x=>x.id)),title:raw.title.trim(),rootMidi:raw.rootMidi,pattern:raw.pattern,bpm:raw.bpm,createdAt:new Date().toISOString()};
 generatePracticePattern(drill);out.customDrills.push(drill);return out;
}
export function removeCustomDrill(state,id){
 const out=clone(state);out.customDrills=(out.customDrills||[]).filter(x=>x.id!==Number(id));return out;
}
/** Return a manageable Academy page without hiding unlocked lessons. */
export function selectAcademyLessons(state,{track='all',query='',stage='all',readyOnly=false,limit=12}={}){
 const search=String(query).trim().toLocaleLowerCase().slice(0,120);
 const stageValue=stage==='all'?'all':Number(stage);
 const results=state.lessons.filter(lesson=>(track==='all'||lesson.track===track)
   &&(stageValue==='all'||lesson.stage===stageValue)
   &&(!readyOnly||isLessonReady(state,lesson))
   &&(!search||`${lesson.title} ${lesson.objective} ${lesson.track}`.toLocaleLowerCase().includes(search)))
   .map(lesson=>({...lesson,ready:isLessonReady(state,lesson)}))
   .sort((a,b)=>a.stage-b.stage||Number(b.ready)-Number(a.ready)||a.title.localeCompare(b.title));
 return {total:results.length,lessons:results.slice(0,Math.max(1,Math.min(1000,Number(limit)||12)))};
}

export function removeRoutine(state,id){
 const out=clone(state),routine=out.routines.find(r=>r.id===Number(id));
 if(!routine)throw Error('Routine not found');
 if(routine.category!=='Custom')throw Error('Built-in routines cannot be deleted');
 out.routines=out.routines.filter(r=>r.id!==routine.id);
 return out;
}

function validPracticeSession(session){
 return Boolean(session&&Number.isInteger(session.id)&&session.id>0&&typeof session.routineTitle==='string'&&session.routineTitle.length>0&&session.routineTitle.length<=120
 &&Number.isInteger(session.completedSteps)&&session.completedSteps>=1&&Number.isInteger(session.totalSteps)&&session.totalSteps>=session.completedSteps&&session.totalSteps<=12
 &&Number.isInteger(session.durationSeconds)&&session.durationSeconds>=0&&session.durationSeconds<=14400
 &&typeof session.reflection==='string'&&session.reflection.length<=2000&&Number.isFinite(Date.parse(session.createdAt)));
}

/** A completed checklist is an honest practice entry, never measured singing proficiency. */
export function recordRoutineSession(state,{routineId,completedStepIndexes,reflection='',elapsedSeconds=0},when=new Date()){
 const routine=state.routines.find(r=>r.id===Number(routineId));
 if(!routine)throw Error('Routine not found');
 if(!Array.isArray(completedStepIndexes)||!completedStepIndexes.length)throw Error('Complete at least one step before saving');
 if(new Set(completedStepIndexes).size!==completedStepIndexes.length)throw Error('Duplicate routine step');
 if(completedStepIndexes.some(i=>!Number.isInteger(i)||i<0||i>=routine.stepsJson.length))throw Error('Invalid routine step');
 if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw Error('Invalid elapsed practice time');
 const out=clone(state);
 const sessions=out.practiceSessions||[];
 const entry={id:Math.max(0,...sessions.map(x=>x.id))+1,routineTitle:routine.title,
  completedSteps:completedStepIndexes.length,totalSteps:routine.stepsJson.length,
  durationSeconds:Math.min(14400,Math.round(elapsedSeconds)),reflection:string(reflection,2000),createdAt:when.toISOString()};
 sessions.unshift(entry);out.practiceSessions=sessions.slice(0,2000);
 return out;
}

/** A local content update may add lessons/skills; never create fake learner progress. */
function validGameSession(entry){
 return entry&&typeof entry==='object'&&Object.keys({"note-runner":1,"sky-steps":1,"echo-cave":1,"tone-garden":1,"rhythm-river":1}).includes(entry.mode)&&['easy','steady','challenge'].includes(entry.difficulty)&&entry.source==='microphone'&&Number.isInteger(entry.correct)&&Number.isInteger(entry.total)&&entry.total>=5&&entry.total<=16&&entry.correct>=0&&entry.correct<=entry.total&&Number.isInteger(entry.score)&&entry.score>=0&&entry.score<=2500&&Number.isInteger(entry.durationSeconds)&&entry.durationSeconds>=0&&entry.durationSeconds<=3600&&typeof entry.createdAt==='string'&&Number.isFinite(Date.parse(entry.createdAt));
}
/** Game stars are recreational achievements, never lesson mastery evidence. */
export function recordGameSession(state,payload,when=new Date()){
 const entry={...payload,createdAt:when.toISOString()};
 if(!validGameSession(entry))throw Error('Invalid microphone game session');
 const next=clone(state);next.gameSessions=[entry,...(next.gameSessions||[])].slice(0,250);return next;
}
export function hydrateState(saved){
 if(!saved||typeof saved!=='object')throw Error('Invalid local learner state');
 const base=createInitialState();
 base.preferences=updatePreferences(base,saved.preferences||{}).preferences;
 const existing=new Map((Array.isArray(saved.skills)?saved.skills:[]).map(s=>[s.slug,s]));
 base.skills=base.skills.map(skill=>{
  const previous=existing.get(skill.slug);
  if(!previous||!MASTERY.includes(previous.masteryState))return skill;
  return {...skill,masteryState:previous.masteryState,accuracyPercent:number(previous.accuracyPercent,0,100,0),attemptsCount:integer(previous.attemptsCount,0,100000,0),lastPracticedAt:ISO_DATE.test(previous.lastPracticedAt)?previous.lastPracticedAt:'',nextReviewDueAt:ISO_DATE.test(previous.nextReviewDueAt)?previous.nextReviewDueAt:'',evidenceSummary:string(previous.evidenceSummary,400)};
 });
 if(Array.isArray(saved.attempts))base.attempts=saved.attempts.slice(0,10000);
 if(Array.isArray(saved.practiceSessions))base.practiceSessions=saved.practiceSessions.slice(0,2000).filter(validPracticeSession);
 if(Array.isArray(saved.gameSessions))base.gameSessions=saved.gameSessions.slice(0,250).filter(validGameSession);
 if(Array.isArray(saved.repertoire))base.repertoire=saved.repertoire.slice(0,500);
 if(Array.isArray(saved.routines))base.routines=saved.routines.slice(0,500);
 if(Array.isArray(saved.customDrills)){
  base.customDrills=saved.customDrills.slice(0,200).filter(d=>{
   try{generatePracticePattern(d);return Number.isInteger(d.id)&&d.id>0&&typeof d.title==='string'&&d.title.length<=100;}catch{return false;}
  });
 }
 return base;
}
export function backupState(state){return {schemaVersion:BACKUP_FORMAT,exportedAt:new Date().toISOString(),preferences:clone(state.preferences),skills:clone(state.skills),attempts:clone(state.attempts),practiceSessions:clone(state.practiceSessions||[]),gameSessions:clone(state.gameSessions||[]),repertoire:clone(state.repertoire),routines:clone(state.routines),customDrills:clone(state.customDrills||[])};}
export function validateBackup(bundle){
 if(!bundle||typeof bundle!=='object'||Array.isArray(bundle)||bundle.schemaVersion!==BACKUP_FORMAT)throw Error('Invalid Vocal Studio backup format');
 for(const k of ['skills','attempts','repertoire','routines'])if(!Array.isArray(bundle[k]))throw Error(`Invalid backup: missing ${k}`);
 if(!bundle.preferences||typeof bundle.preferences!=='object'||Array.isArray(bundle.preferences))throw Error('Invalid backup preferences');
 if(bundle.skills.length<1||bundle.skills.length>100||bundle.attempts.length>10000||bundle.repertoire.length>500||bundle.routines.length>500)throw Error('Backup record limits exceeded');
 const expected=new Set(CATALOG.skills.map(x=>x.slug));
 const seen=new Set();
 for(const x of bundle.skills){if(!x||!expected.has(x.slug)||seen.has(x.slug)||!MASTERY.includes(x.masteryState)||!Number.isInteger(x.attemptsCount)||x.attemptsCount<0||x.attemptsCount>100000||!Number.isFinite(x.accuracyPercent)||x.accuracyPercent<0||x.accuracyPercent>100)throw Error('Invalid backup skills');seen.add(x.slug);}
 for(const a of bundle.attempts){if(!a||!Number.isInteger(a.id)||!expected.has(a.skillSlug)||typeof a.lessonSlug!=='string'||!['microphone','interactive','rhythm-taps','self-report'].includes(a.source)||!(a.scorePercent===null||(Number.isFinite(a.scorePercent)&&a.scorePercent>=0&&a.scorePercent<=100))||!Number.isFinite(Date.parse(a.createdAt)))throw Error('Invalid backup attempts');}
 for(const r of bundle.repertoire){if(!r||!Number.isInteger(r.id)||r.id<=0||typeof r.title!=='string'||r.title.length>120||!Array.isArray(r.melodyNotes)||r.melodyNotes.length>256||!r.melodyNotes.every(n=>Number.isInteger(n.midi)&&n.midi>=20&&n.midi<=110&&Number.isFinite(n.durationBeats)&&n.durationBeats>0&&n.durationBeats<=32))throw Error('Invalid backup repertoire');}
 for(const r of bundle.routines){if(!r||!Number.isInteger(r.id)||r.id<=0||typeof r.title!=='string'||!Array.isArray(r.stepsJson)||r.stepsJson.length>12)throw Error('Invalid backup routines');}
 if(bundle.customDrills!==undefined){
  if(!Array.isArray(bundle.customDrills)||bundle.customDrills.length>200)throw Error('Invalid custom drill archive');
  const ids=new Set();for(const d of bundle.customDrills){try{generatePracticePattern(d);}catch{throw Error('Invalid custom practice pattern');}
   if(!Number.isInteger(d.id)||d.id<1||ids.has(d.id)||typeof d.title!=='string'||!d.title.trim()||d.title.length>100)throw Error('Invalid custom drill');ids.add(d.id);}
 }
 if(bundle.gameSessions!==undefined&&(!Array.isArray(bundle.gameSessions)||bundle.gameSessions.length>250||!bundle.gameSessions.every(validGameSession)))throw Error('Invalid backup game session');
 if(bundle.practiceSessions!==undefined){
  if(!Array.isArray(bundle.practiceSessions)||bundle.practiceSessions.length>2000||!bundle.practiceSessions.every(validPracticeSession))throw Error('Invalid backup practice session');
 }
 const {recordings:audioManifest,...learningData}=bundle;
 if(JSON.stringify(learningData).length>5_000_000)throw Error('Learning journal exceeds backup safety size limit');
 return true;
}
export function restoreBackup(bundle){
 validateBackup(bundle);const base=createInitialState();
 const userSkills=new Map(bundle.skills.map(s=>[s.slug,s]));
 base.preferences=updatePreferences(base,bundle.preferences).preferences;
 base.skills=base.skills.map(s=>{const u=userSkills.get(s.slug);if(!u)return s;return {...s,masteryState:u.masteryState,accuracyPercent:u.accuracyPercent,attemptsCount:u.attemptsCount,lastPracticedAt:ISO_DATE.test(u.lastPracticedAt)?u.lastPracticedAt:'',nextReviewDueAt:ISO_DATE.test(u.nextReviewDueAt)?u.nextReviewDueAt:'',evidenceSummary:string(u.evidenceSummary,400)};});
 base.attempts=bundle.attempts.map(a=>({...a,evidenceNotes:string(a.evidenceNotes,1000),selfReflection:string(a.selfReflection,2000),exerciseTitle:string(a.exerciseTitle,200),targetSummary:string(a.targetSummary,200)}));
 base.practiceSessions=(bundle.practiceSessions||[]).map(s=>({...s}));
 base.gameSessions=(bundle.gameSessions||[]).map(s=>({...s}));
 base.repertoire=bundle.repertoire.map(r=>({...r,title:string(r.title,120),composerOrTradition:string(r.composerOrTradition,150),annotations:string(r.annotations,4000),melodyNotes:clone(r.melodyNotes)}));
 base.routines=bundle.routines.map(r=>({...r,title:string(r.title,120),stepsJson:r.stepsJson.map(s=>string(s,160))}));
 base.customDrills=(bundle.customDrills||[]).map(d=>({...d,title:string(d.title,100)}));
 return base;
}
