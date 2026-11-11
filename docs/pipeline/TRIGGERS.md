# 簡易觸發語句
先選定資產與參數，再擇一交給可讀取 Drive 的 AI；外觀、參數及圖片以指定檔案為準。

- 外觀：讀取 cosmos_chimera_forge/prompts/00_appearance.prompt.md，依附上的素材執行。
- 立繪：讀取 cosmos_chimera_forge/prompts/01_portrait.prompt.md，使用指定資產的 appearance.md 和 parameters.json 執行。
- 立繪審查：讀取 cosmos_chimera_forge/prompts/02_review_portrait.prompt.md，檢查我指定的立繪目錄。
- Colab：讀取 cosmos_chimera_forge/prompts/03a_colab.prompt.md，處理我指定的已核准立繪目錄及 parameters.json。
- AI Blender：讀取 cosmos_chimera_forge/prompts/03b_blender.prompt.md，使用我指定的圖片或 appearance.md 及 parameters.json。
- 最終審查：讀取 cosmos_chimera_forge/prompts/04_review_3d.prompt.md，檢查我指定的模型與來源立繪目錄。

HTML 中選步驟，按「讀取本步驟 .md／複製執行」可產生已填入目前資產的版本。原始 .md 的 {{欄位}} 由 HTML 代入；直接交給 AI 時須提供實際路徑與設定。讀取本身不會自動啟動外部 AI 或 Colab。
