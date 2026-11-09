// COSMIMERA prompt-forge · 介面與組裝 + 交付成果審查台
(function () {
  const TOOL_VERSION = "2.3.0";
  const SPEC = "1";
  const C = window.COSMI_CATALOG, TASKS = window.COSMI_TASKS;
  if (C && !C.CLIPS && C.ACTIONS) C.CLIPS = C.ACTIONS;
  const LS_KEY = "cosmimera.prompt-forge.v2";
  const REVIEW_KEY = "cosmimera.prompt-forge.reviews.v1";
  const DEFAULT_ROOT = "C:\\Users\\user\\Documents\\app\\cosmos_chimera";

  function is3dType(t) {
    return t === "creature-model-rig" || t === "character-model-rig" || t === "model-rig" || (typeof t === "string" && (t.startsWith("mdl") || t.startsWith("anim")));
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
    preset: null // 已設計項目的 line_id；設定時宙獸概念改用 designed.js 的定案內容，不再隨機
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
    setViewMode("forge");
    renderAll();
    toast("已將" + (isChr ? "角色" : "宙獸") + "立繪包「" + pkg.id + "」帶入指定 3D 任務");
  }

  function sendToImgTo3DBatch(pkg) {
    const isChr = pkg ? (pkg.type === "character-concept" || pkg.type === "character-model-rig" || pkg.id.startsWith("chr")) : false;
    const targetTaskId = isChr ? "character-model-rig" : "creature-model-rig";
    state.taskId = targetTaskId;
    const t = TASKS.find(x => x.id === targetTaskId) || TASKS[0];
    const o = taskOpts(t);
    o.scope = "batch";
    setViewMode("forge");
    renderAll();
    toast("已切換至「" + t.zh + "（批量處理模式）」");
  }

  // REQ: 使用者 2026-11-07 — 已設計的宙獸（P2-08 御三家等）直接產出立繪 / img-to-3D prompt。
  const DESIGNED = (window.COSMI_DESIGNED && window.COSMI_DESIGNED.items) || [];
  function designedItem() { return state.preset ? DESIGNED.find(d => d.line_id === state.preset) || null : null; }

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
      { key: "ethnicity", label: "人種", options: () => CH.ethnicity.map(e => ({ v: e.v, w: e.w, zh: e.zh })).concat(getCustom("character.ethnicity").map(v => ({ v, w: 1, zh: v }))), count: [{ n: 1, w: 1 }] },
      { key: "region", label: "文化地區", options: () => uniform(C.CULTURE_REGIONS.concat(getCustom("character.region"))), count: [{ n: 1, w: 1 }] },
      { key: "timeline", label: "文化時間線", options: () => C.TIMELINES.map(t => ({ v: t.v, zh: t.zh, w: 1 })).concat(getCustom("character.timeline").map(v => ({ v, zh: v, w: 1 }))), count: [{ n: 1, w: 1 }] },
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
      { key: "outfit_palette", label: "服裝色系 (1~4色)", options: () => C.PALETTES.map(p => ({ v: p.v, w: p.w, zh: p.zh || p.v })).concat(getCustom("character.outfit_palette").map(v => ({ v, w: 1, zh: v }))), count: [{ n: 1, w: 15 }, { n: 2, w: 45 }, { n: 3, w: 25 }, { n: 4, w: 15 }], max: 4 },
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
      { key: "elements", label: "屬性", options: () => C.ELEMENTS.map(e => ({ v: e.v, w: e.w, zh: e.zh })).concat(getCustom("creature.elements").map(v => ({ v, w: 1, zh: v }))), count: [{ n: 1, w: 2 }, { n: 2, w: 1 }], max: 2 },
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
        const pool = C.getFilteredPalettes(s.creature.elements || []);
        return pool.map(p => ({ v: p.v, w: p.w, zh: p.zh || p.v })).concat(getCustom("creature.appearance_palette").map(v => ({ v, w: 1, zh: v })));
      }, count: [{ n: 1, w: 15 }, { n: 2, w: 45 }, { n: 3, w: 25 }, { n: 4, w: 15 }], max: 4, dep: "elements" },
      { key: "timeline", label: "文化時間線", options: () => C.TIMELINES.map(t => ({ v: t.v, zh: t.zh, w: 1 })).concat(getCustom("creature.timeline").map(v => ({ v, zh: v, w: 1 }))), count: [{ n: 1, w: 1 }] },
      { key: "region", label: "文化地區", options: () => uniform(C.CULTURE_REGIONS.concat(getCustom("creature.region"))), count: [{ n: 1, w: 1 }] },
      { key: "archetype", label: "文化原型", options: s => {
        const pool = archetypePool(s);
        return pool.map(a => ({ v: a.name, w: 1, zh: a.name + "（" + a.region + "·" + a.type + (a.sensitivity === "review" ? "・需審" : "") + "）" })).concat(getCustom("creature.archetype").map(v => ({ v, w: 1, zh: v })));
      }, count: [{ n: 1, w: 1 }] },
      { key: "role", label: "戰鬥定位", options: () => uniform(CR.role.concat(getCustom("creature.role"))), count: [{ n: 1, w: 1 }] },
      { key: "temperament", label: "性情", options: () => uniform(C.PERSONALITIES.concat(getCustom("creature.temperament"))), count: [{ n: 1, w: 1 }] },
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
    state[kind][f.key] = pickN(rng, opts, n);
  }

  function rollAll(kind, rng, force) {
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
      sensitivity: a.sensitivity || "ok", role: c.role?.[0] || "未知", temperament: c.temperament?.[0] || "未知",
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
    const d = kind === "creature" ? designedItem() : null;
    if (d) return d.line_id;
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
  function build() {
    const t = task(), o = taskOpts(t), subj = resolveSubject(t, o);
    const errors = [];
    t.options
      .filter(d => d.type === "checks" && !d.optional && (!d.when || d.when(o)) && (o[d.key] || []).length === 0)
      .forEach(d => errors.push("至少勾選一個「" + d.label + "」"));
    const s = stamp();
    let taskId = t.prefix + "-" + s.day + "-" + state.seed + "-" + s.hm;
    if (t.id === "creature-concept" && o.stage) {
      taskId += "-" + o.stage;
    } else if ((t.id === "creature-model-rig" || t.id === "model-rig") && o.stage) {
      taskId += "-" + o.stage;
    }
    const header = "[COSMIMERA-TASK spec=" + SPEC + " tool=" + TOOL_VERSION + " catalog=" + C.version + " template=" + t.id + "@" + t.version + " task_id=" + taskId + " seed=" + state.seed + "]";
    const is3dTask = is3dType(t.id);
    const chosenPkg = (is3dTask && o.source_pack) ? reviewState.packages.find(p => p.id === o.source_pack) : null;
    let concept = chosenPkg?.concept || (subj === "character" ? characterConcept() : subj === "creature" ? creatureConcept() : null);
    let subjId = chosenPkg?.subjectId || (subj ? subjectId(subj) : is3dTask ? "batch" : t.id === "capture-vessel" ? "vessels" : t.id === "culture-research" ? "region_" + o.region : "fx_" + o.element + "_" + o.shape);

    const ctx = {
      header, taskId, timestamp: s.day + "-" + s.hm, task: t, opts: o, concept, notes: state.notes.trim(),
      platform: state.platform, platformName: state.platform === "gemini" ? "Gemini Argon（任務模式）" : "ChatGPT（對話版）",
      subjectId: subjId
    };
    const rounds = (!errors.length && t.buildRounds) ? t.buildRounds(ctx) : null;
    lastBuild = { ctx, errors, text: errors.length ? "" : t.build(ctx), rounds };
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
        temperament: c.temperament || "沉穩",
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
        personality: c.personality, style: c.style, vessel: c.vessel?.zh || c.vessel,
        biography: c.biography || "角色生平傳記。"
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

  function renderTasks() {
    const box = $("#tasks"); box.replaceChildren();
    TASKS.forEach(t => {
      box.append(el("button", {
        class: "task" + (t.id === state.taskId ? " on" : ""), type: "button",
        onclick: () => { state.taskId = t.id; state.currentRound = 1; renderAll(); }
      }, el("span", { class: "tname" }, t.zh), el("span", { class: "tmeta" }, t.id + " · 建議 " + (t.platform === "gemini" ? "Gemini" : "ChatGPT"))));
    });
    renderDesigned();
  }

  function useDesigned(lineId, taskId) {
    state.preset = lineId;
    state.taskId = taskId;
    state.currentRound = 1;
    const o = state.opts[taskId] || (state.opts[taskId] = {});
    if (taskId === "creature-model-rig" || taskId === "model-rig") { o.scope = "single"; o.source_pack = ""; }
    renderAll();
  }

  function renderDesigned() {
    const box = $("#designed"); if (!box) return;
    box.replaceChildren();
    if (!DESIGNED.length) { box.append(el("p", { class: "muted" }, "沒有已設計項目（designed.js 未載入）。")); return; }
    DESIGNED.forEach(d => {
      const on = state.preset === d.line_id;
      box.append(el("div", { class: "designed" + (on ? " on" : "") },
        el("span", { class: "tname" }, d.code_zh + " · " + d.title_zh),
        el("span", { class: "tmeta" }, d.line_id + " · " + d.element),
        el("div", { class: "row" },
          el("button", { type: "button", class: "btn mini" + (on && state.taskId === "creature-concept" ? "" : " ghost"), onclick: () => useDesigned(d.line_id, "creature-concept") }, "🎨 立繪 prompt"),
          el("button", { type: "button", class: "btn mini" + (on && (state.taskId === "creature-model-rig" || state.taskId === "model-rig") ? "" : " ghost"), onclick: () => useDesigned(d.line_id, "creature-model-rig") }, "🧊 img-to-3D prompt"))));
    });
    if (state.preset) box.append(el("button", { type: "button", class: "btn mini ghost", onclick: () => { state.preset = null; renderAll(); } }, "✕ 取消已設計項目（回到隨機概念）"));
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
    return el("div", { class: "field" }, el("label", {}, f.label), control, el("div", { class: "fctl" }, edit, dice, lockBtn));
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
        el("button", { type: "button", class: "btn mini ghost", onclick: () => { o.source_pack = ""; o.input_img = ""; renderAll(); } }, "✕ 取消選擇")
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
    if (!is3dType(t.id)) {
      tabsBox.style.display = "none";
      return;
    }
    tabsBox.style.display = "inline-flex";
    tabsBox.replaceChildren();
    const modes = [
      { v: "single", zh: "🎯 指定處理模式" },
      { v: "batch", zh: "📦 批量處理模式" }
    ];
    modes.forEach(m => {
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
    t.options.filter(d => d.key !== "scope" && (!d.when || d.when(o)) && (d.key !== "stage" || !isCreatureStageTask(t, o))).forEach(d => {
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
          placeholder: d.placeholder || (isChr3d ? "或手動輸入角色立繪包 ID，例 chr-20261106-7f3a-2105" : "或手動輸入宙獸立繪包 ID，例 cr-20261106-7f3a-2105-adult"),
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
          el("button", { type: "button", class: "btn mini ghost", title: "載入系統內建測試包至審查台", onclick: () => { loadSampleFixtures(); renderAll(); } }, "🧪 載入範例包"),
          el("button", { type: "button", class: "btn mini ghost", title: "從本機選擇 Zip 載入審查台", onclick: () => $("#zipFileInput").click() }, "🗜️ 載入 Zip"),
          el("button", { type: "button", class: "btn mini ghost", title: "前往成果審查台進行立繪檢閱", onclick: () => setViewMode("review") }, "🔍 轉至審查台")
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
              el("button", { type: "button", class: "btn mini ghost", onclick: () => { o.input_img = ""; renderAll(); } }, "✕ 重設為全套視圖")
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

    if (b.rounds && b.rounds.length) {
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

    $("#prompt").value = b.errors.length ? "⚠ " + b.errors.join("\n⚠ ") : displayedText;
    $("#copy").disabled = $("#download").disabled = b.errors.length > 0;
    $("#header").textContent = b.ctx.header;
    $("#chars").textContent = displayedText.length.toLocaleString() + " 字元";
    const root = state.root || DEFAULT_ROOT;
    const dest = root + "\\" + t.drop.replace(/\//g, "\\");
    const cmd = 'powershell unpack_incoming.ps1 -Pattern "' + b.ctx.taskId + '*"';
    if (t.drive) {
      const zips = b.ctx.taskId + (b.ctx.opts.scope === "batch" ? "*" : "") + ".zip";
      const dcmd = 'powershell unpack_incoming.ps1 -Pattern "' + b.ctx.taskId + '*"';
      $("#deliver").replaceChildren(
        el("ol", {},
          el("li", {}, "先把角色/宙獸立繪包（", el("code", {}, "chr-*.zip / cr-*.zip"), "）放到雲端硬碟 ", el("code", {}, "project/cosmos_chimera/image_in/")),
          el("li", {}, "按「複製 prompt」→「開啟 Gemini」切到任務模式貼上送出"),
          el("li", {}, "處理完成之立繪包會自動移至相鄰之 ", el("code", {}, "project/cosmos_chimera/image_backup/"), " 歸檔，避免重複處理"),
          el("li", {}, "完成後從雲端硬碟 ", el("code", {}, "project/cosmos_chimera/3D_out/"), " 下載 ", el("code", {}, zips), " 到本專案 ", el("code", {}, "Art/_incoming/"), "（審查檔案均放在本專案）"),
          el("li", {}, "進入本專案「成果審查台」進行 3D 與立繪對比審查，審查確認後解壓至 ", el("code", {}, dest + "\\"), "。")
        ),
        el("div", { class: "cmd" }, el("code", {}, dcmd), el("button", { type: "button", class: "btn ghost mini", onclick: () => copyText(dcmd, "已複製解壓指令") }, "複製")),
        el("div", { style: "margin-top:8px;display:flex;gap:8px;align-items:center;" },
          el("button", { type: "button", class: "btn mini", onclick: () => { setViewMode("review"); $("#directUnpackFileInput")?.click(); } }, "⚡ 轉至審查台解壓至 cosmos_chimera"),
          el("span", { class: "muted" }, "或在終端機執行 unpack_incoming.ps1 批次解壓")
        )
      );
      return;
    }
    $("#deliver").replaceChildren(
      el("ol", {},
        el("li", {}, "按「複製 prompt」→「開啟 " + (state.platform === "gemini" ? "Gemini" : "ChatGPT") + "」貼上送出", state.platform === "gemini" ? "（先切到任務/Agent 模式）" : "", "。後續任務（3D/動作）可把前一包的概念圖、concept.json、rig_spec.json 一起附上。"),
        el("li", {}, "下載 ", el("code", {}, b.ctx.taskId + ".zip"), " 存放到本專案 ", el("code", {}, "Art/_incoming/"), "（立繪與 3D 審查檔案均統一放在本專案）。"),
        el("li", {}, "進入「成果審查台」點選「📂 掃描本專案審查目錄」進行檢閱與覆核。"),
        el("li", {}, "審查通過後，點選「⚡ 解壓至 cosmos_chimera」解壓至遊戲專案（", el("code", {}, dest + "\\"), "）。")
      ),
      el("div", { class: "cmd" }, el("code", {}, cmd), el("button", { type: "button", class: "btn ghost mini", onclick: () => copyText(cmd, "已複製解壓指令") }, "複製")),
      el("div", { style: "margin-top:8px;display:flex;gap:8px;align-items:center;" },
        el("button", { type: "button", class: "btn mini", onclick: () => { setViewMode("review"); $("#directUnpackFileInput")?.click(); } }, "⚡ 轉至審查台解壓至 cosmos_chimera"),
        el("span", { class: "muted" }, "或在終端機執行 unpack_incoming.ps1 批次解壓")
      ),
      el("p", { class: "muted" }, "若圖片沒有被打包進 zip：照 manifest.files 的檔名手動存到本專案 ", el("code", {}, "Art/_incoming/" + b.ctx.taskId + "/images/"), " 進行審查。")
    );
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
    renderTasks(); renderConcepts(); renderOptions(); renderForge3dModeTabs(); renderForgeStageTabs(); renderOutput(); renderHistory();
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
      if (pkg.manifest?.source_pack) {
        const found = reviewState.packages.find(p => p.id === pkg.manifest.source_pack);
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
    let manifestData = null, conceptData = null, rawPrompt = "", prefix = "";
    let animSpec = null, rigSpec = null, glbFile = null, animFiles = [];
    for (const path in files) {
      if (path.endsWith("manifest.json")) {
        try { manifestData = JSON.parse(new TextDecoder().decode(files[path])); } catch (e) {}
        prefix = path.slice(0, path.lastIndexOf("manifest.json"));
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
        const blob = new Blob([files[path]], { type: "model/gltf-binary" });
        glbFile = { path: rel, url: URL.createObjectURL(blob), buffer: files[path].buffer, uint8: files[path] };
      } else if (path.endsWith(".fbx") && (path.includes("anim") || path.includes("models"))) {
        const rel = path.startsWith(prefix) ? path.slice(prefix.length) : path;
        animFiles.push({ path: rel, size: files[path].length });
      }
    }
    let alignedStaged = null;
    if (!manifestData || !conceptData) {
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
      isZip: true,
      aligned: !!alignedStaged,
      stagedTaskId: alignedStaged?.taskId || null,
      status: manifestData?.missing?.length ? "missing" : "pending"
    };
    addPackage(pkg);
    return pkg;
  }

    function addPackage(pkg) {
      if (!pkg.baseId || pkg.stage === undefined) {
        const info = parsePackageStage(pkg.id, pkg.manifest, pkg.concept);
        pkg.stage = info.stage;
        pkg.baseId = info.baseId;
      }
      pkg.groupKey = (pkg.type === "creature-concept" || pkg.id.startsWith("cr"))
        ? (pkg.baseId || pkg.subjectId || pkg.id)
        : (is3dType(pkg.type) || pkg.id.startsWith("mdl"))
        ? (pkg.baseId || pkg.id)
        : pkg.id;

      const idx = reviewState.packages.findIndex(p => p.id === pkg.id);
      if (idx >= 0) reviewState.packages[idx] = pkg;
      else reviewState.packages.unshift(pkg);
      reviewState.activePkgId = pkg.id;
      if (pkg.stage) reviewState.activeStage = pkg.stage;
      reviewState.activeImgIdx = 0;
      try {
        renderReviewView();
      } catch (e) {
        console.error("renderReviewView failed for package " + pkg.id, e);
      }
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
        status: "ok"
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
        status: "ok"
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
        status: "ok"
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
        status: "ok"
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
        status: "pending"
      },
      {
        id: "chr-20261106-7f3a-2105",
        type: "character-concept",
        subjectId: "chr_7f3a",
        manifest: {
          spec: "cosmimera-art-task/1",
          task_header: "[COSMIMERA-TASK spec=1 tool=1.9.0 catalog=2.1.0 template=character-concept@3.0.0 task_id=chr-20261106-7f3a-2105 seed=7f3a]",
          task_id: "chr-20261106-7f3a-2105",
          task_type: "character-concept",
          subject_id: "chr_7f3a",
          produced_by: "ChatGPT",
          files: [
            { path: "concept.json", kind: "spec", level: "L1" },
            { path: "images/chr_7f3a_main.png", kind: "main", level: "L1" },
            { path: "images/chr_7f3a_turnaround.png", kind: "turnaround", level: "L1" },
            { path: "images/chr_7f3a_expressions.png", kind: "sheet", level: "L1" },
            { path: "images/chr_7f3a_props.png", kind: "sheet", level: "L1" }
          ],
          missing: [],
          notes: "服裝符合機能風格，各插槽骨掛點清楚"
        },
        concept: {
          id: "chr_7f3a", name_zh: "林晴陽", name_en: "Haruhi",
          role: "玩家角色預設外觀", ethnicity: "東亞體系", region: "東亞", timeline: "晶石賽博/霓虹魔導義體紀元",
          gender: "女", age_band: "青少年", age: 17, height: "163 cm", weight: "51.5 kg", body_fat: "21.5%",
          cup_size: "C",
          outfit_palette: ["海軍深藍", "象牙米白", "黃銅金", "清透天藍"],
          hair_palette: ["曜石純黑", "清透天藍"],
          eye_palette: ["琥珀金"],
          personality: ["熱血", "好奇"], style: "街頭機能 × 學院制服改造",
          interests: ["星際探索", "古文字解密"], likes: ["熱奶茶", "發光晶石"], dislikes: ["冗長報告"],
          vessel: "talisman_card", vessel_zh: "符籙卡片",
          biography: "林晴陽自幼生活於新興的晶石賽博大都會，從小著迷於古老星圖與魔導義體技術的共生可能。身著街頭機能學院制服的她，常年攜帶改造版符籙卡片穿梭於霓虹地下市集，對未知的宙獸生命充滿無盡好奇。她以特立獨行的熱忱與果敢的行動力，誓要在浩瀚宙域中繪製屬於新時代的開拓圖鑑。"
        },
        images: [
          { path: "images/chr_7f3a_main.png", url: createSampleSvgDataUrl("角色立繪 · 晴陽 (163cm, 罩杯C)", "#2980b9") },
          { path: "images/chr_7f3a_turnaround.png", url: createSampleSvgDataUrl("角色三視圖 · T-pose 灰底", "#7f8c8d") },
          { path: "images/chr_7f3a_expressions.png", url: createSampleSvgDataUrl("表情集 2×3", "#8e44ad") },
          { path: "images/chr_7f3a_props.png", url: createSampleSvgDataUrl("道具板 · 符籙卡片與背包", "#16a085") }
        ],
        fileCount: 5,
        status: "ok"
      },
      {
        id: "mdl-20261106-7f3a-2106",
        type: "character-model-rig",
        baseId: "mdl-20261106-7f3a-2106",
        subjectId: "chr_7f3a",
        manifest: {
          spec: "cosmimera-art-task/1",
          task_header: "[COSMIMERA-TASK spec=1 tool=2.0.0 catalog=1.3.0 template=character-model-rig@4.1.0 task_id=mdl-20261106-7f3a-2106 seed=7f3a]",
          task_id: "mdl-20261106-7f3a-2106",
          task_type: "character-model-rig",
          subject_id: "chr_7f3a",
          source_pack: "chr-20261106-7f3a-2105",
          produced_by: "Gemini Argon",
          files: [
            { path: "images/chr_7f3a_model_front.png", kind: "view", level: "L1" },
            { path: "images/chr_7f3a_model_side.png", kind: "view", level: "L1" },
            { path: "images/chr_7f3a_model_back.png", kind: "view", level: "L1" },
            { path: "images/chr_7f3a_anim_sheet_01.png", kind: "sheet", level: "L1" },
            { path: "rig/rig_spec.json", kind: "spec", level: "L1" },
            { path: "rig/build_rig.py", kind: "script", level: "L1" },
            { path: "anims/anim_spec.json", kind: "spec", level: "L1" },
            { path: "anims/keyframes.py", kind: "script", level: "L1" },
            { path: "pipeline/run_all.py", kind: "script", level: "L1" },
            { path: "pipeline/README.md", kind: "report", level: "L1" }
          ],
          missing: [
            { item: "models/chr_7f3a.glb", level: "L2", reason: "no 3D generation on this platform" }
          ],
          notes: "由角色立繪包 chr-20261106-7f3a-2105 生成 Humanoid 3D 建模正交視圖與骨架動作規格"
        },
        images: [
          { path: "images/chr_7f3a_model_front.png", url: createSampleSvgDataUrl("御靈召喚使 · 建模正交正面 2048px", "#2980b9") },
          { path: "images/chr_7f3a_model_side.png", url: createSampleSvgDataUrl("御靈召喚使 · 建模正交側面 2048px", "#1f618d") },
          { path: "images/chr_7f3a_model_back.png", url: createSampleSvgDataUrl("御靈召喚使 · 建模正交背面 2048px", "#154360") },
          { path: "images/chr_7f3a_anim_sheet_01.png", url: createSampleSvgDataUrl("動作關鍵幀分鏡 · 御靈召喚使", "#16a085") }
        ],
        fileCount: 11,
        status: "pending"
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
      if (handle.kind === "directory" && (name.startsWith("chr-") || name.startsWith("cr-") || name.startsWith("mdl-") || name.startsWith("anim-") || name.startsWith("fx-") || name.startsWith("vsl-"))) {
        await loadFromDirHandle(name, handle);
        foundCount++;
      } else if (handle.kind === "file" && name.endsWith(".zip")) {
        const file = await handle.getFile();
        await loadZipFile(file);
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
    if (!fileList || !fileList.length) return;
    toast("正在讀取資料夾檔案...");
    const taskGroups = {};
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const rel = file.webkitRelativePath || file.name;
      const parts = rel.split("/");
      // 判斷是否直接選中了 Art/_incoming 目錄，或者選中了某個 task 資料夾
      let taskId = "";
      let subPath = "";
      for (let p = 0; p < parts.length; p++) {
        if (/^(chr-|cr-|mdl-|anim-|fx-|vsl-)/.test(parts[p])) {
          taskId = parts[p];
          subPath = parts.slice(p + 1).join("/");
          break;
        }
      }
      if (taskId) {
        if (!taskGroups[taskId]) taskGroups[taskId] = [];
        taskGroups[taskId].push({ file, subPath });
      } else if (file.name.endsWith(".zip")) {
        await loadZipFile(file);
      }
    }

    let loadedCount = 0;
    for (const taskId in taskGroups) {
      const entries = taskGroups[taskId];
      let manifestData = null, conceptData = null, rawPrompt = "";
      let animSpec = null, rigSpec = null, glbFile = null, animFiles = [];
      const images = [];
      let fileCount = entries.length;

      for (const item of entries) {
        const fn = item.subPath || item.file.name;
        if (fn.endsWith("manifest.json")) {
          try { manifestData = JSON.parse(await item.file.text()); } catch (e) {}
        } else if (fn.endsWith("concept.json")) {
          try { conceptData = JSON.parse(await item.file.text()); } catch (e) {}
        } else if (fn.endsWith(".prompt.md") || fn === "prompt.md") {
          try { rawPrompt = await item.file.text(); } catch (e) {}
        } else if (fn.endsWith("anim_spec.json")) {
          try { animSpec = JSON.parse(await item.file.text()); } catch (e) {}
        } else if (fn.endsWith("rig_spec.json")) {
          try { rigSpec = JSON.parse(await item.file.text()); } catch (e) {}
        } else if (fn.endsWith(".glb")) {
          try {
            const buf = await item.file.arrayBuffer();
            glbFile = { path: fn, url: URL.createObjectURL(item.file), buffer: buf, file: item.file };
          } catch (e) {}
        } else if (fn.endsWith(".fbx") && (fn.includes("anim") || fn.includes("models"))) {
          animFiles.push({ path: fn, size: item.file.size });
        } else if (/\.(png|jpe?g|webp)$/i.test(fn)) {
          images.push({ path: fn, url: URL.createObjectURL(item.file) });
        }
      }

      let alignedStaged = null;
      if (!manifestData || !conceptData) {
        alignedStaged = findMatchingStagedFormat(taskId, entries.map(e => e.subPath || e.file.name));
        if (alignedStaged) {
          if (!manifestData) manifestData = alignedStaged.manifest;
          if (!conceptData) conceptData = alignedStaged.concept;
          if (!rawPrompt) rawPrompt = alignedStaged.prompt;
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
        glbFile,
        animSpec,
        rigSpec,
        animFiles,
        fileCount,
        aligned: !!alignedStaged,
        stagedTaskId: alignedStaged?.taskId || null,
        status: manifestData?.missing?.length ? "missing" : "pending"
      };
      addPackage(pkg);
      loadedCount++;
    }
    toast(`已讀取 ${loadedCount} 個任務資料夾`);
  }

  async function loadFromDirHandle(taskId, dirHandle) {
    let manifestData = null, conceptData = null, rawPrompt = "";
    const images = [];
    let fileCount = 0;
    try {
      const mfFile = await (await dirHandle.getFileHandle("manifest.json")).getFile();
      manifestData = JSON.parse(await mfFile.text());
    } catch (e) {}
    try {
      const cpFile = await (await dirHandle.getFileHandle("concept.json")).getFile();
      conceptData = JSON.parse(await cpFile.text());
    } catch (e) {}

    // 嘗試讀取 prompt.md
    for await (const [pname, phandle] of dirHandle.entries()) {
      if (phandle.kind === "file" && (pname.endsWith(".prompt.md") || pname === "prompt.md")) {
        try { rawPrompt = await (await phandle.getFile()).text(); } catch (e) {}
      }
    }

    // 讀取 images 目錄
    try {
      const imgDir = await dirHandle.getDirectoryHandle("images");
      for await (const [iname, ihandle] of imgDir.entries()) {
        if (ihandle.kind === "file" && /\.(png|jpe?g|webp)$/i.test(iname)) {
          const file = await ihandle.getFile();
          images.push({ path: "images/" + iname, url: URL.createObjectURL(file) });
          fileCount++;
        }
      }
    } catch (e) {}

    // 讀取 models 目錄 (glb / fbx 3D 模型)
    let glbFile = null, animSpec = null, rigSpec = null, animFiles = [];
    try {
      const mdlDir = await dirHandle.getDirectoryHandle("models");
      for await (const [mname, mhandle] of mdlDir.entries()) {
        if (mhandle.kind === "file") {
          const file = await mhandle.getFile();
          fileCount++;
          if (mname.endsWith(".glb")) {
            try {
              const buf = await file.arrayBuffer();
              glbFile = { path: "models/" + mname, url: URL.createObjectURL(file), buffer: buf, file };
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    // 讀取 anims 目錄 (anim_spec.json 與動作 fbx)
    try {
      const animDir = await dirHandle.getDirectoryHandle("anims");
      for await (const [aname, ahandle] of animDir.entries()) {
        if (ahandle.kind === "file") {
          const file = await ahandle.getFile();
          fileCount++;
          if (aname === "anim_spec.json" || aname.endsWith("anim_spec.json")) {
            try { animSpec = JSON.parse(await file.text()); } catch (e) {}
          } else if (aname.endsWith(".fbx")) {
            animFiles.push({ path: "anims/" + aname, size: file.size });
          }
        }
      }
    } catch (e) {}

    // 讀取 rig 目錄 (rig_spec.json)
    try {
      const rigDir = await dirHandle.getDirectoryHandle("rig");
      for await (const [rname, rhandle] of rigDir.entries()) {
        if (rhandle.kind === "file") {
          const file = await rhandle.getFile();
          fileCount++;
          if (rname === "rig_spec.json" || rname.endsWith("rig_spec.json")) {
            try { rigSpec = JSON.parse(await file.text()); } catch (e) {}
          }
        }
      }
    } catch (e) {}

    let alignedStaged = null;
    if (!manifestData || !conceptData) {
      alignedStaged = findMatchingStagedFormat(taskId, images.map(i => i.path));
      if (alignedStaged) {
        if (!manifestData) manifestData = alignedStaged.manifest;
        if (!conceptData) conceptData = alignedStaged.concept;
        if (!rawPrompt) rawPrompt = alignedStaged.prompt;
        try {
          if (manifestData) {
            const mfH = await dirHandle.getFileHandle("manifest.json", { create: true });
            const w = await mfH.createWritable();
            await w.write(JSON.stringify(manifestData, null, 2));
            await w.close();
          }
          if (conceptData) {
            const cpH = await dirHandle.getFileHandle("concept.json", { create: true });
            const w = await cpH.createWritable();
            await w.write(JSON.stringify(conceptData, null, 2));
            await w.close();
          }
          if (rawPrompt) {
            const prH = await dirHandle.getFileHandle(alignedStaged.taskId + ".prompt.md", { create: true });
            const w = await prH.createWritable();
            await w.write(rawPrompt);
            await w.close();
          }
        } catch (e) {}
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
      glbFile,
      animSpec,
      rigSpec,
      animFiles,
      fileCount,
      dirHandle,
      aligned: !!alignedStaged,
      stagedTaskId: alignedStaged?.taskId || null,
      status: manifestData?.missing?.length ? "missing" : "pending"
    };
    addPackage(pkg);
  }

  function getActivePkg() {
    return reviewState.packages.find(p => p.id === reviewState.activePkgId) || reviewState.packages[0] || null;
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
      const statZh = repPkg.status === "ok" ? "✅ 合規" : repPkg.status === "reject" ? "❌ 退回" : repPkg.status === "missing" ? "⚠️ 缺檔" : "🟨 待審";
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
    badge.className = "badge " + pkg.status;
    badge.textContent = pkg.status === "ok" ? "已通過" : pkg.status === "reject" ? "需修改" : pkg.status === "missing" ? "有缺檔" : "待審核";

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
    if (reviewState.three.clips?.length) {
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
    if (!glbBuffer && targetPkg.rawFiles) {
      for (const p in targetPkg.rawFiles) {
        if (p.endsWith(".glb")) {
          glbBuffer = targetPkg.rawFiles[p].buffer;
          break;
        }
      }
    }

    const onModelLoaded = (model, animations) => {
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
            buildProcedural3dRig(targetPkg, onModelLoaded);
          });
        } else {
          loader.load(targetPkg.glbUrl, gltf => onModelLoaded(gltf.scene, gltf.animations), undefined, err => {
            console.error("GLTF load url error:", err);
            buildProcedural3dRig(targetPkg, onModelLoaded);
          });
        }
      } else {
        buildProcedural3dRig(targetPkg, onModelLoaded);
      }
    } else {
      buildProcedural3dRig(targetPkg, onModelLoaded);
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
      infoBadge.textContent = `| ${stats.faceCount.toLocaleString()} 面 · ${stats.vertCount.toLocaleString()} 頂點 · ${clips.length} 組動作`;
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
          el("button", { class: "btn ghost mini", type: "button", onclick: () => exportAnimReviewReport(targetPkg, clips, verifiedMap) }, "⬇ 匯出動作報告 (.json)")
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
              el("span", { class: "prompt-k" }, "戰鬥 / 性情"), el("span", { class: "prompt-v" }, (c.role || "前排肉盾") + " · " + (c.temperament || "好鬥凶悍"))
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
          el("button", { class: "btn ghost mini", type: "button", onclick: () => download(pkg.id + ".prompt.md", getFullPromptText(pkg), "text/markdown") }, "⬇ 下載 prompt.md"),
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
          el("button", { class: "segb" + (pkg.status === "ok" ? " on" : ""), type: "button", onclick: () => { pkg.status = "ok"; saveReview(pkg); renderReviewView(); } }, "✅ 核准通過"),
          el("button", { class: "segb" + (pkg.status === "pending" ? " on" : ""), type: "button", onclick: () => { pkg.status = "pending"; saveReview(pkg); renderReviewView(); } }, "🟨 待修改"),
          el("button", { class: "segb" + (pkg.status === "reject" ? " on" : ""), type: "button", onclick: () => { pkg.status = "reject"; saveReview(pkg); renderReviewView(); } }, "❌ 退回拒絕")
        ),
        el("textarea", { id: "revNote", placeholder: "填寫人工審查意見（例如：身高比例良好，但服裝配色需微調；臉部表情需更生動...）", onchange: e => { saveReview(pkg, e.target.value); } }, getReviewNote(pkg)),
        el("div", { style: "display:flex;gap:6px;margin-top:6px;flex-wrap:wrap" },
          el("button", { class: "btn mini", type: "button", onclick: () => { saveReview(pkg, $("#revNote")?.value); toast("已儲存審查結果"); } }, "💾 儲存審查意見"),
          el("button", { class: "btn ghost mini", type: "button", onclick: () => exportReviewReport(pkg) }, "⬇ 下載審查報告 (.json)"),
          el("button", { class: "btn ghost mini", type: "button", title: "移至備份區（自動加入時間戳）", onclick: () => backupActivePackage(pkg) }, "📦 移至備份區 (含時間戳)")
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
          el("button", { class: "btn mini", type: "button", onclick: () => unpackPackageToDisk(pkg) }, "⚡ 實體解壓至本專案審查目錄"),
          el("button", { class: "btn ghost mini", type: "button", onclick: () => deployPackageToGame(pkg) }, "🚀 交付至 cosmos_chimera")
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

  function getReviewNote(pkg) {
    return reviewState.reviews[pkg.id]?.note || "";
  }
  function saveReview(pkg, note) {
    reviewState.reviews[pkg.id] = { status: pkg.status, note: note ?? getReviewNote(pkg), time: new Date().toLocaleString() };
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewState.reviews)); } catch (e) {}
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
      $("#reviewView").classList.add("active");
      $("#viewBtnForge").classList.remove("on");
      $("#viewBtnReview").classList.add("on");
      $("#forgeHeaderControls").style.display = "none";
      if (!reviewState.packages.length) {
        const autoScanned = await tryAutoScanIncoming();
        if (!autoScanned && !reviewState.packages.length) {
          loadSampleFixtures();
        }
      } else {
        renderReviewView();
      }
    } else {
      $("#forgeView").style.display = "grid";
      $("#reviewView").classList.remove("active");
      $("#viewBtnForge").classList.add("on");
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
        preset: state.preset
      }));
    } catch (e) {}
  }
  function load() {
    try {
      const revs = JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
      reviewState.reviews = revs;
      const d = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!d) return false;
      const sameMajor = (d.catalog || "").split(".")[0] === C.version.split(".")[0];
      Object.assign(state, {
        platform: d.platform || "chatgpt", history: d.history || [], root: d.root || "", notes: d.notes || "",
        customOptions: d.customOptions || {},
        preset: DESIGNED.some(x => x.line_id === d.preset) ? d.preset : null
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
    $("#viewBtnReview").addEventListener("click", () => setViewMode("review"));
    $("#toReview").addEventListener("click", () => setViewMode("review"));

    // 平台切換按鈕事件
    $("#platChatgpt").addEventListener("click", () => { state.platform = "chatgpt"; renderAll(); });
    $("#platGemini").addEventListener("click", () => { state.platform = "gemini"; renderAll(); });

    $("#reroll").addEventListener("click", () => reseed(newSeed(), true));
    $("#seed").addEventListener("change", e => reseed(e.target.value, true));
    $("#notes").addEventListener("input", e => { state.notes = e.target.value; renderOutput(); save(); });
    $("#copy").addEventListener("click", () => {
      const b = build();
      if (b.errors.length) { toast("Prompt 存在錯誤，無法複製"); return; }
      const staged = generateAndStageFormats(b);
      copyText($("#prompt").value, `已複製 Prompt！同時產生時間戳格式包 (${staged.taskId})，供審查台自動對齊封裝`);
      record();
    });

    // 多輪次獨立複製按鈕
    $("#btnCopyR1")?.addEventListener("click", () => {
      const b = build();
      if (b.errors.length) { toast("Prompt 存在錯誤，無法複製"); return; }
      if (!b.rounds || !b.rounds[0]) return;
      state.currentRound = 1;
      renderOutput();
      const staged = generateAndStageFormats(b);
      const isEvo = b.ctx.opts?.stage && b.ctx.opts.stage !== "juvenile" && b.ctx.task.id === "creature-concept";
      const hint = isEvo ? `已複製第 1 輪 (正面圖) Prompt！請先上傳前一階正面圖再貼入生成` : `已複製第 1 輪 (正面圖) Prompt！已產生時間戳對齊包 (${staged.taskId})`;
      copyText(b.rounds[0].prompt, hint);
      record();
    });

    $("#btnCopyR2")?.addEventListener("click", () => {
      const b = build();
      if (b.errors.length) { toast("Prompt 存在錯誤，無法複製"); return; }
      if (!b.rounds || !b.rounds[1]) return;
      state.currentRound = 2;
      renderOutput();
      copyText(b.rounds[1].prompt, `已複製第 2 輪 (三視圖) Prompt！請貼入同對話接續生成`);
      record();
    });

    $("#btnCopyR3")?.addEventListener("click", () => {
      const b = build();
      if (b.errors.length) { toast("Prompt 存在錯誤，無法複製"); return; }
      if (!b.rounds || !b.rounds[2]) return;
      state.currentRound = 3;
      renderOutput();
      copyText(b.rounds[2].prompt, `已複製第 3 輪 (主立繪) Prompt！請貼入同對話接續生成`);
      record();
    });
    $("#download").addEventListener("click", () => { download(lastBuild.ctx.taskId + ".prompt.md", $("#prompt").value, "text/markdown"); record(); });
    $("#export").addEventListener("click", () => {
      const b = lastBuild; if (!b.ctx.concept) { toast("此任務沒有概念"); return; }
      download(b.ctx.subjectId + ".concept.json", JSON.stringify(b.ctx.concept, null, 2), "application/json");
    });
    $("#open").addEventListener("click", () => window.open(state.platform === "gemini" ? "https://gemini.google.com/app" : "https://chatgpt.com/", "_blank", "noopener"));
    $("#root").addEventListener("change", e => { state.root = e.target.value.trim().replace(/[\\/]+$/, ""); renderOutput(); save(); });

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
      unpackPackageToDisk(pkg);
    });
    // 審查通過，交付部署至 cosmos_chimera
    $("#btnDeployGame")?.addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) { toast("請先選取任務包"); return; }
      deployPackageToGame(pkg);
    });
    $("#btnExportAlignedZip")?.addEventListener("click", () => {
      const pkg = getActivePkg();
      if (!pkg) { toast("請先選取任務包"); return; }
      if (!pkg.rawFiles || !Object.keys(pkg.rawFiles).length) {
        toast("此任務包沒有可打包的檔案");
        return;
      }
      const blob = createZipBlob(pkg.rawFiles);
      const a = el("a", { href: URL.createObjectURL(blob), download: pkg.id + ".zip" });
      document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast("已打包下載完整 Zip（含立繪圖檔、manifest.json、concept.json 與 prompt.md）");
    });
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
  document.addEventListener("DOMContentLoaded", init);
})();