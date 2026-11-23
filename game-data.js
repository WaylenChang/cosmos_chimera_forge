// Read-only browser for cosmos_chimera game data (characters, creatures, moves, traits, relations).
// Strictly separated from Google Drive art/animation assets to avoid cross-contamination.
(function (root) {
  "use strict";

  const DB_NAME = "CosmimeraForgeDB";
  const STORE_NAME = "handles";
  const HANDLE_KEY = "cosmosChimeraRootDir";

  const ELEMENT_ZH = {
    metal: "金", wood: "木", water: "水", fire: "火", earth: "土",
    ice: "冰", wind: "風", thunder: "雷", light: "光", shadow: "暗"
  };
  const STAGE_ZH = {
    juvenile: "幼年", adolescent: "少年", adult: "成年", overload: "超載"
  };
  const SIZE_ZH = { XS: "極小", S: "小", M: "中", L: "大", XL: "巨型" };
  const AI_STYLE_ZH = {
    keep_distance: "遠距控場", flank: "側翼游擊", charge: "突進強攻", hold: "陣地固守"
  };
  const RANGE_ZH = { melee: "近戰", mid: "中距", long: "遠距" };
  const SHAPE_ZH = {
    front: "前方", sweep: "橫掃", burst: "爆發", line: "直線",
    cone: "錐形", arc: "拋物線", self: "自身", ally: "友方", field: "場地"
  };
  const KIND_ZH = { damage: "傷害", effect: "效果", both: "複合（傷害＋效果）" };
  const POLARITY_ZH = { yin: "陰（內傷／衝擊）", yang: "陽（外傷／斬灼）" };
  const RELATION_ZH = {
    evolution_family: "進化譜系",
    myth_kin: "神話同源",
    rival_symbiosis: "天敵／共生",
    tool_kin: "同工具系",
    mentor: "師徒傳承"
  };
  const ROLE_ZH = {
    trial_warden: "試煉守護者",
    field_utility_quest: "生活職能委託人",
    non_starter_glb: "宙獸關聯"
  };
  const STAT_AXES = [
    { key: "hp", label: "生命 HP" },
    { key: "speed", label: "速度 SPD" },
    { key: "yin_atk", label: "陰攻 YIN-ATK" },
    { key: "yang_atk", label: "陽攻 YANG-ATK" },
    { key: "yang_def", label: "陽防 YANG-DEF" },
    { key: "yin_def", label: "陰防 YIN-DEF" }
  ];

  const state = {
    dirHandle: null,
    sourceLabel: "",
    loaded: false,
    loading: false,
    category: "all",
    element: "",
    stage: "",
    query: "",
    selected: null, // { type: "creature" | "move" | "character", id: string }
    balance: null,
    names: new Map(),       // id -> { zh, en, ja }
    creatures: new Map(),   // id -> creature obj
    moves: new Map(),       // id -> move obj
    traits: new Map(),      // id -> trait obj
    characters: new Map(),  // id -> character/link obj
    relations: [],          // array of { a, b, kind, note }
    moveUsers: new Map(),   // moveId -> creatureId[]
    charByCreature: new Map(), // creatureId -> characterId[]
    charByMove: new Map()      // moveId -> characterId[]
  };

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") node.className = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v != null && v !== false) node.setAttribute(k, v === true ? "" : String(v));
      }
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
    }
    return node;
  }

  function svgEl(tag, attrs, ...children) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v != null) node.setAttribute(k, String(v));
      }
    }
    for (const child of children.flat()) {
      if (child != null) node.append(child);
    }
    return node;
  }

  function openDb() {
    return new Promise((resolve) => {
      if (!root.indexedDB) { resolve(null); return; }
      const req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function saveHandle(handle) {
    try {
      const db = await openDb();
      if (!db) return;
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    } catch (_) {}
  }

  async function loadSavedHandle() {
    try {
      const db = await openDb();
      if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  }

  function displayName(id) {
    const entry = state.names.get(id);
    if (entry?.zh) return entry.zh;
    const chr = state.characters.get(id);
    if (chr?.name_zh) return chr.name_zh;
    return id;
  }

  function displaySubName(id) {
    const entry = state.names.get(id);
    if (entry?.en) return entry.en;
    const chr = state.characters.get(id);
    if (chr?.name_en) return chr.name_en;
    return "";
  }

  function resetData() {
    state.balance = null;
    state.names.clear();
    state.creatures.clear();
    state.moves.clear();
    state.traits.clear();
    state.characters.clear();
    state.relations = [];
    state.moveUsers.clear();
    state.charByCreature.clear();
    state.charByMove.clear();
  }

  function ingestJsonFiles(fileMap) {
    resetData();
    const parseJson = (path) => {
      const raw = fileMap.get(path);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (_) { return null; }
    };

    const balance = parseJson("Data/balance.json");
    if (balance && typeof balance === "object") state.balance = balance;

    const namesDoc = parseJson("Assets/_Project/Data/Copy/names.json");
    if (namesDoc?.entries && Array.isArray(namesDoc.entries)) {
      for (const e of namesDoc.entries) {
        if (e?.id) state.names.set(e.id, { zh: e.zh || "", en: e.en || "", ja: e.ja || "" });
      }
    }

    const sortPaths = (prefix) => {
      const demo = [];
      const prod = [];
      for (const p of fileMap.keys()) {
        if (!p.endsWith(".json")) continue;
        if (p.startsWith(`Data/_demo/${prefix}/`)) demo.push(p);
        else if (p.startsWith(`Data/${prefix}/`)) prod.push(p);
      }
      return [...demo.sort(), ...prod.sort()];
    };

    for (const path of sortPaths("creatures")) {
      const arr = parseJson(path);
      if (Array.isArray(arr)) {
        for (const c of arr) if (c?.id) state.creatures.set(c.id, c);
      }
    }
    for (const path of sortPaths("moves")) {
      const arr = parseJson(path);
      if (Array.isArray(arr)) {
        for (const m of arr) if (m?.id) state.moves.set(m.id, m);
      }
    }
    for (const path of sortPaths("traits")) {
      const arr = parseJson(path);
      if (Array.isArray(arr)) {
        for (const t of arr) if (t?.id) state.traits.set(t.id, t);
      }
    }
    for (const path of sortPaths("characters")) {
      const arr = parseJson(path);
      if (Array.isArray(arr)) {
        for (const ch of arr) {
          const cid = ch?.id || ch?.character_id;
          if (cid) state.characters.set(cid, { ...ch, character_id: cid });
        }
      }
    }

    const edgeSet = new Set();
    for (const path of sortPaths("relations")) {
      const arr = parseJson(path);
      if (Array.isArray(arr)) {
        for (const edge of arr) {
          if (!edge?.a || !edge?.b || !edge?.kind) continue;
          const key = `${edge.a}|${edge.b}|${edge.kind}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            state.relations.push(edge);
          }
        }
      }
    }

    const linksDoc = parseJson("Data/character-creature-links.json");
    if (linksDoc && typeof linksDoc === "object") {
      const addLink = (item, roleKey) => {
        const cid = item?.character_id;
        if (!cid) return;
        const existing = state.characters.get(cid) || {};
        state.characters.set(cid, {
          ...existing,
          ...item,
          character_id: cid,
          link_group: roleKey
        });
      };
      for (const w of linksDoc.trial_wardens || []) addLink(w, "trial_warden");
      for (const q of linksDoc.field_utility_quests || []) addLink(q, "field_utility_quest");
      for (const n of linksDoc.non_starter_glb_creatures || []) {
        if (n?.character_id) addLink(n, "non_starter_glb");
      }
    }

    // Build reverse lookup indices
    for (const c of state.creatures.values()) {
      if (c.signature_move) {
        if (!state.moveUsers.has(c.signature_move)) state.moveUsers.set(c.signature_move, []);
        state.moveUsers.get(c.signature_move).push(c.id);
      }
    }
    for (const ch of state.characters.values()) {
      const linkedCreature = ch.trial_boss_id || ch.creature_id;
      if (linkedCreature) {
        if (!state.charByCreature.has(linkedCreature)) state.charByCreature.set(linkedCreature, []);
        state.charByCreature.get(linkedCreature).push(ch.character_id);
      }
      if (ch.signature_move) {
        if (!state.charByMove.has(ch.signature_move)) state.charByMove.set(ch.signature_move, []);
        state.charByMove.get(ch.signature_move).push(ch.character_id);
      }
    }

    state.loaded = state.creatures.size > 0 || state.moves.size > 0 || state.characters.size > 0;
    if (state.loaded && !state.selected) {
      const firstCreature = state.creatures.values().next().value;
      const firstMove = state.moves.values().next().value;
      const firstChar = state.characters.values().next().value;
      if (firstCreature) state.selected = { type: "creature", id: firstCreature.id };
      else if (firstChar) state.selected = { type: "character", id: firstChar.character_id };
      else if (firstMove) state.selected = { type: "move", id: firstMove.id };
    }
  }

  async function readFromDirHandle(dirHandle) {
    state.loading = true;
    render();
    try {
      const fileMap = new Map();
      async function readFileIfExists(relPath) {
        const parts = relPath.split("/");
        let cur = dirHandle;
        for (let i = 0; i < parts.length - 1; i++) {
          try { cur = await cur.getDirectoryHandle(parts[i]); } catch (_) { return; }
        }
        try {
          const fh = await cur.getFileHandle(parts[parts.length - 1]);
          const f = await fh.getFile();
          fileMap.set(relPath, await f.text());
        } catch (_) {}
      }
      async function collectJsonDir(relDir) {
        const parts = relDir.split("/");
        let cur = dirHandle;
        for (const p of parts) {
          try { cur = await cur.getDirectoryHandle(p); } catch (_) { return; }
        }
        async function walk(handle, prefix) {
          for await (const [name, child] of handle.entries()) {
            if (child.kind === "directory") {
              await walk(child, `${prefix}/${name}`);
            } else if (name.endsWith(".json")) {
              const f = await child.getFile();
              fileMap.set(`${prefix}/${name}`, await f.text());
            }
          }
        }
        await walk(cur, relDir);
      }

      await Promise.all([
        readFileIfExists("Data/balance.json"),
        readFileIfExists("Data/character-creature-links.json"),
        readFileIfExists("Assets/_Project/Data/Copy/names.json"),
        collectJsonDir("Data/_demo/creatures"),
        collectJsonDir("Data/_demo/moves"),
        collectJsonDir("Data/_demo/traits"),
        collectJsonDir("Data/_demo/relations"),
        collectJsonDir("Data/creatures"),
        collectJsonDir("Data/moves"),
        collectJsonDir("Data/traits"),
        collectJsonDir("Data/relations"),
        collectJsonDir("Data/characters")
      ]);

      state.dirHandle = dirHandle;
      state.sourceLabel = dirHandle.name || "cosmos_chimera";
      ingestJsonFiles(fileMap);
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadFromDriveGameData() {
    if (!root.COSMI_DRIVE?.read) {
      setStatus("Google Drive 尚未登入或不可用。");
      return;
    }
    state.loading = true;
    render();
    try {
      const fileMap = new Map();
      const drivePaths = [
        ["game_data/balance.json", "Data/balance.json"],
        ["game_data/character-creature-links.json", "Data/character-creature-links.json"],
        ["game_data/names.json", "Assets/_Project/Data/Copy/names.json"],
        ["game_data/creatures.json", "Data/creatures/drive-creatures.json"],
        ["game_data/moves.json", "Data/moves/drive-moves.json"],
        ["game_data/traits.json", "Data/traits/drive-traits.json"],
        ["game_data/relations.json", "Data/relations/drive-relations.json"],
        ["game_data/characters.json", "Data/characters/drive-characters.json"]
      ];
      await Promise.all(drivePaths.map(async ([drivePath, virtualPath]) => {
        try {
          const blob = await root.COSMI_DRIVE.read(drivePath);
          if (blob) fileMap.set(virtualPath, await blob.text());
        } catch (_) {}
      }));
      state.sourceLabel = "Drive game_data/（次要來源）";
      ingestJsonFiles(fileMap);
      if (!state.loaded) {
        setStatus("Drive 的 game_data/ 目錄尚無可讀取的遊戲數值檔案；請優先選取 cosmos_chimera 本機資料夾。");
      }
    } finally {
      state.loading = false;
      render();
    }
  }

  async function pickDirectory() {
    if (!root.showDirectoryPicker) {
      document.getElementById("gameDataFolderInput")?.click();
      return;
    }
    try {
      const handle = await root.showDirectoryPicker({ mode: "read" });
      await saveHandle(handle);
      await readFromDirHandle(handle);
    } catch (e) {
      if (e?.name !== "AbortError") {
        setStatus("無法讀取資料夾：" + (e?.message || e));
      }
    }
  }

  async function handleFolderInput(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    state.loading = true;
    render();
    try {
      const fileMap = new Map();
      let rootName = "cosmos_chimera";
      for (const f of files) {
        if (!f.name.endsWith(".json")) continue;
        const rel = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
        const idx = rel.indexOf("/Data/");
        const idxAssets = rel.indexOf("/Assets/");
        let norm = "";
        if (idx >= 0) {
          rootName = rel.slice(0, idx).split("/").pop() || rootName;
          norm = rel.slice(idx + 1);
        } else if (idxAssets >= 0) {
          rootName = rel.slice(0, idxAssets).split("/").pop() || rootName;
          norm = rel.slice(idxAssets + 1);
        } else if (rel.startsWith("Data/") || rel.startsWith("Assets/")) {
          norm = rel;
        }
        if (
          norm === "Data/balance.json" ||
          norm === "Data/character-creature-links.json" ||
          norm === "Assets/_Project/Data/Copy/names.json" ||
          /^Data\/(?:_demo\/)?(?:creatures|moves|traits|relations|characters)\//.test(norm)
        ) {
          fileMap.set(norm, await f.text());
        }
      }
      state.sourceLabel = rootName;
      ingestJsonFiles(fileMap);
    } finally {
      state.loading = false;
      render();
    }
  }

  async function tryRestoreSavedHandle() {
    if (state.loaded || state.loading) return;
    const saved = await loadSavedHandle();
    if (!saved) return;
    state.dirHandle = saved;
    state.sourceLabel = saved.name || "cosmos_chimera";
    try {
      const perm = await saved.queryPermission?.({ mode: "read" });
      if (perm === "granted") {
        await readFromDirHandle(saved);
        return;
      }
    } catch (_) {}
    render();
  }

  async function reloadSavedHandle() {
    if (!state.dirHandle) {
      await pickDirectory();
      return;
    }
    try {
      const perm = await state.dirHandle.requestPermission?.({ mode: "read" });
      if (perm === "granted" || perm == null) {
        await readFromDirHandle(state.dirHandle);
      }
    } catch (e) {
      setStatus("重新讀取失敗：" + (e?.message || e));
    }
  }

  function setStatus(text) {
    const node = document.getElementById("gdStatusText");
    if (node) node.textContent = text;
  }

  function selectEntity(type, id) {
    state.selected = { type, id };
    renderList();
    renderDetail();
  }

  function buildHexagonChart(stats, stage) {
    const cx = 120, cy = 112, maxR = 72;
    const values = STAT_AXES.map(a => Number(stats?.[a.key] || 0));
    const maxVal = Math.max(150, ...values);
    const scaleMax = Math.ceil(maxVal / 50) * 50;

    const pt = (i, r) => {
      const angle = (-90 + i * 60) * Math.PI / 180;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    };

    const svg = svgEl("svg", {
      class: "gd-hex-svg",
      viewBox: "0 0 240 225",
      role: "img",
      "aria-label": "六角能力點圖"
    });

    // Concentric rings
    for (const ratio of [0.25, 0.5, 0.75, 1]) {
      const pts = STAT_AXES.map((_, i) => pt(i, maxR * ratio).map(n => n.toFixed(1)).join(",")).join(" ");
      svg.append(svgEl("polygon", {
        points: pts,
        fill: "none",
        stroke: ratio === 1 ? "#3b465a" : "#262d3c",
        "stroke-width": ratio === 1 ? "1.3" : "1"
      }));
    }

    // Axes
    STAT_AXES.forEach((_, i) => {
      const [x, y] = pt(i, maxR);
      svg.append(svgEl("line", {
        x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1),
        stroke: "#2d3546", "stroke-width": "1"
      }));
    });

    // Data polygon
    const dataPts = values.map((v, i) => {
      const r = Math.min(1, v / scaleMax) * maxR;
      return pt(i, r).map(n => n.toFixed(1)).join(",");
    }).join(" ");
    svg.append(svgEl("polygon", {
      points: dataPts,
      fill: "rgba(110, 168, 255, 0.28)",
      stroke: "#6ea8ff",
      "stroke-width": "2"
    }));

    // Vertex dots & labels
    STAT_AXES.forEach((axis, i) => {
      const val = values[i];
      const r = Math.min(1, val / scaleMax) * maxR;
      const [vx, vy] = pt(i, r);
      svg.append(svgEl("circle", {
        cx: vx.toFixed(1), cy: vy.toFixed(1), r: "3.5",
        fill: "#ffd479", stroke: "#12141a", "stroke-width": "1.2"
      }));

      const [lx, ly] = pt(i, maxR + 20);
      const anchor = i === 0 || i === 3 ? "middle" : (i < 3 ? "start" : "end");
      const shortName = axis.label.split(" ")[0];
      const txt = svgEl("text", {
        x: lx.toFixed(1),
        y: (ly + (i === 0 ? -2 : i === 3 ? 6 : 2)).toFixed(1),
        "text-anchor": anchor,
        fill: "#dfe5ee",
        "font-size": "10.5",
        "font-family": "Segoe UI, Noto Sans TC, sans-serif"
      }, `${shortName} ${val}`);
      svg.append(txt);
    });

    const total = values.reduce((a, b) => a + b, 0);
    const budget = state.balance?.stat_budget?.base?.[stage];
    const statTable = el("div", { class: "gd-stat-table" },
      STAT_AXES.map((a, i) => el("div", { class: "gd-stat-row" },
        el("span", {}, a.label),
        el("strong", {}, String(values[i]))
      )),
      el("div", { class: "gd-stat-row", style: "grid-column:1 / -1" },
        el("span", {}, "能力總和" + (budget ? `（${STAGE_ZH[stage] || stage}基準 ${budget}）` : "")),
        el("strong", {}, String(total))
      )
    );

    return el("div", { class: "gd-hex-wrap" }, svg, statTable);
  }

  function renderRelationGraphFor(entityType, entityId) {
    const nodes = [];
    const edges = [];
    const seen = new Set();
    const addNode = (type, id, ring) => {
      const k = `${type}:${id}`;
      if (seen.has(k)) return;
      seen.add(k);
      nodes.push({ type, id, label: displayName(id), ring });
    };

    addNode(entityType, entityId, 0);

    if (entityType === "creature") {
      const c = state.creatures.get(entityId);
      if (c?.signature_move) {
        addNode("move", c.signature_move, 1);
        edges.push({ from: entityId, to: c.signature_move, label: "專屬技能" });
      }
      if (c?.evolves_to) {
        addNode("creature", c.evolves_to, 1);
        edges.push({ from: entityId, to: c.evolves_to, label: "進化" });
      }
      for (const other of state.creatures.values()) {
        if (other.evolves_to === entityId) {
          addNode("creature", other.id, 1);
          edges.push({ from: other.id, to: entityId, label: "進化前身" });
        }
        if (other.overload_of === entityId) {
          addNode("creature", other.id, 1);
          edges.push({ from: entityId, to: other.id, label: "超載型態" });
        }
      }
      for (const cid of state.charByCreature.get(entityId) || []) {
        addNode("character", cid, 1);
        edges.push({ from: cid, to: entityId, label: "關聯角色" });
      }
      for (const r of state.relations) {
        if (r.a === entityId || r.b === entityId) {
          const otherId = r.a === entityId ? r.b : r.a;
          addNode("creature", otherId, 1);
          edges.push({ from: entityId, to: otherId, label: RELATION_ZH[r.kind] || r.kind });
        }
      }
    } else if (entityType === "move") {
      for (const crId of state.moveUsers.get(entityId) || []) {
        addNode("creature", crId, 1);
        edges.push({ from: crId, to: entityId, label: "專屬宙獸" });
      }
      for (const chId of state.charByMove.get(entityId) || []) {
        addNode("character", chId, 1);
        edges.push({ from: chId, to: entityId, label: "關聯角色" });
      }
    } else if (entityType === "character") {
      const ch = state.characters.get(entityId);
      const linkedCreature = ch?.trial_boss_id || ch?.creature_id;
      if (linkedCreature) {
        addNode("creature", linkedCreature, 1);
        edges.push({ from: entityId, to: linkedCreature, label: "關聯宙獸" });
      }
      if (ch?.signature_move) {
        addNode("move", ch.signature_move, 1);
        edges.push({ from: entityId, to: ch.signature_move, label: "關聯技能" });
      }
    }

    if (nodes.length <= 1) return null;

    const width = 560, height = 270, cx = width / 2, cy = height / 2;
    const outer = nodes.filter(n => n.ring === 1);
    const pos = new Map();
    pos.set(entityId, [cx, cy]);
    outer.forEach((n, idx) => {
      const ang = (-90 + (360 / outer.length) * idx) * Math.PI / 180;
      pos.set(n.id, [cx + 185 * Math.cos(ang), cy + 92 * Math.sin(ang)]);
    });

    const svg = svgEl("svg", { class: "gd-rel-graph", viewBox: `0 0 ${width} ${height}` });
    for (const e of edges) {
      const p1 = pos.get(e.from), p2 = pos.get(e.to);
      if (!p1 || !p2) continue;
      svg.append(svgEl("line", {
        x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
        stroke: "#485874", "stroke-width": "1.5"
      }));
      const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
      svg.append(svgEl("text", {
        x: mx, y: my - 4, "text-anchor": "middle",
        fill: "#9fb1c9", "font-size": "10"
      }, e.label));
    }

    const colorByType = {
      creature: "#6ea8ff",
      move: "#ffd479",
      character: "#8fd8a0"
    };
    for (const n of nodes) {
      const [nx, ny] = pos.get(n.id);
      const g = svgEl("g", { style: "cursor:pointer" });
      g.addEventListener("click", () => selectEntity(n.type, n.id));
      g.append(svgEl("rect", {
        x: nx - 58, y: ny - 16, width: 116, height: 32, rx: 8,
        fill: n.ring === 0 ? "#202735" : "#171a21",
        stroke: colorByType[n.type] || "#6ea8ff",
        "stroke-width": n.ring === 0 ? "2.2" : "1.4"
      }));
      g.append(svgEl("text", {
        x: nx, y: ny + 4, "text-anchor": "middle",
        fill: "#dfe5ee", "font-size": "11.5", "font-weight": n.ring === 0 ? "700" : "500"
      }, n.label.length > 10 ? n.label.slice(0, 9) + "…" : n.label));
      svg.append(g);
    }

    return el("div", { class: "gd-card" },
      el("h3", {}, "角色 / 宙獸 / 技能 關係圖譜（點擊節點跳轉）"),
      svg
    );
  }

  function filteredItems() {
    const q = state.query.trim().toLowerCase();
    const out = [];
    const matchText = (...parts) => !q || parts.some(p => String(p || "").toLowerCase().includes(q));

    if (state.category === "all" || state.category === "character") {
      for (const ch of state.characters.values()) {
        if (state.element && ch.element !== state.element) continue;
        const zh = displayName(ch.character_id), en = displaySubName(ch.character_id);
        if (!matchText(ch.character_id, zh, en, ch.role, ch.terrain, ch.trial_boss_id, ch.signature_move)) continue;
        out.push({ type: "character", id: ch.character_id, zh, en, meta: [ROLE_ZH[ch.link_group] || ch.role || "角色", ELEMENT_ZH[ch.element] || ch.element].filter(Boolean) });
      }
    }
    if (state.category === "all" || state.category === "creature") {
      for (const cr of state.creatures.values()) {
        if (state.stage && cr.stage !== state.stage) continue;
        if (state.element && !Object.keys(cr.mastery || {}).includes(state.element)) continue;
        const zh = displayName(cr.id), en = displaySubName(cr.id);
        const protos = Array.isArray(cr.concept?.design_prototypes) ? cr.concept.design_prototypes : [];
        const morphs = [cr.concept?.base_entity, cr.concept?.morphology_primary, ...(cr.concept?.morphology_secondary || [])].filter(Boolean);
        if (!matchText(cr.id, cr.line_id, zh, en, cr.signature_move, cr.concept?.base, ...protos, ...morphs)) continue;
        const mainElems = Object.entries(cr.mastery || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => ELEMENT_ZH[k] || k).join("/");
        out.push({ type: "creature", id: cr.id, zh, en, meta: [STAGE_ZH[cr.stage] || cr.stage, cr.size_class, mainElems, protos[0], cr.concept?.morphology_primary].filter(Boolean) });
      }
    }
    if (state.category === "all" || state.category === "move") {
      for (const mv of state.moves.values()) {
        if (state.element && mv.element !== state.element) continue;
        const zh = displayName(mv.id), en = displaySubName(mv.id);
        if (!matchText(mv.id, zh, en, mv.element, mv.shape, mv.kind)) continue;
        out.push({ type: "move", id: mv.id, zh, en, meta: ["★" + mv.star, ELEMENT_ZH[mv.element] || mv.element, "威力 " + mv.power].filter(Boolean) });
      }
    }
    return out;
  }

  function renderList() {
    const listEl = document.getElementById("gdList");
    if (!listEl) return;
    listEl.replaceChildren();
    if (!state.loaded) return;

    if (state.category === "relation") {
      const q = state.query.trim().toLowerCase();
      const filtered = state.relations.filter(r =>
        !q || [r.a, r.b, r.kind, r.note, displayName(r.a), displayName(r.b)].some(s => String(s || "").toLowerCase().includes(q))
      );
      if (!filtered.length) {
        listEl.append(el("p", { class: "muted", style: "padding:10px" }, "無符合條件的關係邊。"));
        return;
      }
      for (const r of filtered) {
        listEl.append(el("button", {
          type: "button",
          class: "gd-item",
          onclick: () => selectEntity("creature", r.a)
        },
          el("div", { class: "gd-item-top" },
            el("span", { class: "gd-item-name" }, `${displayName(r.a)} ↔ ${displayName(r.b)}`),
            el("span", { class: "gd-badge" }, RELATION_ZH[r.kind] || r.kind)
          ),
          el("div", { class: "gd-item-sub" }, r.note || `${r.a} / ${r.b}`)
        ));
      }
      return;
    }

    const items = filteredItems();
    if (!items.length) {
      listEl.append(el("p", { class: "muted", style: "padding:10px" }, "沒有符合篩選條件的項目。"));
      return;
    }
    const typeTag = { character: "角色", creature: "宙獸", move: "技能" };
    for (const item of items) {
      const active = state.selected?.type === item.type && state.selected?.id === item.id;
      listEl.append(el("button", {
        type: "button",
        class: "gd-item" + (active ? " on" : ""),
        onclick: () => selectEntity(item.type, item.id)
      },
        el("div", { class: "gd-item-top" },
          el("span", { class: "gd-item-name" }, item.zh + (item.en ? ` (${item.en})` : "")),
          el("span", { class: "gd-badge" }, typeTag[item.type])
        ),
        el("div", { class: "gd-item-sub" },
          el("span", {}, item.id),
          ...item.meta.map(m => el("span", {}, "· " + m))
        )
      ));
    }
  }

  function linkButton(type, id, prefix = "") {
    const label = (prefix ? prefix + "：" : "") + displayName(id) + (displayName(id) !== id ? ` (${id})` : "");
    return el("button", {
      type: "button",
      class: "gd-link-btn",
      onclick: () => selectEntity(type, id)
    }, label);
  }

  function renderCreatureDetail(c) {
    const move = c.signature_move ? state.moves.get(c.signature_move) : null;
    const trait = c.trait ? state.traits.get(c.trait) : null;
    const rels = state.relations.filter(r => r.a === c.id || r.b === c.id);
    const linkedChars = state.charByCreature.get(c.id) || [];
    const preEvos = Array.from(state.creatures.values()).filter(x => x.evolves_to === c.id);
    const overloads = Array.from(state.creatures.values()).filter(x => x.overload_of === c.id);

    const header = el("div", { class: "gd-header" },
      el("div", {},
        el("h2", {}, displayName(c.id), displaySubName(c.id) ? el("span", { class: "gd-en" }, displaySubName(c.id)) : null),
        el("div", { class: "muted", style: "font-family:Consolas,monospace;margin-top:2px" }, `ID: ${c.id} · 系列: ${c.line_id}`)
      ),
      el("div", { class: "gd-badges" },
        el("span", { class: "gd-badge accent" }, STAGE_ZH[c.stage] || c.stage),
        el("span", { class: "gd-badge" }, `體型 ${c.size_class} (${SIZE_ZH[c.size_class] || ""})`),
        el("span", { class: "gd-badge" }, AI_STYLE_ZH[c.ai_style] || c.ai_style),
        c.concept?.base_entity ? el("span", { class: "gd-badge" }, c.concept.base_entity) : null,
        c.concept?.morphology_primary ? el("span", { class: "gd-badge accent" }, c.concept.morphology_primary) : null,
        ...(Array.isArray(c.concept?.morphology_secondary) ? c.concept.morphology_secondary.map(t => el("span", { class: "gd-badge" }, t)) : []),
        ...(Array.isArray(c.concept?.design_prototypes) ? c.concept.design_prototypes.map(p => el("span", { class: "gd-badge warn" }, p)) : []),
        c.field_utility && c.field_utility !== "none" ? el("span", { class: "gd-badge warn" }, `生活技：${c.field_utility}`) : null
      )
    );

    const hexCard = el("div", { class: "gd-card" },
      el("h3", {}, "LV100 六大能力點（六角圖）"),
      buildHexagonChart(c.stats, c.stage)
    );

    const elemCard = el("div", { class: "gd-card" },
      el("h3", {}, "屬性精通（Mastery）"),
      el("div", { class: "gd-elem-grid" },
        Object.entries(c.mastery || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
          el("div", { class: "gd-elem-cell" + (v >= 125 ? " peak" : "") },
            el("span", {}, ELEMENT_ZH[k] || k),
            el("strong", {}, String(v))
          )
        )
      ),
      el("h3", { style: "margin-top:6px" }, "屬性抗性（Resist · 100 為基準）"),
      el("div", { class: "gd-elem-grid" },
        Object.entries(c.resist || {}).map(([k, v]) =>
          el("div", { class: "gd-elem-cell" + (v > 100 ? " weak" : v < 100 ? " resist" : "") },
            el("span", {}, ELEMENT_ZH[k] || k),
            el("strong", {}, String(v))
          )
        )
      )
    );

    const skillAndTrait = el("div", { class: "gd-grid-2" },
      el("div", { class: "gd-card" },
        el("h3", {}, "專屬主動技（Signature Move）"),
        move ? el("div", { class: "gd-rel-list" },
          el("div", { class: "gd-rel-row" },
            linkButton("move", move.id),
            el("span", { class: "gd-badge accent" }, `${ELEMENT_ZH[move.element] || move.element} · ★${move.star}`),
            el("span", { class: "gd-badge" }, `威力 ${move.power} · CD ${move.cooldown_ms}ms`)
          ),
          move.effect ? el("div", { class: "muted" }, `附加效果：${move.effect.type} ${JSON.stringify(move.effect.params || {})}`) : null
        ) : el("p", { class: "muted" }, c.signature_move || "無")
      ),
      el("div", { class: "gd-card" },
        el("h3", {}, "特性（Trait）"),
        trait ? el("div", { class: "gd-rel-list" },
          el("div", { class: "gd-rel-row" },
            el("strong", {}, displayName(trait.id)),
            el("span", { class: "gd-badge" }, `★${trait.star} · ${trait.trigger?.type || ""}`)
          ),
          el("div", { class: "muted", style: "font-family:Consolas,monospace;font-size:11.5px" },
            JSON.stringify(trait.effects || [])
          )
        ) : el("p", { class: "muted" }, c.trait || "無")
      )
    );

    const relRows = [];
    for (const pre of preEvos) relRows.push(el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge" }, "進化前身"), linkButton("creature", pre.id)));
    if (c.evolves_to) {
      const mats = (c.evolution?.materials || []).map(m => `${ELEMENT_ZH[m.element] || m.element} T${m.tier} ×${m.qty}`).join("、");
      relRows.push(el("div", { class: "gd-rel-row" },
        el("span", { class: "gd-badge accent" }, `Lv.${c.evolution?.level ?? "?"} 進化`),
        linkButton("creature", c.evolves_to),
        mats ? el("span", { class: "muted" }, `材料：${mats}`) : null
      ));
    }
    if (c.overload_of) relRows.push(el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge warn" }, "超載來源"), linkButton("creature", c.overload_of)));
    for (const ov of overloads) relRows.push(el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge warn" }, "超載型態"), linkButton("creature", ov.id)));
    for (const chId of linkedChars) relRows.push(el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge" }, "關聯角色"), linkButton("character", chId)));
    for (const r of rels) {
      const otherId = r.a === c.id ? r.b : r.a;
      relRows.push(el("div", { class: "gd-rel-row" },
        el("span", { class: "gd-badge" }, RELATION_ZH[r.kind] || r.kind),
        linkButton("creature", otherId),
        r.note ? el("span", { class: "muted" }, r.note) : null
      ));
    }

    const relCard = el("div", { class: "gd-card" },
      el("h3", {}, "進化與關係明細"),
      relRows.length ? el("div", { class: "gd-rel-list" }, relRows) : el("p", { class: "muted" }, "無關聯記錄")
    );

    const graphCard = renderRelationGraphFor("creature", c.id);

    return [header, el("div", { class: "gd-grid-2" }, hexCard, elemCard), skillAndTrait, relCard, graphCard].filter(Boolean);
  }

  function renderMoveDetail(m) {
    const users = state.moveUsers.get(m.id) || [];
    const chars = state.charByMove.get(m.id) || [];

    const header = el("div", { class: "gd-header" },
      el("div", {},
        el("h2", {}, displayName(m.id), displaySubName(m.id) ? el("span", { class: "gd-en" }, displaySubName(m.id)) : null),
        el("div", { class: "muted", style: "font-family:Consolas,monospace;margin-top:2px" }, `ID: ${m.id}`)
      ),
      el("div", { class: "gd-badges" },
        el("span", { class: "gd-badge accent" }, `${ELEMENT_ZH[m.element] || m.element} (${m.element})`),
        el("span", { class: "gd-badge warn" }, "★".repeat(m.star || 1)),
        el("span", { class: "gd-badge" }, KIND_ZH[m.kind] || m.kind),
        m.polarity ? el("span", { class: "gd-badge" }, POLARITY_ZH[m.polarity] || m.polarity) : null
      )
    );

    const statsGrid = el("div", { class: "gd-card" },
      el("h3", {}, "技能詳細數值"),
      el("div", { class: "gd-kv-grid" },
        ...[
          ["威力 (power)", m.power],
          ["冷卻 (cooldown)", `${m.cooldown_ms} ms`],
          ["前搖 (windup)", `${m.windup_ms} ms`],
          ["命中率 (accuracy)", `${m.accuracy}%`],
          ["射程分類", RANGE_ZH[m.range_class] || m.range_class],
          ["判定形狀", SHAPE_ZH[m.shape] || m.shape],
          ["基礎範圍", `${m.base_range_mm} mm`],
          ["移動類型", m.movement || "none"],
          m.origin ? ["爆破原點", m.origin] : null,
          m.effect_duration_ms ? ["效果持續", `${m.effect_duration_ms} ms`] : null,
          m.field_duration_ms ? ["場地持續", `${m.field_duration_ms} ms`] : null
        ].filter(Boolean).map(([k, v]) =>
          el("div", { class: "gd-kv" }, el("div", { class: "gd-kv-k" }, k), el("div", { class: "gd-kv-v" }, String(v)))
        )
      )
    );

    const effectCard = el("div", { class: "gd-card" },
      el("h3", {}, "遊戲效果與夥伴降星對照"),
      m.effect
        ? el("div", { class: "gd-kv" },
            el("div", { class: "gd-kv-k" }, "效果類型：" + m.effect.type),
            el("div", { class: "gd-kv-v" }, JSON.stringify(m.effect.params || {}))
          )
        : el("p", { class: "muted" }, "純傷害技能，無額外狀態效果。"),
      m.downgraded
        ? el("div", { class: "gd-kv", style: "margin-top:6px" },
            el("div", { class: "gd-kv-k" }, "★1 夥伴共用降星版（downgraded）"),
            el("div", { class: "gd-kv-v" }, JSON.stringify(m.downgraded))
          )
        : null
    );

    const relRows = [
      ...users.map(cid => el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge accent" }, "宙獸專屬技"), linkButton("creature", cid))),
      ...chars.map(chid => el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge" }, "關聯角色"), linkButton("character", chid)))
    ];
    const relCard = el("div", { class: "gd-card" },
      el("h3", {}, "使用此技能的宙獸／角色"),
      relRows.length ? el("div", { class: "gd-rel-list" }, relRows) : el("p", { class: "muted" }, "尚未綁定宙獸或角色")
    );

    return [header, statsGrid, effectCard, relCard, renderRelationGraphFor("move", m.id)].filter(Boolean);
  }

  function renderCharacterDetail(ch) {
    const linkedCreature = ch.trial_boss_id || ch.creature_id;
    const header = el("div", { class: "gd-header" },
      el("div", {},
        el("h2", {}, displayName(ch.character_id), displaySubName(ch.character_id) ? el("span", { class: "gd-en" }, displaySubName(ch.character_id)) : null),
        el("div", { class: "muted", style: "font-family:Consolas,monospace;margin-top:2px" }, `ID: ${ch.character_id}`)
      ),
      el("div", { class: "gd-badges" },
        el("span", { class: "gd-badge accent" }, ROLE_ZH[ch.link_group] || ch.role || "角色"),
        ch.element ? el("span", { class: "gd-badge" }, ELEMENT_ZH[ch.element] || ch.element) : null,
        ch.terrain ? el("span", { class: "gd-badge" }, `場域：${ch.terrain}`) : null,
        ch.field_utility ? el("span", { class: "gd-badge warn" }, `生活職能：${ch.field_utility}`) : null
      )
    );

    const linksCard = el("div", { class: "gd-card" },
      el("h3", {}, "角色 / 宙獸 / 技能 關聯"),
      el("div", { class: "gd-rel-list" },
        linkedCreature ? el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge accent" }, "關聯宙獸"), linkButton("creature", linkedCreature)) : null,
        ch.signature_move ? el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge warn" }, "關聯技能"), linkButton("move", ch.signature_move)) : null,
        ch.trait ? el("div", { class: "gd-rel-row" }, el("span", { class: "gd-badge" }, "關聯特性"), el("span", {}, `${displayName(ch.trait)} (${ch.trait})`)) : null
      )
    );

    return [header, linksCard, renderRelationGraphFor("character", ch.character_id)].filter(Boolean);
  }

  function renderDetail() {
    const detailEl = document.getElementById("gdDetail");
    if (!detailEl) return;
    detailEl.replaceChildren();

    if (!state.loaded) {
      detailEl.append(el("div", { class: "gd-empty" },
        el("h3", {}, "尚未載入 cosmos_chimera 專案資料"),
        el("p", {}, state.dirHandle
          ? `已記住專案資料夾「${state.sourceLabel}」，點擊下方按鈕授權讀取最新遊戲數據。`
          : "請選取本機 cosmos_chimera 專案根目錄（例如 ../cosmos_chimera），唯讀瀏覽角色、宙獸、技能數值與彼此關係。"),
        el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;justify-content:center" },
          state.dirHandle
            ? el("button", { type: "button", class: "btn", onclick: reloadSavedHandle }, `⟳ 讀取 ${state.sourceLabel}`)
            : null,
          el("button", { type: "button", class: state.dirHandle ? "btn ghost" : "btn", onclick: pickDirectory }, "📂 選取 cosmos_chimera 資料夾")
        )
      ));
      return;
    }

    if (!state.selected) {
      detailEl.append(el("div", { class: "gd-empty" }, el("p", {}, "請從左側清單選擇角色、宙獸或技能。")));
      return;
    }

    const { type, id } = state.selected;
    if (type === "creature" && state.creatures.has(id)) {
      detailEl.append(...renderCreatureDetail(state.creatures.get(id)));
    } else if (type === "move" && state.moves.has(id)) {
      detailEl.append(...renderMoveDetail(state.moves.get(id)));
    } else if (type === "character" && state.characters.has(id)) {
      detailEl.append(...renderCharacterDetail(state.characters.get(id)));
    } else {
      detailEl.append(el("div", { class: "gd-empty" }, el("p", {}, `找不到資料：${type} / ${id}`)));
    }
  }

  function render() {
    if (state.loading) {
      setStatus("正在讀取 cosmos_chimera 專案資料…");
    } else if (state.loaded) {
      setStatus(`已連結：${state.sourceLabel} ｜ 角色 ${state.characters.size} · 宙獸 ${state.creatures.size} · 技能 ${state.moves.size} · 特性 ${state.traits.size} · 關係 ${state.relations.length}`);
    } else if (state.dirHandle) {
      setStatus(`待授權讀取：${state.sourceLabel}`);
    } else {
      setStatus("未連結 cosmos_chimera 資料夾");
    }
    renderList();
    renderDetail();
  }

  function mount() {
    const host = document.getElementById("gameDataView");
    if (!host || host.dataset.mounted) return;
    host.dataset.mounted = "1";

    const folderInput = el("input", {
      type: "file",
      id: "gameDataFolderInput",
      webkitdirectory: "",
      multiple: "",
      hidden: true,
      onchange: (e) => handleFolderInput(e.target.files)
    });

    const catSelect = el("select", {
      "aria-label": "分類篩選",
      onchange: (e) => { state.category = e.target.value; renderList(); }
    },
      el("option", { value: "all" }, "全部項目"),
      el("option", { value: "character" }, "角色 / 關聯"),
      el("option", { value: "creature" }, "宙獸 (含六角圖)"),
      el("option", { value: "move" }, "技能 (詳細數值)"),
      el("option", { value: "relation" }, "關係邊清單")
    );

    const elemSelect = el("select", {
      "aria-label": "屬性篩選",
      onchange: (e) => { state.element = e.target.value; renderList(); }
    },
      el("option", { value: "" }, "全部屬性"),
      ...Object.entries(ELEMENT_ZH).map(([k, v]) => el("option", { value: k }, `${v} (${k})`))
    );

    const stageSelect = el("select", {
      "aria-label": "型態篩選",
      onchange: (e) => { state.stage = e.target.value; renderList(); }
    },
      el("option", { value: "" }, "全部型態"),
      ...Object.entries(STAGE_ZH).map(([k, v]) => el("option", { value: k }, v))
    );

    const searchInput = el("input", {
      type: "search",
      placeholder: "搜尋 ID、中文/英文名稱、系列或技能…",
      "aria-label": "搜尋遊戲數據",
      oninput: (e) => { state.query = e.target.value; renderList(); }
    });

    host.append(
      folderInput,
      el("div", { class: "gd-toolbar" },
        el("h2", { id: "gameDataTitle", style: "margin:0;font-size:13px;color:var(--ink)" }, "cosmos_chimera 遊戲數據瀏覽"),
        el("button", { type: "button", class: "btn mini", onclick: pickDirectory }, "📂 選取 cosmos_chimera（主來源）"),
        el("button", { type: "button", class: "btn ghost mini", onclick: reloadSavedHandle }, "⟳ 重新讀取"),
        el("button", { type: "button", class: "btn ghost mini", onclick: loadFromDriveGameData }, "☁ 讀取 Drive game_data/（次要）"),
        el("span", { class: "gd-boundary-badge" }, "主來源：cosmos_chimera｜與美術/動畫/Wiki嚴格分檔"),
        el("span", { id: "gdStatusText", class: "gd-status", role: "status" }, "")
      ),
      el("div", { class: "gd-filters" }, catSelect, elemSelect, stageSelect, searchInput),
      el("div", { class: "gd-main" },
        el("div", { id: "gdList", class: "gd-list", role: "listbox", "aria-label": "遊戲資料清單" }),
        el("div", { id: "gdDetail", class: "gd-detail" })
      )
    );

    render();
  }

  function onActivate() {
    mount();
    if (!state.loaded && !state.loading) {
      void tryRestoreSavedHandle();
    }
  }

  document.addEventListener("DOMContentLoaded", mount);
  root.COSMI_GAME_DATA = Object.freeze({ onActivate, pickDirectory, state });
})(window);
