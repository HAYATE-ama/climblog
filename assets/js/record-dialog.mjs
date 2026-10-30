// Keep the existing record editor and draft lifecycle, while isolating modal interaction.
export function installRecordDialog(){
 const modal=document.getElementById('modal'),panel=modal.querySelector('.dialog'),title=document.getElementById('modalTitle');
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','modalTitle');title.tabIndex=-1;
 const background=[...document.getElementById('appRoot').children].filter(el=>el!==modal),cancel=document.getElementById('cancel');
 const head=document.createElement('div');head.className='recordDialogHead';const close=document.createElement('button');close.type='button';close.id='closeRecordDialog';close.textContent='×';close.setAttribute('aria-label','下書きを残して閉じる');close.onclick=()=>cancel.click();title.before(head);head.append(title,close);
 const actions=panel.querySelector(':scope > .actions'),hint=panel.querySelector(':scope > .hint');actions.classList.add('recordDialogActions');if(hint)actions.before(hint);
 let active=false,trigger=null,scrollY=0,bodyStyle=null,backgroundState=[],locked=false;
 const visible=el=>el instanceof HTMLElement&&el.isConnected&&el.getClientRects().length&&!el.closest('[inert]');
 const controls=()=>[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]')].filter(visible);
 function associateLabels(){for(const label of panel.querySelectorAll('label:not([for])')){if(label.querySelector('input,select,textarea,button'))continue;const next=label.nextElementSibling,control=next?.matches('input,select,textarea,button')?next:next?.id==='gymGradePicker'?next.querySelector('button'):null;if(control?.id)label.htmlFor=control.id;}}
 function begin(){if(active)return;active=true;locked=false;trigger=document.activeElement;scrollY=window.scrollY;
  bodyStyle=Object.fromEntries(['position','top','left','right','width','overflow'].map(key=>[key,document.body.style[key]]));
  backgroundState=background.map(el=>[el,el.inert]);for(const [el]of backgroundState)el.inert=true;
  Object.assign(document.body.style,{position:'fixed',top:`-${scrollY}px`,left:'0',right:'0',width:'100%',overflow:'hidden'});
  associateLabels();panel.scrollTop=0;title.focus({preventScroll:true});
 }
 function end({focus=true}={}){if(!active)return;active=false;for(const [el,inert]of backgroundState)el.inert=inert;backgroundState=[];
  Object.assign(document.body.style,bodyStyle);bodyStyle=null;window.scrollTo({top:locked?0:scrollY,left:0,behavior:'instant'});
  if(focus&&!locked){const fallback=document.querySelector('#calendarView:not([hidden]) #registerFromDetail')||document.querySelector('#mainNavigation .active');(visible(trigger)?trigger:fallback)?.focus({preventScroll:true});}trigger=null;
 }
 function sync(){if(modal.classList.contains('open'))begin();else end();}
 panel.addEventListener('keydown',event=>{if(!active||event.defaultPrevented||event.isComposing||document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){if(!document.getElementById('gymGradeMenu').hidden)return;event.preventDefault();cancel.click();return;}
  if(event.key!=='Tab')return;const items=controls(),first=items[0],last=items.at(-1);if(!first){event.preventDefault();title.focus();return;}
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===title)){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===title)){event.preventDefault();first.focus();}
 });
 new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['class']});
 window.addEventListener('climblog:recordOpened',()=>{sync();associateLabels();});
 window.addEventListener('climblog:authLock',()=>{locked=true;end({focus:false});});
 associateLabels();sync();
}
