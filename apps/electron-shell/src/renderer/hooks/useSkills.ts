import { useCallback, useEffect, useState } from 'react';
import type {
  AgentSkillDefinition,
  AgentSkillDescriptor,
  SkillPreferences,
  SkillScope,
} from 'packages-api-contracts';

const EMPTY_PREFERENCES: SkillPreferences = {
  defaultSkillId: null,
  lastUsedSkillId: null,
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

export type SkillUpdatePayload = Omit<Partial<AgentSkillDefinition>, 'id'>;

export type UseSkillsResult = {
  scope: SkillScope;
  setScope: (scope: SkillScope) => void;
  workspaceName: string | null;
  canUseWorkspaceScope: boolean;
  skills: AgentSkillDescriptor[];
  preferences: SkillPreferences;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createSkill: (skill: AgentSkillDefinition) => Promise<void>;
  updateSkill: (id: string, updates: SkillUpdatePayload) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  setDefaultSkill: (skillId: string | null) => Promise<void>;
  setLastUsedSkill: (skillId: string | null) => Promise<void>;
};

const resolveScope = (requested: SkillScope, hasWorkspace: boolean): SkillScope => {
  if (requested === 'workspace' && !hasWorkspace) {
    return 'global';
  }
  return requested;
};

export function useSkills(initialScope: SkillScope = 'global'): UseSkillsResult {
  const [scope, setScopeState] = useState<SkillScope>(initialScope);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [skills, setSkills] = useState<AgentSkillDescriptor[]>([]);
  const [preferences, setPreferences] = useState<SkillPreferences>(EMPTY_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasWorkspace = workspaceName !== null;

  const loadWorkspace = useCallback(async () => {
    try {
      const workspace = await window.api.workspace.getCurrent();
      const nextWorkspaceName = workspace?.name ?? null;
      setWorkspaceName(nextWorkspaceName);
      if (!nextWorkspaceName) {
        setScopeState('global');
      }
    } catch {
      setWorkspaceName(null);
      setScopeState('global');
    }
  }, []);

  const refreshForScope = useCallback(
    async (requestedScope: SkillScope) => {
      const targetScope = resolveScope(requestedScope, hasWorkspace);
      setIsLoading(true);
      try {
        setError(null);
        const response = await window.api.skills.list({ scope: targetScope });
        setSkills(response.skills);
        setPreferences(response.preferences ?? EMPTY_PREFERENCES);
      } catch (refreshError) {
        setError(toErrorMessage(refreshError, 'Failed to load skills.'));
      } finally {
        setIsLoading(false);
      }
    },
    [hasWorkspace]
  );

  useEffect(() => {
    let isActive = true;
    if (isActive) {
      void loadWorkspace();
    }
    return () => { isActive = false; };
  }, [loadWorkspace]);

  useEffect(() => {
    let isActive = true;
    if (isActive) {
      void refreshForScope(scope);
    }
    return () => { isActive = false; };
  }, [refreshForScope, scope]);

  const refresh = useCallback(async () => {
    await refreshForScope(scope);
  }, [refreshForScope, scope]);

  const runMutation = useCallback(
    async (mutation: () => Promise<void>) => {
      setIsSaving(true);
      try {
        setError(null);
        await mutation();
        await refreshForScope(scope);
      } catch (mutationError) {
        setError(toErrorMessage(mutationError, 'Failed to update skills.'));
      } finally {
        setIsSaving(false);
      }
    },
    [refreshForScope, scope]
  );

  const setScope = useCallback(
    (requestedScope: SkillScope) => {
      setScopeState(resolveScope(requestedScope, hasWorkspace));
    },
    [hasWorkspace]
  );

  const createSkill = useCallback(
    async (skill: AgentSkillDefinition) => {
      await runMutation(async () => {
        await window.api.skills.create({ scope, skill });
      });
    },
    [runMutation, scope]
  );

  const updateSkill = useCallback(
    async (id: string, updates: SkillUpdatePayload) => {
      await runMutation(async () => {
        await window.api.skills.update({ scope, id, updates });
      });
    },
    [runMutation, scope]
  );

  const deleteSkill = useCallback(
    async (id: string) => {
      await runMutation(async () => {
        await window.api.skills.delete({ scope, id });
      });
    },
    [runMutation, scope]
  );

  const setEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      await runMutation(async () => {
        await window.api.skills.setEnabled({ scope, id, enabled });
      });
    },
    [runMutation, scope]
  );

  const setDefaultSkill = useCallback(
    async (skillId: string | null) => {
      await runMutation(async () => {
        await window.api.skills.setDefault({ scope, skillId });
      });
    },
    [runMutation, scope]
  );

  const setLastUsedSkill = useCallback(
    async (skillId: string | null) => {
      await runMutation(async () => {
        await window.api.skills.setLastUsed({ scope, skillId });
      });
    },
    [runMutation, scope]
  );

  return {
    scope,
    setScope,
    workspaceName,
    canUseWorkspaceScope: hasWorkspace,
    skills,
    preferences,
    isLoading,
    isSaving,
    error,
    refresh,
    createSkill,
    updateSkill,
    deleteSkill,
    setEnabled,
    setDefaultSkill,
    setLastUsedSkill,
  };
}
