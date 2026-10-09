'use client';
// Everything Wiktionary has on a word, rendered from its full Kaikki records. Known fields get a
// readable layout; whatever is left is listed under "Other data". Wiki housekeeping (categories,
// link texts, template source), audio file references and derived terms are not shown. No links: the app never opens external pages.
type Rec=Record<string,any>;
const KNOWN=new Set(['word','lang','lang_code','pos','head_templates','forms','sounds','senses','etymology_text','etymology_links','etymology_templates','etymology_number','inflection_templates','related','derived','synonyms','antonyms','hypernyms','hyponyms','coordinate_terms','holonyms','meronyms','descendants','hyphenations','wikipedia','categories','abbreviations','proverbs','info_templates','form_of','alt_of','abbreviation']);
const TERM_KEYS:[string,string][]=[['synonyms','Synonyms'],['antonyms','Antonyms'],['hypernyms','Hypernyms'],['hyponyms','Hyponyms'],['coordinate_terms','Coordinate terms'],['holonyms','Holonyms'],['meronyms','Meronyms'],['related','Related terms'],['form_of','Form of'],['alt_of','Alternative form of'],['abbreviations','Abbreviations'],['proverbs','Proverbs']];
const text=(v:any):string=>typeof v==='string'?v:Array.isArray(v)?v.map(text).join(' '):v==null?'':JSON.stringify(v);
function Term({t}:{t:any}){
 if(typeof t==='string')return <li lang="ru">{t}</li>;
 const extra=[t.english,t.sense,t.topics&&text(t.topics),t.qualifier,t.raw_tags&&text(t.raw_tags),t.lang&&t.lang!=='Russian'?t.lang:''].filter(Boolean).join(' · ');
 return <li><span lang="ru">{t.word??t.form??text(t)}</span>{t.roman&&<span className="roman"> {t.roman}</span>}{t.tags?.length>0&&<span className="tags"> {t.tags.join(', ')}</span>}{extra&&<span className="note"> — {extra}</span>}</li>;
}
function Terms({items,label}:{items:any[];label:string}){
 if(!Array.isArray(items)||!items.length)return null;
 return <div className="block"><h4>{label}</h4><ul className="terms">{items.map((t,i)=><Term key={i} t={t}/>)}</ul></div>;
}
function Examples({items}:{items:any[]}){
 if(!Array.isArray(items)||!items.length)return null;
 return <ul className="examples">{items.map((e,i)=><li key={i}><span lang="ru">{e.text??e.example??text(e)}</span>{e.roman&&<span className="roman"> {e.roman}</span>}{(e.english||e.translation)&&<span className="en">{e.english??e.translation}</span>}{e.literal_meaning&&<span className="en">literally: {e.literal_meaning}</span>}{(e.ref||e.note)&&<span className="note">{[e.ref,e.note].filter(Boolean).join(' · ')}</span>}</li>)}</ul>;
}
function Sense({s,n}:{s:Rec;n:number}){
 const gloss=(s.raw_glosses??s.glosses??[]).join('; ');
 const marks=[s.tags&&text(s.tags),s.qualifier,s.raw_tags&&text(s.raw_tags),s.topics&&text(s.topics)].filter(Boolean).join(' · ');
 const rest=Object.keys(s).filter(k=>!['glosses','raw_glosses','tags','raw_tags','qualifier','topics','examples','id','links','categories','synonyms','antonyms','hypernyms','hyponyms','coordinate_terms','holonyms','meronyms','derived','related','form_of','alt_of','wikipedia','senseid','head_nr','taxonomic','info_templates'].includes(k));
 return <li className="sense"><p><strong>{n}.</strong> {gloss||'(no gloss)'}{marks&&<span className="tags"> {marks}</span>}</p>
  {s.wikipedia&&<p className="note">Wikipedia: {text(s.wikipedia)}</p>}{s.taxonomic&&<p className="note">Taxonomic: {s.taxonomic}</p>}
  <Examples items={s.examples}/>
  {TERM_KEYS.map(([k,l])=><Terms key={k} items={s[k]} label={l}/>)}
  {rest.length>0&&<details className="sub"><summary>Other sense data</summary><pre>{JSON.stringify(Object.fromEntries(rest.map(k=>[k,s[k]])),null,1)}</pre></details>}
 </li>;
}
function Record({r,index,total}:{r:Rec;index:number;total:number}){
 const canonical=(r.forms??[]).find((f:any)=>f.tags?.includes('canonical'))?.form??r.word;
 // Kaikki lists table bookkeeping as pseudo-forms ("no-table-tags", "ru-noun-table"); those are not forms of the word.
 const forms=(r.forms??[]).filter((f:any)=>!f.tags?.includes('canonical')&&!/table|template/i.test([f.form,...(f.tags??[])].join(' '))&&!String(f.form).includes('-'));
 const sounds=r.sounds??[];
 const other=Object.keys(r).filter(k=>!KNOWN.has(k));
 return <section className="record">
  <h3 lang="ru">{canonical}<span className="pos"> · {r.pos}{total>1?` · entry ${index+1} of ${total}`:''}{r.etymology_number?` · etymology ${r.etymology_number}`:''}</span></h3>
  {(r.head_templates??[]).map((h:any,i:number)=>h.expansion&&<p key={i} className="head" lang="ru">{h.expansion}</p>)}
  {sounds.some((s:any)=>!(s.audio||s.ogg_url||s.mp3_url))&&<div className="block"><h4>Pronunciation</h4><ul className="terms">{sounds.map((s:any,i:number)=>{if(s.audio||s.ogg_url||s.mp3_url)return null;const parts=[s.ipa&&`IPA ${s.ipa}`,s.enpr&&`enPR ${s.enpr}`,s.rhymes&&`rhymes ${s.rhymes}`,s.homophone&&`homophone ${s.homophone}`,s.note,s.tags&&text(s.tags),s.raw_tags&&text(s.raw_tags)].filter(Boolean);return parts.length?<li key={i}>{parts.join(' · ')}</li>:null;})}</ul></div>}
  {Array.isArray(r.hyphenations)&&r.hyphenations.length>0&&<p className="note">Hyphenation: {r.hyphenations.map((h:any)=>Array.isArray(h.parts)?h.parts.join('‧'):text(h)).join(', ')}</p>}
  <div className="block"><h4>Meanings</h4><ol className="senses">{(r.senses??[]).map((s:Rec,i:number)=><Sense key={i} s={s} n={i+1}/>)}</ol></div>
  {forms.length>0&&<details className="block" open={forms.length<=12}><summary><h4>Forms ({forms.length})</h4></summary><ul className="forms">{forms.map((f:any,i:number)=><li key={i}><span lang="ru">{f.form}</span>{f.roman&&<span className="roman"> {f.roman}</span>}<span className="tags"> {[...(f.tags??[]),...(f.raw_tags??[])].join(' ')}{f.source?` · ${f.source}`:''}</span></li>)}</ul></details>}
  {r.etymology_text&&<div className="block"><h4>Etymology</h4><p className="etym">{r.etymology_text}</p></div>}
  {TERM_KEYS.map(([k,l])=><Terms key={k} items={r[k]} label={l}/>)}
  <Terms items={r.descendants} label="Descendants"/>
  {r.wikipedia&&<p className="note">Wikipedia: {text(r.wikipedia)}</p>}
  {other.length>0&&<details className="sub"><summary>Other data ({other.join(', ')})</summary><pre>{JSON.stringify(Object.fromEntries(other.map(k=>[k,r[k]])),null,1)}</pre></details>}
 </section>;
}
// The Russian word under a tap (a run of Cyrillic letters, stress mark removed), or null.
export function wordAtPoint(doc:Document,x:number,y:number):string|null{
 let node:Node|null=null,offset=0;
 const d=doc as any;
 if(d.caretRangeFromPoint){const r=d.caretRangeFromPoint(x,y);if(r){node=r.startContainer;offset=r.startOffset;}}
 else if(d.caretPositionFromPoint){const p=d.caretPositionFromPoint(x,y);if(p){node=p.offsetNode;offset=p.offset;}}
 if(!node||node.nodeType!==3)return null;
 const t=node.textContent??'',ru=/[а-яё\u0301]/i;let a=offset,b=offset;
 while(a>0&&ru.test(t[a-1]))a--;while(b<t.length&&ru.test(t[b]))b++;
 const w=t.slice(a,b).replace(/\u0301/g,'');return w?w:null;
}
export default function WordDetails({records,loading,error,onSpeak,status}:{records:Rec[]|null;loading:boolean;error:string;onSpeak?:(word:string)=>void;status?:string}){
 if(loading)return <p className="muted">Loading everything about this word…</p>;
 if(error)return <p className="setup-message" role="alert">{error}</p>;
 if(!records||!records.length)return <p className="muted">No further information is available for this word.</p>;
 return <>
  <p className="alphabet-status" role="status">{status||'Tap any Russian word to hear it.'}</p>
  <div className="details" onClick={e=>{if(!onSpeak)return;const target=e.target as HTMLElement;if(target.closest('summary'))return;const w=wordAtPoint(target.ownerDocument,e.clientX,e.clientY);if(w)onSpeak(w);}}>{records.map((r,i)=><Record key={i} r={r} index={i} total={records.length}/>)}</div>
 </>;
}
