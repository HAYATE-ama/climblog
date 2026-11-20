import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCampSequence} from '../assets/js/basecamp-model.mjs';
import {campFrames} from '../assets/js/basecamp-assets.mjs';

test('camp visits all four activities without consecutive repeats, including across shuffled cycles',()=>{
  let seed=42;
  const sequence=createCampSequence(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
  const episodes=Array.from({length:400},()=>sequence.next());
  const weather=new Set();
  for(let i=0;i<episodes.length;i++){
    const episode=episodes[i];weather.add(episode.weather);
    if(i)assert.notEqual(episode.kind,episodes[i-1].kind);
    assert.ok(episode.duration>=12 && episode.duration<=27);
    if(episode.kind==='swim')assert.equal(episode.weather,'sunny');
    if(episode.kind==='climb')assert.ok(['sunny','cloudy','sunset'].includes(episode.weather));
    if(episode.kind==='tent')assert.ok(['rain','snow','night'].includes(episode.weather));
    if(i%4===0)assert.equal(new Set(episodes.slice(i,i+4).map(e=>e.kind)).size,4);
  }
  assert.equal(weather.size,6);
});

test('sprite anchors and crops fit the shipped sheets; illustrations stay within a small fixed download',()=>{
  let bytes=0;
  for(const [name,asset] of Object.entries(campFrames)){
    bytes+=fs.statSync(new URL('../assets/images/basecamp/'+name+'.webp',import.meta.url)).size;
    for(const frame of asset.frames||[]){
      assert.ok(frame.x>=0 && frame.y>=0 && frame.x+frame.w<=asset.width && frame.y+frame.h<=asset.height);
      assert.ok(frame.anchorX>=0 && frame.anchorX<=frame.w && frame.baseline<=frame.h);
    }
  }
  assert.ok(bytes<700000);
});
