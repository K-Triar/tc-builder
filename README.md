# KT式 TC ビルダー

Minecraft の [TrainCarts](https://github.com/bergerhealer/TrainCarts) で、KT式「経路コード方式」の路線設定（看板・コマンド）を、質問に答えるだけで作れるブラウザアプリです。

**公開 URL：<https://k-triar.github.io/tc-builder/>**（GitHub Pages）

- インストール・ログイン不要。URL を開くだけで使えます。一度開けばオフラインでも動きます（「アプリとして追加」もできます）。
- データはブラウザの中だけに保存され、外部へは送られません。
- PC とスマホの両方に対応しています。

## 使い方

1. **はじめる**：ホームの「新しい路線をつくる」で鉄道会社を選んで作るか、「完成例（瑠璃線系統）を見る」で完成例を見ます。鉄道会社はサーバー Wiki「TrainCartsで使うコード」の一覧から選べます（一覧にない鉄道会社は名前とコードを入れます）。
2. **質問に答える**：路線（鉄道会社・路線・列車の種類）→ 駅 → のりば（ホームから見て列車が進む向き）→ 列車（通る駅とのりば、種類ごとの停車 ○/×）→ 自動生成、の順に答えます。後からは「詳しく編集」画面で表形式でまとめて直せます。
3. **作業**画面で、ゲーム内の作業を進めます。
   - ① コマンド：経路と編成を保存するコマンド。1行ずつコピーでき、「次の行をコピー」で順に進めます。
   - ② 駅の看板：駅→のりばごとのカード。ホームから見た図、看板の4行（行ごとにコピー）、spawn のボタンの付け方、空車削除（C）と switcher の置き場所。
   - ③ 試運転：仕上げの確認項目と、系統ごとの試運転。
   - 「設置した」「実行した」などのチェックは保存され、入力を変えて内容が変わると「要更新」に戻ります。
4. **資料**画面で、経路・編成・各駅発・停車駅の一覧を印刷したり、表計算ソフトに貼ったり（TSV コピー）できます。
5. 右（スマホは下）の**検証**パネルに、入力のエラーと警告が出ます。クリックすると該当する入力へ移ります。エラーがあるあいだは看板とコマンドを出しません。

### 保存について

- 入力はブラウザ（IndexedDB）に自動で保存されます。
- ブラウザのデータ消去に備えて、ときどき「ファイルに書き出す」で `.ktc.json` を保存してください（未保存の変更があるとヘッダに表示されます）。
- 書き出したファイルは、ホームの「ファイルを開く」かドラッグ＆ドロップで読み込めます。別の PC で続きをするときもこの方法を使います。

### 前提となるルール

KT式 経路コード方式の考え方・看板の書き方は[入門ガイド](https://claude.ai/code/artifact/ccbddc5b-be7f-440b-81a8-67191ce8c6bb)を見てください。画面の「？」からも短い説明が読めます。spawn 看板の向きの決まり方はソースから調べたもので、ゲーム内ではまだ確認していません。設置したら必ず試運転で確かめてください。

## 開発

Node.js 22 以上。

```sh
npm ci
npm run dev      # 開発サーバー（http://localhost:5173/tc-builder/）
npm test         # Vitest（ドメイン・ゴールデンテスト・画面）
npm run lint     # ESLint + Prettier
npm run build    # 型チェック + 本番ビルド（dist/）
npm run e2e      # Playwright（PC 幅と 375px 幅、axe によるアクセシビリティ確認）
```

### 構成

| 場所                  | 内容                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/domain/`         | KT式のルール（純粋関数のみ）。入力 `Project` から経路・編成・看板・コマンド・検証を `derive()` で計算する |
| `src/store/`          | 開いているプロジェクトのストア（Zustand + immer）                                                         |
| `src/storage/`        | IndexedDB への自動保存、ファイルの書き出し・読み込み、サンプル                                            |
| `src/ui/`             | 画面（React）。`editors/` が入力、`work/` が作業、`pages/` が各画面                                       |
| `src/content/help.ts` | 画面内ヘルプの文                                                                                          |
| `src/fixtures/ruri/`  | 瑠璃線系統のサンプル（`project.ktc.json`）と、Excel から抜き出した期待値・確認済みの差分                  |
| `scripts/`            | サンプルと期待値を作る Python スクリプト（開発時だけ使う）                                                |

- 保存するのは入力（`Project`）と進捗だけで、出力は毎回計算します。
- データの形を変えるときは `SCHEMA_VERSION` を上げ、`src/domain/schema.ts` にマイグレーションとテストを足します。

### 瑠璃線サンプルとゴールデンテスト

`src/domain/__tests__/golden.test.ts` は、サンプルの出力（経路・編成・各駅発・看板）を元の Excel から抜き出した期待値と比べます。差分はすべて確認済みとして `src/fixtures/ruri/confirmed.json` に理由つきで書いてあり、新しい差分が出たり確認済みの差分が消えたりするとテストが落ちます。

サンプルや期待値を作り直すとき（元の Excel は公開していません。`reference/` に置きます）：

```sh
pip install openpyxl
python scripts/extract-ruri-expected.py   # Excel → src/fixtures/ruri/expected.json
python scripts/build-ruri-project.py      # → src/fixtures/ruri/project.ktc.json
```

### デプロイ

`main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）が lint・テスト・ビルドをして GitHub Pages に公開します。リポジトリの Settings → Pages の Source を「GitHub Actions」にしておきます。別の場所に置くときは、ビルド時に環境変数 `BASE_PATH` でパスを変えられます。
