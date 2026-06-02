import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SophosHttpClient } from './http-client.js';

const TOKEN_URL = 'https://id.sophos.com/api/v2/oauth2/token';

function mockTokenFetch() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: 'test-token', expires_in: 3600 })
  };
}

describe('SophosHttpClient.fetchAllPages', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('returns all items from a single page', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (url) => {
      if (String(url) === TOKEN_URL) return mockTokenFetch() as Response;
      expect(String(url)).toContain('&page=1');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'a' }, { id: 'b' }],
          pages: { total: 1, current: 1 }
        })
      } as Response;
    });

    const client = new SophosHttpClient('client-single', 'secret');
    const items = await client.fetchAllPages<{ id: string }>(
      'https://api.example.com/items?pageSize=100&pageTotal=true'
    );

    expect(items).toEqual([{ id: 'a' }, { id: 'b' }]);
    const apiCalls = fetchMock.mock.calls.filter(([u]) => String(u) !== TOKEN_URL);
    expect(apiCalls).toHaveLength(1);
  });

  it('fetches multiple pages using pages.total', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (url) => {
      if (String(url) === TOKEN_URL) return mockTokenFetch() as Response;
      const u = String(url);
      if (u.includes('&page=1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: 'page1' }],
            pages: { total: 2, current: 1 }
          })
        } as Response;
      }
      expect(u).toContain('&page=2');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'page2' }],
          pages: { total: 2, current: 2 }
        })
      } as Response;
    });

    const client = new SophosHttpClient('client-multi', 'secret');
    const items = await client.fetchAllPages<{ id: string }>(
      'https://api.example.com/items?pageSize=100&pageTotal=true'
    );

    expect(items).toEqual([{ id: 'page1' }, { id: 'page2' }]);
    const apiCalls = fetchMock.mock.calls.filter(([u]) => String(u) !== TOKEN_URL);
    expect(apiCalls).toHaveLength(2);
  });

  it('sends X-Partner-ID when partnerId is set', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === TOKEN_URL) return mockTokenFetch() as Response;
      const headers = init?.headers as Record<string, string>;
      expect(headers['X-Partner-ID']).toBe('partner-uuid');
      expect(headers['Authorization']).toBe('Bearer test-token');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 't1' }],
          pages: { total: 1, current: 1 }
        })
      } as Response;
    });

    const client = new SophosHttpClient('client-partner', 'secret');
    await client.fetchAllPages(
      'https://api.central.sophos.com/partner/v1/tenants?pageSize=100&pageTotal=true',
      undefined,
      { partnerId: 'partner-uuid' }
    );

    expect(fetchMock).toHaveBeenCalled();
  });

  it('retries Sophos API calls when a page response is rate limited', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler) => {
      if (typeof handler === 'function') handler();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (url) => {
      if (String(url) === TOKEN_URL) return mockTokenFetch() as Response;
      const apiCalls = fetchMock.mock.calls.filter(([u]) => String(u) !== TOKEN_URL);
      if (apiCalls.length === 1) {
        return {
          ok: false,
          status: 429,
          json: async () => ({})
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'after-rate-limit' }],
          pages: { total: 1, current: 1 }
        })
      } as Response;
    });

    const client = new SophosHttpClient('client-rate-limit', 'secret');
    const items = await client.fetchAllPages<{ id: string }>(
      'https://api.example.com/items?pageSize=100&pageTotal=true'
    );

    const apiCalls = fetchMock.mock.calls.filter(([u]) => String(u) !== TOKEN_URL);
    expect(items).toEqual([{ id: 'after-rate-limit' }]);
    expect(apiCalls).toHaveLength(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
  });
});
