import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDictionary,CACHE_NAME} from '../lib/dictionary-loader.mjs';
import manifest from '../lib/dictionary-manifest.mjs';
import {words} from '../lib/words.mjs';
const bytes=await readFile(new URL('../public'+manifest.url,import.meta.url));
function cacheStorage(){const data=new Map();let writes=0;const key=x=>typeof x==='string'?x:new URL(x.url).pathname;const cache={match:async k=>data.get(key(k))?.clone(),put:async(k,v)=>{writes++;data.set(key(k),v.clone());},delete:async k=>data.delete(key(k)),keys:async()=>[...data.keys()].map(k=>new Request('https://test'+k))};return{data,cache,get writes(){return writes;},open:async name=>{assert.equal(name,CACHE_NAME);return cache;}};}
const response=()=>new Response(bytes);
test('single gzip contains entire corpus; all limits select locally with no repeated spelling',async()=>{
 let calls=0;const storage=cacheStorage(),statuses=[];
 const choose=createDictionary(async url=>{calls++;assert.equal(url,manifest.url);return response();},Math.random,{storage});
 const meta=JSON.parse(await readFile(new URL('../public/dictionary-attribution.json',import.meta.url),'utf8'));assert.equal(manifest.count,meta.counts.entries);assert.equal(manifest.spellings,meta.counts.uniqueSpellings);
 let previous=words[0];for(let max=1;max<=32;max++)for(let i=0;i<15;i++){const word=await choose(max,previous,undefined,s=>statuses.push(s));assert.ok(word.length<=max);assert.notEqual(word.text,previous.text);assert.deepEqual(word,words[word.id]);previous=word;}
 assert.equal(calls,1);assert.equal(storage.writes,1);assert.match(statuses.at(-1),/saved on this device/);
 const offline=createDictionary(()=>{throw Error('Network forbidden');},()=>.5,{storage});assert.ok((await offline(32)).id>=0);
});
test('selection covers exact first/last eligible entries and rejects invalid samples',async()=>{
 const storage=cacheStorage();let sample=0;const choose=createDictionary(response,()=>sample,{storage});
 for(let max=1;max<=32;max++){const eligible=words.filter(w=>w.length<=max).sort((a,b)=>a.length-b.length);sample=0;assert.equal((await choose(max)).id,eligible[0].id);sample=1-Number.EPSILON;assert.equal((await choose(max)).id,eligible.at(-1).id);}
 sample=1;await assert.rejects(choose(32),/Random sample/);await assert.rejects(choose(0),/maximum letter/);
});
test('concurrent and cancelled selections share one complete download; never store partial bytes',async()=>{
 const storage=cacheStorage();let release,calls=0;const wait=new Promise(r=>release=r);
 const choose=createDictionary(async()=>{calls++;await wait;return response();},()=>.5,{storage});
 const controller=new AbortController();const first=choose(8,undefined,controller.signal);const caught=assert.rejects(first,{name:'AbortError'});controller.abort();const second=choose(3);release();await caught;assert.ok((await second).length<=3);assert.equal(calls,1);assert.equal(storage.writes,1);
});
test('interrupted download is not cached and can retry',async()=>{
 const storage=cacheStorage();let calls=0;const choose=createDictionary(async()=>++calls===1?new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.error(Error('Disconnected'));}})):response(),()=>.5,{storage});
 await assert.rejects(choose(8),/Disconnected/);assert.equal(storage.writes,0);assert.ok(await choose(8));assert.equal(calls,2);
});
test('damaged cached bytes are discarded and replaced only after validation',async()=>{
 const storage=cacheStorage();storage.data.set(manifest.url,new Response('broken'));let calls=0;const choose=createDictionary(async()=>{calls++;return response();},()=>.5,{storage});assert.ok(await choose(32));assert.equal(calls,1);assert.equal(storage.writes,1);
});
test('hash failure never stores bad download; next request retries',async()=>{
 const storage=cacheStorage(),bad=Buffer.from(bytes);bad[20]^=1;let calls=0;const choose=createDictionary(async()=>new Response(++calls===1?bad:bytes),()=>.5,{storage});await assert.rejects(choose(32),/damaged/);assert.equal(storage.writes,0);await choose(32);assert.equal(storage.writes,1);
});
test('denied storage or quota does not break in-memory offline Next',async()=>{
 for(const storage of [{open:async()=>{throw Error('denied');}},{open:async()=>({match:async()=>undefined,put:async()=>{throw Error('quota');}})}]){let calls=0,last;const choose=createDictionary(async()=>{calls++;return response();},()=>.5,{storage});await choose(8,undefined,undefined,s=>last=s);await choose(32);assert.equal(calls,1);assert.match(last,/storage unavailable/);}
});
test('new content version downloads once and removes only obsolete dictionary cache entries',async()=>{
 const storage=cacheStorage();storage.data.set('/dictionary/old.json.gz',new Response('old'));let calls=0;const choose=createDictionary(async()=>{calls++;return response();},()=>.5,{storage});await choose(32);assert.equal(calls,1);assert.deepEqual([...storage.data.keys()],[manifest.url]);
});
test('hung fetch times out, stores nothing and retry starts a fresh download',async()=>{
 const storage=cacheStorage();let calls=0;const choose=createDictionary(async(_url,{signal})=>{if(++calls>1)return response();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}));},()=>.5,{storage,timeoutMs:10});
 await assert.rejects(choose(8),/timed out/);assert.equal(storage.writes,0);assert.ok(await choose(8));assert.equal(calls,2);
});
test('worker bridge drops cancelled words but keeps global progress and recovers from worker failure',async()=>{
 let worker;globalThis.Worker=class{messages=[];constructor(){worker=this;}postMessage(data){this.messages.push(data);}terminate(){}};
 const {chooseWord,subscribeDictionaryStatus}=await import('../lib/client-dictionary.mjs');const statuses=[];const unsubscribe=subscribeDictionaryStatus(s=>statuses.push(s));
 const controller=new AbortController();const first=chooseWord(8,words[0],controller.signal);const caught=assert.rejects(first,{name:'AbortError'});const id=worker.messages[0].id;controller.abort();await caught;
 worker.onmessage({data:{id,status:'Whole dictionary ready · saved on this device'}});worker.onmessage({data:{id,word:words[1]}});assert.match(statuses.at(-1),/ready/);
 const second=chooseWord(3,words[1]);const id2=worker.messages.at(-1).id;worker.onmessage({data:{id:id2,word:words[0]}});assert.deepEqual(await second,words[0]);
 const third=chooseWord(3);const failed=assert.rejects(third,/worker stopped/);worker.onerror();await failed;const oldWorker=worker;
 const fourth=chooseWord(3);assert.notEqual(worker,oldWorker);worker.onmessage({data:{id:worker.messages[0].id,word:words[0]}});await fourth;unsubscribe();delete globalThis.Worker;
});

test('the vocabulary cap keeps only the most frequent words and explains an empty intersection',async()=>{
 const storage=cacheStorage();let sample=0;const choose=createDictionary(response,()=>{sample=(sample+0.37)%1;return sample;},{storage});
 for(let i=0;i<40;i++){const w=await choose(32,undefined,undefined,()=>{},1000);assert.ok(w.rank>=1&&w.rank<=1000,`rank ${w.rank} within 1,000`);}
 const top=await choose(32,undefined,undefined,()=>{},1);assert.equal(top.rank,1);
 await assert.rejects(choose(1,undefined,undefined,()=>{},1),/No word in this vocabulary size fits the letter limit/);
 const any=await choose(32,undefined,undefined,()=>{},0);assert.ok(Number.isInteger(any.rank));
 await assert.rejects(choose(32,undefined,undefined,()=>{},-1),/vocabulary size/);
});
