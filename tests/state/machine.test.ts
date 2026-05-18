import { TaskStateMachine, TaskStatus } from '../../src/state/machine';

describe('TaskStateMachine', () => {
  let sm: TaskStateMachine;

  beforeEach(() => {
    sm = new TaskStateMachine();
  });

  it('creates a task in PENDING state', () => {
    const task = sm.create('Test goal');
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.goal).toBe('Test goal');
  });

  it('follows valid transitions', () => {
    const task = sm.create('goal');
    sm.transition(task.id, TaskStatus.RUNNING);
    expect(sm.get(task.id).status).toBe(TaskStatus.RUNNING);
    sm.transition(task.id, TaskStatus.DONE);
    expect(sm.get(task.id).status).toBe(TaskStatus.DONE);
  });

  it('rejects invalid transitions', () => {
    const task = sm.create('goal');
    expect(() => sm.transition(task.id, TaskStatus.DONE)).toThrow();
  });

  it('records steps', () => {
    const task = sm.create('goal');
    sm.transition(task.id, TaskStatus.RUNNING);
    sm.recordStep(task.id, { stepIndex: 0, action: 'think', output: 'response' });
    expect(sm.get(task.id).steps).toHaveLength(1);
  });

  it('creates and restores checkpoints', () => {
    const task = sm.create('goal');
    sm.transition(task.id, TaskStatus.RUNNING);
    sm.recordStep(task.id, { stepIndex: 0, action: 'think', output: 'ok' });

    const cp = sm.checkpoint(task.id);
    expect(cp.stepIndex).toBe(1);

    const restored = sm.restore(cp);
    expect(restored.status).toBe(TaskStatus.PAUSED);
    expect(restored.steps).toHaveLength(1);
  });

  it('throws for unknown task id', () => {
    expect(() => sm.get('non-existent')).toThrow();
  });
});
