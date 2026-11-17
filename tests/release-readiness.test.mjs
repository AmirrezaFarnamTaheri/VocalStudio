import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,backupState,validateBackup,restoreBackup} from '../src/learning.js';
import {summarizeAudioCheck,runDeviceSignalCheck} from '../src/diagnostics.js';
import {parseRecordingManifest,recordingFilename} from '../src/store.js';

test('an older backup missing newer skills restores without manufacturing mastery',()=>{
 const bundle=backupState(createInitialState());
 bundle.skills=bundle.skills.slice(0,8);
 assert.equal(validateBackup(bundle),true);
 const state=restoreBackup(bundle);
 assert.equal(state.skills.length,createInitialState().skills.length);
 assert.ok(state.skills.every(s=>s.masteryState==='not-started'));
});

test('audio check distinguishes silence, a signal without clear pitch and confident pitch',()=>{
 const silent=summarizeAudioCheck(Array.from({length:25},()=>({rms:.001,hz:0,confidence:0})));
 assert.equal(silent.status,'silent');
 const noise=summarizeAudioCheck(Array.from({length:25},()=>({rms:.07,hz:0,confidence:0})));
 assert.equal(noise.status,'signal');
 const voice=summarizeAudioCheck(Array.from({length:25},(_,i)=>({rms:.08,hz:220+i*.05,confidence:.9})));
 assert.equal(voice.status,'pitched');
 assert.ok(Math.abs(voice.medianHz-220)<1);
 assert.equal(voice.frames,25);
 assert.equal(voice.voicedFrames,25);
 assert.equal(voice.confidencePercent,90);
});

test('audio check rejects malformed readings and does not diagnose vocal quality',()=>{
 assert.throws(()=>summarizeAudioCheck(null),/sample|reading/i);
 assert.throws(()=>summarizeAudioCheck([{rms:-2,hz:0,confidence:0}]),/sample|reading/i);
 const reading=summarizeAudioCheck(Array.from({length:25},()=>({rms:.05,hz:220,confidence:.9})));
 assert.doesNotMatch(JSON.stringify(reading),/healthy|good voice|vocal technique|breath support/i);
});

test('backup recordings reject duplicate ids, invalid timestamps and corrupt base64',()=>{
 const valid={id:'clip-1',name:'Warm up',type:'audio/wav',createdAt:'2026-11-16T10:00:00.000Z',base64:'UklGRg=='};
 assert.equal(parseRecordingManifest([valid]).length,1);
 assert.throws(()=>parseRecordingManifest([valid,valid]),/duplicate|id/i);
 assert.throws(()=>parseRecordingManifest([{...valid,createdAt:'yesterday'}]),/date|time/i);
 assert.throws(()=>parseRecordingManifest([{...valid,base64:'not_valid'}]),/base64|corrupt|encoding/i);
});

test('a personal recording downloads with a safe filename and its proper extension',()=>{
 assert.equal(recordingFilename({name:'Practice / My voice',type:'audio/webm'}),'Practice - My voice.webm');
 assert.equal(recordingFilename({name:'My lesson.wav',type:'audio/wav'}),'My lesson.wav');
 assert.doesNotMatch(recordingFilename({name:'../../\\..\\unsafe',type:'audio/ogg'}),/[\\/]/);
});

test('device self-check samples a real audio interface and stops only its own microphone',async()=>{
 let starts=0,stops=0,samples=0;
 const audio={startMic:async()=>{starts++},stopMic:()=>{stops++},sample:()=>{samples++;return {rms:.08,hz:220,confidence:.92}}};
 const fresh=await runDeviceSignalCheck(audio,{deviceId:'mic-1',iterations:12,wait:async()=>{}});
 assert.equal(fresh.status,'pitched');assert.equal(fresh.frames,12);
 assert.equal(starts,1);assert.equal(stops,1);assert.equal(samples,12);
 await runDeviceSignalCheck(audio,{reuseActiveMic:true,iterations:12,wait:async()=>{}});
 assert.equal(starts,1);assert.equal(stops,1);
});

test('device self-check cleans up the newly opened microphone after a sample error',async()=>{
 let stops=0;
 const audio={startMic:async()=>{},stopMic:()=>stops++,sample:()=>{throw Error('device unplugged')}};
 await assert.rejects(runDeviceSignalCheck(audio,{iterations:8,wait:async()=>{}}),/unplugged/);
 assert.equal(stops,1);
});
