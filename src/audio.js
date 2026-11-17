/** Entirely local audio engine. No microphone samples leave this browser process. */
import { midiToFrequency, detectFundamental } from './music.js';
import { extractPitchContour } from './advanced.js';

class StudioAudio {
 constructor(){this.ctx=null;this.micStream=null;this.micSource=null;this.analyser=null;this.buffer=null;this.mediaRecorder=null;this.tones=new Set();this.worklet=null;this.mutedOutput=null;this.workletBuffer=null;this.workletAt=0;this.workletLoaded=false;}
 context(){
  if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();
  if(this.ctx.state==='suspended')void this.ctx.resume();
  return this.ctx;
 }
 tone(midi,{duration=0.7,volume=0.16,a4=440,type='sine',startAt=0}={}){
  const ctx=this.context(),start=ctx.currentTime+Math.max(0,startAt),freq=midiToFrequency(midi,a4);
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,start);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.01,volume),start+.025);
  gain.gain.setValueAtTime(volume,start+Math.max(.03,duration-.1));
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(gain).connect(ctx.destination);osc.start(start);osc.stop(start+duration+.02);
  this.tones.add(osc);osc.onended=()=>{osc.disconnect();gain.disconnect();this.tones.delete(osc);};return osc;
 }
 melody(notes,{bpm=80,a4=440,transpose=0,repeat=1}={}){
  const beat=60/bpm;let time=0;
  for(let pass=0;pass<Math.min(4,Math.max(1,repeat));pass++)for(const n of notes){const duration=Math.max(.1,n.durationBeats*beat);this.tone(n.midi+transpose,{duration:duration*.89,startAt:time,a4});time+=duration;}
  return time;
 }
 click(accent=false){this.tone(accent?84:79,{duration:.045,volume:accent?.23:.15,type:'triangle'});}
 stopTones(){for(const osc of this.tones){try{osc.stop();}catch{}}this.tones.clear();}
 async availableInputs(){
  if(!navigator.mediaDevices?.enumerateDevices)return [];
  return (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput').map(d=>({deviceId:d.deviceId,label:d.label||'Microphone (permission needed)'}));
 }
 async startMic(deviceId=''){
  if(this.micStream)return this.micStream;
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone access requires the local launcher and browser permission.');
  const constraints={echoCancellation:false,noiseSuppression:false,autoGainControl:false};
  if(deviceId)constraints.deviceId={exact:deviceId};
  const stream=await navigator.mediaDevices.getUserMedia({audio:constraints});
  try{
   const ctx=this.context();this.micStream=stream;
   this.micSource=ctx.createMediaStreamSource(stream);
   this.analyser=ctx.createAnalyser();this.analyser.fftSize=8192;this.analyser.smoothingTimeConstant=0;
   this.buffer=new Float32Array(this.analyser.fftSize);this.micSource.connect(this.analyser);
   if(ctx.audioWorklet&&typeof AudioWorkletNode!=='undefined'){
    try{
     if(!this.workletLoaded){await ctx.audioWorklet.addModule(new URL('./microphone-worklet.js',import.meta.url));this.workletLoaded=true;}
     this.worklet=new AudioWorkletNode(ctx,'vocal-mic-capture');
     this.worklet.port.onmessage=event=>{
      if(event.data?.type==='samples'&&event.data.samples instanceof Float32Array){this.workletBuffer=event.data.samples;this.workletAt=performance.now();}
     };
     this.mutedOutput=ctx.createGain();this.mutedOutput.gain.value=0;
     this.micSource.connect(this.worklet);this.worklet.connect(this.mutedOutput).connect(ctx.destination);
    }catch(error){
     // Some browsers do not permit audio worklets; AnalyserNode remains functional.
     console.warn('Audio worklet unavailable; using analyzer fallback:',error?.message||error);
     try{this.worklet?.disconnect();}catch{};this.worklet=null;this.mutedOutput=null;
    }
   }
   stream.getAudioTracks()[0]?.addEventListener('ended',()=>this.stopMic(),{once:true});
   return stream;
  }catch(error){stream.getTracks().forEach(t=>t.stop());this.stopMic();throw error;}
 }
 stopMic(){
  if(this.mediaRecorder?.state==='recording')this.mediaRecorder.stop();
  try{this.micSource?.disconnect();}catch{}
  try{this.worklet?.disconnect();}catch{}
  try{this.mutedOutput?.disconnect();}catch{}
  this.micStream?.getTracks().forEach(t=>t.stop());
  this.micStream=null;this.micSource=null;this.analyser=null;this.buffer=null;this.worklet=null;this.mutedOutput=null;this.workletBuffer=null;this.workletAt=0;
 }
 sample(){
  if(this.workletBuffer&&performance.now()-this.workletAt<250)return detectFundamental(this.workletBuffer,this.context().sampleRate);
  if(!this.analyser||!this.buffer)return {hz:0,confidence:0,rms:0};
  this.analyser.getFloatTimeDomainData(this.buffer);
  return detectFundamental(this.buffer,this.context().sampleRate);
 }
 async recordVoice({maxSeconds=20}={}){
  await this.startMic();
  if(!window.MediaRecorder)throw Error('Voice recording unsupported by this browser');
  if(this.mediaRecorder?.state==='recording')throw Error('Recording already active');
  const chunks=[],recorder=new MediaRecorder(this.micStream);this.mediaRecorder=recorder;
  const result=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
   recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||'audio/webm'}));
   recorder.onerror=()=>reject(Error('Recording failed'));
  });
  recorder.start();
  const timeout=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},Math.min(20,Math.max(1,maxSeconds))*1000);
  return {stop:()=>{clearTimeout(timeout);if(recorder.state==='recording')recorder.stop();return result;},result};
 }
 async analyseRecording(blob){
  if(!(blob instanceof Blob)||blob.size<=0||blob.size>24*1024*1024)throw Error('Recording is empty or exceeds 24 MB');
  const data=await blob.arrayBuffer();
  const decoded=await this.context().decodeAudioData(data);
  if(decoded.duration>40)throw Error('Recording duration is too long for local contour analysis');
  // Reduce channels to the first mono channel for monophonic pitch estimation.
  const contour=extractPitchContour(decoded.getChannelData(0),decoded.sampleRate,{hopMs:250,maxPoints:130});
  return {durationSeconds:Math.round(decoded.duration*10)/10,contour};
 }
}
export const audio=new StudioAudio();
