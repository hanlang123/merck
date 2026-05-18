import { getLogger } from '../observability/logger';
import { cacheHitsTotal, cacheMissesTotal } from '../observability/metrics';
import { settings } from '../config/settings';

const log = getLogger('cost/cache');

export interface CacheEntry {
  key: string;
  embedding: number[];
  response: string;
  expiresAt: Date;
}

/** Cosine similarity */
function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return na && nb ? dot / (na * nb) : 0;
}

/**
 * Semantic cache — stores LLM responses keyed by request embedding.
 * On a cache lookup, finds the entry with cosine similarity ≥ threshold.
 *
 * In production, back this with Redis (store embeddings in a vector index).
 */
export class SemanticCache {
  private readonly entries: CacheEntry[] = [];
  private readonly threshold: number;
  private readonly ttlSeconds: number;

  constructor(
    threshold = settings.semanticCacheSimilarity,
    ttlSeconds = settings.semanticCacheTtlSeconds,
  ) {
    this.threshold = threshold;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Look up a cached response for `queryEmbedding`.
   * Returns `null` on miss or if the entry has expired.
   */
  get(queryEmbedding: number[]): string | null {
    const now = new Date();
    for (const entry of this.entries) {
      if (entry.expiresAt < now) continue;
      if (cosine(queryEmbedding, entry.embedding) >= this.threshold) {
        cacheHitsTotal.inc();
        log.debug({ key: entry.key }, 'Semantic cache HIT');
        return entry.response;
      }
    }
    cacheMissesTotal.inc();
    return null;
  }

  set(key: string, embedding: number[], response: string): void {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    this.entries.push({ key, embedding, response, expiresAt });
    log.debug({ key }, 'Semantic cache SET');
  }

  /** Remove expired entries */
  evict(): void {
    const now = new Date();
    const before = this.entries.length;
    const alive = this.entries.filter((e) => e.expiresAt >= now);
    this.entries.length = 0;
    this.entries.push(...alive);
    log.debug({ removed: before - this.entries.length }, 'Cache eviction done');
  }

  get size(): number {
    return this.entries.length;
  }
}

export const semanticCache = new SemanticCache();
