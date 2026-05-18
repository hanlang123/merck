import { LongTermMemory, EmbeddingFunction, MemoryEntry } from '../memory/long-term';
import { Chunk } from './chunker';
import { getLogger } from '../observability/logger';

const log = getLogger('rag/retriever');

export interface RetrievedChunk {
  chunk: Chunk;
  score?: number;
}

/**
 * Stores chunks in long-term (vector) memory and retrieves semantically similar ones.
 */
export class VectorRetriever {
  private readonly memory: LongTermMemory;

  constructor(embed?: EmbeddingFunction) {
    this.memory = new LongTermMemory(undefined, embed);
  }

  async index(chunks: Chunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.memory.remember({
        id: chunk.id,
        content: chunk.text,
        metadata: chunk.metadata,
      });
    }
    log.info({ count: chunks.length }, 'Chunks indexed');
  }

  async retrieve(query: string, topK = 5): Promise<MemoryEntry[]> {
    const results = await this.memory.recall(query, topK);
    log.debug({ query, topK, found: results.length }, 'Chunks retrieved');
    return results;
  }
}
