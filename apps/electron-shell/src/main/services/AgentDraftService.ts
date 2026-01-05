import * as fs from 'fs';
import * as path from 'path';
import { SaveAgentDraftRequestSchema } from 'packages-api-contracts';
import { workspaceService } from './WorkspaceService';

const FEATURE_ID_PATTERN = /^[0-9]+-[a-z0-9-]+$/;

const resolveSpecsRoot = (workspacePath: string): string =>
  path.resolve(workspacePath, 'specs');

const resolveFeatureDir = (specsRoot: string, featureId: string): string =>
  path.resolve(specsRoot, featureId);

export class AgentDraftService {
  public saveDraft(request: unknown): {
    featureId: string;
    specPath: string;
    planPath: string;
    tasksPath: string;
    savedAt: string;
  } {
    const validated = SaveAgentDraftRequestSchema.parse(request);
    const workspace = workspaceService.getWorkspace();
    if (!workspace) {
      throw new Error('No workspace open. Open a folder to save drafts.');
    }

    const featureId = validated.draft.featureId.trim();
    if (!FEATURE_ID_PATTERN.test(featureId)) {
      throw new Error(
        'Invalid feature id. Use lowercase letters, numbers, and hyphens (e.g., 159-agents-panel-context).'
      );
    }

    const specsRoot = resolveSpecsRoot(workspace.path);
    const featureDir = resolveFeatureDir(specsRoot, featureId);
    if (!featureDir.startsWith(specsRoot)) {
      throw new Error('Invalid feature path.');
    }

    const specPath = path.join(featureDir, 'spec.md');
    const planPath = path.join(featureDir, 'plan.md');
    const tasksPath = path.join(featureDir, 'tasks.md');
    const allowOverwrite = Boolean(validated.allowOverwrite);

    if (!allowOverwrite) {
      const existing = [specPath, planPath, tasksPath].find((target) =>
        fs.existsSync(target)
      );
      if (existing) {
        throw new Error(
          'Draft files already exist. Enable overwrite to replace existing files.'
        );
      }
    }

    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(specPath, validated.draft.spec, 'utf-8');
    fs.writeFileSync(planPath, validated.draft.plan, 'utf-8');
    fs.writeFileSync(tasksPath, validated.draft.tasks, 'utf-8');

    return {
      featureId,
      specPath,
      planPath,
      tasksPath,
      savedAt: new Date().toISOString(),
    };
  }
}

export const agentDraftService = new AgentDraftService();
