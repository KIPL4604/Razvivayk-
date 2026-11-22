import { loadPyodide } from "../../vendor/pyodide-314.0.8/pyodide.mjs";

const indexURL = new URL("../../vendor/pyodide-314.0.8/", import.meta.url).href;
let runtime;

async function load() {
  const response = await fetch(new URL("course-python.py?v=1", import.meta.url));
  if (!response.ok) throw new Error("Missing Python course runner");
  const code = await response.text();
  const python = await loadPyodide({ indexURL, stdout: () => {}, stderr: () => {} });
  python.runPython(code);
  for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "BroadcastChannel", "indexedDB", "caches"]) {
    Object.defineProperty(globalThis, name, { value: undefined, configurable: false, writable: false });
  }
  return python.globals.get("run_station");
}

self.onmessage = async ({ data: { id, request } }) => {
  try {
    runtime ??= load();
    const run = await runtime;
    self.postMessage({ id, running: true });
    self.postMessage({ id, result: JSON.parse(run(JSON.stringify(request))) });
  } catch {
    self.postMessage({
      id, restart: true,
      result: {
        ok: false, output: [],
        error: { name: "Python", message: "Не удалось выполнить код. Попробуй запустить снова." },
      },
    });
    runtime = undefined;
  }
};
