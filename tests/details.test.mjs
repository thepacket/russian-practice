import test from 'node:test';import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {wordDetails,shardKey,detailCounts} from '../lib/word-details.mjs';
import {lemmasOfForm,plainForm,formShardKey} from '../lib/word-forms.mjs';
import formsManifest from '../lib/word-forms-manifest.mjs';
import manifest from '../lib/word-details-manifest.mjs';
import {readFile} from 'node:fs/promises';
import {words} from '../lib/words.mjs';
const gz=obj=>new Response(gzipSync(Buffer.from(JSON.stringify(obj))));
test('every dictionary spelling has a shard, and shards resolve to three letters where split',async()=>{
 assert.equal(manifest.format,1);assert.equal(detailCounts.spellings,new Set(words.map(w=>w.text)).size);
 for(const w of words)assert.ok(manifest.shards[shardKey(w.text)],`shard for ${w.text}`);
 const three=Object.keys(manifest.shards).find(k=>[...k].length===3);assert.ok(three,'some groups are split by three letters');
 assert.equal(shardKey(three+'ый'),three);
});
test('a real shard decompresses to verbatim records for its words',async()=>{
 const w=words.find(x=>x.text==='окно');const url=manifest.shards[shardKey(w.text)];
 const bytes=await readFile(new URL('../public'+url,import.meta.url));
 const records=await wordDetails('окно',async()=>new Response(bytes));
 assert.ok(records.length>=1);assert.equal(records[0].word,'окно');assert.ok(records[0].senses.length>0);assert.ok(records[0].forms.length>5);assert.ok(records[0].etymology_text);
});
test('shards are fetched once per session and errors are not cached',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return calls===1?new Response('',{status:503}):gz({'зама':[{word:'зама',pos:'noun',senses:[]}],'замок':[{word:'замок',pos:'noun',senses:[]},{word:'замок',pos:'noun',senses:[]}]});};
 await assert.rejects(wordDetails('замок',fetcher),/could not download/);
 assert.equal((await wordDetails('замок',fetcher)).length,2);assert.equal((await wordDetails('зама',fetcher)).length,1);
 assert.equal(calls,2,'one failed and one successful fetch, then cached');
 assert.deepEqual(await wordDetails('ъъ',fetcher),[],'no shard: empty');
});

test('the forms index maps an inflected form (stress removed) to its dictionary spellings',async()=>{
 assert.equal(plainForm('Окна́'),'окна');assert.equal(formsManifest.format,1);assert.ok(formsManifest.forms>400000);
 const url=formsManifest.shards[formShardKey('окна')];assert.ok(url);const bytes=await readFile(new URL('../public'+url,import.meta.url));
 const lemmas=await lemmasOfForm('окна́',async()=>new Response(bytes));assert.ok(lemmas.includes('окно'),`окна́ → ${lemmas}`);
 assert.deepEqual(await lemmasOfForm('ъъъ',async()=>{throw Error('no fetch expected');}),[]);
 assert.equal(formShardKey('окна'),'ок','two-letter key unless the group was split');
});
