import Anthropic from '@anthropic-ai/sdk';
import { BaseLlmAdapter, LlmRequest, LlmResponse, Message } from './base';
import { settings } from '../config/settings';
import { getLogger } from '../observability/logger';
import {
  llmRequestsTotal,
  llmTokensTotal,
  llmLatencySeconds,
} from '../observability/metrics';

const log = getLogger('llm/anthropic');

export class AnthropicAdapter extends BaseLlmAdapter {
  readonly provider = 'anthropic';
  readonly supportedModels = ['claude-3', 'claude-2', 'claude-'];

  private readonly client: Anthropic;

  constructor(apiKey = settings.anthropicApiKey) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model ?? 'claude-3-haiku-20240307';
    const timer = llmLatencySeconds.startTimer({ provider: this.provider, model });

    // Extract system message if present
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const userMessages = request.messages.filter((m) => m.role !== 'system');

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        system: systemMsg?.content,
        messages: userMessages.map((m: Message) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      llmRequestsTotal.inc({ provider: this.provider, model, status: 'success' });
      llmTokensTotal.inc({ provider: this.provider, model, token_type: 'prompt' }, inputTokens);
      llmTokensTotal.inc(
        { provider: this.provider, model, token_type: 'completion' },
        outputTokens,
      );

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text : '';
      const finishReason = response.stop_reason ?? 'stop';

      log.debug({ model, tokens: inputTokens + outputTokens }, 'Anthropic completion');

      return {
        content,
        model,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        finishReason,
        raw: response,
      };
    } catch (err) {
      llmRequestsTotal.inc({ provider: this.provider, model, status: 'error' });
      log.error({ err, model }, 'Anthropic completion failed');
      throw err;
    } finally {
      timer();
    }
  }
}
