import type { RuntimeMessage } from './types';

export async function sendMessage<T>(type: string, payload?: unknown): Promise<T> {
  const response = await chrome.runtime.sendMessage({
    type,
    payload
  } satisfies RuntimeMessage);

  if (!response?.ok) {
    throw new Error(response?.error ?? '操作失败');
  }

  return response.result as T;
}
