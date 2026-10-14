import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosAdapter } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { api, get, post } from './api';
import { queryRetryDelay, shouldRetryQuery } from './queryRetry';

const originalAdapter = api.defaults.adapter;
const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach(client => client.clear());
  clients.length = 0;
  api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
});
function client() {
  const instance = new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: queryRetryDelay } } });
  clients.push(instance);
  return instance;
}
function simulate(responses: Array<{ status: number; data: unknown }>) {
  let calls = 0;
  const adapter: AxiosAdapter = async config => {
    const result = responses[Math.min(calls++, responses.length - 1)];
    const response = { ...result, statusText: String(result.status), headers: {}, config };
    if (result.status >= 400) throw new AxiosError('Gateway or API error', 'ERR_BAD_RESPONSE', config, {}, response);
    return response;
  };
  api.defaults.adapter = adapter;
  return () => calls;
}

describe('recovering listings while the backend starts', () => {
  it('waits through repeated gateway pages and renders the real property response', async () => {
    vi.useFakeTimers();
    const homes = { items: [{ _id: 'property-1', title: 'Sunlit home' }], total: 1 };
    const calls = simulate([
      { status: 502, data: '<html>Waking up</html>' },
      { status: 503, data: '<html>Starting</html>' },
      { status: 200, data: '<html>Still starting</html>' },
      { status: 504, data: '<html>Gateway timeout</html>' },
      { status: 200, data: { success: true, data: homes } },
    ]);
    const result = client().fetchQuery({ queryKey: ['homes'], queryFn: () => get('/properties') });
    await vi.advanceTimersByTimeAsync(24000);
    expect(await result).toEqual(homes);
    expect(calls()).toBe(5);
  });

  it.each([400, 401, 403, 404, 429])('does not retry HTTP %i application errors', async status => {
    const calls = simulate([{ status, data: { success: false, message: 'Request rejected' } }]);
    await expect(client().fetchQuery({ queryKey: ['homes'], queryFn: () => get('/properties') })).rejects.toMatchObject({ response: { status } });
    expect(calls()).toBe(1);
  });

  it('stops after a bounded recovery window when the service stays unavailable', async () => {
    vi.useFakeTimers();
    const calls = simulate([{ status: 502, data: '<html>Unavailable</html>' }]);
    const result = client().fetchQuery({ queryKey: ['homes'], queryFn: () => get('/properties') });
    const failure = expect(result).rejects.toMatchObject({ response: { status: 502 } });
    await vi.advanceTimersByTimeAsync(65000);
    await failure;
    expect(calls()).toBe(9);
  });

  it('never replays a rental application or other mutation after a gateway failure', async () => {
    const calls = simulate([{ status: 502, data: '<html>Unavailable</html>' }]);
    const queryClient = client();
    const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn: () => post('/applications', { property: 'property-1' }) });
    await expect(mutation.execute(undefined)).rejects.toMatchObject({ response: { status: 502 } });
    expect(calls()).toBe(1);
  });
});
