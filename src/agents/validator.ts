import { BaseAgent, AgentOptions } from './base';
import { promptRegistry } from '../llm/prompt-template';
import { getLogger } from '../observability/logger';

const log = getLogger('agents/validator');

export interface ValidationResult {
  valid: boolean;
  score: number;
  issues: string[];
  raw: string;
}

/**
 * Validator agent — reviews executor output for quality, correctness and safety.
 */
export class ValidatorAgent extends BaseAgent {
  constructor(opts: AgentOptions = {}) {
    super({ ...opts, role: 'validator' });
  }

  protected systemPrompt(): string {
    return promptRegistry.render('validator_system', { task: '', output: '' });
  }

  protected async execute(goal: string, taskId: string): Promise<string> {
    const response = await this.think(goal);
    this.stateMachine.recordStep(taskId, {
      stepIndex: 0,
      action: 'validation',
      output: response.content,
    });
    return response.content;
  }

  async validate(task: string, output: string): Promise<ValidationResult> {
    this.resetMemory();
    const prompt = promptRegistry.render('validator_system', { task, output });
    this.memory.append({ role: 'user', content: prompt });

    const response = await this.llmRouter.complete({
      messages: [
        { role: 'system', content: 'You are a strict quality validator.' },
        { role: 'user', content: prompt },
      ],
    });

    log.debug({ task, output: response.content }, 'Validation response');

    try {
      const parsed = JSON.parse(response.content) as {
        valid: boolean;
        score: number;
        issues: string[];
      };
      return { ...parsed, raw: response.content };
    } catch {
      // Fallback: treat any non-JSON as inconclusive
      const valid = response.content.toLowerCase().includes('"valid": true');
      return { valid, score: valid ? 0.7 : 0.3, issues: [], raw: response.content };
    }
  }
}
