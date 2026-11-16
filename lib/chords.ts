/**
 * 코드 악보(텍스트) 이조. 서버와 브라우저에서 같이 쓴다.
 *
 * 읽는 모양
 * - 가사 위에 코드 줄이 따로 있는 악보 (코드 줄만 옮기고 가사 줄은 그대로)
 * - "[G]주 님의 [D]사랑" 처럼 대괄호 안에 코드를 넣은 악보 (ChordPro)
 * - "Intro: G D Em C", "전주 | G | D |" 처럼 앞에 이름표가 붙은 코드 줄
 */

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
/** 키 이름으로 많이 쓰는 표기 */
const MAJOR_KEY_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_KEY_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const FLAT_MAJOR_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);
const FLAT_MINOR_KEYS = new Set(["D", "G", "C", "F", "Bb", "Eb", "Ab"]);

const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const CHORD_RE =
  /^([A-G])([#b♯♭]?)((?:maj|min|dim|aug|sus|add|alt|no|omit|m|M|\+|-|°|ø|Δ|\^|\d|\(|\)|#|b|♯|♭|,|\.)*)(?:\/([A-G])([#b♯♭]?))?$/;

/** 코드 줄에 섞여 있어도 되는 기호들 */
const FILLER_RE = /^(?:\||\|\||\|:|:\||\|\|:|:\|\||\/|%|-|–|—|→|>|~|\.+|x\d+|\(x?\d+\)|\d+x|N\.?C\.?|\*)+$/i;

export type ParsedChord = { root: number; quality: string; bass: number | null; rootText: string; bassText: string | null };

function pitch(letter: string, accidental: string): number {
  let p = BASE[letter];
  if (accidental === "#" || accidental === "♯") p += 1;
  if (accidental === "b" || accidental === "♭") p -= 1;
  return (p + 12) % 12;
}

export function parseChord(token: string): ParsedChord | null {
  const m = CHORD_RE.exec(token);
  if (!m) return null;
  const [, letter, acc, quality, bassLetter, bassAcc] = m;
  // 괄호 짝이 안 맞는 건 코드가 아니라 가사일 수 있다
  if ((quality.match(/\(/g)?.length ?? 0) !== (quality.match(/\)/g)?.length ?? 0)) return null;
  return {
    root: pitch(letter, acc),
    quality,
    bass: bassLetter ? pitch(bassLetter, bassAcc ?? "") : null,
    rootText: letter + acc,
    bassText: bassLetter ? bassLetter + (bassAcc ?? "") : null,
  };
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const noteName = (p: number, flats: boolean) => (flats ? FLAT_NAMES : SHARP_NAMES)[mod12(p)];

export function transposeChord(token: string, steps: number, flats: boolean): string {
  const c = parseChord(token);
  if (!c || mod12(steps) === 0) return token;
  return noteName(c.root + steps, flats) + c.quality + (c.bass === null ? "" : "/" + noteName(c.bass + steps, flats));
}

export type Key = { root: number; minor: boolean };

/** "G", "Bb", "F#m", "Am", "A→B"(앞쪽), "G Key" 같은 글자에서 키를 읽는다 */
export function parseKey(text: string | null | undefined): Key | null {
  if (!text) return null;
  const m = /(?<![A-Za-z])([A-G])([#b♯♭]?)(m(?!aj)|min|minor)?(?![A-Za-ln-z])/.exec(text);
  if (!m) return null;
  return { root: pitch(m[1], m[2]), minor: !!m[3] };
}

export function keyName(key: Key): string {
  return key.minor ? MINOR_KEY_NAMES[mod12(key.root)] + "m" : MAJOR_KEY_NAMES[mod12(key.root)];
}

export function transposeKey(key: Key, steps: number): Key {
  return { root: mod12(key.root + steps), minor: key.minor };
}

/** 이 키에서는 b(플랫)으로 적는 게 자연스러운가 */
export function keyUsesFlats(key: Key): boolean {
  const name = key.minor ? MINOR_KEY_NAMES[key.root] : MAJOR_KEY_NAMES[key.root];
  return key.minor ? FLAT_MINOR_KEYS.has(name) : FLAT_MAJOR_KEYS.has(name);
}

/** 키 칸 글자("A→B", "G")의 키 이름을 모두 옮긴다 */
export function transposeKeyText(text: string, steps: number): string {
  if (mod12(steps) === 0) return text;
  return text.replace(/(?<![A-Za-z])([A-G])([#b♯♭]?)(m(?!aj)|min|minor)?(?![A-Za-ln-z])/g, (_, l: string, a: string, minor?: string) => {
    const k = transposeKey({ root: pitch(l, a), minor: !!minor }, steps);
    return keyName(k).replace(/m$/, "") + (minor ?? "");
  });
}

/** 한 줄을 토큰과 그 시작 위치로 나눈다 */
function tokens(line: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push({ text: m[0], start: m.index });
  return out;
}

/** 토큰 앞뒤의 괄호·마디선을 떼고 코드 부분만 */
function chordCore(token: string): { pre: string; core: string; post: string } {
  const m = /^([(\[|:]*)(.*?)([)\]|:,]*)$/.exec(token)!;
  return { pre: m[1], core: m[2], post: m[3] };
}

function isLabel(token: string, index: number): boolean {
  if (index !== 0) return false;
  if (/[:：]$/.test(token)) return true;
  if (/^\[[^\]]+\]$/.test(token)) return !parseChord(token.slice(1, -1));
  // "전주 G D", "후렴 C G" 같은 짧은 한글 이름표
  return /^[\p{Script=Hangul}\d]{1,6}$/u.test(token) && /\p{Script=Hangul}/u.test(token);
}

/** 이 줄이 코드만 적힌 줄인가 */
export function isChordLine(line: string): boolean {
  const ts = tokens(line);
  let chords = 0;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i].text;
    if (FILLER_RE.test(t)) continue;
    if (parseChord(chordCore(t).core)) {
      chords++;
      continue;
    }
    // "G-D-Em" 처럼 붙여 쓴 코드
    if (t.includes("-") && t.split("-").every((p) => !p || parseChord(chordCore(p).core) || FILLER_RE.test(p))) {
      chords++;
      continue;
    }
    if (isLabel(t, i)) continue;
    return false;
  }
  return chords > 0;
}

/** 코드 줄을 옮기면서 각 코드가 원래 자리(열)에 오도록 맞춘다. 앞 코드가 길어져 밀리면 한 칸만 띄운다 */
function transposeChordLine(line: string, steps: number, flats: boolean): string {
  let out = "";
  for (const t of tokens(line)) {
    out += out.length < t.start ? " ".repeat(t.start - out.length) : out ? " " : "";
    out += transposeToken(t.text, steps, flats);
  }
  return out;
}

function transposeToken(token: string, steps: number, flats: boolean): string {
  if (FILLER_RE.test(token)) return token;
  if (token.includes("-") && !parseChord(chordCore(token).core)) {
    return token
      .split("-")
      .map((p) => transposeToken(p, steps, flats))
      .join("-");
  }
  const { pre, core, post } = chordCore(token);
  return parseChord(core) ? pre + transposeChord(core, steps, flats) + post : token;
}

/** "[G]가사" 처럼 가사 사이 대괄호 코드를 옮긴다 */
function transposeInline(line: string, steps: number, flats: boolean): string {
  return line.replace(/\[([^\]\s]+)\]/g, (whole, inner: string) => (parseChord(inner) ? `[${transposeChord(inner, steps, flats)}]` : whole));
}

const DIRECTIVE_KEY_RE = /^(\s*\{\s*key\s*:\s*)([^}]*)(\}.*)$/i;

/** 악보 전체를 steps 반음만큼 옮긴다. flats를 안 주면 targetKey나 원래 악보 표기를 따른다 */
export function transposeChart(chart: string, steps: number, opts: { flats?: boolean; targetKey?: Key | null } = {}): string {
  if (mod12(steps) === 0) return chart;
  const flats = opts.flats ?? (opts.targetKey ? keyUsesFlats(opts.targetKey) : prefersFlats(chart));
  return chart
    .split("\n")
    .map((line) => {
      const d = DIRECTIVE_KEY_RE.exec(line);
      if (d) return d[1] + transposeKeyText(d[2], steps) + d[3];
      return isChordLine(line) ? transposeChordLine(line, steps, flats) : transposeInline(line, steps, flats);
    })
    .join("\n");
}

/** 악보에 쓰인 코드들 (코드 줄 + 대괄호 코드) */
export function chordsIn(chart: string): string[] {
  const out: string[] = [];
  for (const line of chart.split("\n")) {
    if (DIRECTIVE_KEY_RE.test(line)) continue;
    if (isChordLine(line)) {
      for (const t of tokens(line)) {
        for (const p of t.text.split("-")) {
          const core = chordCore(p).core;
          if (parseChord(core)) out.push(core);
        }
      }
    } else {
      for (const m of line.matchAll(/\[([^\]\s]+)\]/g)) if (parseChord(m[1])) out.push(m[1]);
    }
  }
  return out;
}

function prefersFlats(chart: string): boolean {
  let sharps = 0;
  let flats = 0;
  for (const c of chordsIn(chart)) {
    if (/^[A-G][#♯]/.test(c)) sharps++;
    if (/^[A-G][b♭]/.test(c)) flats++;
  }
  return flats > sharps;
}

/**
 * 붙여 넣은 코드 악보 정리: 줄바꿈·탭을 고르고, 키·제목 표기를 찾아낸다.
 * 키는 "{key: G}", "Key: G", "키 G" 줄을 먼저 보고, 없으면 첫 코드로 추정한다.
 */
export function importChart(raw: string): { chart: string; key: string | null; keyGuessed: boolean; title: string | null } {
  const chart = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");

  let key: string | null = null;
  let title: string | null = null;
  for (const line of chart.split("\n")) {
    const directive = /^\s*\{\s*(title|t|key)\s*:\s*([^}]*)\}/i.exec(line);
    if (directive) {
      const value = directive[2].trim();
      if (/^key$/i.test(directive[1])) key ??= value || null;
      else title ??= value || null;
      continue;
    }
    const keyLine = /^\s*(?:key|키|원키)\s*[:=]?\s*([A-G][#b♯♭]?m?)(?![A-Za-z0-9])/i.exec(line);
    if (keyLine) key ??= keyLine[1];
  }
  if (key) {
    const k = parseKey(key);
    return { chart, key: k ? keyName(k) : key, keyGuessed: false, title };
  }
  const first = chordsIn(chart)[0];
  const c = first ? parseChord(first) : null;
  if (!c) return { chart, key: null, keyGuessed: false, title };
  const minor = /^m(?!aj)/.test(c.quality);
  return { chart, key: keyName({ root: c.root, minor }), keyGuessed: true, title };
}
