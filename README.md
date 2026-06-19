# Community Bank INZAI（CBI）公式サイト

印西「あなたの出番」プロジェクトの公式LPプロトタイプ。

## 構成

```
site/
├── index.html        # シングルページLP本体
├── style.css         # 和モダン配色（ネイビー×ゴールド×グリーン）
├── script.js         # ヘッダー追従・モバイルメニュー
├── assets/
│   ├── cbi-logo.png  # CBIロゴ（本採用版 v2）
│   └── docs/         # 公開PDF資料
└── README.md
```

## ローカル確認

任意の静的サーバで開く。例：

```powershell
# Python
python -m http.server 8000

# Node
npx serve .
```

ブラウザで `http://localhost:8000` を開く。

## GitHub Pages 公開手順

1. このフォルダで `git init` → 専用リポジトリ（例：`cbi-site`）として push
2. リポジトリ設定 → Pages → Source を `main` ブランチ `/ (root)` に設定
3. `https://<user>.github.io/cbi-site/` で公開

## 次の拡張候補

- 人材バンク登録フォーム（Google Forms 埋め込み／自前フォーム）
- 活動報告セクションを `data/news.json` 化して動的読み込み
- イベント一覧（ICSカレンダー連携）
- お問い合わせフォーム（Formspree／GAS WebApp）
- OGP画像専用差し替え
