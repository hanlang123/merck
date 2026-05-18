import { getLogger } from '../observability/logger';

const log = getLogger('memory/structured');

export interface EntityRecord {
  id: string;
  type: string;
  data: Record<string, unknown>;
  tenantId?: string;
  updatedAt: Date;
}

/**
 * Structured entity memory (key-value store backed by an in-memory Map).
 * In production, swap the store for SQLite / PostgreSQL / DynamoDB.
 */
export class StructuredMemory {
  private readonly store = new Map<string, EntityRecord>();

  upsert(record: Omit<EntityRecord, 'updatedAt'>): void {
    this.store.set(record.id, { ...record, updatedAt: new Date() });
    log.debug({ id: record.id, type: record.type }, 'Entity upserted');
  }

  get(id: string): EntityRecord | undefined {
    return this.store.get(id);
  }

  findByType(type: string, tenantId?: string): EntityRecord[] {
    return Array.from(this.store.values()).filter(
      (r) => r.type === type && (tenantId === undefined || r.tenantId === tenantId),
    );
  }

  delete(id: string): boolean {
    const existed = this.store.has(id);
    this.store.delete(id);
    return existed;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const structuredMemory = new StructuredMemory();
