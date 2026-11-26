/* =========================================================
   CaveCraft - world.js
   ブロック、チャンク、自動地形生成、樹木、水辺、照準判定
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.CaveGameConfig;
  const worldBlocks = new Map();
  const chunks = new Map();
  const CHUNK_SIZE = CONFIG.CHUNK_SIZE;
  const terrainColumns = new Map();
  let spawnPosition = { x: 0.5, y: 0, z: 5.5 };
  let currentSeed = CONFIG.WORLD_SEED;

  // 水は固定されたブロックとして配置し、この版では流動させない。

  function blockKey(x, y, z) {
    return x + "," + y + "," + z;
  }

  function columnKey(x, z) {
    return x + "," + z;
  }

  function chunkKey(cx, cy, cz) {
    return cx + "," + cy + "," + cz;
  }

  function chunkCoords(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return { cx, cy, cz };
  }

  function getOrCreateChunk(cx, cy, cz) {
    const key = chunkKey(cx, cy, cz);
    let chunk = chunks.get(key);
    if (!chunk) {
      chunk = {
        key,
        cx,
        cy,
        cz,
        blockKeys: new Set(),
        dirty: true,
        vertexBuffer: null,
        vertexCount: 0
      };
      chunks.set(key, chunk);
    }
    return chunk;
  }

  function markChunkDirty(cx, cy, cz) {
    const chunk = chunks.get(chunkKey(cx, cy, cz));
    if (chunk) chunk.dirty = true;
  }

  function markAffectedChunksDirty(x, y, z, chunk) {
    chunk.dirty = true;
    const lx = x - chunk.cx * CHUNK_SIZE;
    const ly = y - chunk.cy * CHUNK_SIZE;
    const lz = z - chunk.cz * CHUNK_SIZE;

    // チャンク境界では、隣のチャンクの面も再計算する。
    if (lx === 0) markChunkDirty(chunk.cx - 1, chunk.cy, chunk.cz);
    if (lx === CHUNK_SIZE - 1) markChunkDirty(chunk.cx + 1, chunk.cy, chunk.cz);
    if (ly === 0) markChunkDirty(chunk.cx, chunk.cy - 1, chunk.cz);
    if (ly === CHUNK_SIZE - 1) markChunkDirty(chunk.cx, chunk.cy + 1, chunk.cz);
    if (lz === 0) markChunkDirty(chunk.cx, chunk.cy, chunk.cz - 1);
    if (lz === CHUNK_SIZE - 1) markChunkDirty(chunk.cx, chunk.cy, chunk.cz + 1);
  }

  function getBlock(x, y, z) {
    return worldBlocks.get(blockKey(x, y, z)) || null;
  }

  function setBlock(x, y, z, type) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);

    if (!CONFIG.BLOCKS[type]) return false;
    const key = blockKey(x, y, z);
    if (worldBlocks.has(key)) return false;

    worldBlocks.set(key, type);
    const coords = chunkCoords(x, y, z);
    const chunk = getOrCreateChunk(coords.cx, coords.cy, coords.cz);
    chunk.blockKeys.add(key);
    markAffectedChunksDirty(x, y, z, chunk);

    return true;
  }

  function removeBlock(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    const key = blockKey(x, y, z);
    if (!worldBlocks.has(key)) return false;

    worldBlocks.delete(key);
    const coords = chunkCoords(x, y, z);
    const chunk = chunks.get(chunkKey(coords.cx, coords.cy, coords.cz));
    if (chunk) {
      chunk.blockKeys.delete(key);
      markAffectedChunksDirty(x, y, z, chunk);
    }

    return true;
  }

  // 整数座標から、seedに基づいた決定的な疑似乱数を作る。
  // Math.random()を使わないので、同じseedなら毎回同じ地形になる。
  function hash2(x, z, seed) {
    let n = Math.imul(x | 0, 374761393);
    n = (n + Math.imul(z | 0, 668265263)) | 0;
    n = (n + Math.imul(seed | 0, 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967295;
  }

  function smooth(value) {
    return value * value * (3 - 2 * value);
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  // 周囲の乱数をなめらかにつなぎ、自然な起伏を作る。
  function valueNoise(x, z, seed) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const z1 = z0 + 1;
    const sx = smooth(x - x0);
    const sz = smooth(z - z0);

    const a = hash2(x0, z0, seed);
    const b = hash2(x1, z0, seed);
    const c = hash2(x0, z1, seed);
    const d = hash2(x1, z1, seed);

    return lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
  }

  function getTerrainHeight(x, z) {
    const seed = currentSeed;
    const broad = valueNoise(x * 0.020, z * 0.020, seed + 11);
    const medium = valueNoise(x * 0.060, z * 0.060, seed + 37);
    const detail = valueNoise(x * 0.155, z * 0.155, seed + 83);

    const height = Math.round(
      4 + (broad - 0.5) * 13 + (medium - 0.5) * 5 + (detail - 0.5) * 2
    );

    return Math.max(
      CONFIG.WORLD_MIN_SURFACE_Y,
      Math.min(CONFIG.WORLD_MAX_SURFACE_Y, height)
    );
  }

  function generateHeightMap(minX, maxX, minZ, maxZ) {
    terrainColumns.clear();
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const height = getTerrainHeight(x, z);
        terrainColumns.set(columnKey(x, z), {
          x,
          z,
          height,
          underwater: height < CONFIG.SEA_LEVEL,
          nearWater: false,
          surfaceType: "grass"
        });
      }
    }
  }

  function markBeaches(minX, maxX, minZ, maxZ) {
    const radius = CONFIG.BEACH_RADIUS;
    const radiusSquared = radius * radius;

    for (const column of terrainColumns.values()) {
      let nearWater = false;

      // 水面に隣接する低い陸地を砂浜にする。
      if (!column.underwater && column.height <= CONFIG.SEA_LEVEL + 2) {
        for (let dx = -radius; dx <= radius && !nearWater; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dz * dz > radiusSquared) continue;
            const neighbor = terrainColumns.get(columnKey(column.x + dx, column.z + dz));
            if (neighbor && neighbor.underwater) {
              nearWater = true;
              break;
            }
          }
        }
      }

      column.nearWater = nearWater;
      if (column.underwater || nearWater) column.surfaceType = "sand";
    }
  }

  function buildTerrainBlocks() {
    for (const column of terrainColumns.values()) {
      const x = column.x;
      const z = column.z;
      const topY = column.height;
      const baseY = CONFIG.WORLD_BASE_Y;
      const isSand = column.surfaceType === "sand";

      // 地中は石、地表付近は土。水底と砂浜の表面は砂にする。
      for (let y = baseY; y < topY; y++) {
        const depthFromTop = topY - y;
        let type;
        if (isSand && depthFromTop <= 3) {
          type = "sand";
        } else if (!isSand && depthFromTop <= 3) {
          type = "dirt";
        } else {
          type = "stone";
        }
        setBlock(x, y, z, type);
      }

      setBlock(x, topY, z, column.surfaceType);

      // 地形が海面より低い場所を水で満たす。
      if (column.underwater) {
        for (let y = topY + 1; y <= CONFIG.SEA_LEVEL; y++) {
          setBlock(x, y, z, "water");
        }
      }
    }
  }

  function canPlaceTreeAt(x, z, column) {
    if (!column || column.surfaceType !== "grass") return false;
    if (column.underwater || column.height <= CONFIG.SEA_LEVEL + 1) return false;

    // スポーン地点の周囲は木を生やさず、安全な開始場所を確保する。
    const spawnDx = x - 0;
    const spawnDz = z - 5;
    if (spawnDx * spawnDx + spawnDz * spawnDz < 64) return false;

    const seed = currentSeed + 701;
    const roll = hash2(x, z, seed);
    if (roll >= CONFIG.TREE_DENSITY) return false;

    // 木同士が密集しすぎないよう、近隣候補の中で選ばれた場所だけにする。
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (hash2(x + dx, z + dz, seed) < roll) return false;
      }
    }
    return true;
  }

  function addTree(x, groundY, z, height) {
    // 幹
    for (let y = 1; y <= height; y++) {
      setBlock(x, groundY + y, z, "log");
    }

    // 葉の層。外側の角を少し抜いて、四角い塊になりすぎない形にする。
    const leafStart = groundY + height - 1;
    for (let layer = 0; layer < 3; layer++) {
      const radius = layer === 1 ? 2 : 1;
      const leafY = leafStart + layer;

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
          setBlock(x + dx, leafY, z + dz, "leaves");
        }
      }
    }

    setBlock(x, groundY + height + 2, z, "leaves");
  }

  function generateTrees() {
    for (const column of terrainColumns.values()) {
      if (!canPlaceTreeAt(column.x, column.z, column)) continue;

      const treeRandom = hash2(column.x, column.z, currentSeed + 1709);
      const treeHeight = 3 + Math.floor(treeRandom * 3);
      addTree(column.x, column.height, column.z, treeHeight);
    }
  }

  function findSpawnPosition() {
    let best = null;
    let bestDistance = Infinity;

    // 中心付近から、乾いた草地で頭上に木がない場所を探す。
    for (let x = -12; x <= 12; x++) {
      for (let z = -7; z <= 17; z++) {
        const column = terrainColumns.get(columnKey(x, z));
        if (!column || column.surfaceType !== "grass" || column.underwater) continue;
        if (column.height <= CONFIG.SEA_LEVEL + 1) continue;

        const feetY = column.height + 1;
        if (getBlock(x, feetY, z) || getBlock(x, feetY + 1, z)) continue;

        const distance = x * x + (z - 5) * (z - 5);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x: x + 0.5, y: feetY, z: z + 0.5 };
        }
      }
    }

    if (best) return best;

    // まれに中心周辺が海や高い木で埋まっているseedがあるため、
    // ワールド全域から水中ではない安全な地表を探す。
    let fallback = null;
    let fallbackScore = Infinity;
    for (const column of terrainColumns.values()) {
      if (column.underwater) continue;
      const feetY = column.height + 1;
      if (getBlock(column.x, feetY, column.z) || getBlock(column.x, feetY + 1, column.z)) continue;
      const distance = column.x * column.x + (column.z - 5) * (column.z - 5);
      const heightPenalty = Math.max(0, CONFIG.SEA_LEVEL + 2 - column.height) * 20;
      const score = distance + heightPenalty;
      if (score < fallbackScore) {
        fallbackScore = score;
        fallback = { x: column.x + 0.5, y: feetY, z: column.z + 0.5 };
      }
    }

    // 予備探索でも見つからなければ、最高地点を出現地点にする。
    if (fallback) return fallback;
    let highest = null;
    for (const column of terrainColumns.values()) {
      if (!highest || column.height > highest.height) highest = column;
    }
    return highest
      ? { x: highest.x + 0.5, y: highest.height + 1, z: highest.z + 0.5 }
      : { x: 0.5, y: CONFIG.SEA_LEVEL + 2, z: 5.5 };
  }

  function generateWorld() {
    const radius = CONFIG.WORLD_RADIUS_CHUNKS;
    const minChunk = -radius;
    const maxChunk = radius;
    const minX = minChunk * CHUNK_SIZE;
    const maxX = (maxChunk + 1) * CHUNK_SIZE - 1;
    const minZ = minChunk * CHUNK_SIZE;
    const maxZ = (maxChunk + 1) * CHUNK_SIZE - 1;

    generateHeightMap(minX, maxX, minZ, maxZ);
    markBeaches(minX, maxX, minZ, maxZ);
    buildTerrainBlocks();
    generateTrees();
    spawnPosition = findSpawnPosition();
  }

  function init(seed) {
    // シードは32bit整数に揃える。負数や0も有効。
    if (seed === undefined || seed === null || seed === "") {
      currentSeed = CONFIG.WORLD_SEED | 0;
    } else {
      const numericSeed = Number(seed);
      if (!Number.isFinite(numericSeed)) {
        throw new Error("シードは整数で入力してください。");
      }
      currentSeed = Math.trunc(numericSeed) | 0;
    }

    worldBlocks.clear();
    chunks.clear();
    terrainColumns.clear();
    generateWorld();
  }

  // チャンク内のブロックから、隣が空気の面だけを頂点データにする。
  // 1頂点あたり position(3) + color(3) = 6個のfloat。
  const FACE_DEFINITIONS = [
    {
      neighbor: [1, 0, 0], faceIndex: 0,
      corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
    },
    {
      neighbor: [-1, 0, 0], faceIndex: 1,
      corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]
    },
    {
      neighbor: [0, 1, 0], faceIndex: 2,
      corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]
    },
    {
      neighbor: [0, -1, 0], faceIndex: 3,
      corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]
    },
    {
      neighbor: [0, 0, 1], faceIndex: 4,
      corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]
    },
    {
      neighbor: [0, 0, -1], faceIndex: 5,
      corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]
    }
  ];

  function buildChunkVertices(chunk) {
    // 1頂点: position(3) + uv(2) + faceTint(3) = 8 float
    const data = [];
    const triangleOrder = [0, 1, 2, 0, 2, 3];
    const atlasColumns = CONFIG.TEXTURE_COLUMNS;
    const atlasRows = Math.ceil(CONFIG.TEXTURE_NAMES.length / atlasColumns);
    const tileSize = CONFIG.TEXTURE_SIZE;
    const atlasWidth = atlasColumns * tileSize;
    const atlasHeight = atlasRows * tileSize;

    for (const key of chunk.blockKeys) {
      const type = worldBlocks.get(key);
      if (!type) continue;

      const parts = key.split(",");
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      const z = Number(parts[2]);
      const blockDefinition = CONFIG.BLOCKS[type];

      for (let faceIndex = 0; faceIndex < FACE_DEFINITIONS.length; faceIndex++) {
        const face = FACE_DEFINITIONS[faceIndex];
        const nx = x + face.neighbor[0];
        const ny = y + face.neighbor[1];
        const nz = z + face.neighbor[2];
        const neighborType = worldBlocks.get(blockKey(nx, ny, nz));

        // 水同士の内側の面は省略。水と固体の境界では水側の面だけ描く。
        if (neighborType && !(type === "water" && neighborType !== "water")) continue;

        const textureName = blockDefinition.textureFaces[face.faceIndex];
        const tileIndex = CONFIG.TEXTURE_INDEX[textureName] || 0;
        const tileX = tileIndex % atlasColumns;
        const tileY = Math.floor(tileIndex / atlasColumns);
        const u0 = (tileX * tileSize + 0.5) / atlasWidth;
        const u1 = ((tileX + 1) * tileSize - 0.5) / atlasWidth;
        const v0 = (tileY * tileSize + 0.5) / atlasHeight;
        const v1 = ((tileY + 1) * tileSize - 0.5) / atlasHeight;
        // HTMLImageElementの先頭行はWebGLでは低いV側に入るため、
        // ブロックの上端に画像の上端が来るようV座標を反転する。
        const uvCorners = [[u0, v1], [u0, v0], [u1, v0], [u1, v1]];
        const color = blockDefinition.faces[face.faceIndex];

        for (let i = 0; i < triangleOrder.length; i++) {
          const cornerIndex = triangleOrder[i];
          const corner = face.corners[cornerIndex];
          const uv = uvCorners[cornerIndex];
          data.push(
            x + corner[0], y + corner[1], z + corner[2],
            uv[0], uv[1],
            color[0], color[1], color[2]
          );
        }
      }
    }

    return new Float32Array(data);
  }

  // グリッドを通るレイを調べ、最初に当たったブロックを返す。
  function raycast(origin, direction, maxDistance) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    let blockType = getBlock(x, y, z);
    if (blockType) {
      return { x, y, z, type: blockType, normal: { x: 0, y: 0, z: 0 }, distance: 0 };
    }

    const stepX = direction.x > 0 ? 1 : (direction.x < 0 ? -1 : 0);
    const stepY = direction.y > 0 ? 1 : (direction.y < 0 ? -1 : 0);
    const stepZ = direction.z > 0 ? 1 : (direction.z < 0 ? -1 : 0);

    const deltaX = stepX === 0 ? Infinity : Math.abs(1 / direction.x);
    const deltaY = stepY === 0 ? Infinity : Math.abs(1 / direction.y);
    const deltaZ = stepZ === 0 ? Infinity : Math.abs(1 / direction.z);

    let maxX = stepX > 0 ? (x + 1 - origin.x) * deltaX : (stepX < 0 ? (origin.x - x) * deltaX : Infinity);
    let maxY = stepY > 0 ? (y + 1 - origin.y) * deltaY : (stepY < 0 ? (origin.y - y) * deltaY : Infinity);
    let maxZ = stepZ > 0 ? (z + 1 - origin.z) * deltaZ : (stepZ < 0 ? (origin.z - z) * deltaZ : Infinity);

    let distance = 0;
    let normalX = 0;
    let normalY = 0;
    let normalZ = 0;

    while (distance <= maxDistance) {
      if (maxX < maxY && maxX < maxZ) {
        x += stepX;
        distance = maxX;
        maxX += deltaX;
        normalX = -stepX;
        normalY = 0;
        normalZ = 0;
      } else if (maxY < maxZ) {
        y += stepY;
        distance = maxY;
        maxY += deltaY;
        normalX = 0;
        normalY = -stepY;
        normalZ = 0;
      } else {
        z += stepZ;
        distance = maxZ;
        maxZ += deltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }

      if (distance > maxDistance) break;
      blockType = getBlock(x, y, z);
      if (blockType) {
        return {
          x, y, z,
          type: blockType,
          normal: { x: normalX, y: normalY, z: normalZ },
          distance
        };
      }
    }

    return null;
  }

  window.CaveGameWorld = {
    init,
    getBlock,
    setBlock,
    removeBlock,
    isSolidBlock: function (x, y, z) {
      const type = getBlock(x, y, z);
      return !!type && type !== "water";
    },
    raycast,
    buildChunkVertices,
    getChunks: function () { return chunks.values(); },
    getBlockCount: function () { return worldBlocks.size; },
    getSeed: function () { return currentSeed; },
    getSpawnPosition: function () {
      return { x: spawnPosition.x, y: spawnPosition.y, z: spawnPosition.z };
    }
  };
})();
