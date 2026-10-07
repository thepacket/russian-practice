// Azure's ru-RU assessment returns one score per sound, in order, but leaves each sound's name blank.
// The scores are shown against the word's letters when there is one sound per letter; otherwise
// against the dictionary's IPA for the word (silent ь/ъ, or я = two sounds); failing that, by position.
const MODIFIERS=new Set(['ʲ','ː','ʰ','̯']);
export function ipaSegments(ipa){
 const out=[];const chars=[...String(ipa||'').replace(/[ˈˌ.\s\[\]\/]/g,'')];
 for(let i=0;i<chars.length;i++){
  let seg=chars[i];
  if(chars[i+1]==='͡'&&chars[i+2]){seg+='͡'+chars[i+2];i+=2;}
  while(MODIFIERS.has(chars[i+1])){seg+=chars[i+1];i++;}
  out.push(seg);
 }
 return out;
}
export function labelSounds(word,sounds){
 const scored=(sounds||[]).filter(s=>s&&typeof s==='object');
 if(!scored.length)return [];
 const named=scored.every(s=>s.sound);
 const ipa=ipaSegments(word?.ipa),letters=[...String(word?.text||'')];
 const labels=named?scored.map(s=>s.sound):letters.length===scored.length?letters:ipa.length===scored.length?ipa:scored.map((_,i)=>String(i+1));
 return scored.map((s,i)=>({label:labels[i],accuracy:s.accuracy}));
}
export function soundsAverage(sounds){
 const n=(sounds||[]).map(s=>s.accuracy).filter(a=>typeof a==='number');
 return n.length?Math.round(n.reduce((a,b)=>a+b,0)/n.length):null;
}
