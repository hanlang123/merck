import { getLogger } from '../observability/logger';
import { securityBlocksTotal } from '../observability/metrics';
import { settings } from '../config/settings';
import * as fs from 'fs';

const log = getLogger('security/guardrails');

// ── Prompt injection patterns ─────────────────────────────────────────────────
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /forget\s+(all\s+)?your\s+(previous\s+)?instructions/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /act\s+as\s+if\s+you\s+(have|are|were)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /prompt\s+injection/i,
  /<script/i,
  /\beval\s*\(/i,
];

// ── PII / sensitive patterns ───────────────────────────────────────────────────
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
    label: 'ssn',
  },
  {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    replacement: '[CC_REDACTED]',
    label: 'credit_card',
  },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
    label: 'email',
  },
  {
    pattern: /\b(?:password|passwd|api[_-]?key|secret|token)\s*[:=]\s*\S+/gi,
    replacement: '[CREDENTIAL_REDACTED]',
    label: 'credential',
  },
];

export interface GuardrailResult {
  allowed: boolean;
  text: string;
  /** Redaction events that occurred */
  redactions: string[];
  /** Reason for blocking, if any */
  blockReason?: string;
}

export class Guardrails {
  private readonly enabled: boolean;

  constructor(enabled = settings.enableGuardrails) {
    this.enabled = enabled;
  }

  /**
   * Scan input text for prompt injection and redact PII.
   * Returns the (potentially redacted) text and whether it is allowed.
   */
  scanInput(text: string): GuardrailResult {
    if (!this.enabled) {
      return { allowed: true, text, redactions: [] };
    }

    // Injection check
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        log.warn({ pattern: pattern.toString() }, 'Prompt injection detected');
        securityBlocksTotal.inc({ reason: 'prompt_injection' });
        return {
          allowed: false,
          text,
          redactions: [],
          blockReason: `Prompt injection pattern detected: ${pattern}`,
        };
      }
    }

    // PII redaction
    let sanitised = text;
    const redactions: string[] = [];
    for (const { pattern, replacement, label } of PII_PATTERNS) {
      const before = sanitised;
      sanitised = sanitised.replace(pattern, replacement);
      if (sanitised !== before) {
        redactions.push(label);
        log.info({ label }, 'PII redacted from input');
      }
    }

    return { allowed: true, text: sanitised, redactions };
  }

  /**
   * Scan LLM output for accidental sensitive data leakage.
   */
  scanOutput(text: string): GuardrailResult {
    if (!this.enabled) {
      return { allowed: true, text, redactions: [] };
    }
    let sanitised = text;
    const redactions: string[] = [];
    for (const { pattern, replacement, label } of PII_PATTERNS) {
      const before = sanitised;
      sanitised = sanitised.replace(pattern, replacement);
      if (sanitised !== before) {
        redactions.push(label);
        log.warn({ label }, 'Sensitive data found in LLM output — redacted');
        securityBlocksTotal.inc({ reason: `output_${label}` });
      }
    }
    return { allowed: true, text: sanitised, redactions };
  }
}

export const guardrails = new Guardrails();

// ── Audit log ─────────────────────────────────────────────────────────────────
export interface AuditEvent {
  timestamp: string;
  tenantId?: string;
  agentId?: string;
  action: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
  decision: 'allow' | 'deny';
  reason?: string;
}

export class AuditLogger {
  private readonly path: string;

  constructor(path = settings.auditLogPath) {
    this.path = path;
  }

  log(event: AuditEvent): void {
    const line = JSON.stringify(event) + '\n';
    try {
      fs.appendFileSync(this.path, line, 'utf8');
    } catch (err) {
      log.error({ err }, 'Failed to write audit log');
    }
  }
}

export const auditLogger = new AuditLogger();
