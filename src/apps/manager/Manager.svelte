<script lang="ts">
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import Icon from '../../lib/components/Icon.svelte'
  import { sendMessage } from '../../lib/runtime'
  import { activeGroups, sortOrderFromIndex, tabsForGroup } from '../../lib/storage'
  import type { ParkTabData, TabGroupRecord, TabRecord } from '../../lib/types'

  type DropPosition = 'before' | 'after' | 'append'
  type GroupDropPosition = Exclude<DropPosition, 'append'>
  type AlertKind = 'status' | 'error'

  const ALERT_AUTO_CLOSE_MS = 3000

  interface GroupReorderUpdate {
    groupId: string
    sortOrder: number
  }

  interface TabReorderUpdate {
    tabId: string
    groupId: string
    sortOrder: number
  }

  interface DraggedGroupState {
    groupId: string
  }

  interface DraggedTabState {
    tabId: string
    sourceGroupId: string
  }

  interface GroupDropState {
    targetGroupId: string
    position: GroupDropPosition
  }

  interface TabDropState {
    targetGroupId: string
    targetTabId: string | null
    position: DropPosition
  }

  let data: ParkTabData | null = null
  let query = ''
  let error = ''
  let status = ''
  let busyId = ''
  let groups: TabGroupRecord[] = []
  let tabsByGroup: Record<string, TabRecord[]> = {}
  let rawGroupCount = 0
  let rawTabCount = 0
  let dragBusy = false
  let draggingGroup: DraggedGroupState | null = null
  let draggingTab: DraggedTabState | null = null
  let groupDropState: GroupDropState | null = null
  let tabDropState: TabDropState | null = null
  let editingGroupId = ''
  let editingGroupTitle = ''
  let editingTabId = ''
  let editingTabTitle = ''
  let statusTimer: number | null = null
  let errorTimer: number | null = null

  onMount(() => {
    void loadData()
    void pinCurrentManagerTab()

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === 'local' && changes.parkTabData?.newValue) {
        data = changes.parkTabData.newValue as ParkTabData
        recomputeView()
      }
    }

    const handleFocus = () => {
      void loadData()
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
      window.removeEventListener('focus', handleFocus)
      clearAlertTimer('status')
      clearAlertTimer('error')
    }
  })

  $: if (status) {
    scheduleAlertDismiss('status')
  } else {
    clearAlertTimer('status')
  }

  $: if (error) {
    scheduleAlertDismiss('error')
  } else {
    clearAlertTimer('error')
  }

  async function loadData() {
    try {
      const [runtimeData, storageData] = await Promise.all([
        sendMessage<ParkTabData>('data:get'),
        readStoredData()
      ])
      data = pickMoreCompleteData(runtimeData, storageData)
      recomputeView()
    } catch (err) {
      error = err instanceof Error ? err.message : '加载失败'
    }
  }

  /**
   * Clears the auto-dismiss timer for the requested alert kind.
   */
  function clearAlertTimer(kind: AlertKind): void {
    // Status alerts and error alerts track separate timers.
    if (kind === 'status' && statusTimer !== null) {
      window.clearTimeout(statusTimer)
      statusTimer = null
      return
    }

    // Error alerts also need an isolated timer so both channels stay independent.
    if (kind === 'error' && errorTimer !== null) {
      window.clearTimeout(errorTimer)
      errorTimer = null
    }
  }

  /**
   * Schedules the requested alert to close automatically after the default delay.
   */
  function scheduleAlertDismiss(kind: AlertKind): void {
    clearAlertTimer(kind)

    // Status alerts auto-close after the shared default timeout.
    if (kind === 'status') {
      statusTimer = window.setTimeout(() => {
        status = ''
      }, ALERT_AUTO_CLOSE_MS)
      return
    }

    // Error alerts follow the same timeout but maintain a separate timer instance.
    errorTimer = window.setTimeout(() => {
      error = ''
    }, ALERT_AUTO_CLOSE_MS)
  }

  /**
   * Closes the requested alert immediately.
   */
  function dismissAlert(kind: AlertKind): void {
    clearAlertTimer(kind)

    // Manual close resets the corresponding alert channel only.
    if (kind === 'status') {
      status = ''
      return
    }

    // Error close should not affect status messages.
    error = ''
  }

  async function readStoredData(): Promise<ParkTabData | null> {
    const stored = await chrome.storage.local.get('parkTabData')
    const raw = stored.parkTabData
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as ParkTabData).groups) &&
      Array.isArray((raw as ParkTabData).tabs)
    ) {
      return raw as ParkTabData
    }
    return null
  }

  function pickMoreCompleteData(
    runtimeData: ParkTabData,
    storageData: ParkTabData | null
  ): ParkTabData {
    if (!storageData) {
      return runtimeData
    }

    const runtimeCount = runtimeData.groups.filter(group => !group.deletedAt).length
    const storageCount = storageData.groups.filter(group => !group.deletedAt).length
    return storageCount > runtimeCount ? storageData : runtimeData
  }

  async function pinCurrentManagerTab() {
    try {
      const tab = await chrome.tabs.getCurrent()
      if (tab?.id && !tab.pinned) {
        await chrome.tabs.update(tab.id, { pinned: true })
      }
    } catch {
      // Pinning is a convenience only; the manager must keep working if it fails.
    }
  }

  /**
   * 获取链接的 favicon URL
   * @param url - 标签网址
   */
  function getFaviconUrl(url: string): string {
    // 若 url 为空，直接返回空字符串
    if (!url) {
      return ''
    }

    try {
      // 检查当前是否为 Chrome 扩展环境且支持 getURL 方法
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'))
        faviconUrl.searchParams.set('pageUrl', url)
        faviconUrl.searchParams.set('size', '16')
        return faviconUrl.toString()
      } else {
        // 非 Chrome 扩展环境（例如开发调试环境）下，降级使用谷歌的公开 favicon API
        const domain = new URL(url).hostname
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
      }
    } catch {
      // 若 URL 解析或其它处理发生异常，捕获并返回空字符串
      return ''
    }
  }

  function recomputeView() {
    if (!data) {
      groups = []
      tabsByGroup = {}
      rawGroupCount = 0
      rawTabCount = 0
      return
    }

    rawGroupCount = data.groups.filter(group => !group.deletedAt).length
    rawTabCount = data.tabs.filter(tab => !tab.deletedAt).length
    const keyword = query.trim().toLowerCase()
    const visibleTabsByGroup: Record<string, TabRecord[]> = {}
    const visibleGroups = activeGroups(data).filter(group => {
      const tabs = getVisibleTabs(group.id, keyword)
      visibleTabsByGroup[group.id] = tabs
      if (!keyword) return true
      return group.title.toLowerCase().includes(keyword) || tabs.length > 0
    })

    groups = visibleGroups
    tabsByGroup = visibleTabsByGroup
  }

  function getVisibleTabs(groupId: string, keyword: string): TabRecord[] {
    if (!data) return []
    return tabsForGroup(data, groupId).filter(tab => {
      if (!keyword) return true
      const group = data?.groups.find(item => item.id === groupId)
      return [tab.title, tab.url, group?.title ?? ''].some(text =>
        text.toLowerCase().includes(keyword)
      )
    })
  }

  async function updateGroup(groupId: string, patch: Record<string, unknown>) {
    busyId = groupId
    error = ''
    try {
      data = await sendMessage<ParkTabData>('group:update', { groupId, patch })
      recomputeView()
    } catch (err) {
      error = err instanceof Error ? err.message : '更新失败'
    } finally {
      busyId = ''
    }
  }

  async function updateTab(tabId: string, patch: Record<string, unknown>) {
    busyId = tabId
    error = ''
    try {
      data = await sendMessage<ParkTabData>('tab:update', { tabId, patch })
      recomputeView()
    } catch (err) {
      error = err instanceof Error ? err.message : '更新失败'
    } finally {
      busyId = ''
    }
  }

  async function restoreGroup(groupId: string) {
    const restoredGroup = groups.find(group => group.id === groupId)
    busyId = groupId
    status = ''
    error = ''
    try {
      data = await sendMessage<ParkTabData>('tabs:restore-group', {
        groupId,
        target: data?.settings.restoreTarget ?? 'current-window'
      })
      recomputeView()
      // Locked groups stay visible after restore, while others are removed from the list.
      status = restoredGroup?.locked ? '分组已恢复' : '分组已恢复并从列表移除'
    } catch (err) {
      error = err instanceof Error ? err.message : '恢复失败'
    } finally {
      busyId = ''
    }
  }

  async function restoreTab(tabId: string) {
    busyId = tabId
    status = ''
    error = ''
    try {
      data = await sendMessage<ParkTabData>('tabs:restore-tab', {
        tabId,
        target: data?.settings.restoreTarget ?? 'current-window'
      })
      recomputeView()
      status = '标签已恢复'
    } catch (err) {
      error = err instanceof Error ? err.message : '恢复失败'
    } finally {
      busyId = ''
    }
  }

  function confirmDeleteGroup(group: TabGroupRecord) {
    const message = group.locked ? '该分组已锁定，仍要删除吗？' : '确定删除该分组吗？'
    if (confirm(message)) {
      void updateGroup(group.id, { deletedAt: new Date().toISOString() })
    }
  }

  function confirmDeleteTab(tab: TabRecord) {
    if (confirm('确定删除该标签吗？')) {
      void updateTab(tab.id, { deletedAt: new Date().toISOString() })
    }
  }

  /**
   * Switches a group header into inline editing mode.
   */
  function startGroupTitleEditing(group: TabGroupRecord): void {
    editingGroupId = group.id
    editingGroupTitle = group.title
  }

  /**
   * Leaves group title editing mode without persisting changes.
   */
  function cancelGroupTitleEditing(): void {
    editingGroupId = ''
    editingGroupTitle = ''
  }

  /**
   * Persists the pending group title edit.
   */
  async function saveGroupTitle(group: TabGroupRecord): Promise<void> {
    // Ignore blur and submit events that belong to an already-closed edit session.
    if (editingGroupId !== group.id) {
      return
    }

    const nextTitle = editingGroupTitle.trim() || group.title
    await updateGroup(group.id, { title: nextTitle })
    cancelGroupTitleEditing()
  }

  /**
   * Handles Enter and Escape shortcuts for group title editing.
   */
  function handleGroupTitleKeydown(event: KeyboardEvent, group: TabGroupRecord): void {
    // Enter saves the current draft immediately.
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveGroupTitle(group)
      return
    }

    // Escape abandons the draft and restores the read-only header.
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelGroupTitleEditing()
    }
  }

  /**
   * Switches a tab row into inline editing mode.
   */
  function startTabTitleEditing(tab: TabRecord): void {
    editingTabId = tab.id
    editingTabTitle = tab.title
  }

  /**
   * Leaves inline editing mode without changing the stored title.
   */
  function cancelTabTitleEditing(): void {
    editingTabId = ''
    editingTabTitle = ''
  }

  /**
   * Persists the pending inline title edit for a single tab.
   */
  async function saveTabTitle(tab: TabRecord): Promise<void> {
    // Ignore blur and submit events that belong to an already-closed edit session.
    if (editingTabId !== tab.id) {
      return
    }

    const nextTitle = editingTabTitle.trim() || tab.title
    await updateTab(tab.id, { title: nextTitle })
    cancelTabTitleEditing()
  }

  /**
   * Handles Enter and Escape shortcuts for inline title editing.
   */
  function handleTabTitleKeydown(event: KeyboardEvent, tab: TabRecord): void {
    // Enter saves the current draft immediately.
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveTabTitle(tab)
      return
    }

    // Escape abandons the draft and restores the read-only row.
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelTabTitleEditing()
    }
  }

  /**
   * Returns true when the current filtered view should not allow reordering.
   */
  function isDragDisabled(): boolean {
    return Boolean(query.trim()) || dragBusy
  }

  /**
   * Clears all transient drag markers after a completed or cancelled interaction.
   */
  function resetDragState(): void {
    draggingGroup = null
    draggingTab = null
    groupDropState = null
    tabDropState = null
  }

  /**
   * Resolves a before-or-after drop position from the current pointer location.
   */
  function getDropPosition(event: DragEvent): GroupDropPosition {
    const element = event.currentTarget
    if (!(element instanceof HTMLElement)) {
      return 'after'
    }

    const bounds = element.getBoundingClientRect()
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
  }

  /**
   * Returns the tab record from the current transient view state or canonical data.
   */
  function getTabRecord(tabId: string): TabRecord | undefined {
    for (const groupTabs of Object.values(tabsByGroup)) {
      const tab = groupTabs.find(item => item.id === tabId)
      if (tab) {
        return tab
      }
    }

    return data?.tabs.find(item => item.id === tabId && !item.deletedAt)
  }

  /**
   * Builds normalized sort orders for the current group sequence.
   */
  function buildGroupReorderUpdates(): GroupReorderUpdate[] {
    return groups.map((group, index) => ({
      groupId: group.id,
      sortOrder: sortOrderFromIndex(index)
    }))
  }

  /**
   * Builds normalized tab positions for the current visible group layout.
   */
  function buildTabReorderUpdates(): TabReorderUpdate[] {
    const updates: TabReorderUpdate[] = []

    groups.forEach(group => {
      ;(tabsByGroup[group.id] ?? []).forEach((tab, index) => {
        updates.push({
          tabId: tab.id,
          groupId: group.id,
          sortOrder: sortOrderFromIndex(index)
        })
      })
    })

    return updates
  }

  /**
   * Applies a pending group drop to local UI state before persistence.
   */
  function applyGroupDrop(targetGroupId: string, position: GroupDropPosition): void {
    const currentDrag = draggingGroup
    if (!currentDrag || currentDrag.groupId === targetGroupId) {
      return
    }

    const sourceIndex = groups.findIndex(group => group.id === currentDrag.groupId)
    const targetIndex = groups.findIndex(group => group.id === targetGroupId)
    if (sourceIndex === -1 || targetIndex === -1) {
      return
    }

    const nextGroups = [...groups]
    const [movedGroup] = nextGroups.splice(sourceIndex, 1)
    const nextTargetIndex = nextGroups.findIndex(group => group.id === targetGroupId)
    const insertIndex = position === 'after' ? nextTargetIndex + 1 : nextTargetIndex
    nextGroups.splice(insertIndex, 0, movedGroup)
    groups = nextGroups
  }

  /**
   * Applies a pending tab drop to local UI state before persistence.
   */
  function applyTabDrop(
    targetGroupId: string,
    targetTabId: string | null,
    position: DropPosition
  ): void {
    const currentDrag = draggingTab
    if (!currentDrag) {
      return
    }

    const draggedTab = getTabRecord(currentDrag.tabId)
    if (!draggedTab) {
      return
    }

    const sourceGroupId = currentDrag.sourceGroupId
    const sourceTabs = [...(tabsByGroup[sourceGroupId] ?? [])].filter(
      tab => tab.id !== currentDrag.tabId
    )
    const targetTabs =
      sourceGroupId === targetGroupId ? sourceTabs : [...(tabsByGroup[targetGroupId] ?? [])]

    // Dropping on the same tab without changing edge should be treated as a no-op.
    if (sourceGroupId === targetGroupId && targetTabId === currentDrag.tabId) {
      return
    }

    let insertIndex = targetTabs.length
    if (targetTabId) {
      const matchedIndex = targetTabs.findIndex(tab => tab.id === targetTabId)
      if (matchedIndex !== -1) {
        insertIndex = position === 'after' ? matchedIndex + 1 : matchedIndex
      }
    }

    const movedTab: TabRecord = {
      ...draggedTab,
      groupId: targetGroupId
    }
    const nextTargetTabs = [...targetTabs]
    nextTargetTabs.splice(insertIndex, 0, movedTab)

    tabsByGroup = {
      ...tabsByGroup,
      [sourceGroupId]: sourceGroupId === targetGroupId ? nextTargetTabs : sourceTabs,
      [targetGroupId]: nextTargetTabs
    }
  }

  /**
   * Persists the current group order through a single background message.
   */
  async function persistGroupOrder(): Promise<void> {
    dragBusy = true
    error = ''

    try {
      data = await sendMessage<ParkTabData>('groups:reorder', {
        updates: buildGroupReorderUpdates()
      })
      recomputeView()
    } catch (err) {
      const message = err instanceof Error ? err.message : '拖拽排序失败'
      await loadData()
      error = message
    } finally {
      dragBusy = false
      resetDragState()
    }
  }

  /**
   * Persists the current tab layout through a single background message.
   */
  async function persistTabOrder(): Promise<void> {
    dragBusy = true
    error = ''

    try {
      data = await sendMessage<ParkTabData>('tabs:reorder', {
        updates: buildTabReorderUpdates()
      })
      recomputeView()
    } catch (err) {
      const message = err instanceof Error ? err.message : '标签移动失败'
      await loadData()
      error = message
    } finally {
      dragBusy = false
      resetDragState()
    }
  }

  /**
   * Starts a group drag session from the explicit drag handle.
   */
  function handleGroupDragStart(event: DragEvent, groupId: string): void {
    if (isDragDisabled()) {
      event.preventDefault()
      return
    }

    draggingGroup = { groupId }
    draggingTab = null
    tabDropState = null

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', groupId)
    }
  }

  /**
   * Tracks the active group drop marker while the pointer moves over a group header.
   */
  function handleGroupHeaderDragOver(event: DragEvent, groupId: string): void {
    // Group drags use before-or-after markers on the target header.
    if (draggingGroup) {
      event.preventDefault()
      groupDropState = {
        targetGroupId: groupId,
        position: getDropPosition(event)
      }
      return
    }

    // Tab drags treat the header as an append target for the whole group.
    if (draggingTab) {
      event.preventDefault()
      tabDropState = {
        targetGroupId: groupId,
        targetTabId: null,
        position: 'append'
      }
    }
  }

  /**
   * Commits either a group reorder or a tab append when dropping on a group header.
   */
  function handleGroupHeaderDrop(event: DragEvent, groupId: string): void {
    // Dropping a group on a header reorders the cards.
    if (draggingGroup) {
      event.preventDefault()
      applyGroupDrop(groupId, getDropPosition(event))
      void persistGroupOrder()
      return
    }

    // Dropping a tab on a header appends the tab to that group.
    if (draggingTab) {
      event.preventDefault()
      applyTabDrop(groupId, null, 'append')
      void persistTabOrder()
    }
  }

  /**
   * Starts a tab drag session from the explicit tab handle.
   */
  function handleTabDragStart(event: DragEvent, tabId: string, sourceGroupId: string): void {
    if (isDragDisabled()) {
      event.preventDefault()
      return
    }

    draggingTab = { tabId, sourceGroupId }
    draggingGroup = null
    groupDropState = null

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', tabId)
    }
  }

  /**
   * Tracks a tab insertion marker while dragging over a tab row.
   */
  function handleTabRowDragOver(event: DragEvent, groupId: string, tabId: string): void {
    if (!draggingTab) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    tabDropState = {
      targetGroupId: groupId,
      targetTabId: tabId,
      position: getDropPosition(event)
    }
  }

  /**
   * Commits a tab reorder or cross-group move when dropping on a tab row.
   */
  function handleTabRowDrop(event: DragEvent, groupId: string, tabId: string): void {
    if (!draggingTab) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    applyTabDrop(groupId, tabId, getDropPosition(event))
    void persistTabOrder()
  }

  /**
   * Tracks append drops for empty lists and the list tail area.
   */
  function handleTabListDragOver(event: DragEvent, groupId: string): void {
    if (!draggingTab) {
      return
    }

    event.preventDefault()
    tabDropState = {
      targetGroupId: groupId,
      targetTabId: null,
      position: 'append'
    }
  }

  /**
   * Commits a tab append when dropping on a list container or empty state.
   */
  function handleTabListDrop(event: DragEvent, groupId: string): void {
    if (!draggingTab) {
      return
    }

    event.preventDefault()
    applyTabDrop(groupId, null, 'append')
    void persistTabOrder()
  }

  $: if (data || query) {
    recomputeView()
  }
</script>

<main class="min-h-screen bg-panel">
  <header class="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2.5">
      <div class="flex items-baseline gap-2 flex-shrink-0">
        <h1 class="text-base font-bold text-ink tracking-tight">Park Tab</h1>
        <!-- 响应式显示副标题：仅在屏幕宽度大于 sm 时展示，以节省垂直与水平空间 -->
        <span class="text-xs text-muted hidden sm:inline">本地优先的标签页停车场</span>
      </div>
      <div class="flex items-center gap-2.5 flex-1 justify-end max-w-md">
        <input
          class="field py-1 text-xs w-64"
          bind:value={query}
          placeholder="搜索标题、URL 或分组"
          on:input={recomputeView}
        />
        <a class="btn btn-icon flex-shrink-0" href="/options.html" target="_self" aria-label="设置" title="设置">
          <Icon name="settings" />
        </a>
      </div>
    </div>
  </header>

  <div class="mx-auto max-w-6xl px-5 py-5">
    {#if query.trim()}
      <p class="mb-3 text-xs text-muted">搜索结果视图下已禁用拖拽，清空搜索后可调整顺序。</p>
    {/if}


    {#if !data}
      <p class="text-sm text-muted">加载中...</p>
    {:else if groups.length === 0}
      <section class="rounded-md border border-dashed border-line bg-white px-5 py-12 text-center">
        <h2 class="text-base font-semibold text-ink">还没有保存的标签</h2>
        <p class="mt-1 text-sm text-muted">从扩展弹窗保存当前窗口后，会在这里看到分组。</p>
        <p class="mt-2 text-xs text-muted">当前读取到 {rawGroupCount} 组 / {rawTabCount} 个标签</p>
        <button class="btn mt-4 gap-2" type="button" on:click={loadData}>
          <Icon name="refresh" />
          刷新数据
        </button>
      </section>
    {:else}
      <section class="grid gap-5">
        {#each groups as group (group.id)}
          {@const tabs = tabsByGroup[group.id] ?? []}
          <article
            class={`rounded-md border border-line bg-white shadow-sm ${groupDropState?.targetGroupId === group.id ? (groupDropState.position === 'before' ? 'drop-before' : 'drop-after') : ''} ${tabDropState?.targetGroupId === group.id && !tabDropState.targetTabId ? 'drop-inside' : ''}`}
          >
            <div
              class="flex flex-wrap items-center gap-1.5 border-b border-line bg-slate-50/70 px-3"
              role="presentation"
              on:dragover={event => handleGroupHeaderDragOver(event, group.id)}
              on:drop={event => handleGroupHeaderDrop(event, group.id)}
            >
              <button
                class="btn btn-icon btn-handle"
                type="button"
                draggable={!isDragDisabled()}
                aria-label={`拖拽排序分组 ${group.title}`}
                title="拖拽排序分组"
                on:dragstart={event => handleGroupDragStart(event, group.id)}
                on:dragend={resetDragState}
              >
                <Icon name="grip-vertical" />
              </button>
              <button
                class="btn btn-icon"
                type="button"
                title={group.collapsed ? '展开分组' : '折叠分组'}
                aria-label={group.collapsed ? '展开分组' : '折叠分组'}
                disabled={dragBusy}
                on:click={() => updateGroup(group.id, { collapsed: !group.collapsed })}
              >
                <Icon name={group.collapsed ? 'chevron-down' : 'chevron-up'} />
              </button>
              {#if editingGroupId === group.id}
                <input
                  class="field group-title-field min-w-56 flex-1 border-transparent bg-transparent px-2"
                  bind:value={editingGroupTitle}
                  on:blur={() => void saveGroupTitle(group)}
                  on:keydown={event => handleGroupTitleKeydown(event, group)}
                />
              {:else}
                <!-- 当不处于编辑模式时，允许点击整行空白标题进行折叠/展开，并支持双击编辑标题 -->
                <button
                  class="group-title-display min-w-56 flex-1 text-left"
                  type="button"
                  title={`${group.title} (${group.collapsed ? '点击展开' : '点击折叠'})`}
                  disabled={dragBusy}
                  on:click={() => updateGroup(group.id, { collapsed: !group.collapsed })}
                  on:dblclick={() => startGroupTitleEditing(group)}
                >
                  {group.title}
                </button>
              {/if}
              <span class="text-xs font-medium uppercase tracking-wide text-muted"
                >{tabs.length} 个标签</span
              >
              <div class="ml-auto flex items-center gap-1">
                <button
                  class="btn btn-icon"
                  type="button"
                  disabled={busyId === group.id || dragBusy}
                  title="编辑分组标题"
                  aria-label="编辑分组标题"
                  on:click={() => startGroupTitleEditing(group)}
                >
                  <Icon name="edit" />
                </button>
                <button
                  class="btn btn-icon"
                  type="button"
                  disabled={busyId === group.id || dragBusy}
                  title="恢复整组"
                  aria-label="恢复整组"
                  on:click={() => restoreGroup(group.id)}
                >
                  <Icon name="external-link" />
                </button>
                <button
                  class={`btn btn-icon ${group.locked ? 'bg-blue-50 text-brand hover:bg-blue-100' : ''}`}
                  type="button"
                  disabled={dragBusy}
                  title={group.locked ? '点击解锁分组' : '点击锁定分组'}
                  aria-label={group.locked ? '点击解锁分组' : '点击锁定分组'}
                  on:click={() => updateGroup(group.id, { locked: !group.locked })}
                >
                  <Icon name={group.locked ? 'lock' : 'unlock'} />
                </button>
                <button
                  class={`btn btn-icon ${group.archived ? 'bg-blue-50 text-brand hover:bg-blue-100' : ''}`}
                  type="button"
                  disabled={dragBusy}
                  title={group.archived ? '从归档恢复' : '移至归档'}
                  aria-label={group.archived ? '从归档恢复' : '移至归档'}
                  on:click={() => updateGroup(group.id, { archived: !group.archived })}
                >
                  <Icon name={group.archived ? 'archive-restore' : 'archive'} />
                </button>
                <button
                  class="btn btn-icon btn-icon-danger"
                  type="button"
                  disabled={dragBusy}
                  title="删除分组"
                  aria-label="删除分组"
                  on:click={() => confirmDeleteGroup(group)}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>

            {#if !group.collapsed}
              <div
                class="grid gap-0.5"
                role="presentation"
                on:dragover={event => handleTabListDragOver(event, group.id)}
                on:drop={event => handleTabListDrop(event, group.id)}
              >
                {#if tabs.length === 0}
                  <div class="px-4 py-4 text-sm text-muted">拖拽标签到这里</div>
                {:else}
                  {#each tabs as tab (tab.id)}
                    <div
                      class={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 px-3 ${tabDropState?.targetGroupId === group.id && tabDropState.targetTabId === tab.id ? (tabDropState.position === 'before' ? 'drop-before' : 'drop-after') : ''}`}
                      role="presentation"
                      on:dragover={event => handleTabRowDragOver(event, group.id, tab.id)}
                      on:drop={event => handleTabRowDrop(event, group.id, tab.id)}
                    >
                      <button
                        class="btn btn-icon btn-handle"
                        type="button"
                        draggable={!isDragDisabled()}
                        aria-label={`拖拽移动标签 ${tab.title}`}
                        title="拖拽移动标签"
                        on:dragstart={event => handleTabDragStart(event, tab.id, group.id)}
                        on:dragend={resetDragState}
                      >
                        <Icon name="grip-vertical" />
                      </button>
                      <div class="min-w-0">
                        {#if editingTabId === tab.id}
                          <input
                            class="tab-edit-field"
                            bind:value={editingTabTitle}
                            on:blur={() => void saveTabTitle(tab)}
                            on:keydown={event => handleTabTitleKeydown(event, tab)}
                          />
                        {:else}
                          <div class="flex items-center gap-2 w-full min-w-0">
                            <button
                              class="tab-link flex items-center gap-2 max-w-full min-w-0"
                              type="button"
                              title={tab.url}
                              disabled={busyId === tab.id || dragBusy}
                              on:click={() => restoreTab(tab.id)}
                            >
                              <!-- 仅当解析出有效的 favicon 链接时，才进行图片标签渲染 -->
                              {#if getFaviconUrl(tab.url)}
                                <img
                                  class="w-4 h-4 flex-shrink-0 rounded-sm object-contain"
                                  src={getFaviconUrl(tab.url)}
                                  alt=""
                                  on:error={(e) => {
                                    // 当图片因跨域或无网络等原因加载失败时，替换为通用的链条样式 SVG 图标
                                    // @ts-ignore
                                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230ea5e9' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'%3E%3C/path%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'%3E%3C/path%3E%3C/svg%3E";
                                  }}
                                />
                              {/if}
                              <span class="truncate">{tab.title}</span>
                            </button>
                          </div>
                        {/if}
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          class="btn btn-icon"
                          type="button"
                          disabled={busyId === tab.id || dragBusy}
                          title="编辑标签标题"
                          aria-label="编辑标签标题"
                          on:click={() => startTabTitleEditing(tab)}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          class="btn btn-icon btn-icon-danger"
                          type="button"
                          disabled={dragBusy}
                          title="删除标签"
                          aria-label="删除标签"
                          on:click={() => confirmDeleteTab(tab)}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            {/if}
          </article>
        {/each}
      </section>
    {/if}
  </div>
</main>

<!-- 悬浮全局通知消息 (Antd Message 风格)，避免标准流占位导致页面跳动，方便连续操作 -->
<div class="fixed top-6 left-1/2 z-[9999] -translate-x-1/2 flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4">
  <!-- 条件分支：当 status 存在时，渲染成功提示 Message -->
  {#if status}
    <!-- 引入 transition:fly 增加自上而下滑入与淡出动画 -->
    <div
      transition:fly={{ y: -20, duration: 150 }}
      class="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md"
    >
      <!-- 绿色的成功勾号图标 -->
      <svg class="h-5 w-5 text-green-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="min-w-0 flex-1 text-sm font-medium text-slate-700 truncate">{status}</span>
      <button
        class="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        type="button"
        aria-label="关闭提示"
        title="关闭提示"
        on:click={() => dismissAlert('status')}
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  {/if}

  <!-- 条件分支：当 error 存在时，渲染错误提示 Message -->
  {#if error}
    <!-- 引入 transition:fly 增加自上而下滑入与淡出动画 -->
    <div
      transition:fly={{ y: -20, duration: 150 }}
      class="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md"
    >
      <!-- 红色的错误感叹号图标 -->
      <svg class="h-5 w-5 text-red-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="min-w-0 flex-1 text-sm font-medium text-slate-700 truncate">{error}</span>
      <button
        class="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        type="button"
        aria-label="关闭错误提示"
        title="关闭错误提示"
        on:click={() => dismissAlert('error')}
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  {/if}
</div>
