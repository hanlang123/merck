import { AgentEventBus } from '../../src/agents/event-bus';

describe('AgentEventBus', () => {
  it('delivers messages to the target agent', (done) => {
    const bus = new AgentEventBus();
    bus.subscribe('agent-1', (msg) => {
      expect(msg.type).toBe('ping');
      done();
    });
    bus.publish({ from: 'agent-0', to: 'agent-1', type: 'ping' });
  });

  it('delivers broadcast messages to all subscribers', (done) => {
    const bus = new AgentEventBus();
    let count = 0;
    bus.subscribeBroadcast(() => {
      count++;
      if (count === 1) done();
    });
    bus.publish({ from: 'orchestrator', to: 'broadcast', type: 'status_update' });
  });

  it('unsubscribes correctly', () => {
    const bus = new AgentEventBus();
    let received = 0;
    const handler = () => { received++; };
    bus.subscribe('agent-x', handler);
    bus.publish({ from: 'a', to: 'agent-x', type: 'msg' });
    bus.unsubscribe('agent-x', handler);
    bus.publish({ from: 'a', to: 'agent-x', type: 'msg' });
    expect(received).toBe(1);
  });
});
