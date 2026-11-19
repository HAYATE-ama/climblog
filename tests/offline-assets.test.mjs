import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('オフライン用キャッシュには全画面の静的資源を含み、秘密や個人データを含めない',()=>{
  const context={self:{}};vm.runInNewContext(fs.readFileSync(new URL('../assets/js/offline-assets.js',import.meta.url),'utf8'),context);
  const expected=fs.readdirSync(new URL('../assets',import.meta.url),{recursive:true}).map(p=>'./assets/'+p.replaceAll('\\','/')).filter(p=>/\.(js|mjs|css|png|svg)$/.test(p)&&!p.endsWith('/offline-assets.js')).sort();
  assert.deepEqual([...context.self.climbLogOfflineAssets],expected);
});
