import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('トップページが表示される', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('KT式 TC ビルダー');
});

test('サンプル → 作業 → コピー → チェック → リロードで保持', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '完成例（瑠璃線系統）を見る' }).click();
  // 開くと「いまここ」。次にやることが出る
  await expect(page).toHaveURL(/#\/p\/[^/]+\/$/);
  await expect(page.getByText('瑠璃線系統（サンプル）').first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('経路と編成を登録する');

  // 設置する → 看板を置く → 駅の路線図でオットを選ぶ
  await page
    .getByRole('navigation', { name: '画面' })
    .getByRole('link', { name: /設置する/ })
    .click();
  await page.getByRole('link', { name: /② 看板を置く/ }).click();
  await page
    .getByRole('navigation', { name: '看板を置く駅' })
    .getByRole('link', { name: /^オット/ })
    .click();
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
  await page.getByRole('link', { name: /① コマンドを打つ/ }).click();
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

test('アクセシビリティ（axe）：ホーム・いまここ・看板・コマンド・資料・質問・編集', async ({
  page,
}) => {
  // 13画面を順に調べるので長めに待つ
  test.setTimeout(150_000);
  await page.goto('./');
  await page.getByRole('button', { name: '完成例（瑠璃線系統）を見る' }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/$/);
  const id = page.url().match(/#\/p\/([^/]+)/)![1];
  for (const path of [
    '',
    `#/p/${id}/work/signs?station=st-KL04`,
    `#/p/${id}/work/commands`,
    `#/p/${id}/work/trial`,
    `#/p/${id}/docs/stops`,
    `#/p/${id}/`,
    `#/p/${id}/setup/0`,
    `#/p/${id}/setup/1`,
    `#/p/${id}/setup/2?station=st-KL04`,
    `#/p/${id}/setup/3`,
    `#/p/${id}/setup/4`,
    `#/p/${id}/edit/stations`,
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
  await page.getByRole('button', { name: '＋ 新しい路線をつくる' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '新しい路線をつくる' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('路線の名前')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('ダークモードでも文字のコントラストが足りる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  await page.getByRole('button', { name: '完成例（瑠璃線系統）を見る' }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/$/);
  const id = page.url().match(/#\/p\/([^/]+)/)![1];
  for (const path of [
    '',
    `#/p/${id}/work/signs?station=st-KL02`,
    `#/p/${id}/work/commands`,
    `#/p/${id}/setup/2?station=st-KL04`,
    `#/p/${id}/`,
  ]) {
    await page.goto(`./${path}`);
    await page.waitForTimeout(300);
    const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(
      result.violations.map((v) => `${path || 'ホーム'}: ${v.nodes[0]?.target.join(' ')}`),
    ).toEqual([]);
  }
});
