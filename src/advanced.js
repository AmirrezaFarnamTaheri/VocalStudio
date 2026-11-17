/** Optional advanced tools. Entirely local, with no external calls. */
import { clamp, centsBetween, midiToFrequency, midiToNoteName, noteNameToMidi, detectFundamental } from './music.js';

/** Evaluates time-aligned monophonic notes, not vocal quality or polyphonic music.
 * Frames must originate from microphone sampling; the UI never supplies a synthetic score.
 * A result with insufficient observed coverage is unscorable, not a zero or an invented pass.
 */
export function scoreMelodyPerformance({notes,bpm,startAt,frames,a4=440,latencyOffsetMs=0,minFrames=3}={}){
 if(!Array.isArray(notes)||notes.length<3||notes.length>64||!notes.every(n=>Number.isInteger(n.midi)&&n.midi>=24&&n.midi<=100&&Number.isFinite(n.durationBeats)&&n.durationBeats>0&&n.durationBeats<=16))throw Error('Provide 3–64 valid melody notes');
 if(!Number.isFinite(bpm)||bpm<30||bpm>240||!Number.isFinite(startAt)||!Array.isArray(frames)||frames.length>20000)throw Error('Invalid melody timing or microphone frames');
 if(!Number.isFinite(a4)||a4<415||a4>466||!Number.isFinite(latencyOffsetMs)||Math.abs(latencyOffsetMs)>300)throw Error('Invalid tuning or latency');
 const beatMs=60000/bpm;
 let elapsed=0,totalVoiced=0,weightedScore=0,weightedCents=0,weight=0,totalConfidence=0;
 const noteResults=notes.map((note,index)=>{
  const onset=startAt+elapsed*beatMs;
  elapsed+=note.durationBeats;
  const duration=note.durationBeats*beatMs;
  // Ignore attack/release edges to reduce false note transitions and onset jitter.
  const first=onset+duration*.17+latencyOffsetMs,last=onset+duration*.83+latencyOffsetMs;
  const targetHz=midiToFrequency(note.midi,a4);
  const voiced=frames.filter(f=>Number.isFinite(f.time)&&f.time>=first&&f.time<=last&&Number.isFinite(f.hz)&&f.hz>0&&Number.isFinite(f.confidence)&&f.confidence>=.68&&f.confidence<=1);
  const count=voiced.length;
  if(count<minFrames)return {index,note:midiToNoteName(note.midi),voicedFrames:count,scorable:false,cents:null,scorePercent:null};
  const vals=voiced.map(f=>centsBetween(f.hz,targetHz)).filter(Number.isFinite).sort((x,y)=>x-y);
  const median=vals.length%2?vals[Math.floor(vals.length/2)]:(vals[vals.length/2-1]+vals[vals.length/2])/2;
  const confidence=voiced.reduce((sum,f)=>sum+f.confidence,0)/count;
  const score=Math.round(clamp(100-Math.abs(median)*.65,0,100));
  totalVoiced+=count;weightedScore+=score;weightedCents+=median;totalConfidence+=confidence;weight++;
  return {index,note:midiToNoteName(note.midi),voicedFrames:count,scorable:true,cents:Math.round(median*10)/10,confidence:Math.round(confidence*100)/100,scorePercent:score};
 });
 const coveragePercent=Math.round(weight/notes.length*100);
 const scorable=weight>=3&&coveragePercent>=70;
 return {scorable,reason:scorable?'Measured microphone evidence':`Only ${weight}/${notes.length} notes have enough confident microphone evidence`,noteResults,coveragePercent,voicedFrames:totalVoiced,scorePercent:scorable?Math.round(weightedScore/weight):null,confidence:weight?Math.round(totalConfidence/weight*100)/100:0,deviationCents:weight?Math.round(weightedCents/weight*10)/10:null,notesMeasured:weight,notesExpected:notes.length};
}

export const DRILL_PATTERNS=Object.freeze({
 pentachord:[0,2,4,5,7,5,4,2,0],
 majorArpeggio:[0,4,7,12,7,4,0],
 minorArpeggio:[0,3,7,12,7,3,0],
 thirds:[0,4,2,5,4,7,5,9,7,12],
 minorScale:[0,2,3,5,7,8,10,12,10,8,7,5,3,2,0],
 chromatic:[0,1,2,3,4,5,4,3,2,1,0],
});
export function generatePracticePattern(drill){
 const {rootMidi,pattern,bpm}=drill||{};
 if(!Number.isInteger(rootMidi)||rootMidi<36||rootMidi>84||!DRILL_PATTERNS[pattern]||!Number.isInteger(bpm)||bpm<40||bpm>200)throw Error('Invalid practice pattern settings');
 return DRILL_PATTERNS[pattern].map(offset=>({midi:rootMidi+offset,note:midiToNoteName(rootMidi+offset),durationBeats:1}));
}

function firstMatch(block,tag){const re=new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i');return block.match(re)?.[1]?.trim()??'';}
function readNum(text){return Number(text);}
export function parseMusicXML(xml){
 if(typeof xml!=='string'||xml.length>800000||!/<score-partwise(?:\s|>)/i.test(xml))throw Error('Provide a MusicXML score-partwise file under 800 KB');
 if(/<!\s*(?:DOCTYPE|ENTITY)|<\s*(?:backup|forward|harmony|transpose)\b|<\s*chord\b/i.test(xml))throw Error('Unsupported MusicXML doctype, entities or polyphonic chords');
 const part=xml.match(/<part(?:\s[^>]*)?>([\s\S]*?)<\/part>/i)?.[1];
 if(!part)throw Error('No MusicXML part found');
 const measures=[...part.matchAll(/<measure(?:\s[^>]*)?>([\s\S]*?)<\/measure>/gi)].map(x=>x[1]);
 if(!measures.length)throw Error('No supported music measures found');
 const melodyNotes=[];let divisions=1;
 for(const measure of measures){
  const div=firstMatch(measure,'divisions');if(div){divisions=readNum(div);if(!Number.isInteger(divisions)||divisions<1||divisions>10000)throw Error('Invalid MusicXML divisions');}
  for(const match of measure.matchAll(/<note(?:\s[^>]*)?>([\s\S]*?)<\/note>/gi)){
   const note=match[1];
   if(/<rest\b|<grace\b|<unpitched\b/i.test(note))throw Error('Rests and grace notes are not supported by the note-only repertoire importer');
   const pitch=firstMatch(note,'pitch');
   const step=firstMatch(pitch,'step').toUpperCase(),octave=readNum(firstMatch(pitch,'octave'));
   const alterText=firstMatch(pitch,'alter');const alter=alterText?readNum(alterText):0;
   if(!/^[A-G]$/.test(step)||!Number.isInteger(octave)||octave<2||octave>6||![-1,0,1].includes(alter))throw Error('Unsupported MusicXML pitch');
   const duration=readNum(firstMatch(note,'duration'))/divisions;
   if(!Number.isFinite(duration)||duration<=0||duration>32)throw Error('Invalid MusicXML duration');
   const midi=noteNameToMidi(`${step}${alter===1?'#':alter===-1?'b':''}${octave}`);
   if(midi<20||midi>110)throw Error('Note outside supported range');
   melodyNotes.push({midi,note:midiToNoteName(midi),durationBeats:duration,solfege:'',fixedSolfege:''});
   if(melodyNotes.length>256)throw Error('MusicXML melody exceeds 256 notes');
  }
 }
 if(!melodyNotes.length)throw Error('No supported pitched notes in MusicXML file');
 let title=firstMatch(xml,'work-title')||firstMatch(xml,'movement-title')||'Imported MusicXML melody';
 title=title.replace(/<[^>]+>/g,'').replace(/&(amp|quot|apos|lt|gt);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[n])).trim().slice(0,120);
 return {title:title||'Imported MusicXML melody',composerOrTradition:'Imported personal score',melodyNotes};
}

/** Deterministic, source-grounded guide; intentionally not an AI model. */
export function answerStudyQuestion(query,state){
 const normalized=String(query||'').toLowerCase().slice(0,300);
 const stop=new Set(['a','about','and','are','can','could','do','does','for','how','i','in','is','it','learn','me','my','of','on','or','please','should','tell','the','to','what','when','where','which','why','with','you']);
 const terms=normalized.normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]{2,}/g)?.filter(w=>!stop.has(w))??[];
 const entries=[...(state.lessons||[]).map(l=>({title:l.title,description:`${l.objective} ${l.explanation}`,slug:l.slug,kind:'lesson'})),...(state.skills||[]).map(s=>({title:s.title,description:s.description,slug:s.slug,kind:'skill'}))];
 const ranked=entries.map(entry=>{
  const title=entry.title.toLowerCase(),description=entry.description.toLowerCase();
  const score=terms.reduce((acc,term)=>acc+(title.includes(term)?5:0)+(description.includes(term)?1:0),0);
  return {...entry,score};
 }).filter(entry=>entry.score>=2).sort((a,b)=>b.score-a.score).slice(0,3);
 if(!terms.length||!ranked.length)return {text:'No matching explanation was found in your local learning library. Try a musical term such as interval, breath, major third, solfège, rhythm or notation.',references:[]};
 const lead=ranked[0];const sentences=lead.description.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[lead.description];
 const excerpts=sentences.slice(0,3).join(' ').trim().slice(0,540);
 return {text:`${lead.title}: ${excerpts}\n\nPractice suggestion: review this topic in Academy, listen to its example, and try a related exercise at a comfortable pace.`,references:ranked.map(x=>x.slug)};
}

/** Turns a locally decoded recording into a sparse, confidence-gated melody contour. */
export function extractPitchContour(samples,sampleRate,{hopMs=250,maxPoints=180}={}){
 if(!(samples instanceof Float32Array)||!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000||!Number.isFinite(hopMs)||hopMs<90||hopMs>1000)throw Error('Invalid recording sample format');
 const contour=[];const windowLength=Math.min(8192,Math.max(4096,Math.round(sampleRate*.18)));
 const hop=Math.max(1,Math.round(sampleRate*hopMs/1000));
 for(let i=0;i+windowLength<=samples.length&&contour.length<maxPoints;i+=hop){
  const frame=detectFundamental(samples.subarray(i,i+windowLength),sampleRate);
  if(frame.confidence<.68||frame.hz<=0)continue;
  contour.push({timeSeconds:Math.round(i/sampleRate*100)/100,midi:Math.round((69+12*Math.log2(frame.hz/440))*100)/100,hz:Math.round(frame.hz*10)/10,confidence:Math.round(frame.confidence*100)/100});
 }
 return contour;
}
/** All shape comparisons are transposition-invariant, not voice-quality assessments. */
export function comparePitchContours(a,b){
 const values=items=>Array.isArray(items)?items.map(n=>typeof n==='number'?n:n?.midi).filter(Number.isFinite):[];
 const x=values(a),y=values(b);
 if(x.length<3||y.length<3)return {comparable:false,similarityPercent:null,reason:'At least three pitched observations are required from each recording'};
 const steps=Math.min(32,Math.max(x.length,y.length));
 function sample(arr,t){const pos=t*(arr.length-1),lo=Math.floor(pos),hi=Math.min(arr.length-1,lo+1),alpha=pos-lo;return arr[lo]*(1-alpha)+arr[hi]*alpha;}
 let difference=0;const originX=sample(x,0),originY=sample(y,0);
 for(let i=0;i<steps;i++){const time=i/(steps-1);difference+=Math.abs((sample(x,time)-originX)-(sample(y,time)-originY));}
 const meanSemitoneDifference=difference/steps;
 return {comparable:true,similarityPercent:Math.round(clamp(100-meanSemitoneDifference*22,0,100)),meanSemitoneDifference:Math.round(meanSemitoneDifference*100)/100,reason:'Relative contour resemblance only; not a measure of vocal quality'};
}

/** Target onset positions within one repeating bar, in quarter-note beats. */
export const RHYTHM_PATTERNS=Object.freeze({
 quarter:{label:'Steady quarter notes',beats:4,onsets:[0,1,2,3]},
 offbeat:{label:'Eight-note offbeats',beats:4,onsets:[.5,1.5,2.5,3.5]},
 syncopated:{label:'Syncopated pattern',beats:4,onsets:[0,.75,1.5,2.75,3.5]},
 waltz:{label:'Three-quarter pulse',beats:3,onsets:[0,1,2]},
 eighths:{label:'Eighth-note subdivisions',beats:4,onsets:[0,.5,1,1.5,2,2.5,3,3.5]},
 triplets:{label:'Triplet subdivisions',beats:4,onsets:[0,1/3,2/3,1,4/3,5/3,2,7/3,8/3,3,10/3,11/3]},
});
export function rhythmTapOffset(timeMs,epochMs,bpm,pattern='quarter',latencyMs=0){
 const p=RHYTHM_PATTERNS[pattern];if(!p)throw Error('Invalid rhythm pattern');
 if(!Number.isFinite(timeMs)||!Number.isFinite(epochMs)||!Number.isFinite(bpm)||bpm<30||bpm>240||!Number.isFinite(latencyMs)||Math.abs(latencyMs)>300)throw Error('Invalid rhythm timing');
 const beatMs=60000/bpm,beat=(timeMs-epochMs-latencyMs)/beatMs,barIndex=Math.floor(beat/p.beats);
 let delta=Infinity;
 for(let bar=barIndex-1;bar<=barIndex+1;bar++)for(const onset of p.onsets){
  const diff=(beat-(bar*p.beats+onset))*beatMs;
  if(Math.abs(diff)<Math.abs(delta))delta=diff;
 }
 return delta;
}
