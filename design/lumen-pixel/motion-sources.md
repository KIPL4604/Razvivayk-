# Production source briefs · 20 Oct 2026

Built-in imagegen, transparent outputs, each whole sheet generated in one edit.
The following records the production specifications. Original PNGs are preserved
in sources/ and hashed in the manifest; no third-party sprite-pack imports.
Generated output is not represented as exclusive copyrighted art.

- beetle-raw.png: reference seed.png. The copper creature's family, but heavier
  cobalt armored botanical beetle, ivory face, warm legs, lilac shell highlights.
  Top-down3/4,6columns×5rows, idle/walk/attack/hurt/death,6frames each, stable
  proportions/baseline, transparent margins, intended48×48, no labels/background.
- wasp-seed.png: exported from this project's original legacy-art wasp renderer.
  User liked that silhouette, retained as reference, not a third-party asset.
- wasp-raw.png: edit reference wasp-seed.png. Slender lavender body, ivory/pink
  face, wide lilac wings, distinct wing flap.6×5, same5states, stable scale,
  top-down3/4, complete transparent frames, no text/background.
- garden-color-raw.png: edit reference garden-raw.png. Preserve4×2atlas and all
  objects; golden copper beacon, sandstone pillar, blue/lavender flowers,
  coral blossoms, quiet teal leaves. No new obstacles/characters.

Normalization: common actor bounds/one scale, nearest sampling, bottom-center45,
hard alpha,48-color palette (scout/mote32). Generated wasp chroma fringe and
translucent debris removed by builder; raw remains unchanged. Preview contains
all60new normalized frames. combat.png/weapons.png are original native pixel
art defined in build_assets.py: gold bolt, blue blade, violet wave, red hostile,
cyan sliver/amber hexagon/rose cluster gems and corresponding weapon glyphs.
