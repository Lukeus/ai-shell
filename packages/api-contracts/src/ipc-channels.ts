/**
 * IPC channel name constants to prevent typos and ensure type safety.
 * These channels define the communication contract between main and renderer processes.
 */
export const IPC_CHANNELS = {
  GET_VERSION: 'app:get-version',
} as const;

/**
 * Union type of all valid IPC channel names.
 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
