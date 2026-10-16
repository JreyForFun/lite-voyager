export interface JsonCell { text: string | null; kind: 'text' | 'integer' | 'real' | 'null'; }
interface Token { kind: string; start: number; end: number; text?: string; }
interface Frame { kind: '{' | '['; state: 'keyOrEnd' | 'key' | 'colon' | 'valueOrEnd' | 'value' | 'commaOrEnd'; keys: Set<string>; key?: string; }
const numberToken = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const whitespace = /[\x20\t\r\n]/;
function invalid(): never { throw new Error('Malformed JSON object. Check commas, quotes, escapes and complete values.'); }

function stringValue(raw: string): string {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return invalid(); }
  if (typeof value !== 'string') { return invalid(); }
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) { throw new Error('JSON contains an unpaired Unicode surrogate. Use valid Unicode strings.'); }
    } else if (code >= 0xdc00 && code <= 0xdfff) { throw new Error('JSON contains an unpaired Unicode surrogate. Use valid Unicode strings.'); }
  }
  return value;
}

function* tokens(raw: string): Generator<Token> {
  let index = 0;
  while (index < raw.length) {
    const char = raw[index] ?? '';
    if (whitespace.test(char)) { index++; continue; }
    const start = index;
    if ('{}[]:,'.includes(char)) { yield { kind: char, start, end: ++index }; continue; }
    if (char === '"') {
      index++;
      while (index < raw.length && raw[index] !== '"') { if (raw[index] === '\\') { index++; } index++; }
      if (index >= raw.length) { invalid(); }
      index++; yield { kind: 'string', start, end: index, text: stringValue(raw.slice(start, index)) }; continue;
    }
    let literal = false;
    for (const word of ['true', 'false', 'null']) {
      if (raw.startsWith(word, index)) { index += word.length; yield { kind: word, start, end: index }; literal = true; break; }
    }
    if (literal) { continue; }
    numberToken.lastIndex = index; const match = numberToken.exec(raw);
    if (match === null) { invalid(); }
    index = numberToken.lastIndex; yield { kind: 'number', start, end: index };
  }
}

function cell(raw: string): JsonCell {
  if (raw === 'null') { return { text: null, kind: 'null' }; }
  if (raw === 'true' || raw === 'false') { return { text: raw === 'true' ? '1' : '0', kind: 'integer' }; }
  if (raw.startsWith('"')) { return { text: stringValue(raw), kind: 'text' }; }
  if (/^-?(0|[1-9]\d*)$/u.test(raw) && raw !== '-0' && raw.length <= 20) {
    const value = BigInt(raw);
    if (value >= -9223372036854775808n && value <= 9223372036854775807n) { return { text: raw, kind: 'integer' }; }
  }
  if (/[.eE]/u.test(raw) && raw.length < 32) {
    const value = Number(raw);
    if (Number.isFinite(value) && String(value) === raw) { return { text: raw, kind: 'real' }; }
  }
  return { text: raw, kind: 'text' };
}

/** Iterative grammar validator. Only strings are JSON.parse'd; numbers stay lexical. */
export function parseJsonObject(raw: string): Map<string, JsonCell> {
  const result = new Map<string, JsonCell>(); const stack: Frame[] = [];
  let started = false; let ended = false; let topStart = 0; let topKey = '';
  for (const token of tokens(raw)) {
    if (!started) {
      if (token.kind !== '{') { throw new Error('Unsupported JSON shape. Use an array of objects or one object per JSONL line.'); }
      started = true; stack.push({ kind: '{', state: 'keyOrEnd', keys: new Set() }); continue;
    }
    if (ended) { invalid(); }
    const frame = stack.at(-1); if (frame === undefined) { invalid(); }
    const closes = token.kind === (frame.kind === '{' ? '}' : ']');
    if (closes && ['keyOrEnd', 'valueOrEnd', 'commaOrEnd'].includes(frame.state)) {
      stack.pop();
      if (stack.length === 0) { ended = true; }
      else if (stack.length === 1) { result.set(topKey, cell(raw.slice(topStart, token.end))); }
      continue;
    }
    if (frame.state === 'keyOrEnd' || frame.state === 'key') {
      if (token.kind !== 'string' || token.text === undefined) { invalid(); }
      if (frame.keys.has(token.text)) { throw new Error('JSON contains a duplicate object key. Give every key a unique name; no table was imported.'); }
      frame.keys.add(token.text); frame.key = token.text; frame.state = 'colon'; continue;
    }
    if (frame.state === 'colon') { if (token.kind !== ':') { invalid(); } frame.state = 'value'; continue; }
    if (frame.state === 'commaOrEnd') {
      if (token.kind !== ',') { invalid(); } frame.state = frame.kind === '{' ? 'key' : 'value'; continue;
    }
    if (stack.length === 1) { topStart = token.start; topKey = frame.key ?? ''; }
    frame.state = 'commaOrEnd';
    if (token.kind === '{' || token.kind === '[') { stack.push({ kind: token.kind, state: token.kind === '{' ? 'keyOrEnd' : 'valueOrEnd', keys: new Set() }); }
    else if (['string', 'number', 'true', 'false', 'null'].includes(token.kind)) {
      if (stack.length === 1) { result.set(topKey, cell(raw.slice(token.start, token.end))); }
    } else { invalid(); }
  }
  if (!ended) { invalid(); }
  return result;
}
