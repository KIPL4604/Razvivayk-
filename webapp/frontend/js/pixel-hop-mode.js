"use strict";
(() => {
  const frame = document.getElementById("pixelHopFrame");
  const status = document.getElementById("pixelHopStatus");
  const statusText = document.getElementById("pixelHopStatusText");
  const retryButton = document.querySelector('[data-pixel-hop-action="retry"]');
  const gameUrl = "/static/games/pixel-hop-twins/index.html?v=9835295";
  const pointerKeys = new Map();
  const heldPointers = new Map();
  let loadTimer = 0;
  let active = false;

  function art() {
    return '<svg class="game-art pixel-hop-art" viewBox="0 0 384 240" role="img" aria-label="Пиксельный герой на платформе с кристаллом">' +
      '<rect width="384" height="240" fill="#111827"/><path d="M0 138 54 84 105 138 166 57 237 138 303 74 384 151V240H0Z" fill="#27334F"/><path d="M0 172 68 119 135 174 209 111 285 173 344 130 384 160V240H0Z" fill="#34446A"/><g fill="#F4D37A"><rect x="37" y="33" width="5" height="5"/><rect x="93" y="66" width="4" height="4"/><rect x="284" y="34" width="5" height="5"/><rect x="340" y="79" width="4" height="4"/></g><g fill="#7D83F6"><rect x="246" y="105" width="16" height="16"/><rect x="250" y="97" width="8" height="8"/><rect x="250" y="121" width="8" height="8"/></g><g fill="#4FCB9D"><rect x="0" y="193" width="384" height="47"/><rect x="0" y="193" width="384" height="7" fill="#96E8C3"/><rect x="31" y="216" width="22" height="8" fill="#347B67"/><rect x="86" y="205" width="22" height="8" fill="#347B67"/><rect x="141" y="224" width="22" height="8" fill="#347B67"/><rect x="312" y="208" width="22" height="8" fill="#347B67"/></g><g shape-rendering="crispEdges"><rect x="153" y="148" width="26" height="35" fill="#F5C85B"/><rect x="148" y="155" width="7" height="17" fill="#F5C85B"/><rect x="177" y="155" width="7" height="17" fill="#F5C85B"/><rect x="157" y="137" width="18" height="17" fill="#F5C85B"/><rect x="159" y="142" width="4" height="4" fill="#111827"/><rect x="170" y="142" width="4" height="4" fill="#111827"/><rect x="158" y="180" width="7" height="8" fill="#7252A8"/><rect x="169" y="180" width="7" height="8" fill="#7252A8"/></g><rect x="266" y="184" width="74" height="9" fill="#D99163"/><rect x="232" y="184" width="14" height="9" fill="#F4D37A"/><path d="M339 172h30v21h-30z" fill="#D99163"/><path d="M349 172h10v21h-10z" fill="#F4D37A"/></svg>';
  }

  function catalog(filter) {
    const hidden = filter !== "Все" && filter !== "Аркада";
    return '<button class="campaign-card pixel-hop-card" type="button" data-pixel-hop-action="open" ' +
      (hidden ? "hidden" : "") +
      ' aria-label="Pixel Hop Twins. Пиксельный платформер на два уровня. Открыть игру">' + art() +
      '<span class="campaign-card-copy"><span class="campaign-category">Аркада · пиксельный платформер</span>' +
      '<strong>Pixel Hop Twins</strong><span class="campaign-card-progress"><span>2 уровня · кристаллы и двойной прыжок</span>' +
      '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span></button>';
  }

  function sendKey(type, code) {
    const child = frame.contentWindow;
    if (!child) return;
    const key = code === "Space" ? " " : code === "KeyP" ? "p" : code === "KeyM" ? "m" : code;
    child.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, code, key }));
  }

  function press(pointerId, code) {
    const active = heldPointers.get(code) || new Set();
    if (active.has(pointerId)) return;
    if (active.size === 0) sendKey("keydown", code);
    active.add(pointerId);
    heldPointers.set(code, active);
    pointerKeys.set(pointerId, code);
  }

  function release(pointerId) {
    const code = pointerKeys.get(pointerId);
    if (!code) return;
    pointerKeys.delete(pointerId);
    const active = heldPointers.get(code);
    active?.delete(pointerId);
    if (!active?.size) {
      heldPointers.delete(code);
      sendKey("keyup", code);
    }
  }

  function releaseAll() {
    for (const pointerId of [...pointerKeys.keys()]) release(pointerId);
  }

  function beginLoad() {
    window.clearTimeout(loadTimer);
    status.hidden = false;
    status.classList.remove("is-error");
    statusText.textContent = "Загружаем игру…";
    retryButton.hidden = true;
    loadTimer = window.setTimeout(() => showFailure(), 15000);
    if (frame.getAttribute("src") === gameUrl) {
      try { frame.contentWindow.location.reload(); } catch (_) { frame.src = gameUrl; }
    } else {
      frame.src = gameUrl;
    }
  }

  function showFailure() {
    window.clearTimeout(loadTimer);
    status.hidden = false;
    status.classList.add("is-error");
    statusText.textContent = "Не удалось загрузить игру. Проверь подключение и попробуй ещё раз.";
    retryButton.hidden = false;
  }

  function onScreen(name) {
    if (name === "pixel-hop") {
      active = true;
      if (frame.getAttribute("src") !== gameUrl) beginLoad();
      return;
    }
    active = false;
    window.clearTimeout(loadTimer);
    releaseAll();
    if (frame.hasAttribute("src")) frame.removeAttribute("src");
    status.hidden = true;
    status.classList.remove("is-error");
  }

  function click(target, event) {
    if (target.dataset.pixelHopCode) {
      if (event?.detail === 0) {
        const pointerId = `keyboard:${target.dataset.pixelHopCode}`;
        press(pointerId, target.dataset.pixelHopCode);
        window.setTimeout(() => release(pointerId), 120);
      }
      return true;
    }
    if (target.dataset.pixelHopAction === "retry") {
      beginLoad();
      return true;
    }
    return target.dataset.pixelHopAction === "open";
  }

  frame.addEventListener("load", () => {
    if (frame.contentDocument?.readyState === "complete" && !status.classList.contains("is-error")) {
      try { frame.contentWindow.focus(); } catch (_) {}
    }
  });

  window.addEventListener("message", event => {
    if (!active || event.origin !== window.location.origin || event.source !== frame.contentWindow || event.data?.source !== "teramont-pixel-hop") return;
    if (event.data.type === "ready") {
      window.clearTimeout(loadTimer);
      status.hidden = true;
      try { frame.contentDocument?.getElementById("gameCanvas")?.focus({ preventScroll: true }); } catch (_) {}
    } else if (event.data.type === "error") {
      showFailure();
    }
  });

  document.querySelectorAll("[data-pixel-hop-code]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      button.classList.add("is-pressed");
      press(event.pointerId, button.dataset.pixelHopCode);
    });
    const releaseButton = event => {
      button.classList.remove("is-pressed");
      release(event.pointerId);
    };
    button.addEventListener("pointerup", releaseButton);
    button.addEventListener("pointercancel", releaseButton);
    button.addEventListener("lostpointercapture", releaseButton);
  });

  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });

  window.PixelHopMode = { catalog, onScreen, click };
})();
