import { theory, quiz, exercise } from "./course-authoring.mjs";
import { cargoDesktopSuffix, telegramBotSuffix } from "./course-desktop.mjs";

const call = (name, args, result, type) => ({ call: { name, args, result, type }, showReturn: true });
const loadError = "Введите количество и вес числами.";
const rangeError = "Количество должно быть от 0 до 1000, вес — больше 0 и до 1000 кг.";

const parseLoad = "def read_load(boxes, weight):\n    return [int(boxes), float(weight)]";
const formatLoad = "def load_label(boxes, weight):\n    total = boxes * weight\n    return f\"Общий вес: {total:.2f} кг\"";
const layoutRows = 'def layout_rows(start):\n    return {"boxes": start, "weight": start + 1, "calculate": start + 2, "message": start + 3}';
const cargoHelpers = parseLoad + "\n\n" + formatLoad + "\n\n" + layoutRows;
const cargoPartial = cargoHelpers + "\n\ndef cargo_report(boxes, weight):\n    count, kilos = read_load(boxes, weight)\n    return load_label(count, kilos)";
const cargoReport = cargoHelpers +
  '\n\ndef cargo_report(boxes, weight):\n    try:\n        count, kilos = read_load(boxes, weight)\n    except ValueError:\n        return "' + loadError +
  '"\n    if not (0 <= count <= 1000 and 0 < kilos <= 1000):\n        return "' + rangeError +
  '"\n    return load_label(count, kilos)';

const gui = {
  id: "gui",
  title: "Графический интерфейс",
  stages: [
    { title: "Что приходит из поля", slides: [
      theory("Поле окна отдаёт текст. До расчёта преобразуй количество в целое число, а вес — в дробное. Сначала проверим это на значениях, которые могли прийти из двух полей.", 'boxes = "3"\nweight = "1.5"\nprint(int(boxes) * float(weight))'),
      quiz('Почему нельзя сразу перемножить "3" и "1.5"?', "", "Оба значения — строки", ["Вес меньше двух", "Нужен знак +"], "Поле хранит текст. Преобразования дают два числа, которые можно умножить."),
      exercise({
        text: "Напиши read_load(boxes, weight). Функция получает два текста и возвращает список [целое количество, дробный вес].",
        starter: "def read_load(boxes, weight):\n    return []",
        cases: [call("read_load", ["3", "1.5"], [3, 1.5]), call("read_load", [" 8 ", "2.25"], [8, 2.25]), call("read_load", ["0", "0.5"], [0, 0.5])],
        hint: "Помести в список результаты int(boxes) и float(weight).",
        solution: parseLoad,
      }),
    ] },
    { title: "Подпись для результата", slides: [
      theory("Кнопка «Рассчитать» будет передавать числа в функцию. Функция возвращает текст для экрана. Чтобы показать два знака после точки, используй в f-строке формат :.2f.", 'total = 4.5\nprint(f"Вес: {total:.2f} кг")'),
      exercise({
        text: "Напиши load_label(boxes, weight) для уже преобразованных чисел. Умножь количество на вес и верни строку «Общий вес: 4.50 кг», где число зависит от аргументов.",
        starter: "def load_label(boxes, weight):\n    return \"\"",
        cases: [call("load_label", [3, 1.5], "Общий вес: 4.50 кг"), call("load_label", [8, 2.25], "Общий вес: 18.00 кг"), call("load_label", [0, 0.5], "Общий вес: 0.00 кг")],
        hint: "Сначала total = boxes * weight, затем верни f-строку с {total:.2f}.",
        solution: formatLoad,
      }),
    ] },
    { title: "Нажатие кнопки", slides: [
      theory("В Tkinter параметр command получает саму функцию. Скобки нужны при вызове, а кнопка вызовет обработчик при нажатии. Ниже имитируем нажатие обычным вызовом.", 'def clicked():\n    return "Готово"\n\nhandler = clicked\nprint(handler())'),
      quiz("Как передать обработчик кнопке, чтобы он сработал при нажатии?", "", "command=clicked", ["command=clicked()", 'command="clicked"'], "Без скобок мы передаём функцию. Кнопка вызовет её сама."),
      exercise({
        text: "Исправь run_button(handler). Он должен вызвать handler один раз и вернуть результат. Две проверки передадут два разных обработчика.",
        starter: 'def run_button(handler):\n    return handler\n\ndef ready():\n    return "Готово"\n\ndef busy():\n    return "Пульт занят"\n\nfirst = run_button(ready)\nsecond = run_button(busy)',
        cases: [{ expected: { first: "Готово", second: "Пульт занят" } }],
        hint: "handler — функция. Чтобы получить её результат, добавь к имени круглые скобки.",
        solution: 'def run_button(handler):\n    return handler()\n\ndef ready():\n    return "Готово"\n\ndef busy():\n    return "Пульт занят"\n\nfirst = run_button(ready)\nsecond = run_button(busy)',
      }),
    ] },
    { title: "Раскладка полей", slides: [
      theory("В Tkinter grid размещает элементы по строкам и столбцам. В учебном файле название поля и само поле стоят на одной строке, каждое в своём столбце. Номера строк берём из словаря.", 'rows = {"field": 0, "calculate": 1}\nprint(rows["calculate"])'),
      exercise({
        text: "Напиши layout_rows(start). Верни словарь с четырьмя последовательными строками начиная со start. Ключи по порядку: boxes, weight, calculate, message.",
        starter: "def layout_rows(start):\n    return {}",
        cases: [
          call("layout_rows", [0], { boxes: 0, weight: 1, calculate: 2, message: 3 }),
          call("layout_rows", [3], { boxes: 3, weight: 4, calculate: 5, message: 6 }),
        ],
        hint: "Возьми число start для boxes и прибавляй по единице для каждого следующего элемента.",
        solution: layoutRows,
      }),
    ] },
    { title: "Пульт груза", group: "project",
      download: {
        filename: "cargo-console.py", suffix: cargoDesktopSuffix, label: "Скачать окно Tkinter", runLabel: "Проверить расчёт",
        previewLabels: ["Количество коробок", "Вес коробки, кг"],
        instructions: "В браузере выполняется расчёт для примера. Скачай cargo-console.py и запусти его командой python cargo-console.py на компьютере с Tkinter.",
      },
      slides: [
        theory("Соберём обработчик для окна. Он принимает текст из двух полей, проверяет его и возвращает одну строку. В настольном приложении Python эта строка появится под кнопкой. После задания можно скачать готовый .py."),
        exercise({
          text: "Добавь cargo_report(boxes, weight). На этом шаге используй read_load и load_label для правильно введённых чисел.",
          starter: cargoHelpers + '\n\ndef cargo_report(boxes, weight):\n    return ""',
          cases: [call("cargo_report", ["3", "1.5"], "Общий вес: 4.50 кг"), call("cargo_report", ["6", "0.25"], "Общий вес: 1.50 кг")],
          hint: "Распакуй результат read_load в count, kilos. Верни load_label(count, kilos).",
          solution: cargoPartial,
        }),
        exercise({
          text: 'Дополни обработчик. Если числа прочитать нельзя, верни фразу «' + loadError + '» Количество допустимо от 0 до 1000, вес — больше 0 и до 1000 кг. Вне диапазона верни фразу «' + rangeError + '»',
          continueCode: true,
          starter: cargoPartial,
          cases: [
            call("cargo_report", ["3", "1.5"], "Общий вес: 4.50 кг"),
            call("cargo_report", ["0", "9"], "Общий вес: 0.00 кг"),
            call("cargo_report", ["1000", "1000"], "Общий вес: 1000000.00 кг"),
            call("cargo_report", ["", "1.5"], loadError),
            call("cargo_report", ["3", "много"], loadError),
            call("cargo_report", ["-1", "1.5"], rangeError),
            call("cargo_report", ["1001", "1.5"], rangeError),
            call("cargo_report", ["2", "0"], rangeError),
            call("cargo_report", ["2", "nan"], rangeError),
            call("layout_rows", [0], { boxes: 0, weight: 1, calculate: 2, message: 3 }),
          ],
          hint: "Перехвати ValueError от read_load. Затем проверь диапазоны до вызова load_label.",
          solution: cargoReport,
        }),
      ],
    },
  ],
};

const basicBay = "class CargoBay:\n    def __init__(self, name, units):\n        self.name = name\n        self.units = units";
const countingBay = basicBay + "\n\n    def receive(self, units):\n        self.units += units";
const reportingBay = countingBay + '\n\n    def label(self):\n        return f"{self.name}: {self.units}"';
const wholeStation = reportingBay + "\n\n\ndef stock_report(first, second, added):\n    left = CargoBay(first[0], first[1])\n    right = CargoBay(second[0], second[1])\n    left.receive(added)\n    return [left.label(), right.label()]";

const objects = {
  id: "objects",
  title: "Классы и объекты",
  stages: [
    { title: "У каждого отсека своё состояние", slides: [
      theory("Класс описывает, какие данные и действия есть у отсека. При создании конкретного отсека Python вызывает __init__. Имя self помогает записать значения именно в этот объект.", basicBay + '\n\nleft = CargoBay("Док", 3)\nprint(left.name)'),
      quiz("Что хранит self.units после CargoBay('Док', 3)?", "", "3", ["Все запасы станции", "Имя отсека"], "self.units — количество только для этого отсека."),
      exercise({
        text: "Дополни CargoBay. Сохрани name и units в атрибутах объекта. Создай bay с данными из переменных bay_name и initial_units и выведи его имя и запас на отдельных строках.",
        starter: "class CargoBay:\n    def __init__(self, name, units):\n        self.name = name\n\nbay = CargoBay(bay_name, initial_units)",
        cases: [
          { initial: { bay_name: "Док", initial_units: 3 }, types: { bay: "CargoBay" }, output: ["Док", "3"] },
          { initial: { bay_name: "Сад", initial_units: 0 }, types: { bay: "CargoBay" }, output: ["Сад", "0"] },
        ],
        hint: "Добавь self.units = units. Для вывода используй bay.name и bay.units.",
        solution: basicBay + "\n\nbay = CargoBay(bay_name, initial_units)\nprint(bay.name)\nprint(bay.units)",
      }),
    ] },
    { title: "Действие с одним объектом", slides: [
      theory("Метод — функция, связанная с объектом. В вызове bay.receive(2) Python сам передаст bay как self. Меняем self.units тем же присваиванием, которое знакомо по переменным.", countingBay),
      exercise({
        text: "Добавь CargoBay метод receive(units), который увеличивает запас этого отсека. Создай два отсека с указанными запасами. Поставку added получит только left. Выведи запасы left и right по порядку.",
        starter: basicBay + '\n\nleft = CargoBay("Левый", left_units)\nright = CargoBay("Правый", right_units)',
        cases: [
          { initial: { left_units: 5, right_units: 2, added: 4 }, types: { left: "CargoBay", right: "CargoBay" }, output: ["9", "2"] },
          { initial: { left_units: 0, right_units: 7, added: 3 }, types: { left: "CargoBay", right: "CargoBay" }, output: ["3", "7"] },
        ],
        hint: "В методе используй self.units += units. После создания объектов вызови receive только у left.",
        solution: countingBay + '\n\nleft = CargoBay("Левый", left_units)\nright = CargoBay("Правый", right_units)\nleft.receive(added)\nprint(left.units)\nprint(right.units)',
      }),
    ] },
    { title: "Отчёт об объекте", slides: [
      quiz("Какой вызов возвращает подпись объекта bay?", "", "bay.label()", ["bay.label", "label()"], "Скобки вызывают метод label у конкретного объекта."),
      exercise({
        text: "Реализуй метод label. Он возвращает строку из имени отсека, двоеточия, пробела и запаса. Выведи результат для bay.",
        starter: basicBay + "\n\nbay = CargoBay(bay_name, initial_units)",
        cases: [
          { initial: { bay_name: "Док", initial_units: 11 }, types: { bay: "CargoBay" }, output: ["Док: 11"] },
          { initial: { bay_name: "Сад", initial_units: 2 }, types: { bay: "CargoBay" }, output: ["Сад: 2"] },
        ],
        hint: 'В методе используй return f"{self.name}: {self.units}".',
        solution: reportingBay + "\n\nbay = CargoBay(bay_name, initial_units)\nprint(bay.label())",
      }),
    ] },
    { title: "Два отсека станции", group: "project", slides: [
      theory("Один класс помогает работать с любым числом отсеков. Функция соберёт два объекта из записей с именем и количеством, а затем вернёт список подписей."),
      exercise({
        text: "Напиши stock_report(first, second, added). На первом шаге верни две подписи без поставки. first и second — списки вида [имя, запас].",
        starter: reportingBay + "\n\n\ndef stock_report(first, second, added):\n    return []",
        cases: [
          call("stock_report", [["Док", 3], ["Сад", 4], 0], ["Док: 3", "Сад: 4"]),
          call("stock_report", [["А", 0], ["Б", 12], 0], ["А: 0", "Б: 12"]),
        ],
        hint: "Создай CargoBay(first[0], first[1]) и такой же объект из second. Верни список результатов label().",
        solution: reportingBay + "\n\n\ndef stock_report(first, second, added):\n    left = CargoBay(first[0], first[1])\n    right = CargoBay(second[0], second[1])\n    return [left.label(), right.label()]",
      }),
      exercise({
        text: "Учитывай поставку added только в первом отсеке. Верни две обновлённые подписи. Тренажёр покажет результат пробного вызова.",
        continueCode: true,
        starter: reportingBay + "\n\n\ndef stock_report(first, second, added):\n    left = CargoBay(first[0], first[1])\n    right = CargoBay(second[0], second[1])\n    return [left.label(), right.label()]",
        cases: [
          call("stock_report", [["Док", 3], ["Сад", 4], 2], ["Док: 5", "Сад: 4"]),
          call("stock_report", [["А", 0], ["Б", 12], 5], ["А: 5", "Б: 12"]),
          call("stock_report", [["Склад", 9], ["Лифт", 0], 0], ["Склад: 9", "Лифт: 0"]),
        ],
        hint: "Перед return вызови left.receive(added). Второй отсек только читает своё состояние.",
        solution: wholeStation,
      }),
    ] },
  ],
};

const schema = 'import sqlite3\n\ndb = sqlite3.connect(":memory:")\ndb.execute("CREATE TABLE cargo (id INTEGER PRIMARY KEY, bay TEXT, kilos REAL)")';
const insertCargo = 'db.execute("INSERT INTO cargo (bay, kilos) VALUES (?, ?)", (bay, kilos))';
const seedCargo = schema + '\ndb.executemany("INSERT INTO cargo (bay, kilos) VALUES (?, ?)", rows)';
const journalSetup = 'import sqlite3\n\n\ndef journal(rows, wanted):\n    db = sqlite3.connect(":memory:")\n    try:\n        db.execute("CREATE TABLE cargo (id INTEGER PRIMARY KEY, bay TEXT, kilos REAL)")\n        db.executemany("INSERT INTO cargo (bay, kilos) VALUES (?, ?)", rows)\n';
const closeJournal = "\n    finally:\n        db.close()";
const journalCount = journalSetup + '        return db.execute("SELECT COUNT(*) FROM cargo WHERE bay = ?", (wanted,)).fetchone()[0]' + closeJournal;
const cargoJournal = journalSetup +
  '        weights = db.execute("SELECT kilos FROM cargo WHERE bay = ? ORDER BY id", (wanted,)).fetchall()\n' +
  "        return [len(weights), sum(weight for (weight,) in weights)]" + closeJournal;

const database = {
  id: "sqlite",
  title: "Базы данных SQLite",
  stages: [
    { title: "Таблица журнала", slides: [
      theory("Таблица описывает столбцы всех записей. Первичный ключ id отличает строки друг от друга. SQLite может хранить учебную базу в памяти одного запуска.", schema),
      quiz("Зачем таблице столбец id?", "", "Чтобы однозначно отличать записи", ["Чтобы вес стал целым", "Чтобы закрыть соединение"], "Первичный ключ помогает обратиться к одной записи, даже если остальные её данные совпадают с другой."),
      exercise({
        text: "Создай таблицу cargo со столбцами id INTEGER PRIMARY KEY, bay TEXT и kilos REAL. Запиши число строк в row_count. Оно начинается с нуля.",
        starter: 'import sqlite3\n\ndb = sqlite3.connect(":memory:")',
        cases: [{ expected: { row_count: 0 }, types: { db: "Connection", row_count: "int" } }],
        hint: 'После CREATE TABLE вызови db.execute("SELECT COUNT(*) FROM cargo").fetchone()[0].',
        solution: schema + '\nrow_count = db.execute("SELECT COUNT(*) FROM cargo").fetchone()[0]',
      }),
    ] },
    { title: "Добавление записи", slides: [
      theory("Места для данных в запросе обозначаем знаком ?. Значения передаём отдельным кортежем. Тогда апостроф внутри имени отсека остаётся обычной частью имени.", schema + "\n" + insertCargo + '\nprint(db.execute("SELECT bay FROM cargo").fetchone()[0])\ndb.close()', { initial: { bay: "Отсек '7'", kilos: 2 } }),
      exercise({
        text: "Добавь запись в cargo через параметризованный запрос. Затем прочитай из таблицы название и вес записанного груза в saved.",
        starter: schema,
        cases: [
          { initial: { bay: "Док", kilos: 4.5 }, expected: { saved: ["Док", 4.5] } },
          { initial: { bay: "Отсек «А'2»", kilos: 18.25 }, expected: { saved: ["Отсек «А'2»", 18.25] } },
        ],
        hint: 'Вставь (bay, kilos) через VALUES (?, ?), затем прочитай db.execute("SELECT bay, kilos FROM cargo").fetchone().',
        solution: schema + "\n" + insertCargo + '\nsaved = db.execute("SELECT bay, kilos FROM cargo").fetchone()',
      }),
    ] },
    { title: "Поиск по отсеку", slides: [
      theory("WHERE оставляет строки, которые подходят под условие. Если параметр один, запятая создаёт кортеж из одного значения: (wanted,).", seedCargo + '\nfound = db.execute("SELECT kilos FROM cargo WHERE bay = ? ORDER BY id", (wanted,)).fetchall()\nprint(found)\ndb.close()', { initial: { rows: [["Док", 5], ["Лифт", 3]], wanted: "Лифт" } }),
      exercise({
        text: "Запиши в found список весов для отсека wanted. Сохрани порядок поступления грузов. Заготовка уже добавляет строки с помощью executemany.",
        starter: seedCargo + "\n",
        cases: [
          { initial: { rows: [["Док", 4.5], ["Сад", 2], ["Док", 3]], wanted: "Док" }, expected: { found: [4.5, 3] } },
          { initial: { rows: [["А", 8], ["Б", 7]], wanted: "Б" }, expected: { found: [7] } },
          { initial: { rows: [["А", 8]], wanted: "Б" }, expected: { found: [] } },
        ],
        hint: "Получится список кортежей из одного элемента. Возьми первый элемент каждой строки.",
        solution: seedCargo + '\nresults = db.execute("SELECT kilos FROM cargo WHERE bay = ? ORDER BY id", (wanted,)).fetchall()\nfound = [row[0] for row in results]',
      }),
    ] },
    { title: "Файл журнала", slides: [
      theory("Чтобы данные пережили закрытие соединения, передай connect имя файла и заверши запись вызовом commit(). Когда откроешь тот же файл, в нём останутся добавленные строки.", 'import sqlite3\n\ndb = sqlite3.connect("cargo.db")\ndb.execute("CREATE TABLE cargo (bay TEXT)")\ndb.execute("INSERT INTO cargo VALUES (?)", ("Док",))\ndb.commit()\ndb.close()'),
      exercise({
        text: "Дополни remember_load(filename, kilos). Создай таблицу loads, если её ещё нет. Вставь новый вес. Зафиксируй изменения, закрой соединение, заново открой файл и верни записанный вес.",
        starter: 'import sqlite3\n\n\ndef remember_load(filename, kilos):\n    db = sqlite3.connect(filename)\n    db.execute("CREATE TABLE IF NOT EXISTS loads (kilos REAL)")\n    db.execute("INSERT INTO loads VALUES (?)", (kilos,))\n    db.close()',
        cases: [
          call("remember_load", ["dock.db", 3.5], 3.5),
          call("remember_load", ["garden.db", 7.25], 7.25),
        ],
        hint: "Вызови commit() перед первым close(). После открытия получи вес через SELECT kilos FROM loads и закрой новое соединение.",
        solution: 'import sqlite3\n\n\ndef remember_load(filename, kilos):\n    db = sqlite3.connect(filename)\n    db.execute("CREATE TABLE IF NOT EXISTS loads (kilos REAL)")\n    db.execute("INSERT INTO loads VALUES (?)", (kilos,))\n    db.commit()\n    db.close()\n    db = sqlite3.connect(filename)\n    row = db.execute("SELECT kilos FROM loads ORDER BY rowid DESC").fetchone()\n    db.close()\n    return row[0]',
      }),
    ] },
    { title: "Журнал груза", group: "project", slides: [
      theory("Оформим запись и поиск как одну функцию journal. Она создаёт учебную базу, загружает строки, ищет груз по отсеку и возвращает итог. finally закрывает соединение даже при ошибке."),
      exercise({
        text: "Дополни journal(rows, wanted). Сначала верни количество подходящих строк. Используй подготовленную базу и условие WHERE с параметром wanted.",
        starter: journalSetup + "        return 0" + closeJournal,
        cases: [
          call("journal", [[["Док", 5], ["Сад", 8], ["Док", 2]], "Док"], 2, "int"),
          call("journal", [[["А", 5], ["Б", 8]], "Б"], 1, "int"),
          call("journal", [[["А", 5]], "Б"], 0, "int"),
        ],
        hint: "В запросе SELECT COUNT(*) FROM cargo WHERE bay = ? передай (wanted,). Получи значение из fetchone()[0].",
        solution: journalCount,
      }),
      exercise({
        text: "Расширь journal. Верни список [количество строк, сумма весов] для отсека wanted. Если записей нет, ожидается [0, 0].",
        continueCode: true,
        starter: journalCount,
        cases: [
          call("journal", [[["Док", 5], ["Сад", 8], ["Док", 2.5]], "Док"], [2, 7.5]),
          call("journal", [[["А", 5], ["Б", 8]], "Б"], [1, 8]),
          call("journal", [[["А", 5]], "Б"], [0, 0]),
          call("journal", [[["Отсек '7'", 0.5], ["Док", 2]], "Отсек '7'"], [1, 0.5]),
        ],
        hint: "Выбери веса с условием WHERE. Посчитай количество через len, а сумму — через sum от значений из строк.",
        solution: cargoJournal,
      }),
    ] },
  ],
};

const statusLabel = 'def status_label(status):\n    if 200 <= status < 300:\n        return "Получено"\n    if status == 429:\n        return "Подождите перед повтором"\n    return "Ответ с ошибкой"';
const unpackResponse = 'import json\n\n\ndef read_manifest(status, body):\n    if status != 200:\n        return "Сервис недоступен"\n    data = json.loads(body)\n    return data["bay"] + ": " + str(data["boxes"])';
const commandName = 'def command_name(text):\n    parts = text.strip().split()\n    if not parts:\n        return ""\n    return parts[0].lower()';
const chooseReply = commandName + '\n\n\ndef reply_to(text):\n    command = command_name(text)\n    if command == "/start":\n        return "Введите /weight количество вес"\n    return "Команда не найдена"';
const fullBot = commandName +
  '\n\n\ndef reply_to(text):\n    command = command_name(text)\n    if command == "/start":\n        return "Введите /weight количество вес"\n' +
  '    if command != "/weight":\n        return "Команда не найдена"\n    parts = text.split()\n    if len(parts) != 3:\n        return "Пример: /weight 4 1.5"\n' +
  '    try:\n        boxes = int(parts[1])\n        weight = float(parts[2])\n    except ValueError:\n        return "Пример: /weight 4 1.5"\n' +
  '    if not (0 <= boxes <= 1000 and 0 < weight <= 1000):\n        return "Проверьте диапазон чисел"\n    return f"Общий вес: {boxes * weight:.2f} кг"';

const http = {
  id: "http-bots",
  title: "HTTP, API и боты",
  stages: [
    { title: "Запрос и ответ", slides: [
      theory("Клиент отправляет запрос. Сервер отвечает кодом состояния и может добавить данные. Коды 2xx означают успех. Код 429 сообщает, что запросов слишком много. На этом этапе используем учебные ответы, которые уже есть в программе.", 'response = {"status": 200, "body": "{\\"bay\\": \\"Док\\"}"}\nprint(response["status"])'),
      quiz("Что означает код 429?", "", "Слишком много запросов", ["Ответ успешно получен", "Сервер вернул пустую строку"], "Дай сервису время перед следующим запросом."),
      exercise({
        text: "Напиши status_label(status). Для кодов от 200 до 299 верни «Получено», для 429 — «Подождите перед повтором», для остальных — «Ответ с ошибкой».",
        starter: "def status_label(status):\n    return \"\"",
        cases: [call("status_label", [200], "Получено"), call("status_label", [204], "Получено"), call("status_label", [299], "Получено"), call("status_label", [300], "Ответ с ошибкой"), call("status_label", [429], "Подождите перед повтором"), call("status_label", [503], "Ответ с ошибкой")],
        hint: "Проверь диапазон успеха, затем отдельно 429.",
        solution: statusLabel,
      }),
    ] },
    { title: "Параметры запроса", slides: [
      theory("Метод GET запрашивает данные. Путь указывает ресурс, параметры уточняют запрос. Для упражнения соберём описание запроса в словаре и посмотрим, какие данные он должен попросить.", 'request = {"method": "GET", "path": "/manifest", "params": {"bay": "Док"}}\nprint(request["params"]["bay"])'),
      exercise({
        text: "Напиши manifest_request(bay). Верни словарь описания запроса. Ключи method и path должны содержать GET и /manifest. В словаре params ключ bay берёт значение из аргумента.",
        starter: "def manifest_request(bay):\n    return {}",
        cases: [
          call("manifest_request", ["Док"], { method: "GET", path: "/manifest", params: { bay: "Док" } }),
          call("manifest_request", ["Отсек 2"], { method: "GET", path: "/manifest", params: { bay: "Отсек 2" } }),
        ],
        hint: "Словарь с bay помести внутрь значения по ключу params.",
        solution: 'def manifest_request(bay):\n    return {"method": "GET", "path": "/manifest", "params": {"bay": bay}}',
      }),
    ] },
    { title: "JSON со склада", slides: [
      theory("JSON по сети приходит текстом. json.loads превращает этот текст в структуры Python. В нашем примере объект JSON станет словарём.", 'import json\n\ndata = json.loads(\'{"bay": "Док", "boxes": 5}\')\nprint(data["boxes"])'),
      exercise({
        text: "Напиши read_manifest(status, body). При коде 200 прочитай JSON и верни текст вида «Док: 5» из полей bay и boxes. При любом другом коде верни «Сервис недоступен».",
        starter: "import json\n\n\ndef read_manifest(status, body):\n    return \"\"",
        cases: [
          call("read_manifest", [200, '{"bay": "Док", "boxes": 5}'], "Док: 5"),
          call("read_manifest", [200, '{"bay": "Сад", "boxes": 0}'], "Сад: 0"),
          call("read_manifest", [503, "страница ошибки"], "Сервис недоступен"),
          call("read_manifest", [429, ""], "Сервис недоступен"),
        ],
        hint: "Сначала проверь код ответа. В случае успеха вызови json.loads и прочитай оба поля словаря.",
        solution: unpackResponse,
      }),
    ] },
    { title: "Команда и аргументы", slides: [
      theory("У бота команда стоит первой. split разбивает сообщение по пробелам. Остальные части можно разобрать как аргументы команды.", 'parts = "/weight 4 1.5".split()\nprint(parts[0])\nprint(parts[1:])'),
      exercise({
        text: "Напиши command_name(text). Верни первое слово строчными буквами. Для пустого сообщения или одних пробелов верни пустую строку.",
        starter: 'def command_name(text):\n    return ""',
        cases: [
          call("command_name", [" /WEIGHT 4 1.5"], "/weight"),
          call("command_name", ["/start"], "/start"),
          call("command_name", ["   "], ""),
          call("command_name", ["Статус станции"], "статус"),
        ],
        hint: "После split проверь, что список не пустой. Иначе у него нет элемента с индексом 0.",
        solution: commandName,
      }),
    ] },
    { title: "Сообщение от Telegram", slides: [
      theory("Telegram передаёт событие в виде вложенных полей. В учебных примерах обычное текстовое сообщение лежит в message → text. Бывают события без сообщения и сообщения без текста. Для них вернём пустую строку.", 'update = {"update_id": 15, "message": {"chat": {"id": 101}, "text": "/start"}}\nprint(update["message"]["text"])'),
      exercise({
        text: "Напиши read_message(update). Верни текст из message, если он есть, иначе пустую строку. Все проверки используют локальные учебные события.",
        starter: 'def read_message(update):\n    return ""',
        cases: [
          call("read_message", [{ update_id: 15, message: { chat: { id: 101 }, text: "/start" } }], "/start"),
          call("read_message", [{ update_id: 16, message: { chat: { id: 101 }, text: "/weight 3 2" } }], "/weight 3 2"),
          call("read_message", [{ update_id: 17, message: { chat: { id: 101 } } }], ""),
          call("read_message", [{ update_id: 18 }], ""),
        ],
        hint: 'Возьми message с запасным словарём {} через get, затем text с запасной строкой "".',
        solution: 'def read_message(update):\n    message = update.get("message", {})\n    return message.get("text", "")',
      }),
    ] },
    { title: "Бот грузового отсека", group: "project",
      download: {
        filename: "cargo-bot.py", suffix: telegramBotSuffix, label: "Скачать бота для Python", runLabel: "Проверить ответ",
        previewLabels: ["Сообщение боту"],
        instructions: "В браузере проверяется ответ на пример команды. Для своего бота скачай cargo-bot.py, задай на компьютере TERAMONT_LEARNING_BOT_TOKEN и запусти python cargo-bot.py.",
      },
      slides: [
        theory("В Mini App проверяем ответы бота на учебных входах. Настольный .py можно запустить с токеном своего бота в переменной TERAMONT_LEARNING_BOT_TOKEN. Он будет отвечать в личном чате после запуска."),
        exercise({
          text: "Напиши reply_to(text). На /start верни «Введите /weight количество вес», на всё остальное — «Команда не найдена». Используй command_name из заготовки.",
          starter: commandName + '\n\n\ndef reply_to(text):\n    return ""',
          cases: [
            call("reply_to", ["/start"], "Введите /weight количество вес"),
            call("reply_to", [" /START "], "Введите /weight количество вес"),
            call("reply_to", ["/hello"], "Команда не найдена"),
          ],
          hint: "Посмотри на результат command_name(text), чтобы обработать регистр и пробелы.",
          solution: chooseReply,
        }),
        exercise({
          text: 'Добавь команду /weight количество вес. При неверном числе аргументов или преобразовании с ошибкой верни «Пример: /weight 4 1.5». Допустимо от 0 до 1000 коробок и вес больше 0, но не выше 1000 кг. Вне диапазона верни «Проверьте диапазон чисел». При успехе верни текст «Общий вес: 6.00 кг» с рассчитанным числом.',
          continueCode: true,
          starter: chooseReply,
          cases: [
            call("reply_to", ["/weight 4 1.5"], "Общий вес: 6.00 кг"),
            call("reply_to", ["  /WEIGHT 3 2.25 "], "Общий вес: 6.75 кг"),
            call("reply_to", ["/weight 0 0.5"], "Общий вес: 0.00 кг"),
            call("reply_to", ["/weight 4"], "Пример: /weight 4 1.5"),
            call("reply_to", ["/weight 4 нет"], "Пример: /weight 4 1.5"),
            call("reply_to", ["/weight -3 2"], "Проверьте диапазон чисел"),
            call("reply_to", ["/weight 2 nan"], "Проверьте диапазон чисел"),
            call("reply_to", ["/start"], "Введите /weight количество вес"),
            call("reply_to", ["не команда"], "Команда не найдена"),
          ],
          hint: "Разбей строку через split(). Прочитай два числа внутри try, проверь диапазоны и верни f-строку с весом до двух знаков.",
          solution: fullBot,
        }),
      ],
    },
  ],
};

export const appliedChapters = [gui, objects, database, http];
