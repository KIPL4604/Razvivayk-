# Люмен · более детальные квадратные буквы / 20.10.2026

Запрос: «Оставь такие же квадратные буквы и числа но сделай разрешение пикселей
больше, а то похоже будто просто квадратики». Область изменения — буквы и цифры
игрового HUD, улучшений, паузы и результата. Игровые PNG и механика сохранены.

Направление до реализации: прежняя палитра/композиция/размеры панелей,
угловатые буквы и прямоугольные цифры, но более подробный контур. Рассмотрены
8pxbitmap и квадратный outline: bitmap опять ограничивает мелкие детали;
выбран локальный Tektur, без грубой5pxсетки Tiny5. Толщина600/ширина90 поддерживают
плотный игровой характер и кириллицу. Это новые очертания той же квадратной
стилистики, а не искусственное увеличение старых пикселей или размеров всего UI.

Источник оригинального variable TTF и лицензии:
[Google Fonts Tektur](https://github.com/google/fonts/tree/main/ofl/tektur).
[METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/tektur/METADATA.pb)
подтверждает автора Adam Jagosz, кириллицу и OFL. Copyright2023 The Tektur Project
Authors, https://www.github.com/hyvyys/Tektur. Original source163160bytes сохранён
в sources/Tektur.ttf, source/license в sources/OFL-Tektur.txt. Runtime static
Latin/Cyrillic subset около19KB, fonts/Tektur-game.ttf и OFL-Tektur.txt. Исходник
Tiny5 и прежняя лицензия сохранены для истории. CSS family LumenSquare, без
искусственного bold; числа tabular/lining. Browser рисует очертания в родном DPR,
мир остаётся PNG nearest-neighbor. Runtime без новых библиотек и CDN шрифтов.

## Реальная проверка

Edge/Playwright MCP, isolated8081. До изменения лично просмотрено сравнение
before-375 и draft-375/1440 в output/lumen-font: цифры/маленькие подписи стали
детальнее, заголовки сохраняют квадратные углы. Размеры менять не потребовалось.
После подключения CSS/сборщика лично просмотрены375 бой, улучшения, пауза,
landscape812×375; затем768улучшения,1440бой и1920улучшения. Два визуальных
прохода. Финальные evidence — ignored output/playwright/lumen-pixel-*-final.png
и lumen-motion-{combat,upgrade}-{375,768,1440,1920}.png. Это QA scenes, не рекорды.

Pixel-ui прошёл: реальная загрузка LumenSquare (FontFace.status=loaded и computed
family), четыре ширины,44px controls, отсутствие overflow, пауза/focus,
применение усиления, reduced motion, DPR2, recovery PNG и0asset/pageerrors.
Motion-ui: три акцента выбора, размеры диалога прежние41.9%на375/20–24%desktop,
focus, DPR3, отсутствие pageerrors. Состояния20clips×6кадров остаются рабочими,
renderer не пишет в save. Offline art3/3, hashes и лицензия активного шрифта.
Физический телефон и его экран/сглаживание отдельно не проверены. Build/lint
команд у vanilla модуля нет. Игровая симуляция не менялась.
