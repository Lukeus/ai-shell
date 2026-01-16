import type {
  Connection,
  ConnectionConfig,
  ConnectionField,
  ConnectionProvider,
  ConnectionScope,
} from 'packages-api-contracts';

export interface ConnectionFormValues {
  providerId: string;
  scope: ConnectionScope;
  displayName: string;
  config: ConnectionConfig;
  secretValue?: string;
}

export interface ConnectionDetailProps {
  mode: 'create' | 'view';
  connection: Connection | null;
  providers: ConnectionProvider[];
  isBusy: boolean;
  onCreate: (values: ConnectionFormValues) => Promise<void>;
  onUpdate: (connectionId: string, values: ConnectionFormValues) => Promise<void>;
  onDelete: (connectionId: string) => Promise<void>;
  onReplaceSecret: (connectionId: string, secretValue: string) => Promise<void>;
}

export type ConnectionDetailViewState = {
  mode: 'create' | 'view';
  connection: Connection | null;
  providers: ConnectionProvider[];
  provider: ConnectionProvider | undefined;
  providerId: string;
  scope: ConnectionScope;
  displayName: string;
  configValues: ConnectionConfig;
  secretValue: string;
  replaceSecretValue: string;
  secretField: ConnectionField | null;
  validationMessages: string[];
  canSubmit: boolean;
  isBusy: boolean;
};

export type ConnectionDetailViewActions = {
  onProviderChange: (providerId: string) => void;
  onScopeChange: (scope: ConnectionScope) => void;
  onDisplayNameChange: (displayName: string) => void;
  onConfigChange: (fieldId: string, value: string | number | boolean) => void;
  onSecretChange: (value: string) => void;
  onReplaceSecretChange: (value: string) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onReplaceSecret: () => void;
};

export type ConnectionDetailViewProps = {
  state: ConnectionDetailViewState;
  actions: ConnectionDetailViewActions;
};
