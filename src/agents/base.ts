import { v4 as uuidv4 } from 'uuid';
import { LlmRouter } from '../llm/router';
import { LlmRequest, LlmResponse, Message } from '../llm/base';
import { ShortTermMemory } from '../memory/short-term';
import { ToolRegistry } from '../tools/registry';
import { Guardrails } from '../security/guardrails';
import { AuditLogger } from '../security/guardrails';
import { TaskStateMachine, TaskStatus } from '../state/machine';
import { getLogger } from '../observability/logger';
import { agentStepsTotal, agentActiveTasks } from '../observability/metrics';
import { withSpan } from '../observability/tracer';
import { settings } from '../config/settings';

export type AgentRole = 'orchestrator' | 'executor' | 'validator' | 'generic';

export interface AgentOptions {
  id?: string;
  role?: AgentRole;
  maxSteps?: number;
  llmRouter?: LlmRouter;
  toolRegistry?: ToolRegistry;
  guardrails?: Guardrails;
  auditLogger?: AuditLogger;
  stateMachine?: TaskStateMachine;
}

export interface AgentRunResult {
  agentId: string;
  taskId: string;
  output: string;
  steps: number;
  success: boolean;
  error?: string;
}

/**
 * Base agent class providing:
 *  - Short-term memory (sliding window)
 *  - Max-step guard (prevents infinite loops)
 *  - Security guardrails on I/O
 *  - Audit logging of every action
 *  - OTel span per run
 */
export abstract class BaseAgent {
  readonly id: string;
  readonly role: AgentRole;

  protected readonly llmRouter: LlmRouter;
  protected readonly toolRegistry: ToolRegistry;
  protected readonly guardrails: Guardrails;
  protected readonly auditLogger: AuditLogger;
  protected readonly stateMachine: TaskStateMachine;
  protected readonly maxSteps: number;
  protected memory: ShortTermMemory;

  constructor(opts: AgentOptions = {}) {
    this.id = opts.id ?? uuidv4();
    this.role = opts.role ?? 'generic';
    this.maxSteps = opts.maxSteps ?? settings.maxSteps;
    this.llmRouter = opts.llmRouter ?? new LlmRouter();
    this.toolRegistry = opts.toolRegistry ?? new ToolRegistry();
    this.guardrails = opts.guardrails ?? new Guardrails();
    this.auditLogger = opts.auditLogger ?? new AuditLogger();
    this.stateMachine = opts.stateMachine ?? new TaskStateMachine();
    this.memory = new ShortTermMemory();
  }

  protected abstract systemPrompt(): string;

  protected async think(userMessage: string): Promise<LlmResponse> {
    const scan = this.guardrails.scanInput(userMessage);
    if (!scan.allowed) {
      throw new Error(`Guardrail blocked input: ${scan.blockReason}`);
    }

    this.memory.append({ role: 'user', content: scan.text });

    const request: LlmRequest = { messages: this.buildMessages() };
    const response = await this.llmRouter.complete(request);

    const outputScan = this.guardrails.scanOutput(response.content);
    const safeContent = outputScan.text;

    this.memory.append({ role: 'assistant', content: safeContent });
    return { ...response, content: safeContent };
  }

  private buildMessages(): Message[] {
    const sys: Message = { role: 'system', content: this.systemPrompt() };
    return [sys, ...this.memory.getMessages()];
  }

  protected getLog() {
    return getLogger('agents/base', { agentId: this.id, role: this.role });
  }

  async run(goal: string, tenantId?: string): Promise<AgentRunResult> {
    const log = this.getLog();
    return withSpan(`agent.${this.role}.run`, async () => {
      const task = this.stateMachine.create(goal, tenantId);
      agentActiveTasks.inc({ agent_type: this.role });

      try {
        this.stateMachine.transition(task.id, TaskStatus.RUNNING);
        const output = await this.execute(goal, task.id);
        this.stateMachine.setResult(task.id, output);
        this.stateMachine.transition(task.id, TaskStatus.DONE);
        agentActiveTasks.dec({ agent_type: this.role });
        return { agentId: this.id, taskId: task.id, output, steps: task.steps.length, success: true };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.stateMachine.transition(task.id, TaskStatus.FAILED, error);
        agentActiveTasks.dec({ agent_type: this.role });
        log.error({ err, taskId: task.id }, 'Agent run failed');
        return { agentId: this.id, taskId: task.id, output: '', steps: task.steps.length, success: false, error };
      }
    });
  }

  /** Subclasses implement the actual reasoning loop here. */
  protected abstract execute(goal: string, taskId: string): Promise<string>;

  protected checkStepLimit(stepIndex: number): void {
    if (stepIndex >= this.maxSteps) {
      throw new Error(`Max steps (${this.maxSteps}) exceeded`);
    }
    agentStepsTotal.inc({ agent_id: this.id });
  }

  resetMemory(): void {
    this.memory = new ShortTermMemory();
  }
}
