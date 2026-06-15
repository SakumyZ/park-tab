import { exportData, getData, mutateData, replaceData } from '../lib/storage'
import { syncWithWebDav } from '../lib/sync'
import { restoreGroup, restoreTab, saveTabs } from '../lib/tabs'
import { testWebDavConnection } from '../lib/webdav'
import type { RuntimeMessage, SaveTabsPayload, WebDavSettings } from '../lib/types'

interface GroupReorderPayload {
  updates: Array<{ groupId: string; sortOrder: number }>
}

interface TabReorderPayload {
  updates: Array<{ tabId: string; groupId: string; sortOrder: number }>
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: 'save-current-tab',
    title: '保存当前标签到 Park Tab',
    contexts: ['page']
  })
  chrome.contextMenus.create({
    id: 'save-current-window',
    title: '保存当前窗口到 Park Tab',
    contexts: ['action']
  })
  await getData()
})

chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'save-current-tab') {
    void saveTabs('current-tab')
  }
  if (info.menuItemId === 'save-current-window') {
    void saveTabs('current-window')
  }
})

chrome.commands.onCommand.addListener(command => {
  if (command === 'save-current-window') {
    void saveTabs('current-window')
  }
})

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'park-tab-auto-sync') {
    void syncWithWebDav()
  }
})

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(result => sendResponse({ ok: true, result }))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '未知错误'
      sendResponse({ ok: false, error: message })
    })

  return true
})

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case 'data:get':
      return getData()
    case 'data:export':
      return exportData(await getData())
    case 'data:import':
      await replaceData(message.payload as never)
      return getData()
    case 'tabs:save':
      return saveTabs((message.payload as SaveTabsPayload).scope)
    case 'tabs:restore-group': {
      const payload = message.payload as {
        groupId: string
        target: 'current-window' | 'new-window'
      }
      await restoreGroup(payload.groupId, payload.target)
      return getData()
    }
    case 'tabs:restore-tab': {
      const payload = message.payload as { tabId: string; target: 'current-window' | 'new-window' }
      await restoreTab(payload.tabId, payload.target)
      return getData()
    }
    case 'group:update': {
      const payload = message.payload as { groupId: string; patch: Record<string, unknown> }
      return mutateData((data, deviceId) => {
        const group = data.groups.find(item => item.id === payload.groupId)
        if (!group) {
          throw new Error('分组不存在。')
        }
        Object.assign(group, payload.patch, {
          updatedAt: new Date().toISOString(),
          revision: group.revision + 1,
          updatedByDeviceId: deviceId
        })
      })
    }
    case 'groups:reorder': {
      const payload = message.payload as GroupReorderPayload
      return mutateData((data, deviceId) => applyGroupReorder(data, deviceId, payload))
    }
    case 'tab:update': {
      const payload = message.payload as { tabId: string; patch: Record<string, unknown> }
      return mutateData((data, deviceId) => {
        const tab = data.tabs.find(item => item.id === payload.tabId)
        if (!tab) {
          throw new Error('标签不存在。')
        }
        Object.assign(tab, payload.patch, {
          updatedAt: new Date().toISOString(),
          revision: tab.revision + 1,
          updatedByDeviceId: deviceId
        })
      })
    }
    case 'tabs:reorder': {
      const payload = message.payload as TabReorderPayload
      return mutateData((data, deviceId) => applyTabReorder(data, deviceId, payload))
    }
    case 'settings:update':
      return mutateData(data => {
        data.settings = {
          ...data.settings,
          ...(message.payload as object)
        }
        const interval = data.settings.webdav.syncIntervalMinutes
        if (data.settings.webdav.enabled && data.settings.webdav.autoSync) {
          void chrome.alarms.create('park-tab-auto-sync', {
            periodInMinutes: Math.max(5, interval)
          })
        } else {
          void chrome.alarms.clear('park-tab-auto-sync')
        }
      })
    case 'sync:test-webdav':
      await testWebDavConnection(message.payload as WebDavSettings)
      return true
    case 'sync:run':
      return syncWithWebDav()
    case 'manager:open':
      await chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') })
      return true
    default:
      throw new Error(`未知消息类型：${message.type}`)
  }
}

/**
 * Applies a batch of reordered groups inside a single storage mutation.
 */
function applyGroupReorder(
  data: Awaited<ReturnType<typeof getData>>,
  deviceId: string,
  payload: GroupReorderPayload
): void {
  const updatedAt = new Date().toISOString()

  payload.updates.forEach(update => {
    const group = data.groups.find(item => item.id === update.groupId && !item.deletedAt)
    if (!group) {
      // Reorder requests should fail fast when the dragged group disappeared concurrently.
      throw new Error('分组不存在。')
    }

    group.sortOrder = update.sortOrder
    group.updatedAt = updatedAt
    group.revision += 1
    group.updatedByDeviceId = deviceId
  })
}

/**
 * Applies tab reordering and cross-group moves inside a single storage mutation.
 */
function applyTabReorder(
  data: Awaited<ReturnType<typeof getData>>,
  deviceId: string,
  payload: TabReorderPayload
): void {
  const updatedAt = new Date().toISOString()

  payload.updates.forEach(update => {
    const group = data.groups.find(item => item.id === update.groupId && !item.deletedAt)
    if (!group) {
      // Cross-group moves must stop when the drop target vanished.
      throw new Error('目标分组不存在。')
    }

    const tab = data.tabs.find(item => item.id === update.tabId && !item.deletedAt)
    if (!tab) {
      // Reorder requests should fail fast when the dragged tab disappeared concurrently.
      throw new Error('标签不存在。')
    }

    tab.groupId = update.groupId
    tab.sortOrder = update.sortOrder
    tab.updatedAt = updatedAt
    tab.revision += 1
    tab.updatedByDeviceId = deviceId
  })
}
