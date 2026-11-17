"""Exercise the real recording and decoding engine with synthesized local audio.
A synthetic source verifies browser codec/recording compatibility; it does not
substitute for microphone permissions or physical-device measurements.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=[]
for name in ['music','advanced','audio']:
    js=(ROOT/'src'/f'{name}.js').read_text()
    js=re.sub(r"^import\s*\{[^}]+\}\s*from\s*['\"]\./[a-z-]+\.js['\"];\s*$",'',js,flags=re.M)
    js=re.sub(r'\bexport\s+', '',js)
    js=js.replace("new URL('./microphone-worklet.js',import.meta.url)","'./microphone-worklet.js'")
    source.append(js)
source.append('globalThis.studioAudio=audio;')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    page=browser.new_page()
    page.set_content('<html><body>Local audio verification</body></html>')
    page.add_script_tag(content='\n'.join(source))
    results=page.evaluate('''async () => {
       const audio=globalThis.studioAudio;
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
