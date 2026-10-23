// Sunny Block on Anna: AI NIGHT.
// The Gremlin King (Anna's LLM, anna.llm.complete) reads how YOU play, then designs a
// fresh day + night for you as a level plan: houses, storm waves, leech raids, trick
// sparks, how many trick-or-treaters are gremlins in disguise. After the night he reads
// your stats and gives a debrief, and the rematch is re-tuned to your weak spots.
// No API keys, no servers: every AI call goes through the Anna host.
import { validatePlan, toLevel, runRecord, buildPlanPrompt, buildDebriefPrompt, parseJson, fallbackDebrief, normalizeDebrief } from './plan.js';

const SB = window.__sunny;
const { G, C, BTN, startLevel, toMenu, sfx } = SB;
const HIST_KEY = 'sb-anna-ai-history';
const AI_LV = 5;

// ---------- Anna runtime (optional: the game still runs offline in a normal browser) ----------
let rt = null;
const ready = (async () => {
  try {
    const mod = await import('/static/anna-apps/_sdk/latest/index.js');
    rt = await mod.AnnaAppRuntime.connect();
    window.anna = rt;
    try { rt.window.set_title({ title: 'Sunny Block: AI Night' }); } catch (_) {}
    try { const v = await rt.storage.get({ key: 'aiHistory' }); const h = v && (v.value ?? v.result?.value); if (Array.isArray(h) && h.length > history().length) saveHistory(h, false); } catch (_) {}
    return rt;
  } catch (e) {
    console.info('[sunny-block] Anna host not available (offline browser).', e && e.message);
    return null;
  }
})();

async function llm(prompt, maxTokens) {
  const r = await ready;
  if (!r) { const e = new Error('Open Sunny Block inside Anna to play AI nights.'); e.code = 'offline'; throw e; }
  let out = await r.llm.complete({ messages: [{ role: 'user', content: { type: 'text', text: prompt } }], maxTokens });
  if (out && out.ok === false) { const e = new Error(out.error?.message || 'AI error'); e.code = out.error?.code; throw e; }
  if (out && out.result && !out.content) out = out.result;
  const text = String((out && out.content && out.content.text) || '').trim();
  if (!text) { const e = new Error('The Gremlin King said nothing.'); e.code = 'empty'; throw e; }
  return text;
}
function errText(e) {
  const c = e && e.code;
  if (c === 'offline') return 'AI nights need Anna: open Sunny Block from the Anna App Store. Classic days work offline.';
  if (c === 'quota_exceeded') return 'Your Anna AI credits for today are used up. Try again later, or play a classic day.';
  if (c === 'permission_denied') return 'Anna did not allow the AI call for this app.';
  if (c === 'rate_limited') return 'Too many AI calls at once. Wait a few seconds and retry.';
  return 'The Gremlin King got tangled in his own trick (' + ((e && e.message) || 'unknown error').slice(0, 80) + '). Retry?';
}

// ---------- history (what the Gremlin King knows about you) ----------
function history() { try { const h = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); return Array.isArray(h) ? h : []; } catch { return []; } }
function saveHistory(h, remote = true) {
  h = h.slice(-8);
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (_) {}
  if (remote && rt) rt.storage.set({ key: 'aiHistory', value: h }).catch(() => {});
}
function profile() {
  const sv = G.save || {};
  return {
    classicStars: (sv.stars || []).slice(0, 5), classicUnlocked: sv.unlocked || 1, tutorialDone: !!sv.tut, upgrades: sv.ups || [],
    aiNights: history(),
  };
}

// ---------- DOM overlay ----------
const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./ai-night.css', import.meta.url).href; document.head.appendChild(css);
const wrap = document.createElement('div'); wrap.id = 'ai-modal'; wrap.hidden = true; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
wrap.innerHTML = '<div class="ai-card"><div class="ai-body"></div></div>';
document.body.appendChild(wrap);
const body = wrap.querySelector('.ai-body');
let open = false, prevMode = null;
// while the dialog is open the game must not see keys (Enter/Space/Q would act in the game)
window.addEventListener('keydown', e => {
  if (!open) return;
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); closeModal(true); }
}, true);
function show(html) { body.innerHTML = html; if (!open) { open = true; wrap.hidden = false; } const f = body.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 30); }
function closeModal(back) {
  open = false; wrap.hidden = true; body.innerHTML = '';
  if (back && prevMode === 'result') { /* stay on the result card */ }
  try { document.getElementById('game').focus(); } catch (_) {}
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const on = (sel, fn) => { const el = body.querySelector(sel); if (el) el.addEventListener('click', fn); };

// ---------- 1. ask: what kind of night? ----------
const IDEAS = ['A sneaky night: lots of gremlins in costume', 'Leech raid on my battery', 'Cosy, easy night for my little sister', 'Total storm chaos, no mercy', 'Surprise me'];
let lastWish = '';
function askScreen() {
  prevMode = G.mode;
  const h = history(), last = h[h.length - 1];
  show(`
    <div class="ai-head"><span class="ai-crown">👑</span><div><h2>AI Night</h2><p>The Gremlin King studies how you play and designs a night just for you.</p></div></div>
    ${last ? `<p class="ai-note">Last AI night: <b>${esc(last.name)}</b>, ${'★'.repeat(last.stars)}${'☆'.repeat(3 - last.stars)}, ${Math.round(last.lit * 100)}% lit. He remembers.</p>` : `<p class="ai-note">First time? He will start gentle. New to the game? Do <b>How to play</b> first (20 s).</p>`}
    <label for="ai-wish">What kind of night do you want? (optional)</label>
    <textarea id="ai-wish" maxlength="200" rows="2" placeholder="e.g. a spooky night with lots of disguised gremlins" autofocus>${esc(lastWish)}</textarea>
    <div class="ai-chips">${IDEAS.map(t => `<button type="button" class="ai-chip">${esc(t)}</button>`).join('')}</div>
    <div class="ai-actions"><button type="button" class="ai-btn ai-primary" id="ai-go">Plan my night 👑</button><button type="button" class="ai-btn" id="ai-cancel">Back</button></div>
    <p class="ai-fine">Uses Anna AI (your Anna credits or your own key). One plan + one debrief per night.</p>`);
  body.querySelectorAll('.ai-chip').forEach(b => b.addEventListener('click', () => { body.querySelector('#ai-wish').value = b.textContent; }));
  on('#ai-go', () => { lastWish = body.querySelector('#ai-wish').value.trim().slice(0, 200); planNight(lastWish); });
  on('#ai-cancel', () => closeModal(true));
}

// ---------- 2. plan ----------
let planGen = 0;
async function planNight(wish, lastRun) {
  const gen = ++planGen;
  show(`<div class="ai-loading"><div class="ai-spin">👑</div><h2>The Gremlin King is scheming…</h2><p>${lastRun ? 'Re-tuning the next night to your weak spots.' : 'Reading your past nights and planning the waves.'}</p><button type="button" class="ai-btn" id="ai-cancel">Cancel</button></div>`);
  on('#ai-cancel', () => { planGen++; closeModal(true); });
  let plan = null, err = null;
  for (let attempt = 0; attempt < 2 && !plan; attempt++) {
    try {
      const text = await llm(buildPlanPrompt(profile(), wish, lastRun, attempt > 0), 700);
      if (gen !== planGen) return;
      plan = validatePlan(parseJson(text));
    } catch (e) { err = e; if (e && ['offline', 'quota_exceeded', 'permission_denied'].includes(e.code)) break; }
  }
  if (gen !== planGen) return;
  if (!plan) return errorScreen(errText(err), () => planNight(wish, lastRun));
  planScreen(plan, wish);
}
function planScreen(plan, wish) {
  const L = toLevel(plan), diff = '🔥'.repeat(plan.difficulty) + '<span class="ai-dim">' + '🔥'.repeat(5 - plan.difficulty) + '</span>';
  const leech = plan.waves.filter(w => w[2] === 'leech').length, gremlins = plan.waves.reduce((a, w) => a + (w[2] === 'leech' ? 1 : w[1]), 0);
  show(`
    <div class="ai-head"><span class="ai-crown">👑</span><div><h2>${esc(plan.name)}</h2><p class="ai-taunt">“${esc(plan.taunt)}”</p></div></div>
    <ul class="ai-scheme">${plan.scheme.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <div class="ai-stats">
      <div><b>${diff}</b><span>difficulty</span></div>
      <div><b>${plan.houses}</b><span>houses</span></div>
      <div><b>${gremlins}</b><span>gremlins${leech ? ` (${leech} leech)` : ''}</span></div>
      <div><b>${plan.fakeEvery ? 'yes' : 'no'}</b><span>trick sparks</span></div>
      <div><b>${Math.round((1 - plan.kidShare) * 100)}%</b><span>knocks are gremlins</span></div>
      <div><b>${Math.round(L.stars[0] * 100)}/${Math.round(L.stars[1] * 100)}/${Math.round(L.stars[2] * 100)}%</b><span>lit for ★/★★/★★★</span></div>
    </div>
    <div class="ai-actions"><button type="button" class="ai-btn ai-primary" id="ai-start" autofocus>Start the night ▶</button><button type="button" class="ai-btn" id="ai-again">Plan another</button><button type="button" class="ai-btn" id="ai-cancel">Back</button></div>`);
  on('#ai-start', () => { closeModal(); startAi(L); });
  on('#ai-again', () => planNight(wish));
  on('#ai-cancel', () => closeModal(true));
}
function startAi(L) {
  const best = history().filter(r => r.name === L.name).reduce((a, r) => Math.max(a, r.score || 0), 0);
  L.prevBest = best;
  C.levels[AI_LV] = L;
  sfx.unlock && sfx.unlock();
  startLevel(AI_LV);
}
function errorScreen(msg, retry) {
  show(`<div class="ai-head"><span class="ai-crown">😵</span><div><h2>No plan this time</h2><p>${esc(msg)}</p></div></div>
    <div class="ai-actions"><button type="button" class="ai-btn ai-primary" id="ai-retry" autofocus>Retry</button><button type="button" class="ai-btn" id="ai-classic">Play a classic day</button><button type="button" class="ai-btn" id="ai-cancel">Back</button></div>`);
  on('#ai-retry', retry);
  on('#ai-classic', () => { closeModal(); if (G.mode !== 'title') toMenu(); const sv = G.save; startLevel(sv.tut ? Math.min(4, sv.unlocked - 1) : 0); });
  on('#ai-cancel', () => closeModal(true));
}

// ---------- 3. debrief after the night ----------
let debrief = null;   // { gen, promise, data }
G.onResult = S => {
  if (!S.L.ai) return;
  const rec = runRecord(S);
  const h = history(); h.push(rec); saveHistory(h);
  const gen = (debrief?.gen || 0) + 1;
  const d = { gen, rec, plan: S.L.plan, data: null, err: null };
  d.promise = llm(buildDebriefPrompt(S.L.plan, rec, h.slice(0, -1)), 450)
    .then(t => { d.data = normalizeDebrief(parseJson(t), rec); if (d.data.fallback) d.err = { code: 'bad_reply', message: 'unexpected reply' }; })
    .catch(e => { d.err = e; d.data = fallbackDebrief(rec); });
  debrief = d;
};
G.onAiNext = async S => {
  const d = debrief;
  prevMode = 'result';
  if (!d || d.rec.name !== S.L.name) return askScreen();
  if (!d.data) {
    show(`<div class="ai-loading"><div class="ai-spin">👑</div><h2>The Gremlin King is reading your night…</h2></div>`);
    await d.promise;
    if (debrief !== d) return;
  }
  const rec = d.rec, x = normalizeDebrief(d.data, rec), tips = x.tips;
  show(`
    <div class="ai-head"><span class="ai-crown">👑</span><div><h2>${esc(x.headline)}</h2><p class="ai-taunt">“${esc(x.kingLine)}”</p></div></div>
    <p class="ai-verdict">${esc(x.verdict)}</p>
    ${tips.length ? `<h3>Coach Solarchik's tips</h3><ul class="ai-scheme">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${d.err ? `<p class="ai-fine">The AI debrief did not come through${d.err.code === 'quota_exceeded' ? ' (Anna AI credits used up for today)' : ''}, so these tips come from the game itself.</p>` : ''}
    <div class="ai-actions"><button type="button" class="ai-btn ai-primary" id="ai-rematch" autofocus>Rematch: he adapts 👑</button><button type="button" class="ai-btn" id="ai-replay">Replay this night</button><button type="button" class="ai-btn" id="ai-menu">Menu</button></div>
    <p class="ai-fine">${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)} · ${Math.round(rec.lit * 100)}% lit · score ${rec.score}</p>`);
  on('#ai-rematch', () => planNight(lastWish, rec));
  on('#ai-replay', () => { closeModal(); startLevel(AI_LV); });
  on('#ai-menu', () => { closeModal(); toMenu(); });
};
G.onAiTitle = () => askScreen();
G.onMenu = () => { if (open) closeModal(); };

// ---------- title layout: classic PLAY on the left, AI NIGHT on the right ----------
BTN.play.x = C.W / 2 - 290; BTN.play.w = 280;
BTN.ai = { x: C.W / 2 + 10, y: BTN.play.y, w: 280, h: BTN.play.h };
window.__sunnyAI = { ready, history, profile, askScreen, planNight, get open() { return open; }, get debrief() { return debrief && { data: debrief.data, err: debrief.err && String(debrief.err.code || debrief.err.message), rec: debrief.rec }; } };
