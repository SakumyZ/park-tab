import {
  DEFAULT_WORKSPACE_ID,
  SCHEMA_VERSION,
  type ParkTabData,
  type ParkTabSettings,
  type TabGroupRecord,
  type TabRecord
} from './types'
import { createId, nowIso } from './id'

const STORAGE_KEY = 'parkTabData'
const DEVICE_KEY = 'parkTabDeviceId'
export const SORT_ORDER_STEP = 1000

const defaultWebDav = {
  enabled: false,
  url: '',
  username: '',
  password: '',
  remotePath: '/park-tab/sync.json',
  autoSync: false,
  syncIntervalMinutes: 15
}

export const defaultSettings: ParkTabSettings = {
  closeTabsAfterSave: true,
  deleteAfterRestore: true,
  dedupeMode: 'ask',
  showArchived: false,
  restoreTarget: 'current-window',
  webdav: defaultWebDav
}

export async function getDeviceId(): Promise<string> {
  const stored = await chrome.storage.local.get(DEVICE_KEY)
  if (typeof stored[DEVICE_KEY] === 'string') {
    return stored[DEVICE_KEY]
  }

  const deviceId = createId('device')
  await chrome.storage.local.set({ [DEVICE_KEY]: deviceId })
  return deviceId
}

export async function getData(): Promise<ParkTabData> {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  const raw = stored[STORAGE_KEY]

  if (isParkTabData(raw)) {
    return {
      ...raw,
      settings: {
        ...defaultSettings,
        ...raw.settings,
        webdav: {
          ...defaultWebDav,
          ...raw.settings.webdav
        }
      }
    }
  }

  const deviceId = await getDeviceId()
  const createdAt = nowIso()
  const data: ParkTabData = {
    schemaVersion: SCHEMA_VERSION,
    workspace: {
      id: DEFAULT_WORKSPACE_ID,
      name: 'Default',
      createdAt,
      updatedAt: createdAt
    },
    devices: [
      {
        id: deviceId,
        name: 'Chromium Browser',
        browser: 'Chromium',
        createdAt,
        lastSeenAt: createdAt
      }
    ],
    groups: [],
    tabs: [],
    settings: defaultSettings,
    sync: {
      revision: 0,
      baseRevision: 0,
      lastSyncedAt: null,
      status: 'idle',
      error: null
    }
  }

  await saveData(data)
  return data
}

export async function saveData(data: ParkTabData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data })
}

export async function replaceData(imported: ParkTabData): Promise<void> {
  if (!isParkTabData(imported)) {
    throw new Error('导入文件不是有效的 Park Tab 数据。')
  }

  if (imported.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`不支持的 schemaVersion: ${imported.schemaVersion}`)
  }

  await createBackup()
  await saveData({
    ...imported,
    exportedAt: undefined,
    settings: {
      ...defaultSettings,
      ...imported.settings,
      webdav: {
        ...defaultWebDav,
        ...imported.settings.webdav,
        password: ''
      }
    }
  })
}

export async function createBackup(): Promise<void> {
  const data = await getData()
  const backups = await chrome.storage.local.get('parkTabBackups')
  const existing = Array.isArray(backups.parkTabBackups) ? backups.parkTabBackups : []
  const next = [{ createdAt: nowIso(), data }, ...existing].slice(0, 10)
  await chrome.storage.local.set({ parkTabBackups: next })
}

export async function mutateData(
  mutator: (data: ParkTabData, deviceId: string) => ParkTabData | void
): Promise<ParkTabData> {
  const [data, deviceId] = await Promise.all([getData(), getDeviceId()])
  const maybeNext = mutator(data, deviceId)
  const next = maybeNext ?? data
  next.sync.revision += 1
  next.sync.status = 'idle'
  next.sync.error = null
  touchDevice(next, deviceId)
  await saveData(next)
  return next
}

export function exportData(data: ParkTabData): ParkTabData {
  return {
    ...data,
    exportedAt: nowIso(),
    settings: {
      ...data.settings,
      webdav: {
        ...data.settings.webdav,
        password: ''
      }
    }
  }
}

export function activeGroups(data: ParkTabData): TabGroupRecord[] {
  return data.groups
    .filter(group => !group.deletedAt && (data.settings.showArchived || !group.archived))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function tabsForGroup(data: ParkTabData, groupId: string): TabRecord[] {
  return data.tabs
    .filter(tab => tab.groupId === groupId && !tab.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Returns a stable sort order value for the provided zero-based index.
 */
export function sortOrderFromIndex(index: number): number {
  return (index + 1) * SORT_ORDER_STEP
}

function touchDevice(data: ParkTabData, deviceId: string): void {
  const seenAt = nowIso()
  const device = data.devices.find(item => item.id === deviceId)
  if (device) {
    device.lastSeenAt = seenAt
    return
  }

  data.devices.push({
    id: deviceId,
    name: 'Chromium Browser',
    browser: 'Chromium',
    createdAt: seenAt,
    lastSeenAt: seenAt
  })
}

function isParkTabData(value: unknown): value is ParkTabData {
  if (!value || typeof value !== 'object') {
    return false
  }

  const data = value as ParkTabData
  return (
    data.schemaVersion === SCHEMA_VERSION &&
    Boolean(data.workspace) &&
    Array.isArray(data.groups) &&
    Array.isArray(data.tabs) &&
    Boolean(data.settings) &&
    Boolean(data.sync)
  )
}
