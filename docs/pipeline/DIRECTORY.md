# Drive 角色／宙獸目錄

```text
cosmos_chimera_forge/
  00_settings/                  # default.parameters.json； <asset_id>.appearance.md、<asset_id>.parameters.json
  01_portraits/<asset_id>/      # concept.json、manifest.json、images/
  02_3d/
    colab/<asset_id>/           # Colab GPU 輸出
    ai_blender/<asset_id>/      # Argon／Codex Blender 輸出
    legacy/<asset_id>/          # 既有待審成果
  wiki/
    characters/<subject_id>_wiki.md   # 原創角色圖鑑
    creatures/<subject_id>_<stage>_wiki.md  # 每個階段一份
    moves/<move_id>_wiki.md           # 招式圖鑑
  03_completed/
    portraits/<asset_id>/
    models/<asset_id>/
  prompts/                     # 六個單步驟 prompt.md、TRIGGERS.md
    jobs/                      # HTML 填入參數後的單步驟 prompt
  reviews/<asset_id>.json       # 審查結果、來源立繪 ID、時間、意見
  backup/
    rejected_portraits/<revision>/<asset_id>/
    rejected_3d/<revision>/<asset_id>/
    legacy_archives/            # 已核對展開的歷史 ZIP
    legacy_prompts/             # 舊的跨步驟長 prompt
    image_backup/              # 歷史立繪備份，不代表已核准
```

3D 資產目錄內用 models/、rig/、animations/、previews/、manifest.json。

## PR #11 的型態化 Anime3D 管線：Drive 相容規則

**不依生物類型新增 Drive 頂層分類資料夾。** 六大資產類別、十多種解剖型態寫入每個資產的 `profile.json` 與 `manifest.json`，避免將同一宙獸的進化階段／版本分散在不同根目錄。

- `Image-to-3D / Colab＋Blender`：`02_3d/colab/<asset_id>/`。
- `Image-to-3D / AI＋Blender`：`02_3d/ai_blender/<asset_id>/`。
- `Prompt-to-3D / AI＋Blender`：`02_3d/ai_blender/<asset_id>/`；先產 3D，後補 `01_portraits/<portrait_id>/` 的動態主立繪並審查綁定。
- `02_3d/legacy/` 與既有 `02_3d/ai_blender/` 歷史版本**原位保留**，不可因命名不同就搬移／重寫。
- 每個新的 typed runner 產出標準 `manifest.json`，由 `anatomy`、`input_mode`、`pipeline` 與 `source_pack` 識別分流；沒有產生的檔案應列為 `missing`，不應假裝完成。

每個 3D 資產包允許新增以下**同一資產目錄內**的子路徑，而非額外頂層資料夾：

```text
02_3d/<colab|ai_blender>/<asset_id>/
  manifest.json                # 網頁審查必要索引，不可省略
  profile.json                 # 型態、解剖、後端、動作與 QA 分流
  typed_state.json             # 續跑狀態；保留暫存/失敗資訊
  source/<asset_id>.glb        # 原始生成輸出，不覆蓋
  models/<asset_id>.glb
  models/<asset_id>.blend
  rig/rig_report.json          # 含 provisional／existing／explicit_parts
  animations/animations_manifest.json
  previews/qa_*.png
  qa/typed_metrics.json        # 不代表人工通過
  parts/part_*.glb             # PartCrafter 選用；零件機構需另外驗證
  # 不再放入 bestiary.md；以 manifest.encyclopedia_path 指向 wiki
```

`00_settings/` 可繼續儲存資產專屬 `asset_spec.json`、外觀與格式設定；`prompts/jobs/` 存實際需要的自動化 prompt，不需替手動立繪複製流程建立空的 Markdown。對 Prompt-to-3D，不得因尚未補繪立繪就強行設定假 `source_pack`；在人工核准之前仍留待審狀態。

目前 Drive 盤點：`02_3d/colab/` 為空；`02_3d/ai_blender/` 有既有資產與 `_briefs`、`_scripts`；`02_3d/legacy/` 有待審模型；`03_completed/` 尚無模型與立繪；`reviews/` 尚無審查紀錄。**沒有執行任何 Drive 搬移、刪除或大規模建立目錄**。開始 Image-to-3D 批次作業前，必須先完成實際來源立繪的審查紀錄；不能為了讓程序執行而自動假核准歷史素材。

每個版本使用唯一 asset_id；角色與宙獸共用結構，由 manifest.task_type 區別。立繪包涵蓋多個型態時，各模型 source_pack 皆指向同一立繪資產 ID，stage 指定型態。

格式參數獨立存 JSON；外觀 prompt 不夾帶格式與遊戲數值。審查通過的立繪先不移動；退件整個目錄搬到備份。只有最終人工核可後才能移入完成區；歷史資產不自動視為核可。Prompt 建模缺立繪時，必須補畫、核准並綁定來源才可完成。

Colab 使用 GPU 模型的細節尚待實機選定；本次建立介面、目錄與步驟指令，未聲稱已執行 GPU／建模。Blender 可在中途或後續修復。

## Prompt-to-3D 原有成果整理（2026-11-13）

`02_3d/ai_blender/asset_cr_*_<stage>/models/` 是已由 AI＋Blender **Prompt-to-3D** 生成的模型，不能將其重新視為 Image-to-3D；`.glb`、`.blend` 留在原本的 `models/`，保留 Google Drive 檔案 ID。這些模型是否已綁骨、包含動畫或符合品質要求，仍須逐件驗證。

原先 `02_3d/ai_blender/_briefs/` 的 15 份 `cr_*_wiki.md` 已完成拆分並移轉：`wiki/creatures/` 現有 60 份獨立型態 Markdown（15 × 4），15 份系列原檔保留在 `wiki/_legacy/creatures/`，原 `04_encyclopedia/creatures/` 已清空。`wiki/characters/` 與 `wiki/moves/` 亦已建立。新規則改為每個階段一份：`<subject_id>_<stage>_wiki.md`。舊系列圖鑑經設定頁拆分後保存在 `wiki/_legacy/creatures/`，防止資料遺失。圖鑑獨立於模型檔案，模型的 `manifest.encyclopedia_path` 指向該 Markdown。

為避免大量空目錄及將尚未執行的 QA 假報為完成，既有模型包保留 `models/`，待實際產生骨架、動作、預覽及驗證資料才建立 `rig/`、`animations/`、`previews/`、`qa/` 等子目錄。既有模型的原始 `.glb` 不應複製冒充已完成 QA 的 `source/`。

登入網頁後，設定頁提供 **「整理歷史 Prompt-to-3D 目錄」**，需明確點擊及確認後才會檢查實際 `.glb`／`.blend`，建立或更新 `manifest.json`，標記 `input_mode=text`、`pipeline=ai_blender`、`encyclopedia_path` 和待審項目。若原有 manifest，先保存到 `backup/manifest_snapshots/`；不改模型、不自動移至完成區。此自助整理需在網站完成 OAuth 登入後執行，並非由 GitHub CI 在 Drive 背景操作。

角色／宙獸的 Image-to-3D 與 Prompt-to-3D 流程，以及招式特效流程，現在均有獨立的「生成圖鑑」節點。生成 Prompt 使用當前主體概念，輸出到對應的 `wiki/<kind>/`，不得讀取或覆寫別的資產。宙獸 Prompt-to-3D 的圖鑑可先於建模產生；建模時只引用該圖鑑，不再把 `bestiary.md` 當作模型目錄中必須重複保存的副本。

## HTML 操作

選角色／宙獸與型態，以隨機設定、圖鑑或 AI 文字決定外觀。上方「格式參數」獨立編輯，先按「儲存外觀 .md ＋ 參數 .json」，再選步驟並按「讀取本步驟 .md／複製執行」。每個資產版本各有設定檔，指令另存 prompts/jobs/，不混用前一步的長 prompt。

立繪生成後重新載入 Drive，在「審查覆核」核准或退件。核准立繪可按「指定 3D Prompt」，再選 Colab 或 AI Blender；Colab 與指定圖片建模均要求來源立繪已核准。AI Blender 純文字建模可取消圖片來源。

模型完成後重新載入 Drive。純文字建模須補立繪、核准，再填入來源立繪資產 ID 並按「綁定目前 3D 的來源立繪」。最終人工核准才會移至完成區，審查意見可儲存至 Drive。完成區與歷史備份不會被當作新的待審輸入。

歷史參考：原 Argon 說明文件在 02_3d/ai_blender/_briefs/；原 3D_out 散裝重複輸出與總覽在 backup/legacy_loose_outputs/。完整封裝保留於歷史備份。正式目錄保留 GLB／Blend、材質、骨架／動作規格及主要審查圖，其他歷史截圖、中間檔與替代格式留在原封裝。


## 任務清單重建（類別 → 路徑 → 節點）

先選 **角色／宙獸／招式**，再依管線流程選擇工作節點。每個節點可點擊查看當前任務說明與交付項目，Prompt 輸出同步切換；原有任務 ID、Google Drive 路徑與歷史紀錄仍保留。

- **角色／宙獸，Image-to-3D**：外觀設定 → 三輪立繪 → 立繪審查 → **Colab＋Blender** 或 **AI＋Blender**（互斥分支）→ 最終驗收。兩條 3D 分支均需已核准的來源立繪。
- **角色／宙獸，Prompt-to-3D**：外觀設定 → **AI＋Blender 文字建模**（在立繪前分岔）→ **補畫動態主立繪**（不需要正面基準圖或 T-pose）→ 補繪立繪審查／綁定來源 → 最終驗收。所有管線共用獨立階段圖鑑，僅在缺少時建立草稿，不在建模時重複產生。
- **招式**：獨立招式效果動畫／特效設計，不混入角色或宙獸 3D 管線。

切換類別與路徑時，前端保留既有概念資料及任務選項；選取文字建模會清除上一個圖片來源，以避免誤用 Image-to-3D。流程節點選擇保存於本機狀態，重新整理後可恢復。最終核准仍由審查台人工決定，不因切換流程自動通過。

## Wiki 單一產檔規則（PR #11 更新）

- 角色：`wiki/characters/<subject_id>_wiki.md`，有明確型態時使用 `<subject_id>_<stage>_wiki.md`。
- 宙獸：`wiki/creatures/<subject_id>_<juvenile|adolescent|adult|overload>_wiki.md`，每階段各一份。
- 招式：`wiki/moves/<move_id>_wiki.md`。
- Prompt-to-Image、Image-to-3D（Colab/AI Blender）、Prompt-to-3D 使用相同 `wiki` 主鍵。獨立圖鑑步驟只在檔案不存在時建立 Markdown 草稿；下游僅關聯現有檔案，禁止重複產生。
- 設定頁「拆分舊圖鑑」可重複執行：從舊 `wiki` 前身 `04_encyclopedia/creatures/` 的 15 個原始系列文件擷取四階描述，轉為新 Markdown；四階都有檔案才將原始文件移到 `wiki/_legacy/creatures/`。Google Docs 先透過 export 讀取，既有新檔不覆寫；型態段落無法辨識時列入錯誤而不猜造。
- 使用獨立草稿時 `status: draft / review_required`，不假稱已完成畫作、模型或 QA。本次 15→60 雲端資料遷移已透過授權 Drive 操作完成並回讀驗證；網頁端的遷移按鈕保留作為可重試的缺檔修復流程，不會覆寫既有階段圖鑑。
