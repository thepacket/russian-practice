"""Rebuild licensed dictionary data from Kaikki JSONL. Standard library; no remote code.
Usage: python scripts/import-russian-dictionary.py /path/to/kaikki-russian.jsonl
Input URL and snapshot information are recorded in public/dictionary-attribution.json.
"""
import collections, hashlib, json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = pathlib.Path(sys.argv[1])
VOWELS = 'аеиоуыэюяё'
BAD = {'archaic','obsolete','dated','rare','nonstandard','misspelling','vulgar','offensive','derogatory','ethnic-slur','slur','pejorative','historical','dialectal'}
POS = {'noun','verb','adj','adv','pron','num','conj','prep','particle','intj','det'}
# Explicit inventory adaptation only, never generated phonetics from spelling.
# Wiktionary narrow allophones -> Microsoft's documented ru-RU inventory.
MAP = str.maketrans({'ɐ':'ʌ','o':'ɔ','e':'ɛ','ɡ':'g','ɫ':'l','ʊ':'u','æ':'a','ʉ':'u','ɵ':'ɔ'})
ALLOWED = set('aʌəɛiɪɨɔupbtdkgxfvszʂʐ͡ɕmnlrjʲˈˌː.')
counts = collections.Counter(); rows=[]; seen=set()
def stress_number(form):
    vowels=0; stressed=[]
    for ch in form:
        if ch in VOWELS:vowels+=1
        if ch=='́' or ch=='ё':stressed.append(vowels)
    return stressed[0] if len(stressed)==1 else (1 if vowels==1 else None)
def gloss_of(sense):
    # Keep Wiktionary's qualifiers, e.g. "(colloquial)", from the raw gloss. A relational adjective
    # ("(relational) stress") is defined by its noun, which reads like a noun to a learner, so its
    # first part is spelled out: "relating to stress". Possessives ("woodsman's") already read as adjectives.
    raw=(sense.get('raw_glosses') or [None])[-1]
    gloss=raw if isinstance(raw,str) and raw.strip() else sense['glosses'][-1]
    relational='relational' in sense.get('tags',[]) or gloss.startswith('(relational)')
    gloss=re.sub(r'\(relational\)\s*','',gloss).strip()
    # Kaikki sometimes repeats a label inside the leading qualifier, e.g. "(biochemistry, biochemistry)".
    gloss=re.sub(r'^\(([^()]*)\)',lambda m:'('+', '.join(dict.fromkeys(p.strip() for p in m.group(1).split(',')))+')',gloss)
    if relational and gloss:
        first,sep,rest=gloss.partition('; ')
        if not re.search(r"'s?\b|^(of|relating|pertaining)\b",first):first='relating to '+first
        gloss=first+sep+rest
    return gloss
def ipa_stress(ipa):
    vowels='aʌəɛiɪɨɔu'
    if ipa.count('ˈ')==1:return sum(ch in vowels for ch in ipa.split('ˈ')[0])+1
    if 'ˈ' not in ipa and sum(ch in vowels for ch in ipa)==1:return 1
    return None
for line in SOURCE.open():
    x=json.loads(line);counts['sourceRecords']+=1
    text=x.get('word','')
    if x.get('pos') not in POS or not re.fullmatch('[а-яё]+',text):continue
    counts['singleWordRecords']+=1
    senses=[s for s in x.get('senses',[]) if s.get('glosses') and not s.get('form_of') and not s.get('alt_of') and not BAD.intersection(s.get('tags',[]))]
    if not senses:continue
    counts['definitionRecords']+=1
    forms=list(dict.fromkeys(f['form'] for f in x.get('forms',[]) if 'canonical' in f.get('tags',[]) and f['form'].replace('́','')==text))
    if not forms and sum(c in VOWELS for c in text)==1:forms=[text]
    ipas=[s['ipa'] for s in x.get('sounds',[]) if s.get('ipa') and set(s.get('tags',[])) <= {'standard'} and not s.get('note')]
    for form in forms:
        stress=stress_number(form)
        if stress is None:continue
        pronunciation=None
        for original in ipas:
            ipa=original.strip('[]/').translate(MAP)
            if not ipa or set(ipa)-ALLOWED or ipa_stress(ipa)!=stress:continue
            if sum(c in 'aʌəɛiɪɨɔu' for c in ipa)!=sum(c in VOWELS for c in text):continue
            pronunciation=(ipa,original);break
        if not pronunciation:continue
        for sense in senses:
            gloss=gloss_of(sense)
            if not isinstance(gloss,str) or not re.search('[A-Za-z]',gloss) or len(gloss)>300:continue
            if re.search(r'\b(archaic|obsolete|vulgar|offensive|derogatory|slur|misspelling)\b',gloss,re.I):continue
            key=(text,form)
            if key in seen:break
            seen.add(key)
            # Eighth column: frequency rank, filled in by scripts/rank-dictionary.py (0 = not ranked yet).
            rows.append([text,form,gloss,pronunciation[0],pronunciation[1],x['pos'],sense.get('id',''),0]);break
rows.sort(key=lambda r:(r[0],r[1]))
# Keep old numeric IDs for existing open tabs and regression tests, replacing original
# hand-written entries with source-backed equivalents wherever present.
old=['дом','кот','лес','сон','мир','сок','сыр','нос','стол','стул','мама','папа','вода','окно','море','книга','собака','яблоко','молоко','спасибо','пожалуйста','телефон','карандаш','телевизор']
ordered=[]
for w in old:
    match=next((r for r in rows if r[0]==w and (w!='вода' or r[1]=='вода́')),None)
    if match:ordered.append(match);rows.remove(match)
rows=ordered+rows
out=ROOT/'public/dictionary-data.json'
out.write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'lib/dictionary-data.mjs').write_text('// Generated from Kaikki/Wiktionary; CC BY-SA 4.0. See public/dictionary-attribution.json.\nexport default '+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n')
counts.update({'entries':len(rows),'uniqueSpellings':len({r[0] for r in rows}),'maxLetters':max(len(r[0]) for r in rows)})
meta={'source':'English Wiktionary contributors, extracted by Kaikki.org / Wiktextract','sourceUrl':'https://kaikki.org/dictionary/Russian/','downloadUrl':'https://kaikki.org/dictionary/Russian/kaikki.org-dictionary-Russian.jsonl','dumpDate':'2026-09-02','extractionDate':'2026-10-03','retrievedDate':'2026-10-05','sourceSha256':hashlib.file_digest(SOURCE.open('rb'), 'sha256').hexdigest(),'license':'CC BY-SA 4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/','modifications':'Selected lowercase single-word dictionary lemmas with English glosses, explicit or monosyllabic stress, and a matching source IPA. Excluded tagged unsuitable/obsolete senses, inflections, names, multiword expressions and ambiguous/unsupported phonetics. Selected one gloss for each spelling/stress pair, keeping Wiktionary’s leading qualifiers (for example "(colloquial)") and writing relational-adjective glosses as "relating to …". IPA mapped to Azure ru-RU inventory; original IPA retained. Synthesized speech has not been audio-validated.','ipaMapping':{chr(k):v for k,v in MAP.items()},'counts':dict(counts),'lettersHistogram':dict(sorted(collections.Counter(len(r[0]) for r in rows).items()))}
(ROOT/'public/dictionary-attribution.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
starter=next(r for r in rows if r[0]=='мама')
summary={'dictionarySize':counts['uniqueSpellings'],'entryCount':counts['entries'],'maxWordLength':counts['maxLetters'],'lengthCounts':{str(cap):sum(len(r[0])<=cap for r in rows) for cap in range(1,counts['maxLetters']+1)},'initialWord':dict(zip(['text','stress','meaning','ipa','sourceIpa','pos','senseId'],starter))}
summary['initialWord'].update({'id':rows.index(starter),'length':len(starter[0]),'source':'https://en.wiktionary.org/wiki/мама#Russian'})
(ROOT/'lib/dictionary-summary.mjs').write_text('// Generated dictionary metadata; CC BY-SA 4.0. See /dictionary-sources.\nexport default '+json.dumps(summary,ensure_ascii=False,separators=(',',':'))+';\n')
print(json.dumps(meta,ensure_ascii=False,indent=2))
