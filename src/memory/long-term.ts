import { getLogger } from '../observability/logger';

const log = getLogger('memory/long-term');

export interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Long-term memory backed by an in-process vector store (easily swappable
 * for ChromaDB / Qdrant / Weaviate via the same interface).
 *
 * For production, replace `InMemoryVectorStore` with a remote adapter.
 */
export interface VectorStore {
  upsert(entry: MemoryEntry): Promise<void>;
  search(queryEmbedding: number[], topK: number): Promise<MemoryEntry[]>;
  delete(id: string): Promise<void>;
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

export class InMemoryVectorStore implements VectorStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async upsert(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async search(queryEmbedding: number[], topK: number): Promise<MemoryEntry[]> {
    const scored = Array.from(this.entries.values())
      .filter((e) => e.embedding && e.embedding.length > 0)
      .map((e) => ({
        entry: e,
        score: cosineSimilarity(queryEmbedding, e.embedding!),
      }))
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.entry);
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Facade that manages embeddings + storage.
 * Pass a real `EmbeddingFunction` backed by OpenAI / local model in production.
 */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

const nullEmbedding: EmbeddingFunction = async () => [];

export class LongTermMemory {
  private readonly store: VectorStore;
  private readonly embed: EmbeddingFunction;

  constructor(store?: VectorStore, embed?: EmbeddingFunction) {
    this.store = store ?? new InMemoryVectorStore();
    this.embed = embed ?? nullEmbedding;
  }

  async remember(entry: Omit<MemoryEntry, 'embedding' | 'createdAt'>): Promise<void> {
    const embedding = await this.embed(entry.content);
    await this.store.upsert({ ...entry, embedding, createdAt: new Date() });
    log.debug({ id: entry.id }, 'Memory stored');
  }

  async recall(query: string, topK = 5): Promise<MemoryEntry[]> {
    const embedding = await this.embed(query);
    const results = await this.store.search(embedding, topK);
    log.debug({ query, topK, found: results.length }, 'Memory recalled');
    return results;
  }

  async forget(id: string): Promise<void> {
    await this.store.delete(id);
  }
}
