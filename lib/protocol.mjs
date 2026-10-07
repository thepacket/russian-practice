export const MAX_AUDIO_BYTES=256044; // Eight seconds, mono PCM16 at 16 kHz.
export function validateWav(bytes){
 const v=new DataView(bytes); const s=(o,n)=>String.fromCharCode(...new Uint8Array(bytes,o,n));
 if(bytes.byteLength<3244||bytes.byteLength>MAX_AUDIO_BYTES||s(0,4)!=='RIFF'||s(8,4)!=='WAVE'||s(12,4)!=='fmt '||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||v.getUint16(22,true)!==1||v.getUint32(24,true)!==16000||v.getUint32(28,true)!==32000||v.getUint16(32,true)!==2||v.getUint16(34,true)!==16||s(36,4)!=='data'||v.getUint32(40,true)!==bytes.byteLength-44||v.getUint32(4,true)!==bytes.byteLength-8)throw new Error('Record a short clip, up to eight seconds.');
 let power=0,peak=0;for(let i=44;i<bytes.byteLength;i+=2){const n=v.getInt16(i,true)/32768;power+=n*n;peak=Math.max(peak,Math.abs(n));} if(Math.sqrt(power/((bytes.byteLength-44)/2))<0.003)throw new Error('The recording is too quiet. Move closer and try again.');
 return {duration:(bytes.byteLength-44)/32000,clipped:peak>0.995};
}
// A dictionary word is sent as plain text with its stress mark, so Azure's Russian voice applies its own
// reduction and palatalisation: forcing the Wiktionary IPA (mapped onto Azure's smaller symbol set, e.g.
// ɐ→ʌ, e→ɛ) made words sound wrong. Single sounds (the Alphabet) still need the IPA override.
const xml=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function spoken(word){if(word.stress)return xml(word.stress);if(word.ipa)return `<phoneme alphabet="ipa" ph="${xml(word.ipa)}">${xml(word.text)}</phoneme>`;return xml(word.text);}
export function ssml(word,slow,voice){if(!['Svetlana','Dmitry'].includes(voice))throw new Error('Unknown voice.');return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ru-RU"><voice name="ru-RU-${voice}Neural"><prosody rate="${slow?'-50%':'0%'}"><break time="250ms"/>${spoken(word)}</prosody></voice></speak>`;}
const score=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100?Math.round(n):null;
export function assessmentResult(data){
 if(data?.RecognitionStatus!=='Success')return {kind:'uncertain',message:'No reliable speech result. Try again in a quiet place.'};
 const best=Array.isArray(data.NBest)?data.NBest[0]:null; if(!best||typeof best!=='object')return {kind:'uncertain',message:'Azure did not return a usable pronunciation score.'};
 // Confidence is about which words Azure heard, not pronunciation, and is often low for one
 // learner word; keep the score and flag it as rough rather than hiding it.
 const confidence=typeof best.Confidence==='number'&&Number.isFinite(best.Confidence)?best.Confidence:null;
 const a=best.PronunciationAssessment??best; const accuracy=score(a?.AccuracyScore); if(accuracy===null)return {kind:'uncertain',message:'Azure did not return a usable pronunciation score.'};
 // `raw` keeps Azure's top result (bounded) for the troubleshooting view in Settings; it stays in memory only.
 return {kind:'scored',accuracy,lowConfidence:confidence===null||confidence<0.5,raw:JSON.stringify(best).slice(0,20000),recognized:typeof best.Display==='string'?best.Display.slice(0,100):'',words:(Array.isArray(best.Words)?best.Words:[]).filter(w=>w&&typeof w==='object').slice(0,8).map(w=>({word:String(w.Word??'').slice(0,50),accuracy:score((w.PronunciationAssessment??w).AccuracyScore),error:String((w.PronunciationAssessment??w).ErrorType??'').slice(0,40),
  // Per-sound scores (phoneme granularity) show which sounds pulled the word score down.
  sounds:(Array.isArray(w.Phonemes)?w.Phonemes:[]).filter(p=>p&&typeof p==='object').slice(0,40).map(p=>({sound:String(p.Phoneme??'').slice(0,12),accuracy:score((p.PronunciationAssessment??p).AccuracyScore)}))}))};
}
export async function readBounded(request,limit){
 const reader=request.body?.getReader();if(!reader)throw new Error('Empty request.');
 const parts=[];let total=0,timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Request timed out.'));void reader.cancel();},15000);});
 try{for(;;){const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw new Error('Request too large.');}parts.push(value);}const result=new Uint8Array(total);let off=0;for(const p of parts){result.set(p,off);off+=p.length;}return result.buffer;}
 finally{clearTimeout(timer);reader.releaseLock();}
}
