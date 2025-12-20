import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

let appendedContent = '';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:\\mock\\userdata'),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  appendFileSync: vi.fn((file: string, data: string) => {
    if (file === 'C:\\mock\\userdata\\audit.log.jsonl') {
      appendedContent += data;
    }
  }),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { AuditService } from './AuditService';

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    appendedContent = '';
    // @ts-expect-error Reset singleton for tests
    AuditService.instance = null;
    service = AuditService.getInstance();
  });

  it('logs secret access events without secret values', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const event = service.logSecretAccess({
      connectionId: '00000000-0000-0000-0000-000000000001',
      requesterId: 'ext-1',
      reason: 'Needs token',
      allowed: true,
    });

    expect(event.type).toBe('secret-access');
    expect(appendedContent).toContain('"type":"secret-access"');
    expect(appendedContent).not.toContain('secretValue');
  });

  it('logs agent tool access events without secret values', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const event = service.logAgentToolAccess({
      runId: '2cb57c8a-4d7b-4a6e-9a5e-2d2b5d7c4a10',
      toolId: 'fs.read',
      requesterId: 'agent-host',
      reason: 'Read workspace files',
      allowed: true,
    });

    expect(event.type).toBe('agent-tool-access');
    expect(appendedContent).toContain('"type":"agent-tool-access"');
    expect(appendedContent).not.toContain('secretValue');
  });

  it('lists audit events with pagination', () => {
    const events = [
      service.logSecretAccess({
        connectionId: '00000000-0000-0000-0000-000000000001',
        requesterId: 'ext-1',
        allowed: true,
      }),
      service.logSecretAccess({
        connectionId: '00000000-0000-0000-0000-000000000002',
        requesterId: 'ext-2',
        allowed: false,
      }),
    ];

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      events.map((event) => JSON.stringify(event)).join('\n') + '\n'
    );

    const first = service.listEvents({ limit: 1 });
    expect(first.events).toHaveLength(1);
    expect(first.nextCursor).toBe('1');

    const second = service.listEvents({ limit: 1, cursor: first.nextCursor });
    expect(second.events).toHaveLength(1);
    expect(second.nextCursor).toBeUndefined();
  });
});
