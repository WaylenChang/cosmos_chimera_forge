// COSMIMERA prompt-forge · 任務模板
// 每個模板自帶 version：改產出清單、檔名或 JSON 欄位 → major；只改措辭 → patch（README.md）。
// build(ctx) 只組字串，不碰 DOM，方便日後移到 Node 批次產生。
(function () {
  const C = window.COSMI_CATALOG;

  const STYLE =
    "柔和卡通著色（2–3 階明暗）、乾淨深色描邊、色塊分明、剪影鮮明、微弱邊緣光；純色平光背景，主體不與背景融合。無文字、無簽名浮水印、原創設計。";

  // All paths below are relative to project/cosmos_chimera_forge on Google Drive.
  const DRIVE_IN = "01_portraits";
  const DRIVE_OUT = "02_3d/ai_blender";
  const DRIVE_BACKUP = "backup/image_backup";

  function storageSection(ctx) {
    const dir = /model|rig|anim/.test(ctx.task.id) ? DRIVE_OUT : DRIVE_IN;
    return [
      "## Google Drive 讀寫與存放",
      "- 專案根目錄：`project/cosmos_chimera_forge/`；以下路徑皆相對於此根目錄，不使用本機絕對路徑。",
      "- 本次 prompt：`prompts/" + ctx.taskId + ".prompt.md`；參考立繪：`image_in/` 或已歸檔的 `image_backup/`；3D 參考及輸出：`3D_out/`。",
      "- 成果包儲存為 `" + dir + "/" + ctx.taskId + ".zip`，包內參照仍相對於 task_id 資料夾（例如 `images/`、`models/`）。",
      "- 無法直接寫入 Drive 時，提供下載並指明上述相對存放位置；不要宣稱已上傳。"
    ].join("\n");
  }

  const CULTURE_RULES =
    "- 文化原型只擷取象徵符號與意象，不直接照搬宗教儀式紋樣，不用神祇/人物本名為角色命名。\n" +
    "- 避免刻板印象與文化嘲弄；若元素有爭議，改用替代意象並於 notes 說明。";

  function json(o) { return "```json\n" + JSON.stringify(o, null, 2) + "\n```"; }
  function list(items) { return items.map(s => "- " + s).join("\n"); }

  function modelQualityRules() {
    return [
      "## 5. 最終品質檢查（交付前逐項確認）",
      "- 從正面、側面、背面及旋轉視角詳細檢查模型與匯出的 GLB：臉部清楚可見，不被頭髮、配件或其他物件遮擋。",
      "- 修復破圖、網格破洞、穿透或透視露空、貼圖與法線錯誤；確認軀幹完整存在，頭部、四肢及其他身體部位與軀幹自然且完整連接，無斷裂或懸空。",
      "- 在 Blender 重新開啟 .blend，並重新載入 .glb 檢查幾何、材質和姿態；修正問題後再交付。"
    ].join("\n");
  }

  function modelResearchRules() {
    return "- **原型研究與設計**：先判斷立繪的設計原型屬於何種人形、怪物、生物、奇幻生物或超自然物件，搜尋相關的解剖、結構、運動方式與視覺資料；綜合研究結果與本次立繪，再原創設計外觀、適合該原型的骨架及各種自然可信的動作。若無法搜尋，須如實說明，不得虛構資料來源。";
  }

  function deliverySection(ctx, tree) {
    const isModelRig = ctx.task.id === "creature-model-rig" || ctx.task.id === "character-model-rig" || ctx.task.id === "model-rig";
    const manifestObj = {
      spec: "cosmimera-art-task/1",
      task_header: "<原樣抄回本 prompt 第一行>",
      task_id: ctx.taskId,
      task_type: ctx.task.id,
      subject_id: ctx.subjectId,
      produced_by: ctx.platformName,
    };
    if (isModelRig) {
      manifestObj.source_pack = ctx.opts?.source_pack || (ctx.task.id === "character-model-rig" ? "<來源立繪包 task_id，例 chr-20261106-7f3a-2105>" : "<來源立繪包 task_id，例 cr-20261106-7f3a-2105-adult>");
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
      return [
        ctx.header,
        "",
        "# 任務：" + ctx.task.zh,
        "",
        "## 畫風要求",
        STYLE,
        "",
        body,
        "",
        ctx.notes ? "## 使用者補充\n" + ctx.notes + "\n" : null
      ].filter(s => s !== null).join("\n");
    }
    return [
      ctx.header,
      "",
      "# 任務：" + ctx.task.zh,
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
      id: "character-concept", version: "4.3.1", zh: "角色設計概念與立繪", prefix: "chr", platform: "chatgpt",
      needs: "character", drop: "Art/_incoming",
      options: [
        { key: "scene_theme", type: "select", label: "【第 3 輪主立繪】場景主題", items: () => C.SCENE_THEMES, def: "auto" },
        { key: "scene_lighting", type: "select", label: "【第 3 輪主立繪】光影氣候", items: () => C.SCENE_LIGHTINGS, def: "auto" }
      ],
      buildRounds(ctx) {
        const S = ctx.subjectId, c = ctx.concept, o = ctx.opts || {};
        const bgInfo = C.determineAgcBgColor(c, true);
        const sceneInfo = C.resolveDynamicScene(c, true, o);

        const canonicalAppearance = [
          "## 角色設定：【" + (c.name_zh || "原創角色") + "】",
          "- 體貌特徵：" + (c.gender || "角色") + "，約 " + (c.height || "170") + " cm · " + (c.ethnicity || "") + (c.region ? " · " + c.region : "") + (c.timeline ? "（" + c.timeline + "）" : ""),
          "- 配色設定：服裝【" + (c.outfit_palette || []).join("、") + "】，髮色【" + (c.hair_palette || []).join("、") + "】，瞳色【" + (c.eye_palette || []).join("、") + "】",
          c.vessel ? "- 隨身裝備：收服道具佩戴於身側（" + (c.vessel.zh || c.vessel) + "）" : null,
          (c.gender === "女" && c.cup_size && c.cup_size !== "未知") ? ("- 體態特徵：罩杯 " + c.cup_size + "，健康勻稱卡通比例") : null
        ].filter(Boolean).join("\n");

        // 第 1 輪：正面正交基準圖
        const r1Prompt = [
          "# 角色【" + (c.name_zh || "原創角色") + "】正面正交基準圖",
          "",
          "## 畫風要求",
          STYLE,
          "",
          canonicalAppearance,
          "",
          "## 畫面規格",
          "- **視角與姿態**：標準 T-pose 正面平視正交（雙臂自然張開便於 3D 拓撲，1:1），全身居中完整不切頭腳，平光無陰影。",
          "- **指定背景**：**" + bgInfo.promptGuide + "**。",
          "- **格式**：單張獨立 1:1 正面圖，無多角度拼貼、無文字浮水印。"
        ].filter(Boolean).join("\n");

        // 第 2 輪：T-pose 正交三視圖合圖
        const r2Prompt = [
          "# 角色【" + (c.name_zh || "原創角色") + "】T-pose 正交三視圖合圖",
          "",
          "嚴格參考上方剛生成的「正面基準圖」，維持完全相同的面容五官、髮型髮色與服飾細節，繪製正交三視圖合圖：",
          "",
          "## 畫面規格",
          "- **內容排布**：16:9 T-pose 正交三視圖（正面 / 側面 / 背面 / 3/4 視角同比例水平排布）。",
          "- **姿態與光影**：自然平正 T-pose，嚴格平視正交，比例尺一致，平光無動態光影與透視。",
          "- **指定背景**：純色背景（" + bgInfo.hex + "），與第 1 輪完全相同。",
          "- **格式**：單張 16:9 合圖，無文字標籤、無數值浮水印。"
        ].join("\n");

        // 第 3 輪：動態主立繪
        const r3Prompt = [
          "# 角色【" + (c.name_zh || "原創角色") + "】全身性格主立繪",
          "",
          "嚴格參考上方「正面基準圖」確立的角色容貌、身材比例與服飾細節，繪製生動性格主立繪：",
          "- **職業身分**：【" + (c.role || "冒險者") + "】" + ((c.pose && c.pose !== "未知") ? (" · 專屬姿態【" + c.pose + "】") : "") + (c.personality?.length ? (" · 性格【" + c.personality.join("、") + "】") : ""),
          c.vessel ? ("- **道具演繹**：手持或施展【" + (c.vessel.zh || c.vessel) + "】") : null,
          "",
          sceneInfo.fullPromptSection
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
          "## 角色設定：【" + (c.name_zh || "原創角色") + "】",
          "- 體貌特徵：" + (c.gender || "角色") + "，約 " + (c.height || "170") + " cm · " + (c.ethnicity || "") + (c.region ? " · " + c.region : "") + (c.timeline ? "（" + c.timeline + "）" : ""),
          "- 配色設定：服裝【" + (c.outfit_palette || []).join("、") + "】，髮色【" + (c.hair_palette || []).join("、") + "】，瞳色【" + (c.eye_palette || []).join("、") + "】",
          c.vessel ? "- 隨身裝備：收服道具佩戴於身側（" + (c.vessel.zh || c.vessel) + "）" : null,
          (c.gender === "女" && c.cup_size && c.cup_size !== "未知") ? ("- 體態特徵：罩杯 " + c.cup_size + "，健康勻稱卡通比例") : null,
          "",
          "## 🎯 三步驟生圖順序（同對話分輪獨立出圖）",
          "### 步驟 1（基準錨定圖）：`images/" + S + "_front.png`",
          "- **內容**：**正面正交基準圖 1:1**，標準 T-pose 全身居中、平視正交、平光無陰影。背景：" + bgInfo.promptGuide + "。",
          "",
          "### 步驟 2（多視角拓撲圖）：`images/" + S + "_turnaround.png`",
          "- **內容**：**T-pose 正交三視圖合圖 16:9**（正 / 側 / 背 / 3/4 視角同比例排布）。嚴格以「步驟 1 正面圖」為基準延伸，自然站姿、平光無透視，背景同為 " + bgInfo.hex + "。",
          "",
          "### 步驟 3（動態主立繪）：`images/" + S + "_main.png`",
          "- **內容**：**全身性格主立繪 3:4**（【" + (c.role || "冒險者") + "】演繹）。嚴格以「步驟 1 正面圖」之容貌服飾為基準：",
          sceneInfo.fullPromptSection,
          "",
          "## ⚠️ 核心規範",
          "- **同對話獨立出圖**：三張圖片必須在同一個對話中依序生成（1 → 2 → 3），且分別輸出為獨立圖片，嚴禁合併拼貼。",
          "- **背景防汙染**：步驟 1 與 2 必須維持純淨平光灰底（" + bgInfo.hex + "），嚴禁被步驟 3 的動態光影或複雜背景汙染。"
        ].filter(Boolean).join("\n");

        return common(ctx, body, true);
      }
    },

    {
      id: "creature-concept", version: "6.5.1", zh: "宙獸設計概念與型態立繪", prefix: "cr", platform: "chatgpt",
      needs: "creature", drop: "Art/_incoming",
      options: [
        { key: "stage", type: "select", label: "宙獸型態（四型態分開產出）", items: () => C.STAGES.map(s => ({ v: s.v, zh: s.zh + "（" + s.v + "）" })), def: "adult" },
        {
          key: "evolution_mode",
          type: "select",
          label: "【演化突變模態】50/50 辨識度守恆",
          items: (o, env) => {
            const curStage = o?.stage || "adult";
            const transKey = curStage === "adolescent" ? "stage1_to_2" : curStage === "overload" ? "stage3_to_overload" : "stage2_to_3";
            const prev = curStage === "overload" ? env?.creature?.evo_stage2_to_3?.[0] : null;
            const modes = C.getEvolutionModesWithProbabilities ? C.getEvolutionModesWithProbabilities(transKey, prev) : (C.EVOLUTION_MODES || []);
            return [
              { v: "auto", zh: "🤖 依概念隨機項目決定" },
              ...modes.map(m => ({ v: m.id, zh: m.labelWithPct || (m.zh + " (" + m.desc.split("、")[0] + ")") }))
            ];
          },
          def: "auto",
          when: o => (o.stage || "adult") !== "juvenile"
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
        const evoInfo = C.resolveEvolutionPrompt ? C.resolveEvolutionPrompt(o.evolution_mode, curStage, c, S) : null;
        const isJuvenile = curStage === "juvenile";

        const elemZh = (c.elements || []).map(e => C.ELEMENTS.find(el => el.v === e)?.zh || e).join("、");
        const canonicalCreature = [
          "## 主體設定：【" + (lockedStage ? lockedStage.name_zh : (c.name_zh || "原創奇幻生物")) + "】（" + stageDef.zh + "型態）",
          "- 核心構造：非人形生物（獸形/幻獸/機獸），外觀基底【" + (c.bases ? c.bases.join(" + ") : "") + "】",
          elemZh || c.appearance_palette?.length ? ("- 屬性與配色：" + (elemZh ? "屬性【" + elemZh + "】，" : "") + "主色調【" + (c.appearance_palette || []).join("、") + "】") : null,
          "- 體態尺寸：身長/高約 " + curHeight + " · " + stageFeature,
          c.archetype ? ("- 原型意象：" + c.archetype + (c.motifs ? "（圖騰：" + c.motifs + "）" : "")) : null,
          lockedStage?.look ? ("- 外觀特徵：" + lockedStage.look) : null
        ].filter(Boolean).join("\n");

        // 第 1 輪：正面正交基準圖
        let r1Prompt;
        if (isJuvenile) {
          r1Prompt = [
            "# 宙獸【第一階 / 幼年型態】正面正交基準圖",
            "",
            "## 畫風要求",
            STYLE,
            "",
            canonicalCreature,
            "",
            "## 畫面規格",
            "- **視角與姿態**：標準正面平視正交（1:1），全身置中完整無裁切，自然平正站姿，平光無動態陰影。",
            "- **指定背景**：**" + bgInfo.promptGuide + "**。",
            "- **格式**：單張獨立 1:1 正面圖，無多角度拼貼、無文字浮水印。"
          ].filter(Boolean).join("\n");
        } else {
          r1Prompt = [
            "# 宙獸【" + stageDef.zh + "型態】正面正交基準圖（基於前階進化）",
            "",
            "## 畫風要求",
            STYLE,
            "",
            evoInfo.guideSection,
            "",
            canonicalCreature,
            "",
            "## 畫面規格",
            "- **視角與姿態**：標準正面平視正交（1:1），全身置中完整無裁切，自然平正站姿，平光無動態陰影。",
            "- **指定背景**：**" + bgInfo.promptGuide + "**。",
            "- **格式**：單張獨立 1:1 正面圖，無多角度拼貼、無文字浮水印。"
          ].filter(Boolean).join("\n");
        }

        // 第 2 輪：正交三視圖合圖
        const r2Prompt = [
          "# 宙獸【" + stageDef.zh + "型態】正交三視圖合圖",
          "",
          "嚴格參考上方剛生成的「正面基準圖」，維持完全相同的生物構造、特徵與配色 Hex，繪製多視角正交合圖：",
          "",
          "## 畫面規格",
          "- **內容排布**：16:9 正交三視圖（正面 / 側面 / 背面 / 3/4 視角同比例水平排布）。",
          "- **姿態與光影**：自然平正站姿，嚴格平視正交，比例尺一致，平光無動態陰影與透視。",
          "- **指定背景**：純色背景（" + bgInfo.hex + "），與第 1 輪完全相同。",
          "- **格式**：單張 16:9 合圖，無文字標籤、無數值浮水印。"
        ].join("\n");

        // 第 3 輪：全身戰鬥主立繪
        const r3Prompt = [
          "# 宙獸【" + stageDef.zh + "型態】全身戰鬥主立繪",
          "",
          "嚴格參考上方「正面基準圖」確立的生物造型與配色，繪製動態戰鬥主立繪：",
          lockedStage?.signature_move ? ("- **招式演出**：" + lockedStage.signature_move.visual) : null,
          curStage === "overload" ? "- **超載爆發**：裝甲展開、核心光環浮現、高密度能量粒子外溢" : null,
          "",
          sceneInfo.fullPromptSection
        ].filter(Boolean).join("\n");

        return [
          { round: 1, title: isJuvenile ? "第 1 輪：正面正交基準圖 (1:1)" : "第 1 輪：正面正交基準圖 (1:1 · 基於前階進化)", filename: "cr_" + S + "_" + curStage + "_front.png", prompt: r1Prompt },
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
        const evoInfo = C.resolveEvolutionPrompt ? C.resolveEvolutionPrompt(o.evolution_mode, curStage, c, S) : null;
        const isJuvenile = curStage === "juvenile";

        const step1Lines = isJuvenile ? [
          "### 步驟 1（初始基因基準圖）：`images/cr_" + S + "_juvenile_front.png`",
          "- **內容**：**正面正交基準圖 1:1**，全身居中、平視正交、自然平正站姿、平光無陰影。背景：" + bgInfo.promptGuide + "。"
        ] : [
          "### 步驟 1（基準錨定圖 · 基於前階進化）：`images/cr_" + S + "_" + curStage + "_front.png`",
          "- **前置操作**：**先上傳前一階正面圖 `" + evoInfo.prevFrontImg + "`（" + evoInfo.prevStageZh + "）** 作為本階演化唯一視覺基底（Image-to-Image）。",
          "- **演化規範**：基於前階正面圖描述本階進化外觀（50% 鎖定面部五官/瞳色/核心特徵；50% 突變：`" + evoInfo.mode.prompt_guidance + "`；注入 `" + evoInfo.mode.positive_tokens + "` / 排除 `" + evoInfo.mode.negative_tokens + "`）。",
          "- **畫面規格**：**正面正交基準圖 1:1**，全身居中、平視正交、自然平正站姿、平光無陰影。背景：" + bgInfo.promptGuide + "。"
        ];

        const step2Lines = [
          "### 步驟 2（多視角拓撲圖）：`images/cr_" + S + "_" + curStage + "_turnaround.png`",
          "- **內容**：**正交三視圖合圖 16:9**（正面 / 側面 / 背面 / 3/4 視角同比例排布）。嚴格以本型態「步驟 1 正面圖」為基準多角度延伸，自然站姿、平光無透視，背景同為 " + bgInfo.hex + "。（不加演化 prompt）"
        ];

        const step3Lines = [
          "### 步驟 3（動態主立繪）：`images/cr_" + S + "_" + curStage + "_main.png`",
          "- **內容**：**全身戰鬥主立繪 1:1**（場景氛圍與招式演出強化）。嚴格以本型態「步驟 1 正面圖」之造型為基準繪製動態姿勢：（不加演化 prompt）",
          lockedStage?.signature_move ? ("- **招式演出**：" + lockedStage.signature_move.visual) : null,
          curStage === "overload" ? "- **超載爆發**：裝甲展開、核心光環浮現、高密度能量粒子流外溢" : null,
          sceneInfo.fullPromptSection
        ].filter(Boolean);

        const elemZh = (c.elements || []).map(e => C.ELEMENTS.find(el => el.v === e)?.zh || e).join("、");
        const body = [
          "## 主體設定：【" + (lockedStage ? lockedStage.name_zh : (c.name_zh || "原創奇幻生物")) + "】（" + stageDef.zh + "型態）",
          "- 核心構造：非人形生物（獸形/幻獸/機獸），外觀基底【" + (c.bases ? c.bases.join(" + ") : "") + "】",
          elemZh || c.appearance_palette?.length ? ("- 屬性與配色：" + (elemZh ? "屬性【" + elemZh + "】，" : "") + "主色調【" + (c.appearance_palette || []).join("、") + "】") : null,
          "- 體態尺寸：身長/高約 " + curHeight + " · " + stageFeature,
          c.archetype ? ("- 原型意象：" + c.archetype + (c.motifs ? "（圖騰：" + c.motifs + "）" : "")) : null,
          lockedStage?.look ? ("- 外觀特徵：" + lockedStage.look) : null,
          "",
          "## 🎯 三步驟生圖順序（同對話分輪獨立出圖）",
          ...step1Lines,
          "",
          ...step2Lines,
          "",
          ...step3Lines,
          "",
          "## ⚠️ 核心規範",
          "- **同對話獨立出圖**：三張圖片必須在同一個對話中依序生成（1 → 2 → 3），且分別輸出為獨立圖片，嚴禁合併拼貼。",
          "- **背景防汙染**：步驟 1 與 2 必須維持純淨平光灰底（" + bgInfo.hex + "），嚴禁被步驟 3 的動態光影或複雜背景汙染。",
          "- **演化機制**：第一階（幼年）不加演化 prompt；第二階/第三階/超載之步驟 1 需先上傳前一階正面圖並描述本階進化；步驟 2 與 3 不加演化 prompt，純粹以本階步驟 1 為基準。"
        ].filter(Boolean).join("\n");

        return common(ctx, body, true);
      }
    },

    {
      // REQ: 使用者 2026-11-09 — 宙獸 img-to-3D 極致精簡與立繪規格對齊：立繪包已有的概念設定（名稱、屬性、基底等）不再重複，去除對 3D 無關緊要的贅詞。
      id: "creature-model-rig", version: "5.0.1", zh: "宙獸 Image-to-3D 建模、綁骨與動作（雲端硬碟立繪包）", prefix: "mdl", platform: "gemini",
      needs: "creature", drop: "Art/_incoming", drive: true,
      options: [
        { key: "scope", type: "select", label: "模式", items: () => [{ v: "single", zh: "指定處理（單一立繪包）" }, { v: "batch", zh: "批量處理（01_portraits 內宙獸目錄）" }], def: "single" },
        { key: "source_pack", type: "text", label: "參照宙獸立繪包 ID (source_pack)", def: "", placeholder: "例：cr-20261106-7f3a-2105-adult", when: o => o.scope !== "batch" },
        { key: "input_img", type: "text", label: "指定輸入 img", def: "", placeholder: "選填，留空預設使用正面正交 + turnaround 三視圖", when: o => o.scope !== "batch" },
        { key: "stage", type: "select", label: "宙獸型態（四型態分開處理）", items: () => C.STAGES.map(s => ({ v: s.v, zh: s.zh + "（" + s.v + "）" })), def: "adult", when: o => o.scope !== "batch" },
        { key: "actions_creature", type: "checks", label: "宙獸動作", items: () => C.ACTIONS.creature.map(a => ({ v: a.id, zh: a.zh })), def: "all" }
      ],
      build(ctx) {
        const o = ctx.opts, batch = o.scope === "batch", c = ctx.concept || {};
        const S = batch ? "<subject_id>" : ctx.subjectId;
        const curStage = o.stage || "adult";
        const outId = batch ? ctx.taskId + "-<subject-id>" : ctx.taskId;
        const unit = batch ? "cr_" + S + "_<stage>" : "cr_" + S + "_" + curStage;
        const stageTag = batch ? "<stage>" : curStage;

        // 體型與面數規格對齊
        const sizes = (c.size_profile || "S→M→L→XL").split("→");
        const stageIdx = ["juvenile", "adolescent", "adult", "overload"].indexOf(curStage);
        const curSize = sizes[stageIdx >= 0 ? stageIdx : 2] || "L";
        const szInfo = C.SIZE_CLASSES[curSize] || C.SIZE_CLASSES.L;
        const sizeSpec = batch
          ? [
            "- 體型等級面數規格（依各立繪包 stage 對照）：",
            "  - XS: 3–5k tris, 512² | S: 5–8k tris, 1024² | M: 8–15k tris, 1024² | L: 15–25k tris, 2048² | XL: 25–35k tris, 2048²"
          ].join("\n")
          : [
            `- 面數預算：**${szInfo.tris} tris**（健康卡通比例、拓撲乾淨適配變形）`,
            `- 貼圖規格：**${szInfo.tex} × ${szInfo.tex} PBR**（Base Color, Normal, Metallic/Roughness）`
          ].join("\n");

        const src = o.input_img
          ? `\`${o.input_img}\`（指定首要視圖，其餘由三視圖合圖裁切補齊）`
          : `\`images/cr_${S}_${curStage}_front.png\`（正面正交基準 1:1）＋ \`images/cr_${S}_${curStage}_turnaround.png\`（正交三視圖合圖 16:9）`;

        const picked = o.actions_creature || [];
        const clipLines = C.ACTIONS.creature.filter(a => picked.includes(a.id)).map(a =>
          "| `cr_" + stageTag + "_" + a.id + "` | " + a.zh + " | " + a.f + " | " + (a.loop ? "✓" : "") + " | " + (a.rm ? "✓" : "") + " | " + (a.ev || []).join(", ") + " |"
        ).join("\n");

        const rigRule = "Generic 骨架（≤ 60 骨骼）：`Root`（地面原點 pivot）→ `Hips` → `Spine_01..n` → `Neck` → `Head`；四肢以 `L_`/`R_` 為前綴；尾部 `Tail_01..n`；翅膀 `Wing_L_01..n`；插槽骨 `Socket_Mouth`、`Socket_Head`、`Socket_Front`、`Socket_Core_FX`、`Socket_PetTouch`、`Socket_Ground_FX`。";

        const manifestObj = {
          spec: "cosmimera-art-task/1",
          task_header: "<原樣抄回本 prompt 第一行>",
          task_id: outId,
          task_type: "creature-model-rig",
          subject_id: S,
          produced_by: ctx.platformName,
          source_pack: o.source_pack || "<來源宙獸立繪包 task_id，例 cr-20261106-7f3a-2105-adult>",
          files: [
            { path: `models/${unit}.glb`, kind: "model" },
            { path: `models/${unit}.blend`, kind: "model" },
            { path: `models/${unit}.fbx`, kind: "model" },
            { path: "rig/rig_spec.json", kind: "spec" },
            { path: "anims/anim_spec.json", kind: "spec" },
            { path: `anims/cr_${stageTag}_idle.fbx`, kind: "anim" },
            { path: `anims/cr_${stageTag}_idle_long.fbx`, kind: "anim" },
            { path: `images/${unit}_model_front.png`, kind: "view" }
          ]
        };

        const sections = [
          ctx.header,
          "",
          "# 任務：宙獸 Image-to-3D 建模、綁骨與動作",
          "",
          "## 1. 輸入立繪參照與歸檔",
          batch
            ? `- 輸入資料夾：\`${DRIVE_IN}/\`（批次處理所有吻合條件之 \`cr-*.zip\`，略過 \`${DRIVE_OUT}/\` 已有對應 manifest.source_pack 者）。\n- 歸檔移動：每包處理完成後，立即將該來源立繪包移動至相鄰之 \`${DRIVE_BACKUP}/\`。`
            : [
              `- 來源立繪包：\`${DRIVE_IN}/${o.source_pack ? o.source_pack + ".zip" : "cr-" + S + "-" + curStage + ".zip"}\``,
              `- 核心輸入圖：${src}`,
              `- 歸檔移動：處理完成後，立即將該來源立繪包移動至相鄰之 \`${DRIVE_BACKUP}/\`。`
            ].join("\n"),
          "",
          "## 2. 3D 拓撲與貼圖規格",
          modelResearchRules(),
          sizeSpec,
          "- **原創製作**：以本次輸入立繪為依據全新設計並建模；不得參考、複製或修改舊模型檔直接充當新作品。",
          `- **Blender 直接交付**：使用 Blender 製作並儲存可編輯的 \`models/${unit}.blend\`，由 Blender 直接匯出 \`models/${unit}.glb\` 與 \`models/${unit}.fbx\`（Scale 1.0，Y-Up，-Z 前向，全身居中、站立地面原點）。`,
          "",
          "## 3. 骨架體系（Generic Rig）",
          "- " + rigRule,
          "",
          "## 4. 動畫動作清單（30 fps）",
          "| clip | 說明 | 幀數 | loop | RM | 事件@幀 |",
          "|---|---|---|---|---|---|",
          clipLines,
          "- **動作製作與循環規範**：",
          "  - `idle`（標準待機）：2 秒短週期呼吸律動，適合即時探索與戰鬥過渡。",
          "  - `idle_long`（長時間靜止週期動作）：4 秒長週期（120 幀，loop），呈現長時間定力靜止、微幅呼吸起伏、低頻眼眸/耳尾微動或重心微調，首尾幀平滑閉合無縫循環，保持姿態穩定兼具活體生命感。",
          "",
          modelQualityRules(),
          "",
          "## 6. 交付檔案架構（打包為 `" + outId + ".zip` 上傳至 `" + DRIVE_OUT + "/`）",
          "```",
          outId + "/",
          "├── manifest.json",
          "├── models/          # " + unit + ".glb, .blend, .fbx (Blender 可編輯原檔與 PBR 烘焙貼圖完成模型)",
          "├── anims/           # anim_spec.json (L1), cr_" + stageTag + "_*.fbx (L2)",
          "├── rig/             # rig_spec.json (L1)",
          "└── images/          # " + unit + "_model_front.png (L1: 正交彩現檢視圖)",
          "```",
          "manifest.json 格式：",
          json(manifestObj),
          "- **source_pack 必須如實填寫來源立繪包 task_id**，供技術美術與審查台 100% 雙向追溯。",
          ctx.notes ? "\n## 使用者補充\n" + ctx.notes : null
        ];

        return sections.filter(s => s !== null && s !== undefined).join("\n");
      }
    },

    {
      // REQ: 使用者 2026-11-09 — 角色 img-to-3D 極致精簡與立繪規格對齊：立繪包已有的概念設定（名稱、性別、身高、道具等）不再重複，去除對 3D 無關緊要的贅詞。
      id: "character-model-rig", version: "5.0.1", zh: "角色 Image-to-3D 建模、綁骨與動作（雲端硬碟立繪包）", prefix: "mdl", platform: "gemini",
      needs: "character", drop: "Art/_incoming", drive: true,
      options: [
        { key: "scope", type: "select", label: "模式", items: () => [{ v: "single", zh: "指定處理（單一立繪包）" }, { v: "batch", zh: "批量處理（01_portraits 內角色目錄）" }], def: "single" },
        { key: "source_pack", type: "text", label: "參照角色立繪包 ID (source_pack)", def: "", placeholder: "例：chr-20261106-7f3a-2105", when: o => o.scope !== "batch" },
        { key: "input_img", type: "text", label: "指定輸入 img", def: "", placeholder: "選填，留空預設使用正面正交 + turnaround 三視圖", when: o => o.scope !== "batch" },
        { key: "actions_character", type: "checks", label: "角色動作", items: () => C.ACTIONS.character.map(a => ({ v: a.id, zh: a.zh })), def: "all" }
      ],
      build(ctx) {
        const o = ctx.opts, batch = o.scope === "batch", c = ctx.concept || {};
        const S = batch ? "<subject_id>" : ctx.subjectId;
        const outId = batch ? ctx.taskId + "-<subject-id>" : ctx.taskId;
        const unit = S;

        const src = o.input_img
          ? `\`${o.input_img}\`（指定首要視圖，其餘由三視圖合圖裁切補齊）`
          : `\`images/${S}_front.png\`（正面正交基準 1:1，T-pose）＋ \`images/${S}_turnaround.png\`（T-pose 正交三視圖合圖 16:9）`;

        const picked = o.actions_character || [];
        const clipLines = C.ACTIONS.character.filter(a => picked.includes(a.id)).map(a =>
          "| `chr_" + a.id + "` | " + a.zh + " | " + a.f + " | " + (a.loop ? "✓" : "") + " | " + (a.rm ? "✓" : "") + " | " + (a.ev || []).join(", ") + " |"
        ).join("\n");

        const rigRule = "Unity Humanoid 相容骨架（≤ 75 骨骼）：標準 Humanoid 命名（Hips, Spine, Chest, UpperChest, Neck, Head, Shoulder, Arm, Hand, 手指三節 Thumb/Index/Middle/Ring/Little, Leg, Foot, Toes）；頭髮/披風以 `Extra_*` 前綴；插槽骨 `Socket_HandR_Prop`、`Socket_HandL_Prop`、`Socket_Back_Pack`、`Socket_Throw`、`Socket_Head_FX`。";

        const manifestObj = {
          spec: "cosmimera-art-task/1",
          task_header: "<原樣抄回本 prompt 第一行>",
          task_id: outId,
          task_type: "character-model-rig",
          subject_id: S,
          produced_by: ctx.platformName,
          source_pack: o.source_pack || "<來源角色立繪包 task_id，例 chr-20261106-7f3a-2105>",
          files: [
            { path: `models/${unit}.glb`, kind: "model" },
            { path: `models/${unit}.blend`, kind: "model" },
            { path: `models/${unit}.fbx`, kind: "model" },
            { path: "rig/rig_spec.json", kind: "spec" },
            { path: "anims/anim_spec.json", kind: "spec" },
            { path: "anims/chr_idle.fbx", kind: "anim" },
            { path: "anims/chr_idle_long.fbx", kind: "anim" },
            { path: `images/${unit}_model_front.png`, kind: "view" }
          ]
        };

        const sections = [
          ctx.header,
          "",
          "# 任務：角色 Image-to-3D 建模、綁骨與動作",
          "",
          "## 1. 輸入立繪參照與歸檔",
          batch
            ? `- 輸入資料夾：\`${DRIVE_IN}/\`（批次處理所有吻合條件之 \`chr-*.zip\`，略過 \`${DRIVE_OUT}/\` 已有對應 manifest.source_pack 者）。\n- 歸檔移動：每包處理完成後，立即將該來源立繪包移動至相鄰之 \`${DRIVE_BACKUP}/\`。`
            : [
              `- 來源立繪包：\`${DRIVE_IN}/${o.source_pack ? o.source_pack + ".zip" : "chr-" + S + ".zip"}\``,
              `- 核心輸入圖：${src}`,
              `- 歸檔移動：處理完成後，立即將該來源立繪包移動至相鄰之 \`${DRIVE_BACKUP}/\`。`
            ].join("\n"),
          "",
          "## 2. 3D 拓撲與貼圖規格",
          modelResearchRules(),
          "- 面數預算：**15,000 ~ 25,000 tris**（健康卡通比例、拓撲乾淨適配變形）",
          "- 貼圖規格：**2048 × 2048 PBR**（Base Color, Normal, Metallic/Roughness）",
          "- **原創製作**：以本次輸入立繪為依據全新設計並建模；不得參考、複製或修改舊模型檔直接充當新作品。",
          `- **Blender 直接交付**：使用 Blender 製作並儲存可編輯的 \`models/${unit}.blend\`，由 Blender 直接匯出 \`models/${unit}.glb\` 與 \`models/${unit}.fbx\`（Scale 1.0，Y-Up，-Z 前向，全身居中、站立地面原點）。`,
          "",
          "## 3. 骨架體系（Unity Humanoid）",
          "- " + rigRule,
          "",
          "## 4. 動畫動作清單（30 fps）",
          "| clip | 說明 | 幀數 | loop | RM | 事件@幀 |",
          "|---|---|---|---|---|---|",
          clipLines,
          "- **動作製作與循環規範**：",
          "  - `idle`（標準待機）：2 秒短週期呼吸律動，標準 Humanoid 待機姿態。",
          "  - `idle_long`（長時間靜止週期動作）：4 秒長週期（120 幀，loop），呈現長時間定力靜止、極小幅度胸腔呼吸、眼皮微眨或細微重心微調，首尾幀完全對齊平滑循環，避免大幅晃動以確保站姿安定感。",
          "",
          modelQualityRules(),
          "",
          "## 6. 交付檔案架構（打包為 `" + outId + ".zip` 上傳至 `" + DRIVE_OUT + "/`）",
          "```",
          outId + "/",
          "├── manifest.json",
          "├── models/          # " + unit + ".glb, .blend, .fbx (Blender 可編輯原檔與 PBR 烘焙貼圖完成模型)",
          "├── anims/           # anim_spec.json (L1), chr_*.fbx (L2)",
          "├── rig/             # rig_spec.json (L1)",
          "└── images/          # " + unit + "_model_front.png (L1: 正交彩現檢視圖)",
          "```",
          "manifest.json 格式：",
          json(manifestObj),
          "- **source_pack 必須如實填寫來源立繪包 task_id**，供技術美術與審查台 100% 雙向追溯。",
          ctx.notes ? "\n## 使用者補充\n" + ctx.notes : null
        ];

        return sections.filter(s => s !== null && s !== undefined).join("\n");
      }
    },

    {
      id: "move-vfx", version: "1.1.1", zh: "招式效果動畫（特效）", prefix: "fx", platform: "chatgpt",
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
      id: "capture-vessel", version: "1.0.1", zh: "收服道具設計", prefix: "vsl", platform: "chatgpt",
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
      id: "culture-research", version: "1.0.1", zh: "文化原型考據", prefix: "res", platform: "gemini",
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

  // Apply the same storage contract to every full prompt and every image round.
  TASKS.forEach(t => {
    const build = t.build;
    t.nativeBuild = build;
    t.build = ctx => {
      if (window.COSMI_PIPELINE?.supports(ctx)) return window.COSMI_PIPELINE.build(ctx);
      const text = build(ctx), newline = text.indexOf("\n");
      return text.slice(0, newline + 1) + "\n" + storageSection(ctx) + "\n" + text.slice(newline + 1);
    };
    if (t.buildRounds) {
      const buildRounds = t.buildRounds;
      t.buildRounds = ctx => buildRounds(ctx).map(round => ({ ...round, prompt: round.prompt + "\n\n" + storageSection(ctx) }));
    }
  });
  TASKS.filter(t => ["character-concept", "creature-concept", "character-model-rig", "creature-model-rig", "model-rig"].includes(t.id)).forEach(t => { t.version = (Number(t.version.split(".")[0]) + 1) + ".0.0"; });
  window.COSMI_TASKS = TASKS;
})();
