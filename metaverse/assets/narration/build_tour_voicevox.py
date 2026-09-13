# 夜間遊覧（night.js の startTour）のナレーションを VOICEVOX:ずんだもん で生成する（2026-09-13 中司さん指示）
#   前提：VOICEVOX ENGINE（http://127.0.0.1:50021）を起動しておく
#   python build_tour_voicevox.py
# 出力：zundamon/tour_<key>.mp3。文言を変えたら night.js の TOUR_LINES（字幕の並び）と揃えること
import os, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_narration_voicevox import synth, CHARS, HERE

LINES = {
    'intro': '印西の夜空へ、ようこそなのだ！ ボクといっしょに、夜の遊覧に出発するのだ。',
    'course': '市内の駅やお店の上に、光のいんザイ君が十か所うかんでいるのだ。順番にくぐって、千葉ニュータウン中央駅をめざすのだ。',
    'half': '半分まで来たのだ！ この先は、千葉ニュータウン中央駅まで、あと少しなのだ。',
    'goal': 'ゴールのクリスマスいんザイ君なのだ！',
    'arrive': '千葉ニュータウン中央駅に、到着したのだ。',
    'handover': 'ここからは、キミが操縦するのだ。左スティックで飛んで、右スティックで見まわすのだ。',
}

def main():
    c = CHARS['zundamon']
    out = os.path.join(HERE, 'zundamon')
    os.makedirs(out, exist_ok=True)
    for key, text in LINES.items():
        path = os.path.join(out, 'tour_' + key + '.mp3')
        synth(c['speaker'], c['speed'], text, path)
        print('made', os.path.basename(path), os.path.getsize(path), 'bytes')

if __name__ == '__main__':
    main()
