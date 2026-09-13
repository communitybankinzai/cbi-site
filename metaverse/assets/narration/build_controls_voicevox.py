# 3Dワールド「🎮 操作のしかた」（controls-guide.js）のずんだもん音声を VOICEVOX ENGINE で生成する（2026-09-13 中司さん）
#   前提：C:\Tools\voicevox_engine\windows-cpu\run.exe を起動しておく（http://127.0.0.1:50021）
#   python build_controls_voicevox.py            … 文が変わった分だけ生成
#   python build_controls_voicevox.py --force    … 全部作り直す
# 文の元：controls-guide.json の voice（common＝機種共通、xbox／ps＝コントローラーの種類ごと）
# 出力：zundamon/guide_<step>_<common|xbox|ps>.mp3。manifest.json に記録（build_narration_voicevox.py と共用）
# 利用条件：音声を使う場所に「VOICEVOX:ずんだもん」のクレジット表記（ポップアップ内に表示している）
import json, os, sys, hashlib, argparse, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_narration_voicevox import ENGINE, CHARS, synth

HERE = os.path.dirname(os.path.abspath(__file__))

def main(force):
    try: ver = urllib.request.urlopen(ENGINE + '/version', timeout=5).read().decode()
    except Exception as e: print('VOICEVOX ENGINE が起動していません:', e); sys.exit(1)
    print('engine', ver)
    steps = json.load(open(os.path.join(HERE, 'controls-guide.json'), encoding='utf-8'))['steps']
    manifest_path = os.path.join(HERE, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8')) if os.path.exists(manifest_path) else {'files': {}}
    files = manifest['files']
    c = CHARS['zundamon']
    made = skipped = 0
    for s in steps:
        for kind, text in s['voice'].items():
            rel = f"zundamon/guide_{s['id']}_{kind}.mp3"
            path = os.path.join(HERE, rel)
            h = hashlib.sha1(('voicevox:%d:%s:' % (c['speaker'], c['speed']) + text).encode('utf-8')).hexdigest()[:12]
            if not force and files.get(rel, {}).get('hash') == h and os.path.exists(path):
                skipped += 1; continue
            synth(c['speaker'], c['speed'], text, path)
            files[rel] = {'hash': h, 'chars': len(text), 'voice': c['credit'], 'bytes': os.path.getsize(path)}
            made += 1
            print('made', rel, files[rel]['bytes'], 'bytes', flush=True)
    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'made {made}, skipped {skipped}')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true')
    main(ap.parse_args().force)
