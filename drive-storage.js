// All asset paths are relative to the configured, private Drive project folder.
(function () {
  "use strict";
  const config = window.COSMI_DRIVE_CONFIG;
  const API = "https://www.googleapis.com/drive/v3/files";
  let accessToken = "", expiry = 0, expiryTimer, tokenClient, initialized = false;
  const folders = new Map();
  const $ = id => document.getElementById(id);
  function relative(path) {
    if (typeof path !== "string" || !path || path.includes("\\") || /[:?#\x00-\x1f]/.test(path)) throw new Error("請使用 Drive 專案內的相對路徑");
    const parts = path.split("/");
    if (parts.some(p => !p || p === "." || p === "..")) throw new Error("不允許空白或上層目錄路徑");
    return parts;
  }
  function lock(message) {
    accessToken = ""; expiry = 0; folders.clear(); clearTimeout(expiryTimer);
    $("driveApp").hidden = true;
    $("driveGate").hidden = false;
    $("driveGateStatus").textContent = message;
    // Clear private blobs and in-flight review data when an existing session ends.
    if (initialized) window.location.reload();
  }
  async function request(url, options = {}) {
    if (!accessToken || Date.now() >= expiry) { lock("登入已到期，請重新登入 Google"); throw new Error("請先登入 Google"); }
    const headers = new Headers(options.headers);
    headers.set("Authorization", "Bearer " + accessToken);
    const response = await fetch(url, { ...options, headers, cache: "no-store" });
    if (response.status === 401) lock("登入已到期，請重新登入 Google");
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error?.message || `Google Drive HTTP ${response.status}`);
    }
    return response;
  }
  const escapeQuery = s => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  async function list(parent, extra = "") {
    const files = []; let pageToken = "";
    do {
      const params = new URLSearchParams({
        q: `'${escapeQuery(parent)}' in parents and trashed = false${extra ? " and " + extra : ""}`,
        fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size)", pageSize: "1000"
      });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await (await request(`${API}?${params}`)).json();
      files.push(...data.files); pageToken = data.nextPageToken || "";
    } while (pageToken);
    return files;
  }
  async function folder(path) {
    if (!path) return config.rootId;
    const parts = relative(path); let parent = config.rootId, prefix = "";
    for (const part of parts) {
      prefix = prefix ? prefix + "/" + part : part;
      if (!folders.has(prefix)) {
        const matches = await list(parent, `name = '${escapeQuery(part)}' and mimeType = 'application/vnd.google-apps.folder'`);
        if (matches.length !== 1) throw new Error(`${prefix} 資料夾${matches.length ? "名稱重複" : "不存在"}`);
        folders.set(prefix, matches[0].id);
      }
      parent = folders.get(prefix);
    }
    return parent;
  }
  async function find(path) {
    const parts = relative(path), name = parts.pop(), parent = await folder(parts.join("/"));
    const matches = await list(parent, `name = '${escapeQuery(name)}'`);
    if (matches.length > 1) throw new Error(`${path} 名稱重複，請先在 Drive 整理`);
    return { file: matches[0], parent, name };
  }
  async function read(path) {
    const { file } = await find(path);
    if (!file) throw new Error(`${path} 不存在`);
    return (await request(`${API}/${encodeURIComponent(file.id)}?alt=media`)).blob();
  }
  async function write(path, blob) {
    const { file, parent, name } = await find(path);
    const metadata = file ? { name } : { name, parents: [parent] };
    const boundary = "cosmi_" + crypto.randomUUID();
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${blob.type || "application/octet-stream"}\r\n\r\n`, blob,
      `\r\n--${boundary}--`
    ]);
    const url = `https://www.googleapis.com/upload/drive/v3/files${file ? "/" + encodeURIComponent(file.id) : ""}?uploadType=multipart&fields=id,name,size`;
    return (await request(url, { method: file ? "PATCH" : "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body })).json();
  }
  let syncing;
  async function syncPackages() {
    if (syncing) return syncing;
    syncing = (async () => {
      const errors = []; let count = 0;
      $("driveStatus").textContent = "正在讀取 Drive 立繪與 3D 包…";
      for (const dir of ["image_backup", "image_in", "3D_out"]) {
        const files = await list(await folder(dir));
        for (const file of files.filter(f => /\.zip$/i.test(f.name))) {
          try {
            const blob = await (await request(`${API}/${encodeURIComponent(file.id)}?alt=media`)).blob();
            const pkg = await window.COSMI_FORGE.loadZipFile(new File([blob], file.name, { type: "application/zip" }));
            pkg.drivePath = dir + "/" + file.name;
            count++;
          } catch (e) { errors.push(`${file.name}: ${e.message}`); }
        }
      }
      window.COSMI_FORGE.refresh();
      $("driveStatus").textContent = `Drive 已載入 ${count} 包` + (errors.length ? `；${errors.length} 包失敗：${errors.join("；")}` : "");
      return count;
    })().finally(() => { syncing = null; });
    return syncing;
  }
  async function run(action) {
    try { return await action(); } catch (e) { $("driveStatus").textContent = e.message; }
  }
  async function authorize(response) {
    if (response.error || !response.access_token) {
      $("driveGateStatus").textContent = response.error_description || response.error || "Google 登入失敗"; return;
    }
    try {
      accessToken = response.access_token;
      expiry = Date.now() + Number(response.expires_in || 3600) * 1000;
      const root = await (await request(`${API}/${encodeURIComponent(config.rootId)}?fields=id,name,mimeType,trashed`)).json();
      if (root.trashed || root.mimeType !== "application/vnd.google-apps.folder") throw new Error("Drive 專案資料夾無法存取");
      // Access is decided by Google's Drive ACL, not an email check in JavaScript.
      expiryTimer = setTimeout(() => lock("登入已到期，請重新登入 Google"), Math.max(0, expiry - Date.now()));
      if (!initialized) { window.dispatchEvent(new Event("cosmi:authorized")); initialized = true; }
      $("driveGate").hidden = true; $("driveApp").hidden = false;
      await run(syncPackages);
    } catch (e) { lock(e.message); }
  }
  window.COSMI_DRIVE = Object.freeze({ relative, read, write, syncPackages,
    rootPath: config.rootPath,
    packageDir: type => /model|rig|anim/.test(type) ? "3D_out" : "image_in"
  });
  document.addEventListener("DOMContentLoaded", () => {
    $("driveSignIn").addEventListener("click", () => {
      if (!config.clientId) { $("driveGateStatus").textContent = "尚未設定 Google 登入，請設定 GOOGLE_OAUTH_CLIENT_ID 後部署。"; return; }
      if (!window.google?.accounts?.oauth2) { $("driveGateStatus").textContent = "Google 登入元件尚未載入，請稍後重試。"; return; }
      tokenClient ||= google.accounts.oauth2.initTokenClient({
        client_id: config.clientId, scope: "https://www.googleapis.com/auth/drive", callback: authorize,
        error_callback: e => { $("driveGateStatus").textContent = e.type === "popup_closed" ? "登入視窗已關閉" : "Google 登入視窗無法開啟"; }
      });
      tokenClient.requestAccessToken({ prompt: "select_account" });
    });
    $("driveSignOut").addEventListener("click", () => lock("已登出"));
    $("driveSync").addEventListener("click", () => run(syncPackages));
    $("driveSavePrompt").addEventListener("click", () => run(async () => {
      const { path, text } = window.COSMI_FORGE.currentPrompt();
      await write(path, new Blob([text], { type: "text/markdown" }));
      $("driveStatus").textContent = `已儲存 ${path}`;
    }));
    $("driveLoadPrompt").addEventListener("click", () => run(async () => {
      const path = $("drivePromptPath").value.trim();
      if (!path.startsWith("prompts/") || !path.endsWith(".prompt.md")) throw new Error("請輸入 prompts/<task_id>.prompt.md");
      const text = await (await read(path)).text();
      window.COSMI_FORGE.showPrompt(text);
      $("driveStatus").textContent = `已讀取 ${path}（文字預覽，可複製或下載）`;
    }));
    $("driveUploadPackage").addEventListener("click", () => run(async () => {
      const pkg = window.COSMI_FORGE.activePackage();
      if (!pkg?.rawFiles) throw new Error("請先在審查台載入成果包");
      const path = window.COSMI_DRIVE.packageDir(pkg.type) + "/" + pkg.id + ".zip";
      await write(path, window.COSMI_FORGE.packageBlob(pkg));
      pkg.drivePath = path;
      $("driveStatus").textContent = `已儲存 ${path}`;
    }));
    $("driveGateStatus").textContent = config.clientId ? "登入後可讀取你有權限的專案資產。" : "尚未設定 Google 登入，請設定 GOOGLE_OAUTH_CLIENT_ID 後部署。";
  });
})();
