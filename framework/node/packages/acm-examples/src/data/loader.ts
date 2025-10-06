import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonCache = new Map<string, unknown>();
const textCache = new Map<string, string>();
const pathCache = new Map<string, string>();

function candidatePaths(relativePath: string): string[] {
  return [
    path.resolve(process.cwd(), relativePath),
    path.resolve(__dirname, '..', '..', relativePath),
    path.resolve(__dirname, '..', '..', '..', relativePath),
  ];
}

async function readDataFile(relativePath: string): Promise<{ absolute: string; content: string }> {
  if (pathCache.has(relativePath)) {
    const absolute = pathCache.get(relativePath)!;
    const content = await readFile(absolute, 'utf-8');
    return { absolute, content };
  }

  const candidates = candidatePaths(relativePath);
  let lastError: unknown;

  for (const absolute of candidates) {
    try {
      const content = await readFile(absolute, 'utf-8');
      pathCache.set(relativePath, absolute);
      return { absolute, content };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to read data file ${relativePath}`);
}

export async function loadJson<T>(relativePath: string): Promise<T> {
  if (pathCache.has(relativePath)) {
    const absolute = pathCache.get(relativePath)!;
    if (jsonCache.has(absolute)) {
      return jsonCache.get(absolute) as T;
    }
  }

  const { absolute, content } = await readDataFile(relativePath);
  if (jsonCache.has(absolute)) {
    return jsonCache.get(absolute) as T;
  }

  const parsed = JSON.parse(content) as T;
  jsonCache.set(absolute, parsed);
  return parsed;
}

export async function loadText(relativePath: string): Promise<string> {
  if (pathCache.has(relativePath)) {
    const absolute = pathCache.get(relativePath)!;
    if (textCache.has(absolute)) {
      return textCache.get(absolute)!;
    }
  }

  const { absolute, content } = await readDataFile(relativePath);
  textCache.set(absolute, content);
  return content;
}

export function clearDataCaches(): void {
  jsonCache.clear();
  textCache.clear();
  pathCache.clear();
}
