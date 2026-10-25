import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareBodySettings } from '../assets/js/body-settings.mjs';
import { normalizeNarrativeGoals } from '../assets/js/goal-model.mjs';
import { getAdventureSummary } from '../assets/js/home-model.mjs';
import { renderHomeMarkup } from '../assets/js/home-screen.mjs';
import { buildCloudPayload } from '../assets/js/features.mjs';

test('one body save updates height, reach and one dated weight without mutating history',()=>{
  const profile={heightCm:170,reachCm:174},history=[{date:'2026-10-20',kg:65},{date:'2026-10-24',kg:64}];
  const next=prepareBodySettings({heightCm:'171.5',reachCm:'178',date:'2026-10-24',kg:'63.5'},profile,history,'2026-10-24T01:00:00Z');
  assert.equal(next.profile.heightCm,171.5);assert.equal(next.profile.reachCm,178);assert.equal(next.weightChanged,true);assert.equal(next.history.length,2);assert.equal(next.history[1].kg,63.5);
  assert.equal(profile.heightCm,170);assert.equal(history[1].kg,64);
});
test('saving sizes with no weight leaves all past weight values intact',()=>{
  const history=[{date:'2026-10-20',kg:65}];const next=prepareBodySettings({heightCm:'170',reachCm:'',date:'2026-10-24',kg:''},{},history);
  assert.equal(next.weightChanged,false);assert.equal(next.history,history);assert.equal(next.profile.reachCm,null);
});
test('invalid combined body input fails before any values can be persisted',()=>{
  const profile={heightCm:170},history=[{date:'2026-10-20',kg:65}];
  assert.throws(()=>prepareBodySettings({heightCm:'171',reachCm:'175',date:'2026-02-30',kg:'64'},profile,history),/日付/);
  assert.throws(()=>prepareBodySettings({heightCm:'171',reachCm:'175',date:'2026-10-24',kg:'-2'},profile,history),/体重/);
  assert.deepEqual(profile,{heightCm:170});assert.equal(history[0].kg,65);
});
test('goals preserve the users own text and self-assessed progress without attendance quotas',()=>{
  const narrative={focus:'スラブで足を信じたい\n動きを楽しむ',plan:'重心を丁寧に移す',reflection:'力を抜けた',status:'reviewing'};
  assert.deepEqual(normalizeNarrativeGoals(narrative),narrative);
  assert.deepEqual(normalizeNarrativeGoals({gymDaysMonthly:8}),{focus:'',plan:'',reflection:'',status:'active'});
  assert.deepEqual(normalizeNarrativeGoals(null),{focus:'',plan:'',reflection:'',status:'active'});
  const payload=buildCloudPayload({getItem:key=>key==='climbLogGoals'?JSON.stringify(narrative):null});assert.deepEqual(payload.goals,narrative);assert.equal('gymDaysMonthly' in payload.goals,false);
});
test('adventure badges reflect actual notes and matched personal bests, with no invented progress',()=>{
  const empty=getAdventureSummary([],{},'2026-10-24');assert.equal(empty.earnedCount,0);assert.equal(empty.memories.length,0);
  const base={kind:'training',trainingMode:'maxTest',maxType:'hangboard',gripType:'open',edgeDepthMm:20,holdSeconds:7,addedWeightKg:10,totalLoadKg:70,date:'2026-10-20'};
  const initial=getAdventureSummary([{...base,id:'a'}],{},'2026-10-24');assert.equal(initial.badges.find(badge=>badge.id==='personal-best').earned,false);
  const rows=[{...base,id:'a',memo:'立ち位置を変えた'},{...base,id:'b',date:'2026-10-23',addedWeightKg:12,totalLoadKg:72},{id:'future',kind:'outdoor',date:'2027-01-01',sends:1}];
  const result=getAdventureSummary(rows,{focus:'丁寧に登りたい'},'2026-10-24');assert.equal(result.badges.find(badge=>badge.id==='personal-best').earned,true);assert.equal(result.badges.find(badge=>badge.id==='outdoor-send').earned,false);assert.equal(result.memories.length,2);
  assert.equal(getAdventureSummary([{...base,id:'a'},{...base,id:'b',holdSeconds:10,totalLoadKg:72}],{},'2026-10-24').badges.find(badge=>badge.id==='personal-best').earned,false);
});
test('home contains only the original companion scene and one short speech, without private records',()=>{
 const html=renderHomeMarkup([{memo:'private note'}],{focus:'private goal'},'2026-10-25');
 assert.match(html,/id="pixelRoom"/);assert.match(html,/id="companionSpeech"/);assert.match(html,/data-talk-companion/);
 assert.doesNotMatch(html,/private note|private goal|data-home-action|data-open-workout|memoryCard|campBadges|campQuest|FIELD NOTES/);
 assert.equal((html.match(/<button/g)||[]).length,1);
});
