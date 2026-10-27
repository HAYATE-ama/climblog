export function createWeatherService({fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
 const cache=new Map(),pending=new Map();let generation=0;
 async function get(officeCode,{signal}={}){if(!/^\d{6}$/.test(officeCode))throw new Error('予報地域が不正です。');const entry=cache.get(officeCode);if(entry&&now()-entry.time<30*60000)return entry.data;if(pending.has(officeCode))return pending.get(officeCode);const epoch=generation;
  const request=(async()=>{const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,10000);try{const response=await fetchImpl('https://www.jma.go.jp/bosai/forecast/data/forecast/'+officeCode+'.json',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-cache'});if(!response.ok)throw new Error('予報を取得できませんでした。');const data=await response.json();if(!Array.isArray(data))throw new Error('予報の形式が変わった可能性があります。');if(epoch===generation)cache.set(officeCode,{time:now(),data});return data;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(epoch===generation)pending.delete(officeCode);}})();pending.set(officeCode,request);return request;
 }
 return {get,clear(){generation++;cache.clear();pending.clear();}};
}
