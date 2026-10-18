"""Download pinned chess assets and corresponding engine source. No npm scripts."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / "webapp" / "frontend" / "vendor"
ASSETS = {
    "chess/chess.mjs": "https://unpkg.com/chess.js@1.4.0/dist/esm/chess.js",
    "chess/LICENSE": "https://unpkg.com/chess.js@1.4.0/LICENSE",
    "stockfish/stockfish-19-lite-single.js": "https://unpkg.com/stockfish@19.0.1/bin/stockfish-19-lite-single.js",
    "stockfish/stockfish-19-lite-single.wasm": "https://unpkg.com/stockfish@19.0.1/bin/stockfish-19-lite-single.wasm",
    "stockfish/COPYING.txt": "https://raw.githubusercontent.com/nmrugg/stockfish.js/v19.0.1/Copying.txt",
    "stockfish/README.upstream.md": "https://raw.githubusercontent.com/nmrugg/stockfish.js/v19.0.1/README.md",
    "stockfish/source-v19.0.1.tar.gz": "https://codeload.github.com/nmrugg/stockfish.js/tar.gz/refs/tags/v19.0.1",
}


def download(item):
    name, url = item
    request = urllib.request.Request(url, headers={"User-Agent": "Teramont-pinned-assets"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
    target = ROOT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
    return {"path": name, "url": url, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=4) as pool:
        files = list(pool.map(download, ASSETS.items()))
    network = ROOT / "stockfish" / "nn-61e7af4bb97d.nnue"
    expected = "61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b"
    if not network.exists() or hashlib.sha256(network.read_bytes()).hexdigest() != expected:
        node = shutil.which("node")
        if not node:
            raise RuntimeError("Node.js is required to recover the embedded evaluation file.")
        subprocess.run([node, str(Path(__file__).with_name("extract_stockfish_net.cjs"))], check=True)
    files.append({"path": "stockfish/" + network.name, "source": "Unmodified embedded evaluation file recovered from the pinned WASM memory image", "bytes": network.stat().st_size, "sha256": expected})
    manifest = {"chess.js": "1.4.0", "stockfish": "19.0.1", "files": files}
    (ROOT / "chess-assets.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps([{"path": f["path"], "bytes": f["bytes"]} for f in files], ensure_ascii=False))
