// Both requests are read-only. Never expose or persist payload until verification succeeds.
export async function readVerifiedAccount(expectedUserId,{verifyUser,readRemote}){
 if(typeof expectedUserId!=='string'||!expectedUserId)throw new Error('ログインを確認できません。');
 const [verification,remote]=await Promise.all([Promise.resolve().then(verifyUser),Promise.resolve().then(readRemote)]);
 if(verification?.error||verification?.data?.user?.id!==expectedUserId)throw new Error('ログインを確認できません。');
 if(!remote||remote.error)throw remote?.error||new Error('記録を取得できませんでした。');
 return remote.data;
}
export function preloadAppModules(document){
 for(const name of ['app.js','enhancements.js']){const id='preload-'+name;if(document.getElementById(id))continue;const link=document.createElement('link');link.id=id;link.rel='modulepreload';link.href=new URL('./'+name,import.meta.url).href;document.head.append(link);}
}
