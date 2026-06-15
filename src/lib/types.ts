export const SCHEMA_VERSION = 1;
export const DEFAULT_WORKSPACE_ID = 'workspace_default';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'failed' | 'conflict';
export type DedupeMode = 'ask' | 'keep' | 'remove-in-group' | 'remove-global';
export type SaveScope = 'current-tab' | 'highlighted-tabs' | 'current-window' | 'all-windows';

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  browser: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface TabGroupRecord {
  id: string;
  workspaceId: string;
  title: string;
  note: string;
  sortOrder: number;
  locked: boolean;
  archived: boolean;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
  updatedByDeviceId: string;
}

export interface TabRecord {
  id: string;
  groupId: string;
  title: string;
  url: string;
  favIconUrl: string | null;
  sortOrder: number;
  originalWindowId: number | null;
  originalIndex: number | null;
  pinned: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastRestoredAt: string | null;
  deletedAt: string | null;
  revision: number;
  updatedByDeviceId: string;
}

export interface ParkTabSettings {
  closeTabsAfterSave: boolean;
  deleteAfterRestore: boolean;
  dedupeMode: DedupeMode;
  showArchived: boolean;
  restoreTarget: 'current-window' | 'new-window';
  webdav: WebDavSettings;
}

export interface WebDavSettings {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  remotePath: string;
  autoSync: boolean;
  syncIntervalMinutes: number;
}

export interface SyncMeta {
  revision: number;
  baseRevision: number;
  lastSyncedAt: string | null;
  status: SyncStatus;
  error: string | null;
}

export interface ParkTabData {
  schemaVersion: number;
  exportedAt?: string;
  workspace: Workspace;
  devices: DeviceInfo[];
  groups: TabGroupRecord[];
  tabs: TabRecord[];
  settings: ParkTabSettings;
  sync: SyncMeta;
}

export interface SaveTabsPayload {
  scope: SaveScope;
}

export interface SaveTabsResult {
  groupId: string | null;
  savedCount: number;
  skippedCount: number;
}

export interface RuntimeMessage<T = unknown> {
  type: string;
  payload?: T;
}
