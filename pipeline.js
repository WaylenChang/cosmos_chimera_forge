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
    const appearanceKey = ctx.subjectId + ":" + (ctx.opts?.stage || "");
    if (appearanceSubject && appearanceSubject !== appearanceKey && $("pipelineAppearance")) $("pipelineAppearance").value = "";
    appearanceSubject = appearanceKey;
    const base = ctx.concept || {};
    const selected = base.locked?.stages?.find(s => s.stage === ctx.opts?.stage) || {};
    const c = {...base, ...selected, stage: ctx.opts?.stage || base.stage};
    const fields = ["name_zh", "name_en", "stage", "gender", "age", "height", "height_length", "body_type", "size_class", "size_profile", "silhouette_keywords", "appearance", "look", "style", "pose", "outfit_palette", "hair_palette", "eye_palette", "element_palettes", "appearance_palette", "elements", "hair", "eyes", "outfit", "accessories", "bases", "archetype", "motifs"];
    const lines = fields.filter(k => c[k] != null).map(k => k + ": " + (typeof c[k] === "object" ? JSON.stringify(c[k]) : c[k]));
    return $("pipelineAppearance")?.value.trim() || lines.join("\n") || "請填入角色／宙獸的外觀設定";
  }
  function supports(ctx) { return ["character-concept", "creature-concept", "character-model-rig", "creature-model-rig", "model-rig"].includes(ctx.task.id); }
  // A task runs from exactly one versioned stage template; stale Drive files cannot inject old steps.
  const localTemplates = {
    "appearance": "# 外觀設定\n依本次素材撰寫繁體中文原創外觀，只描述輪廓、體型比例、臉／感知器官、肢體、配色材質、服裝／表面構造與辨識特徵；保留已定特徵，不加入遊戲數值或後續製圖、建模指示。\n素材：\n{{appearance}}",
    "review_portrait": "# 立繪審查\n待審：{{input_path}}/\n依該包外觀與參數檢查圖檔完整性、全身構造、視角與配色一致性、遮擋、瑕疵及水印。\n輸出逐檔缺陷、位置與建議通過／退件；只供人工決策，不修圖、不移動資產或代為核准。",
    "colab": "# Colab GPU Image-to-3D\n{{model_input}}\n參數：`{{parameters_path}}`；輸出：`{{output_path}}/`\n先確認 Colab GPU 與生成模型可用，產生初始網格後交 Blender 修整、綁骨與匯出；無法執行則說明阻塞。\n1. 判定原型（人形、怪物、生物、奇幻生物或超自然物件），搜尋並查閱相關外形、解剖、材質、骨架與運動資料；無法搜尋則註明。\n2. 依本次輸入全新設計並建模，不套用或抄襲舊 3D 檔；依生物或機械構造配置蒙皮、關節與動作。\n3. 由 Blender 直接儲存 `models/{{asset_id}}.blend`、匯出 `models/{{asset_id}}.glb`，保留拓撲、UV、材質與骨架。\n4. 每次修改後檢查正、背、左、右、上、下視角及動作關鍵幀：臉／感知器官不被遮擋，軀幹與肢體完整連接；無破面、孔洞、透視露空、錯誤法線／貼圖、部件互穿、離體或關節錯位及各部位獨立亂移。\n5. 重開 `.blend` 並重新匯入 `.glb` 驗證；交付 `models/`、`rig/`、`animations/`、`previews/`、`manifest.json`，記錄未完成項；不交 ZIP。",
    "blender": "# Blender Image-to-3D／Prompt-to-3D\n{{model_input}}\n參數：`{{parameters_path}}`；輸出：`{{output_path}}/`\n直接以 Blender 製作完整模型，不以粗糙幾何堆疊充當成品。\n1. 判定原型（人形、怪物、生物、奇幻生物或超自然物件），搜尋並查閱相關外形、解剖、材質、骨架與運動資料；無法搜尋則註明。\n2. 依本次輸入全新設計並建模，不套用或抄襲舊 3D 檔；依生物或機械構造配置蒙皮、關節與動作。\n3. 由 Blender 直接儲存 `models/{{asset_id}}.blend`、匯出 `models/{{asset_id}}.glb`，保留拓撲、UV、材質與骨架。\n4. 每次修改後檢查正、背、左、右、上、下視角及動作關鍵幀：臉／感知器官不被遮擋，軀幹與肢體完整連接；無破面、孔洞、透視露空、錯誤法線／貼圖、部件互穿、離體或關節錯位及各部位獨立亂移。\n5. 重開 `.blend` 並重新匯入 `.glb` 驗證；交付 `models/`、`rig/`、`animations/`、`previews/`、`manifest.json`，記錄未完成項；不交 ZIP。\n{{bestiary}}",
    "review_3d": "# 3D 模型審查\n模型：{{input_path}}/；來源立繪：{{source_path}}/\n依立繪、參數與 manifest 檢查 GLB／Blend 可用性、拓撲、材質、骨架及動畫變形、穿插與來源追溯。\nImage-to-3D 須有已核准來源立繪；Prompt-to-3D 須在建模後補正式主立繪（不需 T-pose、正面圖），未補齊不得建議通過。缺 `.glb`／`.blend` 亦不得通過。列明問題檔案及建議通過／退件；不補檔、不移動資產或代為核准。"
  };
  const templateMarker = stage => "<!-- COSMI-PIPELINE/2:" + stage + " -->";
  function isCreature(ctx) {
    const id = ctx.task?.id || "";
    return id.startsWith("creature-") || ctx.task?.needs === "creature" ||
      (id === "model-rig" && /^cr[-_]/.test(ctx.subjectId || ctx.opts?.source_pack || ""));
  }
  function build(ctx) {
    const stage = $("pipelineStage")?.value || "portrait";
    if (stage === "portrait") return ctx.task.build(ctx);
    if (stage === "portrait_after_3d") return "# 建模後補主立繪\n依本次已完成且通過模型品質檢查的 GLB／Blend 與預覽，繪製一致的正式全身動態主立繪。無需 T-pose、正面圖或三視圖；不得自行變更模型外觀。輸出 PNG 並記錄對應模型資產 ID，供最終驗收。";
    const raw = templates[stage];
    const normalized = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";
    const prefix = templateMarker(stage);
    const template = normalized.startsWith(prefix + "\n") ? normalized.slice(prefix.length).trim() : localTemplates[stage];
    if (!template) return "此步驟沒有可用的 Prompt 模板。";
    const is3D = stage === "colab" || stage === "blender";
    const active = window.COSMI_FORGE?.activePackage();
    const sourceId = String((stage === "review_3d" ? active?.sourcePack || active?.manifest?.source_pack : ctx.opts?.source_pack) || "").trim();
    const source = sourceId || "未指定";
    const sourcePath = window.COSMI_FORGE?.packages()?.find(p => p.id === sourceId)?.drivePath || (sourceId ? "01_portraits/" + sourceId : "未指定");
    const imageHint = String(ctx.opts?.input_img || "").trim();
    const hasImage = stage === "blender" && graphMode === "prompt" ? false : Boolean(sourceId || imageHint || stage === "colab");
    const visual = stage === "appearance" || (stage === "blender" && !hasImage) ? appearance(ctx) : "";
    let modelInput = "";
    if (is3D) {
      if (hasImage) {
        const absoluteHint = /^(?:https?:\/\/|01_portraits\/|03_completed\/portraits\/|backup\/)/.test(imageHint);
        const imgPath = imageHint ? (sourceId && !absoluteHint ? sourcePath + "/" + imageHint.replace(/^\/+/, "") : imageHint) : (sourceId ? sourcePath + "/" : "未指定");
        modelInput = "輸入圖片：" + imgPath + "\nsource_pack：" + source;
      } else {
        modelInput = "純文字外觀：\n" + visual + "\n建模後須依最終 3D 補正式主立繪（不需 T-pose、正面圖），完成後才能最終驗收。";
      }
    }
    const bestiary = stage === "blender" && !hasImage && isCreature(ctx)
      ? "宙獸圖鑑：另建 `bestiary.md` 並列入 manifest.files；命名本種，分述幼年（juvenile）、少年（adolescent）、成年（adult）、超載（overload）的外觀、生態田野觀察與演化過程。未建模的形態註明概念推演。"
      : "";
    const activePath = String(active?.drivePath || "");
    const portraitPath = /^(?:01_portraits|03_completed\/portraits)\//.test(activePath) ? activePath : (sourceId ? sourcePath : "請指定待審立繪目錄");
    const modelPath = /^(?:02_3d|03_completed\/models)\//.test(activePath) ? activePath : "請指定待審模型目錄";
    const values = {
      appearance: visual, model_input: modelInput, bestiary,
      asset_id: ctx.taskId, subject_id: ctx.subjectId, source_pack: source, source_path: sourcePath,
      input_path: stage === "review_portrait" ? portraitPath : modelPath,
      output_path: (stage === "colab" ? "02_3d/colab/" : stage === "blender" ? "02_3d/ai_blender/" : "01_portraits/") + ctx.taskId,
      parameters_path: "00_settings/" + ctx.taskId + ".parameters.json"
    };
    return template.replace(/\{\{([a-z_]+)\}\}/g, (_, k) => values[k] ?? "未指定").replace(/\n{3,}/g, "\n\n").trim();
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
      const hint = !isPortrait ? "使用本步驟精簡 Prompt（Drive 舊版自動略過）"
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
    colab:["Colab Image-to-3D","以已核准圖片生成模型，Blender 修整後輸出 GLB 與 Blend。","colab"],
    blender_image:["Blender Image-to-3D","以來源圖片建模，不產生宙獸圖鑑。","blender"],
    blender_prompt:["Blender Prompt-to-3D","在立繪生成之前分岔，直接依文字外觀建模；宙獸此路線產生圖鑑。","blender"],
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
          graphMode = null;
          syncStageActions();
          window.COSMI_FORGE?.setPipelineStage($(id).value);
        } else window.COSMI_FORGE?.refresh();
      });
    }
  });
})();
