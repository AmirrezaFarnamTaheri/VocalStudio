// Built-in music learning content, technique lessons, and practice resources.
export const CATALOG = {
  "skills": [
    {
      "slug": "pitch-unison-match",
      "title": "Reference Unison Matching",
      "track": "pitch",
      "stage": 1,
      "description": "Hear a reference note and sing it back in an easy range.",
      "prerequisites": []
    },
    {
      "slug": "pitch-sustained-stability",
      "title": "Sustained Tone Drift Control",
      "track": "pitch",
      "stage": 2,
      "description": "Hold a comfortable mid-range vowel for 6 beats without downward pitch drift at phrase end.",
      "prerequisites": [
        "pitch-unison-match"
      ]
    },
    {
      "slug": "pitch-stepwise-transitions",
      "title": "Clean Stepwise Pitch Transitions",
      "track": "pitch",
      "stage": 2,
      "description": "Move cleanly between whole and half steps without scooping or overshooting target centers.",
      "prerequisites": [
        "pitch-sustained-stability"
      ]
    },
    {
      "slug": "solfege-do-re-mi",
      "title": "Tonic Trichord (Do–Re–Mi)",
      "track": "solfege",
      "stage": 1,
      "description": "Sing and audiize stepwise Do–Re–Mi–Re–Do patterns in movable keys starting from a tonic drone.",
      "prerequisites": [
        "pitch-unison-match"
      ]
    },
    {
      "slug": "solfege-major-pentachord",
      "title": "Major Pentachord & Tonic Arpeggio",
      "track": "solfege",
      "stage": 2,
      "description": "Navigate Do–Re–Mi–Fa–Sol–Mi–Do with accurate Fa–Mi tendency resolution.",
      "prerequisites": [
        "solfege-do-re-mi"
      ]
    },
    {
      "slug": "solfege-minor-la-based",
      "title": "Natural Minor & Modal Inflection",
      "track": "solfege",
      "stage": 3,
      "description": "Contrast parallel major (Do–Mi–Sol) and minor (Do–Me–Sol) pentachords by ear and voice.",
      "prerequisites": [
        "solfege-major-pentachord"
      ]
    },
    {
      "slug": "ear-perfect-intervals",
      "title": "Unison, Octave, Perfect 4th & 5th",
      "track": "ear-training",
      "stage": 2,
      "description": "Distinguish and echo harmonic and melodic P1, P4, P5, and P8 intervals without visual prompts.",
      "prerequisites": [
        "pitch-unison-match"
      ]
    },
    {
      "slug": "ear-thirds-sixths",
      "title": "Major vs. Minor Thirds & Sixths",
      "track": "ear-training",
      "stage": 3,
      "description": "Identify M3, m3, M6, and m6 intervals and sing the lower or upper member on cue.",
      "prerequisites": [
        "ear-perfect-intervals"
      ]
    },
    {
      "slug": "rhythm-steady-pulse",
      "title": "Pulse Internalization & Quarter Subdivision",
      "track": "rhythm",
      "stage": 1,
      "description": "Tap along with a steady pulse and study your timing results.",
      "prerequisites": []
    },
    {
      "slug": "rhythm-dotted-syncopation",
      "title": "Dotted Quarters & Anticipation Ties",
      "track": "rhythm",
      "stage": 2,
      "description": "Tap and vocalize dotted-quarter + eighth patterns while keeping internal beat 2 silent.",
      "prerequisites": [
        "rhythm-steady-pulse"
      ]
    },
    {
      "slug": "notation-treble-bass-landmarks",
      "title": "Staff Landmarks & Step/Skip Literacy",
      "track": "notation",
      "stage": 1,
      "description": "Read line and space motion on the five-line staff and map directly to movable-Do degrees.",
      "prerequisites": [
        "solfege-do-re-mi"
      ]
    },
    {
      "slug": "notation-sight-sing-phrases",
      "title": "Four-Bar Diatonic Sight-Singing",
      "track": "notation",
      "stage": 3,
      "description": "Read and sing a notated phrase, checking approximate note pitches.",
      "prerequisites": [
        "notation-treble-bass-landmarks",
        "solfege-major-pentachord"
      ]
    },
    {
      "slug": "vocal-gentle-onset-breath",
      "title": "Coordinated Breath & Gentle Onset",
      "track": "vocal-fundamentals",
      "stage": 0,
      "description": "Observe breath and comfortable onset in gentle vocal exercises.",
      "prerequisites": []
    },
    {
      "slug": "vocal-vowel-resonance-matching",
      "title": "Pure Vowel Alignment Across Five Steps",
      "track": "vocal-fundamentals",
      "stage": 1,
      "description": "Transition smoothly across [i]–[e]–[a]–[o]–[u] on a comfortable single pitch and 5-note descending scale.",
      "prerequisites": [
        "vocal-gentle-onset-breath"
      ]
    }
  ],
  "lessons": [
    {
      "slug": "lesson-warm-gentle-humming",
      "track": "vocal-fundamentals",
      "stage": 0,
      "title": "Gentle breath and humming",
      "subtitle": "Vocal Fundamentals • Stage 0 Orientation",
      "durationMinutes": 2,
      "skillSlug": "vocal-gentle-onset-breath",
      "objective": "Check vocal comfort and explore an easy hum or lip trill in a comfortable range.",
      "explanation": "Stand or sit comfortably, release unnecessary jaw tension, and take an unforced breath. Try a quiet hum or lip trill over a short pattern only if it feels easy. This is a reflection lesson: your microphone does not assess breathing technique or physical effort.",
      "vocalSafetyNote": "Never push volume to trigger the pitch meter. Stop and rest immediately if your throat feels dry, tight, or fatigued.",
      "demonstrationNotes": [
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 2,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "Mmm"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 2,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "Mmm"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 2,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "Ah"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 2,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "Ah"
        },
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 4,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "Ah"
        }
      ],
      "interactionType": "guided-reflection",
      "toleranceCents": 25,
      "targetBpm": 72,
      "keySignature": "C Major",
      "hints": [
        "Use a small, easy range instead of pushing higher.",
        "Stop if you notice pain or unusual fatigue."
      ]
    },
    {
      "slug": "lesson-pitch-unison-anchor",
      "track": "pitch",
      "stage": 1,
      "title": "Match a reference note",
      "subtitle": "Pitch & Intonation • Stage 1 Foundation",
      "durationMinutes": 3,
      "skillSlug": "pitch-unison-match",
      "objective": "Listen to one note, imagine it silently, then sing it back comfortably.",
      "explanation": "Play the reference note, pause briefly, and imagine its pitch before singing. Use the live meter to see whether the measured pitch sits above or below the target. Background noise and octave confusion can reduce detection reliability.",
      "vocalSafetyNote": "Octave-equivalent scoring is active: sing in the octave that sits effortlessly in your chest or mix voice.",
      "demonstrationNotes": [
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 4,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "Noo"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 4,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "Noo"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 4,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "Noo"
        }
      ],
      "interactionType": "pitch-match",
      "toleranceCents": 18,
      "targetBpm": 72,
      "keySignature": "C Major",
      "hints": [
        "Try a quiet room and headphones.",
        "Choose a target in your comfortable range; there is no need to sing loudly."
      ]
    },
    {
      "slug": "lesson-solfege-major-pentachord",
      "track": "solfege",
      "stage": 2,
      "title": "The five-note major scale",
      "subtitle": "Solfège • Stage 2 Developing",
      "durationMinutes": 4,
      "skillSlug": "solfege-major-pentachord",
      "objective": "Sing Do–Re–Mi–Fa–Sol and back, listening to the semitone between Mi and Fa.",
      "explanation": "The first five notes of a major scale make a pentachord. Do–Re and Re–Mi are whole steps, while Mi–Fa is a half step. Listen to the reference, then sing the whole pattern at a relaxed tempo. The phrase checker measures approximate note centers.",
      "vocalSafetyNote": "Transpose the exercise in Studio if Sol (G4/G3) sits near a register transition.",
      "demonstrationNotes": [
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 1.5,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "Do"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 1.5,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "Re"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 1.5,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "Mi"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 1.5,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "Fa"
        },
        {
          "note": "G4",
          "midi": 67,
          "durationBeats": 2,
          "solfege": "Sol",
          "fixedSolfege": "Sol",
          "lyric": "Sol"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 2,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "Mi"
        },
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 3,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "Do"
        }
      ],
      "interactionType": "solfege-sing",
      "toleranceCents": 18,
      "targetBpm": 80,
      "keySignature": "C Major",
      "hints": [
        "Practise the descending pattern as slowly as the ascending one.",
        "Repeat only while your voice feels comfortable."
      ]
    },
    {
      "slug": "lesson-ear-thirds-and-fifths",
      "track": "ear-training",
      "stage": 3,
      "title": "Recognize thirds and fifths",
      "subtitle": "Ear Training • Stage 3 Independent",
      "durationMinutes": 3,
      "skillSlug": "ear-thirds-sixths",
      "objective": "Distinguish familiar melodic intervals by listening to two successive notes.",
      "explanation": "Compare the distance between the two tones. A minor third spans three semitones, a major third four, and a perfect fifth seven. Listen again before answering if needed. The quiz measures interval recognition, not singing ability.",
      "vocalSafetyNote": "Ear training works 100% offline with or without microphone input—ideal for quiet study or vocal rest days.",
      "demonstrationNotes": [
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 2,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "Root"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 2,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "Maj 3rd"
        },
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 2,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "Root"
        },
        {
          "note": "G4",
          "midi": 67,
          "durationBeats": 3,
          "solfege": "Sol",
          "fixedSolfege": "Sol",
          "lyric": "Perf 5th"
        }
      ],
      "interactionType": "interval-ear",
      "toleranceCents": 20,
      "targetBpm": 76,
      "keySignature": "C Major",
      "hints": [
        "Try humming the first note quietly in your mind.",
        "Count the distance in semitones if the sound alone is unfamiliar."
      ]
    },
    {
      "slug": "lesson-rhythm-dotted-pulse",
      "track": "rhythm",
      "stage": 2,
      "title": "Dotted rhythm and steady pulse",
      "subtitle": "Rhythm & Meter • Stage 2 Developing",
      "durationMinutes": 3,
      "skillSlug": "rhythm-dotted-syncopation",
      "objective": "Understand a dotted-quarter rhythm and keep a steady underlying beat.",
      "explanation": "A dotted quarter lasts one and a half quarter-note beats. Hear how a short note can follow on the offbeat, then practise keeping a steady pulse with the metronome. The tap exercise measures the timing pattern you select, not your spoken or sung articulation.",
      "vocalSafetyNote": "Can be completed via keyboard spacebar, screen tap pad, or short sung 'Tah' syllables.",
      "demonstrationNotes": [
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 1.5,
          "solfege": "Do",
          "fixedSolfege": "Fa",
          "lyric": "Tah—"
        },
        {
          "note": "G4",
          "midi": 67,
          "durationBeats": 0.5,
          "solfege": "Re",
          "fixedSolfege": "Sol",
          "lyric": "ti"
        },
        {
          "note": "A4",
          "midi": 69,
          "durationBeats": 1,
          "solfege": "Mi",
          "fixedSolfege": "La",
          "lyric": "Tah"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 1,
          "solfege": "Do",
          "fixedSolfege": "Fa",
          "lyric": "Tah"
        }
      ],
      "interactionType": "rhythm-tap",
      "toleranceCents": 20,
      "targetBpm": 84,
      "keySignature": "F Major",
      "hints": [
        "Count 1-and-2-and to hear eighth-note subdivisions.",
        "If Bluetooth output introduces lag, adjust the timing offset in Settings."
      ]
    },
    {
      "slug": "lesson-notation-four-bar-sight",
      "track": "notation",
      "stage": 3,
      "title": "Read and sing a short score",
      "subtitle": "Notation & Sight-Singing • Stage 3 Independent",
      "durationMinutes": 4,
      "skillSlug": "notation-sight-sing-phrases",
      "objective": "Locate the tonic, follow the written contour, and sing the short demonstrated phrase.",
      "explanation": "Start by finding the tonic and tracing where the notation rises, falls or repeats. Listen to the reference phrase, then sing at a comfortable tempo. The pitch checker estimates note centers, not complete rhythmic reading or musical expression.",
      "vocalSafetyNote": "Breathe calmly before Measure 1; prioritize steady rhythm and tonal direction over perfection on a single note.",
      "demonstrationNotes": [
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 1,
          "solfege": "Do",
          "fixedSolfege": "Re",
          "lyric": "Do"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 1,
          "solfege": "Re",
          "fixedSolfege": "Mi",
          "lyric": "Re"
        },
        {
          "note": "F#4",
          "midi": 66,
          "durationBeats": 1.5,
          "solfege": "Mi",
          "fixedSolfege": "Fi",
          "lyric": "Mi"
        },
        {
          "note": "G4",
          "midi": 67,
          "durationBeats": 0.5,
          "solfege": "Fa",
          "fixedSolfege": "Sol",
          "lyric": "Fa"
        },
        {
          "note": "A4",
          "midi": 69,
          "durationBeats": 2,
          "solfege": "Sol",
          "fixedSolfege": "La",
          "lyric": "Sol"
        },
        {
          "note": "F#4",
          "midi": 66,
          "durationBeats": 1,
          "solfege": "Mi",
          "fixedSolfege": "Fi",
          "lyric": "Mi"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 1,
          "solfege": "Re",
          "fixedSolfege": "Mi",
          "lyric": "Re"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 3,
          "solfege": "Do",
          "fixedSolfege": "Re",
          "lyric": "Do"
        }
      ],
      "interactionType": "sight-sing",
      "toleranceCents": 18,
      "targetBpm": 76,
      "keySignature": "D Major",
      "hints": [
        "Look for steps and skips on the staff.",
        "Use the reference recording before attempting the whole phrase."
      ]
    },
    {
      "slug": "lesson-pitch-stepwise-semitones",
      "track": "pitch",
      "stage": 2,
      "title": "Whole steps and half steps",
      "subtitle": "Pitch & Intonation • Stage 2 Developing",
      "durationMinutes": 4,
      "skillSlug": "pitch-stepwise-transitions",
      "objective": "Compare adjacent whole-step and half-step targets without forcing pitch transitions.",
      "explanation": "Listen to the distance between Mi and Fa, then compare it with the larger whole step between Re and Mi. Select each note in turn for a short measured pitch capture; single-note practice does not score the entire melodic transition.",
      "vocalSafetyNote": "Keep volume moderate (mezzo-piano to mezzo-forte); clean pitch changes come from mental clarity, not muscular pressure.",
      "demonstrationNotes": [
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 2,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "Mi"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 2,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "Fa"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 2,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "Mi"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 2,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "Re"
        },
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 3,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "Do"
        }
      ],
      "interactionType": "pitch-match",
      "toleranceCents": 15,
      "targetBpm": 74,
      "keySignature": "C Major",
      "hints": [
        "Pause between notes to hear the intended pitch.",
        "Notice the meter trend without forcing a result."
      ]
    },
    {
      "slug": "lesson-vocal-pure-vowels",
      "track": "vocal-fundamentals",
      "stage": 1,
      "title": "Explore connected vowels",
      "subtitle": "Vocal Fundamentals • Stage 1 Foundation",
      "durationMinutes": 3,
      "skillSlug": "vocal-vowel-resonance-matching",
      "objective": "Change vowels gently while noticing comfort, jaw movement and breath flow.",
      "explanation": "On a light sustained note, compare ee, eh, ah, oh and oo. Keep volume easy and observe whether transitions feel free. The exercise is a self-reflection only: a stable pitch does not establish healthy resonance or vocal technique.",
      "vocalSafetyNote": "Self-reflection exercise: observe jaw freedom in a mirror or by resting one finger lightly on the chin.",
      "demonstrationNotes": [
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 2,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "[i] Ee"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 2,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "[e] Eh"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 2,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "[a] Ah"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 2,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "[o] Oh"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 3,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "[u] Oo"
        }
      ],
      "interactionType": "guided-reflection",
      "toleranceCents": 20,
      "targetBpm": 70,
      "keySignature": "F Major",
      "hints": [
        "Move slowly and keep the jaw relaxed.",
        "Skip any vowel or note that causes discomfort."
      ]
    }
  ],
  "repertoire": [
    {
      "title": "Caro mio ben (Opening Phrase)",
      "composerOrTradition": "Tommaso Giordani • 18th-Century Aria Antica",
      "originalKey": "D Major",
      "currentTransposeSemitones": 0,
      "targetBpm": 68,
      "phraseStartMeasure": 1,
      "phraseEndMeasure": 4,
      "melodyNotes": [
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 1.5,
          "solfege": "Do",
          "fixedSolfege": "Re",
          "lyric": "Ca-"
        },
        {
          "note": "C#4",
          "midi": 61,
          "durationBeats": 0.5,
          "solfege": "Ti",
          "fixedSolfege": "Di",
          "lyric": "ro"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 1,
          "solfege": "Do",
          "fixedSolfege": "Re",
          "lyric": "mio"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 2,
          "solfege": "Re",
          "fixedSolfege": "Mi",
          "lyric": "ben,"
        },
        {
          "note": "F#4",
          "midi": 66,
          "durationBeats": 1.5,
          "solfege": "Mi",
          "fixedSolfege": "Fi",
          "lyric": "cre-"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 0.5,
          "solfege": "Re",
          "fixedSolfege": "Mi",
          "lyric": "di-"
        },
        {
          "note": "F#4",
          "midi": 66,
          "durationBeats": 1,
          "solfege": "Mi",
          "fixedSolfege": "Fi",
          "lyric": "mi"
        },
        {
          "note": "G4",
          "midi": 67,
          "durationBeats": 1,
          "solfege": "Fa",
          "fixedSolfege": "Sol",
          "lyric": "al-"
        },
        {
          "note": "F#4",
          "midi": 66,
          "durationBeats": 1.5,
          "solfege": "Mi",
          "fixedSolfege": "Fi",
          "lyric": "me-"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 1.5,
          "solfege": "Re",
          "fixedSolfege": "Mi",
          "lyric": "no"
        }
      ],
      "annotations": "Breathe silently before m.1; keep the lower neighbor C#4 (Ti) high and close to D4 (Do). Sustain vowel purity on 'ben' before consonants.",
      "preparationStatus": "Phrase Looping & Intonation Polish"
    },
    {
      "title": "Shenandoah (Legato Arch Study)",
      "composerOrTradition": "American Traditional Folksong",
      "originalKey": "C Major",
      "currentTransposeSemitones": 0,
      "targetBpm": 72,
      "phraseStartMeasure": 1,
      "phraseEndMeasure": 4,
      "melodyNotes": [
        {
          "note": "G3",
          "midi": 55,
          "durationBeats": 1,
          "solfege": "Sol,",
          "fixedSolfege": "Sol",
          "lyric": "Oh"
        },
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 1.5,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "She-"
        },
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 0.5,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "nan-"
        },
        {
          "note": "C4",
          "midi": 60,
          "durationBeats": 1,
          "solfege": "Do",
          "fixedSolfege": "Do",
          "lyric": "doah,"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 1,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "I"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 1.5,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "long"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 0.5,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "to"
        },
        {
          "note": "A4",
          "midi": 69,
          "durationBeats": 2,
          "solfege": "La",
          "fixedSolfege": "La",
          "lyric": "hear"
        },
        {
          "note": "G4",
          "midi": 67,
          "durationBeats": 3,
          "solfege": "Sol",
          "fixedSolfege": "Sol",
          "lyric": "you"
        }
      ],
      "annotations": "Watch the ascending P4 pickup (Sol, → Do) and the expressive minor third leap from Fa (F4) up to La (A4). Use -2 semitones transposition on low-energy mornings.",
      "preparationStatus": "Expressive Legato & Breath Plan"
    },
    {
      "title": "Scarborough Fair (Dorian Modal Line)",
      "composerOrTradition": "English Ballad • Dorian Mode",
      "originalKey": "D Dorian",
      "currentTransposeSemitones": 0,
      "targetBpm": 78,
      "phraseStartMeasure": 1,
      "phraseEndMeasure": 4,
      "melodyNotes": [
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 2,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "Are"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 1,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "you"
        },
        {
          "note": "A4",
          "midi": 69,
          "durationBeats": 2,
          "solfege": "La",
          "fixedSolfege": "La",
          "lyric": "go-"
        },
        {
          "note": "A4",
          "midi": 69,
          "durationBeats": 1,
          "solfege": "La",
          "fixedSolfege": "La",
          "lyric": "ing"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 1.5,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "to"
        },
        {
          "note": "F4",
          "midi": 65,
          "durationBeats": 0.5,
          "solfege": "Fa",
          "fixedSolfege": "Fa",
          "lyric": "Scar-"
        },
        {
          "note": "E4",
          "midi": 64,
          "durationBeats": 1,
          "solfege": "Mi",
          "fixedSolfege": "Mi",
          "lyric": "bo-rough"
        },
        {
          "note": "D4",
          "midi": 62,
          "durationBeats": 3,
          "solfege": "Re",
          "fixedSolfege": "Re",
          "lyric": "Fair"
        }
      ],
      "annotations": "Pure Perfect 5th leap (D4 → A4) at the start; keep the top A4 floating without neck tension.",
      "preparationStatus": "Modal Intonation Ready"
    }
  ],
  "routines": [
    {
      "title": "12-Minute Daily Conservatory Core",
      "category": "Balanced Daily Plan",
      "durationMinutes": 12,
      "description": "2m gentle breath & humming → 3m movable-Do pentachord review → 4m stepwise intonation drill → 2m Caro mio ben phrase loop → 1m reflection.",
      "targetKey": "C Major",
      "targetBpm": 76,
      "stepsJson": [
        "2 min: Lip-trill & gentle humming within comfortable middle octave",
        "3 min: Due review — Major Pentachord Fa→Mi accuracy against C drone",
        "4 min: Stepwise Semitone Precision (±15¢ target band)",
        "2 min: Repertoire loop — Caro mio ben mm. 1–4",
        "1 min: Log vocal comfort & schedule spaced recall"
      ],
      "isFavorite": true
    },
    {
      "title": "Tonic Drone & Just/Equal Intonation Lock",
      "category": "Pitch & Ear Studio",
      "durationMinutes": 8,
      "description": "Sustain Do, Mi, Sol, and Fa over a continuous Studio C3+G3 fifth drone to calibrate micro-intonation.",
      "targetKey": "D Major",
      "targetBpm": 66,
      "stepsJson": [
        "Enable Studio Drone on D3 + A3",
        "Sustain Do (D4) for 4 beats — verify ±10¢ stability",
        "Sustain Mi (F#4) and Sol (A4) listening for acoustic beatlessness"
      ],
      "isFavorite": true
    },
    {
      "title": "Silent Voice Day: Ear, Rhythm & Score Reading",
      "category": "Vocal Rest Mode",
      "durationMinutes": 10,
      "description": "Full musicianship workout requiring zero phonation—ideal for travel, late nights, or vocal recovery.",
      "targetKey": "F Major",
      "targetBpm": 84,
      "stepsJson": [
        "3 min: Harmonic & melodic interval identification (M3, m3, P4, P5)",
        "4 min: Dotted-quarter subdivision tapping with latency-calibrated metronome",
        "3 min: Mental audiation of 4-bar sight-singing phrases"
      ],
      "isFavorite": false
    }
  ],
  "glossary": [
    {
      "id": "cents-deviation",
      "term": "Cents Deviation (¢)",
      "category": "Acoustics & Pitch",
      "summary": "A logarithmic unit of pitch interval where 100 cents equals one equal-tempered semitone (`1200 × log2(f2 / f1)`). Human listeners typically perceive shifts larger than 10–15 cents on sustained tones.",
      "measurableVsSubjective": "Directly measurable by microphone fundamental frequency estimation on clean voiced frames."
    },
    {
      "id": "movable-vs-fixed-do",
      "term": "Movable-Do vs. Fixed-Do Solfège",
      "category": "Solfège & Ear",
      "summary": "In Movable-Do, 'Do' always represents the tonic of the active key, training tonal function and scale-degree hearing. In Fixed-Do, 'Do' is always C regardless of key signature, training absolute staff-to-pitch literacy.",
      "measurableVsSubjective": "Both systems share the same underlying acoustic pitch targets in Vocal Studio and can be toggled at any time."
    },
    {
      "id": "voicing-confidence",
      "term": "Voicing Confidence Gate",
      "category": "Acoustics & Pitch",
      "summary": "An autocorrelation clarity threshold that separates periodic vocal fold vibration from room tone, breath noise, consonants ('s', 't', 'k'), and silence.",
      "measurableVsSubjective": "Frames below 55% periodicity confidence are explicitly marked unscorable so breath and consonant articulation are never penalized as off-pitch."
    },
    {
      "id": "gentle-onset",
      "term": "Balanced / Gentle Vocal Onset",
      "category": "Vocal Coordination",
      "summary": "Starting a sung tone with coordinated airflow and vocal fold closure—avoiding both a harsh glottal click and excessive breathy air escape.",
      "measurableVsSubjective": "Guided observation only: a microphone pitch trace shows pitch stabilization time, but physical comfort must be self-assessed by the singer."
    },
    {
      "id": "appoggio-breath",
      "term": "Breath Pacing & Rib Expansion",
      "category": "Vocal Coordination",
      "summary": "Maintaining buoyant, unforced rib and abdominal coordination during exhalation so air pressure remains steady across a musical phrase.",
      "measurableVsSubjective": "Not scored by microphone. Evaluated through guided somatic reflection and phrase sustainability without neck or jaw tension."
    },
    {
      "id": "octave-equivalence",
      "term": "Octave Equivalence (2:1 Frequency Ratio)",
      "category": "Acoustics & Pitch",
      "summary": "Pitches separated by a factor of 2x in Hz (e.g., A3 = 220 Hz and A4 = 440 Hz) share the same pitch class. Singers naturally adapt exercises to their comfortable octave.",
      "measurableVsSubjective": "Vocal Studio supports per-exercise octave-equivalent scoring so baritones, altos, tenors, and sopranos can study the same curriculum comfortably."
    },
    {
      "id": "spaced-recall-mastery",
      "term": "Evidence-Based Mastery Stages",
      "category": "Rhythm & Notation",
      "summary": "Skills progress through Not Started → Learning → Demonstrated → Retained based on repeated evidence across separate sessions rather than single-try completion.",
      "measurableVsSubjective": "Scheduled reviews are supportive recommendations, never locked paywalls or barriers to free studio practice."
    }
  ]
};
