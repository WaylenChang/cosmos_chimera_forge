# Drive 角色／宙獸／主動技目錄規範

```text
cosmos_chimera_forge/
  00_settings/
    default.parameters.json       # 全域預設格式參數
  prompts/                        # 舊版共用模板；僅唯讀相容，不再寫入新工作

  characters/                     # 角色管線獨立目錄
    00_settings/                  # <asset_id>.appearance.md、<asset_id>.parameters.json
    01_portraits/<asset_id>/      # concept.json、manifest.json、images/
    02_3d/
      colab/<asset_id>/           # Colab GPU 輸出
      ai_blender/<asset_id>/      # Argon／Codex Blender 輸出
      legacy/<asset_id>/          # 既有待審成果
    03_completed/
      portraits/<asset_id>/
      models/<asset_id>/
    wiki/<subject_id>[_<stage>]_wiki.md
    prompts/                      # 角色專屬階段模板（8 份）
      jobs/                       # HTML 填入參數後的角色工作 prompt
    reviews/<asset_id>.json       # 審查結果、來源立繪 ID、時間、意見
    backup/
      rejected_portraits/<revision>/<asset_id>/
      rejected_3d/<revision>/<asset_id>/

  creatures/                      # 宙獸管線獨立目錄
    00_settings/                  # <asset_id>.appearance.md、<asset_id>.parameters.json
    01_portraits/<asset_id>/      # concept.json、manifest.json、images/
    02_3d/
      colab/<asset_id>/
      ai_blender/<asset_id>/
      legacy/<asset_id>/
    03_completed/
      portraits/<asset_id>/
      models/<asset_id>/
    wiki/<subject_id>_<stage>_wiki.md  # 每個階段一份（含 _legacy/）
    prompts/                      # 宙獸專屬階段模板（8 份）
      jobs/
    reviews/<asset_id>.json
    backup/
      rejected_portraits/<revision>/<asset_id>/
      rejected_3d/<revision>/<asset_id>/

  moves/                          # 主動技管線獨立目錄
    00_settings/
    01_vfx/<asset_id>/            # spec.json、storyboard、layers、flipbook
    03_completed/<asset_id>/
    wiki/<move_id>_wiki.md
    prompts/                      # 主動技專屬 01b_move_vfx.prompt.md
      jobs/
    reviews/<asset_id>.json
    backup/
      rejected_vfx/<revision>/<asset_id>/
```

所有新提示詞讀寫均採分類優先：`characters/prompts/`、`creatures/prompts/`、`moves/prompts/`；根目錄 `prompts/` 僅保留舊版讀取相容。`TRIGGERS.md` 與 `DIRECTORY.md` 的規範版本以 GitHub `docs/pipeline/` 為準，不代表根目錄為新寫入位置。

3D 資產目錄內用 models/、rig/、animations/、previews/、manifest.json。

## PR #11 的型態化 Anime3D 管線：Drive 相容規則

**不依生物類型新增 Drive 頂層分類資料夾。** 六大資產類別、十多種解剖型態寫入每個資產的 `profile.json` 與 `manifest.json`，避免將同一宙獸的進化階段／版本分散在不同根目錄。

- `Image-to-3D / Colab＋Blender`：`<category>/02_3d/colab/<asset_id>/`。
- `Image-to-3D / AI＋Blender`：`<category>/02_3d/ai_blender/<asset_id>/`。
- `Prompt-to-3D / AI＋Blender`：`<category>/02_3d/ai_blender/<asset_id>/`；純文字外觀直接建模、綁骨與動作，無需補立繪。
- `<category>/02_3d/legacy/` 與既有 `<category>/02_3d/ai_blender/` 歷史版本**於分類後的位置保留**，不可因命名不同就搬移／重寫。
- 每個新的 typed runner 產出標準 `manifest.json`，由 `anatomy`、`input_mode`、`pipeline` 與 `source_pack` 識別分流；沒有產生的檔案應列為 `missing`，不應假裝完成。

每個 3D 資產包允許新增以下**同一資產目錄內**的子路徑，而非額外頂層資料夾：

```text
<category>/02_3d/<colab|ai_blender>/<asset_id>/
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

`<category>/00_settings/` 可繼續儲存資產專屬 `asset_spec.json`、外觀與格式設定；`<category>/prompts/jobs/` 存實際需要的自動化 prompt，不需替手動立繪複製流程建立空的 Markdown。對 Prompt-to-3D，無需補繪立繪，也不應設定假 `source_pack`。

2026-11-15 實際 Drive 查核：`characters/02_3d/colab/` 已有角色模型；`creatures/02_3d/ai_blender/` 已分類保存 60 個宙獸型態模型；歷史 `_briefs`、`_scripts` 已移至 `creatures/backup/`。所有正式資產均使用分類優先路徑，退役頂層目錄置於共用 `backup/`。本次檢查 90 份 manifest，其中 71 份的圖鑑引用已實際更新，19 份原已符合規範。開始 Image-to-3D 批次作業前，仍需實際審查來源立繪，不得假核准歷史素材。

每個版本使用唯一 asset_id；角色與宙獸共用結構，由 manifest.task_type 區別。立繪包涵蓋多個型態時，各模型 source_pack 皆指向同一立繪資產 ID，stage 指定型態。

格式參數獨立存 JSON；外觀 prompt 不夾帶格式與遊戲數值。審查通過的立繪先不移動；退件整個目錄搬到備份。只有最終人工核可後才能移入完成區；歷史資產不自動視為核可。Image-to-3D 必須有已核准並綁定之來源立繪才可完成；Prompt-to-3D 無需補立繪。

Colab 使用 GPU 模型的細節尚待實機選定；本次建立介面、目錄與步驟指令，未聲稱已執行 GPU／建模。Blender 可在中途或後續修復。

## Prompt-to-3D 原有成果整理（2026-11-13）

`creatures/02_3d/ai_blender/asset_cr_*_<stage>/models/` 是已由 AI＋Blender **Prompt-to-3D** 生成的模型，不能將其重新視為 Image-to-3D；`.glb`、`.blend` 留在原本的 `models/`，保留 Google Drive 檔案 ID。這些模型是否已綁骨、包含動畫或符合品質要求，仍須逐件驗證。

原先 `creatures/backup/legacy_blender_briefs/` 的 15 份 `cr_*_wiki.md` 已完成拆分並移轉：`creatures/wiki/` 現有 60 份獨立型態 Markdown（15 × 4），15 份系列原檔保留在 `creatures/wiki/_legacy/`，原 `04_encyclopedia/creatures/` 已清空。`characters/wiki/` 與 `moves/wiki/` 亦已建立。新規則改為每個階段一份：`<subject_id>_<stage>_wiki.md`。舊系列圖鑑經設定頁拆分後保存在 `creatures/wiki/_legacy/`，防止資料遺失。圖鑑獨立於模型檔案，模型的 `manifest.encyclopedia_path` 指向該 Markdown。

為避免大量空目錄及將尚未執行的 QA 假報為完成，既有模型包保留 `models/`，待實際產生骨架、動作、預覽及驗證資料才建立 `rig/`、`animations/`、`previews/`、`qa/` 等子目錄。既有模型的原始 `.glb` 不應複製冒充已完成 QA 的 `source/`。

登入網頁後，設定頁提供 **「整理歷史 Prompt-to-3D 目錄」**，需明確點擊及確認後才會檢查實際 `.glb`／`.blend`，建立或更新 `manifest.json`，標記 `input_mode=text`、`pipeline=ai_blender`、`encyclopedia_path` 和待審項目。若原有 manifest，先保存到 `creatures/backup/manifest_snapshots/`；不改模型、不自動移至完成區。此自助整理需在網站完成 OAuth 登入後執行，並非由 GitHub CI 在 Drive 背景操作。

角色／宙獸的 Image-to-3D 與 Prompt-to-3D 流程，以及主動技特效流程，現在均有獨立的「生成圖鑑」節點。生成 Prompt 使用當前主體概念，輸出到對應的 `<kind>/wiki/`，不得讀取或覆寫別的資產。宙獸 Prompt-to-3D 的圖鑑可先於建模產生；建模時只引用該圖鑑，不再把 `bestiary.md` 當作模型目錄中必須重複保存的副本。

## HTML 操作

選角色／宙獸與型態，以隨機設定、圖鑑或 AI 文字決定外觀。上方「格式參數」獨立編輯，先按「儲存外觀 .md ＋ 參數 .json」，再選步驟並按「讀取本步驟 .md／複製執行」。每個資產版本各有設定檔，指令另存 `<category>/prompts/jobs/`，不混用前一步的長 prompt。

立繪生成後重新載入 Drive，在「審查覆核」核准或退件。核准立繪可按「指定 3D Prompt」，再選 Colab 或 AI Blender；Colab 與指定圖片建模均要求來源立繪已核准。AI Blender 純文字建模可取消圖片來源。

模型完成後重新載入 Drive。Image-to-3D 須確認已綁定來源立繪；Prompt-to-3D 無需補立繪即可直接進行最終審查。最終人工核准才會移至完成區，審查意見可儲存至 Drive。完成區與歷史備份不會被當作新的待審輸入。

歷史參考：原 Argon 說明文件在 `creatures/backup/legacy_blender_briefs/`；原 3D_out 散裝輸出與總覽已依資產歸屬分流至 `creatures/backup/legacy_loose_outputs/` 與 `characters/backup/legacy_loose_outputs/`。完整封裝保留於歷史備份。正式目錄保留 GLB／Blend、材質、骨架／動作規格及主要審查圖，其他歷史截圖、中間檔與替代格式留在原封裝。


## 任務清單重建（類別 → 路徑 → 節點）

先選 **角色／宙獸／主動技**，再依管線流程選擇工作節點。每個節點可點擊查看當前任務說明與交付項目，Prompt 輸出同步切換；原有任務 ID、Google Drive 路徑與歷史紀錄仍保留。

- **角色／宙獸，Image-to-3D**：外觀設定 → 角色三輪立繪（宙獸僅需正面圖與三視圖，不需主立繪）→ 立繪審查 → **Colab＋AI＋Blender** 或 **AI＋Blender**（兩條獨立路線）→ 最終驗收。Colab 路線可在 GPU 建模後使用 AI 輔助 Blender 修整，不代表另啟一個獨立的 AI Blender 資產管線；兩條路線均需已核准的來源立繪，並保留各自 `pipeline` 與來源追蹤。
- **角色／宙獸，Prompt-to-3D**：外觀設定 → **AI＋Blender 文字建模**（在立繪前分岔，無需補立繪）→ 最終驗收。所有管線共用獨立階段圖鑑，僅在缺少時建立草稿，不在建模時重複產生。
- **主動技**：獨立主動技效果動畫／特效設計，不混入角色或宙獸 3D 管線。

切換類別與路徑時，前端保留既有概念資料及任務選項；選取文字建模會清除上一個圖片來源，以避免誤用 Image-to-3D。流程節點選擇保存於本機狀態，重新整理後可恢復。最終核准仍由審查台人工決定，不因切換流程自動通過。

## Wiki 單一產檔規則（PR #11 更新）

- 角色：`characters/wiki/<subject_id>_wiki.md`，有明確型態時使用 `<subject_id>_<stage>_wiki.md`。
- 宙獸：`creatures/wiki/<subject_id>_<juvenile|adolescent|adult|overload>_wiki.md`，每階段各一份。
- 主動技：`moves/wiki/<move_id>_wiki.md`。
- Prompt-to-Image、Image-to-3D（Colab/AI Blender）、Prompt-to-3D 使用相同 `wiki` 主鍵。獨立圖鑑步驟只在檔案不存在時建立 Markdown 草稿；下游僅關聯現有檔案，禁止重複產生。
- 設定頁「拆分舊圖鑑」可重複執行：從舊 `wiki` 前身 `04_encyclopedia/creatures/` 的 15 個原始系列文件擷取四階描述，轉為新 Markdown；四階都有檔案才將原始文件移到 `creatures/wiki/_legacy/`。Google Docs 先透過 export 讀取，既有新檔不覆寫；型態段落無法辨識時列入錯誤而不猜造。
- 使用獨立草稿時 `status: draft / review_required`，不假稱已完成畫作、模型或 QA。本次 15→60 雲端資料遷移已透過授權 Drive 操作完成並回讀驗證；網頁端的遷移按鈕保留作為可重試的缺檔修復流程，不會覆寫既有階段圖鑑。
