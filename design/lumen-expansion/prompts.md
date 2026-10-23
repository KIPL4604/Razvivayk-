# Original generated assets · 23 October 2026

Tool: built-in `image_gen.imagegen`, `transparent_background=true`. No CLI/API
fallback, external asset pack, or hand-drawn actor substitute. Project sources:
`design/lumen-expansion/sources/`. Runtime: `webapp/frontend/assets/lumen/`.
Normalization and previews: `design/lumen-expansion/build_assets.py`.

## Shared complete-sheet prompt

Use case: stylized-concept. Asset type: original Lumen production pixel-art
sprite sheet. Transparent RGBA background, exact SIX columns by FIVE rows,
thirty complete separate sprites, evenly spaced slots. Each row shows the
SAME playable hero in SIX distinct consecutive poses. Rows in order: idle
breathing, walking cycle, attacking, recoiling hurt, collapsing death.
3/4 top-down camera, hero faces down-right throughout. Compact full-body
proportions, readable face, dark one-pixel contour, chunky crisp pixel clusters,
highlights from upper-left, 32-color palette, no blur, scenery, text, grid,
labels, or ground shadow. All slots center body on same baseline; full body
always visible, generous transparent gutters. Animate whole sheet at once
with stable outfit proportions. Native appearance suitable for 48x48 frames
like a carefully crafted 1990s action RPG. Every attack frame MUST contain
hero's complete humanoid body; weapon remains beside hand, never replaces body.

Each subject below was appended to the shared prompt and generated as one
complete thirty-frame sheet.

## tinkerer-raw.png

Subject: original female wind engineer / tinkerer, short mint-green hair and
copper goggles on forehead, dark forest-green work coat with brass shoulder
details, ivory scarf, slim dark boots and compact copper mechanical backpack.
Carries an open brass-and-jade folding battle fan. Strong emerald-green and
warm brass identity, tiny amber eye highlights. Idle fan closed at hip, walk
coat swings, attack sweeps fan producing a small pale mint gust close to hand,
hurt recoils, death kneels and slumps. Distinct from existing auburn-haired
clockwork artificer: mint hair, fan silhouette and green angular coat.

## cantor-raw.png

Subject: original playable male copper bell keeper / cantor. Deep blue swept
short hair, midnight-blue long ceremonial coat with small ivory panels and
copper piping, polished copper shoulder plate, warm brown belt and dark boots.
Carries a large ornate copper hand bell with a bright turquoise crystal
clapper. Readable blue-and-copper silhouette, calm determined face. Idle bell
hangs at hip, walk bell sways, attack swings bell beside body with small cyan
sound rings, hurt leans back, death sinks to knees and folds. Maintain full
body in ALL thirty slots.

## astronomer-raw.png

Subject: original playable female astronomer with pale silver bob haircut,
violet layered pointed hood worn back, dark plum long coat scattered with
exactly a few tiny warm-gold star pins, soft ivory collar, copper belt, dark
boots. Carries a compact brass armillary sphere with a small glowing violet
meteor rock at its center. Distinct purple-and-copper silhouette, bright
lavender eyes, dark face contour. Idle orb close at chest, walk coat trails,
attack lifts armillary sphere next to hand with small flaming purple comet,
hurt recoils, death kneels then slumps. Full humanoid body visible in EVERY
frame, no detached orb-only cells.

## heliarch-raw.png

Subject: original playable golden sun knight / heliarch. Short warm ivory hair
visible above a dark slate face guard, angular sun-gold armor with ivory
highlights, dark charcoal undersuit, compact crimson sash and copper boots.
Holds a golden sun lance diagonally beside body, sunburst emblem behind its
spearpoint. Compact broad-shouldered silhouette and bright amber eyes, golden
armor readable against dark backgrounds. Idle lance held at side, walk grounded
marching, attack forward lance thrusts without crossing neighboring slots,
hurt shield shoulder leans back, death kneels then slumps. Spear remains close
enough to fit every cell, full humanoid body in every frame.

## items-raw.png

Use case: stylized-concept. Asset type: original Lumen RPG inventory icon atlas.
Transparent RGBA background. EXACT 4 columns by 4 rows, sixteen independent
pixel-art item icons evenly spaced in identical square slots, generous gutters,
no text, no labels, no UI frames, no grid, no background, no ground shadows.
Handcrafted 1990s dark-fantasy 48x48-pixel icon aesthetic, crisp chunky pixel
clusters, dark contour, luminous restrained jewel colors, upper-left highlights.
Readable object silhouettes at small scale, no scenery. Rows left-to-right in
exact order: row1 silver needle dagger pointing right, emerald-and-brass open
folding battle fan, copper bell with turquoise crystal clapper, brass mechanical
landmine with red fuse. Row2 cyan snowflake frost nova crystal, small
ivory-and-copper twin-wing drone, orange flaming meteor rock, purple gravity
orb within copper gyroscope rings. Row3 golden sun lance spear pointing upper
right, black crescent eclipse with golden rim, green laurel wreath with golden
central teardrop gem, ruby anatomical crystal heart within silver clasp.
Row4 slate armored beetle carapace plate with copper studs, glowing amber coal
ember in a black iron cage, teal-and-gold compass rose in brass housing,
violet sand hourglass with brass frame. All sixteen full separate original
objects. Fan/bell should match an original jade engineer/copper bellkeeper
arsenal. Transparent space between every slot, no connected decorations.

The final icon sheet received this whole-sheet transparent-background edit
with its generated source as the only reference:

Remove ONLY the opaque colored glowing background from this exact sixteen-item
pixel art sprite atlas. Deliver real transparent RGBA background. Preserve ALL
sixteen item sprites exactly: positions, 4 columns by4 rows, sizes, shapes,
pixels, sharp contours, jewel colors and bright object glows within the objects.
Outside each item's solid silhouette must be fully transparent, including the
colored fog around objects. No added checkerboard, text, borders, grid or solid
background. Do not change any item and do not move any slot.

## Inspection and normalization

RawRGBA contains low-alpha RGB outside the solid silhouettes; alpha histogram
was inspected before normalization. Existing threshold192 removes the fringe
without a second background extraction program. All120normalized actor frames
were personally reviewed in `animation-preview.png`; four idle heroes in
`roster-preview.png`; all16distinct icons in `icons-preview.png`. No actor-only
or missing-body attack frames remained. This source review is separate from
integrated browser QA performed by the coordinating task.
