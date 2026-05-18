import * as vm from 'vm';
import { BaseTool, ToolDefinition } from './base';
import { getLogger } from '../observability/logger';

const log = getLogger('tools/sandbox');

export interface SandboxOptions {
  /** Maximum execution time in milliseconds. Default: 1000 */
  timeoutMs?: number;
  /** Additional safe context variables available inside the sandbox. */
  context?: Record<string, unknown>;
}

export interface SandboxRunResult {
  /** Return value of the last expression / explicit `return` in the code. */
  result: unknown;
  /** Lines captured from `console.log / warn / error` calls. */
  logs: string[];
  /** Wall-clock execution time. */
  executionMs: number;
}

/**
 * Lightweight JavaScript sandbox backed by Node.js `vm.Script`.
 *
 * Security properties:
 *  - No access to `require`, `process`, `global`, `fs`, `net`, `child_process`.
 *  - Hard CPU timeout via `vm.Script#runInContext({ timeout })`.
 *  - Only a curated allow-list of globals is exposed.
 */
export class Sandbox {
  private readonly timeoutMs: number;
  private readonly extraContext: Record<string, unknown>;

  constructor(opts: SandboxOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 1000;
    this.extraContext = opts.context ?? {};
  }

  /**
   * Execute `code` inside the sandbox and return its result.
   * Throws on syntax errors, runtime exceptions, or timeout.
   */
  run(code: string): SandboxRunResult {
    const logs: string[] = [];
    const start = Date.now();

    // Minimal, safe allow-list of globals
    const sandbox: Record<string, unknown> = {
      console: {
        log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
        warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
        error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
        info: (...args: unknown[]) => logs.push('[INFO] ' + args.map(String).join(' ')),
      },
      Math,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      Number,
      String,
      Boolean,
      Array,
      Object,
      Date,
      encodeURIComponent,
      decodeURIComponent,
      ...this.extraContext,
      // Sentinel for capturing return value
      __result: undefined as unknown,
    };

    vm.createContext(sandbox);

    try {
      // Wrap in an IIFE so `return` works naturally inside the user code.
      const wrapped = `__result = (function () { ${code} })();`;
      const script = new vm.Script(wrapped, { filename: 'sandbox.js' });
      script.runInContext(sandbox, { timeout: this.timeoutMs });
    } catch (err) {
      const executionMs = Date.now() - start;
      log.warn({ err, executionMs }, 'Sandbox execution failed');
      throw Object.assign(
        new Error(err instanceof Error ? err.message : String(err)),
        { logs, executionMs },
      );
    }

    return {
      result: sandbox['__result'],
      logs,
      executionMs: Date.now() - start,
    };
  }
}

/**
 * A `BaseTool` that exposes the Sandbox to agents.
 * Requires the `sandbox:execute` permission to be granted.
 */
export class SandboxedCodeTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'sandboxed_code',
    description:
      'Executes untrusted JavaScript code in an isolated sandbox. ' +
      'No access to the file system, network, or system APIs is allowed. ' +
      'Use `return <value>` to return a result; use `console.log()` for output.',
    parameters: {
      code: {
        type: 'string',
        description: 'JavaScript code to execute inside the sandbox.',
        required: true,
      },
      timeoutMs: {
        type: 'number',
        description: 'Maximum execution time in milliseconds (default: 1000, max: 5000).',
      },
    },
  };

  get requiredPermissions(): string[] {
    return ['sandbox:execute'];
  }

  protected async execute(params: Record<string, unknown>): Promise<unknown> {
    const code = String(params['code'] ?? '');
    const rawTimeout = typeof params['timeoutMs'] === 'number' ? params['timeoutMs'] : 1000;
    // Cap at 5000 ms to prevent long-running abuse
    const timeoutMs = Math.min(Math.max(1, rawTimeout), 5_000);

    log.debug({ codeLength: code.length, timeoutMs }, 'Running code in sandbox');
    const sandbox = new Sandbox({ timeoutMs });
    return sandbox.run(code);
  }
}
