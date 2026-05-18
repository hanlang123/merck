import { getLogger } from '../observability/logger';

const log = getLogger('rag/chunker');

export interface Chunk {
  id: string;
  text: string;
  metadata: {
    sourceId: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

export interface ChunkerOptions {
  chunkSize?: number;   // characters
  chunkOverlap?: number; // characters
}

/**
 * Splits a document into overlapping chunks for RAG ingestion.
 * Tries to split on sentence boundaries (`. `) before falling back to character splits.
 */
export class DocumentChunker {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor({ chunkSize = 1000, chunkOverlap = 200 }: ChunkerOptions = {}) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  chunk(text: string, sourceId: string): Chunk[] {
    const chunks: Chunk[] = [];
    // Clean whitespace
    const cleaned = text.replace(/\s+/g, ' ').trim();
    let start = 0;
    let chunkIndex = 0;

    while (start < cleaned.length) {
      let end = Math.min(start + this.chunkSize, cleaned.length);

      // Try to align to a sentence boundary
      if (end < cleaned.length) {
        const lookback = cleaned.lastIndexOf('. ', end);
        if (lookback > start + this.chunkSize / 2) {
          end = lookback + 2;
        }
      }

      const chunkText = cleaned.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          id: `${sourceId}_${chunkIndex}`,
          text: chunkText,
          metadata: { sourceId, chunkIndex, startChar: start, endChar: end },
        });
        chunkIndex++;
      }

      // Advance start past the current chunk, stepping back by overlap
      const nextStart = end - this.chunkOverlap;
      // Ensure we always make forward progress
      start = nextStart > start ? nextStart : end;
    }

    log.debug({ sourceId, chunks: chunks.length }, 'Document chunked');
    return chunks;
  }
}
