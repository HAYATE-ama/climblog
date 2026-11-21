import {createTopo,createMarkHistory,problemForTopo,toposForProblem,validateTopos} from './outdoor-topo-model.mjs';
import {readTopos,getTopoPhoto,putTopoPhotos,optimizeTopoPhoto} from './outdoor-topo-store.mjs';

export function installOutdoorTopo(){
 const api=window.climbLogStateApi,dialog=document.createElement('dialog');
 dialog.id='outdoorTopo';dialog.setAttribute('aria-labelledby','topoTitle');
 dialog.innerHTML=`<div class="topoHead"><div><p data-place></p><h2 id="topoTitle">写真・トポ</h2></div><button type="button" data-close aria-label="写真・トポを閉じる">×</button></div>
 <div class="topoBody">
  <div class="topoEmpty" data-empty><strong>自分の写真が、課題のトポに。</strong><p>岩の写真にラインとスタート・ゴールを付けて、次のトライへ。</p></div>
  <label data-photos-label hidden>写真<select data-photos></select></label>
  <label data-routes-label hidden>この写真の課題<select data-routes></select></label>
  <div class="topoStage" data-stage role="group" aria-label="写真のマーク位置。編集時は矢印キーで移動、Enterで配置" hidden><img data-photo alt="課題に紐付けた岩の写真" draggable="false"><svg data-marks viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="ライン・スタート・ゴールのマーク"></svg><button type="button" data-plain aria-pressed="false">写真のみ</button></div>
  <p class="topoLegend" data-legend hidden>オレンジ：選択中の課題　S：スタート　G：ゴール</p>
  <div data-editor hidden>
   <div class="topoTools" role="group" aria-label="マークの種類"><button type="button" data-tool="line">ライン</button><button type="button" data-tool="start">S スタート</button><button type="button" data-tool="goal">G ゴール</button></div>
   <p class="topoHint" data-hint></p>
   <div class="topoHistory"><button type="button" data-undo>↶ ひとつ戻す</button><button type="button" data-redo>↷ ひとつ進める</button></div>
   <button type="button" class="topoClear" data-clear>ラインを消す</button>
   <label>写真のメモ（任意）<textarea data-note maxlength="1000" rows="3" placeholder="例：右のカチからスタート。抜けの足位置を確認。"></textarea></label>
  </div>
  <p class="topoNote" data-saved-note hidden></p>
  <p class="topoMessage" role="status" aria-live="polite"></p>
  <div class="topoActions" data-view-actions><button type="button" data-edit hidden>マークを編集</button><button type="button" data-add>写真を追加</button></div>
  <details data-library><summary>保存済みの写真を使う</summary><p class="topoHint">同じ岩場の写真を別の課題にも紐付けられます。</p><label>写真を選ぶ<select data-existing></select></label><button type="button" data-reuse>この課題に紐付ける</button></details>
  <p class="topoPrivacy">写真とマークはこの端末だけに保存します。端末の元の写真は変更せず、アプリ用に縮小して保存します。</p>
  <input type="file" data-file accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden>
 </div><div class="topoFoot" data-edit-actions hidden><button type="button" data-cancel>キャンセル</button><button type="button" class="topoPrimary" data-save>写真・マークを保存</button></div>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),message=$('.topoMessage'),stage=$('[data-stage]'),svg=$('[data-marks]'),img=$('[data-photo]'),note=$('[data-note]');
 let problem=null,current=null,original=null,history=createMarkHistory(),all=[],owner='',trigger=null,editing=false,busy=false,plain=false,tool='line',url=null,epoch=0,gesture=null,baseline='',previousId=null;
 let pending=new Map(),cursor=null;
 const same=value=>JSON.stringify(value);
 const dirty=()=>editing&&(!original||same(history.get())!==same(original.marks)||note.value!==history.get().note);
 function report(text){message.textContent=text;}
 function release(){if(url)URL.revokeObjectURL(url);url=null;img.removeAttribute('src');}
 function flushNote(){if(editing&&note.value!==history.get().note)history.change({...history.get(),note:note.value});}
 function mayLeave(){flushNote();return !dirty()||confirm('写真・マークに未保存の変更があります。変更を破棄しますか？');}
 function controls(){
  for(const el of dialog.querySelectorAll('button,select,textarea,input'))el.disabled=busy;
  dialog.setAttribute('aria-busy',String(busy));
  $('[data-editor]').hidden=!editing;$('[data-edit-actions]').hidden=!editing;$('[data-view-actions]').hidden=editing;$('[data-library]').hidden=editing;
  $('[data-edit]').hidden=!current||!url;$('[data-empty]').hidden=!!current;stage.hidden=!current||!url;
  $('[data-photos-label]').hidden=editing||$('[data-photos]').options.length<2;
  $('[data-routes-label]').hidden=editing||$('[data-routes]').options.length<2;
  const pendingNote=note.value!==history.get().note;
  $('[data-undo]').disabled=busy||(!history.canUndo()&&!pendingNote);$('[data-redo]').disabled=busy||pendingNote||!history.canRedo();$('[data-clear]').disabled=busy||!history.get().line.length;
  $('[data-reuse]').disabled=busy||!$('[data-existing]').value;
  stage.classList.toggle('isEditing',editing);stage.tabIndex=editing&&!busy?0:-1;
  for(const button of dialog.querySelectorAll('[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===tool));
  $('[data-plain]').hidden=editing;$('[data-plain]').textContent=plain?'マークを表示':'写真のみ';$('[data-plain]').setAttribute('aria-pressed',String(plain));svg.toggleAttribute('hidden',plain);
  $('[data-legend]').hidden=!current||!url||plain;
  $('[data-legend]').textContent='オレンジ：選択中の課題　S：スタート　G：ゴール'+(!editing&&all.some(row=>row.photoId===current?.photoId&&row.id!==current?.id)?'　白い点線：他の課題':'');
  $('[data-saved-note]').hidden=editing||!current?.marks.note;$('[data-saved-note]').textContent=current?.marks.note||'';
  $('[data-hint]').textContent=tool==='line'?'写真を順にタップして線をつなぎます。指でなぞって描くこともできます。':`${tool==='start'?'スタート':'ゴール'}を写真上でタップしてください。別の位置をタップすると移動します。`;
 }
 function choices(){
  const local=toposForProblem(all,problem);
  $('[data-photos]').replaceChildren(...local.map((row,i)=>new Option('写真 '+(i+1)+(row.marks.note?' · '+row.marks.note.slice(0,30):''),row.id)));
  $('[data-photos]').value=current?.id||'';
  $('[data-routes]').replaceChildren(...all.filter(row=>row.photoId===current?.photoId).map(row=>new Option([row.problem.routeName,row.problem.outdoorGrade].filter(Boolean).join(' · '),row.id)));
  $('[data-routes]').value=current?.id||'';
  const shared=new Map();for(const row of all)if(row.problem.cragName===problem.cragName&&!local.some(r=>r.photoId===row.photoId))shared.set(row.photoId,row);
  $('[data-existing]').replaceChildren(new Option(shared.size?'写真を選ぶ':'使える写真はまだありません',''),...[...shared.values()].map(row=>new Option(row.problem.routeName+(row.marks.note?' · '+row.marks.note.slice(0,24):''),row.photoId)));
 }
 function element(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
 function drawMarks(m,muted=false){
  if(m.line.length>1)svg.append(element('polyline',{points:m.line.map(p=>p.map(n=>n*1000).join(',')).join(' '),fill:'none',stroke:muted?'white':'#ff8a24','stroke-width':muted?3:5,'stroke-dasharray':muted?'6 5':'none','vector-effect':'non-scaling-stroke',opacity:muted ? .6 : 1,'stroke-linejoin':'round','stroke-linecap':'round'}));
  if(!muted){
   const width=stage.clientWidth||350,height=stage.clientHeight||250,rx=15/width*1000,ry=15/height*1000;
   for(const [field,label]of [['start','S'],['goal','G']])if(m[field]){
    const [x,y]=m[field].map(n=>n*1000);svg.append(element('ellipse',{cx:x,cy:y,rx,ry,fill:'#ff8a24',stroke:'#fff','stroke-width':2,'vector-effect':'non-scaling-stroke'}));
    const text=element('text',{x,y,'text-anchor':'middle','dominant-baseline':'central',fill:'#151715','font-family':'system-ui','font-weight':800,'font-size':14/height*1000,'transform':`translate(${x} ${y}) scale(${height/width} 1) translate(${-x} ${-y})`});text.textContent=label;svg.append(text);
   }
   if(m.line.length===1){const p=m.line[0];svg.append(element('ellipse',{cx:p[0]*1000,cy:p[1]*1000,rx:4/width*1000,ry:4/height*1000,fill:'#ff8a24'}));}
  }
 }
 function paint(m=history.get()){svg.replaceChildren();if(!editing)for(const row of all)if(row.photoId===current?.photoId&&row.id!==current?.id)drawMarks(row.marks,true);drawMarks(m);
  if(editing&&cursor)svg.append(element('ellipse',{cx:cursor[0]*1000,cy:cursor[1]*1000,rx:10/(stage.clientWidth||350)*1000,ry:10/(stage.clientHeight||250)*1000,fill:'#0008',stroke:'white','stroke-width':2,'vector-effect':'non-scaling-stroke'}));controls();}
 new ResizeObserver(()=>{if(current&&url)paint(gesture?.draft);}).observe(stage);
 img.onload=()=>{stage.style.setProperty('--photo-ratio',`${img.naturalWidth} / ${img.naturalHeight}`);stage.style.setProperty('--photo-max-width',`${img.naturalWidth/img.naturalHeight*52}dvh`);paint();};
 img.onerror=()=>{release();controls();report('写真を開けません。写真付きバックアップから復元するか、写真を追加し直してください。');};
 async function select(row,{blob=null,edit=false}={}){
  const version=++epoch;busy=true;editing=false;gesture=null;cursor=null;plain=false;current=row?structuredClone(row):null;original=row&&all.some(r=>r.id===row.id)?structuredClone(row):null;
  history=createMarkHistory(row?.marks);note.value=history.get().note;release();choices();controls();
  if(!row){busy=false;controls();return;}
  try{
   const photo=blob||await getTopoPhoto(owner,row.photoId);if(version!==epoch||!dialog.open)return;
   if(!photo)throw new Error('写真が見つかりません。写真を含むバックアップから復元してください。');
   url=URL.createObjectURL(photo);img.src=url;editing=edit;baseline=same(all);tool='line';
  }catch(error){if(version===epoch)report(error.message);}finally{if(version===epoch){busy=false;paint();}}
 }
 async function open(source,opener=document.activeElement){
  if(dialog.open||!window.climbLogAuthReady)return;
  problem=problemForTopo(source);trigger=opener;owner=window.climbLogAccountId;pending=new Map();editing=false;current=null;report('');
  $('#topoTitle').textContent=problem.routeName;$('[data-place]').textContent=[problem.cragName,problem.areaName,problem.outdoorGrade,'写真・トポ'].filter(Boolean).join(' · ');
  dialog.showModal();$('.topoBody').scrollTop=0;$('[data-close]').focus();
  try{all=readTopos();await select(toposForProblem(all,problem)[0]||null);}catch(error){all=[];release();controls();report(error.message);}
 }
 function close(){if(busy||!mayLeave())return;dialog.close();}
 $('[data-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{epoch++;editing=false;pending.clear();release();current=null;if(trigger?.isConnected)trigger.focus({preventScroll:true});});
 window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
 window.addEventListener('climblog:authLock',()=>{epoch++;dialog.close();});
 $('[data-add]').onclick=()=>{$('[data-file]').value='';$('[data-file]').click();};
 $('[data-file]').onchange=async event=>{
  const file=event.target.files[0];if(!file||busy||!mayLeave())return;const version=++epoch,localOwner=owner;busy=true;controls();report('写真を準備しています…');
  try{
   const photo=await optimizeTopoPhoto(file);if(version!==epoch||localOwner!==window.climbLogAccountId||!dialog.open)return;
   all=readTopos();const found=toposForProblem(all,problem).find(r=>r.photoId===photo.id);previousId=current?.id||null;
   pending=new Map([[photo.id,photo.blob]]);await select(found||createTopo(problem,photo.id),{blob:photo.blob,edit:!found});report(found?'この写真はすでに紐付いています。':'マークを付けて保存してください。写真だけの保存もできます。');
  }catch(error){report(error.message);busy=false;controls();}
 };
 $('[data-reuse]').onclick=async()=>{
  if(busy||!$('[data-existing]').value||!mayLeave())return;try{all=readTopos();previousId=current?.id||null;await select(createTopo(problem,$('[data-existing]').value),{edit:true});report('この課題のマークを付けて保存してください。他の課題のマークは変更しません。');}catch(error){report(error.message);}
 };
 $('[data-existing]').onchange=controls;
 $('[data-photos]').onchange=async e=>{if(!mayLeave()){choices();return;}report('');await select(all.find(r=>r.id===e.target.value));};
 $('[data-routes]').onchange=async e=>{const row=all.find(r=>r.id===e.target.value);if(!row)return;problem=structuredClone(row.problem);$('#topoTitle').textContent=problem.routeName;$('[data-place]').textContent=[problem.cragName,problem.areaName,problem.outdoorGrade,'写真・トポ'].filter(Boolean).join(' · ');report('');await select(row);};
 $('[data-edit]').onclick=()=>{try{all=readTopos();const row=all.find(r=>r.id===current.id);if(!row)throw new Error('写真の情報が変わりました。一度閉じて開き直してください。');current=structuredClone(row);original=structuredClone(row);history=createMarkHistory(row.marks);note.value=row.marks.note;baseline=same(all);editing=true;plain=false;report('');paint();}catch(error){report(error.message);}};
 $('[data-plain]').onclick=()=>{plain=!plain;controls();};
 for(const button of dialog.querySelectorAll('[data-tool]'))button.onclick=()=>{tool=button.dataset.tool;controls();};
 function step(action){flushNote();history[action]();note.value=history.get().note;paint();report(action==='undo'?'ひとつ戻しました。':'ひとつ進めました。');}
 $('[data-undo]').onclick=()=>step('undo');$('[data-redo]').onclick=()=>step('redo');
 dialog.addEventListener('keydown',event=>{if(!editing||busy||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();step(event.shiftKey?'redo':'undo');}});
 note.onchange=()=>{flushNote();controls();};note.oninput=controls;
 $('[data-clear]').onclick=()=>{flushNote();history.change({...history.get(),line:[]});paint();};
 function position(event){const r=stage.getBoundingClientRect();return [Math.min(1,Math.max(0,(event.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(event.clientY-r.top)/r.height))].map(n=>Math.round(n*10000)/10000);}
 stage.addEventListener('pointerdown',event=>{
  if(!editing||busy||gesture||event.button!==0)return;event.preventDefault();cursor=null;flushNote();const draft=history.get(),p=position(event);
  if(tool==='line'){if(draft.line.length>=300){report('ラインは300点までです。戻すか、ラインを消して描き直してください。');return;}draft.line.push(p);}else draft[tool]=p;
  gesture={id:event.pointerId,draft};stage.setPointerCapture(event.pointerId);paint(draft);
 });
 stage.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;event.preventDefault();const p=position(event),draft=gesture.draft;
  if(tool==='line'){const last=draft.line.at(-1);if(draft.line.length<300&&Math.hypot(p[0]-last[0],p[1]-last[1])>.012)draft.line.push(p);}else draft[tool]=p;paint(draft);
 });
 stage.addEventListener('pointerup',event=>{if(gesture?.id!==event.pointerId)return;history.change(gesture.draft);gesture=null;paint();});
 for(const event of ['pointercancel','lostpointercapture'])stage.addEventListener(event,()=>{if(gesture){gesture=null;paint();}});
 stage.addEventListener('keydown',event=>{
  if(!editing||busy||event.target!==stage)return;
  const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(!arrows[event.key]&&!['Enter',' '].includes(event.key))return;event.preventDefault();cursor ||= [.5,.5];
  if(arrows[event.key])cursor=cursor.map((n,i)=>Math.min(1,Math.max(0,n+arrows[event.key][i]*(event.shiftKey ? .01 : .04))));
  else{flushNote();const draft=history.get();if(tool==='line'){if(draft.line.length>=300)return;draft.line.push([...cursor]);}else draft[tool]=[...cursor];history.change(draft);report('マークを配置しました。');}paint();
 });
 stage.addEventListener('blur',()=>{cursor=null;if(current)paint();});
 $('[data-cancel]').onclick=async()=>{if(!mayLeave())return;report('変更を取り消しました。');pending.clear();editing=false;all=readTopos();await select(all.find(r=>r.id===(original?.id||previousId))||toposForProblem(all,problem)[0]||null);};
 $('[data-save]').onclick=async()=>{
  if(busy||!editing||!current)return;flushNote();const localOwner=owner,version=epoch,row={...current,marks:history.get(),updatedAt:new Date().toISOString()};
  busy=true;controls();report('端末に保存しています…');
  try{
   if(same(readTopos())!==baseline)throw new Error('写真の情報が別の操作で更新されました。変更を控えてから開き直してください。');
   const next=[...all.filter(r=>r.id!==row.id),row];validateTopos(next);
   await putTopoPhotos(localOwner,pending);
   if(!await getTopoPhoto(localOwner,row.photoId))throw new Error('写真を保存できませんでした。もう一度写真を選んでください。');
   if(version!==epoch||localOwner!==window.climbLogAccountId||same(readTopos())!==baseline)throw new Error('保存中に画面の情報が変わりました。開き直して確認してください。');
   api.apply({outdoorTopos:next});all=next;current=structuredClone(row);original=structuredClone(row);editing=false;pending.clear();history=createMarkHistory(row.marks);choices();report('写真とマークをこの端末に保存しました。');
  }catch(error){report('保存できませんでした。編集内容は残っています。'+error.message);}finally{busy=false;paint();}
 };
 window.climbLogTopos={open};return window.climbLogTopos;
}
