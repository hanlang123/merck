import { BaseTool, ToolDefinition, ToolResult } from './base';
import { getLogger } from '../observability/logger';

const log = getLogger('tools/registry');

export class ToolRegistry {
  private readonly tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    if (this.tools.has(tool.definition.name)) {
      log.warn({ name: tool.definition.name }, 'Overwriting existing tool registration');
    }
    this.tools.set(tool.definition.name, tool);
    log.info({ name: tool.definition.name }, 'Tool registered');
  }

  unregister(name: string): void {
    this.tools.delete(name);
    log.info({ name }, 'Tool unregistered');
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async call(
    name: string,
    params: Record<string, unknown>,
    grantedPermissions: string[] = [],
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}`, executionMs: 0 };
    }

    const missing = tool.requiredPermissions.filter((p) => !grantedPermissions.includes(p));
    if (missing.length > 0) {
      log.warn({ name, missing }, 'Permission denied for tool call');
      return {
        success: false,
        error: `Permission denied. Missing: ${missing.join(', ')}`,
        executionMs: 0,
      };
    }

    return tool.run(params);
  }
}

export const globalRegistry = new ToolRegistry();
