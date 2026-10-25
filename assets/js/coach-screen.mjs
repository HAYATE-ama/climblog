import {coachPurposes,coachEquipment,buildCoachRequest} from './coach-model.mjs';
import {coachService} from './coach-service.mjs';
import {escapeHtml as esc} from './data-utils.mjs';
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function installCoachScreen(){
 const view=document.getElementById('coachView');
 view.innerHTML=`<section class="card coachIntro"><div><p class="coachEyebrow">KOHAKU'S COACHING ROOM</p><div class="coachTitle"><h2>次の一手を、一緒に考える。</h2><span class="coachStatus">開発中</span></div><p class="sub">ウォームアップやトレーニングを、あなたの記録に合わせて提案する機能を準備しています。</p></div><span class="coachPortrait" aria-hidden="true">✦</span></section>
 <div class="coachNotice" role="note"><strong>AIコーチは、まだメニューを生成しません。</strong><p>条件の選択と、端末内の記録状況の確認ができます。入力内容や過去の記録を外部AIへ送信することはありません。</p></div>
 <div class="coachGrid"><section class="card coachSetup"><div class="coachSectionHead"><span>01</span><div><h3>今日の条件</h3><p class="sub">画面の操作を試せます。選択内容はこの画面を開いている間だけ保持します。</p></div></div>
 <form id="coachForm"><label for="coachPurpose">目的</label><select id="coachPurpose">${coachPurposes.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><div class="coachFields"><div><label for="coachMinutes">使える時間（分）</label><input id="coachMinutes" type="number" min="5" max="180" step="1" value="30" inputmode="numeric"></div><div><label for="coachLocation">場所</label><select id="coachLocation"><option value="gym">ジム</option><option value="home">自宅</option><option value="outdoor">外岩</option></select></div></div>
 <fieldset><legend>使える器具</legend><p class="sub">器具なしの場合は未選択で構いません。</p><div class="coachEquipment">${coachEquipment.map(([key,label])=>`<label><input type="checkbox" name="coachEquipment" value="${key}"><span>${label}</span></label>`).join('')}</div></fieldset><p id="coachFormStatus" role="status"></p><button id="generateCoachPlan" type="button" class="primary" disabled aria-describedby="coachGenerationNote">メニューを生成する · 開発中</button><p class="sub" id="coachGenerationNote">AI接続後に利用できる予定です。まだ提案や実施記録は作成されません。</p></form></section>
 <div class="coachSide"><section class="card"><div class="coachSectionHead"><span>02</span><div><h3>参照できる記録</h3><p class="sub">今日を含む直近28日間を、この端末内で集計します。</p></div></div><div id="coachContext"></div><div class="coachLinks"><button type="button" data-coach-link="calendar">記録を見る</button><button type="button" data-coach-link="stats">統計を見る</button></div></section>
 <section class="card coachRoadmap"><h3>これからできるようになること</h3><ol><li><strong>記録と条件から提案</strong><span>ウォームアップ・トレーニング・休憩を組み立てる</span></li><li><strong>自分に合わせて調整</strong><span>種目の変更やセット数の編集</span></li><li><strong>実施した分だけ記録</strong><span>実際の内容を既存の一括登録へつなぐ</span></li></ol><p class="sub">生成内容と実施記録を分け、負荷や時間を確認できる設計で進めています。</p></section></div></div>`;
 const form=view.querySelector('#coachForm'),status=view.querySelector('#coachFormStatus');
 function refresh(){try{
  const options={purpose:form.querySelector('#coachPurpose').value,availableMinutes:Number(form.querySelector('#coachMinutes').value),location:form.querySelector('#coachLocation').value,equipment:[...form.querySelectorAll('[name=coachEquipment]:checked')].map(el=>el.value)};
  const request=buildCoachRequest(window.climbLogStateApi.get(),options,localDate()),context=request.context;
  // The request stays in this call; no persistence, global exposure or provider invocation.
  view.querySelector('#coachContext').innerHTML=`<p class="coachPeriod">${esc(context.window.fromDate)} 〜 ${esc(context.window.toDate)}</p><dl class="coachMetrics"><div><dt>登った日</dt><dd>${context.climbingDays}<small>日</small></dd></div><div><dt>通常トレーニング</dt><dd>${context.routineCount}<small>件</small></dd></div><div><dt>セット数</dt><dd>${context.routineSets}<small>セット</small></dd></div><div><dt>測定条件</dt><dd>${context.measurementGroups.length}<small>種類</small></dd></div></dl>${!context.recordCount?'<p class="coachEmpty">この期間にはまだ記録がありません。記録が増えると、ここに集計が表示されます。</p>':''}<ul class="coachReadiness"><li>文章の目標：${context.hasWrittenGoal?'登録あり':'未登録'}</li><li>今日のコンディション：${context.hasTodayCondition?'記録あり':'未記録'}</li></ul><p class="sub">握り方・厚さ・保持時間・左右・負荷の基準は分けて扱います。体調や負荷の適否を判定する機能はまだありません。</p>`;
  status.textContent='';form.querySelector('#coachMinutes').removeAttribute('aria-invalid');
 }catch(error){status.textContent=error.message;form.querySelector('#coachMinutes').setAttribute('aria-invalid','true');}}
 form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',refresh);form.addEventListener('change',refresh);
 view.addEventListener('click',event=>{const button=event.target.closest('[data-coach-link]');if(button)window.climbLogNavigate(button.dataset.coachLink);});
 window.addEventListener('climblog:coachOpened',refresh);window.addEventListener('climblog:stateChanged',()=>{if(!view.hidden)refresh();});
 if(coachService.capabilities.status!=='development'||coachService.capabilities.canGenerate)throw new Error('Unexpected coach capabilities');
 refresh();
}
