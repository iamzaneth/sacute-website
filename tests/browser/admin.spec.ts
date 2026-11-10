import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { startAdminFixture, editorPostID } from '../support/admin-supabase.mjs';
import { imageBytes, testKey } from '../support/supabase.mjs';

test.skip(
  Boolean(process.env.E2E_BASE_URL),
  'Synthetic admin credentials are for the local fixture only.',
);
for (const width of [390, 1280]) {
  test(`private login and read-only admin at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/posts');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(
      page.getByRole('heading', { name: 'Đăng nhập quản trị' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Điều hướng chính' }),
    ).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill('synthetic-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByText('Chế độ chỉ đọc.', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Tạo bài viết' }),
    ).toBeDisabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('link', { name: 'Bài viết', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Trạng thái', exact: true })
      .selectOption('draft');
    await page.getByRole('button', { name: 'Lọc bài viết' }).click();
    await expect(
      page.getByRole('cell', { name: /Bản nháp riêng tư/ }),
    ).toBeVisible();
    await page.goto(`/admin/posts/${editorPostID}/edit`);
    await expect(page.getByLabel('Tiêu đề', { exact: false })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Lưu thay đổi', exact: true }),
    ).toBeDisabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Thư viện ảnh', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Tải ảnh lên' }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/login\?logout=1/);
    await page.goto('/admin/posts');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
}
test('non-admin cannot enter the dashboard', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill('reader@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Không có quyền truy cập' }),
  ).toBeVisible();
  const response = await page.goto('/admin/posts');
  expect(response?.status()).toBe(403);
});

test.describe('enabled CMS with isolated synthetic backend', () => {
  let fixture: Awaited<ReturnType<typeof startAdminFixture>>;
  let child: ChildProcess;
  let origin: string;
  test.beforeAll(async ({ browserName }, workerInfo) => {
    expect(browserName).toBe('chromium');
    fixture = await startAdminFixture();
    origin = `http://127.0.0.1:${4180 + workerInfo.parallelIndex}`;
    child = spawn(process.execPath, ['scripts/preview.mjs'], {
      cwd: 'apps/web',
      env: {
        ...process.env,
        PORT: new URL(origin).port,
        ADMIN_ORIGIN: origin,
        ADMIN_WRITES_ENABLED: 'true',
        SUPABASE_URL: fixture.url,
        SUPABASE_PUBLISHABLE_KEY: testKey,
      },
      stdio: 'ignore',
    });
    await expect
      .poll(async () => {
        try {
          return (await fetch(origin + '/admin/login')).status;
        } catch {
          return 0;
        }
      })
      .toBe(200);
  });
  test.afterAll(async () => {
    if (child?.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
    await fixture?.close();
  });

  test('authenticated navigation uses skeletons without caching private data', async ({
    page,
  }) => {
    await page.goto(origin + '/admin/login');
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill('synthetic-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(origin + '/admin');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/admin/posts.data**', async (route) => {
      await gate;
      await route.continue();
    });
    const loaded = page.waitForResponse((r) =>
      r.url().includes('/admin/posts.data'),
    );
    await page.getByRole('link', { name: 'Bài viết', exact: true }).click();
    await expect(
      page.getByRole('status', { name: 'Đang tải dữ liệu quản trị…' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Quản trị', exact: true }),
    ).toBeVisible();
    release();
    expect((await loaded).headers()['cache-control']).toContain(
      'private, no-store',
    );
    await expect(
      page.getByRole('heading', { name: 'Bài viết', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('status', { name: 'Đang tải dữ liệu quản trị…' }),
    ).toHaveCount(0);
  });
  test('create draft, publish, edit ordered gallery, archive, and upload image', async ({
    page,
  }) => {
    const save = async (name: string) => {
      const previousURL = page.url();
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page).not.toHaveURL(previousURL);
      await expect(page.getByText('Đã lưu bài viết thành công.')).toBeVisible();
    };
    await page.goto(origin + '/admin/login');
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill('synthetic-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('link', { name: 'Tạo bài viết', exact: true }).click();
    await page.getByLabel('Tiêu đề', { exact: false }).fill('Bài viết CMS mới');
    await page.getByLabel('Slug', { exact: false }).fill('bai-viet-cms-moi');
    await page.getByLabel('Danh mục', { exact: false }).fill('Thông báo');
    await page.getByLabel('Tóm tắt', { exact: false }).fill('Tóm tắt CMS');
    await page
      .getByLabel('Nội dung *', { exact: true })
      .fill('Nội dung CMS đã kiểm thử.');
    await save('Lưu bản nháp');
    expect(
      (await page.request.get(origin + '/posts/bai-viet-cms-moi')).status(),
    ).toBe(404);
    await save('Đăng ngay');
    const published = await page.request.get(
      origin + '/posts/bai-viet-cms-moi',
    );
    expect(published.status()).toBe(200);
    expect(await published.text()).toContain('Nội dung CMS đã kiểm thử.');
    await page
      .getByLabel('Đường dẫn ảnh', { exact: true })
      .fill('synthetic/0.png');
    await page.getByRole('button', { name: 'Thêm ảnh', exact: true }).click();
    await page
      .getByLabel('Đường dẫn ảnh', { exact: true })
      .fill('synthetic/1.png');
    await page.getByRole('button', { name: 'Thêm ảnh', exact: true }).click();
    await page.getByRole('button', { name: 'Chuyển ảnh 2 lên' }).click();
    await save('Lưu thay đổi');
    const gallery = await (
      await page.request.get(origin + '/posts/bai-viet-cms-moi')
    ).text();
    expect(gallery.indexOf('synthetic/1.png')).toBeGreaterThan(-1);
    await page.locator('details.admin-lifecycle > summary').click();
    await page
      .getByRole('combobox', { name: 'Chọn thao tác', exact: true })
      .selectOption('archive');
    page.once('dialog', (dialog) => dialog.accept());
    await save('Lưu trữ');
    expect(
      (await page.request.get(origin + '/posts/bai-viet-cms-moi')).status(),
    ).toBe(404);
    await page.getByRole('link', { name: 'Thư viện ảnh', exact: true }).click();
    await page.getByLabel('Chọn ảnh').setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: imageBytes,
    });
    await page
      .getByRole('button', { name: 'Tải ảnh lên', exact: true })
      .click();
    await expect(page.getByText(/Đã tải ảnh: admin\//)).toBeVisible();
    const uploadStatus = await page
      .getByText(/Đã tải ảnh: admin\//)
      .textContent();
    const privatePath = uploadStatus!.match(
      /admin\/[a-f0-9-]+\/[a-f0-9-]+\.png/,
    )![0];
    await page.goto(origin + '/admin/posts/new');
    await page
      .getByLabel('Tiêu đề', { exact: false })
      .fill('Ảnh nháp riêng tư');
    await page.getByLabel('Slug', { exact: false }).fill('anh-nhap-rieng-tu');
    await page.getByLabel('Danh mục', { exact: false }).fill('Thông báo');
    await page.getByLabel('Tóm tắt', { exact: false }).fill('Nội dung nháp');
    await page
      .getByLabel('Nội dung *', { exact: true })
      .fill('Nội dung nháp với ảnh riêng tư');
    await page
      .getByLabel('Đường dẫn ảnh', { exact: true })
      .fill(`draft-media/${privatePath}`);
    await page.getByRole('button', { name: 'Thêm ảnh', exact: true }).click();
    const preview = page.locator('.admin-attached img');
    await expect(preview).toHaveAttribute('src', /\/admin\/media\/file\?/);
    await expect
      .poll(() =>
        preview.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await save('Lưu bản nháp');
    expect(
      (await page.request.get(origin + '/posts/anh-nhap-rieng-tu')).status(),
    ).toBe(404);
    await save('Đăng ngay');
    const editorURL = page.url();
    await page.goto(origin + '/posts/anh-nhap-rieng-tu');
    const publicImage = page.locator('img[src^="/media/posts/"]').first();
    await expect(publicImage).toBeVisible();
    await expect
      .poll(() =>
        publicImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const imageURL = await publicImage.getAttribute('src');
    await page.goto(editorURL);
    await page.locator('details.admin-lifecycle > summary').click();
    await page
      .getByRole('combobox', { name: 'Chọn thao tác', exact: true })
      .selectOption('hide');
    page.once('dialog', (dialog) => dialog.accept());
    await save('Ẩn bài');
    expect(
      (await page.request.get(origin + '/posts/anh-nhap-rieng-tu')).status(),
    ).toBe(404);
    expect((await page.request.get(origin + imageURL)).status()).toBe(404);
  });
  test('schedule, reschedule, cancel, hide, archive and Trash work through contextual controls', async ({
    page,
  }) => {
    fixture.state.now = '2030-11-10T00:00:00.000Z';
    await page.goto(origin + '/admin/login');
    await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill('synthetic-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByRole('link', { name: 'Tạo bài viết', exact: true }).click();
    const form = page.locator('.admin-form');
    await form
      .getByLabel('Tiêu đề', { exact: false })
      .fill('Lifecycle browser scheduled');
    await form
      .getByLabel('Slug', { exact: false })
      .fill('lifecycle-browser-scheduled');
    await form.getByLabel('Danh mục', { exact: false }).fill('Thông báo');
    await form
      .getByLabel('Tóm tắt', { exact: false })
      .fill('Nội dung vòng đời');
    await form
      .getByLabel('Nội dung *', { exact: true })
      .fill('Giữ nguyên nội dung qua mọi trạng thái.');
    const save = async (name: string) => {
      const previous = page.url();
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page).not.toHaveURL(previous);
      await expect(page.getByText('Đã lưu bài viết thành công.')).toBeVisible();
    };
    await save('Lưu bản nháp');
    await form.locator('details > summary').click();
    await form.getByLabel('Ngày đăng', { exact: true }).fill('2030-11-15');
    await form.getByLabel('Giờ đăng', { exact: true }).fill('07:00');
    await expect(
      form.getByText(/Bài viết sẽ tự động hiển thị lúc/),
    ).toContainText('07:00 ngày 15/11/2030');
    await save('Hẹn giờ đăng');
    const record = () =>
      fixture.state.rows.find(
        (row) => row.slug === 'lifecycle-browser-scheduled',
      );
    expect(record()!.visible_from).toBe('2030-11-15T00:00:00.000Z');
    expect(
      (
        await page.request.get(origin + '/posts/lifecycle-browser-scheduled')
      ).status(),
    ).toBe(404);
    await form
      .getByLabel('Tiêu đề', { exact: false })
      .fill('Lifecycle browser updated');
    await save('Lưu thay đổi');
    expect(record()!.visible_from).toBe('2030-11-15T00:00:00.000Z');
    await form.getByLabel('Ngày đăng', { exact: true }).fill('2030-11-16');
    await form.getByLabel('Giờ đăng', { exact: true }).fill('09:30');
    await save('Đổi lịch');
    expect(record()!.visible_from).toBe('2030-11-16T02:30:00.000Z');
    const change = async (
      action: string,
      label: string,
      confirmation = false,
    ) => {
      const panel = page.locator('details.admin-lifecycle');
      if ((await panel.getAttribute('open')) === null)
        await panel.locator('summary').click();
      await panel
        .getByRole('combobox', { name: 'Chọn thao tác', exact: true })
        .selectOption(action);
      if (confirmation) page.once('dialog', (dialog) => dialog.accept());
      await save(label);
    };
    await change('cancel_schedule', 'Hủy lịch', true);
    expect(record()!.status).toBe('draft');
    expect(record()!.visible_from).toBeNull();
    await save('Đăng ngay');
    expect(
      (
        await page.request.get(origin + '/posts/lifecycle-browser-scheduled')
      ).status(),
    ).toBe(200);
    await change('hide', 'Ẩn bài', true);
    expect(
      (
        await page.request.get(origin + '/posts/lifecycle-browser-scheduled')
      ).status(),
    ).toBe(404);
    await save('Đăng ngay');
    await change('archive', 'Lưu trữ', true);
    await expect(form.getByLabel('Tiêu đề', { exact: false })).toBeDisabled();
    await change('restore_archive', 'Khôi phục về bản nháp');
    expect(record()!.status).toBe('draft');
    await change('trash', 'Chuyển vào thùng rác', true);
    expect(record()!.deleted_at).not.toBeNull();
    expect(
      (
        await page.request.get(origin + '/posts/lifecycle-browser-scheduled')
      ).status(),
    ).toBe(404);
    const panel = page.locator('details.admin-lifecycle');
    await panel.locator('summary').click();
    await expect(
      panel.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }),
    ).toBeDisabled();
    await page.goto(origin + '/admin/posts');
    await expect(
      page.getByRole('cell', { name: /Lifecycle browser updated/ }),
    ).toHaveCount(0);
    await page
      .getByRole('combobox', { name: 'Trạng thái', exact: true })
      .selectOption('trashed');
    await page.getByRole('button', { name: 'Lọc bài viết' }).click();
    await expect(
      page.getByRole('cell', { name: /Lifecycle browser updated/ }),
    ).toBeVisible();
    await page
      .getByRole('row')
      .filter({ hasText: 'Lifecycle browser updated' })
      .getByRole('link', { name: 'Xem', exact: true })
      .click();
    await change('restore_trash', 'Khôi phục');
    expect(record()!.deleted_at).toBeNull();
    expect(record()!.status).toBe('draft');
    expect(record()!.content).toBe('Giữ nguyên nội dung qua mọi trạng thái.');
    expect(
      (
        await page.request.get(origin + '/posts/lifecycle-browser-scheduled')
      ).status(),
    ).toBe(404);
  });
});
