import {weatherComparisonInput,weatherConsentVersion} from './outdoor-planner-model.mjs';
const messages={NOT_ALLOWED:'このアカウントは天気AIの利用対象に設定されていません。',CONSENT_REQUIRED:'送信内容の確認が必要です。',PROVIDER_AUTH:'サーバー側のGeminiキー・利用権限を確認してください。',PROVIDER_NOT_FOUND:'サーバー側のGeminiモデルを確認してください。',INPUT_LIMIT:'比較対象が多すぎます。岩場の数や特徴の文章を減らしてください。',SETUP_REQUIRED:'天気AIのサーバー配置が必要です。通常の天気表示は使えます。',DAILY_LIMIT:'今日の天気AIは利用済みです。明日また比較できます。',RATE_LIMIT:'AIコーチを含む利用間隔を空けてから、手動で確認してください。',MONTHLY_LIMIT:'今月のAI利用上限です。通常の天気表示をご利用ください。',AUTH_REQUIRED:'再ログインしてからお試しください。',PROVIDER_LIMIT:'Geminiの無料枠上限です。自動再試行はしません。',STALE_INPUT:'予報が更新されています。天気を再取得してください。',INVALID_AI_RESPONSE:'AIの回答を確認できませんでした。通常の判定をご利用ください。'};
export function createWeatherAdvisor({rows,style}){
 let result=null,resultKey='',busy=false,configured=false,opened=false,message='',epoch=0,locked=false,consented=false,used=false;
 function input(){return weatherComparisonInput(rows(),style());}
 async function request(action,host){if(busy||locked)return;busy=true;message=action==='compare'?'候補日を比較しています…':'接続と今日の利用状況を確認しています…';const ticket=epoch;render(host);try{
  const value=input(),key=JSON.stringify(value),transport=window.climbLogCoachTransport;if(!transport)throw new Error('SETUP_REQUIRED');
  const data=await transport.request({action,...(action==='compare'?{input:value,consentVersion:weatherConsentVersion}:{})},{service:'weather-advisor'});
  if(ticket!==epoch||locked)return;
  configured=data.configured===true;used=data.used===true;
  if(data.result&&data.inputHash&&data.inputKey===key){result=data.result;resultKey=key;message='同じ条件の比較結果を表示しています。';}
  else if(data.result){result=null;message='前回の比較後に予報・条件が変わりました。数値判定は最新です。AIは1日1回までのため再比較できません。';}
  else message=data.used?'今日はすでに1回利用しています（失敗も含みます）。通常の判定をご利用ください。':configured?'比較できます。複数の岩場をまとめて1日1回まで。':'天気AIのサーバー配置が必要です。';
 }catch(error){if(['DAILY_LIMIT','PROVIDER_LIMIT','PROVIDER_AUTH','PROVIDER_NOT_FOUND','PROVIDER_UNAVAILABLE','PROVIDER_TIMEOUT','INVALID_AI_RESPONSE','GENERATION_FAILED'].includes(error.message))used=true;if(ticket===epoch&&!locked)message=messages[error.message]||'比較できませんでした。自動再試行はしません。通常の天気表示をご利用ください。';}
 finally{if(ticket===epoch&&!locked){busy=false;render(host);}}
 }
 function render(host){host.replaceChildren();if(locked)return;const details=document.createElement('details');details.className='weatherAdvisor';details.open=opened;details.ontoggle=()=>{opened=details.open;};const summary=document.createElement('summary');summary.textContent='AIで候補日を比較（手動・1日1回）';details.append(summary);
 const note=document.createElement('p');note.textContent='岩場名・地域予報・岩場の特徴・活動時間帯・比較の目的をGoogleへ送ります。出発地点・身体情報・トレーニング記録は送りません。無料枠では入力・回答が製品改善に使われ、人が確認する場合があります。個人情報は岩場の特徴に入力しないでください。';details.append(note);
 const consent=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=consented;consent.append(checkbox,document.createTextNode('この送信内容で天気AIを利用する'));details.append(consent);
 const terms=document.createElement('a');terms.href='https://ai.google.dev/gemini-api/terms';terms.target='_blank';terms.rel='noopener noreferrer';terms.textContent='Googleの利用条件';details.append(terms);
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent=message;details.append(status);
 const controls=document.createElement('div');controls.className='weatherActions';const check=document.createElement('button');check.type='button';check.textContent='接続・利用状況を確認';check.disabled=busy;check.onclick=()=>request('status',host);
 const generate=document.createElement('button');generate.type='button';generate.textContent=busy?'処理中…':used?'今日は比較済み':'候補日をまとめて比較';generate.disabled=busy||used||!configured||!consented||!rows().length;generate.onclick=()=>request('compare',host);checkbox.onchange=()=>{consented=checkbox.checked;generate.disabled=busy||used||!configured||!consented||!rows().length;};controls.append(check,generate);details.append(controls);
 let key='';try{key=JSON.stringify(input());}catch{}
 if(result&&resultKey===key){const h=document.createElement('strong');h.textContent='AIの比較・参考説明';const p=document.createElement('p');p.textContent=result.summary;details.append(h,p);const extra=document.createElement('details');const extraTitle=document.createElement('summary');extraTitle.textContent='ほかの候補も見る';extra.append(extraTitle);let index=0;for(const item of result.comparisons||[]){const row=rows().find(r=>r.id===item.id);if(!row)continue;const line=document.createElement('p');line.textContent=row.crag+' '+row.date+'：'+item.explanation;(index++<3?details:extra).append(line);}if(index>3)details.append(extra);}
 else if(result){const p=document.createElement('p');p.textContent='予報・条件が変わったため、以前のAI比較は非表示です。';details.append(p);}
 const caution=document.createElement('small');caution.textContent='判定・順位の参考説明です。AIは予報や現地状況を取得せず、安全や乾燥を保証しません。数値判定はAI利用上限に関係なく更新します。';details.append(caution);host.append(details);
 }
 window.addEventListener('climblog:authLock',()=>{locked=true;epoch++;busy=false;result=null;resultKey='';consented=false;});
 return {render};
}
