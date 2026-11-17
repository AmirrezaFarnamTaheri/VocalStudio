import test from 'node:test';
import assert from 'node:assert/strict';
const session = await import('../src/session.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
import {createInitialState, backupState} from '../src/learning.js';
import * as store from '../src/store.js';

function lockManager() {
  let held = false;
  return {request: async (_name, _options, callback) => {
    if (held) return callback(null);
    held = true;
    try { return await callback({name: 'studio'}); }
    finally { held = false; }
  }};
}

test('only one writer can own a browser origin and ownership transfers after release', async () => {
  assert.equal(typeof session.createWriterSession, 'function');
  const locks = lockManager();
  const first = session.createWriterSession(locks);
  const second = session.createWriterSession(locks);
  assert.equal(await first.acquire(), true);
  assert.equal(await first.acquire(), true);
  assert.equal(await second.acquire(), false);
  assert.throws(() => second.assert(), /read.only/i);
  await first.release();
  assert.equal(await second.acquire(), true);
  await second.release();
  assert.throws(() => second.assert(), /read.only/i);
});

test('missing or failed native locking never silently permits writes', async () => {
  assert.equal(typeof session.createWriterSession, 'function');
  for (const locks of [null, {request: async () => { throw Error('denied'); }}]) {
    const owner = session.createWriterSession(locks);
    assert.equal(await owner.acquire(), false);
    assert.throws(() => owner.assert(), /read.only|another tab/i);
  }
});

test('personal data mutations fail closed without writer ownership', async () => {
  for (const action of [
    () => store.saveStudioState(createInitialState()),
    () => store.saveRecording(new Blob(['voice'], {type:'audio/webm'}), 'clip'),
    () => store.deleteRecording('clip'),
    () => store.clearPersonalData(),
    () => store.restorePortableBackup({}),
  ]) await assert.rejects(action(), /read.only|another tab/i);
});

test('routine drafts preserve actual steps and reject changed routines and malformed data', () => {
  assert.equal(typeof session.makeRoutineDraft, 'function');
  const state = createInitialState(), routine = state.routines[0];
  const draft = session.makeRoutineDraft(routine, {checked:[0], reflection:'A comfortable start', elapsedSeconds:8});
  assert.deepEqual(session.readRoutineDraft(draft, state.routines).checked, [0]);
  assert.equal(session.readRoutineDraft(draft, [{...routine, stepsJson:['Changed steps']}]), null);
  for (const patch of [{checked:[-1]}, {checked:[999]}, {checked:[0,0]}, {reflection:'x'.repeat(2001)}, {elapsedSeconds:NaN}, {version:9}]) {
    assert.equal(session.readRoutineDraft({...draft,...patch}, state.routines), null);
  }
  assert.equal(state.practiceSessions.length, 0);
});

test('restore preview validates every collection and explicitly describes recording replacement', () => {
  assert.equal(typeof store.previewPortableBackup, 'function');
  const bundle = backupState(createInitialState());
  const journal = store.previewPortableBackup(bundle);
  assert.equal(journal.replacesRecordings, false);
  assert.equal(journal.recordings, null);
  assert.equal(journal.attempts, 0);
  assert.equal(store.previewPortableBackup({...bundle, recordings:[]}).replacesRecordings, true);
  assert.equal(store.previewPortableBackup({...bundle, recordings:[]}).recordings, 0);
  assert.throws(() => store.previewPortableBackup({...bundle, recordings:[{id:'bad'}]}), /invalid/i);
  assert.throws(() => store.previewPortableBackup({schemaVersion:'vocal-studio-personal-v1'}), /backup|invalid/i);
});
