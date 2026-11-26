/* =========================================================
   CaveCraft - player.js
   Pointer Lock、キーボード、視点、移動、ジャンプ、衝突判定
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.CaveGameConfig;
  let canvas = null;
  const keys = Object.create(null);
  const justPressed = Object.create(null);

  const position = { x: 0.5, y: 0, z: 5.5 };
  const spawnPosition = { x: 0.5, y: 0, z: 5.5 };
  let yaw = 0;
  let pitch = 0;
  let verticalVelocity = 0;
  let grounded = false;
  let currentEyeHeight = CONFIG.EYE_HEIGHT;

  const REGISTERED_KEYS = new Set([
    "w", "a", "s", "d", "space", "shift", "c",
    "1", "2", "3", "4", "5", "6", "7", "8", "9"
  ]);

  function keyFromEvent(event) {
    const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
    if (REGISTERED_KEYS.has(key)) return key;

    // 日本語IMEやキーボード配列の影響を受けにくいよう、event.codeも利用する。
    const code = event.code || "";
    if (code === "Space") return "space";
    if (code === "ShiftLeft" || code === "ShiftRight") return "shift";
    if (code === "KeyW") return "w";
    if (code === "KeyA") return "a";
    if (code === "KeyS") return "s";
    if (code === "KeyD") return "d";
    if (code === "KeyC") return "c";
    if (/^Digit[1-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[1-9]$/.test(code)) return code.slice(6);
    return null;
  }

  function isLocked() {
    return !!canvas && document.pointerLockElement === canvas;
  }

  function clearKeys() {
    for (const key in keys) keys[key] = false;
    for (const key in justPressed) justPressed[key] = false;
  }

  function handleKeyDown(event) {
    if (!isLocked()) return;
    const key = keyFromEvent(event);
    if (!key) return;
    if (key === "space" && isLocked()) event.preventDefault();

    if (!keys[key] && !event.repeat) justPressed[key] = true;
    keys[key] = true;
  }

  function handleKeyUp(event) {
    if (!isLocked()) return;
    const key = keyFromEvent(event);
    if (!key) return;
    keys[key] = false;
  }

  function handleMouseMove(event) {
    if (!isLocked()) return;
    // 右にマウスを動かすと右を向く。Phase 6.5の左右反転修正を維持。
    yaw += event.movementX * CONFIG.MOUSE_SENSITIVITY;
    pitch -= event.movementY * CONFIG.MOUSE_SENSITIVITY;

    const limit = Math.PI / 2 - 0.01;
    if (pitch > limit) pitch = limit;
    if (pitch < -limit) pitch = -limit;
  }

  function handlePointerLockChange() {
    if (!isLocked()) clearKeys();
  }

  function init(targetCanvas) {
    canvas = targetCanvas;
    document.addEventListener("keydown", handleKeyDown, { passive: false });
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) clearKeys();
    });
  }

  function requestPointerLock() {
    if (!canvas) return;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      const result = canvas.requestPointerLock();
      // Promiseを返すブラウザでは拒否をconsoleに表示し、ゲーム自体は継続する。
      if (result && typeof result.catch === "function") {
        result.catch(function (error) {
          console.warn("Pointer Lockを開始できませんでした:", error);
        });
      }
    }
  }

  function isKeyDown(key) {
    return !!keys[key];
  }

  function consumePressed(key) {
    const pressed = !!justPressed[key];
    justPressed[key] = false;
    return pressed;
  }

  function collidesAt(x, y, z, world) {
    const radius = CONFIG.PLAYER_RADIUS;
    const height = CONFIG.PLAYER_HEIGHT;
    const epsilon = 0.0001;
    const minX = Math.floor(x - radius + epsilon);
    const maxX = Math.floor(x + radius - epsilon);
    const minY = Math.floor(y + epsilon);
    const maxY = Math.floor(y + height - epsilon);
    const minZ = Math.floor(z - radius + epsilon);
    const maxZ = Math.floor(z + radius - epsilon);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const type = world.getBlock(bx, by, bz);
          // 水は見た目だけのブロックとして扱い、プレイヤーの当たり判定から除外する。
          if (type && type !== "water") return true;
        }
      }
    }
    return false;
  }

  function hasFullGroundSupport(x, z, feetY, world) {
    // feetYに近い高さの地面を探す。groundedフラグの一時的な揺れに頼らず、
    // 実際に足元を支えているブロックを毎回確認する。
    const tolerance = 0.24;
    const searchFromY = Math.floor(feetY + tolerance) - 1;
    const supportRadius = CONFIG.PLAYER_RADIUS * 0.94;
    const inner = supportRadius * 0.72;
    const samples = [
      [0, 0],
      [-supportRadius, 0], [supportRadius, 0],
      [0, -supportRadius], [0, supportRadius],
      [-inner, -inner], [inner, -inner],
      [-inner, inner], [inner, inner]
    ];

    // プレイヤーの足元全体が同じ高さの固体ブロックで支えられる場合だけ通す。
    for (let blockY = searchFromY; blockY >= searchFromY - 3; blockY--) {
      const topY = blockY + 1;
      if (Math.abs(feetY - topY) > tolerance) continue;

      let supported = true;
      for (const sample of samples) {
        const bx = Math.floor(x + sample[0]);
        const bz = Math.floor(z + sample[1]);
        const type = world.getBlock(bx, blockY, bz);
        if (!type || type === "water") {
          supported = false;
          break;
        }
      }
      if (supported) return true;
    }
    return false;
  }

  function update(deltaTime, world) {
    const locked = isLocked();
    // ポーズ中はキー状態を解除したうえで、視点だけ通常の高さへ戻す。
    const sneaking = locked && isKeyDown("c");
    const targetEyeHeight = sneaking ? CONFIG.SNEAK_EYE_HEIGHT : CONFIG.EYE_HEIGHT;
    const eyeBlend = Math.min(1, deltaTime * CONFIG.EYE_HEIGHT_TRANSITION_SPEED);
    currentEyeHeight += (targetEyeHeight - currentEyeHeight) * eyeBlend;

    if (!locked) return;

    // Cでしゃがんでいる間だけ、足場の端から踏み出さない。
    // Shiftはダッシュ専用にし、落下防止とは切り離す。
    // groundedフラグだけで判断せず、現在の足元を毎回確認する。
    const shiftHeld = isKeyDown("shift");
    const edgeGuard = sneaking && hasFullGroundSupport(
      position.x, position.z, position.y, world
    );
    const dashing = !sneaking && shiftHeld;
    const speed = sneaking
      ? CONFIG.SNEAK_SPEED
      : (dashing ? CONFIG.DASH_SPEED : CONFIG.WALK_SPEED);

    let forward = 0;
    let strafe = 0;
    if (isKeyDown("w")) forward += 1;
    if (isKeyDown("s")) forward -= 1;
    if (isKeyDown("d")) strafe += 1;
    if (isKeyDown("a")) strafe -= 1;

    const inputLength = Math.hypot(forward, strafe);
    if (inputLength > 0) {
      forward /= inputLength;
      strafe /= inputLength;
    }

    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    const moveX = (sinYaw * forward + cosYaw * strafe) * speed * deltaTime;
    const moveZ = (-cosYaw * forward + sinYaw * strafe) * speed * deltaTime;

    // XとZを別々に解決することで、壁に沿って移動しやすくする。
    const nextX = position.x + moveX;
    if (!collidesAt(nextX, position.y, position.z, world) &&
        (!edgeGuard || hasFullGroundSupport(nextX, position.z, position.y, world))) {
      position.x = nextX;
    }

    const nextZ = position.z + moveZ;
    if (!collidesAt(position.x, position.y, nextZ, world) &&
        (!edgeGuard || hasFullGroundSupport(position.x, nextZ, position.y, world))) {
      position.z = nextZ;
    }

    // Spaceを押し続けると、着地した瞬間に次のジャンプを開始する。
    if (isKeyDown("space") && grounded) {
      verticalVelocity = CONFIG.JUMP_SPEED;
      grounded = false;
    }

    verticalVelocity -= CONFIG.GRAVITY * deltaTime;
    const nextY = position.y + verticalVelocity * deltaTime;
    if (collidesAt(position.x, nextY, position.z, world)) {
      if (verticalVelocity < 0) grounded = true;
      verticalVelocity = 0;
    } else {
      position.y = nextY;
      grounded = false;
    }

    if (position.y < -20) {
      position.x = spawnPosition.x;
      position.y = spawnPosition.y;
      position.z = spawnPosition.z;
      verticalVelocity = 0;
      grounded = false;
    }
  }

  function getCamera() {
    const cosPitch = Math.cos(pitch);
    return {
      position: {
        x: position.x,
        y: position.y + currentEyeHeight,
        z: position.z
      },
      direction: {
        x: Math.sin(yaw) * cosPitch,
        y: Math.sin(pitch),
        z: -Math.cos(yaw) * cosPitch
      }
    };
  }

  function intersectsBlock(x, y, z) {
    const radius = CONFIG.PLAYER_RADIUS;
    const playerMinX = position.x - radius;
    const playerMaxX = position.x + radius;
    const playerMinY = position.y;
    const playerMaxY = position.y + CONFIG.PLAYER_HEIGHT;
    const playerMinZ = position.z - radius;
    const playerMaxZ = position.z + radius;

    return playerMaxX > x && playerMinX < x + 1 &&
      playerMaxY > y && playerMinY < y + 1 &&
      playerMaxZ > z && playerMinZ < z + 1;
  }

  function getPosition() {
    return position;
  }

  // 自動生成された地形の上にプレイヤーを配置する。
  function setSpawn(x, y, z) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    spawnPosition.x = x;
    spawnPosition.y = y;
    spawnPosition.z = z;
    position.x = x;
    position.y = y;
    position.z = z;
    verticalVelocity = 0;
    grounded = false;
    yaw = 0;
    pitch = 0;
    currentEyeHeight = CONFIG.EYE_HEIGHT;
  }

  window.CaveGamePlayer = {
    init,
    update,
    requestPointerLock,
    isPointerLocked: isLocked,
    isKeyDown,
    consumePressed,
    getCamera,
    getPosition,
    setSpawn,
    intersectsBlock
  };
})();
