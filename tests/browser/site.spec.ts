import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  '/',
  '/information',
  '/scholarships',
  '/events',
  '/contact',
  '/recruitment',
];
for (const width of [360, 390, 768, 1024, 1366, 1920, 2560]) {
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
      const footer = page.locator('footer');
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
      if (
        [390, 1366].includes(width) &&
        ['/contact', '/recruitment'].includes(route)
      ) {
        await page.screenshot({
          path: `test-results/${route.slice(1)}-${width}.png`,
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
    await page.goto('/');
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  });
}
for (const width of [390, 1366]) {
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
  await expect
    .poll(async () => Math.abs((await dialog.boundingBox())!.x))
    .toBeLessThan(1);
  await page.screenshot({ path: 'test-results/mobile-drawer-left.png' });
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
    await sidebar
      .getByRole('button', { name: 'Thu gọn thanh điều hướng' })
      .click();
    const expand = sidebar.getByRole('button', {
      name: 'Mở rộng thanh điều hướng',
    });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect
      .poll(async () => (await sidebar.boundingBox())!.width)
      .toBe(84);
    await expect
      .poll(async () => (await page.locator('.site-body').boundingBox())!.x)
      .toBe(84);
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
    await page.screenshot({
      path: `test-results/sidebar-collapsed-${width}.png`,
      fullPage: true,
    });
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
    await page.screenshot({
      path: `test-results/team-details-${width}.png`,
      fullPage: true,
    });
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
  await page.getByLabel('Tìm kiếm nội dung').fill('học tập');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(
    page.getByRole('heading', { name: 'Không có nội dung phù hợp' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  await expect(page).toHaveURL(/category=/);
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page).toHaveURL('/information');
  await expect(
    page.getByRole('heading', { name: 'Chưa có thông báo được công bố' }),
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
      .evaluateAll((elements) =>
        elements.some((image) => !image.complete || image.naturalWidth === 0),
      );
    expect(missingImages).toBe(false);
  }
  for (const href of links)
    expect((await request.get(href)).status(), href).toBe(200);
});
