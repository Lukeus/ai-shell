import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  CreateConnectionRequestSchema,
  CreateConnectionResponse,
  UpdateConnectionRequestSchema,
  UpdateConnectionResponse,
  DeleteConnectionRequestSchema,
  ListConnectionsResponse,
  ListProvidersResponse,
  SetSecretRequestSchema,
  SetSecretResponse,
  ReplaceSecretRequestSchema,
  ReplaceSecretResponse,
  SecretAccessRequestSchema,
  SecretAccessResponse,
  ListAuditEventsRequestSchema,
  ListAuditEventsResponse,
} from 'packages-api-contracts';
import { connectionsService } from '../services/ConnectionsService';
import { connectionProviderRegistry } from '../services/ConnectionProviderRegistry';
import { secretsService } from '../services/SecretsService';
import { consentService } from '../services/ConsentService';
import { auditService } from '../services/AuditService';

export const registerConnectionsHandlers = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_PROVIDERS_LIST,
    async (): Promise<ListProvidersResponse> => {
      return { providers: connectionProviderRegistry.list() };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_LIST,
    async (): Promise<ListConnectionsResponse> => {
      const connections = connectionsService.listConnections();
      return { connections };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_CREATE,
    async (_event, request: unknown): Promise<CreateConnectionResponse> => {
      const validated = CreateConnectionRequestSchema.parse(request);
      const connection = connectionsService.createConnection(validated);
      return { connection };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_UPDATE,
    async (_event, request: unknown): Promise<UpdateConnectionResponse> => {
      const validated = UpdateConnectionRequestSchema.parse(request);
      const connection = connectionsService.updateConnection(validated);
      return { connection };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_DELETE,
    async (_event, request: unknown): Promise<void> => {
      const validated = DeleteConnectionRequestSchema.parse(request);
      connectionsService.deleteConnection(validated.id);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_SET_SECRET,
    async (_event, request: unknown): Promise<SetSecretResponse> => {
      const validated = SetSecretRequestSchema.parse(request);
      const connection = connectionsService
        .listConnections()
        .find((item) => item.metadata.id === validated.connectionId);
      if (!connection) {
        throw new Error(`Connection not found: ${validated.connectionId}`);
      }

      const secretRef = secretsService.setSecret(validated.connectionId, validated.secretValue);
      connectionsService.setSecretRef(validated.connectionId, secretRef);
      return { secretRef };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_REPLACE_SECRET,
    async (_event, request: unknown): Promise<ReplaceSecretResponse> => {
      const validated = ReplaceSecretRequestSchema.parse(request);
      const connection = connectionsService
        .listConnections()
        .find((item) => item.metadata.id === validated.connectionId);
      if (!connection) {
        throw new Error(`Connection not found: ${validated.connectionId}`);
      }

      const secretRef = secretsService.replaceSecret(
        validated.connectionId,
        validated.secretValue
      );
      connectionsService.setSecretRef(validated.connectionId, secretRef);
      return { secretRef };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_REQUEST_SECRET_ACCESS,
    async (_event, request: unknown): Promise<SecretAccessResponse> => {
      const validated = SecretAccessRequestSchema.parse(request);
      if (validated.decision) {
        consentService.recordDecision(
          validated.connectionId,
          validated.requesterId,
          validated.decision
        );
      }
      const decision = consentService.evaluateAccess(
        validated.connectionId,
        validated.requesterId
      );

      if (decision === null) {
        auditService.logSecretAccess({
          connectionId: validated.connectionId,
          requesterId: validated.requesterId,
          reason: validated.reason,
          allowed: false,
        });
        return { granted: false };
      }

      const connection = connectionsService
        .listConnections()
        .find((item) => item.metadata.id === validated.connectionId);

      const secretRef = decision ? connection?.metadata.secretRef : undefined;
      const granted = Boolean(decision && secretRef);

      auditService.logSecretAccess({
        connectionId: validated.connectionId,
        requesterId: validated.requesterId,
        reason: validated.reason,
        allowed: granted,
      });

      return {
        granted,
        secretRef: granted ? secretRef : undefined,
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_AUDIT_LIST,
    async (_event, request: unknown): Promise<ListAuditEventsResponse> => {
      const validated = ListAuditEventsRequestSchema.parse(request ?? {});
      return auditService.listEvents(validated);
    }
  );
};
