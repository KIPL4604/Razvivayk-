import { theory, quiz, exercise } from "./course-authoring.mjs";

const strings = {
  id: "strings",
  title: "Строки и команды",
  stages: [
    { title: "Символ по индексу", slides: [
      theory("Индекс показывает позицию символа. Python начинает счёт с нуля: у первого символа индекс 0.", 'code = "A15"\nprint(code[0])'),
      quiz("Что выведется?", 'tag = "M27"\nprint(tag[1])', "2", ["M", "7"], "Индекс 1 указывает на второй символ строки."),
      exercise({
        text: "Из кода пропуска badge возьми первую букву. Сохрани её в sector и выведи.",
        cases: [
          { initial: { badge: "A15" }, expected: { sector: "A" }, output: ["A"] },
          { initial: { badge: "C02" }, expected: { sector: "C" }, output: ["C"] },
        ],
        hint: "Поставь индекс 0 в квадратных скобках после имени badge.",
        solution: "sector = badge[0]\nprint(sector)",
      }),
    ] },
    { title: "Код без префикса", slides: [
      theory("Срез [start:stop] берёт символы с позиции start до позиции stop, не включая её. Без stop срез продолжается до конца строки.", 'ticket = "ID:504"\nprint(ticket[3:])'),
      exercise({
        text: "Сообщение начинается с метки CMD:. Вырежи метку и сохрани оставшуюся команду в command.",
        starter: "command = message[2:]",
        cases: [
          { initial: { message: "CMD:OPEN" }, expected: { command: "OPEN" } },
          { initial: { message: "CMD:PAUSE" }, expected: { command: "PAUSE" } },
        ],
        hint: "Перед командой стоят четыре символа. Начни с позиции 4.",
        solution: "command = message[4:]",
      }),
    ] },
    { title: "Лишние пробелы", slides: [
      theory("Метод strip() возвращает строку без пробелов по краям. Пробел между словами сохраняется.", 'text = "  склад А  "\nprint(text.strip())'),
      quiz("Что получится после strip()?", '"  груз  принят ".strip()', "груз  принят", ["грузпринят", "груз принят"], "Метод убирает только крайние пробелы, поэтому два внутренних пробела останутся."),
      exercise({
        text: "Очисти название label от пробелов по краям. Сохрани результат в clean_label и выведи его.",
        cases: [
          { initial: { label: "  Маяк 7 " }, expected: { clean_label: "Маяк 7" }, output: ["Маяк 7"] },
          { initial: { label: "  Док  А " }, expected: { clean_label: "Док  А" }, output: ["Док  А"] },
        ],
        hint: "Вызови strip() у label. Сохрани результат, который вернул метод.",
        solution: "clean_label = label.strip()\nprint(clean_label)",
      }),
    ] },
    { title: "Регистр команд", slides: [
      theory("lower() приводит буквы к нижнему регистру. Оператор сможет набрать команду разными способами, а программа сравнит её с одной записью.", 'raw = "OpEn"\nprint(raw.lower() == "open")'),
      exercise({
        text: "Сохрани команду raw без крайних пробелов и заглавных букв в command. В accepted сохрани ответ на вопрос, равна ли command строке open.",
        cases: [
          { initial: { raw: "  OPEN " }, expected: { command: "open", accepted: true } },
          { initial: { raw: "  PaUsE " }, expected: { command: "pause", accepted: false } },
        ],
        hint: "Сначала вызови strip(), затем lower(). Для сравнения пригодится ==.",
        solution: 'command = raw.strip().lower()\naccepted = command == "open"',
      }),
    ] },
    { title: "Сообщение с данными", slides: [
      theory("Буква f перед кавычками создаёт f-строку. В фигурных скобках можно подставить значение переменной или вычислить выражение.", 'count = 4\nprint(f"После проверки: {count + 1}")'),
      exercise({
        text: "К исходному count добавили ещё две коробки. Сохрани и выведи строку report формата «Коробок: число».",
        cases: [
          { initial: { count: 5 }, expected: { report: "Коробок: 7" }, output: ["Коробок: 7"] },
          { initial: { count: 0 }, expected: { report: "Коробок: 2" }, output: ["Коробок: 2"] },
        ],
        hint: "Подставь выражение count + 2 между фигурными скобками f-строки.",
        solution: 'report = f"Коробок: {count + 2}"\nprint(report)',
      }),
    ] },
    { title: "Терминал команд", group: "project", slides: [
      exercise({
        text: "Сначала подготовь строку raw для сравнения. Убери крайние пробелы, приведи буквы к нижнему регистру и сохрани команду в command.",
        cases: [
          { initial: { raw: "  OpEn  " }, expected: { command: "open" } },
          { initial: { raw: "STOP " }, expected: { command: "stop" } },
        ],
        hint: "Примени strip() и lower() к одному значению.",
        solution: "command = raw.strip().lower()",
      }),
      exercise({
        text: "Допиши ответ терминала. Для open выведи «Шлюз открыт», для прочих команд выведи «Нет команды: » и очищенную команду.",
        starter: "command = raw.strip().lower()\n",
        continueCode: true,
        cases: [
          { initial: { raw: "  OpEn  " }, expected: { command: "open" }, output: ["Шлюз открыт"] },
          { initial: { raw: "STOP " }, expected: { command: "stop" }, output: ["Нет команды: stop"] },
          { initial: { raw: "   " }, expected: { command: "" }, output: ["Нет команды: "] },
        ],
        hint: "Сравни command с open. В ветке else подставь command в f-строку.",
        solution: 'command = raw.strip().lower()\nif command == "open":\n    print("Шлюз открыт")\nelse:\n    print(f"Нет команды: {command}")',
      }),
    ] },
  ],
};

const collections = {
  id: "collections",
  title: "Коллекции",
  stages: [
    { title: "Список показаний", slides: [
      theory("Список хранит элементы в определённом порядке. append() дописывает элемент в конец исходного списка, а len() считает элементы.", 'readings = [2, 8]\nreadings.append(4)\nprint(len(readings))'),
      exercise({
        text: "Добавь очередное показание latest в список readings. Выведи, сколько показаний стало после добавления.",
        cases: [
          { initial: { readings: [2, 8], latest: 4 }, expected: { readings: [2, 8, 4] }, output: ["3"] },
          { initial: { readings: [], latest: 9 }, expected: { readings: [9] }, output: ["1"] },
        ],
        hint: "Сначала readings.append(latest). Затем вызови len() внутри print().",
        solution: "readings.append(latest)\nprint(len(readings))",
      }),
    ] },
    { title: "Сумма из списка", slides: [
      theory("Цикл for может обойти сам список. С каждым шагом имя после for получает очередной элемент.", "boxes = [2, 4]\nfor box in boxes:\n    print(box)"),
      exercise({
        text: "В boxes записано количество деталей в каждой коробке. Сложи эти количества циклом и сохрани сумму в total. Выведи итог.",
        starter: "total = 0\n",
        cases: [
          { initial: { boxes: [2, 5, 1] }, expected: { total: 8 }, output: ["8"] },
          { initial: { boxes: [9, 1] }, expected: { total: 10 }, output: ["10"] },
          { initial: { boxes: [] }, expected: { total: 0 }, output: ["0"] },
        ],
        hint: "Для каждого box из boxes прибавь box к total. Вывод поставь после цикла.",
        solution: "total = 0\nfor box in boxes:\n    total += box\nprint(total)",
      }),
    ] },
    { title: "Разобрать и собрать", slides: [
      theory("split(',') разбивает строку по запятым. Вызов ' / '.join(parts) соединяет список строк, вставляя ' / ' между элементами.", 'parts = "А,Б,В".split(",")\nprint(" / ".join(parts))'),
      exercise({
        text: "Разбей строку codes по запятым на список parts. Выведи те же коды через пробелы и вертикальную черту, как в «A | B».",
        cases: [
          { initial: { codes: "A,B" }, expected: { parts: ["A", "B"] }, output: ["A | B"] },
          { initial: { codes: "D" }, expected: { parts: ["D"] }, output: ["D"] },
          { initial: { codes: "P,Q,R" }, expected: { parts: ["P", "Q", "R"] }, output: ["P | Q | R"] },
        ],
        hint: "Укажи ',' в split(), а метод join() вызови у строки ' | '.",
        solution: 'parts = codes.split(",")\nprint(" | ".join(parts))',
      }),
    ] },
    { title: "Остаток по названию", slides: [
      theory("Словарь связывает ключ и значение. stock.get(name, 0) получает число по имени детали, а для отсутствующего ключа возвращает 0.", 'stock = {"клапан": 4}\nprint(stock.get("кабель", 0))'),
      exercise({
        text: "На склад поступило added деталей вида part. Обнови число в словаре stock и выведи остаток для этого вида.",
        cases: [
          { initial: { stock: { "клапан": 4 }, part: "клапан", added: 3 }, expected: { stock: { "клапан": 7 } }, output: ["7"] },
          { initial: { stock: { "клапан": 4 }, part: "кабель", added: 2 }, expected: { stock: { "клапан": 4, "кабель": 2 } }, output: ["2"] },
        ],
        hint: "Слева поставь stock[part]. Справа сложи прежнее количество из get() и added.",
        solution: "stock[part] = stock.get(part, 0) + added\nprint(stock[part])",
      }),
    ] },
    { title: "Координаты и пропуска", slides: [
      theory("Кортеж хранит позиции в порядке, например координаты (ряд, место). Множество set() оставляет каждый элемент только один раз.", 'dock = (2, 7)\npasses = ["А", "А", "Б"]\nprint(len(set(passes)))'),
      quiz("Какое число напечатает программа?", 'badges = ["B", "B", "C"]\nprint(len(set(badges)))', "2", ["3", "1"], "В списке три записи, но уникальных пропуска два."),
      exercise({
        text: "Сохрани ряд row и место bay в кортеже dock. Посчитай число разных пропусков из passes и выведи только это число.",
        cases: [
          { initial: { row: 2, bay: 7, passes: ["A", "A", "B"] }, expected: { dock: [2, 7] }, types: { dock: "tuple" }, output: ["2"] },
          { initial: { row: 4, bay: 1, passes: [] }, expected: { dock: [4, 1] }, types: { dock: "tuple" }, output: ["0"] },
        ],
        hint: "Собери (row, bay), затем посчитай длину множества пропусков.",
        solution: "dock = (row, bay)\nprint(len(set(passes)))",
      }),
    ] },
    { title: "Инвентарь грузового отсека", group: "project", slides: [
      exercise({
        text: "Каждое имя в items — одна поступившая деталь. Заполни словарь stock, где ключ — имя детали, а значение — остаток.",
        starter: "stock = {}\n",
        cases: [
          { initial: { items: ["фильтр", "кабель", "фильтр"] }, expected: { stock: { "фильтр": 2, "кабель": 1 } } },
          { initial: { items: ["гайка", "гайка"] }, expected: { stock: { "гайка": 2 } } },
          { initial: { items: [] }, expected: { stock: {} } },
        ],
        hint: "На каждой итерации возьми stock.get(item, 0) и прибавь одну деталь.",
        solution: "stock = {}\nfor item in items:\n    stock[item] = stock.get(item, 0) + 1",
      }),
      exercise({
        text: "Допиши краткий отчёт. На первой строке выведи количество деталей выбранного вида requested. На второй выведи число уникальных пропусков из passes.",
        starter: "stock = {}\nfor item in items:\n    stock[item] = stock.get(item, 0) + 1\n",
        continueCode: true,
        cases: [
          { initial: { items: ["фильтр", "кабель", "фильтр"], requested: "фильтр", passes: ["A", "A", "B"] }, expected: { stock: { "фильтр": 2, "кабель": 1 } }, output: ["2", "2"] },
          { initial: { items: ["гайка"], requested: "шайба", passes: ["C"] }, expected: { stock: { "гайка": 1 } }, output: ["0", "1"] },
        ],
        hint: "Выведи число из stock.get(requested, 0). Для второй строки посчитай длину set(passes).",
        solution: "stock = {}\nfor item in items:\n    stock[item] = stock.get(item, 0) + 1\nprint(stock.get(requested, 0))\nprint(len(set(passes)))",
      }),
    ] },
  ],
};

const functions = {
  id: "functions",
  title: "Функции и модули",
  stages: [
    { title: "Вернуть результат", slides: [
      theory("def даёт имя функции, а return возвращает результат туда, где её вызвали. Вызов функции можно поставить справа от знака =.", "def next_slot(slot):\n    return slot + 1\n\nnext_number = next_slot(4)\nprint(next_number)"),
      quiz("Что делает return slot + 1?", "", "Возвращает вычисленное число", ["Всегда печатает его", "Меняет slot во всей программе"], "return передаёт результат вызову. Вывести его можно отдельно."),
      exercise({
        text: "Напиши функцию next_slot(slot), которая возвращает номер следующего места.",
        starter: "def next_slot(slot):\n",
        cases: [
          { call: { name: "next_slot", args: [4], result: 5 } },
          { call: { name: "next_slot", args: [19], result: 20 } },
        ],
        hint: "В теле функции верни slot + 1.",
        solution: "def next_slot(slot):\n    return slot + 1",
      }),
    ] },
    { title: "Два параметра", slides: [
      theory("У функции может быть два параметра. Вызов подставляет первый аргумент в первый параметр, а второй — во второй.", "def remaining(budget, spent):\n    return budget - spent\n\nprint(remaining(12, 5))"),
      exercise({
        text: "Исправь функцию remaining(budget, spent). Она должна вернуть остаток, в том числе отрицательный при перерасходе.",
        starter: "def remaining(budget, spent):\n    return spent - budget",
        cases: [
          { call: { name: "remaining", args: [12, 5], result: 7 } },
          { call: { name: "remaining", args: [3, 7], result: -4 } },
          { call: { name: "remaining", args: [9, 9], result: 0 } },
        ],
        hint: "Вычти потраченное из бюджета.",
        solution: "def remaining(budget, spent):\n    return budget - spent",
      }),
    ] },
    { title: "Имя внутри функции", slides: [
      theory("Имя, которому присвоили значение внутри функции, обычно живёт только внутри неё. После вызова внешняя переменная с тем же именем сохраняет своё значение.", 'reserve = 50\n\ndef add_reserve(count):\n    reserve = 2\n    return count + reserve\n\nprint(add_reserve(5))\nprint(reserve)'),
      exercise({
        text: "Определи kit_total(count). Внутри функции положи в local_reserve две запасные детали и верни сумму. Выведи итог для pieces. Внешнее total должно сохранить исходное значение.",
        cases: [
          { initial: { pieces: 4, total: 30 }, expected: { total: 30 }, output: ["6"], call: { name: "kit_total", args: [1], result: 3 } },
          { initial: { pieces: 9, total: 7 }, expected: { total: 7 }, output: ["11"], call: { name: "kit_total", args: [9], result: 11 } },
        ],
        hint: "Вызови print(kit_total(pieces)) после определения функции. Для вычисления используй count.",
        solution: "def kit_total(count):\n    local_reserve = 2\n    return count + local_reserve\n\nprint(kit_total(pieces))",
      }),
    ] },
    { title: "Импорт расчёта", slides: [
      theory("Файл cargo_math.py может хранить расчёты отдельно. Чтобы взять функцию из этого файла, напиши from cargo_math import cargo_weight. В имени модуля расширение .py опускают."),
      exercise({
        text: "Подключи cargo_weight из файла cargo_math.py. Вызови её с count и unit_weight, запиши ответ в total_weight и выведи. Используй функцию файла, поскольку правила расчёта может обновить оператор.",
        cases: [
          { files: { "cargo_math.py": "def cargo_weight(count, unit_weight):\n    return count * unit_weight\n" }, initial: { count: 3, unit_weight: 4 }, expected: { total_weight: 12 }, output: ["12"] },
          { files: { "cargo_math.py": "def cargo_weight(count, unit_weight):\n    return count * unit_weight + 2\n" }, initial: { count: 3, unit_weight: 4 }, expected: { total_weight: 14 }, output: ["14"] },
        ],
        hint: "Импортируй функцию в начале, затем передай ей уже заданные имена.",
        solution: "from cargo_math import cargo_weight\ntotal_weight = cargo_weight(count, unit_weight)\nprint(total_weight)",
      }),
    ] },
    { title: "Расчёт для двух отсеков", group: "project", slides: [
      exercise({
        text: "Напиши cargo_weight(count, unit_weight). Функция должна вернуть общий вес коробок в отсеке.",
        starter: "def cargo_weight(count, unit_weight):\n",
        cases: [
          { call: { name: "cargo_weight", args: [4, 2.5], result: 10 } },
          { call: { name: "cargo_weight", args: [0, 2.5], result: 0 } },
          { call: { name: "cargo_weight", args: [3, 0.5], result: 1.5 } },
        ],
        hint: "Общий вес равен количеству, умноженному на вес одной коробки.",
        solution: "def cargo_weight(count, unit_weight):\n    return count * unit_weight",
      }),
      exercise({
        text: "Вызови свою функцию дважды, для left_count и right_count. Вес коробки в обоих отсеках — unit_weight. Выведи сперва вес слева, затем вес справа и в конце сумму.",
        starter: "def cargo_weight(count, unit_weight):\n    return count * unit_weight\n",
        continueCode: true,
        cases: [
          { initial: { left_count: 2, right_count: 3, unit_weight: 4 }, output: ["8", "12", "20"], call: { name: "cargo_weight", args: [7, 5], result: 35 } },
          { initial: { left_count: 0, right_count: 5, unit_weight: 2 }, output: ["0", "10", "10"], call: { name: "cargo_weight", args: [2, 9], result: 18 } },
        ],
        hint: "Запиши оба вызова в разные переменные. Затем выведи их и их сумму.",
        solution: "def cargo_weight(count, unit_weight):\n    return count * unit_weight\n\nleft = cargo_weight(left_count, unit_weight)\nright = cargo_weight(right_count, unit_weight)\nprint(left)\nprint(right)\nprint(left + right)",
      }),
    ] },
  ],
};

const errors = {
  id: "errors",
  title: "Ввод, ошибки и тесты",
  stages: [
    { title: "Прочитать число", slides: [
      theory("input() читает строку из ввода программы. Чтобы прибавить к введённому значению число, сначала преобразуй строку с int().", "raw = input()\ncount = int(raw)\nprint(count + 1)", { stdin: ["4"] }),
      exercise({
        text: "Прочитай целое число коробок из ввода. Сохрани его в count, прибавь две запасные коробки и выведи новый итог.",
        cases: [
          { stdin: ["5"], expected: { count: 5 }, output: ["7"] },
          { stdin: ["11"], expected: { count: 11 }, output: ["13"] },
        ],
        hint: "Прочитай строку вызовом input(), затем передай её в int().",
        solution: "count = int(input())\nprint(count + 2)",
      }),
    ] },
    { title: "Прочитать traceback", slides: [
      theory("При сбое Python пишет traceback. Обычно начинать удобно с последней строки: там тип ошибки и объяснение. Выше указана строка кода, на которой произошёл сбой."),
      quiz("Какое имя Python не нашёл?", "line 2: print(totla)\nNameError: name 'totla' is not defined", "totla", ["print", "line"], "NameError называет имя из исходного кода. Здесь это опечатка totla."),
      exercise({
        text: "В строке вывода опечатка. Почини программу, чтобы она прочитала два показания и вывела их сумму.",
        starter: "total = int(input()) + int(input())\nprint(totla)",
        cases: [
          { stdin: ["7", "2"], expected: { total: 9 }, output: ["9"] },
          { stdin: ["9", "-2"], expected: { total: 7 }, output: ["7"] },
        ],
        hint: "Сравни название слева от знака = и внутри print().",
        solution: "total = int(input()) + int(input())\nprint(total)",
      }),
    ] },
    { title: "Некорректное значение", slides: [
      theory("int() сообщает об ошибке ValueError, если строка не содержит целого числа. В try выполняется преобразование, а except ValueError задаёт действие при такой ошибке.", 'try:\n    boxes = int("нет данных")\nexcept ValueError:\n    print("Число не распознано")'),
      exercise({
        text: "Прочитай число из ввода. При успехе выведи это число. При ValueError выведи «Введите целое число».",
        cases: [
          { stdin: ["8"], output: ["8"] },
          { stdin: ["восемь"], output: ["Введите целое число"] },
          { stdin: [""], output: ["Введите целое число"] },
          { stdin: ["0"], output: ["0"] },
        ],
        hint: "Помести int(input()) в try. В except ValueError выведи сообщение.",
        solution: 'try:\n    count = int(input())\n    print(count)\nexcept ValueError:\n    print("Введите целое число")',
      }),
    ] },
    { title: "Тест граничного значения", slides: [
      theory("assert проверяет условие. Если оно ложно, Python поднимает AssertionError. Для расчёта коробок полезно отдельно проверить ноль.", "def weight(count):\n    return count * 4\n\nassert weight(0) == 0"),
      exercise({
        text: "Напиши один assert для функции cargo_weight(count, unit_weight) из cargo_math.py. Проверь, что при нуле коробок и весе одной коробки 5 результат равен нулю. Один набор данных специально подменяет функцию ошибочной.",
        starter: "from cargo_math import cargo_weight\n",
        cases: [
          { files: { "cargo_math.py": "def cargo_weight(count, unit_weight):\n    return count * unit_weight\n" } },
          { files: { "cargo_math.py": "def cargo_weight(count, unit_weight):\n    return (count + 1) * unit_weight\n" }, error: "AssertionError" },
        ],
        hint: "Сравни значение cargo_weight(0, 5) с нулём после assert.",
        solution: "from cargo_math import cargo_weight\nassert cargo_weight(0, 5) == 0",
      }),
    ] },
    { title: "Надёжный калькулятор", group: "project", slides: [
      exercise({
        text: "Напиши parse_count(raw). Она должна вернуть целое число из строки. При ValueError верни None. Это позволяет отличить ошибку от настоящего нуля.",
        starter: "def parse_count(raw):\n",
        cases: [
          { call: { name: "parse_count", args: ["12"], result: 12 } },
          { call: { name: "parse_count", args: ["0"], result: 0 } },
          { call: { name: "parse_count", args: [""], result: null } },
          { call: { name: "parse_count", args: ["2.5"], result: null } },
        ],
        hint: "Верни int(raw) из try и None из except ValueError.",
        solution: "def parse_count(raw):\n    try:\n        return int(raw)\n    except ValueError:\n        return None",
      }),
      exercise({
        text: "Подключи ввод к parse_count(). Если результат is None, выведи «Введите целое число». Иначе выведи вес при массе 4 на коробку.",
        starter: "def parse_count(raw):\n    try:\n        return int(raw)\n    except ValueError:\n        return None\n",
        continueCode: true,
        cases: [
          { stdin: ["3"], output: ["12"], call: { name: "parse_count", args: ["8"], result: 8 } },
          { stdin: ["0"], output: ["0"], call: { name: "parse_count", args: ["0"], result: 0 } },
          { stdin: ["ошибка"], output: ["Введите целое число"], call: { name: "parse_count", args: ["ошибка"], result: null } },
          { stdin: [""], output: ["Введите целое число"] },
        ],
        hint: "Сохрани результат parse_count(input()). Проверка is None пропустит настоящий ноль.",
        solution: 'def parse_count(raw):\n    try:\n        return int(raw)\n    except ValueError:\n        return None\n\ncount = parse_count(input())\nif count is None:\n    print("Введите целое число")\nelse:\n    print(count * 4)',
      }),
    ] },
  ],
};

const files = {
  id: "files",
  title: "Файлы и данные",
  stages: [
    { title: "Прочитать файл", slides: [
      theory("with open(...) открывает файл и затем закрывает его, когда выполнятся строки внутри блока. read() возвращает текст, а encoding помогает правильно читать русские буквы.", 'with open("note.txt", encoding="utf-8") as source:\n    note = source.read()\nprint(note)', { files: { "note.txt": "Отсек открыт" } }),
      exercise({
        text: "Открой note.txt. Прочитай текст, убери пробелы и переводы строки по краям, сохрани запись в note и выведи её.",
        starter: 'with open("note.txt", encoding="utf-8") as source:\n',
        cases: [
          { files: { "note.txt": "  Смена началась\n" }, expected: { note: "Смена началась" }, output: ["Смена началась"] },
          { files: { "note.txt": " Проверка завершена\n" }, expected: { note: "Проверка завершена" }, output: ["Проверка завершена"] },
        ],
        hint: "Прочитай source.read() и примени strip(). Выведи note после блока.",
        solution: 'with open("note.txt", encoding="utf-8") as source:\n    note = source.read().strip()\nprint(note)',
      }),
    ] },
    { title: "Записать журнал", slides: [
      theory("Режим w создаёт файл или заменяет его содержимое. Метод write() записывает строку. Если нужна новая строка, добавь символ переноса явно.", 'with open("shift.txt", "w", encoding="utf-8") as log:\n    log.write("Смена началась\\n")'),
      exercise({
        text: "Запиши значение message одной строкой в shift.txt. Закончи запись переводом строки и замени прежнее содержимое, если файл уже есть.",
        cases: [
          { initial: { message: "Проверка пройдена" }, expectedFiles: { "shift.txt": "Проверка пройдена\n" } },
          { initial: { message: "Смена закрыта" }, files: { "shift.txt": "Старый отчёт\n" }, expectedFiles: { "shift.txt": "Смена закрыта\n" } },
        ],
        hint: "Открой файл в режиме w. Передай в write() текст message и перевод строки.",
        solution: 'with open("shift.txt", "w", encoding="utf-8") as log:\n    log.write(message + "\\n")',
      }),
    ] },
    { title: "Таблица CSV", slides: [
      theory("В CSV первая строка может содержать названия столбцов. csv.DictReader читает данные как словари. Числа из столбца приходят строками."),
      exercise({
        text: "Файл stock.csv содержит столбцы part и count. Используй csv.DictReader, суммируй count из каждой строки и выведи total.",
        starter: 'import csv\ntotal = 0\nwith open("stock.csv", encoding="utf-8") as source:\n    for row in csv.DictReader(source):\n',
        cases: [
          { files: { "stock.csv": "part,count\nкабель,3\nклапан,5\n" }, expected: { total: 8 }, output: ["8"] },
          { files: { "stock.csv": "part,count\nгайка,7\nшайба,4\n" }, expected: { total: 11 }, output: ["11"] },
          { files: { "stock.csv": "part,count\n" }, expected: { total: 0 }, output: ["0"] },
        ],
        hint: 'Внутри цикла прибавь int(row["count"]) к total. Итог выведи после цикла.',
        solution: 'import csv\ntotal = 0\nwith open("stock.csv", encoding="utf-8") as source:\n    for row in csv.DictReader(source):\n        total += int(row["count"])\nprint(total)',
      }),
    ] },
    { title: "Прочитать структуру JSON", slides: [
      theory("json.load() читает JSON из открытого файла. Объект JSON становится словарём Python, а числа сохраняют числовой тип."),
      exercise({
        text: "Загрузи journal.json в record. Выведи зону zone и число коробок count в двух отдельных строках.",
        starter: 'import json\nwith open("journal.json", encoding="utf-8") as source:\n',
        cases: [
          { files: { "journal.json": '{"zone": "A", "count": 5}' }, expected: { record: { zone: "A", count: 5 } }, output: ["A", "5"] },
          { files: { "journal.json": '{"count": 0, "zone": "C"}' }, expected: { record: { zone: "C", count: 0 } }, output: ["C", "0"] },
        ],
        hint: 'Сохрани json.load(source) в record. Используй ключи "zone" и "count".',
        solution: 'import json\nwith open("journal.json", encoding="utf-8") as source:\n    record = json.load(source)\nprint(record["zone"])\nprint(record["count"])',
      }),
    ] },
    { title: "Журнал между запусками", group: "project", slides: [
      exercise({
        text: "Напиши save_journal(zone, count). Функция записывает переданные данные в journal.json. Создай словарь с ключами zone и count в таком порядке и передай его в json.dump() без параметров форматирования.",
        starter: 'import json\n\ndef save_journal(zone, count):\n    with open("journal.json", "w", encoding="utf-8") as target:\n',
        cases: [
          { call: { name: "save_journal", args: ["A", 6] }, expectedFiles: { "journal.json": '{"zone": "A", "count": 6}' } },
          { call: { name: "save_journal", args: ["C", 0] }, expectedFiles: { "journal.json": '{"zone": "C", "count": 0}' } },
        ],
        hint: 'Подготовь {"zone": zone, "count": count} и передай словарь и target в json.dump().',
        solution: 'import json\n\ndef save_journal(zone, count):\n    with open("journal.json", "w", encoding="utf-8") as target:\n        json.dump({"zone": zone, "count": count}, target)',
      }),
      exercise({
        text: "Добавь восстановление записи. Напиши load_journal(), которая возвращает данные из существующего journal.json. Вызови её, запиши число коробок в restored_count и выведи строку «Зона X: Y». Оставь функцию save_journal для записи новых данных.",
        starter: 'import json\n\ndef save_journal(zone, count):\n    with open("journal.json", "w", encoding="utf-8") as target:\n        json.dump({"zone": zone, "count": count}, target)\n',
        continueCode: true,
        cases: [
          { files: { "journal.json": '{"zone": "A", "count": 6}' }, expected: { restored_count: 6 }, output: ["Зона A: 6"], call: { name: "save_journal", args: ["B", 3] }, expectedFiles: { "journal.json": '{"zone": "B", "count": 3}' } },
          { files: { "journal.json": '{"zone": "C", "count": 0}' }, expected: { restored_count: 0 }, output: ["Зона C: 0"], call: { name: "save_journal", args: ["D", 9] }, expectedFiles: { "journal.json": '{"zone": "D", "count": 9}' } },
        ],
        hint: "Внутри load_journal верни json.load(source). После вызова достань значения по ключам словаря и собери f-строку.",
        solution: 'import json\n\ndef save_journal(zone, count):\n    with open("journal.json", "w", encoding="utf-8") as target:\n        json.dump({"zone": zone, "count": count}, target)\n\ndef load_journal():\n    with open("journal.json", encoding="utf-8") as source:\n        return json.load(source)\n\nrecord = load_journal()\nrestored_count = record["count"]\nprint(f\'Зона {record["zone"]}: {restored_count}\')',
      }),
    ] },
  ],
};

export const coreChapters = [strings, collections, functions, errors, files];
