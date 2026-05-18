export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export interface TaskState {
  id: string;
  status: TaskStatus;
  goal: string;
  tenantId?: string;
  steps: StepRecord[];
  result?: unknown;
  error?: string;
  checkpoints: Checkpoint[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StepRecord {
  stepIndex: number;
  action: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  timestamp: Date;
}

export interface Checkpoint {
  id: string;
  stepIndex: number;
  state: Omit<TaskState, 'checkpoints'>;
  savedAt: Date;
}
