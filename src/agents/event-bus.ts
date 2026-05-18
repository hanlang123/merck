import EventEmitter from 'events';
import { getLogger } from '../observability/logger';

const log = getLogger('agents/event-bus');

export interface AgentMessage {
  from: string;
  to: string | 'broadcast';
  type: string;
  payload?: unknown;
  timestamp: Date;
}

/**
 * Simple in-process event bus for inter-agent communication.
 * In production, replace with Redis Pub/Sub or a message queue (RabbitMQ / Kafka).
 */
export class AgentEventBus {
  private readonly emitter = new EventEmitter();

  publish(message: Omit<AgentMessage, 'timestamp'>): void {
    const full: AgentMessage = { ...message, timestamp: new Date() };
    log.debug({ from: full.from, to: full.to, type: full.type }, 'Event published');
    const channel = full.to === 'broadcast' ? 'broadcast' : `agent:${full.to}`;
    this.emitter.emit(channel, full);
    this.emitter.emit('all', full);
  }

  subscribe(agentId: string, handler: (msg: AgentMessage) => void): void {
    this.emitter.on(`agent:${agentId}`, handler);
    log.debug({ agentId }, 'Agent subscribed to event bus');
  }

  subscribeBroadcast(handler: (msg: AgentMessage) => void): void {
    this.emitter.on('broadcast', handler);
  }

  subscribeAll(handler: (msg: AgentMessage) => void): void {
    this.emitter.on('all', handler);
  }

  unsubscribe(agentId: string, handler: (msg: AgentMessage) => void): void {
    this.emitter.off(`agent:${agentId}`, handler);
  }
}

export const agentEventBus = new AgentEventBus();
