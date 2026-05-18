import { TokenTracker } from '../../src/cost/tracker';

describe('TokenTracker', () => {
  it('tracks usage per tenant', () => {
    const tracker = new TokenTracker();
    tracker.record({
      tenantId: 'tenant-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    expect(tracker.getMonthlyUsage('tenant-1')).toBe(150);
    expect(tracker.getMonthlyUsage('tenant-2')).toBe(0);
  });

  it('accumulates usage across multiple records', () => {
    const tracker = new TokenTracker();
    for (let i = 0; i < 5; i++) {
      tracker.record({
        tenantId: 'tenant-a',
        provider: 'openai',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    }
    expect(tracker.getMonthlyUsage('tenant-a')).toBe(750);
  });

  it('resets monthly usage', () => {
    const tracker = new TokenTracker();
    tracker.record({
      tenantId: 'tenant-b',
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    tracker.resetMonth('tenant-b');
    expect(tracker.getMonthlyUsage('tenant-b')).toBe(0);
  });

  it('filters records by tenant', () => {
    const tracker = new TokenTracker();
    tracker.record({ tenantId: 'a', provider: 'openai', model: 'x', promptTokens: 1, completionTokens: 1, totalTokens: 2 });
    tracker.record({ tenantId: 'b', provider: 'openai', model: 'x', promptTokens: 1, completionTokens: 1, totalTokens: 2 });
    expect(tracker.getRecords('a')).toHaveLength(1);
    expect(tracker.getRecords()).toHaveLength(2);
  });
});
