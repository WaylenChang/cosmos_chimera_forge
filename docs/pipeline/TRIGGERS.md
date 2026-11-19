# 簡易觸發語句

先指定 `<kind>`：角色 `characters`、宙獸 `creatures`、主動技 `moves`。不得從根目錄 `prompts/` 寫入新檔；舊共用模板僅供過渡期唯讀相容。角色與宙獸使用各自的模板，主動技使用 `moves/prompts/01b_move_vfx.prompt.md`。
管線開工（或已有 GLB 產出）時，將 `<kind>/designed_prompts/<design_id>.prompt.md`（純視覺特徵 Prompt，宙獸分述四型態一致性、各型態特徵、型態演化關係，每型態獨立產出一個 `.glb`）移入 `<kind>/<id>/`；若版本或步驟有調整，將更改內容追加於該 `.prompt.md`。`<kind>/<id>/` 只保留 `*.prompt.md` 與當前審核階段或已通過的檔案（宙獸不需審查 img，所有宙獸 img 移入 `01_portrait/`），已結束步驟或舊有版本移至 `<kind>/<id>/<step>/[<ver>/]`。
先選定資產與參數，再擇一交給可讀取 Drive 的 AI；外觀、參數及圖片以指定檔案為準。

- 主動技 VFX：讀取 cosmos_chimera_forge/moves/prompts/01b_move_vfx.prompt.md，使用指定主動技資產設定與輸出路徑。
- 外觀：讀取 cosmos_chimera_forge/<kind>/prompts/00_appearance.prompt.md，依附上的素材執行。
- 立繪：讀取 cosmos_chimera_forge/<kind>/prompts/01_portrait.prompt.md，使用指定資產的 appearance.md 和 parameters.json 執行。
- 立繪審查：讀取 cosmos_chimera_forge/<kind>/prompts/02_review_portrait.prompt.md，檢查我指定的立繪目錄。
- Colab：讀取 cosmos_chimera_forge/<kind>/prompts/03a_colab.prompt.md，處理我指定的已核准立繪目錄及 parameters.json。
- AI Blender：讀取 cosmos_chimera_forge/<kind>/prompts/03b_blender.prompt.md；提供已核准圖片即為 Image-to-3D，未提供任何圖片時依外觀與 parameters.json 執行 Prompt-to-3D。圖鑑統一使用 `<kind>/<id>/<id>[_<stage>]_05_wiki.md` 的既有檔案，缺少時才建立，不重複生成。此分支由立繪階段分岔，建模完成後無需補繪立繪，直接進入最終驗收。
- 最終審查：讀取 cosmos_chimera_forge/<kind>/prompts/04_review_3d.prompt.md，檢查模型與對應立繪（Image-to-3D）；Prompt-to-3D 無需補立繪。

HTML 中選步驟，按「讀取本步驟 .md／複製執行」可產生已填入目前資產的版本。原始 .md 的 {{欄位}} 由 HTML 代入；直接交給 AI 時須提供實際路徑與設定。讀取本身不會自動啟動外部 AI 或 Colab。
流程圖：外觀設定後、立繪生成前分為 Image-to-3D 與 Prompt-to-3D。後者建模完成後無需補立繪，直接進最終驗收。HTML 點選流程區塊可切換步驟並查看 Prompt。

3D 建模實作為兩條獨立管線：A = Colab GPU 生成網格 → Blender 修整／綁骨／匯出；B = AI Blender 直接建模（可選 Image-to-3D 或 Prompt-to-3D）。兩者為替代路線，不得串成 Colab → AI Blender。Prompt-to-3D 仍在立繪生成前分岔，建模後無需補立繪即可驗收。