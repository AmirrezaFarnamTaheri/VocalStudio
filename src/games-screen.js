/** Accessible HTML for the local music arcade. Interactive mechanics live in games-core.js. */
import { GAME_MODES, DIFFICULTIES, targetAt, gameStars, gameKeyboardNotes } from './games-core.js';
import { midiToNoteName } from './music.js';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const action=(label,name,extra='',kind='')=>`<button type="button" class="btn ${kind}" data-action="${name}" ${extra}>${label}</button>`;
const SCENES={
 'note-runner':'<i class="world-rail"></i><i class="world-gate">Do</i><i class="world-orb"></i>',
 'sky-steps':'<i class="world-sun"></i><i class="world-cloud"></i><i class="world-step world-step-a"></i><i class="world-step world-step-b"></i><i class="world-step world-step-c"></i><i class="world-star">✦</i>',
 'echo-cave':'<i class="world-halo"></i><i class="world-crystal world-crystal-a"></i><i class="world-crystal world-crystal-b"></i><i class="world-crystal world-crystal-c"></i>',
 'tone-garden':'<i class="world-hill"></i><i class="world-flower world-flower-a"></i><i class="world-flower world-flower-b"></i><i class="world-flower world-flower-c"></i>',
 'rhythm-river':'<i class="world-moon"></i><i class="world-water"></i><i class="world-boat"></i><i class="world-lantern"></i>'
};
const worldArt=id=>`<span class="arcade-world arcade-world--${id}" aria-hidden="true">${SCENES[id]||''}</span>`;



export function gamesLanding({selected='note-runner',difficulty='easy',source='microphone',tonic=55,comfortableLow=48,comfortableHigh=67,history=[],resting=false,starting=false}={}){
 const active=GAME_MODES[selected]??GAME_MODES['note-runner'];
 const maxTonic=Math.max(comfortableLow,comfortableHigh-12);
 const tonicOptions=[...new Set([comfortableLow,48,50,52,53,55,57,59,60,62,64,65,67,69,71,72])].filter(n=>n>=comfortableLow&&n<=maxTonic).sort((a,b)=>a-b);
 const total=history.length;
 const count=history.filter(r=>r.mode===active.id).length;
 const best=history.filter(r=>r.mode===active.id).reduce((v,r)=>Math.max(v,r.score),0);
 return `<section class="intro arcade-intro"><div><div class="kicker">YOUR MUSIC ARCADE</div><h1>Play the notes. Change the world.</h1><p>Five playful ways to train pitch, melody, musical memory and rhythm. Sing or use the practice keys; all offline.</p></div>${total?`<span class="chip">${total} voice-play rounds</span>`:''}</section>
 <div class="arcade-heading"><div><h2>Choose your world</h2><p class="muted small">Every world teaches a different skill. Start anywhere.</p></div></div>
 <section class="arcade-gallery" aria-label="Music games">${Object.values(GAME_MODES).map(g=>`<button type="button" class="arcade-card arcade-card--${g.id} ${selected===g.id?'selected':''}" data-action="game-select" data-game="${g.id}" aria-pressed="${selected===g.id}">
 <span class="arcade-card-art">${worldArt(g.id)}</span>
 <span class="arcade-card-content"><strong>${safe(g.title)}</strong><span>${safe(g.short)}</span><small>${safe(g.learningGoal)}</small></span></button>`).join('')}</section>
 <section class="arcade-setup" aria-label="Game settings"><div class="arcade-setup-copy"><div class="kicker">SELECTED ADVENTURE</div><h2 id="arcade-selected-title" tabindex="-1">${safe(active.title)}</h2><p>${safe(active.description)}</p><div class="arcade-play-guide"><span class="guide-mark">♪</span><div><strong>How to play</strong><p>${safe(active.instructions)}</p></div></div>${count?`<p class="tiny muted">${count} voice rounds saved · Personal best ${best} points</p>`:''}</div>
 <div class="arcade-setup-controls"><label class="field">Challenge level<select data-action="game-difficulty">${Object.values(DIFFICULTIES).map(d=>`<option value="${d.id}" ${difficulty===d.id?'selected':''}>${d.title}</option>`).join('')}</select></label>
 <label class="field">Play with<select data-action="game-input"><option value="microphone" ${source==='microphone'?'selected':''}>My voice (microphone)</option><option value="keys" ${source==='keys'?'selected':''}>On-screen keys / Space</option></select></label>
 ${active.kind!=='rhythm'?`<label class="field">Starting note<select data-action="game-tonic">${tonicOptions.map(n=>`<option value="${n}" ${tonic===n?'selected':''}>${midiToNoteName(n)}</option>`).join('')}</select></label>`:''}
 ${resting&&source==='microphone'?'<p class="warning">Vocal rest is selected. Choose on-screen keys or change your comfort setting when you are ready to sing.</p>':''}
 ${action(starting?'Opening microphone…':`Start ${safe(active.title)} →`,'game-start',starting||resting&&source==='microphone'?'disabled':'','primary big')}
 <p class="small muted">Voice scores stay local. Practice keys are free play, not a vocal measurement.</p>
 </div></section>`;
}
export function gameStage(session,{resultSaved=false,listening=false,focus=false}={}){
 const mode=GAME_MODES[session.mode],current=targetAt(session),finished=session.phase==='finished',paused=session.phase==='paused',started=session.phase==='playing';
 const perc=Math.round(session.index/session.targets.length*100),ready=session.phase==='ready';
 const star=gameStars(session);
 return `<section class="arcade-play"><div class="arcade-play-heading"><div>${action('← All games','game-quit','','sm ghost')}<div class="kicker">${safe(mode.learningGoal)}</div><h1 id="game-play-title" tabindex="-1">${safe(mode.title)}</h1></div><div class="arcade-play-badges"><span class="chip">${safe(DIFFICULTIES[session.difficulty].title)}</span><span class="chip ${session.source==='microphone'?'success':''}">${session.source==='microphone'?'Microphone':'Practice keys'}</span>${action(focus?'Leave focus view':'Focus view','game-focus','','sm ghost')}</div></div>
 <div class="arcade-stage" role="group" aria-label="${safe(mode.title)} interactive game"><canvas id="game-canvas" role="img" aria-label="${safe(mode.title)} game world showing your current musical challenge"></canvas>
 <div class="arcade-stage-top"><span id="game-stage-progress">${session.index} / ${session.targets.length} challenges</span><span id="game-stage-score">${session.score} points</span></div>
 <div class="arcade-stage-bottom"><span class="game-stage-prompt" id="game-stage-prompt">${finished?'Adventure complete':paused?'Paused':ready?'Listen to the cue…':listening?'Playing the reference note…':session.mode==='rhythm-river'?'Follow the beat':session.mode==='echo-cave'?'Echo the next note':session.source==='keys'?`Find ${safe(current?.label||'Do')}`:`Sing ${safe(current?.label||'Do')}`}
</span><span class="game-stage-observed" id="game-stage-observed">${session.source==='keys'?'Use the notes below':'Listening locally…'}</span></div></div>
 <div class="arcade-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${perc}" aria-label="Game progress"><span id="game-stage-progress-bar" style="width:${perc}%"></span></div>
 ${finished?`<section class="arcade-results" aria-live="polite"><div class="arcade-result-orb" aria-hidden="true">${'★'.repeat(star)}${'☆'.repeat(3-star)}</div><div><div class="kicker">ADVENTURE COMPLETE</div><h2 id="game-results-heading" tabindex="-1">${session.correct} of ${session.targets.length} challenges</h2><p>${session.score} points · ${session.misses} missed · ${session.source==='keys'?'Free-play result, not recorded as voice evidence':resultSaved?'Voice game saved locally':'Saving your voice result locally…'}</p></div>${action('Play again','game-restart','','primary')}${action('Try another game','game-quit')}</section>`:
 `<section class="arcade-game-controls"><div class="arcade-current"><span class="kicker">${session.mode==='rhythm-river'?'YOUR NEXT BEAT':'YOUR NEXT NOTE'}</span><strong id="game-current-note">${session.mode==='rhythm-river'?`Beat ${session.index+1}`:session.mode==='echo-cave'?`Note ${session.index+1} of ${session.targets.length}`:`${safe(current?.label||'Do')} · ${midiToNoteName(current?.midi??60)}`}</strong><span id="game-current-help" class="small muted">${session.source==='keys'?'Use the note keys to match the target. Free play is never measured as singing.':safe(mode.instructions)}</span><div class="arcade-hold-track"><span id="game-held" style="width:0"></span></div></div><div class="arcade-input-controls">${session.mode==='echo-cave'?'':session.mode!=='rhythm-river'?action('♪ Hear note','game-hear','','sm'):action('♪ Count in','game-count-in','','sm')}${session.mode==='echo-cave'?action('Hear melody','game-hear-pattern','','sm'):''}${paused?action('Continue','game-resume','','primary'):started?action('Pause','game-pause','','sm'):''}${action('Leave game','game-quit','','sm ghost')}</div></section>
 ${session.source==='keys'?`<div class="arcade-manual" aria-label="Practice input">${session.mode==='rhythm-river'?`<p>Press Space, Enter, or the button on the beat. Keyboard mode does not claim microphone accuracy.</p>${action('Tap the beat','game-tap',session.phase==='playing'&&!listening?'':'disabled','primary big')}`:`<p>Listen, then choose the matching note. Keyboard shortcuts: A/S/D/F/G/H/J/K, for the displayed keys in order.</p><div class="arcade-keys">${gameKeyboardNotes(session).map(n=>action(`${n.label}<small>${midiToNoteName(n.midi)} · ${n.key}</small>`,'game-key',`data-midi="${n.midi}" ${session.phase==='playing'&&!listening?'':'disabled'}`,'arcade-note-key')).join('')}</div>`}</div>`:'<p class="arcade-privacy">Voice input is analysed here, without uploading or saving raw audio. Keep a comfortable volume. Headphones help prevent the game’s notes from reaching your mic.</p>'}
 <p id="game-announcement" class="sr-only" aria-live="polite">${paused?'Game paused':'Game active'}</p>`}
 </section>`;
}
