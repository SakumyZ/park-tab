<script lang="ts">
  import { onMount } from 'svelte';
  import { sendMessage } from '../../lib/runtime';
  import type { ParkTabData, ParkTabSettings } from '../../lib/types';

  let data: ParkTabData | null = null;
  let settings: ParkTabSettings | null = null;
  let status = '';
  let error = '';
  let fileInput: HTMLInputElement;

  onMount(loadData);

  async function loadData() {
    try {
      data = await sendMessage<ParkTabData>('data:get');
      settings = structuredClone(data.settings);
    } catch (err) {
      error = err instanceof Error ? err.message : '加载失败';
    }
  }

  async function saveSettings() {
    if (!settings) return;
    status = '';
    error = '';
    try {
      data = await sendMessage<ParkTabData>('settings:update', settings);
      settings = structuredClone(data.settings);
      status = '设置已保存';
    } catch (err) {
      error = err instanceof Error ? err.message : '保存失败';
    }
  }

  async function testWebDav() {
    if (!settings) return;
    status = '';
    error = '';
    try {
      await sendMessage('sync:test-webdav', settings.webdav);
      status = 'WebDAV 连接可用';
    } catch (err) {
      error = err instanceof Error ? err.message : 'WebDAV 连接失败';
    }
  }

  async function runSync() {
    status = '';
    error = '';
    try {
      data = await sendMessage<ParkTabData>('sync:run');
      settings = structuredClone(data.settings);
      status = '同步完成';
    } catch (err) {
      error = err instanceof Error ? err.message : '同步失败';
    }
  }

  async function exportJson() {
    const exported = await sendMessage<ParkTabData>('data:export');
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `park-tab-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson() {
    const file = fileInput.files?.[0];
    if (!file) return;
    status = '';
    error = '';
    try {
      const text = await file.text();
      const imported = JSON.parse(text) as ParkTabData;
      data = await sendMessage<ParkTabData>('data:import', imported);
      settings = structuredClone(data.settings);
      status = '导入完成';
      fileInput.value = '';
    } catch (err) {
      error = err instanceof Error ? err.message : '导入失败';
    }
  }
</script>

<main class="min-h-screen bg-panel">
  <header class="border-b border-line bg-white">
    <div class="mx-auto flex max-w-4xl items-center gap-3 px-5 py-4">
      <div class="mr-auto">
        <h1 class="text-xl font-semibold text-ink">设置</h1>
        <p class="text-sm text-muted">保存行为、WebDAV 和数据迁移</p>
      </div>
      <a class="btn" href="/manager.html" target="_self">返回管理页</a>
    </div>
  </header>

  <div class="mx-auto grid max-w-4xl gap-4 px-5 py-5">
    {#if status}
      <p class="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{status}</p>
    {/if}
    {#if error}
      <p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
    {/if}

    {#if settings}
      <section class="rounded-md border border-line bg-white p-4">
        <h2 class="text-base font-semibold text-ink">常规</h2>
        <div class="mt-4 grid gap-3">
          <label class="flex items-center gap-3 text-sm">
            <input type="checkbox" bind:checked={settings.closeTabsAfterSave} />
            保存后关闭原标签页
          </label>
          <label class="flex items-center gap-3 text-sm">
            <input type="checkbox" bind:checked={settings.deleteAfterRestore} />
            恢复后删除非锁定分组
          </label>
          <label class="grid gap-1 text-sm">
            <span class="label">默认恢复位置</span>
            <select class="field max-w-xs" bind:value={settings.restoreTarget}>
              <option value="current-window">当前窗口</option>
              <option value="new-window">新窗口</option>
            </select>
          </label>
        </div>
      </section>

      <section class="rounded-md border border-line bg-white p-4">
        <h2 class="text-base font-semibold text-ink">WebDAV</h2>
        <div class="mt-4 grid gap-3">
          <label class="flex items-center gap-3 text-sm">
            <input type="checkbox" bind:checked={settings.webdav.enabled} />
            启用 WebDAV 同步
          </label>
          <label class="flex items-center gap-3 text-sm">
            <input type="checkbox" bind:checked={settings.webdav.autoSync} />
            自动同步
          </label>
          <label class="grid gap-1 text-sm">
            <span class="label">地址</span>
            <input class="field" bind:value={settings.webdav.url} placeholder="https://dav.example.com/dav" />
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-1 text-sm">
              <span class="label">用户名</span>
              <input class="field" bind:value={settings.webdav.username} />
            </label>
            <label class="grid gap-1 text-sm">
              <span class="label">密码或应用密码</span>
              <input class="field" type="password" bind:value={settings.webdav.password} />
            </label>
          </div>
          <label class="grid gap-1 text-sm">
            <span class="label">远程路径</span>
            <input class="field" bind:value={settings.webdav.remotePath} />
          </label>
          <label class="grid max-w-xs gap-1 text-sm">
            <span class="label">自动同步间隔（分钟）</span>
            <input class="field" type="number" min="5" bind:value={settings.webdav.syncIntervalMinutes} />
          </label>
          <div class="flex flex-wrap gap-2">
            <button class="btn" type="button" on:click={testWebDav}>测试连接</button>
            <button class="btn" type="button" on:click={runSync}>手动同步</button>
          </div>
        </div>
      </section>

      <section class="rounded-md border border-line bg-white p-4">
        <h2 class="text-base font-semibold text-ink">数据</h2>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button class="btn" type="button" on:click={exportJson}>导出完整 JSON</button>
          <input bind:this={fileInput} class="field max-w-sm" type="file" accept="application/json" on:change={importJson} />
        </div>
      </section>

      <div class="flex justify-end">
        <button class="btn btn-primary" type="button" on:click={saveSettings}>保存设置</button>
      </div>
    {:else}
      <p class="text-sm text-muted">加载中...</p>
    {/if}
  </div>
</main>
