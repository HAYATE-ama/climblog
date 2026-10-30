// Suggestions use only the signed-in account's existing records; saved names are never merged.
const name=value=>typeof value==='string'?value.trim():'';
export function outdoorSuggestions(records,{crag='',area=''}={}){
 const rows=(Array.isArray(records)?records:[]).filter(r=>r?.kind==='outdoor').slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
 const unique=(items,limit)=>[...new Set(items.map(name).filter(Boolean))].slice(0,limit);
 const sameCrag=rows.filter(r=>name(r.cragName||r.place)===name(crag));
 return {crags:unique(rows.map(r=>r.cragName||r.place),3),areas:name(crag)?unique(sameCrag.map(r=>r.areaName),30):[],routes:name(crag)?unique(sameCrag.filter(r=>!name(area)||name(r.areaName)===name(area)).map(r=>r.routeName),50):[]};
}
export function installOutdoorInput(){
 const api=window.climbLogRecordApi,field=document.getElementById('cragName'),area=document.getElementById('areaName'),route=document.getElementById('routeName');
 const recent=document.createElement('div');recent.id='recentCrags';recent.className='recentCrags';recent.hidden=true;recent.setAttribute('role','group');recent.setAttribute('aria-label','最近の岩場');field.after(recent);
 const lists={};for(const [control,id]of [[area,'outdoorAreaSuggestions'],[route,'outdoorRouteSuggestions']]){const list=document.createElement('datalist');list.id=id;control.setAttribute('list',id);control.after(list);lists[id]=list;}
 let records=[],locked=false;
 function render(rebuild=false){if(locked)return;const values=outdoorSuggestions(records,{crag:field.value,area:area.value});
  recent.hidden=!values.crags.length;
  if(rebuild){recent.replaceChildren();if(values.crags.length){const label=document.createElement('small');label.textContent='最近の岩場';recent.append(label);for(const crag of values.crags){const button=document.createElement('button');button.type='button';button.textContent=crag;button.title=crag;button.setAttribute('aria-pressed',String(name(field.value)===crag));button.onclick=()=>{field.value=crag;field.dispatchEvent(new Event('input',{bubbles:true}));};recent.append(button);}}}
  for(const button of recent.querySelectorAll('button'))button.setAttribute('aria-pressed',String(name(field.value)===button.textContent));
  for(const [id,key]of [['outdoorAreaSuggestions','areas'],['outdoorRouteSuggestions','routes']])lists[id].replaceChildren(...values[key].map(value=>new Option(value,value)));
 }
 window.addEventListener('climblog:recordOpened',()=>{locked=false;records=api.getRecords();render(true);});
 window.addEventListener('climblog:formRestored',()=>render());
 for(const input of [field,area])input.addEventListener('input',()=>render());
 window.addEventListener('climblog:authLock',()=>{locked=true;records=[];recent.replaceChildren();recent.hidden=true;for(const list of Object.values(lists))list.replaceChildren();});
}
