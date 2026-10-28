import { concatPcm } from "./wav";

export interface EndpointerOptions {
  sampleRate: number;
  /** Do not cut before this much audio, so tiny clips are not sent one by one. */
  minMs: number;
  /** Force a cut here even without a pause. Must stay under the provider's 30 s limit. */
  maxMs: number;
  /** Pause length that ends an utterance. */
  silenceMs: number;
  /** RMS of a 20 ms frame above this counts as speech. */
  rmsThreshold: number;
  /** Silence kept before speech so word edges are not clipped. */
  padMs: number;
}

export const DEFAULT_ENDPOINTER: Omit<EndpointerOptions, "sampleRate"> = {
  minMs: 2000,
  maxMs: 8000,
  silenceMs: 500,
  rmsThreshold: 0.012,
  padMs: 250,
};

export interface PcmChunk {
  samples: Float32Array;
  /** ms from the first sample ever pushed to the first sample of this chunk */
  startMs: number;
  durationMs: number;
}

const FRAME_MS = 20;

/**
 * Splits one continuous PCM stream into speech chunks. Nothing is recorded twice and nothing between
 * chunks is dropped except long silence. Pure and synchronous so it can be unit tested.
 */
export class Endpointer {
  private blocks: Float32Array[] = [];
  private bufMs = 0;
  private startMs = 0;
  private streamMs = 0;
  private speechSeen = false;
  private silenceRun = 0;

  constructor(private o: EndpointerOptions) {}

  private loud(block: Float32Array): boolean {
    const n = Math.max(1, Math.round((this.o.sampleRate * FRAME_MS) / 1000));
    for (let i = 0; i < block.length; i += n) {
      let sum = 0;
      const end = Math.min(block.length, i + n);
      for (let j = i; j < end; j++) sum += block[j]! * block[j]!;
      if (Math.sqrt(sum / (end - i)) >= this.o.rmsThreshold) return true;
    }
    return false;
  }

  /** Feed any size block of mono samples. Returns a chunk when one is complete. */
  push(block: Float32Array): PcmChunk | null {
    const ms = (block.length / this.o.sampleRate) * 1000;
    const isLoud = this.loud(block);
    this.blocks.push(block);
    this.bufMs += ms;
    this.streamMs += ms;
    if (isLoud) {
      this.speechSeen = true;
      this.silenceRun = 0;
    } else {
      this.silenceRun += ms;
    }

    if (!this.speechSeen) {
      // Leading silence: keep only a short pad so the first word is not clipped.
      while (this.blocks.length > 1 && this.bufMs - (this.blocks[0]!.length / this.o.sampleRate) * 1000 >= this.o.padMs) {
        const d = this.blocks.shift()!;
        const dms = (d.length / this.o.sampleRate) * 1000;
        this.bufMs -= dms;
        this.startMs += dms;
      }
      return null;
    }

    const o = this.o;
    const cut = this.bufMs >= o.maxMs || (this.bufMs >= o.minMs && this.silenceRun >= o.silenceMs);
    return cut ? this.emit() : null;
  }

  /** Emit whatever speech is buffered (call when the mic stops). */
  flush(): PcmChunk | null {
    return this.speechSeen ? this.emit() : null;
  }

  private emit(): PcmChunk {
    const samples = concatPcm(this.blocks);
    const chunk: PcmChunk = { samples, startMs: this.startMs, durationMs: (samples.length / this.o.sampleRate) * 1000 };
    this.blocks = [];
    this.bufMs = 0;
    this.startMs = this.streamMs;
    this.speechSeen = false;
    this.silenceRun = 0;
    return chunk;
  }
}
