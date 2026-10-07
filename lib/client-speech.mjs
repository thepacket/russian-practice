import {ssml,validateWav,assessmentResult,readBounded} from './protocol.mjs';
const TOKEN_URL='https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken';
export const KEY_STORAGE='rwp.azure-key.v1';
export const APPROVAL_STORAGE='rwp.azure-approved.v1';
export function validKey(key){return typeof key==='string'&&/^[a-fA-F0-9]{32,128}$/.test(key);}
export function readRememberedKey(storage){try{const value=storage?.getItem(KEY_STORAGE);return validKey(value)?value:'';}catch{return '';}}
// A remembered key also remembers whether Azure calls were approved, so setup is needed once per device.
export function readRememberedApproval(storage){try{return !!readRememberedKey(storage)&&storage?.getItem(APPROVAL_STORAGE)==='1';}catch{return false;}}
export function saveRememberedKey(storage,key,remember,approved=false){if(remember){if(!validKey(key))throw new Error('Enter a valid Azure Speech key.');if(!storage)throw new Error('Browser storage is unavailable. Leave Remember unchecked.');storage.setItem(KEY_STORAGE,key);if(approved)storage.setItem(APPROVAL_STORAGE,'1');else storage.removeItem(APPROVAL_STORAGE);}else{storage?.removeItem(KEY_STORAGE);storage?.removeItem(APPROVAL_STORAGE);}}
// Azure's own explanation, without query strings (connection URLs carry the short-lived token).
class AzureError extends Error{}
const azureDetail=text=>String(text||'').replace(/\?\S*/g,'').replace(/\s+/g,' ').trim().slice(0,200);
/** @param {any} options */
export function createSpeechClient({loadSdk=()=>import('microsoft-cognitiveservices-speech-sdk'),fetcher=(...args)=>fetch(...args),storage,timeoutMs=20000}={}){
 let active=false;
 async function perform(kind,{key,word,slow=false,voice='Svetlana',audio,signal}){
  if(!validKey(key))throw new Error('Enter a valid Azure Speech key.');
  if(active)throw new Error('Wait for the current Azure request to finish.');
  const markup=kind==='tts'?ssml(word,slow,voice):null;if(kind==='assess')validateWav(audio);
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  active=true;
  let engine,input,config,assessment;
  const bounded=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(timeoutMs)]);
  try{
   const sdk=await loadSdk();if(bounded.aborted)throw new Error('Cancelled');
   sdk.SpeechRecognizer.enableTelemetry(false);
   // The long-lived key is sent only to Microsoft's token endpoint in a header.
   // Browser WebSockets cannot set authorization headers; SDK uses the short-lived
   // token in its Azure-only WSS URL. No raw key is passed into the SDK.
   const response=await fetcher(TOKEN_URL,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/x-www-form-urlencoded'},body:'',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:bounded});
   if(!response.ok){await response.body?.cancel();throw new AzureError(`Azure rejected the key (HTTP ${response.status})`);}
   const token=new TextDecoder().decode(await readBounded(response,16384));
   if(!token||bounded.aborted)throw new Error('Cancelled');
   config=sdk.SpeechConfig.fromAuthorizationToken(token,'eastus');
   config.speechRecognitionLanguage='ru-RU';config.outputFormat=sdk.OutputFormat.Detailed;
   config.setProperty(sdk.PropertyId.SpeechServiceConnection_EnableAudioLogging,'false');
   if(kind==='tts'){
    config.speechSynthesisOutputFormat=sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    engine=new sdk.SpeechSynthesizer(config,null);
   }else{
    input=sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000,16,1));
    input.write(audio.slice(44));input.close();
    engine=new sdk.SpeechRecognizer(config,sdk.AudioConfig.fromStreamInput(input));
    assessment=new sdk.PronunciationAssessmentConfig(word.text,sdk.PronunciationAssessmentGradingSystem.HundredMark,sdk.PronunciationAssessmentGranularity.Phoneme,true);
    try{assessment.phonemeAlphabet='IPA';}catch{/* Older SDKs: Azure's default phoneme symbols are shown instead. */}
    assessment.applyTo(engine);
   }
   return await new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;bounded.removeEventListener('abort',abort);error?reject(error):resolve(value);};
    const abort=()=>{try{engine?.close();}catch{}finish(signal?.aborted?new Error('Cancelled'):new AzureError(`Azure did not answer within ${Math.round(timeoutMs/1000)} seconds. Check your connection and try again`));};
    bounded.addEventListener('abort',abort,{once:true});if(bounded.aborted){abort();return;}
    const fail=(detail='')=>finish(new AzureError(azureDetail(detail)));
    const success=result=>{
     if(bounded.aborted){abort();return;}
     if(kind==='tts'){
      if(result.reason!==sdk.ResultReason.SynthesizingAudioCompleted||!result.audioData||result.audioData.byteLength>256000){fail(result.errorDetails);return;}
      finish(null,new Blob([result.audioData],{type:'audio/mpeg'}));
     }else{
      try{if(result.reason===sdk.ResultReason.NoMatch){finish(null,{kind:'uncertain',message:'Azure did not recognise a word in this clip. Say the word clearly after tapping Listen, then try again.'});return;}
       if(result.reason!==sdk.ResultReason.RecognizedSpeech){fail(result.errorDetails);return;}
       const raw=result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult);
       if(typeof raw!=='string'||raw.length>262144){fail();return;}
       finish(null,assessmentResult(JSON.parse(raw)));
      }catch{fail();}
     }
    };
    if(kind==='tts')engine.speakSsmlAsync(markup,success,fail);else engine.recognizeOnceAsync(success,fail);
   });
  }catch(e){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   if(bounded.aborted)throw new Error(`Azure could not finish: Azure did not answer within ${Math.round(timeoutMs/1000)} seconds. Check your connection and try again.`);
   if(e instanceof AzureError&&e.message)throw new Error(`Azure could not finish: ${e.message}`);
   throw new Error('Azure could not finish. Check your East US key, quota and connection, then try again.');
  }finally{try{engine?.close();}catch{}try{input?.close();}catch{}try{assessment?.close?.();}catch{}try{config?.close?.();}catch{}active=false;}
 }
 return{say:options=>perform('tts',options),assess:options=>perform('assess',options)};
}
