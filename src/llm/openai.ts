import OpenAI from 'openai';
import { BaseLlmAdapter, LlmRequest, LlmResponse } from './base';
import { settings } from '../config/settings';
import { getLogger } from '../observability/logger';
import {
  llmRequestsTotal,
  llmTokensTotal,
  llmLatencySeconds,
} from '../observability/metrics';

const log = getLogger('llm/openai');

export class OpenAIAdapter extends BaseLlmAdapter {
  readonly provider = 'openai';
  readonly supportedModels = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'gpt-4o'];

  private readonly client: OpenAI;

  constructor(apiKey = settings.openaiApiKey) {
    super();
    this.client = new OpenAI({ apiKey });
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model ?? settings.defaultModel;
    const timer = llmLatencySeconds.startTimer({ provider: this.provider, model });

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: request.messages as OpenAI.ChatCompletionMessageParam[],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
        ...(request.extraParams as Record<string, unknown>),
      });

      const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      llmRequestsTotal.inc({ provider: this.provider, model, status: 'success' });
      llmTokensTotal.inc(
        { provider: this.provider, model, token_type: 'prompt' },
        usage.prompt_tokens,
      );
      llmTokensTotal.inc(
        { provider: this.provider, model, token_type: 'completion' },
        usage.completion_tokens,
      );

      const content = response.choices[0]?.message?.content ?? '';
      const finishReason = response.choices[0]?.finish_reason ?? 'stop';

      log.debug({ model, tokens: usage.total_tokens }, 'OpenAI completion');

      return {
        content,
        model,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        finishReason,
        raw: response,
      };
    } catch (err) {
      llmRequestsTotal.inc({ provider: this.provider, model, status: 'error' });
      log.error({ err, model }, 'OpenAI completion failed');
      throw err;
    } finally {
      timer();
    }
  }
}
