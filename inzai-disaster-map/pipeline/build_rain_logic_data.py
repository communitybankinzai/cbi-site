# -*- coding: utf-8 -*-
"""雨の判定の説明ページ（rain-logic.html）で、誰でも数値を変えて試せるようにするためのデータを作る。

- 周辺アメダス7か所の10分雨量（CiDAO の控え disaster_amedas_10min。1時間値だけの時期は6コマに均等に配る）
- 台風25号（2026-09-20〜24）の「通れない」「通れた」の記録の時刻・種類・場所（約100m単位に丸める）

判定の式は cidao src/lib/disaster-rain-logic.ts と同じものを rain-logic.html の JS で計算する。
使い方（CBI の PC で・接続先は cidao の .env.local から読む）: python build_rain_logic_data.py
出力: ../rain-logic-data.json
"""
import datetime as dt
import io
import json
import os
import re

import psycopg

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "rain-logic-data.json")
STATIONS = [  # cidao の AMEDAS_STATIONS のうち、控えを貯めている7か所
    ("45061", "我孫子", 35.8633, 140.11), ("45116", "佐倉", 35.7283, 140.2117), ("45121", "成田", 35.7633, 140.385),
    ("45106", "船橋", 35.7117, 140.0433), ("45081", "香取", 35.8583, 140.5017), ("45181", "横芝光", 35.655, 140.505),
    ("45212", "千葉", 35.6017, 140.1033),
]
START = dt.datetime(2026, 9, 12, 15, 0, tzinfo=dt.timezone.utc)   # 9/13 0時（記録の7日前から）
END = dt.datetime(2026, 9, 26, 15, 0, tzinfo=dt.timezone.utc)
EVENT = ("2026-09-19T15:00:00Z", "2026-09-24T15:00:00Z")          # 台風25号（9/20〜9/24・日本時間）
SLOT = dt.timedelta(minutes=10)


def main():
    env = io.open(r"C:\Repos\cidao\.env.local", encoding="utf-8").read()
    url = re.search(r'^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?', env, re.M).group(1)
    n = int((END - START) / SLOT)
    out = {
        "note": "CiDAO の雨量の控え（気象庁アメダスの10分値）と、防災MAPの記録（通れない・通れた）。判定の式は rain-logic.html と cidao src/lib/disaster-rain-logic.ts。",
        "generatedAt": dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat(timespec="minutes"),
        "start": START.isoformat().replace("+00:00", "Z"), "slotMinutes": 10, "slots": n,
        "event": {"name": "台風25号", "from": EVENT[0], "to": EVENT[1]},
        "stations": [], "records": [],
    }
    with psycopg.connect(url, connect_timeout=30) as conn:
        cur = conn.cursor()
        for code, name, lat, lon in STATIONS:
            cur.execute("""select observed_at, r10_mm, r1h_mm from disaster_amedas_10min
                           where station_id=%s and observed_at > %s and observed_at <= %s order by observed_at""",
                        (code, START, END))
            vals = [None] * n
            for t, r10, r1h in cur.fetchall():
                i = int((t - START) / SLOT) - 1  # observed_at の10分値は、その時刻までの10分（コマは始まりの時刻）
                if r10 is not None and 0 <= i < n:
                    vals[i] = round(float(r10), 1)
                elif r10 is None and r1h is not None:
                    for j in range(6):
                        k = i - j
                        if 0 <= k < n and vals[k] is None:
                            vals[k] = round(float(r1h) / 6, 2)
            out["stations"].append({"code": code, "name": name, "lat": lat, "lon": lon, "r10": vals})
        cur.execute("""select kind, ended_at, path from disaster_passed_roads
                       where not hidden and path is not null and ended_at > %s and ended_at <= %s order by ended_at""",
                    (EVENT[0], EVENT[1]))
        for kind, t, path in cur.fetchall():
            lat, lon = path[-1]
            out["records"].append([kind[0], t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), round(lat, 3), round(lon, 3)])
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("stations", len(out["stations"]), "slots", n, "records", len(out["records"]), "bytes", os.path.getsize(OUT))


if __name__ == "__main__":
    main()
