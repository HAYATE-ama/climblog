import {getRainStation} from './jma-rain-stations.mjs';
import {getJmaRegion} from './jma-regions.mjs';
export const outdoorPrefectures=Object.freeze('北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' '));
export const defaultOutdoorSettings=()=>({cragName:'',prefecture:'',weekdays:[0,6],startTime:'09:00',endTime:'16:00'});
export function validateOutdoorSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('外岩の候補日の形式が不正です。');
 if(typeof value.cragName!=='string'||value.cragName.trim().length>100||/[\u0000-\u001f\u007f]/.test(value.cragName))throw new Error('岩場名は100文字以内で入力してください。');
 if(typeof value.prefecture!=='string'||value.prefecture!==''&&!outdoorPrefectures.includes(value.prefecture))throw new Error('都道府県を選択してください。');
 if(!Array.isArray(value.weekdays)||value.weekdays.length>7||value.weekdays.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(value.weekdays).size!==value.weekdays.length)throw new Error('曜日の形式が不正です。');
 const time=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 if(!time(value.startTime)||!time(value.endTime)||value.startTime>=value.endTime)throw new Error('終了時刻は開始時刻より後にしてください（日付をまたぐ時間帯は対象外です）。');
 const forecastAreaCode=value.forecastAreaCode??'';
 if(typeof forecastAreaCode!=='string'||forecastAreaCode!==''&&getJmaRegion(forecastAreaCode)?.prefecture!==value.prefecture)throw new Error('都道府県に合う予報地域を選択してください。');
 const rainStationCode=value.rainStationCode??'';
 if(typeof rainStationCode!=='string'||rainStationCode!==''&&getRainStation(rainStationCode)?.prefecture!==value.prefecture)throw new Error('都道府県に合う雨の観測地点を選択してください。');
 const maxPreviousRainMm=value.maxPreviousRainMm;
 if(maxPreviousRainMm!=null&&(!Number.isFinite(maxPreviousRainMm)||![0,1,3,5].includes(maxPreviousRainMm)))throw new Error('前日の雨量の条件を選択してください。');
 const cragName=value.cragName.trim();
 if(cragName&&(!value.prefecture||!value.weekdays.length))throw new Error('都道府県と、行ける曜日を1つ以上選択してください。');
 return {cragName,prefecture:value.prefecture,weekdays:[...value.weekdays].sort((a,b)=>a-b),startTime:value.startTime,endTime:value.endTime,...(forecastAreaCode?{forecastAreaCode}: {}),...(rainStationCode?{rainStationCode}:{}),...(maxPreviousRainMm!=null?{maxPreviousRainMm}:{})};
}
export function readOutdoorSettings(preferences){try{return validateOutdoorSettings(preferences?.outdoorPlanning);}catch{return defaultOutdoorSettings();}}
