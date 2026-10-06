import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {build} from 'esbuild';
import {words,pickWord} from '../lib/words.mjs';
import {readFile} from 'node:fs/promises';
import {KEY_STORAGE,APPROVAL_STORAGE,saveRememberedKey} from '../lib/client-speech.mjs';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
await build({plugins:[{name:'mock-services',setup(b){
 b.onLoad({filter:/client-dictionary\.mjs$/},()=>({contents:`export function subscribeDictionaryStatus(){return ()=>{};}export async function chooseWord(max,previous,signal){const r=await fetch('/api/word?max='+max+'&previous='+previous.id,{signal});if(!r.ok)throw Error('Dictionary unavailable');return r.json();}`,loader:'js'}));
 b.onLoad({filter:/client-speech\.mjs$/},async({path})=>({contents:(await readFile(path,'utf8')).replace(/export function createSpeechClient[\s\S]*$/,`export const createSpeechClient=()=>({say:async o=>(await fetch('/api/practice',{signal:o.signal})).blob(),assess:async o=>(await fetch('/api/practice',{signal:o.signal})).json()});`),loader:'js'}));
}}],entryPoints:['app/practice.tsx'],outfile:'tests/.practice-test.cjs',bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react-dom/*'],alias:{'@':process.cwd()},logLevel:'silent'});
const bootstrap=new JSDOM('<!doctype html><body/>');Object.defineProperty(globalThis,'window',{value:bootstrap.window,configurable:true,writable:true});Object.defineProperty(globalThis,'document',{value:bootstrap.window.document,configurable:true,writable:true});
const {default:Practice}=require('./.practice-test.cjs');const React=require('react');const {createRoot}=require('react-dom/client');
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const {act}=React;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const flush=async()=>{await act(async()=>{await new Promise(r=>setTimeout(r,0))})};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function memoryStorage(){const data=new Map();const writes=[];return{data,writes,getItem:k=>data.get(k)??null,setItem(k,v){writes.push(['set',k]);data.set(k,String(v));},removeItem(k){writes.push(['remove',k]);data.delete(k);}};}
async function mount(overrides={},tools=[],options={}){const dom=new JSDOM('<div id="root"></div>',{url:'https://russian-word-practice.apacket.chatgpt.site',pretendToBeVisual:true});for(const p of ['window','document','navigator','HTMLElement','HTMLFormElement','HTMLInputElement','HTMLSelectElement','DocumentFragment','Element','Node','MutationObserver','Event','CustomEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','HTMLButtonElement','NodeFilter'])Object.defineProperty(globalThis,p,{value:dom.window[p],configurable:true,writable:true});const storage=options.storage??memoryStorage();if(!options.storage)saveRememberedKey(storage,'a'.repeat(32),true);Object.defineProperty(window,'localStorage',{value:storage,configurable:true});let media={getUserMedia:async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'})}};Object.defineProperty(navigator,'mediaDevices',{value:media,configurable:true});document.modelContext={registerTool(tool,opts){tools.push(tool);}};globalThis.fetch=async(url)=>{if(String(url).startsWith('/api/word')){const u=new URL(url,'https://test');return Response.json(pickWord(Number(u.searchParams.get('max')),Number(u.searchParams.get('previous'))));}return Response.json({configured:true,enabled:true,setupReady:true});};Object.assign(globalThis,overrides);let root=createRoot(document.getElementById('root'));await act(async()=>root.render(options.strict?React.createElement(React.StrictMode,null,React.createElement(Practice)):React.createElement(Practice)));await flush();
if(options.autoSetup!==false){
await act(async()=>document.querySelector('[aria-label="Open Azure setup"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true})));await flush();
const checks=document.querySelectorAll('[role="checkbox"]');for(const i of [1,2])await act(async()=>checks[i].dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await flush();
}
return {dom,media,storage,async close(){await act(async()=>root.unmount());dom.window.close();}};}
const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent===name);
async function click(name){const b=button(name);assert.ok(b,'missing '+name);await act(async()=>b.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));await flush();}
test('legacy remembered key without approval asks once, then reloads ready without re-entry',async()=>{
 const storage=memoryStorage(),dummy='b'.repeat(32);
 saveRememberedKey(storage,dummy,true);storage.writes.length=0;
 const first=await mount({},[],{storage,autoSetup:false,strict:true});
 assert.equal(storage.getItem(KEY_STORAGE),dummy);assert.deepEqual(storage.writes,[]);
 assert.match(document.body.textContent,/Saved key restored/);
 await click('Say');
 assert.match(document.body.textContent,/You do not need to enter your key again/);
 const input=document.querySelector('input[type="password"]');
 assert.equal(input.value,'');assert.equal(input.required,false);
 const checks=document.querySelectorAll('[role="checkbox"]');
 assert.equal(checks[0].getAttribute('aria-checked'),'true');
 assert.equal(checks[1].getAttribute('aria-checked'),'false');
 assert.equal(checks[2].getAttribute('aria-checked'),'false');
 for(const i of [1,2])await act(async()=>checks[i].dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
 await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await flush();
 assert.equal(storage.getItem(KEY_STORAGE),dummy);assert.equal(storage.getItem(APPROVAL_STORAGE),'1');
 assert.match(document.body.textContent,/won’t need to enter it again/);
 await first.close();
 for(let reload=0;reload<2;reload++){
  storage.writes.length=0;
  let speech=0;const app=await mount({},[],{storage,autoSetup:false,strict:true});
  assert.deepEqual(storage.writes,[]);
  assert.match(document.body.textContent,/As many tries as you need/);
  globalThis.fetch=async()=>{speech++;return new Response(new Uint8Array([1,2,3]));};
  globalThis.Audio=class{play(){return Promise.resolve();}pause(){}};
  await click('Say');
  assert.equal(document.querySelector('[role="dialog"]'),null,'Say must not reopen setup');assert.equal(speech,1);
  await app.close();assert.equal(storage.getItem(KEY_STORAGE),dummy);
 }
});
test('first setup remembers key and approval by default',async()=>{
 const storage=memoryStorage();
 const app=await mount({},[],{storage,autoSetup:false});
 await click('Say');
 assert.equal(document.querySelector('[role="checkbox"]').getAttribute('aria-checked'),'true');
 const input=document.querySelector('input[type="password"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'d'.repeat(32));input.dispatchEvent(new window.Event('input',{bubbles:true}));});
 const checks=document.querySelectorAll('[role="checkbox"]');
 for(const i of [1,2])await act(async()=>checks[i].dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
 await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await flush();
 assert.equal(storage.getItem(KEY_STORAGE),'d'.repeat(32));assert.equal(storage.getItem(APPROVAL_STORAGE),'1');
 await app.close();
});
test('unchecking Remember keeps nothing on the device',async()=>{
 const storage=memoryStorage();saveRememberedKey(storage,'e'.repeat(32),true,true);
 const app=await mount({},[],{storage,autoSetup:false});
 await act(async()=>document.querySelector('[aria-label="Open Azure setup"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true})));await flush();
 const checks=document.querySelectorAll('[role="checkbox"]');
 assert.equal(checks[1].getAttribute('aria-checked'),'true');assert.equal(checks[2].getAttribute('aria-checked'),'true');
 await act(async()=>checks[0].dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
 await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await flush();
 assert.equal(storage.getItem(KEY_STORAGE),null);assert.equal(storage.getItem(APPROVAL_STORAGE),null);
 await app.close();
});
test('explicit Forget removes the saved key and approval and the next load requests a key',async()=>{
 const storage=memoryStorage();saveRememberedKey(storage,'c'.repeat(32),true,true);
 const first=await mount({},[],{storage,autoSetup:false});
 await act(async()=>document.querySelector('[aria-label="Open Azure setup"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true})));await flush();
 await click('Forget key on this device');
 assert.equal(storage.getItem(KEY_STORAGE),null);assert.equal(storage.getItem(APPROVAL_STORAGE),null);await first.close();
 const second=await mount({},[],{storage,autoSetup:false});await click('Say');
 assert.equal(document.querySelector('input[type="password"]').required,true);
 const checks=document.querySelectorAll('[role="checkbox"]');
 assert.equal(checks[1].getAttribute('aria-checked'),'false');assert.equal(checks[2].getAttribute('aria-checked'),'false');
 assert.doesNotMatch(document.body.textContent,/Saved key restored/);await second.close();
});
test('microphone denied gives retry guidance and no Validate',async()=>{const app=await mount();await click('Listen');assert.match(document.body.textContent,/permission was denied/);assert.equal(button('Validate').disabled,true);await app.close();});
test('Next invalidates pending permission and stops late stream',async()=>{const app=await mount();const d=deferred();let stopped=0;app.media.getUserMedia=()=>d.promise;await click('Listen');await click('Next word ');await act(async()=>d.resolve({getTracks:()=>[{stop:()=>stopped++}]}));await flush();assert.equal(stopped,1);assert.equal(button('Validate').disabled,true);assert.doesNotMatch(document.body.textContent,/Waiting for microphone/);await app.close();});
test('late TTS does not play after Next',async()=>{let played=0;class AudioMock{play(){played++;return Promise.resolve()}pause(){}}const app=await mount({Audio:AudioMock});const d=deferred();globalThis.fetch=()=>d.promise;await click('Say');await click('Next word ');await act(async()=>d.resolve(new Response(new Uint8Array([1,2,3]))));await flush();assert.equal(played,0);await app.close();});
test('blocked autoplay can replay prepared speech without another Azure request',async()=>{
 let plays=0,requests=0,audio;
 class AudioMock{constructor(){audio=this;}play(){return ++plays===1?Promise.reject(new DOMException('blocked','NotAllowedError')):Promise.resolve();}pause(){}}
 const app=await mount({Audio:AudioMock});
 globalThis.fetch=async()=>{requests++;return new Response(new Uint8Array([1,2,3]));};
 await click('Say');assert.match(document.body.textContent,/Audio is ready/);
 await click('Play audio');assert.equal(plays,2);assert.equal(requests,1);assert.match(document.body.textContent,/Listen to the word/);
 await act(async()=>audio.onended());assert.equal(button('Play audio'),undefined);
 await app.close();
});
test('Next discards speech awaiting a playback gesture',async()=>{
 let paused=0;
 class AudioMock{play(){return Promise.reject(new DOMException('blocked','NotAllowedError'));}pause(){paused++;}}
 const app=await mount({Audio:AudioMock});
 globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]));
 await click('Say');assert.ok(button('Play audio'));
 globalThis.fetch=async()=>Response.json(words[0]);await click('Next word ');
 assert.equal(button('Play audio'),undefined);assert.equal(paused,1);
 await app.close();
});
test('playback status waits for the browser and ignores late completion after Next',async()=>{
 const started=deferred();
 class AudioMock{play(){return started.promise;}pause(){}}
 const app=await mount({Audio:AudioMock});globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]));
 await click('Say');assert.match(document.body.textContent,/Starting audio/);assert.doesNotMatch(document.body.textContent,/Listen to the word/);
 globalThis.fetch=async()=>Response.json(words[0]);await click('Next word ');
 await act(async()=>started.resolve());assert.doesNotMatch(document.body.textContent,/Listen to the word/);
 await app.close();
});
test('record Validate then Next discards stale score, all tracks stop',async()=>{let worklet,stopped=0;class Context{sampleRate=48000;audioWorklet={addModule:async()=>{}};destination={};resume(){return Promise.resolve()}close(){return Promise.resolve()}createMediaStreamSource(){return {connect(){}}}createGain(){return{gain:{value:1},connect(){return this}}}}class Worklet{port={};constructor(){worklet=this}connect(){return this}disconnect(){}}
const app=await mount({AudioContext:Context,AudioWorkletNode:Worklet});app.media.getUserMedia=async()=>({getTracks:()=>[{stop:()=>stopped++}]});await click('Listen');await act(async()=>worklet.port.onmessage({data:new Float32Array(48000).fill(.1)}));const d=deferred();globalThis.fetch=()=>d.promise;await click('Validate');assert.equal(stopped,1);await click('Next word ');await act(async()=>d.resolve(Response.json({kind:'scored',accuracy:99})));await flush();assert.doesNotMatch(document.body.textContent,/99/);assert.equal(button('Validate').disabled,true);await app.close();});

test('WebMCP read tool mirrors visible word and rejects arguments',async()=>{const tools=[];const app=await mount({},tools);let tool=tools.at(-1);assert.equal(tool.name,'read_practice_word');assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.execute({}).word,document.querySelector('h1').textContent);assert.throws(()=>tool.execute({record:true}));await click('Next word ');tool=tools.at(-1);assert.equal(tool.execute({}).word,document.querySelector('h1').textContent);await app.close();});

test('latest Next response wins; old dictionary response cannot replace it',async()=>{
 const app=await mount();const first=deferred(),second=deferred();let calls=0;
 globalThis.fetch=()=>++calls===1?first.promise:second.promise;
 await click('Next word ');assert.equal(button('Say').disabled,true);await click('Next word ');
 await act(async()=>second.resolve(Response.json(words[0])));await flush();assert.equal(document.querySelector('h1').textContent,words[0].stress);
 await act(async()=>first.resolve(Response.json(words[1])));await flush();assert.equal(document.querySelector('h1').textContent,words[0].stress);assert.equal(button('Say').disabled,false);await app.close();
});
test('dictionary failure keeps previous valid word and permits retry',async()=>{
 const app=await mount();const initial=document.querySelector('h1').textContent;
 globalThis.fetch=async()=>Response.json({error:'Dictionary unavailable'},{status:503});await click('Next word ');
 assert.equal(document.querySelector('h1').textContent,initial);assert.match(document.body.textContent,/Dictionary unavailable/);assert.equal(button('Say').disabled,false);
 globalThis.fetch=async()=>Response.json(words[0]);await click('Next word ');assert.equal(document.querySelector('h1').textContent,words[0].stress);await app.close();
});

test('Next preserves a pending maximum-letter change',async()=>{
 const app=await mount();HTMLElement.prototype.scrollIntoView=()=>{};const first=deferred(),second=deferred();const requests=[];
 globalThis.fetch=(url)=>{requests.push(String(url));return requests.length===1?first.promise:second.promise;};
 await act(async()=>document.getElementById('max').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));await flush();
 const option=[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent==='3');assert.ok(option,'3-letter option');
 await act(async()=>option.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));await flush();
 assert.match(requests[0],/max=3/);await click('Next word ');assert.match(requests[1],/max=3/);
 await act(async()=>second.resolve(Response.json(words[0])));await flush();assert.equal(document.getElementById('max').textContent,'3');
 await act(async()=>first.resolve(Response.json(words[1])));await flush();assert.equal(document.querySelector('h1').textContent,words[0].stress);
 Object.defineProperty(document,'hidden',{value:true,configurable:true});await act(async()=>document.dispatchEvent(new window.Event('visibilitychange')));
 globalThis.fetch=async(url)=>{requests.push(String(url));return Response.json(words[1]);};await click('Next word ');assert.match(requests.at(-1),/max=3/);assert.equal(document.getElementById('max').textContent,'3');await app.close();
});
