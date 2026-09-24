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
  await expect(page.getByRole('heading', { level: 1, name: '看板を置く' })).toBeVisible();
  // スマホ幅では駅の一覧は「駅を選ぶ」の中にしまってある
  const picker = page.locator('summary', { hasText: '駅を選ぶ' });
  if (await picker.isVisible()) await picker.click();
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

test('キーボードだけでダイアログを操作できる', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '完成例（瑠璃線系統）を見る' }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/$/);
  await page.goto('./');
  await page.getByRole('button', { name: '瑠璃線系統（サンプル）を消す' }).first().focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'プロジェクトを消しますか？' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('新規作成 → はじめての質問（集中モード）→ いまここ → 自動生成', async ({ page }) => {
  test.setTimeout(120_000);
  const h1 = (name: string | RegExp) => page.getByRole('heading', { level: 1, name });
  const next = () => page.getByRole('button', { name: /^次へ/ }).click();
  /** 集中モードのカードも、アクセシビリティと横はみ出しを確かめる */
  const check = async (where: string) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      result.violations.map((v) => `${where}: ${v.id} ${v.nodes[0]?.target.join(' ')}`),
    ).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${where} が横にはみ出している`).toBeLessThanOrEqual(1);
  };

  await page.goto('./');
  await page.getByRole('button', { name: '＋ 新しい路線網をつくる' }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/start\/name$/);
  await expect(h1('この路線網に名前を付けてください')).toBeFocused();
  // サイドバー・書き出しは出さない
  await expect(page.getByRole('navigation', { name: '画面' })).toHaveCount(0);
  await check('名前');
  // Enter で次へ
  await page.getByLabel('路線網の名前').fill('E2E線');
  await page.getByLabel('路線網の名前').press('Enter');

  await expect(h1('あなたはどの鉄道会社の人ですか？')).toBeVisible();
  await page.getByRole('radio', { name: 'Kトライア' }).check();
  await check('鉄道会社');
  await next();
  await expect(h1('ほかの鉄道会社の線路に、列車が乗り入れますか？')).toBeVisible();
  await page.getByRole('radio', { name: '乗り入れない' }).check();
  await next();
  await expect(h1(/の路線にチェック/)).toBeVisible();
  await check('路線');
  await next();
  await expect(h1('どの種別の列車が走りますか？')).toBeVisible();
  await next();
  await expect(h1('名前の付いた列車はありますか？')).toBeVisible();
  await next();
  await expect(h1('ここまでのこたえ')).toBeVisible();
  await check('こたえの確認');
  await page.getByRole('button', { name: '駅の登録へ進む →' }).click();

  // 途中でやめても、ホームの「続きから」で同じ質問に戻る
  await expect(h1('列車が通る駅を、端から順に入れてください')).toBeVisible();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /やめる（保存されます）/ }).click();
  await page.getByRole('link', { name: 'E2E線' }).click();
  await expect(h1('列車が通る駅を、端から順に入れてください')).toBeVisible();

  for (const name of ['東駅', '中駅', '西駅']) {
    const input = page.getByLabel(/^(最初|次)の駅の名前$/);
    await input.fill(name);
    await input.press('Enter');
  }
  await check('駅');
  await page.getByRole('button', { name: 'のりばの設定へ進む →' }).click();
  await expect(page.getByText('この駅は路線の端です。')).toBeVisible();
  await check('のりば（端の駅）');
  for (const [nextLabel, deadEnd] of [
    ['次の駅：中駅 →', true],
    ['次の駅：西駅 →', false],
    ['列車の走り方へ進む →', true],
  ] as const) {
    await page.locator('label', { hasText: '左から右へ' }).click();
    // 端の駅は折り返す
    if (deadEnd) await page.getByRole('checkbox', { name: /行き止まり/ }).check();
    await page.getByRole('button', { name: nextLabel }).click();
  }

  await expect(h1('列車の走り方')).toBeVisible();
  await page.getByRole('button', { name: '＋ 列車の走り方を作る' }).click();
  await expect(h1('列車はどの駅から、どの駅まで走りますか？')).toBeVisible();
  await check('始発と終点');
  await next();
  await page.getByRole('button', { name: 'この順でよい →' }).click();
  await expect(h1('この区間を走る種別は？')).toBeVisible();
  await page.getByRole('checkbox', { name: '普通' }).check();
  await next();
  await expect(h1('普通が止まる駅を選んでください')).toBeVisible();
  await check('止まる駅');
  await next();
  await expect(h1('この走り方の名前と向き')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '名前' })).toHaveValue('東駅 → 西駅 普通');
  await next();
  await expect(h1('できました！')).toBeVisible();
  await page.getByRole('button', { name: '反対向きも作る（おすすめ）' }).click();
  await expect(h1('列車の走り方')).toBeVisible();
  await expect(
    page.getByRole('list', { name: '作った列車の走り方' }).getByRole('listitem'),
  ).toHaveCount(2);
  await page.getByRole('button', { name: '質問を終えて「いまここ」へ →' }).click();

  // いまここ：入力はすべて済み、次はコマンド
  await expect(page).toHaveURL(/#\/p\/[^/]+\/$/);
  await expect(page.getByRole('navigation', { name: '画面' })).toBeVisible();
  await expect(h1('ゲーム内のチャットで、経路と編成を登録する')).toBeVisible();
  // 自動生成：直すところはない
  await page.goto(page.url().replace(/\/$/, '/setup/4'));
  await expect(
    page.getByText('設定に問題はありません。Minecraft での設置に進めます。'),
  ).toBeVisible();
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

test('どの画面も横にはみ出さない（スマホ幅でも横スクロールしない）', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await page.getByRole('button', { name: '完成例（瑠璃線系統）を見る' }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/$/);
  const id = page.url().match(/#\/p\/([^/]+)/)![1];
  for (const path of [
    '',
    `#/p/${id}/`,
    `#/p/${id}/setup/0`,
    `#/p/${id}/setup/1`,
    `#/p/${id}/setup/2?station=st-KL04`,
    `#/p/${id}/setup/3`,
    `#/p/${id}/setup/4`,
    `#/p/${id}/work/commands`,
    `#/p/${id}/work/signs?station=st-KL04`,
    `#/p/${id}/work/trial`,
    `#/p/${id}/edit/services`,
  ]) {
    await page.goto(`./${path}`);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path || 'ホーム'} が横にはみ出している`).toBeLessThanOrEqual(1);
  }
});
