import { getLogger } from '../observability/logger';

const log = getLogger('human-loop/interface');

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ApprovalRequest {
  id: string;
  agentId: string;
  taskId: string;
  action: string;
  reasoning: string;
  riskLevel: RiskLevel;
  payload?: unknown;
  requestedAt: Date;
}

export interface ApprovalResult {
  requestId: string;
  approved: boolean;
  reviewedBy?: string;
  comment?: string;
  reviewedAt: Date;
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<ApprovalResult>;

/**
 * Human-in-the-loop gate.
 *
 * For high/critical risk actions the agent must obtain human approval before
 * proceeding.  The `handler` is pluggable — wire it to Slack, email, a web
 * dashboard, or a CLI prompt depending on deployment context.
 */
export class HumanInTheLoop {
  private handler: ApprovalHandler;
  private readonly riskThreshold: RiskLevel;

  private static readonly RISK_ORDER: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  constructor(
    handler: ApprovalHandler = HumanInTheLoop.autoApproveHandler,
    riskThreshold: RiskLevel = 'high',
  ) {
    this.handler = handler;
    this.riskThreshold = riskThreshold;
  }

  setHandler(handler: ApprovalHandler): void {
    this.handler = handler;
  }

  requiresApproval(riskLevel: RiskLevel): boolean {
    return (
      HumanInTheLoop.RISK_ORDER[riskLevel] >= HumanInTheLoop.RISK_ORDER[this.riskThreshold]
    );
  }

  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    if (!this.requiresApproval(request.riskLevel)) {
      log.debug({ requestId: request.id, riskLevel: request.riskLevel }, 'Auto-approved (low risk)');
      return {
        requestId: request.id,
        approved: true,
        comment: 'Auto-approved: below risk threshold',
        reviewedAt: new Date(),
      };
    }

    log.info(
      { requestId: request.id, riskLevel: request.riskLevel, action: request.action },
      'Human approval required',
    );
    const result = await this.handler(request);
    log.info(
      { requestId: request.id, approved: result.approved, reviewedBy: result.reviewedBy },
      'Human approval received',
    );
    return result;
  }

  /** Default handler — auto-approves everything (suitable for testing). */
  private static async autoApproveHandler(request: ApprovalRequest): Promise<ApprovalResult> {
    return {
      requestId: request.id,
      approved: true,
      comment: 'Auto-approved by default handler',
      reviewedAt: new Date(),
    };
  }
}

export const humanInTheLoop = new HumanInTheLoop();
