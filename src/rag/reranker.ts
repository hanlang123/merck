import { MemoryEntry } from '../memory/long-term';
import { getLogger } from '../observability/logger';

const log = getLogger('rag/reranker');

export type ScoringFn = (query: string, entry: MemoryEntry) => Promise<number>;

/**
 * Re-ranks retrieved chunks using a cross-encoder-style scoring function.
 * In production, use a real cross-encoder model (e.g. ms-marco-MiniLM).
 * The default scorer uses simple term-overlap as a placeholder.
 */
export class Reranker {
  private readonly score: ScoringFn;

  constructor(scoringFn?: ScoringFn) {
    this.score = scoringFn ?? Reranker.termOverlapScore;
  }

  async rerank(query: string, entries: MemoryEntry[], topK?: number): Promise<MemoryEntry[]> {
    const scored = await Promise.all(
      entries.map(async (e) => ({ entry: e, score: await this.score(query, e) })),
    );
    scored.sort((a, b) => b.score - a.score);
    const result = (topK !== undefined ? scored.slice(0, topK) : scored).map((s) => s.entry);
    log.debug({ query, input: entries.length, output: result.length }, 'Reranking done');
    return result;
  }

  /** Simple term-overlap scorer for testing / fallback */
  private static async termOverlapScore(query: string, entry: MemoryEntry): Promise<number> {
    const qTerms = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
    const eTerms = entry.content.toLowerCase().split(/\W+/).filter(Boolean);
    const matches = eTerms.filter((t) => qTerms.has(t)).length;
    return qTerms.size > 0 ? matches / qTerms.size : 0;
  }
}
