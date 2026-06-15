import { exportData, getData, saveData } from './storage';
import { buildWebDavUrl } from './webdav';
import type { ParkTabData, TabGroupRecord, TabRecord, WebDavSettings } from './types';

export async function syncWithWebDav(): Promise<ParkTabData> {
  const local = await getData();
  const settings = local.settings.webdav;

  if (!settings.enabled) {
    throw new Error('WebDAV 同步未启用。');
  }

  if (!settings.url) {
    throw new Error('请先填写 WebDAV 地址。');
  }

  await saveData({
    ...local,
    sync: {
      ...local.sync,
      status: 'syncing',
      error: null
    }
  });

  try {
    const remote = await downloadRemoteData(settings);
    const merged = remote ? mergeData(local, remote) : exportData(local);
    const syncedAt = new Date().toISOString();
    const next: ParkTabData = {
      ...merged,
      exportedAt: undefined,
      settings: {
        ...merged.settings,
        webdav: {
          ...local.settings.webdav
        }
      },
      sync: {
        revision: Math.max(local.sync.revision, remote?.sync.revision ?? 0) + 1,
        baseRevision: Math.max(local.sync.revision, remote?.sync.revision ?? 0) + 1,
        lastSyncedAt: syncedAt,
        status: 'success',
        error: null
      }
    };

    await uploadRemoteData(settings, exportData(next));
    await saveData(next);
    return next;
  } catch (error) {
    const latest = await getData();
    const message = error instanceof Error ? error.message : '同步失败';
    const failed: ParkTabData = {
      ...latest,
      sync: {
        ...latest.sync,
        status: 'failed',
        error: message
      }
    };
    await saveData(failed);
    throw error;
  }
}

async function downloadRemoteData(settings: WebDavSettings): Promise<ParkTabData | null> {
  const response = await fetch(buildWebDavUrl(settings), {
    method: 'GET',
    headers: createHeaders(settings)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`下载远程数据失败：HTTP ${response.status}`);
  }

  const remote = (await response.json()) as ParkTabData;
  if (!remote || remote.schemaVersion !== 1 || !Array.isArray(remote.groups) || !Array.isArray(remote.tabs)) {
    throw new Error('远程文件不是有效的 Park Tab 数据。');
  }

  return remote;
}

async function uploadRemoteData(settings: WebDavSettings, data: ParkTabData): Promise<void> {
  const response = await fetch(buildWebDavUrl(settings), {
    method: 'PUT',
    headers: {
      ...createHeaders(settings),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data, null, 2)
  });

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(`上传远程数据失败：HTTP ${response.status}`);
  }
}

function mergeData(local: ParkTabData, remote: ParkTabData): ParkTabData {
  const groups = mergeById(local.groups, remote.groups);
  const tabs = mergeById(local.tabs, remote.tabs);
  const devices = mergeById(local.devices, remote.devices);
  const workspace =
    Date.parse(local.workspace.updatedAt) >= Date.parse(remote.workspace.updatedAt)
      ? local.workspace
      : remote.workspace;

  return {
    ...local,
    workspace,
    devices,
    groups,
    tabs,
    settings: {
      ...remote.settings,
      ...local.settings,
      webdav: local.settings.webdav
    }
  };
}

function mergeById<T extends { id: string; updatedAt?: string; lastSeenAt?: string }>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();

  for (const item of remote) {
    merged.set(item.id, item);
  }

  for (const item of local) {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      continue;
    }

    const localTime = Date.parse(item.updatedAt ?? item.lastSeenAt ?? '');
    const remoteTime = Date.parse(existing.updatedAt ?? existing.lastSeenAt ?? '');
    merged.set(item.id, localTime >= remoteTime ? item : existing);
  }

  return Array.from(merged.values()).sort(sortRecords);
}

function sortRecords(a: TabGroupRecord | TabRecord | { id: string }, b: TabGroupRecord | TabRecord | { id: string }): number {
  const aOrder = 'sortOrder' in a ? a.sortOrder : 0;
  const bOrder = 'sortOrder' in b ? b.sortOrder : 0;
  return aOrder - bOrder || a.id.localeCompare(b.id);
}

function createHeaders(settings: WebDavSettings): HeadersInit {
  const headers: Record<string, string> = {};
  if (settings.username || settings.password) {
    headers.Authorization = `Basic ${btoa(`${settings.username}:${settings.password}`)}`;
  }
  return headers;
}
