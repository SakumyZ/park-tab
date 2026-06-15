import type { WebDavSettings } from './types';

export async function testWebDavConnection(settings: WebDavSettings): Promise<void> {
  if (!settings.url) {
    throw new Error('请填写 WebDAV 地址。');
  }

  const endpoint = buildWebDavUrl(settings);
  const response = await fetch(endpoint, {
    method: 'PROPFIND',
    headers: {
      Authorization: createAuthHeader(settings),
      Depth: '0'
    }
  });

  if (!response.ok && response.status !== 207 && response.status !== 404) {
    throw new Error(`WebDAV 连接失败：HTTP ${response.status}`);
  }
}

export function buildWebDavUrl(settings: WebDavSettings): string {
  const base = settings.url.replace(/\/+$/, '');
  const path = settings.remotePath.startsWith('/') ? settings.remotePath : `/${settings.remotePath}`;
  return `${base}${path}`;
}

function createAuthHeader(settings: WebDavSettings): string {
  if (!settings.username && !settings.password) {
    return '';
  }

  return `Basic ${btoa(`${settings.username}:${settings.password}`)}`;
}
