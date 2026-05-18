import { LongTermMemory, InMemoryVectorStore } from '../../src/memory/long-term';

describe('LongTermMemory', () => {
  let mem: LongTermMemory;

  beforeEach(() => {
    // Provide a deterministic embedding function: use char-code array
    const embed = async (text: string): Promise<number[]> =>
      text.split('').map((c) => c.charCodeAt(0) / 128);
    mem = new LongTermMemory(new InMemoryVectorStore(), embed);
  });

  it('stores and recalls entries', async () => {
    await mem.remember({ id: 'a', content: 'TypeScript is great' });
    await mem.remember({ id: 'b', content: 'Python is popular' });
    const results = await mem.recall('TypeScript is great', 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('a');
  });

  it('forgets entries', async () => {
    await mem.remember({ id: 'x', content: 'delete me' });
    await mem.forget('x');
    const results = await mem.recall('delete me', 5);
    expect(results.find((r) => r.id === 'x')).toBeUndefined();
  });
});
