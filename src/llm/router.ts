import { BaseLlmAdapter, LlmRequest, LlmResponse } from './base';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { settings } from '../config/settings';
import { getLogger } from '../observability/logger';

const log = getLogger('llm/router');

/**
 * Routes LLM requests to the appropriate adapter based on the model name
 * or the configured default provider.  Implements exponential-backoff retry
 * and falls back to `fallbackModel` on persistent failure.
 */
export class LlmRouter {
  private readonly adapters = new Map<string, BaseLlmAdapter>();
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(maxRetries = settings.maxRetries, baseDelayMs = settings.retryBaseDelayMs) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.adapters.set('openai', new OpenAIAdapter());
    this.adapters.set('anthropic', new AnthropicAdapter());
  }

  registerAdapter(adapter: BaseLlmAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  private resolveAdapter(model?: string): BaseLlmAdapter {
    if (model) {
      for (const adapter of this.adapters.values()) {
        if (adapter.supportsModel(model)) {
          return adapter;
        }
      }
    }
    const defaultAdapter = this.adapters.get(settings.defaultLlmProvider);
    if (!defaultAdapter) {
      throw new Error(`No adapter found for provider: ${settings.defaultLlmProvider}`);
    }
    return defaultAdapter;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1);
        log.warn({ attempt, delayMs }, 'LLM retry with backoff');
        await new Promise((r) => setTimeout(r, delayMs));
      }
      try {
        const adapter = this.resolveAdapter(request.model);
        return await adapter.complete(request);
      } catch (err) {
        lastErr = err;
        log.error({ err, attempt }, 'LLM call failed');
      }
    }

    // Fallback to a cheaper model
    if (request.model !== settings.fallbackModel) {
      log.warn({ fallback: settings.fallbackModel }, 'Falling back to fallback model');
      return this.complete({ ...request, model: settings.fallbackModel });
    }

    throw lastErr;
  }
}

export const llmRouter = new LlmRouter();
