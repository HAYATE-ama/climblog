const danNames=['初','二','三','四','五','六','七','八','九','十'];
const danPoints=new Map();
for(const [index,name] of danNames.entries()){
  danPoints.set(name+'段',index+1);
  const next=danNames[index+1];
  if(next)danPoints.set(name+'/'+next+'段',index+1.5);
}

export const boulderJapaneseGrades=[
  ...Array.from({length:10},(_,i)=>(10-i)+'級'),
  ...danPoints.keys()
];

export function japaneseDanPoints(grade){
  const label=grade.normalize('NFKC').trim();
  if(danPoints.has(label))return danPoints.get(label);
  const numeric=label.match(/^([1-9]|10)段$/);
  return numeric?Number(numeric[1]):null;
}
