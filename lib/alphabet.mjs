// The 33 letters in standard order. `ipa` is shown to the learner; `say` is the same sound in the
// IPA subset Azure ru-RU accepts (see scripts/import-russian-dictionary.py). Consonants are voiced
// with a short neutral vowel, as in "buh", because a lone plosive is barely audible.
// Vowels are held (ː) so a single short sound such as [i] is long enough to hear clearly.
// An empty `say` sends the plain letter, which Azure reads as the vowel itself.
const vowel=(upper,lower,name,ipa,say,unstressedIpa,unstressedSay,note='')=>({upper,lower,name,kind:'vowel',sound:{ipa,say:say&&say+'ː'},unstressed:unstressedIpa?{ipa:unstressedIpa,say:unstressedSay+'ː'}:null,note});
const consonant=(upper,lower,name,ipa,say,note='')=>({upper,lower,name,kind:'consonant',sound:{ipa,say:say+'ə'},unstressed:null,note});
const sign=(upper,lower,name,note)=>({upper,lower,name,kind:'sign',sound:null,unstressed:null,note});
export const alphabet=[
 vowel('А','а','а','[a]','a','[ɐ] [ə]','ʌ'),
 consonant('Б','б','бэ','[b]','b','[p] at word end'),
 consonant('В','в','вэ','[v]','v','[f] at word end'),
 consonant('Г','г','гэ','[ɡ]','g','[k] at word end'),
 consonant('Д','д','дэ','[d]','d','[t] at word end'),
 vowel('Е','е','е','[je]','jɛ','[jɪ] [ɪ]','jɪ','softens the consonant before it'),
 vowel('Ё','ё','ё','[jo]','jɔ','','','always stressed'),
 consonant('Ж','ж','жэ','[ʐ]','ʐ','[ʂ] at word end'),
 consonant('З','з','зэ','[z]','z','[s] at word end'),
 vowel('И','и','и','[i]','','[ɪ]','ɪ'), // Azure returned silence for ph="iː"
 consonant('Й','й','и кра́ткое','[j]','j'),
 consonant('К','к','ка','[k]','k'),
 consonant('Л','л','эль','[ɫ]','l'),
 consonant('М','м','эм','[m]','m'),
 consonant('Н','н','эн','[n]','n'),
 vowel('О','о','о','[o]','ɔ','[ɐ] [ə]','ʌ'),
 consonant('П','п','пэ','[p]','p'),
 consonant('Р','р','эр','[r]','r','rolled'),
 consonant('С','с','эс','[s]','s'),
 consonant('Т','т','тэ','[t]','t'),
 vowel('У','у','у','[u]','u','[ʊ]','u'),
 consonant('Ф','ф','эф','[f]','f'),
 consonant('Х','х','ха','[x]','x'),
 consonant('Ц','ц','цэ','[t͡s]','t͡s'),
 consonant('Ч','ч','че','[t͡ɕ]','t͡ɕ','always soft'),
 consonant('Ш','ш','ша','[ʂ]','ʂ'),
 consonant('Щ','щ','ща','[ɕː]','ɕː','always soft'),
 sign('Ъ','ъ','твёрдый знак','no sound; separates, as in подъе́зд'),
 vowel('Ы','ы','ы','[ɨ]','ɨ','[ɨ]','ɨ'),
 sign('Ь','ь','мя́гкий знак','no sound; softens the consonant before it'),
 vowel('Э','э','э','[ɛ]','ɛ','[ɪ] [ɨ]','ɪ'),
 vowel('Ю','ю','ю','[ju]','ju','[jʊ]','ju'),
 vowel('Я','я','я','[ja]','ja','[jɪ]','jɪ'),
];
