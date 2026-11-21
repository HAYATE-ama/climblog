import {toyotaGradeSystem} from './outdoor-grades.mjs';
import {buildOutdoorCharts,chartCeiling} from './outdoor-stats-model.mjs';
import {escapeHtml as esc} from './data-utils.mjs';

const tabs={grades:'グレード別',months:'月別',crags:'岩場別'};
const titles={grades:'グレード別の完登',months:'月ごとの積み重ね',crags:'登った岩場の内訳'};
const legend='<div class="outdoorChartLegend"><span><i></i>新規完登</span><span><i class="repeat"></i>再登</span></div>';
export function installOutdoorStats({selectRecords,viewRecord}){
 const $=id=>document.getElementById(id),root=document.createElement('section');
 root.id='outdoorGraphs';root.hidden=true;
 root.innerHTML='<div class="outdoorChartTabs" role="tablist" aria-label="外岩グラフの切り替え">'+Object.entries(tabs).map(([key,label])=>`<button type="button" role="tab" id="outdoorTab-${key}" aria-controls="outdoorChartPanel" aria-selected="${key==='grades'}" data-outdoor-chart="${key}">${label}</button>`).join('')+'</div><section id="outdoorChartPanel" role="tabpanel" aria-labelledby="outdoorTab-grades"><div class="outdoorChartHeading"><h3 id="outdoorChartTitle"></h3><span>完登回数</span></div><label id="outdoorChartScaleWrap" hidden>グレード体系<select id="outdoorChartScale"></select></label><div id="outdoorChartPlot"></div><div id="outdoorChartPager"></div></section><button type="button" id="outdoorAllRecords" class="outdoorAllRecords"><span>このシーズンの記録</span><span id="outdoorAllCount"></span></button><p class="sub outdoorChartHint">グラフを押すと課題を確認できます。敗退・重複を含む全記録は上のボタンから。</p><span class="outdoorChartLive" id="outdoorChartLive" role="status"></span>';
 $('outdoorDanSummary').after(root);
 const source=document.querySelector('.statsSourceCard'),extra=$('statsExtraDetails');
 const sourceMarker=document.createComment('statistics sources'),extraMarker=document.createComment('statistics details');source.before(sourceMarker);extra.before(extraMarker);
 const dialog=document.createElement('dialog');dialog.id='outdoorStatsRecords';dialog.setAttribute('aria-labelledby','outdoorStatsRecordsTitle');
 dialog.innerHTML='<header><h2 id="outdoorStatsRecordsTitle">このシーズンの記録</h2><button type="button" data-outdoor-close aria-label="記録一覧を閉じる">×</button></header><div class="outdoorStatsRecordsBody"></div><footer><button type="button" data-outdoor-close>グラフに戻る</button></footer>';document.body.append(dialog);
 const body=dialog.querySelector('.outdoorStatsRecordsBody');
 let active=false,model=null,filtering=false,view='grades',scale='',page=0,monthPage=0,rangeKey='',plotRows=[],trigger=null,bodyStyle=null,scrollY=0;
 function close(focus=true){
  if(dialog.open)dialog.close();
  if(bodyStyle){Object.assign(document.body.style,bodyStyle);bodyStyle=null;window.scrollTo({top:scrollY,left:0,behavior:'instant'});}
  if(focus&&trigger?.isConnected)trigger.focus({preventScroll:true});trigger=null;
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{if(!dialog.open)close();});
 dialog.addEventListener('click',event=>{
  if(event.target.closest('[data-outdoor-close]'))close();
  const record=event.target.closest('[data-stats-record]');
  if(record){const opener=trigger?.isConnected?trigger:$('outdoorAllRecords');close(false);viewRecord(record.dataset.statsRecord,opener);}
 });
 function showRecords(ids,title,opener){
  trigger=opener;filtering=ids!==null;selectRecords(ids,title);$('outdoorStatsRecordsTitle').textContent=title;extra.hidden=ids!==null;
  scrollY=window.scrollY;bodyStyle=Object.fromEntries(['position','top','left','right','width','overflow'].map(key=>[key,document.body.style[key]]));
  Object.assign(document.body.style,{position:'fixed',top:-scrollY+'px',left:'0',right:'0',width:'100%',overflow:'hidden'});
  dialog.showModal();body.scrollTop=0;dialog.querySelector('[data-outdoor-close]').focus({preventScroll:true});
 }
 function setActive(value){
  root.hidden=!value;if(active===value)return;active=value;
  if(value){body.append(source,extra);}else{close(false);sourceMarker.after(source);extraMarker.after(extra);}
 }
 function groupLabel(group){const [discipline,system]=JSON.parse(group);return (discipline==='lead'?'リード':'ボルダー')+' · '+system;}
 function bar(group,index,max){
  return `<button type="button" class="outdoorGradeBar" data-outdoor-group="${index}" aria-label="${esc(group.label+'、新規'+group.fresh+'課題、再登'+group.repeat+'回。記録を見る')}"><span class="outdoorGradeLabel">${esc(group.label)}</span><span class="outdoorBarTrack" aria-hidden="true"><i style="width:${group.fresh/max*100}%"></i><i class="repeat" style="width:${group.repeat/max*100}%"></i></span><span>${group.total}回</span></button>`;
 }
 function pager(total,start){
  if(total<=6)return '';
  return `<button type="button" data-outdoor-page="-1" aria-label="前の${view==='months'?'6か月':'6項目'}" ${start===0?'disabled':''}>‹ 前へ</button><span>${start+1}–${Math.min(start+6,total)} / ${total}${view==='months'?'か月':'項目'}</span><button type="button" data-outdoor-page="1" aria-label="次の${view==='months'?'6か月':'6項目'}" ${start+6>=total?'disabled':''}>次へ ›</button>`;
 }
 function draw(){
  if(!model)return;
  for(const button of root.querySelectorAll('[data-outdoor-chart]'))button.setAttribute('aria-selected',String(button.dataset.outdoorChart===view));
  $('outdoorChartPanel').setAttribute('aria-labelledby','outdoorTab-'+view);$('outdoorChartTitle').textContent=view==='grades'&&model.systems.length===1&&JSON.parse(model.systems[0])[1]===toyotaGradeSystem?'豊田式の完登':titles[view];
  $('outdoorChartScaleWrap').hidden=view!=='grades'||model.systems.length<2;
  $('outdoorChartScale').innerHTML=model.systems.map(s=>`<option value="${esc(s)}">${esc(groupLabel(s))}</option>`).join('');$('outdoorChartScale').value=scale;
  let html='',paging='';
  if(view==='grades'){
   const groups=model.grades.filter(g=>JSON.stringify([g.discipline,g.system])===scale);page=Math.min(page,Math.max(0,Math.ceil(groups.length/6)-1));plotRows=groups.slice(page*6,page*6+6);const max=chartCeiling(groups.map(g=>g.total));
   html=legend+(groups.length?'<div class="outdoorGradeBars">'+plotRows.map((g,i)=>bar(g,i,max)).join('')+'</div><div class="outdoorBarAxis" aria-hidden="true">'+[0,1,2,3,4].map(n=>'<span>'+n*max/4+'</span>').join('')+'</div>':'<p class="emptyStats">この期間の完登記録はありません。</p>');paging=pager(groups.length,page*6);
  }else if(view==='months'){
   plotRows=model.months.slice(monthPage*6,monthPage*6+6);const max=chartCeiling(model.months.map(g=>g.total));
   html=legend+'<div class="outdoorMonthPlot"><div class="outdoorMonthGrid" aria-hidden="true">'+[0,1,2,3,4].map(n=>`<span style="bottom:${n*25}%">${n*max/4}</span>`).join('')+'</div><div class="outdoorMonthBars">'+plotRows.map((g,i)=>`<button type="button" data-outdoor-group="${i}" ${!g.total?'disabled':''} aria-label="${esc(g.label+'、'+(g.future&&!g.total?'未到来':'新規'+g.fresh+'課題、再登'+g.repeat+'回。記録を見る'))}"><span class="outdoorMonthValue">${g.future&&!g.total?'—':g.total+'回'}</span><span class="outdoorMonthColumn" aria-hidden="true" style="height:${g.total/max*168}px"><i style="height:${g.total?g.fresh/g.total*100:0}%"></i><i class="repeat" style="height:${g.total?g.repeat/g.total*100:0}%"></i></span></button>`).join('')+'</div></div><div class="outdoorMonthLabels">'+plotRows.map(g=>'<span>'+g.label.slice(2)+'</span>').join('')+'</div><p class="sub outdoorChartHint">年月ごとの完登。未来の月の「—」は0回を意味しません。</p>';paging=pager(model.months.length,monthPage*6);
  }else{
   plotRows=model.crags;let offset=0;const perimeter=2*Math.PI*66;
   const circles=plotRows.map((g,i)=>{const length=g.total/model.total*perimeter;const markup=`<circle class="outdoorRingPart ring-${i}" cx="95" cy="95" r="66" transform="rotate(-90 95 95)" stroke-dasharray="${Math.max(0,length-Math.min(3,length/4))} ${perimeter}" stroke-dashoffset="${-offset}" data-outdoor-group="${i}"><title>${esc(g.label+'：'+g.total+'回')}</title></circle>`;offset+=length;return markup;}).join('');
   html=model.total?'<div class="outdoorCragPlot"><svg viewBox="0 0 190 190" role="img" aria-label="'+esc('岩場別の完登回数。'+plotRows.map(g=>g.label+' '+g.total+'回').join('、'))+'">'+circles+'<text x="95" y="97" text-anchor="middle" class="outdoorRingValue">'+model.total+'</text><text x="95" y="121" text-anchor="middle" class="outdoorRingCaption">完登回数</text></svg><div class="outdoorCragLegend">'+plotRows.map((g,i)=>`<button type="button" data-outdoor-group="${i}" aria-label="${esc(g.label+'、新規'+g.fresh+'課題、再登'+g.repeat+'回。記録を見る')}"><i class="ring-${i}"></i><span><b>${esc(g.label)} · ${g.total}回</b><small>新規 ${g.fresh} / 再登 ${g.repeat}</small></span></button>`).join('')+'</div></div>':'<p class="emptyStats">完登を記録すると、岩場の内訳が表示されます。</p>';
  }
  $('outdoorChartPlot').innerHTML=html;$('outdoorChartPager').innerHTML=paging;$('outdoorChartPager').hidden=!paging;
 }
 root.addEventListener('click',event=>{
  const tab=event.target.closest('[data-outdoor-chart]'),group=event.target.closest('[data-outdoor-group]'),move=event.target.closest('[data-outdoor-page]');
  if(tab){view=tab.dataset.outdoorChart;draw();$('outdoorChartLive').textContent=titles[view]+'を表示しました。';}
  if(group){const g=plotRows[Number(group.dataset.outdoorGroup)];if(g){const opener=group.tagName.toLowerCase()==='circle'?root.querySelector('button[data-outdoor-group="'+group.dataset.outdoorGroup+'"]'):group;showRecords(g.ids,g.label+'の完登',opener);}}
  if(move){const direction=Number(move.dataset.outdoorPage);if(view==='months')monthPage+=direction;else page+=direction;draw();const buttons=[...$('outdoorChartPager').querySelectorAll('button:not(:disabled)')];(buttons.find(b=>b.dataset.outdoorPage===String(direction))||buttons[0])?.focus({preventScroll:true});$('outdoorChartLive').textContent=$('outdoorChartPager').textContent;}
 });
 root.querySelector('[role=tablist]').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;const buttons=[...root.querySelectorAll('[data-outdoor-chart]')],index=buttons.indexOf(event.target);if(index<0)return;event.preventDefault();const next=buttons[(index+(event.key==='ArrowRight'?1:2))%3];next.click();next.focus();});
 $('outdoorChartScale').onchange=event=>{scale=event.target.value;page=0;draw();};$('outdoorAllRecords').onclick=event=>showRecords(null,'このシーズンの記録',event.currentTarget);
 function render(data,today){
  model=buildOutdoorCharts(data.rows,data.range,data.extra.dan,today);const nextRange=data.range.from+'/'+data.range.to;
  if(nextRange!==rangeKey){rangeKey=nextRange;page=0;monthPage=model.monthPage;close(false);}
  if(!model.systems.includes(scale))scale=model.systems[0]||'';
  const d=data.extra.dan,isCurrent=today>=data.range.from&&today<=data.range.to;
  $('outdoorDanSummary').innerHTML='<div class="outdoorHeroTop"><h3>'+(isCurrent?'今シーズン':'選択シーズン')+'の新規完登</h3>'+(model.highest?'<span>最高 '+esc(model.highest)+'<small>日本・ボルダー</small></span>':'')+'</div><div class="outdoorDanTotal"><strong id="outdoorDanValue">'+d.newDan+'<small>段</small></strong><span>（再登込み'+d.totalDan+'段）</span></div><div class="outdoorHeroBottom"><span><b>'+d.newProblems+'</b>課題を新規完登</span><span>再登 <b>'+d.repeatAscents+'</b>回</span></div><details class="outdoorCounting"><summary>数え方'+(model.excluded?'・重複 '+model.excluded+'件':'')+'</summary><p>新規は同じ課題をシーズン内に1回、再登は同じ課題・同じ日を1回として集計します。同日重複は加算しません。</p><p>段数は日本のボルダーのみ。＋・−は元の段数、中間表記は0.5段です。級・他の体系・未設定グレードもグラフの完登回数には含みます。</p></details>';
  if(model.grades.some(g=>g.system===toyotaGradeSystem))$('outdoorDanSummary').insertAdjacentHTML('beforeend','<p class="sub">豊田式の完登は段数に換算せず、グレード別グラフで表示します。</p>');
  $('outdoorAllCount').textContent=data.rows.length+'件 ›';draw();if(dialog.open)extra.hidden=filtering;
 }
 return {setActive,render,close};
}
