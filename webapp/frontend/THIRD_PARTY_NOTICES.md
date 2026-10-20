# Third party notices

The star glyph in `js/visuals.js` is adapted from Iconimate Star,
https://iconimate.app/r/star.json (version c23cf7ea1e2e).
Iconimate animation reference: Copyright (c) 2026 Muhammad Ammar (smammar100).
Glyph geometry: Copyright (c) 2023 Phosphor Icons, https://phosphoricons.com.
The React/Motion implementation is not shipped; the app uses a static SVG and its
own CSS entrance animation, disabled for prefers-reduced-motion.

## MIT License (Iconimate / Phosphor Icons)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Game illustrations and other navigation glyphs are original Teramont artwork.
MCP documentation from ArloUI, Astryx, HeroUI and 21st.dev was used for design
research; their React component source code is not distributed in this app.

## Chess

- chess.js 1.4.0: Copyright (c) 2025 Jeff Hlywa. BSD-2-Clause; full notice in
  `vendor/chess/LICENSE`. The unmodified ES module is loaded lazily.
- Stockfish.js 19.0.1: Copyright (c) 2026 Chess.com, LLC and the Stockfish
  contributors. GPL v3; full license in `vendor/stockfish/COPYING.txt`.
  Unmodified published lite-single worker and WASM are supplied with the
  corresponding source archive, evaluation network and build instructions in
  `vendor/stockfish/`. They are accessible in the chess screen's engine details.
- The chess pieces are original SVG artwork in `js/chess-pieces.js`.

## Poker

The complete 52-card vector deck, backs, court illustrations, poker icons and CSS
motion in `js/poker-cards.js`, `css/poker-cards.css` and `css/poker.css` are original
Teramont artwork. ArloUI Motion, 21st.dev card-flip metadata and Iconimate were
consulted as design references; their component source is not copied or shipped.
No new runtime dependency is required by poker.

## Lumen: The Last Beacon

The survival simulation, interface, Web Audio tones and preserved legacy art
are original implementation for Teramont. The first pixel-art slice (19 Oct 2026)
uses project-specific PNG artwork generated with the built-in OpenAI imagegen
tool: scout, seed-creature, botanical scenery and paving. Full source outputs,
generation prompts, normalization code and SHA-256 manifest are retained in
`design/lumen-pixel/` and `assets/lumen/manifest.json`. Device glyphs, particles
and panel pixels are original editable project artwork. No Vampire Survivors
assets, third-party sprite packs, music or game code were copied or distributed.
This provenance does not assert exclusive copyright in generated outputs.

The 20 Oct 2026 revision adds complete blue armored and lavender flying creature
animation sheets and a warmer scenery edit via the same built-in imagegen tool.
The flying reference is exported from original project art. Sources and briefs:
`design/lumen-pixel/motion-sources.md`. Weapon and crystal PNG atlases are original
editable pixel artwork in the offline asset builder.

The current Lumen interface uses Tektur by Adam Jagosz / The Tektur Project
Authors, Copyright 2023, https://www.github.com/hyvyys/Tektur, under SIL Open
Font License 1.1. Source: https://github.com/google/fonts/tree/main/ofl/tektur.
The original variable source and its license are retained in
`design/lumen-pixel/sources/Tektur.ttf` and `OFL-Tektur.txt`. The runtime font is
an offline static Latin/Cyrillic subset (width90, weight600), served locally as
`assets/lumen/fonts/Tektur-game.ttf`. The complete license is distributed at
`assets/lumen/fonts/OFL-Tektur.txt`. This font remains under OFL.

The Tiny5 font from the first art slice is retained for history. It is by The Tiny5 Project Authors / Stefan Schmidt,
under SIL Open Font License 1.1. Source: https://github.com/Gissio/font_tiny5 and
https://github.com/google/fonts/tree/main/ofl/tiny5. The complete source font is
retained in `design/lumen-pixel/sources/Tiny5.ttf`; the runtime font is a static
default-axis Latin/Cyrillic subset. Its license and attribution are distributed
at `assets/lumen/fonts/OFL.txt`. This font remains under OFL.

The game still uses browser APIs and the existing Telegram integration, without
a new runtime library. `openai/plugins` game-studio skills were consulted as
workflow instructions; their code/assets are not bundled into the game.
Provenance and staging scope: `design/lumen-provenance.md` and
`design/lumen-pixel/direction.md` in the repository.
