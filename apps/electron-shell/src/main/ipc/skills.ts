import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  CreateAgentSkillRequestSchema,
  DeleteAgentSkillRequestSchema,
  GetAgentSkillRequestSchema,
  ListAgentSkillsRequestSchema,
  SetAgentSkillEnabledRequestSchema,
  SetDefaultSkillRequestSchema,
  SetLastUsedSkillRequestSchema,
  UpdateAgentSkillRequestSchema,
  type CreateAgentSkillResponse,
  type DeleteAgentSkillResponse,
  type GetAgentSkillResponse,
  type ListAgentSkillsResponse,
  type SetAgentSkillEnabledResponse,
  type SetDefaultSkillResponse,
  type SetLastUsedSkillResponse,
  type UpdateAgentSkillResponse,
} from 'packages-api-contracts';
import { skillsService } from '../services/SkillsService';

export const registerSkillsHandlers = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.SKILLS_LIST,
    async (_event, request: unknown): Promise<ListAgentSkillsResponse> => {
      const validated = ListAgentSkillsRequestSchema.parse(request ?? {});
      return skillsService.listSkills(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILLS_GET,
    async (_event, request: unknown): Promise<GetAgentSkillResponse> => {
      const validated = GetAgentSkillRequestSchema.parse(request);
      return skillsService.getSkill(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILLS_CREATE,
    async (_event, request: unknown): Promise<CreateAgentSkillResponse> => {
      const validated = CreateAgentSkillRequestSchema.parse(request);
      return skillsService.createSkill(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILLS_UPDATE,
    async (_event, request: unknown): Promise<UpdateAgentSkillResponse> => {
      const validated = UpdateAgentSkillRequestSchema.parse(request);
      return skillsService.updateSkill(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILLS_DELETE,
    async (_event, request: unknown): Promise<DeleteAgentSkillResponse> => {
      const validated = DeleteAgentSkillRequestSchema.parse(request);
      return skillsService.deleteSkill(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILLS_SET_ENABLED,
    async (_event, request: unknown): Promise<SetAgentSkillEnabledResponse> => {
      const validated = SetAgentSkillEnabledRequestSchema.parse(request);
      return skillsService.setSkillEnabled(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILLS_SET_DEFAULT,
    async (_event, request: unknown): Promise<SetDefaultSkillResponse> => {
      const validated = SetDefaultSkillRequestSchema.parse(request);
      return skillsService.setDefaultSkill(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SKILLS_SET_LAST_USED,
    async (_event, request: unknown): Promise<SetLastUsedSkillResponse> => {
      const validated = SetLastUsedSkillRequestSchema.parse(request);
      return skillsService.setLastUsedSkill(validated);
    }
  );
};
