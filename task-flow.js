// The task chooser mirrors the asset pipeline; keep it independent of DOM and task templates.
(function () {
  "use strict";
  const categories = Object.freeze([
    { id: "character", zh: "角色", icon: "👤", concept: "character-concept", model: "character-model-rig" },
    { id: "creature", zh: "宙獸", icon: "🐉", concept: "creature-concept", model: "creature-model-rig" },
    { id: "move", zh: "招式", icon: "✨", concept: "move-vfx", model: null }
  ]);
  const flow = Object.freeze({
    image: [
      { id: "appearance", stage: "appearance", task: "concept", name: "外觀設定", detail: "只設計外觀與辨識特徵，不混入 3D 或交付指令。", output: "appearance.md" },
      { id: "portrait", stage: "portrait", task: "concept", name: "生成立繪", detail: "正面基準圖 → T-pose 多視角 → 動態主立繪；可選手動複製或 Drive 自動模式。", output: "立繪圖片" },
      { id: "review_portrait", stage: "review_portrait", task: "concept", name: "立繪審查", detail: "核對各視角一致性與缺陷；通過後才允許圖片建模。", output: "立繪審查紀錄" },
      { id: "image_colab", stage: "colab", task: "model", name: "Colab ＋ Blender", detail: "Image-to-3D 分支 A：使用已核准立繪，Colab 建模並以 Blender 修復、檢查與輸出。與 AI ＋ Blender 二選一。", output: ".glb ＋ .blend、骨架、動作、QA", alternate: true },
      { id: "image_blender", stage: "blender", task: "model", name: "AI ＋ Blender", detail: "Image-to-3D 分支 B：使用已核准立繪，由 AI 操作 Blender 建模、綁骨、製作動作及檢查。與 Colab ＋ Blender 二選一。", output: ".glb ＋ .blend、骨架、動作、QA", alternate: true },
      { id: "review_3d", stage: "review_3d", task: "model", name: "最終驗收", detail: "檢查模型與已核准立繪、材質、骨架、動作及 manifest；人工確認後才歸檔。", output: "最終審查紀錄" }
    ],
    text: [
      { id: "appearance", stage: "appearance", task: "concept", name: "外觀設定", detail: "先確定原創外觀與辨識特徵，不需要先畫正面圖。", output: "appearance.md" },
      { id: "prompt_3d", stage: "blender", task: "model", name: "Prompt-to-3D · AI ＋ Blender", detail: "在立繪之前分岔。以文字直接在 Blender 原創建模、綁骨、製作動作並輸出 .glb／.blend；只有宙獸文字分支須產生圖鑑。", output: ".glb ＋ .blend；宙獸另含 bestiary.md" },
      { id: "portrait_3d", stage: "portrait_3d", task: "concept", name: "補畫主立繪", detail: "建模完成後依 3D 模型與多角度預覽補畫動態主立繪，不需要正面基準圖或 T-pose 三視圖。", output: "動態主立繪" },
      { id: "review_portrait_3d", stage: "review_portrait", task: "concept", name: "補繪立繪審查", detail: "檢查補畫立繪是否和模型一致，核准並綁定到 3D 成果，才能進入最終驗收。", output: "立繪審查與來源綁定" },
      { id: "review_3d", stage: "review_3d", task: "model", name: "最終驗收", detail: "同時查驗已完成的 3D 與補繪立繪；缺立繪、綁定或 .glb／.blend 均不得通過。", output: "最終審查紀錄" }
    ],
    move: [
      { id: "move_vfx", stage: "move_vfx", task: "concept", name: "招式與特效設計", detail: "獨立招式圖鑑條目：設定屬性、形狀與強度，生成規格、六格分鏡、分層拆解與序列圖。施放者僅用於示範。", output: "spec.json、storyboard、layers、flipbook" }
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
    const text = stage === "portrait_3d" ||
      (stage === "blender" && (!opts || (!opts.source_pack && !opts.input_img)));
    const route = text ? "text" : "image";
    let step = stage === "colab" ? "image_colab" :
      stage === "blender" ? (text ? "prompt_3d" : "image_blender") :
      stage === "portrait_3d" ? "portrait_3d" :
      stage === "review_portrait" && text ? "review_portrait_3d" :
      steps(c.id, route).some(x => x.id === stage) ? stage : "appearance";
    return { category: c.id, route, step };
  }
  // Diagram rows preserve alternate paths as a parallel fork instead of sequential tasks.
  function diagram(kind, route) {
    const list = steps(kind, route);
    if (!list.length) return [];
    if (route === "image" && kind !== "move") return [
      ...list.slice(0, 3).map(step => ({ type: "step", steps: [step] })),
      { type: "branch", label: "二選一建模管線", steps: list.slice(3, 5) },
      { type: "step", steps: [list[5]] }
    ];
    return list.map(step => ({ type: "step", steps: [step] }));
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
