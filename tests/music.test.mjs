import test from 'node:test';
import assert from 'node:assert/strict';
import { midiToFrequency, frequencyToMidi, noteNameToMidi, midiToNoteName, centsBetween, evaluatePitch, detectFundamental, intervalName } from '../src/music.js';

test('concert pitch and note conversion are consistent', () => {
  assert.equal(midiToFrequency(69), 440);
  assert.ok(Math.abs(frequencyToMidi(261.6256)-60)<0.001);
  assert.equal(noteNameToMidi('Eb4'), 63);
  assert.equal(midiToNoteName(61), 'C#4');
  assert.ok(Math.abs(centsBetween(466.164,440)-100)<0.01);
});

test('pitch measurements remain unscorable without voiced evidence', () => {
  assert.equal(evaluatePitch({hz:0,confidence:0}, 440).scorable,false);
  assert.equal(evaluatePitch({hz:440,confidence:0.2},440).scorable,false);
  assert.equal(evaluatePitch({hz:440,confidence:0.9},440).scorable,true);
});

test('a synthesized 220 Hz signal is detected from samples', () => {
  const sampleRate=44100, n=8192;
  const buffer=Float32Array.from({length:n},(_,i)=>0.65*Math.sin(2*Math.PI*220*i/sampleRate));
  const result=detectFundamental(buffer,sampleRate);
  assert.ok(result.confidence>0.7,JSON.stringify(result));
  assert.ok(Math.abs(centsBetween(result.hz,220))<15,JSON.stringify(result));
});

test('a synthesized 440 Hz signal is detected despite a second harmonic', () => {
  const rate=48000,n=8192;
  const buffer=Float32Array.from({length:n},(_,i)=>0.6*Math.sin(2*Math.PI*440*i/rate)+0.21*Math.sin(2*Math.PI*880*i/rate));
  const result=detectFundamental(buffer,rate);
  assert.ok(Math.abs(centsBetween(result.hz,440))<15,JSON.stringify(result));
});

test('silence is unscorable and intervals have readable names', () => {
  assert.equal(detectFundamental(new Float32Array(4096),44100).hz,0);
  assert.equal(intervalName(7),'Perfect fifth');
});

test('staff positions use diatonic letter steps, not chromatic semitone interpolation', async()=>{
 const {staffStepForMidi}=await import('../src/music.js');
 assert.equal(staffStepForMidi(60),-2); // middle C ledger
 assert.equal(staffStepForMidi(61),-2); // C sharp is on the same line
 assert.equal(staffStepForMidi(62),-1); // D4 space
 assert.equal(staffStepForMidi(64),0);  // E4 bottom line
 assert.equal(staffStepForMidi(66),1);  // F sharp4 is F4 space
 assert.equal(staffStepForMidi(67),2);  // G4 second line
 assert.equal(staffStepForMidi(72),5);  // C5 third space
});

test('movable solfege follows the piece tonic and fixed solfege follows note names',async()=>{
 const {solfegeForMidi}=await import('../src/music.js');
 assert.equal(solfegeForMidi(69,'A Minor','movable-do'),'Do');
 assert.equal(solfegeForMidi(69,'A Minor','fixed-do'),'La');
 assert.equal(solfegeForMidi(62,'D Dorian','movable-do'),'Do');
 assert.equal(solfegeForMidi(64,'D Dorian','movable-do'),'Re');
});
