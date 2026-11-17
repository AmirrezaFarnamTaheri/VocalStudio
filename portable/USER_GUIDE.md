# Vocal Studio

Your private music academy and voice-controlled music arcade. No sign-in, subscription, or internet connection required for lessons and play.

## Start

**Requirements:** Python 3 and a current desktop browser (Chrome, Edge or Firefox). A microphone is optional; headphones are recommended for singing games.

**Windows:** Double-click `Start_Vocal_Studio.bat` or run `py -3 VocalStudio.pyz` in the application folder.

**macOS / Linux:** In Terminal, open the extracted folder and run `sh Start_Vocal_Studio.sh` (or `python3 VocalStudio.pyz`).

Vocal Studio opens in your browser at `http://127.0.0.1:8765/`. Keep the terminal open while practising. Press **Ctrl+C** to stop. If the port is in use, run `python3 VocalStudio.pyz --port 9000`. Reuse the same browser profile and port to keep your progress visible.

## Learn and practise

- **Today:** Continue a recommended lesson and manage your personal practice.
- **Academy:** Browse, search, and complete 61 interactive lessons in 9 learning domains.
- **Practice:** Use pitch tools, solfège, rhythm, ear training, custom drills and an offline study guide.
- **Games:** Play five original musical worlds with voice control or practice keys.
- **Library:** Create repertoire and routines, save voice clips when you opt in, and work with imported melodies.
- **Progress:** View measured attempts, learning history and your personal practice notes.
- **Settings:** Configure your comfortable range, input, tuning, vocal rest and local backup.

## Play the music games

Choose **Games**, select a world, pick Gentle / Steady / Challenge, choose a comfortable starting note, then start.

- **Note Runner:** Sing the note shown on each gate to guide the glowing ball through.
- **Sky Steps:** Follow a rising and falling melody to climb floating islands.
- **Echo Cave:** Hear a short pattern, remember it, then echo the notes without seeing the answers.
- **Tone Garden:** Hold a gentle steady pitch to grow flowers.
- **Rhythm River:** Sing short rhythmic syllables, clap, or tap on the beat to guide lantern boats.

**My voice:** The game uses your microphone to estimate pitch or rhythm. Input is processed locally; raw audio is not sent to any service. The first round may trigger a browser microphone permission prompt. Choose **Hear note/pattern** to replay a cue without losing response time. Pause, resume, or leave whenever you like. **Focus view** hides the surrounding menus for distraction-free play.

**Practice keys:** Play without a microphone by clicking note buttons or using A, S, D, F, G, H, J, K in order as shown. Use Space or Enter for rhythm. Practice-key scores are not recorded as microphone-verified singing results.

Singing games respect the comfortable pitch range in Settings. If you select vocal rest, use non-singing learning tools instead. Keep singing relaxed; stop if it causes discomfort.

## First-run audio check

In **Settings**, use **Hear test tone** to check speakers and **Check input for 3 seconds** to test the microphone. Select your input device if needed. A detected pitch is a signal check, not a calibrated vocal assessment. Headphones help prevent the speaker’s reference notes from leaking into the mic.

## Keep your data

All progress is saved to the browser profile at the local Vocal Studio address. In **Settings**, run **Storage health** and regularly **Download local backup**. You can restore that file, including optional recordings where selected. Export large recordings individually from **Library**. Local data can be lost if you delete browser site data or switch browser profiles, so keep a backup outside the application folder.

## Comfort and privacy

Use a relaxed volume and a comfortable range. This app provides music practice and estimated pitch/timing feedback; it is not a medical tool and does not diagnose vocal health or measure technique such as breath support. Microphone accuracy and timing depend on the actual device and room. All lessons, games and personal progress work without remote accounts or cloud services.
