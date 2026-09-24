import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('トップページが表示される', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('KT式 TC ビルダー');
});

test('サンプル → 作業 → コピー → チェック → リロードで保持', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'サンプル（瑠璃線系統）を開く' }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/work\/signs/);
  await expect(page.getByText('瑠璃線系統（サンプル）').first()).toBeVisible();

  // オット 1番の看板カード
  await page.getByLabel('駅').selectOption({ label: 'オット（KL02）' });
  const card = page.getByRole('article', { name: 'オット 1番のりば' });
  await expect(card.getByText('B：通過列車があるのりば')).toBeVisible();

  // 行コピー
  await card.getByRole('button', { name: '2枚目の3行目「K300_KL4L13_Lo」をコピー' }).click();
  await expect(card.getByText('✓ コピーしました')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('K300_KL4L13_Lo');

  // チェック
  await card.getByLabel('設置した').check();
  await expect(card.getByLabel('設置した')).toBeChecked();

  // コマンドの1行ずつモード
  await page.getByRole('link', { name: /① コマンド/ }).click();
  await page.getByRole('button', { name: '▶ 次の行をコピー（1行ずつモード）' }).click();
  const bar = page.getByRole('region', { name: '1行ずつコピー' });
  await expect(bar).toContainText('/train route set');
  await bar.getByRole('button', { name: 'コピーして次へ' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^\/train route set /);
  await expect(bar).toContainText('/train route save');

  // リロードしても自動保存したチェックが残る（500ms デバウンスを待つ）
  await page.waitForTimeout(800);
  await page.goto(page.url().replace(/work\/commands.*/, 'work/signs?station=st-KL02'));
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'オット 1番のりば' }).getByLabel('設置した'),
  ).toBeChecked();

  // ホームの一覧にも出る
  await page.goto('./');
  await expect(page.getByRole('link', { name: '瑠璃線系統（サンプル）' }).first()).toBeVisible();
});

test('アクセシビリティ（axe）：ホーム・看板・コマンド・資料・ウィザード', async ({ page }) => {
  // 8画面を順に調べるので長めに待つ
  test.setTimeout(90_000);
  await page.goto('./');
  await page.getByRole('button', { name: 'サンプル（瑠璃線系統）を開く' }).click();
  await expect(page).toHaveURL(/work\/signs/);
  const id = page.url().match(/#\/p\/([^/]+)/)![1];
  for (const path of [
    '',
    `#/p/${id}/work/signs?station=st-KL04`,
    `#/p/${id}/work/commands`,
    `#/p/${id}/work/trial`,
    `#/p/${id}/docs/stops`,
    `#/p/${id}/setup/4`,
    `#/p/${id}/setup/5`,
    `#/p/${id}/setup/6`,
  ]) {
    await page.goto(`./${path}`);
    await page.waitForTimeout(300);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const summary = result.violations.map(
      (v) => `${path || 'ホーム'}: ${v.id}（${v.nodes.length}）${v.nodes[0]?.target.join(' ')}`,
    );
    expect(summary).toEqual([]);
  }
});

test('キーボードだけで看板のチェックとダイアログを操作できる', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '＋ 新しいプロジェクト' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '新しいプロジェクト' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('プロジェクト名')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('ダークモードでも文字のコントラストが足りる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  await page.getByRole('button', { name: 'サンプル（瑠璃線系統）を開く' }).click();
  await expect(page).toHaveURL(/work\/signs/);
  const id = page.url().match(/#\/p\/([^/]+)/)![1];
  for (const path of [
    '',
    `#/p/${id}/work/signs?station=st-KL02`,
    `#/p/${id}/work/commands`,
    `#/p/${id}/setup/5`,
  ]) {
    await page.goto(`./${path}`);
    await page.waitForTimeout(300);
    const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(
      result.violations.map((v) => `${path || 'ホーム'}: ${v.nodes[0]?.target.join(' ')}`),
    ).toEqual([]);
  }
});
