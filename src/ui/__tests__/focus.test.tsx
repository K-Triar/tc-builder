import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App';
import { derive } from '../../domain/derive';
import { createGuidedProject } from '../../domain/presets';
import { saveProject } from '../../storage/db';
import { useProjectStore } from '../../store/projectStore';

const state = () => useProjectStore.getState().project!;
const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const next = () => click(/^次へ/);

beforeEach(() => useProjectStore.getState().close());

async function openNew() {
  const p = createGuidedProject();
  await saveProject(p);
  render(
    <MemoryRouter initialEntries={[`/p/${p.id}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return p;
}

describe('はじめての質問（集中モード）で、新しい路線網を最後まで作る', () => {
  it('路線網の準備 → 駅 → のりば → 列車の走り方 → いまここ', async () => {
    await openNew();

    // A 路線網の準備
    await h1('この路線網に名前を付けてください');
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('路線網の名前'), { target: { value: '試験線' } });
    next();

    await h1('あなたはどの鉄道会社の人ですか？');
    next();
    expect(screen.getByRole('alert')).toHaveTextContent('鉄道会社を選んでください');
    fireEvent.click(screen.getByRole('radio', { name: 'Kトライア' }));
    expect(screen.getByText(/会社コード「K」と路線（5つ）は自動で入ります/)).toBeInTheDocument();
    next();

    await h1('ほかの鉄道会社の線路に、列車が乗り入れますか？');
    fireEvent.click(screen.getByRole('radio', { name: '乗り入れる' }));
    expect(state().guide?.through).toBe('yes');
    next();
    await h1('乗り入れ先の鉄道会社にチェックを入れてください');
    // 自分の会社は出さない
    expect(screen.queryByRole('checkbox', { name: 'Kトライア' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: '翠鉄（翠玉急行電気鉄道）' }));
    next();

    await h1(/Kトライア の路線にチェック/);
    fireEvent.click(screen.getByRole('checkbox', { name: /地下鉄交易所線/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /富士有徳線/ }));
    expect(state().lines.map((l) => l.code)).toEqual(['L', 'B', 'U']);
    next();

    await h1('どの種別の列車が走りますか？');
    expect(screen.getByRole('checkbox', { name: '普通' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '臨時' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: '特急' }));
    next();

    await h1('名前の付いた列車はありますか？');
    expect(screen.getByRole('radio', { name: 'ない' })).toBeChecked();
    next();

    await h1('ここまでのこたえ');
    const answers = screen.getByText('乗り入れ先').closest('div')!;
    expect(answers).toHaveTextContent('翠鉄');
    // 「変える」でその質問へ行き、次へで確認に戻る
    click('路線網の名前を変える');
    await h1('この路線網に名前を付けてください');
    click('確認へ戻る →');
    await h1('ここまでのこたえ');
    expect(screen.getByText('瑠璃本線・貿易港線・地下鉄中央線')).toBeInTheDocument();
    click('駅の登録へ進む →');

    // B 駅：Enter で足して続けて入れる
    await h1('列車が通る駅を、端から順に入れてください');
    for (const name of ['A駅', 'B駅', 'C駅']) {
      const input = screen.getByLabelText(/^(最初|次)の駅の名前$/);
      fireEvent.change(input, { target: { value: name } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }
    expect(state().stations.map((s) => s.name)).toEqual(['A駅', 'B駅', 'C駅']);
    // 乗り入れる会社があるので、駅ごとにどの会社の駅かを選べる
    const su = state().orgs.find((o) => o.code === 'SU')!;
    fireEvent.change(screen.getByLabelText('C駅はどの鉄道会社の駅か'), {
      target: { value: su.id },
    });
    expect(state().stations[2]!.managerOrgId).toBe(su.id);
    // 押した駅だけ詳しい設定が開く
    click('A駅の駅コード・鉄道会社を直す');
    expect(screen.getAllByText('駅コード', { selector: 'h3' })).toHaveLength(1);
    click('のりばの設定へ進む →');

    // C のりば：1駅＝1カード
    await h1('A駅：列車はどちらへ進みますか？');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /左から右へ/ }));
    click('次の駅：B駅 →');
    await h1('B駅：列車はどちらへ進みますか？');
    click('＋ のりばを足す');
    for (const r of screen.getAllByRole('radio', { name: /左から右へ/ })) fireEvent.click(r);
    click('次の駅：C駅 →');
    await h1('C駅：列車はどちらへ進みますか？');
    fireEvent.click(screen.getByRole('radio', { name: /左から右へ/ }));
    click('列車の走り方へ進む →');

    // D 列車の走り方：① 〜 ⑦
    await h1('列車の走り方');
    click('＋ 列車の走り方を作る');
    await h1('列車はどの駅から、どの駅まで走りますか？');
    expect(screen.getByLabelText('始発駅')).toHaveDisplayValue('A駅');
    expect(screen.getByLabelText('終点駅')).toHaveDisplayValue('C駅');
    next();

    await h1('この順に通りますか？');
    expect(
      within(screen.getByRole('list', { name: '通る駅' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent?.replace(/（.+）|↑︎|↓︎|外す/g, '').trim()),
    ).toEqual(['A駅', 'B駅', 'C駅']);
    click('この順でよい →');

    // ③ のりばが2つある B駅だけ聞く
    await h1('B駅では、何番のりばに着く？');
    fireEvent.click(screen.getByRole('button', { name: '2番' }));
    next();

    await h1('この区間を走る種別は？');
    fireEvent.click(screen.getByRole('checkbox', { name: '普通' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '快速' }));
    next();

    // ⑤ 普通は「全部の駅に止まる？」を先に聞く
    await h1('普通が止まる駅を選んでください');
    expect(screen.getByRole('radio', { name: '全部の駅に止まる' })).toBeChecked();
    next();
    await h1('快速が止まる駅を選んでください');
    fireEvent.click(screen.getByRole('checkbox', { name: 'B駅' }));
    next();

    await h1('この走り方の名前と向き');
    expect(screen.getByLabelText('名前')).toHaveValue('A駅 → C駅 普通・快速');
    fireEvent.click(screen.getByRole('radio', { name: '上り' }));
    next();

    await h1('できました！');
    const [down] = state().services;
    expect(down).toMatchObject({ direction: 'up', name: 'A駅 → C駅 普通・快速' });
    expect(down!.entries.map((e) => e.platform)).toEqual([1, 2, 1]);
    expect(down!.kinds.map((k) => [k.formation, k.stops])).toEqual([
      ['K301', [true, true, true]],
      ['K301', [true, false, true]],
    ]);

    // ⑦ 反対向き：のりばが決まらない B駅だけもう一度聞く
    click('反対向きも作る（おすすめ）');
    await h1('B駅では、何番のりばに着く？');
    next();
    expect(screen.getByRole('alert')).toHaveTextContent('のりばを選んでください');
    fireEvent.click(screen.getByRole('button', { name: '1番' }));
    next();

    await h1('列車の走り方');
    expect(state().services.map((s) => [s.name, s.direction])).toEqual([
      ['A駅 → C駅 普通・快速', 'up'],
      ['C駅 → A駅 普通・快速', 'down'],
    ]);
    expect(state().services[1]!.entries.map((e) => e.platform)).toEqual([1, 1, 1]);

    // 終わり → いまここ。もう集中モードには戻らない
    click('質問を終えて「いまここ」へ →');
    expect(await screen.findByRole('navigation', { name: '画面' })).toBeInTheDocument();
    expect(state().guide).toBeUndefined();
    const issues = derive(state()).issues.filter((i) => i.severity === 'error');
    expect(issues.map((i) => i.code)).toEqual(['CODE_CHARS']);
  });

  it('途中でやめると、次に開いたときは同じ質問に戻る', async () => {
    const p = createGuidedProject();
    p.guide = { at: 'kinds' };
    await saveProject(p);
    render(
      <MemoryRouter initialEntries={[`/p/${p.id}`]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await h1('どの種別の列車が走りますか？');
    expect(screen.getByRole('button', { name: '✕ やめる（保存されます）' })).toBeInTheDocument();
  });
});
