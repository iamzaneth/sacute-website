import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [width, columns] of [
  [390, 1],
  [768, 2],
  [1366, 3],
  [2560, 6],
]) {
  test(`responsive post cards and full details work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/events');
    await expect(page.locator('.post-summary')).toHaveCount(2);
    await expect(page.locator('.post-gallery')).toHaveCount(0);
    await expect(page.locator('.article-body')).toHaveCount(0);
    const grid = await page
      .locator('.article-list')
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length,
      );
    expect(grid).toBe(columns);
    for (const card of await page.locator('.post-summary').all()) {
      const bounds = (await card.boundingBox())!;
      expect(bounds.width).toBeLessThan(401);
      expect(bounds.height).toBeLessThan(600);
    }
    await page.screenshot({
      path: `test-results/post-grid-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Chuyến xe đoàn viên', exact: true })
      .click();
    const filteredURL = page.url();
    await page
      .getByRole('link', {
        name: 'Lễ khởi hành Chuyến xe đoàn viên 2026',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/posts\/chuyen-xe-doan-vien-2026$/);
    const bus = page.locator('.post-detail');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Lễ khởi hành Chuyến xe đoàn viên 2026',
    );
    await expect(bus.locator('time')).toHaveText('07/02/2026');
    await expect(bus.locator('.post-author')).toHaveText(
      'Chuyến Xe Đoàn Viên - Sacute',
    );
    await expect(bus.locator('.article-body')).toContainText(
      '1.100 vé xe miễn phí',
    );
    await expect(bus.locator('.article-body')).toContainText('#CXĐV2026');
    await expect(bus.getByRole('button', { name: 'Xem thêm' })).toHaveCount(0);
    await expect(bus.locator('.post-gallery img')).toHaveCount(5);
    await expect(bus.locator('.more-photos')).toHaveText('+9');
    await expect(
      bus
        .locator('.post-header')
        .getByRole('link', { name: 'Xem bài gốc trên Facebook' }),
    ).toHaveAttribute('href', /14swyBb3st8/);
    await expect(page.locator('.post-footer')).toHaveCount(0);
    const fifthPhoto = bus.locator('.post-photo').nth(4);
    await fifthPhoto.click();
    let viewer = page.getByRole('dialog');
    async function expectImageFitted() {
      const frame = await viewer.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const img = element.querySelector(
          '.photo-viewer-stage img',
        ) as HTMLImageElement;
        const picture = img.getBoundingClientRect();
        return {
          widthGap: bounds.width - picture.width,
          heightGap: bounds.height - picture.height,
          aspectError: Math.abs(
            picture.width / picture.height -
              Number(img.getAttribute('width')) /
                Number(img.getAttribute('height')),
          ),
          fits:
            bounds.left >= 0 &&
            bounds.top >= 0 &&
            bounds.right <= innerWidth &&
            bounds.bottom <= innerHeight,
        };
      });
      expect(frame.widthGap).toBeLessThanOrEqual(3);
      expect(frame.heightGap).toBeLessThanOrEqual(3);
      expect(frame.aspectError).toBeLessThan(0.01);
      expect(frame.fits).toBe(true);
    }
    await expect(viewer.getByText('Ảnh 5 / 14')).toBeVisible();
    await expectImageFitted();
    await expect(
      viewer.getByRole('button', { name: 'Đóng ảnh' }),
    ).toBeFocused();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    for (let i = 0; i < 9; i++)
      await viewer.getByRole('button', { name: 'Ảnh tiếp theo' }).click();
    await expect(viewer.getByText('Ảnh 14 / 14')).toBeVisible();
    await expect(viewer.locator('.photo-viewer-stage img')).toHaveAttribute(
      'src',
      /photo-14.jpg$/,
    );
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByText('Ảnh 1 / 14')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(viewer.getByText('Ảnh 14 / 14')).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      expect(
        await viewer.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(fifthPhoto).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({
      path: `test-results/post-detail-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: 'Quay lại danh sách' }).click();
    await expect(page).toHaveURL(filteredURL);
    await expect(page.locator('.post-summary')).toHaveCount(1);
    await page
      .getByRole('button', { name: 'Xuân tình nguyện', exact: true })
      .click();
    await page
      .getByRole('link', {
        name: 'Chiến dịch Xuân Tình Nguyện 2026',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/posts\/xuan-tinh-nguyen-2026$/);
    expect((await page.reload())?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Chiến dịch Xuân Tình Nguyện 2026',
    );
    await expect(
      page.getByText(
        '🌸Là nơi ta gặp nhau, cùng nắm tay để tạo nên những điều tử tế.',
      ),
    ).toBeVisible();
    await expect(
      page
        .locator('.post-detail')
        .getByRole('link', { name: 'sacute@hcmute.edu.vn', exact: true }),
    ).toHaveAttribute('href', 'mailto:sacute@hcmute.edu.vn');
    await page.locator('.post-photo').click();
    viewer = page.getByRole('dialog');
    await expect(viewer.getByText('Ảnh 1 / 1')).toBeVisible();
    await expectImageFitted();
    await expect(
      viewer.getByRole('button', { name: 'Ảnh tiếp theo' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
}
