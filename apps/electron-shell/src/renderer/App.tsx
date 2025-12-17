import { useState, useEffect } from 'react';
import type { AppInfo } from 'packages-api-contracts';

/**
 * Main application component for ai-shell.
 * P1 (Process isolation): Renderer is sandboxed, accesses data via window.api only.
 * P4 (UI design system): Uses Tailwind 4 CSS-first tokens.
 */
export function App() {
  const [versionInfo, setVersionInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    // Fetch version info from main process via preload API
    window.api.getVersion().then(setVersionInfo).catch(console.error);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">ai-shell</h1>
        {versionInfo ? (
          <div className="text-sm text-gray-400 space-y-1">
            <p>App: {versionInfo.version}</p>
            <p>Electron: {versionInfo.electronVersion}</p>
            <p>Chrome: {versionInfo.chromeVersion}</p>
            <p>Node: {versionInfo.nodeVersion}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Loading version info...</p>
        )}
      </div>
    </div>
  );
}
