import type { SkillPreferences } from 'packages-api-contracts';

export type SkillPreferenceCandidate = {
  skillId: string;
  source: 'last-used' | 'default';
};

export const buildPreferenceCandidates = (
  primary: SkillPreferences,
  fallback?: SkillPreferences
): SkillPreferenceCandidate[] => {
  const candidates: SkillPreferenceCandidate[] = [];

  const pushUnique = (
    skillId: string | null | undefined,
    source: SkillPreferenceCandidate['source']
  ): void => {
    if (!skillId || candidates.some((candidate) => candidate.skillId === skillId)) {
      return;
    }
    candidates.push({ skillId, source });
  };

  pushUnique(primary.lastUsedSkillId ?? fallback?.lastUsedSkillId, 'last-used');
  pushUnique(primary.defaultSkillId ?? fallback?.defaultSkillId, 'default');
  return candidates;
};
