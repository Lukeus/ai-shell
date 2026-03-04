import type {
  AgentRunMetadata,
  AgentRunDelegationConfig,
  AgentRunStartRequest,
  AgentSkillDescriptor,
  AgentPolicyConfig,
} from 'packages-api-contracts';

const joinUnique = (...lists: Array<string[] | undefined>): string[] | undefined => {
  const unique = new Set<string>();
  lists.forEach((list) => {
    list?.forEach((entry) => {
      if (entry.trim().length > 0) {
        unique.add(entry);
      }
    });
  });
  if (unique.size === 0) {
    return undefined;
  }
  return Array.from(unique);
};

const intersectAllowlists = (
  ...lists: Array<string[] | undefined>
): string[] | undefined => {
  const normalized = lists.filter(
    (list): list is string[] => Array.isArray(list)
  );
  if (normalized.length === 0) {
    return undefined;
  }

  const base = joinUnique(normalized[0]) ?? [];
  return normalized.slice(1).reduce<string[]>((current, next) => {
    const allowed = new Set(joinUnique(next) ?? []);
    return current.filter((toolId) => allowed.has(toolId));
  }, base);
};

const removeDeniedTools = (
  allowlist: string[] | undefined,
  denylist: string[] | undefined
): string[] | undefined => {
  if (!allowlist) {
    return undefined;
  }
  if (!denylist || denylist.length === 0) {
    return allowlist;
  }
  const denied = new Set(denylist);
  return allowlist.filter((toolId) => !denied.has(toolId));
};

const buildMergedPolicy = (
  request: AgentRunStartRequest,
  skill: AgentSkillDescriptor
): AgentPolicyConfig | undefined => {
  const requestPolicy = request.config?.policy;
  const hasPolicyAllowlist = Array.isArray(requestPolicy?.allowlist);
  const mergedDenylist = joinUnique(
    skill.definition.toolDenylist,
    requestPolicy?.denylist
  );
  const mergedAllowlist = removeDeniedTools(
    hasPolicyAllowlist ? joinUnique(requestPolicy?.allowlist) ?? [] : undefined,
    mergedDenylist
  );

  if (mergedAllowlist === undefined && !mergedDenylist) {
    return undefined;
  }

  return {
    ...(mergedAllowlist !== undefined ? { allowlist: mergedAllowlist } : {}),
    ...(mergedDenylist ? { denylist: mergedDenylist } : {}),
  };
};

const applyRunBoundsToDelegation = (
  delegation: AgentRunDelegationConfig | undefined,
  runAllowlist: string[] | undefined,
  runDenylist: string[] | undefined
): AgentRunDelegationConfig | undefined => {
  if (!delegation) {
    return undefined;
  }

  const subagents = delegation.subagents.map((subagent) => {
    const mergedSubagentDenylist = joinUnique(subagent.toolDenylist, runDenylist);
    const mergedSubagentAllowlist = removeDeniedTools(
      intersectAllowlists(subagent.toolAllowlist, runAllowlist),
      mergedSubagentDenylist
    );
    return {
      ...subagent,
      ...(mergedSubagentAllowlist !== undefined
        ? { toolAllowlist: mergedSubagentAllowlist }
        : {}),
      ...(mergedSubagentDenylist ? { toolDenylist: mergedSubagentDenylist } : {}),
    };
  });

  return {
    ...delegation,
    subagents,
  };
};

export const applySkillToRunRequest = (
  request: AgentRunStartRequest,
  skill: AgentSkillDescriptor,
  delegation?: AgentRunDelegationConfig
): AgentRunStartRequest => {
  const hasExplicitAllowlist =
    Array.isArray(request.toolAllowlist) ||
    Array.isArray(request.config?.toolAllowlist);
  const explicitAllowlist = joinUnique(
    request.toolAllowlist,
    request.config?.toolAllowlist
  );
  const mergedDenylist = joinUnique(
    skill.definition.toolDenylist,
    request.config?.policy?.denylist
  );
  const effectiveAllowlist = removeDeniedTools(
    hasExplicitAllowlist
      ? explicitAllowlist ?? []
      : skill.definition.toolAllowlist,
    mergedDenylist
  );
  const mergedPolicy = buildMergedPolicy(request, skill);
  const runBoundAllowlist = intersectAllowlists(
    effectiveAllowlist,
    mergedPolicy?.allowlist
  );
  const mergedDelegation = applyRunBoundsToDelegation(
    delegation,
    runBoundAllowlist,
    mergedPolicy?.denylist ?? mergedDenylist
  );
  const promptTemplate = skill.definition.promptTemplate?.trim();
  const mergedGoal = promptTemplate
    ? `${promptTemplate}\n\n${request.goal}`
    : request.goal;
  const mergedConfig = {
    ...request.config,
    toolAllowlist: undefined,
    policy: mergedPolicy,
    delegation: mergedDelegation,
  };
  const hasConfigValue = Object.values(mergedConfig).some(
    (value) => value !== undefined
  );

  return {
    ...request,
    goal: mergedGoal,
    skillId: skill.definition.id,
    toolAllowlist: effectiveAllowlist,
    config: hasConfigValue ? mergedConfig : undefined,
  };
};

export const toRunSkillMetadata = (
  skill: AgentSkillDescriptor
): NonNullable<AgentRunMetadata['skill']> => ({
  skillId: skill.definition.id,
  source: skill.source,
  scope: skill.scope,
  ...(skill.version ? { version: skill.version } : {}),
});

export const toRunDelegationMetadata = (
  delegation: AgentRunDelegationConfig
): NonNullable<AgentRunMetadata['delegation']> => ({
  enabled: delegation.enabled,
  ...(delegation.maxDepth !== undefined ? { maxDepth: delegation.maxDepth } : {}),
  ...(delegation.maxDelegations !== undefined
    ? { maxDelegations: delegation.maxDelegations }
    : {}),
  subagentSkillIds: Array.from(
    new Set(delegation.subagents.map((subagent) => subagent.skillId))
  ),
});
