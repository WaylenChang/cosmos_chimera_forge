# Cosmos Chimera Forge — Google Drive 通用目錄結構與管線規範

- **專案根目錄**：`cosmos_chimera_forge/`（Drive Folder ID: `1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`）
- **最後維護日期**：2026-11-20
- **維護正本**：此 GitHub 文件為通用目錄與流程契約的正本，Drive 根目錄 `DIRECTORY.md` 為唯讀鏡像，需在 GitHub PR 合併後由授權流程單向發布及驗證。個別主體成果與索引仍以 Drive 為正本。詳見 [STORAGE_BOUNDARY](../STORAGE_BOUNDARY.md)。

## 1. Google Drive 目錄結構與命名規範

### 1.1 三層主目錄結構與過渡性檔案分層

- **第一層**：`characters/`（角色）、`creatures/`（宙獸）、`moves/`（主動技／技能）
- **未開工設計 Prompt 區（`<kind>/designed_prompts/`）**：尚未開始管線生成的主體，其純視覺設計 Prompt（`<design_id>.prompt.md`，供 `prompt-to-img`／`prompt-to-3D` 使用，不含數值、性格、生態、招式等非視覺雜訊）暫存於 `<kind>/designed_prompts/`；宙獸每個型態皆須產出獨立 `.glb` 檔，`.prompt.md` 須分開描述「四型態一致性」、「各型態特徵」、「型態演化關係」。**一旦該主體已開始任一管線生成步驟，立即將對應 `.prompt.md` 移動到 `<kind>/<id>/` 目錄**。若生成版本或步驟有調整，將更改內容**追加**在該 `<kind>/<id>/*.prompt.md` 檔尾（標註版本與步驟），不覆寫原文亦不另建散裝檔案。
- **第二層**：`<id>/`（主體 ID，例如 `chr_1286`、`cr_aqua_slime`、`starter_moon_line`、`earth_boulder_roll`）
- **第三層（`<kind>/<id>/`）**：**只保留 `*.prompt.md` 與當前審核階段或已通過的檔案**（即成果審查台等待審查或已通過的核心交付物），**已結束步驟或舊有版本必須移動到對應的子目錄 `<kind>/<id>/<step>/[<ver>/]`**：
  - **設計 Prompt**：`<design_id>.prompt.md`（管線開工後自 `designed_prompts/` 移入，版本／步驟調整時追加於此檔）
  - **主立繪（僅角色）**：`<id>_01_portrait[_<ver>]_main.png`（僅保留當前審核中或已通過之最新版本；**宙獸不需審查 img，所有宙獸立繪圖檔一律移入 `creatures/<id>/01_portrait/[<ver>/]`**）
  - **GLB 檔**：`<id>[_<stage>]_<03a_colab|03b_blender>[_<ver>].glb`（僅保留當前審核中或已通過之最新版本；舊版移入 `<step>/v1/`、`v2/`…）
  - **圖鑑**：`<id>[_<stage>]_05_wiki[_<ver>].md`
  - **遊戲格式數據**：對應遊戲格式數據檔（若有）
- **功能性／中間流程過渡性檔案子目錄（`<kind>/<id>/<step>/[<ver>/]`）**：其餘功能性、中間過渡檔案、已結束步驟產物及舊有版本，依管線步驟（有調整版本或歷史重複產出時再建 `<ver>/` 子目錄）存放，**檔名結構維持不變**：
  - **命名結構**：`id_型態(宙獸才有型態)_管線與步驟_版本(可以沒有，多版本才需要)`
  - 多檔產出（如立繪多視角圖、manifest、concept、VFX 分鏡）於基底命名後加上角色／副檔名，例如 `_front.png`、`_manifest.json`、`_concept.json`。

```text
cosmos_chimera_forge/                              [1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0]
├── characters/                                    [1NQ4omQINkHXTCbmdd0zSRmyPiGIL4daD]
│   ├── <id>/                                      # 第二層：角色 ID（無型態）
│   │   ├── <design_id>.prompt.md                  # 第三層保留：設計 Prompt（開工後自 designed_prompts/ 移入，調整時追加）
│   │   ├── <id>_01_portrait_main.png              # 第三層保留：主立繪（僅當前審核中或已通過之最新）
│   │   ├── <id>_03a_colab.glb                     # 第三層保留：GLB（僅當前審核中或已通過之最新）
│   │   ├── <id>_03b_blender_v2.glb                # 第三層保留：GLB（多版本最新）
│   │   ├── <id>_05_wiki.md                        # 第三層保留：圖鑑
│   │   ├── 00_settings/                           # 外觀與參數（有版本則進 v2/）
│   │   │   ├── <id>_00_appearance.md
│   │   │   ├── <id>_00_parameters.json
│   │   │   └── v2/
│   │   │       ├── <id>_00_appearance_v2.md
│   │   │       └── <id>_00_parameters_v2.json
│   │   ├── 01_portrait/                           # 立繪過渡檔案（多視角、concept、manifest）
│   │   │   ├── <id>_01_portrait_front.png
│   │   │   ├── <id>_01_portrait_turnaround.png
│   │   │   ├── <id>_01_portrait_concept.json
│   │   │   └── <id>_01_portrait_manifest.json
│   │   ├── 02_review_portrait/                    # 立繪審查紀錄
│   │   │   └── <id>_02_review_portrait.json
│   │   ├── 03a_colab/                             # Colab 中間檔與舊版 GLB（依版本進 v1/、v2/…）
│   │   │   ├── <id>_03a_colab.blend
│   │   │   ├── <id>_03a_colab_manifest.json
│   │   │   └── v1/
│   │   │       └── <id>_03a_colab.glb
│   │   ├── 03b_blender/                           # AI Blender 中間檔（依版本進 v2/）
│   │   │   └── v2/
│   │   │       ├── <id>_03b_blender_v2.blend
│   │   │       └── <id>_03b_blender_v2_manifest.json
│   │   └── 04_review_3d/                          # 3D 審查紀錄
│   │       └── <id>_04_review_3d.json
│   ├── designed_prompts/                          # 未開工設計 Prompt（開工後移入對應 <id>/）
│   ├── prompts/                                   # 分類專屬管線模板
│   └── backup/                                    # 退件備份
├── creatures/                                     [1zAbLoEZMv5BxKmPaEZJJLrt99H3kro9C]
│   ├── <id>/                                      # 第二層：宙獸 ID（含四階型態）
│   │   ├── <design_id>.prompt.md                  # 第三層保留：設計 Prompt（已有 GLB／開工後自 designed_prompts/ 移入）
│   │   ├── <id>_juvenile_03a_colab.glb            # 第三層保留：GLB
│   │   ├── <id>_adult_03b_blender_v2.glb          # 第三層保留：GLB（多版本）
│   │   ├── <id>_juvenile_05_wiki.md               # 第三層保留：圖鑑
│   │   ├── 00_settings/
│   │   ├── 01_portrait/                           # 宙獸不需審查 img，所有立繪 img（含 _main.png）移入此子目錄
│   │   ├── 02_review_portrait/
│   │   ├── 03a_colab/
│   │   ├── 03b_blender/
│   │   └── 04_review_3d/
│   ├── designed_prompts/                          # 未開工宙獸純視覺 Prompt（四型態一致性／各型態特徵／型態演化關係）
│   │   ├── starters/                              # 御三家（starter_*）
│   │   ├── lines/                                 # 一般演化線（line_*）
│   │   └── trial_bosses/                          # 地形試煉 BOSS（line_*_trial_boss）
│   ├── prompts/                                   # 分類專屬管線模板
│   └── backup/                                    # 退件備份
├── moves/                                         [1alulsIhFcb8m8UKXaA-9-orBCEr__P8B]
│   ├── <id>/                                      # 第二層：技能／主動技 ID（無型態）
│   │   ├── <id>_05_wiki.md                        # 第三層保留：圖鑑
│   │   ├── 00_settings/
│   │   ├── 01b_vfx/
│   │   │   ├── <id>_01b_vfx_spec.json
│   │   │   └── <id>_01b_vfx_manifest.json
│   │   └── 04_review_3d/
│   │       └── <id>_04_review_3d.json
│   ├── designed_prompts/                          # 未開工主動技設計 Prompt（開工後移入對應 <id>/）
│   ├── prompts/                                   # 分類專屬管線模板
│   └── backup/                                    # 退件備份
├── 00_settings/                                   [1USaqcFqwmGocRYFdX3J9CeSj0-iu8qkV] # 全域預設
├── prompts/                                       [1p6os1X7vw58i0aqGco0r89ztXkLPzNGz] # 舊版唯讀相容模板
├── DIRECTORY.md                                   [1UT4_289o-zh6-9wyq3rG_qMpfzdkjsi7]
├── AGENT_QUICKSTART.md                            [1oN0va-tlEct7ofhgVNTsYc5_hKSSpf5O]
└── backup/                                        [1j1URF-pjZA_AJKj6MzG4vNVWrD2-ziqy] # 退役資料夾與歷史索引
```

## 2. 管線流程各步驟參考 Prompt（分類專屬 `<kind>/prompts/`）

新工作一律從 `characters/prompts/`、`creatures/prompts/` 或 `moves/prompts/` 讀取模板。核心交付物（主立繪 `_main.png`、`.glb`、`_05_wiki.md`、遊戲格式數據）直接寫入 `<kind>/<id>/`（第三層）；其餘功能性與中間流程過渡檔寫入 `<kind>/<id>/<step>/[<ver>/]`，檔名結構不變。根目錄 `prompts/` 僅供舊版讀取相容，不再作為新工作寫入路徑。

| 步驟代碼 | 模板檔案 | 對應流程節點 | 輸出命名與存放路徑（`<kind>/<id>/` 下） |
| :--- | :--- | :--- | :--- |
| `00_appearance` / `00_parameters` | `<kind>/prompts/00_appearance.prompt.md` | 外觀設定 | `00_settings/[<ver>/]<id>[_<stage>]_00_appearance[_<ver>].md`、`_00_parameters[_<ver>].json` |
| `01_portrait` | `<kind>/prompts/01_portrait.prompt.md` | 立繪生成 | 第三層保留 `<id>[_<stage>]_01_portrait[_<ver>]_main.png`；其餘（`_front.png`、`_turnaround.png`、`_concept.json`、`_manifest.json`）存於 `01_portrait/[<ver>/]` |
| `01b_vfx` | `moves/prompts/01b_move_vfx.prompt.md` | 主動技特效 | `01b_vfx/[<ver>/]<id>_01b_vfx[_<ver>]_spec.json`、`_manifest.json` |
| `02_review_portrait` | `<kind>/prompts/02_review_portrait.prompt.md` | 立繪審查 | `02_review_portrait/[<ver>/]<id>[_<stage>]_02_review_portrait[_<ver>].json`（只輸出建議，不代為核准） |
| `03a_colab` | `<kind>/prompts/03a_colab.prompt.md` | Colab Image-to-3D | 第三層保留 `<id>[_<stage>]_03a_colab[_<ver>].glb`；其餘（`.blend`、`_manifest.json`、預覽、動畫）存於 `03a_colab/[<ver>/]` |
| `03b_blender` | `<kind>/prompts/03b_blender.prompt.md` | AI Blender（圖生／文生 3D） | 第三層保留 `<id>[_<stage>]_03b_blender[_<ver>].glb`；其餘（`.blend`、`_manifest.json`、貼圖、渲染圖）存於 `03b_blender/[<ver>/]` |
| `04_review_3d` | `<kind>/prompts/04_review_3d.prompt.md` | 3D 最終驗收 | `04_review_3d/[<ver>/]<id>[_<stage>]_04_review_3d[_<ver>].json` |
| `05_wiki` | `<kind>/prompts/05_encyclopedia.prompt.md` | 獨立圖鑑生成 | 第三層保留 `<id>[_<stage>]_05_wiki[_<ver>].md`（僅於目標檔案不存在時建立） |
| `skeleton_actions` | `<kind>/prompts/skeleton_actions.md` | 骨架與動作規格 | 角色（50 動作）／宙獸（57 動作＋`Socket_Weapon_R`/`L` 虛擬大手規範）／招式（施放動作與掛點對照） |
| — | `docs/pipeline/TRIGGERS.md` | 簡易觸發語句 | 各步驟觸發指令與管線分支說明 |


## 3. 個別主體索引（僅 Google Drive）

角色、宙獸、技能的實際名稱／ID、資產版本、Wiki 路徑、歷史完成清單與完整索引只儲存在 Google Drive；本文件不再列出個別主體對照表。需查找時，經 Google OAuth 驗證後依 `characters/`、`creatures/`、`moves/` 中的實際目錄與檔案內容查詢，勿依賴 GitHub 的靜態快照。此頁保留目錄**結構與命名契約**，不是任何主體的資產索引。

參見 [GitHub／Drive 資料儲存邊界](../STORAGE_BOUNDARY.md)。

## 6. 管線與目錄規範摘要（PR #11 相容規則）

- **不依生物類型新增 Drive 頂層分類資料夾**：六大資產類別與解剖型態寫入各資產的 `profile.json` 與 `manifest.json`。
- **3D 資產包標準子目錄**：`models/<asset_id>.glb`、`.blend`、`manifest.json`、`profile.json`、`typed_state.json`、`rig/rig_report.json`、`animations/animations_manifest.json`、`previews/qa_*.png`、`qa/typed_metrics.json`。
- **Wiki 單一產檔規則**：角色 `characters/wiki/<subject_id>[_<stage>]_wiki.md`、宙獸 `creatures/wiki/<subject_id>_<stage>_wiki.md`、主動技 `moves/wiki/<move_id>_wiki.md`；下游僅關聯路徑，禁止重複產生。
- **歷史資產分類與審查規則**：2026-11-15 已將舊頂層資產移入 `characters/`、`creatures/`、`moves/`，退役空目錄封存於共用 `backup/`，保留每個檔案及資料夾原 Drive ID；資產未經人工核准不得移入 `<kind>/03_completed/`。
