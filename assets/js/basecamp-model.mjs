// Pre-rendered GIF episodes. No weather service or personal records are involved.
export const campFrameStep=.15, campFrameDelay=100;
const definitions=[
  ['walk','sunny',14],['walk','night',14],
  ['tent','rain',22],['tent','snow',22],
  ['climb','cloudy',22],['climb','sunset',22],
  ['swim','sunny',24],
];
const captions={
  walk:'少し歩いて、湖畔で気分転換。',
  tent:'テントに入って、ひと休み。',
  climb:'一手ずつ。コハクも岩登りに夢中。',
  swim:'よく見ると、遠くでコハクが泳いでいます。',
};
export const campClips=definitions.map(([kind,weather,sourceSeconds])=>{
  const frames=Math.ceil(sourceSeconds/campFrameStep);
  return Object.freeze({id:kind+'-'+weather,kind,weather,sourceSeconds,frames,durationMs:frames*campFrameDelay,caption:captions[kind]});
});
export function createCampSequence(random=Math.random) {
  let bag=[],previous=null;
  return {
    next(){
      if(!bag.length){
        bag=['walk','tent','climb','swim'];
        for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
        if(bag.at(-1)===previous)[bag[0],bag[3]]=[bag[3],bag[0]];
      }
      const kind=bag.pop(),choices=campClips.filter(clip=>clip.kind===kind);
      previous=kind;
      return choices[Math.floor(random()*choices.length)];
    },
  };
}
