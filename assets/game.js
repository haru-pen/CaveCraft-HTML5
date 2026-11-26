/* =========================================================
   CaveCraft - game.js
   ゲーム管理、UI、ブロック操作、インベントリ、水バケツ
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.CaveGameConfig;
  const World = window.CaveGameWorld;
  const Player = window.CaveGamePlayer;
  const Renderer = window.CaveGameRenderer;

  let canvas;
  let statusElement;
  let menuOverlay;
  let menuTitle;
  let menuDescription;
  let playButton;
  let resetButton;
  let seedInput;
  let saveButton;
  let loadButton;
  let menuFeedback;
  let inventoryOverlay;
  let inventoryGrid;
  let creativeGrid;
  let normalPage;
  let creativePage;
  let normalTab;
  let creativeTab;
  let inventoryStatus;
  let inventoryOpen = false;
  let hasStarted = false;

  let selectedBlockElement;
  let hotbarElement;
  let debugElement;
  let hotbarButtons = [];
  let inventoryButtons = [];
  let inventoryHotbarButtons = [];
  let hotbar = CONFIG.HOTBAR.slice();
  const inventory = new Array(27).fill(null);
  let selectedSlot = 0;
  let wheelAccumulator = 0;
  let lastFrameTime = 0;
  let accumulator = 0;
  let lastRenderTime = 0;
  let fpsFrameCount = 0;
  let fpsTimer = 0;
  let currentFps = 0;
  let lastDebugUpdate = 0;
  let running = false;

  function setStatus(message) {
    if (statusElement) statusElement.textContent = message;
    if (inventoryStatus && inventoryOpen) inventoryStatus.textContent = message;
  }

  function getItemDefinition(type) {
    if (!type) return null;
    return CONFIG.BLOCKS[type] || CONFIG.ITEMS[type] || null;
  }

  function selectedItemType() {
    return hotbar[selectedSlot] || null;
  }

  function updateHotbarUI() {
    for (let i = 0; i < hotbarButtons.length; i++) {
      hotbarButtons[i].classList.toggle("selected", i === selectedSlot);
      const type = hotbar[i];
      const definition = getItemDefinition(type);
      const swatch = hotbarButtons[i].querySelector(".slot-swatch");
      const name = hotbarButtons[i].querySelector(".slot-name");
      swatch.style.backgroundColor = definition ? definition.uiColor : "transparent";
      name.textContent = definition ? definition.name : "空";
    }

    const type = selectedItemType();
    const definition = getItemDefinition(type);
    selectedBlockElement.textContent = definition
      ? "選択中: " + definition.name
      : "選択中: 空のスロット";
    updateInventoryHotbarUI();
  }

  function selectSlot(index) {
    if (index < 0 || index >= hotbar.length) return;
    selectedSlot = index;
    updateHotbarUI();
    const definition = getItemDefinition(selectedItemType());
    setStatus(definition ? definition.name + "を選択しました。" : "空のスロットを選択しました。");
  }

  function createHotbar() {
    hotbarElement.textContent = "";
    hotbarButtons = [];

    for (let i = 0; i < 9; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotbar-slot";
      button.setAttribute("aria-label", "ホットバースロット " + (i + 1));
      button.innerHTML =
        '<span class="slot-number">' + (i + 1) + '</span>' +
        '<span class="slot-swatch"></span>' +
        '<span class="slot-name"></span>';
      button.addEventListener("click", function () {
        selectSlot(i);
      });
      hotbarElement.appendChild(button);
      hotbarButtons.push(button);
    }
    updateHotbarUI();
  }

  function makeInventoryItemButton(type, className) {
    const definition = getItemDefinition(type);
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = definition ? definition.name : type;

    const swatch = document.createElement("span");
    swatch.className = "inventory-swatch";
    swatch.style.backgroundColor = definition ? definition.uiColor : "transparent";
    const name = document.createElement("span");
    name.className = "inventory-item-name";
    name.textContent = definition ? definition.name : "空";
    button.appendChild(swatch);
    button.appendChild(name);
    return button;
  }

  function updateInventoryUI() {
    for (let i = 0; i < inventoryButtons.length; i++) {
      const slot = inventoryButtons[i];
      const type = inventory[i];
      slot.textContent = "";
      slot.classList.toggle("empty", !type);
      if (type) {
        const definition = getItemDefinition(type);
        const swatch = document.createElement("span");
        swatch.className = "inventory-swatch";
        swatch.style.backgroundColor = definition ? definition.uiColor : "transparent";
        const name = document.createElement("span");
        name.className = "inventory-item-name";
        name.textContent = definition ? definition.name : type;
        slot.appendChild(swatch);
        slot.appendChild(name);
      } else {
        const empty = document.createElement("span");
        empty.className = "inventory-item-name";
        empty.textContent = "空";
        slot.appendChild(empty);
      }
    }
  }

  function updateInventoryHotbarUI() {
    for (let i = 0; i < inventoryHotbarButtons.length; i++) {
      const button = inventoryHotbarButtons[i];
      const definition = getItemDefinition(hotbar[i]);
      button.classList.toggle("selected", i === selectedSlot);
      const swatch = button.querySelector(".inventory-swatch");
      const name = button.querySelector(".inventory-item-name");
      swatch.style.backgroundColor = definition ? definition.uiColor : "transparent";
      name.textContent = definition ? definition.name : "空";
    }
  }

  function createInventory() {
    inventoryGrid.textContent = "";
    inventoryButtons = [];

    for (let i = 0; i < 27; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-slot empty";
      button.setAttribute("aria-label", "インベントリスロット " + (i + 1));
      button.addEventListener("click", function () {
        const storedType = inventory[i];
        const oldHotbarType = hotbar[selectedSlot];
        if (!storedType && !oldHotbarType) return;
        hotbar[selectedSlot] = storedType || null;
        inventory[i] = oldHotbarType || null;
        updateInventoryUI();
        updateHotbarUI();
        if (storedType) {
          const definition = getItemDefinition(storedType);
          setStatus((definition ? definition.name : storedType) + "をホットバーに移しました。");
        } else {
          setStatus("選択中のホットバーアイテムを通常インベントリに移しました。");
        }
      });
      inventoryGrid.appendChild(button);
      inventoryButtons.push(button);
    }

    creativeGrid.textContent = "";
    const allTypes = Object.keys(CONFIG.BLOCKS).concat(Object.keys(CONFIG.ITEMS));
    for (const type of allTypes) {
      const button = makeInventoryItemButton(type, "creative-item");
      button.addEventListener("click", function () {
        const emptyIndex = inventory.indexOf(null);
        if (emptyIndex === -1) {
          setStatus("通常インベントリに空きがありません。");
          return;
        }
        inventory[emptyIndex] = type;
        updateInventoryUI();
        const definition = getItemDefinition(type);
        setStatus((definition ? definition.name : type) + "をインベントリに追加しました。");
      });
      creativeGrid.appendChild(button);
    }

    const quickbarGrid = document.getElementById("inventoryHotbarGrid");
    quickbarGrid.textContent = "";
    inventoryHotbarButtons = [];
    for (let i = 0; i < 9; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-hotbar-slot";
      button.innerHTML = '<span class="inventory-hotbar-number">' + (i + 1) + '</span>';
      const swatch = document.createElement("span");
      swatch.className = "inventory-swatch";
      const name = document.createElement("span");
      name.className = "inventory-item-name";
      button.appendChild(swatch);
      button.appendChild(name);
      button.addEventListener("click", function () { selectSlot(i); });
      quickbarGrid.appendChild(button);
      inventoryHotbarButtons.push(button);
    }

    updateInventoryUI();
    updateInventoryHotbarUI();
  }

  function showInventoryPage(page) {
    const creative = page === "creative";
    normalPage.classList.toggle("hidden", creative);
    creativePage.classList.toggle("hidden", !creative);
    normalTab.classList.toggle("active", !creative);
    creativeTab.classList.toggle("active", creative);
    inventoryStatus.textContent = creative
      ? "アイテムをクリックすると通常インベントリに追加します。"
      : "枠をクリックすると選択中のホットバー枠と入れ替わります。";
  }

  function openInventory() {
    if (inventoryOpen || !Player.isPointerLocked()) return;
    inventoryOpen = true;
    menuOverlay.classList.add("hidden");
    inventoryOverlay.classList.remove("hidden");
    showInventoryPage("normal");
    updateInventoryUI();
    if (document.exitPointerLock && document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    setStatus("インベントリを開いています。");
  }

  function showPauseMenu() {
    menuOverlay.classList.remove("hidden");
    menuTitle.textContent = hasStarted ? "ポーズ" : "CaveCraft";
    menuDescription.textContent = hasStarted
      ? "ゲームを一時停止しています。"
      : "「ゲーム開始」をクリックしてください。";
    playButton.textContent = hasStarted ? "ゲームに戻る" : "ゲーム開始";
  }

  function closeInventory() {
    if (!inventoryOpen) return;
    inventoryOpen = false;
    inventoryOverlay.classList.add("hidden");
    showPauseMenu();
    setStatus("ゲームに戻るには「ゲームに戻る」をクリックしてください。");
    // キー入力からでもクリックからでも安全に復帰できるよう、失敗時はポーズ画面を残す。
    Player.requestPointerLock();
  }

  function handleInventoryKeyDown(event) {
    const code = event.code || "";
    const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
    const isE = code === "KeyE" || key === "e";
    const isEscape = code === "Escape" || key === "escape";

    if (inventoryOpen && (isE || isEscape)) {
      if (event.repeat) return;
      event.preventDefault();
      closeInventory();
      return;
    }

    if (!inventoryOpen && isE && Player.isPointerLocked()) {
      if (event.repeat) return;
      event.preventDefault();
      openInventory();
    }
  }

  function getTargetBlock() {
    const camera = Player.getCamera();
    return World.raycast(camera.position, camera.direction, CONFIG.MAX_BLOCK_REACH);
  }

  function breakTargetBlock() {
    const hit = getTargetBlock();
    if (!hit) {
      setStatus("届く範囲にブロックがありません。");
      return;
    }
    if (World.removeBlock(hit.x, hit.y, hit.z)) {
      const definition = getItemDefinition(hit.type);
      setStatus((definition ? definition.name : hit.type) + "を壊しました。");
    }
  }

  function useBucket(type, hit) {
    if (!hit) {
      setStatus("水かブロックの面を狙ってバケツを使ってください。");
      return;
    }

    if (type === "bucket_empty") {
      if (hit.type !== "water") {
        setStatus("空のバケツは水ブロックに向けて右クリックしてください。");
        return;
      }
      if (World.removeBlock(hit.x, hit.y, hit.z)) {
        // 空のバケツは消費・変化せず、何度でも水を汲み取れる。
        setStatus("水を汲み取りました。空のバケツはそのまま何度でも使えます。");
      }
      return;
    }

    if (type === "bucket_water") {
      const x = hit.x + hit.normal.x;
      const y = hit.y + hit.normal.y;
      const z = hit.z + hit.normal.z;
      if (World.getBlock(x, y, z)) {
        setStatus("そこには水を置けません。");
        return;
      }
      if (World.setBlock(x, y, z, "water")) {
        // 水入りバケツも消費・変化せず、無制限に水を置ける。
        setStatus("水を流しました。水入りバケツはそのまま何度でも使えます。");
      }
    }
  }

  function placeSelectedBlock() {
    const type = selectedItemType();
    if (!type) {
      setStatus("空のスロットなので設置できません。");
      return;
    }

    const hit = getTargetBlock();
    if (type === "bucket_empty" || type === "bucket_water") {
      useBucket(type, hit);
      return;
    }
    if (!CONFIG.BLOCKS[type]) {
      setStatus("このアイテムはここでは使えません。");
      return;
    }
    if (!hit) {
      setStatus("ブロックの面を狙って右クリックしてください。");
      return;
    }

    const x = hit.x + hit.normal.x;
    const y = hit.y + hit.normal.y;
    const z = hit.z + hit.normal.z;
    if (World.getBlock(x, y, z)) {
      setStatus("そこにはすでにブロックがあります。");
      return;
    }
    // 水はプレイヤーと重なっても当たり判定がないため設置できる。
    if (type !== "water" && Player.intersectsBlock(x, y, z)) {
      setStatus("プレイヤーと重なる場所には設置できません。");
      return;
    }
    if (World.setBlock(x, y, z, type)) {
      setStatus(CONFIG.BLOCKS[type].name + "を設置しました。");
    }
  }

  function pickTargetBlock() {
    const hit = getTargetBlock();
    if (!hit) {
      setStatus("ブロックを狙ってホイールクリックしてください。");
      return;
    }
    const index = hotbar.indexOf(hit.type);
    if (index === -1) {
      setStatus("このブロックはホットバーにありません。");
      return;
    }
    selectSlot(index);
  }

  function handleMouseDown(event) {
    if (!Player.isPointerLocked()) return;
    if (event.button === 0) {
      event.preventDefault();
      breakTargetBlock();
    } else if (event.button === 2) {
      event.preventDefault();
      placeSelectedBlock();
    } else if (event.button === 1) {
      event.preventDefault();
      pickTargetBlock();
    }
  }

  function handleWheel(event) {
    if (!Player.isPointerLocked()) return;
    event.preventDefault();
    wheelAccumulator += event.deltaY;
    while (wheelAccumulator >= 100) {
      selectSlot((selectedSlot + 1) % 9);
      wheelAccumulator -= 100;
    }
    while (wheelAccumulator <= -100) {
      selectSlot((selectedSlot + 8) % 9);
      wheelAccumulator += 100;
    }
  }

  function handleContextMenu(event) {
    event.preventDefault();
  }

  function handlePointerLockChange() {
    const locked = Player.isPointerLocked();
    if (locked) {
      inventoryOpen = false;
      inventoryOverlay.classList.add("hidden");
      hasStarted = true;
      menuOverlay.classList.add("hidden");
      setStatus("ゲーム開始。Escキーでポーズ、Eキーでインベントリを開けます。");
    } else {
      if (inventoryOpen) return;
      showPauseMenu();
      setStatus(hasStarted ? "ポーズ中です。" : "ゲーム開始前です。");
    }
  }

  function setMenuFeedback(message) {
    if (menuFeedback) menuFeedback.textContent = message;
  }

  function resetWorldFromSeed() {
    const rawSeed = seedInput.value.trim();
    const seed = Number(rawSeed);
    if (!rawSeed || !Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647) {
      setMenuFeedback("シードは -2147483648 ～ 2147483647 の整数で入力してください。");
      return;
    }
    Renderer.clearWorld(World);
    World.init(seed);
    const spawn = World.getSpawnPosition();
    Player.setSpawn(spawn.x, spawn.y, spawn.z);
    seedInput.value = String(World.getSeed());
    wheelAccumulator = 0;
    lastFrameTime = 0;
    accumulator = 0;
    lastRenderTime = 0;
    setMenuFeedback("新しいワールドを生成しました。シード: " + World.getSeed());
    setStatus("ワールドをリセットしました。");
  }

  function handleSavePlaceholder() {
    setMenuFeedback("セーブ機能は第9段階で実装予定です。");
  }

  function handleLoadPlaceholder() {
    setMenuFeedback("ロード機能は第9段階で実装予定です。");
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      accumulator = 0;
      lastFrameTime = 0;
    } else {
      lastFrameTime = 0;
      lastRenderTime = 0;
    }
  }

  function updateHotbarKeys() {
    for (let i = 0; i < 9; i++) {
      if (Player.consumePressed(String(i + 1))) selectSlot(i);
    }
  }

  function updateDebug(now, stats) {
    if (now - lastDebugUpdate < 500) return;
    lastDebugUpdate = now;
    debugElement.textContent =
      "FPS: " + currentFps +
      " | チャンク: " + stats.renderedChunks + "/" + stats.visibleChunks +
      " | 頂点: " + stats.vertices.toLocaleString("ja-JP") +
      " | ブロック: " + World.getBlockCount();
  }

  function gameLoop(timestamp) {
    if (!running) return;
    requestAnimationFrame(gameLoop);
    if (document.hidden) return;

    if (!lastFrameTime) lastFrameTime = timestamp;
    let frameDelta = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    if (frameDelta > 0.1) frameDelta = 0.1;
    if (frameDelta < 0) frameDelta = 0;

    accumulator += frameDelta;
    const fixedDelta = 1 / CONFIG.PHYSICS_HZ;
    let steps = 0;
    while (accumulator >= fixedDelta && steps < 8) {
      Player.update(fixedDelta, World);
      accumulator -= fixedDelta;
      steps++;
    }
    if (steps >= 8) accumulator = 0;

    updateHotbarKeys();
    fpsFrameCount++;
    fpsTimer += frameDelta;
    if (fpsTimer >= 1) {
      currentFps = Math.round(fpsFrameCount / fpsTimer);
      fpsFrameCount = 0;
      fpsTimer = 0;
    }

    const renderInterval = 1000 / CONFIG.TARGET_FPS;
    if (timestamp - lastRenderTime >= renderInterval) {
      lastRenderTime = timestamp;
      const targetBlock = Player.isPointerLocked() ? getTargetBlock() : null;
      const stats = Renderer.render(World, Player, targetBlock);
      updateDebug(timestamp, stats);
    }
  }

  function showFatalError(error) {
    console.error(error);
    const message = document.getElementById("fatalError");
    if (message) {
      message.textContent = "ゲームを起動できませんでした: " + (error && error.message ? error.message : String(error));
      message.classList.remove("hidden");
    }
  }

  function start() {
    canvas = document.getElementById("gameCanvas");
    statusElement = document.getElementById("statusText");
    menuOverlay = document.getElementById("menuOverlay");
    menuTitle = document.getElementById("menuTitle");
    // Always show the current product name on the initial menu.
    menuTitle.textContent = "CaveCraft";
    menuDescription = document.getElementById("menuDescription");
    playButton = document.getElementById("playButton");
    resetButton = document.getElementById("resetButton");
    seedInput = document.getElementById("seedInput");
    saveButton = document.getElementById("saveButton");
    loadButton = document.getElementById("loadButton");
    menuFeedback = document.getElementById("menuFeedback");
    inventoryOverlay = document.getElementById("inventoryOverlay");
    inventoryGrid = document.getElementById("inventoryGrid");
    creativeGrid = document.getElementById("creativeGrid");
    normalPage = document.getElementById("normalPage");
    creativePage = document.getElementById("creativePage");
    normalTab = document.getElementById("normalTab");
    creativeTab = document.getElementById("creativeTab");
    inventoryStatus = document.getElementById("inventoryStatus");
    selectedBlockElement = document.getElementById("selectedBlock");
    hotbarElement = document.getElementById("hotbar");
    debugElement = document.getElementById("debugInfo");

    try {
      World.init();
      Renderer.init(canvas);
      Player.init(canvas);
      const spawn = World.getSpawnPosition();
      Player.setSpawn(spawn.x, spawn.y, spawn.z);

      createHotbar();
      createInventory();

      canvas.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("contextmenu", handleContextMenu);
      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("wheel", handleWheel, { passive: false });
      document.addEventListener("pointerlockchange", handlePointerLockChange);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      document.addEventListener("keydown", handleInventoryKeyDown);

      playButton.addEventListener("click", function () {
        if (!canvas.requestPointerLock) {
          setMenuFeedback("このブラウザではマウスロックを利用できません。");
          return;
        }
        Player.requestPointerLock();
      });
      resetButton.addEventListener("click", resetWorldFromSeed);
      saveButton.addEventListener("click", handleSavePlaceholder);
      loadButton.addEventListener("click", handleLoadPlaceholder);
      normalTab.addEventListener("click", function () { showInventoryPage("normal"); });
      creativeTab.addEventListener("click", function () { showInventoryPage("creative"); });
      document.getElementById("inventoryCloseButton").addEventListener("click", closeInventory);
      document.getElementById("inventoryDoneButton").addEventListener("click", closeInventory);

      seedInput.value = String(World.getSeed());
      menuOverlay.classList.remove("hidden");
      inventoryOverlay.classList.add("hidden");
      setStatus("ゲーム開始前です。");
      running = true;
      requestAnimationFrame(gameLoop);
    } catch (error) {
      showFatalError(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
