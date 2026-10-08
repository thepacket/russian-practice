"""Add a frequency rank to every dictionary entry (8th column), for the vocabulary-size setting.

Usage: python scripts/rank-dictionary.py /path/to/kaikki-russian.jsonl
Needs the `wordfreq` package (pip install wordfreq). Run after import-russian-dictionary.py.

The dictionary holds lemmas, but frequency lists count word forms (был, была, были...), so each
lemma's frequency is the sum of wordfreq's frequencies for the lemma and all of its inflected
forms listed in Wiktionary (Kaikki). Entries are then ranked 1..N within this dictionary.
"""
import collections, json, pathlib, re, sys
from importlib.metadata import version
from wordfreq import word_frequency

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = pathlib.Path(sys.argv[1])
CYRILLIC = re.compile('^[а-яё]+$')
data_json = ROOT / 'public/dictionary-data.json'
rows = json.loads(data_json.read_text())
wanted = {r[0] for r in rows}

# Inflected forms per spelling, from every Russian Wiktionary entry with that headword.
forms = collections.defaultdict(set)
for line in SOURCE.open():
    x = json.loads(line)
    w = x.get('word', '')
    if w not in wanted:
        continue
    forms[w].add(w)
    for f in x.get('forms', []):
        form = f.get('form', '').replace('́', '').lower()
        if CYRILLIC.match(form):
            forms[w].add(form)

def freq(form):
    # wordfreq may hold ё-spelt and е-spelt variants separately; count the larger, never both.
    return max(word_frequency(form, 'ru'), word_frequency(form.replace('ё', 'е'), 'ru'))

score = {w: sum(freq(f) for f in forms[w]) for w in wanted}
order = sorted(wanted, key=lambda w: (-score[w], w))
rank = {w: i + 1 for i, w in enumerate(order)}
for r in rows:
    r[7:] = [rank[r[0]]]

data_json.write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n')
(ROOT / 'lib/dictionary-data.mjs').write_text('// Generated from Kaikki/Wiktionary; CC BY-SA 4.0. See public/dictionary-attribution.json.\nexport default ' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';\n')

attribution = ROOT / 'public/dictionary-attribution.json'
meta = json.loads(attribution.read_text())
meta['frequency'] = {
    'source': f'wordfreq {version("wordfreq")} (Robyn Speer), ru; data under CC BY-SA 4.0',
    'sourceUrl': 'https://github.com/rspeer/wordfreq',
    'method': 'Each lemma’s frequency is the sum of wordfreq word frequencies for the lemma and its inflected forms from the same Wiktionary record; entries are ranked 1..N within this dictionary (ties alphabetical). The rank is the eighth column.',
    'unranked': sum(1 for w in wanted if score[w] == 0),
}
attribution.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
print(f'Ranked {len(rows)} entries ({meta["frequency"]["unranked"]} with no frequency data)')
for w in order[:12]:
    print(' ', rank[w], w, f'{score[w]:.2e}')
