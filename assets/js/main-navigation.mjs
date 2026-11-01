export function installMainNavigation(){
 const nav=document.getElementById('mainNavigation');if(!nav)return;
 function sync(){for(const button of nav.querySelectorAll('button[data-view]')){if(button.classList.contains('active'))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}}
 sync();new MutationObserver(sync).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
}
