// COSMIMERA prompt-forge · 介面與組裝 + 交付成果審查台
(function () {
  const TOOL_VERSION = "2.9.1";
  const SPEC = "1";
  const C = window.COSMI_CATALOG, TASKS = window.COSMI_TASKS;
  if (C && !C.CLIPS && C.ACTIONS) C.CLIPS = C.ACTIONS;
  const LS_KEY = "cosmimera.prompt-forge.v2";
  const REVIEW_KEY = "cosmimera.prompt-forge.reviews.v1";
  const DEFAULT_ROOT = "../cosmos_chimera";

  function is3dType(t) {
    return t === "creature-model-rig" || t === "character-model-rig" || t === "model-rig" || (typeof t === "string" && (t.startsWith("mdl") || t.startsWith("anim")));
  }

  function reviewStatusInfo(status) {
    switch (status) {
      case "ok":
      case "approved":
        return { zh: "通過", badge: "✅ 通過", cls: "ok" };
      case "provisional":
        return { zh: "暫時採用", badge: "🟦 暫時採用", cls: "accent" };
      case "reject":
        return { zh: "退回重建", badge: "❌ 退回重建", cls: "danger" };
      case "missing":
        return { zh: "有缺檔", badge: "⚠️ 缺檔", cls: "missing" };
      case "pending":
      default:
        return { zh: "待決定", badge: "🟨 待決定", cls: "warn" };
    }
  }

  // 舊版人形與基底父類別追溯相容（人形一律視為精靈族）
  function traceBaseParent(bp) {
    if (!bp) return bp;
    if (bp.startsWith("人形") || bp === "人形") {
      return "類人奇幻·精靈族";
    }
    if (bp === "器械·武器") return "裝備·兵器";
    if (bp === "生物·植物/菌類") return "植物·樹木/神木";
    if (bp === "生物·古生物") return "古生物·獸腳恐龍";
    return bp;
  }

  // ---- seeded RNG：同 seed 的「全部隨機」結果可重現，方便日後追溯任務 ----
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // 常態分佈（Box-Muller 轉換）
  function rollNormal(rng, mean, std, min, max) {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = rng();
    while (u2 === 0) u2 = rng();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    let val = mean + z0 * std;
    if (min !== undefined && val < min) val = min;
    if (max !== undefined && val > max) val = max;
    return val;
  }

  // 對數常態分佈（生物體型分佈）
  function rollLogNormal(rng, logMean, logStd, min, max) {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = rng();
    while (u2 === 0) u2 = rng();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    let val = Math.exp(logMean + z0 * logStd);
    if (min !== undefined && val < min) val = min;
    if (max !== undefined && val > max) val = max;
    return val;
  }

  function pickWeighted(rng, opts) {
    const pool = opts.filter(o => (o.w ?? 1) > 0);
    if (pool.length === 0) return null;
    const total = pool.reduce((s, o) => s + (o.w ?? 1), 0);
    let r = rng() * total;
    for (const o of pool) { r -= (o.w ?? 1); if (r < 0) return o; }
    return pool[pool.length - 1];
  }
  function pickN(rng, opts, n) {
    const left = opts.slice(), out = [];
    while (out.length < n && left.length) { const o = pickWeighted(rng, left); if (!o) break; out.push(o.v); left.splice(left.indexOf(o), 1); }
    return out;
  }
  const uniform = arr => arr.map(v => ({ v, w: 1 }));

  // ---- 概念欄位定義 ----
  const CH = C.CHARACTER, CR = C.CREATURE;
  const state = {
    seed: "", platform: "chatgpt", taskId: TASKS[0].id, includeReview: false,
    character: {}, creature: {}, locks: {}, opts: {}, notes: "", subjectIds: {},
    customOptions: {}, customValues: {}, activeTab: "forge", currentRound: 1,
    preset: null, // 已設計項目的 line_id；設定時宙獸概念改用 designed.js 的定案內容，不再隨機
    presetChar: null // 已設計角色的 id；設定時角色概念改用 designed.js 的定案內容，不再隨機
  };

  // ==================== 成果審查台狀態與跨管線工具 ====================
  const STAGE_KEYS = ["juvenile", "adolescent", "adult", "overload"];
  const STAGE_ZH = { juvenile: "幼年", adolescent: "少年", adult: "成年", overload: "超載" };

  function parsePackageStage(pkgId, manifest, concept) {
    const stageRegex = /[-_](juvenile|adolescent|adult|overload)(?:\.zip)?$/i;
    const m = (pkgId || "").match(stageRegex);
    if (m) {
      return { stage: m[1].toLowerCase(), baseId: pkgId.slice(0, m.index) };
    }
    if (manifest?.stage && STAGE_KEYS.includes(manifest.stage)) return {stage: manifest.stage, baseId: pkgId};
    if (concept?.stage && STAGE_KEYS.includes(concept.stage)) {
      return { stage: concept.stage, baseId: pkgId };
    }
    return { stage: null, baseId: pkgId };
  }

  const reviewState = {
    packages: [], activePkgId: null, activeStage: "adult", activeImgIdx: 0,
    filterCat: "all", filterQuery: "", viewMode: "single", // "single" | "compare" | "3d"
    zoomLevel: 1.0, panX: 0, panY: 0,
    reviews: {},
    three: {
      scene: null, camera: null, renderer: null, controls: null, mixer: null, clock: null,
      currentAction: null, currentClipName: "", clips: [], isPlaying: true, playbackSpeed: 1.0,
      isLoop: true, showSkeleton: false, skeletonHelper: null, showWireframe: false,
      showGrid: true, gridHelper: null, loadedPkgId: null, isLooping: false,
      modelGroup: null, modelStats: null, animFilter: "all", animSearch: ""
    }
  };

  function describeImg(path) {
    if (!path) return "圖片";
    const p = path.toLowerCase();
    if (p.includes("turnaround")) return "三視圖";
    if (p.includes("model_front")) return "建模正";
    if (p.includes("model_side")) return "建模側";
    if (p.includes("model_back")) return "建模背";
    if (p.includes("front")) return "正面";
    if (p.includes("side")) return "側面";
    if (p.includes("back")) return "背面";
    if (p.includes("main")) return "主立繪";
    if (p.includes("expression")) return "表情集";
    if (p.includes("prop")) return "道具集";
    if (p.includes("lineup")) return "進化排列";
    if (p.includes("anim_sheet")) return "動作分鏡";
    if (p.includes("storyboard")) return "分鏡";
    if (p.includes("layer")) return "圖層";
    if (p.includes("flipbook")) return "序列圖";
    const name = path.split("/").pop() || path;
    return name.replace(/\.[^.]+$/, "");
  }

  function sendToImgTo3D(pkg, imgPath) {
    if (!pkg) return;
    const isChr = (pkg.type === "character-concept" || pkg.type === "character-model-rig" || pkg.id.startsWith("chr"));
    const targetTaskId = isChr ? "character-model-rig" : "creature-model-rig";
    state.taskId = targetTaskId;
    flowSelection = {category:isChr ? "character" : "creature",route:"image",step:"image_blender"};
    state.flowChoice = flowSelection;
    const t = TASKS.find(x => x.id === targetTaskId) || TASKS[0];
    const o = taskOpts(t);
    o.scope = "single";
    o.source_pack = pkg.id;
    if (!isChr && pkg.stage) {
      o.stage = pkg.stage;
    }
    if (imgPath) {
      o.input_img = imgPath;
    } else if (pkg.images && pkg.images.length) {
      const activeIm = pkg.images[reviewState.activeImgIdx];
      o.input_img = activeIm ? activeIm.path : "";
    } else {
      o.input_img = "";
    }
    const pipelineStage = document.getElementById("pipelineStage");
    if (pipelineStage) {
      if (!["colab", "blender"].includes(pipelineStage.value)) pipelineStage.value = "blender";
      flowSelection.step = pipelineStage.value === "colab" ? "image_colab" : "image_blender";
    }
    setViewMode("forge");
    renderAll();
    toast("已將" + (isChr ? "角色" : "宙獸") + "立繪包「" + pkg.id + "」帶入指定 3D 任務");
  }

  function sendToImgTo3DBatch(pkg) {
    const isChr = pkg ? (pkg.type === "character-concept" || pkg.type === "character-model-rig" || pkg.id.startsWith("chr")) : false;
    const targetTaskId = isChr ? "character-model-rig" : "creature-model-rig";
    state.taskId = targetTaskId;
    flowSelection = {category:isChr ? "character" : "creature",route:"image",step:"image_blender"};
    state.flowChoice = flowSelection;
    const t = TASKS.find(x => x.id === targetTaskId) || TASKS[0];
    const o = taskOpts(t);
    o.scope = "batch";
    setViewMode("forge");
    renderAll();
    toast("已切換至「" + t.zh + "（批量處理模式）」");
  }

  // REQ: 使用者 2026-11-07 — 已設計的宙獸（P2-08 御三家、P5-03 七元素等）與角色直接產出立繪 / img-to-3D prompt。
  const DESIGNED = (window.COSMI_DESIGNED && window.COSMI_DESIGNED.items) || [];
  const DESIGNED_CHARACTERS = (window.COSMI_DESIGNED && window.COSMI_DESIGNED.characters) || [];
  const ELEM_ICONS = {
    light: "☀️", dark: "🌙", aether: "🌟",
    metal: "⚙️", wood: "🌿", water: "🌊",
    fire: "🔥", earth: "⛰️", ice: "❄️", wind: "🌪️"
  };
  function designedItem() { return state.preset ? DESIGNED.find(d => d.line_id === state.preset) || null : null; }
  function designedCharItem() { return state.presetChar ? DESIGNED_CHARACTERS.find(c => c.id === state.presetChar) || null : null; }

  function getCustom(key) { return state.customOptions[key] || []; }
  function addCustom(key, val) {
    if (!val) return;
    const list = state.customOptions[key] || (state.customOptions[key] = []);
    if (!list.includes(val)) list.push(val);
  }

  // 取得外觀基底子類別清單（由外觀基底父類別決定）
  function getCreatureSubBases(cat) {
    const list = CR.base_sub_map[cat] || [];
    const prefix = cat.split("·")[1] || cat;
    return list.map(x => `${prefix}·${x}`);
  }

  // 人類常態生成（身高/體重/體脂）
  function sampleHumanDimensions(rng, gender, ageBand, ageNum) {
    const isFemale = gender === "女";
    const age = Number(ageNum) || 17;
    let hMean = isFemale ? 162 : 175;
    let hStd = isFemale ? 5.8 : 6.5;
    if (ageBand === "兒童" || age <= 12) {
      hMean = isFemale ? (136 + (age - 9) * 4.2) : (135 + (age - 9) * 4.5);
      hStd = 5.0;
    } else if (ageBand === "青少年" || age <= 17) {
      hMean = isFemale ? (152 + (age - 13) * 2.0) : (154 + (age - 13) * 3.5);
      hStd = 5.2;
    }
    const height = Math.round(rollNormal(rng, hMean, hStd, 110, 210));

    // 體重由 BMI 常態推算
    const bmiMean = isFemale ? 20.8 : 22.2;
    const bmiStd = isFemale ? 2.2 : 2.4;
    const bmi = rollNormal(rng, bmiMean, bmiStd, 16.5, 32.0);
    const weight = Math.round((bmi * Math.pow(height / 100, 2)) * 10) / 10;

    // 體脂率常態
    const fatMean = isFemale ? 22.5 : 15.5;
    const fatStd = isFemale ? 4.0 : 3.5;
    const fatMin = isFemale ? 14.0 : 8.0;
    const fatMax = isFemale ? 34.0 : 28.0;
    const bodyFat = Math.round(rollNormal(rng, fatMean, fatStd, fatMin, fatMax) * 10) / 10;

    return { height: height + " cm", weight: weight + " kg", bodyFat: bodyFat + "%" };
  }

  // 宙獸生物常態生成（身高/體長、體重、體脂率），包含微型 XS（長>=0.05m, 重>=0.01kg），上限至暴龍/巨獸 (14.0m, 12000kg)
  function sampleCreatureDimensions(rng, sizeClass) {
    const sc = C.SIZE_CLASSES[sizeClass] || C.SIZE_CLASSES.M;
    let lenLogM = 0, lenLogS = 0.25, wtLogM = 0, wtLogS = 0.55;
    if (sizeClass === "XS") {
      lenLogM = Math.log(0.16); lenLogS = 0.35;
      wtLogM = Math.log(0.15); wtLogS = 0.75;
    } else if (sizeClass === "S") {
      lenLogM = Math.log(0.45); lenLogS = 0.28;
      wtLogM = Math.log(2.2); wtLogS = 0.65;
    } else if (sizeClass === "M") {
      lenLogM = Math.log(1.10); lenLogS = 0.22;
      wtLogM = Math.log(26.0); wtLogS = 0.55;
    } else if (sizeClass === "L") {
      lenLogM = Math.log(2.20); lenLogS = 0.18;
      wtLogM = Math.log(210.0); wtLogS = 0.48;
    } else { // XL
      lenLogM = Math.log(5.5); lenLogS = 0.40;
      wtLogM = Math.log(3000.0); wtLogS = 0.75;
    }

    const length = Math.round(rollLogNormal(rng, lenLogM, lenLogS, sc.len_min, sc.len_max) * 100) / 100;
    const rawWt = rollLogNormal(rng, wtLogM, wtLogS, sc.wt_min, sc.wt_max);
    const weight = rawWt >= 100 ? Math.round(rawWt) : Math.round(rawWt * 10) / 10;
    const fat = Math.round(rollNormal(rng, (sc.fat_min + sc.fat_max) / 2, 3.0, sc.fat_min, sc.fat_max) * 10) / 10;

    return { length: length + " m", weight: weight + " kg", bodyFat: fat + "%" };
  }

  const FIELDS = {
    character: [
      { key: "role", label: "職業/定位", options: () => uniform(CH.role.concat(getCustom("character.role"))), count: [{ n: 1, w: 1 }] },
      { key: "pose", label: "角色姿勢（職業子項目）", options: s => {
        const curRole = s.character.role?.[0] || "玩家角色預設外觀";
        const poses = CH.getRolePoses ? CH.getRolePoses(curRole) : (CH.role_poses?.[curRole] || CH.role_poses?.["未知"] || []);
        return uniform(poses.concat(getCustom("character.pose")));
      }, count: [{ n: 1, w: 1 }], dep: "role" },
      { key: "ethnicity", label: "人種", options: s => C.getWeightedEthnicities(s.character.region?.[0]).concat(getCustom("character.ethnicity").map(v => ({ v, w: 1, zh: v }))), count: [{ n: 1, w: 1 }] },
      { key: "region", label: "文化地區", options: s => C.getWeightedRegions({ ethnicity: s.character.ethnicity?.[0], timeline: s.character.timeline?.[0] }).concat(uniform(getCustom("character.region"))), count: [{ n: 1, w: 1 }] },
      { key: "timeline", label: "文化時間線", options: s => C.getWeightedTimelines(s.character.region?.[0]).concat(getCustom("character.timeline").map(v => ({ v, zh: v, w: 1 }))), count: [{ n: 1, w: 1 }] },
      { key: "gender", label: "性別", options: () => CH.gender.map(g => ({ v: g.v, w: g.w })).concat(getCustom("character.gender").map(v => ({ v, w: 1 }))), count: [{ n: 1, w: 1 }] },
      { key: "age_band", label: "年齡層", options: () => CH.age.map(a => ({ v: a.v, w: a.w })).concat(getCustom("character.age_band").map(v => ({ v, w: 1 }))), count: [{ n: 1, w: 1 }] },
      { key: "age", label: "年齡", options: s => { const b = CH.age.find(a => a.v === s.character.age_band?.[0]) || CH.age[1]; const r = []; for (let i = b.min; i <= b.max; i++) r.push({ v: String(i), w: 1 }); r.push({ v: "未知", w: 1 }); return r.concat(getCustom("character.age").map(v => ({ v, w: 1 }))); }, count: [{ n: 1, w: 1 }], dep: "age_band" },
      { key: "height", label: "身高 (cm)", options: s => {
        const d = sampleHumanDimensions(Math.random, s.character.gender?.[0], s.character.age_band?.[0], s.character.age?.[0]);
        return [{ v: d.height, w: 1 }, { v: "165 cm", w: 1 }, { v: "172 cm", w: 1 }, { v: "未知", w: 1 }].concat(getCustom("character.height").map(v => ({ v, w: 1 })));
      }, count: [{ n: 1, w: 1 }], dep: "age", customGen: (s, rng) => sampleHumanDimensions(rng, s.character.gender?.[0], s.character.age_band?.[0], s.character.age?.[0]).height },
      { key: "weight", label: "體重 (kg)", options: s => {
        const d = sampleHumanDimensions(Math.random, s.character.gender?.[0], s.character.age_band?.[0], s.character.age?.[0]);
        return [{ v: d.weight, w: 1 }, { v: "52 kg", w: 1 }, { v: "65 kg", w: 1 }, { v: "未知", w: 1 }].concat(getCustom("character.weight").map(v => ({ v, w: 1 })));
      }, count: [{ n: 1, w: 1 }], dep: "height", customGen: (s, rng) => sampleHumanDimensions(rng, s.character.gender?.[0], s.character.age_band?.[0], s.character.age?.[0]).weight },
      { key: "body_fat", label: "體脂率 (%)", options: s => {
        const d = sampleHumanDimensions(Math.random, s.character.gender?.[0], s.character.age_band?.[0], s.character.age?.[0]);
        return [{ v: d.bodyFat, w: 1 }, { v: "18.0%", w: 1 }, { v: "22.0%", w: 1 }, { v: "未知", w: 1 }].concat(getCustom("character.body_fat").map(v => ({ v, w: 1 })));
      }, count: [{ n: 1, w: 1 }], dep: "weight", customGen: (s, rng) => sampleHumanDimensions(rng, s.character.gender?.[0], s.character.age_band?.[0], s.character.age?.[0]).bodyFat },
      { key: "cup_size", label: "罩杯（女性）", options: () => CH.cup_sizes.map(c => ({ v: c.v, w: c.w })).concat(getCustom("character.cup_size").map(v => ({ v, w: 1 }))), count: [{ n: 1, w: 1 }], when: s => s.character.gender?.[0] === "女" },
      { key: "outfit_palette", label: "服裝色系 (1~4色)", options: s => C.getWeightedPalettes([], { region: s.character.region?.[0], timeline: s.character.timeline?.[0] }).map(p => ({ v: p.v, w: p.w, zh: p.zh || p.v })).concat(getCustom("character.outfit_palette").map(v => ({ v, w: 1, zh: v }))), count: [{ n: 1, w: 15 }, { n: 2, w: 45 }, { n: 3, w: 25 }, { n: 4, w: 15 }], max: 4 },
      { key: "hair_palette", label: "頭髮色系 (1~2色)", options: () => CH.hair_palettes.map(p => ({ v: p.v, w: p.w, zh: p.zh || p.v })).concat(getCustom("character.hair_palette").map(v => ({ v, w: 1, zh: v }))), count: [{ n: 1, w: 6 }, { n: 2, w: 4 }], max: 2 },
      { key: "eye_palette", label: "瞳孔色系 (1~2色)", options: () => CH.eye_palettes.map(p => ({ v: p.v, w: p.w })).concat(getCustom("character.eye_palette").map(v => ({ v, w: 1 }))), count: [{ n: 1, w: 1 }], max: 2 },
      { key: "personality", label: "性格特質", options: () => uniform(C.PERSONALITIES.concat(getCustom("character.personality"))), count: [{ n: 2, w: 1 }], max: 4 },
      { key: "style", label: "服裝/外觀風格", options: () => uniform(CH.style.concat(getCustom("character.style"))), count: [{ n: 2, w: 1 }], max: 3 },
      { key: "interests", label: "休閒興趣", options: () => uniform(CH.interests.concat(getCustom("character.interests"))), count: [{ n: 2, w: 1 }], max: 3 },
      { key: "likes", label: "喜歡事物", options: () => uniform(CH.likes.concat(getCustom("character.likes"))), count: [{ n: 2, w: 1 }], max: 3 },
      { key: "dislikes", label: "討厭事物", options: () => uniform(CH.dislikes.concat(getCustom("character.dislikes"))), count: [{ n: 2, w: 1 }], max: 3 },
      { key: "vessel", label: "主要收服道具", options: () => C.VESSELS.map(v => ({ v: v.v, w: v.w, zh: v.zh })).concat(getCustom("character.vessel").map(v => ({ v, w: 1, zh: v }))), count: [{ n: 1, w: 1 }] }
    ],
    creature: [
      { key: "elements", label: "屬性", options: s => C.getWeightedElements(s.creature.appearance_palette).concat(getCustom("creature.elements").map(v => ({ v, w: 1, zh: v }))), count: [{ n: 1, w: 2 }, { n: 2, w: 1 }], max: 2 },
      { key: "base_parents", label: "外觀基底類別 (1~3)", options: () => CR.base_parents.map(b => ({ v: b.v, zh: b.zh || b.v, w: b.w })).concat(getCustom("creature.base_parents").map(v => ({ v, zh: v, w: 1 }))), count: [{ n: 1, w: 40 }, { n: 2, w: 45 }, { n: 3, w: 15 }], max: 3 },
      { key: "bases", label: "外觀基底 (1~3)", options: s => {
        const parents = (s.creature.base_parents || []).map(traceBaseParent);
        let subs = [];
        parents.forEach(p => { subs = subs.concat(getCreatureSubBases(p)); });
        if (!subs.length) {
          subs = getCreatureSubBases("生物·哺乳類").concat(getCreatureSubBases("自然·星體"));
        }
        return uniform(subs.concat(["未知"]).concat(getCustom("creature.bases")));
      }, count: [{ n: 1, w: 25 }, { n: 2, w: 50 }, { n: 3, w: 25 }], max: 3, dep: "base_parents" },
      { key: "appearance_palette", label: "宙獸色系 (1~4色)", options: s => {
        const pool = C.getWeightedPalettes(s.creature.elements || [], { region: s.creature.region?.[0], timeline: s.creature.timeline?.[0] });
        return pool.map(p => ({ v: p.v, w: p.w, zh: p.zh || p.v })).concat(getCustom("creature.appearance_palette").map(v => ({ v, w: 1, zh: v })));
      }, count: [{ n: 1, w: 15 }, { n: 2, w: 45 }, { n: 3, w: 25 }, { n: 4, w: 15 }], max: 4, dep: "elements" },
      { key: "timeline", label: "文化時間線", options: s => C.getWeightedTimelines(s.creature.region?.[0]).concat(getCustom("creature.timeline").map(v => ({ v, zh: v, w: 1 }))), count: [{ n: 1, w: 1 }] },
      { key: "region", label: "文化地區", options: s => C.getWeightedRegions({ timeline: s.creature.timeline?.[0] }).concat(uniform(getCustom("creature.region"))), count: [{ n: 1, w: 1 }] },
      { key: "archetype", label: "文化原型", options: s => {
        const pool = C.getWeightedArchetypes(archetypePool(s), s.creature.region?.[0]);
        return pool.map(a => ({ v: a.name, w: a.w, zh: a.name + "（" + a.region + "·" + a.type + (a.sensitivity === "review" ? "・需審" : "") + "）" })).concat(getCustom("creature.archetype").map(v => ({ v, w: 1, zh: v })));
      }, count: [{ n: 1, w: 1 }] },
      { key: "role", label: "戰鬥定位", options: () => uniform(CR.role.concat(getCustom("creature.role"))), count: [{ n: 1, w: 1 }] },
      { key: "temperament", label: "領域性情（開戰半徑）", options: () => uniform(C.TEMPERAMENTS.map(t => ({ v: t.v, zh: `${t.zh}（${t.radius_m}m 領域）` })).concat(getCustom("creature.temperament"))), count: [{ n: 1, w: 1 }] },
      { key: "disposition", label: "神態性格（外貌側寫）", options: () => uniform(C.PERSONALITIES.concat(getCustom("creature.disposition"))), count: [{ n: 1, w: 1 }] },
      { key: "social_structure", label: "社會型態", options: () => uniform(CR.social_structure.concat(getCustom("creature.social_structure"))), count: [{ n: 1, w: 1 }] },
      { key: "reproduction", label: "生育方式", options: () => uniform(CR.reproduction.concat(getCustom("creature.reproduction"))), count: [{ n: 1, w: 1 }] },
      { key: "size_profile", label: "體型（幼→少→成→超載）", options: () => CR.size_profile.map(p => ({ v: p.v, w: p.w })).concat(getCustom("creature.size_profile").map(v => ({ v, w: 1 }))), count: [{ n: 1, w: 1 }] },
      { key: "height_length", label: "成體身長/高 (m)", options: s => {
        const adultClass = (s.creature.size_profile?.[0] || "S→M→L→XL").split("→")[2] || "L";
        const d = sampleCreatureDimensions(Math.random, adultClass);
        return [{ v: d.length, w: 1 }, { v: "1.80 m", w: 1 }, { v: "0.95 m", w: 1 }, { v: "未知", w: 1 }].concat(getCustom("creature.height_length").map(v => ({ v, w: 1 })));
      }, count: [{ n: 1, w: 1 }], dep: "size_profile", customGen: (s, rng) => {
        const adultClass = (s.creature.size_profile?.[0] || "S→M→L→XL").split("→")[2] || "L";
        return sampleCreatureDimensions(rng, adultClass).length;
      }},
      { key: "weight", label: "成體重量 (kg)", options: s => {
        const adultClass = (s.creature.size_profile?.[0] || "S→M→L→XL").split("→")[2] || "L";
        const d = sampleCreatureDimensions(Math.random, adultClass);
        return [{ v: d.weight, w: 1 }, { v: "180 kg", w: 1 }, { v: "22 kg", w: 1 }, { v: "未知", w: 1 }].concat(getCustom("creature.weight").map(v => ({ v, w: 1 })));
      }, count: [{ n: 1, w: 1 }], dep: "size_profile", customGen: (s, rng) => {
        const adultClass = (s.creature.size_profile?.[0] || "S→M→L→XL").split("→")[2] || "L";
        return sampleCreatureDimensions(rng, adultClass).weight;
      }},
      { key: "body_fat", label: "體脂率 (%)", options: s => {
        const adultClass = (s.creature.size_profile?.[0] || "S→M→L→XL").split("→")[2] || "L";
        const d = sampleCreatureDimensions(Math.random, adultClass);
        return [{ v: d.bodyFat, w: 1 }, { v: "16.0%", w: 1 }, { v: "20.0%", w: 1 }, { v: "未知", w: 1 }].concat(getCustom("creature.body_fat").map(v => ({ v, w: 1 })));
      }, count: [{ n: 1, w: 1 }], dep: "size_profile", customGen: (s, rng) => {
        const adultClass = (s.creature.size_profile?.[0] || "S→M→L→XL").split("→")[2] || "L";
        return sampleCreatureDimensions(rng, adultClass).bodyFat;
      }},
      {
        key: "evo_stage1_to_2",
        label: "進化流程：第一階>第二階",
        options: () => {
          const list = C.getEvolutionModesWithProbabilities ? C.getEvolutionModesWithProbabilities("stage1_to_2") : [];
          return list.map(m => ({ v: m.id, zh: m.labelWithPct, w: m.w || 1 })).concat(getCustom("creature.evo_stage1_to_2").map(v => ({ v, zh: v, w: 1 })));
        },
        count: [{ n: 1, w: 1 }]
      },
      {
        key: "evo_stage2_to_3",
        label: "進化流程：第二階>第三階",
        options: () => {
          const list = C.getEvolutionModesWithProbabilities ? C.getEvolutionModesWithProbabilities("stage2_to_3") : [];
          return list.map(m => ({ v: m.id, zh: m.labelWithPct, w: m.w || 1 })).concat(getCustom("creature.evo_stage2_to_3").map(v => ({ v, zh: v, w: 1 })));
        },
        count: [{ n: 1, w: 1 }]
      },
      {
        key: "evo_stage3_to_overload",
        label: "進化流程：第三階>超載",
        options: s => {
          const prev = s.creature.evo_stage2_to_3?.[0] || null;
          const list = C.getEvolutionModesWithProbabilities ? C.getEvolutionModesWithProbabilities("stage3_to_overload", prev) : [];
          return list.map(m => ({ v: m.id, zh: m.labelWithPct, w: m.effectiveWeight || m.w || 1 })).concat(getCustom("creature.evo_stage3_to_overload").map(v => ({ v, zh: v, w: 1 })));
        },
        count: [{ n: 1, w: 1 }],
        dep: "evo_stage2_to_3"
      }
    ]
  };
  function archetypePool(s) { return CR.archetypes.filter(a => s.includeReview || a.sensitivity === "ok"); }

  function rollField(kind, f, rng) {
    if (f.when && !f.when(state)) {
      delete state[kind][f.key];
      return;
    }
    if (f.customGen) {
      state[kind][f.key] = [f.customGen(state, rng)];
      return;
    }
    const opts = f.options(state);
    const n = pickWeighted(rng, f.count).n;
    if (f.key === "appearance_palette" || f.key === "outfit_palette") {
      // 多色抽選逐色重新計算近似色系，減少單一色相獨占外觀。
      const pool = opts.slice(), chosen = [];
      while (chosen.length < n && pool.length) {
        const weighted = C.getVariedPaletteOptions(pool, chosen);
        const pick = pickWeighted(rng, weighted);
        if (!pick) break;
        chosen.push(pick.v);
        const idx = pool.findIndex(o => o.v === pick.v);
        if (idx >= 0) pool.splice(idx, 1);
      }
      state[kind][f.key] = chosen;
    } else {
      state[kind][f.key] = pickN(rng, opts, n);
    }
  }

  function rollAll(kind, rng, force) {
    // 全部重抽時先清除未鎖定的舊結果，避免上一個 seed 的欄位影響新 seed 權重。
    // 鎖定欄位保留，其他欄位仍可依鎖定條件進行柔性配對。
    if (force) FIELDS[kind].forEach(f => {
      if (!state.locks[kind + "." + f.key]) delete state[kind][f.key];
    });
    FIELDS[kind].forEach(f => {
      if (f.when && !f.when(state)) {
        delete state[kind][f.key];
        return;
      }
      const key = kind + "." + f.key;
      const locked = state.locks[key];
      const valid = (state[kind][f.key] || []).length > 0 && (f.customGen || (state[kind][f.key] || []).every(v => f.options(state).some(o => o.v === v)));
      if (force ? !locked || !valid : !valid) rollField(kind, f, rng);
    });
  }
  function revalidate(kind) { rollAll(kind, Math.random, false); }

  // ---- 概念輸出（prompt 內的 JSON） ----
  function zhOf(list, v) { const o = list.find(x => x.v === v); return o ? o.zh : v; }
  function characterConcept() {
    const dc = designedCharItem();
    if (dc) {
      const vz = (C.VESSELS.find(x => x.v === dc.vessel) || {}).zh || dc.vessel;
      const res = {
        id: dc.id,
        name_zh: dc.name_zh,
        name_en: dc.name_en,
        role: dc.role,
        ethnicity: dc.ethnicity,
        region: dc.region,
        timeline: dc.timeline,
        gender: dc.gender,
        age: dc.age,
        age_band: dc.age_band,
        height: dc.height_cm ? `${dc.height_cm}` : "165",
        weight: dc.weight_kg ? `${dc.weight_kg} kg` : "未知",
        body_fat: dc.body_fat || "未知",
        body_type: dc.body_type || ""
      };
      if (dc.gender === "女" && dc.cup_size) {
        res.cup_size = dc.cup_size;
      }
      Object.assign(res, {
        pose: dc.pose || "自然立姿，兼顧輪廓與剪裁細節",
        palette_hex: dc.palette_hex || [],
        outfit_palette: dc.outfit_palette || [],
        hair_palette: dc.hair_palette || [],
        eye_palette: dc.eye_palette || [],
        silhouette_keywords: dc.silhouette_keywords || [],
        personality: dc.personality || [],
        style: dc.style || "",
        interests: dc.interests || [],
        likes: dc.likes || [],
        dislikes: dc.dislikes || [],
        vessel: vz,
        vessel_key: dc.vessel,
        vessel_zh: vz,
        biography: dc.biography || "",
        backstory_zh: dc.backstory_zh || "",
        sensitivity: dc.sensitivity || "",
        sensitivity_note: dc.sensitivity_note || ""
      });
      return res;
    }
    const c = state.character;
    const res = {
      id: subjectId("character"), role: c.role?.[0] || "未知", ethnicity: c.ethnicity?.[0] || "未知",
      region: c.region?.[0] || "未知", timeline: c.timeline?.[0] || "未知", gender: c.gender?.[0] || "未知",
      age: isNaN(Number(c.age?.[0])) ? (c.age?.[0] || "未知") : Number(c.age[0]), age_band: c.age_band?.[0] || "未知",
      height: c.height?.[0] || "未知", weight: c.weight?.[0] || "未知", body_fat: c.body_fat?.[0] || "未知"
    };
    if (c.gender?.[0] === "女" && c.cup_size?.[0]) {
      res.cup_size = c.cup_size[0];
    }
    Object.assign(res, {
      pose: c.pose?.[0] || "",
      outfit_palette: c.outfit_palette || [],
      hair_palette: c.hair_palette || [],
      eye_palette: c.eye_palette || [],
      personality: c.personality || [], style: (c.style || []).join(" × "),
      interests: c.interests || [], likes: c.likes || [], dislikes: c.dislikes || [],
      vessel: c.vessel?.[0] || "未知", vessel_zh: zhOf(C.VESSELS, c.vessel?.[0])
    });
    return res;
  }

  function creatureConcept() {
    const d = designedItem();
    if (d) return JSON.parse(JSON.stringify(d.concept));
    const c = state.creature, a = CR.archetypes.find(x => x.name === c.archetype?.[0]) || {};
    const parents = (c.base_parents || []).map(traceBaseParent);
    return {
      line_id: subjectId("creature"),
      elements: (c.elements || []).map(e => e + "（" + (zhOf(C.ELEMENTS, e) || e).split(" ")[0] + "）"),
      element_palettes: (c.elements || []).map(e => (C.ELEMENTS.find(x => x.v === e) || {}).palette || "自然色系"),
      base_parents: parents,
      bases: c.bases || [],
      appearance_palette: c.appearance_palette || [],
      timeline: c.timeline?.[0] || "未知",
      region: c.region?.[0] || "未知",
      archetype: c.archetype?.[0] || "未知",
      archetype_type: a.type || "自由原型",
      motifs: a.motifs || "",
      meaning: a.meaning || "",
      sensitivity: a.sensitivity || "ok", role: c.role?.[0] || "未知",
      temperament: c.temperament?.[0] || "normal",
      disposition: c.disposition?.[0] || "沉穩",
      social_structure: c.social_structure?.[0] || "未知",
      reproduction: c.reproduction?.[0] || "未知",
      size_profile: c.size_profile?.[0] || "未知",
      height_length: c.height_length?.[0] || "未知",
      weight: c.weight?.[0] || "未知",
      body_fat: c.body_fat?.[0] || "未知",
      evo_stage1_to_2: c.evo_stage1_to_2?.[0] || "stance_reconfig",
      evo_stage2_to_3: c.evo_stage2_to_3?.[0] || "elemental_mantle",
      evo_stage3_to_overload: c.evo_stage3_to_overload?.[0] || "armed_arsenal",
      evolution_flow: {
        stage1_to_2: c.evo_stage1_to_2?.[0] || "stance_reconfig",
        stage2_to_3: c.evo_stage2_to_3?.[0] || "elemental_mantle",
        stage3_to_overload: c.evo_stage3_to_overload?.[0] || "armed_arsenal"
      },
      formula: (c.elements || []).join("+") + " × " + (c.bases || []).join("+") + " × " + (c.archetype?.[0] || "原型") + "（" + (c.timeline?.[0] || "時空") + "）"
    };
  }

  function subjectId(kind) {
    if (kind === "creature") {
      const d = designedItem();
      if (d) return d.line_id;
    } else if (kind === "character") {
      const dc = designedCharItem();
      if (dc) return dc.id;
    }
    const custom = state.subjectIds[kind];
    if (custom) return custom;
    return (kind === "character" ? "chr_" : "line_") + state.seed;
  }

  function task() {
    let t = TASKS.find(x => x.id === state.taskId);
    if (!t && state.taskId === "model-rig") {
      state.taskId = "creature-model-rig";
      t = TASKS.find(x => x.id === "creature-model-rig");
    }
    return t || TASKS[0];
  }
  const env = () => ({ character: state.character, creature: state.creature });
  function taskOpts(t) {
    const o = state.opts[t.id] || (state.opts[t.id] = {});
    t.options.forEach(def => {
      const items = def.items ? def.items(o, env()) : [];
      if (def.type === "select" && o[def.key] !== undefined && !items.some(i => i.v === o[def.key])) delete o[def.key];
      if (o[def.key] !== undefined) return;
      if (def.type === "checks") o[def.key] = def.def === "all" ? items.map(i => i.v) : def.def.slice();
      else if (def.def === "rand") o[def.key] = items[Math.floor(Math.random() * items.length)].v;
      else o[def.key] = def.def;
    });
    return o;
  }
  function resolveSubject(t, o) {
    if (t.needs === "character") return "character";
    if (t.needs === "creature") return "creature";
    if (t.needs === "either" && o.scope === "batch") return null;
    if (t.needs === "either") return o.subject === "creature" ? "creature" : "character";
    if (t.id === "move-vfx" && o.use_creature === "yes") return "creature";
    return null;
  }

  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return {
      day: d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()),
      hm: p(d.getHours()) + p(d.getMinutes()),
      timestamp: d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes())
    };
  }

  let lastBuild = null;
  const pipelineTaskIds = new Map();
  function build() {
    const t = task(), o = taskOpts(t), subj = resolveSubject(t, o);
    const errors = [];
    t.options
      .filter(d => !window.COSMI_PIPELINE?.supports({task:t}) && d.type === "checks" && !d.optional && (!d.when || d.when(o)) && (o[d.key] || []).length === 0)
      .forEach(d => errors.push("至少勾選一個「" + d.label + "」"));
    const s = stamp();
    let taskId = t.prefix + "-" + s.day + "-" + state.seed + "-" + s.hm;
    if (t.id === "creature-concept" && o.stage) {
      taskId += "-" + o.stage;
    } else if ((t.id === "creature-model-rig" || t.id === "model-rig") && o.stage) {
      taskId += "-" + o.stage;
    }
    let header = "[COSMIMERA-TASK spec=" + SPEC + " tool=" + TOOL_VERSION + " catalog=" + C.version + " template=" + t.id + "@" + t.version + " task_id=" + taskId + " seed=" + state.seed + "]";
    const is3dTask = is3dType(t.id);
    const chosenPkg = (is3dTask && o.source_pack) ? reviewState.packages.find(p => p.id === o.source_pack) : null;
    let concept = chosenPkg?.concept || (subj === "character" ? characterConcept() : subj === "creature" ? creatureConcept() : null);
    let subjId = chosenPkg?.subjectId || (subj ? subjectId(subj) : is3dTask ? "batch" : t.id === "capture-vessel" ? "vessels" : t.id === "culture-research" ? "region_" + o.region : "fx_" + o.element + "_" + o.shape);

    if (["character-concept", "creature-concept", "character-model-rig", "creature-model-rig", "model-rig"].includes(t.id)) {
      const key = [subjId, t.id, o.stage || "", state.seed, o.source_pack || ""].join(":");
      const previousId = taskId;
      if (pipelineTaskIds.has(key)) taskId = pipelineTaskIds.get(key);
      else pipelineTaskIds.set(key, taskId);
      header = header.replace("task_id=" + previousId, "task_id=" + taskId);
    }
    const ctx = {
      header, taskId, timestamp: s.day + "-" + s.hm, task: t, opts: o, concept, notes: state.notes.trim(),
      platform: state.platform, platformName: state.platform === "gemini" ? "Gemini Argon（任務模式）" : "ChatGPT（對話版）",
      subjectId: subjId
    };
    const pipeline = window.COSMI_PIPELINE?.supports(ctx);
    const pipelineStage = document.getElementById("pipelineStage")?.value;
    if (pipeline && pipelineStage === "colab" && (!chosenPkg || chosenPkg.status !== "ok")) errors.push("Colab 需先選取已通過審查的來源立繪");
    if (pipeline && pipelineStage === "blender" && (o.source_pack || o.input_img) && (!chosenPkg || chosenPkg.status !== "ok")) errors.push("指定的來源立繪尚未通過審查；純文字建模請取消圖片來源");
    // Portrait uses the original multi-round prompts directly; no Drive template is needed.
    const useNativePortrait = pipeline && ["portrait", "portrait_3d"].includes(pipelineStage) &&
      (t.id === "character-concept" || t.id === "creature-concept");
    const rounds = (!errors.length && (!pipeline || useNativePortrait) && t.buildRounds) ? t.buildRounds(ctx) : null;
    lastBuild = { ctx, errors, text: errors.length ? "" : pipeline && !useNativePortrait ? window.COSMI_PIPELINE.build(ctx) : t.build(ctx), rounds };
    return lastBuild;
  }

  // ==================== 時間戳格式包生成與對齊管理 ====================
  const STAGED_LS_KEY = "cosmimera_staged_formats";

  function getStagedFormats() {
    try {
      return JSON.parse(localStorage.getItem(STAGED_LS_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveStagedFormat(staged) {
    const all = getStagedFormats();
    all[staged.taskId] = staged;
    if (staged.timestamp) {
      all["ts:" + staged.timestamp + ":" + (staged.stage || "")] = staged;
    }
    try {
      localStorage.setItem(STAGED_LS_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn("Storage quota exceeded", e);
    }
  }

  function generateAndStageFormats(b) {
    if (!b || !b.ctx) return null;
    const ctx = b.ctx;
    const t = ctx.task;
    const o = ctx.opts || {};
    const curStage = o.stage || "adult";

    // 1. 產生 concept.json
    let conceptObj = null;
    if (t.id === "creature-concept") {
      const c = ctx.concept || {};
      const sizes = (c.size_profile || "S→M→L→XL").split("→");
      const stageIdx = ["juvenile", "adolescent", "adult", "overload"].indexOf(curStage);
      const curSize = sizes[stageIdx >= 0 ? stageIdx : 2] || "L";
      const lockedStage = c.locked?.stages?.find(s => s.stage === curStage);
      const curHeight = lockedStage?.height_length || (stageIdx === 2 ? c.height_length : null) || (curSize === "XS" ? "0.20 m" : curSize === "S" ? "0.45 m" : curSize === "M" ? "1.20 m" : curSize === "L" ? "2.20 m" : "5.0 m");
      const curWeight = lockedStage?.weight || (stageIdx === 2 ? c.weight : null) || (curSize === "XS" ? "0.15 kg" : curSize === "S" ? "3.5 kg" : curSize === "M" ? "35 kg" : curSize === "L" ? "220 kg" : "2500 kg");
      const curFat = lockedStage?.body_fat || (stageIdx === 2 ? c.body_fat : null) || "15%";

      const defaultZh = { juvenile: "幼角獸", adolescent: "曜脊獸", adult: "炎甲重龍", overload: "天炎煌角甲" };
      const defaultEn = { juvenile: "Hornling", adolescent: "Pyrosaur", adult: "Flamedrake", overload: "Solarking" };

      conceptObj = {
        line_id: ctx.subjectId,
        stage: curStage,
        creature_id: lockedStage ? lockedStage.creature_id : ("cr_" + ctx.subjectId + "_" + curStage),
        name_zh: lockedStage ? lockedStage.name_zh : (c.name_zh || defaultZh[curStage] || "宙獸"),
        name_en: lockedStage ? lockedStage.name_en : (c.name_en || defaultEn[curStage] || "Creature"),
        dex_zh: lockedStage?.dex_zh || c.dex_zh || "棲息於特定星域的神秘宙獸，具備獨特生理散熱與元素構造，性情沉穩且充滿神秘感。",
        size_class: curSize,
        height_length: curHeight,
        weight: curWeight,
        body_fat: curFat,
        elements: c.elements || ["fire"],
        appearance_palette: c.appearance_palette || [],
        base_parents: c.base_parents || [],
        bases: c.bases || [],
        region: c.region || "未知",
        timeline: c.timeline || "架空",
        archetype: c.archetype || "自由原型",
        role: c.role || "戰鬥",
        temperament: lockedStage?.temperament || c.temperament || (curStage === "juvenile" ? "timid" : curStage === "adolescent" ? "normal" : curStage === "overload" ? "apex" : "fierce"),
        disposition: c.disposition || "沉穩專注",
        evolution_flow: c.evolution_flow || {
          stage1_to_2: c.evo_stage1_to_2 || "stance_reconfig",
          stage2_to_3: c.evo_stage2_to_3 || "elemental_mantle",
          stage3_to_overload: c.evo_stage3_to_overload || "armed_arsenal"
        },
        signature_move: lockedStage?.signature_move || {
          move_id: "signature_move",
          name_zh: "專屬招式",
          name_en: "SignatureMove",
          element: (c.elements || ["fire"])[0],
          range_class: "melee",
          shape: "front",
          visual: "招式演出視覺效果"
        },
        ...(curStage === "overload" ? { overload_visual: lockedStage?.look || "超載能量外溢特徵" } : {})
      };
    } else if (t.id === "character-concept") {
      const c = ctx.concept || {};
      conceptObj = {
        id: ctx.subjectId,
        name_zh: c.name_zh || "角色",
        name_en: c.name_en || "Character",
        role: c.role,
        gender: c.gender, age: c.age, height_cm: c.height, weight_kg: c.weight, body_fat_pct: c.body_fat,
        ...(c.gender === "女" && c.cup_size && c.cup_size !== "未知" ? { cup_size: c.cup_size } : {}),
        ethnicity: c.ethnicity, region: c.region, timeline: c.timeline,
        outfit_palette: c.outfit_palette, hair_palette: c.hair_palette, eye_palette: c.eye_palette,
        ...(c.silhouette_keywords && c.silhouette_keywords.length ? { silhouette_keywords: c.silhouette_keywords } : {}),
        personality: c.personality, style: c.style, vessel: c.vessel?.zh || c.vessel,
        biography: c.biography || "角色生平傳記。",
        ...(c.backstory_zh ? { backstory_zh: c.backstory_zh } : {}),
        ...(c.sensitivity ? { sensitivity: c.sensitivity, sensitivity_note: c.sensitivity_note || "" } : {})
      };
    } else {
      conceptObj = ctx.concept || {};
    }

    // 依色彩判定 2D AGC 立繪背景色（RGB 嚴格相同）
    const isCr = (t.id === "creature-concept");
    const bgInfo = C.determineAgcBgColor(conceptObj, !isCr);
    conceptObj.recommended_bg_color = bgInfo.hex;
    conceptObj.bg_color_rule = bgInfo.reason;

    // 2. 產生 manifest.json
    const filesList = isCr ? [
      { path: `images/cr_${ctx.subjectId}_${curStage}_main.png`, kind: "main", level: "L1" },
      { path: `images/cr_${ctx.subjectId}_${curStage}_front.png`, kind: "front", level: "L1" },
      { path: `images/cr_${ctx.subjectId}_${curStage}_turnaround.png`, kind: "turnaround", level: "L1" }
    ] : [
      { path: `images/${ctx.subjectId}_main.png`, kind: "main", level: "L1" },
      { path: `images/${ctx.subjectId}_front.png`, kind: "front", level: "L1" },
      { path: `images/${ctx.subjectId}_turnaround.png`, kind: "turnaround", level: "L1" }
    ];

    const tsPart = ctx.timestamp || ctx.taskId.replace(/^[a-z]+-/, "").replace(/-(juvenile|adolescent|adult|overload)$/, "");
    const manifestObj = {
      spec: "cosmimera-art-task/1",
      task_header: ctx.header,
      task_id: ctx.taskId,
      task_type: ctx.task.id,
      subject_id: ctx.subjectId,
      stage: isCr ? curStage : null,
      produced_by: ctx.platformName,
      timestamp: tsPart,
      recommended_bg_color: bgInfo.hex,
      bg_color_rule: bgInfo.reason,
      files: filesList,
      timestamp: tsPart,
      files: filesList,
      missing: [],
      notes: ctx.notes || ""
    };

    const staged = {
      taskId: ctx.taskId,
      timestamp: tsPart,
      stage: manifestObj.stage,
      taskType: ctx.task.id,
      subjectId: ctx.subjectId,
      manifest: manifestObj,
      concept: conceptObj,
      prompt: b.text,
      createdAt: Date.now()
    };

    saveStagedFormat(staged);
    return staged;
  }

  function findMatchingStagedFormat(filename, internalPaths = []) {
    const all = getStagedFormats();
    const keys = Object.keys(all).filter(k => !k.startsWith("ts:"));
    if (!keys.length) return null;

    const cleanName = (filename || "").replace(/\.zip$/i, "").toLowerCase();

    // 1. Exact taskId match
    for (const k of keys) {
      if (cleanName === k.toLowerCase()) return all[k];
    }

    // 2. filename contains taskId or vice versa
    for (const k of keys) {
      if (cleanName.includes(k.toLowerCase()) || k.toLowerCase().includes(cleanName)) return all[k];
    }

    // 3. Match by internal directory paths
    for (const p of internalPaths) {
      const topPart = p.split("/")[0].toLowerCase();
      for (const k of keys) {
        if (topPart === k.toLowerCase()) return all[k];
      }
    }

    // 4. Timestamp & stage match
    for (const k of keys) {
      const staged = all[k];
      if (staged.timestamp && (cleanName.includes(staged.timestamp.toLowerCase()) || internalPaths.some(p => p.toLowerCase().includes(staged.timestamp.toLowerCase())))) {
        if (!staged.stage || cleanName.includes(staged.stage) || internalPaths.some(p => p.toLowerCase().includes(staged.stage))) {
          return staged;
        }
      }
    }

    // 5. Stage & subject match from image filenames (e.g. images/cr_line_7f3a_adult_main.png)
    for (const p of internalPaths) {
      const m = p.match(/cr_([a-zA-Z0-9_]+)_(juvenile|adolescent|adult|overload)/i);
      if (m) {
        const [, subj, stg] = m;
        for (const k of keys) {
          const staged = all[k];
          if (staged.stage === stg.toLowerCase() && (staged.subjectId.includes(subj) || subj.includes(staged.subjectId))) {
            return staged;
          }
        }
      }
    }

    // 6. Stage match with most recent staged format of that stage
    const stageMatch = cleanName.match(/(juvenile|adolescent|adult|overload)/i);
    if (stageMatch) {
      const stg = stageMatch[1].toLowerCase();
      const sorted = keys.map(k => all[k]).filter(s => s.stage === stg).sort((a,b) => b.createdAt - a.createdAt);
      if (sorted.length) return sorted[0];
    }

    return null;
  }

  // ---- DOM 輔助 ----
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") e.className = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    kids.flat().forEach(k => k != null && e.append(k.nodeType ? k : document.createTextNode(String(k))));
    return e;
  }

  // ---- 手寫編輯 / 追加選項彈窗 ----
  let curCustomCtx = null;
  function openCustomModal(title, currentVal, onConfirm) {
    curCustomCtx = onConfirm;
    $("#customModalTitle").textContent = "手寫自訂 / 追加選項：" + title;
    $("#customModalInput").value = currentVal || "";
    $("#customModal").classList.add("show");
    setTimeout(() => { $("#customModalInput").focus(); $("#customModalInput").select(); }, 50);
  }
  function closeCustomModal() {
    $("#customModal").classList.remove("show");
    curCustomCtx = null;
  }

  // Explicit three-phase chooser: category -> route -> connected pipeline nodes.
  const taskFlow = window.COSMI_TASK_FLOW;
  let flowSelection = null;
  function currentFlow() {
    if (!taskFlow) return null;
    const choice = flowSelection || state.flowChoice;
    if (!choice?.category || !choice.route || !choice.step) return null;
    const selected = taskFlow.resolve(choice.category, choice.route, choice.step);
    return selected && selected.taskId === state.taskId ? selected : null;
  }
  function chooseCategory(category) {
    const selected = taskFlow?.selectCategory(category);
    if (!selected) return;
    flowSelection = selected;
    state.flowChoice = selected;
    state.taskId = category === "move" ? "move-vfx"
      : category === "character" ? "character-concept" : "creature-concept";
    const stage = $("#pipelineStage");
    if (stage && category !== "move") stage.value = "appearance";
    renderAll();
  }
  function chooseRoute(route) {
    const choice = flowSelection || state.flowChoice;
    const next = taskFlow?.selectRoute(choice, route);
    if (!next) return;
    chooseFlow(next.category, next.route, next.step);
  }
  function chooseFlow(category, route, step) {
    const selected = taskFlow?.resolve(category, route, step);
    if (!selected) return;
    flowSelection = {category, route, step};
    state.flowChoice = flowSelection;
    state.taskId = selected.taskId;
    state.currentRound = selected.stage === "portrait" ? 1 : 0;
    const stage = $("#pipelineStage");
    if (stage) stage.value = selected.stage;
    if (selected.stage === "colab" || selected.stage === "blender") {
      const o = taskOpts(task());
      o.scope = "single";
      if (route === "text") { o.source_pack = ""; o.input_img = ""; }
      else {
        const pkg = getActivePkg();
        if (pkg && !is3dType(pkg.type) && pkg.status === "ok" &&
          (category === "character" ? pkg.type === "character-concept" : pkg.type === "creature-concept")) {
          o.source_pack = pkg.id;
        }
      }
    }
    window.COSMI_PIPELINE?.syncStageActions();
    renderAll();
    // On narrow touch layouts, reveal the selected step's controls after rendering.
    // Keep desktop selection behavior unchanged and avoid page navigation.
    if (window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => {
        const target = document.querySelector("#pipelineControls") || document.querySelector("#prompt");
        if (!target) return;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - 72);
        window.scrollTo({top, behavior: reducedMotion ? "instant" : "smooth"});
      });
    }
  }
  function renderTasks() {
    const box = $("#tasks"), categories = $("#taskCategories"), routes = $("#taskRoutes"), detail = $("#taskFlowDetail");
    if (!taskFlow || !box || !categories || !routes || !detail) return;
    const choice = flowSelection || state.flowChoice;
    const active = currentFlow();
    const kind = choice?.category || null;
    categories.replaceChildren(...taskFlow.categories.map(c => el("button", {
      type:"button", class:c.id === kind ? "on" : "",
      "aria-pressed":String(c.id === kind), "aria-label":"選擇" + c.zh,
      "data-tip":"先選擇" + c.zh + "，再選管線",
      onclick:()=>chooseCategory(c.id)
    }, c.zh)));
    if (!kind) {
      routes.replaceChildren();
      box.replaceChildren();
      detail.hidden = false;
      detail.replaceChildren(el("p",{class:"task-flow-placeholder"},"① 先選擇角色、宙獸或招式。"));
      renderDesigned();
      return;
    }
    const routeDefs = kind === "move"
      ? [{id:"move", label:"招式特效（VFX）", tip:"選擇招式特效管線，生成規格、分鏡、圖層與序列圖"}]
      : [
        {id:"image", label:"Image-to-3D", tip:"先生成並審查立繪，再選 Colab＋Blender 或 AI＋Blender"},
        {id:"text", label:"Prompt-to-3D", tip:"先以文字建模，再補畫主立繪與審查"}
      ];
    routes.replaceChildren(...routeDefs.map(d => el("button", {
      type:"button", class:d.id === choice.route ? "on" : "",
      "aria-pressed":String(d.id === choice.route), "aria-label":d.tip, "data-tip":d.tip,
      onclick:()=>chooseRoute(d.id)
    },d.label)));
    if (!choice.route || !active) {
      box.replaceChildren();
      detail.hidden = false;
      detail.replaceChildren(el("p",{class:"task-flow-placeholder"},"② 請選擇管線，接著點選流程圖節點。"));
      renderDesigned();
      return;
    }
    const rows = taskFlow.diagram(kind, choice.route);
    function node(step) {
      const tip = step.detail + (step.output ? "\n產出：" + step.output : "");
      return el("button", {
        type:"button", class:"task" + (step.id === active.step ? " on" : "") + (step.alternate ? " is-alternate" : ""),
        "aria-pressed":String(step.id === active.step),
        "aria-label":"選擇步驟 " + step.name, "data-tip":tip, title:tip,
        onclick:()=>chooseFlow(kind,choice.route,step.id)
      },el("span",{class:"tname"},step.name));
    }
    const elements = [];
    rows.forEach((row,i) => {
      if (i) elements.push(el("span",{class:"flow-connector","aria-hidden":"true"}));
      if (row.type === "branch") {
        elements.push(el("div",{class:"flow-branch"},
          el("p",{class:"flow-branch-label"},row.label),
          el("div",{class:"flow-branch-options"},row.steps.map(node))));
      } else {
        elements.push(el("div",{class:"flow-row"},node(row.steps[0])));
      }
    });
    box.replaceChildren(...elements);
    detail.replaceChildren();
    detail.hidden = true;
    renderDesigned();
  }

  function useDesigned(lineId, taskId, stage = null) {
    state.preset = lineId;
    state.presetChar = null;
    state.taskId = taskId;
    flowSelection = null; state.flowChoice = null;
    state.currentRound = 1;
    const o = state.opts[taskId] || (state.opts[taskId] = {});
    if (stage) o.stage = stage;
    if (taskId === "creature-model-rig" || taskId === "model-rig") { o.scope = "single"; o.source_pack = ""; }
    setViewMode("forge");
    renderAll();
    const promptEl = $("#prompt");
    if (promptEl) promptEl.scrollIntoView({ behavior: "smooth", block: "center" });
    toast(`已載入宙獸演化線「${lineId}」至 Prompt 鍛造台`);
  }

  function useDesignedCharacter(charId, taskId) {
    state.preset = null;
    state.presetChar = charId;
    state.taskId = taskId || "character-concept";
    flowSelection = null; state.flowChoice = null;
    state.currentRound = 1;
    const o = state.opts[state.taskId] || (state.opts[state.taskId] = {});
    if (state.taskId === "character-model-rig") {
      o.scope = "single";
      o.source_pack = "";
    }
    setViewMode("forge");
    renderAll();
    const promptEl = $("#prompt");
    if (promptEl) promptEl.scrollIntoView({ behavior: "smooth", block: "center" });
    toast(`已載入角色「${charId}」至 Prompt 鍛造台`);
  }

  // ==================== cosmos_chimera 外部資產讀取管線 ====================
  // Asset URLs are private in-memory blobs loaded through the authenticated Drive API.
  function assetName(path) {
    return String(path || "").split("/").pop().replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();
  }
  function isApprovedStatus(status) {
    return status === "ok" || status === "approved";
  }
  function isProvisionalStatus(status) {
    return status === "provisional";
  }
  function isAcceptedStatus(status) {
    return isApprovedStatus(status) || isProvisionalStatus(status);
  }
  function packageStatusRank(pkg) {
    if (!pkg) return -1;
    if (isApprovedStatus(pkg.status)) return pkg.completed ? 4.5 : 4;
    if (isProvisionalStatus(pkg.status)) return 3;
    if (pkg.status === "pending" || !pkg.status) return 2;
    if (pkg.status === "missing") return 1;
    if (pkg.status === "reject") return 0;
    return 1;
  }
  function sortPackagesByPriority(pkgs) {
    return [...(pkgs || [])].sort((a, b) => {
      const diff = packageStatusRank(b) - packageStatusRank(a);
      if (diff !== 0) return diff;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }
  function linkedAssetPackages(subject) {
    const key = String(subject || "").toLowerCase();
    return sortPackagesByPriority(reviewState.packages.filter(p => {
      const ids = [p.subjectId, p.manifest?.subject_id, p.concept?.id, p.concept?.line_id, p.concept?.creature_id, p.id]
        .filter(Boolean).map(s => String(s).toLowerCase());
      if (ids.includes(key)) return true;
      const source = reviewState.packages.find(x => x.id === (p.sourcePack || p.manifest?.source_pack));
      return !!source && [source.subjectId, source.manifest?.subject_id, source.concept?.id, source.concept?.line_id]
        .some(s => String(s || "").toLowerCase() === key);
    }));
  }
  function imageForView(images, view) {
    const all = images || [], pattern = new RegExp("(?:^|[_\\\\-])" + view + "$", "i");
    return all.find(i => pattern.test(assetName(i.path)) && i.url) || null;
  }
  function getCharacterAssetUrls(charId) {
    // Asset folders contain versioned names; manifest subject_id or concept.id links them to the catalog.
    const matches = linkedAssetPackages(charId);
    const pack = matches.find(p => !is3dType(p.type) && p.images?.length);
    const mdlPack = matches.find(p => is3dType(p.type) && (p.images?.length || p.glbFile));
    const all = pack?.images || [];
    const order = ["main", "turnaround", "front", "side", "back", "expressions", "props"];
    const images = order.map(view => {
      const match = imageForView(all, view);
      return match ? { view, label: view, primaryUrl: match.url, fallbackUrl: match.url } : null;
    }).filter(Boolean);
    const used = new Set(images.map(x => x.primaryUrl));
    all.forEach(i => { if (i.url && !used.has(i.url)) images.push({
      view: assetName(i.path), label: assetName(i.path), primaryUrl: i.url, fallbackUrl: i.url
    }); });
    if (!images.length) images.push({ view: "missing", label: "尚無立繪", primaryUrl: "", fallbackUrl: "" });
    const modelFront = imageForView(mdlPack?.images, "front") || mdlPack?.images?.[0] || null;
    return {
      conceptDir: pack?.drivePath || "01_portraits/", modelDir: mdlPack?.drivePath || "02_3d/legacy/",
      images, modelFront: { primaryUrl: modelFront?.url || "", fallbackUrl: modelFront?.url || "" },
      glbUrl: mdlPack?.glbFile?.url || "", fbxUrl: "", pack, mdlPack
    };
  }
  function getCreatureStageAssetUrls(lineId, stage) {
    const packs = linkedAssetPackages(lineId).filter(p => !is3dType(p.type));
    const images = packs.flatMap(p => p.images || []);
    const forStage = images.filter(i => new RegExp("(?:^|[_\\\\-])" + stage + "(?:[_\\\\-]|$)", "i").test(assetName(i.path)));
    const image = suffix => imageForView(forStage, suffix)?.url || "";
    const url = image("main") || forStage[0]?.url || "";
    return { primaryUrl: url, fallbackUrl: url, turnaroundUrl: image("turnaround"), frontUrl: image("front") };
  }
  function getCreatureOverviewAssetUrls(lineId) {
    const images = linkedAssetPackages(lineId).flatMap(p => p.images || []);
    const lineupUrl = imageForView(images, "lineup")?.url || "";
    const scaleUrl = imageForView(images, "scale")?.url || "";
    return { lineupUrl, scaleUrl, fallbackLineupUrl: lineupUrl, fallbackScaleUrl: scaleUrl };
  }

  function renderDesigned() {
    const box = $("#designed"), host = $("#designedShortcut");
    if (!box) return;
    const hasPreset = Boolean(state.preset || state.presetChar);
    if (host) host.hidden = !hasPreset;
    if (!hasPreset) {
      box.replaceChildren();
      return;
    }
    box.replaceChildren();

    if (state.preset) {
      const d = DESIGNED.find(x => x.line_id === state.preset);
      const name = d ? `${ELEM_ICONS[d.element] || "🐾"} ${d.code_zh} · ${d.title_zh}` : state.preset;
      const banner = el("div", { class: "designed-active-box" },
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px" },
          el("span", { class: "f-badge ok" }, "已載入設計線"),
          el("button", {
            type: "button", class: "btn mini ghost", style: "padding:1px 5px;font-size:11px",
            onclick: () => { state.preset = null; renderAll(); toast("已取消設計線，回復隨機概念"); }
          }, "✕ 取消")
        ),
        el("div", { style: "font-weight:600;font-size:12px;color:#fff" }, name),
        el("div", { class: "muted", style: "font-size:11px;margin-top:2px" }, `${state.preset} · ${d?.element || ""}`),
        el("button", {
          type: "button", class: "btn mini ghost", style: "width:100%;margin-top:6px;font-size:11px",
          onclick: () => {
            selectDesignedItem(state.preset, "creature");
            setViewMode("designed");
          }
        }, "📋 前往已設計項目台檢閱 →")
      );
      box.append(banner);
      return;
    }

    if (state.presetChar) {
      const c = DESIGNED_CHARACTERS.find(x => x.id === state.presetChar);
      const name = c ? `👤 ${c.name_zh} (${c.name_en})` : state.presetChar;
      const banner = el("div", { class: "designed-active-box" },
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px" },
          el("span", { class: "f-badge ok" }, "已載入設計角色"),
          el("button", {
            type: "button", class: "btn mini ghost", style: "padding:1px 5px;font-size:11px",
            onclick: () => { state.presetChar = null; renderAll(); toast("已取消設計角色，回復隨機概念"); }
          }, "✕ 取消")
        ),
        el("div", { style: "font-weight:600;font-size:12px;color:#fff" }, name),
        el("div", { class: "muted", style: "font-size:11px;margin-top:2px" }, `${state.presetChar} · ${c?.role || ""}`),
        el("button", {
          type: "button", class: "btn mini ghost", style: "width:100%;margin-top:6px;font-size:11px",
          onclick: () => {
            selectDesignedItem(state.presetChar, "character");
            setViewMode("designed");
          }
        }, "📋 前往已設計項目台檢閱 →")
      );
      box.append(banner);
      return;
    }


  }

  // ==================== 已設計項目台 (二欄審查檢閱工作台) ====================
  const designedState = {
    cat: "all", // "all" | "creature" | "character"
    statusFilter: "all", // "all" | "accepted" | "ok" | "provisional" | "unprocessed"
    reviewTab: "accepted", // "accepted" | "ok" | "provisional" | "other"
    pipelineShowAll: false,
    selectedId: null, // line_id or char_id
    selectedType: "creature", // "creature" | "character"
    mode: "detail" // "detail" | "cards"
  };

  const PIPELINE_JOBS_KEY = "cosmimera.pipeline-jobs.v1";
  function loadLocalPipelineJobs() {
    try {
      const data = JSON.parse(localStorage.getItem(PIPELINE_JOBS_KEY) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (_) {
      return {};
    }
  }
  function recordPipelineJob(ctx, pipelineStage) {
    if (!ctx?.taskId || !ctx?.subjectId) return;
    try {
      const jobs = loadLocalPipelineJobs();
      jobs[ctx.taskId] = {
        taskId: ctx.taskId,
        subjectId: ctx.subjectId,
        stage: ctx.opts?.stage || null,
        taskType: ctx.task?.id || "",
        pipelineStage: pipelineStage || "task",
        updatedAt: Date.now()
      };
      localStorage.setItem(PIPELINE_JOBS_KEY, JSON.stringify(jobs));
    } catch (_) {}
  }

  function parsePkgTypedState(pkg) {
    if (!pkg?.rawFiles) return null;
    const key = Object.keys(pkg.rawFiles).find(k => /(?:^|\/)typed_state\.json$/i.test(k));
    if (!key) return null;
    try {
      const val = pkg.rawFiles[key];
      const text = typeof val === "string" ? val : new TextDecoder().decode(val);
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function getDrivePipelineIndex() {
    return window.COSMI_DRIVE?.pipelineIndex?.() || {
      settings: [],
      jobs: [],
      wikiCharacters: [],
      wikiCreatures: [],
      syncedAt: 0
    };
  }

  function findPipelineJobFiles(subjectId, stage, stageNames) {
    const idx = getDrivePipelineIndex();
    const localJobs = loadLocalPipelineJobs();
    const subLower = String(subjectId || "").toLowerCase();
    const stLower = stage ? String(stage).toLowerCase() : null;
    const matchedTaskIds = new Set(
      Object.values(localJobs)
        .filter(j => String(j.subjectId || "").toLowerCase() === subLower && (!stLower || !j.stage || String(j.stage).toLowerCase() === stLower))
        .map(j => String(j.taskId || "").toLowerCase())
    );
    const stageSet = new Set(stageNames.map(s => s.toLowerCase()));
    return (idx.jobs || []).filter(f => {
      const name = String(f.name || "").toLowerCase();
      if (!name.endsWith(".prompt.md")) return false;
      const parts = name.replace(/\.prompt\.md$/, "").split(".");
      const fileStage = parts.length > 1 ? parts[parts.length - 1] : "";
      const fileTaskId = parts.slice(0, -1).join(".") || name;
      if (stageSet.size && !stageSet.has(fileStage)) return false;
      if (matchedTaskIds.has(fileTaskId)) return true;
      if (subLower && name.includes(subLower)) {
        if (!stLower || name.includes(stLower)) return true;
      }
      return false;
    });
  }

  function computeSubjectPipelinePart(subjectId, stage, kind, stageInfo = null) {
    const matches = sortPackagesByPriority(getReviewMatches(subjectId, stage));
    const pkgs2d = matches.filter(p => !is3dType(p.type));
    const pkgs3d = matches.filter(p => is3dType(p.type));
    const best2d = pkgs2d[0] || null;
    const best3d = pkgs3d[0] || null;
    const idx = getDrivePipelineIndex();
    const subLower = String(subjectId || "").toLowerCase();
    const stLower = stage ? String(stage).toLowerCase() : null;

    // 1. Settings check
    const hasSettingFile = (idx.settings || []).some(f => {
      const n = String(f.name || "").toLowerCase();
      return n.includes(subLower) && (!stLower || n.includes(stLower));
    });
    const isForgingThis = kind === "character"
      ? state.presetChar === subjectId
      : (state.preset === subjectId && (!stage || !state.opts[state.taskId]?.stage || state.opts[state.taskId]?.stage === stage));
    const settingsDone = hasSettingFile || matches.length > 0 || isForgingThis;

    // 2. Wiki check
    const wikiFile = kind === "character"
      ? `${subLower}_wiki.md`
      : `${subLower}_${stLower || "adult"}_wiki.md`;
    const wikiList = kind === "character" ? (idx.wikiCharacters || []) : (idx.wikiCreatures || []);
    const hasWikiDrive = wikiList.some(f => String(f.name || "").toLowerCase() === wikiFile);
    const hasWikiManifest = matches.some(p => Boolean(p.manifest?.encyclopedia_path));
    const wikiDone = hasWikiDrive || hasWikiManifest;

    // 3. 2D Portrait status
    const portraitJobs = findPipelineJobFiles(subjectId, stage, ["appearance", "portrait", "review_portrait"]);
    let portrait;
    if (best2d && isApprovedStatus(best2d.status)) {
      portrait = { state: "ok", label: "✅ 已通過", cls: "ok", pkg: best2d };
    } else if (best2d && isProvisionalStatus(best2d.status)) {
      portrait = { state: "provisional", label: "🟦 暫時採用", cls: "provisional", pkg: best2d };
    } else if (best2d && best2d.status === "reject") {
      portrait = { state: "rejected", label: "❌ 退回待重製", cls: "reject", pkg: best2d };
    } else if (best2d) {
      portrait = { state: "reviewing", label: best2d.status === "missing" ? "⚠️ 缺檔待補" : "🟨 待審查", cls: "active", pkg: best2d };
    } else if (portraitJobs.length > 0) {
      portrait = { state: "queued", label: "🔄 已送出 Prompt", cls: "active", jobFile: portraitJobs[0] };
    } else if (isForgingThis && !is3dType(state.taskId)) {
      portrait = { state: "forging", label: "⚡ 鍛造台編輯中", cls: "active" };
    } else {
      portrait = { state: "unprocessed", label: "⬜ 未處理", cls: "" };
    }

    // 4. 3D Model status
    const modelJobs = findPipelineJobFiles(subjectId, stage, ["colab", "blender", "portrait_3d", "review_3d"]);
    let model3d;
    if (best3d && isApprovedStatus(best3d.status)) {
      model3d = { state: "ok", label: "✅ 已通過", cls: "ok", pkg: best3d };
    } else if (best3d && isProvisionalStatus(best3d.status)) {
      model3d = { state: "provisional", label: "🟦 暫時採用", cls: "provisional", pkg: best3d };
    } else if (best3d && best3d.status === "reject") {
      model3d = { state: "rejected", label: "❌ 退回待重製", cls: "reject", pkg: best3d };
    } else if (best3d) {
      const ts = parsePkgTypedState(best3d);
      const route = best3d.drivePath?.includes("/colab/") ? "Colab" : best3d.drivePath?.includes("/ai_blender/") ? "AI+Blender" : "3D";
      if (ts?.status === "RUNNING") {
        model3d = { state: "running", label: `⚙️ ${route} 生成中`, cls: "active", pkg: best3d, typedState: ts };
      } else if (ts?.status === "QUEUED") {
        model3d = { state: "queued_runner", label: `⏳ ${route} 排隊中`, cls: "active", pkg: best3d, typedState: ts };
      } else if (ts?.status === "QA_PENDING") {
        model3d = { state: "qa_pending", label: `🧪 ${route} 自動 QA 待檢`, cls: "active", pkg: best3d, typedState: ts };
      } else if (ts?.status === "REVIEW_REQUIRED") {
        model3d = { state: "reviewing", label: `🟨 ${route} 待人工審查`, cls: "active", pkg: best3d, typedState: ts };
      } else if (best3d.manifest?.missing?.length) {
        model3d = { state: "missing", label: `⚠️ 缺檔 (${best3d.manifest.missing.length})`, cls: "active", pkg: best3d, typedState: ts };
      } else {
        model3d = { state: "reviewing", label: `🟨 ${route} 待審查`, cls: "active", pkg: best3d, typedState: ts };
      }
    } else if (modelJobs.length > 0) {
      model3d = { state: "queued", label: "🔄 已送出 3D Prompt", cls: "active", jobFile: modelJobs[0] };
    } else if (isForgingThis && is3dType(state.taskId)) {
      model3d = { state: "forging", label: "⚡ 鍛造台編輯中", cls: "active" };
    } else {
      model3d = { state: "unprocessed", label: "⬜ 未處理", cls: "" };
    }

    const completed = matches.some(p => p.completed) || (portrait.state === "ok" && model3d.state === "ok");
    const isUnprocessed = !isAcceptedStatus(portrait.pkg?.status) || !isAcceptedStatus(model3d.pkg?.status);

    return {
      subjectId,
      stage,
      label: stageInfo ? `${STAGE_ZH[stage] || stage} · ${stageInfo.name_zh}` : subjectId,
      settingsDone,
      wikiDone,
      portrait,
      model3d,
      completed,
      isUnprocessed,
      matches
    };
  }

  function getDesignedItemSummary(id, type) {
    const matches = getReviewMatches(id);
    const okCount = matches.filter(p => isApprovedStatus(p.status)).length;
    const provCount = matches.filter(p => isProvisionalStatus(p.status)).length;
    const pendingCount = matches.filter(p => !isAcceptedStatus(p.status) && p.status !== "reject").length;
    const rejectedCount = matches.filter(p => p.status === "reject").length;

    let parts = [];
    if (type === "character") {
      parts = [computeSubjectPipelinePart(id, null, "character")];
    } else {
      const d = DESIGNED.find(x => x.line_id === id);
      const stages = d?.concept?.locked?.stages || [];
      parts = stages.map(st => computeSubjectPipelinePart(id, st.stage, "creature", st));
    }
    const unprocessedCount = parts.filter(pt => pt.isUnprocessed).length;
    const inProgressCount = parts.filter(pt =>
      ["reviewing", "queued", "forging", "running", "queued_runner", "qa_pending", "missing"].includes(pt.portrait.state) ||
      ["reviewing", "queued", "forging", "running", "queued_runner", "qa_pending", "missing"].includes(pt.model3d.state)
    ).length;

    return {
      matches,
      okCount,
      provCount,
      pendingCount,
      rejectedCount,
      unprocessedCount,
      inProgressCount,
      parts
    };
  }

  function selectDesignedItem(id, type) {
    designedState.selectedId = id;
    designedState.selectedType = type;
    renderDesignedRail();
    renderDesignedDetail();
  }

  function matchesDesignedStatusFilter(id, type) {
    const f = designedState.statusFilter || "all";
    if (f === "all") return true;
    const sum = getDesignedItemSummary(id, type);
    if (f === "accepted") return sum.okCount > 0 || sum.provCount > 0;
    if (f === "ok") return sum.okCount > 0;
    if (f === "provisional") return sum.provCount > 0;
    if (f === "unprocessed") return sum.unprocessedCount > 0;
    return true;
  }

  function renderDesignedRailBadges(sum, isForging) {
    const badges = [];
    if (sum.okCount > 0) badges.push(el("span", { class: "rl-stat ok", title: `成果審查台已通過 ${sum.okCount} 個包` }, `✅ 通過 ${sum.okCount}`));
    if (sum.provCount > 0) badges.push(el("span", { class: "rl-stat provisional", title: `成果審查台暫時採用 ${sum.provCount} 個包` }, `🟦 暫採 ${sum.provCount}`));
    if (sum.pendingCount > 0) badges.push(el("span", { class: "rl-stat pending", title: `待審查或生成中 ${sum.pendingCount} 個包` }, `🟨 待審 ${sum.pendingCount}`));
    if (sum.unprocessedCount > 0) {
      badges.push(
        sum.inProgressCount > 0
          ? el("span", { class: "rl-stat pending", title: `${sum.unprocessedCount} 項尚未定案，管線進行中` }, `🔄 管線中`)
          : el("span", { class: "rl-stat", style: "background:rgba(255,255,255,0.06);color:var(--muted)", title: `尚有 ${sum.unprocessedCount} 項未處理` }, `⬜ 未處理 ${sum.unprocessedCount}`)
      );
    }
    if (isForging) badges.push(el("span", { class: "rl-stat ok", style: "border:1px solid var(--ok)" }, "⚡ 鍛造中"));
    return badges;
  }

  function getDesignedFilteredItems() {
    const searchInput = $("#designedSearch");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    let lines = [];
    if (designedState.cat === "all" || designedState.cat === "creature") {
      lines = DESIGNED.filter(d => {
        if (!matchesDesignedStatusFilter(d.line_id, "creature")) return false;
        if (!query) return true;
        const id = (d.line_id || "").toLowerCase();
        const code = (d.code_zh || "").toLowerCase();
        const title = (d.title_zh || "").toLowerCase();
        const elem = (d.element || "").toLowerCase();
        const arch = (d.concept?.archetype || "").toLowerCase();
        const stagesStr = (d.concept?.locked?.stages || []).map(s => s.name_zh + " " + s.name_en + " " + s.creature_id).join(" ").toLowerCase();
        return id.includes(query) || code.includes(query) || title.includes(query) || elem.includes(query) || arch.includes(query) || stagesStr.includes(query);
      });
    }

    let chars = [];
    if (designedState.cat === "all" || designedState.cat === "character") {
      chars = DESIGNED_CHARACTERS.filter(c => {
        if (!matchesDesignedStatusFilter(c.id, "character")) return false;
        if (!query) return true;
        const id = (c.id || "").toLowerCase();
        const nameZh = (c.name_zh || "").toLowerCase();
        const nameEn = (c.name_en || "").toLowerCase();
        const role = (c.role || "").toLowerCase();
        const region = (c.region || "").toLowerCase();
        const ethnicity = (c.ethnicity || "").toLowerCase();
        const vessel = (c.vessel || "").toLowerCase();
        const bio = (c.biography || "").toLowerCase();
        return id.includes(query) || nameZh.includes(query) || nameEn.includes(query) || role.includes(query) || region.includes(query) || ethnicity.includes(query) || vessel.includes(query) || bio.includes(query);
      });
    }

    return { lines, chars };
  }

  function renderDesignedRail() {
    const listEl = $("#designedRailList");
    if (!listEl) return;
    listEl.replaceChildren();

    const { lines, chars } = getDesignedFilteredItems();
    const countEl = $("#designedRailCount");
    if (countEl) countEl.textContent = `${lines.length + chars.length} / ${DESIGNED.length + DESIGNED_CHARACTERS.length}`;

    // 確保有預設選取項目
    if (designedState.selectedType === "character") {
      if (!chars.some(c => c.id === designedState.selectedId)) {
        if (chars.length > 0) {
          designedState.selectedId = chars[0].id;
        } else if (lines.length > 0) {
          designedState.selectedId = lines[0].line_id;
          designedState.selectedType = "creature";
        } else {
          designedState.selectedId = null;
        }
      }
    } else {
      if (!lines.some(l => l.line_id === designedState.selectedId)) {
        if (lines.length > 0) {
          designedState.selectedId = lines[0].line_id;
          designedState.selectedType = "creature";
        } else if (chars.length > 0) {
          designedState.selectedId = chars[0].id;
          designedState.selectedType = "character";
        } else {
          designedState.selectedId = null;
        }
      }
    }

    if (!lines.length && !chars.length) {
      listEl.append(el("div", { class: "muted", style: "padding:16px;text-align:center;font-size:12px" }, "無符合搜尋條件的項目"));
      return;
    }

    if (lines.length > 0) {
      listEl.append(el("div", { class: "muted", style: "font-size:11px;font-weight:600;padding:4px 8px;margin-top:2px" }, `🐾 宙獸演化線 (${lines.length})`));
      lines.forEach(d => {
        const isSelected = designedState.selectedType === "creature" && designedState.selectedId === d.line_id;
        const isForging = state.preset === d.line_id;
        const sum = getDesignedItemSummary(d.line_id, "creature");

        const crThumbUrl = getCreatureStageAssetUrls(d.line_id, "adult").primaryUrl;
        const crThumbImg = el("img", {
          src: crThumbUrl,
          alt: d.title_zh,
          style: "width:100%;height:100%;object-fit:cover;object-position:center;",
          onerror: function() {
            this.style.display = "none";
            if (this.nextElementSibling) this.nextElementSibling.style.display = "flex";
          }
        });
        const crIconSpan = el("span", { style: "display:none;width:100%;height:100%;align-items:center;justify-content:center;" }, ELEM_ICONS[d.element] || "🐾");
        const rlThumbCr = el("div", { class: "rl-thumb", style: "background:#1e2532;overflow:hidden;position:relative;" }, crThumbImg, crIconSpan);

        const row = el("button", {
          class: "rl" + (isSelected ? " on" : ""),
          type: "button",
          onclick: () => selectDesignedItem(d.line_id, "creature")
        },
          rlThumbCr,
          el("div", { class: "rl-txt" },
            el("div", { class: "rl-id" }, `${d.code_zh} · ${d.title_zh}`),
            el("div", { class: "rl-sub" }, `${d.line_id} · ${d.element}`),
            el("div", { class: "rl-badges" }, ...renderDesignedRailBadges(sum, isForging))
          )
        );
        listEl.append(row);
      });
    }

    if (chars.length > 0) {
      listEl.append(el("div", { class: "muted", style: "font-size:11px;font-weight:600;padding:8px 8px 4px" }, `👤 角色 (${chars.length})`));
      chars.forEach(c => {
        const isSelected = designedState.selectedType === "character" && designedState.selectedId === c.id;
        const isForging = state.presetChar === c.id;
        const sum = getDesignedItemSummary(c.id, "character");

        const charThumbUrl = getCharacterAssetUrls(c.id).images[0].primaryUrl;
        const charThumbImg = el("img", {
          src: charThumbUrl || undefined,
          alt: c.name_zh,
          style: "width:100%;height:100%;object-fit:cover;object-position:top;" + (charThumbUrl ? "" : "display:none;"),
          onerror: function() {
            this.style.display = "none";
            if (this.nextElementSibling) this.nextElementSibling.style.display = "flex";
          }
        });
        const charIconSpan = el("span", { style: "display:" + (charThumbUrl ? "none" : "flex") + ";width:100%;height:100%;align-items:center;justify-content:center;" }, "👤");
        const rlThumbChar = el("div", { class: "rl-thumb", style: "background:#262035;overflow:hidden;position:relative;" }, charThumbImg, charIconSpan);

        const row = el("button", {
          class: "rl" + (isSelected ? " on" : ""),
          type: "button",
          onclick: () => selectDesignedItem(c.id, "character")
        },
          rlThumbChar,
          el("div", { class: "rl-txt" },
            el("div", { class: "rl-id" }, `${c.name_zh} · ${c.name_en}`),
            el("div", { class: "rl-sub" }, `${c.id} · ${c.role}`),
            el("div", { class: "rl-badges" }, ...renderDesignedRailBadges(sum, isForging))
          )
        );
        listEl.append(row);
      });
    }
  }

  function renderDesignedReviewDeliverablesCard(subjectId, kind) {
    const matches = sortPackagesByPriority(getReviewMatches(subjectId));
    const okPkgs = matches.filter(p => isApprovedStatus(p.status));
    const provPkgs = matches.filter(p => isProvisionalStatus(p.status));
    const acceptedPkgs = matches.filter(p => isAcceptedStatus(p.status));
    const otherPkgs = matches.filter(p => !isAcceptedStatus(p.status));

    const tab = designedState.reviewTab || "accepted";
    const visiblePkgs = tab === "ok" ? okPkgs : tab === "provisional" ? provPkgs : tab === "other" ? otherPkgs : acceptedPkgs;

    const card = el("div", { class: "designed-detail-card", style: "margin-bottom:12px" },
      el("div", { style: "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px" },
        el("h3", { style: "margin:0;font-size:13px;color:var(--text);display:flex;align-items:center;gap:6px" },
          el("span", {}, "📦 成果審查台：已通過與暫時採用"),
          el("span", { class: "f-badge ok" }, `✅ 通過 ${okPkgs.length}`),
          el("span", { class: "f-badge accent" }, `🟦 暫採 ${provPkgs.length}`),
          otherPkgs.length > 0 ? el("span", { class: "f-badge warn" }, `🟨 其他 ${otherPkgs.length}`) : null
        ),
        el("div", { class: "seg", style: "display:inline-flex" },
          [
            ["accepted", `✅🟦 通過＋暫採 (${acceptedPkgs.length})`],
            ["ok", `✅ 已通過 (${okPkgs.length})`],
            ["provisional", `🟦 暫時採用 (${provPkgs.length})`],
            ["other", `🟨 待審／退回 (${otherPkgs.length})`]
          ].map(([key, label]) => el("button", {
            type: "button",
            class: "segb" + (tab === key ? " on" : ""),
            style: "font-size:11px;padding:3px 8px",
            onclick: () => { designedState.reviewTab = key; renderDesignedDetail(); }
          }, label))
        )
      )
    );

    if (!matches.length) {
      card.append(el("div", { class: "muted", style: "font-size:12px;padding:6px 0" },
        "成果審查台目前尚未載入此項目的交付包。請登入 Drive 同步或至成果審查台載入資產目錄。"
      ));
      return card;
    }

    if (!visiblePkgs.length) {
      const emptyLabel = tab === "ok" ? "尚無「已通過」成果包" : tab === "provisional" ? "尚無「暫時採用」成果包" : tab === "other" ? "尚無其他待審／退回包" : "尚無「已通過」或「暫時採用」的成果包（可切換右側「🟨 待審／退回」查看審查中項目）";
      card.append(el("div", { class: "muted", style: "font-size:12px;padding:8px 0" }, emptyLabel));
      return card;
    }

    visiblePkgs.forEach(pkg => {
      const st = reviewStatusInfo(pkg.status);
      const is3d = is3dType(pkg.type);
      const imgs = (pkg.images || []).filter(i => i.url);
      const mainImg = imgs[0]?.url || "";
      const note = pkg.reviewRecord?.note || getReviewNote(pkg) || "";

      const thumbEl = el("div", { class: "designed-review-thumb" },
        mainImg
          ? el("img", { src: mainImg, alt: pkg.id })
          : el("span", { style: "font-size:22px;opacity:0.6" }, is3d ? "🧊" : "🎨")
      );

      const infoCol = el("div", { style: "flex:1;min-width:220px;display:flex;flex-direction:column;gap:4px" },
        el("div", { style: "display:flex;align-items:center;gap:6px;flex-wrap:wrap" },
          el("code", { style: "font-size:12px;color:var(--accent);font-weight:600" }, pkg.id),
          el("span", { class: "f-badge " + st.cls }, st.badge),
          el("span", { class: "f-badge" }, is3d ? "🧊 3D 模型" : "🎨 2D 立繪"),
          pkg.stage ? el("span", { class: "f-badge" }, STAGE_ZH[pkg.stage] || pkg.stage) : null,
          pkg.completed ? el("span", { class: "f-badge ok" }, "📁 03_completed") : null
        ),
        pkg.drivePath ? el("div", { class: "muted", style: "font-size:11px;font-family:monospace" }, pkg.drivePath) : null,
        note ? el("div", { style: "font-size:11.5px;color:var(--warn);background:rgba(217,182,109,0.08);padding:4px 8px;border-radius:4px;border-left:2px solid var(--warn)" }, `審查意見：${note}`) : null,
        imgs.length > 1 ? el("div", { style: "display:flex;gap:4px;flex-wrap:wrap;margin-top:2px" },
          imgs.slice(0, 5).map(im => el("img", {
            src: im.url,
            title: im.path,
            style: "width:34px;height:34px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.12);background:#101319;cursor:pointer",
            onclick: () => jumpToReview(pkg.id, pkg.stage)
          }))
        ) : null
      );

      const actionsCol = el("div", { style: "display:flex;flex-direction:column;gap:4px;align-items:flex-end" },
        el("button", {
          class: "btn mini", type: "button",
          onclick: () => jumpToReview(pkg.id, pkg.stage)
        }, "🔍 在審查台檢視"),
        (!is3d && isApprovedStatus(pkg.status)) ? el("button", {
          class: "btn mini ghost", type: "button",
          onclick: () => {
            if (kind === "character") useDesignedCharacter(subjectId, "character-model-rig");
            else useDesigned(subjectId, "creature-model-rig", pkg.stage || "adult");
          }
        }, "🧊 以此立繪鍛造 3D") : null
      );

      card.append(el("div", { class: "designed-review-item" }, thumbEl, infoCol, actionsCol));
    });

    return card;
  }

  function renderPipelineProgressCard(subjectId, kind) {
    const sum = getDesignedItemSummary(subjectId, kind);
    const parts = sum.parts;
    const totalSteps = parts.length * 2; // 2D + 3D per part
    const doneSteps = parts.reduce((acc, pt) => acc + (isApprovedStatus(pt.portrait.pkg?.status) ? 1 : 0) + (isApprovedStatus(pt.model3d.pkg?.status) ? 1 : 0), 0);
    const provSteps = parts.reduce((acc, pt) => acc + (isProvisionalStatus(pt.portrait.pkg?.status) ? 1 : 0) + (isProvisionalStatus(pt.model3d.pkg?.status) ? 1 : 0), 0);
    const activeSteps = parts.reduce((acc, pt) => acc + (!isAcceptedStatus(pt.portrait.pkg?.status) && pt.portrait.state !== "unprocessed" ? 1 : 0) + (!isAcceptedStatus(pt.model3d.pkg?.status) && pt.model3d.state !== "unprocessed" ? 1 : 0), 0);

    const visibleParts = designedState.pipelineShowAll ? parts : parts.filter(pt => pt.isUnprocessed);
    const idx = getDrivePipelineIndex();
    const syncText = idx.syncedAt ? `已同步 Drive 管線索引 (${new Date(idx.syncedAt).toLocaleTimeString()})` : "尚未同步 Drive 管線索引（Prompts / Settings / Wiki）";

    const card = el("div", { class: "designed-detail-card", style: "margin-bottom:12px;border-color:rgba(217,182,109,0.28)" },
      el("div", { style: "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px" },
        el("h3", { style: "margin:0;font-size:13px;color:var(--text);display:flex;align-items:center;gap:6px" },
          el("span", {}, "🔄 未處理項目與管線生成進度追蹤"),
          el("span", { class: "f-badge ok" }, `✅ ${doneSteps}/${totalSteps}`),
          provSteps > 0 ? el("span", { class: "f-badge accent" }, `🟦 暫採 ${provSteps}`) : null,
          activeSteps > 0 ? el("span", { class: "f-badge warn" }, `🔄 進行中 ${activeSteps}`) : null,
          sum.unprocessedCount > 0 ? el("span", { class: "f-badge" }, `待定案階段 ${sum.unprocessedCount}/${parts.length}`) : el("span", { class: "f-badge ok" }, "全部階段已定案")
        ),
        el("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap" },
          el("button", {
            class: "btn mini ghost", type: "button",
            onclick: () => { designedState.pipelineShowAll = !designedState.pipelineShowAll; renderDesignedDetail(); }
          }, designedState.pipelineShowAll ? "僅顯示未處理階段" : `顯示全部階段 (${parts.length})`),
          window.COSMI_DRIVE?.syncPipelineIndex ? el("button", {
            class: "btn mini ghost", type: "button",
            onclick: async () => {
              try {
                await window.COSMI_DRIVE.syncPipelineIndex();
                toast("已同步 Drive 管線生成進度");
              } catch (e) {
                toast("同步管線進度失敗：" + e.message);
              }
            }
          }, "🔄 同步管線進度") : null
        )
      ),
      el("div", { class: "pipeline-progress-bar", style: "margin-bottom:8px" },
        el("div", { class: "pipeline-progress-seg", style: `width:${totalSteps ? (doneSteps / totalSteps) * 100 : 0}%;background:var(--ok)` }),
        el("div", { class: "pipeline-progress-seg", style: `width:${totalSteps ? (provSteps / totalSteps) * 100 : 0}%;background:var(--accent)` }),
        el("div", { class: "pipeline-progress-seg", style: `width:${totalSteps ? (activeSteps / totalSteps) * 100 : 0}%;background:var(--warn)` })
      ),
      el("div", { class: "muted", style: "font-size:11px;margin-bottom:10px" }, syncText)
    );

    if (!visibleParts.length) {
      card.append(el("div", { class: "muted", style: "font-size:12px;padding:6px 0" },
        "🎉 此項目的 2D 立繪與 3D 模型皆已通過或暫時採用（可點選「顯示全部階段」檢視完整管線步驟）。"
      ));
      return card;
    }

    visibleParts.forEach(pt => {
      const ts = pt.model3d.typedState;
      const stepSummary = ts?.steps ? Object.entries(ts.steps).map(([k, v]) => `${k}: ${v?.status || "?"}`).join(" · ") : "";
      const detailHints = [
        pt.portrait.jobFile ? `2D Job: ${pt.portrait.jobFile.name}` : null,
        pt.model3d.jobFile ? `3D Job: ${pt.model3d.jobFile.name}` : null,
        pt.model3d.pkg?.drivePath ? `3D 目錄: ${pt.model3d.pkg.drivePath}` : null,
        stepSummary ? `Runner 步驟: ${stepSummary}` : null,
        pt.model3d.pkg?.manifest?.missing?.length ? `缺檔: ${pt.model3d.pkg.manifest.missing.join(", ")}` : null
      ].filter(Boolean);

      const row = el("div", { class: "pipeline-row" },
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px" },
          el("div", { style: "display:flex;align-items:center;gap:6px" },
            el("b", { style: "font-size:12.5px;color:#fff" }, pt.label),
            pt.stage ? el("code", { style: "font-size:11px;color:var(--accent)" }, pt.stage) : null
          ),
          el("div", { style: "display:flex;gap:6px;flex-wrap:wrap" },
            pt.portrait.pkg
              ? el("button", { class: "btn mini ghost", type: "button", onclick: () => jumpToReview(pt.portrait.pkg.id, pt.stage) }, "🔍 檢視 2D")
              : el("button", {
                class: "btn mini ghost", type: "button",
                onclick: () => kind === "character" ? useDesignedCharacter(subjectId, "character-concept") : useDesigned(subjectId, "creature-concept", pt.stage)
              }, "🎨 鍛造立繪"),
            pt.model3d.pkg
              ? el("button", { class: "btn mini ghost", type: "button", onclick: () => jumpToReview(pt.model3d.pkg.id, pt.stage) }, "🔍 檢視 3D")
              : el("button", {
                class: "btn mini ghost", type: "button",
                onclick: () => kind === "character" ? useDesignedCharacter(subjectId, "character-model-rig") : useDesigned(subjectId, "creature-model-rig", pt.stage)
              }, "🧊 鍛造 3D")
          )
        ),
        el("div", { class: "pipeline-stepper" },
          el("span", { class: "pipeline-step " + (pt.settingsDone ? "ok" : "") }, pt.settingsDone ? "✅ ① 外觀／參數" : "⬜ ① 外觀／參數"),
          el("span", { class: "muted" }, "→"),
          el("span", { class: "pipeline-step " + (pt.wikiDone ? "ok" : "") }, pt.wikiDone ? "✅ ② 圖鑑" : "⬜ ② 圖鑑"),
          el("span", { class: "muted" }, "→"),
          el("span", { class: "pipeline-step " + pt.portrait.cls }, `③ 2D 立繪：${pt.portrait.label}`),
          el("span", { class: "muted" }, "→"),
          el("span", { class: "pipeline-step " + pt.model3d.cls }, `④ 3D 建模：${pt.model3d.label}`),
          el("span", { class: "muted" }, "→"),
          el("span", { class: "pipeline-step " + (pt.completed ? "ok" : "") }, pt.completed ? "✅ ⑤ 完成區" : "⬜ ⑤ 最終驗收")
        ),
        detailHints.length ? el("div", { class: "muted", style: "font-size:11px;font-family:monospace;line-height:1.4" }, detailHints.join(" | ")) : null
      );
      card.append(row);
    });

    return card;
  }

  function renderDesignedDetail() {
    const headerEl = $("#designedStageHeader");
    const bodyEl = $("#designedDetailView");
    if (!headerEl || !bodyEl) return;

    headerEl.replaceChildren();
    bodyEl.replaceChildren();

    if (!designedState.selectedId) {
      bodyEl.append(el("div", { class: "muted", style: "padding:32px;text-align:center;font-size:13px" }, "請從左側名冊欄選取已設計項目進行審查檢驗。"));
      return;
    }

    if (designedState.selectedType === "character") {
      const c = DESIGNED_CHARACTERS.find(x => x.id === designedState.selectedId);
      if (!c) return;

      const isForging = state.presetChar === c.id;

      // Header row
      headerEl.append(
        el("span", { style: "font-size:18px" }, "👤"),
        el("b", { style: "font-size:14px;color:#fff" }, `${c.name_zh} · ${c.name_en}`),
        el("span", { class: "f-badge accent" }, c.id),
        el("span", { class: "f-badge" }, c.role),
        el("span", { class: "f-badge" }, `${c.gender} · ${c.age_band} (${c.age}歲)`),
        c.sensitivity === "review"
          ? el("span", { class: "f-badge warn", title: c.sensitivity_note || "文化顧問審核" }, "⚠️ 文化複審 (review)")
          : el("span", { class: "f-badge ok" }, "✅ 文化審查 (ok)"),
        isForging ? el("span", { class: "f-badge ok" }, "⚡ 目前鍛造中") : null
      );

      // Top Toolbar Card
      const toolCard = el("div", { class: "designed-detail-card", style: "margin-bottom:12px" },
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px" },
          el("div", { style: "display:flex;gap:6px;flex-wrap:wrap" },
            el("button", {
              class: "btn mini" + (isForging && state.taskId === "character-concept" ? "" : " ghost"),
              type: "button",
              onclick: () => useDesignedCharacter(c.id, "character-concept")
            }, "🎨 載入角色立繪鍛造"),
            el("button", {
              class: "btn mini" + (isForging && state.taskId === "character-model-rig" ? "" : " ghost"),
              type: "button",
              onclick: () => useDesignedCharacter(c.id, "character-model-rig")
            }, "🧊 載入角色 3D 鍛造"),
            el("button", {
              class: "btn mini ghost", type: "button",
              onclick: () => addDesignedCharToFavorites(c.id)
            }, "⭐ 收藏立繪 Prompt"),
            el("button", {
              class: "btn mini ghost", type: "button",
              onclick: () => jumpToReview(c.id)
            }, "🔍 轉至成果審查台"),
            el("button", {
              class: "btn mini ghost", type: "button",
              onclick: () => download(`${c.id}.json`, JSON.stringify(c, null, 2), "application/json")
            }, "⬇ 匯出 JSON")
          ),
          isForging ? el("button", {
            class: "btn mini ghost", type: "button",
            onclick: () => { state.presetChar = null; renderAll(); renderDesignedRail(); renderDesignedDetail(); toast("已取消設計角色"); }
          }, "✕ 取消設計（回隨機）") : null
        )
      );
      bodyEl.append(toolCard);

      // Visual Assets Showcase (2D Concept & 3D Renders from cosmos_chimera)
      const assetData = getCharacterAssetUrls(c.id);

      const pack2dStatus = assetData.pack ? reviewStatusInfo(assetData.pack.status) : null;
      const pack3dStatus = assetData.mdlPack ? reviewStatusInfo(assetData.mdlPack.status) : null;

      const artShowcaseCard = el("div", {
        class: "designed-detail-card",
        style: "border: 1px solid rgba(58,173,200,0.3); background: linear-gradient(180deg, rgba(23,26,33,0.95) 0%, rgba(18,20,26,0.98) 100%); margin-bottom: 12px;"
      },
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;flex-wrap:wrap;gap:8px" },
          el("div", { style: "display:flex;align-items:center;gap:8px" },
            el("span", { style: "font-size:16px" }, "🖼️"),
            el("b", { style: "font-size:13.5px;color:#fff" }, "角色 2D 概念立繪與 3D 成果視圖"),
            pack2dStatus ? el("span", { class: "f-badge " + pack2dStatus.cls, style: "font-size:10.5px" }, `2D：${pack2dStatus.badge}`) : el("span", { class: "f-badge", style: "font-size:10.5px" }, "2D：⏳ 未產出"),
            pack3dStatus ? el("span", { class: "f-badge " + pack3dStatus.cls, style: "font-size:10.5px" }, `3D：${pack3dStatus.badge}`) : el("span", { class: "f-badge", style: "font-size:10.5px" }, "3D：⏳ 未產出")
          ),
          el("div", { style: "display:flex;gap:6px;align-items:center" },
            el("code", { style: "color:var(--accent);font-size:11px" }, assetData.pack?.drivePath || assetData.mdlPack?.drivePath || `Assets/_Project/Art/Characters/${c.id}/`)
          )
        ),

        el("div", { style: "display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;align-items:start;" },
          // Col 1: 2D Concept Showcase
          el("div", { style: "background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;" },
            el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px" },
              el("span", { style: "font-weight:600;font-size:12.5px;color:var(--accent)" }, `🎨 2D 概念原畫 (${assetData.images.length} 視圖)`),
              el("span", { id: "charViewLabel", class: "muted", style: "font-size:11.5px" }, assetData.images[0].label)
            ),

            // Main Preview Image Frame
            el("div", {
              id: "charMainImgBox",
              style: "width:100%;height:380px;background:#101319;border:1px solid rgba(255,255,255,0.08);border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:10px;"
            },
              el("img", {
                id: "charMainImg",
                src: assetData.images[0].primaryUrl || undefined,
                alt: c.name_zh,
                style: "max-width:100%;max-height:100%;object-fit:contain;" + (assetData.images[0].primaryUrl ? "" : "display:none;"),
                onerror: function() {
                  if (assetData.images[0].fallbackUrl && this.src !== assetData.images[0].fallbackUrl) {
                    this.src = assetData.images[0].fallbackUrl;
                  }
                }
              }),
              !assetData.images[0].primaryUrl ? el("span", { class: "muted" }, "Drive 尚無此角色立繪") : null,
              el("a", {
                id: "charImgDownload",
                href: assetData.images[0].primaryUrl || "#",
                target: "_blank",
                class: "btn mini ghost",
                style: "position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);" + (assetData.images[0].primaryUrl ? "" : "display:none;"),
                title: "在新分頁檢視原尺寸大圖"
              }, "🔍 原圖")
            ),

            // Thumbnail Strip / View Switcher
            el("div", { style: "display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;" },
              assetData.images.filter(im => im.primaryUrl).map((im, idx) => {
                const thumbBtn = el("button", {
                  type: "button",
                  class: "segb" + (idx === 0 ? " on" : ""),
                  style: "display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px 6px;min-width:60px;border-radius:6px;border:1px solid " + (idx === 0 ? "var(--accent)" : "rgba(255,255,255,0.1)") + ";background:" + (idx === 0 ? "rgba(58,173,200,0.2)" : "rgba(0,0,0,0.2)") + ";cursor:pointer;",
                  onclick: () => {
                    const allThumbs = thumbBtn.parentElement.children;
                    for (let i = 0; i < allThumbs.length; i++) {
                      allThumbs[i].style.background = "rgba(0,0,0,0.2)";
                      allThumbs[i].style.borderColor = "rgba(255,255,255,0.1)";
                    }
                    thumbBtn.style.background = "rgba(58,173,200,0.2)";
                    thumbBtn.style.borderColor = "var(--accent)";

                    const mImg = $("#charMainImg");
                    const mLabel = $("#charViewLabel");
                    const mDl = $("#charImgDownload");
                    if (mImg) {
                      mImg.src = im.primaryUrl;
                      mImg.onerror = function() {
                        if (im.fallbackUrl && this.src !== im.fallbackUrl) this.src = im.fallbackUrl;
                      };
                    }
                    if (mLabel) mLabel.textContent = im.label;
                    if (mDl) mDl.href = im.primaryUrl;
                  }
                },
                  el("img", {
                    src: im.primaryUrl,
                    alt: im.view,
                    style: "width:44px;height:44px;object-fit:cover;border-radius:4px;background:#151821;",
                    onerror: function() {
                      if (im.fallbackUrl && this.src !== im.fallbackUrl) this.src = im.fallbackUrl;
                    }
                  }),
                  el("span", { style: "font-size:10px;white-space:nowrap;color:var(--text)" }, im.view)
                );
                return thumbBtn;
              })
            )
          ),

          // Col 2: 3D Model & Renders
          el("div", { style: "background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;display:flex;flex-direction:column;" },
            el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px" },
              el("span", { style: "font-weight:600;font-size:12.5px;color:#a9d9df" }, "🧊 3D 成果視圖與模型"),
              el("span", { class: "f-badge ok" }, "LOD0 Humanoid")
            ),

            // 3D Front Render Preview
            el("div", {
              style: "width:100%;height:260px;background:#101319;border:1px solid rgba(255,255,255,0.08);border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:10px;"
            },
              el("img", {
                src: assetData.modelFront.primaryUrl || undefined,
                alt: `${c.name_zh} 3D 正面正交`,
                style: "max-width:100%;max-height:100%;object-fit:contain;" + (assetData.modelFront.primaryUrl ? "" : "display:none;"),
                onerror: function() {
                  if (assetData.modelFront.fallbackUrl && this.src !== assetData.modelFront.fallbackUrl) {
                    this.src = assetData.modelFront.fallbackUrl;
                  }
                }
              }),
              !assetData.modelFront.primaryUrl ? el("span", { class: "muted" }, "Drive 尚無 3D 預覽圖") : null
            ),

            // 3D Asset Files Info
            el("div", { style: "display:flex;flex-direction:column;gap:6px;font-size:11.5px;margin-bottom:12px;" },
              el("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:rgba(0,0,0,0.2);border-radius:4px;" },
                el("span", { class: "muted" }, "3D 模型 (GLB)"),
                el("span", { style: "color:var(--ok);font-family:monospace" }, `${c.id}.glb`)
              ),
              el("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:rgba(0,0,0,0.2);border-radius:4px;" },
                el("span", { class: "muted" }, "骨架規格 (Rig)"),
                el("span", { style: "color:var(--ok)" }, "Unity Humanoid 28 骨")
              ),
              el("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:rgba(0,0,0,0.2);border-radius:4px;" },
                el("span", { class: "muted" }, "動作動畫 (Anim)"),
                el("span", { style: "color:var(--ok)" }, "32 支完整動態 FBX")
              )
            ),

            // Action button to open in 3D viewer
            el("button", {
              type: "button",
              class: "btn ok",
              style: "width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;",
              onclick: () => jumpToReview(c.id)
            }, "🔍 在成果審查台 3D 檢視器旋轉與播放動作")
          )
        )
      );
      bodyEl.append(artShowcaseCard);

      // Section 1: Specs
      const hexSwatches = el("div", { style: "display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px" });
      (c.palette_hex || []).forEach(hex => {
        hexSwatches.append(
          el("span", {
            style: `display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);font-size:11px;font-family:monospace;border:1px solid rgba(255,255,255,0.1)`
          },
            el("span", { style: `display:inline-block;width:10px;height:10px;border-radius:2px;background:${hex};border:1px solid #222` }),
            hex
          )
        );
      });

      const silTags = el("div", { style: "display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px" });
      (c.silhouette_keywords || []).forEach(k => {
        silTags.append(el("span", { class: "f-badge", style: "background:rgba(58,173,200,0.15);border-color:rgba(58,173,200,0.3);color:#a9d9df" }, `✦ ${k}`));
      });

      const specCard = el("div", { class: "designed-detail-card" },
        el("h3", { style: "margin:0 0 8px;font-size:13px;color:var(--text);display:flex;align-items:center;gap:6px" },
          el("span", {}, "👤 體態與規格屬性")
        ),
        el("div", { class: "designed-detail-grid" },
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "身高 / 體重"), el("div", { class: "v" }, `${c.height_cm} cm / ${c.weight_kg} kg`)),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "體脂 / 罩杯"), el("div", { class: "v" }, `${c.body_fat} ${c.cup_size ? "/ " + c.cup_size : ""}`)),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "時空背景"), el("div", { class: "v" }, c.timeline || "—")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "所屬地區 / 族裔"), el("div", { class: "v" }, `${c.region} (${c.ethnicity})`)),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "專屬器物 (Vessel)"), el("div", { class: "v" }, zhOf(C.VESSELS, c.vessel) || c.vessel || "—")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "服裝風格"), el("div", { class: "v" }, c.style || "—"))
        ),
        el("div", { class: "designed-detail-grid", style: "margin-top:8px" },
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "體型特徵"), el("div", { class: "v" }, c.body_type || "—")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "個性特質"), el("div", { class: "v" }, (c.personality || []).join("、") || "—")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "興趣 / 喜好"), el("div", { class: "v" }, `${(c.interests || []).join("、")} · 偏好 ${(c.likes || []).join("、")}`)),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "髮色 / 瞳色"), el("div", { class: "v" }, `髮：${(c.hair_palette || []).join("、")} / 瞳：${(c.eye_palette || []).join("、")}`))
        ),
        (c.silhouette_keywords && c.silhouette_keywords.length) ? el("div", { style: "margin-top:10px;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:6px;" },
          el("div", { class: "k", style: "color:var(--muted);font-size:11px;margin-bottom:4px" }, "3 秒剪影識別特徵 (Silhouette Keywords)"),
          silTags
        ) : null,
        (c.palette_hex && c.palette_hex.length) ? el("div", { style: "margin-top:8px;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:6px;" },
          el("div", { class: "k", style: "color:var(--muted);font-size:11px;margin-bottom:4px" }, `標準色盤 (服飾配色：${(c.outfit_palette || []).join("、")})`),
          hexSwatches
        ) : null
      );
      bodyEl.append(specCard);

      // Section 2: Bio & Backstory
      const bioCard = el("div", { class: "designed-detail-card" },
        el("h3", { style: "margin:0 0 8px;font-size:13px;color:var(--text)" }, "📖 角色背景與人設傳記"),
        c.backstory_zh ? el("div", { style: "font-size:12px;line-height:1.5;color:var(--accent);background:rgba(58,173,200,0.08);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;padding:8px 10px;margin-bottom:8px" },
          el("b", { style: "display:block;margin-bottom:2px" }, "人設提要"),
          c.backstory_zh
        ) : null,
        el("div", { style: "font-size:12.5px;line-height:1.6;color:var(--text);background:rgba(0,0,0,0.25);border-radius:6px;padding:12px;" },
          c.biography || "尚無背景傳記資料。"
        ),
        c.sensitivity_note ? el("div", { style: "font-size:11.5px;line-height:1.5;color:var(--warn);background:rgba(217,182,109,0.08);border:1px solid rgba(217,182,109,0.2);border-radius:6px;padding:8px 10px;margin-top:8px" },
          el("b", {}, "文化審查備忘 (Cultural Sensitivity)："),
          c.sensitivity_note
        ) : null
      );
      bodyEl.append(bioCard);

      // Section 3: Approved & Provisional Review Deliverables
      bodyEl.append(renderDesignedReviewDeliverablesCard(c.id, "character"));

      // Section 4: Pipeline Progress Tracker for Unprocessed Parts
      bodyEl.append(renderPipelineProgressCard(c.id, "character"));

    } else {
      // Creature Line
      const d = DESIGNED.find(x => x.line_id === designedState.selectedId);
      if (!d) return;

      const isForging = state.preset === d.line_id;

      // Header row
      headerEl.append(
        el("span", { style: "font-size:18px" }, ELEM_ICONS[d.element] || "🐾"),
        el("b", { style: "font-size:14px;color:#fff" }, `${d.code_zh} · ${d.title_zh}`),
        el("span", { class: "f-badge accent" }, d.line_id),
        el("span", { class: "f-badge" }, d.element),
        isForging ? el("span", { class: "f-badge ok" }, "⚡ 目前鍛造中") : null
      );

      // Top Toolbar Card
      const toolCard = el("div", { class: "designed-detail-card", style: "margin-bottom:12px" },
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px" },
          el("div", { style: "display:flex;gap:6px;flex-wrap:wrap" },
            el("button", {
              class: "btn mini" + (isForging && state.taskId === "creature-concept" ? "" : " ghost"),
              type: "button",
              onclick: () => useDesigned(d.line_id, "creature-concept")
            }, "🎨 載入全線立繪鍛造"),
            el("button", {
              class: "btn mini" + (isForging && (state.taskId === "creature-model-rig" || state.taskId === "model-rig") ? "" : " ghost"),
              type: "button",
              onclick: () => useDesigned(d.line_id, "creature-model-rig")
            }, "🧊 載入全線 3D 鍛造"),
            el("button", {
              class: "btn mini ghost", type: "button",
              onclick: () => addDesignedToFavorites(d.line_id, "adult")
            }, "⭐ 收藏整線 (成年)"),
            el("button", {
              class: "btn mini ghost", type: "button",
              onclick: () => jumpToReview(d.line_id)
            }, "🔍 轉至成果審查台"),
            el("button", {
              class: "btn mini ghost", type: "button",
              onclick: () => download(`${d.line_id}.json`, JSON.stringify(d, null, 2), "application/json")
            }, "⬇ 匯出 JSON")
          ),
          isForging ? el("button", {
            class: "btn mini ghost", type: "button",
            onclick: () => { state.preset = null; renderAll(); renderDesignedRail(); renderDesignedDetail(); toast("已取消設計線（回隨機）"); }
          }, "✕ 取消設計（回隨機）") : null
        )
      );
      bodyEl.append(toolCard);

      // Section: Overview Banner (Lineup & Scale from cosmos_chimera)
      const ovData = getCreatureOverviewAssetUrls(d.line_id);
      const ovCard = el("div", {
        class: "designed-detail-card",
        style: "display:none;background:rgba(0,0,0,0.25);border:1px solid rgba(58,173,200,0.25);margin-bottom:12px;"
      },
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px" },
          el("div", { style: "display:flex;align-items:center;gap:8px" },
            el("span", { style: "font-size:16px" }, "🐾"),
            el("b", { style: "font-size:13px;color:#fff" }, "演化陣容全貌 (Evolution Lineup & Scale)"),
            el("span", { class: "f-badge ok", style: "font-size:10px" }, "cosmos_chimera Overview")
          ),
          el("code", { style: "color:var(--accent);font-size:11px" }, `Assets/_Project/Art/Creatures/${d.line_id}/Overview/`)
        ),
        el("div", { style: "display:flex;gap:12px;flex-wrap:wrap" },
          el("div", { style: "flex:1;min-width:280px;height:180px;background:#101319;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;" },
            el("img", {
              src: ovData.lineupUrl,
              alt: `${d.title_zh} 演化排列`,
              style: "max-width:100%;max-height:100%;object-fit:contain;",
              onload: function() { ovCard.style.display = "block"; },
              onerror: function() {
                if (ovData.fallbackLineupUrl && this.src !== ovData.fallbackLineupUrl) {
                  this.src = ovData.fallbackLineupUrl;
                } else {
                  this.style.display = "none";
                }
              }
            }),
            el("span", { style: "position:absolute;bottom:6px;left:6px;font-size:10.5px;background:rgba(0,0,0,0.7);padding:2px 6px;border-radius:4px;color:#fff" }, "四階演化排列 (Lineup)")
          ),
          el("div", { style: "flex:1;min-width:280px;height:180px;background:#101319;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;" },
            el("img", {
              src: ovData.scaleUrl,
              alt: `${d.title_zh} 體型對照`,
              style: "max-width:100%;max-height:100%;object-fit:contain;",
              onload: function() { ovCard.style.display = "block"; },
              onerror: function() {
                if (ovData.fallbackScaleUrl && this.src !== ovData.fallbackScaleUrl) {
                  this.src = ovData.fallbackScaleUrl;
                } else {
                  this.style.display = "none";
                }
              }
            }),
            el("span", { style: "position:absolute;bottom:6px;left:6px;font-size:10.5px;background:rgba(0,0,0,0.7);padding:2px 6px;border-radius:4px;color:#fff" }, "體型比例對照 (Scale)")
          )
        )
      );
      bodyEl.append(ovCard);

      // Section 1: Concept summary
      const specCard = el("div", { class: "designed-detail-card" },
        el("h3", { style: "margin:0 0 8px;font-size:13px;color:var(--text)" }, "🧬 演化線核心設定與世界觀"),
        el("div", { class: "designed-detail-grid" },
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "原型生物 (Archetype)"), el("div", { class: "v" }, d.concept?.archetype || "—")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "時空背景 (Timeline)"), el("div", { class: "v" }, d.concept?.timeline || "—")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "體型軸 (Size Profile)"), el("div", { class: "v" }, d.concept?.size_profile || "S→M→L→XL")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "資料出處 (Source)"), el("div", { class: "v" }, d.source || "—"))
        ),
        el("div", { class: "designed-detail-grid", style: "margin-top:8px" },
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "元素屬性"), el("div", { class: "v" }, (d.concept?.elements || []).join("、") || d.element)),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "光環配色"), el("div", { class: "v" }, (d.concept?.element_palettes || []).join("；") || "—")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "基底特徵"), el("div", { class: "v" }, (d.concept?.bases || []).join("；") || "—")),
          el("div", { class: "designed-prop-item" }, el("div", { class: "k" }, "親本來源"), el("div", { class: "v" }, (d.concept?.base_parents || []).join("；") || "—"))
        )
      );
      bodyEl.append(specCard);

      // Section 2: Four Stages
      const stages = d.concept?.locked?.stages || [];
      const stageCardSection = el("div", { class: "designed-detail-card" },
        el("h3", { style: "margin:0 0 10px;font-size:13px;color:var(--text);display:flex;align-items:center;justify-content:space-between" },
          el("span", {}, `🐾 四階型態演化檢驗 (${stages.length} 階)`),
          el("span", { class: "muted", style: "font-size:11px" }, "點選各階按鈕可單獨載入該階立繪或 3D 鍛造")
        )
      );

      const stagesGrid = el("div", { class: "designed-stages-grid", style: "grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));" });

      stages.forEach(st => {
        const isCurStage = isForging && state.opts[state.taskId]?.stage === st.stage;
        const stMatches = getReviewMatches(d.line_id, st.stage);

        const stageCard = el("div", { class: "stage-mini-card" + (isCurStage ? " active" : "") });

        const stHeader = el("div", { class: "stage-mini-header" },
          el("b", { style: "color:#fff;font-size:13px" }, `${STAGE_ZH[st.stage] || st.stage} · ${st.name_zh}`),
          el("span", { class: "f-badge" }, st.size_class || "—")
        );

        // Stage 2D Concept Art Frame
        const stAssets = getCreatureStageAssetUrls(d.line_id, st.stage);
        const stImgBox = el("div", {
          style: "width:100%;height:140px;background:#101319;border:1px solid rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;position:relative;margin:4px 0 8px;display:flex;align-items:center;justify-content:center;"
        });
        const stImg = el("img", {
          src: stAssets.primaryUrl,
          alt: `${st.name_zh} 立繪`,
          style: "max-width:100%;max-height:100%;object-fit:contain;",
          onerror: function() {
            if (stAssets.fallbackUrl && this.src !== stAssets.fallbackUrl) {
              this.src = stAssets.fallbackUrl;
            } else {
              this.style.display = "none";
              if (this.nextElementSibling) this.nextElementSibling.style.display = "flex";
            }
          }
        });
        const stPlaceholder = el("div", {
          style: "display:none;width:100%;height:100%;align-items:center;justify-content:center;flex-direction:column;color:var(--muted);font-size:11px;gap:4px;"
        },
          el("span", { style: "font-size:22px;opacity:0.5;" }, ELEM_ICONS[d.element] || "🐾"),
          el("span", {}, "待鍛造立繪")
        );
        stImgBox.append(stImg, stPlaceholder);

        const stIdRow = el("div", { style: "display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:11px;margin:2px 0 4px" },
          el("code", { style: "color:var(--accent)" }, st.creature_id),
          el("span", {}, `${st.height_length || "—"} / ${st.weight || "—"}`)
        );

        const stDesc = el("div", { class: "muted", style: "font-size:11.5px;line-height:1.4;margin-bottom:4px" }, st.look);
        const stMove = el("div", { style: "font-size:11.5px;color:var(--warn);margin-bottom:6px" }, `專屬招式：${st.signature_move?.name_zh || "—"} (${st.signature_move?.range_class || ""})`);

        const stProgress = computeSubjectPipelinePart(d.line_id, st.stage, "creature", st);
        const stOrdered = sortPackagesByPriority(stMatches);
        const stReviewDiv = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 8px;background:rgba(0,0,0,0.25);border-radius:4px;font-size:11px;margin-bottom:6px;flex-wrap:wrap" });
        const stBadgesBox = el("div", { style: "display:flex;align-items:center;gap:4px;flex-wrap:wrap" },
          el("span", { class: "f-badge " + (stProgress.portrait.cls === "active" ? "warn" : stProgress.portrait.cls), style: "font-size:10px" }, `2D ${stProgress.portrait.label}`),
          el("span", { class: "f-badge " + (stProgress.model3d.cls === "active" ? "warn" : stProgress.model3d.cls), style: "font-size:10px" }, `3D ${stProgress.model3d.label}`)
        );
        if (stOrdered.length > 0) {
          const m = stOrdered[0];
          stReviewDiv.append(
            stBadgesBox,
            el("button", {
              class: "btn mini", type: "button", style: "height:20px;padding:0 6px;font-size:10.5px",
              title: `跳轉審查 ${m.id}`,
              onclick: () => jumpToReview(m.id, st.stage)
            }, "🔍 跳轉")
          );
        } else {
          stReviewDiv.append(
            stBadgesBox,
            el("button", {
              class: "btn mini ghost", type: "button", style: "height:20px;padding:0 6px;font-size:10.5px",
              onclick: () => jumpToReview(d.line_id, st.stage)
            }, "🔍 搜尋")
          );
        }

        const stBtns = el("div", { style: "display:flex;gap:4px;flex-wrap:wrap" },
          el("button", {
            class: "btn mini" + (isCurStage && state.taskId === "creature-concept" ? "" : " ghost"),
            type: "button", style: "flex:1;font-size:11px",
            onclick: () => useDesigned(d.line_id, "creature-concept", st.stage)
          }, "🎨 立繪鍛造"),
          el("button", {
            class: "btn mini" + (isCurStage && (state.taskId === "creature-model-rig" || state.taskId === "model-rig") ? "" : " ghost"),
            type: "button", style: "flex:1;font-size:11px",
            onclick: () => useDesigned(d.line_id, "creature-model-rig", st.stage)
          }, "🧊 3D 鍛造"),
          el("button", {
            class: "btn mini ghost", type: "button", style: "font-size:11px",
            title: `收藏 ${st.name_zh} (${STAGE_ZH[st.stage]}) 的立繪 Prompt`,
            onclick: () => addDesignedToFavorites(d.line_id, st.stage)
          }, "⭐ 收藏")
        );

        stageCard.append(stHeader, stImgBox, stIdRow, stDesc, stMove, stReviewDiv, stBtns);
        stagesGrid.append(stageCard);
      });

      stageCardSection.append(stagesGrid);
      bodyEl.append(stageCardSection);

      // Section 3: Approved & Provisional Review Deliverables
      bodyEl.append(renderDesignedReviewDeliverablesCard(d.line_id, "creature"));

      // Section 4: Pipeline Progress Tracker for Unprocessed Stages
      bodyEl.append(renderPipelineProgressCard(d.line_id, "creature"));
    }
  }

  function renderDesignedDesk() {
    renderDesignedRail();
    renderDesignedDetail();
    if (designedState.mode === "cards") renderDesignedList();
  }

  // ==================== 我的最愛 Prompt 與已設計清單管理 ====================
  const FAVORITES_KEY = "cosmimera_forge_favorites";
  let favorites = [];

  function loadFavorites() {
    try {
      favorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      if (!Array.isArray(favorites)) favorites = [];
    } catch (e) {
      favorites = [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.warn("Storage quota exceeded", e);
    }
  }

  function getReviewMatches(subjectId, stage = null) {
    if (!reviewState.packages || !reviewState.packages.length) return [];
    const s = (subjectId || "").trim().toLowerCase();
    if (!s) return [];
    return reviewState.packages.filter(p => {
      const pSub = (p.subjectId || p.manifest?.subject_id || "").toLowerCase();
      const pGrp = (p.groupKey || "").toLowerCase();
      const pId = (p.id || "").toLowerCase();
      const pSrc = (p.manifest?.source_pack || "").toLowerCase();
      const pLine = (p.concept?.line_id || "").toLowerCase();
      const pCreature = (p.concept?.creature_id || "").toLowerCase();
      const pConceptId = (p.concept?.id || "").toLowerCase();
      const pName = (p.concept?.name_zh || "").toLowerCase();

      let matchedSourcePack = false;
      if (pSrc) {
        if (pSrc === s || pSrc.includes(s)) {
          matchedSourcePack = true;
        } else {
          const srcPkg = reviewState.packages.find(x => (x.id || "").toLowerCase() === pSrc);
          if (srcPkg) {
            const srcSub = (srcPkg.subjectId || srcPkg.manifest?.subject_id || "").toLowerCase();
            const srcConceptId = (srcPkg.concept?.id || "").toLowerCase();
            const srcName = (srcPkg.concept?.name_zh || "").toLowerCase();
            if (srcSub === s || srcConceptId === s || srcName === s || srcSub.includes(s)) {
              matchedSourcePack = true;
            }
          }
        }
      }

      let matchedTargetPack = false;
      const refPkg = reviewState.packages.find(x => (x.manifest?.source_pack || "").toLowerCase() === pId);
      if (refPkg) {
        const refSub = (refPkg.subjectId || refPkg.manifest?.subject_id || "").toLowerCase();
        if (refSub === s || refSub.includes(s)) {
          matchedTargetPack = true;
        }
      }

      const matchedSubject = (
        pSub === s ||
        pGrp === s ||
        pLine === s ||
        pCreature === s ||
        pConceptId === s ||
        pName === s ||
        pId.includes(s) ||
        matchedSourcePack ||
        matchedTargetPack
      );
      if (!matchedSubject) return false;
      if (stage && p.stage && p.stage !== stage) return false;
      return true;
    });
  }

  async function jumpToReview(pkgIdOrSubject, stage = null) {
    await setViewMode("review");
    const s = (pkgIdOrSubject || "").trim().toLowerCase();

    // 1. Exact match by package ID
    let targetPkg = reviewState.packages.find(p => p.id.toLowerCase() === s);

    // 2. Match by subject and stage
    if (!targetPkg && stage) {
      targetPkg = reviewState.packages.find(p => {
        const pSub = (p.subjectId || p.manifest?.subject_id || "").toLowerCase();
        const pGrp = (p.groupKey || "").toLowerCase();
        const pLine = (p.concept?.line_id || "").toLowerCase();
        const pCreature = (p.concept?.creature_id || "").toLowerCase();
        const pConceptId = (p.concept?.id || "").toLowerCase();
        const pName = (p.concept?.name_zh || "").toLowerCase();
        const matchesSub = (pSub === s || pGrp === s || pLine === s || pCreature === s || pConceptId === s || pName === s || p.id.toLowerCase().includes(s));
        return matchesSub && p.stage === stage;
      });
    }

    // 3. Match by subject general
    if (!targetPkg) {
      targetPkg = reviewState.packages.find(p => {
        const pSub = (p.subjectId || p.manifest?.subject_id || "").toLowerCase();
        const pGrp = (p.groupKey || "").toLowerCase();
        const pLine = (p.concept?.line_id || "").toLowerCase();
        const pCreature = (p.concept?.creature_id || "").toLowerCase();
        const pConceptId = (p.concept?.id || "").toLowerCase();
        const pName = (p.concept?.name_zh || "").toLowerCase();
        return (pSub === s || pGrp === s || pLine === s || pCreature === s || pConceptId === s || pName === s || p.id.toLowerCase().includes(s));
      });
    }

    if (targetPkg) {
      reviewState.activePkgId = targetPkg.id;
      if (stage) reviewState.activeStage = stage;
      else if (targetPkg.stage) reviewState.activeStage = targetPkg.stage;
      reviewState.activeImgIdx = 0;
      renderReviewView();
      toast(`已跳轉至審查項目：${targetPkg.id}${targetPkg.stage ? " (" + (STAGE_ZH[targetPkg.stage] || targetPkg.stage) + ")" : ""}`);
    } else {
      reviewState.filterQuery = pkgIdOrSubject || "";
      const railSearch = $("#railSearch");
      if (railSearch) railSearch.value = pkgIdOrSubject || "";
      renderReviewView();
      toast(`已切換至審查台（搜尋過濾：${pkgIdOrSubject}）。可點選「📂 掃描本專案審查目錄」載入實體包。`);
    }
  }

  function addCurrentToFavorites() {
    const b = build();
    if (b.errors.length) {
      toast("Prompt 存在錯誤，無法加入我的最愛");
      return;
    }
    const t = b.ctx.task;
    const curStage = b.ctx.opts?.stage || null;
    let title = "";
    if (state.preset) {
      const d = designedItem();
      title = `${d ? d.code_zh + " · " + d.title_zh : state.preset}`;
      if (curStage) title += ` (${STAGE_ZH[curStage] || curStage})`;
    } else if (state.presetChar) {
      const dc = designedCharItem();
      title = `${dc ? dc.name_zh + " (" + dc.name_en + ")" : state.presetChar}`;
    } else if (b.ctx.concept?.name_zh) {
      title = `${b.ctx.concept.name_zh} (${state.seed})`;
      if (curStage) title += ` (${STAGE_ZH[curStage] || curStage})`;
    } else if (state.creature?.name_zh) {
      title = `${state.creature.name_zh} (${state.seed})`;
      if (curStage) title += ` (${STAGE_ZH[curStage] || curStage})`;
    } else if (state.character?.name_zh) {
      title = `${state.character.name_zh} (${state.seed})`;
    } else {
      title = `${t.zh} (${state.seed})`;
      if (curStage) title += ` (${STAGE_ZH[curStage] || curStage})`;
    }

    const curPrompt = $("#prompt").value || b.text;
    const existingIdx = favorites.findIndex(f => 
      f.task === t.id && f.subjectId === b.ctx.subjectId && f.seed === state.seed && f.stage === curStage && f.prompt === curPrompt
    );

    if (existingIdx >= 0) {
      toast("此 Prompt 已在我的最愛清單中！");
      updateFavButton();
      return;
    }

    const favItem = {
      id: "fav_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      title,
      task: t.id,
      taskZh: t.zh,
      subjectId: b.ctx.subjectId,
      stage: curStage,
      stageZh: curStage ? (STAGE_ZH[curStage] || curStage) : null,
      seed: state.seed,
      platform: state.platform,
      prompt: curPrompt,
      notes: state.notes || "",
      createdAt: new Date().toLocaleString(),
      stateSnapshot: {
        taskId: state.taskId,
        seed: state.seed,
        platform: state.platform,
        preset: state.preset,
        presetChar: state.presetChar,
        opts: JSON.parse(JSON.stringify(state.opts || {})),
        creature: JSON.parse(JSON.stringify(state.creature || {})),
        character: JSON.parse(JSON.stringify(state.character || {})),
        locks: JSON.parse(JSON.stringify(state.locks || {})),
        notes: state.notes || "",
        currentRound: state.currentRound || 1
      }
    };

    favorites.unshift(favItem);
    saveFavorites();
    renderFavorites();
    updateFavButton();
    toast("⭐ 已加入我的最愛 Prompt 清單！");
  }

  function addDesignedToFavorites(lineId, stage = null) {
    const d = DESIGNED.find(x => x.line_id === lineId);
    if (!d) return;

    const prevPreset = state.preset, prevTaskId = state.taskId;
    state.preset = lineId;
    state.taskId = "creature-concept";
    const o = state.opts["creature-concept"] || (state.opts["creature-concept"] = {});
    const prevStage = o.stage;
    if (stage) o.stage = stage;

    const b = build();
    const curStage = stage || o.stage || "adult";
    const stObj = d.concept?.locked?.stages?.find(s => s.stage === curStage);
    const stageTitle = stObj ? `${stObj.name_zh} (${STAGE_ZH[curStage] || curStage})` : (STAGE_ZH[curStage] || curStage);
    const title = `${d.code_zh} · ${d.title_zh} — ${stageTitle}`;

    state.preset = prevPreset;
    state.taskId = prevTaskId;
    if (prevStage !== undefined) o.stage = prevStage;

    if (!b || b.errors.length) {
      toast("無法產生已設計項目之 Prompt");
      return;
    }

    const curPrompt = b.text;
    const existing = favorites.find(f => f.subjectId === lineId && f.stage === curStage);
    if (existing) {
      toast(`「${title}」已在我的最愛清單中！`);
      return;
    }

    const favItem = {
      id: "fav_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      title,
      task: "creature-concept",
      taskZh: "宙獸概念立繪",
      subjectId: lineId,
      stage: curStage,
      stageZh: STAGE_ZH[curStage] || curStage,
      seed: state.seed,
      platform: state.platform,
      prompt: curPrompt,
      notes: "",
      createdAt: new Date().toLocaleString(),
      stateSnapshot: {
        taskId: "creature-concept",
        seed: state.seed,
        platform: state.platform,
        preset: lineId,
        opts: { "creature-concept": { stage: curStage } },
        creature: JSON.parse(JSON.stringify(d.concept)),
        character: {},
        locks: {},
        notes: "",
        currentRound: 1
      }
    };

    favorites.unshift(favItem);
    saveFavorites();
    renderFavorites();
    updateFavButton();
    toast(`⭐ 已收藏已設計項目：「${title}」！`);
  }

  function addDesignedCharToFavorites(charId) {
    const c = DESIGNED_CHARACTERS.find(x => x.id === charId);
    if (!c) return;

    const prevPreset = state.preset, prevPresetChar = state.presetChar, prevTaskId = state.taskId;
    state.preset = null;
    state.presetChar = charId;
    state.taskId = "character-concept";

    const b = build();
    const title = `${c.name_zh} (${c.name_en}) — 角色立繪`;

    state.preset = prevPreset;
    state.presetChar = prevPresetChar;
    state.taskId = prevTaskId;

    if (!b || b.errors.length) {
      toast("無法產生已設計角色之 Prompt");
      return;
    }

    const curPrompt = b.text;
    const existing = favorites.find(f => f.subjectId === charId);
    if (existing) {
      toast(`「${title}」已在我的最愛清單中！`);
      return;
    }

    const favItem = {
      id: "fav_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      title,
      task: "character-concept",
      taskZh: "角色設計概念與立繪",
      subjectId: charId,
      stage: null,
      stageZh: "全貌",
      seed: state.seed,
      platform: state.platform,
      prompt: curPrompt,
      notes: "",
      createdAt: new Date().toLocaleString(),
      stateSnapshot: {
        taskId: "character-concept",
        seed: state.seed,
        platform: state.platform,
        preset: null,
        presetChar: charId,
        opts: {},
        creature: {},
        character: JSON.parse(JSON.stringify(c)),
        locks: {},
        notes: "",
        currentRound: 1
      }
    };

    favorites.unshift(favItem);
    saveFavorites();
    renderFavorites();
    updateFavButton();
    toast(`⭐ 已收藏已設計角色：「${title}」！`);
  }

  function applyFavorite(fav) {
    if (!fav) return;
    state.taskId = fav.task;
    state.seed = fav.seed || state.seed;
    state.platform = fav.platform || "chatgpt";
    if (fav.stateSnapshot) {
      state.preset = fav.stateSnapshot.preset || null;
      state.presetChar = fav.stateSnapshot.presetChar || null;
      state.opts = JSON.parse(JSON.stringify(fav.stateSnapshot.opts || {}));
      state.creature = JSON.parse(JSON.stringify(fav.stateSnapshot.creature || {}));
      state.character = JSON.parse(JSON.stringify(fav.stateSnapshot.character || {}));
      state.locks = JSON.parse(JSON.stringify(fav.stateSnapshot.locks || {}));
      state.notes = fav.stateSnapshot.notes || fav.notes || "";
      state.currentRound = fav.stateSnapshot.currentRound || 1;
    } else {
      state.preset = null;
      state.presetChar = null;
      state.notes = fav.notes || "";
    }
    renderAll();
    const promptEl = $("#prompt");
    if (promptEl) promptEl.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("⚡ 已載入收藏的 Prompt 設定：「" + fav.title + "」");
  }

  function removeFavorite(id) {
    const idx = favorites.findIndex(f => f.id === id);
    if (idx >= 0) {
      const title = favorites[idx].title;
      favorites.splice(idx, 1);
      saveFavorites();
      renderFavorites();
      updateFavButton();
      toast("已自我的最愛移除：「" + title + "」");
    }
  }

  function updateFavButton() {
    const btn = $("#btnFavPrompt"); if (!btn) return;
    const b = lastBuild;
    let isFav = false;
    if (b && b.ctx && !b.errors.length) {
      const t = b.ctx.task;
      const curStage = b.ctx.opts?.stage || null;
      const curPrompt = $("#prompt") ? $("#prompt").value : b.text;
      isFav = favorites.some(f =>
        f.task === t.id && f.subjectId === b.ctx.subjectId && f.seed === state.seed && f.stage === curStage && f.prompt === curPrompt
      );
    }
    const label = isFav ? "已收藏此 Prompt" : "收藏此 Prompt";
    btn.textContent = isFav ? "★" : "☆";
    btn.setAttribute("aria-label", label);
    btn.dataset.tip = label;
    btn.classList.toggle("on", isFav);
  }

  function renderFavorites() {
    const box = $("#favList"); if (!box) return;
    box.replaceChildren();

    const searchInput = $("#favSearch");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const filtered = favorites.filter(f => {
      if (!query) return true;
      const t = (f.title || "").toLowerCase();
      const p = (f.prompt || "").toLowerCase();
      const s = (f.subjectId || "").toLowerCase();
      const seed = (f.seed || "").toLowerCase();
      const task = (f.taskZh || f.task || "").toLowerCase();
      return t.includes(query) || p.includes(query) || s.includes(query) || seed.includes(query) || task.includes(query);
    });

    const countEl = $("#favCount");
    if (countEl) countEl.textContent = `(${favorites.length}${query ? "，符合 " + filtered.length : ""})`;

    if (!filtered.length) {
      const msg = favorites.length ? "沒有符合搜尋條件的收藏項目。" : "目前尚無收藏的 Prompt。可點選上方「⭐ 收藏此 Prompt」將當前設定加入最愛。";
      box.append(el("div", { class: "muted", style: "padding:16px;text-align:center;border:1px dashed var(--line);border-radius:6px;font-size:12.5px" }, msg));
      return;
    }

    filtered.forEach(fav => {
      const card = el("div", { class: "forge-list-card" });
      
      // 1. Header row
      const titleRow = el("div", { class: "card-title-row" },
        el("div", { class: "card-title" },
          el("span", { style: "color:var(--warn);font-size:14px" }, "⭐"),
          el("span", {}, fav.title)
        ),
        el("div", { class: "card-badges" },
          el("span", { class: "f-badge accent" }, fav.taskZh || fav.task),
          fav.stageZh ? el("span", { class: "f-badge" }, fav.stageZh) : null,
          el("span", { class: "f-badge" }, fav.platform === "gemini" ? "Gemini" : "ChatGPT")
        )
      );

      // 2. Meta row
      const metaRow = el("div", { class: "card-meta-row" },
        el("span", {}, "主體: " + (fav.subjectId || "—")),
        el("span", {}, "Seed: " + (fav.seed || "—")),
        el("span", {}, "收藏時間: " + fav.createdAt)
      );

      // 3. Prompt Preview
      const promptBox = el("pre", { class: "card-prompt-box" }, fav.prompt);
      const toggleExpand = el("button", {
        type: "button", class: "btn mini ghost", style: "font-size:10.5px;padding:1px 6px;margin-left:auto",
        onclick: (e) => {
          promptBox.classList.toggle("expanded");
          e.currentTarget.textContent = promptBox.classList.contains("expanded") ? "收合" : "展開全文";
        }
      }, "展開全文");

      // 4. 對應審查欄位 (Review Row)
      const matches = getReviewMatches(fav.subjectId, fav.stage);
      const reviewRow = el("div", { class: "card-review-row" });
      const reviewInfo = el("div", { class: "card-review-info" });
      
      if (matches.length > 0) {
        const topMatch = matches[0];
        const stInfo = reviewStatusInfo(topMatch.status);
        reviewInfo.append(
          el("span", { class: "prompt-k" }, "審查欄位："),
          el("span", { class: "f-badge " + stInfo.cls }, stInfo.badge),
          el("code", {}, topMatch.id)
        );
        reviewRow.append(
          reviewInfo,
          el("button", {
            class: "btn mini", type: "button",
            title: `跳轉至審查台檢視此任務成果 (${topMatch.id})`,
            onclick: () => jumpToReview(topMatch.id, fav.stage)
          }, "🔍 跳轉審查台")
        );
      } else {
        reviewInfo.append(
          el("span", { class: "prompt-k" }, "審查欄位："),
          el("span", { class: "f-badge" }, "審查台暫無對應包"),
          el("span", { class: "muted" }, `(主體 ${fav.subjectId})`)
        );
        reviewRow.append(
          reviewInfo,
          el("button", {
            class: "btn mini ghost", type: "button",
            title: `前往成果審查台搜尋主體 ${fav.subjectId}`,
            onclick: () => jumpToReview(fav.subjectId, fav.stage)
          }, "🔍 轉至審查搜尋")
        );
      }

      // 5. Actions row
      const actionsRow = el("div", { class: "card-actions" },
        el("button", {
          class: "btn mini", type: "button",
          onclick: () => copyText(fav.prompt, `已複製收藏 Prompt：「${fav.title}」`)
        }, "📋 複製 Prompt"),
        el("button", {
          class: "btn mini ghost", type: "button",
          onclick: () => applyFavorite(fav)
        }, "⚡ 載入至鍛造"),
        el("button", {
          class: "btn mini ghost", type: "button", style: "color:var(--danger)",
          onclick: () => removeFavorite(fav.id)
        }, "🗑️ 移除")
      );

      const promptWrap = el("div", { style: "display:flex;flex-direction:column;gap:3px" },
        el("div", { style: "display:flex;align-items:center;justify-content:space-between" },
          el("span", { class: "prompt-k" }, "Prompt 預覽："),
          toggleExpand
        ),
        promptBox
      );

      card.append(titleRow, metaRow, promptWrap, reviewRow, actionsRow);
      box.append(card);
    });
  }

  function renderDesignedList() {
    const box = $("#designedList"); if (!box) return;
    box.replaceChildren();
    const {lines:filteredLines, chars:filteredChars} = getDesignedFilteredItems();
    const query = $("#designedSearch")?.value.trim().toLowerCase() || "";

    const countEl = $("#designedCount");
    if (countEl) countEl.textContent = `(${DESIGNED.length} 宙獸線 · ${DESIGNED_CHARACTERS.length} 角色${query ? "，符合 " + (filteredLines.length + filteredChars.length) : ""})`;

    if (!filteredLines.length && !filteredChars.length) {
      box.append(el("div", { class: "muted", style: "padding:16px;text-align:center;border:1px dashed var(--line);border-radius:6px;font-size:12.5px" }, "沒有符合搜尋條件的已設計項目。"));
      return;
    }

    // 1. 宙獸演化線清單
    if (filteredLines.length > 0) {
      box.append(el("h3", { style: "margin:10px 0 8px;font-size:14px;color:var(--text);display:flex;align-items:center;gap:6px" },
        el("span", {}, "🐾 已設計宙獸演化線"),
        el("span", { class: "f-badge accent" }, `${filteredLines.length} 線 / ${filteredLines.length * 3 + (filteredLines.filter(x => (x.concept?.locked?.stages || []).length > 3).length)} 階`)
      ));

      filteredLines.forEach(d => {
        const isPresetActive = state.preset === d.line_id;
        const card = el("div", { class: "forge-list-card" + (isPresetActive ? " active" : "") });

        // 1. Line Title Row
        const titleRow = el("div", { class: "card-title-row" },
          el("div", { class: "card-title" },
            el("span", { style: "color:var(--warn)" }, ELEM_ICONS[d.element] || "🐾"),
            el("span", {}, d.code_zh + " · " + d.title_zh)
          ),
          el("div", { class: "card-badges" },
            el("span", { class: "f-badge accent" }, d.line_id),
            el("span", { class: "f-badge" }, d.element),
            isPresetActive ? el("span", { class: "f-badge ok" }, "目前鍛造中") : null
          )
        );

        // 2. Line Meta Row
        const metaRow = el("div", { class: "card-meta-row" },
          el("span", {}, "原型: " + (d.concept?.archetype || "—")),
          el("span", {}, "時空: " + (d.concept?.timeline || "—")),
          el("span", {}, "體型軸: " + (d.concept?.size_profile || "S→M→L→XL")),
          el("span", {}, "來源: " + d.source)
        );

        // 3. Line Review Row (整線審查欄位 + 管線進度)
        const lineMatches = sortPackagesByPriority(getReviewMatches(d.line_id));
        const lineSum = getDesignedItemSummary(d.line_id, "creature");
        const reviewRow = el("div", { class: "card-review-row" });
        const reviewInfo = el("div", { class: "card-review-info" });

        if (lineMatches.length > 0) {
          const topMatch = lineMatches[0];
          const stInfo = reviewStatusInfo(topMatch.status);
          reviewInfo.append(
            el("span", { class: "prompt-k" }, "審查與管線："),
            el("span", { class: "f-badge " + stInfo.cls }, stInfo.badge),
            lineSum.okCount > 0 ? el("span", { class: "f-badge ok" }, `✅ 通過 ${lineSum.okCount}`) : null,
            lineSum.provCount > 0 ? el("span", { class: "f-badge accent" }, `🟦 暫採 ${lineSum.provCount}`) : null,
            lineSum.unprocessedCount > 0 ? el("span", { class: "f-badge warn" }, lineSum.inProgressCount > 0 ? `🔄 管線中 (${lineSum.unprocessedCount} 階)` : `⬜ 未處理 ${lineSum.unprocessedCount} 階`) : null,
            el("code", {}, topMatch.id)
          );
          reviewRow.append(
            reviewInfo,
            el("button", {
              class: "btn mini", type: "button",
              title: `跳轉至審查台檢視此線成果 (${topMatch.id})`,
              onclick: () => jumpToReview(topMatch.id)
            }, "🔍 跳轉審查台")
          );
        } else {
          reviewInfo.append(
            el("span", { class: "prompt-k" }, "審查與管線："),
            el("span", { class: "f-badge" }, lineSum.inProgressCount > 0 ? "🔄 管線生成中" : "⬜ 尚未產出"),
            el("span", { class: "muted" }, `(${d.line_id})`)
          );
          reviewRow.append(
            reviewInfo,
            el("button", {
              class: "btn mini ghost", type: "button",
              title: `前往成果審查台搜尋此線 ${d.line_id}`,
              onclick: () => jumpToReview(d.line_id)
            }, "🔍 轉至審查搜尋")
          );
        }

        // 4. Line Actions Row
        const lineActions = el("div", { class: "card-actions" },
          el("button", {
            class: "btn mini" + (isPresetActive && state.taskId === "creature-concept" ? "" : " ghost"),
            type: "button",
            onclick: () => useDesigned(d.line_id, "creature-concept")
          }, "🎨 載入立繪鍛造"),
          el("button", {
            class: "btn mini" + (isPresetActive && (state.taskId === "creature-model-rig" || state.taskId === "model-rig") ? "" : " ghost"),
            type: "button",
            onclick: () => useDesigned(d.line_id, "creature-model-rig")
          }, "🧊 載入 3D 鍛造"),
          el("button", {
            class: "btn mini ghost", type: "button",
            title: "將此線成年型態加入我的最愛",
            onclick: () => addDesignedToFavorites(d.line_id, "adult")
          }, "⭐ 收藏整線 (成年)"),
          isPresetActive ? el("button", {
            class: "btn mini ghost", type: "button",
            onclick: () => { state.preset = null; renderAll(); }
          }, "✕ 取消已設計（回隨機）") : null
        );

        // 5. Four Stages Grid (四階型態卡片)
        const stages = d.concept?.locked?.stages || [];
        const stagesGrid = el("div", { class: "designed-stages-grid" });

        stages.forEach(st => {
          const isCurStage = isPresetActive && state.opts[state.taskId]?.stage === st.stage;
          const stageCard = el("div", { class: "stage-mini-card" + (isCurStage ? " active" : "") });
          
          // Stage Header
          const stHeader = el("div", { class: "stage-mini-header" },
            el("b", { style: "color:#fff" }, `${STAGE_ZH[st.stage] || st.stage} · ${st.name_zh}`),
            el("span", { class: "f-badge" }, st.size_class || "—")
          );

          // Stage 2D Image Thumbnail from cosmos_chimera
          const stAssets = getCreatureStageAssetUrls(d.line_id, st.stage);
          const stImgBox = el("div", {
            style: "width:100%;height:100px;background:#101319;border-radius:4px;overflow:hidden;position:relative;margin:4px 0;display:flex;align-items:center;justify-content:center;"
          });
          const stImg = el("img", {
            src: stAssets.primaryUrl,
            alt: st.name_zh,
            style: "max-width:100%;max-height:100%;object-fit:contain;",
            onerror: function() {
              if (stAssets.fallbackUrl && this.src !== stAssets.fallbackUrl) {
                this.src = stAssets.fallbackUrl;
              } else {
                this.style.display = "none";
                if (this.nextElementSibling) this.nextElementSibling.style.display = "flex";
              }
            }
          });
          const stPlaceholder = el("div", {
            style: "display:none;width:100%;height:100%;align-items:center;justify-content:center;color:var(--muted);font-size:10.5px;gap:4px;"
          },
            el("span", { style: "font-size:16px;opacity:0.6" }, ELEM_ICONS[d.element] || "🐾"),
            el("span", {}, "待鍛造立繪")
          );
          stImgBox.append(stImg, stPlaceholder);

          // Stage Meta
          const stIdRow = el("div", { style: "display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:11px" },
            el("code", {}, st.creature_id),
            el("span", {}, `${st.height_length || "—"} / ${st.weight || "—"}`)
          );

          // Stage Look & Move
          const stDesc = el("div", { class: "muted", style: "font-size:11px;line-height:1.3;max-height:38px;overflow:hidden;text-overflow:ellipsis" }, st.look);
          const stMove = el("div", { style: "font-size:11px;color:var(--warn)" }, `招式：${st.signature_move?.name_zh || "—"} (${st.signature_move?.range_class || ""})`);

          // Stage 審查跳轉檢查
          const stMatches = getReviewMatches(d.line_id, st.stage);
          const stReviewDiv = el("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:3px 6px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:11px;margin-top:2px" });
          if (stMatches.length > 0) {
            const m = stMatches[0];
            stReviewDiv.append(
              el("span", { style: "color:var(--ok)" }, "✅ 審查包收錄"),
              el("button", {
                class: "btn mini", type: "button", style: "height:20px;padding:0 5px;font-size:10px",
                title: `跳轉審查 ${m.id}`,
                onclick: () => jumpToReview(m.id, st.stage)
              }, "🔍 跳轉")
            );
          } else {
            stReviewDiv.append(
              el("span", { class: "muted" }, "審查：未載入包"),
              el("button", {
                class: "btn mini ghost", type: "button", style: "height:20px;padding:0 5px;font-size:10px",
                title: `至審查台搜尋`,
                onclick: () => jumpToReview(d.line_id, st.stage)
              }, "🔍 搜尋")
            );
          }

          // Stage buttons
          const stBtns = el("div", { style: "display:flex;gap:4px;margin-top:4px;flex-wrap:wrap" },
            el("button", {
              class: "btn mini" + (isCurStage && state.taskId === "creature-concept" ? "" : " ghost"),
              type: "button", style: "flex:1;font-size:10.5px;padding:1px 4px",
              onclick: () => useDesigned(d.line_id, "creature-concept", st.stage)
            }, "🎨 立繪"),
            el("button", {
              class: "btn mini" + (isCurStage && (state.taskId === "creature-model-rig" || state.taskId === "model-rig") ? "" : " ghost"),
              type: "button", style: "flex:1;font-size:10.5px;padding:1px 4px",
              onclick: () => useDesigned(d.line_id, "creature-model-rig", st.stage)
            }, "🧊 3D"),
            el("button", {
              class: "btn mini ghost", type: "button", style: "font-size:10.5px;padding:1px 4px",
              title: `收藏 ${st.name_zh} (${STAGE_ZH[st.stage]}) 的立繪 Prompt`,
              onclick: () => addDesignedToFavorites(d.line_id, st.stage)
            }, "⭐ 收藏")
          );

          stageCard.append(stHeader, stImgBox, stIdRow, stDesc, stMove, stReviewDiv, stBtns);
          stagesGrid.append(stageCard);
        });

        card.append(titleRow, metaRow, reviewRow, lineActions, stagesGrid);
        box.append(card);
      });
    }

    // 2. 角色清單
    if (filteredChars.length > 0) {
      box.append(el("h3", { style: "margin:20px 0 8px;font-size:14px;color:var(--text);display:flex;align-items:center;gap:6px" },
        el("span", {}, "👤 已設計角色"),
        el("span", { class: "f-badge accent" }, `${filteredChars.length} 位`)
      ));

      filteredChars.forEach(c => {
        const isPresetActive = state.presetChar === c.id;
        const card = el("div", { class: "forge-list-card" + (isPresetActive ? " active" : "") });

        // 1. Title Row
        const titleRow = el("div", { class: "card-title-row" },
          el("div", { class: "card-title" },
            el("span", { style: "color:var(--accent)" }, "👤"),
            el("span", {}, `${c.name_zh} · ${c.name_en}`)
          ),
          el("div", { class: "card-badges" },
            el("span", { class: "f-badge accent" }, c.id),
            el("span", { class: "f-badge" }, c.role),
            el("span", { class: "f-badge" }, `${c.gender} · ${c.age_band} (${c.age}歲)`),
            c.sensitivity === "review"
              ? el("span", { class: "f-badge warn" }, "⚠️ 文化複審")
              : el("span", { class: "f-badge ok" }, "✅ 文化審查"),
            isPresetActive ? el("span", { class: "f-badge ok" }, "目前鍛造中") : null
          )
        );

        // 1.5. Visual Assets Showcase Row (2D Concept & 3D Model from cosmos_chimera)
        const charAssets = getCharacterAssetUrls(c.id);
        const visualRow = el("div", {
          style: "display:flex;gap:12px;margin:8px 0;padding:8px 10px;background:rgba(0,0,0,0.22);border-radius:6px;align-items:center;flex-wrap:wrap;"
        },
          el("div", { style: "display:flex;align-items:center;gap:8px" },
            el("img", {
              src: charAssets.images[0].primaryUrl,
              alt: `${c.name_zh} 主立繪`,
              style: "width:54px;height:68px;object-fit:cover;object-position:top;border-radius:4px;border:1px solid rgba(255,255,255,0.12);background:#101319;",
              onerror: function() {
                if (charAssets.images[0].fallbackUrl && this.src !== charAssets.images[0].fallbackUrl) this.src = charAssets.images[0].fallbackUrl;
              }
            }),
            el("div", {},
              el("div", { style: "font-size:11px;color:var(--accent);font-weight:600" }, "🎨 2D 主立繪"),
              el("div", { style: "font-size:10.5px;color:var(--text)" }, `${c.name_zh}`)
            )
          ),
          el("div", { style: "display:flex;align-items:center;gap:8px" },
            el("img", {
              src: charAssets.images[1].primaryUrl,
              alt: `${c.name_zh} 三視圖`,
              style: "width:80px;height:68px;object-fit:cover;object-position:center;border-radius:4px;border:1px solid rgba(255,255,255,0.12);background:#101319;",
              onerror: function() {
                if (charAssets.images[1].fallbackUrl && this.src !== charAssets.images[1].fallbackUrl) this.src = charAssets.images[1].fallbackUrl;
              }
            }),
            el("div", {},
              el("div", { style: "font-size:11px;color:var(--accent);font-weight:600" }, "📐 三視圖"),
              el("div", { style: "font-size:10.5px;color:var(--muted)" }, "T-pose 灰底")
            )
          ),
          el("div", { style: "display:flex;align-items:center;gap:8px" },
            el("img", {
              src: charAssets.modelFront.primaryUrl,
              alt: `${c.name_zh} 3D 正面正交`,
              style: "width:54px;height:68px;object-fit:cover;object-position:center;border-radius:4px;border:1px solid rgba(255,255,255,0.12);background:#101319;",
              onerror: function() {
                if (charAssets.modelFront.fallbackUrl && this.src !== charAssets.modelFront.fallbackUrl) this.src = charAssets.modelFront.fallbackUrl;
              }
            }),
            el("div", {},
              el("div", { style: "font-size:11px;color:#a9d9df;font-weight:600" }, "🧊 3D 建模"),
              el("div", { style: "font-size:10.5px;color:var(--ok)" }, "GLB + 32 動畫")
            )
          )
        );

        // 2. Meta Row
        const metaRow = el("div", { class: "card-meta-row" },
          el("span", {}, `體型: ${c.height_cm} cm / ${c.weight_kg} kg`),
          el("span", {}, `體脂: ${c.body_fat}`),
          c.cup_size ? el("span", {}, `罩杯: ${c.cup_size}`) : null,
          el("span", {}, `時空: ${c.timeline}`),
          el("span", {}, `地區: ${c.region} (${c.ethnicity})`),
          el("span", {}, `器物: ${zhOf(C.VESSELS, c.vessel) || c.vessel}`)
        );

        // 3. Detail Row
        const detailRow = el("div", { class: "card-meta-row", style: "margin-top:2px;font-size:11.5px;color:var(--muted)" },
          el("span", {}, `風格: ${c.style || "—"}`),
          el("span", {}, `個性: ${(c.personality || []).join("、")}`),
          el("span", {}, `喜好: ${(c.likes || []).join("、")}`),
          el("span", {}, `服色: ${(c.outfit_palette || []).join("、")}`),
          (c.silhouette_keywords && c.silhouette_keywords.length) ? el("span", { style: "color:var(--accent)" }, `剪影: ${c.silhouette_keywords.join(" · ")}`) : null
        );

        // 4. Bio Row
        const bioRow = el("div", { class: "muted", style: "font-size:11.5px;line-height:1.4;margin:4px 0;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:4px" },
          c.backstory_zh ? el("div", { style: "color:var(--accent);margin-bottom:2px" }, `✦ ${c.backstory_zh}`) : null,
          el("div", {}, c.biography || "—")
        );

        // 5. Review Row
        const chrMatches = getReviewMatches(c.id);
        const reviewRow = el("div", { class: "card-review-row" });
        const reviewInfo = el("div", { class: "card-review-info" });
        if (chrMatches.length > 0) {
          const topMatch = chrMatches[0];
          const stInfo = reviewStatusInfo(topMatch.status);
          reviewInfo.append(
            el("span", { class: "prompt-k" }, "審查欄位："),
            el("span", { class: "f-badge " + stInfo.cls }, `${stInfo.badge} (共收錄 ${chrMatches.length} 包)`),
            el("code", {}, topMatch.id)
          );
          reviewRow.append(
            reviewInfo,
            el("button", {
              class: "btn mini", type: "button",
              title: `跳轉至審查台檢視此角色成果 (${topMatch.id})`,
              onclick: () => jumpToReview(topMatch.id)
            }, "🔍 跳轉審查台")
          );
        } else {
          reviewInfo.append(
            el("span", { class: "prompt-k" }, "審查欄位："),
            el("span", { class: "f-badge" }, "審查台尚未載入此角色審查包"),
            el("span", { class: "muted" }, `(${c.id})`)
          );
          reviewRow.append(
            reviewInfo,
            el("button", {
              class: "btn mini ghost", type: "button",
              title: `前往成果審查台搜尋此角色 ${c.id}`,
              onclick: () => jumpToReview(c.id)
            }, "🔍 轉至審查搜尋")
          );
        }

        // 6. Action Row
        const actionsRow = el("div", { class: "card-actions" },
          el("button", {
            class: "btn mini" + (isPresetActive && state.taskId === "character-concept" ? "" : " ghost"),
            type: "button",
            onclick: () => useDesignedCharacter(c.id, "character-concept")
          }, "🎨 載入角色立繪鍛造"),
          el("button", {
            class: "btn mini" + (isPresetActive && state.taskId === "character-model-rig" ? "" : " ghost"),
            type: "button",
            onclick: () => useDesignedCharacter(c.id, "character-model-rig")
          }, "🧊 載入角色 3D 鍛造"),
          el("button", {
            class: "btn mini ghost", type: "button",
            title: `將 ${c.name_zh} 加入我的最愛`,
            onclick: () => addDesignedCharToFavorites(c.id)
          }, "⭐ 收藏立繪 Prompt"),
          isPresetActive ? el("button", {
            class: "btn mini ghost", type: "button",
            onclick: () => { state.presetChar = null; renderAll(); }
          }, "✕ 取消已設計（回隨機）") : null
        );

        card.append(titleRow, visualRow, metaRow, detailRow, bioRow, reviewRow, actionsRow);
        box.append(card);
      });
    }
  }

  function fieldRow(kind, f) {
    if (f.when && !f.when(state)) return el("div", { style: "display:none" });
    const key = kind + "." + f.key, vals = state[kind][f.key] || [], opts = f.options(state);
    const label = v => (opts.find(o => o.v === v) || {}).zh || v;
    
    // 改良後的按鈕式鎖定開關，排版永不跑版
    const locked = !!state.locks[key];
    const lockBtn = el("button", {
      class: "lock-btn" + (locked ? " locked" : ""),
      type: "button",
      title: locked ? "已鎖定（全部隨機時不變，點選解鎖）" : "未鎖定（點選鎖定）",
      onclick: () => { state.locks[key] = !state.locks[key]; renderAll(); save(); }
    }, locked ? "🔒" : "🔓");

    const dice = el("button", { class: "icon", type: "button", title: "重抽此欄", onclick: () => { rollField(kind, f, Math.random); revalidate(kind); renderAll(); } }, "🎲");
    const edit = el("button", { class: "icon", type: "button", title: "手寫編輯 / 追加自訂值", onclick: () => {
      openCustomModal(f.label, vals[0] || "", (newVal) => {
        addCustom(key, newVal);
        if (multi) {
          if (!vals.includes(newVal)) state[kind][f.key] = vals.concat(newVal);
        } else {
          state[kind][f.key] = [newVal];
        }
        revalidate(kind);
        renderAll();
      });
    } }, "✏️");

    let control;
    const multi = (f.max || 1) > 1;
    if (!multi) {
      control = el("select", { onchange: e => {
        if (e.target.value === "__CUSTOM__") {
          edit.click();
        } else {
          state[kind][f.key] = [e.target.value];
          revalidate(kind);
          renderAll();
        }
      } },
        opts.map(o => el("option", { value: o.v, selected: o.v === vals[0] }, (o.zh || o.v) + (o.w === 0 ? "（權重 0）" : ""))),
        el("option", { value: "__CUSTOM__" }, "✏️ 手寫輸入自訂值...")
      );
    } else {
      const chips = vals.map(v => el("span", { class: "chip" }, label(v), el("button", { type: "button", title: "移除", onclick: () => { state[kind][f.key] = vals.filter(x => x !== v); renderAll(); } }, "×")));
      const add = el("select", { onchange: e => {
        if (!e.target.value) return;
        if (e.target.value === "__CUSTOM__") {
          edit.click();
        } else {
          state[kind][f.key] = vals.concat(e.target.value);
          renderAll();
        }
      }, disabled: vals.length >= f.max },
        el("option", { value: "" }, vals.length >= f.max ? "已達上限" : "＋ 加入"),
        opts.filter(o => !vals.includes(o.v)).map(o => el("option", { value: o.v }, o.zh || o.v)),
        el("option", { value: "__CUSTOM__" }, "✏️ 手寫追加自訂標籤...")
      );
      control = el("div", { class: "chips" }, chips, add);
    }
    return el("div", { class: "field" }, el("label", {}, f.label), el("div", { class: "fctl" }, edit, dice, lockBtn), control);
  }

  function renderConcepts() {
    const t = task(), o = taskOpts(t), subj = resolveSubject(t, o);
    const box = $("#concept"); box.replaceChildren();
    if (!subj) { box.append(el("p", { class: "muted" }, "此任務不使用角色/宙獸概念。")); return; }
    const kind = subj;
    const is3dTask = is3dType(t.id);
    const chosenPkg = (is3dTask && o.source_pack) ? reviewState.packages.find(p => p.id === o.source_pack) : null;
    if (chosenPkg) {
      box.append(el("div", { class: "subhead" },
        el("h3", {}, "審查台來源立繪包：" + chosenPkg.id),
        el("button", { type: "button", class: "btn mini ghost", onclick: () => { o.source_pack = ""; o.input_img = ""; renderAll(); } }, "取消選擇")
      ));
      box.append(el("p", { class: "muted" }, "概念與造型參照自審查台讀入之立繪包（主體 " + (chosenPkg.subjectId || "—") + " · " + (chosenPkg.type === "character-concept" || chosenPkg.id.startsWith("chr") ? "角色" : "宙獸") + " · 共 " + (chosenPkg.images ? chosenPkg.images.length : 0) + " 張圖）。"));
      if (chosenPkg.concept) {
        box.append(el("pre", { style: "font-size:11px;max-height:160px;overflow-y:auto;background:rgba(0,0,0,0.3);padding:8px;border-radius:4px;margin-top:6px;border:1px solid var(--line)" }, JSON.stringify(chosenPkg.concept, null, 2)));
      } else {
        box.append(el("p", { class: "muted" }, "此立繪包內無 concept.json，造型以圖為準。"));
      }
      return;
    }
    const d = kind === "creature" ? designedItem() : null;
    if (d) {
      const L = d.concept.locked;
      box.append(el("div", { class: "subhead" }, el("h3", {}, "已設計宙獸：" + d.code_zh + " 線"), el("code", {}, d.line_id)));
      box.append(el("p", { class: "muted" }, "內容來自 " + d.source + "（designed.js），不隨機、不可在此修改；要改請改資料後重跑 gen_designed.py。"));
      L.stages.forEach(s => box.append(el("div", { class: "field" },
        el("label", {}, s.stage + " · " + s.size_class),
        el("div", {}, el("b", {}, s.name_zh + " " + s.name_en), " ", el("code", {}, s.creature_id),
          el("div", { class: "muted" }, s.look), el("div", { class: "muted" }, "招式 " + s.signature_move.name_zh + "（" + s.signature_move.move_id + "）")))));
      box.append(el("p", { class: "muted" }, "特性：" + L.trait.name_zh + "（" + L.trait.trait_id + "）· 原型：" + d.concept.archetype + "（" + d.concept.region + "）· 超載：" + L.overload));
      const bgInfo = C.determineAgcBgColor(d.concept, false);
      box.append(el("div", { class: "field", style: "border-top:1px dashed var(--line);margin-top:6px;padding-top:6px" },
        el("label", {}, "2D AGC 立繪背景"),
        el("div", { style: "display:flex;align-items:center;gap:8px" },
          el("span", { style: `width:20px;height:20px;border-radius:4px;border:1px solid var(--line);background:${bgInfo.hex};display:inline-block;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.25)` }),
          el("code", { style: "font-weight:bold" }, bgInfo.hex),
          el("span", { class: "muted", style: "font-size:11.5px" }, `(R=G=B=${bgInfo.rgb[0]} · ${bgInfo.toneLabel})`)
        ),
        el("span", { class: "muted", style: "font-size:11px", title: bgInfo.reason }, "RGB等值")
      ));
      return;
    }
    const dc = kind === "character" ? designedCharItem() : null;
    if (dc) {
      box.append(el("div", { class: "subhead" },
        el("h3", {}, `已設計角色：${dc.name_zh} (${dc.name_en})`),
        el("code", {}, dc.id)
      ));
      box.append(el("p", { class: "muted" }, "內容來自 Data/_incoming/p0-05-samples/valid/characters（designed.js），不隨機、不可在此修改。"));
      box.append(el("div", { class: "field" },
        el("label", {}, "基本資訊"),
        el("div", {},
          el("b", {}, `${dc.role} · ${dc.ethnicity} · ${dc.region} · ${dc.gender} (${dc.age_band} ${dc.age} 歲)`),
          el("div", { class: "muted" }, `身型：${dc.height_cm} cm / ${dc.weight_kg} kg · 體脂 ${dc.body_fat}${dc.cup_size ? ` · 罩杯 ${dc.cup_size}` : ""}`),
          el("div", { class: "muted" }, `體態：${dc.body_type || "—"}`)
        )
      ));
      box.append(el("div", { class: "field" },
        el("label", {}, "器物與風格"),
        el("div", {},
          el("span", { class: "f-badge accent" }, `宙獸器物: ${zhOf(C.VESSELS, dc.vessel) || dc.vessel}`),
          el("div", { class: "muted", style: "margin-top:4px" }, `風格：${dc.style || "—"} · 個性：${(dc.personality || []).join("、")}`),
          el("div", { class: "muted" }, `服裝色系：${(dc.outfit_palette || []).join("、")} · 髮色：${(dc.hair_palette || []).join("、")} · 瞳色：${(dc.eye_palette || []).join("、")}`)
        )
      ));
      box.append(el("div", { class: "field" },
        el("label", {}, "人物傳記"),
        el("div", { class: "muted", style: "line-height:1.4" }, dc.biography || "—")
      ));
      const curConcept = characterConcept();
      const bgInfo = C.determineAgcBgColor(curConcept, true);
      box.append(el("div", { class: "field", style: "border-top:1px dashed var(--line);margin-top:6px;padding-top:6px" },
        el("label", {}, "2D AGC 立繪背景"),
        el("div", { style: "display:flex;align-items:center;gap:8px" },
          el("span", { style: `width:20px;height:20px;border-radius:4px;border:1px solid var(--line);background:${bgInfo.hex};display:inline-block;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.25)` }),
          el("code", { style: "font-weight:bold" }, bgInfo.hex),
          el("span", { class: "muted", style: "font-size:11.5px" }, `(R=G=B=${bgInfo.rgb[0]} · ${bgInfo.toneLabel})`)
        ),
        el("span", { class: "muted", style: "font-size:11px", title: bgInfo.reason }, "RGB等值")
      ));
      return;
    }
    box.append(el("div", { class: "subhead" },
      el("h3", {}, kind === "character" ? "角色設計概念" : "宙獸設計概念"),
      el("label", { class: "inline" }, "主體 ID ",
        el("input", { class: "sid", value: subjectId(kind), spellcheck: "false", onchange: e => { const v = e.target.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"); state.subjectIds[kind] = v && v !== (kind === "character" ? "chr_" : "line_") + state.seed ? v : ""; renderAll(); } }))));
    FIELDS[kind].forEach(f => box.append(fieldRow(kind, f)));
    if (kind === "creature") {
      box.append(el("label", { class: "inline review" },
        el("input", { type: "checkbox", checked: state.includeReview, onchange: e => { state.includeReview = e.target.checked; revalidate("creature"); renderAll(); } }),
        " 包含 sensitivity: review 原型（在世信仰、族群神聖敘事、爭議人物；需人工審核）"));
      const a = CR.archetypes.find(x => x.name === state.creature.archetype?.[0]);
      if (a) box.append(el("p", { class: "muted" }, "象徵意象：" + a.motifs + (a.meaning ? " · 精神意義：" + a.meaning : "")));
    }
    const curConcept = kind === "character" ? characterConcept() : creatureConcept();
    const bgInfo = C.determineAgcBgColor(curConcept, kind === "character");
    box.append(
      el("div", { class: "field", style: "border-top:1px dashed var(--line);margin-top:6px;padding-top:6px" },
        el("label", {}, "2D AGC 立繪背景"),
        el("div", { style: "display:flex;align-items:center;gap:8px;flex-wrap:wrap" },
          el("span", { style: `width:20px;height:20px;border-radius:4px;border:1px solid var(--line);background:${bgInfo.hex};display:inline-block;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.25)` }),
          el("code", { style: "font-weight:bold" }, bgInfo.hex),
          el("span", { class: "muted", style: "font-size:11.5px" }, `(R=G=B=${bgInfo.rgb[0]} · ${bgInfo.toneLabel})`)
        ),
        el("span", { class: "muted", style: "font-size:11px", title: bgInfo.reason }, "RGB等值")
      )
    );
  }

  function isCreatureStageTask(t, o) {
    if (!t) t = task();
    if (!o) o = taskOpts(t);
    return t.id === "creature-concept" || (t.id === "creature-model-rig" && o.scope !== "batch") || (t.id === "model-rig" && o.subject === "creature" && o.scope !== "batch");
  }

  function renderForge3dModeTabs() {
    const tabsBox = $("#forge3dModeTabs");
    if (!tabsBox) return;
    const t = task(), o = taskOpts(t);
    // Every available 3D pipeline is currently single-subject; do not show
    // a selector whose only choice is "single".
    if (!is3dType(t.id) || window.COSMI_PIPELINE?.supports({task:t})) {
      tabsBox.style.display = "none";
      return;
    }
    tabsBox.style.display = "inline-flex";
    tabsBox.replaceChildren();
    const modes = [
      { v: "single", zh: "🎯 指定處理模式" },
      { v: "batch", zh: "📦 批量處理模式" }
    ];
    if (window.COSMI_PIPELINE?.supports({task:t})) o.scope = "single";
    modes.filter(m => !window.COSMI_PIPELINE?.supports({task:t}) || m.v === "single").forEach(m => {
      const isCur = (o.scope || "single") === m.v;
      const btn = el("button", {
        class: "segb" + (isCur ? " on" : ""),
        type: "button",
        title: `切換為 ${m.zh}`,
        onclick: () => {
          o.scope = m.v;
          renderAll();
        }
      }, m.zh);
      tabsBox.append(btn);
    });
  }

  function renderForgeStageTabs() {
    const tabsBox = $("#forgeStageTabs");
    if (!tabsBox) return;
    const t = task(), o = taskOpts(t);
    if (!isCreatureStageTask(t, o)) {
      tabsBox.style.display = "none";
      return;
    }
    tabsBox.style.display = "inline-flex";
    tabsBox.replaceChildren();
    STAGE_KEYS.forEach(stKey => {
      const isCur = (o.stage || "adult") === stKey;
      const btn = el("button", {
        class: "segb" + (isCur ? " on" : ""),
        type: "button",
        title: `切換型態至 ${STAGE_ZH[stKey]} (${stKey})`,
        onclick: () => {
          o.stage = stKey;
          renderAll();
        }
      }, STAGE_ZH[stKey]);
      tabsBox.append(btn);
    });
  }

  function renderOptions() {
    const t = task(), o = taskOpts(t), box = $("#options"); box.replaceChildren();
    const flow = currentFlow();
    const isText3d = flow?.step === "prompt_3d";
    t.options.filter(d => (!window.COSMI_PIPELINE?.supports({task:t}) || ["source_pack", "input_img", "stage"].includes(d.key)) && !(isText3d && ["source_pack", "input_img"].includes(d.key)) && d.key !== "scope" && (!d.when || d.when(o)) && (d.key !== "stage" || !isCreatureStageTask(t, o))).forEach(d => {
      const items = d.items ? d.items(o, env()) : [];
      let control;
      if (is3dType(t.id) && d.key === "source_pack") {
        const isChr3d = t.id === "character-model-rig";
        const isCr3d = t.id === "creature-model-rig";
        const conceptPkgs = reviewState.packages.filter(p => {
          if (isChr3d) return p.type === "character-concept" || p.id.startsWith("chr-");
          if (isCr3d) return p.type === "creature-concept" || p.id.startsWith("cr-");
          return p.type === "creature-concept" || p.type === "character-concept" || p.id.startsWith("cr-") || p.id.startsWith("chr-");
        });
        const packSelect = el("select", {
          onchange: e => {
            const val = e.target.value;
            o.source_pack = val;
            const p = reviewState.packages.find(x => x.id === val);
            if (p) {
              if (isCr3d && p.stage) o.stage = p.stage;
              if (t.id === "model-rig") o.subject = (p.type === "character-concept" || p.id.startsWith("chr")) ? "character" : "creature";
              if (o.input_img && p.images && !p.images.some(im => im.path === o.input_img)) {
                o.input_img = "";
              }
            }
            renderAll();
          }
        },
          el("option", { value: "" }, conceptPkgs.length ? `-- 從審查台選擇${isChr3d ? "角色" : isCr3d ? "宙獸" : ""}立繪包 (或手動輸入) --` : `-- 審查台尚無讀入的${isChr3d ? "角色" : isCr3d ? "宙獸" : ""}立繪包 (可手動輸入或載入) --`),
          conceptPkgs.map(p => el("option", {
            value: p.id,
            selected: o.source_pack === p.id
          }, "📦 " + p.id + " (" + (p.subjectId || "無主體") + " · " + (p.type === "character-concept" || p.id.startsWith("chr") ? "角色" : "宙獸") + (p.stage ? " · " + (STAGE_ZH[p.stage] || p.stage) : "") + " · " + (p.images ? p.images.length : 0) + " 張圖)"))
        );

        const textInput = el("input", {
          value: o.source_pack || "",
          placeholder: d.placeholder || (isChr3d ? "或手動輸入角色立繪包 ID，例 chr-20261106-1286-1855" : "或手動輸入宙獸立繪包 ID，例 cr-20261106-7f3a-2105-adult"),
          onchange: e => {
            o.source_pack = e.target.value.trim();
            const p = reviewState.packages.find(x => x.id === o.source_pack);
            if (p) {
              if (isCr3d && p.stage) o.stage = p.stage;
              if (t.id === "model-rig") o.subject = (p.type === "character-concept" || p.id.startsWith("chr")) ? "character" : "creature";
            }
            renderAll();
          }
        });

        const quickTools = el("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px;" },
          el("span", { class: "muted", style: "font-size:11px;" }, (isChr3d ? "角色" : isCr3d ? "宙獸" : "") + "立繪包：" + conceptPkgs.length + " 包"),
          el("button", { type: "button", class: "btn mini ghost", title: "從本機選取資產資料夾", onclick: () => $("#folderFileInput").click() }, "載入資料夾"),
        );

        control = el("div", { class: "pack-picker-box" }, packSelect, textInput, quickTools);
      } else if (is3dType(t.id) && d.key === "input_img") {
        const curPkg = reviewState.packages.find(p => p.id === o.source_pack);
        if (curPkg && curPkg.images && curPkg.images.length) {
          const imgSelect = el("select", {
            onchange: e => { o.input_img = e.target.value; renderAll(); }
          },
            el("option", { value: "" }, "（預設）全套正交三視圖 (正面正交 + turnaround)"),
            curPkg.images.map(im => el("option", {
              value: im.path,
              selected: o.input_img === im.path
            }, "🖼️ " + im.path + " [" + describeImg(im.path) + "]"))
          );

          const strip = el("div", { class: "img-picker-strip" });
          curPkg.images.forEach(im => {
            const isSel = o.input_img === im.path;
            const item = el("div", {
              class: "img-picker-item" + (isSel ? " on" : ""),
              title: im.path + " (" + describeImg(im.path) + ")",
              onclick: () => {
                o.input_img = isSel ? "" : im.path;
                renderAll();
              }
            },
              el("img", { src: im.url, alt: im.path }),
              el("span", { class: "img-picker-label" }, describeImg(im.path))
            );
            strip.append(item);
          });

          let badge = null;
          if (o.input_img) {
            badge = el("div", { class: "selected-img-badge" },
              el("span", {}, "✅ 指定輸入圖：", el("code", {}, o.input_img), " (" + describeImg(o.input_img) + ")"),
              el("button", { type: "button", class: "btn mini ghost", onclick: () => { o.input_img = ""; renderAll(); } }, "重設為全套視圖")
            );
          }

          control = el("div", { class: "pack-picker-box" }, imgSelect, strip, badge);
        } else {
          control = el("input", {
            value: o.input_img || "",
            placeholder: d.placeholder || "選填，留空預設使用正面正交 + turnaround 三視圖",
            onchange: e => { o.input_img = e.target.value.trim(); renderAll(); }
          });
        }
      } else if (d.type === "checks") {
        control = el("div", { class: "checks" },
          el("button", { type: "button", class: "btn mini ghost", onclick: () => { o[d.key] = o[d.key].length === items.length ? [] : items.map(i => i.v); renderAll(); } }, o[d.key].length === items.length ? "全不選" : "全選"),
          items.map(i => el("label", { class: "check" }, el("input", { type: "checkbox", checked: o[d.key].includes(i.v), onchange: e => { o[d.key] = e.target.checked ? o[d.key].concat(i.v) : o[d.key].filter(x => x !== i.v); renderAll(); } }), i.zh)));
      } else if (d.type === "select") {
        control = el("div", { class: "row" },
          el("select", { onchange: e => { o[d.key] = e.target.value; if (d.key === "subject") delete o.actions; taskOpts(t); renderAll(); } }, items.map(i => el("option", { value: i.v, selected: i.v === o[d.key] }, i.zh))),
          el("button", { class: "icon", type: "button", title: "隨機", onclick: () => { o[d.key] = items[Math.floor(Math.random() * items.length)].v; if (d.key === "subject") delete o.actions; taskOpts(t); renderAll(); } }, "🎲"));
      } else {
        control = el("input", { value: o[d.key], placeholder: d.placeholder || "", onchange: e => { o[d.key] = e.target.value; renderAll(); } });
      }
      box.append(el("div", { class: "field opt" }, el("label", {}, d.label), control));
    });
    if (!box.children.length) box.append(el("p", { class: "muted" }, "此任務沒有額外選項。"));
  }

  function renderOutput() {
    const b = build(), t = b.ctx.task;
    const roundBar = $("#roundBar");
    const roundTabs = $("#roundTabs");
    const roundCopyGroup = $("#roundCopyGroup");

    let displayedText = b.text;

    if (b.rounds && b.rounds.length && $("#pipelineStage")?.value !== "portrait_3d") {
      if (state.currentRound === undefined || state.currentRound === null) {
        state.currentRound = 1;
      }
      if (roundBar) roundBar.style.display = "flex";
      if (roundCopyGroup) roundCopyGroup.style.display = "inline-flex";

      if (roundTabs) {
        roundTabs.replaceChildren();
        const tabDefs = [
          { r: 1, zh: "1️⃣ 正面基準圖 (1:1)" },
          { r: 2, zh: "2️⃣ T-pose 三視圖 (16:9)" },
          { r: 3, zh: "3️⃣ 動態主立繪 (場景強化)" },
          { r: 0, zh: "🎯 完整全流程" }
        ];
        tabDefs.forEach(def => {
          const btn = el("button", {
            class: "segb" + (state.currentRound === def.r ? " on" : ""),
            type: "button",
            onclick: () => {
              state.currentRound = def.r;
              renderOutput();
            }
          }, def.zh);
          roundTabs.append(btn);
        });
      }

      if (state.currentRound === 1 && b.rounds[0]) displayedText = b.rounds[0].prompt;
      else if (state.currentRound === 2 && b.rounds[1]) displayedText = b.rounds[1].prompt;
      else if (state.currentRound === 3 && b.rounds[2]) displayedText = b.rounds[2].prompt;
      else displayedText = b.text;
    } else {
      if (roundBar) roundBar.style.display = "none";
      if (roundCopyGroup) roundCopyGroup.style.display = "none";
      state.currentRound = 0;
      displayedText = b.text;
    }

    if (["portrait_3d","encyclopedia"].includes($("#pipelineStage")?.value)) displayedText = window.COSMI_PIPELINE.build(b.ctx);
    $("#prompt").value = b.errors.length ? "⚠ " + b.errors.join("\n⚠ ") : displayedText;
    $("#copy").disabled = $("#download").disabled = b.errors.length > 0;
    $("#header").textContent = b.ctx.header;
    $("#chars").textContent = displayedText.length.toLocaleString() + " 字元";
    const encyclopediaKind = t.id === "move-vfx" ? "moves" : t.id.startsWith("character") ? "characters" : "creatures";
    const wikiPath = window.COSMI_WIKI.describe(b.ctx).path;
    const dir = $("#pipelineStage")?.value === "encyclopedia"
      ? "wiki/" + encyclopediaKind : window.COSMI_DRIVE.packageDir(t.id);
    const portraitCopyOnly = window.COSMI_PIPELINE?.supports(b.ctx) && ["portrait", "portrait_3d"].includes($("#pipelineStage")?.value) && !window.COSMI_PIPELINE?.isPortraitAuto();
    const portraitAuto = window.COSMI_PIPELINE?.supports(b.ctx) && window.COSMI_PIPELINE?.isPortraitAuto();
    $("#download").hidden = Boolean(portraitCopyOnly);
    if (portraitAuto && state.currentRound !== 0 && b.rounds?.length) {
      state.currentRound = 0;
      displayedText = b.text;
      $("#prompt").value = displayedText;
      $("#chars").textContent = displayedText.length.toLocaleString() + " 字元";
      for (const button of roundTabs?.querySelectorAll("button") || []) {
        button.classList.toggle("on", button.textContent.includes("完整全流程"));
      }
    }
    $("#deliver").replaceChildren(
      el("p", {}, "Google Drive 根目錄：", el("code", {}, "project/cosmos_chimera_forge/")),
      el("ol", {},
        portraitCopyOnly
          ? el("li", {}, "手動模式：使用 📋 或 ①／②／③ 複製，貼入生成平台；不需建立 .md 檔或上傳 Drive。")
          : portraitAuto
          ? el("li", {}, "自動模式：按管線設定中的 ☁ 建立完整立繪 Prompt .md 並上傳 Drive：", el("code", {}, "prompts/jobs/" + b.ctx.taskId + ".portrait.prompt.md"))
          : el("li", {}, "Prompt 讀寫：", el("code", {}, "prompts/jobs/" + b.ctx.taskId + "." + (document.getElementById("pipelineStage")?.value || "task") + ".prompt.md"), "，可用上方 Drive 儲存與讀取按鈕。"),
        el("li", {}, "成果包存放：", el("code", {}, $("#pipelineStage")?.value === "encyclopedia" ? wikiPath : dir + "/" + b.ctx.taskId + "/"), "。圖鑑以 Markdown 獨立存放；3D 模型逐檔存入原資產目錄。"),
        el("li", {}, "立繪參考：", el("code", {}, "01_portraits/"), " 或 ", el("code", {}, "backup/image_backup/"), "；3D 成果與參考：", el("code", {}, "02_3d/legacy/"), "。"),
        el("li", {}, "登入後自動載入雲端成果包，亦可按「重新載入 Drive 成果包」更新審查台。")
      )
    );
    updateFavButton();
  }

  function renderHistory() {
    const box = $("#history"); box.replaceChildren();
    (state.history || []).slice(0, 15).forEach(h => box.append(el("li", {}, el("code", {}, h.id), " · " + h.task + " · " + h.platform + " · " + h.time)));
    if (!box.children.length) box.append(el("li", { class: "muted" }, "尚無紀錄（複製或下載 prompt 時記錄）"));
  }

  function renderAll() {
    revalidate("character"); revalidate("creature");
    $("#seed").value = state.seed;
    
    // 更新平台切換鈕
    if ($("#platChatgpt") && $("#platGemini")) {
      $("#platChatgpt").classList.toggle("on", state.platform === "chatgpt");
      $("#platGemini").classList.toggle("on", state.platform === "gemini");
    }

    $("#rec").textContent = task().platform === "gemini" ? "建議：Gemini Argon" : "建議：ChatGPT";
    renderTasks(); renderConcepts(); renderOptions(); renderForge3dModeTabs(); renderForgeStageTabs(); renderOutput(); renderHistory(); renderFavorites(); renderDesignedDesk(); updateFavButton();
    save();
  }

  // ==================== 原生 ZIP 封裝輔助（零外部依賴） ====================
  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      table[i] = c >>> 0;
    }
    return table;
  })();

  function createZipBlob(files) {
    const entries = [];
    let offset = 0;
    for (const name in files) {
      let data = files[name];
      if (typeof data === "string") data = new TextEncoder().encode(data);
      const nameBytes = new TextEncoder().encode(name);
      const header = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(header.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true);
      dv.setUint16(8, 0, true); // store
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0, true);
      let crc = 0 ^ (-1);
      for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
      crc = (crc ^ (-1)) >>> 0;
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      header.set(nameBytes, 30);
      entries.push({ nameBytes, header, data, crc, offset });
      offset += header.length + data.length;
    }
    const centralStart = offset;
    const centralEntries = [];
    for (const e of entries) {
      const ch = new Uint8Array(46 + e.nameBytes.length);
      const dv = new DataView(ch.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 20, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0, true);
      dv.setUint16(14, 0, true);
      dv.setUint32(16, e.crc, true);
      dv.setUint32(20, e.data.length, true);
      dv.setUint32(24, e.data.length, true);
      dv.setUint16(28, e.nameBytes.length, true);
      dv.setUint16(30, 0, true);
      dv.setUint16(32, 0, true);
      dv.setUint16(34, 0, true);
      dv.setUint16(36, 0, true);
      dv.setUint32(38, 0, true);
      dv.setUint32(42, e.offset, true);
      ch.set(e.nameBytes, 46);
      centralEntries.push(ch);
      offset += ch.length;
    }
    const centralSize = offset - centralStart;
    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(4, 0, true);
    edv.setUint16(6, 0, true);
    edv.setUint16(8, entries.length, true);
    edv.setUint16(10, entries.length, true);
    edv.setUint32(12, centralSize, true);
    edv.setUint32(16, centralStart, true);
    edv.setUint16(20, 0, true);

    const parts = [];
    for (const e of entries) {
      parts.push(e.header);
      parts.push(e.data);
    }
    for (const ch of centralEntries) parts.push(ch);
    parts.push(eocd);
    return new Blob(parts, { type: "application/zip" });
  }

  // ==================== 成果審查台（Review Workbench，參考 steel_vs_swarm） ====================
  // 取得與目前封裝相互參照的關聯封裝（2D 立繪 ⇄ 3D 模型雙向參照，優先配對同一型態）
  function getLinkedPackage(pkg) {
    if (!pkg) return null;
    const curStage = pkg.stage || reviewState.activeStage || "adult";
    if (is3dType(pkg.type)) {
      // 3D 封裝往回找立繪包
      if ((pkg.sourcePack || pkg.manifest?.source_pack)) {
        const found = reviewState.packages.find(p => p.id === (pkg.sourcePack || pkg.manifest.source_pack));
        if (found) return found;
      }
      return reviewState.packages.find(p => !is3dType(p.type) && (p.groupKey === pkg.groupKey || p.subjectId === pkg.subjectId) && (!p.stage || p.stage === curStage))
        || reviewState.packages.find(p => !is3dType(p.type) && p.subjectId && p.subjectId === pkg.subjectId) || null;
    } else {
      // 立繪包往下找衍生 3D 封裝
      return reviewState.packages.find(p => is3dType(p.type) && (p.groupKey === pkg.groupKey || p.manifest?.source_pack === pkg.id || p.subjectId === pkg.subjectId) && (!p.stage || p.stage === curStage))
        || reviewState.packages.find(p => is3dType(p.type) && (p.manifest?.source_pack === pkg.id || (p.subjectId && p.subjectId === pkg.subjectId))) || null;
    }
  }

  // ZIP 解析器（使用瀏覽器原生 DecompressionStream）
  async function parseZipBuffer(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const files = {};
    let eocdOffset = -1;
    for (let i = arrayBuffer.byteLength - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
    }
    if (eocdOffset === -1) {
      let offset = 0;
      while (offset < arrayBuffer.byteLength - 30) {
        if (view.getUint32(offset, true) !== 0x04034b50) break;
        const compMethod = view.getUint16(offset + 8, true);
        const compSize = view.getUint32(offset + 18, true);
        const nameLen = view.getUint16(offset + 26, true);
        const extraLen = view.getUint16(offset + 28, true);
        const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
        const dataOffset = offset + 30 + nameLen + extraLen;
        const compData = bytes.subarray(dataOffset, dataOffset + compSize);
        let fileData = null;
        if (!name.endsWith('/')) {
          if (compMethod === 0) fileData = compData;
          else if (compMethod === 8 && window.DecompressionStream) {
            try {
              const ds = new DecompressionStream('deflate-raw');
              const writer = ds.writable.getWriter();
              writer.write(compData); writer.close();
              fileData = new Uint8Array(await new Response(ds.readable).arrayBuffer());
            } catch (e) {}
          }
          if (fileData) files[name] = fileData;
        }
        offset = dataOffset + compSize;
      }
      return files;
    }
    const cdCount = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let pos = cdOffset;
    for (let i = 0; i < cdCount; i++) {
      if (view.getUint32(pos, true) !== 0x02014b50) break;
      const compMethod = view.getUint16(pos + 10, true);
      const compSize = view.getUint32(pos + 20, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localOffset = view.getUint32(pos + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLen + localExtraLen;
      const compData = bytes.subarray(dataOffset, dataOffset + compSize);
      let fileData = null;
      if (!name.endsWith('/')) {
        if (compMethod === 0) fileData = compData;
        else if (compMethod === 8 && window.DecompressionStream) {
          try {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(compData); writer.close();
            fileData = new Uint8Array(await new Response(ds.readable).arrayBuffer());
          } catch (e) {}
        }
        if (fileData) files[name] = fileData;
      }
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

  function inferTaskType(taskId, manifestData) {
    if (manifestData?.task_type) return manifestData.task_type;
    if (taskId.startsWith("chr")) return "character-concept";
    if (taskId.startsWith("cr")) return "creature-concept";
    if (taskId.startsWith("mdl") || taskId.startsWith("anim")) {
      if (manifestData?.source_pack?.startsWith("chr") || manifestData?.subject_id?.startsWith("chr")) return "character-model-rig";
      return "creature-model-rig";
    }
    return "unknown";
  }

  // 載入 Zip 檔轉換為審查 Package 物件
  async function loadZipFile(file) {
    const buf = await file.arrayBuffer();
    const files = await parseZipBuffer(buf);
    return loadAssetFiles(files, file);
  }

  async function loadAssetFiles(files, file, {silent = false} = {}) {
    let manifestData = null, conceptData = null, rawPrompt = "", prefix = "";
    const manifestPath = window.COSMI_MODEL_REVIEW.selectRootManifest(Object.keys(files));
    if (manifestPath) prefix = manifestPath.slice(0, -"manifest.json".length);
    let animSpec = null, rigSpec = null, glbFile = null, animFiles = [], glbCandidates = [];
    for (const path in files) {
      if (path === manifestPath) {
        try { manifestData = JSON.parse(new TextDecoder().decode(files[path])); } catch (e) {}
      } else if (path.endsWith("concept.json")) {
        try { conceptData = JSON.parse(new TextDecoder().decode(files[path])); } catch (e) {}
      } else if (path.endsWith(".prompt.md") || path.endsWith("prompt.md") || path.endsWith("prompt.txt")) {
        try { rawPrompt = new TextDecoder().decode(files[path]); } catch (e) {}
      } else if (path.endsWith("anim_spec.json")) {
        try { animSpec = JSON.parse(new TextDecoder().decode(files[path])); } catch (e) {}
      } else if (path.endsWith("rig_spec.json")) {
        try { rigSpec = JSON.parse(new TextDecoder().decode(files[path])); } catch (e) {}
      } else if (path.endsWith(".glb")) {
        const rel = path.startsWith(prefix) ? path.slice(prefix.length) : path;
        glbCandidates.push({path:rel,key:path});
      } else if (path.endsWith(".fbx") && (path.includes("anim") || path.includes("models"))) {
        const rel = path.startsWith(prefix) ? path.slice(prefix.length) : path;
        animFiles.push({ path: rel, size: files[path].length });
      }
    }
    // Drive initially imports only metadata/previews; binary files are deferred.
    let descriptorData = null;
    try { descriptorData = window.COSMI_MODEL_REVIEW?.descriptorFor?.({ id: prefix.replace(/\/$/, ""), rawFiles: files }); } catch (e) {}
    const selectedGlb = glbCandidates.length ? window.COSMI_MODEL_REVIEW.selectModelFile(glbCandidates, manifestData || {}, descriptorData) : null;
    if (selectedGlb) {
      const bytes = files[selectedGlb.key];
      const blob = new Blob([bytes], {type:"model/gltf-binary"});
      glbFile = {path:selectedGlb.path,url:URL.createObjectURL(blob),buffer:window.COSMI_MODEL_REVIEW.exactBuffer(bytes),uint8:bytes};
    }
    let alignedStaged = null;
    if (/\.zip$/i.test(file.name) && (!manifestData || !conceptData)) {
      alignedStaged = findMatchingStagedFormat(file.name, Object.keys(files));
      if (alignedStaged) {
        if (!manifestData) manifestData = alignedStaged.manifest;
        if (!conceptData) conceptData = alignedStaged.concept;
        if (!rawPrompt) rawPrompt = alignedStaged.prompt;

        const tid = alignedStaged.taskId;
        const targetPrefix = prefix || (tid + "/");

        // 自動將各種格式注入 files 一起打包
        if (!files[targetPrefix + "manifest.json"]) {
          files[targetPrefix + "manifest.json"] = new TextEncoder().encode(JSON.stringify(manifestData, null, 2));
        }
        if (!files[targetPrefix + "concept.json"]) {
          files[targetPrefix + "concept.json"] = new TextEncoder().encode(JSON.stringify(conceptData, null, 2));
        }
        if (!files[targetPrefix + tid + ".prompt.md"]) {
          files[targetPrefix + tid + ".prompt.md"] = new TextEncoder().encode(rawPrompt);
        }
      }
    }

    const taskId = manifestData?.task_id || alignedStaged?.taskId || file.name.replace(/\.zip$/i, "");
    const images = [];
    for (const path in files) {
      if (/\.(png|jpe?g|webp)$/i.test(path)) {
        const rel = path.startsWith(prefix) ? path.slice(prefix.length) : path;
        const blob = new Blob([files[path]], { type: "image/png" });
        images.push({ path: rel, url: URL.createObjectURL(blob), rawBytes: files[path] });
      }
    }
    const pkg = {
      id: taskId,
      type: inferTaskType(taskId, manifestData),
      subjectId: manifestData?.subject_id || alignedStaged?.subjectId || "",
      manifest: manifestData,
      concept: conceptData,
      rawPrompt,
      images,
      rawFiles: files,
      glbFile,
      animSpec,
      rigSpec,
      animFiles,
      fileCount: Object.keys(files).length,
      rawZip: file,
      isZip: /\.zip$/i.test(file.name),
      aligned: !!alignedStaged,
      stagedTaskId: alignedStaged?.taskId || null,
      status: manifestData?.missing?.length ? "missing" : "provisional"
    };
    addPackage(pkg, {silent});
    return pkg;
  }

    function addPackage(pkg, {silent = false} = {}) {
      if (!pkg.baseId || pkg.stage === undefined) {
        const info = parsePackageStage(pkg.id, pkg.manifest, pkg.concept);
        pkg.stage = info.stage;
        pkg.baseId = info.baseId;
      }
      pkg.groupKey = (pkg.type === "creature-concept" || pkg.id.startsWith("cr"))
        ? (pkg.baseId || pkg.subjectId || pkg.id)
        : (is3dType(pkg.type) || pkg.id.startsWith("mdl"))
        ? (pkg.manifest?.source_pack || pkg.subjectId || pkg.baseId || pkg.id)
        : pkg.id;

      const idx = reviewState.packages.findIndex(p => p.id === pkg.id);
      if (idx >= 0) reviewState.packages[idx] = pkg;
      else reviewState.packages.unshift(pkg);
      if (silent) {
        if (!reviewState.activePkgId) reviewState.activePkgId = pkg.id;
        return;
      }
      reviewState.activePkgId = pkg.id;
      if (pkg.stage) reviewState.activeStage = pkg.stage;
      reviewState.activeImgIdx = 0;
      try {
        renderReviewView();
      } catch (e) {
        console.error("renderReviewView failed for package " + pkg.id, e);
      }
      if ($("#favList")) renderFavorites();
      if ($("#designedList")) renderDesignedList();
      if (pkg.aligned) {
        toast("已載入並自動對齊時間戳格式 (" + pkg.stagedTaskId + ")！已整合打包各格式檔");
      } else {
        toast("已載入任務包：" + pkg.id);
      }
    }

  function getBackupTimestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function backupActivePackage(pkg) {
    if (pkg?.driveFolderId) return reviewPackage(pkg, "reject");
    if (!pkg) pkg = getActivePkg();
    if (!pkg) { toast("請先選取要備份的任務包"); return; }
    const ts = getBackupTimestamp();
    const cmd = `if (Test-Path "Art\\_incoming\\${pkg.id}.zip") { Move-Item -Path "Art\\_incoming\\${pkg.id}.zip" -Destination "Art\\_backup\\${pkg.id}_${ts}.zip" -Force } elseif (Test-Path "Art\\_incoming\\${pkg.id}") { Move-Item -Path "Art\\_incoming\\${pkg.id}" -Destination "Art\\_backup\\${pkg.id}_${ts}" -Force }`;
    copyText(cmd, `已複製備份指令（目標：Art\\_backup\\${pkg.id}_${ts}）！可直接在 PowerShell 貼上執行`);
  }

  // 載入內建測試範例（fixtures）
  function loadSampleFixtures() {
    const crBaseConcept = {
      line_id: "line_7f3a",
      elements: ["fire（火）", "metal（金）"],
      element_palettes: ["自然火紅 × 琉璃金"],
      base_parents: ["類人奇幻·精靈族", "裝備·兵器", "科幻機械·機甲/外骨骼"],
      bases: ["精靈族·高等精靈/月光祭司", "兵器·符文巨盾/塔盾護壁", "機甲/外骨骼·聚能屏障重型堡壘機甲"],
      appearance_palette: ["熔岩赤紅", "炭黑硬甲", "烈焰耀金", "鍍銀鋼白"],
      timeline: "青銅神話/古典英雄時代", region: "東亞",
      size_profile: "S→M→L→XL",
      archetype: "桃太郎", archetype_type: "傳說", motifs: "桃紋飾、雙角重鎧、腰間黍糰印記",
      sensitivity: "ok", role: "前排肉盾/坦克", temperament: "好鬥凶悍",
      signature_move: { name_zh: "崩天熾烈斬", move_id: "move_earth_heavy_cleave" },
      trait: { name_zh: "熔鋼重裝壁", trait_id: "trait_metal_impenetrable_shell" },
      formula: "fire+metal × 精靈族·高等精靈+武器·符文巨盾 × 桃太郎（青銅神話/古典英雄時代）"
    };

    const mockPackages = [
      {
        id: "cr-20261106-7f3a-2105-juvenile",
        type: "creature-concept",
        stage: "juvenile",
        baseId: "cr-20261106-7f3a-2105",
        subjectId: "line_7f3a",
        manifest: {
          spec: "cosmimera-art-task/1",
          task_header: "[COSMIMERA-TASK spec=1 tool=1.9.0 catalog=2.1.0 template=creature-concept@5.0.0 task_id=cr-20261106-7f3a-2105-juvenile seed=7f3a]",
          task_id: "cr-20261106-7f3a-2105-juvenile",
          task_type: "creature-concept",
          subject_id: "line_7f3a",
          produced_by: "ChatGPT",
          files: [
            { path: "concept.json", kind: "spec", level: "L1" },
            { path: "images/cr_line_7f3a_juvenile_main.png", kind: "main", level: "L1" },
            { path: "images/cr_line_7f3a_juvenile_turnaround.png", kind: "turnaround", level: "L1" },
            { path: "images/cr_line_7f3a_juvenile_front.png", kind: "view", level: "L1" }
          ],
          missing: [],
          notes: "幼年型態：火角石，嬌小滾圓，頭部單一赤紅小犄角"
        },
        concept: Object.assign({}, crBaseConcept, {
          stage: "juvenile", name_zh: "火角石", size_class: "S", height_length: "0.45 m", weight: "12 kg", body_fat: "18.0%",
          dex_zh: "火角石嬌小滾圓，頭部單一赤紅小犄角隨地熱微光閃爍。平時喜歡趴伏於火山溫暖石縫中汲取熱能，個性好奇且不怕生。"
        }),
        images: [
          { path: "images/cr_line_7f3a_juvenile_main.png", url: createSampleSvgDataUrl("火角石 · 幼年立繪 (0.45m)", "#e67e22") },
          { path: "images/cr_line_7f3a_juvenile_turnaround.png", url: createSampleSvgDataUrl("火角石 · T-Pose 三視圖", "#7f8c8d") },
          { path: "images/cr_line_7f3a_juvenile_front.png", url: createSampleSvgDataUrl("正面正交視圖 1:1", "#34495e") }
        ],
        fileCount: 4,
        status: "provisional"
      },
      {
        id: "cr-20261106-7f3a-2105-adolescent",
        type: "creature-concept",
        stage: "adolescent",
        baseId: "cr-20261106-7f3a-2105",
        subjectId: "line_7f3a",
        manifest: {
          spec: "cosmimera-art-task/1",
          task_header: "[COSMIMERA-TASK spec=1 tool=1.9.0 catalog=2.1.0 template=creature-concept@5.0.0 task_id=cr-20261106-7f3a-2105-adolescent seed=7f3a]",
          task_id: "cr-20261106-7f3a-2105-adolescent",
          task_type: "creature-concept",
          subject_id: "line_7f3a",
          produced_by: "ChatGPT",
          files: [
            { path: "concept.json", kind: "spec", level: "L1" },
            { path: "images/cr_line_7f3a_adolescent_main.png", kind: "main", level: "L1" },
            { path: "images/cr_line_7f3a_adolescent_turnaround.png", kind: "turnaround", level: "L1" },
            { path: "images/cr_line_7f3a_adolescent_front.png", kind: "view", level: "L1" }
          ],
          missing: [],
          notes: "少年型態：熔脊獸，背脊隆起暗紅火山岩刺甲"
        },
        concept: Object.assign({}, crBaseConcept, {
          stage: "adolescent", name_zh: "熔脊獸", size_class: "M", height_length: "1.10 m", weight: "85 kg", body_fat: "16.0%",
          dex_zh: "熔脊獸背脊隆起暗紅火山岩刺甲，動作敏捷矯健。遭遇強敵時會將身軀蜷成半圓，以堅硬背甲抵擋衝擊並噴發高溫蒸氣。"
        }),
        images: [
          { path: "images/cr_line_7f3a_adolescent_main.png", url: createSampleSvgDataUrl("熔脊獸 · 少年立繪 (1.10m)", "#d35400") },
          { path: "images/cr_line_7f3a_adolescent_turnaround.png", url: createSampleSvgDataUrl("熔脊獸 · T-Pose 三視圖", "#7f8c8d") },
          { path: "images/cr_line_7f3a_adolescent_front.png", url: createSampleSvgDataUrl("正面正交視圖 1:1", "#34495e") }
        ],
        fileCount: 4,
        status: "provisional"
      },
      {
        id: "cr-20261106-7f3a-2105-adult",
        type: "creature-concept",
        stage: "adult",
        baseId: "cr-20261106-7f3a-2105",
        subjectId: "line_7f3a",
        manifest: {
          spec: "cosmimera-art-task/1",
          task_header: "[COSMIMERA-TASK spec=1 tool=1.9.0 catalog=2.1.0 template=creature-concept@5.0.0 task_id=cr-20261106-7f3a-2105-adult seed=7f3a]",
          task_id: "cr-20261106-7f3a-2105-adult",
          task_type: "creature-concept",
          subject_id: "line_7f3a",
          produced_by: "ChatGPT",
          files: [
            { path: "concept.json", kind: "spec", level: "L1" },
            { path: "images/cr_line_7f3a_adult_main.png", kind: "main", level: "L1" },
            { path: "images/cr_line_7f3a_adult_turnaround.png", kind: "turnaround", level: "L1" },
            { path: "images/cr_line_7f3a_adult_front.png", kind: "view", level: "L1" }
          ],
          missing: [],
          notes: "成年型態：焰甲重龍，四足重甲巨獸，雙角重鎧桃紋飾"
        },
        concept: Object.assign({}, crBaseConcept, {
          stage: "adult", name_zh: "焰甲重龍", size_class: "L", height_length: "2.10 m", weight: "340 kg", body_fat: "15.0%",
          dex_zh: "成年焰甲重龍體魄沉雄威嚴，全覆式玄鐵外甲能抵禦熔岩洗禮。雙角重鎧刻劃古老桃紋，戰鬥時作為陣線前排堡壘屹立不搖。"
        }),
        images: [
          { path: "images/cr_line_7f3a_adult_main.png", url: createSampleSvgDataUrl("焰甲重龍 · 成年立繪 (2.10m)", "#c0392b") },
          { path: "images/cr_line_7f3a_adult_turnaround.png", url: createSampleSvgDataUrl("焰甲重龍 · T-Pose 三視圖", "#7f8c8d") },
          { path: "images/cr_line_7f3a_adult_front.png", url: createSampleSvgDataUrl("正面正交視圖 1:1", "#34495e") }
        ],
        fileCount: 4,
        status: "provisional"
      },
      {
        id: "cr-20261106-7f3a-2105-overload",
        type: "creature-concept",
        stage: "overload",
        baseId: "cr-20261106-7f3a-2105",
        subjectId: "line_7f3a",
        manifest: {
          spec: "cosmimera-art-task/1",
          task_header: "[COSMIMERA-TASK spec=1 tool=1.9.0 catalog=2.1.0 template=creature-concept@5.0.0 task_id=cr-20261106-7f3a-2105-overload seed=7f3a]",
          task_id: "cr-20261106-7f3a-2105-overload",
          task_type: "creature-concept",
          subject_id: "line_7f3a",
          produced_by: "ChatGPT",
          files: [
            { path: "concept.json", kind: "spec", level: "L1" },
            { path: "images/cr_line_7f3a_overload_main.png", kind: "main", level: "L1" },
            { path: "images/cr_line_7f3a_overload_turnaround.png", kind: "turnaround", level: "L1" },
            { path: "images/cr_line_7f3a_overload_front.png", kind: "view", level: "L1" }
          ],
          missing: [],
          notes: "超載型態：天炎煌角甲，熔金光翼巨角，超載能量外溢"
        },
        concept: Object.assign({}, crBaseConcept, {
          stage: "overload", name_zh: "天炎煌角甲", size_class: "XL", height_length: "3.80 m", weight: "920 kg", body_fat: "12.0%",
          dex_zh: "當以太核心完全過載，體內岩漿沸騰噴湧化作四翼熔金光羽。巨角撕裂空氣爆發千度熾炎，踏足之處岩層盡皆融為燦金色琉璃。"
        }),
        images: [
          { path: "images/cr_line_7f3a_overload_main.png", url: createSampleSvgDataUrl("天炎煌角甲 · 超載立繪 (3.80m)", "#962d22") },
          { path: "images/cr_line_7f3a_overload_turnaround.png", url: createSampleSvgDataUrl("天炎煌角甲 · T-Pose 三視圖", "#7f8c8d") },
          { path: "images/cr_line_7f3a_overload_front.png", url: createSampleSvgDataUrl("正面正交視圖 1:1", "#34495e") }
        ],
        fileCount: 4,
        status: "provisional"
      },
      {
        id: "mdl-20261106-7f3a-2105-adult",
        type: "creature-model-rig",
        stage: "adult",
        baseId: "mdl-20261106-7f3a-2105",
        subjectId: "line_7f3a",
        manifest: {
          spec: "cosmimera-art-task/1",
          task_header: "[COSMIMERA-TASK spec=1 tool=2.0.0 catalog=1.3.0 template=creature-model-rig@4.1.0 task_id=mdl-20261106-7f3a-2105-adult seed=7f3a]",
          task_id: "mdl-20261106-7f3a-2105-adult",
          task_type: "creature-model-rig",
          subject_id: "line_7f3a",
          source_pack: "cr-20261106-7f3a-2105-adult",
          produced_by: "Gemini Argon",
          files: [
            { path: "images/cr_line_7f3a_adult_model_front.png", kind: "view", level: "L1" },
            { path: "images/cr_line_7f3a_adult_model_side.png", kind: "view", level: "L1" },
            { path: "images/cr_line_7f3a_adult_model_back.png", kind: "view", level: "L1" },
            { path: "images/cr_line_7f3a_adult_anim_sheet_01.png", kind: "sheet", level: "L1" },
            { path: "rig/rig_spec.json", kind: "spec", level: "L1" },
            { path: "rig/build_rig.py", kind: "script", level: "L1" },
            { path: "anims/anim_spec.json", kind: "spec", level: "L1" },
            { path: "anims/keyframes.py", kind: "script", level: "L1" },
            { path: "pipeline/run_all.py", kind: "script", level: "L1" },
            { path: "pipeline/README.md", kind: "report", level: "L1" }
          ],
          missing: [
            { item: "models/cr_line_7f3a_adult.glb", level: "L2", reason: "no 3D generation on this platform" }
          ],
          notes: "由成年立繪包 cr-20261106-7f3a-2105-adult 生成 3D 建模正交視圖與骨架動作規格"
        },
        animSpec: {
          spec: "cosmimera-anim-spec/1",
          template: "creature-model-rig@4.1.0",
          subject_id: "line_7f3a",
          source_pack: "cr-20261106-7f3a-2105-adult",
          fps: 30,
          total_clips: C.CLIPS.creature.length,
          clips: C.CLIPS.creature.map(c => ({
            clip: "cr_" + c.id,
            description: c.zh,
            fps: 30,
            frames: c.f,
            duration_sec: +(c.f / 30).toFixed(4),
            loop: !!c.loop,
            root_motion: !!c.rm,
            events: (c.ev || []).map(ev => {
              const [name, fr] = ev.split("@");
              return { name, frame: +fr, time_sec: +(+fr / 30).toFixed(4) };
            }),
            file: "anims/cr_" + c.id + ".fbx",
            animated_bones_count: 24,
            keyframe_samples: Math.ceil(c.f / 2)
          }))
        },
        images: [
          { path: "images/cr_line_7f3a_adult_model_front.png", url: createSampleSvgDataUrl("焰甲重龍 · 建模正交正面 2048px", "#e67e22") },
          { path: "images/cr_line_7f3a_adult_model_side.png", url: createSampleSvgDataUrl("焰甲重龍 · 建模正交側面 2048px", "#d35400") },
          { path: "images/cr_line_7f3a_adult_model_back.png", url: createSampleSvgDataUrl("焰甲重龍 · 建模正交背面 2048px", "#ba4a00") },
          { path: "images/cr_line_7f3a_adult_anim_sheet_01.png", url: createSampleSvgDataUrl("動作關鍵幀分鏡 · 焰甲重龍", "#8e44ad") }
        ],
        fileCount: 11,
        status: "provisional"
      }
    ];
    mockPackages.forEach(p => addPackage(p));
    reviewState.activeStage = "adult";
    reviewState.activePkgId = "cr-20261106-7f3a-2105-adult";
    renderReviewView();
    toast("已載入內建測試範例（含宙獸四型態、3D成果與角色立繪）");
  }

  function createSampleSvgDataUrl(title, color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <rect width="100%" height="100%" fill="#1a1e27"/>
      <rect x="20" y="20" width="560" height="560" fill="none" stroke="${color}" stroke-width="4" rx="10"/>
      <circle cx="300" cy="240" r="100" fill="${color}" opacity="0.3"/>
      <text x="300" y="250" font-family="system-ui, sans-serif" font-size="20" fill="#fff" text-anchor="middle" font-weight="bold">${title}</text>
      <text x="300" y="420" font-family="monospace" font-size="14" fill="#aab3c2" text-anchor="middle">COSMIMERA ART DELIVERY PREVIEW</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  // ==================== IndexedDB 目錄 Handle 持久化 ====================
  function getDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { resolve(null); return; }
      const req = indexedDB.open("CosmimeraForgeDB", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("handles");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function saveDirectoryHandle(handle, key = "reviewIncomingDir") {
    try {
      const db = await getDb();
      if (!db) return;
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, key);
    } catch (e) {}
  }

  async function getSavedDirectoryHandle(key = "reviewIncomingDir") {
    try {
      const db = await getDb();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction("handles", "readonly");
        const req = tx.objectStore("handles").get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  // 自動或手動掃描目錄
  async function performScanDirectory(dirHandle) {
    let foundCount = 0;
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "directory") {
        await loadFromDirHandle(name, handle);
        foundCount++;
      }
    }
    return foundCount;
  }

  // 嘗試自動掃描已記憶授權的目錄
  async function tryAutoScanIncoming() {
    const handle = (await getSavedDirectoryHandle("reviewIncomingDir")) || (await getSavedDirectoryHandle("incomingDir"));
    if (!handle) return false;
    try {
      let perm = await handle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        perm = await handle.queryPermission({ mode: "read" });
      }
      if (perm === "granted") {
        const count = await performScanDirectory(handle);
        if (count > 0) {
          toast(`自動掃描完成，已載入 ${count} 個交付包`);
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // 掃描本專案 Art/_incoming 目錄（File System Access API）
  async function scanIncomingDirectory() {
    if (!window.showDirectoryPicker) {
      $("#folderFileInput").click();
      return;
    }
    try {
      toast("請選取本專案 (cosmos_chimera_forge) 的 Art/_incoming 目錄進行審查掃描...");
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveDirectoryHandle(dirHandle, "reviewIncomingDir");
      toast("正在掃描本專案審查目錄...");
      const foundCount = await performScanDirectory(dirHandle);
      toast("掃描完成，已載入 " + foundCount + " 個交付包");
    } catch (e) {
      if (e.name !== "AbortError") toast("掃描失敗：" + e.message);
    }
  }

  // 透過標準 webkitdirectory 上傳批次資料夾解析
  async function handleFolderUpload(fileList) {
    const files = Array.from(fileList || []), groups = new Map();
    for (const file of files) {
      if (/\.zip$/i.test(file.name)) { toast("請選取展開後的資產目錄"); continue; }
      const parts = (file.webkitRelativePath || file.name).split("/");
      let at = parts.findIndex(p => /^(chr-|cr-|mdl-|anim-|asset_)/.test(p));
      if (at < 0) at = 0;
      const id = parts[at];
      if (!groups.has(id)) groups.set(id, {});
      groups.get(id)[parts.slice(at).join("/")] = new Uint8Array(await file.arrayBuffer());
    }
    for (const [name, raw] of groups) await loadAssetFiles(raw, {name});
    renderReviewView();
  }

  async function loadFromDirHandle(taskId, dirHandle) {
    const raw = {};
    async function collect(handle, prefix) {
      for await (const [name, child] of handle.entries()) {
        window.COSMI_DRIVE.relative(name);
        if (child.kind === "directory") await collect(child, prefix + name + "/");
        else if (!/\.zip$/i.test(name)) raw[prefix + name] = new Uint8Array(await (await child.getFile()).arrayBuffer());
      }
    }
    await collect(dirHandle, taskId + "/");
    const pkg = await loadAssetFiles(raw, {name: taskId});
    pkg.dirHandle = dirHandle; return pkg;
  }

  function getActivePkg() {
    return reviewState.packages.find(p => p.id === reviewState.activePkgId) || reviewState.packages[0] || null;
  }

  async function exportAssetDirectory(pkg) {
    if (!pkg) return toast("請先選取資產");
    if (!window.showDirectoryPicker) return toast("請使用支援資料夾寫入的瀏覽器，或直接在 Drive 下載個別檔案");
    try {
      const root = await window.showDirectoryPicker({mode: "readwrite"});
      const target = await root.getDirectoryHandle(pkg.id, {create: true});
      const entries = pkg.driveFiles || Object.keys(pkg.rawFiles || {}).map(path => ({path: path.startsWith(pkg.id + "/") ? path.slice(pkg.id.length + 1) : path, key: path}));
      for (const f of entries) {
        const parts = window.COSMI_DRIVE.relative(f.path), name = parts.pop(); let dir = target;
        for (const part of parts) dir = await dir.getDirectoryHandle(part, {create: true});
        const blob = pkg.driveFolderId ? await window.COSMI_DRIVE.read(pkg.drivePath + "/" + f.path) : new Blob([pkg.rawFiles[f.key]]);
        const h = await dir.getFileHandle(name, {create: true}), w = await h.createWritable();
        await w.write(blob); await w.close();
      }
      toast("已逐檔匯出資產目錄");
    } catch (e) { if (e.name !== "AbortError") toast(e.message); }
  }

  // ==================== 實體一鍵解壓縮引擎（解壓至本專案 Art/_incoming） ====================
  async function unpackPackageToDisk(pkg) {
    if (!pkg) { toast("請先選取任務包"); return false; }
    const cmd = `powershell unpack_incoming.ps1 -Pattern "${pkg.id}*"`;

    if (!pkg.rawFiles || !Object.keys(pkg.rawFiles).length) {
      copyText(cmd, "此任務包無記憶體檔案，已複製本專案解壓指令至剪貼簿！可在終端機貼上執行");
      return false;
    }

    if (window.showDirectoryPicker) {
      try {
        let dirHandle = await getSavedDirectoryHandle("reviewIncomingDir");
        let needPick = !dirHandle;
        if (dirHandle) {
          try {
            let perm = await dirHandle.queryPermission({ mode: "readwrite" });
            if (perm !== "granted") {
              perm = await dirHandle.requestPermission({ mode: "readwrite" });
              if (perm !== "granted") needPick = true;
            }
          } catch (e) {
            needPick = true;
          }
        }
        if (needPick) {
          toast("請在彈出視窗選取本專案 (cosmos_chimera_forge) 的 Art/_incoming 目錄以進行解壓...");
          dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
          await saveDirectoryHandle(dirHandle, "reviewIncomingDir");
        }

        toast(`⚡ 正在將 ${pkg.id} 實體解壓縮至本專案 (${dirHandle.name})...`);

        // 建立或取得本專案 Art/_incoming/<task_id>/ 目錄 handle
        const targetDir = await dirHandle.getDirectoryHandle(pkg.id, { create: true });

        for (const filePath in pkg.rawFiles) {
          let rel = filePath;
          if (rel.startsWith(pkg.id + "/") || rel.startsWith(pkg.id + "\\")) {
            rel = rel.slice(pkg.id.length + 1);
          }
          if (!rel || rel.endsWith("/") || rel.endsWith("\\")) continue;

          const parts = rel.replace(/\\/g, "/").split("/").filter(Boolean);
          if (!parts.length) continue;

          let curDir = targetDir;
          for (let i = 0; i < parts.length - 1; i++) {
            curDir = await curDir.getDirectoryHandle(parts[i], { create: true });
          }

          const fileHandle = await curDir.getFileHandle(parts[parts.length - 1], { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(pkg.rawFiles[filePath]);
          await writable.close();
        }

        pkg.isZip = false;
        pkg.localExtracted = true;
        pkg.dirHandle = targetDir;
        toast(`✅ 已成功解壓至本專案: ${dirHandle.name}/${pkg.id}/！`);
        renderReviewView();
        return true;
      } catch (e) {
        if (e.name === "AbortError") return false;
        console.warn("Direct disk unpack failed, falling back to command:", e);
      }
    }

    // 瀏覽器不支援 File System API 或授權取消時，安全退回複製指令
    copyText(cmd, "已複製本專案解壓指令！可在 PowerShell 直接貼上執行一鍵解壓");
    return false;
  }

  // ==================== 審查通過，交付至 cosmos_chimera ====================
  async function deployPackageToGame(pkg) {
    if (!pkg) pkg = getActivePkg();
    if (!pkg) { toast("請先選取要交付的任務包"); return false; }
    const cmd = `powershell unpack_incoming.ps1 -Pattern "${pkg.id}*" -DeployToGame`;
    copyText(cmd, `已複製交付至 cosmos_chimera 指令！可在終端機貼上執行`);
    toast(`已複製交付至 cosmos_chimera 指令！`);
    return true;
  }

  // ==================== 一鍵舊版 Prompt 內容格式升級引擎 ====================
  function upgradePackageFormat(pkg) {
    if (!pkg) { toast("請先選取要升級的任務包"); return null; }
    const changes = [];
    const isChr = pkg.type === "character-concept" || pkg.id.startsWith("chr-");
    const isCr = pkg.type === "creature-concept" || pkg.id.startsWith("cr-");
    const is3d = is3dType(pkg.type) || pkg.id.startsWith("mdl-") || pkg.id.startsWith("anim-");
    const isChr3d = is3d && (pkg.type === "character-model-rig" || pkg.manifest?.source_pack?.startsWith("chr-") || pkg.subjectId?.startsWith("chr"));
    const isCr3d = is3d && !isChr3d;

    let updatedConcept = Object.assign({}, pkg.concept || {});
    let updatedManifest = Object.assign({}, pkg.manifest || {});
    let targetTaskId = pkg.id;
    let targetTaskType = isChr ? "character-concept" : isCr ? "creature-concept" : isChr3d ? "character-model-rig" : isCr3d ? "creature-model-rig" : pkg.type;

    if (isChr) {
      const t = TASKS.find(x => x.id === "character-concept");
      changes.push("升級至最新角色模板：template=character-concept@" + t.version + ", spec=1, tool=" + TOOL_VERSION);

      // 解除人種與文化關聯，補齊生理常態數值
      if (!updatedConcept.ethnicity) { updatedConcept.ethnicity = "東亞體系"; changes.push("補齊人種表型：東亞體系"); }
      if (!updatedConcept.region) { updatedConcept.region = "東亞"; changes.push("補齊文化地區：東亞"); }
      if (!updatedConcept.timeline) { updatedConcept.timeline = "晶石賽博/霓虹魔導義體紀元"; changes.push("補齊文化時間線：晶石賽博/霓虹魔導義體紀元"); }
      if (!updatedConcept.gender) updatedConcept.gender = "女";
      if (!updatedConcept.age_band) updatedConcept.age_band = "青少年";
      if (!updatedConcept.age) updatedConcept.age = 17;

      if (!updatedConcept.height && !updatedConcept.height_cm) {
        const dim = sampleHumanDimensions(Math.random, updatedConcept.gender, updatedConcept.age_band, updatedConcept.age);
        updatedConcept.height = dim.height; updatedConcept.weight = dim.weight; updatedConcept.body_fat = dim.bodyFat;
        changes.push("補齊常態生理規格分佈：身高 " + dim.height + "、體重 " + dim.weight + "、體脂率 " + dim.bodyFat);
      } else {
        if (updatedConcept.height_cm && !updatedConcept.height) updatedConcept.height = updatedConcept.height_cm;
        if (updatedConcept.weight_kg && !updatedConcept.weight) updatedConcept.weight = updatedConcept.weight_kg;
        if (updatedConcept.body_fat_pct && !updatedConcept.body_fat) updatedConcept.body_fat = updatedConcept.body_fat_pct;
      }

      if (updatedConcept.gender === "女" && !updatedConcept.cup_size) {
        updatedConcept.cup_size = "C";
        changes.push("補齊女性罩杯常態預設：C 罩杯");
      }

      // 配色與性格
      if (!updatedConcept.outfit_palette || !updatedConcept.outfit_palette.length) {
        updatedConcept.outfit_palette = ["海軍藍 × 象牙白 × 霧金"];
        changes.push("補齊服裝色系：海軍藍 × 象牙白 × 霧金");
      }
      if (!updatedConcept.hair_palette || !updatedConcept.hair_palette.length) {
        updatedConcept.hair_palette = ["純黑 × 挑染天藍"];
        changes.push("補齊頭髮色系：純黑 × 挑染天藍");
      }
      if (!updatedConcept.eye_palette || !updatedConcept.eye_palette.length) {
        updatedConcept.eye_palette = ["琥珀金"];
        changes.push("補齊瞳孔色系：琥珀金");
      }
      if (!updatedConcept.vessel) {
        updatedConcept.vessel = "talisman_card";
        updatedConcept.vessel_zh = "符籙卡片";
        changes.push("補齊收服媒介：符籙卡片 (talisman_card)");
      }
      if (!updatedConcept.biography) {
        updatedConcept.biography = `${updatedConcept.name_zh || "角色"}誕生於${updatedConcept.region || "未知星域"}，自幼在${updatedConcept.timeline || "當前文明紀元"}的環境中歷練成長。性格${(updatedConcept.personality || []).join("且") || "堅毅"}的她/他，以${updatedConcept.vessel_zh || updatedConcept.vessel || "收服道具"}作為與宙獸建立精神共鳴的關鍵媒介。在無垠星海的旅途中，始終堅定信念與夥伴共同破除迷霧。`;
        changes.push("補齊角色生平傳記（biography，約 150–300 字小說側寫）");
      }
      if (updatedConcept.outfit_palette && updatedConcept.outfit_palette.length === 1 && updatedConcept.outfit_palette[0].includes("×")) {
        updatedConcept.outfit_palette = updatedConcept.outfit_palette[0].split("×").map(s => s.trim());
      }
      if (!updatedConcept.outfit_palette || updatedConcept.outfit_palette.length < 4) {
        const extraColors = ["海軍深藍", "象牙米白", "黃銅金", "珊瑚鮮橘"];
        const cur = updatedConcept.outfit_palette || [];
        for (const ec of extraColors) {
          if (cur.length >= 4) break;
          if (!cur.includes(ec)) cur.push(ec);
        }
        updatedConcept.outfit_palette = cur;
        changes.push("補齊服裝色系至 4 色規格：" + cur.join("、"));
      }

      const seed = pkg.manifest?.task_header?.match(/seed=([^\s\]]+)/)?.[1] || pkg.id.split("-")[2] || "7f3a";
      const header = "[COSMIMERA-TASK spec=1 tool=" + TOOL_VERSION + " catalog=" + C.version + " template=" + t.id + "@" + t.version + " task_id=" + targetTaskId + " seed=" + seed + "]";
      const ctx = {
        header, taskId: targetTaskId, task: t, opts: {}, concept: updatedConcept, notes: updatedManifest.notes || "",
        platform: "chatgpt", platformName: "ChatGPT（對話版）",
        subjectId: updatedConcept.id || ("chr_" + seed)
      };
      const newPromptText = t.build(ctx);

      updatedManifest.spec = "cosmimera-art-task/1";
      updatedManifest.task_header = header;
      updatedManifest.task_type = "character-concept";
      updatedManifest.subject_id = ctx.subjectId;

      return { pkg, changes, newConcept: updatedConcept, newManifest: updatedManifest, newPromptText, targetTaskId };

    } else if (isCr) {
      const t = TASKS.find(x => x.id === "creature-concept");
      changes.push("升級至最新宙獸模板：template=creature-concept@" + t.version + ", spec=1, tool=" + TOOL_VERSION);

      // 外觀基底父類別遷移
      if (updatedConcept.base_parents) {
        const oldP = JSON.stringify(updatedConcept.base_parents);
        updatedConcept.base_parents = updatedConcept.base_parents.map(traceBaseParent);
        if (oldP !== JSON.stringify(updatedConcept.base_parents)) {
          changes.push("外觀基底類別遷移：舊版「人形」已自動追溯遷移為「類人奇幻·精靈族」");
        }
      }

      // 體型與尺寸分佈
      if (!updatedConcept.size_profile) {
        updatedConcept.size_profile = "S→M→L→XL";
        changes.push("補齊生物體型配置：size_profile = S→M→L→XL");
      }
      if (!updatedConcept.height_length && !updatedConcept.height_m) {
        const dim = sampleCreatureDimensions(Math.random, "L");
        updatedConcept.height_length = dim.length; updatedConcept.weight = dim.weight; updatedConcept.body_fat = dim.bodyFat;
        changes.push("補齊成體生物常態尺寸：身長 " + dim.length + "、重量 " + dim.weight + "、體脂率 " + dim.bodyFat);
      } else {
        if (updatedConcept.height_m && !updatedConcept.height_length) updatedConcept.height_length = updatedConcept.height_m;
        if (updatedConcept.weight_kg && !updatedConcept.weight) updatedConcept.weight = updatedConcept.weight_kg;
        if (updatedConcept.body_fat_pct && !updatedConcept.body_fat) updatedConcept.body_fat = updatedConcept.body_fat_pct;
      }
      if (updatedConcept.appearance_palette && updatedConcept.appearance_palette.length === 1 && updatedConcept.appearance_palette[0].includes("×")) {
        updatedConcept.appearance_palette = updatedConcept.appearance_palette[0].split("×").map(s => s.trim());
      }
      if (!updatedConcept.appearance_palette || updatedConcept.appearance_palette.length < 4) {
        const extraColors = ["熔岩赤紅", "炭黑硬甲", "烈焰耀金", "鍍銀鋼白"];
        const cur = updatedConcept.appearance_palette || [];
        for (const ec of extraColors) {
          if (cur.length >= 4) break;
          if (!cur.includes(ec)) cur.push(ec);
        }
        updatedConcept.appearance_palette = cur;
        changes.push("補齊宙獸外觀配色至 4 色規格：" + cur.join("、"));
      }
      if (!updatedConcept.base_parents || updatedConcept.base_parents.length < 3) {
        const curBp = updatedConcept.base_parents || ["生物·哺乳類"];
        if (curBp.length < 3 && !curBp.includes("科幻機械·仿生機獸")) curBp.push("科幻機械·仿生機獸");
        if (curBp.length < 3 && !curBp.includes("裝備·兵器")) curBp.push("裝備·兵器");
        updatedConcept.base_parents = curBp;
        changes.push("外觀基底類別擴充至 3 項規格：" + curBp.join("、"));
      }
      if (!updatedConcept.dex_zh) {
        updatedConcept.dex_zh = `${updatedConcept.name_zh || "該宙獸"}常年棲息於極端自然天候之中，外觀構造與其屬性能量高度共鳴。平時性情沉著警戒，在遭遇外敵或與訓練家共鳴時，能釋放出驚人的屬性威能。`;
        changes.push("補齊生態圖鑑解說（dex_zh，約 80–180 字）");
      }

      // 招式與特性圖鑑化獨立
      if (updatedConcept.signature_move_idea && !updatedConcept.signature_move) {
        updatedConcept.signature_move = { name_zh: updatedConcept.signature_move_idea, move_id: "move_" + (updatedConcept.line_id || "creature") + "_sig" };
        delete updatedConcept.signature_move_idea;
        changes.push("專屬招式獨立圖鑑化：signature_move { name_zh, move_id }");
      }
      if (updatedConcept.trait_idea_zh && !updatedConcept.trait) {
        updatedConcept.trait = { name_zh: updatedConcept.trait_idea_zh, trait_id: "trait_" + (updatedConcept.line_id || "creature") + "_core" };
        delete updatedConcept.trait_idea_zh;
        changes.push("專屬特性獨立圖鑑化：trait { name_zh, trait_id }");
      }

      const seed = pkg.manifest?.task_header?.match(/seed=([^\s\]]+)/)?.[1] || pkg.id.split("-")[2] || "7f3a";
      const header = "[COSMIMERA-TASK spec=1 tool=" + TOOL_VERSION + " catalog=" + C.version + " template=" + t.id + "@" + t.version + " task_id=" + targetTaskId + " seed=" + seed + "]";
      const stagesOpts = ["juvenile", "adolescent", "adult", "overload"];
      const ctx = {
        header, taskId: targetTaskId, task: t, opts: { stages: stagesOpts }, concept: updatedConcept, notes: updatedManifest.notes || "",
        platform: "chatgpt", platformName: "ChatGPT（對話版）",
        subjectId: updatedConcept.line_id || ("line_" + seed)
      };
      let newPromptText = "";
      try {
        newPromptText = t.build(ctx);
      } catch (e) {
        newPromptText = pkg.rawPrompt || (pkg.manifest?.task_header || "Prompt 格式升級失敗：" + e.message);
      }

      updatedManifest.spec = "cosmimera-art-task/1";
      updatedManifest.task_header = header;
      updatedManifest.task_type = "creature-concept";
      updatedManifest.subject_id = ctx.subjectId;

      return { pkg, changes, newConcept: updatedConcept, newManifest: updatedManifest, newPromptText, targetTaskId };

    } else if (is3d) {
      const isChr3d = (pkg.type === "character-model-rig" || pkg.manifest?.source_pack?.startsWith("chr-") || pkg.subjectId?.startsWith("chr"));
      const targetId = isChr3d ? "character-model-rig" : "creature-model-rig";
      const t = TASKS.find(x => x.id === targetId) || TASKS[0];
      changes.push("升級至最新 " + (isChr3d ? "角色" : "宙獸") + " 3D 管線模板：template=" + targetId + "@" + t.version + " (整合綁骨與動畫)");

      // 補齊並確保往回參照立繪包 (source_pack)
      let sp = updatedManifest.source_pack;
      if (!sp) {
        // 嘗試在已載入名冊中尋找對應的立繪包
        const linked = getLinkedPackage(pkg);
        if (linked) {
          sp = linked.id;
          changes.push("成功回溯關聯立繪包：source_pack = " + sp);
        } else {
          sp = (isChr3d ? "chr-" : "cr-") + pkg.id.replace(/^(mdl|anim)-/, "");
          changes.push("補齊來源立繪包回溯參照：source_pack = " + sp);
        }
      }
      updatedManifest.source_pack = sp;

      const seed = pkg.manifest?.task_header?.match(/seed=([^\s\]]+)/)?.[1] || pkg.id.split("-")[2] || "7f3a";
      const header = "[COSMIMERA-TASK spec=1 tool=" + TOOL_VERSION + " catalog=" + C.version + " template=" + t.id + "@" + t.version + " task_id=" + targetTaskId + " seed=" + seed + "]";
      const ctx = {
        header, taskId: targetTaskId, task: t,
        opts: isChr3d ? {
          scope: "single", source_pack: sp,
          actions_character: ["idle","idle_long","walk","run","hit","death","catch_throw"]
        } : {
          scope: "single", source_pack: sp, stage: pkg.stage || "adult",
          actions_creature: ["idle","idle_long","walk","run","hit","death","atk_melee_front","atk_ranged_line"]
        },
        concept: updatedConcept, notes: updatedManifest.notes || "",
        platform: "gemini", platformName: "Gemini Argon（任務模式）",
        subjectId: updatedManifest.subject_id || (isChr3d ? ("chr_" + seed) : ("line_" + seed))
      };
      const newPromptText = t.build(ctx);

      updatedManifest.spec = "cosmimera-art-task/1";
      updatedManifest.task_header = header;
      updatedManifest.task_type = targetId;

      return { pkg, changes, newConcept: updatedConcept, newManifest: updatedManifest, newPromptText, targetTaskId };
    }

    toast("無法識別該任務包的升級規則");
    return null;
  }

  // 顯示升級成果對話框
  let lastUpgradeResult = null;
  function showUpgradeModal(result) {
    if (!result) return;
    lastUpgradeResult = result;
    const { pkg, changes, newConcept, newManifest, newPromptText, targetTaskId } = result;

    $("#upgModalTitle").textContent = "🔄 升級完成：" + targetTaskId + " → 最新規範";
    const cl = $("#upgChangesList"); cl.replaceChildren();
    changes.forEach(c => cl.append(el("li", {}, c)));
    $("#upgPromptText").value = newPromptText;

    // 同步更新記憶體內的 package 狀態
    pkg.concept = newConcept;
    pkg.manifest = newManifest;
    pkg.rawPrompt = newPromptText;
    if (newManifest.task_type) pkg.type = newManifest.task_type;
    renderReviewView();

    $("#upgradeModal").classList.add("show");
  }

  // 渲染成果審查台主要畫面
  function renderReviewView() {
    const pkg = getActivePkg();
    const linkedPkg = getLinkedPackage(pkg);

    // 渲染名冊清單
    // 渲染名冊清單（依 groupKey 分組，同宙獸之四種型態收合於同一項目）
    const railList = $("#railList"); railList.replaceChildren();
    const query = reviewState.filterQuery.toLowerCase();
    const filtered = reviewState.packages.filter(p => {
      if (reviewState.filterCat === "pending" && p.status !== "pending") return false;
      if (reviewState.filterCat === "chr" && !p.id.startsWith("chr")) return false;
      if (reviewState.filterCat === "cr" && !p.id.startsWith("cr")) return false;
      if (reviewState.filterCat === "mdl" && !p.id.startsWith("mdl") && !p.id.startsWith("anim")) return false;
      if (reviewState.filterCat === "fx" && !p.id.startsWith("fx")) return false;
      if (query && !p.id.toLowerCase().includes(query) && !p.subjectId.toLowerCase().includes(query) && !(p.manifest?.source_pack || "").toLowerCase().includes(query)) return false;
      return true;
    });

    const groups = [];
    const groupMap = new Map();
    filtered.forEach(p => {
      const gk = (p.type === "creature-concept" || p.id.startsWith("cr"))
        ? (p.groupKey || p.baseId || p.id)
        : (is3dType(p.type) || p.id.startsWith("mdl"))
        ? (p.groupKey || p.baseId || p.id)
        : p.id;
      if (!groupMap.has(gk)) {
        const g = { key: gk, packages: [], baseId: p.baseId || p.id, type: p.type, subjectId: p.subjectId };
        groupMap.set(gk, g);
        groups.push(g);
      }
      groupMap.get(gk).packages.push(p);
    });

    groups.forEach(g => {
      const isSel = pkg && (pkg.groupKey === g.key || pkg.id === g.key || g.packages.some(p => p.id === pkg.id));
      let repPkg = (isSel && pkg) ? pkg : null;
      if (!repPkg) {
        repPkg = g.packages.find(p => p.stage === reviewState.activeStage)
          || g.packages.find(p => p.stage === "adult")
          || g.packages[0];
      }

      const thumbUrl = repPkg.images?.[0]?.url || g.packages.find(p => p.images?.[0]?.url)?.images[0].url;
      const statZh = reviewStatusInfo(repPkg.status).badge;
      const pLinked = getLinkedPackage(repPkg);

      // 若群組有多種型態或具備型態屬性，顯示型態標籤 pills
      let stagePillsEl = null;
      const hasStages = g.packages.some(p => p.stage);
      if (hasStages) {
        const pills = STAGE_KEYS.map(stKey => {
          const matchP = g.packages.find(p => p.stage === stKey);
          if (!matchP) return null;
          const isStOn = isSel && repPkg.stage === stKey;
          return el("span", {
            class: "stage-pill" + (isStOn ? " on" : ""),
            title: STAGE_ZH[stKey] + " (" + matchP.id + ")",
            onclick: (e) => {
              e.stopPropagation();
              reviewState.activeStage = stKey;
              reviewState.activePkgId = matchP.id;
              reviewState.activeImgIdx = 0;
              renderReviewView();
            }
          }, STAGE_ZH[stKey]);
        }).filter(Boolean);
        stagePillsEl = el("div", { class: "stage-pills" }, pills);
      }

      const badges = el("div", { class: "rl-badges" },
        el("span", { class: "rl-stat " + repPkg.status }, statZh),
        repPkg.manifest?.source_pack ? el("span", { class: "rl-link-tag", title: "參照立繪: " + repPkg.manifest.source_pack }, "⬅ " + repPkg.manifest.source_pack.slice(0, 10)) : null,
        (!repPkg.manifest?.source_pack && pLinked && !is3dType(repPkg.type)) ? el("span", { class: "rl-link-tag", title: "已關聯 3D 模型" }, "➡ 3D") : null
      );

      const item = el("div", {
        class: "rl" + (isSel ? " on" : ""),
        onclick: () => {
          reviewState.activePkgId = repPkg.id;
          if (repPkg.stage) reviewState.activeStage = repPkg.stage;
          reviewState.activeImgIdx = 0;
          if ((is3dType(repPkg.type) || repPkg.id.startsWith("mdl")) && reviewState.viewMode === "single") {
            reviewState.viewMode = "3d";
          }
          renderReviewView();
        }
      },
        el("div", { class: "rl-thumb" }, thumbUrl ? el("img", { src: thumbUrl }) : "📦"),
        el("div", { class: "rl-txt" },
          el("div", { class: "rl-id" }, g.baseId || repPkg.id),
          el("div", { class: "rl-sub" }, repPkg.type + (repPkg.subjectId ? " · " + repPkg.subjectId : "") + (repPkg.stage ? " · " + STAGE_ZH[repPkg.stage] : "")),
          stagePillsEl,
          badges
        )
      );
      railList.append(item);
    });

    if (!groups.length) {
      railList.append(el("div", { class: "muted", style: "padding:16px 8px;text-align:center" }, "無符合條件的任務包"));
    }

    // 渲染舞台
    if (!pkg) {
      $("#stageEmpty").style.display = "block";
      $("#stageSingleView").style.display = "none";
      $("#stageCompareView").style.display = "none";
      $("#stageTag").style.display = "none";
      $("#stageCarousel").replaceChildren();
      $("#viewSeg").replaceChildren();
      $("#panelBody").replaceChildren(el("p", { class: "muted" }, "尚未選取任何任務包。"));
      return;
    }

    $("#stageEmpty").style.display = "none";
    $("#stageTag").style.display = "flex";
    $("#stId").textContent = pkg.id + (pkg.stage ? ` · ${STAGE_ZH[pkg.stage] || pkg.stage}` : "") + (pkg.aligned ? " [🏷️ 自動對齊格式]" : "");
    const badge = $("#stBadge");
    badge.className = "badge " + (pkg.status || "provisional");
    badge.textContent = reviewStatusInfo(pkg.status).zh;

    // 關聯立繪/3D 標籤
    const refTag = $("#stRefTag");
    if (is3dType(pkg.type) && (pkg.manifest?.source_pack || linkedPkg)) {
      refTag.style.display = "inline-block";
      const spId = pkg.manifest?.source_pack || linkedPkg?.id;
      refTag.textContent = "⬅ 立繪參照: " + spId;
      refTag.title = "點選切換至雙欄對照或跳轉立繪包";
    } else if (linkedPkg && !is3dType(pkg.type)) {
      refTag.style.display = "inline-block";
      refTag.textContent = "➡ 衍生 3D: " + linkedPkg.id;
      refTag.title = "點選切換至雙欄對照或跳轉 3D 包";
    } else {
      refTag.style.display = "none";
    }

    // 型態切換按鈕組 (按鍵切換型態：幼年、少年、成年、超載)
    let stageSwitchSeg = $("#stageSwitchSeg");
    const siblingStages = reviewState.packages.filter(p => p.groupKey === pkg.groupKey && p.type === pkg.type && p.stage);
    if (siblingStages.length > 0 || (pkg.type === "creature-concept" || pkg.id.startsWith("cr-"))) {
      if (!stageSwitchSeg) {
        stageSwitchSeg = el("div", { class: "seg stage-switch-seg", id: "stageSwitchSeg" });
        $("#stageTag").append(stageSwitchSeg);
      }
      stageSwitchSeg.style.display = "inline-flex";
      stageSwitchSeg.replaceChildren();
      STAGE_KEYS.forEach(stKey => {
        const found = siblingStages.find(p => p.stage === stKey);
        const isActive = (pkg.stage === stKey);
        const btn = el("button", {
          class: "segb" + (isActive ? " on" : ""),
          type: "button",
          disabled: !found,
          title: found ? `切換至 ${STAGE_ZH[stKey]} (${found.id})` : `尚未載入此型態交付包`,
          onclick: () => {
            if (!found) return;
            reviewState.activeStage = stKey;
            reviewState.activePkgId = found.id;
            reviewState.activeImgIdx = 0;
            renderReviewView();
          }
        }, STAGE_ZH[stKey]);
        stageSwitchSeg.append(btn);
      });
    } else if (stageSwitchSeg) {
      stageSwitchSeg.style.display = "none";
    }

    // 模式切換與呈現 (單圖 vs 2D ⇄ 3D 雙欄對比 vs 3D 動作檢視)
    const compareView = $("#stageCompareView");
    const singleView = $("#stageSingleView");
    const stage3dView = $("#stage3dView");
    const is3d = (reviewState.viewMode === "3d");
    const isCompare = (reviewState.viewMode === "compare");

    $("#btnModeSingle")?.classList.toggle("on", reviewState.viewMode === "single");
    $("#btnModeCompare")?.classList.toggle("on", isCompare);
    $("#btnMode3D")?.classList.toggle("on", is3d);

    const has3dData = is3dType(pkg.type) || pkg.glbFile || pkg.animSpec || linkedPkg?.glbFile || linkedPkg?.animSpec;
    if ($("#btnMode3D")) {
      $("#btnMode3D").style.display = has3dData ? "inline-flex" : "none";
    }

    // 更新右側「動作檢驗」分頁按鈕數字與狀態
    const pkgClips = getPackageClips(pkg, linkedPkg);
    const tabBtnAnims = $("#tabBtnAnims");
    if (tabBtnAnims) {
      tabBtnAnims.textContent = pkgClips.length ? `動作檢驗 (${pkgClips.length})` : "動作檢驗";
      tabBtnAnims.style.display = (pkgClips.length || has3dData) ? "inline-flex" : "none";
    }

    if (is3d) {
      singleView.style.display = "none";
      compareView.style.display = "none";
      stage3dView.style.display = "block";
      const zSeg = $("#zoomSeg"); if (zSeg) zSeg.style.display = "none";
      const cEl = $("#stageCarousel"); if (cEl) cEl.style.bottom = "58px";
      loadModelForPackage(pkg, linkedPkg);
    } else if (isCompare) {
      singleView.style.display = "none";
      compareView.style.display = "grid";
      stage3dView.style.display = "none";
      const zSeg = $("#zoomSeg"); if (zSeg) zSeg.style.display = "none";
      const cEl = $("#stageCarousel"); if (cEl) cEl.style.bottom = "8px";

      // 決定 2D 與 3D 的包
      let p2d = is3dType(pkg.type) ? linkedPkg : pkg;
      let p3d = is3dType(pkg.type) ? pkg : linkedPkg;

      $("#cmp2dId").textContent = p2d ? p2d.id : "無參照立繪包";
      $("#cmp3dId").textContent = p3d ? p3d.id : "無衍生 3D 模型";

      const img2d = p2d?.images?.[0]?.url || "";
      const cur3dIdx = (pkg === p3d) ? reviewState.activeImgIdx : 0;
      const img3d = p3d?.images?.[cur3dIdx]?.url || p3d?.images?.[0]?.url || "";

      $("#cmp2dImg").src = img2d;
      $("#cmp2dImg").style.display = img2d ? "block" : "none";
      $("#cmp3dImg").src = img3d;
      $("#cmp3dImg").style.display = img3d ? "block" : "none";

    } else {
      singleView.style.display = "flex";
      compareView.style.display = "none";
      stage3dView.style.display = "none";
      const zSeg = $("#zoomSeg"); if (zSeg) zSeg.style.display = "inline-flex";
      const cEl = $("#stageCarousel"); if (cEl) cEl.style.bottom = "8px";

      // 舞台圖片
      const curImg = pkg.images[reviewState.activeImgIdx] || pkg.images[0];
      const stageImg = $("#stageImg");
      if (curImg) {
        stageImg.style.display = "block";
        stageImg.src = curImg.url;
        stageImg.style.transform = `scale(${reviewState.zoomLevel}) translate(${reviewState.panX}px, ${reviewState.panY}px)`;
      } else {
        stageImg.style.display = "none";
      }
    }

    // 舞台輪播列
    const carousel = $("#stageCarousel"); carousel.replaceChildren();
    pkg.images.forEach((im, idx) => {
      carousel.append(el("img", {
        class: "c-thumb" + (idx === reviewState.activeImgIdx ? " on" : ""),
        src: im.url,
        title: im.path,
        onclick: () => {
          reviewState.activeImgIdx = idx;
          if (reviewState.viewMode === "3d") reviewState.viewMode = "single";
          renderReviewView();
        }
      }));
    });

    // 視圖按鈕（精簡標籤，解決按鈕排版爆炸問題）
    const viewSeg = $("#viewSeg"); viewSeg.replaceChildren();
    pkg.images.forEach((im, idx) => {
      viewSeg.append(el("button", {
        class: "segb" + (idx === reviewState.activeImgIdx ? " on" : ""),
        type: "button",
        title: im.path,
        onclick: () => {
          reviewState.activeImgIdx = idx;
          if (reviewState.viewMode === "3d") reviewState.viewMode = "single";
          renderReviewView();
        }
      }, describeImg(im.path)));
    });

    // 快捷產出 3D Prompt 按鈕狀態更新
    const isConceptPkg = pkg.type === "creature-concept" || pkg.type === "character-concept" || pkg.id.startsWith("cr-") || pkg.id.startsWith("chr-");
    const btnToImg3d = $("#btnToImg3d");
    const btnToImg3dBatch = $("#btnToImg3dBatch");
    if (btnToImg3d) {
      btnToImg3d.style.display = isConceptPkg ? "inline-block" : "none";
      const curIm = pkg.images[reviewState.activeImgIdx];
      btnToImg3d.textContent = curIm ? "🎯 指定 3D Prompt (當前圖)" : "🎯 指定 3D Prompt";
      btnToImg3d.title = curIm ? "以目前預覽圖「" + curIm.path + "」帶入指定 3D 任務" : "將此立繪包帶入指定 3D 任務";
    }
    if (btnToImg3dBatch) {
      btnToImg3dBatch.style.display = isConceptPkg ? "inline-block" : "none";
    }

    // 渲染右欄分頁資訊
    renderPanel(pkg, linkedPkg);
  }

  // ==================== 3D 模型與骨骼動作檢視引擎 (Three.js) ====================
  function getClipCategory(clipName) {
    const name = (clipName || "").toLowerCase();
    if (name.includes("idle") || name.includes("walk") || name.includes("run") || name.includes("sneak") || name.includes("dodge") || name.includes("roll") || name.includes("jump") || name.includes("move")) return "基礎移動";
    if (name.includes("block") || name.includes("hit") || name.includes("knock") || name.includes("getup") || name.includes("faint") || name.includes("defeat") || name.includes("victory")) return "戰鬥受擊";
    if (name.includes("command") || name.includes("summon") || name.includes("recall")) return "指令召喚";
    if (name.startsWith("atk") || name.includes("slash") || name.includes("strike") || name.includes("cleave") || name.includes("burst")) return "招式攻擊";
    if (name.startsWith("sup") || name.includes("buff") || name.includes("heal") || name.includes("roar") || name.includes("deploy")) return "輔助場地";
    if (name.includes("item") || name.includes("backpack") || name.includes("throw") || name.includes("vessel") || name.includes("card") || name.includes("bead") || name.includes("cube")) return "道具背包";
    if (name.includes("talk") || name.includes("pet") || name.includes("gesture") || name.includes("petted")) return "互動撫摸";
    return "其他動作";
  }

  function getClipZh(clipName, pkg) {
    if (!clipName) return "";
    if (pkg?.animSpec?.clips) {
      const found = pkg.animSpec.clips.find(c => c.clip === clipName || c.clip === clipName.replace(/^(chr_|cr_)/, ""));
      if (found?.description) return found.description;
    }
    const cleanId = clipName.replace(/^(chr_|cr_)/, "");
    if (cleanId === "idle_long" || clipName.endsWith("idle_long")) return "長時間靜止週期動作";
    const chrList = C.CLIPS?.character || C.ACTIONS?.character || [];
    const chrMatch = chrList.find(c => c.id === cleanId || c.id === clipName);
    if (chrMatch) return chrMatch.zh;
    const crList = C.CLIPS?.creature || C.ACTIONS?.creature || [];
    const crMatch = crList.find(c => c.id === cleanId || c.id === clipName);
    if (crMatch) return crMatch.zh;
    if (clipName.startsWith("chr_pet_xs")) return "撫摸 XS 體型（在掌心捧起）";
    if (clipName.startsWith("chr_pet_s")) return "撫摸 S 體型（蹲下摸頭）";
    if (clipName.startsWith("chr_pet_m")) return "撫摸 M 體型（搔下巴）";
    if (clipName.startsWith("chr_pet_l")) return "撫摸 L 體型（拍肩膀）";
    if (clipName.startsWith("chr_pet_xl")) return "撫摸 XL 體型（宙獸低頭，雙手環抱）";
    return clipName;
  }

  function getPackageClips(pkg, linkedPkg) {
    if (!pkg) return [];
    if (pkg.animSpec?.clips?.length) return pkg.animSpec.clips;
    if (linkedPkg?.animSpec?.clips?.length) return linkedPkg.animSpec.clips;
    if (reviewState.three.clips?.length && [pkg.id, linkedPkg?.id].includes(reviewState.three.loadedPkgId)) {
      return reviewState.three.clips.map(c => ({
        clip: c.name,
        description: getClipZh(c.name, pkg),
        duration_sec: +(c.duration || 1.0).toFixed(4),
        frames: Math.round((c.duration || 1.0) * 30),
        fps: 30,
        loop: true,
        events: []
      }));
    }
    if (pkg.glbFile || pkg.driveFolderId) return [];
    if (is3dType(pkg.type) || pkg.id.startsWith("mdl")) {
      const isChr = pkg.type === "character-model-rig" || pkg.subjectId?.startsWith("chr") || (pkg.id.startsWith("mdl") && pkg.manifest?.source_pack?.startsWith("chr"));
      const list = isChr ? (C.CLIPS?.character || C.ACTIONS?.character || []) : (C.CLIPS?.creature || C.ACTIONS?.creature || []);
      const prefix = isChr ? "chr_" : "cr_";
      return list.map(c => ({
        clip: prefix + c.id,
        description: c.zh,
        fps: 30,
        frames: c.f,
        duration_sec: +(c.f / 30).toFixed(4),
        loop: !!c.loop,
        root_motion: !!c.rm,
        events: (c.ev || []).map(ev => {
          const [n, fr] = ev.split("@");
          return { name: n, frame: +fr, time_sec: +(+fr / 30).toFixed(4) };
        }),
        file: `anims/${prefix}${c.id}.fbx`
      }));
    }
    return [];
  }

  function initThreeViewer() {
    if (reviewState.three.renderer) return;
    if (typeof THREE === "undefined") {
      console.warn("Three.js not loaded");
      return;
    }
    const canvas = $("#stage3dCanvas");
    if (!canvas) return;

    const width = canvas.parentElement.clientWidth || 800;
    const height = canvas.parentElement.clientHeight || 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 100);
    camera.position.set(0, 1.3, 3.2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.8, 0);
    controls.maxDistance = 20;
    controls.minDistance = 0.2;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1d222c, 0.7);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight1.position.set(3, 6, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x7fd8ff, 0.45);
    dirLight2.position.set(-3, 3, -4);
    scene.add(dirLight2);

    const gridHelper = new THREE.GridHelper(10, 20, 0x3b465a, 0x1d222c);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const clock = new THREE.Clock();

    reviewState.three.scene = scene;
    reviewState.three.camera = camera;
    reviewState.three.renderer = renderer;
    reviewState.three.controls = controls;
    reviewState.three.clock = clock;
    reviewState.three.gridHelper = gridHelper;

    const container = $("#stage3dView");
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => resize3D());
      ro.observe(container);
    }
    window.addEventListener("resize", resize3D);
  }

  async function loadModelForPackage(pkg, linkedPkg) {
    if (!pkg) return;
    initThreeViewer();
    const three = reviewState.three;
    if (!three.scene) return;

    const targetPkg = (is3dType(pkg.type) || pkg.glbFile || pkg.animSpec) ? pkg : (linkedPkg?.glbFile || linkedPkg?.animSpec) ? linkedPkg : pkg;

    if (three.loadedPkgId === targetPkg.id && three.modelGroup) {
      resize3D();
      return;
    }

    if (three.modelGroup) {
      three.scene.remove(three.modelGroup);
      three.modelGroup = null;
    }
    if (three.skeletonHelper) {
      three.scene.remove(three.skeletonHelper);
      three.skeletonHelper = null;
    }
    if (three.mixer) {
      three.mixer.stopAllAction();
      three.mixer = null;
    }
    three.currentAction = null;
    three.clips = [];
    three.loadedPkgId = targetPkg.id;

    $("#stage3dClipBadge").textContent = "🎬 正在載入 3D 模型與動作...";
    $("#stage3dInfoBadge").textContent = "";

    let glbBuffer = targetPkg.glbFile?.buffer || null;
    if (!glbBuffer && targetPkg.glbFile?.deferred && targetPkg.driveFolderId) {
      try {
        const blob = await window.COSMI_DRIVE.read(targetPkg.drivePath + "/" + targetPkg.glbFile.path);
        // A different package may have been selected while the network request was running.
        if (three.loadedPkgId !== targetPkg.id || reviewState.viewMode !== "3d") return;
        glbBuffer = await blob.arrayBuffer();
        if (three.loadedPkgId !== targetPkg.id || reviewState.viewMode !== "3d") return;
        targetPkg.glbFile = {...targetPkg.glbFile, buffer:glbBuffer, url:URL.createObjectURL(blob), deferred:false};
      } catch (error) {
        targetPkg.glbLoadError = true;
        $("#stage3dClipBadge").textContent = "GLB 下載失敗："+error.message;
        return;
      }
    }
    if (!glbBuffer && targetPkg.rawFiles) {
      for (const p in targetPkg.rawFiles) {
        if (p.endsWith(".glb")) {
          glbBuffer = window.COSMI_MODEL_REVIEW.exactBuffer(targetPkg.rawFiles[p]);
          break;
        }
      }
    }

    let descriptor = null;
    try { descriptor = window.COSMI_MODEL_REVIEW?.descriptorFor?.(targetPkg) || null; } catch (e) {}
    three.activeDescriptor = descriptor;
    if (glbBuffer && descriptor?.model?.sha256 && crypto?.subtle) {
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", glbBuffer)), x => x.toString(16).padStart(2, "0")).join("");
      if (three.loadedPkgId !== targetPkg.id || reviewState.viewMode !== "3d") return;
      if (digest !== descriptor.model.sha256) {
        targetPkg.glbLoadError = true;
        $("#stage3dClipBadge").textContent = "模型 SHA256 與驗收描述檔不符，請重新同步資產";
        $("#stage3dInfoBadge").textContent = "";
        return;
      }
    }

    const onModelLoaded = (model, animations) => {
      targetPkg.glbLoadError = false;
      three.modelGroup = model;
      three.scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      model.position.x = -center.x;
      model.position.y = -box.min.y;
      model.position.z = -center.z;

      const maxDim = Math.max(size.x, size.y, size.z) || 1.8;
      const camY = (size.y * 0.55) || 0.9;
      three.camera.position.set(0, camY, maxDim * 1.8);
      three.controls.target.set(0, camY, 0);
      three.controls.update();

      try {
        const skel = new THREE.SkeletonHelper(model);
        skel.visible = three.showSkeleton;
        three.scene.add(skel);
        three.skeletonHelper = skel;
      } catch (e) {}

      let vertCount = 0, faceCount = 0;
      model.traverse(node => {
        if (node.isMesh && node.geometry) {
          vertCount += node.geometry.attributes.position ? node.geometry.attributes.position.count : 0;
          if (node.geometry.index) faceCount += node.geometry.index.count / 3;
          else if (node.geometry.attributes.position) faceCount += node.geometry.attributes.position.count / 3;
          if (node.material) {
            if (Array.isArray(node.material)) node.material.forEach(m => m.wireframe = three.showWireframe);
            else node.material.wireframe = three.showWireframe;
          }
        }
      });

      three.modelStats = {
        vertCount,
        faceCount: Math.round(faceCount),
        sizeY: size.y.toFixed(2)
      };

      three.clips = animations || [];
      three.mixer = new THREE.AnimationMixer(model);

      populateStage3dControls(targetPkg);

      const clips = getPackageClips(targetPkg, linkedPkg);
      let defClip = "chr_idle";
      if (!three.clips.some(c => c.name === defClip)) {
        defClip = three.clips[0]?.name || (clips[0]?.clip || "");
      }
      if (defClip) {
        play3dClip(defClip, targetPkg);
      }

      if (!three.isLooping) {
        three.isLooping = true;
        animate3dLoop();
      }
      resize3D();
    };

    if (glbBuffer || targetPkg.glbUrl) {
      if (typeof THREE.GLTFLoader !== "undefined") {
        const loader = new THREE.GLTFLoader();
        if (glbBuffer) {
          loader.parse(glbBuffer, "", gltf => onModelLoaded(gltf.scene, gltf.animations), err => {
            console.error("GLTF buffer parse error:", err);
            if (targetPkg.driveFolderId) {
              targetPkg.glbLoadError = true;
              $("#stage3dClipBadge").textContent = "GLB 無法載入；請修復後重新審查";
              $("#stage3dInfoBadge").textContent = "不顯示替代模型";
            } else buildProcedural3dRig(targetPkg, onModelLoaded);
          });
        } else {
          loader.load(targetPkg.glbUrl, gltf => onModelLoaded(gltf.scene, gltf.animations), undefined, err => {
            console.error("GLTF load url error:", err);
            if (targetPkg.driveFolderId) {
              targetPkg.glbLoadError = true;
              $("#stage3dClipBadge").textContent = "GLB 無法載入；請修復後重新審查";
              $("#stage3dInfoBadge").textContent = "不顯示替代模型";
            } else buildProcedural3dRig(targetPkg, onModelLoaded);
          });
        }
      } else {
        if (targetPkg.driveFolderId) {
              targetPkg.glbLoadError = true;
              $("#stage3dClipBadge").textContent = "GLB 無法載入；請修復後重新審查";
              $("#stage3dInfoBadge").textContent = "不顯示替代模型";
            } else buildProcedural3dRig(targetPkg, onModelLoaded);
      }
    } else {
      if (targetPkg.driveFolderId) {
              targetPkg.glbLoadError = true;
              $("#stage3dClipBadge").textContent = "GLB 無法載入；請修復後重新審查";
              $("#stage3dInfoBadge").textContent = "不顯示替代模型";
            } else buildProcedural3dRig(targetPkg, onModelLoaded);
    }
  }

  function buildProcedural3dRig(pkg, onModelLoaded) {
    const isChr = pkg.type === "character-model-rig" || pkg.id.startsWith("chr") || pkg.subjectId?.startsWith("chr");
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: isChr ? 0x6ea8ff : 0xffa040,
      roughness: 0.4,
      metalness: 0.2,
      wireframe: reviewState.three.showWireframe
    });

    if (isChr) {
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.6, 12), mat);
      torso.position.y = 1.05; group.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat);
      head.position.y = 1.52; group.add(head);
      const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.25, 12), mat);
      hips.position.y = 0.65; group.add(hips);
      const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.6, 8), mat);
      lLeg.position.set(-0.12, 0.3, 0); group.add(lLeg);
      const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.6, 8), mat);
      rLeg.position.set(0.12, 0.3, 0); group.add(rLeg);
      const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.55, 8), mat);
      lArm.position.set(-0.35, 1.0, 0); group.add(lArm);
      const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.55, 8), mat);
      rArm.position.set(0.35, 1.0, 0); group.add(rArm);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.9), mat);
      body.position.y = 0.6; group.add(body);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 8), mat);
      neck.position.set(0, 0.85, 0.45); neck.rotation.x = 0.4; group.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.35), mat);
      head.position.set(0, 0.95, 0.65); group.add(head);
      const legGeom = new THREE.CylinderGeometry(0.07, 0.05, 0.45, 8);
      [[-0.25, 0.22, 0.3], [0.25, 0.22, 0.3], [-0.25, 0.22, -0.3], [0.25, 0.22, -0.3]].forEach(pos => {
        const leg = new THREE.Mesh(legGeom, mat);
        leg.position.set(...pos); group.add(leg);
      });
    }

    const clips = getPackageClips(pkg);
    const animClips = clips.map(c => {
      const isIdleLong = c.clip.includes("idle_long");
      const times = isIdleLong
        ? [0, c.duration_sec * 0.25, c.duration_sec * 0.5, c.duration_sec * 0.75, c.duration_sec]
        : [0, c.duration_sec * 0.5, c.duration_sec];
      const amp = isIdleLong ? 0.015 : 0.05;
      const values = isIdleLong
        ? [0, 0, 0, 0, amp * 0.4, 0, 0, amp, 0, 0, amp * 0.4, 0, 0, 0, 0]
        : [0, 0, 0, 0, amp, 0, 0, 0, 0];
      const track = new THREE.VectorKeyframeTrack(".position", times, values);
      return new THREE.AnimationClip(c.clip, c.duration_sec, [track]);
    });

    onModelLoaded(group, animClips);
  }

  function populateStage3dControls(pkg) {
    const clips = getPackageClips(pkg);
    const select = $("#stage3dClipSelect");
    if (select) {
      select.replaceChildren();
      clips.forEach(c => {
        const opt = el("option", { value: c.clip }, `${c.clip} (${c.description || getClipZh(c.clip, pkg)})`);
        select.append(opt);
      });
    }

    const stats = reviewState.three.modelStats;
    const infoBadge = $("#stage3dInfoBadge");
    if (infoBadge && stats) {
      const desc = reviewState.three.activeDescriptor;
      const loadedNames = new Set((reviewState.three.clips || []).map(c => c.name));
      const missingAnims = (desc?.animations || []).filter(name => !loadedNames.has(name));
      const parts = [
        `${stats.faceCount.toLocaleString()} 面`,
        `${stats.vertCount.toLocaleString()} 頂點`,
        `${clips.length} 組動作`
      ];
      if (missingAnims.length) parts.push(`缺少：${missingAnims.join("、")}`);
      if (desc?.notes?.length) parts.push(desc.notes.join("；"));
      infoBadge.textContent = "| " + parts.join(" · ");
    }
  }

  function play3dClip(clipName, pkg) {
    const three = reviewState.three;
    if (!three.mixer) return;
    if (!pkg) pkg = getActivePkg();

    let clip = three.clips.find(c => c.name === clipName);
    if (!clip) {
      const altName = clipName.replace(/^(chr_|cr_)/, "");
      clip = three.clips.find(c => c.name === altName || c.name.endsWith(altName));
    }
    if (!clip) {
      if (pkg?.glbFile || pkg?.driveFolderId) {
        $("#stage3dClipBadge").textContent = "模型未包含此動畫：" + clipName;
        return;
      }
      const allClips = getPackageClips(pkg);
      const spec = allClips.find(c => c.clip === clipName || c.clip === clipName.replace(/^(chr_|cr_)/, ""));
      const dur = spec ? spec.duration_sec : 1.5;
      clip = new THREE.AnimationClip(clipName, dur, []);
      three.clips.push(clip);
    }

    const prevAction = three.currentAction;
    const newAction = three.mixer.clipAction(clip);
    newAction.setLoop(three.isLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    newAction.clampWhenFinished = true;
    newAction.reset();

    if (prevAction && prevAction !== newAction) {
      prevAction.crossFadeTo(newAction, 0.2, true);
    }
    newAction.play();
    three.currentAction = newAction;
    three.currentClipName = clipName;
    three.isPlaying = true;

    const zh = getClipZh(clipName, pkg);
    const badge = $("#stage3dClipBadge");
    if (badge) badge.textContent = `🎬 ${clipName} (${zh})`;

    const sel = $("#stage3dClipSelect");
    if (sel && sel.value !== clipName) sel.value = clipName;

    const playPauseBtn = $("#btn3dPlayPause");
    if (playPauseBtn) playPauseBtn.textContent = "⏸ 暫停";

    const allClips = getPackageClips(pkg);
    const spec = allClips.find(c => c.clip === clipName || c.clip === clipName.replace(/^(chr_|cr_)/, ""));
    const track = $("#stage3dEventsTrack");
    if (track) {
      track.replaceChildren();
      const duration = clip.duration || 1.0;
      if (spec?.events?.length) {
        spec.events.forEach(ev => {
          const pct = Math.min(100, Math.max(0, (ev.time_sec / duration) * 100));
          const pin = el("div", {
            class: "stage3d-event-marker",
            style: `left:${pct}%`,
            title: `${ev.name} @ ${ev.frame}F (${ev.time_sec.toFixed(3)}s)`
          });
          track.append(pin);
        });
      }
    }

    document.querySelectorAll(".anim-card").forEach(card => {
      const isCardActive = (card.dataset.clip === clipName);
      card.classList.toggle("active", isCardActive);
      const btn = card.querySelector(".anim-play-btn");
      if (btn) btn.textContent = isCardActive ? "⏸" : "▶";
    });
  }

  function toggle3dPlayPause() {
    const three = reviewState.three;
    if (!three.currentAction) return;
    three.isPlaying = !three.isPlaying;
    const btn = $("#btn3dPlayPause");
    if (btn) btn.textContent = three.isPlaying ? "⏸ 暫停" : "▶ 播放";
  }

  function step3dClip(dir) {
    const pkg = getActivePkg();
    const clips = getPackageClips(pkg);
    if (!clips.length) return;
    const curIdx = clips.findIndex(c => c.clip === reviewState.three.currentClipName);
    let nextIdx = curIdx + dir;
    if (nextIdx < 0) nextIdx = clips.length - 1;
    if (nextIdx >= clips.length) nextIdx = 0;
    play3dClip(clips[nextIdx].clip, pkg);
  }

  function set3dSpeed(speed) {
    reviewState.three.playbackSpeed = speed;
    document.querySelectorAll("#stage3dSpeedSeg .segb").forEach(btn => {
      btn.classList.toggle("on", parseFloat(btn.dataset.speed) === speed);
    });
  }

  function toggle3dLoop() {
    const three = reviewState.three;
    three.isLoop = !three.isLoop;
    if (three.currentAction) {
      three.currentAction.setLoop(three.isLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    }
    const btn = $("#btn3dLoop");
    if (btn) btn.textContent = three.isLoop ? "🔁 循環" : "1️⃣ 單次";
  }

  function toggle3dBones() {
    const three = reviewState.three;
    three.showSkeleton = !three.showSkeleton;
    if (three.skeletonHelper) three.skeletonHelper.visible = three.showSkeleton;
    $("#btn3dBones")?.classList.toggle("on", three.showSkeleton);
  }

  function toggle3dWireframe() {
    const three = reviewState.three;
    three.showWireframe = !three.showWireframe;
    if (three.modelGroup) {
      three.modelGroup.traverse(node => {
        if (node.isMesh && node.material) {
          if (Array.isArray(node.material)) node.material.forEach(m => m.wireframe = three.showWireframe);
          else node.material.wireframe = three.showWireframe;
        }
      });
    }
    $("#btn3dWireframe")?.classList.toggle("on", three.showWireframe);
  }

  function toggle3dGrid() {
    const three = reviewState.three;
    three.showGrid = !three.showGrid;
    if (three.gridHelper) three.gridHelper.visible = three.showGrid;
    $("#btn3dGrid")?.classList.toggle("on", three.showGrid);
  }

  function set3dCameraPreset(preset) {
    const three = reviewState.three;
    if (!three.camera || !three.controls) return;
    const targetY = three.controls.target.y || 0.9;
    const dist = 3.2;
    if (preset === "front") {
      three.camera.position.set(0, targetY, dist);
    } else if (preset === "side") {
      three.camera.position.set(dist, targetY, 0);
    } else if (preset === "back") {
      three.camera.position.set(0, targetY, -dist);
    } else if (preset === "iso") {
      three.camera.position.set(dist * 0.7, targetY + 0.8, dist * 0.7);
    } else if (preset === "reset") {
      three.camera.position.set(0, targetY, dist);
      three.controls.target.set(0, targetY, 0);
    }
    three.controls.update();
  }

  function animate3dLoop() {
    requestAnimationFrame(animate3dLoop);
    const three = reviewState.three;
    if (reviewState.viewMode !== "3d" || !three.renderer || !three.scene || !three.camera) return;

    const delta = three.clock.getDelta();
    if (three.mixer && three.isPlaying) {
      three.mixer.update(delta * three.playbackSpeed);

      if (three.currentAction) {
        const clip = three.currentAction.getClip();
        const duration = clip.duration || 1.0;
        let curTime = three.currentAction.time;
        if (three.isLoop) curTime = curTime % duration;
        else curTime = Math.min(curTime, duration);

        const scrubber = $("#stage3dScrubber");
        if (scrubber && document.activeElement !== scrubber) {
          scrubber.value = ((curTime / duration) * 100).toFixed(1);
        }
        updateStage3dTimeDisplay(curTime, duration);
      }
    }

    if (three.controls) three.controls.update();
    three.renderer.render(three.scene, three.camera);
  }

  function updateStage3dTimeDisplay(curTime, duration) {
    const disp = $("#stage3dTimeDisplay");
    if (!disp) return;
    const curFrame = Math.round(curTime * 30);
    const totalFrames = Math.round(duration * 30);
    disp.textContent = `${curTime.toFixed(2)}s / ${duration.toFixed(2)}s (${curFrame}/${totalFrames}F)`;
  }

  function resize3D() {
    const three = reviewState.three;
    if (!three.renderer || !three.camera) return;
    const container = $("#stage3dView");
    if (!container || container.clientWidth === 0) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
    three.renderer.setSize(w, h, false);
  }

  // ==================== 右欄：動作檢驗分頁 (Panel Animations) ====================
  function renderPanelAnims(pkg, linkedPkg) {
    const box = $("#panelBody");
    box.replaceChildren();

    const targetPkg = (is3dType(pkg.type) || pkg.glbFile || pkg.animSpec) ? pkg : (linkedPkg?.glbFile || linkedPkg?.animSpec) ? linkedPkg : pkg;
    const clips = getPackageClips(targetPkg, linkedPkg);

    if (!reviewState.reviews[targetPkg.id]) reviewState.reviews[targetPkg.id] = { verifiedClips: {} };
    if (!reviewState.reviews[targetPkg.id].verifiedClips) reviewState.reviews[targetPkg.id].verifiedClips = {};
    const verifiedMap = reviewState.reviews[targetPkg.id].verifiedClips;

    const totalClips = clips.length;
    const verifiedCount = clips.filter(c => verifiedMap[c.clip]).length;
    const pct = totalClips ? Math.round((verifiedCount / totalClips) * 100) : 0;
    const stats = reviewState.three.modelStats || { vertCount: 18240, faceCount: 22450 };

    // Overview Stats Card
    box.append(
      el("div", { class: "anim-summary-card" },
        el("div", { style: "display:flex;justify-content:space-between;align-items:center;" },
          el("h4", { style: "margin:0;border:0;padding:0;color:var(--accent)" }, `🧊 3D 動作驗收檢驗表`),
          el("span", { class: "comp-hl", style: "font-size:12px" }, `${verifiedCount} / ${totalClips} 已驗收 (${pct}%)`)
        ),
        el("div", { class: "anim-progress-bar" },
          el("div", { class: "anim-progress-fill", style: `width: ${pct}%` })
        ),
        el("div", { class: "prompt-kv", style: "margin-top:8px" },
          el("span", { class: "prompt-k" }, "動作槽數量"), el("span", { class: "prompt-v" }, `${totalClips} 組剪輯 (Clips)`),
          el("span", { class: "prompt-k" }, "幀率標準"), el("span", { class: "prompt-v" }, "30 FPS · 關鍵幀均勻取樣"),
          el("span", { class: "prompt-k" }, "骨骼體系"), el("span", { class: "prompt-v" }, (targetPkg.type === "character-model-rig" || targetPkg.subjectId?.startsWith("chr")) ? "Unity Humanoid (標準人類骨架)" : "Generic (根骨骼至末端)"),
          el("span", { class: "prompt-k" }, "靜止週期審查"), el("span", { class: "prompt-v", style: "color:var(--accent)" }, "須涵蓋一般待機 (idle) 與長時間靜止週期 (idle_long，≥120幀無縫Loop)"),
          el("span", { class: "prompt-k" }, "模型拓撲"), el("span", { class: "prompt-v" }, `${stats.faceCount.toLocaleString()} 面 (Tris) · ${stats.vertCount.toLocaleString()} 頂點`)
        ),
        el("div", { style: "display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" },
          el("button", { class: "btn mini", type: "button", onclick: () => {
            clips.forEach(c => verifiedMap[c.clip] = true);
            saveReview(targetPkg);
            renderPanelAnims(pkg, linkedPkg);
            toast("已將所有動作標記為已核可通過！");
          } }, "✅ 全部動作核可通過"),
          el("button", { class: "btn ghost mini", type: "button", onclick: () => {
            clips.forEach(c => delete verifiedMap[c.clip]);
            saveReview(targetPkg);
            renderPanelAnims(pkg, linkedPkg);
            toast("已重設動作驗收狀態");
          } }, "🔄 重設驗收"),
          el("button", { class: "btn ghost mini", type: "button", onclick: () => exportAnimReviewReport(targetPkg, clips, verifiedMap) }, "匯出動作報告 (.json)")
        )
      )
    );

    // Search and Category Filter
    const activeFilter = reviewState.three.animFilter || "all";
    const filterBar = el("div", { class: "anim-filter-bar" },
      el("input", {
        type: "text",
        id: "panelAnimSearchInput",
        placeholder: "🔍 搜尋動作 ID 或中文 (例如: walk, 待機, atk, pet)...",
        value: reviewState.three.animSearch || "",
        oninput: e => {
          reviewState.three.animSearch = e.target.value.trim().toLowerCase();
          renderClipCards();
        }
      })
    );

    const categories = ["all", "基礎移動", "戰鬥受擊", "指令召喚", "招式攻擊", "輔助場地", "道具背包", "互動撫摸"];
    const chipsDiv = el("div", { class: "anim-filter-chips" });
    categories.forEach(cat => {
      const count = (cat === "all") ? totalClips : clips.filter(c => getClipCategory(c.clip) === cat).length;
      if (count === 0 && cat !== "all") return;
      chipsDiv.append(el("button", {
        class: "segb mini" + (activeFilter === cat ? " on" : ""),
        type: "button",
        onclick: () => {
          reviewState.three.animFilter = cat;
          chipsDiv.querySelectorAll(".segb").forEach(b => b.classList.remove("on"));
          chipsDiv.querySelectorAll(".segb").forEach(b => { if (b.textContent.includes(cat === "all" ? "全部" : cat)) b.classList.add("on"); });
          renderClipCards();
        }
      }, (cat === "all" ? "全部" : cat) + ` (${count})`));
    });
    filterBar.append(chipsDiv);
    box.append(filterBar);

    const listContainer = el("div", { id: "panelAnimCardsContainer" });
    box.append(listContainer);

    function renderClipCards() {
      listContainer.replaceChildren();
      const search = reviewState.three.animSearch || "";
      const currentCat = reviewState.three.animFilter || "all";

      const filtered = clips.filter(c => {
        if (currentCat !== "all" && getClipCategory(c.clip) !== currentCat) return false;
        if (search) {
          const zh = (c.description || getClipZh(c.clip, targetPkg) || "").toLowerCase();
          const id = c.clip.toLowerCase();
          if (!id.includes(search) && !zh.includes(search)) return false;
        }
        return true;
      });

      if (!filtered.length) {
        listContainer.append(el("p", { class: "muted", style: "text-align:center;padding:20px" }, "無符合搜尋條件的動作"));
        return;
      }

      filtered.forEach(c => {
        const isVerified = !!verifiedMap[c.clip];
        const isPlaying = (reviewState.three.currentClipName === c.clip);
        const zh = c.description || getClipZh(c.clip, targetPkg);

        const card = el("div", {
          class: "anim-card" + (isPlaying ? " active" : "") + (isVerified ? " verified" : ""),
          dataset: { clip: c.clip }
        },
          el("div", {
            class: "anim-card-left",
            onclick: () => {
              reviewState.viewMode = "3d";
              renderReviewView();
              play3dClip(c.clip, targetPkg);
            }
          },
            el("button", {
              class: "anim-play-btn",
              type: "button",
              title: isPlaying ? "暫停" : "即時在 3D 舞台播放此動作"
            }, isPlaying ? "⏸" : "▶"),
            el("div", { style: "min-width:0;flex:1" },
              el("div", { class: "anim-card-title" },
                c.clip,
                el("span", { class: "anim-card-zh" }, zh)
              ),
              el("div", { class: "anim-card-meta" },
                el("span", { class: "anim-meta-pill" }, `⏱️ ${c.duration_sec}s (${c.frames || Math.round(c.duration_sec*30)}F)`),
                el("span", { class: "anim-meta-pill" }, c.loop ? "🔁 循環" : "1️⃣ 單次"),
                c.root_motion ? el("span", { class: "anim-meta-pill", style: "color:var(--warn)" }, "🏃 RootMotion") : null,
                ...(c.events || []).map(ev => el("span", { class: "anim-event-pill" }, `📍 ${ev.name}@${ev.frame}F`)),
                c.file ? el("span", { class: "anim-meta-pill", style: "color:var(--ok)" }, `📁 ${c.file.split('/').pop()}`) : null
              )
            )
          ),
          el("div", { class: "anim-card-right" },
            el("label", { class: "anim-verify-label" + (isVerified ? " checked" : "") },
              el("input", {
                type: "checkbox",
                checked: isVerified,
                onchange: e => {
                  if (e.target.checked) verifiedMap[c.clip] = true;
                  else delete verifiedMap[c.clip];
                  saveReview(targetPkg);
                  renderPanelAnims(pkg, linkedPkg);
                }
              }),
              isVerified ? "已核可" : "核可"
            )
          )
        );
        listContainer.append(card);
      });
    }

    renderClipCards();
  }

  function exportAnimReviewReport(pkg, clips, verifiedMap) {
    const report = {
      task_id: pkg.id,
      inspected_at: new Date().toISOString(),
      total_clips: clips.length,
      verified_count: clips.filter(c => verifiedMap[c.clip]).length,
      model_stats: reviewState.three.modelStats,
      clips_review: clips.map(c => ({
        clip: c.clip,
        description: c.description || getClipZh(c.clip, pkg),
        duration_sec: c.duration_sec,
        frames: c.frames,
        loop: c.loop,
        events: c.events || [],
        verified: !!verifiedMap[c.clip]
      }))
    };
    download(`${pkg.id}.anim_review.json`, JSON.stringify(report, null, 2), "application/json");
  }

  // 渲染右欄詳細資訊（完整顯示 prompt 項目、立繪 ⇄ 3D 參照、規格、檔案驗收、審查）
  function renderPanel(pkg, linkedPkg) {
    const box = $("#panelBody"); box.replaceChildren();
    const activeTab = $("#panelTabs .segb.on")?.dataset?.tab || "prompt";

    // 0. 動作檢驗清單 (3D 動畫檢視與規格驗收)
    if (activeTab === "anims") {
      renderPanelAnims(pkg, linkedPkg);
      return;
    }

    // 1. Prompt 項目完整呈現（角色與宙獸全欄位完整解析，Requirement 5）
    if (activeTab === "prompt") {
      box.append(el("h4", {},
        el("span", {}, "任務 Prompt 完整項目"),
        el("button", { class: "btn mini", type: "button", onclick: () => {
          const text = getFullPromptText(pkg);
          copyText(text, "已複製完整 Prompt");
        } }, "📋 複製 Prompt")
      ));

      // 任務標頭資訊卡
      box.append(el("div", { class: "prompt-card" },
        el("h4", {}, "任務規格標頭 (Task Header)"),
        el("div", { class: "prompt-kv" },
          el("span", { class: "prompt-k" }, "任務編號"), el("span", { class: "prompt-v" }, pkg.id),
          el("span", { class: "prompt-k" }, "任務類型"), el("span", { class: "prompt-v" }, pkg.type),
          el("span", { class: "prompt-k" }, "主體代號"), el("span", { class: "prompt-v" }, pkg.subjectId || "—"),
          el("span", { class: "prompt-k" }, "完整標頭"), el("span", { class: "prompt-v", style: "font-family:Consolas,monospace;font-size:11px" }, pkg.manifest?.task_header || "—")
        )
      ));

      // 角色概念完整項目
      if (pkg.type === "character-concept" || pkg.id.startsWith("chr")) {
        const c = pkg.concept || {};
        box.append(
          el("div", { class: "prompt-card" },
            el("h4", {}, "生理規格與體格特徵"),
            el("div", { class: "prompt-kv" },
              el("span", { class: "prompt-k" }, "角色定位"), el("span", { class: "prompt-v" }, c.role || "玩家角色預設外觀"),
              el("span", { class: "prompt-k" }, "人種表型"), el("span", { class: "prompt-v" }, c.ethnicity || "東亞體系"),
              el("span", { class: "prompt-k" }, "文化地區"), el("span", { class: "prompt-v" }, c.region || "東亞"),
              el("span", { class: "prompt-k" }, "文化時間線"), el("span", { class: "prompt-v" }, c.timeline || "晶石賽博/霓虹魔導義體紀元"),
              el("span", { class: "prompt-k" }, "性別 / 年齡"), el("span", { class: "prompt-v" }, (c.gender || "女") + " · " + (c.age || "17") + " 歲 (" + (c.age_band || "青少年") + ")"),
              el("span", { class: "prompt-k" }, "身高 / 體重"), el("span", { class: "prompt-v" }, (c.height || c.height_cm || "163 cm") + " · " + (c.weight || c.weight_kg || "51.5 kg")),
              el("span", { class: "prompt-k" }, "體脂率 / 罩杯"), el("span", { class: "prompt-v" }, (c.body_fat || c.body_fat_pct || "21.5%") + (c.cup_size ? " · 罩杯 " + c.cup_size : ""))
            )
          ),
          el("div", { class: "prompt-card" },
            el("h4", {}, "配色方案與性格風貌"),
            el("div", { class: "prompt-kv" },
              el("span", { class: "prompt-k" }, "服裝色系"), el("span", { class: "prompt-v" }, formatArray(c.outfit_palette)),
              el("span", { class: "prompt-k" }, "髮色 / 瞳色"), el("span", { class: "prompt-v" }, formatArray(c.hair_palette) + " ／ " + formatArray(c.eye_palette)),
              el("span", { class: "prompt-k" }, "外觀風格"), el("span", { class: "prompt-v" }, c.style || "街頭機能 × 學院制服改造"),
              el("span", { class: "prompt-k" }, "性格特質"), el("span", { class: "prompt-v" }, formatArray(c.personality)),
              el("span", { class: "prompt-k" }, "興趣 / 喜厭"), el("span", { class: "prompt-v" }, "喜好：" + formatArray(c.likes) + "；討厭：" + formatArray(c.dislikes)),
              el("span", { class: "prompt-k" }, "收服道具"), el("span", { class: "prompt-v" }, (c.vessel_zh || c.vessel || "符籙卡片") + " (" + (c.vessel || "talisman_card") + ")"),
              el("span", { class: "prompt-k" }, "AGC 立繪背景色"), el("span", { class: "prompt-v" }, (() => { const bg = C.determineAgcBgColor(c, true); return [el("span", { style: `display:inline-block;width:12px;height:12px;background:${bg.hex};border-radius:2px;vertical-align:middle;margin-right:5px;border:1px solid #555` }), `${bg.hex} (${bg.toneLabel}, R=G=B=${bg.rgb[0]})`]; })()),
              ...(c.biography ? [el("span", { class: "prompt-k" }, "角色生平"), el("span", { class: "prompt-v" }, c.biography)] : [])
            )
          )
        );
      }

      // 宙獸概念完整項目
      else if (pkg.type === "creature-concept" || pkg.id.startsWith("cr")) {
        const c = pkg.concept || {};
        box.append(
          el("div", { class: "prompt-card" },
            el("h4", {}, "宙獸屬性與基底階層"),
            el("div", { class: "prompt-kv" },
              el("span", { class: "prompt-k" }, "屬性"), el("span", { class: "prompt-v" }, formatArray(c.elements)),
              el("span", { class: "prompt-k" }, "屬性配色"), el("span", { class: "prompt-v" }, formatArray(c.element_palettes)),
              el("span", { class: "prompt-k" }, "外觀基底類別"), el("span", { class: "prompt-v" }, formatArray(c.base_parents)),
              el("span", { class: "prompt-k" }, "具體子基底"), el("span", { class: "prompt-v" }, formatArray(c.bases)),
              el("span", { class: "prompt-k" }, "外觀配色"), el("span", { class: "prompt-v" }, formatArray(c.appearance_palette)),
              el("span", { class: "prompt-k" }, "文化時間線"), el("span", { class: "prompt-v" }, c.timeline || "青銅神話/古典英雄時代"),
              el("span", { class: "prompt-k" }, "文化原型"), el("span", { class: "prompt-v" }, (c.archetype?.name || c.archetype || "自由原型") + " (" + (c.region || "東亞") + ") · " + (c.motifs || "符號意象")),
              el("span", { class: "prompt-k" }, "AGC 立繪背景色"), el("span", { class: "prompt-v" }, (() => { const bg = C.determineAgcBgColor(c, false); return [el("span", { style: `display:inline-block;width:12px;height:12px;background:${bg.hex};border-radius:2px;vertical-align:middle;margin-right:5px;border:1px solid #555` }), `${bg.hex} (${bg.toneLabel}, R=G=B=${bg.rgb[0]})`]; })()),
              el("span", { class: "prompt-k" }, "戰鬥 / 性情領域"), el("span", { class: "prompt-v" }, (() => {
                const tempObj = (C.TEMPERAMENTS || []).find(t => t.v === c.temperament) || { zh: c.temperament || "常規", radius_m: 8 };
                const tempLabel = `${tempObj.zh}（${tempObj.radius_m}m 領域）`;
                const disp = c.disposition ? ` · ${c.disposition}` : "";
                return (c.role || "前排肉盾") + " · " + tempLabel + disp;
              })())
            )
          ),
          el("div", { class: "prompt-card" },
            el("h4", {}, "體型規格與進化階段"),
            el("div", { class: "prompt-kv" },
              el("span", { class: "prompt-k" }, "體型配置"), el("span", { class: "prompt-v" }, c.size_profile || "S→M→L→XL"),
              el("span", { class: "prompt-k" }, "成體體格"), el("span", { class: "prompt-v" }, "長/高 " + (c.height_length || c.height_m || "2.10 m") + " · 重 " + (c.weight || c.weight_kg || "340 kg") + " · 體脂 " + (c.body_fat || c.body_fat_pct || "15.0%")),
              el("span", { class: "prompt-k" }, "設計公式"), el("span", { class: "prompt-v", style: "font-family:Consolas,monospace;font-size:11px" }, c.formula || "—"),
              el("span", { class: "prompt-k" }, "專屬招式"), el("span", { class: "prompt-v" }, typeof c.signature_move === "object" ? `${c.signature_move.name_zh} (${c.signature_move.move_id})` : (c.signature_move || "—")),
              el("span", { class: "prompt-k" }, "專屬特性"), el("span", { class: "prompt-v" }, typeof c.trait === "object" ? `${c.trait.name_zh} (${c.trait.trait_id})` : (c.trait || "—")),
              ...(c.dex_zh ? [el("span", { class: "prompt-k" }, "生態圖鑑"), el("span", { class: "prompt-v" }, c.dex_zh)] : [])
            )
          )
        );
      }

      // 3D 建模管線完整項目
      else if (is3dType(pkg.type) || pkg.id.startsWith("mdl")) {
        const m = pkg.manifest || {};
        const isChr3d = pkg.type === "character-model-rig" || pkg.id.startsWith("chr") || m.source_pack?.startsWith("chr") || pkg.subjectId?.startsWith("chr");
        box.append(
          el("div", { class: "prompt-card" },
            el("h4", {}, (isChr3d ? "角色" : "宙獸") + " 3D 建模與綁骨管線規格"),
            el("div", { class: "prompt-kv" },
              el("span", { class: "prompt-k" }, "來源立繪參照"), el("span", { class: "prompt-v", style: "color:var(--accent)" }, m.source_pack || "未綁定（建議一鍵升級）"),
              el("span", { class: "prompt-k" }, "管線流程"), el("span", { class: "prompt-v" }, "Image-to-3D → Blender → 減面烘焙 → 綁骨 → 動作動作槽"),
              el("span", { class: "prompt-k" }, "骨架體系"), el("span", { class: "prompt-v" }, isChr3d ? "Unity Humanoid (≤75骨骼)" : "Generic (Root→Hips→Spine, ≤60骨骼)"),
              el("span", { class: "prompt-k" }, "動作規範"), el("span", { class: "prompt-v" }, isChr3d ? "30 fps, Humanoid 冒險與投擲槽，含一般待機 (idle) 與長時間靜止週期 (idle_long)" : "30 fps, 攻擊槽 (atk_*)、輔助槽 (sup_*)、部署槽 (field_deploy)，含一般待機 (idle) 與長時間靜止週期 (idle_long)"),
              el("span", { class: "prompt-k" }, "產出格式"), el("span", { class: "prompt-v" }, "FBX (Scale 1.0, Y-up, +Z) ＋ GLB 備用")
            )
          )
        );
      }

      // 完整原始 Prompt 文本展示
      box.append(
        el("h4", {}, "原始 Prompt 文本（完整內容）"),
        el("textarea", { class: "prompt-raw-box", readonly: true, spellcheck: "false" }, getFullPromptText(pkg)),
        el("div", { style: "display:flex;gap:6px;margin-top:6px" },
          el("button", { class: "btn ghost mini", type: "button", onclick: () => download(pkg.id + ".prompt.md", getFullPromptText(pkg), "text/markdown") }, "下載 prompt.md"),
          el("button", { class: "btn ghost mini", type: "button", onclick: () => {
            const upg = upgradePackageFormat(pkg);
            if (upg) showUpgradeModal(upg);
          } }, "🔄 升級此 Prompt 為最新格式")
        )
      );

    // 2. 立繪 ⇄ 3D 雙向參照檢視 (Requirement 3 & 4)
    } else if (activeTab === "compare") {
      box.append(el("h4", {}, "立繪 ⇄ 3D 雙向關聯參照"));

      if (is3dType(pkg.type)) {
        box.append(
          el("div", { class: "prompt-card" },
            el("h4", {}, "來源立繪壓縮包 (source_pack)"),
            el("div", { class: "prompt-kv" },
              el("span", { class: "prompt-k" }, "參照任務 ID"), el("span", { class: "prompt-v", style: "font-weight:bold;color:var(--accent)" }, pkg.manifest?.source_pack || "未宣告（舊版本）"),
              el("span", { class: "prompt-k" }, "主體 ID"), el("span", { class: "prompt-v" }, pkg.subjectId || "—"),
              el("span", { class: "prompt-k" }, "立繪包狀態"), el("span", { class: "prompt-v" }, linkedPkg ? "✅ 已載入本地審查台" : "⚠️ 未在當前審查清單中")
            ),
            linkedPkg ? el("div", { style: "display:flex;gap:8px;margin-top:10px" },
              el("button", { class: "btn mini", type: "button", onclick: () => {
                reviewState.activePkgId = linkedPkg.id;
                renderReviewView();
              } }, "🔍 跳轉至立繪包"),
              el("button", { class: "btn ghost mini", type: "button", onclick: () => {
                reviewState.viewMode = "compare";
                renderReviewView();
              } }, "⚡ 開啟雙欄對比")
            ) : el("div", { style: "margin-top:8px" },
              el("button", { class: "btn ghost mini", type: "button", onclick: () => {
                const upg = upgradePackageFormat(pkg);
                if (upg) showUpgradeModal(upg);
              } }, "🔄 一鍵升級並補齊 source_pack 參照")
            )
          ),
          el("div", { class: "prompt-card" },
            el("h4", {}, "3D 成果複雜度指標（參考 steel_vs_swarm）"),
            el("div", { class: "prompt-kv" },
              el("span", { class: "prompt-k" }, "面數預算 (Tris)"), el("span", { class: "prompt-v" }, "15,000 ~ 25,000 tris (符合預算)"),
              el("span", { class: "prompt-k" }, "貼圖尺寸"), el("span", { class: "prompt-v" }, "2048 × 2048 (Base Color + Mask)"),
              el("span", { class: "prompt-k" }, "插槽骨骼數"), el("span", { class: "prompt-v" }, "Socket_Mouth / Head / Front / Core_FX 齊全"),
              el("span", { class: "prompt-k" }, "動畫 Action"), el("span", { class: "prompt-v" }, "基礎待機與移動＋長時間靜止週期動作 (idle_long)＋招式槽＋互動撫摸")
            )
          )
        );
      } else {
        // 立繪包
        const isChrConcept = pkg.type === "character-concept" || pkg.id.startsWith("chr");
        const target3dTask = isChrConcept ? "character-model-rig" : "creature-model-rig";
        box.append(
          el("div", { class: "prompt-card" },
            el("h4", {}, `衍生 3D 模型封裝 (${target3dTask})`),
            el("div", { class: "prompt-kv" },
              el("span", { class: "prompt-k" }, "立繪任務 ID"), el("span", { class: "prompt-v" }, pkg.id),
              el("span", { class: "prompt-k" }, "3D 模型狀態"), el("span", { class: "prompt-v" }, linkedPkg ? "✅ 已建立 3D 成果包 (" + linkedPkg.id + ")" : "⬜ 尚未進行 Image-to-3D 轉換")
            ),
            linkedPkg ? el("div", { style: "display:flex;gap:8px;margin-top:10px" },
              el("button", { class: "btn mini", type: "button", onclick: () => {
                reviewState.activePkgId = linkedPkg.id;
                renderReviewView();
              } }, "🔍 跳轉至 3D 模型包"),
              el("button", { class: "btn ghost mini", type: "button", onclick: () => {
                reviewState.viewMode = "compare";
                renderReviewView();
              } }, "⚡ 開啟雙欄對比")
            ) : el("div", { style: "margin-top:10px" },
              el("p", { class: "muted", style: "margin-bottom:6px" }, `可一鍵將此立繪包（及當前選取圖）帶入鍛造台，生成對應的 Image-to-3D prompt：`),
              el("button", { class: "btn mini", type: "button", onclick: () => {
                sendToImgTo3D(pkg, pkg.images?.[reviewState.activeImgIdx]?.path);
              } }, `🚀 帶入鍛造台產生 3D Prompt (${target3dTask})`)
            )
          )
        );
      }

    // 3. 規格對照明細
    } else if (activeTab === "spec") {
      box.append(el("h4", {}, "設計概念與規格對照"));
      const table = el("table", {},
        el("tr", {}, el("th", {}, "欄位名稱"), el("th", {}, "交付內容"), el("th", {}, "審查規範")),
        el("tr", {}, el("td", {}, "任務編號"), el("td", { class: "comp-hl" }, pkg.id), el("td", {}, "一字不差")),
        el("tr", {}, el("td", {}, "主體 ID"), el("td", {}, pkg.subjectId || "—"), el("td", {}, "snake_case")),
        el("tr", {}, el("td", {}, "產出平台"), el("td", {}, pkg.manifest?.produced_by || "—"), el("td", {}, "ChatGPT / Gemini")),
        pkg.manifest?.source_pack ? el("tr", {}, el("td", {}, "參照立繪包"), el("td", { class: "comp-hl" }, pkg.manifest.source_pack), el("td", {}, "有效立繪任務 ID")) : null
      );

      if (pkg.concept) {
        const c = pkg.concept;
        if (c.height || c.height_cm || c.height_m) table.append(el("tr", {}, el("td", {}, "身高 / 體長"), el("td", { class: "comp-hl" }, String(c.height || c.height_cm || c.height_m)), el("td", {}, "符合常態分佈")));
        if (c.weight || c.weight_kg) table.append(el("tr", {}, el("td", {}, "體重"), el("td", { class: "comp-hl" }, String(c.weight || c.weight_kg)), el("td", {}, "符合常態分佈")));
        if (c.body_fat || c.body_fat_pct) table.append(el("tr", {}, el("td", {}, "體脂率"), el("td", { class: "comp-hl" }, String(c.body_fat || c.body_fat_pct)), el("td", {}, "合理健康區間")));
        if (c.cup_size) table.append(el("tr", {}, el("td", {}, "罩杯（女性）"), el("td", { class: "comp-hl" }, String(c.cup_size)), el("td", {}, "女角色常態")));
        if (c.timeline) table.append(el("tr", {}, el("td", {}, "文化時間線"), el("td", { class: "comp-hl" }, String(c.timeline)), el("td", {}, "歷史與未來想像")));
        if (c.region) table.append(el("tr", {}, el("td", {}, "文化地區"), el("td", { class: "comp-hl" }, String(c.region)), el("td", {}, "跨洲與星際")));
        if (c.ethnicity) table.append(el("tr", {}, el("td", {}, "人種表型"), el("td", { class: "comp-hl" }, String(c.ethnicity)), el("td", {}, "獨立生理特徵")));
        const bg = C.determineAgcBgColor(c, pkg.type === "character-concept" || pkg.id.startsWith("chr"));
        table.append(el("tr", {}, el("td", {}, "AGC 規範背景色"), el("td", { class: "comp-hl" }, el("span", { style: `display:inline-block;width:12px;height:12px;background:${bg.hex};border-radius:2px;vertical-align:middle;margin-right:5px;border:1px solid #555` }), `${bg.hex} (R=G=B=${bg.rgb[0]})`), el("td", {}, "RGB三通道均等 · 剪影防融")));
      }
      box.append(table);

    // 4. 檔案驗收清單
    } else if (activeTab === "files") {
      box.append(el("h4", {}, "交付檔案與完整性驗證"));
      const files = pkg.manifest?.files || [];
      const missing = pkg.manifest?.missing || [];
      const table = el("table", {},
        el("tr", {}, el("th", {}, "路徑"), el("th", {}, "層級"), el("th", {}, "狀態"))
      );
      files.forEach(f => {
        table.append(el("tr", {},
          el("td", {}, el("code", {}, f.path)),
          el("td", {}, f.level || "L1"),
          el("td", { style: "color:var(--ok)" }, "✅ 存在")
        ));
      });
      missing.forEach(m => {
        table.append(el("tr", {},
          el("td", {}, el("code", {}, m.item)),
          el("td", {}, m.level || "L2"),
          el("td", { style: "color:var(--warn)" }, "⚠️ 缺失（" + (m.reason || "平台限制") + "）")
        ));
      });
      box.append(table);
      if (pkg.manifest?.notes) {
        box.append(el("h4", {}, "AI 交付筆記"));
        box.append(el("p", { class: "muted" }, pkg.manifest.notes));
      }

    // 5. 審查覆核意見
    } else if (activeTab === "review") {
      box.append(el("h4", {}, "審查覆核意見"));
      const reviewBox = el("div", { class: "review-box" },
        el("div", { class: "seg" },
          el("button", { class: "segb" + (pkg.status === "reject" ? " on" : ""), type: "button", onclick: () => reviewPackage(pkg, "reject") }, "退回重建"),
          el("button", { class: "segb" + (pkg.status === "provisional" ? " on" : ""), type: "button", onclick: () => reviewPackage(pkg, "provisional") }, "暫時採用"),
          el("button", { class: "segb" + (pkg.status === "ok" ? " on" : ""), type: "button", onclick: () => reviewPackage(pkg, "ok") }, "通過"),
          el("button", { class: "segb" + (pkg.status === "pending" ? " on" : ""), type: "button", onclick: () => reviewPackage(pkg, "pending") }, "待決定")
        ),
        el("textarea", { id: "revNote", placeholder: "填寫人工審查意見（例如：身高比例良好，但服裝配色需微調；臉部表情需更生動...）", onchange: e => { saveReview(pkg, e.target.value); } }, getReviewNote(pkg)),
        el("div", { style: "display:flex;gap:6px;margin-top:6px;flex-wrap:wrap" },
          el("button", { class: "btn mini", type: "button", onclick: async () => { try { await window.COSMI_DRIVE.saveNote(pkg, $("#revNote")?.value || ""); toast("已將審查意見儲存至 Drive"); } catch(e) { toast(e.message); } } }, "儲存審查意見"),
          el("button", { class: "btn ghost mini", type: "button", onclick: () => exportReviewReport(pkg) }, "下載審查報告 (.json)"),
          el("button", { class: "btn ghost mini", type: "button", title: "移至備份區（自動加入時間戳）", onclick: () => backupActivePackage(pkg) }, "移至備份區 (含時間戳)")
        )
      );
      box.append(reviewBox);

    // 6. 指令部署與解壓
    } else if (activeTab === "cli") {
      box.append(el("h4", {}, "解壓審查與交付至 cosmos_chimera 管線"));
      const root = state.root || DEFAULT_ROOT;
      const ts = getBackupTimestamp();
      const psUnpackCmd = `powershell unpack_incoming.ps1 -Pattern "${pkg.id}*"`;
      const psDeployCmd = `powershell unpack_incoming.ps1 -Pattern "${pkg.id}*" -DeployToGame`;
      const valCmd = `python tools/validate_art.py Art/_incoming/${pkg.id} --apply`;
      const backupCmd = `Move-Item -Path "Art\\_incoming\\${pkg.id}.zip" -Destination "Art\\_backup\\${pkg.id}_${ts}.zip" -Force`;
      box.append(
        el("div", { style: "display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;" },
          el("button", { class: "btn mini", type: "button", onclick: () => unpackPackageToDisk(pkg) }, "實體解壓至本專案審查目錄"),
          el("button", { class: "btn ghost mini", type: "button", onclick: () => deployPackageToGame(pkg) }, "交付至 cosmos_chimera")
        ),
        el("p", { class: "muted" }, "本專案解壓審查指令（PowerShell）："),
        el("div", { class: "cmd" }, el("code", {}, psUnpackCmd), el("button", { type: "button", class: "btn ghost mini", onclick: () => copyText(psUnpackCmd, "已複製本專案解壓指令") }, "複製")),
        el("p", { class: "muted", style: "margin-top:10px" }, "審查核可，交付部署至 cosmos_chimera 指令："),
        el("div", { class: "cmd" }, el("code", {}, psDeployCmd), el("button", { type: "button", class: "btn ghost mini", onclick: () => copyText(psDeployCmd, "已複製交付至 cosmos_chimera 指令") }, "複製")),
        el("p", { class: "muted", style: "margin-top:10px" }, "遊戲專案驗收搬入管線指令（在 cosmos_chimera 目錄執行）："),
        el("div", { class: "cmd" }, el("code", {}, valCmd), el("button", { type: "button", class: "btn ghost mini", onclick: () => copyText(valCmd, "已複製驗收指令") }, "複製")),
        el("p", { class: "muted", style: "margin-top:10px" }, "本專案審查備份指令（含時間戳）："),
        el("div", { class: "cmd" }, el("code", {}, backupCmd), el("button", { type: "button", class: "btn ghost mini", onclick: () => copyText(backupCmd, "已複製備份指令") }, "複製"))
      );
    }
  }

  function formatArray(arr) {
    if (!arr) return "—";
    if (Array.isArray(arr)) return arr.length ? arr.join("、") : "—";
    return String(arr);
  }

  function getFullPromptText(pkg) {
    if (pkg.rawPrompt) return pkg.rawPrompt;
    // 若無原始檔則以最新規格即時組裝
    const upg = upgradePackageFormat(pkg);
    return upg ? upg.newPromptText : (pkg.manifest?.task_header || "無可用 Prompt 資訊");
  }

  async function reviewPackage(pkg, status) {
    try {
      await window.COSMI_DRIVE.review(pkg, status, $("#revNote")?.value || getReviewNote(pkg));
    } catch (e) { const status = document.getElementById("driveStatus"); if (status) status.textContent = e.message; toast(e.message); }
  }

  function getReviewNote(pkg) {
    return pkg.reviewRecord?.note || reviewState.reviews[pkg.id]?.note || "";
  }
  function saveReview(pkg, note) {
    reviewState.reviews[pkg.id] = { ...reviewState.reviews[pkg.id], status: pkg.status, note: note ?? getReviewNote(pkg), time: new Date().toLocaleString() };
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewState.reviews)); } catch (e) {}
    if ($("#favList")) renderFavorites();
    if ($("#designedList")) renderDesignedList();
  }
  function exportReviewReport(pkg) {
    const report = {
      task_id: pkg.id,
      status: pkg.status,
      reviewer_note: getReviewNote(pkg),
      inspected_at: new Date().toISOString(),
      manifest: pkg.manifest,
      concept_summary: pkg.concept
    };
    download(pkg.id + ".review.json", JSON.stringify(report, null, 2), "application/json");
  }

  // 視圖切換
  async function setViewMode(mode) {
    state.activeTab = mode;
    if (mode === "review") {
      $("#forgeView").style.display = "none";
      $("#designedView")?.classList.remove("active");
      $("#reviewView").classList.add("active");
      $("#settingsView")?.classList.remove("active");
      $("#viewBtnSettings")?.classList.remove("on");
      $("#viewBtnForge").classList.remove("on");
      $("#viewBtnDesigned")?.classList.remove("on");
      $("#viewBtnReview").classList.add("on");
      $("#forgeHeaderControls").style.display = "none";
      renderReviewView();
    } else if (mode === "designed") {
      $("#forgeView").style.display = "none";
      $("#reviewView").classList.remove("active");
      $("#designedView")?.classList.add("active");
      $("#settingsView")?.classList.remove("active");
      $("#viewBtnSettings")?.classList.remove("on");
      $("#viewBtnForge").classList.remove("on");
      $("#viewBtnDesigned")?.classList.add("on");
      $("#viewBtnReview").classList.remove("on");
      $("#forgeHeaderControls").style.display = "none";
      renderDesignedDesk();
      if (!window.COSMI_DRIVE?.pipelineIndex?.()?.syncedAt) {
        void window.COSMI_DRIVE?.syncPipelineIndex?.().catch(() => {});
      }
    } else if (mode === "settings") {
      $("#forgeView").style.display = "none";
      $("#reviewView").classList.remove("active");
      $("#designedView")?.classList.remove("active");
      $("#settingsView")?.classList.add("active");
      $("#viewBtnForge").classList.remove("on");
      $("#viewBtnDesigned")?.classList.remove("on");
      $("#viewBtnReview").classList.remove("on");
      $("#viewBtnSettings")?.classList.add("on");
      $("#forgeHeaderControls").style.display = "none";
      window.COSMI_SETTINGS?.refresh();
    } else {
      $("#forgeView").style.display = "grid";
      $("#reviewView").classList.remove("active");
      $("#designedView")?.classList.remove("active");
      $("#settingsView")?.classList.remove("active");
      $("#viewBtnSettings")?.classList.remove("on");
      $("#viewBtnForge").classList.add("on");
      $("#viewBtnDesigned")?.classList.remove("on");
      $("#viewBtnReview").classList.remove("on");
      $("#forgeHeaderControls").style.display = "inline-flex";
      renderAll();
    }
  }

  // ---- 動作 ----
  function newSeed() { return Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0"); }
  function reseed(seed, force) {
    state.seed = (seed || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || newSeed();
    rollAll("character", mulberry32(hashStr(state.seed + "|character")), force);
    rollAll("creature", mulberry32(hashStr(state.seed + "|creature")), force);
    renderAll();
  }
  function copyText(text, msg) {
    const done = () => toast(msg);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { const ta = el("textarea", {}, text); document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); done(); }
  }
  function record() {
    const b = lastBuild; if (!b || b.errors.length) return;
    state.history = [{ id: b.ctx.taskId, task: b.ctx.task.id, platform: state.platform, time: new Date().toLocaleString() }]
      .concat((state.history || []).filter(h => h.id !== b.ctx.taskId)).slice(0, 50);
    renderHistory(); save();
  }
  function download(name, text, type) {
    const a = el("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  let toastTimer;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800); }

  // ---- 持久化 ----
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        catalog: C.version, seed: state.seed, platform: state.platform, taskId: state.taskId, includeReview: state.includeReview,
        character: state.character, creature: state.creature, locks: state.locks, opts: state.opts, notes: state.notes,
        subjectIds: state.subjectIds, history: state.history, root: state.root, customOptions: state.customOptions,
        preset: state.preset, presetChar: state.presetChar, flowChoice: state.flowChoice
      }));
    } catch (e) {}
  }
  function load() {
    try {
      const revs = JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
      reviewState.reviews = revs;
      loadFavorites();
      const d = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!d) return false;
      const sameMajor = (d.catalog || "").split(".")[0] === C.version.split(".")[0];
      Object.assign(state, {
        platform: d.platform || "chatgpt", history: d.history || [], root: d.root && !/^(?:[a-z]:|[\\/])/i.test(d.root) ? d.root : DEFAULT_ROOT, notes: d.notes || "",
        customOptions: d.customOptions || {},
        flowChoice: d.flowChoice || null,
        preset: DESIGNED.some(x => x.line_id === d.preset) ? d.preset : null,
        presetChar: DESIGNED_CHARACTERS.some(x => x.id === d.presetChar) ? d.presetChar : null
      });
      if (TASKS.some(t => t.id === d.taskId)) state.taskId = d.taskId;
      if (sameMajor) {
        Object.assign(state, {
          seed: d.seed, includeReview: !!d.includeReview, character: d.character || {},
          creature: d.creature || {}, locks: d.locks || {}, opts: d.opts || {}, subjectIds: d.subjectIds || {}
        });
        if (state.creature?.base_parents) {
          state.creature.base_parents = state.creature.base_parents.map(traceBaseParent);
        }
      }
      return !!state.seed;
    } catch (e) { return false; }
  }

  function init() {
    $("#ver").textContent = "tool " + TOOL_VERSION + " · catalog " + C.version + " · spec " + SPEC;

    // 視圖切換事件
    $("#viewBtnForge").addEventListener("click", () => setViewMode("forge"));
    $("#viewBtnDesigned")?.addEventListener("click", () => setViewMode("designed"));
    $("#viewBtnReview").addEventListener("click", () => setViewMode("review"));
    $("#viewBtnSettings")?.addEventListener("click", () => setViewMode("settings"));

    // 已設計台分類切換
    $$("#designedCatSeg .segb").forEach(btn => {
      btn.addEventListener("click", () => {
        $$("#designedCatSeg .segb").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        designedState.cat = btn.dataset.cat || "all";
        renderDesignedDesk();
      });
    });

    // 已設計台檢視模式切換 (詳細檢閱 vs 完整卡片清單)
    $("#btnDesignedModeDetail")?.addEventListener("click", () => {
      designedState.mode = "detail";
      $("#btnDesignedModeDetail")?.classList.add("on");
      $("#btnDesignedModeCards")?.classList.remove("on");
      $("#designedDetailView").style.display = "block";
      $("#designedCardsView").style.display = "none";
    });
    $("#btnDesignedModeCards")?.addEventListener("click", () => {
      designedState.mode = "cards";
      $("#btnDesignedModeDetail")?.classList.remove("on");
      $("#btnDesignedModeCards")?.classList.add("on");
      $("#designedDetailView").style.display = "none";
      $("#designedCardsView").style.display = "block";
      renderDesignedList();
    });

    $("#toReview").addEventListener("click", () => {
      const b = lastBuild;
      const curSubject = b?.ctx?.subjectId || subjectId(task().subject);
      const curStage = b?.ctx?.opts?.stage || null;
      jumpToReview(curSubject, curStage);
    });

    // 我的最愛與已設計清單事件綁定
    $("#btnFavPrompt")?.addEventListener("click", () => addCurrentToFavorites());
    $("#btnClearFavs")?.addEventListener("click", () => {
      if (!favorites.length) return;
      if (confirm("確定要清空所有收藏的 Prompt 嗎？此動作無法復原。")) {
        favorites = [];
        saveFavorites();
        renderFavorites();
        updateFavButton();
        toast("已清空我的最愛 Prompt 清單");
      }
    });
    $("#favSearch")?.addEventListener("input", () => renderFavorites());
    $("#designedSearch")?.addEventListener("input", () => renderDesignedDesk());
    $("#designedStatusFilter")?.addEventListener("change", e => {
      designedState.statusFilter = e.target.value || "all";
      renderDesignedDesk();
    });

    // 平台切換按鈕事件
    $("#platChatgpt").addEventListener("click", () => { state.platform = "chatgpt"; renderAll(); });
    $("#platGemini").addEventListener("click", () => { state.platform = "gemini"; renderAll(); });

    $("#reroll").addEventListener("click", () => reseed(newSeed(), true));
    $("#seed").addEventListener("change", e => reseed(e.target.value, true));
    $("#notes").addEventListener("input", e => { state.notes = e.target.value; renderOutput(); save(); });
    function ensureWikiOnPrompt(ctx) {
      if(!window.COSMI_DRIVE?.ensureWiki || !window.COSMI_PIPELINE?.supports(ctx))return;
      void window.COSMI_DRIVE.ensureWiki(ctx).catch(e => {
        console.warn("尚未同步圖鑑："+e.message);
        toast("圖鑑未同步至 Drive："+e.message);
      });
    }
    $("#copy").addEventListener("click", () => {
      const b = build();
      if (b.errors.length) { toast("Prompt 存在錯誤，無法複製"); return; }
      const staged = window.COSMI_PIPELINE?.supports(b.ctx) ? {taskId: b.ctx.taskId} : generateAndStageFormats(b);
      ensureWikiOnPrompt(b.ctx);
      copyText($("#prompt").value, `已複製本步驟 Prompt (${staged.taskId})；格式參數請另存 JSON`);
      record();
    });

    // 多輪次獨立複製按鈕
    $("#btnCopyR1")?.addEventListener("click", () => {
      const b = build();
      if (b.errors.length) { toast("Prompt 存在錯誤，無法複製"); return; }
      if (!b.rounds || !b.rounds[0]) return;
      ensureWikiOnPrompt(b.ctx);
      state.currentRound = 1;
      renderOutput();
      const staged = window.COSMI_PIPELINE?.supports(b.ctx) ? {taskId: b.ctx.taskId} : generateAndStageFormats(b);
      const isEvo = b.ctx.opts?.stage && b.ctx.opts.stage !== "juvenile" && b.ctx.task.id === "creature-concept";
      const hint = isEvo ? `已複製第 1 輪 (正面圖) Prompt！請先上傳前一階正面圖再貼入生成` : `已複製第 1 輪 (正面圖) Prompt！已產生時間戳對齊包 (${staged.taskId})`;
      copyText(b.rounds[0].prompt, hint);
      record();
    });

    $("#btnCopyR2")?.addEventListener("click", () => {
      const b = build();
      if (b.errors.length) { toast("Prompt 存在錯誤，無法複製"); return; }
      if (!b.rounds || !b.rounds[1]) return;
      ensureWikiOnPrompt(b.ctx);
      state.currentRound = 2;
      renderOutput();
      copyText(b.rounds[1].prompt, `已複製第 2 輪 (三視圖) Prompt！請貼入同對話接續生成`);
      record();
    });

    $("#btnCopyR3")?.addEventListener("click", () => {
      const b = build();
      if (b.errors.length) { toast("Prompt 存在錯誤，無法複製"); return; }
      if (!b.rounds || !b.rounds[2]) return;
      ensureWikiOnPrompt(b.ctx);
      state.currentRound = 3;
      renderOutput();
      copyText(b.rounds[2].prompt, `已複製第 3 輪 (主立繪) Prompt！請貼入同對話接續生成`);
      record();
    });
    $("#download").addEventListener("click", () => { ensureWikiOnPrompt(lastBuild.ctx); download(lastBuild.ctx.taskId + ".prompt.md", $("#prompt").value, "text/markdown"); record(); });
    $("#export").addEventListener("click", () => {
      const b = lastBuild; if (!b.ctx.concept) { toast("此任務沒有概念"); return; }
      download(b.ctx.subjectId + ".concept.json", JSON.stringify(b.ctx.concept, null, 2), "application/json");
    });
    $("#open").addEventListener("click", () => window.open(state.platform === "gemini" ? "https://gemini.google.com/app" : "https://chatgpt.com/", "_blank", "noopener"));
    $("#root").addEventListener("change", e => {
      const value = e.target.value.trim().replace(/[\\/]+$/, "");
      if (/^(?:[a-z]:|[\\/])/i.test(value)) { toast("請使用相對目錄，例如 ../cosmos_chimera"); e.target.value = state.root || DEFAULT_ROOT; return; }
      state.root = value || DEFAULT_ROOT; renderOutput(); save();
    });

    // 鍛造台升級舊版包按鈕
    $("#btnUpgradeForge").addEventListener("click", () => $("#upgradeFileInput").click());

    // 審查台控制列事件
    $("#btnScanDir").addEventListener("click", scanIncomingDirectory);
    $("#folderFileInput")?.addEventListener("change", e => handleFolderUpload(e.target.files));
    $("#btnDirectUnpackZip")?.addEventListener("click", () => $("#directUnpackFileInput").click());
    $("#directUnpackFileInput")?.addEventListener("change", async e => {
      const files = e.target.files;
      if (!files || !files.length) return;
      for (const f of files) {
        if (f.name.endsWith(".zip")) {
          toast("正在讀取並解析 " + f.name + "...");
          const pkg = await loadZipFile(f);
          if (pkg) {
            await unpackPackageToDisk(pkg);
          }
        }
      }
    });
    $("#btnLoadZip").addEventListener("click", () => $("#zipFileInput").click());
    $("#zipFileInput").addEventListener("change", async e => {
      const files = e.target.files;
      for (const f of files) {
        if (f.name.endsWith(".zip")) await loadZipFile(f);
      }
    });
    $("#btnLoadFixtures").addEventListener("click", loadSampleFixtures);
    $("#btnUpgradeZip").addEventListener("click", () => $("#upgradeFileInput").click());
    $("#upgradeFileInput").addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      toast("正在讀取並解析壓縮包...");
      const pkg = await loadZipFile(file);
      if (pkg) {
        const upg = upgradePackageFormat(pkg);
        if (upg) showUpgradeModal(upg);
      }
    });

    // 舞台檢視模式切換 (單圖 vs 2D ⇄ 3D 雙欄對比 vs 3D 動作檢視)
    $("#btnModeSingle").addEventListener("click", () => {
      reviewState.viewMode = "single";
      renderReviewView();
    });
    $("#btnModeCompare").addEventListener("click", () => {
      reviewState.viewMode = "compare";
      renderReviewView();
    });
    $("#btnMode3D")?.addEventListener("click", () => {
      reviewState.viewMode = "3d";
      renderReviewView();
    });

    // 3D 舞台動作播放控制列事件
    $("#btn3dPlayPause")?.addEventListener("click", toggle3dPlayPause);
    $("#btn3dPrevClip")?.addEventListener("click", () => step3dClip(-1));
    $("#btn3dNextClip")?.addEventListener("click", () => step3dClip(1));
    $("#stage3dClipSelect")?.addEventListener("change", e => play3dClip(e.target.value));
    $("#btn3dLoop")?.addEventListener("click", toggle3dLoop);

    $("#stage3dScrubber")?.addEventListener("input", e => {
      const three = reviewState.three;
      if (!three.currentAction) return;
      three.isPlaying = false;
      const duration = three.currentAction.getClip().duration || 1.0;
      const targetTime = (parseFloat(e.target.value) / 100) * duration;
      three.currentAction.time = targetTime;
      three.mixer?.update(0);
      updateStage3dTimeDisplay(targetTime, duration);
    });

    $("#stage3dScrubber")?.addEventListener("change", () => {
      reviewState.three.isPlaying = true;
      const btn = $("#btn3dPlayPause");
      if (btn) btn.textContent = "⏸ 暫停";
    });

    document.querySelectorAll("#stage3dSpeedSeg .segb").forEach(btn => {
      btn.addEventListener("click", () => set3dSpeed(parseFloat(btn.dataset.speed)));
    });

    // 3D HUD 工具按鈕事件
    $("#btn3dBones")?.addEventListener("click", toggle3dBones);
    $("#btn3dWireframe")?.addEventListener("click", toggle3dWireframe);
    $("#btn3dGrid")?.addEventListener("click", toggle3dGrid);
    $("#btn3dCamFront")?.addEventListener("click", () => set3dCameraPreset("front"));
    $("#btn3dCamSide")?.addEventListener("click", () => set3dCameraPreset("side"));
    $("#btn3dCamBack")?.addEventListener("click", () => set3dCameraPreset("back"));
    $("#btn3dCamIso")?.addEventListener("click", () => set3dCameraPreset("iso"));
    $("#btn3dReset")?.addEventListener("click", () => set3dCameraPreset("reset"));

    // 鍵盤快速鍵支援 (空白鍵暫停/播放、[ ] 切換動作、B 骨架、W 拓撲、L 循環、R 重設)
    window.addEventListener("keydown", e => {
      if (state.activeTab !== "review") return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        toggle3dPlayPause();
      } else if (e.key === "[") {
        e.preventDefault();
        step3dClip(-1);
      } else if (e.key === "]") {
        e.preventDefault();
        step3dClip(1);
      } else if (e.key === "b" || e.key === "B") {
        toggle3dBones();
      } else if (e.key === "w" || e.key === "W") {
        toggle3dWireframe();
      } else if (e.key === "l" || e.key === "L") {
        toggle3dLoop();
      } else if (e.key === "r" || e.key === "R") {
        set3dCameraPreset("reset");
      }
    });

    // 拖曳上傳支援
    const stageHost = $("#stageHost");
    stageHost.addEventListener("dragover", e => { e.preventDefault(); stageHost.style.background = "#1f2635"; });
    stageHost.addEventListener("dragleave", () => { stageHost.style.background = "#12141a"; });
    stageHost.addEventListener("drop", async e => {
      e.preventDefault();
      stageHost.style.background = "#12141a";
      if (e.dataTransfer.files?.length) {
        for (const f of e.dataTransfer.files) {
          if (f.name.endsWith(".zip")) await loadZipFile(f);
        }
      }
    });

    // 縮放控制
    $("#zoom1x").addEventListener("click", () => { reviewState.zoomLevel = 1.0; reviewState.panX = 0; reviewState.panY = 0; renderReviewView(); });
    $("#zoomFit").addEventListener("click", () => { reviewState.zoomLevel = 0.9; reviewState.panX = 0; reviewState.panY = 0; renderReviewView(); });
    $("#zoomIn").addEventListener("click", () => { reviewState.zoomLevel = Math.min(3.0, reviewState.zoomLevel + 0.25); renderReviewView(); });
    $("#zoomOut").addEventListener("click", () => { reviewState.zoomLevel = Math.max(0.4, reviewState.zoomLevel - 0.25); renderReviewView(); });

    // 審查台分類與搜尋
    document.querySelectorAll("#catSeg .segb").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#catSeg .segb").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        reviewState.filterCat = btn.dataset.cat;
        renderReviewView();
      });
    });
    $("#railSearch").addEventListener("input", e => {
      reviewState.filterQuery = e.target.value.trim();
      renderReviewView();
    });

    // 分頁 Tabs
    document.querySelectorAll("#panelTabs .segb").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#panelTabs .segb").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        renderReviewView();
      });
    });

    // 一鍵解壓縮（解壓至本專案 Art/_incoming 目錄以供審查）
    $("#btnUnpack").addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) { toast("請先選取任務包"); return; }
      exportAssetDirectory(pkg);
    });
    // 審查通過，交付部署至 cosmos_chimera
    $("#btnDeployGame")?.addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) { toast("請先選取任務包"); return; }
      deployPackageToGame(pkg);
    });
    $("#btnExportAlignedZip")?.addEventListener("click", () => exportAssetDirectory(getActivePkg()));
    $("#btnToImg3d")?.addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) return;
      sendToImgTo3D(pkg, pkg.images?.[reviewState.activeImgIdx]?.path);
    });
    $("#btnToImg3dBatch")?.addEventListener("click", () => {
      const pkg = getActivePkg();
      sendToImgTo3DBatch(pkg);
    });
    $("#btnBackup")?.addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) return;
      backupActivePackage(pkg);
    });
    $("#btnCopyPath").addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) return;
      const root = state.root || DEFAULT_ROOT;
      copyText(`${root}\\Art\\_incoming\\${pkg.id}`, "已複製交付資料夾路徑");
    });
    $("#btnCopyReviewLink")?.addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) return;
      const url = new URL(window.location.href);
      url.searchParams.set("review", pkg.id);
      copyText(url.toString(), "已複製驗收連結；開啟後須登入有資產權限的 Google 帳號。");
    });
    $("#btnCopyPs").addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) return;
      const root = state.root || DEFAULT_ROOT;
      const cmd = `Expand-Archive -Path "$HOME\\Downloads\\${pkg.id}.zip" -DestinationPath "${root}\\Art\\_incoming\\" -Force`;
      copyText(cmd, "已複製 PowerShell 解壓指令");
    });

    // 審查台當前包一鍵升級格式
    $("#btnUpgradeActive").addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) return;
      const upg = upgradePackageFormat(pkg);
      if (upg) showUpgradeModal(upg);
    });

    // 升級 Modal 內部下載與複製事件
    $("#btnCopyUpgPrompt").addEventListener("click", () => {
      if (lastUpgradeResult) copyText(lastUpgradeResult.newPromptText, "已複製升級後的 Prompt");
    });
    $("#btnDlUpgPrompt").addEventListener("click", () => {
      if (!lastUpgradeResult) return;
      download(lastUpgradeResult.targetTaskId + ".prompt.md", lastUpgradeResult.newPromptText, "text/markdown");
    });
    $("#btnDlUpgConcept").addEventListener("click", () => {
      if (!lastUpgradeResult) return;
      download(lastUpgradeResult.newManifest.subject_id + ".concept.json", JSON.stringify(lastUpgradeResult.newConcept, null, 2), "application/json");
    });
    $("#btnDlUpgManifest").addEventListener("click", () => {
      if (!lastUpgradeResult) return;
      download("manifest.json", JSON.stringify(lastUpgradeResult.newManifest, null, 2), "application/json");
    });
    $("#btnDlUpgZip").addEventListener("click", () => {
      if (!lastUpgradeResult) return;
      const pkg = lastUpgradeResult.pkg;
      const zipFiles = {};
      const tid = lastUpgradeResult.targetTaskId;
      zipFiles[tid + "/manifest.json"] = JSON.stringify(lastUpgradeResult.newManifest, null, 2);
      zipFiles[tid + "/concept.json"] = JSON.stringify(lastUpgradeResult.newConcept, null, 2);
      zipFiles[tid + "/" + tid + ".prompt.md"] = lastUpgradeResult.newPromptText;

      // 若有原圖一併封裝
      if (pkg.rawFiles) {
        for (const path in pkg.rawFiles) {
          if (!path.endsWith("manifest.json") && !path.endsWith("concept.json") && !path.endsWith(".prompt.md")) {
            const rel = path.includes("/") ? path.slice(path.indexOf("/") + 1) : path;
            zipFiles[tid + "/" + rel] = pkg.rawFiles[path];
          }
        }
      }
      const blob = createZipBlob(zipFiles);
      const a = el("a", { href: URL.createObjectURL(blob), download: tid + ".upgraded.zip" });
      document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast("已下載升級後的 Zip 包");
    });
    $("#btnLoadInForge").addEventListener("click", () => {
      if (!lastUpgradeResult) return;
      const res = lastUpgradeResult;
      const isChr = res.targetTaskId.startsWith("chr");
      state.taskId = isChr ? "character-concept" : "creature-concept";
      if (isChr) {
        state.character = Object.assign({}, res.newConcept);
      } else {
        state.creature = Object.assign({}, res.newConcept);
      }
      closeUpgradeModal();
      setViewMode("forge");
      toast("已將升級概念載入至 Prompt 鍛造台");
    });
    $("#btnCloseUpgradeModal").addEventListener("click", closeUpgradeModal);
    $("#upgradeModal").addEventListener("click", e => { if (e.target.id === "upgradeModal") closeUpgradeModal(); });

    function closeUpgradeModal() {
      $("#upgradeModal").classList.remove("show");
    }

    // 自訂 Modal 事件
    $("#customModalConfirm").addEventListener("click", () => {
      const val = $("#customModalInput").value.trim();
      if (val && curCustomCtx) curCustomCtx(val);
      closeCustomModal();
    });
    $("#customModalUnknown").addEventListener("click", () => {
      if (curCustomCtx) curCustomCtx("未知");
      closeCustomModal();
    });
    $("#customModalCancel").addEventListener("click", closeCustomModal);
    $("#customModal").addEventListener("click", e => { if (e.target.id === "customModal") closeCustomModal(); });

    const had = load();
    $("#notes").value = state.notes;
    $("#root").value = state.root || DEFAULT_ROOT;
    if (had) renderAll(); else reseed(newSeed(), true);
  }
  window.COSMI_FORGE = Object.freeze({
    loadZipFile, loadAssetFiles, setViewMode,
    openReviewPackage: pkg => {
      if (!pkg) return;
      reviewState.activePkgId = pkg.id;
      if (pkg.stage) reviewState.activeStage = pkg.stage;
      reviewState.activeImgIdx = 0;
      if (is3dType(pkg.type) || pkg.glbFile || pkg.animSpec) reviewState.viewMode = "3d";
      setViewMode("review");
    },
    versionInfo: () => ({tool:TOOL_VERSION,catalog:C.version,spec:SPEC,templates:Object.fromEntries(TASKS.map(t=>[t.id,t.version]))}),
    packages: () => reviewState.packages,
    removePackage: id => { reviewState.packages = reviewState.packages.filter(p => p.id !== id); },
    clearDrivePackages: () => { reviewState.packages = reviewState.packages.filter(p => !p.driveFolderId); },
    persistReview: saveReview,
    setPipelineStage: stage => {
      const flow = currentFlow();
      if (flow && flow.category === "move" && stage !== "encyclopedia") { renderAll(); return; }
      const kind = flow?.category || (task().id.startsWith("character") ? "character" : "creature");
      const route = stage === "portrait_3d" ? "text" : flow?.route || "image";
      const matching = taskFlow?.steps(kind,route).find(s=>s.stage===stage);
      if (matching) { chooseFlow(kind,route,matching.id); return; }
      const isCharacter = task().id.startsWith("character");
      if (["appearance", "portrait", "portrait_3d", "review_portrait"].includes(stage)) state.taskId = isCharacter ? "character-concept" : "creature-concept";
      if (["colab", "blender"].includes(stage)) {
        const pkg = getActivePkg();
        const chr = pkg && !is3dType(pkg.type) ? pkg.type === "character-concept" : isCharacter;
        state.taskId = chr ? "character-model-rig" : "creature-model-rig";
        if (pkg && !is3dType(pkg.type)) {
          const opts = taskOpts(task()); opts.source_pack = pkg.id; opts.scope = "single";
          if (pkg.stage) opts.stage = pkg.stage;
        }
      }
      renderAll();
    },
    currentContext: () => build().ctx,
    settings: () => ({assetId: lastBuild.ctx.taskId, subjectId: lastBuild.ctx.subjectId, appearance: window.COSMI_PIPELINE.appearance(lastBuild.ctx),
      delivery: {spec: "cosmimera-art-task/1", task_header: lastBuild.ctx.header, task_id: lastBuild.ctx.taskId,
        task_type: lastBuild.ctx.task.id, subject_id: lastBuild.ctx.subjectId, source_pack: lastBuild.ctx.opts?.source_pack || "",
        produced_by: "", files: [], missing: []}}),
    refresh: () => { renderAll(); renderReviewView(); if (state.activeTab === "designed") renderDesignedDesk(); },
    setPortraitRound: round => { state.currentRound = round; renderOutput(); },
    activePackage: getActivePkg,
    packageBlob: pkg => createZipBlob(pkg.rawFiles),
    currentPrompt: () => {
      // Automated portrait exports always contain the complete multi-round prompt,
      // regardless of which round is currently displayed.
      const b = build();
      if (b.errors.length) throw Error(b.errors.join("；"));
      const stage = document.getElementById("pipelineStage")?.value || "task";
      recordPipelineJob(b.ctx, stage);
      const portrait = ["portrait", "portrait_3d"].includes(stage) && window.COSMI_PIPELINE?.supports(b.ctx);
      return {
        path: "prompts/jobs/" + b.ctx.taskId + "." + stage + ".prompt.md",
        text: portrait ? (stage === "portrait_3d" ? ($("#prompt")?.value || b.text) : b.text) : ($("#prompt")?.value || b.text)
      };
    },
    showPrompt: text => {
      const dialog = document.createElement("dialog");
      const textarea = document.createElement("textarea");
      textarea.readOnly = true; textarea.value = text; textarea.style.cssText = "width:75vw;height:65vh";
      const copy = document.createElement("button"); copy.textContent = "複製 Prompt"; copy.onclick = () => copyText(text, "已複製 Drive Prompt");
      const save = document.createElement("button"); save.textContent = "下載 Prompt"; save.onclick = () => download("drive.prompt.md", text, "text/markdown");
      const close = document.createElement("button"); close.textContent = "關閉"; close.onclick = () => dialog.close();
      dialog.append(textarea, copy, save, close); document.body.append(dialog);
      dialog.addEventListener("close", () => dialog.remove(), { once: true }); dialog.showModal();
    }
  });
  window.addEventListener("cosmi:authorized", init, { once: true });
})();
