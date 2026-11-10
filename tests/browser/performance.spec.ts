import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { startFixtureDatabase, testKey } from '../support/supabase.mjs';

test.describe('public skeletons and validated cache', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  let fixture: Awaited<ReturnType<typeof startFixtureDatabase>>;
  let child: ChildProcess, origin: string, hold: Promise<void> | undefined;
  test.beforeAll(async ({ browserName }, workerInfo) => {
    expect(browserName).toBe('chromium');
    fixture = await startFixtureDatabase(0, async (_req, _res, url) => {
      if (url.pathname === '/rest/v1/posts' && hold) await hold;
      return false;
    });
    fixture.state.now = '2030-11-10T00:00:00.000Z';
    origin = `http://127.0.0.1:${4240 + workerInfo.parallelIndex}`;
    child = spawn(process.execPath, ['scripts/preview.mjs'], {
      cwd: 'apps/web',
      env: {
        ...process.env,
        PORT: new URL(origin).port,
        SUPABASE_URL: fixture.url,
        SUPABASE_PUBLISHABLE_KEY: testKey,
        ADMIN_WRITES_ENABLED: 'false',
        ADMIN_ORIGIN: origin,
      },
      stdio: 'ignore',
    });
    await expect
      .poll(async () => {
        try {
          return (await fetch(origin + '/contact')).status;
        } catch {
          return 0;
        }
      })
      .toBe(200);
  });
  test.afterAll(async () => {
    if (child?.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((r) => child.once('exit', r));
    }
    await fixture?.close();
  });
  test('initial document shows static content and accessible reduced-motion skeletons before DB completion', async ({
    page,
  }) => {
    let release!: () => void;
    hold = new Promise<void>((resolve) => (release = resolve));
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(origin, { waitUntil: 'commit' });
      await expect(
        page.getByRole('heading', {
          name: 'SACUTE — Đồng hành cùng sinh viên',
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Thông tin mới nhất' }),
      ).toBeVisible();
      await expect(page.locator('.content-skeleton').first()).toBeVisible();
      await expect(page.locator('.article-card')).toHaveCount(0);
      await page.screenshot({
        path: '/tmp/sacute-public-skeleton.png',
        fullPage: true,
      });
      expect(
        await page
          .locator('.skeleton-block')
          .first()
          .evaluate((node) => getComputedStyle(node, '::after').animationName),
      ).toBe('none');
    } finally {
      release();
      hold = undefined;
    }
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('.content-skeleton')).toHaveCount(0);
  });
  test('navigation commits static controls while pending; repeat visits validate and reuse 304 responses', async ({
    page,
  }) => {
    await page.goto(origin + '/information');
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Liên hệ', exact: true })
      .click();
    await expect(page).toHaveURL(origin + '/contact');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      '**/resources/content?view=information**',
      async (route) => {
        await gate;
        await route.continue();
      },
    );
    const response = page.waitForResponse((r) =>
      r.url().includes('/resources/content?view=information'),
    );
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Thông tin', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Thông tin từ SACUTE' }),
    ).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('.content-skeleton')).toHaveCount(0);
    release();
    expect((await response).status()).toBe(304);
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
    await page.unroute('**/resources/content?view=information**');
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Sự kiện nổi bật', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Hoạt động thử nghiệm', exact: true }),
    ).toBeVisible();
    const again = page.waitForResponse(
      (r) =>
        r.url().includes('/resources/content?view=information') &&
        r.status() === 304,
    );
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Thông tin', exact: true })
      .click();
    await again;
    await expect(page.locator('.content-skeleton')).toHaveCount(0);
  });
  test('late responses cannot replace the latest selected tab', async ({
    page,
  }) => {
    await page.goto(origin + '/contact');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      '**/resources/content?view=information**',
      async (route) => {
        await gate;
        await route.continue();
      },
    );
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Thông tin', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Thông tin từ SACUTE' }),
    ).toBeVisible();
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Học bổng', exact: true })
      .click();
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Sự kiện nổi bật', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Hoạt động thử nghiệm', exact: true }),
    ).toBeVisible();
    release();
    await expect(page).toHaveURL(origin + '/events');
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toHaveCount(0);
  });
  test('hidden cached posts and failed validation are removed, with an explicit retry', async ({
    page,
  }) => {
    const row = fixture.state.rows[0];
    await page.goto(origin + '/information');
    await expect(
      page.getByRole('heading', { name: row.title, exact: true }),
    ).toBeVisible();
    await page.goto(origin + '/posts/' + row.slug);
    await expect(
      page.getByRole('heading', { name: row.title, exact: true }),
    ).toBeVisible();
    // Warm detail navigation cache, then change visibility in the synthetic DB.
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Thông tin', exact: true })
      .click();
    await page.locator('.post-card-link').first().click();
    await expect(
      page.getByRole('heading', { name: row.title, exact: true }),
    ).toBeVisible();
    row.status = 'draft';
    try {
      await page
        .locator('.sidebar')
        .getByRole('link', { name: 'Thông tin', exact: true })
        .click();
      await expect(page.locator('.content-skeleton')).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: row.title, exact: true }),
      ).toHaveCount(0);
      fixture.state.fail = true;
      await page
        .locator('.sidebar')
        .getByRole('link', { name: 'Liên hệ', exact: true })
        .click();
      await page
        .locator('.sidebar')
        .getByRole('link', { name: 'Thông tin', exact: true })
        .click();
      await expect(page.getByRole('alert')).toContainText(
        'Không thể tải nội dung',
      );
      await expect(page.locator('.article-card')).toHaveCount(0);
      fixture.state.fail = false;
      await page.getByRole('button', { name: 'Thử tải lại' }).click();
      await expect(
        page.getByRole('heading', {
          name: 'Thông báo thử nghiệm trước',
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      row.status = 'published';
      fixture.state.fail = false;
    }
  });
  test('browser focus revalidates and scheduled posts appear using the DB clock', async ({
    page,
  }) => {
    const row = fixture.state.rows[0];
    row.visible_from = '2030-11-15T00:00:00.000Z';
    try {
      await page.goto(origin + '/information');
      await expect(
        page.getByRole('heading', {
          name: 'Thông báo thử nghiệm trước',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: row.title, exact: true }),
      ).toHaveCount(0);
      await page.clock.install();
      fixture.state.now = row.visible_from;
      const checked = page.waitForResponse((r) =>
        r.url().includes('/resources/content?view=information'),
      );
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.clock.fastForward(2100);
      await checked;
      await expect(
        page.getByRole('heading', { name: row.title, exact: true }),
      ).toBeVisible();
    } finally {
      row.visible_from = null;
      fixture.state.now = '2030-11-10T00:00:00.000Z';
    }
  });
  test('cache retention expires without replaying an unvalidated result', async ({
    page,
  }) => {
    await page.goto(origin + '/information');
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
    await page.clock.install();
    await page.clock.fastForward(300001);
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Liên hệ', exact: true })
      .click();
    const request = page.waitForRequest((r) =>
      r.url().includes('/resources/content?view=information'),
    );
    await page
      .locator('.sidebar')
      .getByRole('link', { name: 'Thông tin', exact: true })
      .click();
    expect((await request).headers()['if-none-match']).toBeUndefined();
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
  });
  test('query cache is bounded and evicts older search results', async ({
    page,
  }) => {
    await page.goto(origin + '/information');
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
    for (let i = 0; i < 17; i++) {
      const response = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/resources/content' &&
          new URL(r.url()).searchParams.get('q') === `bounded-${i}`,
      );
      await page.getByRole('searchbox').fill(`bounded-${i}`);
      await page.getByRole('searchbox').press('Enter');
      await response;
      await expect(
        page.getByRole('heading', {
          name: 'Không có nội dung phù hợp',
          exact: true,
        }),
      ).toBeVisible();
    }
    const evicted = page.waitForRequest(
      (r) =>
        new URL(r.url()).pathname === '/resources/content' &&
        new URL(r.url()).searchParams.get('q') === 'bounded-0',
    );
    await page.getByRole('searchbox').fill('bounded-0');
    await page.getByRole('searchbox').press('Enter');
    expect((await evicted).headers()['if-none-match']).toBeUndefined();
  });
  test('repeated navigation to the same pending tab shares one data fetch', async ({
    page,
  }) => {
    await page.goto(origin + '/contact');
    let release!: () => void,
      requests = 0;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      '**/resources/content?view=information**',
      async (route) => {
        requests++;
        await gate;
        await route.continue();
      },
    );
    const tab = page
      .locator('.sidebar')
      .getByRole('link', { name: 'Thông tin', exact: true });
    await tab.click();
    await expect(page.locator('.content-skeleton')).toBeVisible();
    await tab.click();
    await tab.click();
    expect(requests).toBe(1);
    release();
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
  });
  test('opening a loaded list article renders its full body before detail validation completes', async ({
    page,
  }) => {
    await page.goto(origin + '/information');
    await expect(
      page.getByRole('heading', {
        name: 'Thông báo thử nghiệm mới',
        exact: true,
      }),
    ).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/resources/content?view=post**', async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.locator('.post-card-link').first().click();
      await expect(page.locator('.post-detail')).toBeVisible();
      await expect(page.locator('.post-detail')).toContainText(
        'Nội dung thử nghiệm tiếng Việt',
      );
      await expect(page.locator('.content-skeleton')).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page).toHaveURL(origin + '/posts/bai-thu-nghiem-notice');
  });
  test('filters preview locally when the complete source list has already loaded', async ({
    page,
  }) => {
    await page.goto(origin + '/information?category=');
    await expect(
      page.getByRole('heading', { name: 'Hoạt động thử nghiệm', exact: true }),
    ).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      '**/resources/content?view=information**',
      async (route) => {
        await gate;
        await route.continue();
      },
    );
    try {
      await page
        .getByRole('button', { name: 'Hoạt động', exact: true })
        .click();
      await expect(
        page.getByRole('heading', {
          name: 'Hoạt động thử nghiệm',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', {
          name: 'Thông báo thử nghiệm mới',
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(page.locator('.content-skeleton')).toHaveCount(0);
    } finally {
      release();
    }
  });
});
