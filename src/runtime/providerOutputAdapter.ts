import { applyPatchEnvelope, createEmptyDocument } from './generatedRuntime';
import { fullDocumentToPatchStream, type FullDocumentProviderOutput } from './fallbackAdapter';
import type { GeneratedDocument, PatchEnvelope } from './types';

export type ProviderOutputAdaptResult =
  | {
      kind: 'patch-stream';
      envelopes: PatchEnvelope[];
    }
  | {
      kind: 'full-document';
      envelopes: PatchEnvelope[];
    }
  | {
      kind: 'rejected';
      reason: string;
    };

const forbiddenOutputPatterns = [
  /<\s*script\b/i,
  /<\s*style\b/i,
  /<\s*iframe\b/i,
  /<\/?[a-z][\s\S]*>/i,
  /\bdangerouslySetInnerHTML\b/i,
  /\bjavascript:/i,
  /\bdata:text\/html\b/i,
];

export function adaptProviderJsonOutput(options: {
  raw: string;
  sessionId: string;
  streamId: string;
  baseRevision: number;
  baseDocument?: GeneratedDocument;
}): ProviderOutputAdaptResult {
  if (forbiddenOutputPatterns.some((pattern) => pattern.test(options.raw))) {
    return { kind: 'rejected', reason: 'Provider output contained forbidden markup or executable content.' };
  }

  const parsed = parseJsonObject(options.raw);
  if (!parsed) {
    return { kind: 'rejected', reason: 'Provider output was not a JSON object.' };
  }

  if ('envelopes' in parsed && Array.isArray(parsed.envelopes)) {
    return adaptEnvelopeList(parsed.envelopes, options.sessionId, options.baseRevision, options.baseDocument);
  }

  if ('envelope' in parsed) {
    return adaptEnvelopeList([parsed.envelope], options.sessionId, options.baseRevision, options.baseDocument);
  }

  if ('document' in parsed && isGeneratedDocumentLike(parsed.document)) {
    const output: FullDocumentProviderOutput = {
      document: parsed.document,
      statusText: typeof parsed.statusText === 'string' ? parsed.statusText : undefined,
      stale: parsed.stale === true,
    };
    const envelopes = fullDocumentToPatchStream(options.sessionId, options.streamId, options.baseRevision, output);
    return validateEnvelopeReplay(envelopes, options.baseRevision, options.baseDocument);
  }

  return { kind: 'rejected', reason: 'Provider JSON did not contain envelopes or a generated document.' };
}

function adaptEnvelopeList(
  values: unknown[],
  sessionId: string,
  baseRevision: number,
  baseDocument?: GeneratedDocument,
): ProviderOutputAdaptResult {
  const envelopes = values.filter(isPatchEnvelope);
  if (envelopes.length !== values.length) {
    return { kind: 'rejected', reason: 'Provider envelope list contained invalid envelope shapes.' };
  }

  if (envelopes.some((envelope) => envelope.sessionId !== sessionId)) {
    return { kind: 'rejected', reason: 'Provider envelope session mismatch.' };
  }

  return validateEnvelopeReplay(envelopes, baseRevision, baseDocument);
}

function validateEnvelopeReplay(
  envelopes: PatchEnvelope[],
  baseRevision: number,
  baseDocument?: GeneratedDocument,
): ProviderOutputAdaptResult {
  let document = baseDocument ?? createEmptyDocument('provider-output-validation', 'Provider Output');
  document = { ...document, revision: baseRevision };

  for (const envelope of envelopes) {
    const next = applyPatchEnvelope(document, envelope);
    if (next === document) {
      return { kind: 'rejected', reason: `Provider envelope ${envelope.seq} failed patch validation.` };
    }
    document = next;
  }

  return { kind: 'patch-stream', envelopes };
}

function parseJsonObject(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function isPatchEnvelope(value: unknown): value is PatchEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PatchEnvelope).protocolVersion === 1 &&
    typeof (value as PatchEnvelope).sessionId === 'string' &&
    typeof (value as PatchEnvelope).streamId === 'string' &&
    Number.isInteger((value as PatchEnvelope).seq) &&
    Number.isInteger((value as PatchEnvelope).baseRevision) &&
    Number.isInteger((value as PatchEnvelope).resultRevision) &&
    typeof (value as PatchEnvelope).kind === 'string' &&
    'payload' in value
  );
}

function isGeneratedDocumentLike(value: unknown): value is GeneratedDocument {
  if (typeof value !== 'object' || value === null) return false;
  const document = value as GeneratedDocument;
  return (
    typeof document.documentId === 'string' &&
    Number.isInteger(document.revision) &&
    typeof document.rootBlockId === 'string' &&
    typeof document.blocks === 'object' &&
    document.blocks !== null &&
    typeof document.eventIntents === 'object' &&
    document.eventIntents !== null &&
    typeof document.appIdentity?.title === 'string' &&
    typeof document.appIdentity?.statusText === 'string' &&
    typeof document.resourceManifest?.resources === 'object' &&
    document.resourceManifest.resources !== null
  );
}
