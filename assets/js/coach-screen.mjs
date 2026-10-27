import {coachPurposes,coachEquipment,normalizeCoachOptions} from './coach-model.mjs';
import {coachService} from './coach-service.mjs';
export function installCoachScreen(){
 const view=document.getElementById('coachView');
 view.innerHTML=`<section class="card coachIntro"><div><p class="coachEyebrow">KOHAKU'S COACHING ROOM</p><div class="coachTitle"><h2>次の一手を、一緒に考える。</h2><span class="coachStatus">開発中</span></div><p class="sub">ウォームアップやトレーニングを、あなたの記録に合わせて提案する機能を準備しています。</p></div><span class="coachPortrait" aria-hidden="true">✦</span></section>
 <div class="coachNotice" role="note"><strong>AIコーチは、まだメニューを生成しません。</strong><p>目的・時間・器具の選択を試せます。入力内容や過去の記録を外部AIへ送信することはありません。</p></div>
 <div class="coachGrid"><section class="card coachSetup"><div class="coachSectionHead"><div><h3>今日の条件</h3><p class="sub">画面の操作を試せます。選択内容はこの画面を開いている間だけ保持します。</p></div></div>
 <form id="coachForm"><label for="coachPurpose">目的</label><select id="coachPurpose">${coachPurposes.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><div class="coachFields"><div><label for="coachMinutes">使える時間（分）</label><input id="coachMinutes" type="number" min="5" max="180" step="1" value="30" inputmode="numeric"></div><div><label for="coachLocation">場所</label><select id="coachLocation"><option value="gym">ジム</option><option value="home">自宅</option><option value="outdoor">外岩</option></select></div></div>
 <details class="coachEquipmentOptions"><summary id="coachEquipmentSummary">使える器具：未選択</summary><fieldset><legend>使える器具</legend><p class="sub">器具なしの場合は未選択で構いません。</p><div class="coachEquipment">${coachEquipment.map(([key,label])=>`<label><input type="checkbox" name="coachEquipment" value="${key}"><span>${label}</span></label>`).join('')}</div></fieldset></details><p id="coachFormStatus" role="status"></p><button id="generateCoachPlan" type="button" class="primary" disabled aria-describedby="coachGenerationNote">メニューを生成する · 開発中</button><p class="sub" id="coachGenerationNote">AI接続後に利用できる予定です。まだ提案や実施記録は作成されません。</p></form></section>
 </div>`;
 const form=view.querySelector('#coachForm'),status=view.querySelector('#coachFormStatus');
 function refresh(){try{
  const options={purpose:form.querySelector('#coachPurpose').value,availableMinutes:Number(form.querySelector('#coachMinutes').value),location:form.querySelector('#coachLocation').value,equipment:[...form.querySelectorAll('[name=coachEquipment]:checked')].map(el=>el.value)};
  normalizeCoachOptions(options);
  form.querySelector('#coachEquipmentSummary').textContent='使える器具：'+(options.equipment.length?options.equipment.length+'種類を選択':'未選択');
  status.textContent='';form.querySelector('#coachMinutes').removeAttribute('aria-invalid');
 }catch(error){status.textContent=error.message;form.querySelector('#coachMinutes').setAttribute('aria-invalid','true');}}
 form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',refresh);form.addEventListener('change',refresh);
 window.addEventListener('climblog:coachOpened',refresh);window.addEventListener('climblog:stateChanged',()=>{if(!view.hidden)refresh();});
 if(coachService.capabilities.status!=='development'||coachService.capabilities.canGenerate)throw new Error('Unexpected coach capabilities');
 refresh();
}
