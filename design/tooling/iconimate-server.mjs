import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Local Codex adapter. Source data and icon code come from the official registry.
const ORIGIN = 'https://iconimate.app';
const MAX_BYTES = 5 * 1024 * 1024;
let cache = null;

async function readJson(path) {
  const url = new URL(path, ORIGIN);
  if (url.origin !== ORIGIN) throw new Error('Only the official Iconimate registry is supported.');
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json' },
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Iconimate registry returned HTTP ${response.status}.`);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Registry response exceeds the supported size.');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function catalog() {
  if (cache && Date.now() - cache.retrievedAt < 300000) return cache;
  const registry = await readJson('/r/registry.json');
  if (!Array.isArray(registry.items)) throw new Error('Unexpected registry format.');
  cache = { items: registry.items, retrievedAt: Date.now() };
  return cache;
}

const text = value => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const run = handler => async input => {
  try { return text(await handler(input)); }
  catch (error) {
    return { isError: true, content: [{ type: 'text', text: `Iconimate unavailable: ${error.message}` }] };
  }
};
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const server = new McpServer({ name: 'iconimate-local-adapter', version: '1.0.0' });

server.registerTool('iconimate_search', {
  title: 'Search official Iconimate icons',
  description: 'Search animated React icons in the official Iconimate registry by name or description. Returns metadata and source URLs without installing or executing code. Query terms use English icon names.',
  inputSchema: { query: z.string().max(120).default(''), limit: z.number().int().min(1).max(30).default(8) },
  annotations,
}, run(async ({ query, limit }) => {
  const data = await catalog();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = data.items.map(item => {
    const name = String(item.name || '').toLowerCase();
    const description = String(item.description || '').toLowerCase();
    const score = terms.reduce((sum, term) => sum + (name === term ? 10 : name.includes(term) ? 4 : description.includes(term) ? 1 : 0), 0);
    return { item, score };
  }).filter(entry => !terms.length || entry.score > 0).sort((a, b) => b.score - a.score);
  return {
    source: `${ORIGIN}/r/registry.json`, retrievedAt: new Date(data.retrievedAt).toISOString(),
    catalogSize: data.items.length, matches: matches.length,
    results: matches.slice(0, limit).map(({ item }) => ({
      name: item.name, title: item.title, description: item.description, version: item.meta?.version,
      registryUrl: `${ORIGIN}/r/${encodeURIComponent(item.name)}.json`,
    })),
  };
}));

server.registerTool('iconimate_get', {
  title: 'Get official Iconimate component source',
  description: 'Retrieve one icon found with iconimate_search. Returns the official React/TSX code, dependencies and attribution; it does not install it. React/Motion code requires adaptation for vanilla JavaScript. Preserve the source license and honor reduced motion.',
  inputSchema: { name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) },
  annotations,
}, run(async ({ name }) => {
  const data = await catalog();
  if (!data.items.some(item => item.name === name)) throw new Error('Icon is not present in the official catalog.');
  const item = await readJson(`/r/${name}.json`);
  if (item.name !== name || !Array.isArray(item.files)) throw new Error('Unexpected icon response.');
  return {
    source: `${ORIGIN}/r/${name}.json`, retrievedAt: new Date().toISOString(),
    note: 'Official publisher code, not executed. React/Motion component; preserve Iconimate and Phosphor MIT notices.',
    name: item.name, title: item.title, dependencies: item.dependencies || [],
    registryDependencies: item.registryDependencies || [], files: item.files,
  };
}));

await server.connect(new StdioServerTransport());
