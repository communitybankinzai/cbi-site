# 武蔵屋めぐり ナレーション音声

`male/`（ja-JP-KeitaNeural）・`female/`（ja-JP-NanamiNeural）に、文化財20件 ×（kids／adult）＋ 駅（station）＋ ゴール（goal＝前置き＋岩井家住宅主屋）の MP3。計88ファイル・約11MB（2026-09-13 生成）。

- 生成：`python build_narration.py`（文が変わった分だけ作り直す。`--force` で全部）。`manifest.json` に文のハッシュを記録
- 文の元：`../../musashiya-texts.json` と、`build_narration.py` 内の駅・ゴール定型文（`musashiya.js` の文言と揃えること）
- 速さ：`+15%`（musashiya.js の SPEECH_RATE 1.2 相当）
- 再生：`musashiya.js` の `narrate(key, fallbackText)`。開始画面の声の選択が「録音ずみの声」のとき使い、ファイルが無い／再生できないときは端末の音声合成（`speak`）に戻る
- ツール：[edge-tts](https://github.com/rany2/edge-tts)（Microsoft Edge の読み上げサービスを使う非公式ツール）。作った音声の公開利用は Microsoft の規約上あいまいで、イベント用途として中司さんが了承（2026-09-13・案B）。問題が指摘されたら差し替える
