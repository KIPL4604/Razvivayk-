# Stockfish.js 19.0.1 Lite Single

Upstream: https://github.com/nmrugg/stockfish.js/tree/v19.0.1
Engine license: [GPL v3](COPYING.txt).

The unchanged JavaScript and WASM files come from the published npm package
`stockfish@19.0.1`. SHA-256 hashes and exact asset URLs are recorded in
`../chess-assets.json`.

Corresponding source is supplied beside the binaries:

- [Source archive, tag v19.0.1](source-v19.0.1.tar.gz)
- [Embedded evaluation network](nn-61e7af4bb97d.nnue)
- [Upstream README and build instructions](README.upstream.md)

The network is an unchanged copy of the data embedded in the published engine.
Its full SHA-256 is
`61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b`.

To build: extract the source archive; install and activate Emscripten 6.0.9
and Node.js as described upstream. Place the supplied network in the extracted
`src/` directory, then run from the extracted project root:

```sh
npm ci
node build.js --lite --single-threaded --no-split
```

No engine source changes or local binary build were made for Teramont. The app
communicates with this separate worker through UCI messages. Runtime loading
uses only the JavaScript and WASM; the source archive and evaluation file are
provided for redistribution and rebuilding, and are not downloaded during play.
