import { getLogger } from '../observability/logger';

const log = getLogger('security/permissions');

export type Permission = string; // e.g. "read:files", "write:db", "call:external_api"

export interface Role {
  name: string;
  permissions: Permission[];
}

export const BUILT_IN_ROLES: Record<string, Role> = {
  reader: { name: 'reader', permissions: ['read:files', 'read:db'] },
  writer: {
    name: 'writer',
    permissions: ['read:files', 'read:db', 'write:db', 'write:files'],
  },
  admin: {
    name: 'admin',
    permissions: [
      'read:files',
      'read:db',
      'write:db',
      'write:files',
      'call:external_api',
      'manage:tenants',
    ],
  },
};

export class PermissionManager {
  private readonly roleMap = new Map<string, Role>(Object.entries(BUILT_IN_ROLES));
  /** agentId → granted permissions */
  private readonly agentPermissions = new Map<string, Set<Permission>>();

  addRole(role: Role): void {
    this.roleMap.set(role.name, role);
  }

  grantRole(agentId: string, roleName: string): void {
    const role = this.roleMap.get(roleName);
    if (!role) {
      throw new Error(`Unknown role: ${roleName}`);
    }
    const existing = this.agentPermissions.get(agentId) ?? new Set<Permission>();
    for (const p of role.permissions) {
      existing.add(p);
    }
    this.agentPermissions.set(agentId, existing);
    log.info({ agentId, roleName }, 'Role granted');
  }

  grantPermission(agentId: string, permission: Permission): void {
    const existing = this.agentPermissions.get(agentId) ?? new Set<Permission>();
    existing.add(permission);
    this.agentPermissions.set(agentId, existing);
  }

  revokePermission(agentId: string, permission: Permission): void {
    this.agentPermissions.get(agentId)?.delete(permission);
  }

  hasPermission(agentId: string, permission: Permission): boolean {
    return this.agentPermissions.get(agentId)?.has(permission) ?? false;
  }

  getPermissions(agentId: string): Permission[] {
    return Array.from(this.agentPermissions.get(agentId) ?? []);
  }

  checkAll(agentId: string, required: Permission[]): { granted: boolean; missing: Permission[] } {
    const missing = required.filter((p) => !this.hasPermission(agentId, p));
    return { granted: missing.length === 0, missing };
  }
}

export const permissionManager = new PermissionManager();
