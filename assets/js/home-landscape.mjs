import {createCampSequence} from './basecamp-model.mjs';

// The browser decodes and plays the GIF. No Canvas, WebGL, or per-frame JS runs on the home screen.
export function createCampPlayer(image,{onCaption=()=>{},onState=()=>{},onError=()=>{},sequence=createCampSequence()}={}) {
  const scene=image.parentElement;
  let active=false,disposed=false,version=0,timeout=0,request=null,objectUrl=null,clip=null;
  function clearImage() {
    image.onload=null;image.onerror=null;image.removeAttribute('src');
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
    delete scene.dataset.ready;image.setAttribute('aria-hidden','true');
  }
  function pause() {
    if(disposed||(!active&&!request&&!objectUrl))return;
    active=false;version++;clearTimeout(timeout);timeout=0;request?.abort();request=null;
    clearImage();onState('paused');
  }
  function fail(ticket) {
    if(disposed||!active||ticket!==version)return;
    pause();onState('error');onError();
  }
  async function load() {
    const ticket=++version;
    request?.abort();request=new AbortController();onState('loading');
    try {
      const response=await fetch(new URL('../images/basecamp/'+clip.id+'.gif',import.meta.url),{signal:request.signal,cache:'force-cache'});
      if(!response.ok)throw new Error('Camp GIF unavailable');
      const blob=await response.blob();
      if(disposed||!active||ticket!==version)return;
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      objectUrl=URL.createObjectURL(blob);
      image.onload=()=>{
        if(disposed||!active||ticket!==version)return;
        scene.dataset.ready='true';image.setAttribute('aria-hidden','false');
        image.dataset.action=clip.kind;image.dataset.weather=clip.weather;image.dataset.clip=clip.id;
        onCaption(clip.caption);onState('playing');
        // GIFs play once. Leave one frame of margin before starting a new random episode.
        timeout=setTimeout(()=>{timeout=0;clip=sequence.next();void load();},clip.durationMs+100);
      };
      image.onerror=()=>fail(ticket);
      image.src=objectUrl;
    } catch(error) {
      if(error?.name!=='AbortError')fail(ticket);
    }
  }
  return {
    play(){
      if(disposed||active)return;
      active=true;clip ||= sequence.next();void load();
    },
    pause,
    dispose(){if(disposed)return;pause();disposed=true;},
  };
}
