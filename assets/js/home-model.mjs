import { getMaxTestSeries } from './features.mjs';
import { normalizeNarrativeGoals } from './goal-model.mjs';
export { normalizeNarrativeGoals } from './goal-model.mjs';

export function getAdventureSummary(records,goals,today){
  const rows=records.filter(row=>row&&row.date<=today),series=getMaxTestSeries(rows),goal=normalizeNarrativeGoals(goals);
  const badges=[
    {id:'first-note',symbol:'◆',title:'はじめの足跡',description:'最初の活動を記録する',earned:rows.length>0},
    {id:'outdoor-send',symbol:'▲',title:'岩との対話',description:'外岩の完登を記録する',earned:rows.some(row=>row.kind==='outdoor'&&Number(row.sends)>0)},
    {id:'measurement',symbol:'◎',title:'自分を知る',description:'最大出力を測定する',earned:series.length>0},
    {id:'personal-quest',symbol:'⚑',title:'言葉の道しるべ',description:'自分の目標を文章で残す',earned:Boolean(goal.focus.trim())},
    {id:'reflection',symbol:'✎',title:'気づきを集める',description:'活動のメモを残す',earned:rows.some(row=>String(row.memo||'').trim())},
    {id:'personal-best',symbol:'✦',title:'新しい一手',description:'同じ条件で自己ベストを更新する',earned:series.some(group=>group.entries.some((entry,index)=>index>0&&entry.isPersonalBest))}
  ];
  return {badges,earnedCount:badges.filter(badge=>badge.earned).length,goal,series,memories:rows.map((row,index)=>({...row,order:index})).sort((a,b)=>b.date.localeCompare(a.date)||b.order-a.order).slice(0,3)};
}
