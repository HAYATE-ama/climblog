import {isRecordedLoad} from './training-conditions.mjs';
import {escapeHtml as esc} from './data-utils.mjs';
import {trainingVolume} from './training-model.mjs';
const kindNames={gym:'ジム',outdoor:'外岩',training:'トレーニング'};
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const text=value=>String(value??'').trim();
export function routineLabel(r){
 const v=trainingVolume(r),rows=r.setDetails;
 if(rows?.length){const same=rows.every(s=>n(s.reps)===n(rows[0].reps)&&n(s.holdSeconds)===n(rows[0].holdSeconds));if(same){const target=[n(rows[0].reps)?`${n(rows[0].reps)}回`:'',n(rows[0].holdSeconds)?`${n(rows[0].holdSeconds)}秒`:''].filter(Boolean).join('＋');return `${target}×${v.sets}セット`;}return [`${v.sets}セット`,v.reps?`合計${v.reps}回`:'',v.holdSeconds?`合計${v.holdSeconds}秒`:''].filter(Boolean).join(' · ');}
 return [n(r.reps)&&v.sets?`${n(r.reps)}回×${v.sets}セット`:v.sets?`${v.sets}セット`:'',n(r.durationMinutes)?`${n(r.durationMinutes)}分`:''].filter(Boolean).join(' · ')||'実績未入力';
}
export function recordSummary(r){
 if(r.kind==='outdoor')return {title:`${text(r.cragName)||text(r.place)||'岩場未設定'} · ${text(r.routeName)||'課題名なし'}`,value:text(r.outdoorGrade)||text(r.grade)||'NoGrade',secondary:[({flash:'フラッシュ',onsight:'オンサイト',redpoint:'レッドポイント',send:'完登',attempt:'トライ'}[r.result]||'記録'),['flash','onsight'].includes(r.result)?'1回':text(r.attemptsRange)?text(r.attemptsRange).replace(/回$/,'').replace(/-/g,'〜')+'回':n(r.tries)?`${n(r.tries)}回`:'',r.discipline==='lead'?'リード':''].filter(Boolean).join(' · ')};
 if(r.kind==='gym')return {title:text(r.gymName)||text(r.place)||'ジム未設定',value:text(r.gradeLabelSnapshot)||text(r.grade)||'NoGrade',secondary:`${r.gymOutcome==='failed'?'敗退 · ':''}完登${n(r.sends)} · トライ${n(r.tries)}`};
 if(r.trainingMode==='maxTest'){const conditions=[({open:'オープン',halfCrimp:'ハーフクリンプ',fullCrimp:'フルクリンプ'}[r.gripType]||''),n(r.edgeDepthMm)?`${n(r.edgeDepthMm)}mm`:'',n(r.holdSeconds)?`${n(r.holdSeconds)}秒`:'',({left:'左手',right:'右手'}[r.liftHand]||'')].filter(Boolean);return {title:text(r.exerciseName)||text(r.grade)||'最大出力',value:`${r.maxType==='singleHandLift'?'挙上':'追加'} ${n(r.addedWeightKg)}kg`,secondary:conditions.join(' · ')};}
 const sets=r.setDetails?.length?r.setDetails:[{loadKg:r.loadKg,loadRecorded:r.loadRecorded}],loads=sets.filter(s=>isRecordedLoad(s,r.loadMethod)&&s.loadKg!=null&&s.loadKg!==''&&Number.isFinite(Number(s.loadKg))&&Number(s.loadKg)>=0).map(s=>Number(s.loadKg)),lo=Math.min(...loads),hi=Math.max(...loads),missing=loads.length<sets.length;
 const weight=loads.length?(hi?`負荷 ${lo===hi?hi:lo+'〜'+hi}kg`:'重量なし')+(missing?'（未記録あり）':''):'重量未記録';
 return {title:text(r.exerciseName)||text(r.grade)||'トレーニング',value:routineLabel(r),secondary:weight};
}
export function recordLineMarkup(r,{secondary=true}={}){
 const s=recordSummary(r),color=r.colorSnapshot||r.swatch,swatch=r.kind==='gym'?`<i class="compactSwatch" style="background:${/^#[0-9a-f]{3,8}$/i.test(color||'')?color:'#ff6f00'}" aria-hidden="true"></i>`:'';
 return `<span class="logrow recordPrimary"><span class="recordTitle">${esc(s.title)}</span>${swatch}<span class="recordValue">${esc(s.value)}</span><span class="recordChevron" aria-hidden="true">›</span></span>${secondary&&s.secondary?`<span class="recordSecondary">${esc(s.secondary)}</span>`:''}`;
}
export function recordAccessibleLabel(r){const s=recordSummary(r);return [r.date,kindNames[r.kind],s.title,s.value,s.secondary,'詳細を見る'].filter(Boolean).join(' · ');}
export function searchRecordMarkup(r,{kind='all',year}={}){
 const short=r.date?.slice(0,4)===String(year)?r.date.slice(5).replace('-','/'):r.date;
 return `<button type="button" class="searchResult compactSearch" data-search-date="${esc(r.date)}" data-search-record="${esc(r.id)}" aria-label="${esc(recordAccessibleLabel(r))}"><span class="recordMeta"><time datetime="${esc(r.date)}">${esc(short)}</time>${kind==='all'?`<span>${kindNames[r.kind]||'活動'}</span>`:''}</span>${recordLineMarkup(r,{secondary:false})}</button>`;
}
export function outdoorStatMarkup(r){return `<button type="button" class="outdoorProblemRow compactOutdoor" data-view-record="${esc(r.id)}" aria-label="${esc(recordAccessibleLabel(r))}">${recordLineMarkup(r,{secondary:false})}<span class="recordSecondary">${esc(r.date?.slice(5).replace('-','/'))} · ${esc(recordSummary(r).secondary)}</span></button>`;}
