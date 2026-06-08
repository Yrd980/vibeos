import { resolveSearchResults, resolveSemanticSuggestions } from './intentResolver';
import type { LaunchIntent, SearchResult, ShellState } from './types';

export function setSearchQuery(
  shell: ShellState,
  query: string,
  scheduleSemantic: (requestId: number, query: string, results: SearchResult[]) => void,
) {
  shell.searchQuery = query;
  shell.semanticSuggestions = [];
  shell.semanticStatus = query.trim() ? 'debouncing' : 'idle';
  shell.semanticRequestId += 1;
  const requestId = shell.semanticRequestId;
  shell.searchResults = resolveSearchResults(query, shell.recentIntents);
  shell.selectedSearchIndex = 0;

  if (query.trim()) {
    const schedule = globalThis.setTimeout ?? ((callback: () => void) => {
      callback();
      return 0;
    });
    schedule(() => {
      scheduleSemantic(requestId, query, resolveSemanticSuggestions(query));
    }, 180);
  }
}

export function applySemanticSuggestions(shell: ShellState, requestId: number, query: string, results: SearchResult[]) {
  if (requestId !== shell.semanticRequestId || query !== shell.searchQuery) {
    return;
  }

  shell.semanticSuggestions = results;
  shell.semanticStatus = 'idle';
  shell.searchResults = mergeSearchResults(resolveSearchResults(query, shell.recentIntents), results);
}

export function selectDesktopIcon(shell: ShellState, iconId: string) {
  shell.desktopSelectedIconId = iconId;
}

export function moveSearchSelection(shell: ShellState, delta: number) {
  const count = shell.searchResults.length;
  if (!count) return;
  shell.selectedSearchIndex = (shell.selectedSearchIndex + delta + count) % count;
}

export function rememberIntent(shell: ShellState, intent: LaunchIntent) {
  if (intent.kind === 'local-app') return;
  shell.recentIntents = [
    intent,
    ...shell.recentIntents.filter((recent) => recent.rawQuery !== intent.rawQuery),
  ].slice(0, 12);
}

function mergeSearchResults(localResults: SearchResult[], semanticResults: SearchResult[]) {
  const seen = new Set(localResults.map((result) => `${result.title}-${result.kind}`));
  return [
    ...localResults,
    ...semanticResults.filter((result) => {
      const key = `${result.title}-${result.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ].slice(0, 12);
}
