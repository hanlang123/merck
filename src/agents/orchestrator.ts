import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, AgentOptions, AgentRunResult } from './base';
import { ExecutorAgent } from './executor';
import { ValidatorAgent } from './validator';
import { promptRegistry } from '../llm/prompt-template';
import { HumanInTheLoop, ApprovalRequest } from '../human-loop/interface';
import { getLogger } from '../observability/logger';
import { withSpan } from '../observability/tracer';

const log = getLogger('agents/orchestrator');

export interface SubTask {
  id: string;
  description: string;
  tool?: string;
  params?: Record<string, unknown>;
}

export interface OrchestratorPlan {
  thoughts: string;
  tasks: SubTask[];
  done: boolean;
}

/**
 * Orchestrator agent — the top-level planner.
 *
 * Flow:
 *  1. Generate a plan (list of sub-tasks) via LLM
 *  2. Request human approval for high-risk plans
 *  3. Dispatch each sub-task to an ExecutorAgent
 *  4. Validate executor output with ValidatorAgent
 *  5. Aggregate results and return
 */
export class OrchestratorAgent extends BaseAgent {
  private readonly executor: ExecutorAgent;
  private readonly validator: ValidatorAgent;
  private readonly humanLoop: HumanInTheLoop;

  constructor(opts: AgentOptions & { humanLoop?: HumanInTheLoop } = {}) {
    super({ ...opts, role: 'orchestrator' });
    this.executor = new ExecutorAgent(opts);
    this.validator = new ValidatorAgent(opts);
    this.humanLoop = opts.humanLoop ?? new HumanInTheLoop();
  }

  protected systemPrompt(): string {
    const tools = this.toolRegistry.list().map((t) => `${t.name}: ${t.description}`).join('\n');
    return promptRegistry.render('orchestrator_system', {
      tools: tools || 'none',
      date: new Date().toISOString(),
    });
  }

  protected async execute(goal: string, taskId: string): Promise<string> {
    return withSpan('orchestrator.execute', async () => {
      log.info({ taskId, goal }, 'Orchestrator planning');

      // ── Step 1: Generate plan ────────────────────────────────────────────
      const planResponse = await this.think(goal);
      this.stateMachine.recordStep(taskId, {
        stepIndex: 0,
        action: 'plan',
        input: goal,
        output: planResponse.content,
      });

      let plan: OrchestratorPlan;
      try {
        plan = JSON.parse(planResponse.content) as OrchestratorPlan;
      } catch {
        // Non-JSON response → treat as single-task direct answer
        return planResponse.content;
      }

      // ── Step 2: Human approval for non-trivial plans ─────────────────────
      if (plan.tasks.length > 3 || plan.tasks.some((t) => t.tool?.includes('write'))) {
        const approval = await this.humanLoop.requestApproval({
          id: uuidv4(),
          agentId: this.id,
          taskId,
          action: 'execute_plan',
          reasoning: plan.thoughts,
          riskLevel: 'high',
          payload: plan,
          requestedAt: new Date(),
        } as ApprovalRequest);

        if (!approval.approved) {
          throw new Error(`Plan rejected by human: ${approval.comment}`);
        }
      }

      // ── Step 3: Execute sub-tasks ────────────────────────────────────────
      const results: string[] = [];
      for (const subTask of plan.tasks) {
        this.checkStepLimit(results.length + 1);
        log.info({ subTaskId: subTask.id, description: subTask.description }, 'Dispatching sub-task');

        let executorResult: AgentRunResult;
        try {
          executorResult = await this.executor.run(subTask.description, undefined);
        } catch (err) {
          log.error({ err, subTaskId: subTask.id }, 'Sub-task execution failed');
          results.push(`[FAILED] ${subTask.description}: ${String(err)}`);
          continue;
        }

        // ── Step 4: Validate output ──────────────────────────────────────
        const validation = await this.validator.validate(subTask.description, executorResult.output);
        if (!validation.valid) {
          log.warn({ subTaskId: subTask.id, issues: validation.issues }, 'Validation failed');
        }

        this.stateMachine.recordStep(taskId, {
          stepIndex: results.length + 1,
          action: `subtask:${subTask.id}`,
          input: subTask,
          output: { executorResult, validation },
        });

        results.push(`[${validation.valid ? 'OK' : 'WARN'}] ${subTask.description}: ${executorResult.output}`);
      }

      return results.join('\n');
    });
  }
}
