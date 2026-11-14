import {coachingReport} from './coaching-report.mjs';
export function installCoachScreen(){
 const view=document.getElementById('coachView'),account=window.climbLogAccountId;
 let locked=false,report=null,stale=false;
 const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const daysAgo=days=>new Date(Date.parse(today()+'T00:00:00+09:00')-(days-1)*86400000+9*3600000).toISOString().slice(0,10);
 view.innerHTML=`<section class="card coachIntro"><div><h2>記録をチャットで相談</h2><p class="sub">① レポートを作成 → ② チャットに貼る → ③ 分析とコースを相談 → ④ アプリへ反映</p><p class="sub">コース生成APIは使用しません。作成・コピーだけでは外部へ送信されません。</p></div></section>
 <section class="card coachSetup"><form id="coachingReportForm"><h3>相談用レポート</h3>
 <label for="coachingPeriod">対象期間<select id="coachingPeriod"><option value="28">直近28日</option><option value="90">直近90日</option><option value="all">全期間</option><option value="custom">日付を指定</option></select></label>
 <div class="coachFields"><label for="coachingFrom">開始日<input id="coachingFrom" type="date"></label><label for="coachingTo">終了日<input id="coachingTo" type="date" required></label></div>
 <label for="coachingGoal">相談したいこと・目標<textarea id="coachingGoal" rows="4" maxlength="2000" placeholder="例：長ものの後半で落ちる。記録から弱点と週の練習メニューを考えてほしい。"></textarea></label>
 <details><summary>含める情報を選ぶ</summary><p class="sub">日付・登攀結果・グレード・種目・セット・回数・時間・重量を含めます。</p><label class="coachCheck"><input id="coachingNotes" type="checkbox"> 記録のメモ</label><label class="coachCheck"><input id="coachingBody" type="checkbox"> 体重・身長・リーチ</label><label class="coachCheck"><input id="coachingLocations" type="checkbox"> ジム名・岩場名・課題名</label></details>
 <button type="submit" class="primary">相談用レポートを作る</button><p id="coachingReportStatus" role="status" aria-live="polite"></p></form>
 <section id="coachingReportResult" hidden><h3>内容を確認してコピー</h3><p class="sub">コピー後、このアプリの開発を相談しているチャットへ貼り付けてください。長い場合はテキストを保存して添付できます。</p><label for="coachingReportText">相談用レポート<textarea id="coachingReportText" readonly rows="12" spellcheck="false"></textarea></label><div class="coachActions"><button type="button" class="primary" id="copyCoachingReport">相談文と記録をコピー</button><button type="button" class="secondary" id="saveCoachingReport">テキストを保存</button></div><p class="sub">内容を相談してから、必要なコースをテンプレートとしてアプリへ追加します。生成だけで実施記録は作りません。</p></section></section>`;
 const $=id=>view.querySelector('#'+id),form=$('coachingReportForm'),status=$('coachingReportStatus');
 $('coachingFrom').value=daysAgo(28);$('coachingTo').value=today();
 function invalidate(){report=null;$('coachingReportResult').hidden=true;$('coachingReportText').value='';status.textContent='';}
 $('coachingPeriod').onchange=()=>{const period=$('coachingPeriod').value;if(period!=='custom'){$('coachingFrom').value=period==='all'?'':daysAgo(Number(period));$('coachingTo').value=today();}invalidate();};
 for(const id of ['coachingFrom','coachingTo'])$(id).oninput=()=>{$('coachingPeriod').value='custom';invalidate();};
 form.addEventListener('input',invalidate);
 form.onsubmit=event=>{event.preventDefault();if(locked||window.climbLogAccountId!==account)return;try{report=coachingReport(window.climbLogStateApi.get(),{from:$('coachingFrom').value,to:$('coachingTo').value,goal:$('coachingGoal').value,notes:$('coachingNotes').checked,body:$('coachingBody').checked,locations:$('coachingLocations').checked});stale=false;$('coachingReportText').value=report.text;$('coachingReportResult').hidden=false;status.textContent=report.payload.summary.recordCount+'件のレポートを作成しました。外部には送信していません。';$('coachingReportResult').scrollIntoView({block:'start',behavior:'instant'});}catch(error){invalidate();status.textContent=error.message;}};
 function current(){if(locked||window.climbLogAccountId!==account)return false;if(stale||!report){status.textContent='記録や条件が変わっています。レポートを作り直してください。';return false;}return true;}
 $('copyCoachingReport').onclick=async()=>{if(!current())return;const text=report.text;try{await navigator.clipboard.writeText(text);if(locked)return;status.textContent='コピーしました。このチャットに貼り付けてください。';}catch{if(locked)return;$('coachingReportText').focus();$('coachingReportText').select();status.textContent='自動コピーできませんでした。選択された文章を長押しなどでコピーするか、テキストを保存してください。';}};
 $('saveCoachingReport').onclick=()=>{if(!current())return;const url=URL.createObjectURL(new Blob([report.text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='climblog-coaching-'+today()+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='相談用テキストを保存しました。';};
 window.addEventListener('climblog:stateChanged',()=>{if(report&&!locked){stale=true;invalidate();status.textContent='記録・設定が更新されました。レポートを作り直してください。';}});
 window.addEventListener('climblog:authLock',()=>{locked=true;report=null;view.replaceChildren();},{once:true});
 window.climbLogAiCoach={openConsent:async()=>{if(!locked)window.climbLogNavigate('coach');},recordAdoption:async()=>{}};
}
