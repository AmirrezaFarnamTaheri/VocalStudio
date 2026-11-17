import test from 'node:test';
import assert from 'node:assert/strict';
import { audio } from '../src/audio.js';

test('audio device chooser shows only microphone inputs and never asks for permission implicitly',async()=>{
 const original=globalThis.navigator;
 let captureCalls=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{enumerateDevices:async()=>[
  {deviceId:'mic1',kind:'audioinput',label:'Internal microphone'},
  {deviceId:'spkr',kind:'audiooutput',label:'Speaker'},
  {deviceId:'camera',kind:'videoinput',label:'Camera'},
 ],getUserMedia:()=>{captureCalls++;throw Error('Should not start microphone');}}}});
 try{
  const devices=await audio.availableInputs();
  assert.deepEqual(devices.map(x=>x.deviceId),['mic1']);
  assert.equal(captureCalls,0);
 }finally{Object.defineProperty(globalThis,'navigator',{configurable:true,value:original});}
});
