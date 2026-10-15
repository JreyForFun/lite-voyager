/** One in-flight send, one latest progress and one terminal result. */
export class CsvImportRelay {
  private sending = false;
  private latest: unknown;
  private terminal: unknown;
  private finished = false;
  constructor(private readonly send: (value: unknown) => Promise<void>, private readonly failure: () => void) {}
  accept(value: unknown): void {
    if (this.finished || this.terminal !== undefined) { return; }
    if (typeof value !== 'object' || value === null || !('type' in value)) { this.finished = true; this.failure(); return; }
    if (value.type === 'progress') { this.latest = value; }
    else { this.terminal = value; }
    this.drain();
  }
  private drain(): void {
    if (this.finished || this.sending) { return; }
    const terminal = this.latest === undefined;
    const value = this.latest ?? this.terminal;
    if (value === undefined) { return; }
    this.latest = undefined; this.sending = true;
    void this.send(value).then(() => {
      this.sending = false;
      if (terminal) { this.finished = true; } else { this.drain(); }
    }, () => { this.finished = true; this.failure(); });
  }
}
