import manifest from './dictionary-manifest.mjs';
export const CACHE_NAME='russian-practice-dictionary-v1';
// Only this exact public, content-hashed dictionary is stored. Never speech or credentials.
export function createDictionary(fetcher=fetch,random=Math.random,{storage=globalThis.caches,metadata=manifest,timeoutMs=60000}={}){
 let ready, pending;
 async function decode(bytes){
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==metadata.bytes||hash!==metadata.sha256)throw Error('Dictionary download is incomplete or damaged. Try Next Word again.');
  const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const rows=JSON.parse(text);
  if(!Array.isArray(rows)||rows.length!==metadata.count||rows.some(r=>!Array.isArray(r)||r.length!==8||r.slice(0,7).some(v=>typeof v!=='string')||!Number.isInteger(r[7])||r[7]<0)||new Set(rows.map(r=>r[0])).size!==metadata.spellings)throw Error('Dictionary data is incomplete. Try Next Word again.');
  const groups=Array.from({length:33},()=>[]);
  rows.forEach(([text,stress,meaning,ipa,sourceIpa,pos,senseId,rank],id)=>{
   const length=[...text].length;if(length<1||length>32)throw Error('Unsupported dictionary entry.');
   groups[length].push({id,text,stress,meaning,ipa,sourceIpa,pos,senseId,rank,length,source:`https://en.wiktionary.org/wiki/${encodeURIComponent(text)}#Russian`});
  });
  return groups;
 }
 async function load(report){
  let cache;try{cache=await storage?.open(CACHE_NAME);}catch{}
  if(cache){try{const cached=await cache.match(metadata.url);if(cached){report('Opening saved dictionary…');const groups=await decode(await cached.arrayBuffer());report('Whole dictionary ready · saved on this device');return groups;}}catch{try{await cache.delete(metadata.url);}catch{}}}
  report('Downloading the whole dictionary…');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  let bytes;
  try{
  const response=await fetcher(metadata.url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
  if(!response.ok)throw Error('Dictionary could not download. Check your connection and try Next Word again.');
  const reader=response.body?.getReader();
  if(reader){const parts=[];let received=0;try{while(true){const {done,value}=await reader.read();if(done)break;received+=value.byteLength;if(received>metadata.bytes)throw Error('Dictionary download has an unexpected size.');parts.push(value);report(`Downloading whole dictionary · ${Math.floor(received/metadata.bytes*100)}%`);}}catch(error){await reader.cancel().catch(()=>{});throw error;}
   bytes=new Uint8Array(received);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  }else bytes=new Uint8Array(await response.arrayBuffer());
  }catch(error){if(controller.signal.aborted)throw Error('Dictionary download timed out. Check your connection and try Next Word again.');throw error;}finally{clearTimeout(timeout);}
  report('Unpacking and checking the whole dictionary…');
  const groups=await decode(bytes);
  let saved=false;
  if(cache){try{await cache.put(metadata.url,new Response(bytes,{headers:{'Content-Type':'application/gzip'}}));saved=true;
   // Remove only obsolete dictionary files from this dedicated cache, after success.
   for(const key of await cache.keys())if(new URL(key.url).pathname!==metadata.url)await cache.delete(key);
  }catch{}}
  report(saved?'Whole dictionary ready · saved on this device':'Whole dictionary ready · storage unavailable; this tab still works offline');
  return groups;
 }
 const listeners=new Set();let status='';
 const report=value=>{status=value;for(const fn of listeners)fn(value);};
 // `rank` caps the frequency rank (vocabulary size); 0 means every word. Rank 0 entries have no frequency data and only appear with 0.
 return async function choose(max,previous,signal,onProgress=()=>{},rank=0){
  if(!Number.isInteger(max)||max<1||max>32)throw Error('Choose a supported maximum letter count.');
  if(!Number.isInteger(rank)||rank<0)throw Error('Choose a supported vocabulary size.');
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  listeners.add(onProgress);if(status)onProgress(status);
  try{
   if(!ready){pending??=load(report).then(groups=>ready=groups).finally(()=>{pending=undefined;});await pending;}
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   const fits=w=>w.text!==previous?.text&&(rank===0||(w.rank>0&&w.rank<=rank));
   const groups=ready.slice(1,max+1);
   const counts=groups.map(group=>group.reduce((n,w)=>n+(fits(w)?1:0),0));
   const total=counts.reduce((a,b)=>a+b,0);if(!total)throw Error(rank?'No word in this vocabulary size fits the letter limit. Raise Max characters or choose a larger vocabulary in Settings.':'No other matching word.');
   const sample=random();if(!Number.isFinite(sample)||sample<0||sample>=1)throw RangeError('Random sample must be in [0, 1).');
   let index=Math.floor(sample*total);
   for(let i=0;i<groups.length;i++){if(index>=counts[i]){index-=counts[i];continue;}for(const w of groups[i]){if(!fits(w))continue;if(index--===0)return w;}}
   throw Error('Dictionary selection failed.');
  }finally{listeners.delete(onProgress);}
 };
}
