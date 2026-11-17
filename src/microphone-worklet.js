/** Captures a rolling window in the browser's audio processing thread.
 * Samples are posted to this page only and are not sent to disk or a remote service.
 */
class VocalMicCapture extends AudioWorkletProcessor {
 constructor(){super();this.ring=new Float32Array(8192);this.pos=0;this.collected=0;this.framesSincePost=0;}
 process(inputs,outputs){
  const samples=inputs[0]?.[0];
  if(samples){for(let i=0;i<samples.length;i++){this.ring[this.pos]=samples[i];this.pos=(this.pos+1)%this.ring.length;this.collected=Math.min(this.ring.length,this.collected+1);}}
  this.framesSincePost+=(samples?.length||128);
  if(this.framesSincePost>=2048&&this.collected===this.ring.length){
   this.framesSincePost=0;
   const windowSamples=new Float32Array(this.ring.length);
   windowSamples.set(this.ring.subarray(this.pos));windowSamples.set(this.ring.subarray(0,this.pos),this.ring.length-this.pos);
   this.port.postMessage({type:'samples',samples:windowSamples},[windowSamples.buffer]);
  }
  // Output stays at absolute zero; microphone input must never be monitored into speakers.
  for(const bus of outputs)for(const channel of bus)channel.fill(0);
  return true;
 }
}
registerProcessor('vocal-mic-capture',VocalMicCapture);
