/**
 * JSON-RPC 2.0 Client for Extension Host
 * 
 * Handles bidirectional JSON-RPC communication over stdin/stdout.
 * Transport: newline-delimited JSON messages.
 * 
 * P1 (Process Isolation): All communication with main process goes through this client.
 * NO direct IPC, filesystem, or network access.
 */

import { createInterface } from 'readline';

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

type RequestHandler = (params: unknown) => Promise<unknown> | unknown;
type NotificationHandler = (params: unknown) => void;

/**
 * JSON-RPC 2.0 client for communication with main process.
 * Uses stdin for receiving messages and stdout for sending messages.
 */
export class JSONRPCClient {
  private requestHandlers = new Map<string, RequestHandler>();
  private notificationHandlers = new Map<string, NotificationHandler>();
  private pendingRequests = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private nextRequestId = 1;
  private readline: ReturnType<typeof createInterface>;
  private closed = false;

  constructor() {
    // Set up readline to read newline-delimited JSON from stdin
    this.readline = createInterface({
      input: process.stdin,
      output: undefined, // Don't echo to stdout
      terminal: false,
    });

    // Process each line as a JSON-RPC message
    this.readline.on('line', (line) => {
      this.handleMessage(line);
    });

    // Handle stdin close
    this.readline.on('close', () => {
      console.error('[JSON-RPC] stdin closed');
      this.close();
    });
  }

  /**
   * Registers a handler for a JSON-RPC method (request/response pattern).
   */
  public onRequest(method: string, handler: RequestHandler): void {
    this.requestHandlers.set(method, handler);
  }

  /**
   * Registers a handler for a JSON-RPC notification (no response expected).
   */
  public onNotification(method: string, handler: NotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  /**
   * Sends a request to main process and waits for response.
   * @param method - RPC method name
   * @param params - Method parameters
   * @param timeoutMs - Timeout in milliseconds (default 30000)
   * @returns Promise resolving to the result
   */
  public async sendRequest(method: string, params?: unknown, timeoutMs = 30000): Promise<unknown> {
    if (this.closed) {
      throw new Error('JSON-RPC client is closed');
    }

    const id = this.nextRequestId++;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      this.send(request);
    });
  }

  /**
   * Sends a notification to main process (no response expected).
   */
  public sendNotification(method: string, params?: unknown): void {
    if (this.closed) {
      return;
    }

    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.send(notification);
  }

  /**
   * Sends a JSON-RPC message via stdout.
   */
  private send(message: JSONRPCMessage): void {
    const json = JSON.stringify(message);
    // Write to stdout with newline delimiter
    process.stdout.write(json + '\n');
  }

  /**
   * Handles an incoming JSON-RPC message from stdin.
   */
  private async handleMessage(line: string): Promise<void> {
    try {
      const message = JSON.parse(line) as JSONRPCMessage;

      // Validate JSON-RPC 2.0 format
      if (message.jsonrpc !== '2.0') {
        console.error('[JSON-RPC] Invalid message: missing jsonrpc 2.0');
        return;
      }

      // Check if it's a response to our request
      if ('id' in message && 'result' in message || 'error' in message) {
        this.handleResponse(message as JSONRPCResponse);
        return;
      }

      // Check if it's a request from main
      if ('method' in message) {
        if ('id' in message && message.id !== undefined) {
          await this.handleRequest(message as JSONRPCRequest);
        } else {
          this.handleNotification(message as JSONRPCNotification);
        }
      }
    } catch (error) {
      console.error('[JSON-RPC] Failed to parse message:', error);
    }
  }

  /**
   * Handles a JSON-RPC response from main process.
   */
  private handleResponse(response: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.error('[JSON-RPC] Received response for unknown request:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(pending.timeout);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Handles a JSON-RPC request from main process.
   */
  private async handleRequest(request: JSONRPCRequest): Promise<void> {
    const handler = this.requestHandlers.get(request.method);
    
    if (!handler) {
      // Send error response
      this.send({
        jsonrpc: '2.0',
        id: request.id as string | number,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      });
      return;
    }

    try {
      const result = await handler(request.params);
      // Send success response
      this.send({
        jsonrpc: '2.0',
        id: request.id as string | number,
        result,
      });
    } catch (error) {
      // Send error response
      this.send({
        jsonrpc: '2.0',
        id: request.id as string | number,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Handles a JSON-RPC notification from main process.
   */
  private handleNotification(notification: JSONRPCNotification): void {
    const handler = this.notificationHandlers.get(notification.method);
    
    if (!handler) {
      console.error('[JSON-RPC] No handler for notification:', notification.method);
      return;
    }

    try {
      handler(notification.params);
    } catch (error) {
      console.error('[JSON-RPC] Error handling notification:', error);
    }
  }

  /**
   * Closes the JSON-RPC client and cleans up resources.
   */
  public close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('JSON-RPC client closed'));
    }
    this.pendingRequests.clear();

    // Close readline interface
    this.readline.close();
  }
}
