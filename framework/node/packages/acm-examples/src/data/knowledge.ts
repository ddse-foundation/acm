import { loadJson, loadText } from './loader.js';

export interface KnowledgeSnippetMeta {
  id: string;
  title: string;
  tags: string[];
  path: string;
  summary: string;
}

interface KnowledgeIndex {
  snippets: KnowledgeSnippetMeta[];
}

let cachedIndex: KnowledgeIndex | null = null;

async function loadIndex(): Promise<KnowledgeIndex> {
  if (cachedIndex) {
    return cachedIndex;
  }

  cachedIndex = await loadJson<KnowledgeIndex>('data/knowledge/index.json');
  return cachedIndex;
}

export async function searchSnippets(query: string): Promise<KnowledgeSnippetMeta[]> {
  const index = await loadIndex();
  const lower = query.toLowerCase();
  return index.snippets
    .map(snippet => ({
      snippet,
      score: scoreSnippet(snippet, lower),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.snippet);
}

function scoreSnippet(snippet: KnowledgeSnippetMeta, query: string): number {
  const haystack = `${snippet.title} ${snippet.tags.join(' ')} ${snippet.summary}`.toLowerCase();
  let score = 0;
  for (const term of query.split(/\s+/)) {
    if (!term) continue;
    if (haystack.includes(term)) {
      score += 2;
    }
    for (const tag of snippet.tags) {
      if (tag.toLowerCase() === term) {
        score += 3;
      }
    }
  }
  return score;
}

export async function loadSnippetContent(docId: string): Promise<string | undefined> {
  const index = await loadIndex();
  const snippet = index.snippets.find(item => item.id === docId);
  if (!snippet) {
    return undefined;
  }

  return loadText(pathForSnippet(snippet.path));
}

function pathForSnippet(relative: string): string {
  return pathNormalize(`data/knowledge/${relative}`);
}

function pathNormalize(relative: string): string {
  return relative.replace(/\\/g, '/');
}

export async function getSnippetMeta(docId: string): Promise<KnowledgeSnippetMeta | undefined> {
  const index = await loadIndex();
  return index.snippets.find(item => item.id === docId);
}
