// Use a first-of-month anchor so Jan 31 never jumps over February.
export function shiftCalendarMonth(date,delta){if(!(date instanceof Date)||!Number.isFinite(+date)||!Number.isInteger(delta))throw new Error('月の移動が不正です。');return new Date(date.getFullYear(),date.getMonth()+delta,1);}

// One pass per render instead of scanning the full history for each of 42 cells.
export function calendarRecordsByDate(records,kind='all'){
 const dates=new Map();for(const record of records){if(kind!=='all'&&record.kind!==kind)continue;let rows=dates.get(record.date);if(!rows){rows=[];dates.set(record.date,rows);}rows.push(record);}return dates;
}
