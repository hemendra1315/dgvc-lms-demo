#!/usr/bin/env node
/**
 * End-to-end verification of the PYQ feature in a real browser (Playwright / Chromium).
 * Builds and serves the app on PORT (default 5199), then checks:
 *   student: list shows every paper, subject/semester/year filters, open in viewer,
 *            page navigation + zoom, download (real file bytes), bookmark → Saved, Saved persists after reload
 *   every PDF record opens and renders inside the app viewer
 *   admin:   resources table, preview, unpublish → hidden from student, publish → back,
 *            edit metadata (with validation), archive, delete with confirmation, audit log
 *   security: student blocked from /admin; unpublished paper shows "not available"; missing file state
 *   layout:  no horizontal overflow at common viewports
 * Usage: node scripts/e2e.mjs   (exit code 0 = all passed; screenshots in test-results/)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5199);
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(ROOT, 'test-results');
fs.mkdirSync(OUT, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/generated/pyq-resources.json'), 'utf8'));
const N = manifest.resources.length;

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const server = spawn(process.execPath, [path.join(ROOT, 'scripts/build.mjs'), '--serve'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server did not start')), 60000);
  server.stdout.on('data', (d) => d.toString().includes(`localhost:${PORT}`) && (clearTimeout(t), res()));
  server.on('exit', (c) => rej(new Error(`server exited ${c}`)));
});

const browser = await chromium.launch();
const consoleErrors = [];
async function newPage(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && consoleErrors.push(m.text()));
  return page;
}
async function login(page, role) {
  await page.goto(`${BASE}/login`);
  await page.click(`[data-testid=demo-${role}]`);
  await page.waitForURL(role === 'student' ? '**/home' : '**/admin');
}
const cards = (p) => p.locator('[data-testid=pyq-card]');

try {
  console.log(`\nDGVC LMS e2e — ${N} sample papers\n`);
  const p = await newPage();

  await check('login form validates input and rejects wrong password', async () => {
    await p.goto(`${BASE}/login`);
    await p.click('button[type=submit]');
    await p.getByText('Enter a valid email address').waitFor();
    await p.fill('input[type=email]', 'student@demo.dgvc.in');
    await p.fill('input[type=password]', 'wrongpass1');
    await p.click('button[type=submit]');
    await p.getByText('Email or password is incorrect').waitFor();
    await p.fill('input[type=password]', 'Demo@2026');
    await p.click('button[type=submit]');
    await p.waitForURL('**/home');
  });

  await check('student: Previous Year Papers lists every sample paper', async () => {
    await p.click('[data-testid=qa-pyq]');
    await p.waitForURL('**/pyq');
    await cards(p).first().waitFor();
    assert((await cards(p).count()) === N, `expected ${N} cards, got ${await cards(p).count()}`);
    const ids = await cards(p).evaluateAll((els) => els.map((e) => e.dataset.id));
    for (const r of manifest.resources) assert(ids.includes(r.id), `missing ${r.file_name}`);
    await p.screenshot({ path: `${OUT}/student-pyq-mobile.png` });
  });

  await check('student: select a subject (Python Programming)', async () => {
    await p.click('[data-testid=chip-python-programming]');
    const n = manifest.resources.filter((r) => r.subject_key === 'python-programming').length;
    await p.waitForFunction((n) => document.querySelectorAll('[data-testid=pyq-card]').length === n, n);
    assert(p.url().includes('subject=python-programming'), 'subject not in URL');
  });

  await check('student: filter by semester and exam year', async () => {
    await p.click('[data-testid=chip-statistics]').catch(() => {});
    await p.goto(`${BASE}/pyq`);
    await p.selectOption('[data-testid=filter-semester]', '4');
    const sem4 = manifest.resources.filter((r) => r.semester === 4).length;
    await p.waitForFunction((n) => document.querySelectorAll('[data-testid=pyq-card]').length === n, sem4);
    await p.selectOption('[data-testid=filter-semester]', '');
    await p.selectOption('[data-testid=filter-year]', '2025');
    const y = manifest.resources.filter((r) => r.exam_year === 2025).length;
    await p.waitForFunction((n) => document.querySelectorAll('[data-testid=pyq-card]').length === n, y);
    await p.selectOption('[data-testid=filter-semester]', '1');
    const both = manifest.resources.filter((r) => r.exam_year === 2025 && r.semester === 1).length;
    await p.waitForFunction((n) => document.querySelectorAll('[data-testid=pyq-card]').length === n, both);
    await p.fill('[data-testid=pyq-search]', 'zzz-no-match');
    await p.getByTestId('empty-state').waitFor();
  });

  const py = manifest.resources.find((r) => r.file_name === 'python-programming-nov-2025-sample.pdf');
  await check('student: open a paper in the in-app PDF viewer, navigate pages and zoom', async () => {
    await p.goto(`${BASE}/pyq?subject=python-programming`);
    await p.locator(`[data-id="${py.id}"] [data-testid=open-btn]`).click();
    await p.waitForURL(`**/pyq/${py.id}`);
    await p.waitForSelector('canvas[data-rendered-page="1"]', { timeout: 20000 });
    assert((await p.textContent('[data-testid=page-count]')).includes(String(py.page_count)), 'page count');
    await p.click('[data-testid=next-page]');
    await p.waitForSelector('canvas[data-rendered-page="2"]');
    const z1 = await p.textContent('[data-testid=zoom-level]');
    await p.click('[data-testid=zoom-in]');
    await p.waitForFunction((z) => document.querySelector('[data-testid=zoom-level]').textContent !== z, z1);
    const w = await p.$eval('canvas', (c) => c.width);
    assert(w > 300, 'canvas not rendered');
    await p.screenshot({ path: `${OUT}/student-viewer-mobile.png` });
  });

  await check('student: download the PDF (real file, correct name and size)', async () => {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid=viewer-download]')]);
    assert(dl.suggestedFilename() === py.file_name, `filename ${dl.suggestedFilename()}`);
    const file = path.join(OUT, dl.suggestedFilename());
    await dl.saveAs(file);
    const buf = fs.readFileSync(file);
    assert(buf.subarray(0, 5).toString() === '%PDF-', 'not a PDF');
    assert(buf.length === py.file_size, `size ${buf.length} != ${py.file_size}`);
    fs.rmSync(file);
  });

  await check('student: bookmark from viewer and list card; appears in Saved and survives reload', async () => {
    await p.click('[data-testid=viewer-bookmark]');
    await p.waitForSelector('[data-testid=viewer-bookmark][aria-pressed=true]');
    await p.goto(`${BASE}/pyq`);
    const other = manifest.resources.find((r) => r.subject_key === 'statistics');
    await p.locator(`[data-id="${other.id}"] [data-testid=bookmark-btn]`).click();
    await p.goto(`${BASE}/saved?tab=bookmarks`);
    await p.reload();
    await p.waitForSelector('[data-testid=saved-item]');
    assert((await p.locator('[data-testid=saved-item]').count()) === 2, 'expected 2 bookmarks');
    await p.click('[data-testid=tab-downloads]');
    assert((await p.locator('[data-testid=saved-item]').count()) === 1, 'expected 1 download');
    await p.click('[data-testid=tab-recent]');
    assert((await p.locator('[data-testid=saved-item]').count()) >= 1, 'expected recent activity');
    await p.click('[data-testid=tab-bookmarks]');
    await p.locator('[data-testid=remove-bookmark]').first().click();
    await p.waitForFunction(() => document.querySelectorAll('[data-testid=saved-item]').length === 1);
  });

  await check(`every one of the ${N} PDFs opens and renders in the app viewer`, async () => {
    const failed = [];
    for (const r of manifest.resources) {
      await p.goto(`${BASE}/pyq/${r.id}`);
      try {
        await p.waitForSelector('canvas[data-rendered-page="1"]', { timeout: 15000 });
        const pages = await p.textContent('[data-testid=page-count]');
        if (!pages.includes(String(r.page_count))) failed.push(`${r.file_name}: pages ${pages}`);
      } catch {
        failed.push(r.file_name);
      }
    }
    assert(!failed.length, `failed: ${failed.join(', ')}`);
  });

  await check('every PDF URL is served as application/pdf', async () => {
    for (const r of manifest.resources) {
      const res = await p.request.get(`${BASE}${r.file_url}`);
      assert(res.ok() && res.headers()['content-type'] === 'application/pdf', `${r.file_url} ${res.status()}`);
      assert((await res.body()).length === r.file_size, `${r.file_url} size`);
    }
  });

  await check('viewer shows a clear state for a missing PDF file', async () => {
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('dgvc-lms-demo-state'));
      s.resources[0].file_url = '/demo-pdfs/does-not-exist.pdf';
      localStorage.setItem('dgvc-lms-demo-state', JSON.stringify(s));
    });
    const id = await p.evaluate(() => JSON.parse(localStorage.getItem('dgvc-lms-demo-state')).resources[0].id);
    await p.goto(`${BASE}/pyq/${id}`);
    await p.getByTestId('viewer-error-missing').waitFor();
  });

  await check('student cannot open the admin dashboard', async () => {
    await p.goto(`${BASE}/admin/resources`);
    await p.getByTestId('forbidden').waitFor();
  });

  // ---------------------------------------------------------------- admin
  const a = await newPage({ width: 1366, height: 768 });
  const target = manifest.resources.find((r) => r.file_name === 'mathematics-apr-2024-sample.pdf');
  const row = () => a.locator(`[data-testid=resource-row][data-id="${target.id}"]`);

  await check('admin: Resource Management lists all generated papers', async () => {
    await login(a, 'super_admin');
    await a.click('text=Resources');
    await a.waitForSelector('[data-testid=resource-row]');
    assert((await a.locator('[data-testid=resource-row]').count()) === N, 'row count');
    await a.screenshot({ path: `${OUT}/admin-resources-desktop.png` });
  });

  await check('admin: preview opens the PDF inside the admin app', async () => {
    await row().locator('[data-testid=action-preview]').click();
    await a.waitForSelector('canvas[data-rendered-page="1"]', { timeout: 20000 });
    await a.goBack();
    await row().waitFor();
  });

  // Admin and student share one browser (same localStorage), as in a live demo: switch accounts in place.
  async function switchTo(page, role) {
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('dgvc-lms-demo-state')); s.sessionUserId = null; localStorage.setItem('dgvc-lms-demo-state', JSON.stringify(s)); });
    await login(page, role);
  }
  async function studentCount(page) {
    await page.goto(`${BASE}/pyq`);
    await cards(page).first().waitFor();
    return cards(page).count();
  }
  await check('admin: unpublish hides the paper from students; publish restores it', async () => {
    await row().locator('[data-testid=action-unpublish]').click();
    await row().getByText('unpublished').waitFor();
    await switchTo(a, 'student');
    assert((await studentCount(a)) === N - 1, 'student still sees unpublished paper');
    await a.goto(`${BASE}/pyq/${target.id}`);
    await a.getByTestId('viewer-error-denied').waitFor();
    await switchTo(a, 'super_admin');
    await a.goto(`${BASE}/admin/resources`);
    await row().locator('[data-testid=action-publish]').click();
    await row().getByText('published').waitFor();
    await switchTo(a, 'student');
    assert((await studentCount(a)) === N, 'republished paper not visible');
    await switchTo(a, 'super_admin');
    await a.goto(`${BASE}/admin/resources`);
    await row().waitFor();
  });

  await check('admin: edit metadata validates and saves', async () => {
    await row().locator('[data-testid=action-edit]').click();
    await a.fill('[data-testid=edit-year]', '2099');
    await a.click('[data-testid=save-meta]');
    await a.getByText('Year cannot be in the future').waitFor();
    await a.fill('[data-testid=edit-year]', '2024');
    await a.fill('[data-testid=edit-title]', 'Mathematics for Data Science — April 2024 (Sample, revised)');
    await a.click('[data-testid=save-meta]');
    await row().getByText('(Sample, revised)').waitFor();
  });

  await check('admin: archive (with confirmation) and restore', async () => {
    await row().locator('[data-testid=action-archive]').click();
    await a.click('[data-testid=confirm-action]');
    await row().getByText('archived').waitFor();
    await row().locator('[data-testid=action-restore]').click();
    await row().getByText('unpublished').waitFor();
    await row().locator('[data-testid=action-publish]').click();
  });

  await check('admin: delete asks for confirmation, cancel keeps it, confirm removes it', async () => {
    await row().locator('[data-testid=action-delete]').click();
    await a.getByRole('dialog').getByText('Cancel').click();
    await row().waitFor();
    await row().locator('[data-testid=action-delete]').click();
    await a.click('[data-testid=confirm-action]');
    await row().waitFor({ state: 'detached' });
    assert((await a.locator('[data-testid=resource-row]').count()) === N - 1, 'row not removed');
  });

  await check('admin: audit log records the changes', async () => {
    await a.click('text=Audit Logs');
    for (const t of ['Unpublished resource', 'Published resource', 'Edited resource metadata', 'Archived resource', 'Deleted resource'])
      await a.getByRole('cell', { name: t }).first().waitFor();
  });

  await check('faculty sees only assigned subjects; department admin only their department', async () => {
    const f = await newPage({ width: 1366, height: 768 });
    await login(f, 'faculty');
    await f.goto(`${BASE}/admin/resources`);
    await f.waitForSelector('[data-testid=resource-row]');
    const exp = manifest.resources.filter((r) => ['python-programming', 'statistics'].includes(r.subject_key)).length;
    assert((await f.locator('[data-testid=resource-row]').count()) === exp, 'faculty scope');
    await switchTo(f, 'department_admin');
    await f.goto(`${BASE}/admin/resources`);
    await f.waitForSelector('[data-testid=resource-row]');
    const ds = await f.locator('[data-testid=resource-row]').count();
    // Fresh browser context = fresh demo data, so the full department set is expected.
    const expDs = manifest.resources.filter((r) => r.department === 'Department of Data Science').length;
    assert(ds === expDs, `dept admin scope ${ds} != ${expDs}`);
    await f.context().close();
  });

  await check('reset demo data restores all papers', async () => {
    await a.goto(`${BASE}/admin/resources`);
    await a.click('text=Reset demo data');
    await a.waitForFunction((n) => document.querySelectorAll('[data-testid=resource-row]').length === n, N);
  });

  await check('no horizontal overflow at 360/390/412/768/1366/1920 widths', async () => {
    const v = await newPage();
    await login(v, 'student');
    const bad = [];
    for (const [w, h] of [[360, 800], [390, 844], [412, 915], [768, 1024], [1366, 768], [1920, 1080]]) {
      await v.setViewportSize({ width: w, height: h });
      for (const route of ['/home', '/pyq', '/saved', '/profile', `/pyq/${py.id}`]) {
        await v.goto(BASE + route);
        await v.waitForTimeout(route.startsWith('/pyq/') ? 1500 : 200);
        const over = await v.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 1) bad.push(`${route}@${w} (+${over}px)`);
      }
      if (w === 360) await v.screenshot({ path: `${OUT}/student-home-360.png`, fullPage: true });
    }
    assert(!bad.length, bad.join(', '));
  });

  await check('no uncaught page errors', async () => {
    assert(!consoleErrors.length, consoleErrors.slice(0, 3).join(' | '));
  });
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'e2e-results.json'), JSON.stringify({ at: new Date().toISOString(), papers: N, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
