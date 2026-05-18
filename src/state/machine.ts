import { v4 as uuidv4 } from 'uuid';
import {
  TaskState,
  TaskStatus,
  StepRecord,
  Checkpoint,
} from './types';
import { getLogger } from '../observability/logger';
import { agentTasksTotal } from '../observability/metrics';

export { TaskStatus };

const log = getLogger('state/machine');

/** Valid transitions for the task state machine */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.RUNNING, TaskStatus.FAILED],
  [TaskStatus.RUNNING]: [TaskStatus.PAUSED, TaskStatus.DONE, TaskStatus.FAILED],
  [TaskStatus.PAUSED]: [TaskStatus.RUNNING, TaskStatus.FAILED],
  [TaskStatus.DONE]: [],
  [TaskStatus.FAILED]: [],
};

export class TaskStateMachine {
  private readonly store = new Map<string, TaskState>();

  create(goal: string, tenantId?: string): TaskState {
    const state: TaskState = {
      id: uuidv4(),
      status: TaskStatus.PENDING,
      goal,
      tenantId,
      steps: [],
      checkpoints: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(state.id, state);
    log.info({ taskId: state.id, goal }, 'Task created');
    agentTasksTotal.inc({ agent_type: 'task', status: 'created' });
    return state;
  }

  get(taskId: string): TaskState {
    const state = this.store.get(taskId);
    if (!state) throw new Error(`Task ${taskId} not found`);
    return state;
  }

  transition(taskId: string, to: TaskStatus, reason?: string): TaskState {
    const state = this.get(taskId);
    const allowed = TRANSITIONS[state.status] ?? [];
    if (!allowed.includes(to)) {
      throw new Error(
        `Invalid transition ${state.status} → ${to} for task ${taskId}`,
      );
    }
    const from = state.status;
    state.status = to;
    state.updatedAt = new Date();
    if (to === TaskStatus.FAILED) {
      state.error = reason;
      agentTasksTotal.inc({ agent_type: 'task', status: 'failed' });
    } else if (to === TaskStatus.DONE) {
      agentTasksTotal.inc({ agent_type: 'task', status: 'done' });
    }
    log.info({ taskId, from, to, reason }, 'Task transition');
    return state;
  }

  recordStep(taskId: string, step: Omit<StepRecord, 'timestamp'>): void {
    const state = this.get(taskId);
    state.steps.push({ ...step, timestamp: new Date() });
    state.updatedAt = new Date();
  }

  setResult(taskId: string, result: unknown): void {
    const state = this.get(taskId);
    state.result = result;
    state.updatedAt = new Date();
  }

  /** Save a checkpoint that can be used to resume later. */
  checkpoint(taskId: string): Checkpoint {
    const state = this.get(taskId);
    const { checkpoints: _cp, ...stateWithoutCheckpoints } = state;
    const cp: Checkpoint = {
      id: uuidv4(),
      stepIndex: state.steps.length,
      state: stateWithoutCheckpoints,
      savedAt: new Date(),
    };
    state.checkpoints.push(cp);
    log.info({ taskId, checkpointId: cp.id, stepIndex: cp.stepIndex }, 'Checkpoint saved');
    return cp;
  }

  /** Restore task from a checkpoint (re-creates with PAUSED status). */
  restore(checkpoint: Checkpoint): TaskState {
    const restored: TaskState = {
      ...checkpoint.state,
      id: uuidv4(), // new execution ID
      status: TaskStatus.PAUSED,
      checkpoints: [checkpoint],
      updatedAt: new Date(),
    };
    this.store.set(restored.id, restored);
    log.info(
      { originalTaskId: checkpoint.state.id, newTaskId: restored.id },
      'Task restored from checkpoint',
    );
    return restored;
  }

  list(tenantId?: string): TaskState[] {
    return Array.from(this.store.values()).filter(
      (s) => tenantId === undefined || s.tenantId === tenantId,
    );
  }
}

export const taskStateMachine = new TaskStateMachine();
