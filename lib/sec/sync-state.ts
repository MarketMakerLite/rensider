import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

// Sync state types
export type SyncStatus = 'pending' | 'running' | 'success' | 'failed';

export interface SyncState {
  source: string;
  lastProcessedDate?: string;
  lastAccessionNumber?: string;
  lastRunAt?: string;
  status: SyncStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';
const SYNC_STATE_FILE = join(DATA_DIR, 'sync-state.json');

interface SyncStateStore {
  [source: string]: SyncState;
}

async function ensureFile(): Promise<void> {
  try {
    await mkdir(dirname(SYNC_STATE_FILE), { recursive: true });
  } catch {
    // Directory exists
  }
}

export async function readSyncState(): Promise<SyncStateStore> {
  try {
    const data = await readFile(SYNC_STATE_FILE, 'utf-8');
    return JSON.parse(data) as SyncStateStore;
  } catch {
    return {};
  }
}

export async function writeSyncState(state: SyncStateStore): Promise<void> {
  await ensureFile();
  await writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function getSyncState(source: string): Promise<SyncState | null> {
  const store = await readSyncState();
  return store[source] || null;
}

export async function setSyncState(source: string, state: Partial<SyncState>): Promise<void> {
  const store = await readSyncState();
  const existing = store[source] || { source, status: 'pending' as const };
  store[source] = {
    ...existing,
    ...state,
    source, // Ensure source is always correct
  };
  await writeSyncState(store);
}

export async function markSyncStarted(source: string): Promise<void> {
  await setSyncState(source, {
    status: 'running',
    lastRunAt: new Date().toISOString(),
    errorMessage: undefined,
  });
}

export async function markSyncComplete(
  source: string,
  lastProcessedDate?: string,
  lastAccessionNumber?: string
): Promise<void> {
  await setSyncState(source, {
    status: 'success',
    lastProcessedDate,
    lastAccessionNumber,
    errorMessage: undefined,
  });
}

export async function markSyncFailed(source: string, error: Error): Promise<void> {
  await setSyncState(source, {
    status: 'failed',
    errorMessage: error.message,
  });
}

// Quarter tracking for 13F backfill

interface QuarterProgress {
  quarter: string;
  status: 'pending' | 'downloading' | 'extracting' | 'processing' | 'complete' | 'failed';
  filesProcessed?: number;
  totalFiles?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface BackfillProgress {
  formType: '13F' | '13D' | '13G';
  quarters: QuarterProgress[];
  currentQuarter?: string;
  startedAt: string;
  lastUpdatedAt: string;
}

const BACKFILL_FILE = join(DATA_DIR, 'backfill-progress.json');

export async function readBackfillProgress(formType: '13F' | '13D' | '13G'): Promise<BackfillProgress | null> {
  try {
    const data = await readFile(BACKFILL_FILE, 'utf-8');
    const store = JSON.parse(data) as Record<string, BackfillProgress>;
    return store[formType] || null;
  } catch {
    return null;
  }
}

export async function writeBackfillProgress(progress: BackfillProgress): Promise<void> {
  await ensureFile();
  let store: Record<string, BackfillProgress> = {};

  try {
    const data = await readFile(BACKFILL_FILE, 'utf-8');
    store = JSON.parse(data);
  } catch {
    // File doesn't exist yet
  }

  store[progress.formType] = {
    ...progress,
    lastUpdatedAt: new Date().toISOString(),
  };

  await writeFile(BACKFILL_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export async function initBackfillProgress(
  formType: '13F' | '13D' | '13G',
  quarters: string[]
): Promise<BackfillProgress> {
  const existing = await readBackfillProgress(formType);

  if (existing) {
    // Merge new quarters with existing progress
    const existingQuarters = new Set(existing.quarters.map(q => q.quarter));
    const newQuarters = quarters.filter(q => !existingQuarters.has(q));

    if (newQuarters.length > 0) {
      // Add new quarters as pending
      const newQuarterProgress = newQuarters.map(q => ({
        quarter: q,
        status: 'pending' as const,
      }));

      // Merge and sort by quarter
      existing.quarters = [...existing.quarters, ...newQuarterProgress].sort((a, b) =>
        a.quarter.localeCompare(b.quarter)
      );

      await writeBackfillProgress(existing);
    }

    return existing;
  }

  const progress: BackfillProgress = {
    formType,
    quarters: quarters.map(q => ({
      quarter: q,
      status: 'pending',
    })),
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };

  await writeBackfillProgress(progress);
  return progress;
}

export async function updateQuarterProgress(
  formType: '13F' | '13D' | '13G',
  quarter: string,
  update: Partial<QuarterProgress>
): Promise<void> {
  const progress = await readBackfillProgress(formType);
  if (!progress) {
    throw new Error(`No backfill progress found for ${formType}`);
  }

  const quarterIndex = progress.quarters.findIndex(q => q.quarter === quarter);
  if (quarterIndex === -1) {
    throw new Error(`Quarter ${quarter} not found in progress`);
  }

  progress.quarters[quarterIndex] = {
    ...progress.quarters[quarterIndex],
    ...update,
  };

  if (update.status === 'processing' || update.status === 'downloading') {
    progress.currentQuarter = quarter;
  } else if (update.status === 'complete' || update.status === 'failed') {
    progress.currentQuarter = undefined;
  }

  await writeBackfillProgress(progress);
}

export async function getNextPendingQuarter(formType: '13F' | '13D' | '13G'): Promise<string | null> {
  const progress = await readBackfillProgress(formType);
  if (!progress) return null;

  const pending = progress.quarters.find(q => q.status === 'pending');
  return pending?.quarter || null;
}

export async function isBackfillComplete(formType: '13F' | '13D' | '13G'): Promise<boolean> {
  const progress = await readBackfillProgress(formType);
  if (!progress) return false;

  return progress.quarters.every(q => q.status === 'complete');
}
