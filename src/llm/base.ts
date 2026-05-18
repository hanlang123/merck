import { z } from 'zod';

// ── Message types ─────────────────────────────────────────────────────────────
export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  name: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export interface LlmRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  /** Arbitrary provider-specific options */
  extraParams?: Record<string, unknown>;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage: LlmUsage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error' | string;
  /** Raw provider response for debugging */
  raw?: unknown;
}

// ── Abstract adapter ──────────────────────────────────────────────────────────
export abstract class BaseLlmAdapter {
  abstract readonly provider: string;
  abstract readonly supportedModels: string[];

  abstract complete(request: LlmRequest): Promise<LlmResponse>;

  supportsModel(model: string): boolean {
    return this.supportedModels.some((m) => model.startsWith(m));
  }
}
