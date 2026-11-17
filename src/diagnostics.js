/** A device-signal check, not a vocal-health or singing-quality assessment. */
export function summarizeAudioCheck(readings){
 if(!Array.isArray(readings)||readings.length>300||readings.some(sample=>!sample||!Number.isFinite(sample.rms)||sample.rms<0||sample.rms>2||!Number.isFinite(sample.hz)||sample.hz<0||sample.hz>5000||!Number.isFinite(sample.confidence)||sample.confidence<0||sample.confidence>1))throw Error('Invalid microphone sample readings');
 const frames=readings.length;
 if(frames<8)return {status:'insufficient',frames,voicedFrames:0,medianHz:null,confidencePercent:0,signalPercent:0,message:'Not enough microphone samples. Check permissions and try again.'};
 const voiced=readings.filter(r=>r.hz>=65&&r.hz<=1000&&r.confidence>=.68);
 const rms=readings.map(r=>r.rms).sort((a,b)=>a-b);
 const medianRms=rms[Math.floor(rms.length/2)];
 const signalPercent=Math.min(100,Math.round(medianRms*400));
 const pitches=voiced.map(r=>r.hz).sort((a,b)=>a-b);
 const medianHz=pitches.length?Math.round(pitches[Math.floor(pitches.length/2)]*10)/10:null;
 const confidencePercent=voiced.length?Math.round(voiced.reduce((s,r)=>s+r.confidence,0)/voiced.length*100):0;
 const voicedPercent=Math.round(voiced.length/frames*100);
 let status='signal',message='The microphone receives sound, but no stable sung or hummed pitch was detected. Try a sustained gentle hum in a quiet room.';
 if(medianRms<.008){status='silent';message='Input is very quiet. Check microphone selection, operating-system permissions, and input level.';}
 else if(voiced.length>=8&&voicedPercent>=35){status='pitched';message='The microphone is receiving a detectable steady pitch. You can try a practice exercise.';}
 return {status,frames,voicedFrames:voiced.length,voicedPercent,medianHz,confidencePercent,signalPercent,message};
}

/** User-triggered local signal verification; never stores or uploads captured samples. */
export async function runDeviceSignalCheck(audio,{deviceId='',reuseActiveMic=false,iterations=28,wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!Number.isInteger(iterations)||iterations<8||iterations>100)throw Error('Invalid diagnostic length');
 if(!reuseActiveMic)await audio.startMic(deviceId);
 try{
  const readings=[];
  for(let i=0;i<iterations;i++){
   await wait(110);
   readings.push(audio.sample());
  }
  return summarizeAudioCheck(readings);
 }finally{if(!reuseActiveMic)audio.stopMic();}
}
