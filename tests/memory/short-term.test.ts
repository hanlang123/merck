import { ShortTermMemory } from '../../src/memory/short-term';
import { Message } from '../../src/llm/base';

const msg = (role: Message['role'], content: string): Message => ({ role, content });

describe('ShortTermMemory', () => {
  it('stores and retrieves messages', () => {
    const mem = new ShortTermMemory(10_000);
    mem.append(msg('user', 'Hello'));
    mem.append(msg('assistant', 'Hi!'));
    expect(mem.getMessages()).toHaveLength(2);
  });

  it('evicts old messages when over token limit', () => {
    const mem = new ShortTermMemory(50); // very small limit (≈12 tokens)
    // system message should not be evicted
    mem.append(msg('system', 'You are a bot.'));
    for (let i = 0; i < 10; i++) {
      mem.append(msg('user', `Message number ${i} with some extra content here`));
    }
    const messages = mem.getMessages();
    // System message preserved
    expect(messages[0]!.role).toBe('system');
    // Total count reduced
    expect(messages.length).toBeLessThan(11);
  });

  it('clears memory', () => {
    const mem = new ShortTermMemory();
    mem.append(msg('user', 'test'));
    mem.clear();
    expect(mem.length).toBe(0);
  });

  it('reports estimated token count', () => {
    const mem = new ShortTermMemory();
    mem.append(msg('user', 'Hello world')); // 11 chars ≈ 3 tokens
    expect(mem.estimatedTokenCount).toBeGreaterThan(0);
  });
});
