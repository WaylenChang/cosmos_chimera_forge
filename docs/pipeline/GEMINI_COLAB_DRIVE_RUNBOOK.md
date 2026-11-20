# Gemini Colab 離線執行手冊（PR #26）

> 這份手冊位於 Google Drive `cosmos_chimera_forge/pipeline/character_colab_runtime_PR26/`。Gemini 可以只讀此資料夾以及獲授權的單一角色資料夾，不需瀏覽或 clone GitHub。本文件是 PR #26 已發布的特定版本快照；程式的唯一維護來源仍為 GitHub，Drive 僅作發布鏡像。

## 1. 入口與可執行檔
- **主要入口**：`08_drive_only_colab.ipynb`（新的 Drive-only Colab Notebook）；原本 `07_batch_runner.ipynb` 也已改為從 Drive 離線 ZIP 載入。
- **程式包**：`anime3d_colab_source.zip`，包含 Python Runtime 全套 10 個腳本及 5 份通用流程、模型後端設定說明。
- **完整性**：`bundle_integrity.json` 記錄 ZIP 與每個檔案的 SHA-256；Notebook 會先核對再解壓。錯誤時中止，**絕不回退 GitHub**。
- **來源索引**：`runtime_manifest.json` 保存原 PR 分支、原始 Git blob 識別碼、發行 ZIP 檔案 SHA-256；Google Docs 複本供 Gemini 查詢文字，但 Runtime 必須以 ZIP 為準。
- **人類操作說明**：`DRIVE_RUNTIME_README.md`、ZIP 內 `docs/pipeline/CHARACTER_COLAB_QUALITY.md` 及 `docs/ANIME3D_TYPED_RUNNER.md`。

## 2. Gemini 的讀取順序
1. 讀此手冊與 `DRIVE_RUNTIME_README.md`，再讀 `runtime_manifest.json`、`bundle_integrity.json`。
2. 僅在獲指定的角色資料夾中讀取 `characters/<subject_id>/00_settings/asset_spec.json`、`_01_portrait/` 的已核准參考圖與 `_02_review_portrait/` 的**真實**核准紀錄，不可自行補假 review。
3. 設定 Colab Notebook 中 `DRIVE_ROOT` 與 `SUBJECT_ID`，並確認 Google Drive 已掛載。
4. 解壓後閱讀 ZIP 內腳本與流程文件即可了解預檢、模型推論、續跑、品質閘門、Blender 後處理、GPU 釋放；不需讀 GitHub。
5. 同一角色版本不可混用；任意來源圖、配置、後端或 GLB 變更，都要新 `asset_id` 留存前版。

## 3. 必要角色 spec（已核准的實際路徑，不得把範例當真）
```json
{
  "asset_id": "<asset_id>",
  "subject_id": "<subject_id>",
  "category": "character",
  "input_mode": "image",
  "asset_class": "humanoid",
  "license_status": "verified",
  "source_pack": "<approved_source_pack>",
  "source_layout": "subject_v3",
  "character_colab_workflow": "character-colab/2",
  "portrait_review": "_02_review_portrait/review.json",
  "source_image": "_01_portrait/front.png",
  "reference_views": {
    "front": "_01_portrait/front.png",
    "turnaround": "_01_portrait/turnaround.png",
    "three_quarter_45": "_01_portrait/three_quarter_45.png"
  }
}
```
以上路徑與 ID **都是佔位示例**，必須以實際 Drive 已存在檔案與人為審查為準。角色來源須有正面圖＋（側背獨立圖或三視合圖）＋獨立 45° 圖；三視合圖不代表具有真實相機外參，不能任意套用 Pixal3D `inference_mv.py`。

## 4. 執行階段
**第一階段 CPU 預檢**：Notebook 預設 `EXECUTE=False`、`STAGE='pre_gpu'`，檢查來源與核准狀態、參考圖 SHA-256、後端 runtime 路徑、規格一致性。若顯示 BLOCKED，先排除；不得跳過。

**模型環境準備**：ZIP 不包含 Pixal3D、TRELLIS.2、SkinTokens 的模型權重、CUDA、隔離 Python 環境。依後端官方版本個別安裝，從 `docs/anime3d_backends.example.json` 派生本機 `BACKEND_CONFIG`，填入實際 `repo`、`python`、checkpoint 路徑。不同模型不可混用衝突的依賴環境。沒有裝好不可宣稱能推論。

**第二階段 GPU 建模**：在獲授權、模型確實可用且預檢成功時，選 `STAGE='gpu'`、`EXECUTE=True`。產生的真實 `source/<asset_id>.glb` 與 `typed_state.json`、`qa/reference_views.json` 只寫到該角色 `_03a_colab/<asset_id>/`。GPU 結束或失敗必須使用 `anime3d_colab_guard.py` 呼叫 `google.colab.runtime.unassign()`，核對 `_gpu_runtime_status.json`；不能僅假設程式碼寫了就代表真的斷線。

**第三階段獨立外觀品質審查**：實際視覺模型或真人從多角度核對輪廓、臉部、服裝、細節、材質，將 `qa/appearance_review.json` 寫入該角色工作包。必須包含 `schema`、`asset_id`、模型與參考圖 SHA-256、`reviewer`、`method`、五項分數與 issues。缺報告或雜湊不符時阻擋 Rig。門檻為輪廓 .82、臉 .85、服裝 .82、細節 .80、材質 .76（專案起始評分值，不是模型 benchmark）。

**失敗決策**：缺角度才建議 MV-Adapter；幾何缺陷優先局部修補；貼圖缺陷考慮 Texture Refinement；臉或服裝辨識錯誤考慮針對性修正 Prompt 或比較後端。最多兩次重建＋一次 MV-Adapter 補圖，使用新的 `asset_id`；現版只輸出建議，不宣稱已提供自動 MV-Adapter、貼圖修復與跨模型評比。

**第四階段綁骨與 Blender QA**：只在外觀閘門通過後選 `STAGE='post_gpu'`，依實際安裝情形使用 SkinTokens（仍可能需 GPU）與 Blender，檢查骨架、蒙皮、動畫、UV/材質、輸出 GLB/BLEND。最終仍需人工驗收，不可把 `QA_PENDING` 或 `REVIEW_REQUIRED` 自動變為完成。

## 5. 禁止事項與疑難處理
- 禁止 GitHub 下載作為 fallback；ZIP／檔案 SHA 不符，停止執行並要求正式重新發布。
- 禁止使用角色圖片存在與否推論已核准；必須核實 review status=ok、subject/source_pack 一致。
- 禁止洩漏 Colab Secret，禁止預設啟動付費 Tripo，禁止假造 GPU、推論、評分或 QA 成功紀錄。
- 無 `BACKEND_CONFIG`、缺模型權重、GPU/VRAM 不足、未達品質門檻，均維持 BLOCKED/REVIEW_REQUIRED，回報具體缺項。
- 只做 CPU/語法與 CLI smoke tests；未曾在這次交付執行 Colab GPU、真實權重推論、SkinTokens、Texture Refinement 或人工圖像審核。
- Google Drive 的共用管線 ZIP、文件屬 GitHub 單向發布鏡像；個別角色的 spec、審查、圖片、模型成果才是 Drive 可寫工作資料。

## 6. 驗證紀錄
- 離線 ZIP 15 個檔案，10 個 Python scripts＋5 個通用文件；全部 Python 語法編譯、JSON 解析成功。
- `anime3d_preflight.py --help`、`anime3d_universal.py --help`、`anime3d_colab_guard.py --help` 全部退出碼 0。
- ZIP SHA-256 `53611c60df636c8596fdeced3a424e769754aa709b71967dac976d495a968145`。
- 這是**離線可載入/可進行預檢的管線交付**，不等於已證實可生成指定角色的 3D 模型。
