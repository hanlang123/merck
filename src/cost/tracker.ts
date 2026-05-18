import { getLogger } from '../observability/logger';
import { monthlyTokenUsage } from '../observability/metrics';
import { settings } from '../config/settings';

const log = getLogger('cost/tracker');

export interface TokenUsageRecord {
  tenantId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: Date;
}

export class TokenTracker {
  /** tenantId → cumulative tokens this month */
  private readonly monthlyUsage = new Map<string, number>();
  private readonly records: TokenUsageRecord[] = [];

  record(usage: Omit<TokenUsageRecord, 'timestamp'>): void {
    const record: TokenUsageRecord = { ...usage, timestamp: new Date() };
    this.records.push(record);

    const current = this.monthlyUsage.get(usage.tenantId) ?? 0;
    const updated = current + usage.totalTokens;
    this.monthlyUsage.set(usage.tenantId, updated);

    monthlyTokenUsage.set({ tenant_id: usage.tenantId }, updated);

    const ratio = updated / settings.monthlyTokenBudget;
    if (ratio >= settings.tokenAlertThreshold) {
      log.warn(
        { tenantId: usage.tenantId, used: updated, budget: settings.monthlyTokenBudget, ratio },
        'Token budget alert: approaching monthly limit',
      );
    }
  }

  getMonthlyUsage(tenantId: string): number {
    return this.monthlyUsage.get(tenantId) ?? 0;
  }

  getRecords(tenantId?: string): TokenUsageRecord[] {
    return tenantId ? this.records.filter((r) => r.tenantId === tenantId) : [...this.records];
  }

  resetMonth(tenantId: string): void {
    this.monthlyUsage.set(tenantId, 0);
    monthlyTokenUsage.set({ tenant_id: tenantId }, 0);
  }
}

export const tokenTracker = new TokenTracker();
