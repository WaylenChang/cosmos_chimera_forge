// Portrait prompts support manual clipboard and on-demand automated Drive .md output.
(function () {
  "use strict";
  const stages = {
    appearance: "00_appearance", portrait: "01_portrait", review_portrait: "02_review_portrait",
    colab: "03a_colab", blender: "03b_blender", review_3d: "04_review_3d",
    encyclopedia: "05_encyclopedia"
  };
  const templates = {};
  const templatesByKind = new Map();
  let loadedTemplateKind = null;
  const modeKey = "cosmimera.portrait-mode.v1";
  let portraitMode = "manual";
  let graphMode = null;
  try {
    if (window.localStorage?.getItem(modeKey) === "auto") portraitMode = "auto";
  } catch (_) {
    // Private browsing may restrict localStorage; manual is a safe default.
  }
  const $ = id => document.getElementById(id);
  const defaults = {schema: "cosmi-pipeline/1", image_format: "png", views: ["front", "turnaround", "main"],
    model_formats: ["glb", "blend"], animation_clips: ["idle", "walk", "attack"],
    image_specs: {front: {aspect: "1:1", view: "正面正交、自然平正站姿、全身"}, turnaround: {aspect: "16:9", view: "正側背視角、同比例、全身"}, main: {aspect: "1:1", view: "動態主立繪、全身"}}, embed_textures: true, units: "meters", texture_size: 2048, triangle_budget: 30000};
  function parameters() {
    const p = JSON.parse($("pipelineParameters")?.value || JSON.stringify(defaults));
    if (!p || Array.isArray(p) || typeof p !== "object") throw Error("格式參數必須是 JSON 物件");
    if (p.image_format !== "png" || !Array.isArray(p.views) || !p.views.length || !p.views.every(x => /^[a-z][a-z0-9_]*$/.test(x))) throw Error("views 必須是非空的檔名陣列，image_format 須為 png");
    if (!Array.isArray(p.model_formats) || !["glb", "blend"].every(x => p.model_formats.includes(x))) throw Error("model_formats 需包含 glb 與 blend");
    return p;
  }
  function appearance(ctx, { pureVisual = false } = {}) {
    // Concept parameters are the sole appearance source; notes provide explicit amendments.
    const base = ctx.concept || {};
    const selected = base.locked?.stages?.find(s => s.stage === ctx.opts?.stage) || {};
    const concept = {...base, ...selected, stage: ctx.opts?.stage || base.stage};
    const visualFields = ["name_zh", "name_en", "stage", "gender", "age", "body_type", "outfit_palette", "hair_palette", "eye_palette", "silhouette_keywords", "style", "pose", "element_palettes", "elements", "size_profile", "height", "height_length", "appearance", "look", "size_class", "appearance_palette", "hair", "eyes", "outfit", "accessories", "base_parents", "bases", "motifs"];
    const wikiFields = pureVisual ? [] : ["archetype", "disposition", "social_structure", "reproduction", "formula"];
    const fields = [...visualFields, ...wikiFields];
    const lines = fields.filter(k => concept[k] != null).map(k => k + ": " + (typeof concept[k] === "object" ? JSON.stringify(concept[k]) : concept[k]));
    if (ctx.notes?.trim()) lines.push("補充／修改: " + ctx.notes.trim());
    return lines.join("\n") || "請先於設計概念參數設定角色／宙獸外觀";
  }
  // A task runs from exactly one versioned stage template; stale Drive files cannot inject old steps.
  const localTemplates = {
    "appearance": "# 外觀設定\n依本次素材撰寫繁體中文原創外觀，只描述輪廓、體型比例、臉／感知器官、肢體、配色材質、服裝／表面構造與辨識特徵；保留已定特徵，不加入遊戲數值或後續製圖、建模指示。\n素材：\n{{appearance}}",
    "review_portrait": "# 立繪審查\n待審：{{input_path}}/\n依該包外觀與參數檢查圖檔完整性、全身構造、視角與配色一致性、遮擋、瑕疵及水印。\n輸出逐檔缺陷、位置與建議通過／退件；只供人工決策，不修圖、不移動資產或代為核准。",
    "colab": "# Colab GPU Image-to-3D\n{{model_input}}\n參數：`{{parameters_path}}`；輸出：`{{output_path}}/`\n先確認 Colab GPU 與生成模型可用，產生初始網格後交 Blender 修整、綁骨與匯出；無法執行則說明阻塞。\n1. 判定原型（人形、怪物、生物、奇幻生物或超自然物件），搜尋並查閱相關外形、解剖、材質、骨架與運動資料；無法搜尋則註明。\n2. 依本次輸入全新設計並建模，不套用或抄襲舊 3D 檔；依生物或機械構造配置蒙皮、關節與動作。\n3. 由 Blender 直接儲存 `models/{{asset_id}}.blend`、匯出 `models/{{asset_id}}.glb`，保留拓撲、UV、材質與骨架。\n4. 每次修改後檢查正、背、左、右、上、下視角及動作關鍵幀：臉／感知器官不被遮擋，軀幹與肢體完整連接；無破面、孔洞、透視露空、錯誤法線／貼圖、部件互穿、離體或關節錯位及各部位獨立亂移。\n5. 重開 `.blend` 並重新匯入 `.glb` 驗證；交付 `models/`、`rig/`、`animations/`、`previews/`、`manifest.json`，記錄未完成項；不交 ZIP。",
    "blender": "# Blender Image-to-3D／Prompt-to-3D\n{{model_input}}\n參數：`{{parameters_path}}`；輸出：`{{output_path}}/`\n直接以 Blender 製作完整模型，不以粗糙幾何堆疊充當成品。\n1. 判定原型（人形、怪物、生物、奇幻生物或超自然物件），搜尋並查閱相關外形、解剖、材質、骨架與運動資料；無法搜尋則註明。\n2. 依本次輸入全新設計並建模，不套用或抄襲舊 3D 檔；依生物或機械構造配置蒙皮、關節與動作。\n3. 由 Blender 直接儲存 `models/{{asset_id}}.blend`、匯出 `models/{{asset_id}}.glb`，保留拓撲、UV、材質與骨架。\n4. 每次修改後檢查正、背、左、右、上、下視角及動作關鍵幀：臉／感知器官不被遮擋，軀幹與肢體完整連接；無破面、孔洞、透視露空、錯誤法線／貼圖、部件互穿、離體或關節錯位及各部位獨立亂移。\n5. 重開 `.blend` 並重新匯入 `.glb` 驗證；交付 `models/`、`rig/`、`animations/`、`previews/`、`manifest.json`，記錄未完成項；不交 ZIP。\n{{bestiary}}",
    "review_3d": "# 3D 模型審查\n模型：{{input_path}}/；來源立繪：{{source_path}}/\n依立繪（若有）、參數與 manifest 檢查 GLB／Blend 可用性、拓撲、材質、骨架及動畫變形、穿插與來源追溯。\nImage-to-3D 須有已核准來源立繪；Prompt-to-3D 無需補繪立繪。缺 `.glb`／`.blend` 不得通過。列明問題檔案及建議通過／退件；不補檔、不移動資產或代為核准。"
  };
  const templateMarker = stage => "<!-- COSMI-PIPELINE/2:" + stage + " -->";
  function pipelineRootFor(ctx) {
    if (window.COSMI_DRIVE?.pipelineRoot) return window.COSMI_DRIVE.pipelineRoot(ctx);
    const id = String(ctx?.task?.id || "");
    if (id === "move-vfx") return "moves";
    if (id.startsWith("character")) return "characters";
    if (id.startsWith("creature")) return "creatures";
    return /^chr[-_]/i.test(ctx?.subjectId || ctx?.taskId || "") ? "characters"
      : /^(?:fx|vsl)[-_]/i.test(ctx?.subjectId || ctx?.taskId || "") ? "moves"
      : "creatures";
  }
  function isCreature(ctx) {
    const id = ctx.task?.id || "";
    return id.startsWith("creature-") || ctx.task?.needs === "creature" ||
      (id === "model-rig" && /^cr[-_]/.test(ctx.subjectId || ctx.opts?.source_pack || ""));
  }
  function supports(ctx) { return ["character-concept", "creature-concept", "character-model-rig", "creature-model-rig", "model-rig", "move-vfx"].includes(ctx.task.id); }
  function build(ctx) {
    const stage = $("pipelineStage")?.value || "portrait";
    if (stage === "portrait" || stage === "move_vfx") {
      const content=ctx.task.nativeBuild ? ctx.task.nativeBuild(ctx) : ctx.task.build(ctx);
      if (!window.COSMI_WIKI || !supports(ctx))return content;
      const wiki=window.COSMI_WIKI.describe(ctx);
      const sourceNote = stage === "move_vfx" ? "僅引用，未建立時先執行獨立圖鑑步驟；不可重複生成" : "於外觀設定階段建立，此處僅引用；不可重複生成";
      return content + "\n\n圖鑑：" + wiki.path + "（" + sourceNote + "）。";
    }
    if (stage === "encyclopedia") {
      const wiki = window.COSMI_WIKI.describe(ctx);
      const kind = wiki.kind, subject = wiki.subject;
      const destination = wiki.path;
      const moveOptions = kind === "moves" ? Object.fromEntries(
        Object.entries(ctx.opts || {}).filter(([key]) => ["element","shape","tier","use_creature","action","motion","name"].includes(key))
      ) : null;
      const focus = kind === "moves" ?
        "主動技定位、施放條件、屬性、視覺形態、分鏡、效果節奏與動作規格" :
        kind === "characters" ? "角色身份、背景、外觀、服裝、性格、技能與設計變體" :
        "此階段宙獸原型、生態、棲息地、解剖結構、屬性、動作與主動技";
      return [
        "# 生成原創" + (kind === "moves" ? "主動技" : kind === "characters" ? "角色" : "宙獸") + "圖鑑",
        "對象：" + subject + (wiki.stage ? "；當前型態：" + wiki.stage : ""),
        "概念設定：", kind === "moves" ? JSON.stringify(moveOptions, null, 2) : appearance(ctx),
        "只依目前概念與已確認的素材建立圖鑑，不借用其他對象的圖鑑內容。",
        "內容包含：" + focus + "；只描述目前型態，不混入其他階段的外觀與主動技；未確認資料標示待核。",
        "先檢查此精確路徑是否已存在：存在則使用現有圖鑑，不重新生成；若需改版請明確要求更新，禁止建立副本。",
        "輸出 Markdown：" + destination,
        "圖鑑獨立於 3D 模型目錄；若需模型關聯，記錄現有 asset_id 與模型路徑，不複製 GLB。",
        "僅更新本對象的圖鑑，不修改或移動既有模型，也不得以產生圖鑑代替 3D QA 與最終驗收。"
      ].join("\n");
    }
    const raw = templatesByKind.get(pipelineRootFor(ctx))?.[stage];
    const normalized = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";
    const prefix = templateMarker(stage);
    const template = normalized.startsWith(prefix + "\n") ? normalized.slice(prefix.length).trim() : localTemplates[stage];
    if (!template) return "此步驟沒有可用的 Prompt 模板。";
    const is3D = stage === "colab" || stage === "blender";
    const active = window.COSMI_FORGE?.activePackage();
    const sourceId = String((stage === "review_3d" ? active?.sourcePack || active?.manifest?.source_pack : ctx.opts?.source_pack) || "").trim();
    const source = sourceId || "未指定";
    const root = pipelineRootFor(ctx);
    const subjectBase = (window.COSMI_DRIVE?.cleanSubjectId?.(root, ctx.subjectId || ctx.taskId) || ctx.subjectId || ctx.taskId);
    const subjectFolder = root + "/" + subjectBase;
    const sourcePath = window.COSMI_FORGE?.packages()?.find(p => p.id === sourceId)?.drivePath || (sourceId ? root + "/" + (window.COSMI_DRIVE?.cleanSubjectId?.(root, sourceId) || sourceId) : "未指定");
    const imageHint = String(ctx.opts?.input_img || "").trim();
    const hasImage = stage === "blender" && graphMode === "prompt" ? false : Boolean(sourceId || imageHint || stage === "colab");
    const visual = stage === "appearance" ? appearance(ctx) : (stage === "blender" && !hasImage) ? appearance(ctx, { pureVisual: true }) : "";
    let modelInput = "";
    if (is3D) {
      if (hasImage) {
        const absoluteHint = /^(?:https?:\/\/|(?:characters|creatures|moves)\/)/.test(imageHint);
        const imgPath = imageHint ? (sourceId && !absoluteHint ? sourcePath + "/" + imageHint.replace(/^\/+/, "") : imageHint) : (sourceId ? sourcePath + "/" : "未指定");
        modelInput = "輸入圖片：" + imgPath + "\nsource_pack：" + source;
      } else {
        modelInput = "純文字外觀：\n" + visual;
      }
    }
    const bestiary = stage === "blender" && !hasImage && isCreature(ctx)
      ? "宙獸圖鑑：另建 `bestiary.md` 並列入 manifest.files；命名本種，分述幼年（juvenile）、少年（adolescent）、成年（adult）、超載（overload）的外觀、生態田野觀察與演化過程。未建模的形態註明概念推演。"
      : "";
    const activePath = String(active?.drivePath || "");
    const activeIsPortrait = active && !/model|rig|anim/.test(active.type || "");
    const activeIsModel = active && /model|rig|anim/.test(active.type || "");
    const portraitPath = (/^(?:characters|creatures)\/(?:01_portraits|03_completed\/portraits)\//.test(activePath) || (activeIsPortrait && /^(?:characters|creatures)\/[^/]+$/.test(activePath)))
      ? activePath : (sourceId ? sourcePath : "請指定待審立繪目錄");
    const modelPath = (/^(?:characters|creatures)\/(?:02_3d|03_completed\/models)\//.test(activePath) || (activeIsModel && /^(?:characters|creatures)\/[^/]+$/.test(activePath)))
      ? activePath : "請指定待審模型目錄";
    const paramStem = window.COSMI_DRIVE?.assetStem?.({
      kind: root,
      id: subjectBase,
      stage: ctx.opts?.stage || ctx.concept?.stage,
      step: "00_parameters",
    }) || (subjectBase + (root === "creatures" ? "_" + (ctx.opts?.stage || ctx.concept?.stage || "adult") : "") + "_00_parameters");
    const values = {
      appearance: visual, model_input: modelInput, bestiary,
      asset_id: ctx.taskId, subject_id: ctx.subjectId, source_pack: source, source_path: sourcePath,
      input_path: stage === "review_portrait" ? portraitPath : modelPath,
      output_path: window.COSMI_DRIVE?.pipelineDirectory?.(root, stage === "colab" || stage === "blender" ? stage : root === "moves" ? "vfx" : "portrait", subjectBase) || subjectFolder,
      parameters_path: subjectFolder + "/" + paramStem + ".json"
    };
    const filled = template.replace(/\{\{([a-z_]+)\}\}/g, (_, k) => values[k] ?? "未指定").replace(/\n{3,}/g, "\n\n").trim();
    if (stage === "appearance" && window.COSMI_WIKI && supports(ctx)) {
      const wiki = window.COSMI_WIKI.describe(ctx);
      const kindLabel = wiki.kind === "characters" ? "角色" : "宙獸";
      const focus = wiki.kind === "characters"
        ? "角色身份、背景、外觀、服裝、性格、技能與設計變體"
        : "此階段宙獸原型、生態、社會型態、生育方式、棲息地、解剖結構、屬性、動作與主動技";
      return [
        filled,
        "",
        "## 同步生成原創" + kindLabel + "圖鑑",
        "對象：" + wiki.subject + (wiki.stage ? "；當前型態：" + wiki.stage : ""),
        "依本次外觀與概念設定建立本型態圖鑑（" + focus + "）；只描述目前型態，未確認資料標示待核，不借用其他對象或階段內容。",
        "先檢查此精確路徑是否已存在：存在則使用現有圖鑑，不重新生成；輸出 Markdown：" + wiki.path
      ].join("\n");
    }
    if (!["colab", "blender"].includes(stage)) return filled;
    const kind = ctx.task.id.startsWith("character") ? "character" : "creature";
    const route = hasImage ? "image" : "text";
    const anatomy = window.COSMI_ANATOMY?.plan(kind, ctx.concept, route);
    const typed = anatomy ? filled + "\n解剖分類：" + anatomy.anatomy +
      "；骨架／機構策略：" + anatomy.rig +
      "。依指定原型與實際肢體建立專用動作，混合／不明拓撲先審查，不可擅套人形 Rig。" : filled;
    const wiki = window.COSMI_WIKI.describe(ctx);
    return typed + "\n共用圖鑑：" + wiki.path + "。此管線只引用既有圖鑑，不重新生成；若尚無該圖鑑，先於「外觀設定」步驟建立。manifest.encyclopedia_path 記錄同一路徑。";
  }
  async function loadTemplates() {
    const root = pipelineRootFor(window.COSMI_FORGE?.currentContext?.() || {});
    const kindTemplates = templatesByKind.get(root) || {};
    const entries = Object.entries(stages).filter(([key]) => !["portrait", "encyclopedia"].includes(key));
    const jobs = entries.map(async ([key, name]) => {
      try {
        const canonical = root + "/prompts/" + name + ".prompt.md";
        try {
          kindTemplates[key] = await (await window.COSMI_DRIVE.read(canonical)).text();
        } catch (canonicalError) {
          // Read-only compatibility while legacy templates are being retired.
          kindTemplates[key] = await (await window.COSMI_DRIVE.read("prompts/" + name + ".prompt.md")).text();
        }
      } catch (error) {
        console.warn("無法讀取管線模板：" + name, error);
      }
    });
    jobs.push((async () => {
      try {
        const saved = JSON.parse(await (await window.COSMI_DRIVE.read("00_settings/default.parameters.json")).text());
        if ($("pipelineParameters")) $("pipelineParameters").value = JSON.stringify(saved, null, 2);
      } catch (error) {
        console.warn("使用預設管線參數：", error);
      }
    })());
    await Promise.all(jobs);
    templatesByKind.set(root, kindTemplates);
    if (pipelineRootFor(window.COSMI_FORGE?.currentContext?.() || {}) === root) {
      for (const key of Object.keys(templates)) delete templates[key];
      Object.assign(templates, kindTemplates);
      loadedTemplateKind = root;
    }
  }
  function isPortraitAuto() {
    return $("pipelineStage")?.value === "portrait" && portraitMode === "auto";
  }
  function syncStageActions() {
    const isPortrait = $("pipelineStage")?.value === "portrait";
    const automatic = isPortraitAuto();
    const modeControl = $("portraitModeControl"), modeSelect = $("portraitMode");
    if (modeControl) modeControl.hidden = !isPortrait;
    if (modeSelect) modeSelect.value = portraitMode;
    // Manual portrait mode has no Drive Prompt read/write controls.
    for (const id of ["driveSavePrompt", "drivePromptPath", "driveLoadPrompt"]) {
      const control = $(id);
      if (control) control.hidden = isPortrait && !automatic;
    }
    const action = $("pipelineRead");
    if (action) {
      // Manual portrait already has one copy action next to the Prompt.
      action.hidden = isPortrait && !automatic;
      const hint = !isPortrait ? "從 Google Drive 讀取本步驟 Prompt 模板"
        : automatic ? "建立完整立繪 Prompt .md 並上傳 Google Drive"
        : "複製目前立繪 Prompt，貼入生成平台";
      action.textContent = !isPortrait ? "📖" : automatic ? "☁" : "📋";
      action.setAttribute("aria-label", hint);
      action.dataset.tip = hint;
    }
  }

  window.COSMI_PIPELINE = { stages, templates, defaults, parameters, appearance, supports, build, loadTemplates, isPortraitAuto, syncStageActions };
  document.addEventListener("DOMContentLoaded", () => {
    $("pipelineParameters").value = JSON.stringify(defaults, null, 2);
    syncStageActions();
    $("portraitMode")?.addEventListener("change", event => {
      portraitMode = event.target.value === "auto" ? "auto" : "manual";
      try { window.localStorage?.setItem(modeKey, portraitMode); } catch (_) {}
      syncStageActions();
      window.COSMI_FORGE?.setPortraitRound?.(portraitMode === "auto" ? 0 : 1);
    });
    for (const id of ["pipelineStage", "pipelineParameters"]) {
      $(id).addEventListener("change", () => {
        if (id === "pipelineStage") {
          graphMode = null;
          syncStageActions();
          window.COSMI_FORGE?.setPipelineStage($(id).value);
        } else window.COSMI_FORGE?.refresh();
      });
    }
  });
})();
