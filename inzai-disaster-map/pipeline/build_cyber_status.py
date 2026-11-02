"""通信・金融・サイバーの画面（?mode=cyber）に出す公的情報を、cyber-status.json に書く。

自動で取るのは公的な2件だけ（2026-11-02 事業主決定）。ほかの事業者・団体のページは地図の画面にリンクを置くだけで取らない。
  - JPCERT/CC の注意喚起・緊急報告（RSS 1.0）… 見出し・日付・リンクだけを持つ（本文は写さない）。
  - 総務省「電気通信事故の発生状況」… 年度ごとの報道資料（PDF）の題名・公表日・リンクだけを持つ（PDF の中身は読まない）。

取れなかった情報源は前回の値を残し、ok=false と error を付ける（画面は「取得できません」と出す。古い値を最新に見せない）。
標準ライブラリだけで動く。使い方: python pipeline/build_cyber_status.py [--out cyber-status.json]
"""
import argparse
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
UA = "CBI-disaster-map/1.0 (+https://communitybankinzai.github.io/cbi-site/inzai-disaster-map/)"
JPCERT_RSS = "https://www.jpcert.or.jp/rss/jpcert.rdf"
SOUMU_PAGE = "https://www.soumu.go.jp/menu_seisaku/ictseisaku/net_anzen/jiko/result.html"
SOUMU_BASE = "https://www.soumu.go.jp"
JPCERT_KEEP = 8      # 画面に出す件数
SOUMU_KEEP = 3
HEARTBEAT_HOURS = 6  # 変化がなくても、この時間ごとには確認時刻を書き直す

NS = {
    "rss": "http://purl.org/rss/1.0/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "dc": "http://purl.org/dc/elements/1.1/",
}


def now_iso():
    return datetime.now(JST).isoformat(timespec="seconds")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read()


def read_jpcert():
    root = ET.fromstring(fetch(JPCERT_RSS))
    items = []
    for node in root.findall("rss:item", NS):
        title = (node.findtext("rss:title", "", NS) or "").strip()
        link = (node.findtext("rss:link", "", NS) or "").strip()
        date = (node.findtext("dc:date", "", NS) or "").strip()
        m = re.match(r"^(注意喚起|緊急報告)\s*[:：]\s*(.+)$", title)
        if not m or not link.startswith("https://www.jpcert.or.jp/"):
            continue   # Weekly Report などは出さない
        body = m.group(2).strip()
        state = ""
        sm = re.search(r"\s*[（(](公開|更新)[）)]\s*$", body)
        if sm:
            state = sm.group(1)
            body = body[:sm.start()].strip()
        items.append({"kind": m.group(1), "title": body, "state": state, "url": link, "date": date})
    if not items:
        raise ValueError("注意喚起・緊急報告が1件も読めませんでした（フィードの形が変わった可能性）")
    items.sort(key=lambda x: x["date"], reverse=True)
    return {"items": items[:JPCERT_KEEP]}


def read_soumu():
    html = fetch(SOUMU_PAGE).decode("cp932", errors="replace")
    reports = []
    for m in re.finditer(r'<a[^>]+href="([^"]+\.pdf)"[^>]*>(.*?)</a>', html, re.S):
        label = re.sub(r"<[^>]+>", "", m.group(2))
        label = re.sub(r"\s+", " ", label).strip()
        pm = re.match(r"^(令和|平成)(\d+|元)年度分?(?:上半期分)?[（(](令和|平成)(\d+|元)年(\d+)月(\d+)日\s*報道資料[）)]$", label)
        if not pm:
            continue
        era, y = pm.group(3), pm.group(4)
        year = (1 if y == "元" else int(y)) + (2018 if era == "令和" else 1988)
        published = f"{year:04d}-{int(pm.group(5)):02d}-{int(pm.group(6)):02d}"
        url = m.group(1)
        if url.startswith("/"):
            url = SOUMU_BASE + url
        reports.append({"label": label, "url": url, "published": published})
    if not reports:
        raise ValueError("年度ごとの報道資料のリンクが1件も読めませんでした（ページの形が変わった可能性）")
    reports.sort(key=lambda x: x["published"], reverse=True)
    excel = ""
    em = re.search(r'href="(/main_content/\d+\.xlsx)"', html)
    if em:
        excel = SOUMU_BASE + em.group(1)
    return {"pageUrl": SOUMU_PAGE, "excelUrl": excel, "reports": reports[:SOUMU_KEEP]}


def refresh(previous, reader):
    """前回の値(previous)を土台に、reader の結果で上書きする。失敗したら前回の値を残して ok=false。"""
    out = dict(previous or {})
    out["checkedAt"] = now_iso()
    try:
        out.update(reader())
        out["ok"] = True
        out["error"] = ""
        out["lastSuccessAt"] = out["checkedAt"]
    except Exception as exc:   # 一時的な失敗で画面を空にしないため、前回の値は残す
        out["ok"] = False
        out["error"] = f"{type(exc).__name__}: {exc}"[:300]
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "cyber-status.json"))
    args = parser.parse_args()
    path = Path(args.out)
    prev = {}
    if path.exists():
        try:
            prev = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            prev = {}
    data = {
        "jpcert": refresh(prev.get("jpcert"), read_jpcert),
        "soumu": refresh(prev.get("soumu"), read_soumu),
    }
    data["generatedAt"] = now_iso()
    # 中身（取得の成否・件数・内容）が前回と同じなら、確認時刻だけの違いでは書き換えない（コミットを増やさない）。
    # ただし画面の「最終確認」が古く見えないよう、HEARTBEAT_HOURS を過ぎたら書く
    def core(d):
        skip = {"checkedAt", "lastSuccessAt"}
        return json.dumps({k: {kk: vv for kk, vv in v.items() if kk not in skip} for k, v in d.items() if isinstance(v, dict)}, ensure_ascii=False, sort_keys=True)
    try:
        age_h = (datetime.now(JST) - datetime.fromisoformat(prev["generatedAt"])).total_seconds() / 3600
    except Exception:
        age_h = 999
    if prev and core(prev) == core(data) and age_h < HEARTBEAT_HOURS:
        print("変更なし")
        return 0
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for key in ("jpcert", "soumu"):
        print(key, "ok" if data[key]["ok"] else "NG: " + data[key]["error"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
