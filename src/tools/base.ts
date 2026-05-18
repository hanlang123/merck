import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../observability/logger';
import { toolCallsTotal, toolLatencySeconds } from '../observability/metrics';
import { withSpan } from '../observability/tracer';

const log = getLogger('tools/base');

export const ToolParameterSchema = z.record(z.unknown());

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON-schema-compatible parameter definitions */
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionMs: number;
}

export abstract class BaseTool {
  abstract readonly definition: ToolDefinition;

  /** Override to declare required permissions (e.g. "read:files", "write:db") */
  get requiredPermissions(): string[] {
    return [];
  }

  /** Execute the tool. Implement business logic here. */
  protected abstract execute(params: Record<string, unknown>): Promise<unknown>;

  async run(params: Record<string, unknown>): Promise<ToolResult> {
    const start = Date.now();
    const spanName = `tool.${this.definition.name}`;
    return withSpan(spanName, async () => {
      try {
        log.debug({ tool: this.definition.name, params }, 'Tool invoked');
        const data = await this.execute(params);
        const executionMs = Date.now() - start;
        toolCallsTotal.inc({ tool_name: this.definition.name, status: 'success' });
        toolLatencySeconds.observe({ tool_name: this.definition.name }, executionMs / 1000);
        log.debug({ tool: this.definition.name, executionMs }, 'Tool succeeded');
        return { success: true, data, executionMs };
      } catch (err) {
        const executionMs = Date.now() - start;
        toolCallsTotal.inc({ tool_name: this.definition.name, status: 'error' });
        const error = err instanceof Error ? err.message : String(err);
        log.error({ tool: this.definition.name, error, executionMs }, 'Tool failed');
        return { success: false, error, executionMs };
      }
    });
  }
}

// ── Example built-in tool ────────────────────────────────────────────────────
export class EchoTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'echo',
    description: 'Returns the input unchanged. Useful for testing.',
    parameters: {
      message: { type: 'string', description: 'Message to echo', required: true },
    },
  };

  protected async execute(params: Record<string, unknown>): Promise<unknown> {
    return { echo: params['message'], id: uuidv4() };
  }
}
