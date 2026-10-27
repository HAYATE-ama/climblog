// Use a first-of-month anchor so Jan 31 never jumps over February.
export function shiftCalendarMonth(date,delta){if(!(date instanceof Date)||!Number.isFinite(+date)||!Number.isInteger(delta))throw new Error('月の移動が不正です。');return new Date(date.getFullYear(),date.getMonth()+delta,1);}
