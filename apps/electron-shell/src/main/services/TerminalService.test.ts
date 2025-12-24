import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { TerminalService } from './TerminalService';
import { CreateTerminalRequest, SETTINGS_DEFAULTS } from 'packages-api-contracts';

const ptyMocks = vi.hoisted(() => {
  const mockPtyProcess = {
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
  const mockSpawn = vi.fn(() => mockPtyProcess);
  return { mockPtyProcess, mockSpawn };
});

// Mock node-pty module
vi.mock('node-pty', () => ({
  spawn: ptyMocks.mockSpawn,
}));

vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: ptyMocks.mockSpawn,
}));

vi.mock('fs', () => ({
  realpathSync: vi.fn((value: string) => value),
}));

vi.mock('./SettingsService', () => ({
  settingsService: {
    getSettings: vi.fn(() => SETTINGS_DEFAULTS),
  },
}));

describe('TerminalService', () => {
  const { mockSpawn, mockPtyProcess } = ptyMocks;
  const requireForMocks = createRequire(import.meta.url);
  const registerPtyMocks = () => {
    const mockModule = { spawn: mockSpawn };
    try {
      const moduleId = requireForMocks.resolve('node-pty');
      requireForMocks.cache[moduleId] = {
        exports: mockModule,
      } as NodeModule;
    } catch {
      // Module not available in this environment.
    }
    try {
      const moduleId = requireForMocks.resolve('@homebridge/node-pty-prebuilt-multiarch');
      requireForMocks.cache[moduleId] = {
        exports: mockModule,
      } as NodeModule;
    } catch {
      // Module not available in this environment.
    }
  };
  let terminalService: TerminalService;
  const mockWorkspaceRoot = 'C:\\mock\\workspace';
  const mockCwd = 'C:\\mock\\workspace\\project';

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    registerPtyMocks();

    // Reset the singleton instance using reflection
    // @ts-expect-error Accessing private static field for testing
    TerminalService.instance = null;

    // Get fresh instance
    terminalService = TerminalService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance()', () => {
    it('should return singleton instance', () => {
      // Act
      const first = TerminalService.getInstance();
      const second = TerminalService.getInstance();

      // Assert
      expect(first).toBe(second);
    });
  });

  describe('createSession()', () => {
    it('should create terminal session with valid cwd within workspace', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };

      // Act
      const session = terminalService.createSession(request, mockWorkspaceRoot);

      // Assert
      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.title).toMatch(/^Terminal \d+$/);
      expect(session.cwd).toBe(mockCwd);
      expect(session.status).toBe('running');
      expect(session.createdAt).toBeDefined();
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.objectContaining({
          cwd: mockCwd,
          cols: 80,
          rows: 24,
        })
      );
    });

    it('should throw error if cwd is outside workspace', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: 'C:\\outside\\workspace',
        cols: 80,
        rows: 24,
      };

      // Act & Assert
      expect(() => {
        terminalService.createSession(request, mockWorkspaceRoot);
      }).toThrow('Terminal cwd must be within workspace');
    });

    it('should throw error if no workspace is open', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };

      // Act & Assert
      expect(() => {
        terminalService.createSession(request, null);
      }).toThrow('Cannot create terminal: no workspace open');
    });

    it('should throw error if max sessions limit exceeded', () => {
      // Arrange - create 10 sessions
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };

      for (let i = 0; i < 10; i++) {
        terminalService.createSession(request, mockWorkspaceRoot);
      }

      // Act & Assert - 11th session should fail
      expect(() => {
        terminalService.createSession(request, mockWorkspaceRoot);
      }).toThrow('Maximum number of terminal sessions (10) exceeded');
    });

    it('should use default shell if not specified', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };

      // Act
      terminalService.createSession(request, mockWorkspaceRoot);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String), // Should be default shell
        [],
        expect.any(Object)
      );
    });

    it('should use custom shell if specified', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        shell: 'C:\\custom\\shell.exe',
        cols: 80,
        rows: 24,
      };

      // Act
      terminalService.createSession(request, mockWorkspaceRoot);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith(
        'C:\\custom\\shell.exe',
        [],
        expect.any(Object)
      );
    });

    it('should sanitize environment variables', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        env: {
          CUSTOM_VAR: 'value',
        },
        cols: 80,
        rows: 24,
      };

      // Act
      terminalService.createSession(request, mockWorkspaceRoot);

      // Assert
      const spawnCall = mockSpawn.mock.calls[0];
      const options = spawnCall[2];
      expect(options.env).toBeDefined();
      expect(options.env?.CUSTOM_VAR).toBe('value');
    });

    it('should wire up PTY data events', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };

      const dataHandler = vi.fn();
      terminalService.on('data', dataHandler);

      // Act
      const session = terminalService.createSession(request, mockWorkspaceRoot);

      // Simulate PTY data event
      const onDataCallback = mockPtyProcess.onData.mock.calls[0][0];
      onDataCallback('test data');

      // Assert
      expect(dataHandler).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        data: 'test data',
      });
    });

    it('should wire up PTY exit events', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };

      const exitHandler = vi.fn();
      terminalService.on('exit', exitHandler);

      // Act
      const session = terminalService.createSession(request, mockWorkspaceRoot);

      // Simulate PTY exit event
      const onExitCallback = mockPtyProcess.onExit.mock.calls[0][0];
      onExitCallback({ exitCode: 0 });

      // Assert
      expect(exitHandler).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        exitCode: 0,
      });
    });
  });

  describe('write()', () => {
    it('should write data to PTY session', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };
      const session = terminalService.createSession(request, mockWorkspaceRoot);

      // Act
      terminalService.write(session.sessionId, 'echo test\n');

      // Assert
      expect(mockPtyProcess.write).toHaveBeenCalledWith('echo test\n');
    });

    it('should throw error if session not found', () => {
      // Act & Assert
      expect(() => {
        terminalService.write('invalid-session-id', 'test');
      }).toThrow('Terminal session not found');
    });
  });

  describe('resize()', () => {
    it('should resize PTY session', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };
      const session = terminalService.createSession(request, mockWorkspaceRoot);

      // Act
      terminalService.resize(session.sessionId, 100, 30);

      // Assert
      expect(mockPtyProcess.resize).toHaveBeenCalledWith(100, 30);
    });

    it('should throw error if session not found', () => {
      // Act & Assert
      expect(() => {
        terminalService.resize('invalid-session-id', 100, 30);
      }).toThrow('Terminal session not found');
    });
  });

  describe('close()', () => {
    it('should close PTY session and remove from sessions map', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };
      const session = terminalService.createSession(request, mockWorkspaceRoot);

      // Act
      terminalService.close(session.sessionId);

      // Assert
      expect(mockPtyProcess.kill).toHaveBeenCalled();
      
      // Verify session removed
      expect(() => {
        terminalService.write(session.sessionId, 'test');
      }).toThrow('Terminal session not found');
    });

    it('should throw error if session not found', () => {
      // Act & Assert
      expect(() => {
        terminalService.close('invalid-session-id');
      }).toThrow('Terminal session not found');
    });
  });

  describe('listSessions()', () => {
    it('should return empty array when no sessions exist', () => {
      // Act
      const sessions = terminalService.listSessions();

      // Assert
      expect(sessions).toEqual([]);
    });

    it('should return array of session metadata', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };
      const session1 = terminalService.createSession(request, mockWorkspaceRoot);
      const session2 = terminalService.createSession(request, mockWorkspaceRoot);

      // Act
      const sessions = terminalService.listSessions();

      // Assert
      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe(session1.sessionId);
      expect(sessions[1].sessionId).toBe(session2.sessionId);
    });
  });

  describe('cleanup()', () => {
    it('should close all active sessions', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };
      terminalService.createSession(request, mockWorkspaceRoot);
      terminalService.createSession(request, mockWorkspaceRoot);

      // Act
      terminalService.cleanup();

      // Assert
      expect(mockPtyProcess.kill).toHaveBeenCalledTimes(2);
      expect(terminalService.listSessions()).toEqual([]);
    });

    it('should not throw if session close fails during cleanup', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };
      terminalService.createSession(request, mockWorkspaceRoot);

      // Mock kill to throw error
      mockPtyProcess.kill.mockImplementation(() => {
        throw new Error('Kill failed');
      });

      // Act & Assert - should not throw
      expect(() => {
        terminalService.cleanup();
      }).not.toThrow();
    });
  });

  describe('Security Validations', () => {
    it('should reject path traversal attempts', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: 'C:\\mock\\workspace\\..\\..\\outside',
        cols: 80,
        rows: 24,
      };

      // Act & Assert
      expect(() => {
        terminalService.createSession(request, mockWorkspaceRoot);
      }).toThrow('Terminal cwd must be within workspace');
    });

    it('should reject workspace prefix paths outside root', () => {
      const request: CreateTerminalRequest = {
        cwd: 'C:\\mock\\workspace2',
        cols: 80,
        rows: 24,
      };

      expect(() => {
        terminalService.createSession(request, mockWorkspaceRoot);
      }).toThrow('Terminal cwd must be within workspace');
    });

    it('should generate UUID session IDs', () => {
      // Arrange
      const request: CreateTerminalRequest = {
        cwd: mockCwd,
        cols: 80,
        rows: 24,
      };

      // Act
      const session = terminalService.createSession(request, mockWorkspaceRoot);

      // Assert - UUID v4 format
      expect(session.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });
});
