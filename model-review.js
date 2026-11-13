(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.COSMI_MODEL_REVIEW = api; api.install(); }
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  const state = { generation: 0, urls: [], pkg: null, viewer: null, linked: "" };
  const $ = id => document.getElementById(id);
  const isModel = pkg => /model|rig|anim/.test(pkg?.type || "");
  function exactBuffer(bytes) {
    if (ArrayBuffer.isView(bytes)) return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    if (bytes instanceof ArrayBuffer) return bytes.slice(0);
    throw Error("GLB 不是有效的二進位資料");
  }
  function relative(path) {
    if (typeof path !== "string" || !path || /[\\:?#\x00-\x1f]/.test(path) ||
        path.split("/").some(p => !p || p === "." || p === "..")) throw Error("驗收資源必須使用包內相對路徑");
    return path;
  }
  function selectRootManifest(paths) {
    return paths.filter(p => /(^|\/)manifest\.json$/.test(p))
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0] || "";
  }
  function selectModelFile(files, manifest = {}, descriptor = null) {
    const candidates = files.filter(f => /\.glb$/i.test(f.path));
    const declared = descriptor?.model?.path;
    if (declared) {
      relative(declared);
      const match = candidates.find(f => f.path === declared);
      if (!match) throw Error("驗收描述檔指定的最終 GLB 不存在：" + declared);
      return match;
    }
    const primary = (manifest.files || []).filter(f => f.kind === "model" && f.level === "L1" && /\.glb$/i.test(f.path));
    for (const entry of primary) {
      const match = candidates.find(f => f.path === entry.path);
      if (match) return match;
    }
    if (primary.length) throw Error("manifest 指定的最終 GLB 不存在，請確認交付檔案");
    const rank = f => f.path.startsWith("models/") ? 0 : f.path.startsWith("rig/") ? 1 : f.path.startsWith("source/") ? 2 : 3;
    return candidates.slice().sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path))[0] || null;
  }
  function descriptorFor(pkg) {
    const key = Object.keys(pkg.rawFiles || {}).find(p => p === "review_viewer.json" || p === pkg.id + "/review_viewer.json");
    if (!key) return null;
    const value = JSON.parse(new TextDecoder().decode(pkg.rawFiles[key]));
    if (value.spec !== "cosmimera-model-review/1") throw Error("不支援的 3D 驗收描述檔版本");
    return value;
  }
  function packageFiles(pkg) {
    return pkg.driveFiles || Object.keys(pkg.rawFiles || {}).map(key => ({
      key, path: key.startsWith(pkg.id + "/") ? key.slice(pkg.id.length + 1) : key
    }));
  }
  function orbitFor(descriptor) {
    const orbit = descriptor?.camera_orbit || "0deg 80deg auto";
    if (!/^-?\d+(?:\.\d+)?deg \d+(?:\.\d+)?deg (?:auto|\d+(?:\.\d+)?m)$/.test(orbit)) throw Error("相機方向設定無效");
    return orbit;
  }
  function clearMedia() {
    state.generation++;
    state.cancelLoad?.();
    if (state.viewer) { state.viewer.pause(); state.viewer.removeAttribute("src"); }
    $("modelReviewMedia")?.replaceChildren();
    $("modelReviewClips")?.replaceChildren();
    for (const url of state.urls) URL.revokeObjectURL(url);
    state.urls = [];
  }
  async function readResource(pkg, path) {
    relative(path);
    if (pkg.driveFolderId) return window.COSMI_DRIVE.read(pkg.drivePath + "/" + path);
    const file = packageFiles(pkg).find(f => f.path === path);
    const data = file && pkg.rawFiles[file.key || pkg.id + "/" + path];
    if (!data) throw Error("資源不存在：" + path);
    return new Blob([data]);
  }
  const message = text => { $("modelReviewStatus").textContent = text; };
  const make = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node; };
  const modelPackages = () => (window.COSMI_FORGE?.packages() || []).filter(isModel);
  function populatePackages(selected) {
    const picker = $("modelReviewAsset");
    picker.replaceChildren();
    for (const pkg of modelPackages()) {
      const option = make("option", pkg.id);
      option.value = pkg.id; picker.append(option);
    }
    if (selected) picker.value = selected;
  }
  async function ensureViewer() {
    if (!customElements.get("model-viewer")) await import(new URL("vendor/model-viewer.min.js", document.baseURI).href);
    await customElements.whenDefined("model-viewer");
    if (!state.viewer) {
      state.viewer = document.createElement("model-viewer");
      state.viewer.setAttribute("alt", "可旋轉縮放的實際 3D 模型");
      state.viewer.setAttribute("camera-controls", "");
      state.viewer.setAttribute("shadow-intensity", "0.5");
      state.viewer.setAttribute("exposure", "1.2");
      state.viewer.setAttribute("touch-action", "pan-y");
      $("modelReviewStage").append(state.viewer);
    }
    return state.viewer;
  }
  async function showClip(name) {
    const viewer = state.viewer;
    if (!viewer?.availableAnimations.includes(name)) return;
    viewer.pause(); viewer.animationName = name;
    await viewer.updateComplete;
    viewer.currentTime = 0; viewer.play();
    $("modelReviewPlay").textContent = "暫停";
  }
  async function resetCamera() {
    if (!state.viewer) return;
    const orbit = state.orbit || "0deg 80deg auto";
    const [theta, phi, radius] = orbit.split(" ");
    // A drag changes the camera goal without changing its declarative attribute.
    state.viewer.cameraOrbit = (parseFloat(theta) + 0.001) + "deg " + phi + " " + radius;
    await state.viewer.updateComplete;
    state.viewer.cameraOrbit = orbit;
    await state.viewer.updateComplete;
    state.viewer.jumpCameraToGoal();
  }
  async function addPreviewMedia(pkg, descriptor, generation) {
    const media = $("modelReviewMedia");
    for (const entry of descriptor?.previews || []) {
      const figure = make("figure"), img = make("img"), caption = make("figcaption", entry.label || entry.path);
      img.alt = entry.label || "模型視角"; img.loading = "lazy";
      figure.append(img, caption); media.append(figure);
      try {
        const blob = await readResource(pkg, entry.path);
        if (generation !== state.generation) return;
        const url = URL.createObjectURL(blob); state.urls.push(url); img.src = url;
      } catch (e) { caption.textContent += "（載入失敗：" + e.message + "）"; }
    }
    for (const entry of descriptor?.videos || []) {
      const figure = make("figure"), button = make("button", "載入" + (entry.label || "動作影片"));
      button.type = "button"; button.className = "btn ghost mini";
      figure.append(button); media.append(figure);
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const blob = await readResource(pkg, entry.path);
          if (generation !== state.generation) return;
          const url = URL.createObjectURL(blob); state.urls.push(url);
          const video = make("video"); video.controls = true; video.loop = true; video.src = url;
          figure.replaceChildren(make("figcaption", entry.label || "動作影片"), video);
          await video.play();
        } catch (e) { button.disabled = false; button.textContent = "重試：" + e.message; }
      });
    }
  }
  async function loadPackage(pkg) {
    clearMedia();
    const generation = state.generation;
    state.pkg = pkg;
    $("modelReviewTitle").textContent = "互動 3D 驗收";
    const approvalLabels = {
      ok: "通過",
      provisional: "暫時採用",
      pending: "待決定",
      reject: "退回重建",
      missing: "有缺檔"
    };
    $("modelReviewApproval").textContent = approvalLabels[pkg.status] || "暫時採用";
    $("modelReviewNotes").textContent = "";
    $("modelReviewPlay").disabled = true;
    $("modelReviewScrub").value = 0;
    message("正在從 " + (pkg.driveFolderId ? "Google Drive" : "已匯入資產") + " 載入最終模型…");
    try {
      const descriptor = descriptorFor(pkg);
      const file = selectModelFile(packageFiles(pkg), pkg.manifest || {}, descriptor);
      if (!file) throw Error("此資產尚無可驗收的 GLB");
      const blob = await readResource(pkg, file.path);
      const bytes = await blob.arrayBuffer();
      if (generation !== state.generation) return;
      if (descriptor?.model?.sha256) {
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x => x.toString(16).padStart(2, "0")).join("");
        if (digest !== descriptor.model.sha256) throw Error("模型 SHA256 與驗收描述檔不符，請重新同步資產");
      }
      const viewer = await ensureViewer();
      if (generation !== state.generation) return;
      state.orbit = orbitFor(descriptor);
      viewer.cameraOrbit = state.orbit;
      $("modelReviewTitle").textContent = (descriptor?.title || pkg.subjectId || pkg.id) + " · 互動 3D 驗收";
      $("modelReviewNotes").textContent = (descriptor?.notes || []).join("；");
      const url = URL.createObjectURL(new Blob([bytes], {type: "model/gltf-binary"})); state.urls.push(url);
      await new Promise((resolve, reject) => {
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(Error("GLB 無法顯示，請確認模型與貼圖")); };
        const cancelled = () => { cleanup(); reject(Error("驗收資產已切換")); };
        const cleanup = () => { viewer.removeEventListener("load", loaded); viewer.removeEventListener("error", failed); if (state.cancelLoad === cancelled) state.cancelLoad = null; };
        state.cancelLoad = cancelled;
        viewer.addEventListener("load", loaded); viewer.addEventListener("error", failed); viewer.src = url;
      });
      if (generation !== state.generation) return;
      const names = viewer.availableAnimations;
      const labels = {idle: "待機", walk: "走路", run: "跑步"};
      for (const name of names) { const option = make("option", (labels[name] || name) + "（" + name + "）"); option.value = name; $("modelReviewClips").append(option); }
      const missing = (descriptor?.animations || []).filter(name => !names.includes(name));
      message(file.path + " · " + names.length + " 段實際動畫" + (missing.length ? "；缺少：" + missing.join("、") : ""));
      $("modelReviewPlay").disabled = !names.length;
      $("modelReviewClips").disabled = !names.length;
      if (names.length) { $("modelReviewClips").value = names.includes("idle") ? "idle" : names[0]; await showClip($("modelReviewClips").value); }
      void addPreviewMedia(pkg, descriptor, generation);
    } catch (e) {
      if (generation === state.generation) { state.viewer?.removeAttribute("src"); message("載入失敗：" + e.message); }
    }
  }
  function updateLink(id) {
    const url = new URL(window.location.href); url.searchParams.set("review", id);
    window.history.replaceState(null, "", url);
  }
  async function open(pkg = null) {
    const dialog = $("modelReviewDialog");
    if (!dialog.open) dialog.showModal();
    if (!state.tick && state.tickFn) state.tick = requestAnimationFrame(state.tickFn);
    const active = pkg || window.COSMI_FORGE?.activePackage();
    const models = modelPackages();
    const selected = isModel(active) ? active : models[0];
    populatePackages(selected?.id);
    if (!selected) { clearMedia(); message("尚未載入 3D 資產，請按「重新載入 Drive」。"); return; }
    updateLink(selected.id);
    await loadPackage(selected);
  }
  function onPackagesChanged() {
    const desired = new URL(window.location.href).searchParams.get("review");
    populatePackages(state.pkg?.id);
    if (desired && state.linked !== desired) {
      const pkg = modelPackages().find(p => p.id === desired);
      if (pkg) { state.linked = desired; void open(pkg); }
      else { if (!$("modelReviewDialog").open) $("modelReviewDialog").showModal(); message("找不到指定資產：" + desired + "；請確認 Drive 權限並重新載入。"); }
    }
  }
  function install() {
    document.addEventListener("DOMContentLoaded", () => {
      const dialog = make("dialog"); dialog.id = "modelReviewDialog"; dialog.setAttribute("aria-labelledby", "modelReviewTitle");
      dialog.innerHTML = `<header><div><span id="modelReviewApproval"></span><h2 id="modelReviewTitle">互動 3D 驗收</h2></div><button type="button" id="modelReviewClose" class="btn ghost mini">關閉</button></header>
        <div class="model-review-toolbar"><label>3D 資產 <select id="modelReviewAsset" aria-label="選擇驗收資產"></select></label><button id="modelReviewReload" class="btn ghost mini" type="button">重新載入 Drive</button><button id="modelReviewLink" class="btn ghost mini" type="button">複製驗收連結</button></div>
        <p id="modelReviewStatus" role="status"></p><div id="modelReviewStage"></div>
        <div class="model-review-toolbar"><label>動作 <select id="modelReviewClips" aria-label="互動驗收動作"></select></label><button id="modelReviewPlay" class="btn mini" type="button">暫停</button><button id="modelReviewFront" class="btn ghost mini" type="button">回正面</button><input id="modelReviewScrub" aria-label="動畫時間" type="range" min="0" max="1000" value="0"><output id="modelReviewTime">0.00 s</output></div>
        <p class="muted">拖曳旋轉、滾輪縮放；可暫停或拖曳時間軸檢查變形。模型與影片從 Drive 讀取，不啟動 Colab。</p><p id="modelReviewNotes"></p><details><summary>四視角與動作影片</summary><div id="modelReviewMedia"></div></details>`;
      document.body.append(dialog);
      for (const id of ["modelReviewOpen", "modelReviewPackage"]) $(id)?.addEventListener("click", () => void open());
      $("modelReviewClose").addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => { clearMedia(); cancelAnimationFrame(state.tick); state.tick = 0; state.pkg = null; state.linked = ""; const url = new URL(window.location.href); url.searchParams.delete("review"); window.history.replaceState(null, "", url); });
      $("modelReviewAsset").addEventListener("change", () => { const pkg = modelPackages().find(p => p.id === $("modelReviewAsset").value); if (pkg) { updateLink(pkg.id); void loadPackage(pkg); } });
      $("modelReviewClips").addEventListener("change", () => void showClip($("modelReviewClips").value));
      $("modelReviewFront").addEventListener("click", () => void resetCamera());
      $("modelReviewPlay").addEventListener("click", () => { const v = state.viewer; if (!v) return; if (v.paused) { v.play(); $("modelReviewPlay").textContent = "暫停"; } else { v.pause(); $("modelReviewPlay").textContent = "播放"; } });
      $("modelReviewScrub").addEventListener("input", () => { const v = state.viewer; if (!v) return; v.pause(); v.currentTime = Number($("modelReviewScrub").value) / 1000 * (v.duration || 0); $("modelReviewPlay").textContent = "播放"; });
      $("modelReviewReload").addEventListener("click", async () => { try { message("正在重新載入 Drive…"); const id = state.pkg?.id; await window.COSMI_DRIVE.syncPackages({force: true}); const pkg = modelPackages().find(p => p.id === id); if (pkg) await loadPackage(pkg); else onPackagesChanged(); } catch (e) { message(e.message); } });
      $("modelReviewLink").addEventListener("click", async () => { try { await navigator.clipboard.writeText(window.location.href); message("已複製驗收連結；開啟後須登入有資產權限的 Google 帳號。"); } catch (_) { message("驗收連結：" + window.location.href); } });
      state.tickFn = () => { state.tick = 0; if (!dialog.open) return; if (state.viewer) { const v = state.viewer; $("modelReviewScrub").value = v.duration ? v.currentTime / v.duration * 1000 : 0; $("modelReviewTime").textContent = (v.currentTime || 0).toFixed(2) + " / " + (v.duration || 0).toFixed(2) + " s"; } state.tick = requestAnimationFrame(state.tickFn); };
    });
  }
  return Object.freeze({selectRootManifest, selectModelFile, descriptorFor, packageFiles, exactBuffer, relative, orbitFor, open, onPackagesChanged, install});
});
