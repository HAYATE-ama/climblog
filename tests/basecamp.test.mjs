import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCampSequence,campClips} from '../assets/js/basecamp-model.mjs';

test('camp visits all four activities without consecutive repeats and uses compatible weather',()=>{
  let seed=42;
  const sequence=createCampSequence(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
  const episodes=Array.from({length:400},()=>sequence.next()),weather=new Set();
  for(let i=0;i<episodes.length;i++){
    const episode=episodes[i];weather.add(episode.weather);
    if(i)assert.notEqual(episode.kind,episodes[i-1].kind);
    assert.ok(episode.durationMs>=9000&&episode.durationMs<=16000);
    if(episode.kind==='swim')assert.equal(episode.weather,'sunny');
    if(episode.kind==='climb')assert.ok(['cloudy','sunset'].includes(episode.weather));
    if(episode.kind==='tent')assert.ok(['rain','snow'].includes(episode.weather));
    if(i%4===0)assert.equal(new Set(episodes.slice(i,i+4).map(e=>e.kind)).size,4);
  }
  assert.equal(weather.size,6);
});

function inspectGif(bytes){
  assert.equal(bytes.subarray(0,6).toString(),'GIF89a');
  const width=bytes.readUInt16LE(6),height=bytes.readUInt16LE(8);
  let offset=13+((bytes[10]&128)?3*(1<<((bytes[10]&7)+1)):0),frames=0,durationMs=0,delay=0;
  const skipBlocks=()=>{while(bytes[offset]){offset+=bytes[offset]+1;assert.ok(offset<bytes.length);}offset++;};
  while(offset<bytes.length){
    const marker=bytes[offset++];
    if(marker===0x3b){assert.equal(offset,bytes.length);break;}
    if(marker===0x21){
      const label=bytes[offset++];
      if(label===0xf9){assert.equal(bytes[offset],4);delay=bytes.readUInt16LE(offset+2)*10;}
      skipBlocks();
    }else if(marker===0x2c){
      assert.ok(bytes.readUInt16LE(offset)+bytes.readUInt16LE(offset+4)<=width);
      assert.ok(bytes.readUInt16LE(offset+2)+bytes.readUInt16LE(offset+6)<=height);
      const flags=bytes[offset+8];offset+=9;
      if(flags&128)offset+=3*(1<<((flags&7)+1));
      offset++;skipBlocks();frames++;durationMs+=delay;
    }else assert.fail('Invalid GIF block: '+marker);
  }
  return {width,height,frames,durationMs};
}

test('all shipped GIFs contain timed animation frames and fit the published byte budget',()=>{
  let total=0;
  for(const clip of campClips){
    const data=fs.readFileSync(new URL('../assets/images/basecamp/'+clip.id+'.gif',import.meta.url));
    total+=data.length;
    assert.deepEqual(inspectGif(data),{width:600,height:360,frames:clip.frames,durationMs:clip.durationMs});
    assert.ok(clip.frames>50);
  }
  assert.ok(total<16*1024*1024);
  assert.ok(fs.statSync(new URL('../assets/images/basecamp/poster.webp',import.meta.url)).size>1000);
});
