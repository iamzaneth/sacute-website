import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { localContent } from '../../packages/shared/src/index';

const notices = localContent.information.filter(
  (item) => item.category === 'Thông báo',
);
const searchTitle = localContent.events[0].title;

const routes = [
  '/',
  '/information',
  '/scholarships',
  '/events',
  '/contact',
  '/recruitment',
];
for (const width of [320, 360, 390, 768, 1024, 1366, 1440, 1920, 2560]) {
  test(`all pages fit and render at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator('main')).toBeVisible();
      const footer = page.locator('footer.footer');
      await expect(footer.locator('.brand-caption > span')).toHaveText(
        'Trung tâm Tư vấn và Hỗ trợ Sinh viên',
      );
      await expect(footer.locator('a[href="/information"]')).toHaveCount(0);
      const facebook = await footer
        .getByRole('link', { name: 'Facebook' })
        .boundingBox();
      const tiktok = await footer
        .getByRole('link', { name: 'TikTok' })
        .boundingBox();
      expect(Math.abs(facebook!.y - tiktok!.y)).toBeLessThan(2);
      if (route === '/recruitment') {
        for (const detail of await page.locator('.team-detail').all()) {
          await detail.locator('summary').click();
          await expect(detail).toHaveAttribute('open', '');
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await expect(
            detail.getByRole('heading', { name: 'Mô tả công việc' }),
          ).toBeVisible();
        }
        await page.locator('.team-detail[open] summary').click();
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
          window.scrollTo({ top: 0, behavior: 'instant' });
        });
      }
    }
    expect(errors).toEqual([]);
  });
}
for (const width of [320, 390, 768, 1366, 1440]) {
  test(`public pages meet automated accessibility checks at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      if (route === '/recruitment')
        await page.locator('#academics summary').click();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        result.violations,
        `${route}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
      ).toEqual([]);
    }
  });
}
test('mobile drawer traps focus, closes with Escape, restores focus and navigates', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect
    .poll(async () => Math.abs((await dialog.boundingBox())!.x))
    .toBeLessThan(1);
  await expect(
    dialog.getByRole('button', { name: 'Đóng menu điều hướng' }),
  ).toBeFocused();
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press('Shift+Tab');
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('link', { name: 'Học bổng' }).click();
  await expect(page).toHaveURL(/\/scholarships$/);
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

for (const width of [1024, 1366, 1920]) {
  test(`desktop sidebar collapses, navigates and expands at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const sidebar = page.getByRole('complementary', {
      name: 'Thanh điều hướng',
    });
    const initialWidth = (await sidebar.boundingBox())!.width;
    const sidebarAvatar = sidebar.locator('.brand-logo');
    await expect(sidebarAvatar).toHaveAttribute(
      'src',
      '/branding/profile/avatar.jpg',
    );
    await expect(page.locator('.institution-header .header-logo')).toBeHidden();
    async function expectIndependentColumns() {
      const avatar = (await sidebarAvatar.boundingBox())!;
      const header = (await page.locator('.institution-header').boundingBox())!;
      const navigation = (await sidebar.boundingBox())!;
      expect(navigation.y).toBe(0);
      expect(avatar.x).toBeGreaterThanOrEqual(navigation.x);
      expect(avatar.x + avatar.width).toBeLessThanOrEqual(
        navigation.x + navigation.width,
      );
      expect(header.x).toBeGreaterThanOrEqual(
        navigation.x + navigation.width - 1,
      );
      expect(header.width + navigation.width).toBeCloseTo(width, 0);
    }
    await expectIndependentColumns();
    expect((await sidebarAvatar.boundingBox())!.width).toBeGreaterThanOrEqual(
      56,
    );
    await sidebar
      .getByRole('button', { name: 'Thu gọn thanh điều hướng' })
      .click();
    const expand = sidebar.getByRole('button', {
      name: 'Mở rộng thanh điều hướng',
    });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect
      .poll(async () => (await sidebar.boundingBox())!.width)
      .toBe(104);
    await expectIndependentColumns();
    await expect
      .poll(async () => (await page.locator('.site-body').boundingBox())!.x)
      .toBe(104);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await sidebar.getByRole('link', { name: 'Học bổng', exact: true }).click();
    await expect(page).toHaveURL('/scholarships');
    await expect(
      sidebar.getByRole('link', { name: 'Học bổng', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(expand).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(sidebar).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Mở menu điều hướng' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width, height: 900 });
    await expand.focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await sidebar.boundingBox())!.width)
      .toBe(initialWidth);
    await expect(
      sidebar.getByRole('button', { name: 'Thu gọn thanh điều hướng' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
}

for (const width of [390, 1366]) {
  test(`team deep links, selection, keyboard disclosure and history work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/recruitment#academics');
    await expect(page.locator('#academics')).toHaveAttribute('open', '');
    await expect(page.locator('.team-card[href="#academics"]')).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.locator('#academics .editorial-note')).toBeVisible();
    const slugs = [
      'communications',
      'administration',
      'skills-workshops',
      'housing-employment',
    ];
    for (const slug of slugs) {
      await page.locator(`.team-card[href="#${slug}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#${slug}$`));
      await expect(page.locator(`#${slug}`)).toHaveAttribute('open', '');
      await expect(page.locator('.team-detail[open]')).toHaveCount(1);
      await expect(page.locator(`#${slug} summary`)).toBeFocused();
      await expect(page.locator(`#${slug} h4`)).toHaveCount(3);
    }
    await page.goBack();
    await expect(page.locator('#skills-workshops')).toHaveAttribute('open', '');
    await page.locator('#skills-workshops summary').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#skills-workshops')).not.toHaveAttribute('open');
    await page.keyboard.press('Space');
    await expect(page.locator('#skills-workshops')).toHaveAttribute('open', '');
    await page.goto('/recruitment#housing-employment');
    await expect(page.locator('#housing-employment')).toHaveAttribute(
      'open',
      '',
    );
    await expect(page.locator('a[href*="forms.google"]')).toHaveCount(0);
  });
}

test('official logo and supplied contacts render as functional accessible links', async ({
  page,
}) => {
  await page.goto('/contact');
  const main = page.getByRole('main');
  await expect(
    main.getByRole('link', { name: 'sacute@hcmute.edu.vn' }),
  ).toHaveAttribute('href', 'mailto:sacute@hcmute.edu.vn');
  await expect(
    main.getByText('Số 01, Võ Văn Ngân, P. Thủ Đức, TP. HCM'),
  ).toBeVisible();
  for (const url of [
    'https://www.facebook.com/hotrosinhvienspkt',
    'https://www.tiktok.com/@sacute.2015',
  ]) {
    const link = main.locator(`a[href="${url}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  const images = page.locator('.brand-logo:visible');
  for (const image of await images.all()) {
    expect(
      await image.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return (
          el instanceof HTMLImageElement &&
          el.complete &&
          el.naturalWidth > 0 &&
          Math.abs(box.width - box.height) < 1
        );
      }),
    ).toBe(true);
  }
});
test('search and filters update the URL, reset, and recover empty results', async ({
  page,
}) => {
  await page.goto('/information');
  const filters = page.getByRole('group', { name: 'Lọc theo chuyên mục' });
  await expect(filters.getByRole('button')).toHaveText([
    'Tất cả',
    'Thông báo',
    'Hoạt động',
    'Xóa bộ lọc',
  ]);
  await expect(
    filters.getByRole('button', { name: 'Thông báo', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.article-card')).toHaveCount(notices.length);
  await page.getByLabel('Tìm kiếm nội dung').fill('không-tồn-tại-demo');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(
    page.getByRole('heading', { name: 'Không có nội dung phù hợp' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  await expect(page).toHaveURL(/category=/);
  await expect(page.locator('.article-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page).toHaveURL('/information?category=');
  await expect(
    filters.getByRole('button', { name: 'Tất cả', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.article-card')).toHaveCount(
    localContent.information.length,
  );
  for (const item of localContent.information)
    await expect(
      page.getByRole('heading', { name: item.title, exact: true }),
    ).toBeVisible();
});
test('FAQs expand and unknown routes have a functional HTTP 404 fallback', async ({
  page,
}) => {
  await page.goto('/recruitment');
  await page.getByText('SACUTE đang tuyển thành viên không?').click();
  await expect(
    page.getByText(
      'Hiện chưa có đợt tuyển thành viên được công bố trên website.',
      { exact: false },
    ),
  ).toBeVisible();
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Trang này chưa có ở đây.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page).toHaveURL('/');
});
test('internal links and built assets resolve', async ({ page, request }) => {
  const links = new Set<string>();
  for (const route of routes) {
    await page.goto(route);
    for (const href of await page
      .locator('a[href^="/"]')
      .evaluateAll((elements) =>
        elements.map((el) => el.getAttribute('href')!),
      ))
      links.add(href);
    const missingImages = await page
      .locator('img')
      .evaluateAll(async (elements) => {
        // Request off-screen attachments too before checking for broken assets.
        await Promise.all(
          elements.map((image) => {
            image.loading = 'eager';
            return image.decode();
          }),
        );
        return elements.some(
          (image) => !image.complete || image.naturalWidth === 0,
        );
      });
    expect(missingImages).toBe(false);
  }
  for (const href of links)
    expect((await request.get(href)).status(), href).toBe(200);
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(favicon).toBeTruthy();
  expect((await request.get(favicon!)).status()).toBe(200);
  expect(favicon).toMatch(/favicon\.svg$/);
  const iconAlpha = await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url!;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, 32, 32);
    return [
      [0, 0],
      [31, 0],
      [0, 31],
      [31, 31],
      [16, 16],
    ].map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
  }, favicon);
  expect(iconAlpha).toEqual([0, 0, 0, 0, 255]);
});

test('skip link and search retain visible keyboard focus on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/information');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Chuyển đến nội dung chính' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const input = page.getByLabel('Tìm kiếm nội dung');
  await input.focus();
  await expect(input).toHaveCSS('outline-style', 'solid');
  await expect(input).toHaveCSS('font-size', '16px');
  const submit = page.getByRole('button', { name: 'Tìm kiếm', exact: true });
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await input.fill('không-tồn-tại-demo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/q=/);
  const reset = page.getByRole('button', { name: 'Xóa bộ lọc' });
  await reset.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/information?category=');
});

test('drawer remains accessible with reduced motion and forced colors', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await expect(dialog.locator('.nav-item.active')).toHaveCSS(
    'outline-style',
    'solid',
  );
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  await dialog
    .getByRole('link', { name: 'Tuyển thành viên', exact: true })
    .click();
  await expect(page).toHaveURL('/recruitment');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
});

test('content reflows with 200 percent text size', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  for (const route of routes) {
    await page.goto(route);
    // Snapshot original sizes so nested content is doubled only once.
    await page.evaluate(() => {
      const elements = [
        ...document.querySelectorAll<HTMLElement>('body *:not(svg):not(svg *)'),
      ];
      const sizes = elements.map((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      );
      elements.forEach(
        (element, index) => (element.style.fontSize = `${sizes[index] * 2}px`),
      );
    });
    if (route === '/recruitment')
      await page.locator('#academics summary').click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    await expect(page.locator('h1')).toBeVisible();
  }
});

test('explicit all categories survives search, reload, and browser history', async ({
  page,
}) => {
  await page.goto('/information');
  const filters = page.getByRole('group', { name: 'Lọc theo chuyên mục' });
  const all = filters.getByRole('button', { name: 'Tất cả', exact: true });
  const announcement = filters.getByRole('button', {
    name: 'Thông báo',
    exact: true,
  });
  await expect(announcement).toHaveAttribute('aria-pressed', 'true');
  await all.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL('/information?category=');
  await page.getByLabel('Tìm kiếm nội dung').fill(searchTitle);
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(page.locator('.result-count')).toHaveText('1 bài viết');
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Tìm kiếm nội dung')).toHaveValue(searchTitle);
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page.locator('.result-count')).toHaveText(
    `${localContent.information.length} bài viết`,
  );
  await expect(page.getByLabel('Tìm kiếm nội dung')).toHaveValue('');
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Xóa bộ lọc' })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByLabel('Tìm kiếm nội dung')).toHaveValue(searchTitle);
  await expect(page.locator('.result-count')).toHaveText('1 bài viết');
  await page.goForward();
  await expect(page.locator('.result-count')).toHaveText(
    `${localContent.information.length} bài viết`,
  );
  await page.goto('/scholarships?q=missing&category=Học+bổng');
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(
    page.getByRole('button', { name: 'Tất cả', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('heading', { name: localContent.scholarships[0].title }),
  ).toBeVisible();
});

for (const width of [1024, 1366, 1920]) {
  test(`sidebar animation keeps controls stable and shell aligned at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('.sidebar-toggle').waitFor();
    for (const opening of [false, true]) {
      const frames = await page.evaluate(async () => {
        const sidebar = document.querySelector('.sidebar')!;
        const toggle =
          document.querySelector<HTMLButtonElement>('.sidebar-toggle')!;
        const icon = sidebar.querySelector('.nav-item > svg')!;
        const supportIcon = sidebar.querySelector('.sidebar-bottom a > svg')!;
        const snapshot = () => ({
          width: sidebar.getBoundingClientRect().width,
          iconX: icon.getBoundingClientRect().x,
          iconY: icon.getBoundingClientRect().y,
          toggleY: toggle.getBoundingClientRect().y,
          supportX: supportIcon.getBoundingClientRect().x,
          supportY: supportIcon.getBoundingClientRect().y,
          headerGap:
            document
              .querySelector('.institution-header')!
              .getBoundingClientRect().x -
            sidebar.getBoundingClientRect().right,
          contentGap:
            document.querySelector('.site-body')!.getBoundingClientRect().x -
            sidebar.getBoundingClientRect().right,
          overflow: document.documentElement.scrollWidth > innerWidth,
        });
        const samples = [snapshot()];
        toggle.click();
        const started = performance.now();
        await new Promise<void>((resolve) => {
          const sample = () => {
            samples.push(snapshot());
            if (performance.now() - started < 350)
              requestAnimationFrame(sample);
            else resolve();
          };
          requestAnimationFrame(sample);
        });
        return samples;
      });
      expect(
        frames.some(
          (frame) =>
            frame.width > 105 &&
            frame.width < frames[opening ? frames.length - 1 : 0].width - 1,
        ),
      ).toBe(true);
      for (const frame of frames) {
        expect(frame.iconX).toBeCloseTo(frames[0].iconX, 0);
        expect(frame.iconY).toBeCloseTo(frames[0].iconY, 0);
        expect(frame.toggleY).toBeCloseTo(frames[0].toggleY, 0);
        expect(frame.supportX).toBeCloseTo(frames[0].supportX, 0);
        expect(frame.supportY).toBeCloseTo(frames[0].supportY, 0);
        expect(Math.abs(frame.headerGap)).toBeLessThan(1);
        expect(Math.abs(frame.contentGap)).toBeLessThan(1);
        expect(frame.overflow).toBe(false);
      }
      if (!opening) {
        const support = page.locator('.sidebar-bottom a');
        await support.hover();
        const bounds = (await support.boundingBox())!;
        const rail = (await page.locator('.sidebar').boundingBox())!;
        const icon = (await support.locator('svg').first().boundingBox())!;
        expect(bounds.width).toBe(80);
        expect(bounds.x - rail.x).toBeCloseTo(12, 0);
        expect(
          Math.abs(bounds.x + bounds.width / 2 - (icon.x + icon.width / 2)),
        ).toBeLessThan(1);
      }
    }
  });
}
