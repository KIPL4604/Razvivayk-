import { runPython } from "./console.mjs?v=1";

export const lessons = [
  {
    name: "Выйти на связь",
    system: "Связь",
    explanation: "Команда print() выводит то, что стоит внутри скобок. Текст пишем в кавычках. В консоли появятся только слова из кавычек.",
    example: 'print("На связи")',
    task: "Отправь сообщение «Готов к запуску». Вставь текст в скобки.",
    before: "print(", after: ")",
    hints: ["Сообщение должно стоять внутри скобок.", "Возьми весь текст в прямые кавычки — одинарные или двойные."],
    success: "Связь восстановлена. Робот получил твоё сообщение.",
  },
  {
    name: "Записать заряд",
    system: "Питание",
    explanation: "У числа на приборе есть подпись. Дадим числу имя energy. Такое имя называется переменной. Знак = связывает имя слева со значением справа.",
    example: "energy = 12",
    task: "Робот получил батарею на 9 единиц. Сохрани это число.",
    before: "energy = ",
    hints: ["Справа от знака = записывается значение.", "Целое число пишется без кавычек."],
    success: "Батарея подключена. В energy хранится число 9.",
  },
  {
    name: "Показать заряд",
    system: "Датчик",
    explanation: "Если в скобках стоит имя переменной, Python выводит её значение. Кавычки вокруг имени превращают его в обычный текст.",
    example: 'energy = 9\nprint(energy)\nprint("energy")',
    task: "Датчик показывает 11. Выбери команду, которая прочитает заряд из переменной.",
    prefix: "energy = 11",
    choices: ['print("energy")', "print(energy)", 'print("11")'],
    hints: ["Если заряд завтра станет 7, команда должна показать новое число.", "Имя energy внутри print() пишется без кавычек."],
    success: "Датчик работает. Консоль показывает текущее значение energy.",
  },
  {
    name: "Посчитать расход",
    system: "Шлюз",
    explanation: "Было 12 единиц, на дорогу уйдёт 4, останется 8. Python сначала вычисляет то, что в скобках, и только потом показывает результат.",
    example: "energy = 12\nprint(energy - 4)",
    task: "Стартовый заряд — 15. Поездка стоит 6 единиц. Посчитай остаток через energy.",
    prefix: "energy = 15",
    before: "print(", after: ")",
    hints: ["Расход уменьшает заряд. Используй вычитание.", "Поставь energy слева от минуса, а расход — справа."],
    success: "Шлюз открыт. После поездки у робота останется 9 единиц.",
  },
  {
    name: "Обновить заряд",
    system: "Маршрут",
    explanation: "В строке energy = energy - 4 Python сначала считает правую часть. Затем сохраняет новое значение под тем же именем energy.",
    example: "energy = 12\nenergy = energy - 4\nprint(energy)",
    task: "Добавь строки в нужном порядке. Было 10 единиц, робот потратил 3. Сохрани остаток и выведи его.",
    fragments: ["print(energy)", "energy = energy - 3", "energy = 10"],
    hints: ["Сначала задай начальное значение.", "Вычитание идёт перед print(energy), иначе увидишь старый заряд."],
    success: "Робот сохранил новый заряд. Следующая команда прочитает 7.",
  },
  {
    name: "Поездка к маяку",
    system: "Маяк",
    mission: true,
    explanation: "Робот должен доехать до маяка и вернуться. Станция загрузила стартовый заряд и стоимость обеих поездок.",
    task: "Обнови energy с учётом обоих расходов и один раз выведи итоговый заряд.",
    prefix: "energy = 18\noutbound_cost = 5\nreturn_cost = 4",
    hints: ["Вычти оба расхода. Сохрани результат в energy.", "Можно обновить energy дважды: сначала вычесть outbound_cost, затем return_cost. После этого выведи energy."],
    success: "Маяк запущен. Робот вернулся с зарядом 9.",
  },
];

export function lessonSource(index, answer) {
  const lesson = lessons[index];
  if (lesson.choices) return lesson.choices[answer] ?? "";
  if (lesson.fragments) return answer.map(part => lesson.fragments[part]).join("\n");
  return (lesson.before ?? "") + answer + (lesson.after ?? "");
}

const missionCases = [
  [{ energy: 18, outbound_cost: 5, return_cost: 4 }, 9],
  [{ energy: 21, outbound_cost: 6, return_cost: 8 }, 7],
  [{ energy: 11, outbound_cost: 6, return_cost: 5 }, 0],
];

export function checkLesson(index, answer) {
  const source = lessonSource(index, answer);
  const initial = [{}, {}, { energy: 11 }, { energy: 15 }, {}, missionCases[0][0]][index];
  const result = runPython(source, initial);
  const { error, output, variables } = result;
  const response = (ok, message) => ({ ...result, ok, message: ok ? lessons[index].success : message });

  if (index === 4 && answer.length < 3) return response(false, "Добавь все три строки и проверь их порядок.");
  if (error) {
    if (index === 0 && /[«»“”]|[а-яё]/iu.test(String(answer))) {
      return response(false, "Напиши сообщение в прямых кавычках, чтобы Python распознал текст.");
    }
    return response(false, error.message);
  }

  switch (index) {
    case 0:
      return response(output.length === 1 && output[0] === "Готов к запуску", "Сверь сообщение в консоли с фразой в задании.");
    case 1:
      return response(variables.get("energy") === 9, variables.get("energy") === "9"
        ? "Кавычки превращают 9 в текст. Введи число без кавычек." : "Запиши в energy целое число 9.");
    case 2:
      return response(answer === 1, answer === 0
        ? "В кавычках напечаталось слово energy. Выбери команду, которая читает значение." : "Строка с «11» всегда выводит 11. Нам нужно показание датчика.");
    case 3: {
      const trial = runPython(source, { energy: 18 });
      return response(output.length === 1 && output[0] === "9" && trial.output[0] === "12",
        "Вычти расход из переменной energy, чтобы расчёт работал и с другим зарядом.");
    }
    case 4:
      return response(variables.get("energy") === 7 && output.length === 1 && output[0] === "7",
        "Консоль прочитала старый заряд. Перенеси вычисление выше команды print().");
    case 5:
      if (output.length !== 1) return response(false, "Оставь один вывод после расчёта обоих расходов.");
      if (variables.get("energy") === initial.energy) return response(false, "Сохрани рассчитанный остаток обратно в energy.");
      return response(missionCases.every(([values, expected]) => {
        const trial = runPython(source, values);
        return !trial.error && trial.variables.get("energy") === expected &&
          trial.output.length === 1 && trial.output[0] === String(expected);
      }), "Расчёт должен учитывать оба расхода и работать при другом заряде. Используй имена из данных станции.");
    default:
      throw new RangeError("Unknown lesson");
  }
}
