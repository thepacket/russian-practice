import dictionary from './dictionary-data.mjs';
// Source-backed dictionary entries, not a fixed teaching sequence.
// All English glosses, stress and original IPA are from the same source record.
export const words = dictionary.map(([text,stress,meaning,ipa,sourceIpa,pos,senseId,rank],id)=>({id,text,stress,meaning,ipa,sourceIpa,pos,senseId,rank,length:[...text].length,source:`https://en.wiktionary.org/wiki/${encodeURIComponent(text)}#Russian`}));
export const maxWordLength=Math.max(...words.map(w=>w.length));
export const dictionarySize=new Set(words.map(w=>w.text)).size;
const pools=new Map();
export function wordPool(max){
 if(!Number.isInteger(max)||max<1||max>maxWordLength)throw new RangeError('Choose a supported maximum letter count.');
 if(!pools.has(max))pools.set(max,words.filter(w=>w.length<=max));
 return pools.get(max);
}
export function pickWord(max,previous,random=Math.random,rank=0){
 const previousText=words[previous]?.text;
 const pool=wordPool(max).filter(w=>w.text!==previousText&&(rank===0||(w.rank>0&&w.rank<=rank)));
 if(!pool.length)throw new RangeError('No different word fits this limit.');
 const value=random();
 if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('Random sample must be in [0, 1).');
 return pool[Math.floor(value*pool.length)];
}
