import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright-core');
} catch {
  playwright = require('/tmp/pw/node_modules/playwright-core');
}
const { chromium } = playwright;
const OUT = '/opt/cursor/artifacts';
const BASE = 'http://127.0.0.1:8765';
const checks = [];
const consoleErrors = [];
const pageErrors = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) throw new Error(`${name}: ${detail}`);
}

async function openLevel(page, name) {
  await page.getByRole('button', { name: '选择关卡' }).click();
  await page.getByRole('heading', { name, exact: true }).click();
  await page.getByRole('button', { name: '开始游戏' }).click();
  await page.getByLabel(/^算式卡/).first().waitFor();
}

async function cardAudit(page, levelId) {
  return page.evaluate((id) => {
    const list = globalThis.MathMatchLevels.problems(id);
    const byExpr = new Map(list.map((problem) => [problem.expression, String(problem.answer)]));
    const equations = [...document.querySelectorAll('[aria-label^="算式卡"]')].map((element) => element.getAttribute('aria-label').replace('算式卡: ', ''));
    const answers = [...document.querySelectorAll('[aria-label^="答案卡"]')].map((element) => element.getAttribute('aria-label').replace('答案卡: ', ''));
    return {
      equations,
      answers,
      unknown: equations.filter((expression) => !byExpr.has(expression)),
      missingAnswer: equations.filter((expression) => byExpr.has(expression) && !answers.includes(byExpr.get(expression))),
      duplicateAnswers: answers.filter((answer, index) => answers.indexOf(answer) !== index),
    };
  }, levelId);
}

async function matchAll(page, levelId) {
  for (let guard = 0; guard < 8; guard += 1) {
    const equation = page.getByLabel(/^算式卡/).first();
    if (await equation.count() === 0) break;
    const expression = (await equation.getAttribute('aria-label')).replace('算式卡: ', '');
    const answer = await page.evaluate(({ id, expression: current }) => {
      const found = globalThis.MathMatchLevels.problems(id).find((problem) => problem.expression === current);
      return found ? String(found.answer) : null;
    }, { id: levelId, expression });
    if (!answer) throw new Error(`没有答案 ${expression}`);
    await equation.click();
    await page.getByLabel(`答案卡: ${answer}`, { exact: true }).click();
  }
  await page.getByRole('button', { name: '再玩一局' }).waitFor({ timeout: 8000 });
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('anna_math_settings_v1', JSON.stringify({
      pairCount: 2,
      permanentFlip: true,
      timerMode: 'off',
      countdownSeconds: 60,
      soundEnabled: false,
      soundVolume: 0,
    }));
    localStorage.setItem('anna_math_mistakes_v1', JSON.stringify([{
      id: 'mistake_keep_7plus8',
      expression: '7+8',
      correctAnswer: 15,
      selectedWrongAnswer: 14,
      category: 'add-10',
      categoryName: '10 以内加法',
      timestamp: 1762700000000,
      errorCount: 2,
    }]));
    localStorage.setItem('anna_math_records_v1', JSON.stringify([{
      id: 'record_keep_1',
      date: '2026/11/9',
      timestamp: 1762700000000,
      category: 'add-10',
      categoryName: '10 以内加法',
      totalPairs: 6,
      timeSpent: 42,
      errorCount: 1,
      accuracy: 83,
      stars: 2,
    }]));
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check('title', await page.title() === '数学消消乐', await page.title());
  check('loaded level module', await page.evaluate(() => Boolean(globalThis.MathMatchLevels && globalThis.MathMatchLevels.levels.length === 8)));
  check('no ANNA on screen', !(await page.locator('body').innerText()).includes('ANNA'));

  await page.getByRole('button', { name: '选择关卡' }).click();
  for (const name of ['10 以内加法', '10 以内减法', '20 以内加法', '20 以内减法', '乘法口诀', '表内除法', '混合大挑战', '100以内加法', '100以内减法', '100以内加减', '有余数的除法', '分数加法', '分数减法', '分数乘法', '分数除法']) {
    await page.getByRole('heading', { name, exact: true }).waitFor();
  }
  check('old and new levels are in the selector', true);
  await page.screenshot({ path: `${OUT}/levels-desktop.png`, fullPage: true });

  await openLevel(page, '10 以内加法');
  const oldCards = await page.evaluate(() => [...document.querySelectorAll('[aria-label^="算式卡"]')].map((element) => element.getAttribute('aria-label').replace('算式卡: ', '')));
  check('original addition still within 10', oldCards.every((expression) => {
    const match = expression.match(/^(\d+) \+ (\d+)$/);
    return match && Number(match[1]) + Number(match[2]) <= 10;
  }), oldCards.join(', '));

  for (const [name, id] of [['100以内加法', 'add-100'], ['100以内减法', 'sub-100'], ['100以内加减', 'addsub-100'], ['有余数的除法', 'rem-div'], ['分数加法', 'frac-add'], ['分数减法', 'frac-sub'], ['分数乘法', 'frac-mul'], ['分数除法', 'frac-div']]) {
    await openLevel(page, name);
    const audit = await cardAudit(page, id);
    check(`${name} cards`, audit.equations.length === 2 && audit.unknown.length === 0 && audit.missingAnswer.length === 0 && audit.duplicateAnswers.length === 0, JSON.stringify(audit));
  }
  await page.screenshot({ path: `${OUT}/fraction-division.png` });

  await openLevel(page, '有余数的除法');
  await page.screenshot({ path: `${OUT}/remainder-round.png` });
  const firstRemainder = await cardAudit(page, 'rem-div');
  await matchAll(page, 'rem-div');
  check('remainder round can finish', true);
  await page.getByRole('button', { name: '再玩一局' }).click();
  await page.getByLabel(/^算式卡/).first().waitFor();
  const replay = await cardAudit(page, 'rem-div');
  check('remainder can be played again', replay.equations.length === 2 && replay.unknown.length === 0, replay.equations.join(' | '));
  check('replay deals another pair', [...replay.equations].sort().join('|') !== [...firstRemainder.equations].sort().join('|'), replay.equations.join(' | '));

  await openLevel(page, '分数加法');
  await page.screenshot({ path: `${OUT}/fraction-addition.png` });
  const fraction = await cardAudit(page, 'frac-add');
  const wrong = fraction.answers.find((answer) => answer !== fraction.answers[0]) || fraction.answers[0];
  const targetExpression = fraction.equations[0];
  const correct = await page.evaluate((expression) => String(globalThis.MathMatchLevels.problems('frac-add').find((problem) => problem.expression === expression).answer), targetExpression);
  const incorrect = fraction.answers.find((answer) => answer !== correct);
  await page.getByLabel(`算式卡: ${targetExpression}`, { exact: true }).click();
  await page.getByLabel(`答案卡: ${incorrect}`, { exact: true }).click();
  await page.waitForTimeout(300);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('anna_math_mistakes_v1')));
  check('old mistake remains after a new error', stored.some((item) => item.id === 'mistake_keep_7plus8' && item.expression === '7+8' && item.correctAnswer === 15));
  check('fraction mistake stores the simplified answer', stored.some((item) => item.expression === targetExpression && item.correctAnswer === correct), JSON.stringify(stored));
  await page.getByRole('button', { name: '我的错题本' }).click();
  await page.getByText('7+8', { exact: true }).waitFor();
  await page.getByText(targetExpression, { exact: true }).waitFor();
  await page.screenshot({ path: `${OUT}/mistakes-with-new-level.png` });
  await page.getByRole('button', { name: '错题再练一次' }).click();
  await page.getByLabel(/^算式卡/).first().waitFor();
  const practiceText = await page.locator('body').innerText();
  check('mistake practice opens', practiceText.includes('错题专项强化') || practiceText.includes(targetExpression));

  await page.getByRole('button', { name: '家长设置' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出学习数据备份 (.json)' }).click(),
  ]);
  const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  check('backup keeps compatibility name and both answer kinds', backup.appName === 'ANNA Math Match' && backup.mistakes.some((item) => item.correctAnswer === 15) && backup.mistakes.some((item) => item.correctAnswer === correct));
  const imported = {
    ...backup,
    mistakes: [...backup.mistakes, {
      id: 'mistake_old_import',
      expression: '9 - 4',
      correctAnswer: 5,
      selectedWrongAnswer: 6,
      category: 'sub-10',
      categoryName: '10 以内减法',
      timestamp: 1762700001000,
      errorCount: 1,
    }],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page.waitForTimeout(500);
  const afterImport = await page.evaluate(() => JSON.parse(localStorage.getItem('anna_math_mistakes_v1')).map((item) => item.expression));
  check('import keeps old, new, and numeric backup mistakes', ['7+8', targetExpression, '9 - 4'].every((expression) => afterImport.includes(expression)), afterImport.join(', '));
  check('learning record remains', (await page.evaluate(() => localStorage.getItem('anna_math_records_v1'))).includes('record_keep_1'));

  await page.locator('#anna-mc-fab').click();
  await page.locator('.anna-mc-cell[data-r="5"][data-c="3"]').click();
  const board = await page.locator('#anna-mc-groups').innerText();
  const repeat = await page.locator('#anna-mc-repeat').innerText();
  check('hundred board 5×3 is still 3 groups of 5', board === '3组，每组5个' && repeat === '5＋5＋5＝15', `${board} ${repeat}`);
  await page.screenshot({ path: `${OUT}/hundred-board-regression.png` });
  await page.locator('#anna-mc-close').click();
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await mobilePage.getByRole('button', { name: '选择关卡' }).click();
  await mobilePage.getByRole('heading', { name: '有余数的除法', exact: true }).scrollIntoViewIfNeeded();
  await mobilePage.screenshot({ path: `${OUT}/levels-mobile.png` });
  await mobilePage.getByRole('heading', { name: '有余数的除法', exact: true }).click();
  await mobilePage.getByRole('button', { name: '开始游戏' }).click();
  await mobilePage.getByLabel(/^算式卡/).first().waitFor();
  const mobileAudit = await cardAudit(mobilePage, 'rem-div');
  check('mobile remainder cards', mobileAudit.unknown.length === 0 && mobileAudit.equations.length >= 2, JSON.stringify(mobileAudit.equations));
  const box = await mobilePage.locator('[aria-label^="算式卡"]').first().boundingBox();
  check('mobile equation card is large enough to tap', box && box.height >= 44 && box.width >= 44, JSON.stringify(box));
  await mobilePage.screenshot({ path: `${OUT}/remainder-mobile.png` });
  await mobile.close();

  const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const tabletPage = await tablet.newPage();
  await tabletPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await tabletPage.getByRole('button', { name: '选择关卡' }).click();
  await tabletPage.screenshot({ path: `${OUT}/levels-tablet-width.png` });
  await tablet.close();

  const cacheName = fs.readFileSync('/workspace/sw.js', 'utf8').match(/CACHE_NAME = '([^']+)'/)[1];
  fs.writeFileSync('/tmp/anna-serve-root', '/tmp/anna-prev\n');
  const upgradeContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const upgradePage = await upgradeContext.newPage();
  await upgradePage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await upgradePage.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration && registration.active);
  });
  const oldCaches = await upgradePage.evaluate(async () => caches.keys());
  check('previous cache installs', oldCaches.includes('anna-math-cache-2.2.0-groups-704592f326'), JSON.stringify(oldCaches));
  fs.writeFileSync('/tmp/anna-serve-root', '/workspace\n');
  await upgradePage.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
  });
  await upgradePage.waitForFunction(async (name) => (await caches.keys()).includes(name), cacheName, { timeout: 10000 });
  await upgradePage.reload({ waitUntil: 'domcontentloaded' });
  let upgraded = false;
  for (let attempt = 0; attempt < 25 && !upgraded; attempt += 1) {
    try {
      upgraded = await upgradePage.evaluate(async (name) => {
        const keys = await caches.keys();
        const text = document.body ? document.body.innerText : '';
        return keys.includes(name) && !keys.includes('anna-math-cache-2.2.0-groups-704592f326') && text.includes('数学消消乐') && !text.includes('ANNA');
      }, cacheName);
    } catch {
      upgraded = false;
    }
    if (!upgraded) await upgradePage.waitForTimeout(400);
  }
  await upgradePage.getByRole('button', { name: '选择关卡' }).click();
  await upgradePage.getByRole('heading', { name: '分数乘法', exact: true }).waitFor();
  check('service worker upgrade shows new levels', upgraded === true, cacheName);
  await upgradePage.screenshot({ path: `${OUT}/sw-upgraded-levels.png` });
  await upgradeContext.close();

  fs.writeFileSync('/tmp/anna-serve-root', '/workspace\n');
  const offlineContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await offlinePage.waitForFunction(async (name) => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || !registration.active) return false;
    const cache = await caches.open(name);
    return Boolean(await cache.match('/src/new-levels.mjs') && await cache.match('/index.html') && await cache.match('/assets/index-2_2UvlOz.js'));
  }, cacheName);
  await offlineContext.setOffline(true);
  await offlinePage.reload({ waitUntil: 'domcontentloaded' });
  await offlinePage.getByRole('button', { name: '选择关卡' }).click();
  await offlinePage.getByRole('heading', { name: '有余数的除法', exact: true }).click();
  await offlinePage.getByRole('button', { name: '开始游戏' }).click();
  await offlinePage.getByLabel(/^算式卡/).first().waitFor();
  const offlineAudit = await cardAudit(offlinePage, 'rem-div');
  check('offline reload still serves remainder problems', offlineAudit.equations.length >= 2 && offlineAudit.unknown.length === 0, offlineAudit.equations.join(', '));
  await offlinePage.screenshot({ path: `${OUT}/offline-remainder.png` });
  await offlineContext.close();
} finally {
  fs.writeFileSync(`${OUT}/levels-browser-report.json`, JSON.stringify({ checks, consoleErrors, pageErrors }, null, 2));
  await browser.close();
  const failed = checks.filter((item) => !item.ok).length;
  console.log(`RESULT failed=${failed} checks=${checks.length} consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length}`);
  if (failed || consoleErrors.length || pageErrors.length) process.exit(1);
}
