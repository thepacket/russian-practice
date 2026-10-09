import manifest from './word-forms-manifest.mjs';
// Inflected form (stress marks removed) -> dictionary spellings it belongs to, from the forms index
// shards (grouped by the first two or three letters), fetched on first use and kept for the session.
const shards=new Map();
export function plainForm(text){return String(text||'').replace(/́/g,'').toLowerCase();}
export function formShardKey(form){const c=[...form];const three=c.slice(0,3).join('');return manifest.shards[three]?three:c.slice(0,2).join('');}
export async function lemmasOfForm(text,fetcher=fetch,{decompress=body=>body.pipeThrough(new DecompressionStream('gzip'))}={}){
 const form=plainForm(text),key=formShardKey(form),url=manifest.shards[key];
 if(!form||!url)return [];
 if(!shards.has(key)){
  const load=(async()=>{
   const response=await fetcher(url,{credentials:'omit',referrerPolicy:'no-referrer'});
   if(!response.ok||!response.body)throw Error('Word forms could not download. Check your connection and try again.');
   const parsed=JSON.parse(await new Response(decompress(response.body)).text());
   if(!parsed||typeof parsed!=='object')throw Error('Word forms are damaged.');
   return parsed;
  })();
  shards.set(key,load);load.catch(()=>{shards.delete(key);});
 }
 const shard=await shards.get(key);const lemmas=shard[form];
 return Array.isArray(lemmas)?lemmas:[];
}
