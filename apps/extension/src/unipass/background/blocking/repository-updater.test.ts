import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateRepositorySubscription, REPOSITORY_UPDATE_STORAGE_KEY } from './repository-updater';
import { BUNDLED_REPOSITORY_RULES, REPOSITORY_FILTER_STORAGE_KEY, REPOSITORY_FILTER_URL } from './repository-rules';
import { updateFilterSubscriptions } from './filter-updater';
import { FILTER_SUBSCRIPTIONS } from './subscriptions';

let data: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;
let notify: ReturnType<typeof vi.fn>;
const next = { version: 1, revision: 2, sites: [{ host: 'www.example.com', selectors: ['.sponsor'] }] };

beforeEach(() => {
  data = {};
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(next)));
  notify = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('chrome', {
    storage: { local: {
      get: vi.fn(async () => ({ ...data })),
      set: vi.fn(async (values) => { Object.assign(data, values); }),
      remove: vi.fn(async (key) => { delete data[key]; }),
    } },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://www.example.com/' }]), sendMessage: notify },
    alarms: { create: vi.fn().mockResolvedValue(undefined) },
    declarativeNetRequest: { getDynamicRules: vi.fn().mockResolvedValue([]), updateDynamicRules: vi.fn().mockResolvedValue(undefined) },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('independent repository updater', () => {
  it('fetches only the fixed URL without credentials/referrer/redirects and refreshes pages', async () => {
    await updateRepositorySubscription();
    expect(fetchMock).toHaveBeenCalledWith(REPOSITORY_FILTER_URL, expect.objectContaining({
      credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store',
    }));
    expect(data[REPOSITORY_FILTER_STORAGE_KEY]).toEqual(next);
    expect(notify).toHaveBeenCalledWith(1, { type: 'refreshCosmeticEffects' });
    await updateRepositorySubscription();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['404', 'html', 'json', 'schema', 'oversize', 'downgrade', 'changed-revision', 'network'])(
    'retains the last known good cache on %s failure', async (failure) => {
      data[REPOSITORY_FILTER_STORAGE_KEY] = next;
      const responses: Record<string, Response> = {
        '404': new Response('', { status: 404 }),
        html: new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
        json: new Response('{'),
        schema: new Response(JSON.stringify({ ...next, script: 'bad' })),
        oversize: new Response(' '.repeat(100_001)),
        downgrade: new Response(JSON.stringify(BUNDLED_REPOSITORY_RULES)),
        'changed-revision': new Response(JSON.stringify({ ...next, sites: [] })),
      };
      if (failure === 'network') fetchMock.mockRejectedValue(new Error('offline'));
      else fetchMock.mockResolvedValue(responses[failure]);
      await updateRepositorySubscription();
      expect(data[REPOSITORY_FILTER_STORAGE_KEY]).toEqual(next);
      expect(data[REPOSITORY_UPDATE_STORAGE_KEY]).toHaveProperty('error');
      expect(notify).not.toHaveBeenCalled();
    },
  );

  it('keeps the cache when storage fails before committing the new rules', async () => {
    data[REPOSITORY_FILTER_STORAGE_KEY] = BUNDLED_REPOSITORY_RULES;
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('storage full'));
    await updateRepositorySubscription();
    expect(data[REPOSITORY_FILTER_STORAGE_KEY]).toEqual(BUNDLED_REPOSITORY_RULES);
    expect(notify).not.toHaveBeenCalled();
  });

  it('coalesces concurrent requests', async () => {
    const first = updateRepositorySubscription();
    expect(updateRepositorySubscription()).toBe(first);
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('continues original subscriptions when the repository is unavailable', async () => {
    fetchMock.mockImplementation(async (url: string) => url === REPOSITORY_FILTER_URL
      ? new Response('', { status: 404 })
      : new Response('[Adblock Plus 2.0]\n||ads.example.com^'));
    await updateFilterSubscriptions();
    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
    for (const source of FILTER_SUBSCRIPTIONS) expect(fetchMock).toHaveBeenCalledWith(source.url, expect.anything());
    expect(data[REPOSITORY_UPDATE_STORAGE_KEY]).toHaveProperty('error');
  });

  it('updates repository rules even when every original subscription fails', async () => {
    fetchMock.mockImplementation(async (url: string) => url === REPOSITORY_FILTER_URL
      ? new Response(JSON.stringify(next)) : new Response('', { status: 503 }));
    await updateFilterSubscriptions();
    expect(data[REPOSITORY_FILTER_STORAGE_KEY]).toEqual(next);
    expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
  });
});
