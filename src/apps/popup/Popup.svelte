<script lang="ts">
  import { onMount } from 'svelte';
  import { sendMessage } from '../../lib/runtime';
  import type { ParkTabData, SaveScope, SaveTabsResult } from '../../lib/types';

  let data: ParkTabData | null = null;
  let loading = true;
  let busy = false;
  let status = '';
  let error = '';

  onMount(loadData);

  async function loadData() {
    loading = true;
    error = '';
    try {
      data = await sendMessage<ParkTabData>('data:get');
    } catch (err) {
      error = err instanceof Error ? err.message : '加载失败';
    } finally {
      loading = false;
    }
  }

  async function save(scope: SaveScope) {
    busy = true;
    error = '';
    status = '';
    try {
      const result = await sendMessage<SaveTabsResult>('tabs:save', { scope });
      status = result.savedCount > 0 ? `已保存 ${result.savedCount} 个标签` : '没有可保存的标签';
      data = await sendMessage<ParkTabData>('data:get');
    } catch (err) {
      error = err instanceof Error ? err.message : '保存失败';
    } finally {
      busy = false;
    }
  }

  async function openManager() {
    await sendMessage('manager:open');
    window.close();
  }

  $: groupCount = data?.groups.filter((group) => !group.deletedAt).length ?? 0;
  $: tabCount = data?.tabs.filter((tab) => !tab.deletedAt).length ?? 0;
</script>

<main class="w-[360px] bg-panel p-4">
  <header class="mb-4 flex items-center justify-between gap-3">
    <div>
      <h1 class="text-base font-semibold text-ink">Park Tab</h1>
      <p class="text-xs text-muted">已保存 {groupCount} 组 / {tabCount} 个标签</p>
    </div>
    <button class="btn px-2 py-1.5" type="button" on:click={openManager}>管理</button>
  </header>

  <section class="grid gap-2">
    <button class="btn btn-primary w-full" type="button" disabled={busy || loading} on:click={() => save('current-window')}>
      保存当前窗口
    </button>
    <div class="grid grid-cols-2 gap-2">
      <button class="btn" type="button" disabled={busy || loading} on:click={() => save('current-tab')}>
        当前标签
      </button>
      <button class="btn" type="button" disabled={busy || loading} on:click={() => save('highlighted-tabs')}>
        选中标签
      </button>
    </div>
    <div class="grid grid-cols-1 gap-2">
      <button class="btn" type="button" disabled={busy || loading} on:click={() => save('all-windows')}>
        全部窗口
      </button>
    </div>
  </section>

  {#if status}
    <p class="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{status}</p>
  {/if}

  {#if error}
    <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  {/if}

  <footer class="mt-4 border-t border-line pt-3 text-xs text-muted">
    同步状态：{data?.sync.status ?? 'idle'}
    {#if data?.sync.lastSyncedAt}
      · {new Date(data.sync.lastSyncedAt).toLocaleString()}
    {/if}
  </footer>
</main>
