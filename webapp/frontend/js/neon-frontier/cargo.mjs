import { CASES, PARTS, PART_IDS, RANK_NAMES } from "./economy.mjs?v=2";
import { moduleSvg } from "./ships.mjs?v=3";

const ICONS = {
  core: "M8 3h8l4 6v9l-3 3H7l-3-3V9z M8 10l4-3 4 3v5l-4 2-4-2z",
  cockpit: "M12 3c4 0 7 7 7 12v3l-7 3-7-3v-3c0-5 3-12 7-12z M9 15c0-3 1-6 3-8 2 2 3 5 3 8z",
  cannon: "M6 3h3v10h2v6H4v-6h2z M15 3h3v10h2v6h-7v-6h2z M7 19v2m10-2v2",
  drive: "M5 7h14v8H5z M8 7V4h8v3 M8 18v2m4-2v4m4-4v2 M8 10h8",
  armor: "M12 3l7 3v6c0 4-4 7-7 9-3-2-7-5-7-9V6z M8 12l3 3 5-6",
  reactor: "M8 4h8l5 8-5 8H8l-5-8z M12 8l4 4-4 4-4-4z",
  coin: "M8 3h8l5 5v8l-5 5H8l-5-5V8z M12 7v10m-3-8 3-2 3 2",
  back: "M20 12H4m0 0 6-6m-6 6 6 6",
  arrow: "M4 12h16m0 0-6-6m6 6-6 6",
  lock: "M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3",
  assembly: "M3 3h6v6H3z M15 3h6v6h-6z M9 15h6v6H9z M6 9v3h12V9 M12 12v3",
};

export function dockIcon(name) {
  return `<svg class="nf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
}

export function crateSvg(id) {
  return `<svg class="nf-crate" viewBox="0 0 136 104" style="--case-ink:${CASES[id].color}" aria-hidden="true">
    <ellipse cx="68" cy="94" rx="53" ry="6" fill="#060914"/>
    <g class="nf-crate-body">
      <path fill="#18233a" stroke="#65809d" d="M16 46 33 35h80l8 12v29l-13 13H29L16 78z"/>
      <path fill="#243a54" d="M16 50h92v38H29L16 77z"/>
      <path fill="#142238" d="M108 50l13-9v35l-13 12z"/>
      <path fill="#091321" d="M29 60h63v18H29z"/>
      <path fill="#435a72" d="M31 63h54v3H31zm0 7h23v3H31zM21 55h8v26h-5l-3-4zm72 0h9v27h-9z"/>
      <path fill="var(--case-ink)" d="M32 64h18v2H32zm61-6h4v18h-4zm-70 1h3v16h-3zm90 2 3-2v10l-3 2z"/>
      <path stroke="#576c86" fill="none" d="M107 49v38M19 81h6m73 1h6m-73 4h59"/>
    </g>
    <g class="nf-crate-lid">
      <path fill="#263956" stroke="#6b86a7" d="M13 38 34 24h75l15 10v15l-15 9H27L13 49z"/>
      <path fill="#405b76" d="M14 38l21-13h74l14 9-15 11H27z"/>
      <path fill="#30445f" d="M14 39l13 7h81l15-10v12l-15 9H28l-14-8z"/>
      <path fill="#21314c" d="M42 29h53l9 5-9 7H35l-5-4z"/>
      <path fill="var(--case-ink)" d="M47 30h42v2H46zm-13 7h10v2H33zm55 1h12l-3 2H89z"/>
      <path fill="#131d30" stroke="var(--case-ink)" d="M58 45h18v12l-4 5H62l-4-5z"/>
      <path fill="var(--case-ink)" d="M65 49h4v8h-4z"/>
    </g>
  </svg>`;
}

function prizeTile({part, rank}) {
  return `<div class="nf-prize-tile" data-rank="${rank}">${moduleSvg("swift", part, rank)}<span>${PARTS[part].label}</span></div>`;
}

export function createCargoDialog(dialog, motion, onAcknowledge) {
  let timer;
  let receipt;

  function stopTimer() { clearTimeout(timer); }

  function reveal() {
    if (!dialog.open || dialog.dataset.phase === "result") return;
    stopTimer();
    dialog.dataset.phase = "result";
    dialog.querySelector('[data-cargo="confirm"]').focus({preventScroll: true});
  }

  function close() {
    stopTimer();
    if (dialog.open) dialog.close();
  }

  function back() {
    if (!dialog.open) return false;
    if (dialog.dataset.phase !== "result") reveal();
    else dialog.querySelector('[data-cargo="confirm"]').click();
    return true;
  }

  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    back();
  });
  dialog.addEventListener("click", async event => {
    const action = event.target.closest("button")?.dataset.cargo;
    if (action === "skip") reveal();
    if (!["confirm", "fit"].includes(action) || dialog.dataset.phase !== "result" ||
        dialog.querySelector('[data-cargo="confirm"]').disabled) return;
    const actions = dialog.querySelectorAll(".nf-cargo-actions button");
    actions.forEach(button => { button.disabled = true; });
    if (await onAcknowledge(receipt, action === "fit")) close();
    else {
      actions.forEach(button => { button.disabled = false; });
      dialog.querySelector(".nf-cargo-error").textContent = "Сохранение недоступно. Попробуй ещё раз.";
    }
  });
  motion.addEventListener("change", event => { if (event.matches) reveal(); });

  function show(prize, animate) {
    if (dialog.open) return;
    receipt = prize;
    const tier = CASES[prize.caseId];
    const part = PARTS[prize.part];
    const ranks = tier.odds.flatMap((chance, i) => chance ? [i + 1] : []);
    const tiles = Array.from({length: 16}, (_, i) => i === 13 ? prize : {
      part: PART_IDS[Math.floor(Math.random() * PART_IDS.length)],
      rank: ranks[Math.floor(Math.random() * ranks.length)],
    });
    dialog.innerHTML = `
      <header class="nf-cargo-header">
        <p class="nf-code">КОНТЕЙНЕР ${tier.code}</p>
        <h2 id="nfCargoTitle">${tier.name} кейс</h2>
      </header>
      <div class="nf-cargo-window">
        <div class="nf-cargo-crate">${crateSvg(prize.caseId)}<span></span></div>
        <div class="nf-reel" aria-hidden="true"><div class="nf-strip">${tiles.map(prizeTile).join("")}</div></div>
        <div class="nf-cargo-prize" data-rank="${prize.rank}">
          ${moduleSvg("swift", prize.part, prize.rank)}
          <p class="nf-code">${RANK_NAMES[prize.rank - 1]}</p>
          <h3>${part.names[prize.rank - 1]}</h3>
          <p>${prize.refund ? `Дубликат переработан · +${prize.refund} монет` : `${part.label} · ${part.bonus}`}</p>
        </div>
      </div>
      <p class="nf-cargo-error" role="status"></p>
      <button type="button" class="nf-button nf-cargo-skip" data-cargo="skip">Пропустить анимацию</button>
      <div class="nf-cargo-actions">
        <button type="button" class="nf-button" data-cargo="confirm">К кейсам</button>
        ${prize.refund ? "" : '<button type="button" class="nf-button nf-primary" data-cargo="fit">Примерить в ангаре</button>'}
      </div>`;
    dialog.dataset.phase = "charge";
    dialog.showModal();
    if (!animate || motion.matches) {
      reveal();
      return;
    }
    dialog.querySelector('[data-cargo="skip"]').focus({preventScroll: true});
    timer = setTimeout(() => {
      dialog.dataset.phase = "burst";
      timer = setTimeout(() => {
        dialog.dataset.phase = "roll";
        timer = setTimeout(reveal, 2100);
      }, 360);
    }, 840);
  }

  return { show, close, back, get open() { return dialog.open; } };
}
