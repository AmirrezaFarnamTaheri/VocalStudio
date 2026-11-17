"""Optional real-browser acceptance check. Requires Playwright with a local Chromium installation.

Start `python3 run.py --no-browser --port 8765` first, then invoke this script.
This script never uses an external application service or account.
"""
from argparse import ArgumentParser
from pathlib import Path
from tempfile import gettempdir
import json
from playwright.sync_api import sync_playwright

parser = ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8765/')
parser.add_argument('--output', default=str(Path(gettempdir()) / 'vocal-studio-browser-test'))
args = parser.parse_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1365, 'height': 900}, accept_downloads=True)
    page = context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
    try:
        page.goto(args.url,wait_until='domcontentloaded')
        page.get_by_text('Start with one good note.').first.wait_for(timeout=10000)
        assert page.locator('.nav-button').count() == 7
        assert 'PRACTICE ENTRIES' in page.locator('#main-content').inner_text()
        page.screenshot(path=str(out/'today.png'),full_page=True)
        page.locator('[data-action=tab][data-tab=academy]').first.click()
        assert page.locator('.lesson-card').count() == 12
        page.locator('[data-action=lesson]').first.click()
        assert page.locator('[role=dialog]').count()==1
        page.screenshot(path=str(out/'lesson.png'),full_page=True)
        page.locator('[data-action=close-lesson]').click()
        page.locator('[data-action=tab][data-tab=studio]').first.click()
        page.locator('[data-action=studio-mode][data-mode=ear]').click()
        for i in range(4):
            page.locator('[data-action=answer-interval]').first.click()
            if i<3:page.locator('[data-action=next-interval]').click()
        page.locator('[data-action=save-studio-ear]').click()
        page.locator('[data-action=tab][data-tab=progress]').first.click()
        assert page.locator('.attempt').count() >= 1
        page.reload(wait_until='domcontentloaded')
        page.locator('h1').first.wait_for()
        page.locator('[data-action=tab][data-tab=progress]').first.click()
        assert page.locator('.attempt').count() >= 1, 'Journal did not persist after reload'
        page.locator('[data-action=tab][data-tab=settings]').first.click()
        page.locator('input[name=learnerName]').fill('Personal Studio Browser Test')
        page.locator('#preferences-form button[type=submit]').click()
        page.reload(wait_until='domcontentloaded')
        page.locator('[data-action=tab][data-tab=settings]').first.click()
        assert page.locator('input[name=learnerName]').input_value()=='Personal Studio Browser Test'
        with page.expect_download() as info:page.locator('[data-action=download-backup]').click()
        info.value.save_as(str(out/'personal-test-backup.json'))
        backup=json.loads((out/'personal-test-backup.json').read_text())
        assert len(backup['attempts'])>=1
        page.screenshot(path=str(out/'settings.png'),full_page=True)
        assert not errors,f'JavaScript errors: {errors}'
        print('Browser smoke passed: six-screen navigation, curriculum, ear attempt, reload persistence, profile and backup.')
        print('Artifacts:',out)
    finally:
        browser.close()
