/** Abort the owned work before Mocha's deadline can start the next test. */
export class TestBudget {
  private readonly controller = new AbortController();
  private readonly deadline: number;
  private readonly timer: ReturnType<typeof setTimeout>;
  constructor(milliseconds: number) {
    if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) { throw new Error('Invalid test budget.'); }
    this.deadline = performance.now() + milliseconds;
    this.timer = setTimeout(() => { this.controller.abort(); }, milliseconds);
  }
  get signal(): AbortSignal { return this.controller.signal; }
  remaining(maximum: number): number {
    const remaining = this.deadline - performance.now();
    if (this.signal.aborted || remaining <= 0) { throw new Error('T-016 test budget expired; owned operations must stop before the outer test deadline.'); }
    return Math.max(1, Math.min(maximum, remaining));
  }
  dispose(): void { clearTimeout(this.timer); }
}
