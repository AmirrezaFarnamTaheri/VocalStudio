"""Real-origin acceptance tests; all learner data lives in a temporary browser context."""
from argparse import ArgumentParser
from contextlib import contextmanager
from pathlib import Path
import json
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


@contextmanager
def local_app(url):
    if url:
        yield url
        return
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    process = subprocess.Popen([sys.executable, str(ROOT / 'run.py'), '--no-browser', '--port', str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f'http://127.0.0.1:{port}/'
    try:
        for _ in range(60):
            try:
                with urllib.request.urlopen(url, timeout=.5):
                    break
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError('Local launcher exited before startup')
                time.sleep(.1)
        else:
            raise RuntimeError('Local launcher did not start')
        yield url
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def action(page, name):
    return page.locator(f'[data-action="{name}"]').first


def tab(page, name):
    page.locator(f'.nav-button[data-tab="{name}"]').click()


def ready(page):
    expect(page.locator('.nav-button')).to_have_count(7)


def saved(page):
    return page.evaluate("""async () => {
      const store = await import('./src/store.js');
      const state = await store.loadStudioState();
      return {name:state.preferences.learnerName, attempts:state.attempts.length, sessions:state.practiceSessions.length, clips:(await store.listRecordings()).length, draft:await store.loadLocalValue('routine-draft')};
    }""")


def run(url, channel, output):
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=channel)
        context = browser.new_context(viewport={'width': 1365, 'height': 900}, accept_downloads=True)
        context.add_init_script("""window.micRequests=0;
          const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
          navigator.mediaDevices.getUserMedia = (...args) => { window.micRequests++; return get(...args); };
        """)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(url)
            ready(page)
            expect(page.get_by_role('heading', name='Start with one good note.')).to_be_visible()
            action(page, 'setup-open').click()
            expect(page.get_by_role('heading', name='Make yourself comfortable')).to_be_visible()
            page.locator('#setup-form input[name=comfortableLowNote]').fill('D3')
            page.locator('#setup-form button[type=submit]').click()
            action(page, 'setup-dismiss').click()
            assert page.evaluate('window.micRequests') == 0, 'Setup requested microphone without an explicit check'
            page.screenshot(path=str(output / 'today.png'), full_page=True)

            tab(page, 'studio')
            page.locator('[data-action=studio-mode][data-mode=ear]').click()
            for i in range(4):
                action(page, 'answer-interval').click()
                if i < 3:
                    action(page, 'next-interval').click()
            action(page, 'save-studio-ear').click()
            expect(page.locator('#toast')).to_contain_text('saved')
            assert saved(page)['attempts'] == 1
            tab(page, 'settings')
            page.locator('input[name=learnerName]').fill('Independent Learner')
            page.locator('#preferences-form button[type=submit]').click()
            expect(page.locator('#toast')).to_contain_text('Preferences saved on this device.')
            assert saved(page)['name'] == 'Independent Learner', 'Settings submit did not reach persistent storage'
            page.reload()
            ready(page)
            page.wait_for_function("""async () => {
              const store=await import('./src/store.js');
              return (await store.loadStudioState()).preferences.learnerName === 'Independent Learner';
            }""",timeout=10000)
            assert saved(page)['name'] == 'Independent Learner'
            assert saved(page)['attempts'] == 1

            tab(page, 'library')
            page.locator('[data-action=library-section][data-section=routines]').click()
            action(page, 'start-routine').click()
            page.locator('.routine-step-input').first.check()
            page.locator('#routine-reflection').fill('Listened carefully and stayed comfortable.')
            action(page, 'routine-close').click()
            expect(page.locator('.routine-dock')).to_have_count(0)
            page.reload()
            ready(page)
            action(page, 'routine-resume').click()
            expect(page.locator('#routine-reflection')).to_have_value('Listened carefully and stayed comfortable.')
            expect(page.locator('.routine-step-input').first).to_be_checked()
            assert saved(page)['sessions'] == 0
            page.locator('#routine-session-form button[type=submit]').click()
            expect(page.locator('.routine-dock')).to_have_count(0)
            assert saved(page)['sessions'] == 1
            assert saved(page).get('draft') is None

            tab(page, 'settings')
            page.locator('input[name=recordingConsentOptIn]').check()
            page.locator('#preferences-form button[type=submit]').click()
            page.evaluate("""async () => {
              const s=await import('./src/store.js'),{audio}=await import('./src/audio.js');
              const db=await s.openStudioDatabase(), original=db.transaction.bind(db);let fail=true;
              db.transaction=(...args)=>{const tx=original(...args);if(fail&&args[1]==='readwrite'){fail=false;queueMicrotask(()=>tx.abort());}return tx;};
              window.originalRecordVoice=audio.recordVoice;
              audio.recordVoice=async()=>({result:Promise.resolve(new Blob(['synthetic retry fixture'],{type:'audio/webm'}))});
            }""")
            tab(page, 'library')
            page.locator('[data-action=library-section][data-section=recordings]').click()
            action(page, 'start-recording').click()
            expect(page.get_by_role('heading', name='Your voice clip is not saved yet')).to_be_visible()
            assert page.evaluate("const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);e.defaultPrevented"), 'Unsaved voice clip did not warn before leaving'
            action(page, 'recording-retry').click()
            expect(page.get_by_role('heading', name='Your voice clip is not saved yet')).to_have_count(0)
            assert saved(page)['clips'] == 1
            page.evaluate("""async () => {
              const s=await import('./src/store.js'),{audio}=await import('./src/audio.js');audio.recordVoice=window.originalRecordVoice;
              for(const clip of await s.listRecordings())await s.deleteRecording(clip.id);
              await s.saveRecording(new Blob(['synthetic fixture'],{type:'audio/webm'}),'Test clip');
            }""")
            tab(page, 'settings')
            page.locator('#include-recordings').uncheck()
            with page.expect_download() as download:
                action(page, 'download-backup').click()
            journal_path = output / 'journal.json'
            download.value.save_as(str(journal_path))
            journal = json.loads(journal_path.read_text())
            assert 'recordings' not in journal
            before = saved(page)
            page.locator('#restore-file').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"schemaVersion":"bad"}'})
            action(page, 'restore-backup').click()
            expect(page.locator('#toast')).to_have_class('toast error')
            assert saved(page) == before
            # Invalid backup input is a transient error, not a sticky failed-write alert.
            expect(action(page, 'dismiss-error')).to_have_count(0)
            rollback = page.evaluate("""async () => {
              const s=await import('./src/store.js');
              const bundle=await s.createPortableBackup(await s.loadStudioState(),{includeRecordings:true});
              bundle.preferences.learnerName='Must not survive abort';bundle.recordings=[];
              const original=IDBObjectStore.prototype.clear;
              let injected=false;
              IDBObjectStore.prototype.clear=function(...args){
                const request=original.apply(this,args);
                if(this.name==='recordings')request.addEventListener('success',()=>{
                  injected=true;
                  this.transaction.abort();
                },{once:true});
                return request;
              };
              let aborted=false;
              try {await s.restorePortableBackup(bundle);} catch {aborted=true;}
              finally {IDBObjectStore.prototype.clear=original;}
              return {aborted,injected};
            }""")
            assert rollback['injected'], 'Restore never reached the recording-clear request'
            assert rollback['aborted'], 'Interrupted restore incorrectly reported success'
            assert saved(page) == before, 'Interrupted transaction changed personal data'

            page.locator('#restore-file').set_input_files(str(journal_path))
            action(page, 'restore-backup').click()
            expect(page.locator('.restore-dialog')).to_contain_text('Your saved recordings will be kept.')
            page.screenshot(path=str(output / 'restore.png'), full_page=True)
            action(page, 'restore-cancel').click()
            assert saved(page) == before
            page.locator('input[name=learnerName]').fill('Changed after backup')
            page.locator('#preferences-form button[type=submit]').click()
            expect(page.locator('#toast')).to_contain_text('Preferences saved on this device.')
            assert saved(page)['name'] == 'Changed after backup'
            page.locator('#restore-file').set_input_files(str(journal_path))
            action(page, 'restore-backup').click()
            action(page, 'restore-apply').click()
            expect(page.locator('.restore-dialog')).to_have_count(0)
            assert saved(page)['clips'] == 1
            assert saved(page)['name'] == 'Independent Learner', 'Apply did not restore the saved journal state'

            empty_clips = {**journal, 'recordings': []}
            page.locator('#restore-file').set_input_files({'name':'empty-clips.json','mimeType':'application/json','buffer':json.dumps(empty_clips).encode()})
            action(page, 'restore-backup').click()
            expect(page.locator('.restore-dialog')).to_contain_text('replaced with 0 clips')
            action(page, 'restore-apply').click()
            expect(page.locator('.restore-dialog')).to_have_count(0)
            assert saved(page)['clips'] == 0

            other = context.new_page()
            other.on('pageerror', lambda error: errors.append(str(error)))
            other.goto(url)
            ready(other)
            expect(other.get_by_role('heading', name='This tab is read-only')).to_be_visible()
            refused = other.evaluate("""async () => {
              const s=await import('./src/store.js'),state=await s.loadStudioState();
              const writes=[()=>s.saveStudioState(state),()=>s.clearPersonalData(),()=>s.restorePortableBackup({}),()=>s.saveLocalValue('setup-dismissed',true),()=>s.deleteRecording('test'),()=>s.saveRecording(new Blob(['test'],{type:'audio/webm'}),'test'),()=>s.checkLocalStorage()];
              for(const write of writes){try {await write();return false;}catch(e){if(!e.message.includes('read-only'))return false;}}
              return true;
            }""")
            assert refused, 'Second tab bypassed the persistence guard'
            other.screenshot(path=str(output / 'read-only.png'), full_page=True)
            page.close()
            action(other, 'continue-here').click()
            expect(other.get_by_role('heading', name='This tab is read-only')).to_have_count(0)
            assert saved(other)['name'] == 'Independent Learner'
            page = other

            page.wait_for_function("""async () => {
              const registration=await navigator.serviceWorker.getRegistration();
              return Boolean(registration?.active);
            }""",timeout=10000)
            page.reload()
            ready(page)
            page.wait_for_function('navigator.serviceWorker.controller !== null')
            context.set_offline(True)
            page.reload()
            ready(page)
            assert saved(page)['attempts'] == 1
            context.set_offline(False)

            for width, height in [(390,844),(768,1024),(1365,900)]:
                page.set_viewport_size({'width':width,'height':height})
                tab(page, 'today')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Horizontal page overflow at {width}px'
                page.screenshot(path=str(output / f'today-{width}.png'), full_page=True)
            page.set_viewport_size({'width':390,'height':844})
            tab(page, 'settings')
            page.locator('#restore-file').set_input_files(str(journal_path))
            action(page, 'restore-backup').click()
            expect(page.locator('.restore-dialog')).to_be_visible()
            for _ in range(9):
                page.keyboard.press('Tab')
                assert page.evaluate("document.activeElement.closest('.restore-dialog') !== null"), (
                    'Focus escaped restore dialog: ' + str(page.evaluate("""() => ({
                      active: document.activeElement?.outerHTML?.slice(0, 400),
                      modal: Boolean(document.querySelector('.restore-dialog')),
                      readonly: Boolean(document.querySelector('.read-only'))
                    })"""))
                )
            page.keyboard.press('Shift+Tab')
            assert page.evaluate("document.activeElement.closest('.restore-dialog') !== null"), 'Reverse focus escaped restore dialog'
            page.keyboard.press('Escape')
            expect(page.locator('.restore-dialog')).to_have_count(0)
            page.evaluate("""async () => {
              const store=await import('./src/store.js');
              await store.saveRecording(new Blob(['synthetic reset fixture'],{type:'audio/webm'}),'Reset fixture');
            }""")
            assert saved(page)['clips'] == 1, 'Reset test needs a recording before deletion'
            tab(page, 'library')
            page.locator('[data-action=library-section][data-section=routines]').click()
            action(page, 'start-routine').click()
            page.locator('.routine-step-input').first.check()
            action(page, 'routine-close').click()
            expect(page.locator('.routine-dock')).to_have_count(0)
            assert saved(page)['draft'] is not None, 'Reset test needs a saved draft before deletion'
            tab(page, 'settings')
            page.once('dialog', lambda dialog: dialog.accept())
            action(page, 'reset-data').click()
            expect(page.locator('#toast')).to_contain_text('All personal data deleted.')
            cleared=saved(page)
            assert cleared['name']=='Solo Vocalist' and cleared['attempts']==0 and cleared['sessions']==0 and cleared['clips']==0 and cleared.get('draft') is None
            assert not errors, f'Uncaught browser errors: {errors}'
            print('Browser passed: setup privacy, actual IndexedDB, attempts, preferences, routine recovery, atomic completion, restore validation/cancel/preservation/replacement, competing tabs, writer transfer, offline reload, responsive layout and dialog keyboard focus.')
            print('Artifacts:', output)
        finally:
            context.close()
            browser.close()


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('--url')
    parser.add_argument('--channel', default='msedge' if sys.platform == 'win32' else 'chromium')
    parser.add_argument('--output', type=Path, default=Path(tempfile.gettempdir()) / 'vocal-studio-browser-test')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with local_app(args.url) as url:
        run(url, args.channel, args.output)
