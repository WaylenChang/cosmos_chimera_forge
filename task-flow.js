// The task chooser mirrors the asset pipeline; keep it independent of DOM and task templates.
(function () {
  "use strict";
  const categories = Object.freeze([
    { id: "character", zh: "角色", icon: "👤", concept: "character-concept", model: "character-model-rig" },
    { id: "creature", zh: "宙獸", icon: "🐉", concept: "creature-concept", model: "creature-model-rig" },
    { id: "move", zh: "主動技", icon: "✨", concept: "move-vfx", model: null }
  ]);
  const flow = Object.freeze({
    image: [
      { id: "appearance", stage: "appearance", task: "concept", name: "外觀設定", detail: "只整理本角色／本型態宙獸的視覺外觀與辨識特徵。", output: "<id>[_<stage>]_00_appearance.md" },
      { id: "portrait", stage: "portrait", task: "concept", name: "生成立繪", detail: "正面基準圖 → 多視角三視圖（角色另含動態主立繪）；可選手動複製或 Drive 自動模式。", output: "立繪圖片" },
      { id: "review_portrait", stage: "review_portrait", task: "concept", name: "立繪審查", detail: "核對各視角一致性與缺陷；通過後才允許圖片建模。", output: "立繪審查紀錄" },
      { id: "image_colab", stage: "colab", task: "model", name: "Colab + AI + Blender", detail: "Image-to-3D 分支 A：使用已核准立繪，Colab 生成初始模型，由 AI 協助 Blender 修復、檢查與輸出。與 AI + Blender 二選一。", output: ".glb ＋ .blend、骨架、動作、QA", alternate: true },
      { id: "image_blender", stage: "blender", task: "model", name: "AI + Blender", detail: "Image-to-3D 分支 B：使用已核准立繪，由 AI 操作 Blender 建模、綁骨、製作動作及檢查。與 Colab + AI + Blender 二選一。", output: ".glb ＋ .blend、骨架、動作、QA", alternate: true },
      { id: "review_3d", stage: "review_3d", task: "model", name: "最終驗收", detail: "檢查模型與已核准立繪、材質、骨架、動作及 manifest；人工確認後才歸檔。", output: "最終審查紀錄" }
    ],
    text: [
      { id: "appearance", stage: "appearance", task: "concept", name: "外觀設定", detail: "整理本對象視覺特徵，提供純文字建模的外觀基礎。", output: "<id>[_<stage>]_00_appearance.md" },
      { id: "prompt_3d", stage: "blender", task: "model", name: "AI + Blender（文字建模）", detail: "以本對象外觀概念直接在 Blender 建模、綁骨、製作動作並輸出 .glb／.blend。", output: ".glb ＋ .blend" },
      { id: "review_3d", stage: "review_3d", task: "model", name: "最終驗收", detail: "檢查已完成的 3D 模型、材質、骨架、動作與 manifest；Prompt-to-3D 無需補立繪，缺 .glb／.blend 不得通過。", output: "最終審查紀錄" }
    ],
    move: [
      { id: "move_vfx", stage: "move_vfx", task: "concept", name: "主動技與特效設計", detail: "依本招式屬性、形狀與強度製作規格、六格分鏡、分層拆解與序列圖。施放者僅用於尺度示範。", output: "spec.json、storyboard、layers、flipbook" }
    ]
  });
  function category(id) { return categories.find(c => c.id === id) || null; }
  function steps(kind, route) {
    if (!category(kind)) return [];
    if (kind === "move") return flow.move;
    return route === "text" ? flow.text : route === "image" ? flow.image : [];
  }
  function resolve(kind, route, stepId) {
    const c = category(kind);
    const selected = steps(kind, route).find(s => s.id === stepId);
    if (!c || !selected) return null;
    return { category: kind, route: kind === "move" ? "move" : route, step: stepId,
      taskId: selected.task === "model" ? c.model : c.concept, ...selected };
  }
  function infer(taskId, stage, opts) {
    const c = categories.find(x => x.concept === taskId || x.model === taskId);
    if (!c) return null;
    if (c.id === "move") return { category: "move", route: "move", step: "move_vfx" };
    const text = stage === "blender" && (!opts || (!opts.source_pack && !opts.input_img));
    const route = text ? "text" : "image";
    let step = stage === "colab" ? "image_colab" :
      stage === "blender" ? (text ? "prompt_3d" : "image_blender") :
      steps(c.id, route).some(x => x.id === stage) ? stage : "appearance";
    return { category: c.id, route, step };
  }
  // Three open tracks: the approved-portrait branch divides into two visible
  // model implementations; the direct-text branch stays below both.
  // Labels are only on actionable steps, never on enclosing route containers.
  function diagram(kind) {
    if (!category(kind)) return [];
    if (kind === "move") return flow.move.map(step => ({type: "step", steps: [step]}));
    return [
      {type: "step", shared: true, steps: [flow.image[0]]},
      {type: "fork", lanes: [
        {id: "image", segments: [
          {type: "step", steps: [flow.image[1]]},
          {type: "step", steps: [flow.image[2]]},
          {type: "parallel", tracks: flow.image.filter(step => step.alternate).map(step => [step])}
        ]},
        {id: "text", segments: flow.text.slice(1, -1).map(step => ({type: "step", steps: [step]}))}
      ]},
      {type: "step", shared: true, steps: [flow.image[flow.image.length - 1]]}
    ];
  }
  // Explicit chooser state machine: category must be chosen before route and node.
  function selectCategory(kind) {
    return category(kind) ? { category: kind, route: null, step: null } : null;
  }
  function selectRoute(choice, route) {
    if (!choice || !category(choice.category)) return null;
    const kind = choice.category;
    if (kind === "move") {
      return route === "move" ? { category: kind, route, step: "move_vfx" } : null;
    }
    return route === "image" || route === "text"
      ? { category: kind, route, step: "appearance" } : null;
  }
  function selectStep(choice, step) {
    const selected = choice && resolve(choice.category, choice.route, step);
    return selected ? { category: choice.category, route: choice.route, step } : null;
  }
  window.COSMI_TASK_FLOW = Object.freeze({ categories, steps, diagram, resolve, infer, selectCategory, selectRoute, selectStep });
})();
