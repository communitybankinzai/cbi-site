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

```
A clean, minimalist infographic illustration showing a Japanese community
collaboration ecosystem called "CBI". Four interconnected hexagonal nodes
arranged in a circle around a central glowing hub:
(1) "Citizens" (icons of diverse people: elderly, parent with child,
   young worker, retiree),
(2) "AI Agents A1-A10" (small geometric robot icons in a row),
(3) "CiDAO Voting" (a ballot box with hand-drawn vote slips and a
   transparent ledger),
(4) "Local Currency" (a coin with a Japanese seal mark, slightly faded
   to indicate "concept stage").
At the center: a deep navy circle with a gold torii-gate silhouette
labeled "Community Bank INZAI". Soft connecting lines in gold link all
nodes. Background: warm off-white paper texture (#faf8f3) with subtle
washi pattern. Color palette: deep navy (#1e3a5f), antique gold
(#c9a55c), forest green (#2d5a3d), cream (#faf8f3). Flat vector style,
elegant, government-document-friendly. Japanese labels preferred.
Aspect ratio 16:9.
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
