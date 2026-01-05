import {
  OutputChannel,
  OutputLine,
  AppendOutputRequest,
  ClearOutputRequest,
  ReadOutputRequest,
  ReadOutputResponse,
  ListOutputChannelsResponse,
  OutputAppendEvent,
  OutputClearEvent,
} from 'packages-api-contracts';

/**
 * OutputService - Manages named output channels and their content.
 * 
 * P1 (Process isolation): Runs in main process; manages memory-backed output buffers.
 * P2 (Security Defaults): Channels are identified by string IDs.
 * P5 (Performance budgets): Limits buffer size per channel to 10,000 lines.
 */
export class OutputService {
  private static instance: OutputService | null = null;
  private channels = new Map<string, OutputChannel>();
  private buffers = new Map<string, OutputLine[]>();
  private onAppendListeners = new Set<(event: OutputAppendEvent) => void>();
  private onClearListeners = new Set<(event: OutputClearEvent) => void>();

  private readonly MAX_LINES = 10000;

  private constructor() {}

  public static getInstance(): OutputService {
    if (!OutputService.instance) {
      OutputService.instance = new OutputService();
    }
    return OutputService.instance;
  }

  /**
   * List all registered output channels.
   */
  public listChannels(): ListOutputChannelsResponse {
    return {
      channels: Array.from(this.channels.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /**
   * Create or get an existing channel.
   */
  public getOrCreateChannel(id: string, name: string): OutputChannel {
    let channel = this.channels.get(id);
    if (!channel) {
      channel = {
        id,
        name,
        lineCount: 0,
        createdAt: new Date().toISOString(),
      };
      this.channels.set(id, channel);
      this.buffers.set(id, []);
    }
    return channel;
  }

  /**
   * Append lines to a channel.
   */
  public append(request: AppendOutputRequest): void {
    const channel = this.getOrCreateChannel(request.channelId, request.channelId);
    const buffer = this.buffers.get(request.channelId) || [];
    
    const timestamp = new Date().toISOString();
    const newLines: OutputLine[] = request.lines.map((content, index) => ({
      lineNumber: channel.lineCount + index + 1,
      content,
      timestamp,
      severity: request.severity,
    }));

    buffer.push(...newLines);
    
    // Evict old lines if buffer exceeds limit
    if (buffer.length > this.MAX_LINES) {
      buffer.splice(0, buffer.length - this.MAX_LINES);
    }

    channel.lineCount += newLines.length;
    this.buffers.set(request.channelId, buffer);

    this.notifyAppend({
      channelId: request.channelId,
      lines: newLines,
    });
  }

  /**
   * Read lines from a channel with pagination.
   */
  public read(request: ReadOutputRequest): ReadOutputResponse {
    const channel = this.channels.get(request.channelId);
    if (!channel) {
      throw new Error(`Output channel not found: ${request.channelId}`);
    }

    const buffer = this.buffers.get(request.channelId) || [];
    
    // Convert 1-indexed startLine to 0-indexed offset in the current buffer
    // Note: buffer only holds the last MAX_LINES.
    const firstLineInBuf = buffer.length > 0 ? buffer[0].lineNumber : 1;
    const offset = Math.max(0, request.startLine - firstLineInBuf);
    
    const lines = buffer.slice(offset, offset + request.maxLines);
    const hasMore = offset + request.maxLines < buffer.length;

    return {
      channel,
      lines,
      totalLines: channel.lineCount,
      hasMore,
    };
  }

  /**
   * Clear all lines in a channel.
   */
  public clear(request: ClearOutputRequest): void {
    const channel = this.channels.get(request.channelId);
    if (channel) {
      channel.lineCount = 0;
      this.buffers.set(request.channelId, []);
      this.notifyClear({ channelId: request.channelId });
    }
  }

  /**
   * Subscribe to append events.
   */
  public onAppend(listener: (event: OutputAppendEvent) => void): () => void {
    this.onAppendListeners.add(listener);
    return () => this.onAppendListeners.delete(listener);
  }

  /**
   * Subscribe to clear events.
   */
  public onClear(listener: (event: OutputClearEvent) => void): () => void {
    this.onClearListeners.add(listener);
    return () => this.onClearListeners.delete(listener);
  }

  private notifyAppend(event: OutputAppendEvent): void {
    for (const listener of this.onAppendListeners) {
      listener(event);
    }
  }

  private notifyClear(event: OutputClearEvent): void {
    for (const listener of this.onClearListeners) {
      listener(event);
    }
  }
}

export const outputService = OutputService.getInstance();
