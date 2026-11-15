const danNames=['初','二','三','四','五','六','七','八','九','十'];
const withModifiers=label=>[label+'-',label,label+'+'];
const danPoints=new Map();
for(const [index,name] of danNames.entries()){
  for(const label of withModifiers(name+'段'))danPoints.set(label,index+1);
  const next=danNames[index+1];
  if(next)danPoints.set(name+'/'+next+'段',index+1.5);
}

export const boulderJapaneseGrades=[
  ...Array.from({length:10},(_,i)=>(10-i)+'級').flatMap(withModifiers),
  ...danPoints.keys()
];

// Normalize historical spellings for lookup while preserving the saved display label.
export function japaneseGradeKey(grade){
  const label=grade.normalize('NFKC').trim().replaceAll('−','-');
  return label.replace(/^([1-9]|10)段([+-]?)$/,(_,number,sign)=>danNames[Number(number)-1]+'段'+sign);
}

export function japaneseDanPoints(grade){
  return danPoints.get(japaneseGradeKey(grade))??null;
}
