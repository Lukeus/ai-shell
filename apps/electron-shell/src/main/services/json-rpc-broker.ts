/**
 * JSON-RPC Broker for Main Process
 * 
 * Handles bidirectional JSON-RPC 2.0 communication with Extension Host over stdio.
 * Similar to Extension Host's JSONRPCClient but designed for main process.
 * 
 * P1 (Process Isolation): All communication with Extension Host goes through this broker.
 */

import { createInterface, type Interface } from 'readline';
import type { Writable, Readable } from 'stream';

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
 * JSON-RPC 2.0 broker for main process to Extension Host communication.
 */
export class JSONRPCBroker {
  private requestHandlers = new Map<string, RequestHandler>();
  private notificationHandlers = new Map<string, NotificationHandler>();
  private pendingRequests = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private nextRequestId = 1;
  private readline: Interface;
  private output: Writable;
  private closed = false;

  constructor(output: Writable, input: Readable) {
    this.output = output;
    
    // Set up readline to read newline-delimited JSON from input stream
    this.readline = createInterface({
      input,
      output: undefined, // Don't echo
      terminal: false,
    });

    // Process each line as a JSON-RPC message
    this.readline.on('line', (line) => {
      this.handleMessage(line);
    });

    // Handle stream close
    this.readline.on('close', () => {
      console.error('[JSON-RPC Broker] Input stream closed');
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
   * Sends a request to Extension Host and waits for response.
   */
  public async sendRequest(method: string, params?: unknown, timeoutMs = 30000): Promise<unknown> {
    if (this.closed) {
      throw new Error('JSON-RPC broker is closed');
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
   * Sends a notification to Extension Host (no response expected).
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
   * Sends a JSON-RPC message via output stream.
   */
  private send(message: JSONRPCMessage): void {
    const json = JSON.stringify(message);
    // Write with newline delimiter
    this.output.write(json + '\n');
  }

  /**
   * Handles an incoming JSON-RPC message from Extension Host.
   */
  private async handleMessage(line: string): Promise<void> {
    try {
      const message = JSON.parse(line) as JSONRPCMessage;

      // Validate JSON-RPC 2.0 format
      if (message.jsonrpc !== '2.0') {
        console.error('[JSON-RPC Broker] Invalid message: missing jsonrpc 2.0');
        return;
      }

      // Check if it's a response to our request
      if ('id' in message && ('result' in message || 'error' in message)) {
        this.handleResponse(message as JSONRPCResponse);
        return;
      }

      // Check if it's a request from Extension Host
      if ('method' in message) {
        if ('id' in message && message.id !== undefined) {
          await this.handleRequest(message as JSONRPCRequest);
        } else {
          this.handleNotification(message as JSONRPCNotification);
        }
      }
    } catch (error) {
      console.error('[JSON-RPC Broker] Failed to parse message:', error);
    }
  }

  /**
   * Handles a JSON-RPC response from Extension Host.
   */
  private handleResponse(response: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.error('[JSON-RPC Broker] Received response for unknown request:', response.id);
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
   * Handles a JSON-RPC request from Extension Host.
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
   * Handles a JSON-RPC notification from Extension Host.
   */
  private handleNotification(notification: JSONRPCNotification): void {
    const handler = this.notificationHandlers.get(notification.method);
    
    if (!handler) {
      console.error('[JSON-RPC Broker] No handler for notification:', notification.method);
      return;
    }

    try {
      handler(notification.params);
    } catch (error) {
      console.error('[JSON-RPC Broker] Error handling notification:', error);
    }
  }

  /**
   * Closes the JSON-RPC broker and cleans up resources.
   */
  public close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('JSON-RPC broker closed'));
    }
    this.pendingRequests.clear();

    // Close readline interface
    this.readline.close();
  }
}
