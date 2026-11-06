import {
  CASES, HANGAR_KEY, LEGACY_RECORD, PARTS, PART_IDS, RANK_NAMES, SHIPS, STARTER,
  UPGRADE_IDS, UPGRADE_PRICES, acknowledgeCase, completeFlight, fitModule, openCase,
  restoreHangar, selectShip, shipStats, upgradeShip,
} from "./economy.mjs?v=2";
import { createCargoDialog, crateSvg, dockIcon } from "./cargo.mjs?v=2";
import { moduleSvg, shipSvg } from "./ships.mjs?v=2";

const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const format = value => number.format(value);
const cost = value => `<span class="nf-price">${dockIcon("coin")}${format(value)}</span>`;
const roman = ["—", "I", "II", "III"];

function readProfile() {
  const legacy = Number(localStorage.getItem(LEGACY_RECORD));
  const raw = localStorage.getItem(HANGAR_KEY);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { /* Rebuild a corrupt local record. */ }
  return restoreHangar(parsed, legacy);
}

function bay(id, parts, { hero = false, exploded = false, selected = "", trial = false } = {}) {
  const ship = SHIPS[id];
  return `<figure class="nf-bay${hero ? " nf-bay-hero" : ""}${exploded ? " nf-bay-exploded" : ""}"
      style="--ship-ink:${ship.color};--slot-ink:${PARTS[selected]?.ink ?? ship.color}">
    <span class="nf-bay-mark">${ship.code}</span>
    <span class="nf-bay-reticle" aria-hidden="true"></span>
    ${shipSvg(id, "nf-bay-ship", parts, { exploded, selected: exploded || trial ? selected : "" })}
    <figcaption>${trial ? "<span>Примерка</span>" : `<span>${ship.role}</span>`}<strong>${ship.name}</strong></figcaption>
    ${hero ? "" : `<button class="nf-button nf-explode" type="button" data-depot="explode">${dockIcon("assembly")}${exploded ? "Собрать" : "Разобрать"}</button>`}
  </figure>`;
}

function statList(stats) {
  return `<dl class="nf-stats">
    <div><dt>Корпус</dt><dd>${stats.hull}</dd></div>
    <div><dt>Скорость</dt><dd>${stats.speed}</dd></div>
    <div><dt>Урон</dt><dd>${format(stats.damage)}</dd></div>
    <div><dt title="Длительность щита после попадания">Щит</dt><dd>${format(stats.guard)} с</dd></div>
  </dl>`;
}

function menu(profile, paused) {
  return `<div class="nf-hero">
    <div class="nf-hero-heading">
      <p class="nf-code">ОРБИТАЛЬНЫЙ ДОК / 07</p>
      <h1 tabindex="-1" class="nf-title">Неоновый <span>рубеж</span></h1>
      <p class="nf-intro">Зачисти два сектора и вернись в док с добычей.</p>
    </div>
    ${bay(profile.active, shipStats(profile).parts, { hero: true })}
    <div class="nf-hero-actions">
      <button type="button" class="nf-button nf-primary" data-depot="launch">${paused ? "Продолжить вылет" : "Вылет"}${dockIcon("arrow")}</button>
      ${paused ? '<button type="button" class="nf-button nf-quiet" data-depot="restart">Новый вылет</button>' : ""}
      <span class="nf-record"><span>Рекорд</span> <strong>${format(profile.best)}</strong></span>
    </div>
  </div>
  <div class="nf-menu-links" aria-label="Разделы дока">
    <button type="button" data-depot="hangar"><span class="nf-route-number">01</span><span><strong>Ангар</strong><small>Корабли и модули</small></span>${dockIcon("arrow")}</button>
    <button type="button" data-depot="cases"><span class="nf-route-number">02</span><span><strong>Кейсы</strong><small>Модули от 100 монет</small></span>${dockIcon("arrow")}</button>
  </div>`;
}

function upgrades(profile, id) {
  return UPGRADE_IDS.map(part => {
    const level = profile.ships[id][part];
    const price = UPGRADE_PRICES[level];
    return `<div class="nf-upgrade">
      ${dockIcon(part)}
      <div><strong>${PARTS[part].label}</strong><small>${PARTS[part].bonus}</small></div>
      <span class="nf-rungs" aria-label="Уровень ${level} из 3">${UPGRADE_PRICES.map((_, i) =>
        `<i class="${i < level ? "is-lit" : ""}" aria-hidden="true"></i>`).join("")}</span>
      ${price ? `<button class="nf-button" type="button" data-depot="upgrade" data-part="${part}" data-level="${level}"
        aria-label="Улучшить: ${PARTS[part].label} за ${price} монет" ${profile.coins < price ? "disabled" : ""}>${cost(price)}</button>`
      : '<span class="nf-max">Макс.</span>'}
    </div>`;
  }).join("");
}

function moduleEffect(part, rank) {
  if (!rank) return "Базовые характеристики";
  const hull = `+${rank === 3 ? 2 : 1} к прочности`;
  return {
    core: `${hull} · +${format(rank * .08)} с щита`,
    cockpit: `−${rank * 6}% к интервалу между залпами`,
    cannon: `+${format(rank * .12)} к урону`,
    drive: `+${rank * 13} к скорости`,
    armor: `${hull} · +${format(rank * .11)} с щита`,
    reactor: `+${rank * 12}% монет за вылет`,
  }[part];
}

function workshop(profile, id, parts, selected, candidate, owned) {
  const slot = PARTS[selected];
  const installed = parts[selected];
  const rank = candidate ?? installed;
  const unlocked = profile.modules[selected];
  const name = slot.names[rank - 1] ?? "Штатный модуль";
  return `<section class="nf-equipment" aria-label="Конструктор корабля">
    <header><p class="nf-code">СХЕМА СБОРКИ</p><h2>Модули корабля</h2></header>
    <div class="nf-module-list" role="group" aria-label="Детали корабля">${PART_IDS.map(part =>
      `<button class="nf-slot" type="button" data-depot="slot" data-slot="${part}" aria-pressed="${part === selected}" style="--slot-ink:${PARTS[part].ink}">
        ${dockIcon(part)}<span>${PARTS[part].label}</span><small>${roman[parts[part]]}</small>
      </button>`).join("")}</div>
    <div class="nf-workbench" style="--slot-ink:${slot.ink}">
      <div class="nf-variants" role="group" aria-label="${slot.label}: варианты">${[0, 1, 2, 3].map(index =>
        `<button type="button" data-depot="variant" data-variant="${index}" aria-pressed="${rank === index}" data-rank="${index}"
          aria-label="${slot.names[index - 1] ?? "Штатный модуль"}${index > unlocked ? ", закрыт" : index === installed ? ", установлен" : ", доступен"}">
          ${moduleSvg(id, selected, index)}<span>${index ? roman[index] : "Штатный"}</span>
          ${index > unlocked ? dockIcon("lock") : index === installed ? '<i title="Установлен" aria-hidden="true"></i>' : ""}
        </button>`).join("")}</div>
      <div class="nf-workbench-detail">
        <div><p class="nf-code">${slot.label} / ${RANK_NAMES[rank - 1] ?? "Штатный"}</p><h3>${name}</h3>
        <p class="nf-part-effect">${moduleEffect(selected, rank)}</p></div>
        ${!owned ? '<span class="nf-part-state">После покупки корабля</span>' :
          rank === installed ? '<span class="nf-part-state is-installed">Установлен</span>' :
          rank > unlocked ? '<span class="nf-part-state">Выпадает из кейсов</span>' :
          `<button type="button" class="nf-button nf-primary" data-depot="fit" data-variant="${rank}">Установить</button>`}
      </div>
    </div>
  </section>`;
}

function hangar(profile, id, paused, selected, candidate, exploded) {
  const ship = SHIPS[id];
  const owned = Object.hasOwn(profile.ships, id);
  const active = profile.active === id;
  const stats = shipStats(profile, id);
  const trial = candidate !== null && candidate !== stats.parts[selected];
  const display = trial ? { ...stats.parts, [selected]: candidate } : stats.parts;
  return `<header class="nf-view-heading"><p class="nf-code">ОТСЕК 01 / ФЛОТ</p><h1 tabindex="-1">Ангар</h1></header>
    <div class="nf-hangar">
      <div class="nf-hangar-visual">${bay(id, display, { selected, exploded, trial })}
        <div class="nf-fleet" role="group" aria-label="Выбрать корабль">${Object.entries(SHIPS).map(([key, item]) =>
          `<button type="button" data-depot="preview" data-ship="${key}" aria-pressed="${id === key}"
            style="--ship-ink:${item.color}">${shipSvg(key, "", profile.fits[key])}<span>${item.name}</span>
            ${Object.hasOwn(profile.ships, key) ? "" : dockIcon("lock")}</button>`).join("")}</div>
        <div class="nf-ownership">
        ${active ? '<p class="nf-selected">Выбран для вылета</p>' :
          `<button type="button" class="nf-button nf-primary nf-ship-action" data-depot="select" ${!owned && profile.coins < ship.price ? "disabled" : ""}>
            ${owned ? "Выбрать корабль" : `Купить корабль ${cost(ship.price)}`}</button>`}
        ${!owned && profile.coins < ship.price ? `<p class="nf-helper">Не хватает ${format(ship.price - profile.coins)} монет.</p>` : ""}
        </div>
      </div>
      <div class="nf-hangar-controls">
      ${workshop(profile, id, stats.parts, selected, candidate, owned)}
      <div class="nf-fitout">
        <p class="nf-code">${ship.code} / ${ship.role}</p>
        <h2>${ship.name}</h2>
        <p class="nf-ship-description">${ship.description}</p>
        ${statList(stats)}
        ${paused ? '<p class="nf-helper">Сборка применяется со следующего вылета.</p>' : ""}
        <section class="nf-upgrades" aria-label="Прокачка корабля">
          <h3>Прокачка</h3>
          ${owned ? upgrades(profile, id) : '<p class="nf-helper">Откроется после покупки корабля.</p>'}
        </section>
      </div>
      </div>
    </div>`;
}

function caseShop(profile) {
  return `<header class="nf-view-heading">
      <p class="nf-code">ОТСЕК 02 / СНАБЖЕНИЕ</p><h1 tabindex="-1">Кейсы</h1>
      <p>В каждом кейсе один модуль. Выпавший уровень открывает и предыдущие варианты детали. Дубликаты перерабатываются в монеты.</p>
    </header>
    ${profile.pending ? '<button type="button" class="nf-button nf-primary nf-pending" data-depot="pending">Посмотреть выигрыш</button>' : ""}
    <div class="nf-case-grid">${Object.entries(CASES).map(([id, tier]) => `
      <article class="nf-case" style="--case-ink:${tier.color}">
        <div class="nf-case-figure"><span aria-hidden="true">${tier.code}</span>${crateSvg(id)}</div>
        <div class="nf-case-info">
          <h2>${tier.name}</h2>
          <dl class="nf-odds" aria-label="Вероятности выпадения">${tier.odds.map((chance, i) => chance ?
            `<div data-rank="${i + 1}"><dt>${RANK_NAMES[i]}</dt><dd>${chance}%</dd></div>` : "").join("")}</dl>
          <button type="button" class="nf-button" data-depot="open" data-case="${id}"
            aria-label="Открыть ${tier.name.toLowerCase()} кейс за ${tier.price} монет" ${profile.coins < tier.price || profile.pending ? "disabled" : ""}>
            Открыть ${cost(tier.price)}</button>
        </div>
      </article>`).join("")}</div>`;
}

export function createDepot(mount, { launch, isPaused, exit, motion }) {
  const dock = document.createElement("section");
  dock.className = "nf-dock";
  dock.hidden = true;
  dock.innerHTML = `
    <header class="nf-bar">
      <button type="button" class="nf-button nf-back" data-depot="back">${dockIcon("back")}<span>Игры</span></button>
      <p class="nf-brand"><span></span> TERAMONT / АРКАДА</p>
      <p class="nf-wallet" aria-label="Баланс">${cost(120)}</p>
    </header>
    <div class="nf-scroll">
      <div class="nf-content">
        <div class="nf-body"></div>
        <p class="nf-status" role="status"></p>
      </div>
    </div>
    <dialog class="nf-cargo" aria-labelledby="nfCargoTitle"></dialog>`;
  mount.prepend(dock);
  const body = dock.querySelector(".nf-body");
  const wallet = dock.querySelector(".nf-wallet");
  const backButton = dock.querySelector(".nf-back span");
  const notice = dock.querySelector(".nf-status");
  let profile = restoreHangar(null);
  let preview = STARTER;
  let selected = "core";
  let candidate = null;
  let exploded = false;
  let view = "menu";
  let busy = false;

  function refresh() {
    try { profile = readProfile(); } catch (_) { /* The stored profile remains in memory. */ }
  }

  async function transact(change) {
    const apply = () => {
      const next = readProfile();
      const reason = change(next);
      if (reason) {
        profile = readProfile();
        return reason;
      }
      localStorage.setItem(HANGAR_KEY, JSON.stringify(next));
      profile = next;
      return "";
    };
    try {
      return navigator.locks ? await navigator.locks.request(HANGAR_KEY, apply) : apply();
    } catch (_) {
      return "Не удалось сохранить изменения. Попробуй ещё раз.";
    }
  }

  function render(focusSelector, resetScroll = false) {
    wallet.innerHTML = cost(profile.coins);
    wallet.setAttribute("aria-label", `Баланс: ${profile.coins} монет`);
    backButton.textContent = view === "menu" ? "Игры" : "Меню";
    body.innerHTML = view === "menu" ? menu(profile, isPaused()) :
      view === "hangar" ? hangar(profile, preview, isPaused(), selected, candidate, exploded) : caseShop(profile);
    if (resetScroll) dock.querySelector(".nf-scroll").scrollTop = 0;
    if (focusSelector && !dock.hidden) {
      const target = body.querySelector(focusSelector);
      (target && !target.disabled ? target : body.querySelector("h1")).focus({preventScroll: true});
    }
  }

  function navigate(next, focus = true) {
    view = next;
    notice.textContent = "";
    render(focus ? "h1" : "", true);
  }

  const cargo = createCargoDialog(dock.querySelector(".nf-cargo"), motion, async (prize, tryModule) => {
    const error = await transact(next => acknowledgeCase(next, prize.id));
    if (error) return false;
    if (!dock.hidden) {
      if (tryModule) {
        preview = profile.active;
        selected = prize.part;
        candidate = prize.rank;
        exploded = false;
        navigate("hangar", false);
      } else render();
      // The opener was replaced when the case receipt was committed.
      setTimeout(() => { if (!dock.hidden && !cargo.open) body.querySelector("h1")?.focus(); });
    }
    return true;
  });

  function back() {
    if (cargo.back()) return true;
    if (busy) return true;
    if (view === "menu") return false;
    navigate("menu");
    return true;
  }

  dock.addEventListener("click", async event => {
    const button = event.target.closest("button[data-depot]");
    if (!button || button.disabled || busy || cargo.open) return;
    const action = button.dataset.depot;
    if (action === "back") {
      if (!back()) exit();
    } else if (action === "launch" || action === "restart") {
      if (action === "restart" && !window.confirm("Начать новый вылет? Добыча приостановленного вылета будет потеряна.")) return;
      refresh();
      launch(action === "restart");
    } else if (action === "hangar" || action === "cases") {
      refresh();
      if (action === "hangar") {
        preview = profile.active;
        candidate = null;
      }
      navigate(action);
    } else if (action === "preview") {
      preview = button.dataset.ship;
      candidate = null;
      render(`[data-ship="${preview}"]`);
    } else if (action === "explode") {
      exploded = !exploded;
      render("[data-depot=explode]");
    } else if (action === "slot") {
      selected = button.dataset.slot;
      candidate = null;
      render(`[data-slot="${selected}"]`);
    } else if (action === "variant") {
      candidate = Number(button.dataset.variant);
      render(`[data-depot=variant][data-variant="${candidate}"]`);
    } else if (action === "pending") {
      if (profile.pending) cargo.show(profile.pending, false);
    } else if (["select", "upgrade", "open", "fit"].includes(action)) {
      busy = true;
      const id = preview;
      const { part, level, case: caseId, variant } = button.dataset;
      const change = action === "select" ? next => selectShip(next, id) :
        action === "upgrade" ? next => upgradeShip(next, id, part, Number(level)) :
        action === "fit" ? next => fitModule(next, id, selected, Number(variant)) :
          next => openCase(next, caseId);
      const error = await transact(change);
      busy = false;
      if (dock.hidden) return;
      notice.textContent = error || (action === "select" ? `${SHIPS[id].name} выбран для вылета.` :
        action === "upgrade" ? `Улучшение установлено · уровень ${Number(level) + 1}.` :
        action === "fit" ? `Установлено: ${PARTS[selected].names[Number(variant) - 1] ?? "штатный модуль"}.` : "");
      render(action === "upgrade" ? `[data-part="${part}"]` :
        action === "fit" ? `[data-depot=variant][data-variant="${variant}"]` :
        action === "select" ? `[data-ship="${id}"]` : "[data-depot=pending]");
      if (action === "open" && !error) cargo.show(profile.pending, true);
    }
  });

  window.addEventListener("storage", event => {
    if (event.key !== HANGAR_KEY) return;
    refresh();
    if (!dock.hidden && !cargo.open) render();
  });

  return {
    show(focus) {
      refresh();
      dock.hidden = false;
      navigate(profile.pending ? "cases" : "menu", focus);
      if (profile.pending) cargo.show(profile.pending, false);
    },
    hide() {
      cargo.close();
      dock.hidden = true;
    },
    back,
    get best() { return profile.best; },
    build: () => shipStats(profile),
    async reward(score, amount) {
      const error = await transact(next => completeFlight(next, score, amount));
      if (!error && !dock.hidden && !cargo.open) render();
      return !error;
    },
  };
}
