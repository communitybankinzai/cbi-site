# 武蔵屋めぐりのナレーション（MP3）を edge-tts で生成する（2026-09-13 中司さん決定：案B）
#   python build_narration.py            … 文が変わった分だけ生成
#   python build_narration.py --force    … 全部作り直す
# 声：男性 ja-JP-KeitaNeural／女性 ja-JP-NanamiNeural（Microsoft Edge の読み上げと同じ声。edge-tts は非公式ツールで、
# 作った音声の公開利用は Microsoft の規約上あいまい。イベント用途として中司さんが了承・2026-09-13）
# 文の元：../../musashiya-texts.json（kids／adult）＋ 駅・ゴールの定型文（musashiya.js と同じ文言に保つこと）
import asyncio, json, os, re, sys, hashlib, argparse
sys.stdout.reconfigure(encoding='utf-8')
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
TEXTS = os.path.join(HERE, '..', '..', 'musashiya-texts.json')
BUNKAZAI = os.path.join(HERE, '..', '..', 'bunkazai.json')
VOICES = {'male': 'ja-JP-KeitaNeural', 'female': 'ja-JP-NanamiNeural'}
RATE = '+15%'  # 読み上げの速さ（musashiya.js の SPEECH_RATE 1.2 に相当）

STATION = {
    'kids': 'ここは千葉ニュータウン中央駅（ちばニュータウンちゅうおうえき）。まわりのビルや道路が、本物そっくりの3Dで見えるよ。ここから、武蔵屋（むさしや）の近くの文化財へ向かおう！',
    'adult': '千葉ニュータウン中央駅の上空です。周囲の建物や道路は Google の3D都市データで、実際の街並みがそのまま再現されています。ここから武蔵屋の近くの文化財へ向かいます。',
}
GOAL_PREFIX = {'kids': 'ゴール！ 武蔵屋に とうちゃく。', 'adult': 'ゴール。武蔵屋に到着しました。'}
KANJI = re.compile(r'[一-鿿々〆ヵヶ]+（([ぁ-ゖー]+)）')

def speech_text(kana_or_name, body):
    # musashiya.js の speechText() と同じ：「漢字（よみ）」は読みだけ
    return (kana_or_name + '。' if kana_or_name else '') + KANJI.sub(r'\1', body)

def station_text(age):
    t = STATION[age]
    return t.replace('千葉ニュータウン中央駅（ちばニュータウンちゅうおうえき）', 'ちばニュータウンちゅうおうえき').replace('武蔵屋（むさしや）', 'むさしや')

def build_jobs():
    texts = json.load(open(TEXTS, encoding='utf-8'))['spots']
    spots = json.load(open(BUNKAZAI, encoding='utf-8'))['spots']
    byid = {s['reportId']: s for s in spots}
    jobs = []  # (key, age, text)
    for rid, t in texts.items():
        b = byid.get(rid)
        if not b:
            print('WARN reportId not in bunkazai.json:', rid); continue
        for age in ('kids', 'adult'):
            body = t.get(age) or b.get('description') or ''
            name = b.get('kana') if age == 'kids' else b.get('name')
            text = speech_text(name, body)
            if rid == 'iwaike-jutaku-omoya':
                jobs.append(('goal', age, GOAL_PREFIX[age] + text))  # ゴールは前置きつき
            jobs.append((rid, age, text))
    for age in ('kids', 'adult'):
        jobs.append(('station', age, station_text(age)))
    return jobs

async def synth(voice, text, path):
    await edge_tts.Communicate(text, voice, rate=RATE).save(path)

async def main(force):
    jobs = build_jobs()
    manifest_path = os.path.join(HERE, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8')) if os.path.exists(manifest_path) else {'files': {}}
    files = manifest['files']
    made = skipped = 0
    for gender, voice in VOICES.items():
        os.makedirs(os.path.join(HERE, gender), exist_ok=True)
        for key, age, text in jobs:
            rel = f'{gender}/{key}_{age}.mp3'
            path = os.path.join(HERE, rel)
            h = hashlib.sha1((voice + RATE + text).encode('utf-8')).hexdigest()[:12]
            if not force and files.get(rel, {}).get('hash') == h and os.path.exists(path):
                skipped += 1; continue
            for attempt in range(3):
                try:
                    await synth(voice, text, path); break
                except Exception as e:
                    print('retry', rel, e); await asyncio.sleep(2)
            else:
                print('FAILED', rel); continue
            files[rel] = {'hash': h, 'chars': len(text), 'voice': voice, 'bytes': os.path.getsize(path)}
            made += 1
            print('made', rel, files[rel]['bytes'], 'bytes')
    manifest['voices'] = VOICES; manifest['rate'] = RATE
    manifest['generated'] = '2026-09-13'
    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(v['bytes'] for v in files.values())
    print(f'made {made}, skipped {skipped}, files {len(files)}, total {total/1e6:.1f} MB')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true')
    asyncio.run(main(ap.parse_args().force))
