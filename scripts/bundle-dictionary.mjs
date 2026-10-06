import dictionary from '../lib/dictionary-data.mjs';
import {writeFile,mkdir,rm,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const target=new URL('../public/dictionary/',import.meta.url),manifestFile=new URL('../lib/dictionary-manifest.mjs',import.meta.url);
const json=JSON.stringify(dictionary);
// Different zlib versions compress the same JSON to different bytes (and so a different file name).
// Keep the committed archive when it already holds exactly this dictionary, so builds and tests
// don't rewrite tracked files on every machine.
try{
 const current=(await import(manifestFile.href+'?t='+Date.now())).default;
 const bytes=await readFile(new URL('..'+current.url,target));
 if(createHash('sha256').update(bytes).digest('hex')===current.sha256&&bytes.length===current.bytes&&gunzipSync(bytes).toString('utf8')===json){
  console.log(`Dictionary unchanged: keeping ${current.url} (${current.count} entries)`);process.exit(0);
 }
}catch{/* No usable archive yet: build one below. */}
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
const compressed=gzipSync(json,{level:9});
const sha256=createHash('sha256').update(compressed).digest('hex');
const name=`full-${sha256}.json.gz`;
await writeFile(new URL(name,target),compressed);
const manifest={format:1,count:dictionary.length,spellings:new Set(dictionary.map(x=>x[0])).size,bytes:compressed.length,sha256,url:'/dictionary/'+name};
await writeFile(manifestFile,'export default '+JSON.stringify(manifest)+';\n');
console.log(`Prepared ${manifest.count} entries in one ${compressed.length}-byte gzip dictionary`);
