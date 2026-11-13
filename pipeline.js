// Portrait prompts support manual clipboard and on-demand automated Drive .md output.
(function () {
  "use strict";
  const stages = {
    appearance: "00_appearance", portrait: "01_portrait", review_portrait: "02_review_portrait",
    colab: "03a_colab", blender: "03b_blender", review_3d: "04_review_3d",
    encyclopedia: "05_encyclopedia"
  };
  const templates = {};
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
  function appearance(ctx) {
    // Concept parameters are the sole appearance source; notes provide explicit amendments.
    const base = ctx.concept || {};
    const selected = base.locked?.stages?.find(s => s.stage === ctx.opts?.stage) || {};
    const concept = {...base, ...selected, stage: ctx.opts?.stage || base.stage};
    const fields = ["name_zh", "name_en", "stage", "gender", "age", "body_type", "outfit_palette", "hair_palette", "eye_palette", "silhouette_keywords", "style", "pose", "element_palettes", "elements", "size_profile", "height", "height_length", "appearance", "look", "size_class", "appearance_palette", "hair", "eyes", "outfit", "accessories", "base_parents", "bases", "archetype", "motifs", "disposition", "formula"];
    const lines = fields.filter(k => concept[k] != null).map(k => k + ": " + (typeof concept[k] === "object" ? JSON.stringify(concept[k]) : concept[k]));
    if (ctx.notes?.trim()) lines.push("補充／修改: " + ctx.notes.trim());
    return lines.join("\n") || "請先於設計概念參數設定角色／宙獸外觀";
  }
  function supports(ctx) { return ["character-concept", "creature-concept", "character-model-rig", "creature-model-rig", "model-rig", "move-vfx"].includes(ctx.task.id); }
  function build(ctx) {
    const stage = $("pipelineStage")?.value || "portrait";
    if (stage === "portrait" || stage === "move_vfx") {
      const content=ctx.task.nativeBuild ? ctx.task.nativeBuild(ctx) : ctx.task.build(ctx);
      if (!window.COSMI_WIKI || !supports(ctx))return content;
      const wiki=window.COSMI_WIKI.describe(ctx);
      return content + "\n\n圖鑑：" + wiki.path + "（僅引用，未建立時先執行獨立圖鑑步驟；不可重複生成）。";
    }
    if (stage === "encyclopedia") {
      const wiki = window.COSMI_WIKI.describe(ctx);
      const kind = wiki.kind, subject = wiki.subject;
      const destination = wiki.path;
      const moveOptions = kind === "moves" ? Object.fromEntries(
        Object.entries(ctx.opts || {}).filter(([key]) => ["element","shape","tier","use_creature","action","motion","name"].includes(key))
      ) : null;
      const focus = kind === "moves" ?
        "招式定位、施放條件、屬性、視覺形態、分鏡、效果節奏與動作規格" :
        kind === "characters" ? "角色身份、背景、外觀、服裝、性格、技能與設計變體" :
        "此階段宙獸原型、生態、棲息地、解剖結構、屬性、動作與招式";
      return [
        "# 生成原創" + (kind === "moves" ? "招式" : kind === "characters" ? "角色" : "宙獸") + "圖鑑",
        "對象：" + subject + (wiki.stage ? "；當前型態：" + wiki.stage : ""),
        "概念設定：", kind === "moves" ? JSON.stringify(moveOptions, null, 2) : appearance(ctx),
        "只依目前概念與已確認的素材建立圖鑑，不借用其他對象的圖鑑內容。",
        "內容包含：" + focus + "；只描述目前型態，不混入其他階段的外觀與招式；未確認資料標示待核。",
        "先檢查此精確路徑是否已存在：存在則使用現有圖鑑，不重新生成；若需改版請明確要求更新，禁止建立副本。",
        "輸出 Markdown：" + destination,
        "圖鑑獨立於 3D 模型目錄；若需模型關聯，記錄現有 asset_id 與模型路徑，不複製 GLB。",
        "僅更新本對象的圖鑑，不修改或移動既有模型，也不得以產生圖鑑代替 3D QA 與最終驗收。"
      ].join("\n");
    }
    if (stage === "portrait_3d") {
      const model = window.COSMI_FORGE?.activePackage?.();
      const subject = ctx.concept?.name_zh || ctx.subjectId;
      return [
        "# 3D 完成後補畫主立繪：" + subject,
        "依已完成的 3D 模型、材質與多角度預覽，繪製一張全身動態主立繪。",
        "維持模型的外觀、比例、五官、服裝或肢體、配色及辨識特徵。",
        "不要生成正面基準圖、T-pose 或三視圖；只輸出動態主立繪。",
        "3D 來源：" + (model?.drivePath || "請指定已完成的 3D 模型目錄"),
        "輸出至 01_portraits/" + ctx.taskId + "/images/，並建立可追溯的來源關聯。",
        "完成後須人工審查立繪並綁定 3D，才可最終驗收。"
      ].join("\n");
    }
    const template = templates[stage];
    if (!template) return "請先從 Drive 讀取本步驟 prompt.md。";
    const model = window.COSMI_FORGE?.activePackage();
    const source = stage === "review_3d" ? model?.sourcePack || model?.manifest?.source_pack || "未指定" : ctx.opts?.source_pack || "未指定";
    const values = {appearance: appearance(ctx), asset_id: ctx.taskId, subject_id: ctx.subjectId,
      source_pack: source, source_path: window.COSMI_FORGE?.packages().find(p => p.id === source)?.drivePath || (source === "未指定" ? "未指定" : "01_portraits/" + source),
      input_path: model?.drivePath || "請指定輸入資產目錄", output_path: (stage === "colab" ? "02_3d/colab/" : stage === "blender" ? "02_3d/ai_blender/" : "01_portraits/") + ctx.taskId,
      parameters_path: "00_settings/" + ctx.taskId + ".parameters.json"};
    const filled = template.replace(/\{\{([a-z_]+)\}\}/g, (_, k) => values[k] ?? "未指定");
    if (!["colab", "blender"].includes(stage)) return filled;
    const kind = ctx.task.id.startsWith("character") ? "character" : "creature";
    const route = stage === "colab" || ctx.opts?.source_pack || ctx.opts?.input_img ? "image" : "text";
    const anatomy = window.COSMI_ANATOMY?.plan(kind, ctx.concept, route);
    const typed = anatomy ? filled + "\n解剖分類：" + anatomy.anatomy +
      "；骨架／機構策略：" + anatomy.rig +
      "。依指定原型與實際肢體建立專用動作，混合／不明拓撲先審查，不可擅套人形 Rig。" : filled;
    const wiki = window.COSMI_WIKI.describe(ctx);
    return typed + "\n共用圖鑑：" + wiki.path + "。此管線只引用既有圖鑑，不重新生成；若尚無該圖鑑，先執行獨立「生成圖鑑」步驟。manifest.encyclopedia_path 記錄同一路徑。";
  }
  async function loadTemplates() {
    const entries = Object.entries(stages).filter(([key]) => !["portrait", "encyclopedia"].includes(key));
    const jobs = entries.map(async ([key, name]) => {
      try {
        templates[key] = await (await window.COSMI_DRIVE.read("prompts/" + name + ".prompt.md")).text();
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
  }
  function isPortraitAuto() {
    return ["portrait", "portrait_3d"].includes($("pipelineStage")?.value) && portraitMode === "auto";
  }
  function syncStageActions() {
    const isPortrait = ["portrait", "portrait_3d"].includes($("pipelineStage")?.value);
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

  const graphSteps = {
    appearance:["外觀設定","產生原創外觀描述，兩條管線共用。","appearance"],
    portrait:["立繪生成","Image-to-3D 專用：先產生正面、T-pose 多視圖及動態主立繪。","portrait"],
    review_portrait:["立繪審查","確認來源立繪通過後，才能以圖片建模。","review_portrait"],
    colab:["Colab + Blender","獨立管線 A：Colab GPU 生成初始網格，再由 Blender 修整、綁骨並匯出 GLB 與 Blend；不是 AI Blender 管線的前置步驟。","colab"],
    blender_image:["AI Blender：Image-to-3D","獨立管線 B：直接由 AI 操作 Blender，以來源圖片建模；不經過 Colab，不產生宙獸圖鑑。","blender"],
    blender_prompt:["AI Blender：Prompt-to-3D","獨立管線 B 的文字輸入模式：在立繪生成前分岔，直接由 AI 操作 Blender 建模；宙獸此路線產生圖鑑。","blender"],
    portrait_after_3d:["建模後補主立繪","以完成的 3D 模型為唯一外觀基準補正式動態主立繪，不需 T-pose 或正面圖。","portrait_after_3d"],
    review_3d:["最終驗收","Image-to-3D 檢查核准來源立繪；Prompt-to-3D 檢查建模後補的主立繪。缺任一必交成果不得通過。","review_3d"]
  };
  function selectGraphStep(key) {
    const info = graphSteps[key];
    if (!info) return;
    graphMode = key === "blender_prompt" || key === "portrait_after_3d" ? "prompt" : key === "blender_image" ? "image" : null;
    const stage = info[2] === "portrait_after_3d" ? "portrait_after_3d" : info[2];
    const selector = $("pipelineStage");
    if (selector) selector.value = stage;
    document.querySelectorAll("[data-pipeline-node]").forEach(node => node.setAttribute("aria-pressed",String(node.dataset.pipelineNode === key)));
    if ($("pipelineStepTitle")) $("pipelineStepTitle").textContent = info[0];
    if ($("pipelineStepDescription")) $("pipelineStepDescription").textContent = info[1];
    syncStageActions();
    window.COSMI_FORGE?.setPipelineStage?.(stage);
    window.COSMI_FORGE?.refresh?.();
    const updatePrompt = () => {
      const prompt = $("prompt")?.value || "";
      const out = $("pipelineStepPrompt");
      if (out) {out.hidden = false;out.textContent = prompt || "請先選擇資產，以產生此步驟 Prompt。";}
    };
    updatePrompt();
    if ($("pipelineStepPrompt")) $("pipelineStepPrompt").textContent = $("prompt")?.value || "請先選擇資產，以產生此步驟 Prompt。";
  }
  window.COSMI_PIPELINE = { stages, templates, defaults, parameters, appearance, supports, build, loadTemplates, isPortraitAuto, syncStageActions };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-pipeline-node]").forEach(node => node.addEventListener("click", () => selectGraphStep(node.dataset.pipelineNode)));
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
