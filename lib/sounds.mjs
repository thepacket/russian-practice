// Azure's ru-RU assessment returns one score per sound, in order, but leaves each sound's name blank.
// The scores are shown against the word's letters (grouping silent signs and two-sound vowels, see
// letterGroups); if the counts still disagree, against the dictionary's IPA; failing that, by position.
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
// Russian spelling vs sounds: ь/ъ are silent (shown with the letter before them), я/ю/е/ё are two
// sounds at the start of a word or after a vowel or ь/ъ (so is и after ь), and a double consonant
// may be heard as one sound. Returns letter groups with the number of sounds each should cover.
const VOWELS='аеёиоуыэюя',IOTATED='еёюя',SIGNS='ьъ';
export function letterGroups(text,{mergeDoubles=false}={}){
 const letters=[...String(text||'')],groups=[];
 for(let i=0;i<letters.length;i++){
  const l=letters[i],prev=letters[i-1]??'';
  if(SIGNS.includes(l)){if(groups.length)groups[groups.length-1].label+=l;else groups.push({label:l,count:0});continue;}
  if(mergeDoubles&&l===prev&&!VOWELS.includes(l)&&groups.length){groups[groups.length-1].label+=l;continue;}
  const two=IOTATED.includes(l)?(i===0||VOWELS.includes(prev)||SIGNS.includes(prev)):(l==='и'&&prev==='ь');
  groups.push({label:l,count:two?2:1});
 }
 return groups;
}
function alignToLetters(text,scored){
 for(const mergeDoubles of [false,true]){
  const groups=letterGroups(text,{mergeDoubles});
  if(groups.reduce((n,g)=>n+g.count,0)!==scored.length)continue;
  let i=0;
  return groups.map(g=>{const part=scored.slice(i,i+g.count);i+=g.count;const nums=part.map(s=>s.accuracy).filter(a=>typeof a==='number');return {label:g.label,accuracy:nums.length?Math.min(...nums):null};});
 }
 return null;
}
export function labelSounds(word,sounds){
 const scored=(sounds||[]).filter(s=>s&&typeof s==='object');
 if(!scored.length)return [];
 if(scored.every(s=>s.sound))return scored.map(s=>({label:s.sound,accuracy:s.accuracy}));
 const byLetter=alignToLetters(word?.text,scored);if(byLetter)return byLetter;
 const ipa=ipaSegments(word?.ipa);
 const labels=ipa.length===scored.length?ipa:scored.map((_,i)=>String(i+1));
 return scored.map((s,i)=>({label:labels[i],accuracy:s.accuracy}));
}
export function soundsAverage(sounds){
 const n=(sounds||[]).map(s=>s.accuracy).filter(a=>typeof a==='number');
 return n.length?Math.round(n.reduce((a,b)=>a+b,0)/n.length):null;
}
