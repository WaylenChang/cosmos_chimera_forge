# COSMIMERA AI Agent 快速執行指南（AGENT_QUICKSTART）

本文件說明 AI Agent 如何在讀取後，僅透過使用者提供的 **角色／宙獸（或招式）名稱／ID** 與 **管線步驟**，自動定位 Google Drive 上的設定、圖鑑、立繪、模型與 Prompt 模板，並依規範開始執行工作。

---

## 1. 專案根目錄與唯一正式路徑規則

- **Drive 專案根目錄**：`project/cosmos_chimera_forge/`（Folder ID：`1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`）
- **核心參考文件**：
  - `DIRECTORY.md`：完整目錄結構、PR #11 型態化 3D 與 Wiki 規範
  - `docs/pipeline/TRIGGERS.md`：各步驟觸發語句與分支說明
  - `<kind>/prompts/*.prompt.md`：角色／宙獸分類專屬模板；招式使用 `moves/prompts/01b_move_vfx.prompt.md`

> **分類優先的唯一正式路徑**：所有角色／宙獸／招式資產都在 `<kind>/` 之下，`<kind>` 僅能是 `characters`、`creatures`、`moves`。圖鑑位於 `<kind>/wiki/`，模型與立繪也只由對應分類讀取。舊根目錄及 `<kind>/02_3d/legacy/` 仍可能保留待核對資料；只允許唯讀盤點與遷移相容讀取，不得作為新工作輸出位置。完成來源、衝突、備份及驗收驗證前，不得宣稱已退役或刪除。

---

## 2. 解析「角色／宙獸名稱或 ID」的標準流程

使用者可能提供以下任一種識別資訊：
1. **中文／英文名稱**：如 `葉澄汐`、`Chengxi Yeh`、`水波史萊姆`、`鏡環天鷺`
2. **Subject ID / Line ID**：如 `chr_1286`、`cr_aqua_slime`、`starter_sun_line`
3. **Asset ID（特定版本包）**：如 `chr-20261106-1286-2039`、`cr-20261114-cr_aqua_slime`、`asset_cr_aqua_slime_juvenile`、`mdl-20261113-1286-0000`
4. **進化階段（宙獸適用）**：`juvenile`（幼年）／`adolescent`（少年）／`adult`（成年）／`overload`（過載）

### 自動定位步驟（依序執行）

1. **判定類別（`kind`）**：
   - 角色（`characters`）：ID 以 `chr_` / `chr-` 開頭，或於 `characters/wiki/` 命中。
   - 宙獸（`creatures`）：ID 以 `cr_` / `cr-` / `starter_` / `line_` / `asset_cr_` 開頭，或於 `creatures/wiki/` 命中。
   - 招式（`moves`）：ID 以 `fx_` / `vsl_` / `mv_` 開頭，或於 `moves/wiki/` 命中。
2. **解析 `subject_id`（與宙獸 `stage`）**：
   - 若使用者給中文／英文名稱：
     - 搜尋 `<kind>/wiki/` 檔名與內容（`name_zh`、`name_en`、`title_zh`、`subject_id`）。
     - 搜尋 `<kind>/00_settings/*.appearance.md`中的 `id` / `name_zh` / `name_en`。
     - 搜尋 `<kind>/01_portraits/*/concept.json` 或 `manifest.json`。
   - 若為宙獸但未指定 `stage`：
     - 若有指定明確 `asset_id`（如 `asset_cr_aqua_slime_juvenile`），從檔名／`manifest.json` 取得 `stage`。
     - 否則先向使用者確認要執行哪一個階段（`juvenile` / `adolescent` / `adult` / `overload`），不得自行猜測。
3. **定位相關檔案與目錄**：
   - **圖鑑**：
     - 角色：`characters/wiki/<subject_id>_wiki.md`（若有分階段則 `<subject_id>_<stage>_wiki.md`）
     - 宙獸：`creatures/wiki/<subject_id>_<stage>_wiki.md`
     - 招式：`moves/wiki/<move_id>_wiki.md`
   - **外觀與參數設定**：`<kind>/00_settings/<asset_id>.appearance.md`、`<kind>/00_settings/<asset_id>.parameters.json`（若無專屬參數檔，回退讀取共用的 `00_settings/default.parameters.json`）。
   - **立繪包**：`<kind>/01_portraits/<portrait_asset_id>/`。
   - **立繪審查紀錄**：`<kind>/reviews/<portrait_asset_id>.json`。
   - **3D 模型包**：`<kind>/02_3d/<colab|ai_blender|legacy>/<model_asset_id>/`。

---

## 3. 管線步驟對照表（步驟名稱／代碼 → 模板與規範）

收到任務時，先讀取 `<kind>/prompts/<對應模板>`，將解析出的 `subject_id`、`asset_id`、路徑與參數代入模板後執行：

| 步驟代碼 | 常見別名 | Prompt 模板（`<kind>/prompts/`） | 必要前置條件 | 主要輸入 | 輸出位置與交付物 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `00_appearance` | 外觀設定 | `00_appearance.prompt.md` | 無 | 概念／圖鑑素材 | `<kind>/00_settings/<asset_id>.appearance.md`（繁中純外觀，不含數值與製圖指令） |
| `01_portrait` | 生成立繪、立繪 | `01_portrait.prompt.md` | 已有外觀與參數 | `appearance.md`、`parameters.json`（引用既有 wiki，不覆寫） | `<kind>/01_portraits/<asset_id>/`（`images/`、`concept.json`、`manifest.json`） |
| `01b_move_vfx` | 招式特效 | `01b_move_vfx.prompt.md` | 若無招式圖鑑須先建 | 招式規格、`moves/wiki/<id>_wiki.md` | `moves/01_vfx/<asset_id>/`（`spec.json`、`storyboard/`、`layers/`、`flipbook/`、`manifest.json`） |
| `02_review_portrait` | 立繪審查 | `02_review_portrait.prompt.md` | 已有待審立繪包 | `<kind>/01_portraits/<asset_id>/`、`appearance.md`、`parameters.json` | 輸出逐檔檢查報告與通過／退件建議（**不可自動核准或搬移資產**） |
| `03a_colab` | Colab 3D、Colab | `03a_colab.prompt.md` | **Image-to-3D 須有已核准立繪**（`<kind>/reviews/<id>.json` `status == "ok"`） | 已核准立繪圖檔、`parameters.json` | `<kind>/02_3d/colab/<asset_id>/`（`models/<id>.glb`、`.blend`、`rig/`、`animations/`、`previews/`、`manifest.json`） |
| `03b_blender` | AI Blender、Blender 3D | `03b_blender.prompt.md` | Image-to-3D 須立繪已核准；Prompt-to-3D 可無立繪 | 已核准立繪（Image-to-3D）或 `appearance.md`＋`wiki`（Prompt-to-3D） | `<kind>/02_3d/ai_blender/<asset_id>/`（同上結構；無圖則標記 `input_mode: "text"`，不可填假 `source_pack`） |
| `03c_portrait_after_3d` | 補畫主立繪 | `03c_portrait_after_3d.prompt.md` | 僅限 **Prompt-to-3D** 建模完成後 | `<kind>/02_3d/ai_blender/<model_id>/` 模型與預覽 | `<kind>/01_portraits/<portrait_id>/`（全身動態主立繪 PNG 與來源模型 `asset_id` 關聯；不畫 T-pose／三視圖） |
| `04_review_3d` | 3D 審查、最終審查 | `04_review_3d.prompt.md` | Image-to-3D 須有核准來源立繪；Prompt-to-3D 須已補主立繪 | `<kind>/02_3d/.../<model_id>/`、對應立繪、`manifest.json` | 逐項檢查 `.glb`/`.blend`/骨架/動畫/材質並提出通過／退件建議（**不可自動核准或移至 `<kind>/03_completed/`**） |
| `05_encyclopedia` | 生成圖鑑、圖鑑 | `05_encyclopedia.prompt.md` | **目標圖鑑檔不得已存在**（存在則直接沿用，禁止覆寫或建副本） | 當前 `subject_id`（與 `stage`）概念／外觀 | `<kind>/wiki/<subject_id>[_<stage>]_wiki.md`（草稿標示 `status: draft / review_required`） |

---

## 4. 不可違反的鐵則（Guardrails）

1. **管線分流**：Image-to-3D 有 `Colab＋AI＋Blender` 與 `AI＋Blender` 兩條獨立路線；Prompt-to-3D 使用 `AI＋Blender`，建模後須補主立繪。`03a_colab` 是 Colab 路線的 GPU 建模階段，後續允許 AI 輔助 Blender 修整；`03b_blender` 是獨立的 AI Blender 建模入口，不得把同一資產誤當作兩次獨立建模交付。各路線必須保留 `pipeline`、`input_mode`、來源與審查狀態，不得因串接工具而重複產生圖鑑。
2. **禁止代為核准**：Agent 執行審查步驟（`02_review_portrait`、`04_review_3d`）時，只能輸出檢查報告與建議；只有人類審核者可寫入 `<kind>/reviews/<asset_id>.json` (`status: "ok"`) 或將資產搬入 `<kind>/03_completed/`。
3. **嚴禁造假與覆寫**：
   - 未產生的檔案（如缺少 `.glb`、`.blend`、動畫、預覽）必須在 `manifest.json` 如實標記 `missing` 或 `REVIEW_REQUIRED`。
   - Prompt-to-3D 尚未補畫並核准主立繪前，不得填入假的 `source_pack`。
   - 保留 `source/<asset_id>.glb` 原始輸出不被覆蓋。
4. **交付格式**：所有資產一律逐檔交付至對應展開目錄，**禁止交付 ZIP 壓縮檔**。
5. **不跨資產混用**：只讀取當前 `subject_id`（與指定 `stage`）的資料，不得借用其他角色或進化階段的圖鑑或外觀。

---

## 5. 現有常見角色／宙獸速查範例

- **角色（`characters`）**：
  - `葉澄汐` / `Chengxi Yeh` → `subject_id`: `chr_1286`（設定／立繪包：`chr-20261106-1286-2039`）
  - `chr_1855` → 設定／立繪包：`chr-20261106-1855-1855`
  - `chr_3d04` → 設定／立繪包：`chr-20261106-3d04-2100`
- **宙獸（`creatures`）**：
  - `cr_aqua_slime`、`cr_chrono_beetle`、`cr_earth_golem`、`cr_fire_wisp`、`cr_frostblade_penguin`、`cr_ice_snowman`、`cr_ink_stele`、`cr_light_khepri`、`cr_metal_vault`、`cr_shadow_eye`、`cr_solmane_lion`、`cr_thunder_drone`、`cr_verdant_aquila`、`cr_wind_bird`、`cr_wood_puppet`
  - 御三家：`starter_sun_line`（鏡環天鷺）、`starter_moon_line`（夜痕霜狼）、`starter_star_line`（星蹄天驥）
  - （實際最新清單請以 `characters/wiki/`、`creatures/wiki/` 與 `<kind>/00_settings/` 即時目錄為準）

---

## 6. 使用者指派範例（Agent 收到即可開工）

- 「閱讀 `cosmos_chimera_forge/AGENT_QUICKSTART.md`，對 **葉澄汐（`chr_1286`）** 執行 **`03a_colab`**」
- 「閱讀 `cosmos_chimera_forge/AGENT_QUICKSTART.md`，對 **`cr_aqua_slime`（`juvenile`）** 執行 **`04_review_3d`**」
- 「閱讀 `cosmos_chimera_forge/AGENT_QUICKSTART.md`，為 **鏡環天鷺（`starter_sun_line`，`adult`）** 執行 **`01_portrait`**」
