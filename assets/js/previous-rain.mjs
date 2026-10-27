const jstDate=now=>new Date(Number(now)+9*3600000).toISOString().slice(0,10);
export const previousDate=date=>jstDate(Date.parse(date+'T00:00:00+09:00')-86400000);
export function parsePreviousRain(payload,stationCode,today){
 const key=today.replaceAll('-','')+'000000',row=payload?.[key],value=row?.precipitation24h;
 if(!/^\d{5}$/.test(stationCode)||String(row?.prefNumber).padStart(2,'0')+String(row?.observationNumber).padStart(3,'0')!==stationCode||!Array.isArray(value)||value[1]!==0||typeof value[0]!=='number'||!Number.isFinite(value[0])||value[0]<0)throw new Error('前日の降水量を確認できません。');
 return {date:previousDate(today),stationCode,amountMm:value[0],observedAt:today+'T00:00:00+09:00'};
}
