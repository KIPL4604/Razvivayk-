import { MAX_SOURCE, runPython } from "./python-station/console.mjs?v=2";
import { intro, stages } from "./python-station/course-content.mjs?v=3";
import { stationView } from "./python-station/station.mjs?v=2";
import { createPythonStationController as createLegacy } from "./python-station-mode.mjs?v=4";

const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const empty = () => ({ intro: false, completed: 0, cursors: {}, drafts: {}, projects: [] });
const chapterAt = step => step === -1 ? intro : stages[step];
const editorAttrs = 'autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="' + MAX_SOURCE + '"';

function load(key) {
  const state = empty();
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    state.intro = saved?.intro === true;
    if (Number.isInteger(saved?.completed)) state.completed = Math.max(0, Math.min(stages.length, saved.completed));
    for (let step = -1; step < stages.length; step++) {
      const chapter = chapterAt(step);
      const cursor = saved?.cursors?.[step];
      if (Number.isInteger(cursor) && cursor >= 0 && cursor < chapter.slides.length) state.cursors[step] = cursor;
      chapter.slides.forEach((slide, page) => {
        const id = step + ":" + page;
        if (slide.kind === "practice" && typeof saved?.drafts?.[id] === "string") {
          state.drafts[id] = saved.drafts[id].slice(0, MAX_SOURCE);
        }
      });
    }
    if (Array.isArray(saved?.projects)) {
      state.projects = saved.projects.filter(project => typeof project?.name === "string" && typeof project.code === "string")
        .map(project => ({ name: project.name.slice(0, 60), code: project.code.slice(0, MAX_SOURCE) }));
    }
  } catch { /* Local storage can be unavailable in a WebView. */ }
  return state;
}

function errorText(result) {
  return result.error.line
    ? result.error.name + " · строка " + result.error.line + ". " + result.error.message
    : result.error.message;
}

function verify(slide, code) {
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
        text: index > 0 ? "Попробуй взять значения из переменных. На других данных получился неверный результат." :
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
  const key = "teramont.python-course.v1." + identity;
  const state = load(key);
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
  let mapScroll = 0, reviewing = false, wrongAnswers = 0;
  let reviewDrafts = {};
  let courseError = false;
  const get = selector => root.querySelector(selector);
  const chapter = () => chapterAt(step);
  const current = () => chapter().slides[page];
  const draftId = () => step + ":" + page;

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

  function nodeMarkup(item, index) {
    const row = index + 1;
    const done = isDone(index);
    const open = isOpen(index);
    const selected = open && !done;
    const shape = done ? "check" : !open ? "lock" : item.group || "code";
    const status = done ? "Повторить" : open ? "Текущий этап" : "Закрыто";
    const connector = index < stages.length - 1
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
      '<span class="pc-island-caption"><span class="pc-node-title">' + (index < 0 ? "" : (index + 1) + ". ") + escape(item.title) +
      '</span><span class="pc-node-state">' + status + '</span></span></button></li>';
  }

  function map() {
    const next = stages[state.completed];
    const label = !state.intro ? "Начать курс" : next ? "Продолжить обучение" : "Повторить с начала";
    const right = '<button class="ps-secondary pc-project-link" type="button" data-course-action="projects">' +
      icon("project") + '<span>Мои проекты</span></button>';
    frame("Питон-станция", '<div class="pc-map"><div class="pc-map-info"><section class="pc-banner"><div class="pc-banner-copy"><span class="pc-eyebrow">Курс Python</span>' +
      '<h2>Переменные</h2><p>Пройдено ' + state.completed + ' из ' + stages.length + ' этапов</p>' +
      '<progress aria-label="Прогресс темы" max="' + stages.length + '" value="' + state.completed + '"></progress>' +
      action("continue", label) + '</div><div class="pc-banner-art" aria-hidden="true"><div class="pc-code-tile">' +
      '<span>score</span> = <b>5</b></div><div class="pc-art-lid"></div><div class="pc-art-base"></div></div></section>' +
      (legacyAvailable ? action("legacy", "Прежние уроки", "pc-plain") : "") + '</div>' +
      '<section class="pc-track" aria-label="Маршрут курса"><div class="pc-track-top"><h2 tabindex="-1">Маршрут обучения</h2>' +
      (state.intro && next ? action("locate", "К текущему этапу", "pc-plain") : "") + '</div>' +
      '<ol class="pc-islands">' + nodeMarkup(intro, -1) + stages.map(nodeMarkup).join("") + '</ol></section></div>', "", right);
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
      (step < 0 ? "Введение" : "Переменные · этап " + (step + 1) + " из " + stages.length) + '</p><h2 tabindex="-1">' +
      escape(chapter().title) + '</h2><ol class="pc-substeps" aria-label="Шаги этапа">' + list + '</ol>' +
      action("start-island", label + " →") + '</section>', "Маршрут");
  }

  const codeBlock = code => code ? '<pre class="pc-code"><code>' + escape(code) + '</code></pre>' : "";

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
      const example = runPython(slide.code);
      content += codeBlock(slide.code);
      if (!example.error && example.output.length) {
        content += '<p class="pc-example-label">Вывод</p><pre class="pc-output">' +
          escape(example.output.join("\n")) + '</pre>';
      }
      content += action("next", "Дальше →");
    }
    if (slide.kind === "quiz") {
      content += codeBlock(slide.code) + '<div class="pc-options">' + choices +
        '</div><div class="pc-feedback" role="status"></div>' + action("next", "Дальше →");
    }
    if (slide.kind === "practice") {
      const data = Object.entries(slide.cases[0].initial).map(([name, value]) => name + " = " + JSON.stringify(value)).join("\n");
      content += (data ? '<p class="pc-code-label">Уже задано</p>' + codeBlock(data) : "") +
        '<form class="pc-form" data-course-form="practice"><label for="pc-code">Твой код</label>' +
        '<textarea id="pc-code" rows="4" ' + editorAttrs + '>\n' + escape((reviewing ? reviewDrafts : state.drafts)[draftId()] ?? slide.starter) + '</textarea>' +
        '<details class="pc-hint"><summary>Подсказка</summary><p>' + escape(slide.hint) + '</p></details>' +
        '<div class="pc-feedback" role="status"></div><pre class="pc-output" aria-label="Вывод программы" hidden></pre>' +
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
    const guided = step === stages.length - 1;
    const primary = guided ? action("save-guided", "Сохранить в «Мои проекты»") :
      reviewing ? action("back", "К шагам этапа") : action("continue", "Продолжить обучение →");
    frame("Питон-станция", '<section class="pc-card pc-summary"><span class="pc-icon" data-role="check">' + icon("check") + '</span>' +
      '<h2 tabindex="-1">' + (reviewing ? "Этап повторён" : guided ? "Тема завершена!" : "Этап пройден") + '</h2><p class="pc-copy">' +
      escape(chapter().title) + '</p><div class="pc-actions">' +
      primary +
      action("map", "К маршруту", "ps-secondary") + '</div></section>', "К этапу");
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
    frame("Мои проекты", '<section class="pc-card pc-projects"><h2 tabindex="-1">Редактор Python</h2>' +
      '<p class="pc-copy">Здесь работают целые числа, строки, переменные, print(), +, − и *.</p>' +
      '<form class="pc-form" data-course-form="project"><label for="pc-name">Название</label>' +
      '<input id="pc-name" maxlength="60" value="' + escape(project.name) + '">' +
      '<label for="pc-code">Твой код</label><textarea id="pc-code" rows="7" ' + editorAttrs + '>\n' +
      escape(project.code) + '</textarea><pre class="pc-output" aria-label="Вывод программы" role="status" hidden></pre>' +
      '<button class="ps-primary" type="submit">Запустить код</button></form></section>', "Проекты");
  }

  function display(target, focus = true) {
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
    if (mode === "map") mapScroll = main.scrollTop;
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

  function createProject(name = "Новый проект", code = "") {
    state.projects.push({ name, code });
    projectIndex = state.projects.length - 1;
    save();
    display("editor");
    get("#pc-name").select();
  }

  function showOutput(result) {
    const output = get(".pc-output");
    output.hidden = !result;
    if (!result) return;
    output.textContent = result.error ? errorText(result) : result.output.join("\n") || "Программа выполнена. Вывода нет.";
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
      case "save-guided": createProject("Список покупок", (reviewing ? reviewDrafts : state.drafts)[draftId()] ?? ""); break;
    }
  });

  root.addEventListener("input", ({ target }) => {
    if (mode === "editor") {
      if (target.id === "pc-name") state.projects[projectIndex].name = target.value;
      else if (target.id === "pc-code") state.projects[projectIndex].code = target.value;
      else return;
    } else if (mode === "lesson" && target.id === "pc-code") {
      (reviewing ? reviewDrafts : state.drafts)[draftId()] = target.value;
      get('[data-course-action="next"]').hidden = true;
      get('button[type="submit"]').hidden = false;
      get(".pc-feedback").textContent = "";
      get(".pc-output").hidden = true;
      if (current().display) {
        gauge.textContent = "—";
        model.setProgress(0);
      }
    } else return;
    if (mode === "editor" || !reviewing) save();
  });

  root.addEventListener("submit", event => {
    if (!event.target.matches("[data-course-form]")) return;
    event.preventDefault();
    const code = get("#pc-code").value;
    if (mode === "editor") return showOutput(runPython(code));
    const slide = current();
    const { result, ok, text } = verify(slide, code);
    const feedback = get(".pc-feedback");
    feedback.dataset.correct = String(ok);
    feedback.textContent = text;
    showOutput(result?.output.length ? result : null);
    if (slide.display) {
      const value = result?.variables.get(slide.display);
      gauge.textContent = value === undefined ? "—" : String(value);
      model.setProgress(Number.isInteger(value) && value > 0 ? 2 : 0);
      if (value !== undefined) feedback.textContent += " Табло показывает " + value + ".";
    }
    const next = get('[data-course-action="next"]');
    next.hidden = !ok;
    get('button[type="submit"]').hidden = ok;
    if (ok) {
      (reviewing ? reviewDrafts : state.drafts)[draftId()] = code;
      if (!reviewing) save();
      next.focus();
    } else feedback.scrollIntoView({ block: "nearest" });
  });

  return {
    back,
    onScreen(screen) {
      const visible = screen === "python-station";
      if (visible && !active) display("map", false);
      if (!visible && active) {
        model.show(false);
        if (mode === "legacy") legacy.onScreen(screen);
      }
      active = visible;
    },
  };
}
