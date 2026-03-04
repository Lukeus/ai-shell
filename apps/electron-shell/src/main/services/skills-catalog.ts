import {
  AgentSkillDefinitionSchema,
  type AgentSkillDescriptor,
  type SkillScope,
} from 'packages-api-contracts';
import type { StoredExtension } from './extension-storage';
import type { SkillsStoreData, StoredSkill } from './SkillsStore';

export type ExtensionSkillSnapshot = {
  skills: AgentSkillDescriptor[];
  fingerprint: string;
};

export type GlobalSkillList = {
  list: AgentSkillDescriptor[];
  map: Map<string, AgentSkillDescriptor>;
};

export const sortSkills = (
  skills: AgentSkillDescriptor[]
): AgentSkillDescriptor[] => {
  return [...skills].sort((a, b) => {
    const nameA = a.definition.name.toLocaleLowerCase();
    const nameB = b.definition.name.toLocaleLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    return a.definition.id.localeCompare(b.definition.id);
  });
};

export const buildUserDescriptor = (
  stored: StoredSkill,
  scope: SkillScope
): AgentSkillDescriptor => ({
  definition: stored.definition,
  source: 'user',
  scope,
  enabled: stored.enabled,
  version: stored.version,
  createdAt: stored.createdAt,
  updatedAt: stored.updatedAt,
});

export const buildExtensionSnapshot = (
  extensions: StoredExtension[] | null | undefined
): ExtensionSkillSnapshot => {
  if (!extensions || extensions.length === 0) {
    return { skills: [], fingerprint: 'none' };
  }

  const skills: AgentSkillDescriptor[] = [];
  const fingerprintParts: string[] = [];

  extensions.forEach((ext) => {
    const contributions = ext.manifest.contributes?.agentSkills ?? [];
    contributions.forEach((skill) => {
      const parsed = AgentSkillDefinitionSchema.safeParse(skill);
      if (!parsed.success) {
        return;
      }
      skills.push({
        definition: parsed.data,
        source: 'extension',
        scope: 'global',
        enabled: true,
        extensionId: ext.manifest.id,
      });
    });
    fingerprintParts.push(
      `${ext.manifest.id}:${ext.manifest.version}:${ext.updatedAt}:${
        contributions.length
      }`
    );
  });

  fingerprintParts.sort();

  return {
    skills,
    fingerprint: fingerprintParts.join('|'),
  };
};

export const buildGlobalSkillList = (
  extensionSkills: AgentSkillDescriptor[],
  store: SkillsStoreData
): GlobalSkillList => {
  const map = new Map<string, AgentSkillDescriptor>();
  extensionSkills.forEach((skill) => {
    map.set(skill.definition.id, skill);
  });

  Object.entries(store.skills).forEach(([id, stored]) => {
    map.set(id, buildUserDescriptor(stored, 'global'));
  });

  Object.keys(store.disabled).forEach((id) => {
    const existing = map.get(id);
    if (!existing || existing.source !== 'extension') {
      return;
    }
    map.set(id, {
      ...existing,
      enabled: false,
    });
  });

  return { list: sortSkills(Array.from(map.values())), map };
};

export const buildWorkspaceOverrides = (
  globalMap: Map<string, AgentSkillDescriptor>,
  store: SkillsStoreData
): AgentSkillDescriptor[] => {
  const map = new Map<string, AgentSkillDescriptor>();

  Object.entries(store.skills).forEach(([id, stored]) => {
    map.set(id, buildUserDescriptor(stored, 'workspace'));
  });

  Object.keys(store.disabled).forEach((id) => {
    if (map.has(id)) {
      return;
    }
    const base = globalMap.get(id);
    if (!base) {
      return;
    }
    map.set(id, {
      ...base,
      scope: 'workspace',
      enabled: false,
    });
  });

  return sortSkills(Array.from(map.values()));
};

export const mergeSkills = (
  globalMap: Map<string, AgentSkillDescriptor>,
  overrides: AgentSkillDescriptor[]
): AgentSkillDescriptor[] => {
  const merged = new Map(globalMap);
  overrides.forEach((skill) => {
    merged.set(skill.definition.id, skill);
  });
  return sortSkills(Array.from(merged.values()));
};
