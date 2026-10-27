import {createOutdoorSettingsPanel} from './outdoor-settings.mjs';
// One modal surface; categories and tools switch inside it without changing the page.
export function installSettingsDrawer(){
 if(window.climbLogSettings)return;
 const $=id=>document.getElementById(id),view=$('settingsView'),home=$('settingsHome'),gym=$('gymSettingsView'),body=$('bodyWeightSettings'),gear=$('settingsTab');
 const groups=[...home.querySelectorAll('.settingGroup')],appearance=groups.find(g=>g.querySelector('#themeSetting')),data=groups.find(g=>g.querySelector('#exportData'));
 const drawer=document.createElement('dialog');drawer.id='settingsDrawer';drawer.className='settingsDrawer';drawer.setAttribute('aria-labelledby','settingsDrawerTitle');
 drawer.innerHTML=`<div class="settingsDrawerHead"><button type="button" id="settingsDrawerBack" aria-label="設定の項目一覧に戻る" hidden>‹ 戻る</button><h2 id="settingsDrawerTitle">設定</h2><button type="button" id="settingsDrawerClose" aria-label="設定を閉じる">×</button></div><div class="settingsDrawerScroll"><section id="settingsDrawerMenu" aria-label="設定項目"><nav class="settingsDrawerList" aria-label="設定の項目"><button type="button" id="settingsAppearance" data-settings-panel="appearance">表示・カレンダー <span aria-hidden="true">›</span></button><button type="button" id="settingsOutdoor" data-settings-panel="outdoor">外岩の候補日 <span aria-hidden="true">›</span></button><button type="button" id="settingsBody" data-settings-panel="body">身体情報 <span aria-hidden="true">›</span></button><button type="button" id="settingsGyms" data-settings-panel="gym">ジム・グレード <span aria-hidden="true">›</span></button><button type="button" id="settingsData" data-settings-panel="data">データ管理 <span aria-hidden="true">›</span></button></nav><div class="settingsDrawerFooter" id="settingsDrawerFooter"></div></section></div>`;
 document.body.append(drawer);drawer.querySelector('.settingsDrawerScroll').append(view);home.hidden=true;view.hidden=false;
 const appearancePanel=document.createElement('section');appearancePanel.id='settingsAppearancePanel';appearancePanel.append(appearance);view.append(appearancePanel);
 const dataPanel=document.createElement('section');dataPanel.id='settingsDataPanel';dataPanel.append(data);view.append(dataPanel);
 $('settingsDrawerFooter').append($('settingsSyncStatus'),$('signOut'));
 const tools=$('dataDialog');tools.classList.add('settingsEmbeddedTools');view.append(tools);
 const toolClose=tools.querySelector('[data-close]');toolClose.onclick=()=>choose('data');
 const outdoor=createOutdoorSettingsPanel();view.append(outdoor.panel);
 const panels={outdoor:outdoor.panel,appearance:appearancePanel,body,gym,data:dataPanel,dataTools:tools},titles={outdoor:'外岩の候補日',appearance:'表示・カレンダー',body:'身体情報',gym:'ジム・グレード',data:'データ管理',dataTools:'復元・ゴミ箱・履歴'};
 let current='menu',scrollY=0,previousBodyStyle=null,bodyBaseline='',gymBaseline='',lastTrigger=null,forceClosing=false;
 const bodySnapshot=()=>JSON.stringify([...$('bodyProfileForm').querySelectorAll('input')].map(el=>[el.id,el.value]));
 function dirty(){return current==='outdoor'?outdoor.isDirty():current==='body'?bodySnapshot()!==bodyBaseline:current==='gym'?window.climbLogGymEditor.snapshot()!==gymBaseline:false;}
 function mayLeave(){if(!dirty())return true;if(!confirm('未保存の変更があります。変更を破棄して続けますか？'))return false;if(current==='gym')window.climbLogGymEditor.restore(gymBaseline);return true;}
 function paintPanel(panel){current=panel;for(const [name,el]of Object.entries(panels))el.hidden=name!==panel;home.hidden=true;$('settingsDrawerMenu').hidden=panel!=='menu';$('settingsDrawerBack').hidden=panel==='menu';$('settingsDrawerTitle').textContent=titles[panel]||'設定';drawer.querySelector('.settingsDrawerScroll').scrollTop=0;if(panel==='dataTools')tools.setAttribute('open','');else tools.removeAttribute('open');}
 function choose(panel,{focus=true,check=true}={}){if(check&&!mayLeave())return false;
  if(panel==='outdoor')outdoor.load();if(panel==='body')$('openBodyWeight').click();if(panel==='gym')$('openGymSettings').click();
  paintPanel(panel);if(panel==='body')bodyBaseline=bodySnapshot();if(panel==='gym')gymBaseline=window.climbLogGymEditor.snapshot();
  if(focus)(panel==='menu'?lastTrigger||$('settingsAppearance'):$('settingsDrawerBack')).focus({preventScroll:true});return true;
 }
 function unlockScroll(){if(!previousBodyStyle)return;Object.assign(document.body.style,previousBodyStyle);previousBodyStyle=null;window.scrollTo({top:forceClosing?0:scrollY,left:0,behavior:'instant'});}
 function close(force=false){if(!drawer.open)return true;if(!force&&!mayLeave())return false;forceClosing=force;drawer.close();unlockScroll();gear.setAttribute('aria-expanded','false');if(!force)gear.focus({preventScroll:true});return true;}
 function open(){if(drawer.open)return;view.hidden=false;forceClosing=false;scrollY=window.scrollY;previousBodyStyle=Object.fromEntries(['position','top','left','right','width','overflow'].map(k=>[k,document.body.style[k]]));Object.assign(document.body.style,{position:'fixed',top:`-${scrollY}px`,left:'0',right:'0',width:'100%',overflow:'hidden'});
  $('themeSetting').value=window.climbLogStateApi.get().preferences?.theme||'dark';$('weekStartSetting').value=String(window.climbLogStateApi.get().preferences?.weekStart??1);$('settingsSyncStatus').textContent='同期状態：'+$('syncState').textContent;
  paintPanel('menu');drawer.showModal();gear.setAttribute('aria-expanded','true');$('settingsDrawerClose').focus({preventScroll:true});
 }
 gear.setAttribute('aria-controls','settingsDrawer');gear.setAttribute('aria-expanded','false');gear.setAttribute('aria-haspopup','dialog');gear.onclick=open;
 drawer.addEventListener('click',event=>{const b=event.target.closest('[data-settings-panel]');if(b){lastTrigger=b;choose(b.dataset.settingsPanel);}});
 $('settingsDrawerBack').onclick=()=>choose(current==='dataTools'?'data':'menu');$('settingsDrawerClose').onclick=()=>close();
 drawer.addEventListener('cancel',event=>{event.preventDefault();close();});
 drawer.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...drawer.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(!first)return;if(event.shiftKey&&(document.activeElement===first||!drawer.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!drawer.contains(document.activeElement))){event.preventDefault();first.focus();}});

 let backdropDown=false;const outside=e=>{const r=drawer.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};drawer.addEventListener('pointerdown',e=>{backdropDown=e.target===drawer&&outside(e);});drawer.addEventListener('click',e=>{if(e.target===drawer&&backdropDown&&outside(e))close();backdropDown=false;});
 drawer.addEventListener('close',()=>{unlockScroll();gear.setAttribute('aria-expanded','false');});
 for(const id of ['settingsBack','bodyWeightBack'])$(id).addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();choose('menu');},true);
 $('bodyProfileForm').addEventListener('submit',()=>queueMicrotask(()=>{if(/保存しました/.test($('bodyProfileMessage').textContent))bodyBaseline=bodySnapshot();}));
 $('saveGym').addEventListener('click',()=>{const snapshot=window.climbLogGymEditor.snapshot();if(localStorage.getItem('climbLogGyms')===snapshot)gymBaseline=snapshot;});
 new MutationObserver(()=>{if(drawer.open)$('settingsSyncStatus').textContent='同期状態：'+$('syncState').textContent;}).observe($('syncState'),{childList:true,characterData:true,subtree:true});
 window.addEventListener('climblog:authLock',()=>close(true));
 window.climbLogSettings={open,close,openDataTools:()=>{if(!drawer.open)open();choose('dataTools');}};
 paintPanel('menu');
}
