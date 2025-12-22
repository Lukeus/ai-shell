import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScmFileStatus } from 'packages-api-contracts';
import { Input } from 'packages-ui-kit';
import { useFileTree } from '../explorer/FileTreeContext';

type StatusGroup = {
  id: 'staged' | 'unstaged' | 'untracked';
  title: string;
  items: ScmFileStatus[];
};

const SCM_STATUS_EVENT = 'ai-shell:scm-status';

export function SourceControlPanel() {
  const { workspace, openFile } = useFileTree();
  const [status, setStatus] = useState({
    branch: null as string | null,
    staged: [] as ScmFileStatus[],
    unstaged: [] as ScmFileStatus[],
    untracked: [] as ScmFileStatus[],
  });
  const [commitMessage, setCommitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const groups = useMemo<StatusGroup[]>(() => ([
    { id: 'staged', title: 'Staged Changes', items: status.staged },
    { id: 'unstaged', title: 'Changes', items: status.unstaged },
    { id: 'untracked', title: 'Untracked', items: status.untracked },
  ]), [status]);

  const formatPath = useCallback((filePath: string) => {
    if (!workspace) {
      return filePath;
    }
    const normalizedFile = filePath.replace(/\\/g, '/');
    const normalizedRoot = workspace.path.replace(/\\/g, '/');
    if (normalizedFile.startsWith(normalizedRoot)) {
      const relative = normalizedFile.slice(normalizedRoot.length).replace(/^\/+/, '');
      return relative || normalizedFile;
    }
    return filePath;
  }, [workspace]);

  const refreshStatus = useCallback(async () => {
    setError(null);
    setInfo(null);

    if (!workspace) {
      setStatus({ branch: null, staged: [], unstaged: [], untracked: [] });
      return;
    }

    try {
      setIsLoading(true);
      const response = await window.api.scm.status({});
      setStatus(response);
      window.dispatchEvent(new CustomEvent(SCM_STATUS_EVENT, { detail: response }));
      if (
        response.staged.length === 0 &&
        response.unstaged.length === 0 &&
        response.untracked.length === 0
      ) {
        setInfo('No changes detected.');
      }
    } catch (err) {
      console.error('Failed to load SCM status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load source control status.');
    } finally {
      setIsLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleStage = useCallback(async (filePath: string) => {
    setError(null);
    try {
      await window.api.scm.stage({ paths: [filePath] });
      await refreshStatus();
    } catch (err) {
      console.error('Failed to stage file:', err);
      setError(err instanceof Error ? err.message : 'Failed to stage file.');
    }
  }, [refreshStatus]);

  const handleUnstage = useCallback(async (filePath: string) => {
    setError(null);
    try {
      await window.api.scm.unstage({ paths: [filePath] });
      await refreshStatus();
    } catch (err) {
      console.error('Failed to unstage file:', err);
      setError(err instanceof Error ? err.message : 'Failed to unstage file.');
    }
  }, [refreshStatus]);

  const handleStageAll = useCallback(async () => {
    setError(null);
    try {
      await window.api.scm.stage({ all: true });
      await refreshStatus();
    } catch (err) {
      console.error('Failed to stage all:', err);
      setError(err instanceof Error ? err.message : 'Failed to stage all changes.');
    }
  }, [refreshStatus]);

  const handleUnstageAll = useCallback(async () => {
    setError(null);
    try {
      await window.api.scm.unstage({ all: true });
      await refreshStatus();
    } catch (err) {
      console.error('Failed to unstage all:', err);
      setError(err instanceof Error ? err.message : 'Failed to unstage all changes.');
    }
  }, [refreshStatus]);

  const handleCommit = useCallback(async () => {
    const message = commitMessage.trim();
    if (!message) {
      setError('Commit message is required.');
      return;
    }

    setError(null);
    try {
      await window.api.scm.commit({ message });
      setCommitMessage('');
      await refreshStatus();
    } catch (err) {
      console.error('Failed to commit:', err);
      setError(err instanceof Error ? err.message : 'Failed to commit changes.');
    }
  }, [commitMessage, refreshStatus]);

  const handleOpenFile = useCallback((filePath: string) => {
    openFile(filePath);
  }, [openFile]);

  if (!workspace) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div
          className="flex items-center justify-center flex-1 text-center text-secondary animate-fade-in"
          style={{
            paddingLeft: 'var(--vscode-space-4)',
            paddingRight: 'var(--vscode-space-4)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="codicon codicon-source-control text-2xl opacity-50" aria-hidden="true" />
            <p className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              Open a workspace to view source control.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div
        className="border-b border-border-subtle bg-surface-secondary"
        style={{ padding: 'var(--vscode-space-3)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="codicon codicon-source-control text-secondary" aria-hidden="true" />
            <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
              Source Control
            </span>
            {status.branch && (
              <span
                className="text-tertiary"
                style={{ fontSize: 'var(--vscode-font-size-small)' }}
              >
                {status.branch}
              </span>
            )}
          </div>
          <button
            onClick={refreshStatus}
            className="
              rounded-sm border border-border-subtle text-secondary
              hover:bg-surface-hover hover:text-primary
              active:opacity-90 transition-colors duration-150
            "
            style={{
              paddingLeft: 'var(--vscode-space-2)',
              paddingRight: 'var(--vscode-space-2)',
              paddingTop: 'var(--vscode-space-1)',
              paddingBottom: 'var(--vscode-space-1)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Input
            type="text"
            value={commitMessage}
            onChange={(value) => setCommitMessage(String(value))}
            placeholder="Commit message"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCommit}
              className="
                rounded-sm bg-accent text-primary
                hover:bg-accent-hover active:opacity-90
                transition-colors duration-150
              "
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-ui)',
              }}
            >
              Commit
            </button>
            <button
              onClick={handleStageAll}
              className="
                rounded-sm border border-border-subtle text-secondary
                hover:bg-surface-hover hover:text-primary
                active:opacity-90 transition-colors duration-150
              "
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-ui)',
              }}
            >
              Stage All
            </button>
            <button
              onClick={handleUnstageAll}
              className="
                rounded-sm border border-border-subtle text-secondary
                hover:bg-surface-hover hover:text-primary
                active:opacity-90 transition-colors duration-150
              "
              style={{
                paddingLeft: 'var(--vscode-space-3)',
                paddingRight: 'var(--vscode-space-3)',
                paddingTop: 'var(--vscode-space-2)',
                paddingBottom: 'var(--vscode-space-2)',
                fontSize: 'var(--vscode-font-size-ui)',
              }}
            >
              Unstage All
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {error && (
          <div
            className="text-status-error"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {error}
          </div>
        )}

        {info && !error && (
          <div
            className="text-tertiary"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {info}
          </div>
        )}

        {groups.map((group) => (
          <div key={group.id} className="border-b border-border-subtle">
            <div
              className="flex items-center justify-between text-secondary"
              style={{
                padding: 'var(--vscode-space-2)',
              }}
            >
              <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
                {group.title}
              </span>
              <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
                {group.items.length}
              </span>
            </div>

            {group.items.length === 0 ? (
              <div
                className="text-tertiary"
                style={{
                  paddingLeft: 'var(--vscode-space-3)',
                  paddingRight: 'var(--vscode-space-3)',
                  paddingBottom: 'var(--vscode-space-2)',
                  fontSize: 'var(--vscode-font-size-small)',
                }}
              >
                No files.
              </div>
            ) : (
              <div className="flex flex-col">
                {group.items.map((item) => (
                  <div
                    key={`${group.id}-${item.path}`}
                    className="flex items-center justify-between hover:bg-surface-hover"
                    style={{ padding: 'var(--vscode-space-2)' }}
                  >
                    <button
                      onClick={() => handleOpenFile(item.path)}
                      className="flex items-center gap-2 text-left"
                    >
                      <span className="codicon codicon-file text-secondary" aria-hidden="true" />
                      <span className="text-primary" style={{ fontSize: 'var(--vscode-font-size-ui)' }}>
                        {formatPath(item.path)}
                      </span>
                      <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
                        {item.status}
                      </span>
                    </button>
                    {group.id === 'staged' ? (
                      <button
                        onClick={() => handleUnstage(item.path)}
                        className="
                          rounded-sm border border-border-subtle text-secondary
                          hover:bg-surface-hover hover:text-primary
                          active:opacity-90 transition-colors duration-150
                        "
                        style={{
                          paddingLeft: 'var(--vscode-space-2)',
                          paddingRight: 'var(--vscode-space-2)',
                          paddingTop: 'var(--vscode-space-1)',
                          paddingBottom: 'var(--vscode-space-1)',
                          fontSize: 'var(--vscode-font-size-small)',
                        }}
                      >
                        Unstage
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStage(item.path)}
                        className="
                          rounded-sm border border-border-subtle text-secondary
                          hover:bg-surface-hover hover:text-primary
                          active:opacity-90 transition-colors duration-150
                        "
                        style={{
                          paddingLeft: 'var(--vscode-space-2)',
                          paddingRight: 'var(--vscode-space-2)',
                          paddingTop: 'var(--vscode-space-1)',
                          paddingBottom: 'var(--vscode-space-1)',
                          fontSize: 'var(--vscode-font-size-small)',
                        }}
                      >
                        Stage
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
