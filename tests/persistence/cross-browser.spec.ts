import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

type Project = {
  projectId: string;
  revision: number;
  contentHash: string;
  snapshot: { format: string; files: Record<string, string> };
};

async function startSession(page: Page) {
  // Onboarding preference only; project state must come from the server.
  await page.addInitScript(() => localStorage.setItem('revyme-onboarding-completed', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start development session' }).click();
  await expect(page.getByRole('button', { name: 'Create project', exact: true })).toBeVisible();
}

async function loadServer(context: BrowserContext, id: string): Promise<Project> {
  const response = await context.request.get(`http://localhost:4334/api/projects/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function waitForEditor(page: Page) {
  await page.frameLocator('iframe[src*="5174"]').locator('[data-id="root"]').first().waitFor();
  // The canvas viewport spans the window underneath fixed header/sidebar UI.
  await page.locator('[data-canvas-viewport]').click({ position: { x: 340, y: 100 } });
  await page.keyboard.press('Shift+Digit1');
}

async function drawFrame(page: Page, verticalFraction: number) {
  const root = page.frameLocator('iframe[src*="5174"]').locator('[data-id="root"]').first();
  await expect(root).toBeVisible();
  const box = await root.boundingBox();
  if (!box) throw new Error('Canvas root has no visible bounds');
  const x = Math.max(360, box.x + box.width * 0.25);
  const y = Math.max(150, box.y + box.height * verticalFraction);
  await page.keyboard.press('f');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y + 70, { steps: 14 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
}

function frameIds(project: Project): string[] {
  return [...(project.snapshot.files['app/page.client.tsx'] ?? '').matchAll(/data-id="(frame-[^"]+)"/g)]
    .map((match) => match[1]);
}

test('canvas autosave survives a fresh browser context and accepts the next revision', async ({ browser }) => {
  const first = await browser.newContext({ baseURL: 'http://localhost:4334', viewport: { width: 1600, height: 1000 } });
  const firstPage = await first.newPage();
  await startSession(firstPage);
  await firstPage.getByLabel('Project name').fill(`Persistence proof ${Date.now()}`);
  await firstPage.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(firstPage).toHaveURL(/\/builder\/[0-9a-f-]+$/);
  const id = new URL(firstPage.url()).pathname.split('/').pop()!;
  await waitForEditor(firstPage);
  await drawFrame(firstPage, 0.3);
  await expect.poll(async () => frameIds(await loadServer(first, id)).length).toBe(1);
  await expect(firstPage.getByRole('status', { name: 'Project save status' })).toHaveText('Saved');
  const saved = await loadServer(first, id);
  expect(saved.revision).toBeGreaterThan(0);
  expect(await firstPage.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('revyme-project-')))).toEqual([]);
  await first.close();

  const second = await browser.newContext({ baseURL: 'http://localhost:4334', viewport: { width: 1600, height: 1000 } });
  const secondPage = await second.newPage();
  await startSession(secondPage);
  await secondPage.goto(`/builder/${id}`);
  await waitForEditor(secondPage);
  await expect(secondPage.frameLocator('iframe[src*="5174"]').locator(`[data-id="${frameIds(saved)[0]}"]`).first()).toBeAttached();
  await drawFrame(secondPage, 0.6);
  await expect.poll(async () => frameIds(await loadServer(second, id)).length).toBe(2);
  await expect(secondPage.getByRole('status', { name: 'Project save status' })).toHaveText('Saved');
  const continued = await loadServer(second, id);
  expect(continued.revision).toBeGreaterThan(saved.revision);
  expect(continued.contentHash).not.toBe(saved.contentHash);
  await secondPage.reload();
  await waitForEditor(secondPage);
  for (const frameId of frameIds(continued)) {
    await expect(secondPage.frameLocator('iframe[src*="5174"]').locator(`[data-id="${frameId}"]`).first()).toBeAttached();
  }
  await expect(secondPage.getByRole('status', { name: 'Project save status' })).toHaveText('Saved');
  const screenshot = test.info().outputPath('second-browser-reloaded.png');
  await secondPage.screenshot({ path: screenshot });
  await test.info().attach('second-browser-reloaded', { path: screenshot, contentType: 'image/png' });
  await test.info().attach('server-revision-proof', {
    body: JSON.stringify({ projectId: id, firstRevision: saved.revision, secondRevision: continued.revision, contentHash: continued.contentHash, frameIds: frameIds(continued) }, null, 2),
    contentType: 'application/json',
  });
  await second.close();
});

test('a missing server project blocks editing and never sends an autosave', async ({ page }) => {
  await startSession(page);
  const id = randomUUID();
  const writes: string[] = [];
  page.on('request', request => {
    if (request.method() === 'PUT' && request.url().endsWith(`/api/projects/${id}`)) writes.push(request.url());
  });
  await page.goto(`/builder/${id}`);
  await expect(page.getByText('Editing is blocked to protect the saved project.')).toBeVisible();
  await expect(page.locator('[data-canvas-root]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save now', exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('a stale browser preserves its unsaved copy without overwriting the newer server revision', async ({ browser }) => {
  const first = await browser.newContext({ baseURL: 'http://localhost:4334', viewport: { width: 1600, height: 1000 } });
  const second = await browser.newContext({ baseURL: 'http://localhost:4334', viewport: { width: 1600, height: 1000 } });
  try {
    const firstPage = await first.newPage();
    await startSession(firstPage);
    await firstPage.getByLabel('Project name').fill(`Conflict proof ${Date.now()}`);
    await firstPage.getByRole('button', { name: 'Create project', exact: true }).click();
    await expect(firstPage).toHaveURL(/\/builder\/[0-9a-f-]+$/);
    const id = new URL(firstPage.url()).pathname.split('/').pop()!;
    await waitForEditor(firstPage);
    await drawFrame(firstPage, 0.3);
    await expect.poll(async () => frameIds(await loadServer(first, id)).length).toBe(1);
    await expect(firstPage.getByRole('status', { name: 'Project save status' })).toHaveText('Saved');

    const secondPage = await second.newPage();
    await startSession(secondPage);
    await secondPage.goto(`/builder/${id}`);
    await waitForEditor(secondPage);
    await drawFrame(secondPage, 0.6);
    await expect.poll(async () => frameIds(await loadServer(second, id)).length).toBe(2);
    await expect(secondPage.getByRole('status', { name: 'Project save status' })).toHaveText('Saved');
    const newest = await loadServer(second, id);

    await drawFrame(firstPage, 0.75);
    await expect(firstPage.getByRole('status', { name: 'Project save status' })).toHaveText('Save conflict');
    const afterConflict = await loadServer(second, id);
    expect(afterConflict.revision).toBe(newest.revision);
    expect(afterConflict.contentHash).toBe(newest.contentHash);
    const conflictScreenshot = test.info().outputPath('stale-browser-conflict.png');
    await firstPage.screenshot({ path: conflictScreenshot });
    await test.info().attach('stale-browser-conflict', { path: conflictScreenshot, contentType: 'image/png' });
    const downloadEvent = firstPage.waitForEvent('download');
    await firstPage.getByRole('button', { name: 'Download unsaved copy' }).click();
    const download = await downloadEvent;
    const path = await download.path();
    if (!path) throw new Error('Recovery download was not saved');
    const localCopy = JSON.parse(await readFile(path, 'utf8')) as Project['snapshot'];
    expect(localCopy.format).toBe('revyme-v1');
    expect(localCopy.files['app/page.client.tsx']).not.toBe(newest.snapshot.files['app/page.client.tsx']);
    expect(frameIds({ ...newest, snapshot: localCopy })).toHaveLength(2);
  } finally {
    await first.close();
    await second.close();
  }
});
