// 選択駅（経路に入れる駅）の自動推定と上書き（rules §3.2）。

import { platformKey, type ChoiceOverride, type Project } from './model';

export interface ChoiceInfo {
  /** 経路に入れるか */
  chosen: boolean;
  /** 上書きがなく自動で決まったか */
  auto: boolean;
  override?: ChoiceOverride;
  /** 画面に出す推定理由 */
  reason: string;
}

/** 系統ごと・経由要素ごとの選択駅。戻り値は [系統の添字][経由要素の添字] */
export function computeChoices(project: Project): ChoiceInfo[][] {
  const platformsFrom = collectEntryPlatforms(project);
  const names = new Map(project.stations.map((s) => [s.id, s.name]));

  return project.services.map((service) => {
    const last = service.entries.length - 1;
    return service.entries.map((e, i): ChoiceInfo => {
      const auto = autoChoice(i, last, e.platform, () => {
        const prev = service.entries[i - 1]?.stationId ?? '';
        const used = platformsFrom.get(pairKey(prev, e.stationId)) ?? [];
        return { prevName: names.get(prev) ?? '?', used };
      });
      // 終点は上書きに関係なく必ず入る（rules §3.2）
      const override =
        i === last || e.platform === null
          ? undefined
          : project.overrides.choice[platformKey(e.stationId, e.platform)];
      if (!override) return { chosen: auto.chosen, auto: true, reason: auto.reason };

      const chosen = override === 'include';
      const action = chosen ? '手動で入れる' : '手動で外す';
      const note =
        auto.chosen === chosen
          ? `自動でも${chosen ? '入る' : '入らない'}`
          : `自動では${auto.chosen ? '入る' : '入らない'}：${auto.reason}`;
      return { chosen, auto: false, override, reason: `${action}（${note}）` };
    });
  });
}

function autoChoice(
  i: number,
  last: number,
  platform: number | null,
  neighbours: () => { prevName: string; used: number[] },
): { chosen: boolean; reason: string } {
  if (i === last) return { chosen: true, reason: '終点' };
  if (platform === null) return { chosen: false, reason: 'のりば未定（他団体区間）' };
  if (i === 0) return { chosen: false, reason: '始発駅（経路に入らない）' };
  const { prevName, used } = neighbours();
  const list = used.map((n) => `${n}番`).join('・');
  if (used.length >= 2) {
    return { chosen: true, reason: `${prevName} から入るのりばが ${list} の${used.length}つ` };
  }
  return { chosen: false, reason: `${prevName} から入るのりばは ${list} だけ` };
}

function pairKey(prevStationId: string, stationId: string): string {
  return `${prevStationId}>${stationId}`;
}

/** 全系統の隣り合う2駅（前の駅 → 駅）ごとに、使われているのりば番号（昇順） */
function collectEntryPlatforms(project: Project): Map<string, number[]> {
  const sets = new Map<string, Set<number>>();
  for (const service of project.services) {
    service.entries.forEach((e, i) => {
      const prev = service.entries[i - 1];
      if (!prev || e.platform === null) return;
      const key = pairKey(prev.stationId, e.stationId);
      let set = sets.get(key);
      if (!set) sets.set(key, (set = new Set()));
      set.add(e.platform);
    });
  }
  return new Map([...sets].map(([k, s]) => [k, [...s].sort((a, b) => a - b)]));
}
