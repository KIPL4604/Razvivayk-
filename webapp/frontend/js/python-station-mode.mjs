import { MAX_SOURCE, runPython } from "./python-station/console.mjs?v=2";
import { checkLesson, lessonSource, lessons } from "./python-station/lessons.mjs?v=1";
import { stationView } from "./python-station/station.mjs?v=2";

const stationStatus = ["Связь потеряна", "Связь восстановлена", "Питание включено", "Датчик работает", "Шлюз открыт", "Маршрут готов", "Маяк включён"];
const encode = text => String(text).replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const colorCode = source => source.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\bprint\b|\b\d+\b)/g)
  .map((part, index) => index % 2 ? "<mark>" + encode(part) + "</mark>" : encode(part)).join("");

function loadProgress(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    const completed = Number.isInteger(data?.completed) ? Math.min(lessons.length, Math.max(0, data.completed)) : 0;
    const drafts = lessons.map((lesson, index) => {
      const draft = data?.drafts?.[index];
      if (lesson.choices) return Number.isInteger(draft) && draft >= 0 && draft < lesson.choices.length ? draft : -1;
      if (lesson.fragments) return Array.isArray(draft)
        ? [...new Set(draft.filter(part => Number.isInteger(part) && part >= 0 && part < lesson.fragments.length))]
        : [];
      return typeof draft === "string" ? draft.slice(0, MAX_SOURCE) : "";
    });
    return { completed, drafts };
  } catch {
    return { completed: 0, drafts: lessons.map(lesson => lesson.choices ? -1 : lesson.fragments ? [] : "") };
  }
}

export function createPythonStationController(mount = document.querySelector("#pythonStationMount")) {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  const key = "teramont.python-station.v1." + (Number.isSafeInteger(user) ? user : "local");
  const state = loadProgress(key);
  let index = state.completed;
  let visible = false, screenMode = "map", hint = 0, outcome = null, exampleShown = false, storageWarning = false;
  mount.innerHTML = `
    <div class="ps-shell" data-view="map">
      <header class="ps-header">
        <button class="ps-back" type="button" data-screen-link="home" aria-label="Вернуться к играм"><span aria-hidden="true">←</span><span>Игры</span></button>
        <h1 tabindex="-1">Питон-станция</h1>
        <span class="ps-chapter">Глава 1 <span>· Запуск робота</span></span>
      </header>
      <section class="ps-progress" aria-label="Прогресс главы">
        <div class="ps-progress-copy"><span>Глава 1 · Запуск робота</span><strong class="ps-progress-label"></strong></div>
        <div class="ps-progress-meter" role="progressbar" aria-label="Выполненные задания" aria-valuemin="0" aria-valuemax="${lessons.length}" aria-valuenow="0"><span class="ps-progress-fill"></span></div>
      </section>
      <div class="ps-layout">
        <aside class="ps-station" aria-label="Состояние станции">
          <div class="ps-view">
            <canvas class="ps-canvas" width="540" height="360" aria-hidden="true"></canvas>
            <div class="ps-view-readout"><span class="ps-signal" aria-hidden="true"></span><span id="ps-system" role="status"></span></div>
            <button class="ps-orbit" data-ps-action="orbit" type="button" aria-label="Повернуть станцию" title="Повернуть станцию">↻</button>
          </div>
          <nav class="ps-route" aria-label="Маршрут заданий главы"></nav>
        </aside>
        <div class="ps-work"></div>
      </div>
    </div>`;
  const find = selector => mount.querySelector(selector);
  const work = find(".ps-work"), route = find(".ps-route");
  const view = stationView(find("canvas"));

  function persist() {
    try { localStorage.setItem(key, JSON.stringify(state)); storageWarning = false; }
    catch { storageWarning = true; }
    const notice = find(".ps-storage");
    if (notice) notice.hidden = !storageWarning;
  }

  function updateStation() {
    find("#ps-system").textContent = stationStatus[state.completed];
    find(".ps-view").dataset.online = String(state.completed > 0);
    find(".ps-shell").dataset.view = screenMode;
    const meter = find(".ps-progress-meter");
    const progressLabel = find(".ps-progress-label");
    meter.setAttribute("aria-valuenow", String(state.completed));
    meter.setAttribute("aria-valuetext", `${state.completed} из ${lessons.length} заданий`);
    progressLabel.textContent = state.completed === lessons.length
      ? `Все ${lessons.length} заданий пройдены`
      : `${state.completed} из ${lessons.length} заданий`;
    find(".ps-progress-fill").style.transform = `scaleX(${state.completed / lessons.length})`;
    view.setProgress(state.completed);
    route.innerHTML = lessons.map((lesson, step) => {
      const completed = step < state.completed;
      const available = step === state.completed && state.completed < lessons.length;
      const status = completed ? "Пройдено" : available ? "Доступно" : "Закрыто";
      const badge = completed ? "✓" : available ? String(step + 1).padStart(2, "0") : `<svg viewBox="0 0 24 24" focusable="false"><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><rect x="5" y="10" width="14" height="11" rx="2"></rect></svg>`;
      return `
        <button class="ps-route-node ${completed ? "is-complete" : available ? "is-current" : "is-locked"}" type="button" data-ps-step="${step}"
          aria-label="${encode(lesson.name)}, этап ${step + 1} из ${lessons.length}, ${status}"
          ${available ? 'aria-current="step"' : ""} ${step > state.completed ? "disabled" : ""}>
          <span class="ps-route-badge" aria-hidden="true">${badge}</span>
          <span class="ps-route-copy"><strong class="ps-route-text">${lesson.system}</strong><span class="ps-route-status">${status}</span></span>
        </button>`;
    }).join("");
  }

  function outputMarkup(result) {
    if (!result) return "";
    const lines = result.output.join("\n");
    if (result.error) return (lines ? lines + "\n" : "") + result.error.name + " · " + result.error.message;
    return lines || (result.variables.has("energy") ? "energy = " + JSON.stringify(result.variables.get("energy")) : "Команда выполнена");
  }

  function answerMarkup(lesson, answer) {
    if (lesson.choices) return `<div class="ps-options" role="group" aria-label="Варианты ответа">${lesson.choices.map((choice, number) => `
      <button type="button" data-ps-choice="${number}" aria-pressed="${number === answer}"><code>${encode(choice)}</code></button>`).join("")}</div>`;
    if (lesson.fragments) return `<div class="ps-order">
      <div class="ps-fragments" role="group" aria-label="Строки для сборки программы">${lesson.fragments.map((line, number) => `
        <button type="button" data-ps-fragment="${number}" ${answer.includes(number) ? "disabled" : ""}><code>${encode(line)}</code></button>`).join("")}</div>
      <div class="ps-program" aria-label="Собранные строки">${answer.length ? answer.map((number, spot) => `
        <button type="button" data-ps-remove="${spot}" aria-label="Убрать строку ${spot + 1}"><span>${spot + 1}</span><code>${encode(lesson.fragments[number])}</code><span aria-hidden="true">×</span></button>`).join("") : "<p>Здесь появятся собранные строки</p>"}</div></div>`;
    const attrs = `id="ps-input" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="${MAX_SOURCE - (lesson.before?.length ?? 0) - (lesson.after?.length ?? 0)}"`;
    const field = lesson.before
      ? `<div class="ps-edited-line"><code>${encode(lesson.before)}</code><input ${attrs} type="text" value="${encode(answer)}" placeholder="…"><code>${encode(lesson.after ?? "")}</code></div>`
      : `<textarea ${attrs} rows="3" placeholder="# Напиши команды здесь">${encode(answer)}</textarea>`;
    return field + `<div class="ps-keys" role="group" aria-label="Символы для кода">${['"', "'", "(", ")", "=", "-"].map(key =>
      `<button type="button" data-ps-key="${encode(key)}" aria-label="Вставить символ ${encode(key)}">${encode(key)}</button>`).join("")}</div>`;
  }

  function render(focus) {
    updateStation();
    if (screenMode === "map") {
      const complete = state.completed === lessons.length;
      const next = lessons[complete ? 0 : state.completed];
      work.innerHTML = `<section class="ps-map-card">
        <span class="ps-kicker">${complete ? "Глава завершена" : "Маршрут обучения"}</span>
        <h2 class="ps-map-title" tabindex="-1">Запуск робота</h2>
        <p class="ps-map-description">5 уроков и финальная миссия</p>
        ${complete ? "" : `<div class="ps-map-next"><span>Следующий этап</span><strong>${encode(next.name)}</strong></div>`}
        <button class="ps-primary ps-map-start" type="button" data-ps-action="begin">${complete ? "Повторить уроки" : state.completed ? "Продолжить обучение" : "Начать обучение"}<span aria-hidden="true">→</span></button>
        <p class="ps-storage" role="status" ${storageWarning ? "" : "hidden"}>Не удалось сохранить прогресс на этом устройстве.</p>
      </section>`;
      if (focus) find(focus)?.focus({ preventScroll: true });
      return;
    }
    const lesson = lessons[index];
    if (!lesson) {
      work.innerHTML = `<article class="ps-lesson ps-finish">
        <span class="ps-kicker">6 из 6 заданий</span><h2 tabindex="-1">Маяк включён</h2>
        <p>Робот вернулся на станцию. Ты отправил сообщение, поработал с переменными и рассчитал заряд на весь маршрут.</p>
        <div class="ps-final-charge"><span>Заряд после поездки</span><strong>9</strong></div>
        <div class="ps-actions"><button class="ps-primary" type="button" data-ps-action="map">К маршруту</button><button class="ps-secondary" type="button" data-ps-step="0">Повторить уроки</button></div>
        <p class="ps-storage" role="status" ${storageWarning ? "" : "hidden"}>Не удалось сохранить прогресс на этом устройстве.</p>
      </article>`;
    } else {
      const answer = state.drafts[index];
      work.innerHTML = `<article class="ps-lesson">
        <button class="ps-map-back" type="button" data-ps-action="map"><span aria-hidden="true">←</span> Карта главы</button>
        <span class="ps-kicker">${lesson.mission ? "Задание 6 / 6 · Миссия" : "Урок " + (index + 1) + " / 5"}</span>
        <h2 tabindex="-1">${lesson.name}</h2>
        <p class="ps-explanation">${lesson.explanation}</p>
        ${lesson.example ? `<div class="ps-example"><div class="ps-code-label"><span>Пример</span><button class="ps-example-run" type="button" data-ps-action="example"><span aria-hidden="true">▷</span> Запустить</button></div>
          <pre><code>${colorCode(lesson.example)}</code></pre><pre class="ps-example-out" role="status" ${exampleShown ? "" : "hidden"}>${exampleShown ? encode(outputMarkup(runPython(lesson.example))) : ""}</pre></div>` : ""}
        <form class="ps-task">
          ${lesson.choices || lesson.fragments
            ? `<p class="ps-task-label">${lesson.task}</p>`
            : `<label class="ps-task-label" for="ps-input">${lesson.task}</label>`}
          ${lesson.prefix ? `<pre class="ps-preset"><code>${colorCode(lesson.prefix)}</code></pre>` : ""}
          <div class="ps-answer">${answerMarkup(lesson, answer)}</div>
          <div class="ps-feedback" role="status" aria-atomic="true"></div>
          <div class="ps-hint" role="status" ${hint ? "" : "hidden"}>${hint ? lesson.hints[hint - 1] : ""}</div>
          <div class="ps-actions">
            <button class="ps-primary" type="${outcome?.ok ? "button" : "submit"}" ${outcome?.ok ? 'data-ps-action="next"' : ""}>${outcome?.ok ? (index === lessons.length - 1 ? "К итогам" : "Дальше") : "Проверить"} <span aria-hidden="true">→</span></button>
            <button class="ps-secondary" type="button" data-ps-action="hint" ${hint === lesson.hints.length || outcome?.ok ? "disabled" : ""}>${hint ? "Ещё подсказка" : "Подсказка"}</button>
          </div>
          <p class="ps-storage" role="status" ${storageWarning ? "" : "hidden"}>Не удалось сохранить прогресс на этом устройстве.</p>
        </form>
      </article>`;
      updateFeedback();
    }
    if (focus) find(focus)?.focus({ preventScroll: true });
  }

  function updateFeedback() {
    const feedback = find(".ps-feedback");
    feedback.replaceChildren();
    if (!outcome) return;
    feedback.dataset.result = outcome.ok ? "pass" : "retry";
    const copy = document.createElement("p");
    copy.textContent = outcome.message;
    feedback.append(copy);
    const result = outputMarkup(outcome);
    if (result) {
      const output = document.createElement("pre");
      output.textContent = result;
      feedback.append(output);
    }
  }

  function select(step) {
    document.querySelector("#main").scrollTop = 0;
    screenMode = "lesson";
    index = step;
    hint = 0;
    outcome = null;
    exampleShown = false;
    render(".ps-work h2");
  }

  function showMap() {
    document.querySelector("#main").scrollTop = 0;
    screenMode = "map";
    index = state.completed < lessons.length ? state.completed : 0;
    hint = 0;
    outcome = null;
    exampleShown = false;
    render(".ps-header h1");
  }

  function record(value) {
    state.drafts[index] = value;
    persist();
    if (outcome?.ok) {
      outcome = null;
      const primary = find(".ps-primary");
      primary.type = "submit";
      delete primary.dataset.psAction;
      primary.textContent = "Проверить";
      find('[data-ps-action="hint"]').disabled = hint >= lessons[index].hints.length;
      updateFeedback();
    } else if (outcome) {
      outcome = null;
      updateFeedback();
    }
  }

  mount.addEventListener("input", event => {
    if (event.target.id === "ps-input") record(event.target.value);
  });
  mount.addEventListener("keydown", event => {
    if (event.target.matches("textarea") && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      const submit = find(".ps-primary[type=submit]");
      if (submit) {
        event.preventDefault();
        submit.form.requestSubmit(submit);
      }
    }
  });
  mount.addEventListener("submit", event => {
    if (!event.target.matches(".ps-task")) return;
    event.preventDefault();
    const lesson = lessons[index], draft = state.drafts[index];
    if (draft === -1 || !lessonSource(index, draft).trim() || (typeof draft === "string" && !draft.trim())) {
      outcome = { ok: false, message: "Добавь ответ и проверь его.", output: [], variables: new Map() };
    } else outcome = checkLesson(index, draft);
    if (!outcome.ok) {
      updateFeedback();
      return;
    }
    state.completed = Math.max(state.completed, index + 1);
    persist();
    render('[data-ps-action="next"]');
  });
  mount.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    const { psStep, psAction, psChoice, psFragment, psRemove, psKey } = button.dataset;
    if (psStep !== undefined) {
      select(Number(psStep));
    } else if (psAction === "orbit") {
      view.rotate();
    } else if (psAction === "map") {
      showMap();
    } else if (psAction === "begin") {
      select(state.completed < lessons.length ? state.completed : 0);
    } else if (psAction === "next") {
      select(index + 1);
    } else if (psAction === "example") {
      exampleShown = true;
      const exampleOutput = find(".ps-example-out");
      exampleOutput.hidden = false;
      exampleOutput.textContent = outputMarkup(runPython(lessons[index].example));
    } else if (psAction === "hint") {
      hint++;
      const box = find(".ps-hint");
      box.hidden = false;
      box.textContent = lessons[index].hints[hint - 1];
      button.textContent = "Ещё подсказка";
      if (hint >= lessons[index].hints.length) {
        button.disabled = true;
        find(".ps-primary").focus();
      }
    } else if (psChoice !== undefined) {
      record(Number(psChoice));
      find(".ps-options").querySelectorAll("button").forEach(option =>
        option.setAttribute("aria-pressed", String(option.dataset.psChoice === psChoice)));
    } else if (psFragment !== undefined || psRemove !== undefined) {
      const draft = [...state.drafts[index]];
      if (psFragment !== undefined) draft.push(Number(psFragment));
      else draft.splice(Number(psRemove), 1);
      record(draft);
      find(".ps-answer").innerHTML = answerMarkup(lessons[index], draft);
      (find('[data-ps-fragment]:not(:disabled)') || find(".ps-primary")).focus();
    } else if (psKey !== undefined) {
      const field = find("#ps-input");
      if (!field) return;
      const start = field.selectionStart, end = field.selectionEnd;
      if (field.value.length - end + start + psKey.length > field.maxLength) return;
      field.setRangeText(psKey, start, end, "end");
      const value = field.value;
      record(value);
      const current = find("#ps-input");
      current.focus();
      current.setSelectionRange(start + psKey.length, start + psKey.length);
    }
  });

  return {
    onScreen(screen) {
      const nextVisible = screen === "python-station";
      if (nextVisible === visible) return;
      visible = nextVisible;
      view.show(visible);
      if (visible) showMap();
      else if (screen === "home") queueMicrotask(() => document.querySelector('[data-screen-link="python-station"]')?.focus());
    },
  };
}
