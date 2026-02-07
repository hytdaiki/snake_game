# Snake Arcade

Snake Arcade は、cute illustrations + speed-up + bomb obstacles + ranking を備えた依存なしゲームです。  
純粋な `HTML / CSS / JavaScript` だけで動作します。

## ゲーム概要

- スコアが 5 増えるごとに速度アップ
- スコア 31 以降で障害物（爆弾）が増加
- ローカルランキング（Top10）を `localStorage` に保存
- Desktop / Mobile UI 切替（Auto / Desktop / Mobile）

## 操作方法

- 移動: `矢印キー` または `W / A / S / D`
- 一時停止: `P` または `Space`
- リスタート: `R` または `Restart` ボタン
- 開始: `Start` ボタン（または `Enter`）
- 画面キーボード: `↑ ← ↓ →` ボタンをクリック/タップ
- スマホ操作: 盤面上スワイプ

## ローカル実行手順

1. このフォルダに移動

```bash
cd /Users/aa/Codex_Projects/snake_game
```

2. ローカルサーバーを起動

```bash
python3 -m http.server 4173
```

3. ブラウザで開く

- `http://127.0.0.1:4173`

## GitHub Pages で公開する手順

1. GitHub で新規リポジトリを作成（例: `snake-game`）
2. ローカルから push

```bash
cd /Users/aa/Codex_Projects/New_project_snake
git init
git add .
git commit -m "Initial snake game for GitHub Pages"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

3. GitHub の `Settings` → `Pages` を開く
4. `Build and deployment` の `Source` を `Deploy from a branch` に設定
5. `Branch` を `main`、フォルダを `/(root)` に設定して `Save`
6. 数十秒〜数分待って公開 URL にアクセス

- `https://<user>.github.io/<repo>/`

## よくあるトラブルと対処

### 1. CSS / JS が 404 になる

- 原因: `/styles.css` のような先頭 `/` の絶対パス
- 対処: すべて相対パスに統一する
  - `./styles.css`
  - `./src/index.js`
  - `./assets/...`

### 2. 画面が真っ白

- 原因候補: JS 読み込み失敗、パスミス、`file://` 直開き
- 対処:
  - DevTools Console にエラーがないか確認
  - `python3 -m http.server` など HTTP 経由で開く
  - `index.html` の `<script type="module" src="./src/index.js">` を確認

### 3. GitHub Pages でだけ壊れる

- 原因候補: リポジトリ配下 URL で絶対パスがずれる
- 対処:
  - 画像/CSS/JS をすべて相対パスにする
  - `Settings > Pages` で `main / (root)` を再確認
  - デプロイ完了まで数分待って再読み込み

## 備考

- 本プロジェクトは依存追加なし（ビルド不要）です。
- そのまま GitHub Pages に配置して動作します。
