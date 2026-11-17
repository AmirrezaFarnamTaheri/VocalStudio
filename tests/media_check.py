"""Exercise the real recording and decoding engine with synthesized local audio.
A synthetic source verifies browser codec/recording compatibility; it does not
substitute for microphone permissions or physical-device measurements.
"""
from argparse import ArgumentParser
import sys
from playwright.sync_api import sync_playwright
from browser_check import local_app

parser=ArgumentParser()
parser.add_argument('--channel',default='msedge' if sys.platform=='win32' else 'chromium')
args=parser.parse_args()
with local_app(None) as url, sync_playwright() as p:
    browser=p.chromium.launch(channel=args.channel,args=['--autoplay-policy=no-user-gesture-required'])
    page=browser.new_page()
    page.goto(url)
    page.locator('.nav-button').first.wait_for()
    results=page.evaluate('''async () => {
       const {audio}=await import('./src/audio.js');
       const ctx=audio.context();await ctx.resume();
       const dest=ctx.createMediaStreamDestination();
       const sine=ctx.createOscillator();sine.frequency.value=220;
       const gain=ctx.createGain();gain.gain.value=.4;
       sine.connect(gain).connect(dest);sine.start();
       audio.startMic=async()=>{audio.micStream=dest.stream;return dest.stream;};
       try {
        const recording=await audio.recordVoice({maxSeconds:3});
        await new Promise(resolve=>setTimeout(resolve,650));
        const blob=await recording.stop();
        const analysis=await audio.analyseRecording(blob);
        return {mimeType:blob.type,size:blob.size,duration:analysis.durationSeconds,
                points:analysis.contour.length,firstMidi:analysis.contour[0]?.midi};
       } finally {sine.stop();gain.disconnect();dest.disconnect();await ctx.close();}
    }''')
    assert results['mimeType'].startswith('audio/'),results
    assert results['size']>1000,results
    assert .2<=results['duration']<=3,results
    assert results['points']>=1,results
    assert abs(results['firstMidi']-57)<1,results  # 220 Hz = A3
    print('Real Chromium MediaRecorder -> Blob -> decodeAudioData -> pitch contour PASSED:',results)
    browser.close()
