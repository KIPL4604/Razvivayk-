# Люмен · расширение коридора / промпты v2

28.10.2026. Встроенный `image_gen`, редактирование локальных PNG v1.
Запрос: «Сделай коридор шире в два с половиной раза».
Ширина18→45м, длина50м. Основные формы существ и материалы сохранены.

## world-boss-creatures-v2.png

Вход: `world-boss-creatures-v1.png`.

```text
Edit the attached ORIGINAL Lumen game approval board. This is an EDIT, not a redesign. The user's ONLY change is: make the CASTLE CORRIDOR TWO AND A HALF TIMES WIDER.

EDIT TARGET: supplied world-boss-creatures-v1.png.
Critical geometry: old corridor width 18 m -> NEW corridor width 45 m. Corridor length remains 50 m. Central carpet width 6 m -> 15 m, with normal-size repeating embroidery, NOT stretched motifs. Increase the real distance between left and right wall rows by a factor of 2.5. Preserve original world/pixel scale of the hero, ordinary creatures, piano, candle columns, plants, bookcases, wood panels and all floor-pattern units. Add much more visible EMPTY PLAYABLE FLOOR between furnishing rows and between actors; show long wide parquet lanes on both sides of the widened red carpet. Do not multiply the population or fill the added space with decorations. The widened corridor should feel like a broad royal gallery with room for large battles.

CANVAS/COMPOSITION: expand canvas horizontally to accommodate the 2.5x wider left corridor scene at the SAME camera scale. Aim for an ultrawide landscape board, approximately 2500x1100 or 3200x1400, not the old cramped 4:3 canvas. The top left CORRIDOR panel should now occupy about 70% of the upper board width, while the original FINAL BOSS panel remains about 30%. Keep the corridor height the same relative to the hero and furnishings. Both walls must be visible simultaneously and the empty width must be obvious. Widen by constructing more tiled floor, not by horizontally stretching the bitmap, zooming out both dimensions, shrinking characters, or merely changing the text. Top/bottom openings stay continuous, axis remains vertical, no vanishing point, no isometric floor.

PRESERVE: all existing materials, original crisp dark pixel art, walnut panel walls, warm candlelight, gold carving, burgundy carpet, mint hero, candles on columns, grand piano with ivory keys and bench, flower beds, tall bookshelves. Keep unique objects in side alcoves along outer walls. Preserve the right final-boss hall composition, the enormous hollow crowned golden armored boss with crimson mantle, original boss size relative to hero, the rings/spiral of red and amber orb projectiles, and the bottom creature roster identities and Russian names. Right hall and roster can be repositioned in the larger canvas but do not redesign or enlarge their actors. Extend the bottom charcoal strip across the whole wider canvas with more spacing between the existing creature portraits. Do not introduce any new characters or new attacks.

TEXT: retain the original Russian section labels exactly: "ЛЮМЕН · МИР III", "КОРИДОР", "ФИНАЛЬНЫЙ ЗАЛ", "ОБИТАТЕЛИ ЗАМКА", the five creature names. Keep the floating amber north-pointing direction arrow and its "45" number. Add a modest dimension bracket below or at the edge of the corridor scene labeled exactly "45 м · ШИРИНА ×2,5". The level number 45 by the arrow and the 45 m dimension are separate concepts and should not overlap. Minimal text, no new stats.

Result must unmistakably show a 2.5-times-wider corridor while retaining the established art direction and creature/boss designs.
```

## corridor-materials-v2.png · первичная правка

Вход: `corridor-materials-v1.png`. Промежуточный результат не включён в набор v2.

```text
Edit the supplied Lumen castle CORRIDOR MATERIALS/STRUCTURE board, keeping the established pixel art and every material/prop design. The user's ONLY requested change is widening the corridor by EXACTLY 2.5 times. EDIT TARGET is corridor-materials-v1.png.

MANDATORY GEOMETRY: previous full corridor module 50 m long x 18 m wide becomes 50 m long x 45 m wide. Keep the 50 m longitudinal length, the original five 10 m wall bays and original furniture/column/hero scale. Increase the lateral spacing between the parallel side walls by 2.5x. The COMPLETE left floor plan must now have almost-square proportions: drawn outer width / drawn longitudinal height = 45/50 = 0.90. E.g. if full plan height is 1000 pixels, its outer width must be 900 pixels. This visibly wider plan is the key requirement. Do NOT leave the original narrow strip and simply change its number, do NOT stretch piano or tiles horizontally, do NOT increase the corridor length to fake proportions. Construct additional repeat floor and move the unchanged wall rows outward. All floor motif units, wood panels, props, hero, plants, columns remain the same scale. Central burgundy carpet widens from 6m to15m (one third of the total width), surrounded by very generous empty parquet lanes on both sides. Decor stays along outer walls/in side alcoves, never added to the centre.

ADAPT CANVAS: expand image horizontally to an ultrawide board as needed (about 2600x1500). Give the big new 45x50 m COMPLETE corridor plan the LEFT 50% or more, and keep six texture samples and six prop sprites on the RIGHT at their original designs. The original narrow inset showing two repeated segments should also become noticeably wider, matching the new module proportions, and can be small beneath/alongside the plan as space permits. Clearly show two matching modules joining top-to-bottom. Maintain same neutral cut cross sections at top and bottom of the main plan so the continuous carpet/parquet lines line up in the concept. Paired join triangles outside both ends. Keep the long-axis height bracket "50 м" to the left of the plan and change the bottom width bracket from "18 м" to exactly "45 м". Header text exactly "ЛЮМЕН · ЗАМКОВЫЙ КОРИДОР". Subheader exactly "КОНЦЕПТ · МОДУЛЬ 50 × 45 М". Optional small note exactly "ШИРИНА ×2,5". The unchanged text labels are "ПОВТОР", "ПАРКЕТ", "КОВЁР", "КРАЙ КОВРА", "ДЕРЕВО", "ПОЗОЛОТА", "КАМЕНЬ", "ОБЪЕКТЫ". No English.

PRESERVE ART DIRECTION: original crisp rich dark pixel art, dark walnut panels with antique gold trim, warm brown parquet, burgundy/red and gold carpet, candle columns, candle pedestal, recognizable grand piano with ivory keyboard and bench, tall bookshelves, planted flower beds, mint lantern hero. Six right-hand texture swatches and six object portraits keep exactly those material and object identities. No new monsters, no boss on this board, no modern elements. Same warm candle lighting, orthographic overhead game plan with only modest sprite height, no vanishing point, no diagonal isometric grid. The corridor must read as 2.5 times wider and much more spacious with empty usable floor, while length stays50m.
```

## corridor-materials-v2.png · уточнение схемы повтора

Вход: промежуточный `exec-0fe046d7-c5e1-45e8-ad0d-8e38a3f4f50e.png`.
Итог: `exec-7d6a5f15-b5ed-4cd9-a50e-4db2c6d0c85a.png`.

```text
Make ONE precise correction to this Lumen castle corridor planning board. Edit target is the supplied image. Preserve the large 45 m wide by 50 m long main corridor, all its art, the header, dimensions, material samples and object sprites EXACTLY as they are. Do not change their scale or composition. The main wide corridor is correct and must stay wide.

ONLY FIX THE SMALL REPEAT INSET: the tiny vertical strip located between the main plan and the right materials panel (around x=0.53 to 0.60 of total canvas width) is still drawn as two very narrow old-style corridor modules. Replace this tiny narrow illustration with TWO SMALL ALMOST-SQUARE thumbnail copies of the NEW WIDE main corridor, joined directly top-to-bottom at a horizontal seam. Each miniature segment's width/height must be 45/50 = 0.90, e.g. 94 pixels wide by104 pixels tall at the current image size. Entire inset two-module stack is then about208 pixels tall, NOT the current nearly full-height narrow strip. Centre that short two-module stack vertically within its existing narrow empty column, leaving dark background above/below it. Use simplified visible miniatures of the wide floor: broad parquet lanes, red carpet roughly1/3 width, tiny walls on each side. Their proportions must look almost-square, not narrow. Keep a small seam indicator and the existing "ПОВТОР" label beside this stack. Remove the old tall narrow bracket and replace it with one fitting the short stack. Keep gold joining triangles above and below the new short stack.

Do not alter anything outside that small inset column. Same canvas size, same pixel art, same wording, all measurements remain50м length and45м width, no added content. This is a targeted inset geometry correction only.
```
