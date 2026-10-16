/** Exact source keys map to deterministic SQLite-safe, ASCII-case-unique names. */
export class JsonColumns {
  readonly mapping = new Map<string, string>();
  private readonly used = new Set<string>();
  renamed = false;
  add(keys: Iterable<string>): string[] {
    const added: string[] = [];
    for (const key of keys) {
      if (this.mapping.has(key)) { continue; }
      const base = key.trim() === '' ? `column_${String(this.mapping.size + 1)}` : key.replaceAll('\0', '_');
      let name = base; let suffix = 2;
      const fold = (text: string): string => text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
      while (this.used.has(fold(name))) { name = `${base}_${String(suffix++)}`; }
      this.used.add(fold(name)); this.mapping.set(key, name); added.push(name); this.renamed ||= name !== key;
    }
    return added;
  }
}
export const JSON_NOTICE = 'JSON null and missing keys become SQL NULL; booleans become 1/0. Exact numeric spellings that cannot round-trip as INTEGER/REAL stay TEXT. Nested values retain their original JSON text; SQLite JSON numeric arithmetic has its own limits. Blank/NUL keys and case collisions receive unique column names. Source is read-only. Memory-limited fallback allows 20,000,000 source bytes and 64,000,000 SQLite bytes; update VS Code for disk-backed imports.';
