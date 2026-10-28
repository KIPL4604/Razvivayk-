// Assets are lazy, local and decoded before a run becomes interactive.
const base = new URL('../../assets/lumen/', import.meta.url);
let pending;
export function loadArt() {
  pending ||= (async () => {
    const response = await fetch(new URL('manifest.json', base));
    if (!response.ok) throw new Error('Lumen asset manifest unavailable');
    const manifest = await response.json();
    if (manifest.version !== 1 || manifest.frameSize !== 48 || manifest.packFormat !== 'image/webp' || !Array.isArray(manifest.packs)) throw new Error('Unsupported Lumen artwork');
    const packs = Object.create(null);
    for (const entry of manifest.packs) {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        const packUrl = new URL(entry.file, base);
        packUrl.searchParams.set('v', entry.sha256.slice(0, 16));
        packUrl.searchParams.set('attempt', String(attempt));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        try {
          const packResponse = await fetch(packUrl, {signal: controller.signal, cache: 'no-store', priority: 'high'});
          if (!packResponse.ok) throw new Error(`Lumen artwork pack unavailable: ${entry.file}`);
          const pack = await packResponse.arrayBuffer();
          if (pack.byteLength !== entry.bytes) throw new Error(`Incomplete Lumen artwork pack: ${entry.file}`);
          packs[entry.file] = pack;
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        } finally {
          clearTimeout(timeout);
        }
      }
      if (lastError) throw lastError;
    }
    const entries = await Promise.all(Object.entries(manifest.files).map(async ([file, entry]) => {
      const invalid = () => { throw new Error(`Invalid Lumen artwork entry: ${file}`); };
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid();
      const chunks = entry.chunks === undefined
        ? [{pack:entry.pack, offset:entry.offset, bytes:entry.packBytes}]
        : entry.chunks;
      if (!Array.isArray(chunks) || !chunks.length) invalid();
      const slices = chunks.map(chunk => {
        if (!chunk || typeof chunk !== 'object' || typeof chunk.pack !== 'string') invalid();
        const pack = packs[chunk.pack];
        if (!pack || !Number.isSafeInteger(chunk.offset) || !Number.isSafeInteger(chunk.bytes) ||
            chunk.offset < 0 || chunk.bytes < 1 || chunk.offset + chunk.bytes > pack.byteLength) invalid();
        return pack.slice(chunk.offset, chunk.offset + chunk.bytes);
      });
      const image = new Image();
      const url = URL.createObjectURL(new Blob(slices, {type:manifest.packFormat}));
      try {
        image.src = url;
        await image.decode();
      } finally {
        URL.revokeObjectURL(url);
      }
      return [file.replace('.png', ''), image];
    }));
    return { manifest, images: Object.fromEntries(entries) };
  })().catch(error => { pending = null; throw error; });
  return pending;
}
