// Source: Cabinet Office holiday list, checked 2026-10-31.
// https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
// Do not extrapolate equinoxes or special holidays beyond verified years.
const dates={
 2026:'01-01 01-12 02-11 02-23 03-20 04-29 05-03 05-04 05-05 05-06 07-20 08-11 09-21 09-22 09-23 10-12 11-03 11-23',
 2027:'01-01 01-11 02-11 02-23 03-21 03-22 04-29 05-03 05-04 05-05 07-19 08-11 09-20 09-23 10-11 11-03 11-23'
};
export function japaneseHoliday(date){const year=Number(date.slice(0,4));return dates[year]?dates[year].split(' ').includes(date.slice(5)):null;}
export function siteAvailable(site,date){
 const weekday=new Date(date+'T12:00:00+09:00').getUTCDay(),holiday=japaneseHoliday(date);
 if(site.period==='weekend'&&holiday===true)return true;
 return site.weekdays.includes(weekday);
}
