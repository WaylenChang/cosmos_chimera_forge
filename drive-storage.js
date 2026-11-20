// Private Drive assets use directories; archives are import-only.
(function () {
  "use strict";
  const config = window.COSMI_DRIVE_CONFIG,
    API = "https://www.googleapis.com/drive/v3/files",
    MIME = "application/vnd.google-apps.folder";
  let accessToken = "",
    expiry = 0,
    expiryTimer,
    tokenClient,
    initialized = false,
    syncing,
    busy = false,
    accountNamespace = "",
    sessionGeneration = 0;
  // sessionStorage survives refreshes within the same browser tab, but not a closed session.
  // Never persist a full-Drive bearer token in localStorage or in a URL.
  const SESSION_KEY = "cosmi.drive.oauth.v1",
    SESSION_SKEW = 30000;
  function clearSavedSession() {
    try {
      window.sessionStorage?.removeItem(SESSION_KEY);
    } catch (_) {}
  }
  function saveSession() {
    try {
      window.sessionStorage?.setItem(
        SESSION_KEY,
        JSON.stringify({
          clientId: config.clientId,
          rootId: config.rootId,
          accessToken,
          expiry,
        }),
      );
    } catch (_) {}
  }
  function readSession() {
    try {
      const raw = window.sessionStorage?.getItem(SESSION_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (
        saved.clientId !== config.clientId ||
        saved.rootId !== config.rootId ||
        typeof saved.accessToken !== "string" ||
        !saved.accessToken ||
        !Number.isFinite(saved.expiry) ||
        saved.expiry <= Date.now() + SESSION_SKEW
      ) {
        clearSavedSession();
        return null;
      }
      return saved;
    } catch (_) {
      clearSavedSession();
      return null;
    }
  }
  const folders = new Map(),
    $ = (id) => document.getElementById(id);
  let pipelineIndexState = {
    settings: [],
    jobs: [],
    wikiCharacters: [],
    wikiCreatures: [],
    syncedAt: 0,
  };
  function pipelineRoot(input) {
    if (!input) return "creatures";
    if (typeof input === "object") {
      const drivePath = String(input.drivePath || "");
      const m = /^(characters|creatures|moves)\//.exec(drivePath);
      if (m) return m[1];
      const t = String(input.manifest?.task_type || input.type || input.task?.id || "");
      if (t === "move-vfx" || t === "move") return "moves";
      if (t.startsWith("character")) return "characters";
      if (t.startsWith("creature")) return "creatures";
      return pipelineRoot(
        input.manifest?.subject_id ||
          input.subjectId ||
          input.id ||
          input.taskId ||
          "",
      );
    }
    const s = String(input).trim();
    const pathMatch = /^(characters|creatures|moves)\//.exec(s);
    if (pathMatch) return pathMatch[1];
    if (
      s === "move" ||
      s === "moves" ||
      s === "move-vfx" ||
      /^(?:asset_)?(?:fx|vsl)[-_]/i.test(s)
    )
      return "moves";
    if (
      s === "character" ||
      s === "characters" ||
      s.startsWith("character-") ||
      /^(?:asset_)?chr[-_]/i.test(s)
    )
      return "characters";
    if (
      s === "creature" ||
      s === "creatures" ||
      s.startsWith("creature-") ||
      /^(?:asset_)?cr[-_]/i.test(s)
    )
      return "creatures";
    return "creatures";
  }
  const CREATURE_STAGES = Object.freeze(["juvenile", "adolescent", "adult", "overload"]);
  const STEP_ALIASES = Object.freeze({
    appearance: "00_appearance",
    "00_appearance": "00_appearance",
    parameters: "00_parameters",
    "00_parameters": "00_parameters",
    portrait: "01_portrait",
    "01_portrait": "01_portrait",
    portrait_3d: "01_portrait",
    vfx: "01b_vfx",
    move_vfx: "01b_vfx",
    "01_vfx": "01b_vfx",
    "01b_vfx": "01b_vfx",
    "01b_move_vfx": "01b_vfx",
    review_portrait: "02_review_portrait",
    "02_review_portrait": "02_review_portrait",
    colab: "03a_colab",
    "03a_colab": "03a_colab",
    colab_ai_blender: "03a_colab",
    blender: "03b_blender",
    "03b_blender": "03b_blender",
    ai_blender: "03b_blender",
    review_3d: "04_review_3d",
    "04_review_3d": "04_review_3d",
    wiki: "05_wiki",
    encyclopedia: "05_wiki",
    "05_wiki": "05_wiki",
    "05_encyclopedia": "05_wiki",
  });
  const ASSET_STEPS = new Set(["01_portrait", "01b_vfx", "03a_colab", "03b_blender"]);
  const RESERVED_CATEGORY_FOLDERS = new Set([
    "prompts",
    "00_settings",
    "01_portraits",
    "01_vfx",
    "02_3d",
    "03_completed",
    "wiki",
    "reviews",
    "backup",
  ]);
  function stepCode(stage) {
    const key = String(stage || "").trim();
    if (key === "legacy") throw Error("舊版 3D 管線僅供唯讀遷移，不允許新輸出");
    const code = STEP_ALIASES[key];
    if (!code) throw Error("未知管線階段：" + String(stage));
    return code;
  }
  function cleanSubjectId(kind, id) {
    const root = pipelineRoot(kind);
    let s = String(id || "").trim();
    if (!s) return "";
    if (root === "creatures") {
      const m = /^(.+)_(juvenile|adolescent|adult|overload)$/.exec(s);
      if (m) s = m[1];
    }
    return s;
  }
  function subjectDir(kind, id) {
    const root = pipelineRoot(kind);
    const clean = cleanSubjectId(root, id);
    return clean ? root + "/" + clean : root;
  }
  function assetStem({ kind, id, stage, step, version } = {}) {
    const root = pipelineRoot(kind || id);
    const clean = cleanSubjectId(root, id);
    if (!clean) throw Error("缺少主體 ID");
    const parts = [clean];
    if (root === "creatures") {
      const st = CREATURE_STAGES.includes(stage) ? stage : "adult";
      parts.push(st);
    }
    parts.push(stepCode(step));
    if (version !== undefined && version !== null && String(version).trim()) {
      parts.push(String(version).trim());
    }
    return parts.join("_");
  }
  function parseAssetFilename(name, kind) {
    const base = String(name || "").split("/").pop();
    const m = /^(.+?)(?:_(juvenile|adolescent|adult|overload))?_(00_appearance|00_parameters|01_portrait|01b_vfx|02_review_portrait|03a_colab|03b_blender|04_review_3d|05_wiki)(?:_(v\d+|\d{8}(?:[-_]\d{4})?))?(?:_([^.]+))?\.([^.]+)$/i.exec(
      base,
    );
    if (!m) return null;
    const rawId = m[1];
    const stage = kind === "creatures" ? m[2] || "" : "";
    const id = !kind || kind === "creatures" ? rawId : m[2] ? rawId + "_" + m[2] : rawId;
    const step = m[3];
    const version = m[4] || "";
    const role = m[5] || "";
    const ext = m[6];
    const stem = [id, stage, step, version].filter(Boolean).join("_");
    return { id, stage, step, version, role, ext, stem };
  }
  function isLevel3Deliverable(parsed) {
    if (!parsed) return false;
    if (parsed.step === "05_wiki") return true;
    if (parsed.step === "01_portrait" && /^main$/i.test(parsed.role)) return true;
    if (
      (parsed.step === "03a_colab" || parsed.step === "03b_blender") &&
      !parsed.role &&
      /^glb$/i.test(parsed.ext)
    )
      return true;
    return false;
  }
  function stepSubdir(step) {
    if (step === "00_appearance" || step === "00_parameters") return "00_settings";
    return step;
  }
  function assetSubpath(filename, kind) {
    const base = String(filename || "").split("/").pop();
    const parsed = parseAssetFilename(base, kind);
    if (!parsed || isLevel3Deliverable(parsed)) return base;
    const parts = [stepSubdir(parsed.step)];
    if (parsed.version) parts.push(parsed.version);
    parts.push(base);
    return parts.join("/");
  }
  // One canonical directory resolver for all category-specific pipeline outputs.
  // Level 1: characters / creatures / moves; Level 2: <id>; Level 3: flat files.
  function pipelineDirectory(kind, stage, id) {
    const root = pipelineRoot(kind);
    const code = stepCode(stage);
    if (root === "moves" && code !== "01b_vfx" && code !== "00_appearance" && code !== "00_parameters" && code !== "04_review_3d" && code !== "05_wiki") {
      throw Error("主動技僅支援 VFX 資產管線");
    }
    return id ? subjectDir(root, id) : root;
  }
  function packageDir(type, subjectOrId, stage) {
    const root = pipelineRoot(subjectOrId ? { type, id: subjectOrId } : type);
    if (root === "moves") pipelineDirectory(root, "vfx");
    else if (/model|rig|anim/.test(type)) pipelineDirectory(root, stage || "blender");
    else pipelineDirectory(root, "portrait");
    const rawId = String(subjectOrId || "").trim();
    if (!rawId || /^(?:characters?|creatures?|moves?)$/i.test(rawId)) return root;
    return subjectDir(root, rawId);
  }
  function recordPipelineWrite(path, result) {
    const clean = String(path || "").replace(/^\/+/, "");
    const name = clean.split("/").pop();
    const item = {
      id: result?.id || "",
      name,
      modifiedTime: new Date().toISOString(),
    };
    const upsert = (arr) => {
      if (!item.name) return arr;
      const next = arr.filter((x) => x.name !== item.name);
      next.push(item);
      return next;
    };
    const parsed = parseAssetFilename(name, pipelineRoot(clean));
    if (
      parsed?.step === "00_appearance" ||
      parsed?.step === "00_parameters" ||
      /^(?:(?:characters|creatures|moves)\/)?00_settings\//.test(clean)
    )
      pipelineIndexState.settings = upsert(pipelineIndexState.settings);
    else if (
      /_(?:prompt|job)\.md$/i.test(name) ||
      /^(?:(?:characters|creatures|moves)\/)?prompts\/jobs\//.test(clean)
    )
      pipelineIndexState.jobs = upsert(pipelineIndexState.jobs);
    else if (
      (clean.startsWith("characters/") && parsed?.step === "05_wiki") ||
      /^(?:characters\/wiki|wiki\/characters)\//.test(clean)
    )
      pipelineIndexState.wikiCharacters = upsert(
        pipelineIndexState.wikiCharacters,
      );
    else if (
      (clean.startsWith("creatures/") && parsed?.step === "05_wiki") ||
      /^(?:creatures\/wiki|wiki\/creatures)\//.test(clean)
    )
      pipelineIndexState.wikiCreatures = upsert(
        pipelineIndexState.wikiCreatures,
      );
  }
  function limitConcurrent(max) {
    let running = 0;
    const waiting = [];
    function resolvePriority(entry) {
      return typeof entry.priority === "function"
        ? Number(entry.priority()) || 0
        : Number(entry.priority) || 0;
    }
    function takeNext() {
      let bestIdx = 0;
      let bestPriority = resolvePriority(waiting[0]);
      for (let i = 1; i < waiting.length; i++) {
        const p = resolvePriority(waiting[i]);
        if (p > bestPriority) {
          bestPriority = p;
          bestIdx = i;
        }
      }
      return waiting.splice(bestIdx, 1)[0];
    }
    function drain() {
      while (running < max && waiting.length) {
        const item = takeNext();
        running++;
        Promise.resolve()
          .then(item.task)
          .then(item.resolve, item.reject)
          .finally(() => {
            running--;
            drain();
          });
      }
    }
    const enqueue = (task, priority = 0) =>
      new Promise((resolve, reject) => {
        waiting.push({ task, resolve, reject, priority });
        drain();
      });
    enqueue.drain = drain;
    return enqueue;
  }
  const driveDownload = limitConcurrent(6);
  let explicitPriorityTargets = null;
  function normalizePriorityTargets(targets) {
    if (!targets || typeof targets !== "object") return null;
    const ids = Array.isArray(targets.ids)
      ? [
          ...new Set(
            targets.ids.flatMap((v) => {
              const s = String(v || "").trim().toLowerCase();
              if (!s) return [];
              const stripped = s.replace(/^(?:creature|character|move):/, "");
              return stripped && stripped !== s ? [s, stripped] : [s];
            }),
          ),
        ]
      : [];
    const folderIds = Array.isArray(targets.folderIds)
      ? targets.folderIds.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    const paths = Array.isArray(targets.paths)
      ? targets.paths
          .map((v) => String(v || "").trim().toLowerCase())
          .filter(Boolean)
      : [];
    if (!ids.length && !folderIds.length && !paths.length) return null;
    return { ids, folderIds, paths };
  }
  function getPriorityTargets() {
    const fromForge = window.COSMI_FORGE?.priorityDriveTargets?.();
    return normalizePriorityTargets(fromForge) || explicitPriorityTargets;
  }
  function isPriorityEntry(dir, entry, targets = getPriorityTargets()) {
    if (!targets || !entry) return false;
    if (targets.folderIds.includes(String(entry.id || ""))) return true;
    const folderPath = (dir + "/" + entry.name).toLowerCase();
    if (targets.paths.includes(folderPath)) return true;
    const entryName = String(entry.name || "").toLowerCase();
    if (!entryName) return false;
    for (const id of targets.ids) {
      if (id === entryName) return true;
      if (id.startsWith(entryName + "_") || id.startsWith(entryName + "-"))
        return true;
    }
    return false;
  }
  function prioritize(targets) {
    if (targets !== undefined) {
      explicitPriorityTargets = normalizePriorityTargets(targets);
    }
    driveDownload.drain();
  }
  const categoryRoots = ["characters", "creatures", "moves"];
  const legacyCategoryDirs = [
    "characters/01_portraits",
    "characters/02_3d/colab",
    "characters/02_3d/ai_blender",
    "characters/02_3d/legacy",
    "characters/03_completed/portraits",
    "characters/03_completed/models",
    "creatures/01_portraits",
    "creatures/02_3d/colab",
    "creatures/02_3d/ai_blender",
    "creatures/02_3d/legacy",
    "creatures/03_completed/portraits",
    "creatures/03_completed/models",
    "moves/01_vfx",
    "moves/03_completed",
  ];
  const categoryDirs = legacyCategoryDirs; // Retained for legacy manifest migration only.
  const legacyDirs = [
    "01_portraits",
    "02_3d/colab",
    "02_3d/ai_blender",
    "02_3d/legacy",
    "03_completed/portraits",
    "03_completed/models",
  ];
  const dirs = categoryRoots; // Active Drive scans use Level 1 category roots -> Level 2 <id> -> flat Level 3 files.
  function relative(path) {
    if (
      typeof path !== "string" ||
      !path ||
      path.includes("\\") ||
      /[:?#\x00-\x1f]/.test(path)
    )
      throw Error("請使用 Drive 專案內的相對路徑");
    const parts = path.split("/");
    if (parts.some((p) => !p || p === "." || p === ".."))
      throw Error("不允許空白或上層目錄路徑");
    return parts;
  }
  function lock(message) {
    const previousNamespace = accountNamespace;
    sessionGeneration++;
    accessToken = "";
    expiry = 0;
    accountNamespace = "";
    folders.clear();
    clearTimeout(expiryTimer);
    clearSavedSession();
    // Invalidate the private cache on any logout, expiry or permission failure.
    void window.COSMI_DRIVE_CACHE?.clear(previousNamespace);
    $("driveApp").hidden = true;
    $("driveGate").hidden = false;
    $("driveGateStatus").textContent = message;
    if (initialized) window.location.reload();
  }
  async function request(url, options = {}) {
    if (!accessToken || Date.now() >= expiry) {
      lock("登入已到期，請重新登入 Google");
      throw Error("請先登入 Google");
    }
    const headers = new Headers(options.headers);
    headers.set("Authorization", "Bearer " + accessToken);
    const r = await fetch(url, { ...options, headers, cache: "no-store" });
    if (r.status === 401) lock("登入已到期，請重新登入 Google");
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw Error(d.error?.message || "Google Drive HTTP " + r.status);
    }
    return r;
  }
  const escapeQuery = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  async function list(parent, extra = "") {
    const files = [];
    let pageToken = "";
    do {
      const p = new URLSearchParams({
        q:
          "'" +
          escapeQuery(parent) +
          "' in parents and trashed = false" +
          (extra ? " and " + extra : ""),
        fields:
          "nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)",
        pageSize: "1000",
      });
      if (pageToken) p.set("pageToken", pageToken);
      const d = await (await request(API + "?" + p)).json();
      files.push(...d.files);
      pageToken = d.nextPageToken || "";
    } while (pageToken);
    return files;
  }
  async function folder(path, create = false) {
    if (!path) return config.rootId;
    let parent = config.rootId,
      prefix = "";
    for (const part of relative(path)) {
      prefix = prefix ? prefix + "/" + part : part;
      if (!folders.has(prefix)) {
        let m = await list(
          parent,
          "name = '" + escapeQuery(part) + "' and mimeType = '" + MIME + "'",
        );
        if (!m.length && create)
          m = [
            await (
              await request(API + "?fields=id,name", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: part,
                  mimeType: MIME,
                  parents: [parent],
                }),
              })
            ).json(),
          ];
        if (m.length !== 1)
          throw Error(prefix + " 資料夾" + (m.length ? "名稱重複" : "不存在"));
        folders.set(prefix, m[0].id);
      }
      parent = folders.get(prefix);
    }
    return parent;
  }
  const fileModifiedMs = (file) => {
    const ms = Date.parse(file?.modifiedTime || "");
    return Number.isFinite(ms) ? ms : -Infinity;
  };
  function pickLatestFile(files) {
    if (!files?.length) return undefined;
    let best = files[0],
      bestMs = fileModifiedMs(best);
    for (let i = 1; i < files.length; i++) {
      const candidateMs = fileModifiedMs(files[i]);
      if (candidateMs > bestMs) {
        best = files[i];
        bestMs = candidateMs;
      }
    }
    return best;
  }
  async function find(path, create = false, { pickLatest = false } = {}) {
    const parts = relative(path),
      name = parts.pop(),
      parent = await folder(parts.join("/"), create),
      m = await list(parent, "name = '" + escapeQuery(name) + "'");
    if (m.length > 1) {
      if (!pickLatest) throw Error(path + " 名稱重複，請先在 Drive 整理");
      return { file: pickLatestFile(m), parent, name };
    }
    return { file: m[0], parent, name };
  }
  async function read(path) {
    const { file } = await find(path, false, { pickLatest: true });
    if (!file) throw Error(path + " 不存在");
    return driveDownload(
      async () => (await request(API + "/" + file.id + "?alt=media")).blob(),
      100,
    );
  }
  async function readById(id) {
    if (!id) throw Error("缺少 Drive 檔案 ID");
    return driveDownload(
      async () =>
        (await request(API + "/" + encodeURIComponent(id) + "?alt=media")).blob(),
      100,
    );
  }
  async function write(path, blob) {
    const { file, parent, name } = await find(path, true),
      boundary = "cosmi_" + crypto.randomUUID();
    const body = new Blob([
      "--" +
        boundary +
        "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(file ? { name } : { name, parents: [parent] }) +
        "\r\n",
      "--" +
        boundary +
        "\r\nContent-Type: " +
        (blob.type || "application/octet-stream") +
        "\r\n\r\n",
      blob,
      "\r\n--" + boundary + "--",
    ]);
    const result = await (
      await request(
        "https://www.googleapis.com/upload/drive/v3/files" +
          (file ? "/" + file.id : "") +
          "?uploadType=multipart&fields=id,name,size",
        {
          method: file ? "PATCH" : "POST",
          headers: {
            "Content-Type": "multipart/related; boundary=" + boundary,
          },
          body,
        },
      )
    ).json();
    // A write may change asset metadata or references: never serve a stale package afterward.
    void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
    recordPipelineWrite(path, result);
    return result;
  }
  const jsonWrite = (path, data) =>
    write(
      path,
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
  async function walk(id, prefix = "", depth = 0) {
    if (depth > 12) throw Error("資產目錄超過 12 層");
    const folderNames = new Set(),
      filesByName = new Map(),
      subfolders = [];
    for (const f of await list(id)) {
      if (f.mimeType === MIME) {
        if (folderNames.has(f.name)) throw Error(prefix + f.name + " 名稱重複");
        folderNames.add(f.name);
        subfolders.push(walk(f.id, prefix + f.name + "/", depth + 1));
      } else {
        if (/\.zip$/i.test(f.name)) continue;
        const prev = filesByName.get(f.name);
        if (!prev || fileModifiedMs(f) > fileModifiedMs(prev))
          filesByName.set(f.name, { ...f, path: prefix + f.name, parentId: id });
      }
    }
    const result = [...filesByName.values()];
    for (const children of await Promise.all(subfolders))
      result.push(...children);
    return result;
  }
  async function record(id, reviewIndex, hint) {
    let file = reviewIndex ? reviewIndex.get(id + ".json") : null;
    if (!file && !reviewIndex) {
      const root = pipelineRoot(hint || id);
      file =
        (await find(root + "/reviews/" + id + ".json", false, { pickLatest: true })).file;
    }
    return file
      ? JSON.parse(
          await (await request(API + "/" + file.id + "?alt=media")).text(),
        )
      : null;
  }
  async function syncPackages({ force = false } = {}) {
    if (syncing) return syncing;
    if (busy) throw Error("審查寫入中，請稍後重新載入");
    syncing = (async () => {
      const generation = sessionGeneration,
        ns = accountNamespace,
        cache = window.COSMI_DRIVE_CACHE;
      const options = cache?.preferences();
      const errors = [];
      let count = 0,
        finished = 0;
      const ids = new Set();
      const cachedRecords =
        !force && options?.cacheEnabled && ns
          ? await cache.getPackages(ns)
          : [];
      const prior = new Map(
        cachedRecords.map((record) => [record.entry.id, record]),
      );
      const checkSession = () => {
        if (generation !== sessionGeneration)
          throw Error("Google 工作階段已變更");
      };
      const importSinglePackage = async (dir, entry, files, raw, reviewRecord, pkgNameOverride = null) => {
        checkSession();
        const pkg = await window.COSMI_FORGE.loadAssetFiles(
          raw,
          { name: pkgNameOverride || entry.name },
          { silent: true },
        );
        checkSession();
        if (ids.has(pkg.id)) throw Error(pkg.id + " 在多個目錄重複");
        ids.add(pkg.id);
        if (!pkg.subjectId && /^(?:characters|creatures|moves)$/.test(dir)) pkg.subjectId = entry.name;
        pkg.drivePath = dir + "/" + entry.name;
        pkg.driveFolderId = entry.id;
        pkg.driveFiles = files;
        const glb =
          window.COSMI_MODEL_REVIEW?.selectModelFile(
            files,
            pkg.manifest || {},
            window.COSMI_MODEL_REVIEW.descriptorFor(pkg),
          ) ||
          files.find((f) => /^models\/.*\.glb$/i.test(f.path)) ||
          files.find((f) => /\.glb$/i.test(f.path));
        if (glb && !pkg.glbFile)
          pkg.glbFile = { path: glb.path, id: glb.id, modifiedTime: glb.modifiedTime || "", deferred: true };
        if (!reviewRecord && pkg.glbFile && pkg.status === "missing")
          pkg.status = "provisional";
        if (reviewRecord) {
          pkg.status = reviewRecord.status;
          pkg.sourcePack = reviewRecord.source_pack;
          pkg.reviewRecord = reviewRecord;
          if (reviewRecord.status === "ok") pkg.completed = true;
        }
        if (/(?:^|\/)03_completed(?:\/|$)/.test(dir)) pkg.completed = true;
        window.COSMI_MODEL_REVIEW?.onPackagesChanged();
        return pkg;
      };
      const importPackage = async (dir, entry, files, raw, fallbackReviewRecord) => {
        const kind = pipelineRoot(dir);
        const grouped = new Map();
        const inlineReviews = new Map();
        for (const f of files) {
          const parsed = parseAssetFilename(f.path, kind);
          if (!parsed) continue;
          if (parsed.step === "02_review_portrait" || parsed.step === "04_review_3d") {
            const rawKey = entry.name + "/" + f.path;
            if (raw[rawKey]) {
              try {
                const parsedReview = JSON.parse(new TextDecoder().decode(raw[rawKey]));
                const targetStep = parsed.step === "02_review_portrait" ? "01_portrait" : null;
                const keyPrefix = [parsed.id, parsed.stage].filter(Boolean).join("_");
                if (parsedReview?.task_id) inlineReviews.set(parsedReview.task_id, parsedReview);
                if (targetStep) {
                  inlineReviews.set([keyPrefix, targetStep, parsed.version].filter(Boolean).join("_"), parsedReview);
                } else {
                  for (const s3d of ["03a_colab", "03b_blender", "01b_vfx"]) {
                    inlineReviews.set([keyPrefix, s3d, parsed.version].filter(Boolean).join("_"), parsedReview);
                  }
                }
              } catch (_) {}
            }
            continue;
          }
          if (!ASSET_STEPS.has(parsed.step)) continue;
          if (!grouped.has(parsed.stem)) grouped.set(parsed.stem, []);
          grouped.get(parsed.stem).push(f);
        }
        if (!grouped.size) {
          const hasLegacyAsset = files.some((f) => /(?:^|\/)(?:manifest|concept)\.json$/i.test(f.path) || /\.glb$/i.test(f.path));
          if (!hasLegacyAsset) return [];
          return [await importSinglePackage(dir, entry, files, raw, fallbackReviewRecord)];
        }
        const imported = [];
        for (const [stem, groupFiles] of grouped) {
          const subRaw = {};
          for (const gf of groupFiles) {
            const k = entry.name + "/" + gf.path;
            const leaf = gf.name || gf.path.split("/").pop();
            if (raw[k]) subRaw[stem + "/" + leaf] = raw[k];
          }
          if (!Object.keys(subRaw).length) continue;
          const rev = inlineReviews.get(stem) || fallbackReviewRecord || null;
          imported.push(await importSinglePackage(dir, entry, groupFiles, subRaw, rev, stem));
        }
        return imported;
      };
      const status = (message) => {
        $("driveStatus").textContent = message;
      };
      status(
        cachedRecords.length ? "正在顯示本機快取…" : "正在取得 Drive 資產清單…",
      );
      if (cachedRecords.length) {
        window.COSMI_FORGE.clearDrivePackages?.();
        for (const item of cachedRecords) {
          try {
            await importPackage(
              item.dir,
              item.entry,
              item.files,
              item.raw,
              item.reviewRecord || null,
            );
          } catch (e) {
            errors.push("快取 " + item.entry.name + ": " + e.message);
            await cache.removePackage(ns, item.entry.id);
          }
        }
        window.COSMI_FORGE.refresh();
        status("已從快取顯示 " + ids.size + " 個資產，正在確認雲端更新…");
      }
      const reviewIndexPromise = (async () => {
        const merged = new Map();
        for (const revDir of [
          "characters/reviews",
          "creatures/reviews",
          "moves/reviews",
        ]) {
          try {
            const reviewFiles = await list(await folder(revDir));
            for (const f of reviewFiles) {
              if (!f.name.endsWith(".json")) continue;
              const prev = merged.get(f.name);
              if (!prev || fileModifiedMs(f) > fileModifiedMs(prev))
                merged.set(f.name, f);
            }
          } catch (e) {
            if (!/不存在/.test(e.message))
              errors.push(revDir + ": " + e.message);
          }
        }
        return merged;
      })();
      const groups = await Promise.all(
        dirs.map(async (dir) => {
          try {
            const entries = await list(await folder(dir));
            return entries
              .filter(
                (f) =>
                  f.mimeType === MIME &&
                  !f.name.startsWith("_") &&
                  !RESERVED_CATEGORY_FOLDERS.has(f.name),
              )
              .map((entry) => ({ dir, entry }));
          } catch (e) {
            if (!/不存在/.test(e.message)) errors.push(dir + ": " + e.message);
            return [];
          }
        }),
      );
      checkSession();
      const entries = groups.flat(),
        reviewIndex = await reviewIndexPromise;
      const currentFolders = new Set(entries.map((item) => item.entry.id));
      if (!cachedRecords.length && window.COSMI_FORGE.clearDrivePackages && window.COSMI_FORGE.packages && window.COSMI_FORGE.removePackage) {
        for (const p of window.COSMI_FORGE.packages()) {
          if (p.driveFolderId && !currentFolders.has(p.driveFolderId)) {
            window.COSMI_FORGE.removePackage(p.id);
          }
        }
      }
      // Folder removals are not safely observable from local cache; remove any missing folder.
      for (const item of cachedRecords.filter(
        (record) => !currentFolders.has(record.entry.id),
      )) {
        await cache.removePackage(ns, item.entry.id);
      }
      if (
        cachedRecords.some((record) => !currentFolders.has(record.entry.id))
      ) {
        window.COSMI_FORGE.clearDrivePackages?.();
        ids.clear();
        for (const item of cachedRecords.filter((record) =>
          currentFolders.has(record.entry.id),
        )) {
          try {
            await importPackage(
              item.dir,
              item.entry,
              item.files,
              item.raw,
              item.reviewRecord || null,
            );
          } catch (e) {
            errors.push("快取 " + item.entry.name + ": " + e.message);
          }
        }
        window.COSMI_FORGE.refresh();
      }
      const pendingEntries = entries.slice();
      const takeNextEntry = () => {
        if (!pendingEntries.length) return null;
        const targets = getPriorityTargets();
        if (targets) {
          const idx = pendingEntries.findIndex(({ dir, entry }) =>
            isPriorityEntry(dir, entry, targets),
          );
          if (idx !== -1) return pendingEntries.splice(idx, 1)[0];
        }
        return pendingEntries.shift();
      };
      const download = (task, priority = 0) => driveDownload(task, priority);
      const workers = Array.from(
        { length: Math.min(3, entries.length) },
        async () => {
          for (let item = takeNextEntry(); item; item = takeNextEntry()) {
            const { dir, entry } = item;
            const entryPriority = () =>
              isPriorityEntry(dir, entry) ? 10 : 0;
            try {
              checkSession();
              const files = await walk(entry.id),
                raw = {};
              const old = prior.get(entry.id);
              const fingerprint = (items) =>
                JSON.stringify(
                  items
                    .map((f) => [
                      f.id,
                      f.path,
                      f.modifiedTime || "",
                      f.size || "",
                    ])
                    .sort((a, b) => a[1].localeCompare(b[1])),
                );
              const reuse =
                !!old && fingerprint(old.files) === fingerprint(files);
              if (reuse) {
                // Refresh the review record even for a cached asset, since it can change independently.
                const r = await download(
                  () => record(old.pkgId || entry.name, reviewIndex),
                  entryPriority,
                );
                if (ids.has(old.pkgId || entry.name)) {
                  const matched = window.COSMI_FORGE.packages().filter(
                    (p) => p.driveFolderId === entry.id,
                  );
                  if (matched.length) {
                    for (const pkg of matched) {
                      pkg.driveFiles = files;
                      if (r) {
                        pkg.status = r.status || pkg.status;
                        pkg.sourcePack = r.source_pack || pkg.sourcePack;
                        pkg.reviewRecord = r;
                      }
                    }
                    count += matched.length;
                    if (isPriorityEntry(dir, entry))
                      window.COSMI_FORGE.refresh();
                    continue;
                  }
                }
                await importPackage(dir, entry, files, old.raw, r);
                count++;
                if (isPriorityEntry(dir, entry)) window.COSMI_FORGE.refresh();
                continue;
              }
              const needed = files.filter(
                (f) =>
                  /\.(json|md|png|jpe?g|webp)$/i.test(f.name) &&
                  !f.mimeType.startsWith("application/vnd.google-apps."),
              );
              await Promise.all(
                needed.map((f) =>
                  download(async () => {
                    raw[entry.name + "/" + f.path] = new Uint8Array(
                      await (
                        await request(API + "/" + f.id + "?alt=media")
                      ).arrayBuffer(),
                    );
                  }, entryPriority),
                ),
              );
              if (!Object.keys(raw).length) continue;
              // Avoid rendering the whole review desk for every downloaded file/package.
              const r = await download(
                () => record(entry.name, reviewIndex),
                entryPriority,
              );
              const imported = await importPackage(dir, entry, files, raw, r);
              if (ns && generation === sessionGeneration && imported.length)
                await cache?.putPackage(ns, {
                  dir,
                  entry,
                  files,
                  raw,
                  reviewRecord: r,
                  pkgId: imported[0]?.id || entry.name,
                });
              count += imported.length;
              if (isPriorityEntry(dir, entry) || count % 5 === 0)
                window.COSMI_FORGE.refresh();
            } catch (e) {
              if (generation !== sessionGeneration) throw e;
              errors.push(entry.name + ": " + e.message);
            } finally {
              finished++;
              status(
                "Drive 正在載入 " +
                  finished +
                  "/" +
                  entries.length +
                  " 個資產目錄（成功 " +
                  count +
                  "）",
              );
            }
          }
        },
      );
      await Promise.all(workers);
      checkSession();
      window.COSMI_FORGE.refresh();
      const errorText = errors.length
        ? "；" +
          errors.slice(0, 3).join("；") +
          (errors.length > 3 ? "；另有 " + (errors.length - 3) + " 項錯誤" : "")
        : "";
      status(
        "Drive 已載入 " +
          count +
          " 個資產目錄" +
          (cachedRecords.length ? "（已使用快取）" : "") +
          errorText,
      );
      window.COSMI_MODEL_REVIEW?.onPackagesChanged();
      return count;
    })().finally(() => {
      syncing = null;
    });
    return syncing;
  }
  const modelType = (p) => /model|rig|anim/.test(p.type);
  async function metadata(id) {
    return (
      await request(
        API +
          "/" +
          encodeURIComponent(id) +
          "?fields=id,name,mimeType,parents,trashed",
      )
    ).json();
  }
  async function move(id, from, to) {
    const m = await metadata(id);
    if (m.trashed || !m.parents?.includes(from))
      throw Error("來源已移動，請重新載入 Drive");
    const p = new URLSearchParams({
      addParents: to,
      removeParents: from,
      fields: "id,name,parents",
    });
    const r = await (
      await request(API + "/" + encodeURIComponent(id) + "?" + p, {
        method: "PATCH",
      })
    ).json();
    void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
    if (!r.parents?.includes(to) || r.parents?.includes(from))
      throw Error("Drive 移動結果未確認");
    folders.clear();
    return r;
  }
  function reviewPathFor(pkg) {
    const isModel = modelType(pkg),
      root = pipelineRoot(pkg),
      revStep = isModel || root === "moves" ? "04_review_3d" : "02_review_portrait";
    const parsed = parseAssetFilename(String(pkg.id || "") + ".json", root);
    const id = parsed?.id || cleanSubjectId(root, pkg.subjectId || pkg.baseId || pkg.id);
    const stage = parsed?.stage || pkg.stage || pkg.manifest?.stage || "";
    const version = parsed?.version || pkg.manifest?.version || "";
    const stem = assetStem({ kind: root, id, stage, step: revStep, version });
    const dir =
      pkg.drivePath && new RegExp("^" + root + "/[^/]+$").test(pkg.drivePath)
        ? pkg.drivePath
        : subjectDir(root, id);
    return dir + "/" + assetSubpath(stem + ".json", root);
  }
  async function review(pkg, status, note = "") {
    if (!pkg?.driveFolderId) throw Error("請先將資產資料夾儲存至 Drive");
    if (syncing || busy) throw Error("Drive 處理中，請稍後重試");
    if (!["ok", "provisional", "pending", "reject"].includes(status))
      throw Error("無效審查狀態");
    if (pkg.completed) throw Error("資產已完成，請建立新版本後審查");
    busy = true;
    try {
      const isModel = modelType(pkg),
        root = pipelineRoot(pkg),
        sourceId = pkg.sourcePack || pkg.manifest?.source_pack || "",
        ops = [];
      const r = {
        task_id: pkg.id,
        status,
        source_pack: sourceId,
        note,
        time: new Date().toISOString(),
      };
      if (status === "ok" && !isModel && !pkg.images?.length)
        throw Error("立繪必須具有可預覽影像");
      let src = null;
      if (status === "reject") {
        const dir =
          root +
          "/backup/" +
          (root === "moves"
            ? "rejected_vfx"
            : isModel
              ? "rejected_3d"
              : "rejected_portraits") +
          "/" +
          pkg.id +
          "_" +
          Date.now();
        const isSubjectFlat = new RegExp("^" + root + "/[^/]+$").test(pkg.drivePath || "");
        if (isSubjectFlat) {
          const fromId = pkg.driveFolderId || (await folder(pkg.drivePath));
          const fileIds = (pkg.driveFiles || []).filter((f) => f.id);
          if (fileIds.length) {
            const toId = await folder(dir, true);
            for (const f of fileIds) {
              ops.push({ fileId: f.id, from: f.parentId || fromId, to: toId, path: dir + "/" + (f.name || f.path.split("/").pop()) });
            }
          }
          r.drive_path = dir;
        } else {
          ops.push({
            pkg,
            fileId: pkg.driveFolderId,
            from: await folder(pkg.drivePath.split("/").slice(0, -1).join("/")),
            to: await folder(dir, true),
            path: dir + "/" + pkg.drivePath.split("/").pop(),
          });
        }
      } else if (status === "ok" && isModel) {
        src = window.COSMI_FORGE.packages().find((p) => p.id === sourceId) || null;
        const isImage3d =
          Boolean(sourceId) ||
          pkg.drivePath?.includes("/02_3d/colab/") ||
          pkg.id?.includes("_03a_colab") ||
          pkg.manifest?.pipeline === "colab" ||
          pkg.manifest?.input_mode === "image" ||
          Boolean(pkg.manifest?.input_img);
        if (
          isImage3d &&
          (!src ||
            modelType(src) ||
            src.status !== "ok" ||
            !src.images?.length ||
            !src.driveFolderId)
        )
          throw Error("請先綁定已核准的來源立繪");
        if (pkg.glbLoadError) throw Error("GLB 載入失敗，修復後才能完成");
        if (
          !pkg.glbFile ||
          !pkg.driveFiles.some((f) => f.path.toLowerCase().endsWith(".blend"))
        )
          throw Error("3D 需同時具有可預覽 GLB 與 .blend 原檔");
        if (
          src &&
          pkg.stage &&
          src.stage &&
          pkg.stage !== src.stage &&
          !src.images.some((im) => im.path.includes(pkg.stage))
        )
          throw Error("來源立繪與模型型態不符");
      }
      const done = [];
      try {
        for (const op of ops) {
          await move(op.fileId, op.from, op.to);
          done.push(op);
        }
        r.drive_path = r.drive_path || ops.find((o) => o.pkg === pkg)?.path || pkg.drivePath;
        await jsonWrite(reviewPathFor(pkg), r);
      } catch (e) {
        const failures = [];
        for (const op of done.reverse()) {
          try {
            await move(op.fileId, op.to, op.from);
          } catch (err) {
            failures.push(err.message);
          }
        }
        if (failures.length)
          throw Error(
            e.message + "；回復未完成，請重新載入核對：" + failures.join("；"),
          );
        throw e;
      }
      if (status === "reject") {
        pkg.drivePath = r.drive_path;
      } else if (status === "ok") {
        pkg.completed = true;
        if (src && !src.completed) src.completed = true;
      }
      pkg.status = status;
      pkg.reviewRecord = r;
      window.COSMI_FORGE.persistReview?.(pkg, note);
      if (status === "reject") window.COSMI_FORGE.removePackage?.(pkg.id);
      window.COSMI_FORGE.refresh();
      $("driveStatus").textContent =
        status === "reject"
          ? "已退回重建並移至 " + pkg.drivePath
          : status === "ok"
            ? "已核准並保留於 " + pkg.drivePath
            : status === "provisional"
              ? "已標記暫時採用；資產留在原位"
              : "已標記待決定；資產留在原位";
      return r;
    } finally {
      busy = false;
    }
  }
  async function saveNote(pkg, note) {
    if (!pkg?.driveFolderId) throw Error("請先將資產儲存至 Drive");
    if (syncing || busy) throw Error("Drive 處理中，請稍後重試");
    busy = true;
    try {
      const r = {
        ...pkg.reviewRecord,
        task_id: pkg.id,
        status: pkg.status,
        source_pack: pkg.sourcePack || pkg.manifest?.source_pack || "",
        drive_path: pkg.drivePath,
        note,
        time: new Date().toISOString(),
      };
      await jsonWrite(reviewPathFor(pkg), r);
      pkg.reviewRecord = r;
      window.COSMI_FORGE.persistReview?.(pkg, note);
      return r;
    } finally {
      busy = false;
    }
  }
  async function uploadAsset(pkg) {
    if (!pkg?.rawFiles) throw Error("請先載入資產資料夾");
    if (pkg.driveFolderId) return pkg.drivePath;
    const type = pkg.manifest?.task_type || pkg.type || "";
    const subjectId = pkg.manifest?.subject_id || pkg.subjectId || pkg.id;
    const root = pipelineRoot({ type, id: subjectId });
    const stage = pkg.stage || pkg.manifest?.stage || (root === "creatures" ? "adult" : "");
    const step =
      root === "moves"
        ? "01b_vfx"
        : /model|rig|anim/.test(type)
          ? stepCode($("pipelineStage")?.value === "colab" || pkg.manifest?.pipeline === "colab" ? "03a_colab" : "03b_blender")
          : "01_portrait";
    const version = pkg.manifest?.version || "";
    const stem = assetStem({ kind: root, id: subjectId, stage, step, version });
    const path = packageDir(type, subjectId, $("pipelineStage")?.value);
    const keys = Object.keys(pkg.rawFiles),
      rooted = keys.every((k) => k.startsWith(pkg.id + "/"));
    const targetNames = [];
    for (const key of keys) {
      const rel = rooted ? key.slice(pkg.id.length + 1) : key;
      relative(rel);
      if (/\.zip$/i.test(rel)) throw Error("正式目錄不接受 ZIP");
      let flatName;
      if (parseAssetFilename(rel.split("/").pop(), root)) {
        flatName = rel.split("/").pop();
      } else if (/\.(glb|blend)$/i.test(rel)) {
        const ext = rel.split(".").pop().toLowerCase();
        flatName = stem + "." + ext;
      } else {
        const cleaned = rel
          .replace(/^(?:images|models|previews|animations|rig|vfx|storyboard|layers|flipbook|source)\//i, "")
          .replace(/\//g, "_");
        flatName = stem + "_" + cleaned;
      }
      targetNames.push({ key, flatName });
    }
    const manifestSubpath = assetSubpath(stem + "_manifest.json", root);
    const existing = await find(path + "/" + manifestSubpath);
    const existingFlat = existing.file ? existing : await find(path + "/" + stem + "_manifest.json");
    if (existingFlat.file)
      throw Error("已有同名資產，請使用新版本（如 v2）或重新載入");
    const id = await folder(path, true);
    for (const { key, flatName } of targetNames) {
      await write(path + "/" + assetSubpath(flatName, root), new Blob([pkg.rawFiles[key]]));
    }
    pkg.drivePath = path;
    pkg.driveFolderId = id;
    pkg.driveFiles = await walk(id);
    return path;
  }

  const wikiInFlight = new Map();
  function ensureWiki(ctx) {
    const wiki = window.COSMI_WIKI.describe(ctx);
    if (wikiInFlight.has(wiki.path)) return wikiInFlight.get(wiki.path);
    const pending = (async () => {
      if (syncing || busy)
        throw Error("Drive 正在處理其他資產，請稍後再建立圖鑑");
      const destination = await folder(wiki.kind + "/" + wiki.subject, true);
      // Serialize same-path requests within this browser tab, and never
      // overwrite or fork a previously generated wiki.
      const found = await list(
        destination,
        "name = '" + escapeQuery(wiki.path.split("/").pop()) + "'",
      );
      if (found.length > 1) throw Error(wiki.path + " 名稱重複，請人工整理");
      if (found.length === 1)
        return { path: wiki.path, created: false, id: found[0].id };
      const text = window.COSMI_WIKI.initialMarkdown(ctx);
      const written = await write(
        wiki.path,
        new Blob([text], { type: "text/markdown" }),
      );
      return { path: wiki.path, created: true, id: written.id };
    })();
    wikiInFlight.set(wiki.path, pending);
    void pending.then(
      () => wikiInFlight.delete(wiki.path),
      () => wikiInFlight.delete(wiki.path),
    );
    return pending;
  }
  async function migrateWikis() {
    if (syncing || busy) throw Error("Drive 正在同步或審查，請稍後再執行");
    busy = true;
    const report = {
      sources: 0,
      created: 0,
      skipped: 0,
      archived: 0,
      errors: [],
    };
    try {
      const oldFolder = "04_encyclopedia/creatures";
      let sourceFiles = [];
      try { sourceFiles = await list(await folder(oldFolder)); }
      catch (e) { if (!/不存在/.test(e.message)) throw e; }
      await folder("creatures/wiki", true);
      await folder("creatures/wiki/_legacy", true);
      const backupId = await folder("creatures/wiki/_legacy");
      const targetId = await folder("creatures/wiki");
      const archiveFiles = await list(backupId);
      const existingArchive = new Set(archiveFiles.map((f) => f.name));
      // Include previously archived family wikis on repeat runs to repair missing stages.
      const candidates = [...sourceFiles, ...archiveFiles].filter((f) =>
        /^cr_[a-z0-9_]+_wiki\.md$/.test(f.name),
      );
      const done = new Set();
      for (const file of candidates) {
        const id = /^(cr_[a-z0-9_]+)_wiki\.md$/.exec(file.name)[1];
        if (done.has(id)) continue;
        done.add(id);
        report.sources++;
        try {
          let data = "";
          if (file.mimeType === "application/vnd.google-apps.document") {
            // Native Docs must be exported, not requested with alt=media.
            const p = new URLSearchParams({ mimeType: "text/plain" });
            data = await (
              await request(API + "/" + file.id + "/export?" + p)
            ).text();
          } else
            data = await (
              await request(API + "/" + file.id + "?alt=media")
            ).text();
          if (!data.trim()) throw Error("來源圖鑑沒有內容");
          const present = await list(targetId);
          const known = new Set(present.map((f) => f.name));
          let allGood = true;
          for (const stage of window.COSMI_WIKI.STAGES) {
            const name = id + "_" + stage + "_wiki.md";
            if (known.has(name)) {
              report.skipped++;
              continue;
            }
            try {
              const content = window.COSMI_WIKI.splitLegacy(
                data,
                id,
                stage,
                file.name,
              );
              await write(
                "creatures/wiki/" + name,
                new Blob([content], { type: "text/markdown" }),
              );
              const saved = await read("creatures/wiki/" + name);
              if (!(await saved.text()).includes("- stage: " + stage))
                throw Error("圖鑑回讀不符");
              report.created++;
              known.add(name);
            } catch (e) {
              allGood = false;
              report.errors.push(name + ": " + e.message);
            }
          }
          // Never remove legacy bytes. Archive the original only after all stages exist.
          if (allGood && !existingArchive.has(file.name)) {
            const meta = await (
              await request(API + "/" + file.id + "?fields=parents")
            ).json();
            const previous = (meta.parents || []).join(",");
            const q = new URLSearchParams({
              addParents: backupId,
              removeParents: previous,
              fields: "id,parents",
            });
            await request(API + "/" + file.id + "?" + q, { method: "PATCH" });
            existingArchive.add(file.name);
            report.archived++;
          }
        } catch (e) {
          report.errors.push(id + ": " + e.message);
        }
      }
      void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
      return report;
    } finally {
      busy = false;
    }
  }

  async function migratePrompt3dAssets() {
    // One-time, idempotent migration of EXISTING original Prompt-to-3D models.
    // No mesh is modified, copied or claimed to have passed geometry/animation QA.
    if (syncing || busy) throw Error("Drive 正在同步或審查，請稍後再執行");
    busy = true;
    const report = { total: 0, updated: 0, skipped: 0, errors: [] };
    try {
      let baseDir = "creatures/02_3d/ai_blender";
      let entries = [];
      try {
        entries = await list(await folder(baseDir));
      } catch (e) {
        if (!/不存在/.test(e.message)) throw e;
        baseDir = "02_3d/ai_blender";
        entries = await list(await folder(baseDir));
      }
      const assets = entries.filter(
        (f) =>
          f.mimeType === MIME &&
          /^asset_cr_[a-z0-9_]+_(juvenile|adolescent|adult|overload)$/.test(
            f.name,
          ),
      );
      let wikiBase = "creatures/wiki";
      let wikiFiles = [];
      try {
        wikiFiles = await list(await folder(wikiBase));
      } catch (e) {
        if (!/不存在/.test(e.message)) throw e;
        throw Error("正式圖鑑目錄 creatures/wiki 不存在，請先完成分類搬移");
      }
      const wikiNames = new Set(wikiFiles.map((f) => f.name));
      report.total = assets.length;
      for (const asset of assets) {
        try {
          const children = await list(asset.id);
          const modelFolder = children.find(
            (f) => f.mimeType === MIME && f.name === "models",
          );
          if (!modelFolder) {
            report.skipped++;
            report.errors.push(asset.name + ": 缺 models/");
            continue;
          }
          const models = await list(modelFolder.id);
          const glbs = models.filter((f) => /\.glb$/i.test(f.name));
          if (!glbs.length) {
            report.skipped++;
            report.errors.push(asset.name + ": 無 .glb");
            continue;
          }
          const modelEntries = models
            .filter((f) => /\.(glb|blend)$/i.test(f.name))
            .map((f) => ({
              path: "models/" + f.name,
              kind: "model",
              level: "L1",
            }));
          const manifestFile = pickLatestFile(
            children.filter(
              (f) => f.name === "manifest.json" && f.mimeType !== MIME,
            ),
          );
          let manifest = {};
          if (manifestFile) {
            try {
              manifest = JSON.parse(
                await (
                  await request(API + "/" + manifestFile.id + "?alt=media")
                ).text(),
              );
            } catch (e) {
              report.skipped++;
              report.errors.push(
                asset.name + ": 既有 manifest 不可解析；未覆寫",
              );
              continue;
            }
            if (
              !manifest ||
              Array.isArray(manifest) ||
              typeof manifest !== "object"
            ) {
              report.skipped++;
              continue;
            }
          }
          const matched =
            /^asset_(cr_[a-z0-9_]+)_(juvenile|adolescent|adult|overload)$/.exec(
              asset.name,
            );
          const subject = matched[1],
            stage = matched[2],
            wiki = subject + "_" + stage + "_wiki.md";
          const existingEntries = Array.isArray(manifest.files)
            ? manifest.files.filter((e) => e && typeof e.path === "string")
            : [];
          const indexed = new Map(existingEntries.map((e) => [e.path, e]));
          for (const entry of modelEntries) indexed.set(entry.path, entry);
          const missing = Array.isArray(manifest.missing)
            ? manifest.missing.filter((e) => e && typeof e.item === "string")
            : [];
          const addMissing = (item, reason) => {
            if (!missing.some((m) => m.item === item))
              missing.push({ item, level: "L1", reason });
          };
          if (!models.some((f) => /\.blend$/i.test(f.name)))
            addMissing(
              ".blend",
              "Only source GLB exists; editable Blender file not found",
            );
          if (!children.some((f) => f.name === "rig"))
            addMissing("rig QA", "Rig was not verified from existing model");
          if (!children.some((f) => f.name === "animations"))
            addMissing(
              "animation QA",
              "Motion clips were not verified from existing model",
            );
          if (!children.some((f) => f.name === "qa"))
            addMissing("visual QA", "Pose/visual QA has not been reviewed");
          if (!wikiNames.has(wiki))
            addMissing(
              "encyclopedia",
              "Matching stage-specific creature wiki not yet found",
            );
          const next = {
            ...manifest,
            spec: manifest.spec || "cosmimera-art-task/1",
            task_id: manifest.task_id || asset.name,
            task_type: manifest.task_type || "creature-model-rig",
            subject_id: manifest.subject_id || subject,
            stage: manifest.stage || stage,
            source_pack: manifest.source_pack || "",
            produced_by: manifest.produced_by || "historical Prompt-to-3D",
            input_mode: "text",
            pipeline: "ai_blender",
            encyclopedia_path: wikiNames.has(wiki) ? wikiBase + "/" + wiki : "",
            qa_status: "REVIEW_REQUIRED",
            files: [...indexed.values()],
            missing,
            notes:
              manifest.notes ||
              "Historical Prompt-to-3D source. Pending manual pose, rig and clip review.",
          };
          if (JSON.stringify(next) === JSON.stringify(manifest)) {
            report.skipped++;
            continue;
          }
          // Preserve all historical manifest bytes in a separate backup before update.
          if (manifestFile) {
            const backupPath =
              "creatures/backup/manifest_snapshots/" +
              asset.name +
              ".before_prompt3d_migration.json";
            await folder("creatures/backup/manifest_snapshots", true);
            if (!(await find(backupPath)).file)
              await jsonWrite(backupPath, manifest);
          }
          const target = baseDir + "/" + asset.name + "/manifest.json";
          await jsonWrite(target, next);
          const check = JSON.parse(await (await read(target)).text());
          if (check.task_id !== next.task_id || check.input_mode !== "text")
            throw Error("Manifest 回讀驗證失敗");
          report.updated++;
        } catch (e) {
          report.errors.push(asset.name + ": " + e.message);
        }
      }
      void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
      return report;
    } finally {
      busy = false;
    }
  }

  async function run(action) {
    try {
      return await action();
    } catch (e) {
      $("driveStatus").textContent = e.message;
    }
  }
  async function authorize(response, restoredSession = null) {
    if (response.error || !response.access_token) {
      $("driveGateStatus").textContent =
        response.error_description || response.error || "Google 登入失敗";
      return;
    }
    try {
      accessToken = response.access_token;
      expiry =
        restoredSession?.expiry ??
        Date.now() + Number(response.expires_in || 3600) * 1000;
      const root = await metadata(config.rootId);
      if (root.trashed || root.mimeType !== MIME)
        throw Error("Drive 專案資料夾無法存取");
      // A permission ID is stable for this account. Never mix cached data between Google accounts.
      let permissionId = "";
      try {
        const about = await (
          await request(
            "https://www.googleapis.com/drive/v3/about?fields=user(permissionId)",
          )
        ).json();
        permissionId = about.user?.permissionId || "";
      } catch (_) {}
      accountNamespace =
        window.COSMI_DRIVE_CACHE?.namespace(config.rootId, permissionId) || "";
      // Persist only after Drive permissions have been validated.
      saveSession();
      expiryTimer = setTimeout(
        () => lock("登入已到期，請重新登入 Google"),
        Math.max(0, expiry - Date.now()),
      );
      // Unlock the UI as soon as folder permission is verified; synchronize assets afterward.
      if (!initialized) {
        window.dispatchEvent(new Event("cosmi:authorized"));
        initialized = true;
      }
      $("driveGate").hidden = true;
      $("driveApp").hidden = false;
      $("driveStatus").textContent = "已登入，正在讀取雲端資料…";
      if (window.COSMI_PIPELINE) {
        Promise.resolve()
          .then(() => window.COSMI_PIPELINE.loadTemplates())
          .then(() => window.COSMI_FORGE.refresh())
          .catch((e) => {
            $("driveStatus").textContent += "；管線模板讀取失敗：" + e.message;
          });
      }
      if (window.COSMI_DRIVE_CACHE?.preferences().autoSync !== false)
        await run(() => syncPackages());
      else
        $("driveStatus").textContent =
          "已登入，已依設定暫停自動同步；可手動重新載入 Drive。";
    } catch (e) {
      lock(e.message);
    }
  }
  async function migratePipelineDirectories() {
    if (syncing || busy) throw Error("Drive 正在同步或審查，請稍後再執行");
    busy = true;
    const report = { moved: 0, skipped: 0, errors: [] };
    const knownRoots = new Map();
    const safeEntries = async (dirPath) => {
      try {
        const id = await folder(dirPath);
        return { id, items: await list(id) };
      } catch (e) {
        if (!/不存在/.test(e.message)) report.errors.push(dirPath + ": " + e.message);
        return { id: "", items: [] };
      }
    };
    const moveIfFree = async (item, fromId, targetDir) => {
      try {
        const toId = await folder(targetDir, true);
        if (fromId === toId) {
          report.skipped++;
          return;
        }
        const existing = await list(toId, "name = '" + escapeQuery(item.name) + "'");
        if (existing.length) {
          report.skipped++;
          return;
        }
        await move(item.id, fromId, toId);
        report.moved++;
      } catch (e) {
        report.errors.push(item.name + ": " + e.message);
      }
    };
    try {
      for (const dir of legacyDirs) {
        const { id: fromId, items } = await safeEntries(dir);
        if (!fromId) continue;
        for (const entry of items) {
          if (entry.mimeType !== MIME || entry.name.startsWith("_")) continue;
          let manifest = null;
          try {
            const children = await list(entry.id);
            const mf = children.find((f) => f.name === "manifest.json");
            if (mf) {
              manifest = JSON.parse(
                await (await request(API + "/" + mf.id + "?alt=media")).text(),
              );
            }
          } catch (_) {}
          const root = pipelineRoot({ id: entry.name, manifest });
          knownRoots.set(entry.name, root);
          if (manifest?.subject_id) knownRoots.set(manifest.subject_id, root);
          const targetSubdir =
            root === "moves"
              ? dir.startsWith("03_completed")
                ? "moves/03_completed"
                : "moves/01_vfx"
              : root + "/" + dir;
          await moveIfFree(entry, fromId, targetSubdir);
        }
      }
      const classifyFile = (name) => {
        const stem = name.replace(/\.(json|md|prompt\.md|parameters\.json|appearance\.md)$/i, "");
        const base = stem.split(".")[0];
        return knownRoots.get(base) || pipelineRoot(base);
      };
      for (const [oldDir, buildTarget] of [
        ["reviews", (f) => classifyFile(f.name) + "/reviews"],
        ["00_settings", (f) => classifyFile(f.name) + "/00_settings"],
        ["prompts/jobs", (f) => classifyFile(f.name) + "/prompts/jobs"],
        ["wiki/characters", () => "characters/wiki"],
        ["wiki/creatures", () => "creatures/wiki"],
        ["wiki/moves", () => "moves/wiki"],
        ["wiki/_legacy/creatures", () => "creatures/wiki/_legacy"],
      ]) {
        const { id: fromId, items } = await safeEntries(oldDir);
        if (!fromId) continue;
        for (const item of items) {
          if (item.mimeType === MIME) continue;
          if (oldDir === "00_settings" && item.name === "default.parameters.json") {
            report.skipped++;
            continue;
          }
          await moveIfFree(item, fromId, buildTarget(item));
        }
      }
      void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
      return report;
    } finally {
      busy = false;
    }
  }
  // Explicit, repeatable cleanup for the on-disk manifest references left by earlier
  // Drive directory moves. Updates only link fields and retains the same Drive file ID.
  async function migrateManifestWikiReferences() {
    if (syncing || busy) throw Error("Drive 正在同步或審查，請稍後再執行");
    busy = true;
    const report = { examined: 0, updated: 0, skipped: 0, errors: [] };
    try {
      for (const dir of categoryDirs) {
        let entries;
        try { entries = await list(await folder(dir)); }
        catch (e) { if (!/不存在/.test(e.message)) report.errors.push(dir + ": " + e.message); continue; }
        for (const entry of entries.filter(item => item.mimeType === MIME)) {
          try {
            const children = await list(entry.id);
            const manifests = children.filter(item => item.name === "manifest.json" && item.mimeType !== MIME);
            if (manifests.length > 1) throw Error("同一資產包含多份 manifest.json");
            if (!manifests.length) { report.skipped++; continue; }
            const file = manifests[0];
            const raw = await (await request(API + "/" + file.id + "?alt=media")).text();
            let manifest;
            try { manifest = JSON.parse(raw); } catch (_) { throw Error("manifest.json 不是合法 JSON"); }
            if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
              throw Error("manifest.json 必須是物件");
            report.examined++;
            const updated = window.COSMI_WIKI?.normalizeManifest?.(manifest);
            if (!updated || JSON.stringify(updated) === JSON.stringify(manifest)) {
              report.skipped++; continue;
            }
            const location = dir + "/" + entry.name + "/manifest.json";
            await jsonWrite(location, updated);
            const verify = JSON.parse(await (await read(location)).text());
            if (JSON.stringify(verify) !== JSON.stringify(updated))
              throw Error("更新後 manifest 回讀不符");
            report.updated++;
          } catch (e) {
            report.errors.push(dir + "/" + entry.name + ": " + e.message);
          }
        }
      }
      return report;
    } finally {
      busy = false;
      void window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
    }
  }
  async function syncPipelineIndex() {
    if (!accessToken || Date.now() >= expiry - SESSION_SKEW) {
      return pipelineIndexState;
    }
    const safeList = async (dirPath) => {
      try {
        const entries = await list(await folder(dirPath));
        const byName = new Map();
        for (const f of entries) {
          if (f.mimeType === MIME) continue;
          const prev = byName.get(f.name);
          if (!prev || fileModifiedMs(f) > fileModifiedMs(prev)) byName.set(f.name, f);
        }
        return [...byName.values()];
      } catch (_) {
        return [];
      }
    };
    const settings = [],
      jobs = [],
      wikiCharacters = [],
      wikiCreatures = [];
    for (const root of categoryRoots) {
      let subjectFolders = [];
      try {
        const entries = await list(await folder(root));
        subjectFolders = entries.filter(
          (f) => f.mimeType === MIME && !f.name.startsWith("_") && !RESERVED_CATEGORY_FOLDERS.has(f.name),
        );
      } catch (_) {}
      await Promise.all(
        subjectFolders.map(async (sub) => {
          let files = [];
          try {
            files = await walk(sub.id);
          } catch (_) {
            files = await safeList(root + "/" + sub.name);
          }
          for (const f of files) {
            const parsed = parseAssetFilename(f.name, root);
            if (parsed?.step === "00_appearance" || parsed?.step === "00_parameters") settings.push(f);
            else if (/_(?:prompt|job)\.md$/i.test(f.name)) jobs.push(f);
            else if (parsed?.step === "05_wiki") {
              if (root === "characters") wikiCharacters.push(f);
              else if (root === "creatures") wikiCreatures.push(f);
            }
          }
        }),
      );
    }
    const [
      settingsChar,
      settingsCreature,
      settingsMove,
      jobsChar,
      jobsCreature,
      jobsMove,
      wikiCharLegacy,
      wikiCreatureLegacy,
    ] = await Promise.all([
      safeList("characters/00_settings"),
      safeList("creatures/00_settings"),
      safeList("moves/00_settings"),
      safeList("characters/prompts/jobs"),
      safeList("creatures/prompts/jobs"),
      safeList("moves/prompts/jobs"),
      safeList("characters/wiki"),
      safeList("creatures/wiki"),
    ]);
    pipelineIndexState = {
      settings: [...settings, ...settingsChar, ...settingsCreature, ...settingsMove],
      jobs: [...jobs, ...jobsChar, ...jobsCreature, ...jobsMove],
      wikiCharacters: [...wikiCharacters, ...wikiCharLegacy],
      wikiCreatures: [...wikiCreatures, ...wikiCreatureLegacy],
      syncedAt: Date.now(),
    };
    window.COSMI_FORGE?.refresh?.();
    return pipelineIndexState;
  }
  window.COSMI_DRIVE = Object.freeze({
    relative,
    read,
    readById,
    write,
    folder,
    list,
    move,
    review,
    saveNote,
    uploadAsset,
    syncPackages,
    prioritize,
    syncPipelineIndex,
    pipelineIndex: () => pipelineIndexState,
    pipelineRoot,
    stepCode,
    cleanSubjectId,
    subjectDir,
    assetStem,
    parseAssetFilename,
    isLevel3Deliverable,
    assetSubpath,
    migratePipelineDirectories,
    migrateManifestWikiReferences,
    migratePrompt3dAssets,
    migrateWikis,
    ensureWiki,
    cacheStats: () =>
      window.COSMI_DRIVE_CACHE?.stats(accountNamespace) ||
      Promise.resolve({ count: 0, bytes: 0, supported: false }),
    clearCache: async () => {
      await window.COSMI_DRIVE_CACHE?.clear(accountNamespace);
      return true;
    },
    signOut: () => lock("已登出"),
    rootPath: config.rootPath,
    packageDir,
    pipelineDirectory,
  });
  document.addEventListener("DOMContentLoaded", () => {
    $("driveSignIn").addEventListener("click", () => {
      if (window.location?.protocol === "file:") {
        $("driveGateStatus").textContent =
          "本機請先以 http://localhost:8687 啟動網頁，不能直接開啟 HTML 檔。";
        return;
      }
      if (!config.clientId) {
        $("driveGateStatus").textContent =
          "尚未設定 Google 登入，請設定 GOOGLE_OAUTH_CLIENT_ID 後部署。";
        return;
      }
      if (!window.google?.accounts?.oauth2) {
        $("driveGateStatus").textContent =
          "Google 登入元件尚未載入，請稍後重試。";
        return;
      }
      tokenClient ||= google.accounts.oauth2.initTokenClient({
        client_id: config.clientId,
        scope: "https://www.googleapis.com/auth/drive",
        callback: authorize,
        error_callback: (e) => {
          $("driveGateStatus").textContent =
            e.type === "popup_closed"
              ? "登入視窗已關閉"
              : "Google 登入視窗無法開啟";
        },
      });
      tokenClient.requestAccessToken({ prompt: "select_account" });
    });
    $("driveSync").addEventListener("click", () =>
      run(() => syncPackages({ force: true })),
    );
    $("settingsMigratePipeline")?.addEventListener("click", () => {
      if (
        !window.confirm(
          "按角色／宙獸／主動技整理舊共用目錄，並修正既有 manifest.json 的 wiki 引用？保留所有檔案 ID，同名檔案不覆寫，僅更新已知舊路徑。",
        )
      )
        return;
      run(async () => {
        $("driveStatus").textContent = "正在依角色／宙獸／主動技分類 Drive 目錄…";
        const report = await migratePipelineDirectories();
        const links = await migrateManifestWikiReferences();
        $("driveStatus").textContent =
          "管線目錄分類：" +
          report.moved +
          " 已移動、" +
          report.skipped +
          " 跳過、" +
          (report.errors.length + links.errors.length) +
          " 項錯誤；另有 " + links.updated + " 份 manifest 圖鑑引用已校正";
        $("settingsMessage").textContent =
          [...report.errors, ...links.errors].slice(0, 6).join("；") ||
          "已完成角色／宙獸／主動技 Drive 目錄分類與 manifest 引用校正。";
        await syncPackages({ force: true });
        await syncPipelineIndex();
      });
    });
    $("settingsMigrateWiki")?.addEventListener("click", () => {
      if (
        !window.confirm(
          "將現有 15 份系列圖鑑拆成各型態獨立 Markdown？原圖鑑移至 creatures/wiki/_legacy 備份；既有階段圖鑑不覆寫。",
        )
      )
        return;
      run(async () => {
        $("driveStatus").textContent = "正在依型態拆分圖鑑…";
        const report = await migrateWikis();
        $("driveStatus").textContent =
          "圖鑑整理：" +
          report.created +
          " 新增、" +
          report.skipped +
          " 既有、" +
          report.archived +
          " 備份；" +
          report.errors.length +
          " 項錯誤";
        $("settingsMessage").textContent =
          report.errors.slice(0, 6).join("；") ||
          "各型態圖鑑已整理，原始系列文件保留於 creatures/wiki/_legacy。";
      });
    });
    $("settingsMigratePrompt3d")?.addEventListener("click", () => {
      if (
        !window.confirm(
          "整理 creatures/02_3d/ai_blender（或舊 02_3d/ai_blender）的歷史 Prompt-to-3D 資產描述檔？原 GLB/Blend 不會修改；既有 manifest 先備份，全部保持待審狀態。",
        )
      )
        return;
      run(async () => {
        $("driveStatus").textContent = "正在建立 Prompt-to-3D 資產索引…";
        const report = await migratePrompt3dAssets();
        $("driveStatus").textContent =
          "Prompt-to-3D 整理：" +
          report.updated +
          " 已更新、" +
          report.skipped +
          " 跳過、" +
          report.errors.length +
          " 項待檢查";
        $("settingsMessage").textContent =
          report.errors.slice(0, 8).join("；") ||
          "歷史模型已建立待審索引，未自動核准。";
        await syncPackages({ force: true });
      });
    });
    $("driveSavePrompt").addEventListener("click", () => {
      if (
        $("pipelineStage").value === "portrait" &&
        !window.COSMI_PIPELINE?.isPortraitAuto()
      )
        return;
      run(async () => {
        const { path, text } = window.COSMI_FORGE.currentPrompt();
        await write(path, new Blob([text], { type: "text/markdown" }));
        $("driveStatus").textContent = "已儲存 " + path;
      });
    });
    $("driveLoadPrompt").addEventListener("click", () =>
      run(async () => {
        const path = $("drivePromptPath").value.trim();
        if (
          !/^(?:(?:characters|creatures|moves)\/(?:prompts\/.*|[^/]+\/[^/]+)|prompts\/.*)\.md$/.test(path)
        )
          throw Error(
            "請輸入 <類別>/<id>/ 或 <類別>/prompts/ 下的 Markdown 相對路徑",
          );
        window.COSMI_FORGE.showPrompt(await (await read(path)).text());
        $("driveStatus").textContent = "已讀取 " + path;
      }),
    );
    $("pipelineRead").addEventListener("click", () => {
      if ($("pipelineStage").value === "portrait") {
        if (!window.COSMI_PIPELINE?.isPortraitAuto()) {
          $("copy").click();
          return;
        }
        run(async () => {
          const { path, text } = window.COSMI_FORGE.currentPrompt();
          await write(path, new Blob([text], { type: "text/markdown" }));
          $("drivePromptPath").value = path;
          $("driveStatus").textContent = "立繪管線已建立並上傳 " + path;
        });
        return;
      }
      run(async () => {
        const key = $("pipelineStage").value;
        if (key === "encyclopedia") {
          const ctx = window.COSMI_FORGE.currentContext?.();
          if (!ctx) throw Error("目前沒有可用的圖鑑概念設定");
          const wiki = await ensureWiki(ctx);
          window.COSMI_FORGE.showPrompt(
            window.COSMI_FORGE.currentPrompt().text,
          );
          $("driveStatus").textContent =
            (wiki.created ? "已建立" : "已存在，未重複生成") + " " + wiki.path;
          return;
        }
        if (
          [
            "appearance",
            "portrait",
            "review_portrait",
            "colab",
            "blender",
            "review_3d",
            "move_vfx",
          ].includes(key)
        ) {
          const context = window.COSMI_FORGE.currentContext?.();
          // A stage template read must not create an unrelated encyclopedia draft.
        }
        const name = window.COSMI_PIPELINE.stages[key];
        window.COSMI_PIPELINE.templates[key] = await (
          await read(pipelineRoot(context || window.COSMI_FORGE.currentContext?.() || "creatures") + "/prompts/" + name + ".prompt.md")
        ).text();
        window.COSMI_FORGE.refresh();
        window.COSMI_FORGE.showPrompt(window.COSMI_FORGE.currentPrompt().text);
      });
    });
    $("pipelineSaveSettings").addEventListener("click", () =>
      run(async () => {
        const d = window.COSMI_FORGE.settings(),
          p = window.COSMI_PIPELINE.parameters(),
          root = pipelineRoot(d.delivery?.task_type || d.assetId),
          subject = d.subjectId || d.assetId,
          stem = assetStem({ kind: root, id: subject, stage: d.stage, step: "00_parameters" });
        await jsonWrite(subjectDir(root, subject) + "/" + assetSubpath(stem + ".json", root), {
          ...p,
          delivery: d.delivery,
        });
        $("driveStatus").textContent = "已儲存格式參數（外觀由概念參數提供）";
      }),
    );
    $("pipelineLoadSettings").addEventListener("click", () =>
      run(async () => {
        const d = window.COSMI_FORGE.settings(),
          id = d.assetId,
          subject = d.subjectId || id,
          root = pipelineRoot(d.delivery?.task_type || id),
          stem = assetStem({ kind: root, id: subject, stage: d.stage, step: "00_parameters" });
        let p;
        for (const candidate of [
          subjectDir(root, subject) + "/" + assetSubpath(stem + ".json", root),
          subjectDir(root, subject) + "/" + stem + ".json",
          root + "/00_settings/" + id + ".parameters.json",
          "00_settings/" + id + ".parameters.json",
        ]) {
          try {
            p = await (await read(candidate)).text();
            break;
          } catch (e) {
            if (!/不存在/.test(e.message)) throw e;
          }
        }
        if (p == null) throw Error("找不到格式參數檔：" + stem + ".json");
        JSON.parse(p);
        $("pipelineParameters").value = p;
        window.COSMI_PIPELINE.parameters();
        window.COSMI_FORGE.refresh();
        $("driveStatus").textContent = "已載入格式參數";
      }),
    );
    $("pipelineBindSource").addEventListener("click", () =>
      run(async () => {
        const pkg = window.COSMI_FORGE.activePackage(),
          id = $("pipelineSource").value.trim(),
          src = window.COSMI_FORGE.packages().find(
            (p) => p.id === id && !modelType(p),
          );
        if (!pkg?.driveFolderId || !modelType(pkg) || pkg.completed || !src)
          throw Error("請選取待審 3D 並填入已載入的立繪資產 ID");
        await jsonWrite(reviewPathFor(pkg), {
          task_id: pkg.id,
          status: pkg.status,
          source_pack: id,
          time: new Date().toISOString(),
        });
        pkg.sourcePack = id;
        window.COSMI_FORGE.refresh();
        $("driveStatus").textContent = "已綁定來源立繪 " + id;
      }),
    );
    $("driveUploadPackage").addEventListener("click", () =>
      run(async () => {
        $("driveStatus").textContent =
          "已儲存資產目錄 " +
          (await uploadAsset(window.COSMI_FORGE.activePackage()));
      }),
    );
    const saved = readSession();
    if (saved) {
      $("driveGateStatus").textContent = "正在恢復 Google Drive 登入…";
      void authorize({ access_token: saved.accessToken }, saved);
    } else {
      $("driveGateStatus").textContent =
        window.location?.protocol === "file:"
          ? "本機請先以 http://localhost:8687 啟動網頁，不能直接開啟 HTML 檔。"
          : config.clientId
            ? "登入後可讀取你有權限的專案資產。"
            : "尚未設定 Google 登入，請設定 GOOGLE_OAUTH_CLIENT_ID 後部署。";
    }
  });
})();
