import { WIDTH, HEIGHT, SECTORS, newFlight, stepFlight } from "./neon-frontier/flight.mjs?v=5";
import { createPainter, RENDER_SCALE } from "./neon-frontier/art.mjs?v=5";
import { rewardFor } from "./neon-frontier/economy.mjs?v=2";
import { createDepot } from "./neon-frontier/depot.mjs?v=3";
import { cannonProfile } from "./neon-frontier/guns.mjs?v=1";

const STEP = 1 / 60;
const CONTROLS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};
const format = score => String(score).padStart(6, "0");

export function createNeonFrontierController() {
  const mount = document.querySelector("#neonFrontierMount");
  mount.innerHTML = `
    <div class="neon-shell" hidden>
      <header class="neon-header">
        <div class="neon-nav">
          <button class="neon-button neon-back" data-neon="dock" type="button">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4m0 0 5-5m-5 5 5 5"/></svg>
            Меню
          </button>
          <h1 id="neonFrontierTitle">Неоновый рубеж</h1>
          <button class="neon-button neon-pause" type="button" aria-label="Пауза" title="Пауза (P или Esc)" data-neon="pause">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10m6-10v10"/></svg>
          </button>
        </div>
        <dl class="neon-hud">
          <div><dt>Сектор</dt><dd data-neon="sector">01/02</dd></div>
          <div><dt>Корпус</dt><dd data-neon="hull"></dd></div>
          <div><dt data-neon="gun-label">Огонь</dt><dd data-neon="weapon">I</dd></div>
          <div><dt>Очки</dt><dd data-neon="score">000000</dd></div>
        </dl>
      </header>
      <div class="neon-stage">
        <div class="neon-field">
          <canvas width="${WIDTH * RENDER_SCALE}" height="${HEIGHT * RENDER_SCALE}" tabindex="-1" aria-label="Игровое поле" aria-describedby="neonControls"></canvas>
          <div class="neon-boss" data-neon="boss" hidden>
            <div><span data-neon="boss-name"></span><span data-neon="boss-phase"></span></div>
            <progress aria-label="Прочность босса" data-neon="boss-hull"></progress>
          </div>
          <p class="neon-signal" data-neon="signal" role="status" hidden></p>
          <div class="neon-layer">
            <section class="neon-panel" aria-labelledby="neonPanelTitle">
              <p class="neon-code" data-neon="code"></p>
              <h2 id="neonPanelTitle" tabindex="-1"></h2>
              <p class="neon-detail" data-neon="detail"></p>
              <p class="neon-best"><span>Твой рекорд</span> <strong data-neon="best"></strong></p>
              <p class="neon-bounty" data-neon="bounty" role="status" hidden></p>
              <button class="neon-button" type="button" data-neon="retry-reward" hidden>Сохранить награду</button>
              <button class="neon-button neon-start" type="button" data-neon="start"></button>
              <button class="neon-button neon-depot-button" type="button" data-neon="return">В меню</button>
            </section>
          </div>
        </div>
      </div>
      <footer class="neon-footer" id="neonControls">
        <span class="neon-keyboard">WASD / стрелки</span>
        <span class="neon-touch">Веди корабль пальцем</span>
        <span>Автоогонь</span>
      </footer>
    </div>`;
  const pick = name => mount.querySelector('[data-neon="' + name + '"]');
  const shell = mount.querySelector(".neon-shell");
  const canvas = mount.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D unavailable");
  let paint;
  const layer = mount.querySelector(".neon-layer");
  const title = mount.querySelector("#neonPanelTitle");
  const start = pick("start");
  const pauseButton = pick("pause");
  const sector = pick("sector");
  const hull = pick("hull");
  const weapon = pick("weapon");
  const gunLabel = pick("gun-label");
  const score = pick("score");
  const boss = pick("boss");
  const bossName = pick("boss-name");
  const bossPhase = pick("boss-phase");
  const bossHull = pick("boss-hull");
  const signal = pick("signal");
  const bounty = pick("bounty");
  const retryReward = pick("retry-reward");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const keys = new Set();
  let active = false;
  let status = "ready";
  let run = null;
  let pointer = null;
  let target = null;
  let frame = 0;
  let previous = 0;
  let accumulator = 0;
  let previousHud = "";
  let payout = null;

  function clearInput() {
    keys.clear();
    const id = pointer;
    pointer = null;
    target = null;
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  function updateHud() {
    const index = run?.sector ?? 0;
    const maxHull = run.build.hull;
    const health = run.player.hull;
    const level = run?.weapon ?? 1;
    const points = run?.score ?? 0;
    const commander = run?.boss;
    const notice = run?.phase === "transit" ? "Орбита свободна · ремонт корпуса"
      : commander && commander.age < 1.35 ? "Командир в зоне"
      : run?.phase === "waves" && run.clock < 1.65 ? SECTORS[index].name : "";
    const key = [index, maxHull, health, level, points, run.gun, commander?.hp, notice].join("|");
    if (previousHud === key) return;
    previousHud = key;
    sector.textContent = `0${index + 1}/0${SECTORS.length}`;
    hull.setAttribute("aria-label", `${health} из ${maxHull}`);
    hull.innerHTML = Array.from({ length: maxHull }, (_, i) =>
      `<span aria-hidden="true" class="${i < health ? "intact" : ""}"></span>`).join("");
    weapon.textContent = ["I", "II", "III"][level - 1];
    gunLabel.textContent = cannonProfile(run.build.parts.cannon).label;
    score.textContent = format(points);
    boss.hidden = !commander;
    if (commander) {
      bossName.textContent = SECTORS[index].boss;
      bossPhase.textContent = commander.hp <= commander.maxHp / 2 ? "ФАЗА 02" : "ФАЗА 01";
      bossHull.max = commander.maxHp;
      bossHull.value = commander.hp;
    }
    if (signal.textContent !== notice) signal.textContent = notice;
    signal.hidden = !notice;
  }

  function updatePanel(focus) {
    mount.dataset.state = status;
    layer.hidden = status === "playing";
    pauseButton.disabled = status !== "playing" && status !== "paused";
    pauseButton.setAttribute("aria-label", status === "paused" ? "Продолжить вылет" : "Пауза");
    pauseButton.title = status === "paused" ? "Продолжить (P или Esc)" : "Пауза (P или Esc)";
    if (status === "playing") {
      if (focus) canvas.focus({ preventScroll: true });
      return;
    }
    const copy = {
      paused: ["ПОЛЁТ ПРИОСТАНОВЛЕН", "Пауза", SECTORS[run?.sector ?? 0].name, "Продолжить"],
      lost: ["СВЯЗЬ ПОТЕРЯНА", "Корабль сбит", `Сектор 0${(run?.sector ?? 0) + 1} · ${run?.score ?? 0} очков`, "Новый вылет"],
      won: ["ЦЕЛЬ ВЫПОЛНЕНА", "Рубеж пройден", `Оба командира уничтожены · ${run?.score ?? 0} очков`, "Новый вылет"],
    };
    const [code, heading, detail, action] = copy[status];
    pick("code").textContent = code;
    title.textContent = heading;
    pick("detail").textContent = detail;
    pick("best").textContent = format(Math.max(run.score, depot.best));
    bounty.hidden = !payout;
    bounty.textContent = !payout ? "" : payout.saving ? "Сохраняем добычу…" :
      payout.saved ? `Добыча за вылет · +${payout.amount} монет` : "Награда ждёт сохранения";
    retryReward.hidden = !payout || payout.saving || payout.saved;
    start.disabled = Boolean(payout?.saving);
    start.textContent = action;
    if (focus) (start.disabled ? title : start).focus({ preventScroll: true });
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    clearInput();
  }

  async function settle(result) {
    if (result.saving || result.saved) return;
    result.saving = true;
    updatePanel(false);
    result.saved = await depot.reward(result.score, result.amount);
    result.saving = false;
    if (payout === result && active && !shell.hidden) updatePanel(document.activeElement === title);
  }

  function tick(now) {
    if (!active || status !== "playing") return;
    accumulator += Math.min(.1, (now - previous) / 1000);
    previous = now;
    let x = 0;
    let y = 0;
    for (const key of keys) {
      x += CONTROLS[key][0];
      y += CONTROLS[key][1];
    }
    const input = { x: Math.sign(x), y: Math.sign(y), target };
    while (accumulator >= STEP) {
      stepFlight(run, input, STEP);
      accumulator -= STEP;
    }
    updateHud();
    paint(run, motion.matches);
    if (run.phase === "lost" || run.phase === "won") {
      stop();
      status = run.phase;
      payout = { score: run.score, amount: rewardFor(run), saving: false, saved: false };
      settle(payout);
      updatePanel(true);
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function play(restart = false) {
    if (!active || status === "playing") return;
    paint ||= createPainter(ctx);
    if (status !== "paused" || restart) run = newFlight(depot.build());
    payout = null;
    depot.hide();
    shell.hidden = false;
    status = "playing";
    accumulator = 0;
    previous = performance.now();
    updateHud();
    paint(run, motion.matches);
    updatePanel(true);
    frame = requestAnimationFrame(tick);
  }

  function pause(focus) {
    if (status !== "playing") return;
    stop();
    status = "paused";
    updatePanel(focus);
  }

  function toggle() {
    if (status === "playing") pause(true);
    else if (status === "paused") play();
  }

  function openDepot(focus) {
    pause(false);
    shell.hidden = true;
    depot.show(focus);
  }

  const depot = createDepot(mount, {
    launch: play, isPaused: () => status === "paused", exit: () => showScreen("home"), motion,
  });

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    target = {
      x: (event.clientX - rect.left) * WIDTH / rect.width,
      y: (event.clientY - rect.top) * HEIGHT / rect.height - (event.pointerType === "touch" ? 24 : 0),
    };
  }

  start.addEventListener("click", () => play());
  pauseButton.addEventListener("click", toggle);
  pick("dock").addEventListener("click", () => openDepot(true));
  pick("return").addEventListener("click", () => openDepot(true));
  retryReward.addEventListener("click", () => { if (payout) settle(payout); });
  canvas.addEventListener("pointerdown", event => {
    if (status !== "playing" || pointer !== null || event.button !== 0) return;
    event.preventDefault();
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    point(event);
  });
  canvas.addEventListener("pointermove", event => { if (event.pointerId === pointer) point(event); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, event => { if (event.pointerId === pointer) clearInput(); });
  }
  document.addEventListener("keydown", event => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
    if (shell.hidden) {
      if (event.code === "Escape" && !event.repeat && depot.back()) event.preventDefault();
      return;
    }
    if (event.code === "KeyP" || event.code === "Escape") {
      if (status !== "playing" && status !== "paused") return;
      event.preventDefault();
      if (!event.repeat) toggle();
    } else if (status === "playing" && Object.hasOwn(CONTROLS, event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  });
  document.addEventListener("keyup", event => keys.delete(event.code));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(false); });
  window.addEventListener("blur", () => pause(false));

  return {
    back() {
      if (shell.hidden) return depot.back();
      openDepot(true);
      return true;
    },
    onScreen(name) {
      if (name !== "neon-frontier") {
        if (!active) return;
        active = false;
        pause(false);
        depot.hide();
        shell.hidden = true;
        if (name === "home") queueMicrotask(() =>
          document.querySelector('#campaignCards [data-screen-link="neon-frontier"]')?.focus({ preventScroll: true }));
        return;
      }
      active = true;
      openDepot(false);
    },
  };
}
