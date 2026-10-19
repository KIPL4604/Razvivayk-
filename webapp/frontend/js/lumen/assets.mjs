// Assets are lazy, local and decoded before a run becomes interactive.
const base = new URL('../../assets/lumen/', import.meta.url);
let pending;
export function loadArt() {
  pending ||= (async () => {
    const response = await fetch(new URL('manifest.json', base));
    if (!response.ok) throw new Error('Lumen asset manifest unavailable');
    const manifest = await response.json();
    if (manifest.version !== 1 || manifest.frameSize !== 48) throw new Error('Unsupported Lumen artwork');
    const entries = await Promise.all(Object.keys(manifest.files).map(async file => {
      const image = new Image();
      image.src = new URL(file, base).href;
      await image.decode();
      return [file.replace('.png', ''), image];
    }));
    return { manifest, images: Object.fromEntries(entries) };
  })().catch(error => { pending = null; throw error; });
  return pending;
}
