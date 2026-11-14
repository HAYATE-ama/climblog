import {boulderJapaneseGrades,japaneseDanPoints} from './japanese-boulder-grades.mjs';

const vScaleGrades=Array.from({length:18},(_,i)=>[`V${i}-`,`V${i}`,`V${i}+`]).flat();
const fontScaleGrades=["3","3+","4","4+","5","5+",...Array.from({length:4},(_,i)=>["A","B","C"].flatMap(letter=>{const band=6+i;return [`${band}${letter}`,`${band}${letter}+`]}))];
const frenchGrades=["3","3+",...Array.from({length:5},(_,i)=>["a","b","c"].flatMap(letter=>{const band=i+4;return [`${band}${letter}`,`${band}${letter}+`]})),"9a","9a+","9b","9b+","9c"];
const ydsGrades=[...Array.from({length:10},(_,i)=>`5.${i}`),...Array.from({length:6},(_,i)=>{const band=i+10;return [`5.${band}`,...(["a","b","c","d"].map(letter=>`5.${band}${letter}`))]}).flat()];
const romanGrades=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
const uiaaGrades=romanGrades.flatMap(g=>[`${g}-`,g,`${g}+`]);

const systems={
  boulder:{'日本（段級）':boulderJapaneseGrades,'V Scale':vScaleGrades,Fontainebleau:fontScaleGrades.flat()},
  lead:{'YDS / デシマル':ydsGrades,French:frenchGrades.flat(),UIAA:uiaaGrades}
};
export const gradeSystemsFor=discipline=>Object.keys(systems[discipline]||{});
export const gradeOptionsFor=(discipline,system)=>Object.hasOwn(systems[discipline]||{},system)?systems[discipline][system]:[];

const catalogs=Object.values(systems).flatMap(group=>Object.entries(group)).map(([system,grades],order)=>({
  system,order,ranks:new Map(grades.map((grade,index)=>[grade,index]))
}));
const collator=new Intl.Collator('ja',{numeric:true});
function gradePosition(record){
  const grade=String(record.outdoorGrade??record.grade??'').normalize('NFKC').trim();
  if(!grade||['NoGrade','グレード未設定','未設定'].includes(grade))return {missing:true,label:'グレード未設定'};
  const dan=japaneseDanPoints(grade);
  const matches=catalogs.filter(c=>{
    if(record.discipline&&!Object.hasOwn(systems[record.discipline]||{},c.system))return false;
    if(record.gradeSystem)return record.gradeSystem===c.system;
    return c.ranks.has(grade)||(c.system==='日本（段級）'&&dan!==null);
  });
  const catalog=matches.length===1?matches[0]:null;
  const rank=catalog?.system==='日本（段級）'&&dan!==null?10+(dan-1)*2:catalog?.ranks.get(grade);
  return {grade,label:catalog?.system||record.gradeSystem||'体系未設定',group:catalog?.order??catalogs.length,rank:rank??Number.MAX_SAFE_INTEGER};
}

export const outdoorGradeGroup=record=>gradePosition(record).label;
export function compareOutdoorGrades(a,b){
  const x=gradePosition(a),y=gradePosition(b);
  if(x.missing||y.missing)return Number(Boolean(x.missing))-Number(Boolean(y.missing));
  return x.group-y.group||collator.compare(x.label,y.label)||x.rank-y.rank||
    (x.rank===Number.MAX_SAFE_INTEGER?collator.compare(x.grade,y.grade):0);
}
