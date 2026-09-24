"""瑠璃線系統の Excel から、ゴールデンテスト（T14）の期待値 JSON を作る。

使い方（リポジトリ直下で）:
    python scripts/extract-ruri-expected.py

入力: reference/Kトライア瑠璃 瑠璃線系統TC看板表.xlsx
出力: src/fixtures/ruri/expected.json

- 「経路・編成表」→ routes / formations
- 「各駅発編成表」→ departures / terminals
- 「駅看板表」→ signs（のりばごとの看板の列）。進行方向は看板の列の隣にある矢印（→ ←）で読む。
  矢印が読めないもの（←→、矢印なし）は order を null にして manual に理由を書く。
- domain-rules §7 の既知の誤植は corrections に書いたうえで修正する。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "reference" / "Kトライア瑠璃 瑠璃線系統TC看板表.xlsx"
OUT = ROOT / "src" / "fixtures" / "ruri" / "expected.json"


def text(v) -> str:
    """セルの値を看板の文字列にする（5.0 → '5'、None → ''）"""
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def platform_number(v) -> int | None:
    t = text(v)
    return int(t) if t.isdigit() else None


# ---------------------------------------------------------------- 経路・編成表


def read_routes_and_formations(ws):
    routes, formations = [], []
    for row in ws.iter_rows(min_row=3, values_only=True):
        (route_name, via, kinds, section, code, route_list, _dup1, _dup2, _sep,
         f_code, f_desc, f_form, f_tag, f_route, f_speed, f_mob, f_player) = (list(row) + [None] * 17)[:17]
        if code:
            routes.append({
                "code": text(code),
                "dests": [d.strip() for d in text(route_list).split("→")],
                "name": text(route_name),
                "via": text(via),
                "kinds": text(kinds),
                "section": text(section).replace("\n", " / "),
            })
        if f_code:
            formations.append({
                "code": text(f_code),
                "description": text(f_desc),
                "formation": text(f_form),
                "tag": text(f_tag),
                "routeCode": text(f_route),
                "maxSpeed": float(f_speed),
                "mobCollision": text(f_mob),
                "playerCollision": text(f_player),
            })
    return routes, formations


# ---------------------------------------------------------------- 各駅発編成表


def read_departures(ws):
    """左右2つの表（A〜E、G〜K）を、見出し行（区間名）ごとに読む"""
    departures, terminals = [], []
    for first_col in (1, 7):
        section = None
        for r in range(2, ws.max_row + 1):
            cells = [ws.cell(r, first_col + i).value for i in range(5)]
            if all(c is None for c in cells):
                continue
            name, code, desc, formation, platform = cells
            if code is None and desc is None and name is not None:
                section = text(name)
                continue
            if text(name) == "駅名":
                continue
            item = {
                "section": section,
                "station": text(name),
                "stationCode": text(code),
                "description": text(desc),
                "platform": platform_number(platform),
            }
            if section == "各列車終点":
                terminals.append({**item, "line": text(formation)})
            else:
                departures.append({**item, "formationCode": text(formation)})
    return departures, terminals


# ---------------------------------------------------------------- 駅看板表

TITLE_RE = re.compile(r"^(\d+)番のりば")
STATION_RE = re.compile(r"^(.+?)((?:\[[^\]]+\])+)$")
SIGN_HEADS = {"[train]", "[+train]"}
FOREIGN_HEADS = {"HRA設定", "翠鉄設定"}


class Sheet:
    def __init__(self, ws):
        self.ws = ws
        # 結合セル：左上以外のセル → 左上、左上 → 幅
        self.anchor = {}
        self.width = {}
        for m in ws.merged_cells.ranges:
            for r in range(m.min_row, m.max_row + 1):
                for c in range(m.min_col, m.max_col + 1):
                    self.anchor[(r, c)] = (m.min_row, m.min_col)
            self.width[(m.min_row, m.min_col)] = m.max_col - m.min_col + 1

    def value(self, r, c):
        ar, ac = self.anchor.get((r, c), (r, c))
        return self.ws.cell(ar, ac).value

    def span(self, r, c) -> int:
        return self.width.get((r, c), 1)


def find_station(sheet: Sheet, row: int, col: int):
    """見出しの上にある「駅名[コード]」。結合セルや少し左にずれた見出しも拾う"""
    for r in range(row - 1, 0, -1):
        for c in range(col, max(col - 3, 0), -1):
            v = text(sheet.value(r, c))
            m = STATION_RE.match(v)
            if m:
                return m.group(1), re.findall(r"\[([^\]]+)\]", m.group(2))
    return None, []


def arrow_at(sheet: Sheet, r: int, c: int) -> str:
    v = text(sheet.value(r, c)) if c >= 1 else ""
    return v if v in ("→", "←", "←→") else ""


def read_signs(ws, corrections):
    sheet = Sheet(ws)
    blocks, manual = [], []
    for row in ws.iter_rows():
        for cell in row:
            v = text(cell.value)
            m = TITLE_RE.match(v)
            if not m:
                continue
            t, c0 = cell.row, cell.column
            station, codes = find_station(sheet, t, c0)
            signs, foreign, col = [], None, c0
            while True:
                head = text(sheet.value(t + 1, col))
                if head in FOREIGN_HEADS:
                    foreign = head
                    break
                if head not in SIGN_HEADS:
                    break
                lines = [text(sheet.value(t + k, col)) for k in range(1, 5)]
                signs.append({"cell": f"{cell.column_letter}{t}+{col - c0}", "lines": lines})
                col += max(sheet.span(t + 1, col), sheet.span(t + 2, col))
            end = col  # 看板の列の次の列

            dest = next((s["lines"][2] for s in signs if s["lines"][1] == "destination"), None)
            number = int(m.group(1))
            if dest and re.search(r"-(\d+)$", dest):
                number = int(re.search(r"-(\d+)$", dest).group(1))

            # 進行方向：看板の列のすぐ右、なければすぐ左の矢印（2行目の高さ）
            arrows = {arrow_at(sheet, t + 2, end), arrow_at(sheet, t + 2, c0 - 1)} - {""}
            order = None
            if arrows == {"→"}:
                order = "ltr"
            elif arrows == {"←"}:
                order = "rtl"

            block = {
                "station": station,
                "stationCodes": codes,
                "title": v,
                "titleCell": cell.coordinate,
                "platform": number,
                "destCode": dest,
                "foreign": foreign,
                "order": order,
                "signs": [s["lines"] for s in signs],
            }
            key = f"{station} {v}（{cell.coordinate}）"
            for fix in CORRECTIONS:
                if fix["match"](block):
                    fix["apply"](block)
                    corrections.append(f"{key}：{fix['note']}")
            if not foreign and order is None and signs:
                manual.append(f"{key}：進行方向の矢印が読めない（{'・'.join(sorted(arrows)) or '矢印なし'}）")
            if not foreign and not signs:
                manual.append(f"{key}：看板が読めない")
            blocks.append(block)
    return blocks, manual


def _fix_senapon6(block):
    for s in block["signs"]:
        if s[1].startswith("spawn") and s[2] == "[]":
            s[2] = "K300_KL10L13_Lo"


# domain-rules §7 の既知の誤植（ユーザー確認済み）
CORRECTIONS = [
    {
        "match": lambda b: b["destCode"] == "KL05-6" and any(s[2] == "[]" for s in b["signs"]),
        "apply": _fix_senapon6,
        "note": "spawn の [] を K300_KL10L13_Lo に修正（rules §7）",
    },
    {
        "match": lambda b: b["destCode"] == "KL10-2" and b["title"].startswith("1番"),
        "apply": lambda b: None,
        "note": "見出しは「1番」だが行先 KL10-2 なので 2番として扱う（rules §7）",
    },
]


def main() -> int:
    if not XLSX.exists():
        print(f"Excel が見つかりません: {XLSX}", file=sys.stderr)
        return 1
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    routes, formations = read_routes_and_formations(wb["経路・編成表"])
    departures, terminals = read_departures(wb["各駅発編成表"])
    corrections: list[str] = []
    signs, manual = read_signs(wb["駅看板表"], corrections)

    data = {
        "source": XLSX.name,
        "note": "scripts/extract-ruri-expected.py で生成。手で直さない（確認済みの差分は src/fixtures/ruri/confirmed.json に書く）",
        "routes": routes,
        "formations": formations,
        "departures": departures,
        "terminals": terminals,
        "signs": signs,
        "corrections": corrections,
        "manual": manual,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: 経路 {len(routes)}、編成 {len(formations)}、各駅発 {len(departures)}、"
          f"のりば {len(signs)}（向き不明 {len(manual)}）、誤植修正 {len(corrections)}")
    for line in corrections + manual:
        print("  " + line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
