# Cosmos Chimera Forge — Google Drive 目錄結構、名稱／ID 對照與管線索引

- **專案根目錄**：`cosmos_chimera_forge/`（Drive Folder ID: `1AQR7UfEk7lL85rHHiZTK9PBOHc4GcEC0`）
- **最後維護日期**：2026-11-20

## 1. Google Drive 目錄結構與命名規範

> **2026-11-20 physical Drive rename:** The concrete Google Drive folder names have been normalized: category helper folders and all nested processing/version/backup folders start with `_`; subject folders use `chr_<batch>_<name>`, `ch_<batch>_<name>` or `mv_<batch>_<name>`. The historical paths and asset IDs displayed below are **logical compatibility paths**, not literal physical Drive folder paths. Examples: `characters/chr_1286/03a_colab/v2` resolves to `characters/chr_legacy_yeh_chengxi/_03a_colab/_v2`; `creatures/cr_aqua_slime/03b_blender` resolves to `creatures/ch_legacy_aqua_slime/_03b_blender`. Retain original filenames/game IDs. The exact 433-folder name+ID mapping is in `folder-migration-map-2026-11-20.json`, and full metadata readback confirms zero naming violations. The updated Drive resolver is available in PR #25 and must be deployed before relying on the new physical paths in the live app.

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

## 3. 角色（Characters）名稱與 ID 對照

| Subject ID（舊／Wiki） | 設計 ID（`designed.js`） | 中文名稱 | 英文名稱 | 現有立繪／3D 資產 ID | Wiki 路徑 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `chr_1286` | `chr_yeh_chengxi` | 葉澄汐 | Chengxi Yeh | `chr-20261106-1286-2039` / `mdl-20261113-1286-0000` | `characters/wiki/chr_1286_wiki.md` |
| `chr_1855` | `chr_amemori_sumiha` | 雨森澄羽 | Amemori Sumiha | `chr-20261106-1855-1855` / `mdl-20261114-1855-0000` | `characters/wiki/chr_1855_wiki.md` |
| `chr_3d04` | `chr_roen` | 洛恩 | Roen | `chr-20261106-3d04-2100` / `mdl-20261114-3d04-0000` | `characters/wiki/chr_3d04_wiki.md` |

## 4. 宙獸（Creatures）名稱與 ID 對照

### 4.1 既有 `cr_*` 系列（各含 `juvenile` / `adolescent` / `adult` / `overload` 四階）

| Subject ID | 中文名稱 | 現有 3D（Prompt-to-3D） | 現有立繪包 | Wiki 檔名格式 |
| :--- | :--- | :--- | :--- | :--- |
| `cr_aqua_slime` | 靈澤凝膠史萊姆 | `asset_cr_aqua_slime_<stage>` | `cr-20261114-cr_aqua_slime` | `creatures/wiki/cr_aqua_slime_<stage>_wiki.md` |
| `cr_chrono_beetle` | 懷錶犀角金龜 | `asset_cr_chrono_beetle_<stage>` | `cr-20261114-cr_chrono_beetle` | `creatures/wiki/cr_chrono_beetle_<stage>_wiki.md` |
| `cr_earth_golem` | 陶泥厚岩偶 | `asset_cr_earth_golem_<stage>` | `cr-20261114-cr_earth_golem` | `creatures/wiki/cr_earth_golem_<stage>_wiki.md` |
| `cr_fire_wisp` | 熾焰火灶靈 | `asset_cr_fire_wisp_<stage>` | `cr-20261114-cr_fire_wisp` | `creatures/wiki/cr_fire_wisp_<stage>_wiki.md` |
| `cr_frostblade_penguin` | 冰刀企鵝 | `asset_cr_frostblade_penguin_<stage>` | `cr-20261114-cr_frostblade_penguin` | `creatures/wiki/cr_frostblade_penguin_<stage>_wiki.md` |
| `cr_ice_snowman` | 霜魄冰晶雪人 | `asset_cr_ice_snowman_<stage>` | `cr-20261114-cr_ice_snowman` | `creatures/wiki/cr_ice_snowman_<stage>_wiki.md` |
| `cr_ink_stele` | 墨影碑帖 | `asset_cr_ink_stele_<stage>` | — | `creatures/wiki/cr_ink_stele_<stage>_wiki.md` |
| `cr_light_khepri` | 阿頓曦光聖甲蟲 | `asset_cr_light_khepri_<stage>` | — | `creatures/wiki/cr_light_khepri_<stage>_wiki.md` |
| `cr_metal_vault` | 模組折疊集裝機兵 | `asset_cr_metal_vault_<stage>` | — | `creatures/wiki/cr_metal_vault_<stage>_wiki.md` |
| `cr_shadow_eye` | 幽影虛空瞳 | `asset_cr_shadow_eye_<stage>` | — | `creatures/wiki/cr_shadow_eye_<stage>_wiki.md` |
| `cr_solmane_lion` | 火鬃聖獅 | `asset_cr_solmane_lion_<stage>` | — | `creatures/wiki/cr_solmane_lion_<stage>_wiki.md` |
| `cr_thunder_drone` | 超導電容巡航無人機 | `asset_cr_thunder_drone_<stage>` | — | `creatures/wiki/cr_thunder_drone_<stage>_wiki.md` |
| `cr_verdant_aquila` | 葉冠鷲 | `asset_cr_verdant_aquila_<stage>` | — | `creatures/wiki/cr_verdant_aquila_<stage>_wiki.md` |
| `cr_wind_bird` | 氣旋羽雲雀 | `asset_cr_wind_bird_<stage>` | — | `creatures/wiki/cr_wind_bird_<stage>_wiki.md` |
| `cr_wood_puppet` | 機巧靈木偶 | `asset_cr_wood_puppet_<stage>` | — | `creatures/wiki/cr_wood_puppet_<stage>_wiki.md` |

> 另含歷史測試批次：`cr-20261111-a111-1200`（`mdl-20261111-a111-1300~1303`）、`cr-20261111-b111-1200`（`mdl-20261111-b111-1300~1303`）、`cr-20261111-c111-1200`（`mdl-20261111-c111-1300~1303`）。

### 4.2 設計線與草案宙獸（`designed.js` / `Data/_incoming/`）

| Line ID | 演化線中文名稱 | 屬性 | 型態 ID（`juvenile` → `adolescent` → `adult`） | 中文／英文名稱 |
| :--- | :--- | :--- | :--- | :--- |
| `starter_sun_line` | 鏡環天鷺 | `light` | `sun_mirror_chick` → `sun_heliostat_heron` → `sun_array_skyheron` | 鏡環天鷺 |
| `starter_moon_line` | 夜痕霜狼 | `shadow` | `moon_night_pup` → `moon_shade_wolf` → `moon_longnight_wolf` | 夜痕霜狼 |
| `starter_star_line` | 星蹄天驥 | `thunder` | `star_blaze_foal` → `star_storm_colt` → `star_skyhoof_steed` | 星蹄天驥 |
| `line_metal_gearclock` | 漏輪巨象 | `metal` | `metal_clock_chick` → `metal_gear_strider` → `metal_chronos_engine` | 漏輪巨象 |
| `line_wood_vinecrest` | 蔓冠虹禽 | `wood` | `wood_fern_chick` → `wood_plume_peafowl` → `wood_canopy_regent` | 蔓冠虹禽 |
| `line_water_tidecraft` | 潮帆巨鰻 | `water` | `water_wave_elver` → `water_skiff_eel` → `water_catamaran_serpent` | 潮帆巨鰻 |
| `line_fire_blazelion` | 焰角羱羊 | `fire` | `fire_ember_cub` → `fire_mane_stalker` → `fire_pyre_monarch` | 焰角羱羊 |
| `line_earth_gildedgolem` | 金甲犰狳 | `earth` | `earth_pebble_pawn` → `earth_gilded_warden` → `earth_auric_sovereign` | 金甲犰狳 |
| `line_ice_frostbeast` | 霜角巨獸 | `ice` | `ice_frost_fledgling` → `ice_rime_strider` → `ice_tundra_dreadnought` | 霜角巨獸 |
| `line_wind_fluteglider` | 笛風天舟 | `wind` | `wind_reed_skiff` → `wind_flute_cruiser` → `wind_monsoon_galeon` | 笛風天舟 |
| `line_metal_citadelbull` | — | `metal` | `metal_gate_calf` → `metal_winged_bull` → `metal_citadel_colossus` | — |
| `line_wood_crownvine` | — | `wood` | `wood_betel_sprout` → `wood_garland_serpent` → `wood_lotus_wyrm` | — |
| `line_water_whalemaelstrom` | — | `water` | `water_ivory_calf` → `water_harpoon_cetacean` → `water_abyssal_leviathan` | — |
| `line_fire_baobabhearth` | — | `fire` | `fire_spark_barkling` → `fire_ember_crocodilian` → `fire_hearth_monolith` | — |
| `line_earth_pillarbeast` | — | `earth` | `earth_lotus_cub` → `earth_pillar_chimera` → `earth_temple_tuskbeast` | — |
| `line_ice_driftvessel` | — | `ice` | `ice_sled_buoy` → `ice_hull_cutter` → `ice_polar_icebreaker` | — |
| `line_wind_mistwing` | — | `wind` | `wind_crossbow_fledgling` → `wind_bergglider_gull` → `wind_pelagic_soarer` | — |
| `line_thunder_redburrower` | — | `thunder` | `thunder_dune_larva` → `thunder_crimson_crawler` → `thunder_gobi_voltwyrm` | — |
| `line_light_foilprism` | — | `light` | `light_foil_spark` → `light_orbit_beacon` → `light_radiant_cyclotron` | — |
| `line_shadow_ironsteed` | — | `shadow` | `shadow_tundra_foal` → `shadow_reverb_charger` → `shadow_iron_cavalier` | — |

## 5. 主動技（Moves）名稱與 ID 對照

主動技 VFX 資產存放於 `moves/01_vfx/<asset_id>/`，圖鑑存放於 `moves/wiki/<move_id>_wiki.md`。

| Move ID | 屬性 | 類型 | 形態 | 中文名稱 | 英文名稱 | 來源批次 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `earth_boulder_roll` | `earth` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `earth_dust_cloud` | `earth` | `damage` | `sweep` | — | — | `p5-05-moves-draft-03` |
| `earth_fault_dash` | `earth` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `earth_flint_thrust` | `earth` | `damage` | `front` | — | — | `p5-05-moves-draft-04` |
| `earth_granite_stance` | `earth` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `earth_lithic_plating` | `earth` | `effect` | `self` | — | — | `p5-05-moves-draft-06` |
| `earth_mineral_communion` | `earth` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `earth_monolith_quarry` | `earth` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `earth_mud_sling` | `earth` | `damage` | `cone` | — | — | `p5-05-moves-draft-02` |
| `earth_pebble_shot` | `earth` | `damage` | `line` | 礫紋彈 | Pebblegrain Shot | `p5-05-moves-draft-01` |
| `earth_quicksand_sink` | `earth` | `both` | `field` | — | — | `p5-05-moves-draft-06` |
| `earth_rampart_rush` | `earth` | `damage` | `line` | 岩壘馳 | Rampartborne Rush | `p5-05-moves-draft-01` |
| `earth_sand_sweep` | `earth` | `damage` | `cone` | — | — | `p5-05-moves-draft-01` |
| `earth_scree_spray` | `earth` | `damage` | `cone` | — | — | `p5-05-moves-draft-04` |
| `earth_seismic_slam` | `earth` | `damage` | `burst` | 地脈震 | Faultpulse Slam | `p5-05-moves-draft-01` |
| `earth_stalagmite_field` | `earth` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `earth_stone_skate` | `earth` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `earth_tectonic_lance` | `earth` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `earth_tremor_ring` | `earth` | `damage` | `burst` | — | — | `p5-05-moves-draft-04` |
| `earth_tremor_stomp` | `earth` | `both` | `burst` | — | — | `p5-05-moves-draft-05` |
| `fire_ash_fan` | `fire` | `damage` | `cone` | — | — | `p5-05-moves-draft-03` |
| `fire_blaze_charge` | `fire` | `damage` | `line` | 焰鬃突 | Blazemane Drive | `p5-05-moves-draft-01` |
| `fire_caldera_burst` | `fire` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `fire_cinder_slash` | `fire` | `both` | `sweep` | — | — | `p5-05-moves-draft-05` |
| `fire_cinder_slide` | `fire` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `fire_ember_carpet` | `fire` | `damage` | `field` | — | — | `p5-05-moves-draft-06` |
| `fire_ember_lash` | `fire` | `damage` | `sweep` | 燼尾掃 | Embertail Sweep | `p5-05-moves-draft-01` |
| `fire_flare_nova` | `fire` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `fire_furnace_vent` | `fire` | `damage` | `burst` | — | — | `p5-05-moves-draft-04` |
| `fire_inferno_cataclysm` | `fire` | `damage` | `burst` | 熾墜界 | Pyrefall Expanse | `p5-05-moves-draft-01` |
| `fire_kindle_ward` | `fire` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `fire_magma_wave` | `fire` | `damage` | `sweep` | — | — | `p5-05-moves-draft-02` |
| `fire_meteor_rush` | `fire` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `fire_pyre_lunge` | `fire` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `fire_pyroclast_sweep` | `fire` | `damage` | `cone` | — | — | `p5-05-moves-draft-04` |
| `fire_scorch_beam` | `fire` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `fire_searing_ray` | `fire` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `fire_slag_rake` | `fire` | `both` | `sweep` | — | — | `p5-05-moves-draft-06` |
| `fire_spark_jab` | `fire` | `damage` | `front` | — | — | `p5-05-moves-draft-02` |
| `fire_thermal_sprint` | `fire` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `ice_avalanche_charge` | `ice` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `ice_blizzard_vortex` | `ice` | `damage` | `burst` | 雪渦綻 | Snowwhorl Bloom | `p5-05-moves-draft-01` |
| `ice_brittle_strike` | `ice` | `both` | `front` | — | — | `p5-05-moves-draft-05` |
| `ice_claw_cleave` | `ice` | `damage` | `sweep` | — | — | `p5-05-moves-draft-03` |
| `ice_floe_crash` | `ice` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `ice_frigid_breath` | `ice` | `both` | `cone` | — | — | `p5-05-moves-draft-06` |
| `ice_frost_tap` | `ice` | `damage` | `front` | — | — | `p5-05-moves-draft-02` |
| `ice_frostfall_impact` | `ice` | `damage` | `burst` | — | — | `p5-05-moves-draft-04` |
| `ice_glacial_mirror` | `ice` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `ice_glacier_lance` | `ice` | `damage` | `line` | 冰川矛 | Glaciergrain Lance | `p5-05-moves-draft-01` |
| `ice_glaze_slide` | `ice` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `ice_hail_burst` | `ice` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `ice_hoarfrost_ray` | `ice` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `ice_icicle_beam` | `ice` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `ice_numbing_haze` | `ice` | `effect` | `cone` | — | — | `p5-05-moves-draft-05` |
| `ice_permafrost_surge` | `ice` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `ice_polar_sweep` | `ice` | `damage` | `cone` | — | — | `p5-05-moves-draft-02` |
| `ice_rime_skate` | `ice` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `ice_shard_flurry` | `ice` | `damage` | `cone` | 霜晶扇 | Rimeglass Fan | `p5-05-moves-draft-01` |
| `ice_tundra_expanse` | `ice` | `damage` | `field` | — | — | `p5-05-moves-draft-06` |
| `light_aurora_drift` | `light` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `light_beacon_lunge` | `light` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `light_chromatic_fan` | `light` | `damage` | `cone` | — | — | `p5-05-moves-draft-04` |
| `light_corona_sweep` | `light` | `damage` | `cone` | — | — | `p5-05-moves-draft-02` |
| `light_crown_radiance` | `light` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `light_dawn_flash` | `light` | `damage` | `burst` | — | — | `p5-05-moves-draft-01` |
| `light_dazzling_crescent` | `light` | `both` | `sweep` | — | — | `p5-05-moves-draft-05` |
| `light_glint_jab` | `light` | `damage` | `front` | — | — | `p5-05-moves-draft-02` |
| `light_halo_burst` | `light` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `light_harmonic_cadence` | `light` | `effect` | `self` | — | — | `p5-05-moves-draft-06` |
| `light_heliostat_beam` | `light` | `damage` | `line` | 追日光束 | Suntrack Beam | `p2-08-starters-draft-01` |
| `light_luminous_glide` | `light` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `light_mirror_glint` | `light` | `both` | `line` | 鏡閃 | Mirrorflash | `p2-08-starters-draft-01` |
| `light_optic_lance` | `light` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `light_photon_flash` | `light` | `damage` | `sweep` | — | — | `p5-05-moves-draft-03` |
| `light_prism_beam` | `light` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `light_prismatic_exposure` | `light` | `effect` | `field` | — | — | `p5-05-moves-draft-06` |
| `light_radiant_benediction` | `light` | `effect` | `ally` | — | — | `p5-05-moves-draft-05` |
| `light_radiant_step` | `light` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `light_solar_array_lance` | `light` | `both` | `line` | 日環光槍 | Solar Array Lance | `p2-08-starters-draft-01` |
| `light_solar_burst` | `light` | `damage` | `cone` | — | — | `p5-05-moves-draft-01` |
| `light_stellar_nova` | `light` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `light_zenith_lance` | `light` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `metal_alloy_polish` | `metal` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `metal_anvil_drop` | `metal` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `metal_blade_rush` | `metal` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `metal_caltrop_zone` | `metal` | `damage` | `field` | — | — | `p5-05-moves-draft-06` |
| `metal_corrosion_edge` | `metal` | `both` | `front` | — | — | `p5-05-moves-draft-06` |
| `metal_drill_drive` | `metal` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `metal_ferro_temper` | `metal` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `metal_flechette_beam` | `metal` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `metal_iron_cleave` | `metal` | `damage` | `sweep` | 鐵輪斬 | Ironwheel Cleave | `p5-05-moves-draft-01` |
| `metal_lance_charge` | `metal` | `damage` | `line` | 鉚槍馳 | Rivetlance Rush | `p5-05-moves-draft-01` |
| `metal_magnet_strike` | `metal` | `both` | `front` | — | — | `p5-05-moves-draft-05` |
| `metal_mercury_drift` | `metal` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `metal_needle_thrust` | `metal` | `damage` | `front` | 針輪刺 | Needlewheel Thrust | `p5-05-moves-draft-01` |
| `metal_rail_slug` | `metal` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `metal_razor_spin` | `metal` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `metal_scrap_barrage` | `metal` | `damage` | `burst` | — | — | `p5-05-moves-draft-01` |
| `metal_shard_volley` | `metal` | `damage` | `cone` | — | — | `p5-05-moves-draft-03` |
| `metal_shrapnel_spray` | `metal` | `damage` | `cone` | — | — | `p5-05-moves-draft-02` |
| `metal_siege_bombard` | `metal` | `damage` | `burst` | — | — | `p5-05-moves-draft-04` |
| `metal_tungsten_pierce` | `metal` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `shadow_abyss_ray` | `shadow` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `shadow_abyssal_shroud` | `shadow` | `damage` | `cone` | — | — | `p5-05-moves-draft-03` |
| `shadow_dusk_fang` | `shadow` | `damage` | `front` | — | — | `p5-05-moves-draft-03` |
| `shadow_eclipse_collapse` | `shadow` | `damage` | `burst` | — | — | `p5-05-moves-draft-01` |
| `shadow_enervating_mire` | `shadow` | `effect` | `burst` | — | — | `p5-05-moves-draft-05` |
| `shadow_entropy_wave` | `shadow` | `damage` | `cone` | — | — | `p5-05-moves-draft-04` |
| `shadow_gloom_pulse` | `shadow` | `damage` | `burst` | — | — | `p5-05-moves-draft-04` |
| `shadow_lone_hunter_ambush` | `shadow` | `both` | `line` | 孤影伏襲 | Loneshade Ambush | `p2-08-starters-draft-01` |
| `shadow_longnight_lunge` | `shadow` | `damage` | `line` | 長夜突 | Longnight Lunge | `p2-08-starters-draft-01` |
| `shadow_nightmare_cleave` | `shadow` | `damage` | `sweep` | — | — | `p5-05-moves-draft-02` |
| `shadow_nightpaw_swipe` | `shadow` | `both` | `front` | 夜爪擊 | Nightpaw Strike | `p2-08-starters-draft-01` |
| `shadow_penumbra_spike` | `shadow` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `shadow_pitch_lob` | `shadow` | `both` | `arc` | — | — | `p5-05-moves-draft-06` |
| `shadow_shade_dart` | `shadow` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `shadow_singularity_maw` | `shadow` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `shadow_stygian_pit` | `shadow` | `both` | `field` | — | — | `p5-05-moves-draft-06` |
| `shadow_twilight_phase` | `shadow` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `shadow_umbra_curse` | `shadow` | `both` | `arc` | — | — | `p5-05-moves-draft-05` |
| `shadow_umbral_fang` | `shadow` | `damage` | `sweep` | — | — | `p5-05-moves-draft-01` |
| `shadow_veiling_mist` | `shadow` | `effect` | `ally` | — | — | `p5-05-moves-draft-05` |
| `shadow_void_step` | `shadow` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `shadow_void_well` | `shadow` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `shadow_wraith_charge` | `shadow` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `thunder_amplifying_spark` | `thunder` | `effect` | `ally` | — | — | `p5-05-moves-draft-05` |
| `thunder_arc_discharge` | `thunder` | `damage` | `cone` | — | — | `p5-05-moves-draft-01` |
| `thunder_clap_nova` | `thunder` | `damage` | `burst` | — | — | `p5-05-moves-draft-01` |
| `thunder_conductive_grid` | `thunder` | `damage` | `field` | — | — | `p5-05-moves-draft-06` |
| `thunder_draining_bolt` | `thunder` | `both` | `line` | — | — | `p5-05-moves-draft-05` |
| `thunder_dynamo_charge` | `thunder` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `thunder_fork_barrage` | `thunder` | `damage` | `cone` | — | — | `p5-05-moves-draft-03` |
| `thunder_fulgur_dive` | `thunder` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `thunder_galloping_discharge` | `thunder` | `damage` | `burst` | 奔雷散電 | Galloping Discharge | `p2-08-starters-draft-01` |
| `thunder_megavolt_burst` | `thunder` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `thunder_overclock_charge` | `thunder` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `thunder_overload_spray` | `thunder` | `damage` | `cone` | — | — | `p5-05-moves-draft-04` |
| `thunder_piercing_needle` | `thunder` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `thunder_plasma_rail` | `thunder` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `thunder_pulse_ring` | `thunder` | `damage` | `burst` | — | — | `p5-05-moves-draft-04` |
| `thunder_shock_prod` | `thunder` | `damage` | `front` | — | — | `p5-05-moves-draft-03` |
| `thunder_skyhoof_stampede` | `thunder` | `damage` | `line` | 天蹄雷馳 | Skyhoof Stampede | `p2-08-starters-draft-01` |
| `thunder_spark_dash` | `thunder` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `thunder_starblaze_charge` | `thunder` | `damage` | `line` | 星火衝 | Starspark Charge | `p2-08-starters-draft-01` |
| `thunder_static_prick` | `thunder` | `damage` | `sweep` | — | — | `p5-05-moves-draft-02` |
| `thunder_storm_cell` | `thunder` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `thunder_volt_drift` | `thunder` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `thunder_voltage_tracer` | `thunder` | `both` | `line` | — | — | `p5-05-moves-draft-06` |
| `water_brine_spray` | `water` | `damage` | `cone` | — | — | `p5-05-moves-draft-02` |
| `water_bubble_pop` | `water` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `water_cascade_jab` | `water` | `damage` | `front` | — | — | `p5-05-moves-draft-03` |
| `water_crest_slicer` | `water` | `damage` | `line` | 漣刃線 | Rippleedge Ray | `p5-05-moves-draft-01` |
| `water_deluge_crater` | `water` | `damage` | `burst` | 瀾坑爆 | Deluge Hollow | `p5-05-moves-draft-01` |
| `water_depth_charge` | `water` | `damage` | `burst` | — | — | `p5-05-moves-draft-04` |
| `water_drenching_surge` | `water` | `both` | `cone` | — | — | `p5-05-moves-draft-05` |
| `water_flow_state` | `water` | `effect` | `self` | — | — | `p5-05-moves-draft-06` |
| `water_froth_swipe` | `water` | `damage` | `sweep` | — | — | `p5-05-moves-draft-04` |
| `water_geyser_pool` | `water` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `water_healing_spring` | `water` | `effect` | `ally` | — | — | `p5-05-moves-draft-05` |
| `water_hydro_spray` | `water` | `damage` | `cone` | — | — | `p5-05-moves-draft-03` |
| `water_maelstrom_lance` | `water` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `water_rip_current` | `water` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `water_tidal_surge` | `water` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `water_torrent_burst` | `water` | `damage` | `cone` | 湍流扇 | Torrentfan Surge | `p5-05-moves-draft-01` |
| `water_tsunami_charge` | `water` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `water_undertow_rush` | `water` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `water_vapor_veil` | `water` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `water_vortex_basin` | `water` | `both` | `field` | — | — | `p5-05-moves-draft-06` |
| `wind_ballistic_focus` | `wind` | `effect` | `self` | — | — | `p5-05-moves-draft-06` |
| `wind_breeze_gust` | `wind` | `damage` | `cone` | — | — | `p5-05-moves-draft-02` |
| `wind_cyclone_dart` | `wind` | `damage` | `line` | — | — | `p5-05-moves-draft-01` |
| `wind_draft_step` | `wind` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `wind_gale_claw` | `wind` | `damage` | `sweep` | 颯爪掃 | Galepaw Sweep | `p5-05-moves-draft-01` |
| `wind_haste_current` | `wind` | `effect` | `ally` | — | — | `p5-05-moves-draft-05` |
| `wind_hurricane_sweep` | `wind` | `damage` | `cone` | — | — | `p5-05-moves-draft-04` |
| `wind_jetstream_glide` | `wind` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `wind_monsoon_domain` | `wind` | `effect` | `field` | — | — | `p5-05-moves-draft-06` |
| `wind_shear_fan` | `wind` | `damage` | `sweep` | — | — | `p5-05-moves-draft-03` |
| `wind_squall_vortex` | `wind` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `wind_tailwind_boon` | `wind` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `wind_tailwind_dive` | `wind` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `wind_tempest_sphere` | `wind` | `damage` | `burst` | 風球綻 | Stormsphere Bloom | `p5-05-moves-draft-01` |
| `wind_turbulent_arc` | `wind` | `both` | `arc` | — | — | `p5-05-moves-draft-05` |
| `wind_typhoon_spire` | `wind` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `wind_vacuum_blade` | `wind` | `damage` | `line` | 空鳴刃 | Hollowwind Edge | `p5-05-moves-draft-01` |
| `wind_whirlwind_burst` | `wind` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `wind_zephyr_cutter` | `wind` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `wind_zephyr_pierce` | `wind` | `damage` | `front` | — | — | `p5-05-moves-draft-04` |
| `wood_acorn_bombard` | `wood` | `damage` | `cone` | — | — | `p5-05-moves-draft-02` |
| `wood_bamboo_surge` | `wood` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `wood_bramble_whip` | `wood` | `damage` | `sweep` | — | — | `p5-05-moves-draft-03` |
| `wood_briar_dash` | `wood` | `damage` | `line` | 棘芽突 | Briarsprout Dash | `p5-05-moves-draft-01` |
| `wood_canopy_crush` | `wood` | `damage` | `burst` | 翠冠墜 | Verdant Crownfall | `p5-05-moves-draft-01` |
| `wood_pine_salvo` | `wood` | `damage` | `cone` | — | — | `p5-05-moves-draft-04` |
| `wood_pollen_jet` | `wood` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |
| `wood_root_spear` | `wood` | `damage` | `line` | 根紋槍 | Rootgrain Spear | `p5-05-moves-draft-01` |
| `wood_sap_splash` | `wood` | `damage` | `burst` | — | — | `p5-05-moves-draft-02` |
| `wood_splinter_thrust` | `wood` | `damage` | `front` | — | — | `p5-05-moves-draft-04` |
| `wood_spore_scatter` | `wood` | `damage` | `cone` | — | — | `p5-05-moves-draft-01` |
| `wood_sunlight_mend` | `wood` | `effect` | `self` | — | — | `p5-05-moves-draft-05` |
| `wood_tangle_grove` | `wood` | `both` | `field` | — | — | `p5-05-moves-draft-06` |
| `wood_tendril_vault` | `wood` | `damage` | `line` | — | — | `p5-05-moves-draft-04` |
| `wood_thorn_ballista` | `wood` | `damage` | `line` | — | — | `p5-05-moves-draft-02` |
| `wood_thorn_snare` | `wood` | `both` | `line` | — | — | `p5-05-moves-draft-05` |
| `wood_timber_fall` | `wood` | `damage` | `burst` | — | — | `p5-05-moves-draft-03` |
| `wood_verdant_infusion` | `wood` | `effect` | `ally` | — | — | `p5-05-moves-draft-05` |
| `wood_vernal_growth` | `wood` | `effect` | `self` | — | — | `p5-05-moves-draft-06` |
| `wood_vine_lunge` | `wood` | `damage` | `line` | — | — | `p5-05-moves-draft-03` |

## 6. 管線與目錄規範摘要（PR #11 相容規則）

- **不依生物類型新增 Drive 頂層分類資料夾**：六大資產類別與解剖型態寫入各資產的 `profile.json` 與 `manifest.json`。
- **3D 資產包標準子目錄**：`models/<asset_id>.glb`、`.blend`、`manifest.json`、`profile.json`、`typed_state.json`、`rig/rig_report.json`、`animations/animations_manifest.json`、`previews/qa_*.png`、`qa/typed_metrics.json`。
- **Wiki 單一產檔規則**：角色 `characters/wiki/<subject_id>[_<stage>]_wiki.md`、宙獸 `creatures/wiki/<subject_id>_<stage>_wiki.md`、主動技 `moves/wiki/<move_id>_wiki.md`；下游僅關聯路徑，禁止重複產生。
- **歷史資產分類與審查規則**：2026-11-15 已將舊頂層資產移入 `characters/`、`creatures/`、`moves/`，退役空目錄封存於共用 `backup/`，保留每個檔案及資料夾原 Drive ID；資產未經人工核准不得移入 `<kind>/03_completed/`。
