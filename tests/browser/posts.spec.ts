import { test, expect } from '@playwright/test';
import { testContent } from '../support/supabase.mjs';

for (const kind of ['information', 'scholarships', 'events'] as const) {
  for (const item of testContent[kind]) {
    test(`${kind}: ${item.slug} opens from its card and reloads`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${kind}?category=`);
      await page.locator(`.post-card-link[href="/posts/${item.slug}"]`).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        item.title,
      );
      await expect(page.locator('.article-body')).toBeVisible();
      expect((await page.reload())?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        item.title,
      );
      for (const image of await page.locator('.post-gallery img').all()) {
        await image.scrollIntoViewIfNeeded();
        await expect(image).toBeVisible();
        await expect
          .poll(() =>
            image.evaluate((node: HTMLImageElement) => node.naturalWidth),
          )
          .toBeGreaterThan(0);
      }
      if (item.images?.length) {
        const photo = page.locator('.post-photo').first();
        await photo.click();
        const viewer = page.getByRole('dialog');
        await expect(viewer).toBeVisible();
        if (item.images.length > 1) {
          await page.keyboard.press('ArrowRight');
          await expect(
            viewer.locator('.photo-viewer-stage img'),
          ).toHaveAttribute('src', item.images[1].url);
        }
        await page.keyboard.press('Escape');
        await expect(viewer).not.toBeVisible();
        await expect(photo).toBeFocused();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole('link', { name: 'Quay lại danh sách' }).click();
      await expect(page).toHaveURL(`/${kind}?category=`);
    });
  }
}
