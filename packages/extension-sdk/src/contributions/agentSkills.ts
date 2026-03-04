import type { AgentSkillDefinition } from 'packages-api-contracts';
import { AgentSkillDefinitionSchema } from 'packages-api-contracts';

type AgentSkillListener = (skill: AgentSkillDefinition) => void;

const skills = new Map<string, AgentSkillDefinition>();
const listeners = new Set<AgentSkillListener>();

export function registerAgentSkill(skill: AgentSkillDefinition): AgentSkillDefinition {
  const validated = AgentSkillDefinitionSchema.parse(skill);
  skills.set(validated.id, validated);
  listeners.forEach((listener) => listener(validated));
  return validated;
}

export function registerAgentSkills(nextSkills: AgentSkillDefinition[]): AgentSkillDefinition[] {
  return nextSkills.map((skill) => registerAgentSkill(skill));
}

export function listAgentSkills(): AgentSkillDefinition[] {
  return Array.from(skills.values());
}

export function onAgentSkillRegistered(listener: AgentSkillListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
