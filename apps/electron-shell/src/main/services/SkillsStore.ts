import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import {
  AgentSkillDefinitionSchema,
  SkillPreferencesSchema,
  type AgentSkillDefinition,
  type SkillPreferences,
} from 'packages-api-contracts';

export type StoredSkill = {
  definition: AgentSkillDefinition;
  enabled: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

const StoredSkillSchema = z.object({
  definition: AgentSkillDefinitionSchema,
  enabled: z.boolean(),
  version: z.number().int().min(1),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

const DEFAULT_PREFERENCES: SkillPreferences = SkillPreferencesSchema.parse({});

const SkillsStoreSchema = z.object({
  version: z.literal(1),
  skills: z.record(z.string(), StoredSkillSchema).default({}),
  disabled: z.record(z.string(), z.boolean()).default({}),
  preferences: SkillPreferencesSchema.default(DEFAULT_PREFERENCES),
});

export type SkillsStoreData = z.infer<typeof SkillsStoreSchema>;

const buildEmptyStore = (): SkillsStoreData => ({
  version: 1,
  skills: {},
  disabled: {},
  preferences: SkillPreferencesSchema.parse({}),
});

const cloneStore = (store: SkillsStoreData): SkillsStoreData =>
  JSON.parse(JSON.stringify(store)) as SkillsStoreData;

/**
 * SkillsStore - JSON persistence for user-defined skills + preferences.
 *
 * P1: Main process only. P3: No secrets stored.
 */
export class SkillsStore {
  private readonly filePath: string;
  private cache: SkillsStoreData | null = null;
  private revision = 0;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  public getRevision(): number {
    return this.revision;
  }

  public getFilePath(): string {
    return this.filePath;
  }

  public getStore(): SkillsStoreData {
    if (this.cache) {
      return this.cache;
    }
    this.cache = this.loadStore();
    return this.cache;
  }

  public update(
    mutator: (current: SkillsStoreData) => SkillsStoreData
  ): SkillsStoreData {
    const current = this.getStore();
    const next = mutator(cloneStore(current));
    this.saveStore(next);
    return next;
  }

  private loadStore(): SkillsStoreData {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const validated = SkillsStoreSchema.safeParse(parsed);
      if (!validated.success) {
        return buildEmptyStore();
      }
      return validated.data;
    } catch {
      return buildEmptyStore();
    }
  }

  private saveStore(store: SkillsStoreData): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2), 'utf-8');
    this.cache = store;
    this.revision += 1;
  }
}
