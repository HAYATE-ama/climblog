export function installAuthLoading(doc){
 const form=doc.getElementById('authForm'),node=doc.createElement('div');node.id='authLoading';node.hidden=true;node.className='authLoading';node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.innerHTML='<span class="authSpinner" aria-hidden="true"></span><span id="authLoadingText">ログインしています…</span>';form.querySelector('.brand').after(node);
 return {set(active,text='ログインしています…'){node.hidden=!active;node.querySelector('#authLoadingText').textContent=text;form.setAttribute('aria-busy',String(active));}};
}
