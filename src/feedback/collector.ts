import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../observability/logger';

const log = getLogger('feedback/collector');

export type FeedbackRating = 'positive' | 'negative';

export interface FeedbackRecord {
  id: string;
  taskId: string;
  tenantId?: string;
  rating: FeedbackRating;
  comment?: string;
  /** The agent output that was rated */
  agentOutput: string;
  /** The user request that produced the output */
  userInput: string;
  annotatedAt: Date;
  annotatedBy?: string;
}

/**
 * Golden Dataset — a curated set of (input, expected_output) pairs
 * used for regression testing and fine-tuning.
 */
export interface GoldenExample {
  id: string;
  input: string;
  expectedOutput: string;
  tags?: string[];
  addedAt: Date;
}

export class FeedbackCollector {
  private readonly records: FeedbackRecord[] = [];
  private readonly goldenDataset: GoldenExample[] = [];

  record(feedback: Omit<FeedbackRecord, 'id' | 'annotatedAt'>): FeedbackRecord {
    const record: FeedbackRecord = { ...feedback, id: uuidv4(), annotatedAt: new Date() };
    this.records.push(record);
    log.info(
      { id: record.id, taskId: record.taskId, rating: record.rating },
      'Feedback recorded',
    );
    return record;
  }

  addGoldenExample(example: Omit<GoldenExample, 'id' | 'addedAt'>): GoldenExample {
    const ex: GoldenExample = { ...example, id: uuidv4(), addedAt: new Date() };
    this.goldenDataset.push(ex);
    log.info({ id: ex.id }, 'Golden example added');
    return ex;
  }

  getGoldenDataset(): GoldenExample[] {
    return [...this.goldenDataset];
  }

  getRecords(tenantId?: string): FeedbackRecord[] {
    return tenantId ? this.records.filter((r) => r.tenantId === tenantId) : [...this.records];
  }

  /** Compute positive-rate for a tenant or overall */
  positiveRate(tenantId?: string): number {
    const records = this.getRecords(tenantId);
    if (records.length === 0) return 0;
    const positives = records.filter((r) => r.rating === 'positive').length;
    return positives / records.length;
  }

  /**
   * Export negative-feedback records as fine-tuning candidates
   * (those that need improvement).
   */
  exportFineTuningCandidates(tenantId?: string): FeedbackRecord[] {
    return this.getRecords(tenantId).filter((r) => r.rating === 'negative');
  }
}

export const feedbackCollector = new FeedbackCollector();
