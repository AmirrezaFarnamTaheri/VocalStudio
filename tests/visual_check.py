"""Chromium visual smoke check using in-memory modules.
Network navigation to localhost is blocked in some automated environments. This
checks the real interface/DOM without claiming real IndexedDB or microphone tests.
"""
from pathlib import Path
import re
from tempfile import gettempdir
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(gettempdir())/'vocal-studio-visual-check'
OUT.mkdir(exist_ok=True)

MODULES=['music','advanced','base-catalog','advanced-catalog','catalog','learning','store','audio','diagnostics','games-core','games-canvas','games-screen','app']

def bundle():
    output=[]
    for name in MODULES:
        if name=='store':
            output.append("""const __mod_store={loadStudioState:async()=>__mod_learning.createInitialState(),saveStudioState:async(s)=>s,createPortableBackup:async(s)=>__mod_learning.backupState(s),restorePortableBackup:async(b)=>__mod_learning.restoreBackup(b),clearPersonalData:async()=>__mod_learning.createInitialState(),saveRecording:async()=>{},listRecordings:async()=>[],getRecording:async()=>null,deleteRecording:async()=>{}};""")
            continue
        if name=='audio':
            output.append("""const __mod_audio={audio:{tone(){},melody(){},click(){},stopTones(){},stopMic(){},sample(){return {hz:0,confidence:0}},availableInputs:async()=>[]}};""")
            continue
        source=(ROOT/'src'/f'{name}.js').read_text()
        imports=[]
        def inject_import(match):
            defs=[]
            for item in match.group(1).split(','):
                part=item.strip().split(' as ')
                defs.append(f'{part[0]}: {part[-1]}' if len(part)>1 else part[0])
            imports.append(f"const {{{', '.join(defs)}}}=__mod_{match.group(2).replace('-','_')};")
            return ''
        source=re.sub(r"^import\s*\{([^}]+)\}\s*from\s*['\"]\./([a-z-]+)\.js['\"];\s*$",inject_import,source,flags=re.M)
        source=source.replace("new URL('./microphone-worklet.js',import.meta.url)","'./microphone-worklet.js'")
        exported=re.findall(r'\bexport\s+(?:const|class|(?:async\s+)?function)\s+(\w+)',source)
        source=re.sub(r'\bexport\s+(?=(?:const|class|(?:async\s+)?function)\s+)', '',source)
        if re.search(r'\bimport\s+|\bexport\s+',source):raise RuntimeError(f'Unprocessed module token in {name}')
        output.append(f"const __mod_{name.replace('-','_')}=(()=>{{\n"+'\n'.join(imports)+'\n'+source+'\n'+('return {'+','.join(exported)+'};' if exported else '')+'\n})();')
    return '\n'.join(output)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.set_content('<!doctype html><html><head><meta charset="utf-8"><style>'+ (ROOT/'styles.css').read_text()+'</style></head><body><div id="app"></div><div id="toast"></div></body></html>')
    try:
        page.add_script_tag(content=bundle())
        page.get_by_text('Start with one good note.').first.wait_for(timeout=10000)
        for tab,label in [('today','Start with one good note'),('academy','Learn music, one skill at a time'),('studio','The Practice Studio'),('games','Play the notes. Change the world.'),('library','Library & repertoire'),('progress','Progress'),('settings','Personal settings')]:
            page.locator(f'[data-action=tab][data-tab={tab}]').first.click()
            assert label.lower() in page.locator('#main-content').inner_text().lower(),tab
            page.screenshot(path=str(OUT/f'{tab}.png'),full_page=True)
            if tab=='settings':
                def contrast(selector):
                    colors=page.locator(selector).first.evaluate("el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor]}")
                    def luminance(color):
                        values=[int(x) for x in re.findall(r'\d+',color)[:3]]
                        rgb=[v/255 for v in values]
                        linear=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb]
                        return .2126*linear[0]+.7152*linear[1]+.0722*linear[2]
                    a,b=map(luminance,colors)
                    return (max(a,b)+.05)/(min(a,b)+.05)
                assert contrast('button[data-action=reset-data]')>=4.5,'Delete button text contrast insufficient'
                assert contrast('input[type=file]')>=4.5,'Backup file input contrast insufficient'

        # Arcade: all five modes are available, and actual keyboard practice is interactive.
        page.locator('[data-action=tab][data-tab=games]').first.click()
        assert page.locator('.arcade-card').count()==5
        page.screenshot(path=str(OUT/'games-lobby.png'),full_page=True)
        for mode in ['note-runner','sky-steps','echo-cave','tone-garden','rhythm-river']:
            page.locator(f'[data-action=game-select][data-game={mode}]').click()
            assert page.locator('.arcade-card.selected').count()==1
        page.locator('[data-action=game-select][data-game=note-runner]').click()
        page.locator('[data-action=game-input]').select_option('keys')
        page.locator('[data-action=game-start]').click()
        assert page.locator('#game-canvas').count()==1
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT/'games-runner.png'),full_page=True)
        assert 'Find' in page.locator('#game-stage-prompt').inner_text()
        page.locator('[data-action=game-focus]').click()
        assert 'game-focus' in (page.locator('body').get_attribute('class') or '')
        assert page.locator('.sidebar').is_hidden(), 'Focus play should hide workspace chrome'
        assert page.locator('[data-action=game-quit]').first.is_visible(), 'Focus view must preserve an exit'
        page.screenshot(path=str(OUT/'games-focus.png'),full_page=True)
        page.locator('[data-action=game-focus]').click()
        assert page.locator('.sidebar').is_visible()
        page.locator('.arcade-keys [data-action=game-key]').nth(1).click()
        assert 'Not quite' in page.locator('#game-stage-observed').inner_text(), 'Wrong notes need visible feedback'
        page.locator('.arcade-keys [data-action=game-key]').first.click()
        assert page.locator('#game-stage-progress').inner_text().startswith('1 /')
        page.locator('[data-action=game-pause]').click()
        assert 'Paused' in page.locator('#game-stage-prompt').inner_text()
        page.locator('[data-action=game-resume]').click()
        page.wait_for_timeout(350)
        assert 'Find' in page.locator('#game-stage-prompt').inner_text()
        page.locator('[data-action=game-quit]').first.click()
        page.locator('[data-action=game-select][data-game=sky-steps]').click()
        page.locator('[data-action=game-start]').click()
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT/'games-sky.png'),full_page=True)
        page.locator('[data-action=game-quit]').first.click()
        page.locator('[data-action=game-select][data-game=echo-cave]').click()
        page.locator('[data-action=game-start]').click()
        page.wait_for_timeout(900)
        page.wait_for_timeout(2200)
        assert 'Echo the next note' in page.locator('#game-stage-prompt').inner_text()
        assert 'Note 1 of' in page.locator('#game-current-note').inner_text()
        page.screenshot(path=str(OUT/'games-echo.png'),full_page=True)
        page.locator('[data-action=game-quit]').first.click()
        page.locator('[data-action=game-select][data-game=tone-garden]').click()
        page.locator('[data-action=game-start]').click()
        page.wait_for_timeout(900)
        page.screenshot(path=str(OUT/'games-garden.png'),full_page=True)
        page.locator('[data-action=game-quit]').first.click()
        page.locator('[data-action=game-select][data-game=rhythm-river]').click()
        page.locator('[data-action=game-start]').click()
        page.wait_for_timeout(550)
        page.screenshot(path=str(OUT/'games-river.png'),full_page=True)
        page.locator('[data-action=game-quit]').first.click()
        page.locator('[data-action=tab][data-tab=studio]').first.click()
        page.locator('[data-action=studio-mode][data-mode=builder]').click()
        assert page.locator('#drill-form').count()==1
        page.locator('[data-action=studio-mode][data-mode=guide]').click()
        assert page.locator('#guide-form').count()==1
        page.locator('[data-action=tab][data-tab=academy]').first.click()
        assert page.locator('.lesson-card').count()==12
        page.locator('#academy-query').fill('dictation')
        assert page.locator('.lesson-card').count()>=2
        page.locator('[data-action=lesson][data-slug=dictation-three-notes]').click()
        assert 'hidden until' in page.locator('[role=dialog]').inner_text()
        page.screenshot(path=str(OUT/'dictation.png'),full_page=True)
        page.locator('[data-action=close-lesson]').click()
        page.locator('[data-action=tab][data-tab=library]').first.click()
        page.locator('[data-action=library-section][data-section=routines]').click()
        page.locator('[data-action=start-routine][data-id="1"]').click()
        assert page.locator('.routine-dock').count()==1
        page.screenshot(path=str(OUT/'routine.png'),full_page=True)
        page.locator('.routine-step-input').first.check()
        page.locator('#routine-session-form button[type=submit]').click()
        page.locator('[data-action=tab][data-tab=progress]').first.click()
        assert 'Self-reported session' in page.locator('#main-content').inner_text()
        mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1, is_mobile=True, has_touch=True)
        mobile_errors=[]
        mobile.on('pageerror',lambda error:mobile_errors.append(str(error)))
        mobile.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>'+(ROOT/'styles.css').read_text()+'</style></head><body><div id="app"></div><div id="toast"></div></body></html>')
        mobile.add_script_tag(content=bundle())
        mobile.get_by_text('Start with one good note.').first.wait_for(timeout=10000)
        for selected in ['today','academy','studio','games','library']:
            mobile.locator(f'[data-action=tab][data-tab={selected}]').first.click()
            mobile.screenshot(path=str(OUT/f'mobile-{selected}.png'),full_page=True)
            width=mobile.evaluate('document.documentElement.scrollWidth')
            assert width<=390, f'mobile horizontal overflow in {selected}: {width}px'
        mobile.locator('[data-action=tab][data-tab=games]').first.click()
        shelf=mobile.locator('.arcade-gallery')
        metrics=shelf.evaluate('(el)=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,snap:getComputedStyle(el).scrollSnapType})')
        assert metrics['scrollWidth']>metrics['clientWidth'], 'Phone game worlds should scroll horizontally'
        assert 'mandatory' in metrics['snap'], 'World shelf should snap to the selected card'
        mobile.locator('[data-action=game-input]').select_option('keys')
        mobile.locator('[data-action=game-start]').click()
        mobile.wait_for_timeout(850)
        mobile.screenshot(path=str(OUT/'mobile-game-runner.png'),full_page=True)
        assert mobile.evaluate('document.documentElement.scrollWidth')<=390,'Mobile game horizontal overflow'
        mobile.locator('[data-action=game-quit]').first.click()
        mobile.locator('[data-action=tab][data-tab=library]').first.click()
        mobile.locator('[data-action=library-section][data-section=routines]').click()
        mobile.locator('[data-action=start-routine][data-id="1"]').click()
        assert mobile.locator('.routine-dock').count()==1
        mobile.screenshot(path=str(OUT/'mobile-routine.png'))
        assert not mobile_errors,mobile_errors
        mobile.close()
        assert not errors,errors
        print('Chromium in-memory interface visual check PASSED, screenshots:',OUT)
    finally:
        browser.close()
