import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AuditEventSchema } from 'packages-api-contracts';
import type { AuditEvent, ListAuditEventsRequest, ListAuditEventsResponse } from 'packages-api-contracts';

type SecretAccessLogInput = {
  connectionId: string;
  requesterId: string;
  reason?: string;
  allowed: boolean;
};

type AgentToolAccessLogInput = {
  runId: string;
  toolId: string;
  requesterId: string;
  reason?: string;
  allowed: boolean;
};

/**
 * AuditService - append-only audit log for sensitive actions.
 * 
 * Security: audit logs never include secret values.
 */
export class AuditService {
  private static instance: AuditService | null = null;
  private readonly auditPath: string;

  private constructor() {
    this.auditPath = path.join(app.getPath('userData'), 'audit.log.jsonl');
  }

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  public logSecretAccess(input: SecretAccessLogInput): AuditEvent {
    const event = AuditEventSchema.parse({
      id: randomUUID(),
      type: 'secret-access',
      connectionId: input.connectionId,
      requesterId: input.requesterId,
      reason: input.reason,
      allowed: input.allowed,
      createdAt: new Date().toISOString(),
    });

    this.appendEvent(event);
    return event;
  }

  public logAgentToolAccess(input: AgentToolAccessLogInput): AuditEvent {
    const event = AuditEventSchema.parse({
      id: randomUUID(),
      type: 'agent-tool-access',
      runId: input.runId,
      toolId: input.toolId,
      requesterId: input.requesterId,
      reason: input.reason,
      allowed: input.allowed,
      createdAt: new Date().toISOString(),
    });

    this.appendEvent(event);
    return event;
  }

  public listEvents(request: ListAuditEventsRequest = {}): ListAuditEventsResponse {
    const limit = request.limit ?? 200;
    const cursor = request.cursor ? parseInt(request.cursor, 10) : 0;
    const events = this.readEvents();
    const start = Number.isFinite(cursor) && cursor > 0 ? cursor : 0;
    const slice = events.slice(start, start + limit);
    const nextCursor = start + limit < events.length ? String(start + limit) : undefined;

    return { events: slice, nextCursor };
  }

  private appendEvent(event: AuditEvent): void {
    const dir = path.dirname(this.auditPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(this.auditPath, `${JSON.stringify(event)}\n`, 'utf-8');
  }

  private readEvents(): AuditEvent[] {
    try {
      if (!fs.existsSync(this.auditPath)) {
        return [];
      }
      const content = fs.readFileSync(this.auditPath, 'utf-8');
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as AuditEvent);
    } catch {
      return [];
    }
  }
}

export const auditService = AuditService.getInstance();
