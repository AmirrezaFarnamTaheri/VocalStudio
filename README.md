# Vocal Studio

**A personal space to learn music and practise singing.**

Vocal Studio is an offline-first, single-learner application for vocal practice, solfège, ear training, rhythm, notation and music theory. It opens in your browser but runs entirely on your computer. There is no sign-in, subscription, cloud storage or required network connection.

## Open Vocal Studio

**You'll need:** Python 3 and a recent desktop browser (Chrome, Edge or Firefox). A microphone is only needed for singing measurements and optional recordings. Headphones help prevent echo.

### Portable launcher

If you have the single-file `VocalStudio.pyz`:

- **Windows:** Open Command Prompt in its folder, then run `py -3 VocalStudio.pyz`.
- **macOS or Linux:** Open Terminal in its folder, then run `python3 VocalStudio.pyz`.

### Source folder

From the extracted project, run `start.bat` on Windows or `./start.sh` on macOS/Linux. Alternatively, run `python3 run.py` from that folder.

The app opens at **http://127.0.0.1:8765/**. If your browser doesn't open automatically, enter that address yourself. Keep the terminal window open while using the app; press **Ctrl+C** to close it.

If port 8765 is in use, run `python3 VocalStudio.pyz --port 9000` or `python3 run.py --port 9000`. Use the same browser profile and port on future visits so your saved learning history remains available.

## Your learning space

| Area | What you can do |
| --- | --- |
| **Today** | See a recommended next lesson and your personal practice focus. |
| **Academy** | Search and filter 61 lessons across pitch, solfège, ear training, rhythm, notation, vocal fundamentals, theory, performance and creativity. |
| **Practice** | Use the pitch monitor, scale player, interval trainer, rhythm lab, piano keyboard, custom drill builder and offline study guide. |
| **Games** | Five musical arcade worlds with microphone control or on-screen keyboard practice, local achievements and difficulty levels. |
| **Library** | Manage repertoire, phrase loops, personal practice routines and optional recordings. |
| **Progress** | See your learning journal, measured attempts, skill mastery and saved routine sessions. |
| **Settings** | Set a comfortable range, tuning, solfège system, learning goals, appearance and audio input; manage your backups. |

### A good first session

1. Go to **Today** and open **Start this lesson**, or choose an introductory lesson from **Academy**.
2. Read the explanation and play the demonstration. Repeat the example at a comfortable pace.
3. Complete the actual exercise. Theory, ear and rhythm tasks use your selections or taps; vocal pitch and phrase assessments require microphone input.
4. Save the attempt to keep your learning history. Personal reflections are labelled as self-reported, not measured performance.
5. For a longer session, open **Library → Routines**. Check off steps as you go and add a reflection. The session remains open while you switch between tools.

In **Academy**, search by a musical concept, choose a level, or show only lessons whose prerequisites you've demonstrated. You can still explore other lessons freely.

### Settle in

Choose **Today → Set up my studio** to hear a test tone, optionally check your microphone, and set a comfortable practice range and learning focus. You can skip setup or reopen it later. No microphone permission is requested until you choose the microphone check, and the check never saves a recording.

Routine checkboxes and notes save as a local draft. After reopening the app, choose **Resume practice** on Today. Time spent away is not counted. A draft becomes a journal entry only when you choose **Save session**. Drafts stay in this browser and are not included in backups.

For storage checks, open **Settings → Storage health**. Requesting retention can reduce browser eviction risk, but only an exported backup protects against losing the browser profile.

### Set up your audio

Open **Settings → Audio privacy**. Select a microphone input and save it if you do not want the system default. Choose **Hear test tone** to check speaker or headphone playback. Choose **Check input for 3 seconds** and gently hum a comfortable note: Vocal Studio reports whether it received a signal and detected a stable pitch. This check does **not** evaluate vocal technique or health and does not store your voice. If the result says **Input is quiet**, check operating-system microphone permissions, choose the correct input and try again. The test also works while live pitch monitoring is already running.

Headphones help prevent test tones from leaking into microphone assessments. Real pitch accuracy and timing depend on your room, device and browser. The optional latency adjustment affects phrase timing and is not a calibrated measurement.

### Music games

Open **Games** to play five offline musical adventures: **Note Runner** (sing through solfège gates), **Sky Steps** (climb a melody), **Echo Cave** (repeat a short note pattern), **Tone Garden** (hold a steady comfortable note to grow flowers), and **Rhythm River** (say a gentle “ta” or clap near the beat to guide lantern boats).

Choose a difficulty, starting note and input mode. **My voice** uses live microphone analysis and saves a separate personal game result when you finish. These achievements are not academic mastery evidence. **On-screen keys** lets you play with the buttons (or A, S, D, F, G, H, J, K) and Space/Enter for rhythm; this mode is for exploring the games and never claims to have measured your singing. A microphone permission prompt appears only when you start a voice game. Pause or leave to release the mic. Headphones are recommended. Voice games are disabled while vocal rest is selected.

### Practice tools

- **Pitch lab:** Play a reference note, enable your microphone, and capture a three-second sung note. Insufficient or uncertain voiced audio will not produce a scored measurement.
- **Solfège & scales:** Hear scales and syllables with fixed or movable Do, and change the tonic or scale type.
- **Ear trainer:** Listen to intervals and answer recognition questions.
- **Rhythm lab:** Follow a metronome and tap in time. Choose subdivisions; the spacebar also works when you're not typing.
- **Custom drills:** Create your own sequence patterns and play them back at a chosen tempo.
- **Study guide:** Ask supported questions about music concepts. Guidance is generated locally from bundled material, not a cloud AI service.
- **Repertoire:** Add a melody in note-and-beat notation, import a simple monophonic MusicXML melody, transpose, and loop sections.
- **Voice recordings:** With your explicit consent, keep short clips locally, play or download each clip, and compare estimated pitch contours.

## Your data stays yours

Learning history, settings, repertoire and optional recordings are stored in the browser's local storage for the Vocal Studio address. There is no cloud account or automatic transfer. **Settings → Download local backup** exports a JSON file; you can include recordings subject to the size limit. A backup exported without recordings restores progress without deleting existing voice clips. A backup that includes a recording manifest replaces the voice-clip library on restore. Choose **Preview selected backup** when transferring to a new browser or computer. Review the incoming item counts and recording policy, optionally download your current studio, then confirm the restore. Invalid or interrupted restores leave the previous saved data unchanged.

For audio libraries larger than the 24 MB combined-backup limit, download recordings individually from **Library → Voice recordings**, and export your learning journal without audio. Regularly save backups outside the application folder. One tab can save at a time. Other tabs are read-only; close the first tab and choose **Continue here** to switch. A current browser with Web Locks support is required to save. Clearing site data, changing browser profile, or switching localhost ports can make your old history unavailable. Backup files containing recordings are not encrypted; keep them in a private location.

**Settings → Delete all personal data** clears the application’s stored progress and recordings from the current browser profile. Backups saved elsewhere are not affected.

## Practise comfortably

Begin gently and stay within your comfortable range. Stop if singing causes pain, strain or unusual fatigue. Use the voice-rest preference when you want to study without vocal exercises. The application estimates pitch and timing; **it does not diagnose vocal health or judge breath support, registration or tone quality**. Microphone accuracy can vary by device and environment.

## Source and tests

The application runs without npm packages or external APIs. With Node.js 24 or later, `npm test` runs unit tests and `npm run check` verifies JavaScript syntax.

For the full suite, install the test-only browser tools with `python -m pip install -r tests/requirements.txt`, then run `python tests/verify.py`. Windows uses installed Microsoft Edge. On Linux, first run `python -m playwright install --with-deps chromium`, then `python tests/verify.py --channel chromium`. Tests use temporary browser data and include actual storage, offline reload, desktop/mobile layouts, keyboard games, and synthetic audio recording. Synthetic audio does not establish physical microphone accuracy.

`python build_portable.py portable/VocalStudio.pyz` rebuilds the portable application and writes its SHA-256 checksum. Builds are reproducible with the same source and Python/zlib toolchain; `SOURCE_DATE_EPOCH` optionally sets a fixed UTC archive timestamp (years 1980–2107). GitHub Actions runs verification and prepares downloadable build artifacts; it does not publish a release automatically.
