"""瑠璃線系統のサンプルプロジェクト（src/fixtures/ruri/project.ktc.json）を作る。

使い方（リポジトリ直下で）:
    python scripts/build-ruri-project.py

元にしたもの：Excel「種別表」（系統・停車駅・のりば）、「駅看板表」（向き・通過線のりば・行き止まり）、
「経路・編成表」（最高速度・他団体の形式）、domain-rules §3.1・§7。
Excel に書かれていない推定は、下の定義のコメントに「推定」と書いてある。
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "fixtures" / "ruri" / "project.ktc.json"

SELF = "org-K"
ORGS = [
    {"id": SELF, "name": "Kトライア", "code": "K"},
    {"id": "org-HRA", "name": "HRA", "code": "H"},  # 形式 H3004・H2006 より
    {"id": "org-CR", "name": "CR", "code": ""},  # 団体コードは未確認（駅コードに使わない）
    {"id": "org-SUI", "name": "翠鉄", "code": ""},  # 同上
]
LINES = [("L", "瑠璃本線"), ("B", "貿易港線"), ("Q", "地下鉄交易所線"), ("U", "地下鉄中央線"), ("Y", "富士有徳線")]
USAGES = [
    ("1", "路面電車型", 0.75),
    ("2", "在来線標準型・新快速", 1.5),
    ("3", "在来線標準型・普通快速", 1.0),
    ("6", "貨物", 1.5),
    ("7", "特急", 2.0),
    ("9", "試験・事業用", 0.5),
]
# 登録順 = spawn の並び順の第1キー
KINDS = [
    ("Lo", None, "普通"),
    ("Ra", None, "快速"),
    ("SR", "LSR", "新快速"),
    ("EX", "MKR", "特急みかり"),
]

R, L = "right", "left"

# 駅：(名前, 駅コード, のりば {番号: (向き, 行先に使うコード, 行き止まり)}, 管理団体, 自分で看板を置くか)
# 向きは Excel の station 看板の4行目。D（降車専用）と Excel にないのりばは「推定」で right。
STATIONS = [
    ("イアリーオ国際空港", ["IIA"], {1: (R,), 2: (R,)}, "org-CR", True),  # 2番の向きは推定
    ("アカシア島", ["KL01"], {1: (R,), 2: (R,), 3: (R,)}, SELF, True),  # 3番（直通快速、ユーザー確認済み）は Excel に看板なし・向き推定
    ("オット", ["KL02"], {1: (R,), 2: (R,)}, SELF, True),
    ("瑠前TT", ["KL03"], {1: (R,), 2: (R,)}, SELF, True),
    ("瑠璃中央", ["KL04", "KU01"], {1: (R, "KU01", True), 2: (R,), 3: (L,), 4: (L,), 5: (R,)}, SELF, True),
    ("セナポンタウン", ["KL05"], {3: (R,), 4: (R,), 5: (R,), 6: (R,)}, SELF, True),
    ("南セナポン", ["KL06"], {1: (R,), 2: (R,)}, SELF, True),
    ("クォーツ", ["KL07"], {2: (R,), 3: (R,)}, SELF, True),
    ("クォーツ南口", ["KL08"], {1: (R,), 2: (R,)}, SELF, True),
    ("瑠交研前", ["KL09"], {1: (R,), 2: (R,)}, SELF, True),
    ("瑠順中央", ["KL10", "KB01"], {1: (R,), 2: (R,), 3: (R, "KB01"), 4: (R, "KB01")}, SELF, True),
    ("瑠順農園", ["KL11"], {1: (R,), 2: (R,)}, SELF, True),
    ("瑠順要塞", ["KL12"], {1: (R,), 2: (R,)}, SELF, True),
    ("エメラルド城", ["KL13", "LM-1"], {1: (R,), 2: (R,)}, SELF, True),  # 2番の向きは推定
    ("南瑠順", ["KB02"], {1: (R,), 2: (R,), 3: (R,), 4: (R,)}, SELF, True),
    ("瑠順採掘場", ["KB03"], {1: (R,), 2: (R,)}, SELF, True),
    ("貿易港", ["KB04"], {1: (R,), 2: (R,)}, SELF, True),
    ("東ヘルべチア", ["KB05"], {1: (R,), 2: (R,)}, SELF, True),
    ("ラピスTT", ["KB06"], {1: (R,), 2: (R,)}, SELF, True),  # 1番の向きは推定
    ("二労", ["KU06"], {1: (R,), 2: (L, None, True)}, SELF, True),
    ("羊ノ森", ["KU05"], {1: (R,), 2: (R,)}, SELF, True),
    ("鍛冶ヶ淵", ["KU04"], {1: (R,), 2: (R,)}, SELF, True),
    ("クロアチア", ["KU03"], {1: (R,), 2: (R,)}, SELF, True),
    ("瑠璃要塞", ["KU02"], {1: (R,), 2: (R,)}, SELF, True),
    # HRA 管理（のりばは他団体の設定。水高地港・セブ地峡は駅コード不明のため経由リストから省略）
    ("クォーツ湖", ["QUL"], {}, "org-HRA", False),
    ("学園新樫樺", ["GSK"], {}, "org-HRA", False),
    ("西水中央", ["NSC"], {1: (R,), 2: (R,)}, "org-HRA", False),
]


def sid(code: str) -> str:
    for name, codes, *_ in STATIONS:
        if code in codes:
            return f"st-{codes[0]}"
    raise KeyError(code)


# 系統：名前, 方向, 直通先, 経由リスト [(駅コード, のりば)], 種別 [(タグ, 形式, 最高速度, 停車しない駅 or 停車する駅)]
# 通過駅ののりばは駅看板表の skip 看板から（rules §3.1）。
SERVICES = [
    {
        "id": "sv-L-down",
        "name": "CRアカシア線→瑠璃線→翠鉄城東線 トクテルダム中央行",
        "direction": "down",
        "throughNote": "翠鉄城東線 トクテルダム中央行",
        "entries": [("IIA", 1), ("KL01", 1), ("KL02", 1), ("KL03", 1), ("KL04", 2), ("KL05", 6), ("KL06", 1),
                    ("KL07", 2), ("KL08", 2), ("KL09", 1), ("KL10", 1), ("KL11", 1), ("KL12", 1), ("KL13", 2)],
        "kinds": [
            ("Lo", "K300", 1.0, {"pass": []}),
            ("Ra", "K302", 1.0, {"pass": ["KL02", "KL03", "KL06", "KL08", "KL11"]}),
        ],
    },
    {
        "id": "sv-L-up",
        "name": "翠鉄城東線→瑠璃線→CRアカシア線 イアリーオ国際空港行",
        "direction": "up",
        "entries": [("KL13", 1), ("KL12", 2), ("KL11", 2), ("KL10", 2), ("KL09", 2), ("KL08", 1), ("KL07", 3),
                    ("KL06", 2), ("KL05", 3), ("KL04", 5), ("KL03", 2), ("KL02", 2), ("KL01", 2), ("IIA", 2)],
        "kinds": [
            ("Lo", "K301", 1.0, {"pass": []}),
            ("Ra", "K303", 1.0, {"pass": ["KL11", "KL08", "KL06", "KL03", "KL02"]}),
        ],
    },
    {
        "id": "sv-direct-down",
        "name": "CRアカシア線→瑠璃線→HRA赤石線 直通快速 西水中央行",
        "direction": "down",
        "entries": [("IIA", 1), ("KL01", 3), ("KL02", 1), ("KL03", 1), ("KL04", 3), ("KL05", 5), ("KL06", 1),
                    ("KL07", 2), ("KL08", 2), ("KL09", 1), ("KB01", 3), ("KB02", 3), ("QUL", None), ("GSK", None),
                    ("NSC", 2)],
        "kinds": [("Ra", "K302", 1.0, {"pass": ["KL02", "KL03", "KL06", "KL08"]})],
    },
    {
        "id": "sv-direct-up",
        "name": "HRA赤石線→瑠璃線→CRアカシア線 普通(瑠璃線内直通快速) イアリーオ国際空港行",
        "direction": "up",
        "entries": [("NSC", 1), ("GSK", None), ("QUL", None), ("KB02", 4), ("KB01", 4), ("KL09", 2), ("KL08", 1),
                    ("KL07", 3), ("KL06", 2), ("KL05", 3), ("KL04", 5), ("KL03", 2), ("KL02", 2), ("KL01", 2),
                    ("IIA", 2)],
        "kinds": [("Ra", "K303", 1.0, {"pass": ["KL08", "KL06", "KL03", "KL02"]})],
    },
    {
        "id": "sv-U-up",
        "name": "中央線 各駅停車 瑠璃中央行",
        "direction": "up",
        "entries": [("KU06", 1), ("KU05", 1), ("KU04", 1), ("KU03", 1), ("KU02", 1), ("KU01", 1)],
        "kinds": [("Lo", "K301", 1.0, {"pass": []})],
    },
    {
        "id": "sv-U-down",
        "name": "中央線 各駅停車 二労行",
        "direction": "down",
        "entries": [("KU01", 1), ("KU02", 2), ("KU03", 2), ("KU04", 2), ("KU05", 2), ("KU06", 2)],
        "kinds": [("Lo", "K300", 1.0, {"pass": []})],
    },
    {
        "id": "sv-SR-down",
        "name": "中央線→瑠璃線→HRA赤石線 新快速 西水中央行",
        "direction": "down",
        "entries": [("KU06", 2), ("KU05", 1), ("KU04", 1), ("KU03", 1), ("KU02", 1), ("KL04", 3), ("KL05", 5),
                    ("KL06", 1), ("KL07", 2), ("KL08", 2), ("KL09", 1), ("KB01", 3), ("KB02", 3), ("QUL", None),
                    ("GSK", None), ("NSC", 2)],
        "kinds": [("SR-LSR", "K200", 1.5, {"stopsAt": ["KU03", "KL04", "KL05", "KB01", "GSK"]})],
    },
    {
        "id": "sv-SR-up",
        "name": "HRA赤石線→瑠璃線→中央線 新快速 二労行",
        "direction": "up",
        "entries": [("NSC", 2), ("GSK", None), ("QUL", None), ("KB02", 4), ("KB01", 4), ("KL09", 2), ("KL08", 1),
                    ("KL07", 3), ("KL06", 2), ("KL05", 4), ("KL04", 4), ("KU02", 2), ("KU03", 2), ("KU04", 2),
                    ("KU05", 2), ("KU06", 2)],
        "kinds": [("SR-LSR", "K201", 1.5, {"stopsAt": ["GSK", "KB01", "KL05", "KL04", "KU03"]})],
    },
    {
        "id": "sv-EX-down",
        "name": "中央線→瑠璃線→貿易港線 特急みかり ラピスTT行",
        "direction": "down",
        "entries": [("KU06", 2), ("KU05", 1), ("KU04", 1), ("KU03", 1), ("KU02", 1), ("KL04", 3), ("KL05", 5),
                    ("KL06", 1), ("KL07", 2), ("KL08", 2), ("KL09", 1), ("KB01", 3), ("KB02", 1), ("KB03", 1),
                    ("KB04", 1), ("KB05", 1), ("KB06", 1)],
        "kinds": [("EX-MKR", "K700", 1.5, {"pass": ["KL05", "KL06", "KL07", "KL08", "KB02"]})],
    },
    {
        "id": "sv-B-down",
        "name": "貿易港線 普通 ラピスTT行",
        "direction": "down",
        "entries": [("KB01", 3), ("KB02", 1), ("KB03", 1), ("KB04", 1), ("KB05", 1), ("KB06", 1)],
        "kinds": [("Lo", "K300", 1.0, {"pass": []})],
    },
    {
        "id": "sv-B-up",
        "name": "貿易港線→瑠璃線→中央線 二労行",
        "direction": "up",
        "entries": [("KB06", 2), ("KB05", 2), ("KB04", 2), ("KB03", 2), ("KB02", 4), ("KB01", 4), ("KL09", 2),
                    ("KL08", 1), ("KL07", 3), ("KL06", 2), ("KL05", 4), ("KL04", 4), ("KU02", 2), ("KU03", 2),
                    ("KU04", 2), ("KU05", 2), ("KU06", 2)],
        "kinds": [
            ("Lo", "K301", 1.0, {"pass": ["KL08", "KL07", "KL06"]}),
            ("EX-MKR", "K701", 1.5, {"pass": ["KB02", "KL08", "KL07", "KL06", "KL05"]}),
        ],
    },
]

# 選択駅の上書き（Excel の経路に合わせる）。HRA からの直通は南瑠順 4番を通る（ユーザー確認済み）
CHOICE = {
    "KL01#3": "exclude",  # 直通快速の IIA 発を KL4NSC にする（ユーザー確認済み）
    "KL10#2": "include",  # rules §3.2 の例（KL10IIA）
    "KL01#2": "include",  # KL10IIA・KL5IIA などの経路に KL01-2 が入っている
    "KB01#4": "include",  # KB2U6・KB1U6・KB1IIA に KB01-4 が入っている
    "KB02#4": "include",  # KB2U6 に KB02-4 が入っている（瑠順採掘場から入るのは 4番だけ）
}

# 各駅発の上書き：(系統, タグ, 駅コード) → 上書き
DEPARTURE = [
    # 瑠順中央・南瑠順から先は HRA の車両
    ("sv-direct-down", "Ra", "KB01", {"formation": "H3004"}),
    ("sv-direct-down", "Ra", "KB02", {"formation": "H3004"}),
    ("sv-SR-down", "SR-LSR", "KB01", {"formation": "H2006"}),
    ("sv-direct-up", "Ra", "KB02", {"formation": "H3004"}),
    ("sv-direct-up", "Ra", "NSC", {"foreignName": "H3004_KB2IIA_Ra"}),
    ("sv-SR-up", "SR-LSR", "NSC", {"foreignName": "H2006_KB2U6_SR-LSR"}),
    # Excel の各駅発にない発駅を外す
    ("sv-L-up", "Ra", "KL01", {"enabled": False}),
    ("sv-direct-up", "Ra", "KL01", {"enabled": False}),
    ("sv-direct-up", "Ra", "KB01", {"enabled": False}),
    ("sv-EX-down", "EX-MKR", "KB01", {"enabled": False}),
    ("sv-EX-down", "EX-MKR", "KB03", {"enabled": False}),
    ("sv-EX-down", "EX-MKR", "KB04", {"enabled": False}),
    ("sv-EX-down", "EX-MKR", "KB05", {"enabled": False}),
    *[("sv-B-up", "Lo", c, {"enabled": False}) for c in ["KB01", "KL09", "KL05", "KL04", "KU02", "KU03", "KU04", "KU05"]],
    *[("sv-B-up", "EX-MKR", c, {"enabled": False}) for c in ["KL04", "KU02", "KU03", "KU04", "KU05"]],
]


def kind_id(tag: str) -> str:
    return f"kind-{tag}"


def station_code(code: str):
    if len(code) == 4 and code[0] == "K" and code[2:].isdigit():
        return {"kind": "numbered", "orgId": SELF, "lineId": f"line-{code[1]}", "number": int(code[2:])}
    return {"kind": "free", "value": code}


def build() -> dict:
    stations = []
    for name, codes, platforms, org, by_self in STATIONS:
        st_id = f"st-{codes[0]}"
        pfs = []
        for n, spec in platforms.items():
            d, code, dead = (list(spec) + [None, False])[:3]
            pfs.append({"number": n, "codeId": f"code-{code or codes[0]}", "dir": d, "deadEnd": bool(dead)})
        stations.append({
            "id": st_id,
            "name": name,
            "managerOrgId": org,
            "signsBySelf": by_self,
            "codes": [{"id": f"code-{c}", "code": station_code(c)} for c in codes],
            "platforms": pfs,
        })

    services = []
    departure = {}
    for s in SERVICES:
        codes = [c for c, _ in s["entries"]]
        kinds = []
        for tag, formation, speed, spec in s["kinds"]:
            stops = []
            for i, c in enumerate(codes):
                if i in (0, len(codes) - 1):
                    stops.append(True)
                elif "stopsAt" in spec:
                    stops.append(c in spec["stopsAt"])
                else:
                    stops.append(c not in spec["pass"])
            kinds.append({
                "kindId": kind_id(tag),
                "formation": formation,
                "maxSpeed": speed,
                "mobCollision": "cancel",
                "playerCollision": "cancel",
                "stops": stops,
            })
        services.append({
            "id": s["id"],
            "name": s["name"],
            "direction": s["direction"],
            **({"throughNote": s["throughNote"]} if "throughNote" in s else {}),
            "entries": [{"stationId": sid(c), "platform": p} for c, p in s["entries"]],
            "kinds": kinds,
        })

    for service_id, tag, code, override in DEPARTURE:
        s = next(x for x in SERVICES if x["id"] == service_id)
        index = [c for c, _ in s["entries"]].index(code)
        departure[f"{service_id}#{kind_id(tag)}#{index}"] = override

    return {
        "schemaVersion": 1,
        "id": "sample-ruri",
        "name": "瑠璃線系統（サンプル）",
        "createdAt": "2026-09-24T00:00:00.000Z",
        "updatedAt": "2026-09-24T00:00:00.000Z",
        "selfOrgId": SELF,
        "settings": {
            "spawnSpeed": 1,
            "stationLaunchDistance": 5,
            "stationDwellSeconds": 5,
            "usages": [{"digit": d, "label": l, "defaultMaxSpeed": v} for d, l, v in USAGES],
        },
        "orgs": ORGS,
        "lines": [{"id": f"line-{c}", "orgId": SELF, "code": c, "name": n} for c, n in LINES],
        "kinds": [
            {"id": kind_id(f"{t}-{n}" if n else t), "typeCode": t, **({"trainNameCode": n} if n else {}), "name": name}
            for t, n, name in KINDS
        ],
        "stations": stations,
        "services": services,
        "overrides": {
            "choice": {f"{sid(k.split('#')[0])}#{k.split('#')[1]}": v for k, v in CHOICE.items()},
            "departure": departure,
            "skipCondition": {},
        },
        "progress": {"items": {}},
    }


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)} を書き出しました")


if __name__ == "__main__":
    main()
