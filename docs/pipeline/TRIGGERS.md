# 簡易觸發語句
先選定資產與參數，再擇一交給可讀取 Drive 的 AI；外觀、參數及圖片以指定檔案為準。

- 外觀：讀取 cosmos_chimera_forge/prompts/00_appearance.prompt.md，依附上的素材執行。
- 立繪：讀取 cosmos_chimera_forge/prompts/01_portrait.prompt.md，使用指定資產的 appearance.md 和 parameters.json 執行。
- 立繪審查：讀取 cosmos_chimera_forge/prompts/02_review_portrait.prompt.md，檢查我指定的立繪目錄。
- Colab：讀取 cosmos_chimera_forge/prompts/03a_colab.prompt.md，處理我指定的已核准立繪目錄及 parameters.json。
- AI Blender：讀取 cosmos_chimera_forge/prompts/03b_blender.prompt.md；提供已核准圖片即為 Image-to-3D，未提供任何圖片時依外觀與 parameters.json 執行 Prompt-to-3D。只有宙獸 Prompt-to-3D 才產生圖鑑。此分支由立繪階段分岔，先建模，再依完成模型補正式主立繪（不需 T-pose、正面圖），最後才能驗收。
- 最終審查：讀取 cosmos_chimera_forge/prompts/04_review_3d.prompt.md，檢查模型與對應立繪；Prompt-to-3D 必須使用建模後補繪的主立繪。

HTML 中選步驟，按「讀取本步驟 .md／複製執行」可產生已填入目前資產的版本。原始 .md 的 {{欄位}} 由 HTML 代入；直接交給 AI 時須提供實際路徑與設定。讀取本身不會自動啟動外部 AI 或 Colab。
\n流程圖：外觀設定後、立繪生成前分為 Image-to-3D 與 Prompt-to-3D。後者建模完成後補正式主立繪（無需 T-pose、正面圖），再進最終驗收。HTML 點選流程區塊可切換步驟並查看 Prompt。\n\n3D 建模實作為兩條獨立管線：A = Colab GPU 生成網格 → Blender 修整／綁骨／匯出；B = AI Blender 直接建模（可選 Image-to-3D 或 Prompt-to-3D）。兩者為替代路線，不得串成 Colab → AI Blender。Prompt-to-3D 仍在立繪生成前分岔，建模後補主立繪再驗收。\n