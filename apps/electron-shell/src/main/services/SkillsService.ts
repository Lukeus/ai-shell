// EXCEPTION: SkillsService currently exceeds guardrail size; follow-up split is tracked in specs/165-multi-agent-skill-delegation/tasks.md (approved by AGENTS.md guardrails)
import * as path from 'path';
import { app } from 'electron';
import {
  AgentSkillDefinitionSchema,
  type AgentRunDelegationConfig,
  type AgentSkillDescriptor,
  type CreateAgentSkillRequest,
  type CreateAgentSkillResponse,
  type DeleteAgentSkillRequest,
  type DeleteAgentSkillResponse,
  type GetAgentSkillRequest,
  type GetAgentSkillResponse,
  type ListAgentSkillsRequest,
  type ListAgentSkillsResponse,
  type SetAgentSkillEnabledRequest,
  type SetAgentSkillEnabledResponse,
  type SetDefaultSkillRequest,
  type SetDefaultSkillResponse,
  type SetLastUsedSkillRequest,
  type SetLastUsedSkillResponse,
  type SkillPreferences,
  type SkillScope,
  type UpdateAgentSkillRequest,
  type UpdateAgentSkillResponse,
} from 'packages-api-contracts';
import { getExtensionRegistry } from '../index';
import { workspaceService } from './WorkspaceService';
import { SkillsStore, type StoredSkill } from './SkillsStore';
import {
  buildExtensionSnapshot,
  buildGlobalSkillList,
  buildUserDescriptor,
  buildWorkspaceOverrides,
  mergeSkills,
} from './skills-catalog';
import {
  buildPreferenceCandidates,
  type SkillPreferenceCandidate,
} from './skills-preferences';
import { resolveSkillDelegation } from './agent-skill-delegation';

type SkillLists = {
  key: string;
  global: AgentSkillDescriptor[];
  merged: AgentSkillDescriptor[];
};

export type ResolvedRunSkill = {
  skill: AgentSkillDescriptor;
  resolvedBy: 'explicit' | 'last-used' | 'default';
  scope: SkillScope;
  delegation?: AgentRunDelegationConfig;
};

const buildWorkspacePath = (workspaceRoot: string): string =>
  path.join(workspaceRoot, '.ai-shell', 'skills.json');

/**
 * SkillsService - Aggregates extension + user skills with scope-aware persistence.
 *
 * P1: main-process only. P3: no secrets stored.
 */
export class SkillsService {
  private static instance: SkillsService | null = null;
  private readonly globalStore: SkillsStore;
  private workspaceStore: SkillsStore | null = null;
  private workspacePath: string | null = null;
  private cache: SkillLists | null = null;
  private readonly now: () => string;

  private constructor(now: () => string = () => new Date().toISOString()) {
    this.globalStore = new SkillsStore(
      path.join(app.getPath('userData'), 'skills.json')
    );
    this.now = now;
  }

  public static getInstance(): SkillsService {
    if (!SkillsService.instance) {
      SkillsService.instance = new SkillsService();
    }
    return SkillsService.instance;
  }

  public listSkills(request: ListAgentSkillsRequest = {}): ListAgentSkillsResponse {
    const scope = request.scope;
    const lists = this.getSkillLists();
    const preferences = this.getEffectivePreferences(scope);

    if (scope === 'global') {
      return { skills: lists.global, preferences };
    }

    if (scope === 'workspace') {
      this.requireWorkspace();
      return { skills: lists.merged, preferences };
    }

    return {
      skills: this.hasWorkspace() ? lists.merged : lists.global,
      preferences,
    };
  }

  public getSkill(request: GetAgentSkillRequest): GetAgentSkillResponse {
    const scope = request.scope;
    const lists = this.getSkillLists();
    let skills: AgentSkillDescriptor[];

    if (scope === 'global') {
      skills = lists.global;
    } else if (scope === 'workspace') {
      this.requireWorkspace();
      skills = lists.merged;
    } else {
      skills = this.hasWorkspace() ? lists.merged : lists.global;
    }
    const skill = skills.find((item) => item.definition.id === request.id);
    if (!skill) {
      throw new Error(`Skill not found: ${request.id}`);
    }
    return { skill };
  }

  public createSkill(request: CreateAgentSkillRequest): CreateAgentSkillResponse {
    const store = this.getStoreForScope(request.scope);
    const definition = AgentSkillDefinitionSchema.parse(request.skill);
    const now = this.now();
    const created: StoredSkill = {
      definition,
      enabled: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const next = store.update((current) => {
      if (current.skills[definition.id]) {
        throw new Error(`Skill already exists: ${definition.id}`);
      }
      const disabled = { ...current.disabled };
      if (disabled[definition.id]) {
        delete disabled[definition.id];
      }
      return {
        ...current,
        skills: { ...current.skills, [definition.id]: created },
        disabled,
      };
    });

    return {
      skill: buildUserDescriptor(next.skills[definition.id], request.scope),
    };
  }

  public updateSkill(request: UpdateAgentSkillRequest): UpdateAgentSkillResponse {
    if (request.updates.id && request.updates.id !== request.id) {
      throw new Error('Skill id cannot be changed.');
    }

    const store = this.getStoreForScope(request.scope);
    const current = store.getStore();
    const existing = current.skills[request.id];

    if (!existing) {
      if (this.findExtensionSkill(request.id)) {
        throw new Error(`Extension skills are read-only: ${request.id}`);
      }
      throw new Error(`Skill not found: ${request.id}`);
    }

    const updatedDefinition = AgentSkillDefinitionSchema.parse({
      ...existing.definition,
      ...request.updates,
      id: existing.definition.id,
    });

    const updated: StoredSkill = {
      ...existing,
      definition: updatedDefinition,
      version: existing.version + 1,
      updatedAt: this.now(),
    };

    const next = store.update((state) => ({
      ...state,
      skills: { ...state.skills, [request.id]: updated },
    }));

    return {
      skill: buildUserDescriptor(next.skills[request.id], request.scope),
    };
  }

  public deleteSkill(request: DeleteAgentSkillRequest): DeleteAgentSkillResponse {
    const store = this.getStoreForScope(request.scope);
    const current = store.getStore();

    if (!current.skills[request.id]) {
      if (this.findExtensionSkill(request.id)) {
        throw new Error(`Extension skills are read-only: ${request.id}`);
      }
      return { success: false };
    }

    store.update((state) => {
      const nextSkills = { ...state.skills };
      delete nextSkills[request.id];
      return { ...state, skills: nextSkills };
    });

    return { success: true };
  }

  public setSkillEnabled(
    request: SetAgentSkillEnabledRequest
  ): SetAgentSkillEnabledResponse {
    const store = this.getStoreForScope(request.scope);
    const current = store.getStore();
    const existing = current.skills[request.id];

    if (existing) {
      const updated: StoredSkill = {
        ...existing,
        enabled: request.enabled,
        updatedAt: this.now(),
      };
      store.update((state) => ({
        ...state,
        skills: { ...state.skills, [request.id]: updated },
      }));
      return {
        skill: buildUserDescriptor(updated, request.scope),
      };
    }

    const extensionSkill = this.findExtensionSkill(request.id);
    if (!extensionSkill) {
      throw new Error(`Skill not found: ${request.id}`);
    }

    store.update((state) => {
      const disabled = { ...state.disabled };
      if (request.enabled) {
        delete disabled[request.id];
      } else {
        disabled[request.id] = true;
      }
      return { ...state, disabled };
    });

    const resolved = this.getSkill({
      id: request.id,
      scope: request.scope,
    });
    return { skill: resolved.skill };
  }

  public setDefaultSkill(
    request: SetDefaultSkillRequest
  ): SetDefaultSkillResponse {
    if (request.skillId) {
      this.assertSkillExists(request.skillId, request.scope);
    }
    const store = this.getStoreForScope(request.scope);
    const next = store.update((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        defaultSkillId: request.skillId,
      },
    }));
    return { preferences: next.preferences };
  }

  public setLastUsedSkill(
    request: SetLastUsedSkillRequest
  ): SetLastUsedSkillResponse {
    if (request.skillId) {
      this.assertSkillExists(request.skillId, request.scope);
    }
    const store = this.getStoreForScope(request.scope);
    const next = store.update((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        lastUsedSkillId: request.skillId,
      },
    }));
    return { preferences: next.preferences };
  }

  public getPreferences(scope: SkillScope): SkillPreferences {
    const store = this.getStoreForScope(scope);
    return store.getStore().preferences;
  }

  public getActiveScope(): SkillScope {
    return this.hasWorkspace() ? 'workspace' : 'global';
  }

  public resolveSkillForRun(skillId?: string): ResolvedRunSkill | null {
    const scope = this.getActiveScope();
    const lists = this.getSkillLists();
    const available = scope === 'workspace' ? lists.merged : lists.global;

    if (skillId) {
      const skill = available.find((item) => item.definition.id === skillId);
      if (!skill) {
        throw new Error(
          `Skill not found: ${skillId}. Select a valid skill or clear the selection.`
        );
      }
      if (!skill.enabled) {
        throw new Error(
          `Skill is disabled: ${skillId}. Enable the skill or choose a different one.`
        );
      }
      return {
        skill,
        resolvedBy: 'explicit',
        scope,
        delegation: this.resolveDelegationForRun(skill, available),
      };
    }

    const candidates = this.getPreferenceCandidates(scope);
    for (const candidate of candidates) {
      const skill = available.find((item) => item.definition.id === candidate.skillId);
      if (!skill || !skill.enabled) {
        continue;
      }
      return {
        skill,
        resolvedBy: candidate.source,
        scope,
        delegation: this.resolveDelegationForRun(skill, available),
      };
    }

    return null;
  }

  private resolveDelegationForRun(
    skill: AgentSkillDescriptor,
    available: AgentSkillDescriptor[]
  ): AgentRunDelegationConfig | undefined {
    return resolveSkillDelegation({
      supervisor: skill,
      availableSkills: available,
    });
  }

  private getStoreForScope(scope: SkillScope): SkillsStore {
    if (scope === 'workspace') {
      return this.requireWorkspaceStore();
    }
    return this.globalStore;
  }

  private hasWorkspace(): boolean {
    return workspaceService.hasWorkspace();
  }

  private requireWorkspace(): void {
    if (!workspaceService.getWorkspace()) {
      throw new Error('No workspace open. Open a folder first.');
    }
  }

  private requireWorkspaceStore(): SkillsStore {
    const workspace = workspaceService.getWorkspace();
    if (!workspace) {
      throw new Error('No workspace open. Open a folder first.');
    }

    if (this.workspacePath !== workspace.path) {
      this.workspacePath = workspace.path;
      this.workspaceStore = new SkillsStore(buildWorkspacePath(workspace.path));
      this.cache = null;
    }

    if (!this.workspaceStore) {
      this.workspaceStore = new SkillsStore(buildWorkspacePath(workspace.path));
    }

    return this.workspaceStore;
  }

  private getWorkspaceStore(): SkillsStore | null {
    const workspace = workspaceService.getWorkspace();
    if (!workspace) {
      this.workspacePath = null;
      this.workspaceStore = null;
      return null;
    }

    if (this.workspacePath !== workspace.path) {
      this.workspacePath = workspace.path;
      this.workspaceStore = new SkillsStore(buildWorkspacePath(workspace.path));
      this.cache = null;
    }

    return this.workspaceStore;
  }

  private getSkillLists(): SkillLists {
    const workspaceStore = this.getWorkspaceStore();
    const registry = getExtensionRegistry();
    const extensionSnapshot = buildExtensionSnapshot(
      registry ? registry.getEnabledExtensions() : []
    );
    const key = [
      this.workspacePath ?? 'none',
      `global:${this.globalStore.getRevision()}`,
      `workspace:${workspaceStore?.getRevision() ?? 0}`,
      `ext:${extensionSnapshot.fingerprint}`,
    ].join('|');

    if (this.cache?.key === key) {
      return this.cache;
    }

    const { list: global, map: globalMap } = buildGlobalSkillList(
      extensionSnapshot.skills,
      this.globalStore.getStore()
    );

    const overrides = workspaceStore
      ? buildWorkspaceOverrides(globalMap, workspaceStore.getStore())
      : [];

    const merged = workspaceStore ? mergeSkills(globalMap, overrides) : global;

    this.cache = {
      key,
      global,
      merged,
    };

    return this.cache;
  }

  private findExtensionSkill(skillId: string): AgentSkillDescriptor | null {
    const registry = getExtensionRegistry();
    const snapshot = buildExtensionSnapshot(
      registry ? registry.getEnabledExtensions() : []
    );
    return snapshot.skills.find((skill) => skill.definition.id === skillId) ?? null;
  }

  private assertSkillExists(skillId: string, scope: SkillScope): void {
    const lists = this.getSkillLists();
    if (scope === 'workspace') {
      this.requireWorkspace();
    }
    const available = scope === 'global' ? lists.global : lists.merged;
    if (!available.some((skill) => skill.definition.id === skillId)) {
      throw new Error(`Skill not found: ${skillId}`);
    }
  }

  private getPreferenceCandidates(
    scope: SkillScope
  ): SkillPreferenceCandidate[] {
    if (scope === 'workspace') {
      const workspacePrefs = this.requireWorkspaceStore().getStore().preferences;
      const globalPrefs = this.globalStore.getStore().preferences;
      return buildPreferenceCandidates(workspacePrefs, globalPrefs);
    }

    return buildPreferenceCandidates(this.globalStore.getStore().preferences);
  }

  private getEffectivePreferences(scope?: SkillScope): SkillPreferences {
    if (scope === 'global' || !this.hasWorkspace()) {
      return this.globalStore.getStore().preferences;
    }

    const workspacePreferences = this.requireWorkspaceStore().getStore().preferences;
    const globalPreferences = this.globalStore.getStore().preferences;

    return {
      defaultSkillId:
        workspacePreferences.defaultSkillId ?? globalPreferences.defaultSkillId,
      lastUsedSkillId:
        workspacePreferences.lastUsedSkillId ?? globalPreferences.lastUsedSkillId,
    };
  }
}

export const skillsService = SkillsService.getInstance();
