import {boulderJapaneseGrades,japaneseGradeKey} from './japanese-boulder-grades.mjs';

export const toyotaGradeSystem='豊田式（a・b・c…）';
export const toyotaGrades=['a','b','c','d','e','f','g'];
const cragKey=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');
export function preferredOutdoorSystem(crag,discipline,preferences={}){
 const saved=preferences.outdoorGradeFormats?.find(row=>cragKey(row.cragName)===cragKey(crag)&&row.discipline===discipline);
 if(saved&&gradeSystemsFor(discipline).includes(saved.system))return saved.system;
 if(discipline==='boulder'&&['豊田','豊田ボルダー','豊田ボルダリング','豊田市'].includes(cragKey(crag)))return toyotaGradeSystem;
 return gradeSystemsFor(discipline)[0]||'';
}
export function withOutdoorGradeFormat(preferences,record){
 const cragName=cragKey(record.cragName||record.place),discipline=record.discipline||'boulder',system=record.gradeSystem;
 if(!cragName||cragName==='未設定'||!gradeSystemsFor(discipline).includes(system))return preferences;
 const rows=preferences.outdoorGradeFormats||[];
 return {...preferences,outdoorGradeFormats:[...rows.filter(row=>cragKey(row.cragName)!==cragName||row.discipline!==discipline),{cragName,discipline,system}]};
}
export function validateOutdoorGradeFormats(rows){
 if(!Array.isArray(rows))throw new Error('岩場のグレード形式を確認してください。');
 const seen=new Set();for(const row of rows){
  if(!row||typeof row.cragName!=='string'||!cragKey(row.cragName)||!gradeSystemsFor(row.discipline).includes(row.system))throw new Error('岩場のグレード形式が不正です。');
  const key=JSON.stringify([cragKey(row.cragName),row.discipline]);if(seen.has(key))throw new Error('岩場のグレード形式が重複しています。');seen.add(key);
 }
}

const vScaleGrades=Array.from({length:18},(_,i)=>[`V${i}-`,`V${i}`,`V${i}+`]).flat();
const fontScaleGrades=["3","3+","4","4+","5","5+",...Array.from({length:4},(_,i)=>["A","B","C"].flatMap(letter=>{const band=6+i;return [`${band}${letter}`,`${band}${letter}+`]}))];
const frenchGrades=["3","3+",...Array.from({length:5},(_,i)=>["a","b","c"].flatMap(letter=>{const band=i+4;return [`${band}${letter}`,`${band}${letter}+`]})),"9a","9a+","9b","9b+","9c"];
const ydsGrades=[...Array.from({length:10},(_,i)=>`5.${i}`),...Array.from({length:6},(_,i)=>{const band=i+10;return [`5.${band}`,...(["a","b","c","d"].map(letter=>`5.${band}${letter}`))]}).flat()];
const romanGrades=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
const uiaaGrades=romanGrades.flatMap(g=>[`${g}-`,g,`${g}+`]);

const systems={
  boulder:{'日本（段級）':boulderJapaneseGrades,'V Scale':vScaleGrades,Fontainebleau:fontScaleGrades.flat(),[toyotaGradeSystem]:toyotaGrades},
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
  const keyFor=c=>c.system==='日本（段級）'?japaneseGradeKey(grade):grade;
  const matches=catalogs.filter(c=>{
    if(record.discipline&&!Object.hasOwn(systems[record.discipline]||{},c.system))return false;
    if(record.gradeSystem)return record.gradeSystem===c.system;
    return c.system!==toyotaGradeSystem&&c.ranks.has(keyFor(c));
  });
  const catalog=matches.length===1?matches[0]:null;
  const toyotaMatch=catalog?.system===toyotaGradeSystem&&/^([a-z])([+-]?)$/.exec(grade);
  const rank=toyotaMatch?(toyotaMatch[1].charCodeAt(0)-97)*3+({'-':0,'':1,'+':2}[toyotaMatch[2]]):catalog?.ranks.get(keyFor(catalog));
  return {grade,label:catalog?.system||record.gradeSystem||'体系未設定',group:catalog?.order??catalogs.length,rank:rank??Number.MAX_SAFE_INTEGER};
}

export const outdoorGradeGroup=record=>gradePosition(record).label;
export function compareOutdoorGrades(a,b){
  const x=gradePosition(a),y=gradePosition(b);
  if(x.missing||y.missing)return Number(Boolean(x.missing))-Number(Boolean(y.missing));
  return x.group-y.group||collator.compare(x.label,y.label)||x.rank-y.rank||
    (x.rank===Number.MAX_SAFE_INTEGER?collator.compare(x.grade,y.grade):0);
}
