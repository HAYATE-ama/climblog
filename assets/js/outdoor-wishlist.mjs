import {installOutdoorGradePicker} from './outdoor-grade-picker.mjs';
import {preferredOutdoorSystem,withOutdoorGradeFormat,toyotaGradeSystem} from './outdoor-grades.mjs';
import {outdoorProblemKey} from './outdoor-season.mjs';
import {addOutdoorWish} from './outdoor-wishlist-model.mjs';
import {outdoorRouteLibrary,filterOutdoorRoutes} from './outdoor-route-library.mjs';
import {getTopoPhoto} from './outdoor-topo-store.mjs';
import {escapeHtml as esc} from './data-utils.mjs';

const resultNames={attempt:'敗退',send:'完登',flash:'フラッシュ',redpoint:'レッドポイント',onsight:'オンサイト'};
const stateNames={new:'未トライ',recorded:'記録あり',trying:'挑戦中',sent:'完登'};
const mountain='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 20 8 5l4 7 4-5 5 13Z"/></svg>';
const gradeText=p=>[p.gradeSystem===toyotaGradeSystem?'豊田式':'',p.outdoorGrade==='グレード未設定'?'':p.outdoorGrade].filter(Boolean).join(' ')||'グレード未設定';
const resultText=r=>r.ascentType==='repeat'&&r.result!=='attempt'?'再登':resultNames[r.result]||'結果未設定';

export function installOutdoorWishlist(){
 const records=window.climbLogRecordApi,api=window.climbLogStateApi,entry=document.getElementById('openOutdoorWishlist');
 const wishes=()=>api.get().outdoorWishlist||[],facts=()=>outdoorRouteLibrary(api.get());
 const dialog=document.createElement('dialog');dialog.id='outdoorWishlist';dialog.setAttribute('aria-labelledby','wishTitle');
 dialog.innerHTML=`<header class="wishHead"><button type="button" data-back hidden aria-label="課題一覧に戻る">‹ 戻る</button><h2 id="wishTitle">外岩の課題</h2><button type="button" data-close aria-label="閉じる">×</button></header>
 <div class="wishBody"><section data-screen="list">
 <p class="wishIntro">登りたい課題も、登った課題もここに。</p><label class="wishSearch"><input type="search" data-search placeholder="課題名・岩場で検索" aria-label="課題名・岩場で検索"></label>
 <div class="wishToolbar"><label><select data-crag aria-label="岩場で絞り込む"></select></label><button type="button" class="wishAdd" data-add>＋ 追加</button></div>
 <div class="wishFilters" role="group" aria-label="課題の絞り込み"><button type="button" data-filter="all" aria-pressed="true">すべて</button><button type="button" data-filter="wish" aria-pressed="false">登りたい</button><button type="button" data-filter="trying" aria-pressed="false">挑戦中</button><button type="button" data-filter="sent" aria-pressed="false">完登</button></div>
 <p class="wishCount" data-count role="status"></p><div class="wishRoutes"><div data-active></div><button type="button" data-more hidden>さらに30課題を表示</button><div class="wishEmpty" data-empty hidden><p></p><button type="button" data-clear>絞り込みを解除</button></div><p class="wishUnnamed" data-unnamed hidden></p></div></section>
 <form data-screen="add" hidden><label>岩場<input name="cragName" list="wishCrags" required maxlength="120" placeholder="例：西の河原"></label><datalist id="wishCrags"></datalist><label>課題名<input name="routeName" required maxlength="160" placeholder="例：ウグイ"></label><label>グレード（任意）<select name="outdoorGrade"></select></label>
 <details><summary>エリア・種目・グレード体系</summary><label>エリア・岩（任意）<input name="areaName" maxlength="120"></label><label>種目<select name="discipline"><option value="boulder">ボルダー</option><option value="lead">リード</option></select></label><label>グレード体系<select name="gradeSystem"></select></label></details><p class="wishIntro">追加した課題は「登りたい」に入ります。</p><button type="submit" class="wishPrimary">一覧に追加</button></form>
 <section data-screen="detail" hidden><p class="wishLocation" data-place></p><div class="wishDetailTitle"><h3 data-name></h3><button type="button" class="wishStar" data-toggle-wish></button></div><div class="wishOverview" data-overview></div><button type="button" class="wishPrimary wishLog" data-log>＋ この課題を記録</button>
 <section class="wishDetailCard"><h4>写真・トポ</h4><button type="button" class="wishPhotoLink" data-topo aria-haspopup="dialog" aria-controls="outdoorTopo"></button><div data-other-topos></div></section><section class="wishDetailCard"><h4>この課題の記録</h4><div data-history></div><button type="button" data-more-history hidden>さらに10件を表示</button></section><label class="wishPriority" hidden><input type="checkbox" data-priority>優先して取り組む</label><button type="button" class="wishRemove" data-remove>登りたい課題から外す</button></section>
 <p class="wishStatus" aria-live="polite" role="status"></p></div>`;
 document.body.append(dialog);
 const get=s=>dialog.querySelector(s),form=get('form'),fields=form.elements,filter=get('[data-crag]'),search=get('[data-search]'),status=get('.wishStatus'),body=get('.wishBody'),routes=get('.wishRoutes');
 let screen='list',selectedKey=null,returnTo=null,locked=false,writing=false,listScrollTop=0,addBaseline='',statusFilter='all',limit=30,historyLimit=10,photoEpoch=0,photoUrls=[];
 const selected=()=>facts().routes.find(r=>r.key===selectedKey);
 const write=patch=>{writing=true;try{api.apply(patch);}finally{writing=false;}};
 const thumbJobs=new WeakMap();
 const thumbObserver=new IntersectionObserver(entries=>{for(const item of entries)if(item.isIntersecting){thumbObserver.unobserve(item.target);thumbJobs.get(item.target)?.();}},{root:routes,rootMargin:'80px'});
 const releasePhotos=()=>{photoEpoch++;thumbObserver.disconnect();for(const url of photoUrls)URL.revokeObjectURL(url);photoUrls=[];};
 const gradePicker=installOutdoorGradePicker({select:fields.outdoorGrade,system:fields.gradeSystem,discipline:fields.discipline,crag:fields.cragName,setSystem:value=>{fields.gradeSystem.value=value;setGrades();},getPreferences:()=>api.get().preferences});
 const addSnapshot=()=>JSON.stringify([...new FormData(form)]);
 const mayLeaveAdd=()=>screen!=='add'||addSnapshot()===addBaseline||confirm('未保存の課題があります。入力を破棄しますか？');
 function show(next){
  if(screen==='list'&&next!=='list')listScrollTop=routes.scrollTop;
  screen=next;for(const pane of dialog.querySelectorAll('[data-screen]'))pane.hidden=pane.dataset.screen!==next;
  get('#wishTitle').textContent={list:'外岩の課題',add:'課題を追加',detail:'課題の詳細'}[next];get('[data-back]').hidden=next==='list';status.textContent='';body.scrollTop=0;
 }
 function star(button,fact){button.textContent=fact.wish?'★':'☆';button.setAttribute('aria-pressed',String(Boolean(fact.wish)));button.setAttribute('aria-label',fact.problem.routeName+'を登りたい課題'+(fact.wish?'から外す':'に入れる'));}
 function thumbnail(link){return '<span class="wishThumb'+(link?' hasPhoto':'')+'">'+mountain+(link?'<span>トポ</span>':'')+'</span>';}
 function loadThumb(element,link){
  if(!link)return;const epoch=photoEpoch;
  const load=()=>getTopoPhoto(window.climbLogAccountId,link.photoId).then(blob=>{if(!blob||epoch!==photoEpoch||!dialog.open||!element.isConnected)return;const url=URL.createObjectURL(blob);photoUrls.push(url);const image=new Image();image.alt='';image.src=url;image.onerror=()=>image.remove();element.prepend(image);}).catch(()=>{});
  if(screen==='list'){thumbJobs.set(element,load);thumbObserver.observe(element);}else load();
 }
 function makeRow(fact){
  const p=fact.problem,row=document.createElement('div');row.className='wishRow';row.dataset.routeKey=fact.key;if(fact.wish)row.dataset.wishId=fact.wish.id;
  row.innerHTML='<button type="button" class="wishRoute" data-action="detail">'+thumbnail(fact.topos[0])+'<span class="wishRouteText"><strong>'+esc(p.routeName)+'</strong><small>'+esc([p.cragName,p.areaName,p.discipline==='lead'?'リード':'',gradeText(p)].filter(Boolean).join(' · '))+'</small><span class="wishRowMeta"><span class="wishBadge '+fact.status+'">'+(fact.status==='sent'?'✓ ':'')+stateNames[fact.status]+'</span><span>'+esc(fact.latest?.date?.slice(5).replace('-','/')||'')+'</span>'+(fact.wish?.starred?'<span>優先</span>':'')+'</span></span></button><button type="button" class="wishStar" data-action="wish"></button>';
  row.querySelector('.wishRoute').setAttribute('aria-label',[p.routeName,gradeText(p),'詳細'].join(' '));star(row.querySelector('.wishStar'),fact);loadThumb(row.querySelector('.wishThumb'),fact.topos[0]);return row;
 }
 function drawList(preferred=filter.value){
  releasePhotos();const {routes:all,unnamedRecords}=facts(),crags=[...new Set(all.map(r=>r.problem.cragName))].sort((a,b)=>a.localeCompare(b,'ja'));
  filter.replaceChildren(new Option('すべての岩場',''),...crags.map(c=>new Option(c,c)));filter.value=crags.includes(preferred)?preferred:'';
  const visible=filterOutdoorRoutes(all,{crag:filter.value,status:statusFilter,query:search.value});get('[data-active]').replaceChildren(...visible.slice(0,limit).map(makeRow));
  for(const button of dialog.querySelectorAll('[data-filter]'))button.setAttribute('aria-pressed',String(button.dataset.filter===statusFilter));
  get('[data-count]').textContent=visible.length>limit?visible.length+'課題中 '+limit+'課題を表示':visible.length+'課題';get('[data-more]').hidden=visible.length<=limit;
  get('[data-empty]').hidden=!!visible.length;get('[data-empty] p').textContent=all.length?'条件に合う課題がありません。':'「＋ 追加」から登りたい課題を登録できます。課題名付きの外岩記録もここに表示します。';get('[data-clear]').hidden=!all.length;
  get('[data-unnamed]').hidden=!unnamedRecords;get('[data-unnamed]').textContent='岩場・課題名が未設定の記録 '+unnamedRecords+'件は、カレンダーから確認できます。';
 }
 function focusRoute(key){const button=[...dialog.querySelectorAll('.wishRow')].find(el=>el.dataset.routeKey===key)?.querySelector('.wishRoute');(button||get('[data-add]')).focus({preventScroll:true});}
 function openList(reset=false){if(reset){filter.value='';search.value='';statusFilter='all';limit=30;selectedKey=null;returnTo=null;listScrollTop=0;}show('list');if(!dialog.open)dialog.showModal();drawList();routes.scrollTop=listScrollTop;}
 function detail(fact,{focus=true}={}){
  if(!fact){openList();return;}releasePhotos();selectedKey=fact.key;const p=fact.problem;if(screen!=='detail')show('detail');
  get('[data-place]').textContent=[p.cragName,p.areaName,p.discipline==='lead'?'リード':'',gradeText(p)].filter(Boolean).join(' · ');get('[data-name]').textContent=p.routeName;star(get('[data-toggle-wish]'),fact);
  get('[data-overview]').innerHTML='<span class="wishBadge '+fact.status+'">'+stateNames[fact.status]+'</span><span>記録 '+fact.days+'日</span><span>完登 '+fact.sendDays+'日</span>';
  const photo=get('[data-topo]');photo.innerHTML=thumbnail(fact.topos[0])+'<span>'+(fact.topos.length?'写真・トポを開く':'写真・トポを追加')+'<small>'+(fact.topos.length?fact.topos.length+'枚の紐付け':'自分の写真にラインを残せます')+'</small></span><span aria-hidden="true">›</span>';loadThumb(photo.querySelector('.wishThumb'),fact.topos[0]);
  const firstKey=outdoorProblemKey(fact.topos[0]?.problem||p),extra=[...new Map(fact.topos.filter(t=>outdoorProblemKey(t.problem)!==firstKey).map(t=>[outdoorProblemKey(t.problem),t])).values()];
  get('[data-other-topos]').replaceChildren(...extra.map(t=>{const b=document.createElement('button');b.type='button';b.textContent=[t.problem.areaName,'の写真・トポ'].join('');b.onclick=()=>window.climbLogTopos.open(t.problem,b);return b;}));
  const history=get('[data-history]');history.replaceChildren();
  for(const [index,row] of fact.records.slice(0,historyLimit).entries()){const button=document.createElement('button');button.type='button';button.className='wishHistory';button.dataset.history=row.id;button.innerHTML='<span'+(index===0?' data-last':'')+'><time>'+esc(String(row.date||'日付未設定').replaceAll('-','/'))+'</time><span>'+esc(resultText(row))+'</span></span>'+(row.memo?'<p'+(index===0?' data-memo':'')+'>'+esc(row.memo)+'</p>':'')+'<small>記録の詳細・編集 ›</small>';history.append(button);}
  if(!fact.records.length){const empty=document.createElement('p');empty.className='wishIntro';empty.textContent='まだ実施記録はありません。';history.append(empty);}
  get('[data-more-history]').hidden=fact.records.length<=historyLimit;get('[data-remove]').hidden=!fact.wish;get('.wishPriority').hidden=!fact.wish;get('[data-priority]').checked=Boolean(fact.wish?.starred);if(focus)get('[data-back]').focus({preventScroll:true});
 }
 function beginRecord(key){const fact=facts().routes.find(r=>r.key===key);if(!fact)return;if(screen==='list')listScrollTop=routes.scrollTop;returnTo={key,screen};dialog.close();records.open('outdoor',null,null,fact.wish?.id||null,fact.problem);}
 function returnFromRecord(saved){if(!returnTo)return;const destination=returnTo;returnTo=null;queueMicrotask(()=>{if(locked)return;openList();const fact=facts().routes.find(r=>r.key===destination.key);if(destination.screen==='detail'&&fact)detail(fact);else focusRoute(destination.key);if(saved)status.textContent='記録を保存しました。';});}
 function toggleWish(fact){
  if(fact.wish&&!confirm('登りたい課題から外しますか？ 実施記録と写真は残ります。'))return;
  try{write({outdoorWishlist:fact.wish?wishes().filter(w=>w.id!==fact.wish.id):addOutdoorWish(wishes(),fact.problem)});if(screen==='detail')detail(selected(),{focus:false});else{const top=routes.scrollTop;drawList();routes.scrollTop=top;focusRoute(fact.key);}status.textContent=fact.wish?'登りたい課題から外しました。':'登りたい課題に追加しました。';}catch(error){status.textContent=error.message;}
 }
 function setGrades(){fields.outdoorGrade.replaceChildren(new Option('未設定',''),...records.gradeOptionsFor(fields.discipline.value,fields.gradeSystem.value).map(v=>new Option(v,v)));gradePicker.sync({reset:true});}
 function setSystems(){fields.gradeSystem.replaceChildren(...records.gradeSystemsFor(fields.discipline.value).map(v=>new Option(v,v)));fields.gradeSystem.value=preferredOutdoorSystem(fields.cragName.value,fields.discipline.value,api.get().preferences);setGrades();gradePicker.reset();}
 function beginAdd(){
  form.reset();form.querySelector('details').open=false;fields.cragName.value=filter.value;
  const crags=new Set([...facts().routes.map(r=>r.problem.cragName),...records.getRecords().filter(r=>r.kind==='outdoor').map(r=>r.cragName||r.place)].filter(c=>c&&c!=='未設定'));
  get('#wishCrags').replaceChildren(...[...crags].sort().map(c=>new Option(c,c)));setSystems();addBaseline=addSnapshot();show('add');fields.cragName.focus();
 }
 function back(){if(!mayLeaveAdd())return;show('list');drawList();routes.scrollTop=listScrollTop;focusRoute(selectedKey);}
 entry.onclick=()=>{if(!locked)openList(true);};
 dialog.addEventListener('close',()=>{releasePhotos();if(!locked&&!returnTo&&!dialog.open&&entry.getClientRects().length)entry.focus({preventScroll:true});});
 get('[data-close]').onclick=()=>{if(mayLeaveAdd())dialog.close();};get('[data-back]').onclick=back;get('[data-add]').onclick=beginAdd;
 const refilter=()=>{limit=30;drawList();routes.scrollTop=0;status.textContent='';};filter.onchange=refilter;search.oninput=refilter;
 get('[data-clear]').onclick=()=>{filter.value='';search.value='';statusFilter='all';refilter();search.focus();};get('[data-more]').onclick=()=>{const top=routes.scrollTop;limit+=30;drawList();routes.scrollTop=top;};fields.discipline.onchange=setSystems;fields.gradeSystem.onchange=setGrades;
 form.onsubmit=event=>{event.preventDefault();try{const next=addOutdoorWish(wishes(),Object.fromEntries(new FormData(form))),added=next.at(-1);write({outdoorWishlist:next,preferences:withOutdoorGradeFormat(api.get().preferences,added)});statusFilter='all';search.value='';limit=30;show('list');drawList(added.cragName);focusRoute(outdoorProblemKey(added));status.textContent=added.routeName+'を追加しました。';}catch(error){status.textContent=error.message;}};
 dialog.addEventListener('cancel',event=>{if(screen!=='list'){event.preventDefault();back();}});
 dialog.addEventListener('click',event=>{
  const filterButton=event.target.closest('[data-filter]');if(filterButton){statusFilter=filterButton.dataset.filter;refilter();return;}
  const history=event.target.closest('[data-history]');if(history){records.view(history.dataset.history,history);return;}
  const button=event.target.closest('[data-action]');if(!button)return;const key=button.closest('.wishRow')?.dataset.routeKey,fact=facts().routes.find(r=>r.key===key);if(!fact)return;if(button.dataset.action==='detail'){historyLimit=10;detail(fact);}else toggleWish(fact);
 });
 get('[data-log]').onclick=()=>beginRecord(selectedKey);get('[data-toggle-wish]').onclick=()=>{const fact=selected();if(fact)toggleWish(fact);};get('[data-remove]').onclick=get('[data-toggle-wish]').onclick;
 get('[data-topo]').onclick=()=>{const fact=selected();if(fact)window.climbLogTopos.open(fact.topos[0]?.problem||fact.problem,get('[data-topo]'));};get('[data-more-history]').onclick=()=>{historyLimit+=10;const top=body.scrollTop;detail(selected(),{focus:false});body.scrollTop=top;};
 get('[data-priority]').onchange=()=>{const fact=selected();if(!fact?.wish)return;try{write({outdoorWishlist:wishes().map(w=>w.id===fact.wish.id?{...w,starred:get('[data-priority]').checked}:w)});}catch(error){get('[data-priority]').checked=fact.wish.starred;status.textContent=error.message;}};
 document.getElementById('cancel').addEventListener('click',()=>returnFromRecord(false));window.addEventListener('climblog:recordSaved',()=>returnFromRecord(true));window.addEventListener('climblog:recordOpened',()=>{if(dialog.open){returnTo={key:selectedKey,screen};dialog.close();}});
 window.addEventListener('climblog:stateChanged',()=>{if(!dialog.open||writing||screen==='add')return;const top=body.scrollTop,listTop=routes.scrollTop;if(screen==='detail')detail(selected(),{focus:false});else drawList();body.scrollTop=top;routes.scrollTop=listTop;});
 window.addEventListener('climblog:authLock',()=>{locked=true;returnTo=selectedKey=null;if(dialog.open)dialog.close();form.reset();for(const selector of ['[data-active]','[data-history]','[data-place]','[data-name]','[data-overview]','[data-topo]','[data-other-topos]','#wishCrags','[data-crag]','.wishStatus'])get(selector).replaceChildren();search.value='';});
 return {contains(record){const key=outdoorProblemKey(record);return Boolean(key&&facts().routes.some(r=>r.wish&&(r.key===key||r.records.some(row=>row.id===record.id))));},addRecord(record){write({outdoorWishlist:addOutdoorWish(wishes(),record)});}};
}
