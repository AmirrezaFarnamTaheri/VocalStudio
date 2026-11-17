export function createWriterSession(locks = globalThis.navigator?.locks) {
  let writable = false;
  let pending;
  let finished;
  let unlock;

  return {
    get writable() { return writable; },
    acquire() {
      if (writable) return Promise.resolve(true);
      if (pending) return pending;
      if (!locks?.request) return Promise.resolve(false);
      pending = new Promise(resolve => {
        finished = Promise.resolve().then(() => locks.request(
          'vocal-studio-writer', {mode: 'exclusive', ifAvailable: true}, async lock => {
            if (!lock) { resolve(false); return; }
            writable = true;
            resolve(true);
            await new Promise(release => { unlock = release; });
            writable = false;
          },
        )).catch(() => { writable = false; resolve(false); });
      }).finally(() => { pending = null; });
      return pending;
    },
    async release() {
      if (pending) await pending;
      writable = false;
      unlock?.();
      unlock = null;
      await finished;
    },
    assert() {
      if (!writable) throw Error('This tab is read-only. Close the other Vocal Studio tab, then choose Continue here.');
    },
  };
}

export const writer = createWriterSession();

export function makeRoutineDraft(routine, {checked = [], reflection = '', elapsedSeconds = 0} = {}) {
  return {
    version: 1,
    routineId: routine.id,
    steps: JSON.stringify(routine.stepsJson),
    checked: [...checked].sort((a, b) => a - b),
    reflection,
    elapsedSeconds,
    updatedAt: new Date().toISOString(),
  };
}

export function readRoutineDraft(draft, routines) {
  if (!draft || draft.version !== 1) return null;
  const routine = routines.find(item => item.id === draft.routineId);
  if (!routine || draft.steps !== JSON.stringify(routine.stepsJson)) return null;
  if (!Array.isArray(draft.checked) || draft.checked.length > routine.stepsJson.length ||
      new Set(draft.checked).size !== draft.checked.length ||
      draft.checked.some(i => !Number.isInteger(i) || i < 0 || i >= routine.stepsJson.length)) return null;
  if (typeof draft.reflection !== 'string' || draft.reflection.length > 2000 ||
      !Number.isFinite(draft.elapsedSeconds) || draft.elapsedSeconds < 0 || draft.elapsedSeconds > 86400 ||
      typeof draft.updatedAt !== 'string' || !Number.isFinite(Date.parse(draft.updatedAt))) return null;
  return makeRoutineDraft(routine, draft);
}
