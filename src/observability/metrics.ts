import {
  Counter,
  Histogram,
  Gauge,
  Registry,
} from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ app: 'enterprise-agent' });

// ── LLM ──────────────────────────────────────────────────────────────────────
export const llmRequestsTotal = new Counter({
  name: 'llm_requests_total',
  help: 'Total LLM API requests',
  labelNames: ['provider', 'model', 'status'] as const,
  registers: [registry],
});

export const llmTokensTotal = new Counter({
  name: 'llm_tokens_total',
  help: 'Total tokens consumed',
  labelNames: ['provider', 'model', 'token_type'] as const, // prompt | completion
  registers: [registry],
});

export const llmLatencySeconds = new Histogram({
  name: 'llm_latency_seconds',
  help: 'LLM request latency in seconds',
  labelNames: ['provider', 'model'] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [registry],
});

// ── Agent ─────────────────────────────────────────────────────────────────────
export const agentTasksTotal = new Counter({
  name: 'agent_tasks_total',
  help: 'Total agent tasks',
  labelNames: ['agent_type', 'status'] as const,
  registers: [registry],
});

export const agentStepsTotal = new Counter({
  name: 'agent_steps_total',
  help: 'Total agent reasoning steps',
  labelNames: ['agent_id'] as const,
  registers: [registry],
});

export const agentActiveTasks = new Gauge({
  name: 'agent_active_tasks',
  help: 'Currently active agent tasks',
  labelNames: ['agent_type'] as const,
  registers: [registry],
});

// ── Tools ─────────────────────────────────────────────────────────────────────
export const toolCallsTotal = new Counter({
  name: 'tool_calls_total',
  help: 'Total tool invocations',
  labelNames: ['tool_name', 'status'] as const,
  registers: [registry],
});

export const toolLatencySeconds = new Histogram({
  name: 'tool_latency_seconds',
  help: 'Tool execution latency',
  labelNames: ['tool_name'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [registry],
});

// ── Security ──────────────────────────────────────────────────────────────────
export const securityBlocksTotal = new Counter({
  name: 'security_blocks_total',
  help: 'Requests blocked by security guardrails',
  labelNames: ['reason'] as const,
  registers: [registry],
});

// ── Cost ─────────────────────────────────────────────────────────────────────
export const monthlyTokenUsage = new Gauge({
  name: 'monthly_token_usage',
  help: 'Tokens used this month per tenant',
  labelNames: ['tenant_id'] as const,
  registers: [registry],
});

export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Semantic cache hits',
  registers: [registry],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Semantic cache misses',
  registers: [registry],
});
