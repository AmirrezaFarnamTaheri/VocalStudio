/** Dependency-free music calculations and confidence-gated fundamental estimation. */
const PITCH_CLASSES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const NOTE_OFFSET = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const INTERVALS = ['Unison','Minor second','Major second','Minor third','Major third','Perfect fourth','Tritone','Perfect fifth','Minor sixth','Major sixth','Minor seventh','Major seventh','Octave'];
export const SCALE_PATTERNS = {major:[0,2,4,5,7,9,11,12],naturalMinor:[0,2,3,5,7,8,10,12],pentatonic:[0,2,4,7,9,12]};
export const SOLFEGE = ['Do','Di/Ra','Re','Me/Ri','Mi','Fa','Fi/Se','Sol','Le/Si','La','Te/Li','Ti'];
export function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
export function midiToFrequency(midi,a4=440){return a4*2**((midi-69)/12);}
export function frequencyToMidi(hz,a4=440){return hz>0&&a4>0 ? 69+12*Math.log2(hz/a4) : NaN;}
export function midiToNoteName(midi){if(!Number.isFinite(midi))return '—';const n=Math.round(midi);return PITCH_CLASSES[((n%12)+12)%12]+(Math.floor(n/12)-1);}
/** Treble staff position in diatonic half-line steps, relative to E4 (bottom line).
 * C and C-sharp share a staff position; accidentals are rendered separately.
 */
export function staffStepForMidi(midi){
 const name=midiToNoteName(midi);const match=name.match(/^([A-G])(?:#|b)?(-?\d+)$/);
 if(!match)throw Error('Invalid staff note');
 const step={C:0,D:1,E:2,F:3,G:4,A:5,B:6}[match[1]];
 return (Number(match[2])-4)*7+step-2;
}
export function noteNameToMidi(note){const match=String(note).trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);if(!match)throw new Error('Invalid musical note');const pc=match[1].toUpperCase()+match[2];const offset=NOTE_OFFSET[pc];if(offset===undefined)throw new Error('Invalid musical note');return (Number(match[3])+1)*12+offset;}
export function centsBetween(hz,targetHz){return hz>0&&targetHz>0?1200*Math.log2(hz/targetHz):NaN;}
export function intervalName(semitones){return INTERVALS[Math.abs(semitones)]??`${Math.abs(semitones)} semitones`;}
export function evaluatePitch(reading,targetHz,{toleranceCents=20,octaveEquivalence=false}={}){
 const {hz=0,confidence=0}=reading??{};
 if(!Number.isFinite(hz)||hz<=0||!Number.isFinite(confidence)||confidence<0.68)return {scorable:false,cents:null,inTune:false,confidence:0};
 let cents=centsBetween(hz,targetHz);
 if(octaveEquivalence)cents-=Math.round(cents/1200)*1200;
 return {scorable:true,cents:Math.round(cents*10)/10,inTune:Math.abs(cents)<=toleranceCents,confidence:clamp(confidence,0,1),detectedNote:midiToNoteName(frequencyToMidi(hz))};
}
/** YIN cumulative mean normalized difference; rejects silence and ambiguous periodicity.
 * Designed for *single monophonic voice* at 65–1000 Hz, not polyphonic mixes.
 */
export function detectFundamental(samples,rate=44100){
 if(!samples||samples.length<1024||!Number.isFinite(rate)||rate<4000)return {hz:0,confidence:0,rms:0};
 const size=Math.min(samples.length,4096), start=samples.length-size;
 let rms=0,mean=0;
 for(let i=0;i<size;i++)mean+=samples[start+i];mean/=size;
 for(let i=0;i<size;i++){const s=samples[start+i]-mean;rms+=s*s;}
 rms=Math.sqrt(rms/size);
 if(rms<0.01)return {hz:0,confidence:0,rms};
 const minLag=Math.max(2,Math.floor(rate/1000));
 const maxLag=Math.min(Math.floor(rate/65),Math.floor(size/2)-1);
 const windowSize=size-maxLag;
 const difference=new Float64Array(maxLag+1);
 const norm=new Float64Array(maxLag+1);
 let cumulative=0;
 for(let lag=1;lag<=maxLag;lag++){
   let sum=0;
   for(let i=0;i<windowSize;i++){
     const d=samples[start+i]-samples[start+i+lag];sum+=d*d;
   }
   difference[lag]=sum;cumulative+=sum;
   norm[lag]=cumulative>0?sum*lag/cumulative:1;
 }
 let lag=-1;
 for(let i=minLag;i<maxLag-1;i++){
   if(norm[i]<0.16){
     while(i+1<=maxLag && norm[i+1]<norm[i])i++;
     lag=i;break;
   }
 }
 if(lag===-1){let best=1;for(let i=minLag;i<maxLag;i++)if(norm[i]<best){best=norm[i];lag=i;}}
 if(lag<minLag||norm[lag]>0.30)return {hz:0,confidence:0,rms};
 const before=norm[lag-1]??norm[lag], center=norm[lag],after=norm[lag+1]??norm[lag];
 const denominator=before-2*center+after;
 const correction=Math.abs(denominator)>1e-8?clamp(0.5*(before-after)/denominator,-0.5,0.5):0;
 const hz=rate/(lag+correction);
 const confidence=clamp(1-center,0,1);
 if(hz<65||hz>1000||confidence<0.68)return {hz:0,confidence:0,rms};
 return {hz,confidence,rms};
}
export function transposeNotes(notes,semitones){return notes.map(n=>({...n,midi:n.midi+semitones,note:midiToNoteName(n.midi+semitones)}));}
export function majorScale(root){return SCALE_PATTERNS.major.map(n=>root+n);}
/** Returns chromatic solfege relative to the displayed tonic (or fixed note names). */
export function solfegeForMidi(midi,keySignature='C Major',system='movable-do'){
 const tonicName=String(keySignature).trim().match(/^([A-G](?:#|b)?)/)?.[1]||'C';
 const tonicPc=noteNameToMidi(`${tonicName}4`)%12;
 const pitchClass=((Math.round(midi)-(system==='fixed-do'?0:tonicPc))%12+12)%12;
 return SOLFEGE[pitchClass];
}
