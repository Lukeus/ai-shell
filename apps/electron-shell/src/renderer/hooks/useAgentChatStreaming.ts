import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentEvent, AgentMessage } from 'packages-api-contracts';
const STREAM_FLUSH_DELAY_MS = 40;
export type AgentStreamingMessage = {
  conversationId: string;
  messageId: string;
  format: AgentMessage['format'];
  content: string;
  startedAt: string;
};

export type AgentStreamingStatus = {
  conversationId: string;
  phase: string;
  label: string;
  startedAt: string;
};

type StreamBuffer = {
  conversationId: string;
  messageId: string;
  format: AgentMessage['format'];
  startedAt: string;
  chunks: string[];
};
type UseAgentChatStreamingOptions = {
  selectedConversationId: string | null;
  onMessageComplete: (message: AgentMessage, conversationId: string, updatedAt: string) => void;
  onMessageEvent: (
    event: Extract<AgentEvent, { type: 'message' }> & { conversationId: string }
  ) => void;
};

type UseAgentChatStreamingResult = {
  streamingMessage: AgentStreamingMessage | null;
  streamingStatus: AgentStreamingStatus | null;
  startStreaming: (conversationId: string) => void;
  clearStreaming: () => void;
  handleStreamingEvent: (event: AgentEvent, activeChatRunId: string | null) => void;
};

const resolveConversationId = (
  eventConversationId: string | undefined,
  selectedConversationId: string | null,
  buffer: StreamBuffer | null
) => eventConversationId ?? buffer?.conversationId ?? selectedConversationId ?? null;

export function useAgentChatStreaming({
  selectedConversationId,
  onMessageComplete,
  onMessageEvent,
}: UseAgentChatStreamingOptions): UseAgentChatStreamingResult {
  const [streamingMessage, setStreamingMessage] = useState<AgentStreamingMessage | null>(
    null
  );
  const [streamingStatus, setStreamingStatus] = useState<AgentStreamingStatus | null>(
    null
  );
  const streamBufferRef = useRef<StreamBuffer | null>(null);
  const streamFlushTimerRef = useRef<number | null>(null);

  const clearStreaming = useCallback(() => {
    streamBufferRef.current = null;
    if (streamFlushTimerRef.current !== null) {
      window.clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    setStreamingMessage(null);
    setStreamingStatus(null);
  }, []);

  const flushStream = useCallback(() => {
    streamFlushTimerRef.current = null;
    const buffer = streamBufferRef.current;
    if (!buffer) {
      return;
    }
    setStreamingMessage({
      conversationId: buffer.conversationId,
      messageId: buffer.messageId,
      format: buffer.format,
      content: buffer.chunks.join(''),
      startedAt: buffer.startedAt,
    });
  }, []);

  const scheduleStreamFlush = useCallback(() => {
    if (streamFlushTimerRef.current !== null) {
      return;
    }
    streamFlushTimerRef.current = window.setTimeout(flushStream, STREAM_FLUSH_DELAY_MS);
  }, [flushStream]);

  useEffect(() => {
    return () => {
      if (streamFlushTimerRef.current !== null) {
        window.clearTimeout(streamFlushTimerRef.current);
      }
    };
  }, []);

  const startStreaming = useCallback(
    (conversationId: string) => {
      clearStreaming();
      setStreamingStatus({
        conversationId,
        phase: 'thinking',
        label: 'Waiting for response',
        startedAt: new Date().toISOString(),
      });
    },
    [clearStreaming]
  );

  const handleStreamingEvent = useCallback(
    (event: AgentEvent, activeChatRunId: string | null) => {
      if (!activeChatRunId || event.runId !== activeChatRunId) {
        return;
      }

      if (event.type === 'status-update') {
        const conversationId = resolveConversationId(
          event.conversationId,
          selectedConversationId,
          streamBufferRef.current
        );
        if (conversationId) {
          setStreamingStatus((prev) => ({
            conversationId,
            phase: event.phase,
            label: event.label,
            startedAt: prev?.startedAt ?? event.timestamp,
          }));
        }
      }

      if (event.type === 'message-delta') {
        const conversationId = resolveConversationId(
          event.conversationId,
          selectedConversationId,
          streamBufferRef.current
        );
        if (!conversationId) {
          return;
        }
        const messageId = event.messageId ?? event.id;
        if (!streamBufferRef.current || streamBufferRef.current.messageId !== messageId) {
          streamBufferRef.current = {
            conversationId,
            messageId,
            format: event.format,
            startedAt: event.timestamp,
            chunks: [],
          };
        }
        const buffer = streamBufferRef.current;
        if (!buffer.chunks[event.sequence]) {
          buffer.chunks[event.sequence] = event.contentDelta;
        }
        buffer.format = event.format;
        scheduleStreamFlush();
      }

      if (event.type === 'message-complete') {
        const conversationId = resolveConversationId(
          event.conversationId,
          selectedConversationId,
          streamBufferRef.current
        );
        if (!conversationId) {
          return;
        }
        const message: AgentMessage = {
          id: event.messageId ?? event.id,
          conversationId,
          role: 'agent',
          format: event.format ?? 'text',
          content: event.content,
          createdAt: event.timestamp,
        };
        onMessageComplete(message, conversationId, event.timestamp);
        clearStreaming();
      }

      if (event.type === 'message') {
        const conversationId = resolveConversationId(
          event.conversationId,
          selectedConversationId,
          streamBufferRef.current
        );
        if (!conversationId) {
          return;
        }
        const messageEvent = event as Extract<AgentEvent, { type: 'message' }> & {
          conversationId: string;
        };
        onMessageEvent({ ...messageEvent, conversationId });
        clearStreaming();
      }
    },
    [
      clearStreaming,
      onMessageComplete,
      onMessageEvent,
      scheduleStreamFlush,
      selectedConversationId,
    ]
  );

  return {
    streamingMessage,
    streamingStatus,
    startStreaming,
    clearStreaming,
    handleStreamingEvent,
  };
}
