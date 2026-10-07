import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {words,pickWord,wordPool,dictionarySize,maxWordLength} from '../lib/words.mjs';
import {ssml} from '../lib/protocol.mjs';
const vowels='аеиоуыэюяё';
test('broad licensed dictionary has reproducible counts and source provenance',()=>{
 const meta=JSON.parse(readFileSync(new URL('../public/dictionary-attribution.json',import.meta.url)));
 assert.equal(words.length,meta.counts.entries);assert.equal(dictionarySize,meta.counts.uniqueSpellings);
 assert.ok(dictionarySize>40000);assert.equal(meta.license,'CC BY-SA 4.0');assert.match(meta.sourceSha256,/^[a-f0-9]{64}$/);
 const exported=JSON.parse(readFileSync(new URL('../public/dictionary-data.json',import.meta.url)));
 assert.equal(exported.length,words.length);
 for(const w of words){assert.match(w.text,/^[а-яё]+$/u);assert.equal(w.stress.replaceAll('\u0301',''),w.text);assert.equal(w.length,[...w.text].length);assert.ok(w.meaning.length>0);assert.ok(w.senseId);assert.match(w.source,/^https:\/\/en.wiktionary.org\/wiki\//);assert.ok(w.sourceIpa);assert.ok(!/[<>"&]/u.test(w.ipa));assert.equal(w.length,exported[w.id][0].length);}
});
test('every pronunciation stress matches its displayed canonical stress',()=>{
 for(const w of words){let count=0,marked=[];for(const c of w.stress){if(vowels.includes(c))count++;if(c==='́'||c==='ё')marked.push(count);}
  const shown=marked.length===1?marked[0]:count===1?1:null;
  const phones=[...w.ipa].filter(c=>'aʌəɛiɪɨɔu'.includes(c)).length;
  const spoken=w.ipa.includes('ˈ')?[...w.ipa.split('ˈ')[0]].filter(c=>'aʌəɛiɪɨɔu'.includes(c)).length+1:phones===1?1:null;
  assert.equal(phones,count,w.text);assert.notEqual(shown,null,w.text);assert.equal(spoken,shown,w.text);
 }
});
test('homographs retain matching stress, gloss and pronunciation',()=>{
 const castle=words.find(w=>w.stress==='за́мок'),lock=words.find(w=>w.stress==='замо́к');
 assert.match(castle.meaning,/castle/);assert.match(lock.meaning,/lock/);assert.match(castle.ipa,/^ˈ/);assert.match(lock.ipa,/zʌˈ/);
 const water=words.find(w=>w.stress==='вода́');assert.match(water.meaning,/water/);
 assert.ok(words.some(w=>w.text.includes('ё')));
 assert.match(ssml(lock,true,'Dmitry'),new RegExp('<break time="250ms"/>'+lock.stress+'</prosody>'),'word is spoken as stressed text, not forced IPA');assert.doesNotMatch(ssml(lock,true,'Dmitry'),/phoneme/);
});
test('all supported caps enforce letter counts, including accents and ё, and never immediately repeat spelling',()=>{
 assert.equal(maxWordLength,32);
 for(let cap=1;cap<=maxWordLength;cap++){
  const pool=wordPool(cap);assert.ok(pool.length>1);assert.ok(pool.every(w=>w.length<=cap));
  let previous=pool[0];for(let n=0;n<30;n++){const next=pickWord(cap,previous.id,()=>n/30);assert.ok(next.length<=cap);assert.notEqual(next.text,previous.text);previous=next;}
 }
 for(const cap of [0,-1,1.1,33,Infinity,NaN])assert.throws(()=>pickWord(cap,0),RangeError);
 for(const random of [-1,1,Infinity,NaN])assert.throws(()=>pickWord(5,0,()=>random),RangeError);
});
test('selection boundaries cover every eligible entry without a tiny starter fallback',()=>{
 const pool=wordPool(3);for(let i=0;i<pool.length;i++)assert.equal(pickWord(3,undefined,()=>((i+.5)/pool.length)).id,pool[i].id);
 assert.ok(new Set(Array.from({length:500},(_,i)=>pickWord(32,undefined,()=>i/500).id)).size>400);
});
