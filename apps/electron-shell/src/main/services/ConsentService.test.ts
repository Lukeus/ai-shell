import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsentService } from './ConsentService';
import * as fs from 'fs';
const mockUserDataPath = vi.hoisted(() => 'C:\\mock\\userdata');

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockUserDataPath),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('ConsentService', () => {
  let service: ConsentService;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error Reset singleton for tests
    ConsentService.instance = null;
    service = ConsentService.getInstance();
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('records and retrieves decisions', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    service.recordDecision('conn-1', 'ext-1', 'allow-always');

    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );

    expect(service.getDecision('conn-1', 'ext-1')).toBe('allow-always');
  });

  it('consumes allow-once decisions', () => {
    service.recordDecision('conn-1', 'ext-1', 'allow-once');
    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );

    expect(service.evaluateAccess('conn-1', 'ext-1')).toBe(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[1][1] as string)
    );
    expect(service.getDecision('conn-1', 'ext-1')).toBeNull();
  });

  it('returns deny decisions as false', () => {
    service.recordDecision('conn-1', 'ext-1', 'deny');
    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );

    expect(service.evaluateAccess('conn-1', 'ext-1')).toBe(false);
  });

  it('returns null when no decision exists', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: 1, decisions: {} })
    );
    expect(service.evaluateAccess('conn-1', 'ext-1')).toBeNull();
  });

  it('clears stored decisions', () => {
    service.recordDecision('conn-1', 'ext-1', 'allow-always');
    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
    );

    service.clearDecision('conn-1', 'ext-1');
    vi.mocked(fs.readFileSync).mockReturnValue(
      (vi.mocked(fs.writeFileSync).mock.calls[1][1] as string)
    );
    expect(service.getDecision('conn-1', 'ext-1')).toBeNull();
  });

  it('stores consent decisions without secrets', () => {
    service.recordDecision('conn-1', 'ext-1', 'allow-always');
    const stored = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(stored).not.toContain('secretValue');
  });
});
