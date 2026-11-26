/* =========================================================
   CaveCraft - config.js
   ゲーム全体で使う設定値
   ========================================================= */
(function () {
  "use strict";

  const textureNames = [
    "grass_top", "grass_side", "dirt", "stone", "sand",
    "planks", "log_side", "log_end", "leaves", "water", "test"
  ];
  const textureIndex = Object.create(null);
  for (let i = 0; i < textureNames.length; i++) textureIndex[textureNames[i]] = i;

  const shade = {
    east: [0.78, 0.78, 0.78],
    west: [0.74, 0.74, 0.74],
    top: [1.00, 1.00, 1.00],
    bottom: [0.58, 0.58, 0.58],
    south: [0.88, 0.88, 0.88],
    north: [0.72, 0.72, 0.72]
  };

  window.CaveGameConfig = Object.freeze({
    // 描画・更新
    TARGET_FPS: 30,
    PHYSICS_HZ: 60,
    CHUNK_SIZE: 16,
    RENDER_DISTANCE_CHUNKS: 6,
    MAX_BLOCK_REACH: 6,
    MAX_PIXEL_RATIO: 1.5,

    // 16×16ピクセルのタイルを並べたPNGテクスチャアトラス
    TEXTURE_SIZE: 16,
    TEXTURE_COLUMNS: 4,
    TEXTURE_NAMES: textureNames,
    TEXTURE_INDEX: textureIndex,
    TEXTURE_ATLAS_PATH: "textures/blocks.png",

    // 自動生成するワールド
    WORLD_SEED: 20261125,
    WORLD_RADIUS_CHUNKS: 3,
    WORLD_BASE_Y: -7,
    WORLD_MIN_SURFACE_Y: -4,
    WORLD_MAX_SURFACE_Y: 11,
    SEA_LEVEL: 3,
    BEACH_RADIUS: 3,
    TREE_DENSITY: 0.027,

    // 水はこの版では静止ブロックとして扱う。流動処理は行わない。

    // プレイヤー
    WALK_SPEED: 4.3,
    DASH_SPEED: 7.0,
    SNEAK_SPEED: 2.0,
    GRAVITY: 20.0,
    JUMP_SPEED: 8.0,
    PLAYER_RADIUS: 0.30,
    PLAYER_HEIGHT: 1.80,
    EYE_HEIGHT: 1.62,
    SNEAK_EYE_HEIGHT: 1.08,
    EYE_HEIGHT_TRANSITION_SPEED: 14,
    MOUSE_SENSITIVITY: 0.0022,

    // カメラ
    FIELD_OF_VIEW: 70 * Math.PI / 180,
    NEAR_PLANE: 0.05,
    FAR_PLANE: 220,

    // 初期ホットバーはすべて空。アイテムはインベントリから配置する。
    HOTBAR: [null, null, null, null, null, null, null, null, null],

    // ブロックの面の明るさ。順番は +X, -X, +Y, -Y, +Z, -Z
    BLOCKS: {
      grass: {
        name: "草ブロック", uiColor: "#579b3c",
        textureFaces: ["grass_side", "grass_side", "grass_top", "dirt", "grass_side", "grass_side"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      },
      dirt: {
        name: "土ブロック", uiColor: "#805333",
        textureFaces: ["dirt", "dirt", "dirt", "dirt", "dirt", "dirt"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      },
      stone: {
        name: "石ブロック", uiColor: "#858585",
        textureFaces: ["stone", "stone", "stone", "stone", "stone", "stone"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      },
      sand: {
        name: "砂ブロック", uiColor: "#d8c27b",
        textureFaces: ["sand", "sand", "sand", "sand", "sand", "sand"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      },
      wood: {
        name: "板材ブロック", uiColor: "#a87643",
        textureFaces: ["planks", "planks", "planks", "planks", "planks", "planks"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      },
      log: {
        name: "原木ブロック", uiColor: "#956034",
        textureFaces: ["log_side", "log_side", "log_end", "log_end", "log_side", "log_side"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      },
      leaves: {
        name: "葉ブロック", uiColor: "#3d8b37",
        textureFaces: ["leaves", "leaves", "leaves", "leaves", "leaves", "leaves"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      },
      water: {
        name: "水ブロック", uiColor: "#398fd1",
        textureFaces: ["water", "water", "water", "water", "water", "water"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      },
      test: {
        name: "テストブロック", uiColor: "#b34fba",
        textureFaces: ["test", "test", "test", "test", "test", "test"],
        faces: [shade.east, shade.west, shade.top, shade.bottom, shade.south, shade.north]
      }
    },

    // バケツはブロックではなく、右クリック時に水を汲む／置くアイテム。
    ITEMS: {
      bucket_empty: { name: "空のバケツ", uiColor: "#b9c1c8", kind: "bucket" },
      bucket_water: { name: "水入りバケツ", uiColor: "#398fd1", kind: "bucket" }
    }
  });
})();
