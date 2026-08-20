import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { api, ApiError } from './api';
import { enqueueEntry, trySync, type PendingEntry } from './offline-queue';

// jest.mock() calls are hoisted above these imports by babel-plugin-jest-hoist regardless
// of source position — this ordering (imports first) is just for readability.
// Mock factories can't reference out-of-scope imports, only a same-line require().
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

jest.mock('./api', () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { api: { postLedgerEntry: jest.fn() }, ApiError };
});

const QUEUE_KEY = 'restoledger_pending_entries';
const mockRandomUUID = Crypto.randomUUID as jest.Mock;
const mockPost = api.postLedgerEntry as jest.Mock;

async function seedQueue(entries: PendingEntry[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
}

async function readQueueFromStorage(): Promise<PendingEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

const entryA: PendingEntry = {
  idempotencyKey: 'key-a',
  tenantId: 't1',
  entryType: 'revenue',
  amount: 420.5,
  description: 'Lunch',
  queuedAt: '2026-08-20T00:00:00.000Z',
};
const entryB: PendingEntry = {
  idempotencyKey: 'key-b',
  tenantId: 't1',
  entryType: 'expense',
  amount: 20,
  queuedAt: '2026-08-20T00:01:00.000Z',
};

describe('offline queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockRandomUUID.mockReset();
    mockPost.mockReset();
  });

  describe('enqueueEntry', () => {
    it('resolves immediately with a generated key, without waiting on the network', async () => {
      mockRandomUUID.mockReturnValue('uuid-1');
      // Resolves (not left hanging): enqueueEntry fires a background sync it doesn't await,
      // and a mock that never resolves would leave `syncing` stuck true for every later
      // test in this file (found the hard way — see .logs/corrections.md).
      mockPost.mockResolvedValue({ id: 'e1' });

      const key = await enqueueEntry({ tenantId: 't1', entryType: 'revenue', amount: 10 });

      expect(key).toBe('uuid-1');
    });
  });

  describe('trySync', () => {
    it('posts a queued entry with its idempotency key and removes it on success', async () => {
      await seedQueue([entryA]);
      mockPost.mockResolvedValue({ id: 'e1' });

      await trySync();

      expect(mockPost).toHaveBeenCalledWith('t1', 'revenue', 420.5, 'Lunch', 'key-a');
      expect(await readQueueFromStorage()).toEqual([]);
    });

    it('keeps an entry queued after a network failure (not an ApiError)', async () => {
      await seedQueue([entryA]);
      mockPost.mockRejectedValue(new TypeError('Network request failed'));

      await trySync();

      expect(await readQueueFromStorage()).toEqual([entryA]);
    });

    it('drops an entry the server rejected (ApiError) instead of retrying forever', async () => {
      await seedQueue([entryA]);
      mockPost.mockRejectedValue(new ApiError(400, 'Validation failed'));

      await trySync();

      expect(await readQueueFromStorage()).toEqual([]);
    });

    it('stops at the first network failure, leaving that entry and everything behind it queued', async () => {
      await seedQueue([entryA, entryB]);
      mockPost.mockRejectedValueOnce(new TypeError('offline'));

      await trySync();

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(await readQueueFromStorage()).toEqual([entryA, entryB]);
    });

    it('syncs entries in queue order', async () => {
      await seedQueue([entryA, entryB]);
      mockPost.mockResolvedValue({ id: 'ok' });

      await trySync();

      expect(mockPost.mock.calls[0]).toEqual(['t1', 'revenue', 420.5, 'Lunch', 'key-a']);
      expect(mockPost.mock.calls[1]).toEqual(['t1', 'expense', 20, undefined, 'key-b']);
    });

    it('does not run two syncs concurrently', async () => {
      await seedQueue([entryA]);
      let resolveFirst: (v: unknown) => void;
      mockPost.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      );

      const sync1 = trySync();
      // Let sync1 progress far enough to actually call postLedgerEntry (and capture
      // resolveFirst) before starting sync2 — otherwise sync2 would race sync1 for the
      // `syncing` flag instead of reliably losing to it. The AsyncStorage mock's own
      // async/await chain (getItem -> multiGet, each independently async) adds more
      // microtask hops than a single flush covers, so poll instead of guessing a count.
      for (let i = 0; i < 10 && mockPost.mock.calls.length === 0; i++) {
        await Promise.resolve();
      }
      const sync2 = trySync(); // should see `syncing` already true and no-op

      resolveFirst!({ id: 'e1' });
      await Promise.all([sync1, sync2]);

      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });
});
