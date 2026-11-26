/* =========================================================
   CaveCraft - renderer.js
   WebGL描画、チャンクGPUメッシュ、16×16ピクセルテクスチャ
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.CaveGameConfig;
  let canvas = null;
  let gl = null;
  let program = null;
  let atlasTexture = null;
  let positionLocation = -1;
  let uvLocation = -1;
  let colorLocation = -1;
  let projectionLocation = null;
  let viewLocation = null;
  let textureLocation = null;
  let highlightModeLocation = null;
  let projectionMatrix = new Float32Array(16);
  let viewMatrix = new Float32Array(16);
  let lastWidth = 0;
  let lastHeight = 0;
  let lastStats = { visibleChunks: 0, renderedChunks: 0, vertices: 0 };
  let highlightBuffer = null;
  let lastHighlightKey = null;

  const VERTEX_SHADER_SOURCE = `
    attribute vec3 aPosition;
    attribute vec2 aUV;
    attribute vec3 aColor;
    uniform mat4 uProjection;
    uniform mat4 uView;
    varying vec2 vUV;
    varying vec3 vColor;
    void main(void) {
      vUV = aUV;
      vColor = aColor;
      gl_Position = uProjection * uView * vec4(aPosition, 1.0);
    }
  `;

  const FRAGMENT_SHADER_SOURCE = `
    precision mediump float;
    uniform sampler2D uAtlas;
    uniform float uHighlightMode;
    varying vec2 vUV;
    varying vec3 vColor;
    void main(void) {
      if (uHighlightMode > 0.5) {
        gl_FragColor = vec4(vColor, 1.0);
      } else {
        vec4 texel = texture2D(uAtlas, vUV);
        gl_FragColor = vec4(texel.rgb * vColor, texel.a);
      }
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || "シェーダーのコンパイルに失敗しました。";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram() {
    const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    const newProgram = gl.createProgram();
    gl.attachShader(newProgram, vertexShader);
    gl.attachShader(newProgram, fragmentShader);
    gl.linkProgram(newProgram);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(newProgram) || "シェーダープログラムのリンクに失敗しました。";
      gl.deleteProgram(newProgram);
      throw new Error(message);
    }
    return newProgram;
  }

  function perspective(out, fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  }

  function normalize3(x, y, z) {
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
  }

  function cross3(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function dot3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function lookAt(out, eye, center, up) {
    const z = normalize3(eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]);
    const x = normalize3.apply(null, cross3(up, z));
    const y = cross3(z, x);

    out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
    out[12] = -dot3(x, eye);
    out[13] = -dot3(y, eye);
    out[14] = -dot3(z, eye);
    out[15] = 1;
    return out;
  }

  function applyAtlasTextureParameters() {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function createTextureAtlas() {
    // まず1×1の白い仮テクスチャを置き、画像読み込み中の描画を保つ。
    atlasTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255])
    );
    applyAtlasTextureParameters();

    const embeddedPng = "data:image/png;base64,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";
    let embeddedStarted = false;
    let atlasReady = false;

    function uploadImage(image, sourceName) {
      const expectedWidth = CONFIG.TEXTURE_COLUMNS * CONFIG.TEXTURE_SIZE;
      const expectedHeight = Math.ceil(CONFIG.TEXTURE_NAMES.length / CONFIG.TEXTURE_COLUMNS) * CONFIG.TEXTURE_SIZE;
      if (image.naturalWidth !== expectedWidth || image.naturalHeight !== expectedHeight) {
        throw new Error("PNGサイズが異なります: " + image.naturalWidth + "x" + image.naturalHeight +
          " (必要: " + expectedWidth + "x" + expectedHeight + ")");
      }
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      applyAtlasTextureParameters();
      atlasReady = true;
      console.info("PNGテクスチャを読み込みました:", sourceName);
    }

    function loadEmbeddedFallback(reason) {
      if (embeddedStarted || atlasReady) return;
      embeddedStarted = true;
      console.warn("外部PNGを読み込めなかったため、埋め込みPNGを使用します。", reason || "");
      const fallbackImage = new Image();
      fallbackImage.onload = function () {
        try { uploadImage(fallbackImage, "renderer.js 内蔵PNG"); }
        catch (error) { console.error("内蔵PNGの登録にも失敗しました:", error); }
      };
      fallbackImage.onerror = function () { console.error("内蔵PNGの読み込みにも失敗しました。"); };
      fallbackImage.src = embeddedPng;
    }

    const image = new Image();
    image.onload = function () {
      try { uploadImage(image, CONFIG.TEXTURE_ATLAS_PATH); }
      catch (error) { loadEmbeddedFallback(error.message); }
    };
    image.onerror = function () {
      loadEmbeddedFallback("textures/blocks.png を読み込めませんでした。");
    };
    try {
      image.src = new URL(CONFIG.TEXTURE_ATLAS_PATH, document.baseURI).href;
    } catch (error) {
      loadEmbeddedFallback(error.message);
    }
  }

  function resizeCanvas() {
    if (!canvas || !gl) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_PIXEL_RATIO);
    const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
    if (width === lastWidth && height === lastHeight) return;

    lastWidth = width;
    lastHeight = height;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    perspective(projectionMatrix, CONFIG.FIELD_OF_VIEW, width / height, CONFIG.NEAR_PLANE, CONFIG.FAR_PLANE);
  }

  function init(targetCanvas) {
    canvas = targetCanvas;
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: true,
      powerPreference: "high-performance"
    });

    if (!gl) {
      throw new Error("このブラウザではWebGLを利用できません。Chromeの設定やグラフィック機能を確認してください。");
    }

    program = createProgram();
    gl.useProgram(program);
    positionLocation = gl.getAttribLocation(program, "aPosition");
    uvLocation = gl.getAttribLocation(program, "aUV");
    colorLocation = gl.getAttribLocation(program, "aColor");
    projectionLocation = gl.getUniformLocation(program, "uProjection");
    viewLocation = gl.getUniformLocation(program, "uView");
    textureLocation = gl.getUniformLocation(program, "uAtlas");
    highlightModeLocation = gl.getUniformLocation(program, "uHighlightMode");

    createTextureAtlas();
    gl.uniform1i(textureLocation, 0);
    gl.uniform1f(highlightModeLocation, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0.53, 0.72, 0.91, 1.0);
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  }

  function updateChunkBuffer(chunk, world) {
    if (!chunk.dirty) return;
    const vertices = world.buildChunkVertices(chunk);
    chunk.vertexCount = vertices.length / 8;

    if (chunk.vertexCount === 0) {
      if (chunk.vertexBuffer) {
        gl.deleteBuffer(chunk.vertexBuffer);
        chunk.vertexBuffer = null;
      }
      chunk.dirty = false;
      return;
    }

    if (!chunk.vertexBuffer) chunk.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    chunk.dirty = false;
  }

  function clearWorld(world) {
    if (!gl || !world) return;
    for (const chunk of world.getChunks()) {
      if (chunk.vertexBuffer) {
        gl.deleteBuffer(chunk.vertexBuffer);
        chunk.vertexBuffer = null;
      }
      chunk.vertexCount = 0;
      chunk.dirty = true;
    }
    lastHighlightKey = null;
  }

  function drawTargetHighlight(targetBlock) {
    if (!targetBlock) {
      lastHighlightKey = null;
      return;
    }

    const key = targetBlock.x + "," + targetBlock.y + "," + targetBlock.z;
    if (!highlightBuffer) highlightBuffer = gl.createBuffer();

    if (key !== lastHighlightKey) {
      const pad = 0.003;
      const x0 = targetBlock.x - pad;
      const y0 = targetBlock.y - pad;
      const z0 = targetBlock.z - pad;
      const x1 = targetBlock.x + 1 + pad;
      const y1 = targetBlock.y + 1 + pad;
      const z1 = targetBlock.z + 1 + pad;
      const corners = [
        [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
        [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]
      ];
      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];
      const color = [1.0, 0.94, 0.28];
      const data = [];
      for (const edge of edges) {
        for (const cornerIndex of edge) {
          const point = corners[cornerIndex];
          data.push(point[0], point[1], point[2], color[0], color[1], color[2]);
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, highlightBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      lastHighlightKey = key;
    }

    gl.uniform1f(highlightModeLocation, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, highlightBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.disableVertexAttribArray(uvLocation);
    gl.vertexAttrib2f(uvLocation, 0, 0);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.uniform1f(highlightModeLocation, 0);
  }

  function render(world, player, targetBlock) {
    if (!gl) return lastStats;
    resizeCanvas();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const camera = player.getCamera();
    const eye = [camera.position.x, camera.position.y, camera.position.z];
    const direction = camera.direction;
    const center = [camera.position.x + direction.x, camera.position.y + direction.y, camera.position.z + direction.z];
    lookAt(viewMatrix, eye, center, [0, 1, 0]);

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.uniform1i(textureLocation, 0);
    gl.uniform1f(highlightModeLocation, 0);
    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
    gl.uniformMatrix4fv(viewLocation, false, viewMatrix);

    const playerPosition = player.getPosition();
    const maxDistance = CONFIG.CHUNK_SIZE * CONFIG.RENDER_DISTANCE_CHUNKS + CONFIG.CHUNK_SIZE * 0.75;
    const maxDistanceSquared = maxDistance * maxDistance;
    let visibleChunks = 0;
    let renderedChunks = 0;
    let totalVertices = 0;

    for (const chunk of world.getChunks()) {
      const centerX = chunk.cx * CONFIG.CHUNK_SIZE + CONFIG.CHUNK_SIZE / 2;
      const centerY = chunk.cy * CONFIG.CHUNK_SIZE + CONFIG.CHUNK_SIZE / 2;
      const centerZ = chunk.cz * CONFIG.CHUNK_SIZE + CONFIG.CHUNK_SIZE / 2;
      const dx = centerX - playerPosition.x;
      const dy = centerY - camera.position.y;
      const dz = centerZ - playerPosition.z;
      if (dx * dx + dy * dy + dz * dz > maxDistanceSquared) continue;
      visibleChunks++;

      updateChunkBuffer(chunk, world);
      if (!chunk.vertexBuffer || chunk.vertexCount === 0) continue;

      gl.bindBuffer(gl.ARRAY_BUFFER, chunk.vertexBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.enableVertexAttribArray(uvLocation);
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 32, 0);
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 32, 12);
      gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 32, 20);
      gl.drawArrays(gl.TRIANGLES, 0, chunk.vertexCount);
      renderedChunks++;
      totalVertices += chunk.vertexCount;
    }

    drawTargetHighlight(targetBlock);
    lastStats = { visibleChunks, renderedChunks, vertices: totalVertices };
    return lastStats;
  }

  window.CaveGameRenderer = { init, render, clearWorld };
})();
