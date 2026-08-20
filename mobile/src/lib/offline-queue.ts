import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { api, ApiError } from './api';

const STORAGE_KEY = 'restoledger_pending_entries';

export interface PendingEntry {
  idempotencyKey: string;
  tenantId: string;
  entryType: 'revenue' | 'expense';
  amount: number;
  description?: string;
  queuedAt: string;
}

type Listener = (pending: PendingEntry[]) => void;
const listeners = new Set<Listener>();

async function readQueue(): Promise<PendingEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: PendingEntry[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  listeners.forEach((l) => l(queue));
}

export function subscribeToQueue(listener: Listener): () => void {
  listeners.add(listener);
  readQueue().then(listener);
  return () => listeners.delete(listener);
}

/**
 * Queues an entry for posting. Always succeeds immediately (offline-first — the UI never
 * blocks on network) and returns the idempotency key that will de-duplicate it server-side
 * if sync retries after a partial success (Story 3.3, ledger.service.ts createEntry).
 */
export async function enqueueEntry(
  input: Omit<PendingEntry, 'idempotencyKey' | 'queuedAt'>,
): Promise<string> {
  const idempotencyKey = Crypto.randomUUID();
  const queue = await readQueue();
  queue.push({ ...input, idempotencyKey, queuedAt: new Date().toISOString() });
  await writeQueue(queue);
  trySync();
  return idempotencyKey;
}

let syncing = false;

/**
 * Attempts to flush the queue. Safe to call repeatedly/concurrently (guarded by `syncing`).
 * A network failure leaves the entry queued for the next attempt; a server-rejected entry
 * (validation error, permission error) is dropped — retrying a request the server will never
 * accept just wastes battery and blocks entries queued behind it.
 */
export async function trySync(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    let queue = await readQueue();
    for (const entry of queue) {
      try {
        await api.postLedgerEntry(
          entry.tenantId,
          entry.entryType,
          entry.amount,
          entry.description,
          entry.idempotencyKey,
        );
        queue = queue.filter((e) => e.idempotencyKey !== entry.idempotencyKey);
        await writeQueue(queue);
      } catch (err) {
        if (err instanceof ApiError) {
          // Server rejected it outright — drop it, don't retry forever.
          queue = queue.filter((e) => e.idempotencyKey !== entry.idempotencyKey);
          await writeQueue(queue);
        } else {
          // Network failure — stop here, keep this and everything behind it queued.
          break;
        }
      }
    }
  } finally {
    syncing = false;
  }
}

export function startAutoSync(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) trySync();
  });
  return unsubscribe;
}
