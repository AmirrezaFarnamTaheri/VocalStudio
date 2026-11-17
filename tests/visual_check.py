"""Rendered desktop and mobile journeys against the real local application."""
from argparse import ArgumentParser
from pathlib import Path
import re
import sys
from tempfile import gettempdir
from playwright.sync_api import sync_playwright, expect
from browser_check import local_app

parser=ArgumentParser()
parser.add_argument('--channel',default='msedge' if sys.platform=='win32' else 'chromium')
parser.add_argument('--output',type=Path,default=Path(gettempdir())/'vocal-studio-visual-check')
args=parser.parse_args()
OUT=args.output
OUT.mkdir(parents=True,exist_ok=True)

with local_app(None) as url, sync_playwright() as p:
    browser=p.chromium.launch(channel=args.channel)
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(url)
    try:
        page.get_by_text('Start with one good note.').first.wait_for(timeout=10000)
        for tab,label in [('today','Start with one good note'),('academy','Learn music, one skill at a time'),('studio','The Practice Studio'),('games','Play the notes. Change the world.'),('library','Library & repertoire'),('progress','Your learning journey'),('settings','Personal settings')]:
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
        mobile.goto(url)
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
        print('Real-origin desktop, arcade and mobile visual checks passed. Screenshots:',OUT)
    finally:
        browser.close()
