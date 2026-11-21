import { createInitialState, backupState, restoreBackup } from './learning.js';
import { writer, readRoutineDraft } from './session.js';
const DB_NAME='vocal-studio-personal';
const DB_VERSION=1;
const STATE_STORE='state';
const RECORDINGS_STORE='recordings';
const LIMIT_BYTES=24*1024*1024;
let databasePromise;
function requestResult(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('Storage transaction aborted'));});}
export function openStudioDatabase(){
 if(!('indexedDB' in globalThis))return Promise.reject(Error('IndexedDB is required. Open Vocal Studio using its local launcher in a modern browser.'));
 if(!databasePromise){databasePromise=new Promise((resolve,reject)=>{
 const req=indexedDB.open(DB_NAME,DB_VERSION);
 req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STATE_STORE))db.createObjectStore(STATE_STORE);if(!db.objectStoreNames.contains(RECORDINGS_STORE))db.createObjectStore(RECORDINGS_STORE,{keyPath:'id'});};
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Close other Vocal Studio tabs to continue'));
 });}
 return databasePromise;
}
export async function loadStudioState(){const db=await openStudioDatabase();const tx=db.transaction(STATE_STORE,'readonly');const value=await requestResult(tx.objectStore(STATE_STORE).get('current'));return value??createInitialState();}
export async function saveStudioState(state,{completeRoutine=false}={}){
 writer.assert();
 const db=await openStudioDatabase();writer.assert();
 const tx=db.transaction(STATE_STORE,'readwrite'),done=transactionDone(tx),store=tx.objectStore(STATE_STORE);
 store.put(state,'current');
 if(completeRoutine)store.delete('routine-draft');
 await done;return state;
}
export async function loadLocalValue(key){
 const db=await openStudioDatabase();
 return requestResult(db.transaction(STATE_STORE,'readonly').objectStore(STATE_STORE).get(key));
}
export async function saveLocalValue(key,value){
 if(!['routine-draft','setup-dismissed'].includes(key))throw Error('Invalid local setting');
 writer.assert();const db=await openStudioDatabase();writer.assert();
 const tx=db.transaction(STATE_STORE,'readwrite'),done=transactionDone(tx),store=tx.objectStore(STATE_STORE);
 if(value===null)store.delete(key);else store.put(value,key);
 await done;
}
export async function saveRoutineDraft(draft,routines){
 const valid=readRoutineDraft(draft,routines);
 if(!valid)throw Error('This practice draft no longer matches its routine.');
 await saveLocalValue('routine-draft',valid);
}
export async function saveRecording(blob,name){writer.assert();if(!(blob instanceof Blob)||blob.size===0||blob.size>LIMIT_BYTES)throw Error('Recording missing or too large (24 MB maximum)');const db=await openStudioDatabase();writer.assert();const tx=db.transaction(RECORDINGS_STORE,'readwrite');const done=transactionDone(tx);const record={id:crypto.randomUUID(),name:String(name||'Voice practice').slice(0,100),createdAt:new Date().toISOString(),type:blob.type||'audio/webm',blob};tx.objectStore(RECORDINGS_STORE).put(record);await done;return {...record,blob:undefined,size:blob.size};}
export async function listRecordings(){const db=await openStudioDatabase();const tx=db.transaction(RECORDINGS_STORE,'readonly');const all=await requestResult(tx.objectStore(RECORDINGS_STORE).getAll());return all.map(({blob,...rest})=>({...rest,size:blob.size})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
export async function getRecording(id){const db=await openStudioDatabase();const tx=db.transaction(RECORDINGS_STORE,'readonly');return requestResult(tx.objectStore(RECORDINGS_STORE).get(id));}
export async function deleteRecording(id){writer.assert();const db=await openStudioDatabase();writer.assert();const tx=db.transaction(RECORDINGS_STORE,'readwrite');const done=transactionDone(tx);tx.objectStore(RECORDINGS_STORE).delete(id);await done;}
export async function clearPersonalData(){writer.assert();const db=await openStudioDatabase();writer.assert();const tx=db.transaction([STATE_STORE,RECORDINGS_STORE],'readwrite');const done=transactionDone(tx);tx.objectStore(STATE_STORE).clear();tx.objectStore(STATE_STORE).put(createInitialState(),'current');tx.objectStore(RECORDINGS_STORE).clear();await done;return createInitialState();}
function arrayBufferToBase64(buf){const bytes=new Uint8Array(buf);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.slice(i,i+32768));return btoa(binary);}
function base64ToBytes(base64){const binary=atob(base64);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
export async function createPortableBackup(state,{includeRecordings=true}={}){
 const bundle=backupState(state);
 if(includeRecordings){bundle.recordings=[];const db=await openStudioDatabase();const tx=db.transaction(RECORDINGS_STORE,'readonly');const all=await requestResult(tx.objectStore(RECORDINGS_STORE).getAll());const bytes=all.reduce((sum,r)=>sum+r.blob.size,0);
 if(bytes>LIMIT_BYTES)throw Error('Total recordings exceed 24 MB. Export the journal without audio or save voice files separately.');
 for(const r of all){bundle.recordings.push({id:r.id,name:r.name,createdAt:r.createdAt,type:r.type,base64:arrayBufferToBase64(await r.blob.arrayBuffer())});}}
 return bundle;
}
const AUDIO_EXTENSION={'audio/wav':'wav','audio/x-wav':'wav','audio/wave':'wav','audio/vnd.wave':'wav','audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/mpeg':'mp3','audio/mp3':'mp3','audio/aac':'aac','audio/flac':'flac'};
/** A recording can be exported independently when the combined archive would be too large. */
export function recordingFilename(record){
 const type=String(record?.type||'').split(';')[0].toLowerCase(),ext=AUDIO_EXTENSION[type]||'audio';
 const clean=String(record?.name||'Voice practice').replace(/[\\/:*?"<>|\p{Cc}]+/gu,' - ').replace(/\s+/g,' ').replace(/^[.\s-]+|[.\s-]+$/g,'').slice(0,90)||'Voice practice';
 return clean.toLowerCase().endsWith('.'+ext)?clean:clean+'.'+ext;
}
/** Validate the full audio manifest before touching the user's IndexedDB stores. */
export function parseRecordingManifest(manifest=[]){
 if(!Array.isArray(manifest)||manifest.length>100)throw Error('Invalid recording manifest');
 let total=0;const ids=new Set();const recordings=[];
 for(const rec of manifest){
  if(!rec||typeof rec.id!=='string'||!rec.id||rec.id.length>100||ids.has(rec.id))throw Error('Duplicate or invalid recording id');
  if(typeof rec.name!=='string'||!rec.name.trim()||rec.name.length>100||typeof rec.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(rec.createdAt)||!Number.isFinite(Date.parse(rec.createdAt)))throw Error('Invalid recording name or timestamp');
  if(typeof rec.type!=='string'||!/^audio\/[a-z0-9.+-]+(?:;[\w=+.-]+)*$/i.test(rec.type))throw Error('Invalid recording audio type');
  if(typeof rec.base64!=='string'||!rec.base64||rec.base64.length>LIMIT_BYTES*1.4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(rec.base64))throw Error('Invalid recording base64 encoding');
  let bytes;try{bytes=base64ToBytes(rec.base64);}catch{throw Error('Corrupted recording base64 encoding');}
  if(bytes.length<1)throw Error('Empty recording data');
  total+=bytes.length;if(total>LIMIT_BYTES)throw Error('Audio backup exceeds 24 MB');
  ids.add(rec.id);
  recordings.push({id:rec.id,name:rec.name,createdAt:rec.createdAt,type:rec.type,blob:new Blob([bytes],{type:rec.type})});
 }
 return recordings;
}
export function shouldReplaceRecordings(bundle){return Object.prototype.hasOwnProperty.call(bundle,'recordings');}
export function previewPortableBackup(bundle){
 const state=restoreBackup(bundle);
 const replacesRecordings=shouldReplaceRecordings(bundle);
 const recordings=replacesRecordings?parseRecordingManifest(bundle.recordings):null;
 return {attempts:state.attempts.length,sessions:state.practiceSessions.length,repertoire:state.repertoire.length,routines:state.routines.length,recordings:recordings?.length??null,replacesRecordings,exportedAt:typeof bundle.exportedAt==='string'&&Number.isFinite(Date.parse(bundle.exportedAt))?bundle.exportedAt:null};
}
export async function restorePortableBackup(bundle){
 writer.assert();
 const state=restoreBackup(bundle);
 const replaceRecordings=shouldReplaceRecordings(bundle);
 const recordings=replaceRecordings?parseRecordingManifest(bundle.recordings):null;
 const db=await openStudioDatabase();writer.assert();
 const tx=db.transaction(replaceRecordings?[STATE_STORE,RECORDINGS_STORE]:[STATE_STORE],'readwrite');
 const done=transactionDone(tx);
 tx.objectStore(STATE_STORE).put(state,'current');
 tx.objectStore(STATE_STORE).delete('routine-draft');
 if(replaceRecordings){const store=tx.objectStore(RECORDINGS_STORE);store.clear();for(const rec of recordings)store.put(rec);}
 await done;return state;
}

/** A real read/write roundtrip, with an ephemeral key, never touches the learner record. */
export async function checkLocalStorage({openDatabase=openStudioDatabase,storage=globalThis.navigator?.storage}={}){
 if(openDatabase===openStudioDatabase)writer.assert();
 const db=await openDatabase();
 if(openDatabase===openStudioDatabase)writer.assert();
 const key='storage-check-'+crypto.randomUUID();
 const value={check:key};
 const tx=db.transaction(STATE_STORE,'readwrite'),done=transactionDone(tx);
 const store=tx.objectStore(STATE_STORE);
 store.put(value,key);
 const read=requestResult(store.get(key));
 store.delete(key);
 const found=await read;
 await done;
 if(found?.check!==key)throw Error('Local storage verification failed');
 let persisted=null,usageBytes=null,quotaBytes=null;
 try{if(typeof storage?.persisted==='function')persisted=Boolean(await storage.persisted());}catch{}
 try{if(typeof storage?.estimate==='function'){const estimate=await storage.estimate();usageBytes=Number.isFinite(estimate?.usage)?estimate.usage:null;quotaBytes=Number.isFinite(estimate?.quota)?estimate.quota:null;}}catch{}
 return {readWrite:true,persisted,usageBytes,quotaBytes};
}

/** Explicitly request stronger browser storage retention following a user's click. */
export async function requestLocalPersistence(storage=globalThis.navigator?.storage){
 if(typeof storage?.persist!=='function')return null;
 try{return Boolean(await storage.persist());}catch{return false;}
}

