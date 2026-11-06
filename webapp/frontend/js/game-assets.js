"use strict";

const CHESS_LEVELS = [
  {id:"beginner",label:"Начальный",name:"Новичок",description:"Часто ошибается. Подойдёт для первых партий и знакомства с правилами.",skill:0,depth:2,time:120,random:.55},
  {id:"casual",label:"Легко",name:"Любитель",description:"Замечает взятия, но оставляет возможности для твоих комбинаций.",skill:2,depth:5,time:250,random:.12},
  {id:"club",label:"Средне",name:"Клубный игрок",description:"Следит за защитой фигур и находит простые тактические идеи.",skill:7,depth:8,time:500,random:0},
  {id:"expert",label:"Сложно",name:"Эксперт",description:"Просчитывает комбинации. За незащищённые фигуры придётся отвечать.",skill:13,depth:12,time:1000,random:0},
  {id:"master",label:"Очень сложно",name:"Мастер",description:"Точная игра и глубокий расчёт. Потребует внимательности в каждом ходе.",skill:18,depth:16,time:1800,random:0},
  {id:"grandmaster",label:"Ультрасложно",name:"Гроссмейстер",description:"Максимальная сила в этой игре. Серьёзное испытание без намеренных ошибок.",skill:20,depth:20,time:3000,random:0}
];

const GameAssets = (() => {
  const styles = new Map();
  const styleLoads = new Map();
  const controllers = new Map();
  const controllerLoads = new Map();
  const attempts = new Map();
  const factories = {
    chess: async suffix => (await import("/static/js/chess-mode.js?v=lazy-catalog-1" + suffix)).createChessController,
    poker: async suffix => (await import("/static/js/poker-mode.js?v=lazy-catalog-2" + suffix)).createPokerController,
    "neon-frontier": async suffix => (await import("/static/js/neon-frontier-mode.mjs?v=2" + suffix)).createNeonFrontierController,
  };
  document.querySelectorAll("template[data-game-style]").forEach(slot => {
    const group = slot.dataset.gameStyle;
    if (!styles.has(group)) styles.set(group, []);
    styles.get(group).push(slot);
  });
  const status = document.querySelector("#gameResourcesStatus");
  let ticket = 0;
  let feedback = 0;

  function cancel() {
    ticket++;
    clearTimeout(feedback);
    status.textContent = "";
  }

  function style(slot) {
    if (styleLoads.has(slot)) return styleLoads.get(slot);
    const pending = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      const finish = error => {
        clearTimeout(timeout);
        link.onload = link.onerror = null;
        if (error) {
          link.remove();
          styleLoads.delete(slot);
          reject(error);
        } else {
          slot.dataset.ready = "true";
          resolve();
        }
      };
      const timeout = setTimeout(() => finish(new Error("Style timed out")), 20000);
      link.onload = () => finish();
      link.onerror = () => finish(new Error("Style unavailable"));
      link.rel = "stylesheet";
      link.href = slot.dataset.src;
      slot.after(link);
    });
    styleLoads.set(slot, pending);
    return pending;
  }

  function controller(group) {
    if (!factories[group]) return null;
    if (!controllerLoads.has(group)) {
      const attempt = attempts.get(group) || 0;
      let timeout;
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Game module timed out")), 20000);
      });
      const pending = Promise.race([factories[group](attempt ? "&retry=" + attempt : ""), deadline]).then(create => {
        controllers.set(group, create());
      }).catch(error => {
        controllerLoads.delete(group);
        attempts.set(group, attempt + 1);
        throw error;
      }).finally(() => clearTimeout(timeout));
      controllerLoads.set(group, pending);
    }
    return controllerLoads.get(group);
  }

  function enter(group, action) {
    cancel();
    const links = styles.get(group) || [];
    if (links.every(link => link.dataset.ready) && (!factories[group] || controllers.has(group))) return action();
    const current = ticket;
    feedback = setTimeout(() => { if (current === ticket) status.textContent = "Загружаем файлы игры…"; }, 150);
    return Promise.all([...links.map(style), controller(group)]).then(() => {
      if (current === ticket) { cancel(); return action(); }
    }, () => {
      if (current === ticket) {
        cancel();
        status.textContent = "Не удалось загрузить игру. Проверь связь и нажми ещё раз.";
        feedback = setTimeout(() => { status.textContent = ""; }, 4500);
      }
    });
  }

  return { enter, cancel, controller: group => controllers.get(group) };
})();

const ChessMode = {
  enter() { return showScreen("chess"); },
  getResume() {
    const run = saved.chess;
    return run && !run.ended ? {type:"chess", lastTouchedAt:run.lastTouchedAt, level:run.level} : null;
  },
  onScreen(name) { GameAssets.controller("chess")?.onScreen(name); },
  invalidateCloud() { GameAssets.controller("chess")?.invalidateCloud(); },
  resume() { return GameAssets.enter("chess", () => GameAssets.controller("chess").resume()); },
  click(target) {
    if (!target.dataset.chessAction && !target.hasAttribute("data-chess-promote")) return false;
    GameAssets.enter("chess", () => GameAssets.controller("chess").click(target));
    return true;
  },
};

const PokerMode = {
  getResume() {
    const run = saved.poker;
    return run ? {type:"poker", lastTouchedAt:run.lastTouchedAt, mode:run.mode} : null;
  },
  onScreen(name) { GameAssets.controller("poker")?.onScreen(name); },
  resume() { return GameAssets.enter("poker", () => GameAssets.controller("poker").resume()); },
  click(target) {
    if (!target.dataset.pokerAction) return false;
    GameAssets.enter("poker", () => GameAssets.controller("poker").click(target));
    return true;
  },
};
