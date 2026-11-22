import { theory, quiz, exercise } from "./course-authoring.mjs";

const sample = (initial, expected, output, types) => ({ initial, expected, output, types });

const integer = name => ({ [name]: "int" });
const decimal = name => ({ [name]: "float" });
const boolean = name => ({ [name]: "bool" });

const cargoInputs = [
  { raw_count: "4", raw_unit_weight: "2.5", count: 4, unit_weight: 2.5, total_weight: 10.0, report: "Вес груза: 10.0 кг" },
  { raw_count: "3", raw_unit_weight: "0.5", count: 3, unit_weight: 0.5, total_weight: 1.5, report: "Вес груза: 1.5 кг" },
  { raw_count: "0", raw_unit_weight: "8.0", count: 0, unit_weight: 8.0, total_weight: 0.0, report: "Вес груза: 0.0 кг" },
];
const cargoVariables = ["count", "unit_weight", "total_weight", "report"];
const cargoTypes = { count: "int", unit_weight: "float", total_weight: "float", report: "str" };
const cargoCases = step => cargoInputs.map(data => {
  const names = cargoVariables.slice(0, step);
  return sample(
    { raw_count: data.raw_count, raw_unit_weight: data.raw_unit_weight },
    Object.fromEntries(names.map(name => [name, data[name]])),
    step === 4 ? [data.report] : [],
    Object.fromEntries(names.map(name => [name, cargoTypes[name]])),
  );
});
const cargoLines = [
  "count = int(raw_count)",
  "unit_weight = float(raw_unit_weight)",
  "total_weight = unit_weight * count",
  'report = "Вес груза: " + str(total_weight) + " кг"\nprint(report)',
];
const cargoCode = step => cargoLines.slice(0, step).join("\n");

const types = {
  id: "types",
  title: "Типы и преобразования",
  stages: [
    { title: "Число и его запись", slides: [
      theory('Тип определяет, что можно сделать со значением. 12 — целое число (int), 12.5 — дробное число (float), а "12" — строка (str).', 'print(12 + 3)\nprint("12" + "3")'),
      quiz("Какой результат будет во второй строке вывода?", 'print(12 + 3)\nprint("12" + "3")', "123", ["15", "Ошибка"], "Две строки соединяются: после текста 12 добавляется текст 3."),
      exercise({
        text: "Сканер передал код партии raw_tag и число коробок boxes. Сохрани код без изменения в batch, а число — в count. Напечатай count.",
        cases: [
          sample({ raw_tag: "07", boxes: 7 }, { batch: "07", count: 7 }, ["7"], { batch: "str", count: "int" }),
          sample({ raw_tag: "008", boxes: 12 }, { batch: "008", count: 12 }, ["12"], { batch: "str", count: "int" }),
        ],
        hint: "Код партии хранится как текст: в нём важны начальные нули. Используй имена raw_tag и boxes справа от знака =.",
        solution: "batch = raw_tag\ncount = boxes\nprint(count)",
      }),
    ] },
    { title: "Текст от датчика", slides: [
      theory('int() умеет читать целое число из строки. Например, int("09") даёт число 9. Дальше с ним можно считать.', 'reading = "09"\namount = int(reading)\nprint(amount + 1)'),
      quiz("Что появится в консоли?", 'count = int("7")\nprint(count + 2)', "9", ["72", "Ошибка"], "int() превращает текст 7 в число, поэтому + здесь складывает."),
      exercise({
        text: "Датчик передал количество в строке raw_count. Преобразуй его в целое число count и выведи это число.",
        starter: "count = \nprint(count)",
        cases: [
          sample({ raw_count: "08" }, { count: 8 }, ["8"], integer("count")),
          sample({ raw_count: "23" }, { count: 23 }, ["23"], integer("count")),
        ],
        hint: "После знака = вызови int(), передав внутрь имя raw_count без кавычек.",
        solution: "count = int(raw_count)\nprint(count)",
      }),
    ] },
    { title: "Сверка запаса", slides: [
      quiz("Как подготовить показание к сложению?", 'raw_count = "9"\nreserve = 2', "int(raw_count)", ["raw_count", '"raw_count"'], "Сначала превращаем текстовое показание в число. Тогда к нему можно прибавить запас."),
      exercise({
        text: "На складе посчитали raw_count деталей. Возьми число из этого текста, прибавь две запасные детали, запиши итог в ready и выведи его.",
        cases: [
          sample({ raw_count: "12" }, { ready: 14 }, ["14"], integer("ready")),
          sample({ raw_count: "27" }, { ready: 29 }, ["29"], integer("ready")),
          sample({ raw_count: "0" }, { ready: 2 }, ["2"], integer("ready")),
        ],
        hint: "Вычисли int(raw_count) + 2 и сохрани это число в ready. Следующей строкой выведи ready.",
        solution: "ready = int(raw_count) + 2\nprint(ready)",
        display: "ready",
      }),
    ] },
    { title: "Подпись для табло", slides: [
      theory('str() превращает число в строку. Со строкой можно соединить подпись, например "Ряд " + str(row).', 'row = 6\nmessage = "Ряд " + str(row)\nprint(message)'),
      quiz("Какая запись выводит «Пост 4»?", "number = 4", 'print("Пост " + str(number))', ['print("Пост " + number)', 'print("Пост " + "number")'], "str(number) даёт строку 4, а кавычки вокруг имени дали бы слово number."),
      exercise({
        text: "Сделай надпись «Ящиков: N», где N — значение count. Запиши надпись в label и выведи её.",
        cases: [
          sample({ count: 4 }, { label: "Ящиков: 4" }, ["Ящиков: 4"]),
          sample({ count: 0 }, { label: "Ящиков: 0" }, ["Ящиков: 0"]),
        ],
        hint: 'К строке "Ящиков: " присоедини str(count). После двоеточия нужен пробел.',
        solution: 'label = "Ящиков: " + str(count)\nprint(label)',
      }),
    ] },
    { title: "Дробное показание", slides: [
      theory('float() читает дробное число из текста. В записи числа и в строке для преобразования используется точка: float("1.5") получает 1.5.', 'reading = "1.5"\nweight = float(reading)\nprint(weight)'),
      quiz("Как сохранить дробное значение из строки?", 'raw_weight = "2.5"', "float(raw_weight)", ["int(raw_weight)", "str(raw_weight)"], "float() понимает текст с десятичной точкой и даёт число, с которым можно считать."),
      exercise({
        text: "Вес коробки пришёл в строке raw_weight. Сохрани дробное число в weight и выведи его.",
        cases: [
          sample({ raw_weight: "2.5" }, { weight: 2.5 }, ["2.5"], decimal("weight")),
          sample({ raw_weight: "0.5" }, { weight: 0.5 }, ["0.5"], decimal("weight")),
          sample({ raw_weight: "8" }, { weight: 8 }, ["8.0"], decimal("weight")),
        ],
        hint: "Воспользуйся float(raw_weight). Даже строка без точки может стать значением типа float.",
        solution: "weight = float(raw_weight)\nprint(weight)",
      }),
    ] },
    { title: "Целая часть", slides: [
      theory("Если значение уже дробное, int() отбрасывает дробную часть. Это работает в сторону нуля: int(4.8) даёт 4, а int(-4.8) — -4.", "print(int(4.8))\nprint(int(-4.8))"),
      quiz("Что получится при преобразовании?", "print(int(-2.75))", "-2", ["-3", "2"], "Дробная часть отбрасывается, знак остаётся. Это не округление до ближайшего целого."),
      exercise({
        text: "Датчик передаёт дробное число offset. Запиши его целую часть в whole и выведи whole.",
        cases: [
          sample({ offset: 5.75 }, { whole: 5 }, ["5"], integer("whole")),
          sample({ offset: -3.25 }, { whole: -3 }, ["-3"], integer("whole")),
          sample({ offset: 0.5 }, { whole: 0 }, ["0"], integer("whole")),
        ],
        hint: "offset уже число. Передай его в int(), а результат запиши под именем whole.",
        solution: "whole = int(offset)\nprint(whole)",
      }),
    ] },
    { title: "Починка записи", slides: [
      quiz("В какой части программы смешались несовместимые типы?", 'raw_count = "12"\nreserve = 2\nready = raw_count + reserve\nprint(ready)', "raw_count + reserve", ["raw_count = \"12\"", "reserve = 2"], "Проблема при сложении: raw_count — строка, reserve — число."),
      exercise({
        text: "Код сломался. Исправь строку вычисления, чтобы ready содержал числовую сумму из текстового raw_count и числового reserve. Выведи ready.",
        starter: "ready = raw_count + reserve\nprint(ready)",
        cases: [
          sample({ raw_count: "15", reserve: 3 }, { ready: 18 }, ["18"], integer("ready")),
          sample({ raw_count: "3", reserve: 7 }, { ready: 10 }, ["10"], integer("ready")),
          sample({ raw_count: "00", reserve: 0 }, { ready: 0 }, ["0"], integer("ready")),
        ],
        hint: "Отправь raw_count в int(), прежде чем сложить с reserve.",
        solution: "ready = int(raw_count) + reserve\nprint(ready)",
      }),
    ] },
    { title: "Грузовой отсек", group: "project", slides: [
      theory("Соберём один отчёт в четыре шага. Сначала подготовим количество и вес, затем посчитаем общий вес и подпишем результат."),
      exercise({
        text: "Шаг 1. Сохрани количество коробок из raw_count в целой переменной count. Печатать будем в конце.",
        cases: cargoCases(1),
        hint: "Количество приходит в виде строки. Чтобы получить целое число, используй int(raw_count).",
        solution: cargoCode(1),
        display: "count",
      }),
      exercise({
        text: "Шаг 2. Оставь строку с count. Преобразуй текст raw_unit_weight и сохрани вес одной коробки в дробной переменной unit_weight.",
        starter: cargoCode(1),
        continueCode: true,
        cases: cargoCases(2),
        hint: "Передай raw_unit_weight в float() и запиши результат под именем unit_weight.",
        solution: cargoCode(2),
        display: "unit_weight",
      }),
      exercise({
        text: "Шаг 3. Добавь total_weight. Для этого умножь вес одной коробки на количество коробок.",
        starter: cargoCode(2),
        continueCode: true,
        cases: cargoCases(3),
        hint: "У тебя уже есть числа unit_weight и count.",
        solution: cargoCode(3),
        display: "total_weight",
      }),
      exercise({
        text: "Шаг 4. Сохрани подпись «Вес груза: N кг» в report и выведи её одной строкой. Вместо N используй total_weight без округления.",
        starter: cargoCode(3),
        continueCode: true,
        cases: cargoCases(4),
        hint: 'Соедини "Вес груза: ", str(total_weight) и " кг". Затем выведи report.',
        solution: cargoCode(4),
      }),
    ] },
  ],
};

const packingInputs = [
  { stock: 23, capacity: 5, full: 4, leftover: 3 },
  { stock: 10, capacity: 5, full: 2, leftover: 0 },
  { stock: 3, capacity: 4, full: 0, leftover: 3 },
];
const packingCases = step => packingInputs.map(({ stock, capacity, full, leftover }) => sample(
  { stock, capacity },
  step > 1 ? { full, leftover } : { full },
  step === 3 ? ["Контейнеров: " + full, "Остаток: " + leftover] : [],
));

const arithmetic = {
  id: "arithmetic",
  title: "Арифметические операторы",
  stages: [
    { title: "Что считать первым", slides: [
      theory("Умножение выполняется раньше сложения. Скобки меняют порядок: (2 + 3) * 4 даёт 20.", "print(2 + 3 * 4)\nprint((2 + 3) * 4)"),
      quiz("Где знак + выполнится первым?", "", "(2 + 3) * 4", ["2 + 3 * 4", "2 + (3 * 4)"], "Действие внутри скобок выполняется до умножения снаружи."),
      exercise({
        text: "В каждом из count комплектов лежат pieces деталей и spare запасных. Исправь расчёт: сначала узнай размер одного комплекта, потом умножь на count и выведи total.",
        starter: "total = pieces + spare * count\nprint(total)",
        cases: [
          sample({ pieces: 5, spare: 2, count: 4 }, { total: 28 }, ["28"]),
          sample({ pieces: 3, spare: 1, count: 2 }, { total: 8 }, ["8"]),
        ],
        hint: "Сумму внутри комплекта оберни скобками, прежде чем умножать на count.",
        solution: "total = (pieces + spare) * count\nprint(total)",
      }),
    ] },
    { title: "Обычное деление", slides: [
      theory("Оператор / делит и возвращает дробное число типа float. Когда деление точное, результат всё равно имеет этот тип: 8 / 4 даёт 2.0.", "print(9 / 4)\nprint(8 / 4)"),
      quiz("Какой вывод даст этот код?", "print(3 / 2)", "1.5", ["1", "2"], "Обычное деление сохраняет дробную часть."),
      exercise({
        text: "Раздели общий вес mass между одинаково нагруженными платформами. Их число — platforms. Запиши вес одной платформы в average и выведи его.",
        cases: [
          sample({ mass: 9, platforms: 4 }, { average: 2.25 }, ["2.25"], decimal("average")),
          sample({ mass: 8, platforms: 4 }, { average: 2 }, ["2.0"], decimal("average")),
        ],
        hint: "Возьми mass / platforms, чтобы получить дробный результат.",
        solution: "average = mass / platforms\nprint(average)",
      }),
    ] },
    { title: "Полные отсеки и остаток", slides: [
      theory("Для целых положительных чисел // даёт количество полных групп, а % — сколько предметов осталось.", "print(17 // 5)\nprint(17 % 5)"),
      quiz("Что вернёт 20 % 4?", "", "0", ["5", "4"], "Число 20 делится на 4 без остатка."),
      exercise({
        text: "Из партии нужно выложить полные ряды по width деталей. Всего деталей items. Исправь расчёт остатка, сохрани его в loose и выведи.",
        starter: "loose = items // width\nprint(loose)",
        cases: [
          sample({ items: 19, width: 4 }, { loose: 3 }, ["3"]),
          sample({ items: 12, width: 4 }, { loose: 0 }, ["0"]),
          sample({ items: 2, width: 4 }, { loose: 2 }, ["2"]),
        ],
        hint: "Вместо количества полных рядов здесь нужны детали, которые в полные ряды не попали.",
        solution: "loose = items % width\nprint(loose)",
      }),
    ] },
    { title: "Квадрат на сетке", slides: [
      theory("Оператор ** возводит число в степень. Запись side ** 2 равна side * side. Степень выполняется перед обычным умножением.", "side = 5\nprint(side ** 2)"),
      quiz("Как получить квадрат суммы 2 и 3?", "", "(2 + 3) ** 2", ["2 + 3 ** 2", "(2 + 3) * 2"], "Скобки заставляют сначала получить 5, а показатель 2 — возвести 5 в квадрат."),
      exercise({
        text: "Две квадратные площадки состоят из клеток. Их стороны left и right. Сохрани суммарное число клеток в cells и выведи его.",
        cases: [
          sample({ left: 3, right: 4 }, { cells: 25 }, ["25"]),
          sample({ left: 2, right: 5 }, { cells: 29 }, ["29"]),
        ],
        hint: "Найди квадрат каждой стороны, потом сложи две площади.",
        solution: "cells = left ** 2 + right ** 2\nprint(cells)",
      }),
    ] },
    { title: "Точность на табло", slides: [
      theory("round(число, знаки) позволяет укоротить дробную запись. На табло иногда достаточно одного или двух знаков после точки.", "print(round(1.333333, 2))"),
      quiz("Как округлить ratio до двух знаков после точки?", "", "round(ratio, 2)", ["round(2, ratio)", "int(ratio)"], "Аргументы идут в порядке: сначала число, затем количество знаков."),
      exercise({
        text: "Из датчиков получены volume и seconds. Сохрани в reading частное volume / seconds, округлённое до двух знаков после точки, и выведи его.",
        cases: [
          sample({ volume: 4, seconds: 3 }, { reading: 1.33 }, ["1.33"]),
          sample({ volume: 11, seconds: 7 }, { reading: 1.57 }, ["1.57"]),
        ],
        hint: "Сначала раздели, потом передай результат и число 2 в round().",
        solution: "reading = round(volume / seconds, 2)\nprint(reading)",
      }),
    ] },
    { title: "Упаковка партии", group: "project", slides: [
      theory("Упаковщик должен сообщить число полных контейнеров и остаток деталей. Вместимость контейнера и размер партии меняются."),
      exercise({
        text: "Шаг 1. Рассчитай число полных контейнеров full. Всего stock деталей, в одном контейнере помещается capacity. Вывод добавим позже.",
        cases: packingCases(1),
        hint: "Целочисленное деление stock // capacity даёт полные контейнеры.",
        solution: "full = stock // capacity",
        display: "full",
      }),
      exercise({
        text: "Шаг 2. Сохрани предыдущий расчёт и добавь число оставшихся деталей leftover.",
        starter: "full = stock // capacity",
        continueCode: true,
        cases: packingCases(2),
        hint: "Чему равен остаток от деления stock на capacity?",
        solution: "full = stock // capacity\nleftover = stock % capacity",
        display: "leftover",
      }),
      exercise({
        text: "Шаг 3. Выведи две строки: «Контейнеров: N» и «Остаток: M». Подставь свои full и leftover.",
        starter: "full = stock // capacity\nleftover = stock % capacity",
        continueCode: true,
        cases: packingCases(3),
        hint: 'Соедини подпись "Контейнеров: " со str(full). Так же подготовь вторую строку.',
        solution: 'full = stock // capacity\nleftover = stock % capacity\nprint("Контейнеров: " + str(full))\nprint("Остаток: " + str(leftover))',
      }),
    ] },
  ],
};

const logicInputs = [
  { charge: 8, minimum: 8, has_pass: true, alarm: false, charged: true, rules_ok: true, allowed: true },
  { charge: 7, minimum: 8, has_pass: true, alarm: false, charged: false, rules_ok: true, allowed: false },
  { charge: 12, minimum: 9, has_pass: false, alarm: false, charged: true, rules_ok: false, allowed: false },
  { charge: 12, minimum: 9, has_pass: true, alarm: true, charged: true, rules_ok: false, allowed: false },
];
const logicCases = step => logicInputs.map(({ charge, minimum, has_pass, alarm, charged, rules_ok, allowed }) => sample(
  { charge, minimum, has_pass, alarm },
  step === 1 ? { charged } : step === 2 ? { charged, rules_ok } : { charged, rules_ok, allowed },
  step === 3 ? [allowed ? "True" : "False"] : [],
  step === 1 ? boolean("charged") : step === 2 ? { charged: "bool", rules_ok: "bool" } : { charged: "bool", rules_ok: "bool", allowed: "bool" },
));

const logic = {
  id: "logic",
  title: "Сравнения и логика",
  stages: [
    { title: "Совпадает ли значение", slides: [
      theory("Знак = сохраняет значение, а == сравнивает два значения. Результат сравнения — True или False. Оператор != проверяет, что значения различаются.", "stored = 5\nprint(stored == 5)\nprint(stored != 5)"),
      quiz("Что выведется?", 'print(5 == "5")', "False", ["True", "5"], "Целое число 5 и строка из одной цифры — разные значения."),
      exercise({
        text: "В строке raw_code приходит код от панели. Известный числовой код называется saved_code. Преобразуй ввод в целое число, сохрани результат сравнения в matches и выведи его.",
        cases: [
          sample({ raw_code: "04", saved_code: 4 }, { matches: true }, ["True"], boolean("matches")),
          sample({ raw_code: "12", saved_code: 11 }, { matches: false }, ["False"], boolean("matches")),
        ],
        hint: "int(raw_code) даёт число. Сравни его с saved_code оператором ==.",
        solution: "matches = int(raw_code) == saved_code\nprint(matches)",
      }),
    ] },
    { title: "На границе порога", slides: [
      theory("Операторы > и < сравнивают строго. Операторы >= и <= учитывают равенство. Если достаточно ровно восьми единиц, подойдёт charge >= 8.", "print(8 > 8)\nprint(8 >= 8)"),
      quiz("Как проверить, что уровень не превышает limit?", "", "level <= limit", ["level < limit", "level >= limit"], "Уровень limit допустим, значит равенство входит в условие."),
      exercise({
        text: "В грузовом отсеке проверяют массу. Сохрани в within_limit результат проверки, что mass не превышает limit, и выведи его.",
        starter: "within_limit = mass < limit\nprint(within_limit)",
        cases: [
          sample({ mass: 6, limit: 6 }, { within_limit: true }, ["True"], boolean("within_limit")),
          sample({ mass: 7, limit: 6 }, { within_limit: false }, ["False"], boolean("within_limit")),
          sample({ mass: 3, limit: 6 }, { within_limit: true }, ["True"], boolean("within_limit")),
        ],
        hint: "Исправь сравнение так, чтобы точное совпадение тоже подходило.",
        solution: "within_limit = mass <= limit\nprint(within_limit)",
      }),
    ] },
    { title: "Оба условия", slides: [
      theory("and даёт True, только если оба условия истинны. not меняет True на False и наоборот.", "has_key = True\nlocked = False\ncan_enter = has_key and not locked\nprint(can_enter)"),
      quiz("Какой будет результат?", "print(True and not True)", "False", ["True", "Ошибка"], "not True превращается в False. У and ложность одной части делает ложным весь результат."),
      exercise({
        text: "У ученика есть допуск has_badge, а в помещении может быть тревога alarm. Запиши в can_enter, что одновременно есть допуск и нет тревоги. Выведи результат.",
        cases: [
          sample({ has_badge: true, alarm: false }, { can_enter: true }, ["True"], boolean("can_enter")),
          sample({ has_badge: false, alarm: false }, { can_enter: false }, ["False"], boolean("can_enter")),
          sample({ has_badge: true, alarm: true }, { can_enter: false }, ["False"], boolean("can_enter")),
        ],
        hint: "Свяжи допуск и отрицание тревоги через and.",
        solution: "can_enter = has_badge and not alarm\nprint(can_enter)",
      }),
    ] },
    { title: "Запасной источник", slides: [
      theory("or даёт True, если истинно хотя бы одно из условий. Скобками можно явно показать, какие проверки объединены.", "socket_a = False\nsocket_b = True\nprint(socket_a or socket_b)"),
      quiz("Какое из условий при двух работающих источниках вернёт True?", "main = True\nreserve = True", "main or reserve", ["not main and reserve", "not (main or reserve)"], "Для or подходит один работающий источник или сразу два."),
      exercise({
        text: "Пульт работает, если есть основной main_power или резервный backup_power. Во время ремонта maintenance пульт должен быть выключен. Запиши в working результат проверки и выведи его.",
        cases: [
          sample({ main_power: false, backup_power: true, maintenance: false }, { working: true }, ["True"], boolean("working")),
          sample({ main_power: true, backup_power: false, maintenance: true }, { working: false }, ["False"], boolean("working")),
          sample({ main_power: false, backup_power: false, maintenance: false }, { working: false }, ["False"], boolean("working")),
          sample({ main_power: true, backup_power: true, maintenance: false }, { working: true }, ["True"], boolean("working")),
        ],
        hint: "В скобках проверь источники через or. К этому условию добавь «и нет ремонта».",
        solution: "working = (main_power or backup_power) and not maintenance\nprint(working)",
      }),
    ] },
    { title: "Допуск к рейсу", group: "project", slides: [
      theory("Пульт должен сообщить, можно ли выехать. Для выезда нужен достаточный заряд, действующий пропуск и отсутствие тревоги."),
      exercise({
        text: "Шаг 1. В charged сохрани результат проверки, что charge не ниже минимума minimum.",
        cases: logicCases(1),
        hint: "Ровно minimum — достаточный заряд.",
        solution: "charged = charge >= minimum",
      }),
      exercise({
        text: "Шаг 2. Добавь rules_ok. Правила соблюдены, если есть пропуск has_pass и нет тревоги alarm.",
        starter: "charged = charge >= minimum",
        continueCode: true,
        cases: logicCases(2),
        hint: "Используй and, чтобы проверить пропуск вместе с отсутствием тревоги.",
        solution: "charged = charge >= minimum\nrules_ok = has_pass and not alarm",
      }),
      exercise({
        text: "Шаг 3. Сохрани допуск к рейсу в allowed и выведи его. Для выезда одновременно должны подойти charged и rules_ok.",
        starter: "charged = charge >= minimum\nrules_ok = has_pass and not alarm",
        continueCode: true,
        cases: logicCases(3),
        hint: "У тебя уже есть два логических результата. Объедини их через and.",
        solution: "charged = charge >= minimum\nrules_ok = has_pass and not alarm\nallowed = charged and rules_ok\nprint(allowed)",
      }),
    ] },
  ],
};

const gateInputs = [
  { has_pass: false, charge: 9, minimum: 8, power_ok: true, status: "Нет пропуска" },
  { has_pass: true, charge: 7, minimum: 8, power_ok: false, status: "Нужна зарядка" },
  { has_pass: true, charge: 8, minimum: 8, power_ok: true, status: "Шлюз открыт" },
  { has_pass: false, charge: 7, minimum: 8, power_ok: false, status: "Нет пропуска" },
];
const gateCases = step => gateInputs.map(({ has_pass, charge, minimum, power_ok, status }) => sample(
  { has_pass, charge, minimum },
  step === 1 ? { power_ok } : { power_ok, status },
  step === 3 ? [status] : [],
  boolean("power_ok"),
));
const gateLines = [
  "power_ok = charge >= minimum",
  'if not has_pass:\n    status = "Нет пропуска"\nelif not power_ok:\n    status = "Нужна зарядка"\nelse:\n    status = "Шлюз открыт"',
  "print(status)",
];
const gateCode = step => gateLines.slice(0, step).join("\n");

const conditions = {
  id: "conditions",
  title: "Условия",
  stages: [
    { title: "Действие по условию", slides: [
      theory("if выполняет строки с отступом, только если условие истинно. После условия ставят двоеточие, а вложенные строки сдвигают вправо.", 'charge = 3\nstatus = "Готов"\nif charge < 5:\n    status = "Зарядка"\nprint(status)'),
      quiz("Когда изменится status?", 'if charge < 5:\n    status = "Зарядка"', "Когда charge меньше 5", ["Когда charge равен 5", "При любом charge"], "Строка с отступом исполняется, когда сравнение возвращает True."),
      exercise({
        text: "У индикатора message по умолчанию текст «Норма». Если temp больше max_temp, измени message на «Перегрев». После условия выведи message.",
        starter: 'message = "Норма"\n',
        cases: [
          sample({ temp: 81, max_temp: 80 }, { message: "Перегрев" }, ["Перегрев"]),
          sample({ temp: 80, max_temp: 80 }, { message: "Норма" }, ["Норма"]),
          sample({ temp: 14, max_temp: 20 }, { message: "Норма" }, ["Норма"]),
        ],
        hint: 'Внутри if меняется message, а print(message) выполняется всегда и пишется без отступа.',
        solution: 'message = "Норма"\nif temp > max_temp:\n    message = "Перегрев"\nprint(message)',
      }),
    ] },
    { title: "Два исхода", slides: [
      theory("У if и else выполнится одна ветка. Если проверка в if ложная, Python переходит к строкам с отступом после else.", 'available = False\nif available:\n    print("Свободно")\nelse:\n    print("Занято")'),
      quiz("Когда сработает else?", 'if free >= needed:\n    print("Разрешено")\nelse:\n    print("Места нет")', "Когда free меньше needed", ["Когда free равен needed", "Всегда после if"], "При равенстве условие >= истинно, поэтому срабатывает if."),
      exercise({
        text: "Для лифта нужно свободное место need. Если свободных мест free достаточно, запиши «Вход открыт» в status. Иначе запиши «Подожди». Выведи status один раз.",
        cases: [
          sample({ free: 3, need: 3 }, { status: "Вход открыт" }, ["Вход открыт"]),
          sample({ free: 1, need: 3 }, { status: "Подожди" }, ["Подожди"]),
          sample({ free: 5, need: 1 }, { status: "Вход открыт" }, ["Вход открыт"]),
        ],
        hint: "Проверь free >= need через if. Вторая ветка начинается с else: без дополнительной проверки.",
        solution: 'if free >= need:\n    status = "Вход открыт"\nelse:\n    status = "Подожди"\nprint(status)',
      }),
    ] },
    { title: "Три режима работы", slides: [
      theory("elif добавляет ещё одну проверку. Python рассматривает ветки сверху вниз и выполняет первую подходящую.", 'speed = 5\nif speed < 3:\n    print("Медленно")\nelif speed < 8:\n    print("Средне")\nelse:\n    print("Быстро")'),
      quiz("Какой режим будет у показания speed = 3?", 'if speed < 3:\n    mode = "Медленно"\nelif speed < 8:\n    mode = "Средне"\nelse:\n    mode = "Быстро"', "Средне", ["Медленно", "Быстро"], "Ровно 3 не подходит к speed < 3, но подходит к speed < 8."),
      exercise({
        text: "По уровню заряда charge выбери mode. Меньше 4 — «Сон», от 4 до 7 включительно — «Экономия», от 8 — «Работа». Выведи mode.",
        cases: [
          sample({ charge: 3 }, { mode: "Сон" }, ["Сон"]),
          sample({ charge: 4 }, { mode: "Экономия" }, ["Экономия"]),
          sample({ charge: 7 }, { mode: "Экономия" }, ["Экономия"]),
          sample({ charge: 8 }, { mode: "Работа" }, ["Работа"]),
        ],
        hint: "Проверь сначала charge < 4, затем в elif проверь charge < 8.",
        solution: 'if charge < 4:\n    mode = "Сон"\nelif charge < 8:\n    mode = "Экономия"\nelse:\n    mode = "Работа"\nprint(mode)',
      }),
    ] },
    { title: "Приоритет сигнала", slides: [
      quiz("Почему при temp = 40 программа не выдаёт слово «Стоп»?", 'if temp >= 25:\n    status = "Тепло"\nelif temp >= 40:\n    status = "Стоп"', "Сработала первая проверка", ["Ошибка отступа", "Вторая проверка тоже сработала"], "Сравнение temp >= 25 уже истинно. Python пропускает остальные ветки."),
      exercise({
        text: "Тревога alarm важнее остальных сигналов. Если она включена, status — «Стоп». Без тревоги температура от 25 даёт статус «Тепло». В остальных случаях — «Норма». Исправь код и выведи результат.",
        starter: 'if temp >= 25:\n    status = "Тепло"\nelif alarm:\n    status = "Стоп"\nelse:\n    status = "Норма"\nprint(status)',
        cases: [
          sample({ temp: 30, alarm: true }, { status: "Стоп" }, ["Стоп"]),
          sample({ temp: 25, alarm: false }, { status: "Тепло" }, ["Тепло"]),
          sample({ temp: 12, alarm: true }, { status: "Стоп" }, ["Стоп"]),
          sample({ temp: 24, alarm: false }, { status: "Норма" }, ["Норма"]),
        ],
        hint: "Перенеси проверку тревоги вместе с её сообщением в первую ветку.",
        solution: 'if alarm:\n    status = "Стоп"\nelif temp >= 25:\n    status = "Тепло"\nelse:\n    status = "Норма"\nprint(status)',
      }),
    ] },
    { title: "Пульт шлюза", group: "project", slides: [
      theory("Шлюзу нужны пропуск и заряд. Когда обоих не хватает, оператор сначала должен увидеть сообщение про пропуск."),
      exercise({
        text: "Шаг 1. Сохрани в power_ok, хватает ли charge для прохода. Порог minimum включается в допустимые значения.",
        cases: gateCases(1),
        hint: "Используй оператор сравнения, который учитывает равенство.",
        solution: gateCode(1),
      }),
      exercise({
        text: "Шаг 2. Определи status. Сначала «Нет пропуска», если пропуска нет. Иначе «Нужна зарядка», если заряда мало. Иначе «Шлюз открыт».",
        starter: gateCode(1),
        continueCode: true,
        cases: gateCases(2),
        hint: "Проверь not has_pass в if, затем not power_ok в elif. Для последнего случая подойдёт else.",
        solution: gateCode(2),
      }),
      exercise({
        text: "Шаг 3. Выведи один status после всех веток.",
        starter: gateCode(2),
        continueCode: true,
        cases: gateCases(3),
        hint: "Добавь один print(status) без отступа после блока if.",
        solution: gateCode(3),
      }),
    ] },
  ],
};

const chargeInputs = [
  { start: 2, target: 7, rate: 2, charge: 7, cycles: 3, log: ["4", "6", "7", "Циклов: 3"] },
  { start: 8, target: 8, rate: 2, charge: 8, cycles: 0, log: ["Циклов: 0"] },
  { start: 1, target: 5, rate: 4, charge: 5, cycles: 1, log: ["5", "Циклов: 1"] },
];
const chargingCases = step => chargeInputs.map(({ start, target, rate, charge, cycles, log }) => sample(
  { start, target, rate },
  step === 1 ? { charge: start, cycles: 0 } : { charge, cycles },
  step === 3 ? log : [],
));
const chargingLines = [
  "charge = start\ncycles = 0",
  "while charge < target:\n    charge = charge + rate\n    if charge > target:\n        charge = target\n    cycles = cycles + 1",
  "    print(charge)\nprint(\"Циклов: \" + str(cycles))",
];
const chargingCode = step => chargingLines.slice(0, step).join("\n");

const loops = {
  id: "loops",
  title: "Циклы",
  stages: [
    { title: "Считаем по порядку", slides: [
      theory("Цикл for повторяет строки с отступом. range(начало, конец) выдаёт числа до конца, не включая его.", "for index in range(1, 4):\n    print(index)"),
      quiz("Какое число будет последним?", "for number in range(2, 6):\n    print(number)", "5", ["6", "4"], "range останавливается перед верхней границей 6."),
      exercise({
        text: "Напечатай номера постов от 1 до last включительно. Каждый номер выведи на своей строке.",
        cases: [
          sample({ last: 3 }, {}, ["1", "2", "3"]),
          sample({ last: 1 }, {}, ["1"]),
          sample({ last: 4 }, {}, ["1", "2", "3", "4"]),
        ],
        hint: "Конец range не включается. Чтобы дошло до last, используй верхнюю границу last + 1.",
        solution: "for post in range(1, last + 1):\n    print(post)",
      }),
    ] },
    { title: "Итог после обхода", slides: [
      theory("Сумму начинаем с нуля и увеличиваем на каждом шаге. print() без отступа выполняется после всего цикла.", "total = 0\nfor number in range(1, 4):\n    total = total + number\nprint(total)"),
      quiz("Сколько значений будет выведено?", "score = 0\nfor number in range(1, 4):\n    score = score + number\nprint(score)", "Одно", ["Три", "Ни одного"], "print() находится после цикла и выводит только итог."),
      exercise({
        text: "Обход состоит из count участков. На участке №1 добавляется 1 единица, на участке №2 — 2, и так далее. Сохрани сумму в total и выведи её после обхода.",
        starter: "total = 0\n",
        cases: [
          sample({ count: 4 }, { total: 10 }, ["10"]),
          sample({ count: 0 }, { total: 0 }, ["0"]),
          sample({ count: 6 }, { total: 21 }, ["21"]),
        ],
        hint: "Прибавляй текущий номер участка к total внутри цикла. Верхняя граница — count + 1.",
        solution: "total = 0\nfor number in range(1, count + 1):\n    total = total + number\nprint(total)",
      }),
    ] },
    { title: "Пока заряда мало", slides: [
      theory("while проверяет условие перед каждым повтором. Изменяй переменную внутри цикла, чтобы условие однажды перестало выполняться.", "charge = 2\nwhile charge < 5:\n    charge = charge + 1\n    print(charge)"),
      quiz("Сколько раз сработает print()?", "charge = 5\nwhile charge < 5:\n    charge = charge + 1\n    print(charge)", "Ноль раз", ["Один раз", "Пять раз"], "Условие charge < 5 уже ложно при первой проверке."),
      exercise({
        text: "Пока charge меньше target, добавляй к заряду по одной единице. Печатай новое показание после каждого изменения.",
        cases: [
          sample({ charge: 2, target: 5 }, { charge: 5 }, ["3", "4", "5"]),
          sample({ charge: 4, target: 4 }, { charge: 4 }, []),
          sample({ charge: 0, target: 2 }, { charge: 2 }, ["1", "2"]),
        ],
        hint: "У while проверяй charge < target. Внутри цикла стоит обновление charge, а затем его вывод.",
        solution: "while charge < target:\n    charge = charge + 1\n    print(charge)",
      }),
    ] },
    { title: "Прервать обход", slides: [
      theory("break останавливает ближайший цикл. Например, можно проверить сигнал тревоги раньше, чем вывести номер очередного поста.", "for post in range(1, 5):\n    if post == 3:\n        break\n    print(post)"),
      quiz("Какие номера выведет программа?", "for post in range(1, 5):\n    if post == 3:\n        break\n    print(post)", "1 и 2", ["1, 2 и 3", "1, 2, 3 и 4"], "Когда post становится равным 3, break прерывает цикл до вывода."),
      exercise({
        text: "Печатай номера постов от 1 до last включительно. Если дойдёшь до закрытого поста stop_at, останови обход до вывода его номера.",
        starter: "for post in range(1, last + 1):\n    print(post)",
        cases: [
          sample({ last: 5, stop_at: 3 }, {}, ["1", "2"]),
          sample({ last: 2, stop_at: 4 }, {}, ["1", "2"]),
          sample({ last: 3, stop_at: 1 }, {}, []),
        ],
        hint: "Внутри for, перед print(), проверь post == stop_at и используй break.",
        solution: "for post in range(1, last + 1):\n    if post == stop_at:\n        break\n    print(post)",
      }),
    ] },
    { title: "Журнал зарядки", group: "project", slides: [
      theory("Соберём программу зарядной станции. Она начнёт с текущего заряда, будет поднимать его небольшими шагами и запишет каждый шаг в журнал."),
      exercise({
        text: "Шаг 1. Запиши начальный заряд start в charge. Заведи счётчик cycles со значением 0.",
        cases: chargingCases(1),
        hint: "Для charge возьми значение входной переменной start, а для cycles запиши 0.",
        solution: chargingCode(1),
        display: "charge",
      }),
      exercise({
        text: "Шаг 2. Пока charge ниже target, добавляй rate и увеличивай cycles на 1. Если новый заряд выше target, замени его на target.",
        starter: chargingCode(1),
        continueCode: true,
        cases: chargingCases(2),
        hint: "Начни с while charge < target. Внутри добавь rate, проверь верхнюю границу и посчитай цикл.",
        solution: chargingCode(2),
        display: "charge",
      }),
      exercise({
        text: "Шаг 3. В конце каждого цикла выводи новый charge. После остановки выведи строку «Циклов: N», где N — значение cycles.",
        starter: chargingCode(2),
        continueCode: true,
        cases: chargingCases(3),
        hint: 'print(charge) с отступом идёт в конце тела while. Подпись "Циклов: " + str(cycles) выводится без отступа.',
        solution: chargingCode(3),
      }),
    ] },
  ],
};

export const foundations = [types, arithmetic, logic, conditions, loops];
