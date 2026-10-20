# Imagegen source log · 19.10.2026

Built-in `image_gen.imagegen`, no API/CLI fallback. The raw PNG outputs are kept
in `sources/`, SHA-256 recorded in `webapp/frontend/assets/lumen/manifest.json`.
The seed was inspected before the full-sheet edits. No frame was generated
independently. At this historical stage approval was pending. On20Oct the user accepted the
style; later source briefs are in motion-sources.md.

## seed.png · transparent=true · no references

```text
Production pixel art sprite SEED REFERENCE for an original top-down 3/4 indie survival game 'Lumen: last beacon', night botanical ruins setting. Transparent PNG, no words, no UI, no background. Exactly TWO isolated sprites, left half ONE hero, right half ONE enemy. Each fits a 48x48 logical pixel grid, shown at large crisp nearest-neighbor scale with hard square pixel clusters, no anti-alias, no gradient. Both full-body with same floor baseline, slight top-down 3/4 view facing southeast. Hero: small readable ivory hood with pointed back, shadowed face with two mint glowing eyes, worn deep teal short cape and tunic, brown leather belt, sturdy dark boots, right hand holding a small copper lantern staff with mint luminous glass. Distinct handcrafted silhouette, approx 38 pixels tall, restrained charming serious indie aesthetic. Enemy: ONE squat copper amber seed-creature / botanical beetle, armored seedpod shell with leaflike pointed crown, three pairs of tiny jointed legs, dark face with two cream glowing eyes and a mint crack in amber shell, approx 27 pixels tall. Enemy MUST read hostile and organic, not a crystal or geometric shape. Limited shared palette: outline #111b25, deep teal #1c3338 #29504a #49725c, mint #83cda4 #c5e8ba, ivory #f1dfaf #c3ac7c, copper #b66b45 #e39b5d, shadow #533f3d. No imitation of existing game assets. No extra poses. Leave generous transparent empty space around both.
```

## scout-raw.png · transparent=true · edit reference: seed.png

```text
Use the LEFT ivory hood teal lantern hero in the reference as the EXACT character design seed. Produce ONE production ANIMATION SPRITE SHEET for only this hero. TRANSPARENT BACKGROUND. EXACTLY 6 evenly spaced columns x 5 evenly spaced rows, 30 complete isolated frames total. No text, no labels, no grid lines, no enemy, no scenery. Canvas landscape ratio 6:5. Each cell is identical size, hero bottom-center anchored at same floor baseline, same scale and proportions in all 30 frames, consistent right/southeast facing 3/4 top-down view. Preserve pointed ivory hood, dark face two mint eyes, teal cape and tunic, belt boots copper lantern staff, same palette and silhouette family. Each cell intended for 48x48 logical pixels, hero fills 38x40 px at most. Crisp low-resolution hand-clustered PIXEL ART, flat restricted colors, no anti-alias or painterly shading. Row1 SIX idle breathing frames: very subtle hood and lantern bob. Row2 SIX walking frames: distinct alternating legs, lifted boot, cape moves, locomotion cycle. Row3 SIX attack frames: lantern raises, outward thrust, mint spark at lantern tip, recoil then recover; staff remains in hand. Row4 SIX hurt frames: lean back, cape recoils, one ivory/mint flash, recover, do not change outfit. Row5 SIX death frames: kneel, hood sinks, fall sideways, cloak settles, extinguished lantern, final small collapsed body. All actions in place, do not change facing, do not rotate whole image, do not crop any body part or lantern. Need exactly all thirty frames, equally spaced clean transparent empty margins, avoid any characters extending outside their cell. This is a functional sprite atlas, not concept art.
```

## mote-raw.png · transparent=true · edit reference: seed.png

```text
Use only the RIGHT copper botanical seed-beetle in the reference as the exact enemy design seed. Create a production pixel-art ANIMATION SPRITE SHEET. Transparent background. EXACTLY 6 evenly spaced columns and 5 evenly spaced rows = 30 isolated frames, landscape 6:5 ratio. No hero, no words, labels, grids, scenery or background. Each cell same size, creature anchored bottom-center on shared baseline, all frames same size and southeast facing top-down 3/4 view. Crisp low-resolution square pixel clusters, suitable for 48x48 game cells with creature about 32x30 px. Preserve copper seedpod shell, spiky green leaf crown, mint crack down shell, six articulated little legs and dark face with two ivory glowing eyes, limited copper/olive/mint/ivory palette with dark navy outline. ROW1 six subtle idle breathing frames. ROW2 six walk cycle frames with alternating legs and stable shell. ROW3 six bite attack frames: crouch, lunge forward in-place, mandibles snap, recover. ROW4 six hurt frames: recoil, shell squashes, brief ivory highlight, recover; same silhouette. ROW5 six death frames: legs buckle, body tilts, shell splits, mint light escapes, collapsed dark seed shell, final dead shell. One sheet at once, strong consistency across all 30 frames, generous equal transparent margins between slots. Fully inside cells, never overlap neighboring frames. No smooth gradients or blur, no photorealism, no imitation of existing game assets.
```

## garden-raw.png · transparent=true · no references

```text
Production pixel art environment atlas for original top-down 3/4 night botanical ruins survival game. EXACT 4 columns x 2 rows = EIGHT equal square slots, transparent outside objects, landscape ratio 2:1, no text labels grid or UI, crisp square pixel clusters at 64x64 logical pixels per slot, no blur, no antialias. Shared limited palette: deep navy #111b25, slate teal #1c3338 #29504a, moss #49725c #75945b, mint #83cda4 #c5e8ba, warm ivory #f1dfaf #c3ac7c, copper #b66b45. ROW1: slot1 one square 32x32 seamless dark weathered moss stone floor tile FILL ENTIRE SLOT edge-to-edge, understated low contrast; slot2 a different square dark cracked slate floor tile fill entire slot; slot3 same dark stone floor with sparse tiny moss between slabs fill entire slot; slot4 same floor with subtle tiny old etched botanical motifs fill entire slot. Floor tiles must be dark desaturated and quiet, no big objects on floor. ROW2 on transparent ground: slot1 ONE ornate ancient beacon: moss stone pedestal with a faceted mint glass lantern/crystal inside copper housing, two tier round stone plinth seen 3/4 from above, about 54px tall; slot2 ONE dense cluster of ferns and pale blue tiny bioluminescent flowers on mossy earth, about 44px wide; slot3 ONE broken carved stone column with ivy and warm pale rim, about 46px tall; slot4 ONE gnarled small botanical tree shrub with broad layered dark teal leaves and a few subtle mint flowers, about 54px tall. Each prop complete within its own slot with ample transparent margin, same scale lighting upper left, detailed but readable at 1x. No character, no creature, no copying assets from existing games. Keep exactly all eight slots aligned and equally sized.
```

Only the props from this output ship; its noisy paving was superseded below.

## floor-raw.png · transparent=false · no references

```text
A production tile atlas for a top-down pixel art game. EXACTLY FOUR square tiles in ONE horizontal row, 4:1 wide composition, tiles touch edge-to-edge with NO gaps NO margin NO text. Each tile is exactly ONE large dark ancient stone paving slab, not a field of many slabs. Target logical tile resolution 32x32 pixels, chunky visibly hard pixel clusters, strictly low detail, 5 colors only: #17262e #1c3338 #25434a #29504a #376157. Dark low contrast night garden ground that lets bright characters stand out. Tile1 one simple square slate slab with a few subtle 2px wear marks and shaded 1px edges. Tile2 same matching slab with ONE thin diagonal crack. Tile3 same slab with small sparse moss cluster only in lower-left corner. Tile4 same slab with ONE very faint incomplete botanical circle engraving. SAME background level and edge pattern on all four so each tile can be placed in any order seamlessly with no black holes, borders or grid seams; edges match at all sides. Flat orthographic overhead perspective, no extrusion, no props, no highlights, no gradients, no grain, no dithering, no tiny noisy texture, no photorealism, no glossy lighting. Hand-authored 32px pixel game tiles, restrained elegant game art.
```

## Font and rebuilding

`sources/Tiny5.ttf`: downloaded19 Oct2026 from
https://raw.githubusercontent.com/google/fonts/main/ofl/tiny5/Tiny5%5BBLED%2CJITT%2CROND%2Cwdth%2Cwght%5D.ttf
with its OFL.txt from the same directory. Not generated by imagegen.
Original retained; static default-axis Latin/Cyrillic subset ships with OFL.

```powershell
python -m pip install -r design/lumen-pixel/requirements.txt
python design/lumen-pixel/build_assets.py
python tests/test_lumen_art.py
```

Builder does not call the network or regenerate art. It imports inspected whole
sheets, uses one scale per actor and bottom-center anchor, removes detached
neighbor scraps, samples nearest, imposes hard alpha and fixed palette, packs
atlas/manifest/cover/contact sheet, subsets the font. Runtime has no Pillow or
FontTools dependency. Default CI still checks hashes without art dependencies;
the two pixel inspection cases explicitly skip if Pillow is not installed.
