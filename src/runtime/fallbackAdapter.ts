import type { GeneratedDocument, PatchEnvelope, PatchOperation } from './types';

export type FullDocumentProviderOutput = {
  document: GeneratedDocument;
  statusText?: string;
  stale?: boolean;
};

export function fullDocumentToPatchStream(
  sessionId: string,
  streamId: string,
  baseRevision: number,
  output: FullDocumentProviderOutput,
): PatchEnvelope[] {
  const document = output.document;
  const root = document.blocks[document.rootBlockId];
  const rootChildren = root?.children ?? [];
  const resourceOps: PatchOperation[] = Object.keys(document.resourceManifest.resources).length
    ? [{ op: 'setResourceManifest', manifest: document.resourceManifest }]
    : [];
  const blockCreates = collectBlocksPostOrder(document)
    .filter((block) => block.id !== document.rootBlockId)
    .map((block): PatchOperation => ({ op: 'createBlock', block: { ...block, children: [], eventIntents: undefined } }));
  const childSetOps = Object.values(document.blocks)
    .filter((block) => block.id !== document.rootBlockId && block.children.length > 0)
    .map((block): PatchOperation => ({ op: 'setChildren', blockId: block.id, childIds: block.children }));
  const routeOps: PatchOperation[] = document.facsimileRoute
    ? [{ op: 'setFacsimileRoute', route: document.facsimileRoute }]
    : [];

  return stagedEnvelopes(sessionId, streamId, baseRevision, [
    [
      { op: 'setAppIdentity', identity: document.appIdentity },
      { op: 'setStage', stage: 'identifying' },
    ],
    [
      ...resourceOps,
      ...blockCreates,
      ...childSetOps,
      { op: 'setChildren', blockId: document.rootBlockId, childIds: rootChildren },
      ...Object.values(document.eventIntents).map((intent): PatchOperation => ({ op: 'registerEventIntent', intent })),
      ...routeOps,
      { op: 'setStatusText', text: output.statusText ?? document.appIdentity.statusText },
      { op: 'setStage', stage: output.stale ? 'stale' : 'ready' },
    ],
  ]);
}

export function cacheReplayStream(sessionId: string, baseRevision: number, statusText: string, stale: boolean): PatchEnvelope[] {
  return stagedEnvelopes(sessionId, `${sessionId}-cache-replay`, baseRevision, [
    [
      { op: 'setStatusText', text: statusText },
      { op: 'setStage', stage: stale ? 'stale' : 'ready' },
    ],
  ]);
}

function stagedEnvelopes(
  sessionId: string,
  streamId: string,
  baseRevision: number,
  stages: PatchOperation[][],
): PatchEnvelope[] {
  let revision = baseRevision;
  return stages
    .filter((ops) => ops.length > 0)
    .map((ops, index) => {
      const envelope: PatchEnvelope = {
        protocolVersion: 1,
        sessionId,
        streamId,
        seq: index + 1,
        baseRevision: revision,
        resultRevision: revision + 1,
        kind: 'transaction',
        payload: {
          transactionId: `${streamId}-tx-${index + 1}`,
          ops,
        },
      };
      revision += 1;
      return envelope;
    });
}

function collectBlocksPostOrder(document: GeneratedDocument) {
  const seen = new Set<string>();
  const ordered: GeneratedDocument['blocks'][string][] = [];

  const visit = (blockId: string) => {
    if (seen.has(blockId)) return;
    const block = document.blocks[blockId];
    if (!block) return;
    seen.add(blockId);
    for (const childId of block.children) {
      visit(childId);
    }
    ordered.push(block);
  };

  visit(document.rootBlockId);
  return ordered;
}
