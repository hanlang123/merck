import { Message } from '../llm/base';
import { getLogger } from '../observability/logger';

const log = getLogger('memory/short-term');

const DEFAULT_MAX_TOKENS = 8_000; // conservative context window
const AVG_CHARS_PER_TOKEN = 4;

/**
 * Short-term (in-process) conversation memory with a sliding window.
 * Prevents context-window overflow by evicting the oldest non-system messages.
 */
export class ShortTermMemory {
  private messages: Message[] = [];
  private readonly maxTokens: number;

  constructor(maxTokens = DEFAULT_MAX_TOKENS) {
    this.maxTokens = maxTokens;
  }

  append(message: Message): void {
    this.messages.push(message);
    this.evict();
  }

  private estimateTokens(): number {
    const total = this.messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(total / AVG_CHARS_PER_TOKEN);
  }

  private evict(): void {
    while (this.estimateTokens() > this.maxTokens && this.messages.length > 1) {
      // Never evict the system message (index 0 if role === 'system')
      const firstEvictable = this.messages[0]?.role === 'system' ? 1 : 0;
      if (firstEvictable >= this.messages.length) break;
      const removed = this.messages.splice(firstEvictable, 1)[0];
      log.debug({ role: removed?.role }, 'Evicted message from short-term memory');
    }
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  get length(): number {
    return this.messages.length;
  }

  get estimatedTokenCount(): number {
    return this.estimateTokens();
  }
}
