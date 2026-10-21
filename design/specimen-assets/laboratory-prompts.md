# Лаборатория · оригинальные PNG / 21.10.2026

Созданы встроенным imagegen с прозрачным фоном. Сторонние игровые ресурсы не
использовались. Исходники сохранены как `nest-source.png` и `flamer-source.png`.
`python design/specimen-assets/build-laboratory.py` нормализует общий масштаб,
альфа-канал, сетку/якорь и manifest SHA-256; `build.py` запускает его последним.
Нормализация не перерисовывает изображения. Runtime: `nest.png`256×256,
4кадра128×128; `flamer.png`384×64,6кадров64×64, якорь(32,58).

## nest-source.png — точный запрос

Production original sprite atlas for a side-view 2D industrial laboratory horror game. Transparent background, no scenery, no labels, no text, exact 2 columns by 2 rows equally sized cells, no borders. All four cells show the SAME organic wall checkpoint plug, roughly circular 130-pixel-wide silhouette, ragged fleshy crimson fibrous biomass fused into fractured dark steel rim, torn wall edges, dense red rope-like intertwined tendrils spreading outwards, as if a large amorphous creature survived an explosion and sealed a breach with its own body. In the middle a clearly visible luminous GREEN HEART/CORE behind translucent wet membranes. Top-left core dim green, top-right core bright pulse, bottom-left brighter pulse with a few thin organic veins lit green, bottom-right core dim green with small tendril flex. Same geometry, size, angle and baseline across cells. Crisp detailed pixel art with readable clusters, deep burgundy shadows, warm crimson highlights, small emerald green glow; gory but no humans or body parts. Orthographic straight-on wall attachment, intended as an in-world checkpoint 96x112 pixels. Entire sprite including steel rim visible in each cell. Original design, no named game references.

## flamer-source.png — точный запрос

Original production pixel-art sprite animation sheet for a 2D side-view laboratory game. Transparent background, no scenery, no labels, no text, exactly SIX equal cells in ONE horizontal row, each sprite with same bottom-center foot anchor and constant size. One human laboratory security flamethrower operator wearing ochre yellow fire-resistant full coveralls, dark boots and gloves, compact dark respirator visor helmet, red-brown fuel canister backpack, dark hose to a short heavy flamethrower held facing RIGHT. Profile view. Six frames in order: idle standing ready, walking left leg forward, walking right leg forward, aiming weapon and small bright orange pilot light, recoil/hurt leaning back, knocked down lying on floor with weapon beside torso. Full figure in every cell, no large flame plume, no cast floor shadow. Same person, identical outfit, palette, proportions and facing, crisp detailed readable pixel clusters matching small 64x64 game actor frames, warm gray metal, mustard suit clearly different from dark rifle guard and white scientist. No grotesque body injury. Original design.
