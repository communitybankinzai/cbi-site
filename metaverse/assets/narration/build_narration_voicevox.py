# 武蔵屋めぐりのナレーションを VOICEVOX ENGINE で生成する（2026-09-13 中司さん決定：ずんだもん）
#   前提：C:\Tools\voicevox_engine\windows-cpu\run.exe を起動しておく（http://127.0.0.1:50021）
#   python build_narration_voicevox.py            … 文が変わった分だけ生成
#   python build_narration_voicevox.py --force    … 全部作り直す
# 文の元と出力の形式は build_narration.py（edge-tts 版）と同じ。出力先は zundamon/。
# 利用条件：音声を使う場所に「VOICEVOX:ずんだもん」のクレジット表記（VOICEVOX 利用規約・ずんだもん利用規約）
import json, os, sys, hashlib, argparse, subprocess, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_narration import build_jobs, HERE  # 文の組み立てを共用

ENGINE = 'http://127.0.0.1:50021'
CHARS = {'zundamon': {'speaker': 3, 'credit': 'VOICEVOX:ずんだもん', 'speed': 1.1}}

def synth(speaker, speed, text, mp3_path):
    q = urllib.request.Request(ENGINE + '/audio_query?' + urllib.parse.urlencode({'text': text, 'speaker': speaker}), method='POST')
    aq = json.load(urllib.request.urlopen(q, timeout=60))
    aq['speedScale'] = speed
    r = urllib.request.Request(ENGINE + '/synthesis?speaker=%d' % speaker, data=json.dumps(aq).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    wav = urllib.request.urlopen(r, timeout=300).read()
    tmp = mp3_path + '.wav'
    open(tmp, 'wb').write(wav)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '64k', mp3_path], check=True)
    os.remove(tmp)

def main(force):
    try: ver = urllib.request.urlopen(ENGINE + '/version', timeout=5).read().decode()
    except Exception as e: print('VOICEVOX ENGINE が起動していません:', e); sys.exit(1)
    print('engine', ver)
    jobs = build_jobs()
    manifest_path = os.path.join(HERE, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8')) if os.path.exists(manifest_path) else {'files': {}}
    files = manifest['files']
    made = skipped = 0
    for folder, c in CHARS.items():
        os.makedirs(os.path.join(HERE, folder), exist_ok=True)
        for key, age, text in jobs:
            rel = f'{folder}/{key}_{age}.mp3'
            path = os.path.join(HERE, rel)
            h = hashlib.sha1(('voicevox:%d:%s:' % (c['speaker'], c['speed']) + text).encode('utf-8')).hexdigest()[:12]
            if not force and files.get(rel, {}).get('hash') == h and os.path.exists(path):
                skipped += 1; continue
            synth(c['speaker'], c['speed'], text, path)
            files[rel] = {'hash': h, 'chars': len(text), 'voice': c['credit'], 'bytes': os.path.getsize(path)}
            made += 1
            print('made', rel, files[rel]['bytes'], 'bytes')
    manifest.setdefault('voicevox', {}).update({k: {'speaker': v['speaker'], 'credit': v['credit'], 'speed': v['speed'], 'engine': ver} for k, v in CHARS.items()})
    json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(v['bytes'] for k, v in files.items() if k.startswith(tuple(CHARS)))
    print(f'made {made}, skipped {skipped}, voicevox total {total/1e6:.1f} MB')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true')
    main(ap.parse_args().force)
