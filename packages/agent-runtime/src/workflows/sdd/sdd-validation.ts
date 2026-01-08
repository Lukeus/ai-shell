import type { SddStep } from 'packages-api-contracts';
import type { SddDocPaths } from './sdd-paths';
import type { SddContext } from './sdd-types';

const CONSTITUTION_ALIGNMENT_PATTERNS = [
  /constitution alignment/i,
  /aligned with memory\/constitution\.md/i,
];

export const assertStepAllowed = (
  step: SddStep,
  docPaths: SddDocPaths,
  context: SddContext
): void => {
  const { specPath, planPath, tasksPath } = docPaths;
  const missing: string[] = [];

  if (step !== 'spec' && !context.files.has(specPath)) {
    missing.push(specPath);
  }

  if (
    (step === 'tasks' || step === 'implement' || step === 'review') &&
    !context.files.has(planPath)
  ) {
    missing.push(planPath);
  }

  if ((step === 'implement' || step === 'review') && !context.files.has(tasksPath)) {
    missing.push(tasksPath);
  }

  if (missing.length > 0) {
    throw new Error(
      `SDD step "${step}" requires the following files: ${missing.join(', ')}`
    );
  }
};

export const assertConstitutionAligned = (
  docPaths: SddDocPaths,
  context: SddContext,
  step: SddStep
): void => {
  const requiredPaths: string[] = [];
  if (step === 'plan') {
    requiredPaths.push(docPaths.specPath, docPaths.planPath);
  } else if (step === 'tasks') {
    requiredPaths.push(docPaths.specPath, docPaths.planPath);
  } else if (step === 'implement' || step === 'review') {
    requiredPaths.push(docPaths.specPath, docPaths.planPath, docPaths.tasksPath);
  } else {
    return;
  }
  const misaligned: string[] = [];

  for (const path of requiredPaths) {
    const content = context.files.get(path);
    if (!content) {
      continue;
    }
    const aligned = CONSTITUTION_ALIGNMENT_PATTERNS.some((pattern) => pattern.test(content));
    if (!aligned) {
      misaligned.push(path);
    }
  }

  if (misaligned.length > 0) {
    throw new Error(
      'SDD constitution alignment check failed. ' +
      'Add a "Constitution alignment" section referencing memory/constitution.md to: ' +
      misaligned.join(', ')
    );
  }
};
