# GitHub Pages 用フロント

`docs/index.html` は GitHub Pages で公開する表示用ページです。

## 公開手順

1. GitHub リポジトリの `Settings`
2. `Pages`
3. `Branch: main`
4. `Folder: /docs`
5. 保存

公開URL例:

`https://you0810jmsdf.github.io/creators-map/`

## 前提

Apps Script 側の `doGet(e)` で `?mode=json&callback=...` を受け取ったとき、JSONP を返せるようにします。

必要な返却イメージ:

```javascript
callbackName([...data...]);
```
