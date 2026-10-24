export function prepareBodySettings(input,profile,history,updatedAt=new Date().toISOString()){
  const optional=(raw,name,max)=>{if(raw==null||String(raw).trim()==='')return null;const value=Number(raw);if(!Number.isFinite(value)||value<1||value>max)throw new Error(`${name}を正しい数値で入力してください。`);return value;};
  const nextProfile={...profile,heightCm:optional(input.heightCm,'身長',300),reachCm:optional(input.reachCm,'リーチ',400),updatedAt};
  const weight=optional(input.kg,'体重',500);
  if(weight===null)return {profile:nextProfile,history,weightChanged:false};
  const date=input.date;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('体重を記録する日付を入力してください。');
  const rows=history.filter(row=>row.date!==date).map(row=>({...row}));rows.push({date,kg:weight,createdAt:updatedAt});rows.sort((a,b)=>a.date.localeCompare(b.date));
  return {profile:nextProfile,history:rows,weightChanged:true};
}
