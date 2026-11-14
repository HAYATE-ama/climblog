import {readCollection} from './account-storage.mjs';
import {outdoorProblemKey} from './outdoor-season.mjs';
import {addOutdoorWish,wishlistEntries} from './outdoor-wishlist-model.mjs';

const resultNames={attempt:'敗退',send:'完登',flash:'フラッシュ',redpoint:'レッドポイント',onsight:'オンサイト'};
const heading=(name,text)=>Object.assign(document.createElement(name),{textContent:text});

export function installOutdoorWishlist(){
  const records=window.climbLogRecordApi;
  const entry=document.getElementById('openOutdoorWishlist');
  const wishes=()=>readCollection(localStorage,'outdoorWishlist');
  const write=next=>window.climbLogStateApi.apply({outdoorWishlist:next});
  const dialog=document.createElement('dialog');
  dialog.id='outdoorWishlist';dialog.setAttribute('aria-labelledby','wishTitle');
  dialog.innerHTML=`
    <header class="wishHead"><button type="button" data-back hidden aria-label="課題リストに戻る">‹ 戻る</button><h2 id="wishTitle">登りたい課題</h2><button type="button" data-close aria-label="閉じる">×</button></header>
    <div class="wishBody">
      <section data-screen="list">
        <div class="wishToolbar"><label>岩場<select data-crag></select></label><button type="button" class="wishAdd" data-add>＋ 追加</button></div>
        <div class="wishRoutes">
          <div data-active></div>
          <details data-finished><summary></summary><div data-finished-rows></div></details>
        </div>
      </section>
      <form data-screen="add" hidden>
        <label>岩場<input name="cragName" list="wishCrags" required maxlength="120" placeholder="例：西の河原"></label><datalist id="wishCrags"></datalist>
        <label>課題名<input name="routeName" required maxlength="160" placeholder="例：ウグイ"></label>
        <label>グレード（任意）<select name="outdoorGrade"></select></label>
        <details><summary>エリア・種目・グレード体系</summary>
          <label>エリア・岩（任意）<input name="areaName" maxlength="120"></label>
          <label>種目<select name="discipline"><option value="boulder">ボルダー</option><option value="lead">リード</option></select></label>
          <label>グレード体系<select name="gradeSystem"></select></label>
        </details>
        <button type="submit" class="wishPrimary">リストに追加</button>
      </form>
      <section data-screen="detail" hidden>
        <p class="wishLocation" data-place></p><h3 data-name></h3>
        <section class="wishMemo"><h4>前回のトライ</h4><p data-last></p><p data-memo></p></section>
        <button type="button" class="wishPrimary" data-log>記録する</button>
        <button type="button" class="wishRemove" data-remove>リストから外す</button>
      </section>
      <p class="wishStatus" aria-live="polite" role="status"></p>
    </div>`;
  document.body.append(dialog);
  const get=selector=>dialog.querySelector(selector);
  const form=get('form'),fields=form.elements,filter=get('[data-crag]'),status=get('.wishStatus');
  const body=get('.wishBody'),routes=get('.wishRoutes');
  let screen='list',selectedId=null,returnId=null,locked=false,listScrollTop=0;
  const facts=()=>wishlistEntries(wishes(),records.getRecords());
  function show(next){
    if(screen==='list'&&next!=='list')listScrollTop=routes.scrollTop;
    screen=next;
    for(const pane of dialog.querySelectorAll('[data-screen]'))pane.hidden=pane.dataset.screen!==next;
    get('#wishTitle').textContent={list:'登りたい課題',add:'課題を追加',detail:'課題の詳細'}[next];
    get('[data-back]').hidden=next==='list';status.textContent='';
    body.scrollTop=0;
  }
  function makeRow({wish}){
    const row=document.createElement('div');row.className='wishRow';row.dataset.wishId=wish.id;
    row.innerHTML='<button type="button" class="wishStar" data-action="star"></button><button type="button" class="wishRoute" data-action="detail"><strong></strong><small></small></button><button type="button" class="wishLog" data-action="log">記録する</button>';
    const star=row.querySelector('.wishStar'),route=row.querySelector('.wishRoute');
    star.textContent=wish.starred?'★':'☆';star.setAttribute('aria-pressed',String(wish.starred));
    star.setAttribute('aria-label',wish.routeName+'を優先する');
    route.querySelector('strong').textContent=wish.routeName;route.querySelector('small').textContent=wish.outdoorGrade;
    route.setAttribute('aria-label',[wish.routeName,wish.outdoorGrade,wish.areaName,'詳細'].filter(Boolean).join(' '));
    row.querySelector('.wishLog').setAttribute('aria-label',wish.routeName+'を記録する');
    return row;
  }
  function groups(container,items,showCrag){
    container.replaceChildren();let lastCrag=null;
    for(const item of items){
      if(showCrag && lastCrag!==item.wish.cragName)container.append(heading('h3',item.wish.cragName));
      container.append(makeRow(item));lastCrag=item.wish.cragName;
    }
  }
  function drawList(preferred=filter.value){
    const all=facts(),crags=[...new Set(all.map(({wish})=>wish.cragName))];
    filter.replaceChildren(new Option('すべての岩場',''),...crags.map(c=>new Option(c,c)));
    filter.value=crags.includes(preferred)?preferred:'';
    const visible=all.filter(({wish})=>!filter.value||wish.cragName===filter.value);
    const pending=visible.filter(f=>!f.done),finished=visible.filter(f=>f.done);
    groups(get('[data-active]'),pending,!filter.value);
    if(!pending.length)get('[data-active]').append(heading('p',all.length?'この岩場に未完登の課題はありません。':'登りたい課題を「＋ 追加」から登録できます。'));
    get('[data-finished]').hidden=!finished.length;
    get('[data-finished] summary').textContent='完登済み（'+finished.length+'）';
    groups(get('[data-finished-rows]'),finished,!filter.value);
  }
  function focusWish(id,action='detail'){
    const row=[...dialog.querySelectorAll('.wishRow')].find(el=>el.dataset.wishId===id);
    const button=row?.querySelector('[data-action="'+action+'"]');
    if(button?.getClientRects().length){
      button.focus({preventScroll:true});
      button.scrollIntoView({block:'nearest'});
    }else get('[data-add]').focus({preventScroll:true});
  }
  function openList(){
    drawList();show('list');
    if(!dialog.open)dialog.showModal();
    routes.scrollTop=listScrollTop;
  }
  function detail(fact){
    selectedId=fact.wish.id;const {wish,latest}=fact;
    get('[data-place]').textContent=[wish.cragName,wish.areaName,wish.discipline==='lead'?'リード':'',wish.outdoorGrade].filter(Boolean).join(' · ');
    get('[data-name]').textContent=wish.routeName;
    get('[data-last]').textContent=latest?[latest.date.replaceAll('-','/'),resultNames[latest.result]].filter(Boolean).join(' · '):'まだ記録がありません';
    get('[data-memo]').textContent=latest?.memo||'';get('[data-memo]').hidden=!latest?.memo;
    show('detail');get('[data-back]').focus({preventScroll:true});
  }
  function beginRecord(id){
    if(!wishes().some(w=>w.id===id))return;
    if(screen==='list')listScrollTop=routes.scrollTop;
    dialog.close();returnId=id;
    records.open('outdoor',null,null,id);
  }
  function returnFromRecord(saved){
    if(!returnId)return;
    const id=returnId;returnId=null;
    queueMicrotask(()=>{
      if(locked)return;
      openList();
      if(saved){
        const fact=facts().find(f=>f.wish.id===id);
        if(fact?.done)get('[data-finished]').open=true;
        status.textContent=fact?.done?'記録を保存しました。完登済みに表示しています。':'トライを保存しました。';
      }
      focusWish(id);
    });
  }
  function setGrades(){
    fields.outdoorGrade.replaceChildren(new Option('未設定',''),...records.gradeOptionsFor(fields.discipline.value,fields.gradeSystem.value).map(v=>new Option(v,v)));
  }
  function setSystems(){
    fields.gradeSystem.replaceChildren(...records.gradeSystemsFor(fields.discipline.value).map(v=>new Option(v,v)));setGrades();
  }
  function beginAdd(){
    selectedId=null;form.reset();form.querySelector('details').open=false;fields.cragName.value=filter.value;
    const crags=new Set(wishes().map(w=>w.cragName));
    for(const r of records.getRecords())if(r.kind==='outdoor'&&(r.cragName||r.place))crags.add(r.cragName||r.place);
    crags.delete('未設定');get('#wishCrags').replaceChildren(...[...crags].sort().map(c=>new Option(c,c)));
    setSystems();show('add');fields.cragName.focus();
  }
  function back(){
    show('list');drawList();
    routes.scrollTop=listScrollTop;
    focusWish(selectedId);
  }
  entry.onclick=()=>{selectedId=null;listScrollTop=0;openList();};
  dialog.addEventListener('close',()=>{
    if(!locked&&!returnId&&!dialog.open&&entry.getClientRects().length)entry.focus({preventScroll:true});
  });
  get('[data-close]').onclick=()=>dialog.close();get('[data-back]').onclick=back;
  get('[data-add]').onclick=beginAdd;
  filter.onchange=()=>{drawList();status.textContent='';};
  fields.discipline.onchange=setSystems;fields.gradeSystem.onchange=setGrades;
  form.onsubmit=event=>{
    event.preventDefault();
    try{
      const next=addOutdoorWish(wishes(),Object.fromEntries(new FormData(form)));
      write(next);show('list');drawList(next.at(-1).cragName);
      if(facts().find(f=>f.wish.id===next.at(-1).id)?.done)get('[data-finished]').open=true;
      focusWish(next.at(-1).id);
      status.textContent=next.at(-1).routeName+'を追加しました。';
    }catch(error){status.textContent=error.message;}
  };
  dialog.addEventListener('cancel',event=>{if(screen!=='list'){event.preventDefault();back();}});
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const id=button.closest('.wishRow').dataset.wishId;
    const fact=facts().find(f=>f.wish.id===id);if(!fact)return;
    if(button.dataset.action==='detail'){detail(fact);return;}
    if(button.dataset.action==='log'){beginRecord(id);return;}
    try{write(wishes().map(w=>w.id===id?{...w,starred:!w.starred}:w));drawList();focusWish(id,'star');}
    catch(error){status.textContent=error.message;}
  });
  get('[data-log]').onclick=()=>beginRecord(selectedId);
  get('[data-remove]').onclick=()=>{
    if(!confirm('この課題をリストから外しますか？ 登った記録は残ります。'))return;
    try{write(wishes().filter(w=>w.id!==selectedId));selectedId=null;back();status.textContent='リストから外しました。';}
    catch(error){status.textContent=error.message;}
  };
  document.getElementById('cancel').addEventListener('click',()=>returnFromRecord(false));
  window.addEventListener('climblog:recordSaved',()=>returnFromRecord(true));
  window.addEventListener('climblog:authLock',()=>{
    locked=true;returnId=selectedId=null;if(dialog.open)dialog.close();form.reset();
    for(const selector of ['[data-active]','[data-finished-rows]','[data-last]','[data-memo]','[data-place]','[data-name]','#wishCrags','[data-crag]','.wishStatus'])get(selector).replaceChildren();
  });
  return {
    contains(record){const key=outdoorProblemKey(record);return Boolean(key&&wishes().some(w=>outdoorProblemKey(w)===key));},
    addRecord(record){write(addOutdoorWish(wishes(),record));}
  };
}
