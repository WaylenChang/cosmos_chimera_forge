// Portrait prompts support manual clipboard and on-demand automated Drive .md output.
(function () {
  "use strict";
  const stages = {
    appearance: "00_appearance", portrait: "01_portrait", review_portrait: "02_review_portrait",
    colab: "03a_colab", blender: "03b_blender", review_3d: "04_review_3d"
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
  function appearance(ctx, { pureVisual = true } = {}) {
    const base = ctx.concept || {};
    const stage = ctx.opts?.stage || base.stage || "";
    const selected = base.locked?.stages?.find(item => item.stage === stage) || {};
    const concept = {...base, ...selected, stage};
    const creature = pipelineRootFor(ctx) === "creatures";
    const visualFields = creature
      ? ["name_zh","name_en","stage","appearance","look","anatomy","limbs","bases","base_parents",
         "silhouette_keywords","height_length","size_class","appearance_palette","elements","motifs","accessories"]
      : ["name_zh","name_en","gender","age","height","body_type","appearance","look","hair","eyes",
         "outfit","accessories","hair_palette","eye_palette","outfit_palette","silhouette_keywords","style","pose"];
    const loreFields = creature
      ? ["archetype","disposition","social_structure","reproduction","niches","habit","signature_move"]
      : ["role","biography","backstory_zh","disposition"];
    const fields = pureVisual ? visualFields : [...visualFields, ...loreFields];
    const meaningful = value => {
      if (value == null) return false;
      if (typeof value === "string") return value.trim() !== "" && value.trim() !== "未知";
      if (Array.isArray(value)) return value.some(meaningful);
      if (typeof value === "object") return Object.values(value).some(meaningful);
      return true;
    };
    const lines = fields.filter(k => meaningful(concept[k]))
      .map(k => k + ": " + (typeof concept[k] === "object" ? JSON.stringify(concept[k]) : concept[k]));
    return lines.join("\n") || "尚未提供本對象的外觀設定";
  }
  // A task runs from exactly one versioned stage template; stale Drive files cannot inject old steps.
  const localTemplates = {
    appearance: "# {{subject_label}}外觀設定\n{{subject_line}}\n依本次視覺素材整理輪廓、比例、臉部／感知器官、肢體、配色、材質及本對象特徵。\n{{appearance}}\n輸出：{{appearance_path}}",
    review_portrait: "# {{subject_label}}立繪審查\n待審：{{input_path}}/\n檢查{{portrait_views}}的完整性、外觀比例、視角及配色一致性，逐檔記錄缺陷和通過／退件建議。\n人工決定審查結果。",
    colab: "# Colab Image-to-3D｜{{subject_label}}\n{{model_input}}\n參數：{{parameters_path}}\n輸出：{{output_path}}/\n{{rig_plan}}\n{{action_plan}}\n以本次已核准圖片重建該對象網格與材質，再由 Blender 修整拓撲、UV、骨架、蒙皮及動作。\n在 Blender 檢查各視角、關節變形與貼圖，重開 .blend 並重匯入 .glb 驗證。\n交付 models/{{asset_id}}.blend、models/{{asset_id}}.glb、rig/、animations/、previews/ 與 manifest.json。",
    blender: "# Blender {{input_mode_label}}｜{{subject_label}}\n{{model_input}}\n參數：{{parameters_path}}\n輸出：{{output_path}}/\n{{rig_plan}}\n{{action_plan}}\n依本次輸入製作該對象的完整網格、材質、骨架、蒙皮及動作；保留臉部／感知器官、服裝或體表構造的辨識細節。\n檢查各視角、關節變形與貼圖，重開 .blend 並重匯入 .glb 驗證。\n交付 models/{{asset_id}}.blend、models/{{asset_id}}.glb、rig/、animations/、previews/ 與 manifest.json。",
    review_3d: "# {{subject_label}}3D 模型最終驗收\n模型：{{input_path}}/\n{{source_reference}}\n核對 .glb、.blend、manifest、拓撲、材質、骨架及本對象的動作變形和各方向外觀。\n逐檔記錄問題與通過／退件建議，由人工審核。"
  };
  const templateMarker = stage => "<!-- COSMI-PIPELINE/3:" + stage + " -->";
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
      return ctx.task.nativeBuild ? ctx.task.nativeBuild(ctx) : ctx.task.build(ctx);
    }
    const root = pipelineRootFor(ctx);
    // Player encyclopedia is game data. It has no generation stage or prompt.
    if (!Object.prototype.hasOwnProperty.call(stages, stage)) {
      return "請選擇有效的生成管線步驟。";
    }
    const raw = templatesByKind.get(root)?.[stage];
    const normalized = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";
    const prefix = templateMarker(stage);
    const loaded = normalized.startsWith(prefix + "\n") ? normalized.slice(prefix.length).trim() : "";
    // No game-encyclopedia references in any generated prompt, including upgraded Drive templates.
    const forbidden = /(?:encyclopedia|bestiary|圖鑑|百科|_05_wiki|wiki_path|\/wiki\/|encyclopedia_path)/i;
    const template = loaded && !forbidden.test(loaded) ? loaded : localTemplates[stage];
    if (!template) return "此步驟沒有可用的 Prompt 模板。";

    const subjectBase = window.COSMI_DRIVE?.cleanSubjectId?.(root, ctx.subjectId || ctx.taskId)
      || ctx.subjectId || ctx.taskId;
    const subjectFolder = root + "/" + subjectBase;
    const candidate = window.COSMI_FORGE?.activePackage?.();
    const candidatePath = String(candidate?.drivePath || "");
    const candidateSubject = String(candidate?.subjectId || candidate?.manifest?.subject_id || "").trim();
    // A selected review package is not evidence for another subject, even in the same category.
    const sameSubject = Boolean(candidate && (candidateSubject
      ? (window.COSMI_DRIVE?.cleanSubjectId?.(root, candidateSubject) || candidateSubject) === subjectBase
      : candidatePath.startsWith(subjectFolder + "/")));
    const active = sameSubject ? candidate : null;
    const activePath = String(active?.drivePath || "");
    const textRoute = ctx.pipelineRoute === "text" ||
      (ctx.pipelineRoute !== "image" && stage === "review_3d" && active?.manifest?.input_mode === "text");
    const requestedSource = textRoute ? "" : String((stage === "review_3d"
      ? active?.sourcePack || active?.manifest?.source_pack
      : ctx.opts?.source_pack) || "").trim();
    const imageHint = textRoute ? "" : String(ctx.opts?.input_img || "").trim();
    const knownPackages = window.COSMI_FORGE?.packages?.() || [];
    const sourcePkg = knownPackages.find(p => {
      if (p.id !== requestedSource || !String(p.drivePath || "").startsWith(root + "/")) return false;
      const id = String(p.subjectId || p.manifest?.subject_id || "").trim();
      return !id || (window.COSMI_DRIVE?.cleanSubjectId?.(root, id) || id) === subjectBase;
    });
    // A known package belonging to a different kind or subject must never become a source.
    const sourceId = knownPackages.some(p => p.id === requestedSource) && !sourcePkg ? "" : requestedSource;
    // Explicit Image-to-3D remains image-only even before an approved reference is selected.
    const hasImage = stage === "colab" || (!textRoute &&
      (ctx.pipelineRoute === "image" || Boolean(sourceId || imageHint)));
    const sourcePath = sourcePkg?.drivePath ||
      (sourceId ? root + "/01_portraits/" + sourceId : "");
    const activeType = String(active?.type || "");
    const activeIsPortrait = active && !/model|rig|anim/.test(activeType);
    const activeIsModel = active && /model|rig|anim/.test(activeType);
    const portraitPath = (active && (activePath.startsWith(root + "/01_portraits/") ||
      activePath.startsWith(root + "/03_completed/portraits/") ||
      (activeIsPortrait && activePath.startsWith(root + "/") && activePath.split("/").length === 2)))
      ? activePath : (sourceId ? sourcePath : "請指定本對象待審立繪目錄");
    const modelPath = (active && (activePath.startsWith(root + "/02_3d/") ||
      activePath.startsWith(root + "/03_completed/models/") ||
      (activeIsModel && activePath.startsWith(root + "/") && activePath.split("/").length === 2)))
      ? activePath : "請指定本對象待審模型目錄";
    const paramStem = window.COSMI_DRIVE?.assetStem?.({
      kind: root, id: subjectBase, stage: ctx.opts?.stage || ctx.concept?.stage, step: "00_parameters"
    }) || subjectBase + "_00_parameters";
    const appearanceStem = window.COSMI_DRIVE?.assetStem?.({
      kind: root, id: subjectBase, stage: ctx.opts?.stage || ctx.concept?.stage, step: "00_appearance"
    }) || subjectBase + "_00_appearance";
    const subjectLabel = root === "characters" ? "角色" : root === "creatures" ? "宙獸" : "主動技";
    const subjectLine = root === "creatures"
      ? "對象：" + subjectBase + "；型態：" + (ctx.opts?.stage || ctx.concept?.stage || "adult")
      : "對象：" + subjectBase;
    const is3D = stage === "colab" || stage === "blender";
    const route = hasImage ? "image" : "text";
    const anatomy = is3D ? window.COSMI_ANATOMY?.plan(
      root === "characters" ? "character" : "creature", ctx.concept, route) : null;
    const rigPlan = anatomy
      ? "解剖：" + anatomy.anatomy + "；骨架／機構：" + anatomy.rig
      : "骨架依本對象的實際解剖與運動構造規劃";
    const actionKey = root === "characters" ? "actions_character" : "actions_creature";
    const actions = Array.isArray(ctx.opts?.[actionKey]) ? ctx.opts[actionKey] : [];
    const actionPlan = actions.length
      ? "本次動作：" + actions.join("、") + "；規格：" + root + "/prompts/skeleton_actions.md"
      : "動作規格：" + root + "/prompts/skeleton_actions.md";
    let modelInput = "";
    if (is3D && hasImage) {
      const absoluteHint = /^(?:https?:\/\/|(?:characters|creatures)\/)/.test(imageHint);
      const imgPath = imageHint
        ? (sourceId && !absoluteHint ? sourcePath + "/" + imageHint.replace(/^\/+/, "") : imageHint)
        : (sourcePath || "請指定已核准圖片來源");
      modelInput = "來源立繪：" + imgPath + (sourceId ? "\nsource_pack：" + sourceId : "");
    } else if (is3D) {
      modelInput = "純文字外觀：\n" + appearance(ctx);
    }
    const values = {
      subject_label: subjectLabel, subject_line: subjectLine,
      appearance: appearance(ctx), appearance_path: subjectFolder + "/" + appearanceStem + ".md",
      portrait_views: root === "characters" ? "正面圖、三視圖及主立繪" : "正面圖及三視圖",
      input_path: stage === "review_portrait" ? portraitPath : modelPath,
      source_reference: sourceId ? "已核准來源立繪：" + sourcePath + "/" : "",
      model_input: modelInput, input_mode_label: hasImage ? "Image-to-3D" : "Prompt-to-3D",
      rig_plan: rigPlan, action_plan: actionPlan,
      parameters_path: subjectFolder + "/" + paramStem + ".json",
      output_path: window.COSMI_DRIVE?.pipelineDirectory?.(
        root, stage === "colab" || stage === "blender" ? stage : "portrait", subjectBase
      ) || subjectFolder,
      asset_id: ctx.taskId
    };
    return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => values[key] ?? "")
      .replace(/\n{3,}/g, "\n\n").trim();
  }
  async function loadTemplates() {
    const root = pipelineRootFor(window.COSMI_FORGE?.currentContext?.() || {});
    const kindTemplates = templatesByKind.get(root) || {};
    const entries = Object.entries(stages).filter(([key]) => key !== "portrait");
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
