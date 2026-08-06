# Sound Lab — Consonants in Detail

Stage 1 (**Review**) of the English consonant listening system for
Colegio Nocturno de Cariari. Content adapted from *Accurate English*, Chapter 15.

## Files

| File | What it does |
|---|---|
| `index.html` | Study plan + the ten review units + self-check |
| `style.css` | Design system (dark editorial, teal / pink / purple) |
| `script.js` | Generative background, speech playback, scroll-linked diagram, meter |

Drop all three at the root of the repo and turn on GitHub Pages
(*Settings → Pages → Deploy from branch → main / root*). No build step,
no dependencies, no framework.

## The ten units

| # | Contrast | Where it is made |
|---|---|---|
| 01 | /s/ – /z/ | tooth ridge |
| 02 | /θ/ – /ð/ | teeth |
| 03 | /ʃ/ – /tʃ/ | behind the ridge |
| 04 | /dʒ/ – /y/ | behind the ridge → palate |
| 05 | /ʒ/ | behind the ridge |
| 06 | final /ts/ – /dz/ | tooth ridge |
| 07 | /f/ /v/ /b/ /w/ | lip + teeth, lips |
| 08 | /h/ | vocal folds |
| 09 | /r/ – /l/ | ridge / palate |
| 10 | final /m/ /n/ /ŋ/ | lips, ridge, soft palate |

Each unit carries the same five blocks: **Your mouth** (3 steps),
**The one difference**, **How it is written**, **Listen** (words + minimal
pairs), and a Spanish-speaker warning. Nothing is hidden and nothing is
graded — the difficulty is deliberately saved for Stage 2.

## Audio

Playback uses the browser's Web Speech API, so there are no audio files to
host and it works offline once the page is cached. The voice selector ranks
the voices installed on the device and puts Natural / Neural / Google
engines first. On Windows, *Settings → Time & Language → Speech* adds the
high-quality voices; on Android, Google Speech Services does the same.

If you later record your own audio, replace `Voice.say()` in `script.js`
with an `Audio()` call against an `/audio/<word>.mp3` folder — the rest of
the interface does not change.

## Not stored

No score, no checkbox state and no result leaves the page. The self-check
meter lives in memory only and resets on reload, by design: Stage 1 is
practice, Stage 2 is the record.

## Next — Stage 2

Minimal pairs, odd-one-out, sound hunting and dictation. Audio only, no
text on screen, one attempt per item, results posted to the sheet.

---
Designed by Rosney Hernández
