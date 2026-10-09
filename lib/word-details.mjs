import manifest from './word-details-manifest.mjs';
// Full Wiktionary records for a word, fetched from its shard (grouped by the first two letters) on
// first use and kept for the session. Same-origin public data only; nothing personal is sent.
const shards=new Map();
// Large two-letter groups are split by three letters; the manifest holds whichever key applies.
export function shardKey(text){const c=[...String(text||'')];const three=c.slice(0,3).join('');return manifest.shards[three]?three:c.slice(0,2).join('');}
export async function wordDetails(text,fetcher=fetch,{decompress=body=>body.pipeThrough(new DecompressionStream('gzip'))}={}){
 const key=shardKey(text),url=manifest.shards[key];
 if(!url)return [];
 if(!shards.has(key)){
  const load=(async()=>{
   const response=await fetcher(url,{credentials:'omit',referrerPolicy:'no-referrer'});
   if(!response.ok||!response.body)throw Error('Word details could not download. Check your connection and try again.');
   const parsed=JSON.parse(await new Response(decompress(response.body)).text());
   if(!parsed||typeof parsed!=='object')throw Error('Word details are damaged.');
   return parsed;
  })();
  shards.set(key,load);
  load.catch(()=>{shards.delete(key);});
 }
 const shard=await shards.get(key);
 const records=shard[text];
 return Array.isArray(records)?records:[];
}
export const detailCounts={records:manifest.records,spellings:manifest.spellings};
