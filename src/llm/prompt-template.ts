import { getLogger } from '../observability/logger';

const log = getLogger('llm/prompt-template');

export interface TemplateVersion {
  version: string;
  template: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Versioned prompt template with Handlebars-style `{{variable}}` interpolation.
 */
export class PromptTemplate {
  private readonly versions = new Map<string, TemplateVersion>();
  private activeVersion: string;

  constructor(
    public readonly name: string,
    initialTemplate: string,
    initialVersion = '1.0.0',
  ) {
    this.addVersion(initialVersion, initialTemplate);
    this.activeVersion = initialVersion;
  }

  addVersion(version: string, template: string, metadata?: Record<string, unknown>): void {
    this.versions.set(version, { version, template, createdAt: new Date(), metadata });
    log.debug({ name: this.name, version }, 'Prompt template version added');
  }

  setActiveVersion(version: string): void {
    if (!this.versions.has(version)) {
      throw new Error(`Version ${version} not found for template "${this.name}"`);
    }
    this.activeVersion = version;
    log.info({ name: this.name, version }, 'Active prompt template version changed');
  }

  render(variables: Record<string, string>, version?: string): string {
    const v = version ?? this.activeVersion;
    const entry = this.versions.get(v);
    if (!entry) {
      throw new Error(`Template version "${v}" not found for "${this.name}"`);
    }
    let result = entry.template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  }

  getVersion(version?: string): TemplateVersion {
    const v = version ?? this.activeVersion;
    const entry = this.versions.get(v);
    if (!entry) {
      throw new Error(`Version "${v}" not found for template "${this.name}"`);
    }
    return entry;
  }

  listVersions(): string[] {
    return Array.from(this.versions.keys());
  }
}

// ── Template Registry ─────────────────────────────────────────────────────────
export class PromptTemplateRegistry {
  private readonly templates = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): void {
    this.templates.set(template.name, template);
  }

  get(name: string): PromptTemplate {
    const t = this.templates.get(name);
    if (!t) throw new Error(`Prompt template "${name}" not found`);
    return t;
  }

  render(name: string, variables: Record<string, string>, version?: string): string {
    return this.get(name).render(variables, version);
  }

  list(): string[] {
    return Array.from(this.templates.keys());
  }
}

export const promptRegistry = new PromptTemplateRegistry();

// ── Built-in templates ────────────────────────────────────────────────────────
promptRegistry.register(
  new PromptTemplate(
    'orchestrator_system',
    `You are an Orchestrator agent. Your role is to break down the user's goal into subtasks and delegate them to Executor agents.

Available tools:
{{tools}}

Current date: {{date}}

Always respond with a valid JSON plan:
{
  "thoughts": "...",
  "tasks": [{ "id": "1", "description": "...", "tool": "...", "params": {} }],
  "done": false
}`,
  ),
);

promptRegistry.register(
  new PromptTemplate(
    'executor_system',
    `You are an Executor agent. Your role is to carry out a specific subtask using the available tools.

Task: {{task}}
Context: {{context}}

Use the provided tools and return the result.`,
  ),
);

promptRegistry.register(
  new PromptTemplate(
    'validator_system',
    `You are a Validator agent. Review the executor's output and determine if it correctly fulfils the task.

Task: {{task}}
Output: {{output}}

Return JSON: { "valid": true/false, "issues": ["..."], "score": 0-1 }`,
  ),
);
