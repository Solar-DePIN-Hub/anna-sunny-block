import assert from 'node:assert/strict';
import { validatePlan, toLevel, parseJson, buildPlanPrompt, buildDebriefPrompt, fallbackDebrief, runRecord } from '../bundle/anna/plan.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
t('parses fenced JSON with trailing comma', () => { const o = parseJson('Sure!\n```json\n{"a":1,"b":[1,2,],}\n```'); assert.deepEqual(o, { a: 1, b: [1, 2] }); });
t('rejects non-JSON', () => assert.throws(() => parseJson('no braces here')));
t('clamps a wild plan to a playable level', () => {
  const p = validatePlan({ name: 'x'.repeat(80), difficulty: 9, houses: 40, dayS: 999, nightS: 1, weather: [2, -1, 'a'], waves: [[1, 99], [3, 2], [30, 1, 'leech'], [32, 1, 'leech'], [50, 1, 'leech'], [55, 1, 'LEECH'], [500, 3]], droneSpeed: 9, fakeEvery: 2, knockEvery: 0, kidShare: 5 });
  assert.equal(p.name.length, 28); assert.equal(p.difficulty, 5); assert.equal(p.houses, 6); assert.equal(p.dayS, 70); assert.equal(p.nightS, 20);
  assert.deepEqual(p.weather, [0.8, 0, 0.2]);   // clamped; junk → 0.2
  assert.ok(p.waves.every(w => w[0] >= 5 && w[0] <= 62 && w[1] >= 1 && w[1] <= 4));
  assert.ok(p.waves.filter(w => w[2] === 'leech').length <= 2);
  for (let i = 1; i < p.waves.length; i++) assert.ok(p.waves[i][0] - p.waves[i - 1][0] >= 4);
  assert.equal(p.droneSpeed, 1.6); assert.equal(p.fakeEvery, 0); assert.equal(p.knockEvery, 4); assert.equal(p.kidShare, 0.7);
});
t('minimal plan still gives a level with waves', () => { const p = validatePlan({ difficulty: 2 }); assert.equal(p.weather.length, 5); assert.ok(p.waves.length >= 1); assert.ok(p.taunt && p.intro); const L = toLevel(p); assert.equal(L.ai, true); assert.equal(L.stars.length, 3); assert.equal(L.drain.length, 2); });
t('object-style waves accepted', () => { const p = validatePlan({ difficulty: 3, waves: [{ second: 12, count: 2 }, { at: 30, kind: 'leech' }] }); assert.deepEqual(p.waves, [[12, 2], [30, 1, 'leech']]); });
t('non-object throws', () => assert.throws(() => validatePlan(null)));
t('prompts carry profile, wish, rematch info', () => {
  const s = buildPlanPrompt({ aiNights: [{ stars: 3 }] }, 'spooky "night"', { stars: 0, gremlinsTreatedByMistake: 4 });
  assert.match(s, /REMATCH/); assert.match(s, /spooky 'night'/); assert.match(s, /gremlinsTreatedByMistake/);
  assert.match(buildDebriefPrompt({ name: 'N', difficulty: 2, scheme: [] }, { stars: 1 }, []), /THEIR RESULT/);
});
t('runRecord + fallback debrief', () => {
  const S = { L: { name: 'N', plan: { difficulty: 2 } }, stars: 1, lit: 0.612, score: 900, battery: 1.23, stats: { built: 3, fooled: 2, pranks: 1, tricks: 0, fakesHit: 3, darks: 4 } };
  const r = runRecord(S); assert.equal(r.lit, 0.61); assert.equal(r.gremlinsTreatedByMistake, 2);
  const d = fallbackDebrief(r); assert.ok(d.tips.length >= 1 && d.tips.length <= 3); assert.match(d.verdict, /61%/);
});
console.log(`${n} passed`);
import { normalizeDebrief } from '../bundle/anna/plan.js';
t('debrief: wrong shape falls back, good shape kept', () => {
  const rec = { stars: 1, lit: 0.5, trickStomps: 1, disguisedGremlinsUnmasked: 0, gremlinsTreatedByMistake: 0, gremlinsIgnored: 0, kidsScared: 0, decoys: 2, fakeSparksTouched: 0, windowsWentDark: 0 };
  assert.equal(normalizeDebrief({ name: 'plan', waves: [] }, rec).fallback, true);
  const ok = normalizeDebrief({ headline: 'H', verdict: 'V', tips: ['a', '', 'b', 'c', 'd'] }, rec); assert.deepEqual(ok.tips, ['a', 'b', 'c']); assert.equal(ok.fallback, undefined);
});
t('plan: a debrief-shaped reply is rejected as a plan', () => assert.throws(() => validatePlan({ headline: 'x', tips: [] })));
console.log(`${n} passed (total)`);
