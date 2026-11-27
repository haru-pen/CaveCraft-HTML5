# CaveCraft-HTML5 V1


This game was created using Vibe Coding.
このゲームはVibe Coding（バイブコーディング）で作成しています。

CaveCraft-HTML5 is an early block-world game that runs locally in a web browser.
CaveCraft-HTML5は、Webブラウザーでローカル起動できる初期段階のブロックワールドゲームです。

## Project structure / ファイル構成

```text
CaveCraft-HTML5/
├─ README.md                 Project guide / GitHubで表示する説明
├─ instructions_説明.txt    Japanese instruction manual / 日本語の説明書
├─ index.html                Game page / ゲーム画面
├─ textures/
│  └─ blocks.png             Texture atlas / テクスチャ画像
└─ assets/
   ├─ style.css              UI styles / 画面デザイン
   ├─ config.js              Game settings / ゲーム設定
   ├─ game.js                Main game management / ゲーム全体の管理
   ├─ world.js               Terrain, blocks, and chunks / 地形・ブロック・チャンク
   ├─ player.js              Player controls and collision / プレイヤー操作・当たり判定
   └─ renderer.js            WebGL rendering and textures / WebGL描画・テクスチャ読み込み
```


Keep this folder structure and the file names unchanged. `index.html` must stay in the project root. JavaScript and CSS files belong in `assets/`, and the PNG texture belongs in `textures/`.

フォルダー構成とファイル名は変更しないでください。`index.html` はプロジェクト直下、JavaScriptとCSSは `assets/`、PNG画像は `textures/` に置きます。

## How to run / 起動方法

### From a ZIP file / ZIPから起動する場合

1. Extract the ZIP archive. / ZIPを展開します。
2. Open the extracted `CaveCraft-HTML5` folder. / 展開した `CaveCraft-HTML5` フォルダーを開きます。
3. Double-click `index.html`. / `index.html` をダブルクリックします。
4. The game starts in Chrome. Hints are shown in the upper-left corner. / Chromeでゲームが起動します。操作のヒントは画面左上に表示されます。

### From a folder / フォルダーから起動する場合

Open the project folder and double-click `index.html`.
プロジェクトフォルダーを開き、`index.html` をダブルクリックしてください。

## Compatibility / 動作環境

- Chrome is the browser used for testing. / 動作確認にはChromeを使用しています。
- Windows and ChromeOS have been tested. / WindowsとChromeOSで動作を確認しています。
- macOS operation is not guaranteed. / macOSでの動作は保証していません。
- The interface is currently Japanese only. / 現在の画面表示は日本語のみです。
- This is an early version; some issues may remain. / 初期バージョンのため、不具合が残っている場合があります。

## Changes from the prototype / 試作段階からの主な変更

- Textures use an actual PNG image loaded by WebGL. / テクスチャはWebGLで実際のPNG画像を読み込みます。
- `textures/blocks.png` is 64×48 pixels. It is a 4-column by 3-row atlas of 16×16-pixel tiles. / `textures/blocks.png` は64×48ピクセルで、16×16ピクセルのタイルを4列×3行に並べた画像です。
- The 11 tiles are grass top, grass side, dirt, stone, sand, planks, log side, log end, leaves, water, and test. / 11種類のタイルは、草上面、草側面、土、石、砂、板材、原木側面、原木木口、葉、水、テストです。
- Nearest-neighbor filtering keeps the pixel-art edges sharp. / NEARESTフィルターにより、ピクセルがぼやけないようにしています。

## Controls / 基本操作

| Key / Input | Action / 操作 |
|---|---|
| WASD | Move / 移動 |
| Space | Jump; hold to jump again after landing / ジャンプ（押し続けると着地後に再ジャンプ） |
| Shift | Dash / ダッシュ |
| C | Crouch and prevent walking off ledges; lowers the view / しゃがみ＋足場からの落下防止（視点が低くなる） |
| Mouse | Look around / 視点移動 |
| Left click | Break a block / ブロック破壊 |
| Right click | Place a block or use a bucket / ブロック設置・バケツ使用 |
| Middle click | Pick the targeted block / 狙ったブロックを選択 |
| 1–9 / Mouse wheel | Select a hotbar slot / ホットバー選択 |
| E | Open or close the inventory / インベントリを開く・閉じる |
| Esc | Pause, or close the inventory / ポーズ画面、またはインベントリを閉じる |

## Inventory / インベントリ

- The normal inventory has 27 slots (3 rows × 9 columns). / 通常インベントリは3段×9列の27スロットです。
- The creative page lets you add all blocks and both bucket types. / クリエイティブページから全ブロックと2種類のバケツを追加できます。
- Clicking a normal inventory slot swaps its item with the currently selected hotbar slot. / 通常ページの枠をクリックすると、選択中のホットバースロットと入れ替わります。
- Item stacking and quantities are not implemented yet. / スタック数・個数の概念はまだありません。

## Texture and source files / テクスチャとプログラム

`textures/blocks.png` is a 64×48 PNG texture atlas. Each tile is 16×16 pixels, arranged in four columns.
`textures/blocks.png` は64×48ピクセルのPNGテクスチャアトラスです。各タイルは16×16ピクセルで、4列に並んでいます。

`assets/renderer.js` also contains the same PNG image as embedded data. This is a fallback for direct local launch using `file://`. The external PNG and embedded image must remain synchronized.
`assets/renderer.js` には、`file://` で直接起動するときの代替処理用として、同じPNG画像がデータとして埋め込まれています。外部PNGと埋め込み画像は同じ内容にしてください。

Do not edit or replace `blocks.png` unless you also update the embedded image in `assets/renderer.js`. Changing names or paths inside `assets/` or the paths referenced by `index.html` may prevent the game from starting.
`blocks.png` を編集・差し替えする場合は、`assets/renderer.js` 内の埋め込み画像も同時に更新してください。また、`assets/` 内のファイル名や `index.html` の読み込みパスを変更すると、ゲームが起動しなくなる場合があります。

## Not included yet / 今回の範囲外

- Water flow, transparency, and swimming are not implemented. / 水の流動・透明化・泳ぎは未実装です。
- Save/load functionality is planned for V3; only the menu UI exists now. / セーブ・ロードの実処理はV3で実装予定です（現在はメニューUIのみです）。
- Caves and ores are planned for V2. / 洞窟・鉱石はV2で実装予定です。

---

## License / ライセンス

This project is under a custom license. Please check the `LICENSE` file for details.
- **Personal Use & Editing:** Allowed (Non-commercial only)
- **Videos & Streaming:** Allowed
- **Commercial Use & Redistribution:** Prohibited without permission

本プロジェクトには独自の利用規約が適用されます。詳細は `LICENSE` ファイルをご確認ください。
- **個人利用・編集：** 許可（非商用のみ）
- **動画投稿・配信：** 許可
- **商用利用・再配布：** 許可なく禁止

