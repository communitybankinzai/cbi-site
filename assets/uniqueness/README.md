# site/assets/uniqueness/

uniqueness ページ用の画像置き場。

## 配置済み画像

| ファイル | 用途（HTML内位置） | アスペクト比 |
|---|---|---|
| `ecosystem.png` | ヒーロー直下の全体図（市民×AI×CiDAO×地域通貨） | 16:9 |
| `dao-concept.png` | ページ末尾「CiDAOとは？」脚注（従来の組織 vs DAO の対比図） | 16:9 |
| `no-personalization.png` | 差異02 直後（代表者依存型 vs CBIモデル対比） | 16:9 |

## 差替手順

同じファイル名で上書きすればOK（HTMLのパスは変更不要）。
画像が見つからない場合は HTML の onerror で「（後日差替）」のプレースホルダが自動表示される（dao-concept.png のみ）。

## 画像生成プロンプト（ChatGPT / DALL·E 用）

### ecosystem.png — CBIエコシステム全体図

**重要：ChatGPT/DALL·E に依頼する際は、本プロジェクトの CBI ロゴ画像（site/assets/cbi-logo.png）を参考画像として一緒に添付すること。中央のロゴは生成AIに描かせず、添付画像をそのまま忠実に再現させる。**

```
[添付：cbi-logo.png を参考画像として使用してください]

Create a clean, minimalist Japanese-style infographic showing a community
collaboration ecosystem called "Community Bank INZAI (CBI)".

Layout: 4 hexagonal nodes arranged symmetrically around a central circular
hub. Aspect ratio 16:9.

CENTER (most important — replicate the attached CBI logo EXACTLY):
A circular hub displaying the official CBI logo provided in the attached
reference image. The logo features a green-and-navy crescent shape with
"Bi" letters in gold, a small mizuhiki knot ornament, and text reading
"COMMUNITY BANK INZAI". Do NOT redesign or stylize the logo — use the
attached reference faithfully. Place it inside a soft circular frame
that blends seamlessly with the washi (Japanese paper) background, no
hard border.

FOUR NODES (hexagons in pale cream with thin gold outline):
1. Top-left "市民" (Citizens) — illustrated diverse Japanese citizens:
   elderly couple, young parent with child, working-age man. Three small
   green check bullets: "暮らしの主体" "地域の知恵" "共に創る未来".
2. Top-right "AIエージェント A1-A10" — a row of 10 small geometric
   robot icons labeled A1 through A10. Three navy check bullets:
   "対話・サポート・提案" "調査・分析・可視化" "公共の課題解決を支援".
3. Bottom-left "CiDAO投票" — a ballot box with vote slips and a small
   transparent ledger. Three green check bullets: "みんなで決める"
   "透明・公正・信頼" "記録は公開・永続".
4. Bottom-right "地域通貨（構想段階）" — a simple abstract gold coin
   with a generic mizuhiki knot or wave pattern symbol on it (DO NOT
   write the kanji "印西" or any specific city name on the coin).
   Slightly faded/translucent to indicate concept stage. Three gold
   check bullets: "地域内で価値が循環" "貢献の可視化と報酬"
   "持続可能な地域経済へ".

CONNECTIONS: thin gold curved lines linking each node to the center hub.

STYLE: warm off-white washi paper background (#faf8f3) with subtle
cloud-pattern texture. Color palette: deep navy (#1e3a5f), antique
gold (#c9a55c), forest green (#2d5a3d). Flat editorial illustration,
elegant, government-document-friendly. Bottom tagline ribbon:
"つながる・支え合う・共に創る、しあわせな地域の未来へ".
```

### dao-concept.png — DAO思想図

```
A philosophical conceptual diagram contrasting two organizational models,
side by side in one composition:
Left panel labeled "従来の組織": a single large human silhouette at the
center, surrounded by small gear icons at the edges.
Right panel labeled "DAO（自律分散型組織）": a glowing geometric core
made of interconnected nodes and rules at the center, with many small
diverse human silhouettes arranged peacefully around the edges.
Above the right panel, a quote ribbon: "中心に自動化、周縁に人間"
— Vitalik Buterin, 2014.
Style: clean editorial illustration, flat vector. Color palette: deep
navy, antique gold, forest green, warm cream background.
Aspect ratio 16:9.
```

### no-personalization.png — 属人化対比図

```
A simple before/after comparison illustration for a Japanese non-profit
organization brochure. Left side labeled "代表者依存型":
a single tall human figure carrying a heavy stack of documents,
surrounded by question marks, with a sad expression.
Right side labeled "CBIモデル": the same documents floating neatly in
a transparent shared cloud labeled "AI＋CiDAO", with multiple smaller
human figures of varying ages calmly contributing each a single small
document. Soft arrows showing seamless handover between people.
Style: flat editorial vector. Color palette: deep navy (#1e3a5f),
antique gold (#c9a55c), forest green (#2d5a3d), warm cream (#faf8f3).
Aspect ratio 16:9.
```
