import { getMaxTestSeries } from './features.mjs';
import { getLiftHandComparisons } from './strength-insights.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value.toFixed(2)).toString();
const gripLabel=row=>({open:'オープン',halfCrimp:'ハーフクリンプ',fullCrimp:'フルクリンプ'}[row.gripType]||'握り方未記録');
function conditions(row){return row.maxType==='weightedPullup'?'':`${gripLabel(row)} · ${row.edgeDepthMm?`${row.edgeDepthMm}mm`:'厚さ未記録'}${row.maxType==='hangboard'?` · ${row.holdSeconds?`${row.holdSeconds}秒`:'保持時間未記録'}`:''}${row.maxType==='singleHandLift'?` · ${row.liftHand==='left'?'左手':row.liftHand==='right'?'右手':'左右未記録'}`:''}`;}
export function renderMaxTestMarkup(records){
  const series=getMaxTestSeries(records),pairs=getLiftHandComparisons(records);
  if(!series.length)return '<div class="emptyStats">最大出力を記録すると、同条件の負荷・体重比・左右差が表示されます</div>';
  const groups=series.map((group,index)=>{
    const first=group.entries[0],latest=group.entries.at(-1),recent=group.entries.slice(-8),peak=Math.max(1,...recent.map(row=>row.valueKg));
    const title={hangboard:'ハングボード保持',weightedPullup:'加重懸垂',singleHandLift:'片手リフト'}[first.maxType]||first.maxType;
    const basis={total:'合計負荷',external:'追加重量（体重未記録）',lift:'挙上重量'}[latest.metricBasis];
    return `<details class="strengthSeries" ${index===0?'open':''}><summary><span><strong>${esc(title)}</strong><small>${esc(conditions(first))}</small></span><span>${number(latest.valueKg)}kg<small>${latest.bodyweightRatio==null?'体重比 —':`体重比 ${latest.bodyweightRatio.toFixed(2)}倍`}</small></span></summary><p class="sub">${basis}の推移。体重比は各記録の測定時体重を使用します。</p><div class="maxTrend">${recent.map(row=>`<div class="maxTrendColumn"><span>${number(row.valueKg)}</span><div class="maxTrendTrack"><i style="height:${Math.max(3,row.valueKg/peak*100)}%"></i></div><small>${esc(row.date.slice(5))}</small></div>`).join('')}</div>${recent.map(row=>`<div class="strengthEntry"><span>${esc(row.date)}<small>${row.bodyweightKg?`体重 ${row.bodyweightKg}kg`:'測定時体重なし'}</small></span><span><strong>${number(row.valueKg)}kg</strong><small>${row.bodyweightRatio==null?'体重比 —':`体重比 ${row.bodyweightRatio.toFixed(2)}倍`}</small>${row.isPersonalBest?'<i class="maxBest">自己ベスト</i>':''}</span></div>`).join('')}</details>`;
  }).join('');
  const comparison=pairs.length?`<section class="handComparison"><h4>片手リフトの左右差</h4><p class="sub">同じ日・握り方・厚さの各手の最大値を比較します。差率＝左右差 ÷ 大きい方の重量。</p>${pairs.slice(0,8).map(pair=>`<article class="handPair"><strong>${esc(pair.date)}</strong><small>${esc(gripLabel(pair.condition))} · ${pair.condition.edgeDepthMm||'—'}mm</small><div class="handPairValues"><span>右 ${pair.rightKg==null?'—':`${number(pair.rightKg)}kg`}</span><span>左 ${pair.leftKg==null?'—':`${number(pair.leftKg)}kg`}</span><span>${pair.differenceKg==null?'片側のみ':`${number(pair.differenceKg)}kg差${pair.differencePercent==null?'':` / ${pair.differencePercent.toFixed(1)}%`}`}</span></div></article>`).join('')}</section>`:'';
  return groups+comparison;
}
