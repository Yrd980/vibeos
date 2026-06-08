import { applyPatchEnvelope } from './generatedRuntime';
import type { CacheMeta, GeneratedDocument, HydrationResult, LaunchIntent, PatchEnvelope, UiEvent } from './types';

type CacheRecord = {
  checkpoint: GeneratedDocument;
  patchLog: PatchEnvelope[];
  eventLog: UiEvent[];
  eventPatchLog: PatchEnvelope[];
  promptSummary: string;
  safetyValidationVersion: number;
  vocabularyVersion: number;
  savedAt: number;
};

const memoryCache = new Map<string, CacheRecord>();
const safetyValidationVersion = 2;
const vocabularyVersion = 2;

export function hydrateCache(intent: LaunchIntent): HydrationResult {
  const record = readRecord(intent.seed);
  if (!record) {
    return { kind: 'miss' };
  }

  if (!isValidCachedDocument(record.checkpoint) || !Array.isArray(record.patchLog) || !Array.isArray(record.eventLog)) {
    return { kind: 'miss' };
  }

  const replay = replayPatchLog(record.checkpoint, record.patchLog);
  const snapshot = replay.snapshot;
  const patchLog = record.patchLog.slice(0, replay.acceptedCount);
  const eventLog = record.eventLog.filter(isValidUiEvent);
  const eventPatchLog = Array.isArray(record.eventPatchLog) ? record.eventPatchLog.filter(isValidPatchEnvelope) : [];
  const cacheMeta = cacheMetaFromRecord(record);

  if (record.safetyValidationVersion !== safetyValidationVersion || record.vocabularyVersion !== vocabularyVersion) {
    return { kind: 'stale', snapshot, patchLog, eventLog, eventPatchLog, cacheMeta, reason: 'validation vocabulary changed' };
  }

  if (replay.acceptedCount < record.patchLog.length) {
    return {
      kind: 'partial',
      snapshot,
      patchLog,
      eventLog,
      eventPatchLog,
      cacheMeta,
      missingFromRevision: snapshot.revision + 1,
    };
  }

  return { kind: 'hit', snapshot, patchLog, eventLog, eventPatchLog, cacheMeta };
}

export function rememberCheckpoint(
  intent: LaunchIntent,
  document: GeneratedDocument,
  patchLog: PatchEnvelope[],
  eventLog: UiEvent[] = [],
  eventPatchLog: PatchEnvelope[] = [],
) {
  const record: CacheRecord = {
    checkpoint: document,
    patchLog: patchLog.filter((envelope) => envelope.baseRevision >= document.revision).slice(0, 80),
    eventLog: eventLog.filter(isValidUiEvent).slice(-80),
    eventPatchLog: eventPatchLog.filter(isValidPatchEnvelope).slice(-80),
    promptSummary: intent.prompt.slice(0, 160),
    safetyValidationVersion,
    vocabularyVersion,
    savedAt: Date.now(),
  };

  memoryCache.set(intent.seed, record);

  try {
    window.localStorage.setItem(storageKey(intent.seed), JSON.stringify(record));
  } catch {
    // Memory cache keeps continuity for this session when storage is unavailable.
  }
}

function readRecord(seed: string): CacheRecord | undefined {
  const memoryRecord = memoryCache.get(seed);
  if (memoryRecord) return memoryRecord;

  try {
    const raw = window.localStorage.getItem(storageKey(seed));
    if (!raw) return undefined;
    const record = JSON.parse(raw) as CacheRecord;
    memoryCache.set(seed, record);
    return record;
  } catch {
    return undefined;
  }
}

function storageKey(seed: string) {
  return `vibeos-cache:${seed}`;
}

function isValidCachedDocument(document: GeneratedDocument) {
  return (
    typeof document.documentId === 'string' &&
    typeof document.revision === 'number' &&
    document.revision > 0 &&
    (document.stage === 'ready' || document.stage === 'stale') &&
    typeof document.rootBlockId === 'string' &&
    Boolean(document.blocks?.[document.rootBlockId]) &&
    Object.keys(document.blocks).length <= 120 &&
    typeof document.appIdentity?.title === 'string'
  );
}

function replayPatchLog(checkpoint: GeneratedDocument, patchLog: PatchEnvelope[]) {
  let snapshot = checkpoint;
  let acceptedCount = 0;
  const pending = patchLog.filter((envelope) => envelope.baseRevision >= checkpoint.revision);

  for (const envelope of pending) {
    if (!isPatchEnvelopeForDocument(snapshot, envelope)) break;
    const next = applyPatchEnvelope(snapshot, envelope);
    if (next === snapshot) break;
    snapshot = next;
    acceptedCount += 1;
  }

  return { snapshot, acceptedCount };
}

function cacheMetaFromRecord(record: CacheRecord): CacheMeta {
  return {
    promptSummary: record.promptSummary,
    safetyValidationVersion: record.safetyValidationVersion,
    vocabularyVersion: record.vocabularyVersion,
    savedAt: record.savedAt,
  };
}

function isPatchEnvelopeForDocument(document: GeneratedDocument, envelope: PatchEnvelope) {
  return (
    envelope.protocolVersion === 1 &&
    typeof envelope.sessionId === 'string' &&
    typeof envelope.streamId === 'string' &&
    envelope.baseRevision === document.revision &&
    envelope.resultRevision === document.revision + 1
  );
}

function isValidPatchEnvelope(value: unknown): value is PatchEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PatchEnvelope).protocolVersion === 1 &&
    typeof (value as PatchEnvelope).sessionId === 'string' &&
    typeof (value as PatchEnvelope).streamId === 'string' &&
    typeof (value as PatchEnvelope).seq === 'number' &&
    typeof (value as PatchEnvelope).baseRevision === 'number' &&
    typeof (value as PatchEnvelope).resultRevision === 'number'
  );
}

function isValidUiEvent(value: unknown): value is UiEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UiEvent).sessionId === 'string' &&
    typeof (value as UiEvent).baseRevision === 'number' &&
    typeof (value as UiEvent).blockId === 'string' &&
    typeof (value as UiEvent).intentId === 'string' &&
    ['click', 'submit', 'change', 'select', 'navigate-simulated', 'open-dialog'].includes((value as UiEvent).eventType)
  );
}
