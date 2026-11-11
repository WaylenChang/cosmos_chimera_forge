// Stage prompts live in the private Drive folder; output parameters stay separate.
(function () {
  "use strict";
  const stages = {
    appearance: "00_appearance", portrait: "01_portrait", review_portrait: "02_review_portrait",
    colab: "03a_colab", blender: "03b_blender", review_3d: "04_review_3d"
  };
  const templates = {};
  let appearanceSubject;
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
  function build(ctx) {
    const stage = $("pipelineStage")?.value || "portrait";
    const template = templates[stage];
    if (!template) return "請先從 Drive 讀取本步驟 prompt.md。";
    const model = window.COSMI_FORGE?.activePackage();
    const source = stage === "review_3d" ? model?.sourcePack || model?.manifest?.source_pack || "未指定" : ctx.opts?.source_pack || "未指定";
    const values = {appearance: appearance(ctx), asset_id: ctx.taskId, subject_id: ctx.subjectId,
      source_pack: source, source_path: window.COSMI_FORGE?.packages().find(p => p.id === source)?.drivePath || (source === "未指定" ? "未指定" : "01_portraits/" + source),
      input_path: model?.drivePath || "請指定輸入資產目錄", output_path: (stage === "colab" ? "02_3d/colab/" : stage === "blender" ? "02_3d/ai_blender/" : "01_portraits/") + ctx.taskId,
      parameters_path: "00_settings/" + ctx.taskId + ".parameters.json"};
    return template.replace(/\{\{([a-z_]+)\}\}/g, (_, k) => values[k] ?? "未指定");
  }
  async function loadTemplates() {
    const saved = JSON.parse(await (await window.COSMI_DRIVE.read("00_settings/default.parameters.json")).text());
    if ($("pipelineParameters")) $("pipelineParameters").value = JSON.stringify(saved, null, 2);
    for (const [key, name] of Object.entries(stages)) templates[key] = await (await window.COSMI_DRIVE.read("prompts/" + name + ".prompt.md")).text();
  }
  window.COSMI_PIPELINE = { stages, templates, defaults, parameters, appearance, supports, build, loadTemplates };
  document.addEventListener("DOMContentLoaded", () => {
    $("pipelineParameters").value = JSON.stringify(defaults, null, 2);
    for (const id of ["pipelineStage", "pipelineAppearance", "pipelineParameters"]) $(id).addEventListener("change", () => id === "pipelineStage" ? window.COSMI_FORGE?.setPipelineStage($(id).value) : window.COSMI_FORGE?.refresh());
  });
})();
