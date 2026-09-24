import { expect, test } from '@playwright/test';

test('トップページが表示される', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('KT式 TC ビルダー');
});
