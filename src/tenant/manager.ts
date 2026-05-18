import { getLogger } from '../observability/logger';

const log = getLogger('tenant/manager');

export interface TenantConfig {
  id: string;
  name: string;
  /** Allowed LLM models for this tenant */
  allowedModels: string[];
  /** Monthly token quota (overrides global setting) */
  tokenQuota?: number;
  /** Extra metadata */
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Multi-tenant manager.  Isolates data, configuration, and model permissions
 * per tenant.  In production, persist tenant configs in a database.
 */
export class TenantManager {
  private readonly tenants = new Map<string, TenantConfig>();

  register(config: Omit<TenantConfig, 'createdAt'>): TenantConfig {
    const tenant: TenantConfig = { ...config, createdAt: new Date() };
    this.tenants.set(tenant.id, tenant);
    log.info({ tenantId: tenant.id, name: tenant.name }, 'Tenant registered');
    return tenant;
  }

  get(tenantId: string): TenantConfig {
    const t = this.tenants.get(tenantId);
    if (!t) throw new Error(`Tenant "${tenantId}" not found`);
    return t;
  }

  list(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  isModelAllowed(tenantId: string, model: string): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;
    // Empty allowedModels means "all models allowed"
    if (tenant.allowedModels.length === 0) return true;
    return tenant.allowedModels.some((m) => model.startsWith(m));
  }

  update(tenantId: string, patch: Partial<Omit<TenantConfig, 'id' | 'createdAt'>>): TenantConfig {
    const tenant = this.get(tenantId);
    const updated = { ...tenant, ...patch };
    this.tenants.set(tenantId, updated);
    return updated;
  }

  delete(tenantId: string): void {
    this.tenants.delete(tenantId);
    log.info({ tenantId }, 'Tenant deleted');
  }
}

export const tenantManager = new TenantManager();
