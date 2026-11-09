// COSMIMERA prompt-forge · 任務模板
// 每個模板自帶 version：改產出清單、檔名或 JSON 欄位 → major；只改措辭 → patch（README.md）。
// build(ctx) 只組字串，不碰 DOM，方便日後移到 Node 批次產生。
(function () {
  const C = window.COSMI_CATALOG;

  const STYLE =
    "柔和卡通著色（2–3 階明暗）、乾淨深色描邊、色塊分明、輪廓剪影鮮明、微弱邊緣光；純色或水彩感微紋理背景、主體不與背景融合。必須是原創設計，嚴禁模仿現有商業 IP。";

  // REQ: 使用者 2026-11-07 — 3D 管線的輸入/輸出固定在這兩個雲端硬碟資料夾。
  const DRIVE_IN = "我的雲端硬碟/project/cosmos_chimera/image_in";
  const DRIVE_OUT = "我的雲端硬碟/project/cosmos_chimera/3D_out";

  const CULTURE_RULES =
    "- 文化原型只擷取象徵符號與意象，不直接照搬宗教儀式紋樣，不用神祇/人物本名為角色命名。\n" +
    "- 避免刻板印象與文化嘲弄；若元素有爭議，改用替代意象並於 notes 說明。";

  function json(o) { return "```json\n" + JSON.stringify(o, null, 2) + "\n```"; }
  function list(items) { return items.map(s => "- " + s).join("\n"); }

  function deliverySection(ctx, tree) {
    const isModelRig = ctx.task.id === "model-rig";
    const manifestObj = {
      spec: "cosmimera-art-task/1",
      task_header: "<原樣抄回本 prompt 第一行>",
      task_id: ctx.taskId,
      task_type: ctx.task.id,
      subject_id: ctx.subjectId,
      produced_by: ctx.platformName,
    };
    if (isModelRig) {
      manifestObj.source_pack = ctx.opts?.source_pack || "<來源立繪包 task_id，例 cr-20261106-7f3a-2105 或 chr-20261106-7f3a-2105>";
    }
    Object.assign(manifestObj, {
      files: [{ path: "images/<檔名>.png", kind: "<main|turnaround|view|sheet|spec|script|model|anim|flipbook|storyboard|report>", level: "L1|L2" }],
      missing: [{ item: "<路徑或項目>", level: "L2", reason: "<為何做不到>" }],
      notes: "<設計取捨、文化替代、需要人工確認的點>"
    });

    return [
      "## 交付格式（必須遵守）",
      "把所有檔案打包成 **`" + ctx.taskId + ".zip`**，zip 內頂層是同名資料夾：",
      "```",
      ctx.taskId + "/",
      "├── manifest.json",
      tree,
      "```",
      "manifest.json：",
      json(manifestObj),
      "- **L1 = 必交**；**L2 = 平台能力允許才交**，做不到就列入 `missing`，**不要用佔位或假檔充數**。",
      isModelRig ? "- **source_pack 必須如實填寫來源立繪包 task_id**，供技術美術與審查台 100% 雙向追溯。" : null,
      "- 所有檔名小寫 snake_case，完全照〈產出清單〉。"
    ].filter(Boolean).join("\n");
  }

  function platformSection(ctx) {
    if (ctx.platform === "gemini") {
      return [
        "## 執行方式（Gemini 任務模式）",
        "- 圖像用內建能力逐張產出並依檔名命名。",
        ctx.task.drive
          ? "- 從 Google 雲端硬碟讀取輸入、成品 zip 上傳回雲端硬碟。若無法寫入則提供 zip 下載連結。"
          : "- 全部完成後打包 zip 提供下載（若無法下載則以 code block 與標註檔名提供）。"
      ].join("\n");
    }
    return [
      "## 執行方式（ChatGPT 對話版）",
      "- 圖像用內建生成逐張產出並標註檔名。",
      "- JSON / 文字檔用程式碼執行寫成檔案。",
      "- 完成後依〈交付格式〉打包 zip 下載（若圖片無法進 Python 環境，zip 放文字檔，manifest 照列圖檔名供手動存入）。"
    ].join("\n");
  }

  function common(ctx, body, isPureArt) {
    if (isPureArt) {
      const bgInfo = C.determineAgcBgColor(ctx.concept, ctx.task.needs === "character");
      return [
        ctx.header,
        "",
        "# 任務：" + ctx.task.zh,
        "你是《宙獸紀 COSMIMERA》概念美術設計師。",
        "",
        "## 畫風要求",
        STYLE,
        "",
        body,
        "",
        ctx.notes ? "## 使用者補充（優先於預設）\n" + ctx.notes + "\n" : null,
        "## 自我檢查",
        list([
          "三張圖片均在「同一個對話」中依步驟 1 → 2 → 3 逐張輸出為各自獨立的圖片，無合圖拼貼",
          "步驟 1 正面圖與步驟 2 三視圖背景為 " + bgInfo.toneLabel + "（" + bgInfo.hex + "，RGB三通道均為 " + bgInfo.rgb[0] + "），無動態光影汙染，利於 3D 拓撲",
          "無文字浮水印、簽名或現有商業 IP 元素"
        ])
      ].filter(s => s !== null).join("\n");
    }
    return [
      ctx.header,
      "",
      "# 任務：" + ctx.task.zh,
      "你是《宙獸紀 COSMIMERA》概念美術設計師。",
      "",
      "## 畫風要求",
      STYLE,
      "",
      "## 原創與文化準則",
      CULTURE_RULES,
      "",
      body,
      "",
      ctx.notes ? "## 使用者補充（優先於預設）\n" + ctx.notes + "\n" : null,
      platformSection(ctx),
      "",
      "## 自我檢查",
      list([
        "manifest.task_header 與本 prompt 第一行一字不差",
        "所有 L1 項目均在 files 中，做不到的列入 missing",
        "無文字浮水印、簽名或現有商業 IP 元素"
      ])
    ].filter(s => s !== null).join("\n");
  }

  function creatureStageLines(cc, stages) {
    const sizes = cc.size_profile.split("→");
    const baseOrder = ["juvenile", "adolescent", "adult", "overload"];
    const descOrder = ["overload", "adult", "adolescent", "juvenile"];
    // 依體型由大到小排序：overload → adult → adolescent → juvenile
    const sortedStages = [...stages].sort((a, b) => {
      const ia = descOrder.indexOf(a);
      const ib = descOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return sortedStages.map(s => {
      const i = baseOrder.indexOf(s);
      const st = C.STAGES[i];
      const sz = C.SIZE_CLASSES[sizes[i]];
      return { v: s, zh: st.zh, size: sizes[i], sizeZh: sz.zh, tris: sz.tris, tex: sz.tex };
    });
  }

  function subjectOf(ctx) {
    return ctx.opts.subject === "creature" ? "creature" : "character";
  }

  const TASKS = [
    {
      id: "character-concept", version: "4.2.0", zh: "角色設計概念與立繪", prefix: "chr", platform: "chatgpt",
      needs: "character", drop: "Art/_incoming",
      options: [
        { key: "scene_theme", type: "select", label: "【第 3 輪主立繪】場景主題", items: () => C.SCENE_THEMES, def: "auto" },
        { key: "scene_lighting", type: "select", label: "【第 3 輪主立繪】光影氣候", items: () => C.SCENE_LIGHTINGS, def: "auto" }
      ],
      buildRounds(ctx) {
        const S = ctx.subjectId, c = ctx.concept, o = ctx.opts || {};
        const bgInfo = C.determineAgcBgColor(c, true);
        const sceneInfo = C.resolveDynamicScene(c, true, o);

        // 第 1、2 輪基準資訊：嚴格標準生理外觀與服裝結構（無職業、無姿勢、無動態偏向，確保 T-pose 絕對平正）
        const canonicalAppearance = [
          "## 設計目標：角色【" + (c.name_zh || "原創角色") + "】",
          "- 外觀特徵：" + (c.gender || "角色") + "，約 " + (c.height || "170") + " cm · " + (c.ethnicity || "人種") + " · " + (c.region || "文明") + "（" + (c.timeline || "時空") + "）",
          "- 配色組合：服裝【" + (c.outfit_palette || []).join("、") + "】，髮色【" + (c.hair_palette || []).join("、") + "】，瞳色【" + (c.eye_palette || []).join("、") + "】",
          c.vessel ? "- 收服道具：平靜收合配戴於身側（" + (c.vessel.zh || c.vessel) + "）" : null,
          (c.gender === "女" && c.cup_size && c.cup_size !== "未知") ? ("- 體態特徵：罩杯 " + c.cup_size + "，維持健康勻稱卡通比例") : null
        ].filter(Boolean).join("\n");

        // 第 1 輪：正面正交基準圖
        const r1Prompt = [
          ctx.header,
          "",
          "# 任務：角色設計【第 1 輪 / 正面正交基準圖】",
          "你是《宙獸紀 COSMIMERA》概念美術設計師。",
          "",
          "## 畫風要求",
          STYLE,
          "",
          canonicalAppearance,
          "",
          "## 🎯 本輪生圖指令（建立唯一基因基準）",
          "- **產出檔名**：`images/" + S + "_front.png`",
          "- **畫面內容**：**正面正交基準圖 1:1**",
          "- **姿態與視角**：T-pose 全身置中（雙臂自然張開便於 3D 拓撲）、標準平視正面正交（無透視畸變）、平光無陰影。",
          "- **指定背景**：**" + bgInfo.promptGuide + "**。",
          "- **核心目的**：確立面容、髮型、身形比例與服裝結構，作為後續所有圖片的唯一基準錨點。",
          "",
          "## ⚠️ 規則與自我檢查",
          list([
            "單張獨立輸出為 1:1 圖片，絕不與其他視角拼貼",
            "背景嚴格為純中性灰（" + bgInfo.hex + "，R=G=B=" + bgInfo.rgb[0] + "），杜絕邊緣環境光色偏汙染",
            "純粹平正 T-pose，無任何動態傾斜、戰鬥姿勢或表情誇張",
            "無文字浮水印、無簽名、原創設計嚴禁模仿現有商業 IP"
          ])
        ].filter(Boolean).join("\n");

        // 第 2 輪：T-pose 正交三視圖合圖
        const r2Prompt = [
          "# 任務：角色設計【第 2 輪 / T-pose 正交三視圖合圖】",
          "",
          "## 📌 核心繼承指令（依據第 1 輪基準圖）",
          "**請嚴格參考同對話上方剛生成的「第 1 張正面基準圖」，保持完全相同的面容五官、髮型髮色、服裝結構與配色，進行多視角延伸繪製：**",
          "",
          "## 🎯 本輪生圖指令",
          "- **產出檔名**：`images/" + S + "_turnaround.png`",
          "- **畫面內容**：**T-pose 正交三視圖合圖 16:9**（正面 / 側面 / 背面 / 3/4 視角同比例水平排布）",
          "- **姿態與視角**：自然 T-pose 站姿、嚴格正交平光（無透視畸變、無動態光影）。",
          "- **指定背景**：維持與第 1 輪完全相同之純中性灰（" + bgInfo.hex + "，R=G=B=" + bgInfo.rgb[0] + "），利於 3D 拓撲重建。",
          "",
          "## ⚠️ 規則與自我檢查",
          list([
            "嚴格維持第 1 張基準圖確立的角色容貌與配色 Hex，不產生基因漂移",
            "水平排布各視角，比例尺嚴格一致",
            "維持無傾斜 T-pose，無動態陰影、無氛圍特效、無文字標籤"
          ])
        ].join("\n");

        // 第 3 輪：動態主立繪（場景強化 + 職業與專屬姿勢演出）
        const r3Prompt = [
          "# 任務：角色設計【第 3 輪 / 全身性格主立繪（場景強化）】",
          "",
          "## 📌 核心繼承指令（依據第 1 輪基準圖）",
          "**請重新回到同對話最上方「第 1 張正面基準圖」，維持完全相同的角色容貌、體態比例與服裝細節，繪製生動的全身性格主立繪：**",
          "",
          "## 🎭 角色身份與專屬演繹（僅本輪使用）",
          "- **職業/定位**：【" + (c.role || "冒險者") + "】",
          (c.pose && c.pose !== "未知") ? ("- **角色專屬姿態（職業子項目）**：【" + c.pose + "】") : null,
          c.personality?.length ? ("- **性格特質**：【" + c.personality.join("、") + "】") : null,
          c.style ? ("- **冒險風格**：【" + c.style + "】") : null,
          c.vessel ? ("- **收服道具動態**：手持或施展【" + (c.vessel.zh || c.vessel) + "】") : null,
          "",
          "## 🎯 本輪生圖規格",
          "- **產出檔名**：`images/" + S + "_main.png`",
          "- **畫面規格**：**全身性格主立繪 3:4**（帶動態姿態、性格神韻與專屬場景氛圍）",
          "",
          sceneInfo.fullPromptSection,
          "",
          "## ⚠️ 規則與自我檢查",
          list([
            "主體面容與造型嚴格對齊第 1 輪基準圖",
            "主體全身完整居中，不切頭不切腳，主體邊緣清晰且帶微弱邊緣反光",
            "背景風格維持柔和水彩微紋理或適度景深留白，絕不與主體色調混淆",
            "無文字、無浮水印、原創設計"
          ])
        ].filter(Boolean).join("\n");

        return [
          { round: 1, title: "第 1 輪：正面正交基準圖 (1:1)", filename: S + "_front.png", prompt: r1Prompt },
          { round: 2, title: "第 2 輪：T-pose 三視圖合圖 (16:9)", filename: S + "_turnaround.png", prompt: r2Prompt },
          { round: 3, title: "第 3 輪：動態主立繪 (場景強化)", filename: S + "_main.png", prompt: r3Prompt }
        ];
      },
      build(ctx) {
        const S = ctx.subjectId, c = ctx.concept, o = ctx.opts || {};
        const bgInfo = C.determineAgcBgColor(c, true);
        const sceneInfo = C.resolveDynamicScene(c, true, o);

        const body = [
          "## 設計目標：角色【" + (c.name_zh || "原創角色") + "】",
          "- 外觀特徵：" + (c.gender || "角色") + "，約 " + (c.height || "170") + " cm · " + (c.ethnicity || "人種") + " · " + (c.region || "文明") + "（" + (c.timeline || "時空") + "）",
          "- 配色組合：服裝【" + (c.outfit_palette || []).join("、") + "】，髮色【" + (c.hair_palette || []).join("、") + "】，瞳色【" + (c.eye_palette || []).join("、") + "】",
          c.vessel ? "- 收服道具：平靜收合配戴於身側（" + (c.vessel.zh || c.vessel) + "）" : null,
          (c.gender === "女" && c.cup_size && c.cup_size !== "未知") ? ("- 體態特徵：罩杯 " + c.cup_size + "，維持健康勻稱卡通比例") : null,
          "",
          "## 🎯 三步驟生圖順序（同一對話、分輪次獨立出圖、以圖生圖保持一致性）",
          "請在「同一個對話」中依序逐輪生成以下 3 張獨立圖片，完成一張後再生成下一張：",
          "",
          "### 步驟 1（基準錨定圖）：`images/" + S + "_front.png`",
          "- 內容：**正面正交基準圖 1:1**",
          "- 規範：T-pose 全身置中（雙臂自然張開便於 3D 拓撲）、標準平視正面正交（無透視畸變）、平光無陰影、純中性姿態。",
          "- 背景：**" + bgInfo.promptGuide + "**。",
          "- 目的：確立面容、髮型、身形比例與服裝結構，作為後續圖片的唯一基準錨點。",
          "",
          "### 步驟 2（多視角拓撲圖）：`images/" + S + "_turnaround.png`",
          "- 內容：**T-pose 正交三視圖合圖 16:9**（正 / 側 / 背 / 3/4 視角同比例排布）",
          "- 規範：**嚴格以「步驟 1 正面圖」確立的容貌與服飾為唯一基準**進行多角度延伸，T-pose 正交平光，背景同為 " + bgInfo.hex + "，無透視。",
          "",
          "### 步驟 3（動態主立繪）：`images/" + S + "_main.png`",
          "- 內容：**全身性格主立繪 3:4（場景氛圍與職業演繹強化）**",
          "- **職業/定位**：【" + (c.role || "冒險者") + "】" + ((c.pose && c.pose !== "未知") ? (" · 專屬姿態【" + c.pose + "】") : "") + (c.personality?.length ? (" · 性格【" + c.personality.join("、") + "】") : ""),
          "- 規範：**嚴格以「步驟 1 正面圖」之容貌服飾為基準**，繪製生動性格姿勢與動態氛圍：",
          sceneInfo.fullPromptSection,
          "",
          "## ⚠️ 核心禁忌與防汙染規範",
          "1. 【同一對話、分輪次獨立生成】：三張圖片**必須在同一個對話中依序生成（先 1 → 再 2 → 再 3）**以保持面容與服飾一致，但**必須分別輸出為 3 張獨立不同的圖片**，嚴禁合併繪製在同一張畫布中！",
          "2. 【嚴格防汙染】：步驟 1 與步驟 2 必須維持乾淨純粹的 " + bgInfo.toneLabel + "（" + bgInfo.hex + "）與平光，**嚴禁被步驟 3 主立繪的動態光影、背景雜質或特效所汙染**。",
          "",
          "## 📦 成果打包規範",
          "- 產出完成後若打包 zip 請命名為：`" + ctx.taskId + ".zip`（內部為 `" + ctx.taskId + "/images/...`）。"
        ].filter(Boolean).join("\n");

        return common(ctx, body, true);
      }
    },

    {
      id: "creature-concept", version: "6.3.0", zh: "宙獸設計概念與型態立繪", prefix: "cr", platform: "chatgpt",
      needs: "creature", drop: "Art/_incoming",
      options: [
        { key: "stage", type: "select", label: "宙獸型態（四型態分開產出）", items: () => C.STAGES.map(s => ({ v: s.v, zh: s.zh + "（" + s.v + "）" })), def: "adult" },
        {
          key: "evolution_mode",
          type: "select",
          label: "【演化突變模態】50/50 辨識度守恆",
          items: () => [
            { v: "auto", zh: "🤖 智慧決定（依階級自動匹配）" },
            ...(C.EVOLUTION_MODES ? C.EVOLUTION_MODES.map(m => ({ v: m.id, zh: m.zh + " (" + m.desc.split("、")[0] + ")" })) : [])
          ],
          def: "auto"
        },
        { key: "scene_theme", type: "select", label: "【第 3 輪主立繪】場景主題", items: () => C.SCENE_THEMES, def: "auto" },
        { key: "scene_lighting", type: "select", label: "【第 3 輪主立繪】光影氣候", items: () => C.SCENE_LIGHTINGS, def: "auto" },
        { key: "scene_action", type: "select", label: "【第 3 輪主立繪】動態姿態", items: () => C.SCENE_ACTIONS, def: "auto" }
      ],
      buildRounds(ctx) {
        const S = ctx.subjectId, c = ctx.concept, o = ctx.opts || {};
        const curStage = o.stage || "adult";
        const stageDef = C.STAGES.find(s => s.v === curStage) || C.STAGES[2];
        const bgInfo = C.determineAgcBgColor(c, false);
        const sizes = (c.size_profile || "S→M→L→XL").split("→");
        const stageIdx = ["juvenile", "adolescent", "adult", "overload"].indexOf(curStage);
        const curSize = sizes[stageIdx >= 0 ? stageIdx : 2] || "L";
        const lockedStage = c.locked?.stages?.find(s => s.stage === curStage);
        const curHeight = lockedStage?.height_length || (stageIdx === 2 ? c.height_length : null) || (curSize === "XS" ? "0.20 m" : curSize === "S" ? "0.45 m" : curSize === "M" ? "1.20 m" : curSize === "L" ? "2.20 m" : "4.00 m");
        const stageFeature = curStage === "juvenile" ? "幼態小巧滾圓，動作靈動，保留核心意象特徵" :
          curStage === "adolescent" ? "初顯成年原型輪廓，敏捷感與力量感初具" :
          curStage === "adult" ? "成熟勻稱威嚴，文化原型主體特徵完備" :
          "超載戰鬥極致爆發態，裝甲展開、光環浮現、能量外溢粒子流";

        const sceneInfo = C.resolveDynamicScene(c, false, o, curStage);
        const evoInfo = C.resolveEvolutionPrompt ? C.resolveEvolutionPrompt(o.evolution_mode, curStage, c) : null;

        // 第 1、2 輪基準資訊：嚴格標準生物生理構造（無戰鬥招式特效、無動態光影）
        const canonicalCreature = [
          "## 設計目標：宙獸【" + (lockedStage ? lockedStage.name_zh : (c.name_zh || "原創奇幻生物")) + "】· " + stageDef.zh + "型態",
          "- 體型尺寸：身長/高約 " + curHeight + "（" + curSize + " 級）· " + stageFeature,
          "- 核心構造：非人形生物（獸形/幻獸/機獸），外觀基底為【" + (c.base_parents ? c.base_parents.join(" + ") + " → " : "") + (c.bases ? c.bases.join(" + ") : "") + "】",
          "- 屬性配色：屬性【" + (c.elements || []).join("、") + "】，主色調【" + (c.appearance_palette || []).join("、") + "】",
          c.archetype ? ("- 文化原型意象：" + c.archetype + (c.motifs ? "（象徵圖騰：" + c.motifs + "）" : "")) : null,
          lockedStage?.look ? ("- 定案外觀細節：" + lockedStage.look) : null,
          evoInfo ? evoInfo.guideSection : null
        ].filter(Boolean).join("\n");

        // 第 1 輪：正面正交基準圖
        const r1Prompt = [
          ctx.header,
          "",
          "# 任務：宙獸【" + stageDef.zh + "型態】設計【第 1 輪 / 正面正交基準圖】",
          "你是《宙獸紀 COSMIMERA》概念美術設計師。",
          "",
          "## 畫風要求",
          STYLE,
          "",
          canonicalCreature,
          "",
          "## 🎯 本輪生圖指令（建立唯一基因基準）",
          "- **產出檔名**：`images/cr_" + S + "_" + curStage + "_front.png`",
          "- **畫面內容**：**正面正交基準圖 1:1**",
          "- **姿態與視角**：全身置中、標準平視正面正交（無透視畸變）、自然標準站姿、平光無陰影。",
          "- **指定背景**：**" + bgInfo.promptGuide + "**。",
          "- **核心目的**：確立本型態的標準比例、器官構造、對稱特徵與配色分佈，作為後續圖片的唯一基準錨點。",
          "",
          "## ⚠️ 規則與自我檢查",
          list([
            "單張獨立輸出為 1:1 圖片，絕不與其他視角拼貼",
            "背景嚴格為純中性灰（" + bgInfo.hex + "，R=G=B=" + bgInfo.rgb[0] + "），杜絕邊緣環境光色偏汙染",
            "標準中性平正站姿，無動態攻擊姿勢、無氛圍特效",
            "無文字浮水印、無簽名、原創設計嚴禁模仿現有商業 IP"
          ])
        ].filter(Boolean).join("\n");

        // 第 2 輪：正交三視圖合圖
        const r2Prompt = [
          "# 任務：宙獸【" + stageDef.zh + "型態】設計【第 2 輪 / 正交三視圖合圖】",
          "",
          "## 📌 核心繼承指令（依據第 1 輪基準圖）",
          "**請嚴格參考同對話上方剛生成的「第 1 張正面基準圖」，保持完全相同的身體構造、器官特徵、花紋分布與配色 Hex，進行多角度延伸繪製：**",
          "",
          "## 🎯 本輪生圖指令",
          "- **產出檔名**：`images/cr_" + S + "_" + curStage + "_turnaround.png`",
          "- **畫面內容**：**正交三視圖合圖 16:9**（正面 / 側面 / 背面 / 3/4 視角同比例水平排布）",
          "- **姿態與視角**：自然站姿、嚴格正交平光（無透視畸變、無動態光影）。",
          "- **指定背景**：維持與第 1 輪完全相同之純中性灰（" + bgInfo.hex + "，R=G=B=" + bgInfo.rgb[0] + "），利於 3D 拓撲重建。",
          "",
          "## ⚠️ 規則與自我檢查",
          list([
            "嚴格維持第 1 張基準圖確立的生物造型與配色 Hex，不產生基因漂移",
            "水平排布各視角，比例尺嚴格一致",
            "自然平正站姿，無動態陰影、無氛圍特效、無文字標籤"
          ])
        ].join("\n");

        // 第 3 輪：全身戰鬥主立繪（場景強化 + 專屬招式演出）
        const r3Prompt = [
          "# 任務：宙獸【" + stageDef.zh + "型態】設計【第 3 輪 / 全身戰鬥主立繪（場景強化）】",
          "",
          "## 📌 核心繼承指令（依據第 1 輪基準圖）",
          "**請重新回到同對話最上方「第 1 張正面基準圖」，維持完全相同的生物外觀、器官特徵與配色，繪製生動威嚴的全身戰鬥主立繪：**",
          "",
          "## 💥 戰鬥招式與演繹（僅本輪使用）",
          lockedStage?.signature_move ? ("- **專屬招式演出**：" + lockedStage.signature_move.visual) : null,
          curStage === "overload" ? "- **超載戰鬥極致爆發**：裝甲展開、核心光環浮現、高密度能量粒子流外溢" : null,
          "",
          "## 🎯 本輪生圖指令",
          "- **產出檔名**：`images/cr_" + S + "_" + curStage + "_main.png`",
          "- **畫面規格**：**全身戰鬥主立繪 1:1**（帶動態構圖、戰鬥招式氣浪與屬性場景氛圍）",
          "",
          sceneInfo.fullPromptSection,
          "",
          "## ⚠️ 規則與自我檢查",
          list([
            "主體造型與構造嚴格對齊第 1 輪基準圖",
            "主體全身完整居中，不切頭不切腳，主體邊緣輪廓分明且帶微弱邊緣反光",
            "背景風格維持柔和水彩微紋理或適度景深留白，絕不與主體色調混淆",
            "無文字、無浮水印、原創設計"
          ])
        ].filter(Boolean).join("\n");

        return [
          { round: 1, title: "第 1 輪：正面正交基準圖 (1:1)", filename: "cr_" + S + "_" + curStage + "_front.png", prompt: r1Prompt },
          { round: 2, title: "第 2 輪：正交三視圖合圖 (16:9)", filename: "cr_" + S + "_" + curStage + "_turnaround.png", prompt: r2Prompt },
          { round: 3, title: "第 3 輪：動態主立繪 (場景強化)", filename: "cr_" + S + "_" + curStage + "_main.png", prompt: r3Prompt }
        ];
      },
      build(ctx) {
        const S = ctx.subjectId, c = ctx.concept, o = ctx.opts || {};
        const curStage = o.stage || "adult";
        const stageDef = C.STAGES.find(s => s.v === curStage) || C.STAGES[2];
        const bgInfo = C.determineAgcBgColor(c, false);
        const sizes = (c.size_profile || "S→M→L→XL").split("→");
        const stageIdx = ["juvenile", "adolescent", "adult", "overload"].indexOf(curStage);
        const curSize = sizes[stageIdx >= 0 ? stageIdx : 2] || "L";
        const lockedStage = c.locked?.stages?.find(s => s.stage === curStage);
        const curHeight = lockedStage?.height_length || (stageIdx === 2 ? c.height_length : null) || (curSize === "XS" ? "0.20 m" : curSize === "S" ? "0.45 m" : curSize === "M" ? "1.20 m" : curSize === "L" ? "2.20 m" : "4.00 m");
        const stageFeature = curStage === "juvenile" ? "幼態小巧滾圓，動作靈動，保留核心意象特徵" :
          curStage === "adolescent" ? "初顯成年原型輪廓，敏捷感與力量感初具" :
          curStage === "adult" ? "成熟勻稱威嚴，文化原型主體特徵完備" :
          "超載戰鬥極致爆發態，裝甲展開、光環浮現、能量外溢粒子流";

        const sceneInfo = C.resolveDynamicScene(c, false, o, curStage);
        const evoInfo = C.resolveEvolutionPrompt ? C.resolveEvolutionPrompt(o.evolution_mode, curStage, c) : null;

        const body = [
          "## 設計目標：宙獸【" + (lockedStage ? lockedStage.name_zh : (c.name_zh || "原創奇幻生物")) + "】· " + stageDef.zh + "型態",
          "- 體型尺寸：身長/高約 " + curHeight + "（" + curSize + " 級）· " + stageFeature,
          "- 核心構造：非人形生物（獸形/幻獸/機獸），外觀基底為【" + (c.base_parents ? c.base_parents.join(" + ") + " → " : "") + (c.bases ? c.bases.join(" + ") : "") + "】",
          "- 屬性配色：屬性【" + (c.elements || []).join("、") + "】，主色調【" + (c.appearance_palette || []).join("、") + "】",
          c.archetype ? ("- 文化原型意象：" + c.archetype + (c.motifs ? "（象徵圖騰：" + c.motifs + "）" : "")) : null,
          lockedStage?.look ? ("- 定案外觀細節：" + lockedStage.look) : null,
          evoInfo ? evoInfo.guideSection : null,
          "",
          "## 🎯 三步驟生圖順序（同一對話、分輪次獨立出圖、以圖生圖保持一致性）",
          "請在「同一個對話」中依序逐輪生成以下 3 張獨立圖片，完成一張後再生成下一張：",
          "",
          "### 步驟 1（基準錨定圖）：`images/cr_" + S + "_" + curStage + "_front.png`",
          "- 內容：**正面正交基準圖 1:1**",
          "- 規範：全身置中、標準平視正面正交（無透視畸變）、自然標準站姿、平光無陰影、純中性姿態。",
          "- 背景：**" + bgInfo.promptGuide + "**。",
          "- 目的：確立本型態的標準比例、器官構造、對稱特徵與配色分佈，作為後續圖片的唯一基準錨點。",
          "",
          "### 步驟 2（多視角拓撲圖）：`images/cr_" + S + "_" + curStage + "_turnaround.png`",
          "- 內容：**正交三視圖合圖 16:9**（正面 / 側面 / 背面 / 3/4 視角同比例排布）",
          "- 規範：**嚴格以「步驟 1 正面圖」確立的造型、顏色與構造為唯一基準**進行多角度延伸，自然站姿，嚴格正交平光，背景同為 " + bgInfo.hex + "，無透視。",
          "",
          "### 步驟 3（動態主立繪）：`images/cr_" + S + "_" + curStage + "_main.png`",
          "- 內容：**全身戰鬥主立繪 1:1（場景氛圍與招式演出強化）**",
          lockedStage?.signature_move ? ("- **專屬招式演出**：" + lockedStage.signature_move.visual) : null,
          curStage === "overload" ? "- **超載戰鬥極致爆發**：裝甲展開、核心光環浮現、高密度能量粒子流外溢" : null,
          "- 規範：**嚴格以「步驟 1 正面圖」之造型為基準**，繪製生動的戰鬥動態姿勢：",
          sceneInfo.fullPromptSection,
          "",
          "## ⚠️ 核心禁忌與防汙染規範",
          "1. 【同一對話、分輪次獨立生成】：三張圖片**必須在同一個對話中依序生成（先 1 → 再 2 → 再 3）**以保持基因一致，但**必須分別輸出為 3 張獨立不同的圖片**，嚴禁合併繪製在同一張畫布中！",
          "2. 【嚴格防汙染】：步驟 1 正面圖與步驟 2 三視圖必須維持乾淨純粹的 " + bgInfo.toneLabel + "（" + bgInfo.hex + "）與平光，**嚴禁被步驟 3 主立繪的動態光影、絢麗特效或複雜背景所汙染**。",
          "",
          "## 📦 成果打包規範",
          "- 產出完成後若打包 zip 請命名為：`" + ctx.taskId + ".zip`（內部為 `" + ctx.taskId + "/images/...`）。"
        ].filter(Boolean).join("\n");

        return common(ctx, body, true);
      }
    },

    {
      // REQ: 使用者 2026-11-07 — image-to-3D → Blender → 綁骨 → 動作在同一管線；輸入/輸出走 Google 雲端硬碟；可批次；宙獸四型態分開處理。
      // 取代 animation-set（已退役）。招式不在此管線：招式是獨立圖鑑條目，由 move-vfx 處理。
      id: "model-rig", version: "3.2.0", zh: "Image-to-3D 建模、綁骨與動作（雲端硬碟立繪包）", prefix: "mdl", platform: "gemini",
      needs: "either", drop: "Art/_incoming", drive: true,
      options: [
        { key: "scope", type: "select", label: "範圍", items: () => [{ v: "single", zh: "單一立繪包（目前概念）" }, { v: "batch", zh: "批次：image_in 內所有立繪包" }], def: "single" },
        { key: "source_pack", type: "text", label: "參照立繪包 ID (source_pack)", def: "", placeholder: "例：cr-20261106-7f3a-2105-adult 或 chr-20261106-7f3a-2105", when: o => o.scope !== "batch" },
        { key: "input_img", type: "text", label: "指定輸入 img", def: "", placeholder: "選填，留空預設使用正面正交 + turnaround 三視圖", when: o => o.scope !== "batch" },
        { key: "subject", type: "select", label: "對象", items: () => [{ v: "character", zh: "目前角色概念" }, { v: "creature", zh: "目前宙獸概念" }], def: "creature", when: o => o.scope !== "batch" },
        { key: "stage", type: "select", label: "宙獸型態（分開處理）", items: () => C.STAGES.map(s => ({ v: s.v, zh: s.zh + "（" + s.v + "）" })), def: "adult", when: o => o.scope !== "batch" && o.subject === "creature" },
        { key: "actions_character", type: "checks", label: "角色動作", items: () => C.ACTIONS.character.map(a => ({ v: a.id, zh: a.zh })), def: "all", when: o => o.scope === "batch" || o.subject !== "creature" },
        { key: "actions_creature", type: "checks", label: "宙獸動作", items: () => C.ACTIONS.creature.map(a => ({ v: a.id, zh: a.zh })), def: "all", when: o => o.scope === "batch" || o.subject === "creature" }
      ],
      build(ctx) {
        const o = ctx.opts, batch = o.scope === "batch";
        const kinds = batch ? ["character", "creature"] : [subjectOf(ctx)];
        const S = batch ? "<subject_id>" : ctx.subjectId;
        const curStage = o.stage || "adult";
        const stageDef = C.STAGES.find(s => s.v === curStage) || C.STAGES[2];
        const outId = batch ? ctx.taskId + "-<subject-id>" : ctx.taskId;

        const clipTable = kind => {
          const isCr = kind === "creature";
          const picked = isCr ? o.actions_creature : o.actions_character;
          return C.ACTIONS[kind].filter(a => picked.includes(a.id)).map(a =>
            "| `" + (isCr ? "cr_" + curStage + "_" : "chr_") + a.id + "` | " + a.zh + " | " + a.f + " | " + (a.loop ? "✓" : "") + " | " + (a.rm ? "✓" : "") + " | " + (a.ev || []).join(", ") + " |"
          ).join("\n");
        };
        const rigRule = {
          creature: "Generic 骨架：`Root`（地面，pivot）→ `Hips` → `Spine_01..n` → `Neck` → `Head`；四肢 `L_`/`R_` 前綴；尾巴 `Tail_01..n`、翅膀 `Wing_L_01..n`；插槽骨 `Socket_Mouth`、`Socket_Head`、`Socket_Core_FX`、`Socket_Front`、`Socket_PetTouch`、`Socket_Ground_FX`。骨骼 ≤ 60。",
          character: "Unity Humanoid 相容命名：Hips, Spine, Chest, UpperChest, Neck, Head, Left/RightShoulder, Left/RightUpperArm, Left/RightLowerArm, Left/RightHand, 手指三節（Thumb/Index/Middle/Ring/Little）, Left/RightUpperLeg, Left/RightLowerLeg, Left/RightFoot, Left/RightToes；額外骨（頭髮/披風）用 `Extra_` 前綴；插槽骨 `Socket_HandR_Prop`、`Socket_HandL_Prop`、`Socket_Back_Pack`、`Socket_Throw`、`Socket_Head_FX`。骨骼 ≤ 75（含手指）。"
        };
        const sizeTable = Object.keys(C.SIZE_CLASSES).map(k => "| " + k + " | " + C.SIZE_CLASSES[k].tris + " | " + C.SIZE_CLASSES[k].tex + "² |").join("\n");

        const kindBlocks = kinds.map(kind => {
          const isCr = kind === "creature";
          const unit = isCr ? "cr_" + S + "_" + curStage : S;
          let src = isCr
            ? "`images/cr_" + S + "_" + curStage + "_front.png`（單張正面正交灰底）+ `_turnaround.png`（側/背/3/4 從三視圖裁切）"
            : "`images/" + S + "_front.png`（單張正面正交灰底）+ `_turnaround.png`（側/背/3/4 從三視圖裁切）";
          if (o.input_img) {
            src = "`" + o.input_img + "`（審查台指定輸入立繪，其餘視圖由三視圖裁切補齊）";
          }
          return [
            "### " + (isCr ? "宙獸型態：" + stageDef.zh + "（`cr-*-" + curStage + "`）" : "角色（立繪包 task_type = character-concept，`chr-` 開頭）"),
            "- image-to-3D 輸入圖：" + src + "。",
            isCr
              ? "- 目標型態：" + stageDef.zh + "（" + curStage + "），獨立模型、一套骨架與動作。面數與貼圖依該型態 size_class 查上表。"
              : "- 面數 15–25k tris，貼圖 2048²。",
            "- 骨架：" + rigRule[kind],
            "- 動作（30 fps；loop＝循環；RM＝root motion）：",
            "",
            "| clip | 說明 | 幀數 | loop | RM | 事件@幀 |",
            "|---|---|---|---|---|---|",
            clipTable(kind),
            "",
            "產出（`<unit>` = `" + unit + "`）：",
            "",
            "| 檔案 | 內容 | 層級 |",
            "|---|---|---|",
            "| `images/<unit>_model_front.png`、`_model_side.png`、`_model_back.png` | 建模參考圖：平光、無描邊、無陰影、灰底 1:1、全身置中 2048px | L1 |",
            "| `images/<unit>_anim_sheet_01.png` | 關鍵姿勢分鏡，每動作 3–5 格 | L1 |",
            "| `models/<unit>.glb`、`models/<unit>.fbx` | image-to-3D 產生、減面 UV 烘焙並綁骨之模型 | L2 |",
            "| `anims/" + (isCr ? "cr_" + curStage + "_<clip>" : "chr_<clip>") + ".fbx` | 完成動畫，每 clip 一檔 | L2 |"
          ].join("\n");
        }).join("\n\n");

        const inputSection = batch
          ? [
            "## 輸入：Google 雲端硬碟立繪包（批次）",
            list([
              "資料夾：`" + DRIVE_IN + "/`。處理其中所有 `chr-*.zip` 與 `cr-*.zip`。",
              "跳過已完成的：`" + DRIVE_OUT + "/` 已有任何 `mdl-*.zip` 的 manifest.source_pack 等於該立繪包 task_id。",
              "逐包獨立處理：每包各打包獨立 zip。"
            ])
          ].join("\n")
          : [
            "## 輸入：Google 雲端硬碟立繪包",
            list([
              o.source_pack
                ? "資料夾：`" + DRIVE_IN + "/`。指定來源立繪包：`" + o.source_pack + ".zip`（manifest.task_id = `" + o.source_pack + "`）。"
                : "資料夾：`" + DRIVE_IN + "/`。找 manifest.subject_id = `" + S + "` 的立繪包。",
              o.input_img ? "指定 image-to-3D 輸入圖：`" + o.input_img + "`。" : null,
              "找不到就停下來告訴我，不要改用其他主體或自行生成立繪。"
            ].filter(Boolean))
          ].join("\n");

        const body = [
          inputSection,
          "",
          "## 規格與產出",
          kindBlocks,
          "",
          "### 共同規格腳本（L1）",
          "| 檔案 | 內容 | 層級 |",
          "|---|---|---|",
          "| `rig/rig_spec.json` | 骨骼清單：name、parent、head/tail 位置、插槽骨 | L1 |",
          "| `rig/build_rig.py` | Blender 腳本：匯入同名 mesh → 清理/減面 → 依 rig_spec 建 armature、權重、插槽骨 → 匯出 FBX/GLB | L1 |",
          "| `anims/anim_spec.json` | 動作 clip 規格與 key_poses | L1 |",
          "| `anims/keyframes.py` | Blender 腳本：依 anim_spec 建 Actions 並匯出 FBX | L1 |",
          "| `pipeline/run_all.py` | 一鍵串接腳本 | L1 |",
          "| `pipeline/README.md` | 執行步驟與參數說明 | L1 |",
          "",
          "## 交付格式",
          list([
            "單獨打包成 `" + outId + ".zip` 上傳至 `" + DRIVE_OUT + "/`。",
            "manifest.json 填入 `source_pack: \"" + (o.source_pack || "<來源立繪包 task_id>") + "\"`。"
          ])
        ].join("\n");
        const tree = "├── images/\n├── rig/\n├── anims/\n├── pipeline/\n└── models/      # L2";
        return common(ctx, body) + "\n\n" + deliverySection(Object.assign({}, ctx, { taskId: outId, subjectId: S }), tree);
      }
    },

    {
      id: "move-vfx", version: "1.1.0", zh: "招式效果動畫（特效）", prefix: "fx", platform: "chatgpt",
      needs: null, drop: "Art/_incoming",
      options: [
        { key: "use_creature", type: "select", label: "示範施放者", items: () => [{ v: "yes", zh: "以目前宙獸概念示範" }, { v: "no", zh: "不指定（通用示範）" }], def: "yes" },
        // 有示範施放者時只允許它自己的屬性，否則示範畫面的招式配色會跟施放者對不上
        { key: "element", type: "select", label: "屬性", items: (o, env) => C.ELEMENTS.filter(e => o.use_creature !== "yes" || (env.creature.elements || []).includes(e.v)).map(e => ({ v: e.v, zh: e.zh + " " + e.v })), def: "rand" },
        { key: "shape", type: "select", label: "形狀", items: () => C.VFX.shapes, def: "rand" },
        { key: "tier", type: "select", label: "強度", items: () => C.VFX.tiers, def: "rand" },
        { key: "move_name", type: "text", label: "招式名稱（可留空讓 AI 命名）", def: "" },
        { key: "move_id", type: "text", label: "招式圖鑑 id（snake_case，可留空讓 AI 命名）", def: "" },
        { key: "common", type: "checks", label: "附帶通用特效", items: () => C.VFX.common, def: [], optional: true }
      ],
      build(ctx) {
        const o = ctx.opts, el = C.ELEMENTS.find(e => e.v === o.element);
        const shape = C.VFX.shapes.find(s => s.v === o.shape), tier = C.VFX.tiers.find(t => t.v === o.tier);
        const base = "fx_" + o.element + "_" + o.shape + "_" + o.tier;
        const commons = C.VFX.common.filter(x => o.common.includes(x.v));
        const body = [
          "## 招式",
          json({
            move_name: o.move_name || "（請命名，中英各一）", element: o.element + "（" + el.zh + "）", palette: el.palette,
            shape: shape.v + "（" + shape.zh + "）", tier: tier.v + "（" + tier.zh + "）",
            move_id: o.move_id || "（請取 snake_case 通用名稱，不含任何宙獸名）",
            demo_caster: o.use_creature === "yes" ? ctx.concept : "不指定，用中性體型示範"
          }),
          // REQ: 使用者 2026-11-07 — 招式圖鑑獨立於宙獸圖鑑，多隻宙獸可共用同一招式。
          "招式是**獨立圖鑑條目**，任何宙獸都可能學會：demo_caster 只用於分鏡示範，特效不得依賴它的特定身體部位或外觀。",
          "",
          "## 產出清單",
          "| 檔案 | 內容 | 層級 |",
          "|---|---|---|",
          "| `vfx/" + base + "_spec.json` | 特效規格（欄位見下） | L1 |",
          "| `images/" + base + "_storyboard.png` | 分鏡 6 格：預備 → 施放 → 飛行/展開 → 命中 → 餘韻 → 消散，標註毫秒 | L1 |",
          "| `images/" + base + "_layers.png` | 圖層拆解：核心、外光、粒子、拖尾、地面印記、衝擊波各自獨立示意 | L1 |",
          "| `vfx/" + base + "_flipbook.png` | 序列圖 8×8 格、2048²（每格 256²），純黑底（additive 用），單一主要元素循環 | L2 |",
          commons.map(x => "| `vfx/fx_common_" + x.v + "_spec.json` + `images/fx_common_" + x.v + "_storyboard.png` | 通用特效：" + x.zh + " | L1 |").join("\n"),
          "",
          "### spec.json 欄位",
          json({
            id: base, move_id: o.move_id || "<snake_case>", phases: [{ name: "anticipation|cast|travel|impact|linger|fade", start_ms: 0, end_ms: 0, description_zh: "" }],
            colors_hex: { core: "#", glow: "#", accent: "#" },
            geometry: { range_class: "melee|mid|long", shape: shape.v, length_m: 0, width_m: 0, angle_deg: 0, radius_m: 0, arc_height_m: 0, note: "尺寸以 base_range 為 1.0 的比例另列 scale_by_range" },
            layers: [{ name: "", type: "mesh|particles|trail|decal|light|distortion", count: 0, lifetime_ms: 0, size_m: 0, speed_mps: 0, texture: "", blend: "additive|alpha" }],
            sockets: ["Socket_Front"], hit_stop_ms: 0, camera_shake: { amplitude: 0, duration_ms: 0 },
            sound_cues_zh: [""], deck_budget: { max_particles: 0, note: "Steam Deck 版粒子數約為 PC 的 50%" },
            unity_notes: "URP VFX Graph 實作建議；卡通風：硬邊漸層、2–3 色階、避免寫實煙霧"
          }),
          "",
          "## 規格",
          list([
            "形狀必須清楚表達判定範圍（玩家要看得出會不會被打到）；地面印記表示範圍邊界。",
            "強度越高：預備時間越長、畫面占比越大；超載必殺可加短暫的全螢幕色調變化（≤ 400 ms）。",
            "同屬性的特效共用配色語言：" + el.palette + "。",
            "特效從宙獸插槽骨發出（Socket_Front / Socket_Core_FX / Socket_Ground_FX），尺寸隨施放者體型（S/M/L/XL）縮放，在 spec 的 geometry.note 寫明縮放規則。"
          ])
        ].join("\n");
        return common(ctx, body) + "\n\n" + deliverySection(ctx, "├── images/\n└── vfx/");
      }
    },

    {
      id: "capture-vessel", version: "1.0.0", zh: "收服道具設計", prefix: "vsl", platform: "chatgpt",
      needs: null, drop: "Art/_incoming",
      options: [
        { key: "vessels", type: "checks", label: "道具類別", items: () => C.VESSELS.map(v => ({ v: v.v, zh: v.zh + "（副手提供" + v.sub + "）" })), def: ["talisman_card", "glass_bead", "magic_cube"] },
        { key: "variants", type: "select", label: "外觀變體數", items: () => [1, 3, 5].map(n => ({ v: String(n), zh: n + " 種" })), def: "3" }
      ],
      build(ctx) {
        const vs = C.VESSELS.filter(v => ctx.opts.vessels.includes(v.v));
        const rows = vs.map(v => [
          "| `images/vsl_" + v.v + "_concept.png` | " + v.zh + "：收合 / 展開 / 收服中 三態 | L1 |",
          "| `images/vsl_" + v.v + "_variants.png` | " + ctx.opts.variants + " 種外觀變體並排（同類別、可辨識） | L1 |",
          "| `images/vsl_" + v.v + "_icon.png` | 512² 圖示，簡潔剪影、深色底 | L1 |",
          "| `images/vsl_" + v.v + "_model_front.png`、`_model_side.png` | 建模參考，平光灰底 | L1 |",
          "| `images/vsl_" + v.v + "_capture_storyboard.png` | 收服分鏡 8 格：投擲 → 飛行 → 命中 → 展開 → 吸入 → 掙扎 1–3 次 → 成功 / 失敗 | L1 |",
          "| `vfx/vsl_" + v.v + "_capture_spec.json` | 收服特效規格（同招式 spec 欄位） | L1 |"
        ].join("\n"));
        const body = [
          "## 遊戲規則背景",
          "玩家投擲收服道具收服宙獸。三個類別作為主力時無差別；作為副手時，提供給主力的內容由類別決定：",
          list(C.VESSELS.map(v => v.zh + " → " + v.sub)),
          "因此三類道具的外觀語言要**一眼可分**，並暗示它的副手效果。",
          "",
          "## 設計方向",
          json(vs.map(v => ({ id: v.v, name: v.zh, gives_sub: v.sub, look: v.look }))),
          "",
          "## 產出清單",
          "| 檔案 | 內容 | 層級 |",
          "|---|---|---|",
          "| `concept.json` | 每類：名稱中英、材質、配色 hex、變體清單、副手效果的視覺暗示、投擲手感描述 | L1 |",
          rows.join("\n"),
          "| `models/vsl_<id>.glb` | 道具模型 ≤ 1.5k tris，開合以 2–4 根骨骼驅動 | L2 |",
          "",
          "## 規格",
          list([
            "握持尺寸：卡片約 6×9 cm、珠子直徑約 5 cm、方塊邊長約 6 cm；三者在角色手中都要清楚可見。",
            "收服特效需呼應道具本身（符文封印陣 / 光泡包覆 / 方塊牢籠展開）。",
            "對應角色投擲動作：throw_card（雙指甩出）、throw_bead（下手拋擲）、throw_cube（轉動後上手投）。"
          ])
        ].join("\n");
        return common(ctx, body) + "\n\n" + deliverySection(ctx, "├── concept.json\n├── images/\n├── vfx/\n└── models/      # L2");
      }
    },

    {
      id: "culture-research", version: "1.0.0", zh: "文化原型考據", prefix: "res", platform: "gemini",
      needs: null, drop: "Data/_incoming",
      options: [
        { key: "region", type: "select", label: "地區", items: () => C.RESEARCH_REGIONS.map(r => ({ v: r, zh: r })), def: "rand" },
        { key: "count", type: "select", label: "原型數量", items: () => [15, 20, 30].map(n => ({ v: String(n), zh: n + " 個" })), def: "20" }
      ],
      build(ctx) {
        const o = ctx.opts;
        const existing = C.CREATURE.archetypes.filter(a => a.region === o.region).map(a => a.name);
        const body = [
          "## 目標",
          "為宙獸設計建立「" + o.region + "」地區的文化原型考據庫，共 " + o.count + " 個（神祇、英雄、歷史名人、傳說生物、文學人物混合，歷史名人與傳說至少各 1/4）。",
          "已收錄、不要重複：" + (existing.join("、") || "（無）"),
          "",
          "## 產出清單",
          "| 檔案 | 內容 | 層級 |",
          "|---|---|---|",
          "| `archetypes.json` | 陣列，欄位見下 | L1 |",
          "| `report.md` | 地區概述、取材分布、敏感度判斷理由、建議排除清單 | L1 |",
          "",
          "### archetypes.json 每筆",
          json({
            id: "snake_case 英文", name_local: "", name_zh: "", region: o.region, culture: "",
            type: "神祇|英雄|歷史名人|傳說|文學", motifs: ["象徵物/配色/姿態"], colors_hex: ["#"],
            story_summary_zh: "≤80 字", suitable_elements: ["metal|wood|water|fire|earth|ice|wind|thunder|light|shadow"],
            suitable_bases: ["生物|人形|器械|載具"], sensitivity: "ok|review", sensitivity_reason: "",
            sources: [{ title: "", url: "" }]
          }),
          "",
          "## 規則",
          list([
            "仍在信仰中的宗教主神、族群神聖敘事、近代爭議人物 → `sensitivity: review` 並說明理由。",
            "每筆至少 2 個可查證來源（學術、博物館、百科），附 URL；查不到可靠來源就不要收錄。",
            "motifs 要具體到可畫出來（物件、顏色、動作），不要抽象形容詞。"
          ])
        ].join("\n");
        return common(ctx, body) + "\n\n" + deliverySection(ctx, "├── archetypes.json\n└── report.md");
      }
    }
  ];

  window.COSMI_TASKS = TASKS;
})();
