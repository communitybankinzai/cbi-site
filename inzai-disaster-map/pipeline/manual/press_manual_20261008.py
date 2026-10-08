# -*- coding: utf-8 -*-
"""県の復旧見込みPDF 10/8版（fukkyumitoshi5.pdf・全ページ画像）を、運営（Claude）が画像を読んで書き起こし、
press_cards.update（自動反映と同じ関門）で pref-recovery-outlook.json へ反映する。"""
import json, sys, datetime as dt, hashlib, os
os.chdir(r"C:/Users/you08/OneDrive/CBI/site/inzai-disaster-map/pipeline")
sys.path.insert(0, ".")
import press_cards as PC
S = r"C:/Users/you08/AppData/Local/Temp/claude/C--Users-you08-OneDrive-CBI/99fb9040-9004-4d37-8bf0-3a79f00955eb/scratchpad"
J = "../pref-recovery-outlook.json"
URL = "https://www.pref.chiba.lg.jp/doukan/douroiji/documents/fukkyumitoshi5.pdf"
sha = hashlib.sha256(open(S + "/new.pdf", "rb").read()).hexdigest()
assert sha == "59c6e6fefdec7a5b5a57c881999b2dec3a2bc6883c6d09176262b93e3fe99a05", sha
now = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).replace(microsecond=0).isoformat()

# 10/8版（令和8年10月8日時点・14時00分時点 48区間）の区間カード。形式: 路線番号 市町村+場所 区分 見込み
# 区分: 大規模 / 中規模 / 土砂撤去中 / 土砂撤去済 / 倒木撤去中 / 排水作業中 / 解除:M/D。「外」はPDFの見出しどおり
T = """
409 袖ケ浦市林 大規模 調査中
409 袖ケ浦市大鳥居 解除:10/3
409 市原市西国吉 土砂撤去中 2週間程度
409 市原市栢橋 大規模 調査中
410 君津市大坂外 中規模 2週間程度
13 長柄町針ケ谷 解除:10/2
14 長柄町山根 大規模 調査中
21 茂原市大沢 大規模 調査中
21 市原市金剛地 土砂撤去済 1週間程度
24 君津市笹 中規模 3週間程度
32 市原市月崎 土砂撤去中 1週間程度
32 市原市石神 中規模 3週間程度
33 袖ケ浦市滝の口 大規模 調査中
34 鋸南町市井原 大規模 調査中
67 茂原市桂 解除:10/3
67 市原市瀬又 大規模 調査中
81 市原市藪外 土砂撤去中 2週間程度
81 市原市石神 大規模 調査中
81 君津市黄和田畑外 中規模 3週間程度
81 大多喜町葛藤外 土砂撤去中 3週間程度
81 鴨川市天津 解除:10/7
90 木更津市小浜 中規模 1カ月程度
90 君津市坂田 中規模 1カ月程度
93 君津市大野台 大規模 調査中
128 長柄町船木 大規模 調査中
143 袖ケ浦市川原井 大規模 調査中
143 市原市上高根 中規模 3週間程度
144 市原市豊成 解除:10/1
144 市原市中高根 大規模 調査中
145 君津市岩出 解除:10/2
147 長柄町針ケ谷 大規模 調査中
148 市原市平蔵 土砂撤去中 1週間程度
160 市原市飯給外 大規模 調査中
163 君津市鹿野山外 大規模 調査中
163 君津市福岡 解除:10/6
164 君津市草牛 大規模 調査中
168 市原市養老 土砂撤去中 2週間程度
168 木更津市真里谷 大規模 調査中
168 木更津市市野々 大規模 調査中
169 木更津市丹原 大規模 調査中
171 市原市古敷谷 土砂撤去中 1カ月程度
171 市原市徳氏外 解除:10/2
172 市原市月出外 土砂撤去中 2週間程度
173 市原市古敷谷外 大規模 調査中
177 勝浦市大森 解除:10/2
178 大多喜町会所 大規模 調査中
182 富津市志駒 大規模 調査中
185 南房総市富浦町大津 大規模 調査中
269 君津市大鷲新田 大規模 調査中
269 木更津市上烏田 大規模 調査中
284 市原市鶴舞 解除:10/1
287 市原市椎津 大規模 調査中
287 袖ケ浦市久保田 大規模 調査中
287 袖ケ浦市蔵波 中規模 1カ月程度
292 市原市武士 排水作業中 3週間程度
292 市原市勝間 大規模 調査中
163 富津市桜井 中規模 1カ月程度
143 袖ケ浦市上泉 中規模 1カ月程度
"""
cards = []
for line in T.strip().splitlines():
    parts = line.split()
    no, place, kind = parts[0], parts[1], parts[2]
    if kind.startswith("解除:"):
        m, d = kind[3:].split("/")
        cards.append({"routeNo": no, "road": None, "place": place, "cleared": True, "clearedMD": (int(m), int(d)), "scale": None, "work": None, "outlook": None})
        continue
    outlook = parts[3]
    if outlook == "調査中":
        scale, work = "large", "大規模"
    elif outlook.endswith("カ月程度"):
        scale, work = "medium", kind          # 古敷谷は「土砂撤去中・1カ月程度」をそのまま残す
    else:
        scale, work = "small", (None if kind == "中規模" else kind)   # 中規模札＋◯週間は自動読み取りと同じく work は既存値のまま・scale=small
    cards.append({"routeNo": no, "road": None, "place": place, "cleared": False, "clearedMD": None, "scale": scale, "work": work, "outlook": outlook})
assert len(cards) == 58, len(cards)
parsed = {"asOfDate": "2026-10-08", "asOfIso": "2026-10-08T14:00:00+09:00", "statedActive": 48, "cards": cards}

data = json.load(open(J, encoding="utf-8"))
ok, s = PC.update(data, parsed, URL, sha)
print("ok:", ok, "reason:", s.get("reason"), "cards:", s["cards"], "active:", s["active"], "cleared:", s["cleared"], "changes:", s.get("changes"))
print("unmatched:", s["unmatched"], "missing:", s["missing"])
for l in s.get("changeList", []):
    print("  変更", l)
assert ok and s["unmatched"] == ["None 富津市桜井", "None 袖ケ浦市上泉"] and not s["missing"], "一覧との対応が想定と違う"

W = "県の発表（10月8日14時時点）で規制中"
new_items = [
    {"id": "163-富津市-桜井", "routeNo": "163", "road": "一般県道 小櫃佐貫(T)線", "municipality": "富津市", "place": "桜井", "work": "中規模", "outlook": "1カ月程度", "scale": "medium", "traffic": "1,000台未満",
     "lat": 35.246265, "lon": 139.912048, "geocode": "千葉県富津市桜井", "status": "active", "clearedAt": None, "clearedFigure": None, "nearestRedLineM": None, "watch": W, "watchRadiusM": 3500, "mark": None,
     "firstSeen": "2026-10-07", "firstSeenNote": "県の10/7版PDFで追加された区間"},
    {"id": "143-袖ケ浦市-上泉", "routeNo": "143", "road": "一般県道 南総昭和線", "municipality": "袖ケ浦市", "place": "上泉", "work": "中規模", "outlook": "1カ月程度", "scale": "medium", "traffic": "1,000台以上",
     "lat": 35.409775, "lon": 140.047318, "geocode": "千葉県袖ケ浦市上泉", "status": "active", "clearedAt": None, "clearedFigure": None, "nearestRedLineM": None, "watch": W, "watchRadiusM": 3500, "mark": None,
     "firstSeen": "2026-10-08", "firstSeenNote": "県の10/8版PDFで追加された区間"},
]
ids = {it["id"] for it in data["items"]}
for it in new_items:
    assert it["id"] not in ids
    data["items"].append(it)
ko = next(it for it in data["items"] if it["id"] == "171-市原市-古敷谷")
ko["watch"] = W + "（新たな崩落を確認したため復旧期間を見直し）"
s["unmatched"] = []   # 2件は上で登録した

w = data.setdefault("watch", {})
w["press"] = {"sha256": sha, "checkedAt": now, "appliedAt": now, "appliedBy": "運営が画像を読んで反映（10/8版は全ページが画像で文字が無い）"}
pa = {k: v for k, v in s.items() if k != "changeList"}
pa.update(sha256=sha, url=URL, checkedAt=now, manual=True,
          note="10/8版（fukkyumitoshi5.pdf）は全7ページが画像のみで文字が無く press_cards は0枚。運営（Claude）が各ページを画像に起こして読み取り、同じ関門（件数一致・時点）を手で確認して反映")
w["pressAuto"] = pa
data["updatedAt"] = now
with open(J, "w", encoding="utf-8", newline="\n") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write("\n")
d2 = json.load(open(J, encoding="utf-8"))
print("書き込み後: items", len(d2["items"]), "active", sum(1 for i in d2["items"] if i["status"] == "active"), "cleared", sum(1 for i in d2["items"] if i["status"] == "cleared"))
print("source:", json.dumps(d2["source"], ensure_ascii=False))
