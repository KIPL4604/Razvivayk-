import { MAX_SOURCE, runPython } from "./python-station/console.mjs?v=2";
import { chapters, intro, sectionAt, stages } from "./python-station/course-catalog.mjs?v=1";
import { createCourseRunner, MAX_COURSE_SOURCE } from "./python-station/course-runner.mjs?v=1";
import { stationView } from "./python-station/station.mjs?v=2";
import { createPythonStationController as createLegacy } from "./python-station-mode.mjs?v=4";

const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const empty = () => ({ intro: false, completed: 0, cursors: {}, drafts: {}, projects: [] });
const chapterAt = step => step === -1 ? intro : stages[step];
const editorAttrs = limit => 'autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="' + limit + '"';
const redesignedStages = 18;

function pythonLiteral(value) {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return "[" + value.map(pythonLiteral).join(", ") + "]";
  if (typeof value === "object") {
    return "{" + Object.entries(value).map(([key, item]) => pythonLiteral(key) + ": " + pythonLiteral(item)).join(", ") + "}";
  }
  return JSON.stringify(value);
}

const inputCode = initial => Object.entries(initial ?? {}).map(([name, value]) => name + " = " + pythonLiteral(value)).join("\n");
const projectRuntime = project => project.runtime === "python" ? MAX_COURSE_SOURCE : MAX_SOURCE;

function sampleOf(project) {
  return { files: project.files, stdin: project.stdin, call: project.call, showReturn: project.showReturn };
}

function portableProject(project) {
  const files = Object.entries(project.files ?? {}).filter(([name]) => /^[\w-]+(?:\.[\w-]+)*$/.test(name));
  const fixtureCode = files.length ? [
    "from pathlib import Path as _station_path",
    ...files.map(([name, value]) => {
      const path = "_station_path(" + pythonLiteral(name) + ")";
      return "if not " + path + ".exists():\n    " + path + ".write_text(" + pythonLiteral(value) + ", encoding=\"utf-8\")";
    }),
  ].join("\n") : "";
  const call = project.call;
  const invocation = call && /^[A-Za-z_]\w*$/.test(call.name)
    ? call.name + "(" + (call.args ?? []).map(pythonLiteral).join(", ") + ")" : "";
  const example = invocation && project.showReturn ? "print(" + invocation + ")" : invocation;
  return [fixtureCode, project.download?.prefix, project.code, project.download?.suffix ?? example]
    .filter(Boolean).join("\n\n") + "\n";
}

function load(key, previousKey, originalKey) {
  const state = empty();
  try {
    const currentSave = localStorage.getItem(key) ?? localStorage.getItem(previousKey);
    const migrating = currentSave === null;
    const saved = JSON.parse(currentSave ?? localStorage.getItem(originalKey));
    state.intro = saved?.intro === true;
    if (Number.isInteger(saved?.completed)) state.completed = Math.max(0, Math.min(stages.length, saved.completed));
    for (let step = -1; step < stages.length; step++) {
      // The first 18 islands have new exercises. Old slide indexes refer to different tasks.
      if (migrating && step >= 0 && step < redesignedStages) continue;
      const chapter = chapterAt(step);
      const cursor = saved?.cursors?.[step];
      if (Number.isInteger(cursor) && cursor >= 0 && cursor < chapter.slides.length) state.cursors[step] = cursor;
      chapter.slides.forEach((slide, page) => {
        const id = step + ":" + page;
        if (slide.kind === "practice" && typeof saved?.drafts?.[id] === "string") {
          state.drafts[id] = saved.drafts[id].slice(0, slide.runtime === "python" ? MAX_COURSE_SOURCE : MAX_SOURCE);
        }
      });
    }
    if (Array.isArray(saved?.projects)) {
      state.projects = saved.projects.filter(project => typeof project?.name === "string" && typeof project.code === "string")
        .map(project => ({ ...project, name: project.name.slice(0, 60), code: project.code.slice(0, projectRuntime(project)) }));
    }
    if (migrating && state.intro && state.completed < redesignedStages) {
      const activePrefix = state.completed + ":";
      for (const [id, draft] of Object.entries(saved?.drafts ?? {})) {
        if (id.startsWith(activePrefix) && typeof draft === "string" && draft.trim()) {
          state.projects.push({ name: "Черновик прежнего этапа " + (state.completed + 1), code: draft.slice(0, MAX_SOURCE) });
        }
      }
    }
  } catch { /* Local storage can be unavailable in a WebView. */ }
  return state;
}

function errorText(result) {
  return result.error.line
    ? result.error.name + " · строка " + result.error.line + ". " + result.error.message
    : result.error.message;
}

export function checkPractice(slide, code) {
  if (!code.trim()) return { ok: false, text: "Напиши код и запусти его." };
  const first = slide.cases[0];
  const result = runPython(code, first.initial);
  if (result.error) return { ok: false, text: errorText(result) };
  for (const [index, sample] of slide.cases.entries()) {
    const attempt = index === 0 ? result : runPython(code, sample.initial);
    const output = sample.output ?? slide.output;
    const sameValues = Object.entries(sample.expected).every(([key, expected]) => attempt.variables.get(key) === expected);
    const sameOutput = output === null || (output.length === attempt.output.length &&
      output.every((line, number) => line === attempt.output[number]));
    if (attempt.error || !sameValues || !sameOutput) {
      return {
        ok: false, result,
        text: index > 0 ? "На других данных код не сработал. Используй значения из переменных." :
          "Сверь значения и вывод с заданием. Если нужно, открой подсказку.",
      };
    }
  }
  return { ok: true, result, text: "Верно! Код выполняет задание." };
}

const iconShapes = {
  book: '<path d="M12 6v14M3 4h5c2 0 4 1 4 3 0-2 2-3 4-3h5v13h-5c-2 0-4 1-4 3 0-2-2-3-4-3H3z"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-12-2 14"/>',
  review: '<path d="M4 11a8 8 0 1 1 2 6m-2-6V5m0 6h6"/>',
  project: '<path d="M3 7h7l2 2h9v10H3z"/>',
  lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
};
const icon = (name) => '<svg aria-hidden="true" viewBox="0 0 24 24">' + iconShapes[name] + '</svg>';
const action = (id, label, style = "ps-primary") =>
  '<button class="' + style + '" type="button" data-course-action="' + id + '">' + label + '</button>';

export function createPythonCourseController() {
  const mount = document.querySelector("#pythonStationMount");
  const main = mount.closest("main");
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  const identity = Number.isSafeInteger(user) ? user : "local";
  const key = "teramont.python-course.v3." + identity;
  const state = load(key, "teramont.python-course.v2." + identity, "teramont.python-course.v1." + identity);
  let legacyAvailable = false;
  try { legacyAvailable = localStorage.getItem("teramont.python-station.v1." + identity) !== null; } catch {}
  mount.innerHTML = '<div class="pc-shell"></div><div class="pc-legacy" hidden></div>';
  const root = mount.firstElementChild;
  const legacyMount = mount.lastElementChild;
  const station = document.createElement("aside");
  station.className = "pc-station ps-view";
  station.innerHTML = '<canvas class="ps-canvas" width="540" height="360" aria-hidden="true"></canvas>' +
    '<div class="pc-gauge"><span>Табло станции</span><strong aria-label="Показание">—</strong></div>' +
    '<button class="ps-orbit" data-course-action="orbit" type="button" aria-label="Повернуть станцию">↻</button>';
  const model = stationView(station.querySelector("canvas"));
  const gauge = station.querySelector(".pc-gauge strong");
  let legacy, mode = "map", step = -1, page = 0, projectIndex = -1, active = false;
  let selection = sectionAt(state.completed);
  let mapScroll = 0, reviewing = false, wrongAnswers = 0;
  let reviewDrafts = {};
  let courseError = false;
  const get = selector => root.querySelector(selector);
  const chapter = () => chapterAt(step);
  const current = () => chapter().slides[page];
  const draftId = () => step + ":" + page;
  const draftStore = () => reviewing ? reviewDrafts : state.drafts;
  const runner = createCourseRunner();

  function starterFor(slide) {
    const drafts = draftStore();
    return drafts[draftId()] ?? (slide.continueCode ? drafts[step + ":" + (page - 1)] : null) ?? slide.starter;
  }

  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); courseError = false; }
    catch { courseError = true; }
    const warning = get(".pc-storage");
    if (warning) warning.hidden = !courseError;
  }

  function frame(title, markup, back = "", right = "") {
    root.innerHTML = '<header class="pc-header' + (right ? "" : " pc-header-compact") + '">' +
      (back ? action("back", "← " + back, "ps-back") : '<button type="button" class="ps-back" data-screen-link="home">← Игры</button>') +
      '<h1 tabindex="-1">' + title + '</h1>' + right + '</header>' + markup +
      '<p class="pc-storage" role="status"' + (courseError ? "" : " hidden") + '>Сохранение на этом устройстве недоступно.</p>';
    main.scrollTop = 0;
  }

  const isDone = index => index === -1 ? state.intro : index < state.completed;
  const isOpen = index => index === -1 || (state.intro && index <= state.completed);
  const nextIsland = () => !state.intro ? -1 : Math.min(state.completed, stages.length - 1);
  const lane = row => [50, 70, 50, 30][row % 4];
  const slideTitle = (slide, index) => {
    const number = chapter().slides.slice(0, index + 1).filter(item => item.kind === slide.kind).length;
    if (slide.kind === "theory") return "Теория и пример";
    if (slide.kind === "quiz") return "Вопрос " + number;
    return "Тренировка" + (chapter().slides.filter(item => item.kind === "practice").length > 1 ? " " + number : "");
  };

  function nodeMarkup(item, index, row) {
    const done = isDone(index);
    const open = isOpen(index);
    const selected = open && !done;
    const shape = done ? "check" : !open ? "lock" : item.group || "code";
    const status = done ? "Повторить" : open ? "Текущий этап" : "Закрыто";
    const connector = index < selection.end - 1
      ? '<svg class="pc-island-route' + (done ? ' is-travelled' : '') + '" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M' +
        lane(row) + ' 36 C' + lane(row) + ' 93 ' + lane(row + 1) + ' 78 ' + lane(row + 1) + ' 136"/></svg>'
      : "";
    return '<li class="pc-island-row" style="--island-x:' + lane(row) + '%">' + connector +
      '<button class="pc-island" type="button" data-course-step="' + index + '" data-island-state="' +
      (done ? "done" : open ? "open" : "locked") + '" data-island-kind="' + (item.group || "lesson") + '"' +
      (selected ? ' aria-current="step"' : "") +
      (open ? "" : " disabled") + '><span class="pc-island-art" aria-hidden="true">' +
      '<span class="pc-island-shadow"></span><span class="pc-island-rock"></span><span class="pc-island-shelf"></span>' +
      '<span class="pc-island-deck"></span><span class="pc-island-marker">' + icon(shape) + '</span></span>' +
      '<span class="pc-island-caption"><span class="pc-node-title">' + (index < 0 ? "" : (index - selection.first + 1) + ". ") + escape(item.title) +
      '</span><span class="pc-node-state">' + status + '</span></span></button></li>';
  }

  function map() {
    const next = stages[state.completed];
    const currentSection = sectionAt(nextIsland());
    const inCurrent = selection === currentSection;
    const done = Math.max(0, Math.min(selection.stages.length, state.completed - selection.first));
    const label = !inCurrent ? "К текущей главе" : !state.intro ? "Начать курс" : next ? "Продолжить обучение" : "Повторить курс";
    const right = '<button class="ps-secondary pc-project-link" type="button" data-course-action="projects">' +
      icon("project") + '<span>Мои проекты</span></button>';
    const picker = '<label class="pc-chapter-picker">Глава курса<select data-course-chapter>' +
      chapters.map((item, i) => '<option value="' + i + '"' + (selection === item ? " selected" : "") + '>' +
        (i + 1) + ". " + escape(item.title) + (item.first > state.completed ? " · закрыта" : "") + '</option>').join("") +
      '</select></label>';
    const introNode = selection.first === 0 ? nodeMarkup(intro, -1, 0) : "";
    frame("Питон-станция", '<div class="pc-map"><div class="pc-map-info">' + picker +
      '<section class="pc-banner"><div class="pc-banner-copy">' +
      '<h2>' + escape(selection.title) + '</h2><p>Пройдено ' + done + ' из ' + selection.stages.length + ' этапов</p>' +
      '<progress aria-label="Прогресс главы" max="' + selection.stages.length + '" value="' + done + '"></progress>' +
      action(inCurrent ? "continue" : "current-chapter", label) + '</div><div class="pc-banner-art" aria-hidden="true"><div class="pc-code-tile">' +
      '<span>score</span> = <b>5</b></div><div class="pc-art-lid"></div><div class="pc-art-base"></div></div></section>' +
      (legacyAvailable ? action("legacy", "Прежние уроки", "pc-plain") : "") + '</div>' +
      '<section class="pc-track" aria-label="Маршрут курса"><div class="pc-track-top"><h2 tabindex="-1">Маршрут обучения</h2>' +
      (state.intro && next && inCurrent ? action("locate", "К текущему этапу", "pc-plain") : "") + '</div>' +
      '<ol class="pc-islands">' + introNode + selection.stages.map((item, i) =>
        nodeMarkup(item, selection.first + i, i + (introNode ? 1 : 0))).join("") + '</ol></section></div>', "", right);
  }

  function island() {
    const done = isDone(step);
    const cursor = state.cursors[step] ?? 0;
    const label = done ? "Повторить этап" : cursor ? "Продолжить этап" : "Начать этап";
    const list = chapter().slides.map((slide, index) => {
      const passed = done || index < cursor;
      const kind = slide.kind === "practice" ? "code" : slide.kind === "quiz" ? "review" : "book";
      return '<li><button class="pc-substep" type="button" data-course-page="' + index + '"' +
        (passed ? "" : index === cursor ? ' aria-current="step"' : " disabled") +
        '><span class="pc-icon" data-role="' + (passed ? "check" : kind) + '">' +
        icon(passed ? "check" : index > cursor ? "lock" : kind) + '</span>' +
        '<span class="pc-substep-copy"><span>' + slideTitle(slide, index) + '</span>' +
        (slide.kind === "quiz" ? '<small>' + escape(slide.text) + '</small>' : "") + '</span><small>' +
        (passed ? "Повторить" : index === cursor ? "Доступно" : "Закрыто") + '</small></button></li>';
    }).join("");
    frame("Питон-станция", '<section class="pc-card pc-stage"><p class="pc-eyebrow">' +
      (step < 0 ? "Введение" : escape(selection.title) + " · этап " + (step - selection.first + 1) + " из " + selection.stages.length) + '</p><h2 tabindex="-1">' +
      escape(chapter().title) + '</h2><ol class="pc-substeps" aria-label="Шаги этапа">' + list + '</ol>' +
      action("start-island", label + " →") + '</section>', "Маршрут");
  }

  const codeBlock = code => code ? '<pre class="pc-code"><code>' + escape(code) + '</code></pre>' : "";

  function visibleFiles(files, label) {
    return Object.keys(files ?? {}).length ? '<details class="pc-hint"><summary>' + label + '</summary>' +
      Object.entries(files).map(([name, contents]) => '<p class="pc-code-label">' + escape(name) + '</p>' + codeBlock(contents)).join("") +
      '</details>' : "";
  }

  function sampleMarkup(sample) {
    const data = inputCode(sample.initial);
    return (data ? '<p class="pc-code-label">Уже задано</p>' + codeBlock(data) : "") +
      (sample.stdin?.length ? '<p class="pc-code-label">Пример ввода</p>' + codeBlock(sample.stdin.map(pythonLiteral).join("\n")) : "") +
      (sample.call ? '<p class="pc-code-label">Пример вызова</p>' + codeBlock(sample.call.name + "(" + (sample.call.args ?? []).map(pythonLiteral).join(", ") + ")") : "") +
      visibleFiles(sample.files, "Файлы задания");
  }

  function lesson() {
    wrongAnswers = 0;
    const slide = current();
    const title = chapter().title;
    const label = { theory: "Теория", quiz: "Вопрос " + chapter().slides.slice(0, page + 1).filter(item => item.kind === "quiz").length, practice: "Практика" }[slide.kind];
    const bars = chapter().slides.map((_, index) => '<span data-state="' + (index === page ? "active" : index < page ? "done" : "next") + '"></span>').join("");
    const choices = slide.kind === "quiz" ? slide.options.map((_, i) => {
      const value = (i + page + Math.max(step, 0)) % slide.options.length;
      return '<button type="button" class="pc-choice" data-course-choice="' + value + '">' +
        '<code>' + escape(slide.options[value]) + '</code></button>';
    }).join("") : "";
    let content = '<p class="pc-copy">' + escape(slide.text) + '</p>';
    if (slide.kind === "theory") {
      if (slide.example) content += sampleMarkup(slide.example);
      content += codeBlock(slide.code);
      if (slide.runtime === "python" && slide.code) {
        content += action("run-example", "Запустить пример", "ps-secondary") +
          '<div class="pc-feedback" role="status"></div><p class="pc-example-label" data-course-output-label hidden>Вывод программы</p>' +
          '<pre class="pc-output" aria-label="Вывод программы" hidden></pre>';
      } else {
        const example = runPython(slide.code);
        if (!example.error && example.output.length) {
          content += '<p class="pc-example-label">Вывод</p><pre class="pc-output">' +
            escape(example.output.join("\n")) + '</pre>';
        }
      }
      content += action("next", "Дальше →");
    }
    if (slide.kind === "quiz") {
      content += codeBlock(slide.code) + '<div class="pc-options">' + choices +
        '</div><div class="pc-feedback" role="status"></div>' + action("next", "Дальше →");
    }
    if (slide.kind === "practice") {
      content += sampleMarkup(slide.cases[0]) +
        '<form class="pc-form" data-course-form="practice"><label for="pc-code">Твой код</label>' +
        '<textarea id="pc-code" rows="' + (slide.runtime === "python" ? 6 : 4) + '" ' +
        editorAttrs(slide.runtime === "python" ? MAX_COURSE_SOURCE : MAX_SOURCE) + '>\n' + escape(starterFor(slide)) + '</textarea>' +
        '<details class="pc-hint"><summary>Подсказка</summary><p>' + escape(slide.hint) + '</p></details>' +
        '<div class="pc-feedback" role="status"></div><p class="pc-example-label" data-course-output-label hidden>Вывод программы</p>' +
        '<pre class="pc-output" aria-label="Вывод программы" hidden></pre><div class="pc-result-files"></div>' +
        '<button class="ps-primary" type="submit">Запустить код</button>' +
        action("next", page === chapter().slides.length - 1 ? "Завершить этап →" : "Дальше →") + '</form>';
    }
    frame("Питон-станция", '<div class="pc-session' + (slide.display ? ' pc-has-station' : "") + '"><article class="pc-card">' +
      '<div class="pc-steps" aria-hidden="true">' + bars + '</div><div class="pc-slide-meta">' +
      '<p class="pc-eyebrow">' + label + '</p><span>Шаг ' + (page + 1) + ' из ' + chapter().slides.length + '</span></div>' +
      '<h2 tabindex="-1">' + title + '</h2>' + content +
      '</article><div class="pc-station-slot"></div></div>', "К этапу");
    const next = get('[data-course-action="next"]');
    next.hidden = slide.kind === "practice";
    next.disabled = slide.kind === "quiz";
    if (slide.display) {
      gauge.textContent = "—";
      get(".pc-station-slot").append(station);
      model.setProgress(0);
      model.show(true);
    }
  }

  function complete() {
    const guided = chapter().group === "project";
    const courseDone = step === stages.length - 1;
    const primary = reviewing ? action("back", "К шагам этапа") :
      courseDone ? action("map", "К маршруту") : action("continue", "Продолжить обучение →");
    const savedProject = guided ? action("save-guided", "Сохранить в «Мои проекты»", "ps-secondary") : "";
    frame("Питон-станция", '<section class="pc-card pc-summary"><span class="pc-icon" data-role="check">' + icon("check") + '</span>' +
      '<h2 tabindex="-1">' + (reviewing ? "Этап повторён" : courseDone ? "Курс завершён!" : guided ? "Глава завершена!" : "Этап пройден") + '</h2><p class="pc-copy">' +
      escape(chapter().title) + '</p><div class="pc-actions">' +
      primary + savedProject +
      (courseDone && !reviewing ? "" : action("map", "К маршруту", "ps-secondary")) + '</div></section>', "К этапу");
  }

  function projects() {
    frame("Мои проекты", '<section class="pc-card pc-projects"><h2 tabindex="-1">Твой код</h2>' +
      (state.projects.length ? '<ul class="pc-project-list">' + state.projects.map((project, index) =>
        '<li><button class="pc-choice" type="button" data-course-project="' + index + '">' +
        icon("project") + ' <span>' + escape(project.name || "Без названия") + '</span></button></li>').join("") + '</ul>' :
        '<p class="pc-copy">Здесь будут программы, которые ты сохранишь.</p>') +
      action("create-project", "+ Создать проект") + '</section>', "Маршрут");
  }

  function projectEditor() {
    const project = state.projects[projectIndex];
    const advanced = project.runtime === "python";
    const download = project.download;
    const preview = project.call;
    const inputPanel = preview ? (download?.previewLabels ?
      '<fieldset class="pc-demo"><legend>Пробный запуск ' + escape(preview.name) + '()</legend>' +
      download.previewLabels.map((label, index) => '<label>' + escape(label) +
        '<input type="text" data-course-arg="' + index + '" maxlength="200" value="' + escape(preview.args[index] ?? "") + '"></label>').join("") +
      '</fieldset>' : '<details class="pc-hint"><summary>Пробный вызов</summary>' +
      codeBlock(preview.name + "(" + (preview.args ?? []).map(pythonLiteral).join(", ") + ")") + '</details>') :
      advanced ? '<details class="pc-hint"><summary>Входные данные программы</summary>' +
      '<label for="pc-stdin">По одному значению на строку</label><textarea id="pc-stdin" rows="2" ' + editorAttrs(1000) + '>' +
      escape((project.stdin ?? []).join("\n")) + '</textarea></details>' : "";
    const browserHelp = download?.instructions || (advanced ? "Учебный Python. Используй входные данные и файлы проекта." :
      "Целые числа, строки, переменные, print(), +, − и *.");
    frame("Мои проекты", '<section class="pc-card pc-projects"><h2 tabindex="-1">Редактор Python</h2>' +
      '<p class="pc-copy">' + escape(browserHelp) + '</p>' +
      '<form class="pc-form" data-course-form="project"><label for="pc-name">Название</label>' +
      '<input id="pc-name" maxlength="60" value="' + escape(project.name) + '">' +
      '<label for="pc-code">Твой код</label><textarea id="pc-code" rows="8" ' + editorAttrs(projectRuntime(project)) + '>\n' +
      escape(project.code) + '</textarea>' + inputPanel + visibleFiles(project.files, "Файлы проекта") +
      '<div class="pc-feedback" role="status"></div><p class="pc-example-label" data-course-output-label hidden>Вывод программы</p>' +
      '<pre class="pc-output" aria-label="Вывод программы" hidden></pre><div class="pc-result-files"></div>' +
      '<button class="ps-primary" type="submit">' + escape(download?.runLabel ?? "Запустить код") + '</button>' +
      action("download-project", escape(download?.label ?? "Скачать .py"), "ps-secondary") + '</form>' +
      (download?.suffix ? '<details class="pc-hint pc-export-source"><summary>Код для запуска вне станции</summary>' +
        codeBlock(download.suffix) + '</details>' : "") + '</section>', "Проекты");
  }

  function display(target, focus = true) {
    runner.cancel();
    const returningFromIsland = mode === "island" && target === "map";
    model.show(false);
    if (mode === "legacy" && target !== "legacy") legacy.onScreen("");
    mode = target;
    legacyMount.hidden = mode !== "legacy";
    root.hidden = mode === "legacy";
    if (mode === "map") {
      map();
      main.scrollTop = mapScroll;
    }
    else if (mode === "island") island();
    else if (mode === "lesson") lesson();
    else if (mode === "complete") complete();
    else if (mode === "projects") projects();
    else if (mode === "editor") projectEditor();
    else if (mode === "legacy") {
      legacy ??= createLegacy(legacyMount);
      legacy.onScreen("python-station");
    }
    if (focus && mode !== "legacy") {
      const heading = mode === "map" ? get("h1") : get("h2");
      const previous = returningFromIsland ? get('[data-course-step="' + step + '"]') : null;
      (previous || heading)?.focus({ preventScroll: true });
    }
  }

  function inspect(stepIndex) {
    if (!chapterAt(stepIndex) || !isOpen(stepIndex)) return;
    const destination = sectionAt(stepIndex);
    if (destination !== selection) {
      selection = destination;
      mapScroll = 0;
    } else if (mode === "map") mapScroll = main.scrollTop;
    step = stepIndex;
    display("island");
  }

  function open(pageIndex = state.cursors[step] ?? 0) {
    const cursor = state.cursors[step] ?? 0;
    const done = isDone(step);
    if (!isOpen(step) || !chapter().slides[pageIndex] || (!done && pageIndex > cursor)) return;
    reviewing = done || pageIndex < cursor;
    reviewDrafts = {};
    page = pageIndex;
    display("lesson");
  }

  function advance() {
    if (reviewing && !isDone(step) && page + 1 >= (state.cursors[step] ?? 0)) {
      display("island");
      return;
    }
    if (page + 1 < chapter().slides.length) {
      page++;
      if (!reviewing) {
        state.cursors[step] = page;
        save();
      }
      display("lesson");
      return;
    }
    if (!reviewing) {
      delete state.cursors[step];
      if (step === -1) state.intro = true;
      else state.completed = Math.max(state.completed, step + 1);
      save();
    }
    display("complete");
  }

  function back() {
    if (mode === "map") return false;
    display(mode === "editor" ? "projects" : mode === "lesson" || mode === "complete" ? "island" : "map");
    return true;
  }

  function createProject(project = { name: "Новый проект", code: "", runtime: "python" }) {
    state.projects.push(project);
    projectIndex = state.projects.length - 1;
    save();
    display("editor");
    get("#pc-name").select();
  }

  function showOutput(result) {
    const output = get(".pc-output");
    const show = Boolean(result && (result.output?.length || result.error || mode === "editor"));
    get("[data-course-output-label]")?.toggleAttribute("hidden", !show);
    output.hidden = !show;
    if (show) output.textContent = result.error ? errorText(result) : result.output.join("\n") || "Программа выполнена. Вывода нет.";
    const files = get(".pc-result-files");
    if (files) files.innerHTML = visibleFiles(result?.files, "Файлы после запуска");
  }

  function saveGuided() {
    const slide = current();
    const code = draftStore()[draftId()];
    if (!code?.trim()) return;
    const chapterDownload = chapter().download;
    const sample = slide.cases[0];
    const settings = slide.runtime === "python" ? {
      runtime: "python", files: sample.files, stdin: sample.stdin,
      call: sample.call ? { name: sample.call.name, args: structuredClone(sample.call.args ?? []) } : undefined,
      showReturn: sample.showReturn === true,
      download: chapterDownload,
    } : {};
    createProject({ name: chapter().title, code: [inputCode(sample.initial), code].filter(Boolean).join("\n"), ...settings });
  }

  function downloadProject() {
    const project = state.projects[projectIndex];
    const name = project.download?.filename ?? "station-project.py";
    const url = URL.createObjectURL(new Blob([portableProject(project)], { type: "text/x-python;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    root.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function runExample(button) {
    const feedback = get(".pc-feedback");
    button.disabled = true;
    feedback.textContent = "Готовим Python…";
    showOutput(null);
    const slide = current();
    const result = await runner.run(slide.code, [slide.example ?? {}], undefined, () => {
      if (root.contains(button)) feedback.textContent = "Выполняем пример…";
    });
    if (!root.contains(button) || !active) return;
    button.disabled = false;
    feedback.textContent = result.error ? errorText(result) : result.output.length ? "" : "Пример выполнен.";
    if (!result.error) showOutput(result);
  }

  root.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    const { courseAction, courseStep, coursePage, courseChoice, courseProject } = button.dataset;
    if (courseStep !== undefined) return inspect(Number(courseStep));
    if (coursePage !== undefined) return open(Number(coursePage));
    if (courseProject !== undefined) {
      projectIndex = Number(courseProject);
      return display("editor");
    }
    if (courseChoice !== undefined) {
      const correct = courseChoice === "0";
      const feedback = get(".pc-feedback");
      feedback.dataset.correct = String(correct);
      if (correct) feedback.textContent = current().why;
      else {
        wrongAnswers++;
        const hint = current().hint || (current().code ? "Перечитай пример и попробуй снова." : "Вспомни правило из теории и попробуй снова.");
        feedback.textContent = "Пока не так. " + (wrongAnswers === 1 ? hint : current().why);
      }
      get('[data-course-action="next"]').disabled = !correct;
      get(".pc-options").querySelectorAll("button").forEach(choice => {
        choice.dataset.answer = choice === button ? String(correct) : "";
      });
      if (correct) get('[data-course-action="next"]').focus({ preventScroll: true });
      return;
    }
    switch (courseAction) {
      case "continue": inspect(state.completed === stages.length ? 0 : nextIsland()); break;
      case "current-chapter": selection = sectionAt(nextIsland()); mapScroll = 0; display("map"); break;
      case "start-island": open(isDone(step) ? 0 : undefined); break;
      case "locate": {
        const target = get('[data-course-step="' + nextIsland() + '"]');
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "center" });
        break;
      }
      case "next": advance(); break;
      case "back": back(); break;
      case "map": display("map"); break;
      case "legacy": display("legacy"); break;
      case "projects": display("projects"); break;
      case "orbit": model.rotate(); break;
      case "create-project": createProject(); break;
      case "run-example": runExample(button); break;
      case "save-guided": saveGuided(); break;
      case "download-project": downloadProject(); break;
    }
  });

  root.addEventListener("change", ({ target }) => {
    if (!target.matches("[data-course-chapter]")) return;
    selection = chapters[Number(target.value)] ?? selection;
    mapScroll = 0;
    display("map", false);
    get("[data-course-chapter]").focus({ preventScroll: true });
  });

  root.addEventListener("input", ({ target }) => {
    if (mode === "editor") {
      if (target.id === "pc-name") state.projects[projectIndex].name = target.value;
      else if (target.id === "pc-code") state.projects[projectIndex].code = target.value;
      else if (target.id === "pc-stdin") state.projects[projectIndex].stdin = target.value.replace(/\r\n/g, "\n").split("\n");
      else if (target.dataset.courseArg !== undefined) state.projects[projectIndex].call.args[Number(target.dataset.courseArg)] = target.value;
      else return;
      if (target.id !== "pc-name") {
        get(".pc-feedback").textContent = "";
        showOutput(null);
      }
    } else if (mode === "lesson" && target.id === "pc-code") {
      draftStore()[draftId()] = target.value;
      get('[data-course-action="next"]').hidden = true;
      get('button[type="submit"]').hidden = false;
      get(".pc-feedback").textContent = "";
      showOutput(null);
      if (current().display) {
        gauge.textContent = "—";
        model.setProgress(0);
      }
    } else return;
    if (mode === "editor" || !reviewing) save();
  });

  root.addEventListener("submit", async event => {
    if (!event.target.matches("[data-course-form]")) return;
    event.preventDefault();
    const form = event.target;
    const editor = mode === "editor";
    const project = editor ? state.projects[projectIndex] : null;
    const slide = editor ? null : current();
    const textarea = get("#pc-code");
    const submit = form.querySelector('button[type="submit"]');
    if (submit.disabled) return;
    const code = textarea.value;
    const feedback = get(".pc-feedback");
    let result, ok, text;
    if ((project ?? slide).runtime === "python") {
      const editors = form.querySelectorAll("textarea, input");
      submit.disabled = true;
      editors.forEach(input => { input.readOnly = true; });
      feedback.textContent = "Готовим Python…";
      delete feedback.dataset.correct;
      showOutput(null);
      result = await runner.run(code, editor ? [sampleOf(project)] : slide.cases, slide?.display, () => {
        if (root.contains(form)) feedback.textContent = "Выполняем код…";
      });
      if (!root.contains(form) || !active) return;
      submit.disabled = false;
      editors.forEach(input => { input.readOnly = false; });
      ok = result.ok;
      text = ok ? "Верно! Код выполняет задание." :
        (result.failedCase ? "На других данных код не сработал. " : "") +
        (result.error?.line ? errorText(result) : result.detail ?? result.error?.message ?? "Проверь свой код.");
    } else if (editor) return showOutput(runPython(code));
    else ({ result, ok, text } = checkPractice(slide, code));
    if (editor) {
      feedback.dataset.correct = String(ok);
      feedback.textContent = ok ? "Код выполнен." : text;
      showOutput(result);
      submit.focus();
      if (project.download) get('[data-course-action="download-project"]').scrollIntoView({ block: "nearest" });
      return;
    }
    feedback.dataset.correct = String(ok);
    feedback.textContent = text;
    showOutput(result?.output.length || Object.keys(result?.files ?? {}).length ? { ...result, error: null } : null);
    if (slide.display) {
      const value = result?.variables?.get(slide.display) ?? result?.reading;
      gauge.textContent = value == null ? "—" : String(value);
      model.setProgress(Number.isInteger(value) && value > 0 ? 2 : 0);
      if (value != null) feedback.textContent += " Табло показывает " + value + ".";
    }
    const next = get('[data-course-action="next"]');
    next.hidden = !ok;
    submit.hidden = ok;
    if (ok) {
      draftStore()[draftId()] = code;
      if (!reviewing) save();
      next.focus();
    } else feedback.scrollIntoView({ block: "nearest" });
  });

  return {
    back,
    onScreen(screen) {
      const visible = screen === "python-station";
      if (visible && !active) {
        selection = sectionAt(nextIsland());
        mapScroll = 0;
        display("map", false);
      }
      if (!visible && active) {
        runner.cancel();
        model.show(false);
        if (mode === "legacy") legacy.onScreen(screen);
      }
      active = visible;
    },
  };
}
