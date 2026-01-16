import { useEffect, useMemo, useState } from 'react';
import type { SddFeatureSummary } from 'packages-api-contracts';

type UseSddFeaturesParams = {
  workspacePath?: string | null;
  enabled: boolean;
  activeFeatureId: string | null;
  setError: (message: string | null) => void;
};

type UseSddFeaturesResult = {
  features: SddFeatureSummary[];
  selectedFeature: SddFeatureSummary | null;
  selectedFeatureId: string | null;
  setSelectedFeatureId: (id: string | null) => void;
  isLoadingFeatures: boolean;
};

export function useSddFeatures({
  workspacePath,
  enabled,
  activeFeatureId,
  setError,
}: UseSddFeaturesParams): UseSddFeaturesResult {
  const [features, setFeatures] = useState<SddFeatureSummary[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);

  useEffect(() => {
    if (!workspacePath) {
      setFeatures([]);
      setSelectedFeatureId(null);
      return;
    }

    if (!enabled || typeof window.api?.sdd?.listFeatures !== 'function') {
      setFeatures([]);
      return;
    }

    let isMounted = true;
    const loadFeatures = async () => {
      setIsLoadingFeatures(true);
      setError(null);
      try {
        const response = await window.api.sdd.listFeatures();
        if (!isMounted) return;
        setFeatures(response);
      } catch (loadError) {
        console.error('Failed to load SDD features:', loadError);
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load SDD features.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingFeatures(false);
        }
      }
    };

    void loadFeatures();

    return () => {
      isMounted = false;
    };
  }, [enabled, setError, workspacePath]);

  useEffect(() => {
    if (activeFeatureId) {
      setSelectedFeatureId(activeFeatureId);
    }
  }, [activeFeatureId]);

  useEffect(() => {
    if (selectedFeatureId || features.length === 0) {
      return;
    }
    setSelectedFeatureId(features[0].featureId);
  }, [features, selectedFeatureId]);

  const selectedFeature = useMemo(
    () => features.find((feature) => feature.featureId === selectedFeatureId) ?? null,
    [features, selectedFeatureId]
  );

  return {
    features,
    selectedFeature,
    selectedFeatureId,
    setSelectedFeatureId,
    isLoadingFeatures,
  };
}
