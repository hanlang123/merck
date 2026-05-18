import { BaseAgent, AgentOptions } from './base';
import { promptRegistry } from '../llm/prompt-template';
import { TaskStateMachine } from '../state/machine';
import { getLogger } from '../observability/logger';

const log = getLogger('agents/executor');

/**
 * Executor agent — carries out a single subtask using available tools.
 */
export class ExecutorAgent extends BaseAgent {
  constructor(opts: AgentOptions = {}) {
    super({ ...opts, role: 'executor' });
  }

  protected systemPrompt(): string {
    const tools = this.toolRegistry.list().map((t) => `${t.name}: ${t.description}`).join('\n');
    return promptRegistry.render('executor_system', {
      task: 'Await task from orchestrator',
      context: `Available tools:\n${tools || 'none'}`,
    });
  }

  protected async execute(goal: string, taskId: string): Promise<string> {
    log.info({ taskId, goal }, 'Executor starting');
    let step = 0;

    while (step < this.maxSteps) {
      this.checkStepLimit(step);

      const response = await this.think(step === 0 ? goal : 'Continue execution.');
      const content = response.content.trim();

      this.stateMachine.recordStep(taskId, {
        stepIndex: step,
        action: 'llm_response',
        output: content,
        durationMs: 0,
      });

      // Detect tool call (simple JSON extraction pattern)
      const toolMatch = content.match(/TOOL_CALL:\s*(\{[\s\S]*?\})/);
      if (toolMatch) {
        try {
          const parsed = JSON.parse(toolMatch[1]) as { name: string; params: Record<string, unknown> };
          const result = await this.toolRegistry.call(parsed.name, parsed.params);
          this.memory.append({
            role: 'tool',
            content: JSON.stringify(result),
            name: parsed.name,
          });
          this.stateMachine.recordStep(taskId, {
            stepIndex: step,
            action: `tool_call:${parsed.name}`,
            input: parsed.params,
            output: result,
          });
        } catch (err) {
          log.warn({ err }, 'Tool call parse error');
        }
      }

      // Detect completion signal
      if (content.includes('DONE:') || content.includes('"done": true')) {
        return content;
      }

      step++;
    }

    throw new Error('Executor exceeded max steps without completing');
  }
}
