import {outdoorProblemKey,isOutdoorSend} from './outdoor-season.mjs';
import {newId} from './data-utils.mjs';

export function wishFromRoute(source) {
  const discipline=source.discipline||'boulder';
  const grade=source.outdoorGrade||source.grade||'';
  return {
    cragName:(source.cragName||source.place||'').trim(),
    areaName:(source.areaName||'').trim(),
    routeName:(source.routeName||'').trim(),
    discipline,
    gradeSystem:source.gradeSystem||(discipline==='lead'?'YDS / デシマル':'日本（段級）'),
    outdoorGrade:grade==='グレード未設定'?'':grade.trim()
  };
}
export function validateWish(wish) {
  if(!wish||!['lead','boulder'].includes(wish.discipline)||typeof wish.starred!=='boolean')
    throw new Error('課題の種目と優先設定を確認してください。');
  for(const key of ['cragName','routeName','areaName','gradeSystem','outdoorGrade']){
    if(typeof wish[key]!=='string')throw new Error('課題の名前やグレードの形式を確認してください。');
  }
  if(!outdoorProblemKey(wish))throw new Error('岩場と課題名を入力してください。');
}
export function addOutdoorWish(wishes,source) {
  const item={...wishFromRoute(source),starred:false};
  validateWish(item);
  const key=outdoorProblemKey(item);
  if(wishes.some(w=>outdoorProblemKey(w)===key))throw new Error('この課題はすでにリストにあります。');
  return [...wishes,{...item,id:newId()}];
}
// Derive progress from saved ascents, including edits, trash and restore.
export function wishlistEntries(wishes,records) {
  const byKey=new Map(wishes.map(w=>[outdoorProblemKey(w),w]));
  const byId=new Map(wishes.map(w=>[w.id,w]));
  const facts=new Map(wishes.map(w=>[w.id,{wish:w,latest:null,done:false}]));
  for(const row of records){
    if(row.kind!=='outdoor')continue;
    let match=byKey.get(outdoorProblemKey(row));
    if(!match && row.outdoorWishId){
      const linked=byId.get(row.outdoorWishId);
      if(linked && !linked.areaName && outdoorProblemKey({...row,areaName:''})===outdoorProblemKey(linked))match=linked;
    }
    if(!match)continue;
    const fact=facts.get(match.id),last=fact.latest;
    if(isOutdoorSend(row))fact.done=true;
    if(!last || row.date>last.date || (row.date===last.date && (row.createdAt||'')>=(last.createdAt||'')))fact.latest=row;
  }
  return [...facts.values()].sort((a,b)=>a.wish.cragName.localeCompare(b.wish.cragName,'ja')||
    Number(b.wish.starred)-Number(a.wish.starred)||a.wish.routeName.localeCompare(b.wish.routeName,'ja'));
}
