// Portrait prompts support manual clipboard and on-demand automated Drive .md output.
(function () {
  "use strict";
  const stages = {
    appearance: "00_appearance", portrait: "01_portrait", review_portrait: "02_review_portrait",
    colab: "03a_colab", blender: "03b_blender", review_3d: "04_review_3d"
  };
  const templates = {};
  let appearanceSubject;
  const modeKey = "cosmimera.portrait-mode.v1";
  let portraitMode = "manual";
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
    const appearanceKey = ctx.subjectId + ":" + (ctx.opts?.stage || "");
    if (appearanceSubject && appearanceSubject !== appearanceKey && $("pipelineAppearance")) $("pipelineAppearance").value = "";
    appearanceSubject = appearanceKey;
    const base = ctx.concept || {};
    const selected = base.locked?.stages?.find(s => s.stage === ctx.opts?.stage) || {};
    const c = {...base, ...selected, stage: ctx.opts?.stage || base.stage};
    const fields = ["name_zh", "name_en", "stage", "gender", "age", "body_type", "outfit_palette", "hair_palette", "eye_palette", "silhouette_keywords", "style", "pose", "element_palettes", "elements", "size_profile", "height", "height_length", "appearance", "look", "size_class", "appearance_palette", "hair", "eyes", "outfit", "accessories", "base_parents", "bases", "archetype", "motifs", "disposition", "formula"];
    const lines = fields.filter(k => c[k] != null).map(k => k + ": " + (typeof c[k] === "object" ? JSON.stringify(c[k]) : c[k]));
    return $("pipelineAppearance")?.value.trim() || lines.join("\n") || "請填入角色／宙獸的外觀設定";
  }
  function supports(ctx) { return ["character-concept", "creature-concept", "character-model-rig", "creature-model-rig", "model-rig"].includes(ctx.task.id); }
  // A stale Drive 3D template must not override the current production contract.
  const threeDFallback = {
    colab: [
      "# Colab GPU Image-to-3D",
      "{{model_input}}",
      "參數：`{{parameters_path}}`　輸出：`{{output_path}}/`",
      "",
      "確認 GPU 與所選模型可運作；Colab 產生初始網格後須經 Blender 修整、綁骨、檢查與最終匯出，無法執行時回報阻塞。",
      "1. 先判定原型（人形、怪物、生物、奇幻生物、超自然物件），搜尋並查看解剖、造型、材質、骨架與運動參考；無法查詢則註明。",
      "2. 只依本次圖片／外觀全新設計模型、材質、骨架和動作；不得套用、改造或抄襲舊 3D 檔。生物使用合適蒙皮，機械使用正確剛性關節。",
      "3. 在 Blender 完成製作，直接儲存 `models/{{asset_id}}.blend` 並匯出 `models/{{asset_id}}.glb`；依參數建立動畫，保留有效 UV、貼圖與骨架。",
      "4. 每次修改後檢查正、背、左、右、上、下及動作關鍵幀：臉部／感知器官不被遮擋；軀幹與各部位完整連接；無破面、孔洞、透視露空、錯誤法線／材質、部件互穿、離體或各自亂移，拓撲乾淨。修正後重檢。",
      "5. 重開 `.blend`、重新匯入 `.glb` 驗證；交付 `models/`、`rig/`、`animations/`、`previews/`、`manifest.json`，列明缺件或限制；不交 ZIP。",
      "",
      "{{bestiary}}",
    ].join("\n"),
    blender: [
      "# Blender Image-to-3D／Prompt-to-3D",
      "{{model_input}}",
      "參數：`{{parameters_path}}`　輸出：`{{output_path}}/`",
      "",
      "直接操作 Blender；有圖以本次圖片為準，無圖以本次外觀為準，不以簡單幾何堆疊充當完成品。",
      "1. 先判定原型（人形、怪物、生物、奇幻生物、超自然物件），搜尋並查看解剖、造型、材質、骨架與運動參考；無法查詢則註明。",
      "2. 只依本次圖片／外觀全新設計模型、材質、骨架和動作；不得套用、改造或抄襲舊 3D 檔。生物使用合適蒙皮，機械使用正確剛性關節。",
      "3. 在 Blender 完成製作，直接儲存 `models/{{asset_id}}.blend` 並匯出 `models/{{asset_id}}.glb`；依參數建立動畫，保留有效 UV、貼圖與骨架。",
      "4. 每次修改後檢查正、背、左、右、上、下及動作關鍵幀：臉部／感知器官不被遮擋；軀幹與各部位完整連接；無破面、孔洞、透視露空、錯誤法線／材質、部件互穿、離體或各自亂移，拓撲乾淨。修正後重檢。",
      "5. 重開 `.blend`、重新匯入 `.glb` 驗證；交付 `models/`、`rig/`、`animations/`、`previews/`、`manifest.json`，列明缺件或限制；不交 ZIP。",
      "",
      "{{bestiary}}",
    ].join("\n")
  };
  function isCreature(ctx) {
    const id = ctx.task?.id || "";
    return id.startsWith("creature-") || ctx.task?.needs === "creature" ||
      (id === "model-rig" && /^cr[-_]/.test(ctx.subjectId || ctx.opts?.source_pack || ""));
  }
  function build(ctx) {
    const stage = $("pipelineStage")?.value || "portrait";
    if (stage === "portrait") return ctx.task.build(ctx);
    const is3D = stage === "colab" || stage === "blender";
    const remote = templates[stage];
    // Old Drive templates lack input isolation and the bestiary slot.
    const template = is3D && (!remote?.includes("{{model_input}}") || !remote.includes("{{bestiary}}") || !remote.includes("每次修改後"))
      ? threeDFallback[stage] : remote;
    if (!template) return "請先從 Drive 讀取本步驟 prompt.md。";
    const model = window.COSMI_FORGE?.activePackage();
    const source = stage === "review_3d" ? model?.sourcePack || model?.manifest?.source_pack || "未指定" : ctx.opts?.source_pack || "未指定";
    const sourcePath = window.COSMI_FORGE?.packages().find(p => p.id === source)?.drivePath || (source === "未指定" ? "未指定" : "01_portraits/" + source);
    const hasImage = source !== "未指定";
    const needsAppearance = stage === "appearance" || stage === "review_portrait" || (stage === "blender" && !hasImage);
    const visual = needsAppearance ? appearance(ctx) : "";
    const modelInput = hasImage
      ? "來源立繪：" + sourcePath + "/（source_pack：" + source + "）"
      : "純文字外觀：\n" + visual + "\nsource_pack：留空（後續須補核准立繪）";
    const bestiary = is3D && isCreature(ctx)
      ? "宙獸圖鑑：另建 `bestiary.md`，命名本種，分別描述幼年（juvenile）、少年（adolescent）、成年（adult）、超載（overload）的外觀、虛構生態田野觀察與階段演化；缺圖的形態標明概念推演，不假稱已有模型。"
      : "";
    const values = {
      appearance: visual, model_input: modelInput, bestiary,
      asset_id: ctx.taskId, subject_id: ctx.subjectId, source_pack: source,
      source_path: sourcePath,
      input_path: model?.drivePath || "請指定輸入資產目錄",
      output_path: (stage === "colab" ? "02_3d/colab/" : stage === "blender" ? "02_3d/ai_blender/" : "01_portraits/") + ctx.taskId,
      parameters_path: "00_settings/" + ctx.taskId + ".parameters.json"
    };
    const filled = template.replace(/\{\{([a-z_]+)\}\}/g, (_, k) => values[k] ?? "未指定");
    return is3D ? filled.replace(/\n{3,}/g, "\n\n").trim() : filled;
  }
  async function loadTemplates() {
    const entries = Object.entries(stages).filter(([key]) => key !== "portrait");
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
    return $("pipelineStage")?.value === "portrait" && portraitMode === "auto";
  }
  function syncStageActions() {
    const isPortrait = $("pipelineStage")?.value === "portrait";
    const automatic = isPortraitAuto();
    const modeControl = $("portraitModeControl"), modeSelect = $("portraitMode");
    if (modeControl) modeControl.hidden = !isPortrait;
    if (modeSelect) modeSelect.value = portraitMode;
    if ($("portraitAutoRun")) $("portraitAutoRun").hidden = !automatic;
    // Manual portrait mode has no Drive Prompt read/write controls.
    for (const id of ["driveSavePrompt", "drivePromptPath", "driveLoadPrompt"]) {
      const control = $(id);
      if (control) control.hidden = isPortrait && !automatic;
    }
    const action = $("pipelineRead");
    if (action) {
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
    $("portraitAutoRun")?.addEventListener("click", () => $("pipelineRead")?.click());
    $("portraitMode")?.addEventListener("change", event => {
      portraitMode = event.target.value === "auto" ? "auto" : "manual";
      try { window.localStorage?.setItem(modeKey, portraitMode); } catch (_) {}
      syncStageActions();
      window.COSMI_FORGE?.setPortraitRound?.(portraitMode === "auto" ? 0 : 1);
    });
    for (const id of ["pipelineStage", "pipelineAppearance", "pipelineParameters"]) {
      $(id).addEventListener("change", () => {
        if (id === "pipelineStage") {
          syncStageActions();
          window.COSMI_FORGE?.setPipelineStage($(id).value);
        } else window.COSMI_FORGE?.refresh();
      });
    }
  });
})();
