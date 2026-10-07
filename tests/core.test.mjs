import test from 'node:test';import assert from 'node:assert/strict';
import {words,pickWord} from '../lib/words.mjs';import {toWav} from '../lib/audio.mjs';import {validateWav,assessmentResult,ssml,readBounded} from '../lib/protocol.mjs';
const tone=()=>new Float32Array(48000).map((_,i)=>Math.sin(i/15)*.1);
test('character count excludes stress and preserves ё',()=>{for(const w of words){assert.equal(w.length,[...w.text].length);assert.equal(w.stress.replaceAll('\u0301',''),w.text);}for(let m=3;m<=10;m++)for(let i=0;i<100;i++){const w=pickWord(m,0);assert.ok(w.length<=m);assert.notEqual(w.id,0);}});
test('WAV mono PCM16 resampled and bounded',()=>{const wav=toWav([tone()],48000);assert.equal(wav.byteLength,32044);assert.equal(validateWav(wav).duration,1);assert.equal(toWav(Array(20).fill(tone()),48000).byteLength,256044);});
test('reject silence, malformed and oversized audio',()=>{assert.throws(()=>validateWav(toWav([new Float32Array(48000)],48000)),/quiet/);assert.throws(()=>validateWav(new ArrayBuffer(10)));assert.throws(()=>validateWav(new ArrayBuffer(300000)));});
test('safe score normalization supports REST and SDK',()=>{for(const nested of [false,true]){let scores={AccuracyScore:88.2};let best={Confidence:.8,...(nested?{PronunciationAssessment:scores}:scores),Words:[]};assert.equal(assessmentResult({RecognitionStatus:'Success',NBest:[best]}).accuracy,88);}for(const n of [NaN,Infinity,-3,101,'90',undefined])assert.equal(assessmentResult({RecognitionStatus:'Success',NBest:[{Confidence:.8,AccuracyScore:n}]}).kind,'uncertain');const low=assessmentResult({RecognitionStatus:'Success',NBest:[{Confidence:.2,AccuracyScore:90}]});assert.equal(low.kind,'scored');assert.equal(low.accuracy,90);assert.equal(low.lowConfidence,true);assert.equal(assessmentResult({RecognitionStatus:'Success',NBest:[{AccuracyScore:70}]}).lowConfidence,true);assert.equal(assessmentResult({RecognitionStatus:'Success',NBest:[{Confidence:.8,AccuracyScore:70}]}).lowConfidence,false);assert.equal(assessmentResult({RecognitionStatus:'NoMatch'}).kind,'uncertain');});
test('TTS only supported voice and unchanged pitch',()=>{assert.match(ssml(words[0],true,'Svetlana'),/rate="-50%"/);assert.doesNotMatch(ssml(words[0],true,'Svetlana'),/pitch=/);assert.throws(()=>ssml(words[0],false,'evil'));});
test('read bounds rejects oversize bodies',async()=>{await assert.rejects(()=>readBounded(new Request('https://test',{method:'POST',body:'123456'}),5));});
test('alphabet has the 33 letters in standard order with Azure-supported sounds',async()=>{
 const {alphabet}=await import('../lib/alphabet.mjs');
 assert.equal(alphabet.map(l=>l.lower).join(''),'абвгдеёжзийклмнопрстуфхцчшщъыьэюя');
 assert.ok(alphabet.every(l=>l.upper===l.lower.toUpperCase()));
 const allowed=new Set('aʌəɛiɪɨɔupbtdkgxfvszʂʐ͡ɕmnlrjʲˈˌː.');
 for(const l of alphabet)if(l.sound)assert.ok([...l.sound.say].every(c=>allowed.has(c)),`${l.lower}: ${l.sound.say}`);
 for(const l of alphabet.filter(l=>l.unstressed)){const {example,text}=l.unstressed;
  assert.equal(example.split('\u0301').length,2,`${example} has one stress mark`);assert.equal(text,example.replace('\u0301',''));
  const stressedLetter=example[example.indexOf('\u0301')-1];const unstressedCopies=[...text].filter(c=>c===l.lower).length-(stressedLetter===l.lower?1:0);
  assert.ok(unstressedCopies>=1,`${example} has an unstressed ${l.lower}`);}
 assert.equal(alphabet.find(l=>l.lower==='ё').unstressed,null);
 assert.deepEqual(alphabet.filter(l=>!l.sound).map(l=>l.lower),['ъ','ь']);
 assert.equal(alphabet.filter(l=>l.kind==='vowel').length,10);
 assert.match(ssml({text:'б',ipa:alphabet[1].sound.say},false,'Svetlana'),/<phoneme alphabet="ipa" ph="bə">б<\/phoneme>/);
 const i=alphabet.find(l=>l.lower==='и');assert.equal(i.sound.say,'');
 assert.match(ssml({text:'и',ipa:i.sound.say},false,'Svetlana'),/<break time="250ms"\/>и<\/prosody>/,'plain letter, no phoneme override');
 assert.match(ssml(words[0],false,'Svetlana'),/<break time="250ms"\/><phoneme/,'short lead-in so Android does not clip the start');
});
test('silence trimming keeps the spoken part with a margin',async()=>{
 const {trimSilence}=await import('../lib/audio.mjs');const rate=48000;
 const clip=new Float32Array(rate*8);for(let i=rate*3;i<rate*4;i++)clip[i]=Math.sin(i/7)*0.3;for(let i=0;i<clip.length;i+=97)clip[i]+=0.002;
 const [kept]=trimSilence([clip.subarray(0,rate*5),clip.subarray(rate*5)],rate);
 assert.ok(kept.length>rate*1.5&&kept.length<rate*1.7,`kept ${kept.length/rate}s of an 8s clip with 1s of speech`);
 assert.ok(Math.abs(kept[Math.round(rate*0.5)])>0.1||Math.abs(kept[Math.round(rate*0.5)+3])>0.1,'speech is inside the kept part');
 const quiet=new Float32Array(rate);assert.equal(trimSilence([quiet],rate)[0].length,rate,'all-quiet clip is left for the quiet check');
 assert.ok(validateWav(toWav(trimSilence([clip],rate),rate)).duration<2);
});

test('assessment keeps per-sound scores so the learner sees which sounds were low',()=>{
 const r=assessmentResult({RecognitionStatus:'Success',NBest:[{Confidence:.9,PronunciationAssessment:{AccuracyScore:61},Words:[{Word:'мама',PronunciationAssessment:{AccuracyScore:61,ErrorType:'None'},Phonemes:[{Phoneme:'m',PronunciationAssessment:{AccuracyScore:95}},{Phoneme:'a',PronunciationAssessment:{AccuracyScore:40.4}},{Phoneme:'m',PronunciationAssessment:{AccuracyScore:'bad'}},{Phoneme:'ə',PronunciationAssessment:{AccuracyScore:72}}]}]}]});
 assert.equal(r.accuracy,61);assert.deepEqual(r.words[0].sounds,[{sound:'m',accuracy:95},{sound:'a',accuracy:40},{sound:'m',accuracy:null},{sound:'ə',accuracy:72}]);
 const none=assessmentResult({RecognitionStatus:'Success',NBest:[{Confidence:.9,AccuracyScore:80,Words:[{Word:'да'}]}]});assert.deepEqual(none.words[0].sounds,[]);
});

test('per-sound scores are labelled by letter, then by IPA, then by position; average is rounded',async()=>{
 const {ipaSegments,labelSounds,soundsAverage}=await import('../lib/sounds.mjs');
 assert.deepEqual(ipaSegments('lʲɪˈnʲɛjkə'),['lʲ','ɪ','nʲ','ɛ','j','k','ə']);assert.deepEqual(ipaSegments('t͡ɕaj'),['t͡ɕ','a','j']);assert.deepEqual(ipaSegments('ɕːi'),['ɕː','i']);
 const anon=n=>Array.from({length:n},(_,i)=>({sound:'',accuracy:i*10}));
 assert.deepEqual(labelSounds({text:'линейка',ipa:'lʲɪˈnʲɛjkə'},anon(7)).map(s=>s.label),[...'линейка'],'one sound per letter: letters');
 assert.deepEqual(labelSounds({text:'мать',ipa:'matʲ'},anon(3)).map(s=>s.label),['m','a','tʲ'],'silent ь: IPA');
 assert.deepEqual(labelSounds({text:'да',ipa:'da'},anon(5)).map(s=>s.label),['1','2','3','4','5'],'no match: positions');
 assert.deepEqual(labelSounds({text:'да',ipa:'da'},[{sound:'d',accuracy:9},{sound:'a',accuracy:8}]).map(s=>s.label),['d','a'],'named sounds keep their names');
 assert.equal(soundsAverage([{accuracy:0},{accuracy:31},{accuracy:52},{accuracy:28},{accuracy:100},{accuracy:100},{accuracy:100}]),59);assert.equal(soundsAverage([{accuracy:null}]),null);assert.equal(soundsAverage([]),null);
});
