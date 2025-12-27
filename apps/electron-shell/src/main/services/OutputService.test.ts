import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutputService } from './OutputService';

describe('OutputService', () => {
  let service: OutputService;

  beforeEach(() => {
    // Reset singleton instance for tests
    // @ts-expect-error accessing private static field
    OutputService.instance = null;
    service = OutputService.getInstance();
  });

  it('creates and lists channels', () => {
    service.getOrCreateChannel('test-id', 'Test Channel');
    const response = service.listChannels();
    
    expect(response.channels).toHaveLength(1);
    expect(response.channels[0]).toMatchObject({
      id: 'test-id',
      name: 'Test Channel',
      lineCount: 0,
    });
  });

  it('appends lines and notifies listeners', () => {
    const appendSpy = vi.fn();
    service.onAppend(appendSpy);

    service.append({
      channelId: 'test-id',
      lines: ['line 1', 'line 2'],
      severity: 'info',
    });

    const channels = service.listChannels().channels;
    expect(channels[0].lineCount).toBe(2);

    expect(appendSpy).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'test-id',
      lines: expect.arrayContaining([
        expect.objectContaining({ content: 'line 1', lineNumber: 1 }),
        expect.objectContaining({ content: 'line 2', lineNumber: 2 }),
      ]),
    }));
  });

  it('reads lines with pagination', () => {
    service.append({
      channelId: 'test-id',
      lines: ['1', '2', '3', '4', '5'],
    });

    const response = service.read({
      channelId: 'test-id',
      startLine: 2,
      maxLines: 2,
    });

    expect(response.lines).toHaveLength(2);
    expect(response.lines[0].content).toBe('2');
    expect(response.lines[1].content).toBe('3');
    expect(response.hasMore).toBe(true);
    expect(response.totalLines).toBe(5);
  });

  it('clears channels and notifies listeners', () => {
    service.append({ channelId: 'test-id', lines: ['data'] });
    
    const clearSpy = vi.fn();
    service.onClear(clearSpy);

    service.clear({ channelId: 'test-id' });

    expect(service.listChannels().channels[0].lineCount).toBe(0);
    expect(service.read({ channelId: 'test-id', startLine: 1, maxLines: 10 }).lines).toHaveLength(0);
    expect(clearSpy).toHaveBeenCalledWith({ channelId: 'test-id' });
  });

  it('limits buffer size to MAX_LINES', () => {
    // For testing we can use a smaller limit if we could inject it, 
    // but we'll just test the default 10000 by appending a lot of lines if needed,
    // or we can trust the splice logic.
    // Let's assume MAX_LINES is 10000.
    
    const largeBatch = Array.from({ length: 10005 }, (_, i) => `line ${i}`);
    service.append({ channelId: 'test-id', lines: largeBatch });

    const response = service.read({ channelId: 'test-id', startLine: 1, maxLines: 20000 });
    expect(response.lines).toHaveLength(10000);
    expect(response.lines[0].content).toBe('line 5');
    expect(response.totalLines).toBe(10005);
  });
});
