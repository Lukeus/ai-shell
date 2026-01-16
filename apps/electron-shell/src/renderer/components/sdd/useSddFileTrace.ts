import { useEffect, useState } from 'react';
import type { SddFileTraceResponse, SddStatus } from 'packages-api-contracts';
import type { FileTreeContextValue } from '../explorer/FileTreeContext';

type UseSddFileTraceParams = {
  enabled: boolean;
  selectedEntry: FileTreeContextValue['selectedEntry'];
  parity: SddStatus['parity'] | null | undefined;
};

type UseSddFileTraceResult = {
  fileTrace: SddFileTraceResponse | null;
};

export function useSddFileTrace({
  enabled,
  selectedEntry,
  parity,
}: UseSddFileTraceParams): UseSddFileTraceResult {
  const [fileTrace, setFileTrace] = useState<SddFileTraceResponse | null>(null);

  useEffect(() => {
    const filePath = selectedEntry?.type === 'file' ? selectedEntry.path : null;
    if (!enabled || !filePath || typeof window.api?.sdd?.getFileTrace !== 'function') {
      setFileTrace(null);
      return;
    }

    let isMounted = true;
    const loadTrace = async () => {
      try {
        const trace = await window.api.sdd.getFileTrace(filePath);
        if (isMounted) {
          setFileTrace(trace);
        }
      } catch (loadError) {
        console.error('Failed to load SDD file trace:', loadError);
        if (isMounted) {
          setFileTrace(null);
        }
      }
    };

    void loadTrace();

    return () => {
      isMounted = false;
    };
  }, [
    enabled,
    selectedEntry?.path,
    selectedEntry?.type,
    parity?.trackedFileChanges,
    parity?.untrackedFileChanges,
  ]);

  return { fileTrace };
}
