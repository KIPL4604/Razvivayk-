/* Isolated Teramont server with Playwright and Edge/Chromium. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath && /^[a-z]:[\\/]/i.test(modulePath)
  ? pathToFileURL(modulePath).href : modulePath || "playwright-core");
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
const origin = new URL(process.argv[2] || "http://127.0.0.1:8081").origin;
const key = "teramont.neon-frontier.hangar.v1";
const output = "output/neon-hangar";
await mkdir(output, { recursive: true });

try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://telegram.org/**", route => route.fulfill({ body: "", contentType: "text/javascript" }));
  await page.goto(origin);
  const dock = (action, extra = "") => page.locator(`[data-depot="${action}"]${extra}`);
  const game = action => page.locator(`[data-neon="${action}"]`);
  const flight = state => page.locator(`#neonFrontierMount[data-state="${state}"] canvas`);
  const phase = name => page.locator(`.nf-cargo[data-phase="${name}"]`);
  const open = async () => {
    await page.locator('#campaignCards [data-screen-link="neon-frontier"]').press("Enter");
    await page.locator(".nf-dock").waitFor();
  };
  const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
  const snap = name => page.screenshot({ path: `${output}/${name}.png` });

  await open();
  await snap("menu-mobile");
  await dock("cases").tap();
  await snap("cases-mobile");
  // A deterministic cannon prize while using the actual purchase and animation flow.
  await page.evaluate(() => {
    const draws = [.25, .42];
    const fallback = Math.random;
    Math.random = () => draws.length ? draws.shift() : fallback();
  });
  await dock("open", '[data-case="patrol"]').tap();
  await phase("charge").waitFor();
  await snap("case-charge-mobile");
  await phase("burst").waitFor();
  await phase("roll").waitFor();
  await snap("case-roll-mobile");
  await phase("result").waitFor();
  await snap("case-result-mobile");
  const first = await saved();
  assert.equal(first.coins, 20);
  assert.equal(first.pending.part, "cannon");
  await page.reload();
  await open();
  await phase("result").waitFor();
  assert.deepEqual(await saved(), first);
  await page.locator('[data-cargo="fit"]').tap();
  assert.equal(await dock("slot", '[data-slot="cannon"]').getAttribute("aria-pressed"), "true");
  await dock("fit").press("Enter");
  await dock("fit").waitFor({ state: "hidden" });
  assert.equal((await saved()).fits.swift.cannon, 1);
  await dock("explode").tap();
  await snap("exploded-mobile");
  await dock("back").tap();
  await dock("launch").press("Enter");
  await flight("playing").waitFor();
  await snap("flight-mobile");
  await page.keyboard.press("Escape");
  await flight("paused").waitFor();
  await game("dock").tap();
  assert.match(await dock("launch").innerText(), /Продолжить вылет/);
  await dock("launch").press("Enter");
  await flight("playing").waitFor();
  await page.locator('[data-neon="bounty"]', { hasText: /Добыча за вылет/ }).waitFor({ timeout: 30000 });
  const earned = await saved();
  assert.ok(earned.best > 0 && earned.coins > 20);
  await game("return").tap();

  // Stock the parts needed for a complete ship build without grinding case drops.
  await page.evaluate(k => {
    const profile = JSON.parse(localStorage.getItem(k));
    profile.coins = 5000;
    for (const part of Object.keys(profile.modules)) profile.modules[part] = 3;
    localStorage.setItem(k, JSON.stringify(profile));
  }, key);
  await page.setViewportSize({ width: 1440, height: 900 });
  await dock("hangar").click();
  await dock("preview", '[data-ship="prism"]').click();
  await dock("select").click();
  await dock("select").waitFor({ state: "hidden" });
  assert.equal((await saved()).coins, 3950);
  await dock("upgrade", '[data-part="drive"]').click();
  await dock("upgrade", '[data-part="drive"][data-level="1"]').waitFor();
  assert.equal((await saved()).coins, 3830);
  for (const part of ["core", "cockpit", "cannon", "drive", "armor", "reactor"]) {
    await dock("slot", `[data-slot="${part}"]`).click();
    const art = page.locator(`.nf-bay [data-slot-art="${part}"]`);
    const stock = await art.innerHTML();
    await dock("variant", '[data-variant="3"]').click();
    assert.notEqual(await art.innerHTML(), stock, part);
    await dock("fit").click();
    await dock("fit").waitFor({ state: "hidden" });
    assert.equal((await saved()).fits.prism[part], 3);
  }
  assert.equal((await saved()).fits.swift.cannon, 1);
  if (await page.locator(".nf-bay-exploded").count()) await dock("explode").click();
  await snap("assembled-desktop");
  await dock("explode").click();
  await snap("exploded-desktop");
  await dock("back").click();
  await snap("menu-desktop");
  await dock("launch").click();
  await flight("playing").waitFor();
  assert.equal(await game("hull").getAttribute("aria-label"), "8 из 8");
  await snap("flight-desktop");
  await game("dock").click();
  await dock("cases").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await dock("open", '[data-case="stellar"]').click();
  await phase("result").waitFor();
  assert.equal(await page.locator('[data-cargo="confirm"]').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press("Escape");
  await page.locator(".nf-cargo").waitFor({ state: "hidden" });
  assert.equal((await saved()).pending, null);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ initialCase: first.pending.part, score: earned.best, coinsAfterFlight: earned.coins,
    hull: 8, loadouts: ["swift", "prism"], touch: true, keyboard: true, reducedMotion: true }));
} finally {
  await browser.close();
}
