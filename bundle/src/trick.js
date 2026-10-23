// TRICK: the jam theme (All Tools Allowed #3).
// Storm gremlins play tricks on the street (fake 'trick sparks' by day, disguised trick-or-treaters at night).
// Solarchik tricks them back: a Mirror Decoy (Q / Shift / TRICK button) that every gremlin falls for, and a mirror flash
// that unmasks a disguised gremlin at the door. Stomping a dizzy gremlin is a TRICK STOMP; stomp chains in mid-air are AIR TRICKS.
import { C, G, ctx, fx, sfx, sprite, has, rnd, font, roundRect, clamp, touchOn } from './core.js';
import { GROUND } from './world.js';
import { hitCombo, breakCombo, solSay } from './actors.js';
import { lightsOut } from './night.js';

export const trickMax = () => C.trick.maxCharges + (has('pocket') ? 1 : 0);
export function initTrick(S) {
  S.trick = { ch: Math.min(trickMax(), C.trick.startCharges + (has('pocket') ? 1 : 0)), fill: 0, pulse: 0, flash: 0 };
  S.decoys = []; S.visitors = []; S.knockT = 2.2;
  Object.assign(S.stats, { tricks: 0, tricked: 0, trickStomps: 0, airTricks: 0, fakesHit: 0, revealed: 0, treats: 0, unmasked: 0, fooled: 0, scared: 0, pranks: 0, missed: 0, visitors: 0 });
}
export function hitStop(t) { G.hitstop = Math.max(G.hitstop || 0, t); }
export function chargeTrick(S, amt) {
  const T = S.trick; if (T.ch >= trickMax()) { T.fill = 0; return; }
  T.fill += amt;
  if (T.fill >= 1) { T.fill -= 1; T.ch++; T.pulse = 1; sfx.trickReady(); fx.text(98, 104, 'TRICK READY!', '#d9a7ff', 15, 1); if (T.ch >= trickMax()) T.fill = 0; }
}
export const liveDecoy = S => S.decoys.find(d => d.life > 0 && !d.popped);

// ---------- the verb ----------
export function castTrick(S) {
  if (S.phase === 'night' || S.tutNight) return nightTrick(S);
  if (S.phase !== 'day') return;
  const h = S.hero, T = S.trick;
  if (S.tut) {   // training: never 'no tricks left'; one decoy at a time; no new decoy while a gremlin is already dizzy
    if (S.drones.some(g => g.state === 'dizzy')) { solSay(S, "It's dizzy! Jump on it!", 1.3); sfx.tick(); return; }
    S.decoys = S.decoys.filter(d => d.popped); T.ch = Math.max(T.ch, 1);
  }
  if (T.ch < 1) { sfx.deny(); solSay(S, 'No tricks left: catch sun sparks!', 1.3); return; }
  T.ch--; T.flash = 1; S.stats.tricks++;
  const under = S.houses.filter(q => h.x > q.x && h.x < q.x + q.w && q.roofY >= h.y - 4).sort((a, b) => a.roofY - b.roofY)[0];
  const y = h.plat ? h.plat.roofY : h.onGround ? GROUND : under ? under.roofY : GROUND;   // the decoy drops onto the roof or street below
  const d = { x: h.x, y, life: C.trick.decoyLife * (has('mirror') ? 1.4 : 1), t: 0, bite: 0, popped: false, out: 0 };
  S.decoys.push(d);
  let lured = 0;
  for (const g of S.drones) if (lure(g, d)) lured++;
  // the mirror flash turns nearby trick sparks into real sun
  for (const s of S.sparks) if (s.fake && Math.hypot(s.x - h.x, s.y - (h.y - 30)) < C.trick.revealR) { s.fake = false; s.life = Math.max(s.life, 3); S.stats.revealed++; fx.text(s.x, s.y - 18, 'Real now!', '#ffe08a', 13, 0.9); fx.burst(s.x, s.y, '#d9a7ff', 10, 120, 0.5, 2.5, 0); }
  fx.burst(h.x, y - 26, '#d9a7ff', 26, 230, 0.7, 3, 0); fx.burst(h.x, y - 26, '#fff6c2', 14, 160, 0.5, 2, 0);
  if (!S.tut) fx.text(h.x, y - 92, lured ? `MIRROR DECOY! ${lured} lured` : 'MIRROR DECOY!', '#d9a7ff', 18, 1);   // the tutorial labels it with a pointer instead
  fx.shake(3); sfx.trick();
  solSay(S, lured ? 'Ooh, shiny! Come and get it...' : 'Ready for them...', 1.2); h.sq = -0.18;
  if (S.tut) T.ch = Math.max(T.ch, 1);
}
function lure(g, d) {
  if (g.state === 'dead' || g.state === 'flee' || g.state === 'dizzy') return false;
  g.state = 'lured'; g.decoy = d; g.target = null; g.lureT = 0; return true;
}
// called from updateDrones for every gremlin; returns true when this module moved it
export function updateTrickDrone(S, g, dt) {
  if (g.state === 'seek' || g.state === 'charge' || g.state === 'drain') { const d = liveDecoy(S); if (d) lure(g, d); }
  if (g.state === 'lured') {
    const d = g.decoy;
    if (!d || d.popped || d.life <= 0) { g.state = 'seek'; g.decoy = null; g.rest = 0.4; return true; }
    g.lureT += dt;
    const tx = d.x, ty = d.y - 64, dx = tx - g.x, dy = ty - g.y, dist = Math.hypot(dx, dy);
    if (dist > 8) { const m = Math.min(dist, g.speed * C.trick.lureSpeed * dt * (dist > 220 ? 1.5 : 1) * (S.tut ? 1.5 : 1)); g.x += dx / dist * m; g.y += dy / dist * m; }
    else { d.bite += dt; g.x = tx + Math.sin(G.t * 40) * 2; if (d.bite >= C.trick.decoyBite) popDecoy(S, d); }
    return true;
  }
  if (g.state === 'dizzy') {
    g.t -= dt; g.spin += dt * 9;
    g.y += (g.dizzyY - g.y) * Math.min(1, dt * 5); g.x += Math.sin(g.spin * 0.7) * 12 * dt;
    if (g.t <= 0) { g.state = 'seek'; g.rest = 0.8; fx.text(g.x, g.y - 46, 'Grr!', '#c8c9ff', 14, 0.8); }
    return true;
  }
  return false;
}
function popDecoy(S, d) {
  d.popped = true; d.out = 0; S.trick.flash = 0.6;
  let n = 0;
  for (const g of S.drones) {
    if (g.state === 'dead' || g.state === 'flee') continue;
    const near = Math.hypot(g.x - d.x, g.y - (d.y - 64)) < C.trick.dizzyR * (has('mirror') ? 1.35 : 1);
    if (near && (g.state === 'lured' || g.state === 'seek' || g.state === 'charge' || g.state === 'drain')) {
      g.state = 'dizzy'; g.t = S.tut ? 999 : C.trick.dizzy; g.spin = Math.random() * 6; g.dizzyY = clamp(d.y - 60, 120, GROUND - 60); g.decoy = null; n++;
    } else if (g.state === 'lured' && g.decoy === d) { g.state = 'seek'; g.decoy = null; }
  }
  S.stats.tricked += n;
  fx.burst(d.x, d.y - 30, '#d9a7ff', 30, 260, 0.8, 3.5, 60); fx.burst(d.x, d.y - 30, '#ffffff', 16, 200, 0.5, 2.5, 0);
  fx.text(d.x, d.y - 120, n > 1 ? `TRICKED x${n}!` : 'TRICKED!', '#ffb3ff', 24 + Math.min(3, n) * 3, 1.2); fx.shake(5 + n * 2); hitStop(0.12);
  sfx.poof(); sfx.dizzy();
  if (n) solSay(S, n > 1 ? 'Gotcha, all of you! Stomp!' : 'Gotcha! Now jump on it!', 1.4);
}
export function updateDecoys(S, dt) {
  const T = S.trick; T.pulse = Math.max(0, T.pulse - dt * 2); T.flash = Math.max(0, T.flash - dt * 2.5);
  for (let i = S.decoys.length - 1; i >= 0; i--) {
    const d = S.decoys[i]; d.t += dt;
    if (d.popped) { d.out += dt; if (d.out > 0.5) S.decoys.splice(i, 1); continue; }
    if (!S.tut) d.life -= dt;
    if (d.life <= 0) { fx.burst(d.x, d.y - 20, '#9b8cc4', 12, 100, 0.5, 2, 0); fx.text(d.x, d.y - 60, 'fizzle', '#9b8cc4', 13, 0.8); S.decoys.splice(i, 1); }
  }
}
// a stomp/bonk/tap on a dizzy gremlin
export function trickStompBonus(S, g, x, y) {
  S.stats.trickStomps++; hitStop(0.09); fx.shake(9);
  fx.text(x, y - 70, 'TRICK STOMP!', '#ffb3ff', 22, 1); sfx.trickStomp();
  return C.trick.bonusHits;
}
export function airTrick(S, x, y) {
  S.stats.airTricks++; hitCombo(S, x, y, 2); S.coins += 5; hitStop(0.06);
  fx.text(x, y - 96, 'AIR TRICK! +5', '#ffd166', 20, 1); sfx.airTrick();
}

// ---------- gremlin trick sparks (day) ----------
export function dropFakes(S, g, dt) {
  if (!S.L.fakeEvery || S.phase !== 'day' || S.tut || g.kind === 'leech' || g.state !== 'seek') return;
  g.fakeT = (g.fakeT ?? S.L.fakeEvery * rnd(0.4, 0.9)) - dt;
  if (g.fakeT > 0) return;
  g.fakeT = S.L.fakeEvery * rnd(0.8, 1.3);
  if (S.sparks.filter(s => s.fake).length >= C.fake.max) return;
  S.sparks.push({ x: g.x, y: g.y + 20, vx: rnd(-30, 30), floatY: rnd(GROUND - 200, GROUND - 60), life: C.fake.life, max: C.fake.life, born: 0, wob: Math.random() * 6, fake: true });
  sfx.giggle(); fx.text(g.x, g.y - 40, 'hee hee', '#c9a0ff', 12, 0.8);
}
export function touchFake(S, s) {
  const take = Math.min(S.battery, C.fake.drain); S.battery -= take; if (take < C.fake.drain) S.coins = Math.max(0, S.coins - 5);
  S.stats.fakesHit++; breakCombo(S, 'Trick spark! Combo lost');
  fx.burst(s.x, s.y, '#9d4edd', 22, 180, 0.6, 3, 60); fx.text(s.x, s.y - 18, take > 0.05 ? `TRICKED! -${take.toFixed(1)} kWh` : 'TRICKED! -5', '#d291ff', 16, 1.1);
  fx.shake(5); sfx.fooled(); S.ui.batPulse = 1; S.hero.sq = 0.2; solSay(S, "Hey! That one was fake!", 1.2);
}
export function drawFakeMark(s, x, y, R) {   // a grin + purple flicker: the tell
  const T = G.t, fl = Math.sin(T * 7 + s.wob) > 0.55;
  if (fl) { const g = ctx.createRadialGradient(x, y, 2, x, y, R * 1.3); g.addColorStop(0, 'rgba(190,90,255,.9)'); g.addColorStop(1, 'rgba(160,60,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.3, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#3c096c'; ctx.beginPath(); ctx.arc(x - 3.5, y - 2, 1.6, 0, 7); ctx.arc(x + 3.5, y - 2, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3c096c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y + 0.5, 4, 0.2, Math.PI - 0.2); ctx.stroke();
}

// ---------- trick-or-treat (night) ----------
const COSTUMES = [{ sheet: '#f1f1f6', trim: '#c9cbe0' }, { sheet: '#ff9f1c', trim: '#c46a00', pumpkin: true }, { sheet: '#7b2cbf', trim: '#4a148c', hat: true }];
export function spawnVisitor(S, house, kind, opts = {}) {
  const hs = S.houses[house];
  const v = { house, kind, x: hs.x + hs.w / 2 - 34, t: 0, life: opts.life ?? C.knock.life, done: null, out: 0, costume: COSTUMES[(Math.random() * COSTUMES.length) | 0], bob: Math.random() * 6, robot: S.houses[(house % (S.houses.length - 1)) + 1]?.robot || 'frostkit', eyeT: rnd(0, 1) };
  S.visitors.push(v); S.stats.visitors++; hs.jump = 1; sfx.knock();
  fx.text(v.x, GROUND - 160, 'Knock knock!', '#ffd6a5', 15, 1.1);
  return v;
}
export function updateVisitors(S, dt, ctl) {
  if (!S.tut) {
    S.knockT -= dt;
    if (S.knockT <= 0 && S.t < S.L.nightS - 3) {
      S.knockT = S.L.knockEvery * rnd(0.8, 1.2);
      const busy = new Set(S.visitors.filter(v => !v.done).map(v => v.house));
      const free = S.houses.filter(hs => hs.i > 0 && !busy.has(hs.i));
      if (free.length && busy.size < 2) spawnVisitor(S, free[(Math.random() * free.length) | 0].i, Math.random() < S.L.kidShare ? 'kid' : 'gremlin');
    }
  }
  const h = S.hero, at = S.houses.find(q => h.x > q.x - 12 && h.x < q.x + q.w + 12);
  for (let i = S.visitors.length - 1; i >= 0; i--) {
    const v = S.visitors[i]; v.t += dt; v.bob += dt * 3;
    if (v.done) { v.out += dt; if (v.out > 0.8) S.visitors.splice(i, 1); continue; }
    if (at && at.i === v.house) {
      if (ctl.trickPress) { unmaskOrScare(S, v); continue; }
      if (ctl.actionPress) { giveTreat(S, v); continue; }
      if (!S.tut && (S.visHint || 0) < 3 && h.sayT <= -1.5) { S.visHint = (S.visHint || 0) + 1; solSay(S, G.touchUsed ? 'Feet? ⚡ treat. Floating? TRICK!' : 'Feet? E = treat. Floating? Q = trick!', 1.6); }
    }
    if (v.t >= v.life) resolveIgnored(S, v);
  }
}
function houseWins(S, v) { return S.houses[v.house].wins; }
function giveTreat(S, v) {
  const hs = S.houses[v.house];
  if (v.kind === 'kid') {
    v.done = 'treat'; S.stats.treats++;
    const cost = Math.min(S.battery, C.knock.treatCost); S.battery -= cost;
    for (const w of hs.wins) { if (w.dark) { w.dark = false; w.light = 0; } w.light = Math.min(1, w.light + C.knock.treatLight); w.fillFx = 1; }
    hs.mood = 0; hs.jump = 1; S.coins += C.knock.treatCoins;
    fx.text(v.x, GROUND - 100, 'TREAT! Thank you!', '#80ed99', 17, 1.1); fx.burst(v.x, GROUND - 50, '#ffd166', 20, 180, 0.6, 3, 120); fx.burst(v.x, GROUND - 50, '#ff8fab', 10, 140, 0.6, 3, 120);
    sfx.treat(); solSay(S, 'Happy Halloween!', 1);
  } else {
    v.done = 'fooled'; S.stats.fooled++;
    const take = Math.min(S.battery, C.knock.steal); S.battery -= take; S.ui.batPulse = 1;
    const w = houseWins(S, v).filter(q => !q.dark).sort((a, b) => b.light - a.light)[0]; if (w) lightsOut(S, w, 'Pranked!');
    fx.text(v.x, GROUND - 100, `TRICKED YOU! -${take.toFixed(1)} kWh`, '#d291ff', 17, 1.2); fx.burst(v.x, GROUND - 50, '#9d4edd', 24, 200, 0.6, 3, 0);
    fx.shake(7); hitStop(0.1); sfx.fooled(); sfx.giggle(); breakCombo(S); solSay(S, 'It was a gremlin! It was floating!', 1.5);
  }
}
function unmaskOrScare(S, v) {
  const hs = S.houses[v.house];
  if (v.kind === 'gremlin') {
    v.done = 'unmask'; S.stats.unmasked++;
    S.battery = Math.min(S.cap, S.battery + C.knock.unmaskKwh); S.ui.batPulse = 1;
    for (const w of hs.wins) if (!w.dark) { w.light = Math.min(1, w.light + C.knock.unmaskLight); w.fillFx = 1; }
    hs.mood = 0; hs.jump = 1;
    fx.text(v.x, GROUND - 104, `UNMASKED! +${C.knock.unmaskKwh} kWh`, '#ffb3ff', 19, 1.2); fx.burst(v.x, GROUND - 56, '#d9a7ff', 30, 260, 0.7, 3.5, 0); fx.burst(v.x, GROUND - 56, '#ffffff', 14, 200, 0.5, 2.5, 0);
    fx.shake(8); hitStop(0.12); sfx.trick(); sfx.poof(); S.trick.flash = 0.8; solSay(S, 'Nice costume. Not fooling me!', 1.3);
  } else {
    v.done = 'scared'; S.stats.scared++;
    for (const w of hs.wins) if (!w.dark) w.light = Math.max(0.02, w.light - C.knock.scare);
    hs.mood = -1;
    fx.text(v.x, GROUND - 100, 'Waaah! It was a real kid!', '#ff8fab', 16, 1.2); sfx.lose(); fx.shake(3); solSay(S, 'Oops... it had feet!', 1.3);
  }
}
function resolveIgnored(S, v) {
  if (v.kind === 'kid') { v.done = 'left'; S.stats.missed++; fx.text(v.x, GROUND - 96, 'no treat...', '#b8bdd6', 13, 0.9); }
  else {
    v.done = 'prank'; S.stats.pranks++;
    const w = houseWins(S, v).filter(q => !q.dark).sort((a, b) => b.light - a.light)[0]; if (w) lightsOut(S, w, 'PRANK!');
    fx.text(v.x, GROUND - 100, 'Hee hee! PRANKED!', '#d291ff', 17, 1.1); sfx.giggle();
  }
}
function nightTrick(S) {
  const h = S.hero, at = S.houses.find(q => h.x > q.x - 12 && h.x < q.x + q.w + 12);
  if (at && S.visitors.some(v => v.house === at.i && !v.done)) return;   // handled in updateVisitors (same tick)
  solSay(S, 'Trick who? Wait for a knock at a door', 1.2); sfx.tick();
}

// ---------- drawing ----------
export function drawDecoys(S) {
  const T = G.t;
  for (const d of S.decoys) {
    const a = d.popped ? clamp(1 - d.out / 0.5, 0, 1) : clamp(d.t / 0.2, 0, 1) * (d.life < 1.2 ? 0.5 + 0.5 * Math.sin(T * 20) : 1);
    const s = d.popped ? 1 + d.out * 2 : 0.6 + 0.4 * Math.min(1, d.t / 0.25) + 0.05 * Math.sin(T * 6);
    ctx.save(); ctx.globalAlpha = a;
    // lure rings
    if (!d.popped) for (let k = 0; k < 3; k++) { const r = ((T * 60 + k * 40) % 120) + 10; ctx.strokeStyle = `rgba(217,167,255,${0.5 * (1 - r / 130)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(d.x, d.y - 26, r, r * 0.55, 0, 0, 7); ctx.stroke(); }
    const gl = ctx.createRadialGradient(d.x, d.y - 26, 4, d.x, d.y - 26, 70); gl.addColorStop(0, 'rgba(255,240,160,.7)'); gl.addColorStop(0.5, 'rgba(217,167,255,.25)'); gl.addColorStop(1, 'rgba(217,167,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(d.x, d.y - 26, 70, 0, 7); ctx.fill();
    ctx.translate(d.x, d.y - 4); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(217,167,255,.5)'; ctx.fillRect(-2, -16, 4, 16);   // hologram stand
    ctx.translate(0, -30 + Math.sin(T * 3) * 2); ctx.rotate(-0.22 + Math.sin(T * 2) * 0.05);
    const pg = ctx.createLinearGradient(-26, -12, 26, 12); pg.addColorStop(0, '#fff3b0'); pg.addColorStop(0.5, '#ffd166'); pg.addColorStop(1, '#d9a7ff');
    ctx.fillStyle = pg; ctx.fillRect(-26, -12, 52, 22); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.strokeRect(-26, -12, 52, 22);
    ctx.strokeStyle = 'rgba(120,60,200,.5)'; ctx.lineWidth = 1; ctx.beginPath(); for (const xx of [-9, 9]) { ctx.moveTo(xx, -12); ctx.lineTo(xx, 10); } ctx.moveTo(-26, -1); ctx.lineTo(26, -1); ctx.stroke();
    const sh = ((T * 1.4) % 2) * 70 - 35; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(sh - 5, -12); ctx.lineTo(sh + 4, -12); ctx.lineTo(sh - 2, 10); ctx.lineTo(sh - 11, 10); ctx.fill();
    for (let k = 0; k < 4; k++) { const yy = -12 + ((T * 30 + k * 6) % 22); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-26, yy, 52, 1.5); }   // scanlines
    ctx.restore();
  }
  // dashed lure lines from lured gremlins
  ctx.save(); ctx.setLineDash([5, 6]); ctx.lineDashOffset = -G.t * 40; ctx.strokeStyle = 'rgba(217,167,255,.55)'; ctx.lineWidth = 2;
  for (const g of S.drones) if (g.state === 'lured' && g.decoy) { ctx.beginPath(); ctx.moveTo(g.x, g.y + 20); ctx.lineTo(g.decoy.x, g.decoy.y - 30); ctx.stroke(); }
  ctx.restore();
}
export function drawDizzy(g) {
  const T = G.t;
  for (let k = 0; k < 3; k++) {
    const a = g.spin + k * 2.094, x = g.x + Math.cos(a) * 30, y = g.y - 40 + Math.sin(a) * 8;
    ctx.save(); ctx.translate(x, y); ctx.rotate(T * 5); ctx.fillStyle = k === 1 ? '#d9a7ff' : '#ffd166'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.5 : 6, an = i * Math.PI / 5; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
  }
  if (g.t < 1.2 && g.t > 0) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 20); }
  roundRect(ctx, g.x - 30, g.y - 70, 60, 16, 8); ctx.fillStyle = '#7b2cbf'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = font(900, 11); ctx.textAlign = 'center'; ctx.fillText('DIZZY', g.x, g.y - 58.5); ctx.globalAlpha = 1;
}
export function drawHorns(x, y, s = 1, col = '#9d4edd') {   // two little devil horns poking out from behind the storm cloud (draw before the sprite)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col; ctx.strokeStyle = '#3c096c'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
  for (const sg of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sg * 9, 6); ctx.quadraticCurveTo(sg * 12, -12, sg * 27, -24); ctx.quadraticCurveTo(sg * 24, -6, sg * 23, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(sg * 13, 0); ctx.quadraticCurveTo(sg * 15, -10, sg * 24, -19); ctx.lineTo(sg * 22, -12); ctx.closePath(); ctx.fill(); ctx.fillStyle = col;
  }
  ctx.restore();
}
export function drawVisitors(S) {
  const T = G.t;
  for (const v of S.visitors) {
    const app = clamp(v.t / 0.3, 0, 1), gone = v.done ? clamp(v.out / 0.8, 0, 1) : 0, a = app * (1 - gone);
    if (a <= 0.01) continue;
    const grem = v.kind === 'gremlin', floatY = grem ? 10 + Math.sin(v.bob * 1.3) * 3 : 0;
    const exitDx = v.done === 'left' || v.done === 'treat' ? gone * 40 : 0, exitDy = v.done === 'unmask' ? -gone * 60 : 0;
    const x = v.x + exitDx, base = GROUND - floatY + exitDy;
    ctx.save(); ctx.globalAlpha = a;
    {   // warm porch light so the costume reads at night
      const pg = ctx.createRadialGradient(x, GROUND - 30, 6, x, GROUND - 30, 62); pg.addColorStop(0, 'rgba(255,214,140,.32)'); pg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(x, GROUND - 30, 62, 0, 7); ctx.fill();
    }
    ctx.translate(x, GROUND); ctx.scale(1.18, 1.18); ctx.translate(-x, -GROUND);
    // shadow: kids cast a crisp one, floating gremlins a faint one
    ctx.fillStyle = grem ? 'rgba(0,0,0,.12)' : 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, GROUND + 1, grem ? 10 : 15, 3.5, 0, 0, 7); ctx.fill();
    if (v.done === 'unmask') {   // the costume falls away to show the storm gremlin
      drawHorns(x, base - 36, 0.6); sprite('storm', x, base - 4, 46, false, 1);
      ctx.restore(); continue;
    }
    const C0 = v.costume, H = 46;
    if (!grem) {   // robot feet + legs below the costume
      ctx.fillStyle = '#5b6178'; ctx.fillRect(x - 9, base - 9, 5, 7); ctx.fillRect(x + 4, base - 9, 5, 7);
      ctx.fillStyle = '#2a2f4f'; roundRect(ctx, x - 12, base - 4, 10, 5, 2.5); ctx.fill(); roundRect(ctx, x + 2, base - 4, 10, 5, 2.5); ctx.fill();
    } else {   // a wispy storm tail instead of feet
      ctx.strokeStyle = 'rgba(160,190,220,.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 6, base - 8);
      for (let k = 1; k <= 4; k++) ctx.lineTo(x - 6 + Math.sin(T * 9 + k) * 5, base - 8 + k * 3.5); ctx.stroke(); ctx.lineCap = 'butt';
    }
    // sheet costume (same for both)
    const top = base - H, sw = Math.sin(T * 4 + v.bob) * 2;
    ctx.fillStyle = C0.sheet; ctx.strokeStyle = C0.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 15, base - 8); ctx.quadraticCurveTo(x - 17, top + 10, x, top); ctx.quadraticCurveTo(x + 17, top + 10, x + 15, base - 8);
    for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(x + 15 - k * 7.5 - 3.75 + sw, base - 4, x + 15 - (k + 1) * 7.5, base - 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (C0.pumpkin) { ctx.strokeStyle = C0.trim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 6, top + 4); ctx.quadraticCurveTo(x - 9, top + 20, x - 6, base - 10); ctx.moveTo(x + 6, top + 4); ctx.quadraticCurveTo(x + 9, top + 20, x + 6, base - 10); ctx.stroke(); ctx.fillStyle = '#2d6a4f'; ctx.fillRect(x - 2, top - 5, 4, 6); }
    if (C0.hat) { ctx.fillStyle = '#240046'; ctx.beginPath(); ctx.moveTo(x - 16, top + 6); ctx.lineTo(x + 16, top + 6); ctx.lineTo(x + 3, top - 20); ctx.lineTo(x + 8, top - 24); ctx.lineTo(x - 2, top - 16); ctx.closePath(); ctx.fill(); }
    // eyes: kids glow warm yellow; gremlins flash red now and then (always, with Gremlin Radar)
    const red = grem && (has('radar') || Math.sin(T * 4.2 + v.eyeT * 6) > 0.6);
    ctx.fillStyle = C0.pumpkin ? '#3a1d00' : '#1d2240'; ctx.beginPath(); ctx.ellipse(x - 6, top + 16, 4, 5, 0, 0, 7); ctx.ellipse(x + 6, top + 16, 4, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = red ? '#ff2e63' : '#ffe066'; ctx.beginPath(); ctx.arc(x - 6, top + 16, 2, 0, 7); ctx.arc(x + 6, top + 16, 2, 0, 7); ctx.fill();
    if (red && has('radar')) { const rg = ctx.createRadialGradient(x, top + 20, 4, x, top + 20, 36); rg.addColorStop(0, 'rgba(255,46,99,.35)'); rg.addColorStop(1, 'rgba(255,46,99,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, top + 20, 36, 0, 7); ctx.fill(); }
    // candy bucket
    ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.arc(x + 17, base - 18, 6, 0, Math.PI); ctx.fill(); ctx.fillRect(x + 11, base - 22, 12, 4); ctx.strokeStyle = '#2a2f4f'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + 17, base - 22, 6, Math.PI, 0); ctx.stroke();
    if (!v.done) {   // the knock bubble + time ring
      const k = clamp(1 - v.t / v.life, 0, 1), by = top - 30 + Math.sin(T * 5) * 2;
      roundRect(ctx, x - 40, by - 14, 80, 22, 11); ctx.fillStyle = 'rgba(14,18,48,.9)'; ctx.fill(); ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffd6a5'; ctx.font = font(900, 11); ctx.textAlign = 'center'; ctx.fillText('TRICK or TREAT?', x, by + 1);
      ctx.strokeStyle = k < 0.3 ? '#ff6b6b' : '#ffb703'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, by + 18, 5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
// HUD pill: trick charges + meter
export function drawTrickHUD(S, panel) {
  const T = S.trick, x = 10, y = 58, w = 214, h = 30, night = S.phase === 'night' || S.tutNight;
  panel(x, y, w, h, 12, 0.62 + T.pulse * 0.3);
  if (T.pulse > 0 || T.flash > 0) { ctx.save(); ctx.globalAlpha = Math.max(T.pulse, T.flash); ctx.strokeStyle = '#d9a7ff'; ctx.lineWidth = 3; roundRect(ctx, x, y, w, h, 12); ctx.stroke(); ctx.restore(); }
  // mirror icon
  ctx.save(); ctx.translate(x + 18, y + 15); ctx.rotate(-0.3); ctx.fillStyle = '#d9a7ff'; ctx.beginPath(); ctx.ellipse(0, -2, 7, 9, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.ellipse(-1.5, -3.5, 3, 4.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#7b2cbf'; ctx.fillRect(-1.5, 6, 3, 7); ctx.restore();
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = font(900, 13);
  const key = touchOn() ? 'TRICK' : 'TRICK [Q]';
  ctx.fillText(key, x + 32, y + 20);
  if (night) { ctx.font = font(700, 12); ctx.fillStyle = '#d9a7ff'; ctx.fillText('at the door', x + (touchOn() ? 84 : 104), y + 20, w - (touchOn() ? 90 : 110)); return; }
  const kx = x + (touchOn() ? 84 : 104);
  for (let i = 0; i < trickMax(); i++) {
    const on = i < T.ch, cx = kx + i * 20, cy = y + 15, s = on ? 1 + T.pulse * 0.4 : 1;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate(Math.PI / 4); ctx.fillStyle = on ? '#d9a7ff' : 'rgba(255,255,255,.15)'; ctx.fillRect(-6, -6, 12, 12); ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(-6, -6, 12, 12); ctx.restore();
  }
  const bx = kx + trickMax() * 20 - 4, bw = x + w - 10 - bx;
  if (T.ch < trickMax() && bw > 10) { roundRect(ctx, bx, y + 12, bw, 6, 3); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fill(); roundRect(ctx, bx, y + 12, bw * clamp(T.fill, 0, 1), 6, 3); ctx.fillStyle = '#ffd166'; ctx.fill(); }
}
