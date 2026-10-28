import { concatPcm } from "./wav";

export interface QueuedChunk {
  chunkId: string;
  seq: number;
  samples: Float32Array;
  startSec: number;
  /** epoch ms when the audio ended */
  capturedAt: number;
  enqueuedAt: number;
}

export type SendResult = { ok: true } | { ok: false; retryable: boolean; retryAfterMs?: number };

export interface QueueStats {
  sent: number;
  failed: number;
  coalesced: number;
  dropped: number;
  retries: number;
}

export interface QueueOptions {
  maxPending: number;
  maxAttempts: number;
  /** Merged audio never exceeds this. The server rejects chunks over 30 s. */
  maxMergedSec: number;
  sampleRate: number;
  send: (c: QueuedChunk, attempt: number) => Promise<SendResult>;
  /** Called once per chunk that finally failed (after retries or a non-retryable error). */
  onFailed?: (c: QueuedChunk) => void;
  sleep?: (ms: number) => Promise<void>;
  onStats?: (s: QueueStats) => void;
}

/**
 * One in-flight upload at a time (keeps order). When uploads fall behind, the two oldest waiting
 * chunks are merged so audio is delayed rather than lost and memory stays bounded.
 */
export class UploadQueue {
  private pending: QueuedChunk[] = [];
  private running = false;
  stats: QueueStats = { sent: 0, failed: 0, coalesced: 0, dropped: 0, retries: 0 };
  private sleep: (ms: number) => Promise<void>;

  constructor(private o: QueueOptions) {
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get size() {
    return this.pending.length;
  }

  push(c: QueuedChunk) {
    this.pending.push(c);
    while (this.pending.length > this.o.maxPending) this.mergeWaiting();
    void this.run();
  }

  /** Merge the two oldest chunks that are not being uploaded right now. */
  private mergeWaiting() {
    const start = this.running ? 1 : 0;
    const a = this.pending[start];
    const b = this.pending[start + 1];
    if (!a || !b) return;
    const sec = (a.samples.length + b.samples.length) / this.o.sampleRate;
    if (sec > this.o.maxMergedSec) {
      // Cannot merge without exceeding the server limit: drop the oldest waiting chunk and count it.
      this.pending.splice(start, 1);
      this.stats.dropped++;
    } else {
      // Keep a's chunkId and startSec; b's end time becomes the merged end time.
      this.pending.splice(start, 2, { ...a, samples: concatPcm([a.samples, b.samples]), capturedAt: b.capturedAt });
      this.stats.coalesced++;
    }
    this.o.onStats?.(this.stats);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) {
        const head = this.pending[0]!;
        let done = false;
        for (let attempt = 0; attempt < this.o.maxAttempts && !done; attempt++) {
          let r: SendResult;
          try {
            r = await this.o.send(head, attempt);
          } catch {
            r = { ok: false, retryable: true };
          }
          if (r.ok) {
            this.stats.sent++;
            done = true;
          } else if (!r.retryable || attempt === this.o.maxAttempts - 1) {
            this.stats.failed++;
            this.o.onFailed?.(head);
            done = true;
          } else {
            this.stats.retries++;
            await this.sleep(r.retryAfterMs ?? Math.min(8000, 500 * 2 ** attempt));
          }
        }
        this.pending.shift();
        this.o.onStats?.(this.stats);
      }
    } finally {
      this.running = false;
    }
  }
}
