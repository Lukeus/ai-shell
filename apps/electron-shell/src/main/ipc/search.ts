import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  SearchRequestSchema,
  SearchResponse,
  ReplaceRequestSchema,
  ReplaceResponse,
} from 'packages-api-contracts';
import { searchService } from '../services/SearchService';

export const registerSearchHandlers = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_QUERY,
    async (_event, request: unknown): Promise<SearchResponse> => {
      const validated = SearchRequestSchema.parse(request);
      return await searchService.search(validated);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SEARCH_REPLACE,
    async (_event, request: unknown): Promise<ReplaceResponse> => {
      const validated = ReplaceRequestSchema.parse(request);
      return await searchService.replace(validated);
    }
  );
};
