/**
 * IPC channel name constants to prevent typos and ensure type safety.
 * These channels define the communication contract between main and renderer processes.
 */
export const IPC_CHANNELS = {
  GET_VERSION: 'app:get-version',
  
  // Settings management
  /** Retrieve all application settings */
  GET_SETTINGS: 'settings:get',
  
  /** Update application settings (partial merge) */
  UPDATE_SETTINGS: 'settings:update',
  
  /** Reset all settings to defaults */
  RESET_SETTINGS: 'settings:reset',
  
  // Workspace management
  /** Open native folder picker and set workspace */
  WORKSPACE_OPEN: 'workspace:open',
  
  /** Get current workspace (null if no folder open) */
  WORKSPACE_GET_CURRENT: 'workspace:get-current',
  
  /** Close current workspace */
  WORKSPACE_CLOSE: 'workspace:close',

  // Menu events (main -> renderer)
  /** Menu: open workspace */
  MENU_WORKSPACE_OPEN: 'menu:workspace-open',

  /** Menu: close workspace */
  MENU_WORKSPACE_CLOSE: 'menu:workspace-close',

  /** Menu: refresh explorer */
  MENU_REFRESH_EXPLORER: 'menu:refresh-explorer',

  /** Menu: toggle secondary sidebar */
  MENU_TOGGLE_SECONDARY_SIDEBAR: 'menu:toggle-secondary-sidebar',

  // Window controls
  /** Window: minimize */
  WINDOW_MINIMIZE: 'window:minimize',

  /** Window: toggle maximize/restore */
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',

  /** Window: close */
  WINDOW_CLOSE: 'window:close',

  /** Window: get state */
  WINDOW_GET_STATE: 'window:get-state',

  /** Window: state changed (main -> renderer) */
  WINDOW_STATE_CHANGED: 'window:state-changed',
  
  // File system broker (workspace-scoped)
  /** Read directory contents */
  FS_READ_DIRECTORY: 'fs:read-directory',
  
  /** Read file contents */
  FS_READ_FILE: 'fs:read-file',

  /** Write file contents */
  FS_WRITE_FILE: 'fs:write-file',
  
  /** Create new file */
  FS_CREATE_FILE: 'fs:create-file',
  
  /** Create new directory */
  FS_CREATE_DIRECTORY: 'fs:create-directory',
  
  /** Rename file or directory */
  FS_RENAME: 'fs:rename',
  
  /** Delete file or directory (moves to OS trash) */
  FS_DELETE: 'fs:delete',
  
  // Terminal management (PTY)
  /** Create a new terminal session */
  TERMINAL_CREATE: 'terminal:create',
  
  /** Write data to terminal session */
  TERMINAL_WRITE: 'terminal:write',
  
  /** Resize terminal session */
  TERMINAL_RESIZE: 'terminal:resize',
  
  /** Close terminal session */
  TERMINAL_CLOSE: 'terminal:close',
  
  /** List all active terminal sessions */
  TERMINAL_LIST: 'terminal:list',
  
  /** Terminal data event (main → renderer) */
  TERMINAL_DATA: 'terminal:data',
  
  /** Terminal exit event (main → renderer) */
  TERMINAL_EXIT: 'terminal:exit',
  
  // Output channels
  /** Append lines to output channel */
  OUTPUT_APPEND: 'output:append',
  
  /** Clear output channel */
  OUTPUT_CLEAR: 'output:clear',
  
  /** List all output channels */
  OUTPUT_LIST_CHANNELS: 'output:list-channels',
  
  /** Read lines from output channel */
  OUTPUT_READ: 'output:read',
  
  /** Output append event (main → renderer) */
  OUTPUT_ON_APPEND: 'output:on-append',
  
  /** Output clear event (main → renderer) */
  OUTPUT_ON_CLEAR: 'output:on-clear',
  
  // Diagnostics (problems panel)
  /** Publish diagnostics for a file */
  DIAGNOSTICS_PUBLISH: 'diagnostics:publish',
  
  /** Clear diagnostics */
  DIAGNOSTICS_CLEAR: 'diagnostics:clear',
  
  /** List all diagnostics */
  DIAGNOSTICS_LIST: 'diagnostics:list',
  
  /** Diagnostics update event (main → renderer) */
  DIAGNOSTICS_ON_UPDATE: 'diagnostics:on-update',
  
  /** Diagnostics summary event (main → renderer) */
  DIAGNOSTICS_ON_SUMMARY: 'diagnostics:on-summary',
  // Search (workspace)
  /** Execute workspace search */
  SEARCH_QUERY: 'search:query',

  /** Execute replace operation */
  SEARCH_REPLACE: 'search:replace',

  // Source control (git)
  /** Get SCM status */
  SCM_STATUS: 'scm:status',

  /** Stage changes */
  SCM_STAGE: 'scm:stage',

  /** Unstage changes */
  SCM_UNSTAGE: 'scm:unstage',

  /** Commit staged changes */
  SCM_COMMIT: 'scm:commit',

  // SDD traceability + parity
  /** List available SDD features */
  SDD_LIST_FEATURES: 'sdd:list-features',

  /** Get current SDD status */
  SDD_STATUS: 'sdd:status',

  /** Start an SDD run */
  SDD_START_RUN: 'sdd:start-run',

  /** Stop the active SDD run */
  SDD_STOP_RUN: 'sdd:stop-run',

  /** Set active task without starting a run */
  SDD_SET_ACTIVE_TASK: 'sdd:set-active-task',

  /** Get file trace for a path */
  SDD_GET_FILE_TRACE: 'sdd:get-file-trace',

  /** Get task trace for a feature/task */
  SDD_GET_TASK_TRACE: 'sdd:get-task-trace',

  /** Get parity summary */
  SDD_GET_PARITY: 'sdd:get-parity',

  /** Override untracked changes for commit enforcement */
  SDD_OVERRIDE_UNTRACKED: 'sdd:override-untracked',

  /** SDD status changed event (main -> renderer) */
  SDD_CHANGED: 'sdd:changed',

  // Agent runs + events
  /** List agent runs */
  AGENT_RUNS_LIST: 'agent:runs:list',

  /** Get agent run details */
  AGENT_RUNS_GET: 'agent:runs:get',

  /** Start a new agent run */
  AGENT_RUNS_START: 'agent:runs:start',

  /** Cancel an agent run */
  AGENT_RUNS_CANCEL: 'agent:runs:cancel',

  /** Retry an agent run */
  AGENT_RUNS_RETRY: 'agent:runs:retry',

  /** Subscribe to agent events */
  AGENT_EVENTS_SUBSCRIBE: 'agent:events:subscribe',

  /** Unsubscribe from agent events */
  AGENT_EVENTS_UNSUBSCRIBE: 'agent:events:unsubscribe',

  /** Agent event stream (main -> renderer) */
  AGENT_EVENTS_ON_EVENT: 'agent:events:on-event',

  /** List agent trace events */
  AGENT_TRACE_LIST: 'agent:trace:list',

  // Connections + Secrets
  /** List connections */
  CONNECTIONS_LIST: 'connections:list',
  
  /** Create connection metadata */
  CONNECTIONS_CREATE: 'connections:create',
  
  /** Update connection metadata */
  CONNECTIONS_UPDATE: 'connections:update',
  
  /** Delete connection metadata */
  CONNECTIONS_DELETE: 'connections:delete',
  
  /** Set secret for a connection */
  CONNECTIONS_SET_SECRET: 'connections:set-secret',
  
  /** Replace secret for a connection */
  CONNECTIONS_REPLACE_SECRET: 'connections:replace-secret',
  
  /** Request access to a secret */
  CONNECTIONS_REQUEST_SECRET_ACCESS: 'connections:request-secret-access',
  
  /** List audit events */
  CONNECTIONS_AUDIT_LIST: 'connections:audit:list',

  // Extensions management (renderer/main)
  /** List all installed extensions */
  EXTENSIONS_LIST: 'extensions:list',
  
  /** Get a specific extension by ID */
  EXTENSIONS_GET: 'extensions:get',
  
  /** Install an extension */
  EXTENSIONS_INSTALL: 'extensions:install',
  
  /** Uninstall an extension */
  EXTENSIONS_UNINSTALL: 'extensions:uninstall',
  
  /** Enable an extension */
  EXTENSIONS_ENABLE: 'extensions:enable',
  
  /** Disable an extension */
  EXTENSIONS_DISABLE: 'extensions:disable',
  
  // Extension state events (main → renderer)
  /** Extension state change event */
  EXTENSIONS_ON_STATE_CHANGE: 'extensions:on-state-change',
  
  // Extension commands (renderer → main → ext host)
  /** Execute an extension command */
  EXTENSIONS_EXECUTE_COMMAND: 'extensions:execute-command',
  
  /** List all available extension commands */
  EXTENSIONS_LIST_COMMANDS: 'extensions:list-commands',
  
  // Extension views (renderer → main)
  /** List all extension views */
  EXTENSIONS_LIST_VIEWS: 'extensions:list-views',
  
  /** Render extension view content */
  EXTENSIONS_RENDER_VIEW: 'extensions:render-view',
  
  // Extension permissions (renderer/main)
  /** Request a permission for an extension */
  EXTENSIONS_REQUEST_PERMISSION: 'extensions:request-permission',
  
  /** List permissions for an extension */
  EXTENSIONS_LIST_PERMISSIONS: 'extensions:list-permissions',
  
  /** Revoke a permission for an extension */
  EXTENSIONS_REVOKE_PERMISSION: 'extensions:revoke-permission',
} as const;

/**
 * Union type of all valid IPC channel names.
 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

