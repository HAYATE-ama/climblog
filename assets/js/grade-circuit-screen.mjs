import {escapeHtml as esc} from './data-utils.mjs';
import {circuitGrades,circuitGradeLabel,circuitRouteGrade,circuitRouteLabel,setCircuitTotal} from './grade-circuit.mjs';
import {addCircuitRoutes,circuitLabel,circuitNumbers,circuitStats,createCircuit,parseCircuitDraft,recordCircuitTry,tapeShapes,undoCircuitTry,enableCircuitTiming,startCircuitTry,pauseCircuit,finishCircuit,resumeCircuit,circuitClock,circuitTime,circuitHistory,circuitSetKey,circuitComparable,prepareCircuitSave,repeatCircuit,changeCircuitSet} from './grade-circuit.mjs';
const button=(action,label,attrs='')=>'<button type="button" data-circuit="'+action+'" '+attrs+'>'+label+'</button>';
const options=values=>values.map(v=>'<option>'+esc(v)+'</option>').join('');
const routeStatus=r=>r.tries?'完登 '+r.sends+'回 ／ 途中落ち '+(r.tries-r.sends)+'回':'未着手';
const gradeDot=swatch=>'<span class="circuitGradeSwatch" aria-hidden="true" style="background:'+(/^#[\da-f]{3,8}$/i.test(swatch||'')?swatch:'var(--muted)')+'"></span>';
const times=t=>'<div class="circuitTimeTotals"><span>登攀累計<strong>'+circuitTime(t.climbMs)+'</strong></span><span>レスト累計<strong>'+circuitTime(t.restMs)+'</strong></span><span>合計<strong>'+circuitTime(t.climbMs+t.restMs)+'</strong></span></div>';
export function installGradeCircuit({api,getGyms}){
 const dialog=document.createElement('dialog');dialog.className='gradeCircuit';dialog.setAttribute('aria-labelledby','gradeCircuitTitle');
 dialog.innerHTML='<div class="circuitHead"><h2 id="gradeCircuitTitle">グレード別サーキット</h2>'+button('close','×','aria-label="閉じる"')+'</div><div class="circuitBody"></div><p class="circuitMessage" role="status"></p>';document.querySelector('#appRoot').append(dialog);
 const body=dialog.querySelector('.circuitBody'),message=dialog.querySelector('.circuitMessage'),$=s=>body.querySelector(s);
 let session,owner,key,raw,date,screen,selection,onlyRemaining,markKind,shape,opener,historyReturn='setup',historyId=null,queue=Promise.resolve(),ticker,epoch=0,gradeId=null,setup=null,lastGym=null;
 const pendingNotes=new Map();
 const say=text=>{message.textContent=text};
 function checkOwner(){if(!owner||window.climbLogAccountId!==owner||window.climbLogAuthReady===false)throw new Error('保存先を確認して開き直してください。');}
 function checkDraft(){checkOwner();if(localStorage.getItem(key)!==raw)throw new Error('別の画面で下書きが変わりました。閉じてから開き直してください。');}
 function write(next){checkDraft();const encoded=JSON.stringify(next);localStorage.setItem(key,encoded);raw=encoded;session=next;lastGym=next.gym;}
 function clear(){checkDraft();localStorage.removeItem(key);raw=null;session=null;}
 function tabs(){return '<nav class="circuitTabs" aria-label="サーキットの表示">'+button('run-tab','実施','aria-pressed="'+(screen!=='history')+'"')+button('history','履歴・時間の変化','aria-pressed="'+(screen==='history')+'"')+'</nav>';}
 function initial(){
  const gyms=getGyms(),recent=[...(api.get().workoutReceipts||[])].filter(r=>r.circuitSession).sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||''))[0]?.circuitSession.gym;
  if(!setup||!gyms.some(g=>g.name===setup.gym)){const preferred=lastGym||recent||document.querySelector('#gymName').value;setup={gym:gyms.find(g=>g.name===preferred)?.name||gyms[0]?.name,selected:[0],values:{},setName:'',timed:true};}
  body.innerHTML=tabs()+'<form data-form="setup"><p class="sub">'+esc(date)+' のジム記録</p><label>ジム<select name="gym" required>'+options(gyms.map(g=>g.name))+'</select></label><fieldset><legend>登るグレード <small class="sub">複数選択できます</small></legend><div class="circuitGradeChoices" data-grade-choices></div></fieldset><div class="circuitGradeConfigs" data-grade-configs></div><p class="sub" data-setup-total role="status"></p><details class="circuitSetupMore"><summary>セット名・計測の設定</summary><label>課題セット名（任意）<input name="setName" maxlength="80" placeholder="例：11月のサーキット" value="'+esc(setup.setName)+'"></label><p class="sub">同じ課題で比べるときは履歴の「同じセットで始める」から。ホールド替え後は新しいセットを作ります。</p><label class="circuitCheck"><input name="timed" type="checkbox" '+(setup.timed?'checked':'')+'>登攀とレストを計測する</label></details><p class="sub">計測は全グレード共通。同じ課題も繰り返し記録できます。</p><button class="primary" data-setup-start>サーキットを開始</button></form>';
  $('[name=gym]').value=setup.gym;
  $('[name=gym]').onchange=()=>{readSetup();setup={...setup,gym:$('[name=gym]').value,selected:[0],values:{},setName:''};$('[name=setName]').value='';drawSetupGrades();say('選んだジムのグレードに切り替えました。');};
  drawSetupGrades();
 }
 function readSetup(){if(!setup||!$('[data-form=setup]'))return;for(const row of body.querySelectorAll('[data-setup-grade]'))setup.values[row.dataset.setupGrade]={total:row.querySelector('[name=total]').value,layout:row.querySelector('[name=layout]').value};setup.setName=$('[name=setName]').value;setup.timed=$('[name=timed]').checked;}
 function setupTotal(){const chosen=setup.selected.map(i=>setup.values[i]?.total||''),known=chosen.every(v=>v!==''),sum=chosen.reduce((n,v)=>n+(Number(v)||0),0);$('[data-setup-total]').textContent=chosen.length?chosen.length+'グレード · '+(known?'合計 '+sum+'課題':'総数未設定のグレードあり'):'登るグレードを選んでください。';$('[data-setup-start]').disabled=!chosen.length;}
 function drawSetupGrades(){
  const grades=getGyms().find(g=>g.name===setup.gym)?.grades||[];setup.selected=setup.selected.filter(i=>grades[i]);
  $('[data-grade-choices]').innerHTML=grades.map(([name,swatch],i)=>'<label class="circuitGradeChoice"><input type="checkbox" name="grade" value="'+i+'" '+(setup.selected.includes(i)?'checked':'')+'>'+gradeDot(swatch)+'<span>'+esc(name)+'</span></label>').join('');
  $('[data-grade-configs]').innerHTML=setup.selected.map(i=>{const [name,swatch]=grades[i],value=setup.values[i]||{total:'',layout:'numbers'};return '<section class="circuitGradeConfig" data-setup-grade="'+i+'"><div class="circuitGradeConfigTop"><h3>'+gradeDot(swatch)+esc(name)+'</h3><label>課題数（任意）<input name="total" aria-label="'+esc(name)+'の課題数" type="number" min="1" max="300" value="'+esc(value.total)+'" placeholder="不明なら空欄"></label></div><details><summary>番号・テープの設定</summary><label>課題の用意<select name="layout" aria-label="'+esc(name)+'の課題の用意"><option value="numbers" '+(value.layout==='numbers'?'selected':'')+'>1番からの番号を並べる</option><option value="marks" '+(value.layout==='marks'?'selected':'')+'>番号・テープを個別に追加する</option></select></label></details></section>';}).join('');
  setupTotal();
 }
 function gradeSummary(s){return circuitGrades(s).length<2?'':'<div class="circuitGradeSummary">'+circuitGrades(s).map(g=>{const stats=circuitStats(s,g.id);return '<div><strong>'+gradeDot(g.swatch)+esc(g.grade)+'</strong><span>'+stats.completed+(g.total===null?' / 総数未設定':' / '+g.total)+'課題<small>延べ完登 '+stats.sends+'回 · 途中落ち '+stats.falls+'回</small></span></div>';}).join('')+'</div>';}
 function previous(){return circuitHistory(api.get()).find(h=>h.comparable&&h.session.id!==session.id&&circuitSetKey(h.session)===circuitSetKey(session));}
 function clockMarkup(){return session.timing?'<section class="circuitTimer" aria-label="登攀とレストの時間"><div class="circuitRow"><span data-clock-label></span><strong data-clock-status></strong></div><div class="circuitRow"><b class="circuitClock" data-clock></b>'+button('pause','一時停止')+'</div><div data-clock-totals></div><small class="sub" data-clock-note></small></section>':'<p class="sub">時間は計測していません。</p>'+button('enable-timer','ここから時間を計測する');}
 function updateClock(){
  if(!dialog.open||screen!=='run'||!session?.timing||!$('[data-clock]'))return;const t=circuitClock(session);$('.circuitTimer').dataset.phase=t.paused?'paused':t.phase;
  $('[data-clock-label]').textContent=t.phase==='climb'?circuitRouteLabel(session,session.routes[t.routeIndex])+' · 今回の登攀':t.phase==='rest'?'今回のレスト':'トライ開始で計測';$('[data-clock-status]').textContent=t.ended?'終了':t.paused?'一時停止中':t.phase==='climb'?'登攀中':t.phase==='rest'?'レスト中':'開始前';$('[data-clock]').textContent=circuitTime(t.phaseMs);$('[data-clock-totals]').innerHTML=times(t);
  const pause=$('[data-circuit=pause]');pause.disabled=t.phase==='ready'||t.ended;pause.textContent=t.paused?'計測を再開':'一時停止';$('[data-clock-note]').textContent=t.clockIssue?'端末時計の変更・長い空白があるため、時間比較の対象外です。':t.interrupted?'一時停止あり · 時間比較の対象外':t.incomplete?'未計測・未確定のトライあり · 時間比較の対象外':'結果ボタンでレストへ。移動・順番待ちもレストに含みます。';
 }
 function notesMarkup(){return '<details class="circuitNotes"><summary>備考を残す <small class="sub">'+(session.memo||session.routes.some(r=>r.note)?'記入あり':'任意')+'</small></summary><label>今日のサーキット<textarea data-note="session" maxlength="2000" rows="3" placeholder="例：後半は長めにレストした。">'+esc(session.memo||'')+'</textarea></label>'+(session.routes[selection]?'<label>'+esc(circuitRouteLabel(session,session.routes[selection]))+'の備考<textarea data-note="route" maxlength="1000" rows="2" placeholder="例：右足を高くすると楽だった。">'+esc(session.routes[selection].note||'')+'</textarea></label>':'')+'</details>';}
 function run(){
  const {routes,total}=session,{sends,completed,falls}=circuitStats(session),t=session.timing,groups=circuitGrades(session);if(t?.phase==='climb'){selection=t.routeIndex;gradeId=circuitRouteGrade(session,routes[selection]).id;}
  if(!groups.some(g=>g.id===gradeId))gradeId=groups[0].id;const group=groups.find(g=>g.id===gradeId),gradeRoutes=routes.map((r,i)=>i).filter(i=>circuitRouteGrade(session,routes[i]).id===gradeId);
  const visible=gradeRoutes.filter(i=>!onlyRemaining||!routes[i].sends||t?.routeIndex===i);if(!visible.includes(selection))selection=visible[0]??-1;
  const current=routes[selection],active=t?.phase==='climb',mark=t?.milestones[0],prev=previous();
  const tiles=visible.map(i=>{const r=routes[i],label=circuitLabel(r);return '<button type="button" class="circuitTile" data-route-index="'+i+'" data-state="'+(r.sends?'sent':r.tries?'tried':'new')+'" aria-pressed="'+(selection===i)+'" '+(active&&i!==selection?'disabled':'')+' aria-label="'+esc(label+'、'+routeStatus(r)+'、'+r.tries+'トライ')+'"><strong>'+esc(label)+'</strong><small>'+(r.sends?'✓ '+r.sends+'回':r.tries?'トライ中':'未着手')+'</small></button>';});
  body.innerHTML=tabs()+'<div class="circuitMeta"><strong>'+esc(session.gym)+'</strong><small>'+esc(session.date)+' · '+esc(session.setName||circuitGradeLabel(session))+'</small></div>'+
   '<div class="circuitProgress"><div><small>全体 </small><b>'+completed+'</b>'+(total===null?'':' / '+total)+' 課題完登</div><small>'+(total===null?'総数未設定のグレードあり':completed===total?'全課題を完登':'あと'+(total-completed)+'課題')+'</small></div>'+(total?'<div class="circuitProgressTrack" role="progressbar" aria-label="全グレードの完登した課題" aria-valuemin="0" aria-valuemax="'+total+'" aria-valuenow="'+completed+'"><span style="width:'+completed/total*100+'%"></span></div>':'')+clockMarkup()+
   (mark?'<div class="circuitMilestone"><strong>✓ 全課題初回完登　'+circuitTime(mark.climbMs+mark.restMs)+'</strong><small>登攀 '+circuitTime(mark.climbMs)+' / レスト '+circuitTime(mark.restMs)+'</small></div>':prev?'<small class="sub">同じセットの前回：登攀 '+circuitTime(prev.session.timing.milestones[0].climbMs)+' / レスト '+circuitTime(prev.session.timing.milestones[0].restMs)+'</small>':'')+
   '<div class="circuitGradeTabs" role="group" aria-label="表示するグレード">'+groups.map(g=>{const count=circuitStats(session,g.id).completed;return button('grade',gradeDot(g.swatch)+'<span>'+esc(g.grade)+'<small>'+count+' / '+(g.total??'総数未設定')+'</small></span>','data-grade-id="'+esc(g.id)+'" aria-pressed="'+(gradeId===g.id)+'" '+(active?'disabled':''));}).join('')+'</div>'+
   '<div class="circuitRow"><h3>'+esc(group.grade)+'の課題</h3>'+button('filter','未完登のみ','aria-pressed="'+onlyRemaining+'"')+'</div><div class="circuitGrid">'+tiles.join('')+'</div>'+(!visible.length?'<p class="sub">'+(gradeRoutes.length?'このグレードの未完登課題はありません。':'「課題を追加」から目印を選んでください。')+'</p>':'')+
   (current?'<section class="circuitCurrent"><div class="circuitRow"><h3>'+esc(circuitRouteLabel(session,current))+'</h3><small>'+routeStatus(current)+' · '+current.tries+'トライ</small></div>'+(t&&!active?button('start','トライを開始','class="primary circuitWide" '+(t.paused||t.ended?'disabled':'')):'<div class="circuitButtons">'+button('sent','完登 <span class="circuitIncrement">＋1</span>','class="primary" '+(t?.paused?'disabled':''))+button('fall','途中落ち <span class="circuitIncrement">＋1</span>',t?.paused?'disabled':'')+'</div>')+'</section>':'')+
   '<div class="circuitRow"><small class="sub">延べ完登 '+sends+'回 · 途中落ち '+falls+'回</small>'+(session.undo?button('undo','直前を取り消す',active?'disabled':''):'')+'</div>'+notesMarkup()+button('finish','ここまでで終了・確認','class="circuitWide"')+
   '<details class="circuitSettings" '+(!gradeRoutes.length?'open':'')+'><summary>課題の追加・設定</summary><p>'+esc(group.grade)+'の設定</p>'+button('add','＋ 課題を追加',active?'disabled':'')+'<form data-form="total"><label>このグレードの総課題数（任意）<input type="number" name="total" min="1" max="300" value="'+(group.total??'')+'" '+(active?'disabled':'')+'></label><button '+(active?'disabled':'')+'>総課題数を変更</button></form><p class="sub">課題構成の変更後は別セットとして扱い、変更前との時間比較は行いません。別のジムへ移るときは、ここまでを保存して新しく開始してください。</p>'+button('discard','この下書きを破棄')+'</details>';
 }
 function add(){body.innerHTML='<form data-form="mark"><h3>'+esc(circuitGrades(session).find(g=>g.id===gradeId).grade)+'の課題を追加</h3><fieldset><legend>課題の目印</legend><div class="circuitButtons">'+button('number','番号')+button('tape','テープの形')+'</div></fieldset><label data-numbers>課題番号<input name="numbers" placeholder="例：3、8、12 または 1-12" maxlength="130"></label><div data-shapes><div class="circuitShapes">'+[...tapeShapes,['other','その他']].map(([id,name])=>'<button type="button" data-shape="'+id+'">'+(id==='other'?'その他':esc(id)+' '+esc(name))+'</button>').join('')+'</div><label data-custom>その他の形<input name="custom" maxlength="32" placeholder="例：逆L字"></label></div><label>壁・位置（任意）<input name="wall" maxlength="60" placeholder="例：ルーフ左"></label><div class="circuitButtons"><button class="primary">課題を追加</button>'+button('back','一覧に戻る')+'</div></form>';updateMarkFields();}
 function updateMarkFields(){
  $('[data-numbers]').hidden=markKind!=='number';$('[data-shapes]').hidden=markKind!=='tape';$('[data-custom]').hidden=shape!=='other';
  for(const k of ['number','tape'])$('[data-circuit='+k+']').setAttribute('aria-pressed',String(k===markKind));for(const b of body.querySelectorAll('[data-shape]'))b.setAttribute('aria-pressed',String(b.dataset.shape===shape));
 }
 function comparison(s){
  if(!circuitComparable(s))return '<p class="sub">時間の比較対象外：未完登・計測途中・一時停止・時計変更のいずれかがあります。</p>';
  const prev=previous();if(!prev)return '<p class="sub">同じセットの比較できる記録はまだありません。</p>';
  const a=s.timing.milestones[0],b=prev.session.timing.milestones[0],diff=(x,y)=>x===y?'同じ':circuitTime(Math.abs(x-y))+(x<y?'短縮':'長い');return '<p class="sub">前回 '+esc(prev.session.date)+' から：登攀 '+diff(a.climbMs,b.climbMs)+' / レスト '+diff(a.restMs,b.restMs)+'</p>';
 }
 function routeList(s){return '<ul>'+s.routes.filter(r=>r.tries||r.note).map(r=>'<li>'+esc(circuitRouteLabel(s,r))+' · '+routeStatus(r)+(r.note?'<p class="circuitNoteText">'+esc(r.note)+'</p>':'')+'</li>').join('')+'</ul>';}
 function review(){
  const stats=circuitStats(session),t=session.timing,mark=t?.milestones[0];body.innerHTML='<h3>今日のサーキット</h3><p>'+esc(session.date)+' · '+esc(session.gym)+' · '+esc(circuitGradeLabel(session))+'</p><strong>'+stats.completed+(session.total===null?'':' / '+session.total)+'課題完登 · 延べ完登 '+stats.sends+'回 ／ 途中落ち '+stats.falls+'回</strong>'+gradeSummary(session)+
   (t?'<section class="circuitReviewTime"><h3>'+(mark?'全課題を初めて登り切るまで':'ここまでの取り組み時間')+'</h3>'+times(mark||t)+comparison(session)+'<small class="sub">サーキット全体 '+circuitTime(t.climbMs+t.restMs)+' · 一時停止 '+circuitTime(t.pausedMs)+'</small>'+(t.phase==='climb'?'<p class="sub">最後のトライは結果未入力です。完登・途中落ちには加算していません。</p>':'')+'</section>':'<p class="sub">時間は計測していません。</p>')+
   '<label>今日の備考<textarea data-note="session" maxlength="2000" rows="3">'+esc(session.memo||'')+'</textarea></label><details><summary>課題ごとの結果・備考</summary>'+routeList(session)+'</details><div class="circuitButtons">'+button('save','カレンダーに保存','class="primary" '+(stats.tries?'':'disabled'))+button('back','実施に戻る')+'</div>';
 }
 function history(){
  const all=circuitHistory(api.get()),rows=historyId?all.filter(h=>h.session.id===historyId):session?all.filter(h=>circuitSetKey(h.session)===circuitSetKey(session)):all;
  body.innerHTML=tabs()+'<h3>'+(historyId?'サーキットの記録':session?'同じ課題セットの履歴':'サーキットの履歴')+'</h3><p class="sub">登攀とレストを別々に比較します。レストの短さだけで良し悪しを評価しません。</p>'+(rows.length?rows.map(h=>{
   const s=h.session,t=s.timing,m=t?.milestones[0],stat=circuitStats(s);return '<details class="circuitHistoryItem" '+(historyId?'open':'')+'><summary><span><strong>'+esc(s.date)+' · '+esc(circuitGradeLabel(s))+'</strong><small>'+esc(s.gym)+' · '+esc(s.setName||'以前のセット')+'</small></span><span><strong>'+stat.completed+(s.total?' / '+s.total:'')+'課題</strong><small>'+(m?'全課題完登':t?'途中まで':'計測なし')+'</small></span></summary>'+(t?'<p class="sub">'+(m?'全課題初回完登まで':'ここまでの取り組み時間')+'</p>'+times(m||t)+'<p class="sub">'+(h.changed?'記録に編集・削除があります。保存時の結果を表示し、比較から外しています。':h.comparable?'同じセットで比較できます。':'一時停止・未計測・未完登などのため比較対象外です。')+'</p>':'')+'<p>延べ完登 '+stat.sends+'回 · 途中落ち '+stat.falls+'回</p>'+gradeSummary(s)+(s.memo?'<p class="circuitNoteText">'+esc(s.memo)+'</p>':'')+routeList(s)+(!session?button('repeat','同じセットで始める','data-receipt="'+esc(h.receipt.id)+'"'):'')+'</details>';
  }).join(''):'<p class="sub">該当する履歴はまだありません。以前の計測していないジム記録は、カレンダーにそのまま残っています。</p>')+'<details><summary>計測と比較のルール</summary><p class="sub">最初のトライ開始から計測。完登・途中落ちでレストに切り替わり、次のトライ開始までの移動や順番待ちもレストに含みます。全課題を1回以上完登した時点の時間を保存します。ホールド替え後は新しいセットを作成してください。途中まで・一時停止あり・課題変更・記録変更のある結果は、時間比較から外します。</p></details>';
 }
 function render(){if(screen==='setup')initial();if(screen==='run')run();if(screen==='mark')add();if(screen==='review')review();if(screen==='history')history();if(screen==='invalid')body.innerHTML='<p>この端末の下書きを読み込めませんでした。</p>'+button('discard','下書きを破棄してやり直す');if(screen==='saved')body.innerHTML='<p>このサーキットは保存済みです。</p>'+button('calendar','カレンダーで確認')+button('fresh','新しいサーキットを始める');updateClock();}
 function open(requestDate,source,requestedHistory=null){
  if(owner!==window.climbLogAccountId)lastGym=null;setup=null;gradeId=null;
  epoch++;pendingNotes.clear();owner=window.climbLogAccountId;checkOwner();key='climbLogGradeCircuit:'+owner;date=requestDate;opener=source;selection=-1;onlyRemaining=false;shape='×';markKind='number';historyId=requestedHistory;say('');raw=localStorage.getItem(key);
  try{session=raw===null?null:parseCircuitDraft(raw);screen=session?(session.timing?.ended?'review':'run'):'setup';selection=session?.timing?.routeIndex??session?.undo?.index??-1;if(session){const state=api.get(),saved=r=>r?.batchSessionId===session.id;if(state.records.some(saved)||state.recycleBin?.some(e=>saved(e.record))||(state.workoutReceipts||[]).some(r=>r.id==='circuit-'+session.id))screen='saved';}}catch{session=null;screen='invalid';}
  if(session?.routes[selection])gradeId=circuitRouteGrade(session,session.routes[selection]).id;
  historyReturn=screen;if(requestedHistory)screen='history';render();dialog.showModal();updateClock();clearInterval(ticker);ticker=setInterval(updateClock,500);if(screen==='run')say('この端末の途中記録を再開しました。');
 }
 dialog.addEventListener('close',()=>{epoch++;clearInterval(ticker);body.replaceChildren();say('');if(opener?.isConnected)opener.focus({preventScroll:true});});
 dialog.addEventListener('cancel',e=>{e.preventDefault();void perform(()=>dialog.close());});
 window.addEventListener('climblog:authLock',()=>{if(dialog.open)dialog.close();owner=null;session=null;});document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateClock();});
 function save(){
  checkDraft();const result=prepareCircuitSave(api.get(),session);if(!result.alreadySaved)api.apply(result.patch);const savedDate=session.date,sessionId=session.id;
  try{clear();}catch{screen='saved';render();say('記録は保存できました。端末に下書きが残っています。');return;}
  dialog.close();window.climbLogRecordApi.showDate(savedDate);window.climbLogNavigate('calendar');window.dispatchEvent(new CustomEvent('climblog:recordSaved',{detail:{draftKey:'circuit:'+sessionId,recordIds:result.recordIds||[],isNew:!result.alreadySaved}}));
 }
 function action(a,b){
  if(a==='close'){dialog.close();return;}if(a==='calendar'){dialog.close();window.climbLogRecordApi.showDate(session.date);window.climbLogNavigate('calendar');return;}
  if(a==='history'){if(screen!=='history')historyReturn=screen;historyId=null;screen='history';render();return;}if(a==='run-tab'){screen=historyReturn;render();return;}
  if(a==='repeat'){if(session)throw new Error('現在のサーキットを保存または終了してください。');const source=circuitHistory(api.get()).find(h=>h.receipt.id===b.dataset.receipt)?.session;if(!source)throw new Error('元の記録が見つかりません。');write(repeatCircuit(source,date));gradeId=circuitGrades(session)[0].id;selection=0;screen='run';historyId=null;historyReturn='run';render();return;}
  if(a==='grade'){if(session.timing?.phase==='climb')return;gradeId=b.dataset.gradeId;selection=-1;onlyRemaining=false;run();updateClock();body.querySelector('[data-grade-id="'+CSS.escape(gradeId)+'"]')?.focus({preventScroll:true});return;}
  if(a==='fresh'){clear();setup=null;screen='setup';render();return;}if(a==='number'||a==='tape'){markKind=a;updateMarkFields();return;}
  if(a==='discard'){if(!confirm('このサーキットの未保存の下書きを破棄しますか？'))return;clear();setup=null;screen='setup';}
  else if(a==='save'){save();return;}
  else if(a==='add'){if(session.timing?.phase==='climb')throw new Error('先にトライの結果を確定してください。');screen='mark';}
  else if(a==='finish'){const next=structuredClone(session);finishCircuit(next);write(next);screen='review';}
  else if(a==='back'){if(session.timing?.ended){const next=structuredClone(session);resumeCircuit(next);write(next);}screen='run';}
  else if(a==='filter')onlyRemaining=!onlyRemaining;
  else if(['sent','fall','undo','start','pause','enable-timer'].includes(a)){
   const next=structuredClone(session);
   if(a==='undo'){selection=next.undo.index;gradeId=circuitRouteGrade(next,next.routes[selection]).id;undoCircuitTry(next);say('直前のトライを戻しました。');}
   else if(a==='start'){startCircuitTry(next,selection);say('登攀時間の計測を開始しました。');}
   else if(a==='pause'){pauseCircuit(next);say(next.timing.paused?'一時停止しました。':'計測を再開しました。');}
   else if(a==='enable-timer'){enableCircuitTiming(next);say('次のトライ開始から計測します。');}
   else{recordCircuitTry(next,selection,a==='sent');say(circuitRouteLabel(next,next.routes[selection])+'の'+(a==='sent'?'完登':'途中落ち')+'を保存しました。'+(next.timing?'レスト中です。':''));}write(next);
  }
  render();if(['sent','fall','undo','start','pause'].includes(a))($('[data-circuit=start]:not(:disabled)')||$('[data-circuit=sent]:not(:disabled)')||$('[data-circuit=pause]'))?.focus({preventScroll:true});if(a==='add')(markKind==='number'?$('[name=numbers]'):$('[data-shape]')).focus({preventScroll:true});
 }
 function submit(form){
  const data=new FormData(form);
  if(form.dataset.form==='setup'){
   readSetup();const gym=getGyms().find(g=>g.name===data.get('gym')),grades=setup.selected.map(i=>({grade:gym?.grades[i]?.[0],swatch:gym?.grades[i]?.[1],total:setup.values[i]?.total,numbered:setup.values[i]?.layout==='numbers'})),next=createCircuit({date,gym:gym?.name,grades});if(data.get('timed'))enableCircuitTiming(next,String(data.get('setName')||''));else next.setName=String(data.get('setName')||'');write(next);gradeId=next.grades[0].id;setup=null;markKind=grades[0].numbered?'number':'tape';screen='run';historyReturn='run';
  }else if(form.dataset.form==='total'){
   if(session.timing?.phase==='climb')throw new Error('先にトライの結果を確定してください。');const next=structuredClone(session);setCircuitTotal(next,data.get('total'),gradeId);write(next);say('このグレードの総課題数を変更しました。');
  }else{
   if(session.timing?.phase==='climb')throw new Error('先にトライの結果を確定してください。');const marks=markKind==='number'?circuitNumbers(data.get('numbers')):[shape==='other'?data.get('custom'):shape],next=structuredClone(session),result=addCircuitRoutes(next,markKind,marks,data.get('wall'),gradeId);if(result.added)changeCircuitSet(next);write(next);selection=result.selected;onlyRemaining=false;screen='run';say(result.added?result.added+'課題を追加しました。':'登録済みの課題を選びました。');
  }render();
 }
 // Queue notes and actions in order, then serialize the persisted draft across tabs.
 function perform(fn){const generation=epoch,lockKey=key;queue=queue.then(async()=>{try{const run=()=>{if(!dialog.open||generation!==epoch)return;checkOwner();say('');if(pendingNotes.size&&session){const next=structuredClone(session);for(const [field,value]of pendingNotes){if(field==='session')next.memo=value;else if(next.routes[Number(field)])next.routes[Number(field)].note=value;}write(next);pendingNotes.clear();}fn();};if(navigator.locks)await navigator.locks.request(lockKey,run);else run();}catch(e){if(generation===epoch)say(e.message||'保存できませんでした。端末の空き容量を確認してください。');}});return queue;}
 dialog.addEventListener('submit',e=>{e.preventDefault();const form=e.target;void perform(()=>submit(form));});
 dialog.addEventListener('input',e=>{if(e.target.closest('[data-form=setup]')){readSetup();setupTotal();return;}if(!e.target.dataset.note)return;pendingNotes.set(e.target.dataset.note==='session'?'session':String(selection),e.target.value);void perform(()=>{const label=$('.circuitNotes summary small');if(label)label.textContent=session.memo||session.routes.some(r=>r.note)?'記入あり':'任意';});});
 dialog.addEventListener('change',e=>{if(e.target.name==='grade'&&screen==='setup'){readSetup();setup.selected=[...body.querySelectorAll('[name=grade]:checked')].map(el=>Number(el.value));drawSetupGrades();body.querySelector('[name=grade][value="'+e.target.value+'"]')?.focus({preventScroll:true});}});
 dialog.addEventListener('click',e=>{const b=e.target.closest('button[type=button]');if(!b||b.disabled)return;void perform(()=>{
  if(b.dataset.shape){shape=b.dataset.shape;updateMarkFields();return;}
  if(b.dataset.routeIndex!==undefined){const index=Number(b.dataset.routeIndex);if(session.timing?.phase==='climb'&&session.timing.routeIndex!==index)return;selection=index;run();updateClock();const current=$('.circuitCurrent');if(current){const card=current.getBoundingClientRect(),frame=dialog.getBoundingClientRect();if(card.bottom>frame.bottom||card.top<frame.top){current.scrollIntoView({block:'nearest'});current.querySelector('button:not(:disabled)')?.focus({preventScroll:true});}else body.querySelector('[aria-pressed=true][data-route-index]')?.focus({preventScroll:true});}return;}action(b.dataset.circuit,b);
 });});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-circuit-history]');if(b)open(b.dataset.date||window.climbLogGetSelectedDate(),b,b.dataset.circuitHistory);});
 return {open};
}
