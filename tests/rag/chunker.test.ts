import { DocumentChunker } from '../../src/rag/chunker';

describe('DocumentChunker', () => {
  const chunker = new DocumentChunker({ chunkSize: 100, chunkOverlap: 20 });

  it('splits a short document into 1 chunk', () => {
    const chunks = chunker.chunk('Hello world.', 'doc1');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.metadata.sourceId).toBe('doc1');
  });

  it('splits a long document into multiple chunks', () => {
    const text = 'A'.repeat(300);
    const chunks = chunker.chunk(text, 'doc2');
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('assigns sequential chunk indices', () => {
    const text = 'Word '.repeat(100);
    const chunks = chunker.chunk(text, 'doc3');
    chunks.forEach((c, i) => expect(c.metadata.chunkIndex).toBe(i));
  });

  it('generates unique chunk IDs', () => {
    const text = 'X'.repeat(300);
    const chunks = chunker.chunk(text, 'doc4');
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
