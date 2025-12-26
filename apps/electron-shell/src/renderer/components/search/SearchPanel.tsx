import React, { useCallback, useMemo, useState } from 'react';
import { Input, ToggleSwitch } from 'packages-ui-kit';
import type {
  SearchRequest,
  SearchResult,
  ReplaceRequest,
  ReplaceResponse,
} from 'packages-api-contracts';
import { useFileTree } from '../explorer/FileTreeContext';

type ReplaceSummary = ReplaceResponse & { scope: 'workspace' | 'file'; target?: string };

export function SearchPanel() {
  const { workspace, openFile } = useFileTree();
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [includes, setIncludes] = useState('');
  const [excludes, setExcludes] = useState('');
  const [maxResults, setMaxResults] = useState<number | ''>(2000);
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceSummary, setReplaceSummary] = useState<ReplaceSummary | null>(null);

  const patternList = useCallback((value: string) => {
    return value
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }, []);

  const searchRequest = useMemo<SearchRequest>(() => ({
    query,
    isRegex,
    matchCase,
    wholeWord,
    includes: patternList(includes),
    excludes: patternList(excludes),
    maxResults: typeof maxResults === 'number' ? maxResults : undefined,
  }), [query, isRegex, matchCase, wholeWord, includes, excludes, maxResults, patternList]);

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

  const runSearch = useCallback(async () => {
    setError(null);
    setReplaceSummary(null);

    if (!workspace) {
      setResults([]);
      setTruncated(false);
      return;
    }

    if (!query.trim()) {
      setResults([]);
      setTruncated(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await window.api.search.query(searchRequest);
      setResults(response.results);
      setTruncated(response.truncated);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setTruncated(false);
    } finally {
      setIsSearching(false);
    }
  }, [query, searchRequest, workspace]);

  const runReplace = useCallback(async (request: ReplaceRequest, scopeLabel: ReplaceSummary) => {
    setError(null);
    try {
      const response = await window.api.search.replace(request);
      setReplaceSummary({ ...response, ...scopeLabel });
      await runSearch();
    } catch (err) {
      console.error('Replace failed:', err);
      setError(err instanceof Error ? err.message : 'Replace failed');
    }
  }, [runSearch]);

  const handleReplaceWorkspace = useCallback(() => {
    if (!query.trim()) {
      return;
    }

    runReplace(
      {
        scope: 'workspace',
        query,
        replace,
        isRegex,
        matchCase,
        wholeWord,
        includes: patternList(includes),
        excludes: patternList(excludes),
      },
      { scope: 'workspace' }
    );
  }, [query, replace, isRegex, matchCase, wholeWord, includes, excludes, patternList, runReplace]);

  const handleReplaceFile = useCallback((filePath: string) => {
    if (!query.trim()) {
      return;
    }

    runReplace(
      {
        scope: 'file',
        filePath,
        query,
        replace,
        isRegex,
        matchCase,
        wholeWord,
      },
      { scope: 'file', target: formatPath(filePath) }
    );
  }, [query, replace, isRegex, matchCase, wholeWord, formatPath, runReplace]);

  const handleMatchClick = useCallback((filePath: string) => {
    openFile(filePath);
  }, [openFile]);

  if (!workspace) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-surface">
        <div
          className="flex items-center justify-center flex-1 text-center text-secondary animate-fade-in"
          style={{
            paddingLeft: 'var(--vscode-space-4)',
            paddingRight: 'var(--vscode-space-4)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="codicon codicon-search text-2xl opacity-50" aria-hidden="true" />
            <p className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
              Open a workspace to search files.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-surface">
      <div
        className="border-b border-border-subtle bg-surface-secondary shrink-0"
        style={{
          padding: 'var(--vscode-space-3)',
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="codicon codicon-search text-secondary" aria-hidden="true" />
            <div className="flex-1">
              <Input
                type="text"
                value={query}
                onChange={(value) => setQuery(String(value))}
                placeholder="Search"
              />
            </div>
            <button
              onClick={runSearch}
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
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="codicon codicon-replace text-secondary" aria-hidden="true" />
            <div className="flex-1">
              <Input
                type="text"
                value={replace}
                onChange={(value) => setReplace(String(value))}
                placeholder="Replace"
              />
            </div>
            <button
              onClick={handleReplaceWorkspace}
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
              Replace All
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <ToggleSwitch checked={isRegex} onChange={setIsRegex} label="Regex" />
            <ToggleSwitch checked={matchCase} onChange={setMatchCase} label="Match case" />
            <ToggleSwitch checked={wholeWord} onChange={setWholeWord} label="Whole word" />
            <div className="flex items-center gap-2">
              <span className="text-tertiary" style={{ fontSize: 'var(--vscode-font-size-small)' }}>
                Max
              </span>
              <Input
                type="number"
                value={maxResults}
                onChange={(value) => setMaxResults(value === '' ? '' : Number(value))}
                min={1}
                className="w-20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Input
              type="text"
              value={includes}
              onChange={(value) => setIncludes(String(value))}
              placeholder="Include (comma or space separated)"
            />
            <Input
              type="text"
              value={excludes}
              onChange={(value) => setExcludes(String(value))}
              placeholder="Exclude (comma or space separated)"
            />
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: 'var(--vscode-space-3)' }}
      >
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

        {replaceSummary && (
          <div
            className="text-secondary"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            {replaceSummary.replacements} replacements in {replaceSummary.filesChanged} files
            {replaceSummary.scope === 'file' && replaceSummary.target
              ? ` (${replaceSummary.target})`
              : ''}
          </div>
        )}

        {truncated && (
          <div
            className="text-secondary"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            Results truncated. Refine your search to see more matches.
          </div>
        )}

        {!isSearching && query.trim() && results.length === 0 && !error && (
          <div
            className="text-tertiary"
            style={{
              padding: 'var(--vscode-space-3)',
              fontSize: 'var(--vscode-font-size-small)',
            }}
          >
            No results found.
          </div>
        )}

        {results.map((result) => (
          <div key={result.filePath} className="border-b border-border-subtle">
            <div
              className="flex items-center justify-between text-secondary min-w-0"
              style={{
                padding: 'var(--vscode-space-2)',
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="codicon codicon-file" aria-hidden="true" />
                <span
                  className="text-primary truncate"
                  style={{ fontSize: 'var(--vscode-font-size-ui)' }}
                  title={formatPath(result.filePath)}
                >
                  {formatPath(result.filePath)}
                </span>
                <span
                  className="text-tertiary"
                  style={{ fontSize: 'var(--vscode-font-size-small)' }}
                >
                  {result.matches.length}
                </span>
              </div>
              <button
                onClick={() => handleReplaceFile(result.filePath)}
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
                Replace in file
              </button>
            </div>

            <div className="flex flex-col">
              {result.matches.map((match, index) => (
                <button
                  key={`${match.filePath}-${match.line}-${match.column}-${index}`}
                  onClick={() => handleMatchClick(match.filePath)}
                  className="
                    text-left hover:bg-surface-hover
                    transition-colors duration-150
                    min-w-0
                  "
                  style={{
                    padding: 'var(--vscode-space-2)',
                  }}
                >
                  <div
                    className="text-tertiary"
                    style={{ fontSize: 'var(--vscode-font-size-small)' }}
                  >
                    {match.line}:{match.column}
                  </div>
                  <div
                    className="text-primary break-words"
                    style={{ fontSize: 'var(--vscode-font-size-ui)' }}
                  >
                    {match.lineText}
                  </div>
                  {match.matchText && (
                    <div
                      className="text-accent break-words"
                      style={{ fontSize: 'var(--vscode-font-size-small)' }}
                    >
                      {match.matchText}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
