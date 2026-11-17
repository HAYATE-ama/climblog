import {escapeHtml as esc} from './data-utils.mjs';
import {addCircuitRoutes,circuitLabel,circuitNumbers,circuitRecords,circuitStats,circuitTotal,createCircuit,parseCircuitDraft,recordCircuitTry,tapeShapes,undoCircuitTry} from './grade-circuit.mjs';

const button=(action,label,attrs='')=>'<button type="button" data-circuit="'+action+'" '+attrs+'>'+label+'</button>';
const options=values=>values.map(v=>'<option>'+esc(v)+'</option>').join('');
const routeStatus=r=>r.sent?'完登':r.tries?'トライ中':'未着手';

export function installGradeCircuit({api,getGyms}){
  const dialog=document.createElement('dialog');
  dialog.className='gradeCircuit';
  dialog.setAttribute('aria-labelledby','gradeCircuitTitle');
  dialog.innerHTML='<div class="circuitHead"><h2 id="gradeCircuitTitle">グレード別サーキット</h2>'+button('close','×','aria-label="閉じる"')+'</div><div class="circuitBody"></div><p class="circuitMessage" role="status"></p>';
  document.querySelector('#appRoot').append(dialog);
  const body=dialog.querySelector('.circuitBody'),message=dialog.querySelector('.circuitMessage');
  const $=s=>body.querySelector(s);
  let session,owner,key,raw,date,screen,selection,onlyRemaining,markKind,shape,opener,busy=false;
  const say=text=>{message.textContent=text};
  function checkOwner(){
    if(!owner||window.climbLogAccountId!==owner||window.climbLogAuthReady===false)throw new Error('ログイン状態を確認して開き直してください。');
  }
  function checkDraft(){
    checkOwner();
    if(localStorage.getItem(key)!==raw)throw new Error('別の画面で下書きが変わりました。閉じてから開き直してください。');
  }
  function write(next){
    checkDraft();
    const encoded=JSON.stringify(next);
    localStorage.setItem(key,encoded);raw=encoded;session=next;
  }
  function clear(){
    checkDraft();localStorage.removeItem(key);raw=null;session=null;
  }
  function initial(){
    const gyms=getGyms();
    body.innerHTML='<form data-form="setup"><p class="sub">'+esc(date)+' のジム記録</p><label>ジム<select name="gym" required>'+options(gyms.map(g=>g.name))+'</select></label><label>登るグレード<select name="grade" required></select></label><label>総課題数（任意）<input name="total" type="number" min="1" max="300" placeholder="不明なら空欄"></label><label>課題の用意<select name="layout"><option value="numbers">1番からの番号を並べる</option><option value="marks">番号・テープを個別に追加する</option></select></label><p class="sub">番号は一覧からタップして記録できます。総数が不明な場合は登る課題から追加できます。</p><button class="primary">サーキットを開始</button></form>';
    const gym=$('[name=gym]'),preferred=document.querySelector('#gymName').value;
    if(gyms.some(g=>g.name===preferred))gym.value=preferred;
    const setGrades=()=>{$('[name=grade]').innerHTML=options(gyms.find(g=>g.name===gym.value)?.grades.map(([name])=>name)||[])};
    gym.onchange=setGrades;setGrades();
  }
  function run(){
    const {routes,total}=session,{sends,tries}=circuitStats(session),tiles=[];
    const visible=routes.map((r,i)=>i).filter(i=>!onlyRemaining||!routes[i].sent);
    if(!visible.includes(selection))selection=visible[0]??-1;
    const current=routes[selection];
    for(const i of visible){
      const r=routes[i],label=circuitLabel(r),symbol=r.sent?'✓':r.tries?'◐':'–';
      tiles.push('<button type="button" class="circuitTile" data-route-index="'+i+'" data-state="'+(r.sent?'sent':r.tries?'tried':'new')+'" aria-pressed="'+(selection===i)+'" aria-label="'+esc(label+'、'+routeStatus(r)+'、'+r.tries+'トライ')+'"><span aria-hidden="true">'+symbol+'</span> '+esc(label)+'</button>');
    }
    body.innerHTML='<div class="circuitProgress"><small>'+esc(session.date)+' · '+esc(session.gym)+'</small><strong>'+esc(session.grade)+'</strong><div><b>'+sends+'</b>'+(total===null?'':' / '+total)+' 課題完登</div><small>'+(total===null?'総数未設定':'残り'+(total-sends)+'課題')+' · 計'+tries+'トライ</small></div><div class="circuitRow"><h3>課題を選ぶ</h3>'+button('filter','未完登のみ','aria-pressed="'+onlyRemaining+'"')+'</div><div class="circuitGrid">'+tiles.join('')+'</div>'+(!visible.length?'<p class="sub">'+(routes.length?'表示する未完登課題はありません。':'「課題を追加」から最初の目印を選んでください。')+'</p>':'')+'<small class="sub">✓ 完登　◐ トライ中　– 未着手</small>'+button('add','＋ 課題を追加')+
      (current?'<section class="circuitCurrent"><h3>'+esc(circuitLabel(current))+'</h3><p>'+routeStatus(current)+' · '+current.tries+'トライ</p><div class="circuitButtons">'+button('sent',current.sent?'完登済み':'完登した','class="primary" '+(current.sent?'disabled':''))+button('fall','途中で落ちた',current.sent?'disabled':'')+'</div></section>':'')+
      (session.undo?button('undo','直前のトライを戻す'):'')+button('finish','ここまでで終了','class="circuitWide"')+
      '<details><summary>サーキットの設定</summary><form data-form="total"><label>総課題数（任意）<input type="number" name="total" min="1" max="300" value="'+(total??'')+'"></label><button>総課題数を変更</button></form>'+button('discard','この下書きを破棄')+'</details>';
  }
  function add(){
    body.innerHTML='<form data-form="mark"><h3>課題を追加</h3><fieldset><legend>課題の目印</legend><div class="circuitButtons">'+button('number','番号')+button('tape','テープの形')+'</div></fieldset><label data-numbers>課題番号<input name="numbers" placeholder="例：3、8、12 または 1-12" maxlength="130"></label><div data-shapes><div class="circuitShapes">'+[...tapeShapes,['other','その他']].map(([id,name])=>'<button type="button" data-shape="'+id+'">'+(id==='other'?'その他':esc(id)+' '+esc(name))+'</button>').join('')+'</div><label data-custom>その他の形<input name="custom" maxlength="32" placeholder="例：逆L字"></label></div><label>壁・位置（任意）<input name="wall" maxlength="60" placeholder="例：ルーフ左"></label><div class="circuitButtons"><button class="primary">課題を追加</button>'+button('back','一覧に戻る')+'</div></form>';
    updateMarkFields();
  }
  function updateMarkFields(){
    $('[data-numbers]').hidden=markKind!=='number';$('[data-shapes]').hidden=markKind!=='tape';$('[data-custom]').hidden=shape!=='other';
    for(const k of ['number','tape'])$('[data-circuit='+k+']').setAttribute('aria-pressed',String(k===markKind));
    for(const b of body.querySelectorAll('[data-shape]'))b.setAttribute('aria-pressed',String(b.dataset.shape===shape));
  }
  function review(){
    const stats=circuitStats(session);
    body.innerHTML='<h3>今日の結果</h3><p>'+esc(session.date)+' · '+esc(session.gym)+' · '+esc(session.grade)+'</p><strong>'+stats.sends+(session.total===null?'':' / '+session.total)+'課題完登 · '+stats.tries+'トライ</strong><ul>'+session.routes.filter(r=>r.tries).map(r=>'<li>'+esc(circuitLabel(r))+' · '+routeStatus(r)+' · '+r.tries+'トライ</li>').join('')+'</ul><p class="sub">'+(stats.tries?'トライした課題を1件ずつジム記録に保存します。':'実施したトライがありません。')+'</p><div class="circuitButtons">'+button('save','カレンダーに保存','class="primary" '+(stats.tries?'':'disabled'))+button('back','実施に戻る')+'</div>';
  }
  function render(){
    if(screen==='setup')initial();
    if(screen==='run')run();
    if(screen==='mark')add();
    if(screen==='review')review();
    if(screen==='invalid')body.innerHTML='<p>この端末の下書きを読み込めませんでした。</p>'+button('discard','下書きを破棄してやり直す');
    if(screen==='saved')body.innerHTML='<p>このサーキットのジム記録は保存済みです。</p>'+button('calendar','カレンダーで確認')+button('fresh','新しいサーキットを始める');
  }
  function open(requestDate,source){
    owner=window.climbLogAccountId;checkOwner();key='climbLogGradeCircuit:'+owner;
    date=requestDate;opener=source;selection=-1;onlyRemaining=false;shape='×';markKind='number';say('');
    raw=localStorage.getItem(key);
    try{
      session=raw===null?null:parseCircuitDraft(raw);screen=session?'run':'setup';selection=session?.undo?.index??-1;
      if(session){
        const state=api.get(),saved=r=>r?.batchSessionId===session.id;
        if(state.records.some(saved)||state.recycleBin?.some(e=>saved(e.record)))screen='saved';
      }
    }
    catch{session=null;screen='invalid';}
    render();dialog.showModal();if(screen==='run')say('この端末の途中記録を再開しました。');
  }
  dialog.addEventListener('close',()=>{body.replaceChildren();say('');if(opener?.isConnected)opener.focus({preventScroll:true})});
  window.addEventListener('climblog:authLock',()=>{if(dialog.open)dialog.close();owner=null;session=null;});
  function save(){
    checkDraft();const state=api.get(),rows=circuitRecords(session);
    if(!rows.length)throw new Error('実施したトライがありません。');
    const seen=new Set([...state.records.map(r=>r.id),...(state.recycleBin||[]).map(e=>e.record?.id)]);
    const newRows=rows.filter(r=>!seen.has(r.id));
    if(newRows.length)api.apply({records:[...state.records,...newRows]});
    const savedDate=session.date,sessionId=session.id;
    try{clear();}
    catch{screen='saved';render();say('ジム記録は保存できました。端末に下書きが残っています。');return}
    dialog.close();window.climbLogRecordApi.showDate(savedDate);window.climbLogNavigate('calendar');
    window.dispatchEvent(new CustomEvent('climblog:recordSaved',{detail:{draftKey:'circuit:'+sessionId,recordIds:rows.map(r=>r.id),isNew:!!newRows.length}}));
  }
  function action(a){
    if(a==='close'){dialog.close();return}
    if(a==='calendar'){dialog.close();window.climbLogRecordApi.showDate(session.date);window.climbLogNavigate('calendar');return}
    if(a==='fresh'){clear();screen='setup';render();return}
    if(a==='number'||a==='tape'){markKind=a;updateMarkFields();return}
    if(a==='discard'){
      if(!confirm('このサーキットの未保存の下書きを破棄しますか？'))return;
      clear();screen='setup';
    }else if(a==='save'){save();return}
    else if(a==='add')screen='mark';
    else if(a==='finish')screen='review';
    else if(a==='back')screen='run';
    else if(a==='filter')onlyRemaining=!onlyRemaining;
    else if(a==='sent'||a==='fall'||a==='undo'){
      const next=structuredClone(session);
      if(a==='undo'){selection=next.undo.index;undoCircuitTry(next);say('直前のトライを戻しました。');}
      else{recordCircuitTry(next,selection,a==='sent');say(circuitLabel(next.routes[selection])+'の'+(a==='sent'?'完登':'トライ')+'を記録しました。');}
      write(next);
    }
    render();
    if(a==='sent'||a==='fall'||a==='undo')body.querySelector('[data-route-index][aria-pressed=true]')?.focus({preventScroll:true});
    if(a==='add')(markKind==='number'?$('[name=numbers]'):$('[data-shape]')).focus({preventScroll:true});
  }
  function submit(form){
    const data=new FormData(form);
    if(form.dataset.form==='setup'){
      const gym=getGyms().find(g=>g.name===data.get('gym')),grade=gym?.grades.find(([name])=>name===data.get('grade'));
      const numbered=data.get('layout')==='numbers';
      write(createCircuit({date,gym:gym?.name,grade:grade?.[0],swatch:grade?.[1],total:data.get('total'),numbered}));
      markKind=numbered?'number':'tape';screen='run';
    }else if(form.dataset.form==='total'){
      const total=circuitTotal(data.get('total'));
      if(total!==null&&total<session.routes.length)throw new Error('登録済みの課題数以上にするか、空欄にしてください。');
      write({...session,total});say('総課題数を変更しました。');
    }else{
      const marks=markKind==='number'?circuitNumbers(data.get('numbers')):[shape==='other'?data.get('custom'):shape];
      const next=structuredClone(session),result=addCircuitRoutes(next,markKind,marks,data.get('wall'));
      write(next);selection=result.selected;onlyRemaining=false;screen='run';
      say(result.added?result.added+'課題を追加しました。':'登録済みの課題を選びました。');
    }
    render();
  }
  // Serialize draft writes and the final commit across tabs of this account.
  async function perform(fn,needsLock=true){
    if(busy)return;busy=true;
    try{const run=()=>{if(!dialog.open)return;checkOwner();say('');fn();};if(needsLock&&navigator.locks)await navigator.locks.request(key,run);else run();}
    catch(e){say(e.message||'保存できませんでした。端末の空き容量を確認してください。');}
    finally{busy=false;}
  }
  dialog.addEventListener('submit',e=>{e.preventDefault();void perform(()=>submit(e.target));});
  dialog.addEventListener('click',e=>{
    const b=e.target.closest('button[type=button]');if(!b)return;
    void perform(()=>{
      if(b.dataset.shape){shape=b.dataset.shape;updateMarkFields();return}
      if(b.dataset.routeIndex!==undefined){
        selection=Number(b.dataset.routeIndex);run();
        const current=$('.circuitCurrent'),card=current.getBoundingClientRect(),frame=dialog.getBoundingClientRect();
        if(card.bottom>frame.bottom||card.top<frame.top){
          current.scrollIntoView({block:'nearest'});(current.querySelector('button:not(:disabled)')||$('[data-circuit=finish]')).focus({preventScroll:true});
        }else body.querySelector('[aria-pressed=true][data-route-index]')?.focus({preventScroll:true});
        return;
      }
      action(b.dataset.circuit);
    },['sent','fall','undo','save','discard','fresh'].includes(b.dataset.circuit));
  });
  return {open};
}
