type Job = () => Promise<void>;

class AsyncQueue {
  private pending: Job[] = [];
  private active = 0;
  constructor(private concurrency: number) {}

  push(job: Job) {
    this.pending.push(job);
    this.drain();
  }

  private drain() {
    while (this.active < this.concurrency && this.pending.length) {
      const job = this.pending.shift()!;
      this.active++;
      job()
        .catch((e) => console.error("[queue] job failed", e))
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }
}

const g = globalThis as unknown as { __queue?: AsyncQueue };
export const queue = (g.__queue ??= new AsyncQueue(2));
