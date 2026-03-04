import type {
  AgentRunDelegationConfig,
  AgentSkillDescriptor,
  AgentSubagentDefinition,
} from 'packages-api-contracts';

export const DEFAULT_DELEGATION_MAX_DEPTH = 3;
export const DEFAULT_DELEGATION_MAX_COUNT = 16;

type DelegationResolutionOptions = {
  supervisor: AgentSkillDescriptor;
  availableSkills: AgentSkillDescriptor[];
};

type GraphValidationState = {
  edgeCount: number;
};

const normalizeToolList = (list?: string[]): string[] | undefined => {
  if (!list || list.length === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of list) {
    const toolId = entry.trim();
    if (toolId.length === 0 || seen.has(toolId)) {
      continue;
    }
    seen.add(toolId);
    normalized.push(toolId);
  }
  return normalized.length > 0 ? normalized : undefined;
};

const mergeDenylists = (...lists: Array<string[] | undefined>): string[] | undefined =>
  normalizeToolList(lists.flatMap((list) => list ?? []));

const intersectAllowlists = (
  ...lists: Array<string[] | undefined>
): string[] | undefined => {
  const normalized = lists
    .map((list) => normalizeToolList(list))
    .filter((list): list is string[] => Array.isArray(list));

  if (normalized.length === 0) {
    return undefined;
  }

  let intersection = normalized[0];
  for (let index = 1; index < normalized.length; index += 1) {
    const allowed = new Set(normalized[index]);
    intersection = intersection.filter((toolId) => allowed.has(toolId));
  }
  return intersection;
};

const removeDenied = (
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

const toSkillMap = (
  skills: AgentSkillDescriptor[]
): Map<string, AgentSkillDescriptor> =>
  new Map(skills.map((skill) => [skill.definition.id, skill]));

const getEnabledSubagents = (
  skill: AgentSkillDescriptor
): AgentSubagentDefinition[] =>
  skill.definition.delegation?.enabled
    ? skill.definition.delegation.subagents.filter(
        (subagent) => subagent.enabled !== false
      )
    : [];

const assertReferencedSkill = (
  skillMap: Map<string, AgentSkillDescriptor>,
  supervisorId: string,
  subagent: AgentSubagentDefinition
): AgentSkillDescriptor => {
  const referenced = skillMap.get(subagent.skillId);
  if (!referenced) {
    throw new Error(
      `Delegation skill not found: ${subagent.skillId} (referenced by ${supervisorId}).`
    );
  }
  if (!referenced.enabled) {
    throw new Error(
      `Delegation skill is disabled: ${subagent.skillId} (referenced by ${supervisorId}).`
    );
  }
  return referenced;
};

const assertDelegationGraph = (
  skill: AgentSkillDescriptor,
  skillMap: Map<string, AgentSkillDescriptor>,
  maxDepth: number,
  maxDelegations: number,
  state: GraphValidationState,
  path: string[],
  depth: number
): void => {
  const subagents = getEnabledSubagents(skill);
  if (subagents.length === 0) {
    return;
  }

  if (depth >= maxDepth) {
    throw new Error(
      `Delegation maxDepth exceeded: ${path.join(' -> ')} exceeds maxDepth ${maxDepth}.`
    );
  }

  for (const subagent of subagents) {
    state.edgeCount += 1;
    if (state.edgeCount > maxDelegations) {
      throw new Error(
        `Delegation maxDelegations exceeded: ${state.edgeCount} exceeds maxDelegations ${maxDelegations}.`
      );
    }

    const nextSkill = assertReferencedSkill(skillMap, skill.definition.id, subagent);
    if (path.includes(nextSkill.definition.id)) {
      const cyclePath = [...path, nextSkill.definition.id].join(' -> ');
      throw new Error(`Delegation cycle detected: ${cyclePath}.`);
    }

    assertDelegationGraph(
      nextSkill,
      skillMap,
      maxDepth,
      maxDelegations,
      state,
      [...path, nextSkill.definition.id],
      depth + 1
    );
  }
};

const mergeSubagentPolicy = (
  supervisor: AgentSkillDescriptor,
  referencedSkill: AgentSkillDescriptor,
  subagent: AgentSubagentDefinition
): AgentSubagentDefinition => {
  const mergedDenylist = mergeDenylists(
    supervisor.definition.toolDenylist,
    referencedSkill.definition.toolDenylist,
    subagent.toolDenylist
  );
  const mergedAllowlist = removeDenied(
    intersectAllowlists(
      supervisor.definition.toolAllowlist,
      referencedSkill.definition.toolAllowlist,
      subagent.toolAllowlist
    ),
    mergedDenylist
  );

  return {
    name: subagent.name,
    description: subagent.description,
    skillId: subagent.skillId,
    ...(mergedAllowlist !== undefined ? { toolAllowlist: mergedAllowlist } : {}),
    ...(mergedDenylist ? { toolDenylist: mergedDenylist } : {}),
  };
};

export const resolveSkillDelegation = ({
  supervisor,
  availableSkills,
}: DelegationResolutionOptions): AgentRunDelegationConfig | undefined => {
  const delegation = supervisor.definition.delegation;
  if (!delegation?.enabled) {
    return undefined;
  }

  const maxDepth = delegation.maxDepth ?? DEFAULT_DELEGATION_MAX_DEPTH;
  const maxDelegations = delegation.maxDelegations ?? DEFAULT_DELEGATION_MAX_COUNT;
  const skillMap = toSkillMap(availableSkills);
  const state: GraphValidationState = { edgeCount: 0 };
  assertDelegationGraph(
    supervisor,
    skillMap,
    maxDepth,
    maxDelegations,
    state,
    [supervisor.definition.id],
    0
  );

  const resolvedSubagents = delegation.subagents
    .filter((subagent) => subagent.enabled !== false)
    .map((subagent) => {
      const referencedSkill = assertReferencedSkill(
        skillMap,
        supervisor.definition.id,
        subagent
      );
      return mergeSubagentPolicy(supervisor, referencedSkill, subagent);
    });

  if (resolvedSubagents.length === 0) {
    throw new Error(
      `Delegation is enabled for ${supervisor.definition.id} but has no enabled subagents.`
    );
  }

  return {
    enabled: true,
    maxDepth,
    maxDelegations,
    subagents: resolvedSubagents,
  };
};
