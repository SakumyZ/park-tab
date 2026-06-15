import {
  DEFAULT_WORKSPACE_ID,
  type ParkTabData,
  type SaveScope,
  type SaveTabsResult
} from './types'
import { createId, nowIso } from './id'
import { mutateData, SORT_ORDER_STEP, sortOrderFromIndex } from './storage'

const SKIPPED_URL_PREFIXES = ['chrome://', 'edge://', 'brave://', 'about:', 'chrome-extension://']

export async function saveTabs(scope: SaveScope): Promise<SaveTabsResult> {
  const tabs = await queryTabs(scope)
  const savableTabs = tabs.filter(tab => tab.url && !shouldSkipUrl(tab.url))

  if (savableTabs.length === 0) {
    return {
      groupId: null,
      savedCount: 0,
      skippedCount: tabs.length
    }
  }

  const firstTitle = getReadableTitle(savableTabs[0])
  const timestamp = nowIso()
  const groupTitle = `${formatGroupTime(new Date())} ${firstTitle}`.trim()
  const removableTabIds = savableTabs
    .map(tab => tab.id)
    .filter((id): id is number => typeof id === 'number')

  let groupId = ''
  let shouldClose = false

  await mutateData((data, deviceId) => {
    groupId = createId('group')
    const maxOrder = Math.max(0, ...data.groups.map(group => group.sortOrder))
    data.groups.push({
      id: groupId,
      workspaceId: DEFAULT_WORKSPACE_ID,
      title: groupTitle,
      note: '',
      sortOrder: maxOrder + SORT_ORDER_STEP,
      locked: false,
      archived: false,
      collapsed: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      revision: 1,
      updatedByDeviceId: deviceId
    })

    savableTabs.forEach((tab, index) => {
      data.tabs.push({
        id: createId('tab'),
        groupId,
        title: getReadableTitle(tab),
        url: tab.url ?? '',
        favIconUrl: tab.favIconUrl ?? null,
        sortOrder: sortOrderFromIndex(index),
        originalWindowId: tab.windowId ?? null,
        originalIndex: tab.index ?? null,
        pinned: Boolean(tab.pinned),
        active: Boolean(tab.active),
        createdAt: timestamp,
        updatedAt: timestamp,
        lastRestoredAt: null,
        deletedAt: null,
        revision: 1,
        updatedByDeviceId: deviceId
      })
    })

    shouldClose = data.settings.closeTabsAfterSave
  })

  if (shouldClose && removableTabIds.length > 0) {
    await chrome.tabs.remove(removableTabIds)
  }

  return {
    groupId,
    savedCount: savableTabs.length,
    skippedCount: tabs.length - savableTabs.length
  }
}

export async function restoreGroup(
  groupId: string,
  target: 'current-window' | 'new-window'
): Promise<void> {
  let urls: string[] = []

  await mutateData((data, deviceId) => {
    const group = data.groups.find(item => item.id === groupId && !item.deletedAt)
    if (!group) {
      throw new Error('分组不存在。')
    }

    urls = data.tabs
      .filter(tab => tab.groupId === groupId && !tab.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(tab => tab.url)

    const restoredAt = nowIso()
    data.tabs.forEach(tab => {
      if (tab.groupId === groupId && !tab.deletedAt) {
        tab.lastRestoredAt = restoredAt
        tab.updatedAt = restoredAt
        tab.revision += 1
        tab.updatedByDeviceId = deviceId
      }
    })

    // Only unlocked groups follow the delete-after-restore preference.
    if (!group.locked && data.settings.deleteAfterRestore) {
      data.tabs.forEach(tab => {
        if (tab.groupId === groupId) {
          tab.deletedAt = restoredAt
          tab.updatedAt = restoredAt
          tab.revision += 1
          tab.updatedByDeviceId = deviceId
        }
      })

      markGroupDeletedWhenEmpty(data, groupId, restoredAt, deviceId)
    }
  })

  if (urls.length === 0) {
    return
  }

  if (target === 'new-window') {
    await chrome.windows.create({ url: urls })
    return
  }

  await Promise.all(urls.map(url => chrome.tabs.create({ url, active: false })))
}

export async function restoreTab(
  tabId: string,
  target: 'current-window' | 'new-window'
): Promise<void> {
  let url = ''

  await mutateData((data, deviceId) => {
    const tab = data.tabs.find(item => item.id === tabId && !item.deletedAt)
    if (!tab) {
      throw new Error('标签不存在。')
    }

    const group = data.groups.find(item => item.id === tab.groupId && !item.deletedAt)
    if (!group) {
      throw new Error('分组不存在。')
    }

    url = tab.url
    const restoredAt = nowIso()
    tab.lastRestoredAt = restoredAt
    tab.updatedAt = restoredAt
    tab.revision += 1
    tab.updatedByDeviceId = deviceId

    // Only unlocked groups follow the delete-after-restore preference.
    if (!group.locked && data.settings.deleteAfterRestore) {
      tab.deletedAt = restoredAt
      markGroupDeletedWhenEmpty(data, group.id, restoredAt, deviceId)
    }
  })

  if (target === 'new-window') {
    await chrome.windows.create({ url })
    return
  }

  await chrome.tabs.create({ url, active: false })
}

async function queryTabs(scope: SaveScope): Promise<chrome.tabs.Tab[]> {
  if (scope === 'current-tab') {
    return chrome.tabs.query({ active: true, currentWindow: true })
  }

  if (scope === 'current-window') {
    return chrome.tabs.query({ currentWindow: true })
  }

  if (scope === 'highlighted-tabs') {
    return chrome.tabs.query({ currentWindow: true, highlighted: true })
  }

  return chrome.tabs.query({})
}

function shouldSkipUrl(url: string): boolean {
  return SKIPPED_URL_PREFIXES.some(prefix => url.startsWith(prefix))
}

/**
 * Deletes a group record after its last visible tab has been removed.
 */
function markGroupDeletedWhenEmpty(
  data: ParkTabData,
  groupId: string,
  deletedAt: string,
  deviceId: string
): void {
  const group = data.groups.find(item => item.id === groupId && !item.deletedAt)
  if (!group) {
    return
  }

  const hasRemainingTabs = data.tabs.some(tab => tab.groupId === groupId && !tab.deletedAt)
  if (hasRemainingTabs) {
    return
  }

  group.deletedAt = deletedAt
  group.updatedAt = deletedAt
  group.revision += 1
  group.updatedByDeviceId = deviceId
}

function getReadableTitle(tab: chrome.tabs.Tab): string {
  return tab.title?.trim() || tab.url || '未命名标签'
}

function formatGroupTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}
