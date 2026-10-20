# Original generated assets · 20 October 2026

Tool: built-in `image_gen.imagegen`, `transparent_background=true`. No external
character/weapon pack. Final raw sheets in `sources/`, runtime files in
`webapp/frontend/assets/lumen/`. Offline normalization: `build_assets.py`.
Every actor uses one scale and one32-color palette across all30frames. The
10-icon atlas uses64colors. The full pixel builder includes this expansion.

## Shared actor prompt

Use case: stylized-concept. Production pixel-art sprite sheet for an original
2D action RPG Lumen. Transparent RGBA background. Exact6columns by5rows, all30
slots evenly spaced, no labels or grid lines. Each row shows SAME actor in6
distinct consecutive poses. Rows: idle/breath, walking cycle, attacking,
recoiling hurt, collapsing death.3/4top-down camera, actor facing down-right
consistently. Large-headed compact proportions, dark one-pixel contour, chunky
crisp pixel clusters, tasteful highlights from upper left,32color palette,
no blur, no scenery, no text, no ground shadow. Each slot centers the body on
same baseline, full body visible with generous transparent gutter; no
amputated or missing body frames. Whole sheet at once, stable outfit and
proportions across every slot. Suitable to normalize to48x48pixel frames.

Subject suffixes:

- `quartzling`: A small six-legged crystalline crab with an ivory pink quartz
  shell and rose lit cracks, two dark claw tips, small bright cyan eyes.
  Distinct angular silhouette; walk legs alternate, attack thrusts its pointed
  quartz head, hurt body tilts, death shell shatters but body remains readable.
  Mineral pink/cream/slate colors.
- `shardback`: A squat heavy slate-and-amethyst turtle golem with large jagged
  purple quartz crystals growing on its back, four stone legs, a small armored
  face and pale lavender eyes. Walk deliberate stomping, attack raises crystal
  plates and slams down, hurt recoils, death crumbles. Purple/violet and pale
  stone palette.
- `moonmoth`: An ethereal lunar moth enemy with two large crescent-shaped
  ivory-blue wings with dark blue veining, a small dark indigo body, two
  turquoise antennae, luminous cyan eyes. Idle and walking rows show different
  wing beats, attack wings spread releasing a shard, hurt wings fold, death
  wings fall. Entire moth body remains in all frames.
- `artificer`: A playable female clockwork artificer with short auburn hair,
  dark round goggles on forehead, ivory and teal coat, copper mechanical
  backpack, dark boots. Holds an ornate copper chakram with turquoise center.
  Full humanoid body, appealing detailed face at pixel scale. Walk swings coat
  and legs, attack throws chakram, hurt recoils, death kneels and slumps.
- `sentinel`: A playable armored male lunar sentinel with short silver hair,
  angular dark teal armor with ivory shoulder plates, rose copper trims, one
  small turquoise gem on chest. Holds a compact crystal spear with long pale
  cyan point. Walk with spear, attack thrust, hurt recoils, death falls to one
  knee. Full humanoid body, original design.

## Whole-sheet corrections

`artificer` was edited as a whole sheet: Edit only the attack row (third of
five rows) of this exact6x5transparent sprite sheet. Preserve all other rows,
same female copper-and-teal clockwork artificer, colors, proportions and
transparent canvas. In EVERY one of the six attack frames show her complete
body, auburn hair, face, coat, arms and legs; even when chakram flies away,
the whole woman stays visible. Frame5currently has only a flying disc:
replace it with a full-body woman in follow-through throwing pose, the small
disc close beside her hand. Keep all six slots separate, no overlapping
neighbors. Five rows by six columns exactly, aligned baseline, pixel-art
transparent RGBA, no scenery, no labels.

`shardback`: Remove the purple opaque background from this sprite sheet.
Preserve all30violet crystal turtle golem sprites exactly, the6columns x5rows
layout, distinct animation poses, lighting and all body pixels. Actual fully
transparent RGBA outside every sprite. No colored backdrop, no gradient,
no shadow. Keep original dimensions and no labels. Final source carries
transparent alpha; normalization ignores RGB under transparent pixels.

## Icon atlas prompt

Production pixel art item icon atlas for original fantasy action RPG Lumen,
transparent RGBA. EXACT five columns and two rows, ten equally sized square
slots, each icon isolated and centered with generous empty transparent margin.
Dark one pixel outline, chunky pixel clusters, rich material highlights upper
left, exquisite readable32x32silhouette, no blur, no labels or text, no grid,
no scenery or decorative background plaques. Row1left to right:1copper
mechanical chakram circular disc with turquoise core;2long diagonal icy pale
blue crystal spear;3prismatic crystalline crossbow with cyan-gold glowing
beam;4crescent lunar blades in a circular vortex with yellow lightning;
5blooming orange fire flower with curling green thorns. Row2left to right:
6ivory golden double-edged returning axe with sun rays;7brass crystal
collection ring attracting three small turquoise crystals;8intricate copper
chronomancer gear containing a tiny ivory clock face;9violet moon resonator
tuning fork with lavender glowing gem;10small pink and ivory enamel shield
talisman with sun symbol. Objects look like collectible magical equipment
with real form and detailed edges, crisp square pixels, consistent scale
and perspective.
