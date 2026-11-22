export const MAX_COURSE_SOURCE = 8000;

export function createCourseRunner() {
  let worker;
  let pending;
  let sequence = 0;

  function finish(result, discard = false) {
    if (discard) {
      worker?.terminate();
      worker = undefined;
    }
    if (!pending) return;
    const { resolve, timer } = pending;
    pending = undefined;
    clearTimeout(timer);
    resolve(result);
  }

  const fail = (message, name = "Python") => ({
    ok: false, output: [], error: { name, message },
  });

  function start() {
    if (worker) return;
    worker = new Worker(new URL("./course-worker.mjs?v=1", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (!pending || pending.id !== data.id) return;
      if (data.running) {
        clearTimeout(pending.timer);
        pending.timer = setTimeout(() => finish(fail(
          "Код выполнялся слишком долго. Проверь, когда останавливается цикл.",
          "Время выполнения",
        ), true), 4000);
        pending.onRunning?.();
        return;
      }
      finish(data.result, data.restart === true);
    };
    worker.onerror = event => {
      event.preventDefault();
      finish(fail("Не удалось открыть учебный Python. Попробуй запустить снова."), true);
    };
  }

  return {
    cancel() {
      if (pending) finish(fail("Выполнение остановлено."), true);
    },
    run(code, cases = [{}], display = "", onRunning) {
      if (pending) return Promise.resolve(fail("Дождись окончания текущего запуска."));
      if (!code.trim()) return Promise.resolve(fail("Напиши код и запусти его."));
      if (code.length > MAX_COURSE_SOURCE) return Promise.resolve(fail("Сократи программу до 8000 символов."));
      return new Promise(resolve => {
        const id = ++sequence;
        pending = {
          id, resolve, onRunning,
          timer: setTimeout(() => finish(fail("Python долго загружается. Запусти код ещё раз."), true), 45000),
        };
        try {
          start();
          worker.postMessage({ id, request: { code, cases, display } });
        } catch {
          finish(fail("Не удалось открыть учебный Python. Попробуй запустить снова."), true);
        }
      });
    },
  };
}
