import {toyotaGradeSystem,toyotaGrades,preferredOutdoorSystem} from './outdoor-grades.mjs';

// Keep the existing select as the record/draft source of truth.
export function installOutdoorGradePicker({select,system,discipline,crag,setSystem,getPreferences}){
 const root=document.createElement('div');root.className='toyotaGradePicker';root.hidden=true;
 root.innerHTML='<p class="toyotaGradeHelp">豊田式 · トポの小文字表記で記録します</p><div class="toyotaGradeLetters" role="group" aria-label="豊田式のグレード"></div><label class="toyotaGradeCustom" hidden>トポの表記<input maxlength="12" placeholder="例：f+、h" autocomplete="off" autocapitalize="none" spellcheck="false"></label><div class="toyotaGradeExtras"><button type="button" data-toyota-empty>未設定に戻す</button><small>段級への自動換算はしません</small></div>';
 select.after(root);const letters=root.querySelector('.toyotaGradeLetters'),label=root.querySelector('label'),input=root.querySelector('input');
 // Derived input has no ID/name, so drafts and FormData keep just the saved grade.
 const buttons=new Map();for(const value of [...toyotaGrades,'custom']){const b=document.createElement('button');b.type='button';b.dataset.toyotaGrade=value;b.textContent=value==='custom'?'表記を\n入力':value;letters.append(b);buttons.set(value,b);}
 let custom=false,context='',picking=false;
 const key=()=>crag.value.normalize('NFKC').trim()+'|'+discipline.value;
 function sync({reset=false}={}){
  const active=discipline.value==='boulder'&&system.value===toyotaGradeSystem;root.hidden=!active;select.hidden=active;
  if(reset)custom=false;if(select.value&&!toyotaGrades.includes(select.value))custom=true;
  if(toyotaGrades.includes(select.value)&&!picking)custom=false;
  label.hidden=!active||!custom;if(document.activeElement!==input)input.value=custom?select.value:'';
  for(const [value,button]of buttons)button.setAttribute('aria-pressed',String(value==='custom'?custom:!custom&&select.value===value));
 }
 function choose(value){if(![...select.options].some(o=>o.value===value))select.add(new Option(value,value));select.value=value;picking=true;select.dispatchEvent(new Event('change',{bubbles:true}));sync();picking=false;}
 letters.addEventListener('click',event=>{const b=event.target.closest('[data-toyota-grade]');if(!b)return;custom=b.dataset.toyotaGrade==='custom';choose(custom?'':b.dataset.toyotaGrade);if(custom){input.value='';input.focus();}});
 input.addEventListener('input',()=>{const value=input.value.normalize('NFKC').trim().toLowerCase().slice(0,12);choose(value);});
 input.addEventListener('blur',()=>{input.value=select.value;});
 root.querySelector('[data-toyota-empty]').onclick=()=>{custom=false;choose('');};
 select.addEventListener('change',()=>sync());
 system.addEventListener('change',()=>{context=key();sync({reset:true});});
 discipline.addEventListener('change',()=>{context=key();sync({reset:true});});
 crag.addEventListener('input',()=>{
  if(context===key())return;context=key();const preferred=preferredOutdoorSystem(crag.value,discipline.value,getPreferences());
  if(preferred!==system.value){setSystem(preferred);select.dispatchEvent(new Event('change',{bubbles:true}));}sync({reset:true});
 });
 function reset(){context=key();custom=false;sync();}
 reset();return {sync,reset};
}
