import type { SddStep, ToolCallEnvelope, ToolCallResult } from 'packages-api-contracts';
import type { SddDocPaths } from './sdd-paths';

export type SddToolExecutor = {
  executeToolCall: (envelope: ToolCallEnvelope) => Promise<ToolCallResult>;
};

export type SddContext = {
  files: Map<string, string>;
};

export type SddContextLoader = (
  runId: string,
  featureId: string,
  step: SddStep,
  docPaths?: SddDocPaths
) => Promise<SddContext>;
