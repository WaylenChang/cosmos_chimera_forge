# AI Agent × Google Colab：日式賽璐璐 3D 資產全自動管線規格

> **版本**：v1.0｜**查核日**：2026-11-11｜**語言**：繁體中文  
> **適用**：人形／NPC、怪物、動物、奇幻生物、機械、機器人  
> **目標**：概念圖或角色設定圖 → 3D 網格 → 骨架／機構 → 動作 → 日系 NPR／Toon → GLB／FBX／VRM（視需求）→ 品質報告  
> **原則**：**Agent 全自動優先、Colab 為控制中心、人工介入為異常分支**；以可追蹤、可續跑、可替換後端的資產生產系統為目標。

## 0. 先看結論：推薦的系統架構

**MVP 主幹：`Tripo API（Image→3D / Rig Check / Rig / Retarget） → Colab Agent → Blender Headless QA／修復 → Toon 設定 → 匯出`。** 當非人形動作不足、角色結構特殊、或需要分離機械零件時，採用類型化分支；不要把所有資產套入同一種軟性蒙皮。

- **API 先行**：批次量產先走 Tripo v3 API。Colab 可使用 CPU runtime 控制非 GPU API，節省本機 GPU 用量；Tripo／Meshy 費用另外計算，**不包含在 Google AI Pro 的 Colab Compute Units 內**。
- **開源備援**：人形／怪物加入 Pixal3D + SkinTokens；動物／奇幻生物加入 AniGen；硬表面機械／機器人加入 PartCrafter。研究模型須**隔離環境**，不要共用一個 pip 安裝環境。
- **動畫分流**：標準人形優先用 Tripo 預設或 Meshy 動畫 API；四足先求正確行走；翼、蛇、觸手、多足及機械的額外動畫使用骨架模板、IK、參數化關節曲線，必要時轉人工修正。
- **風格收尾**：固定日系 Toon 美術規格，不靠模型生成時寫死的陰影。**GLB 不等同 Unity Toon Shader**；Unity 的 Toon 材質須在目標引擎再套用，Colab 只輸出材質設定檔、模型與可選預覽。
- **Human-in-the-loop**：只在自動修復最多兩輪後仍未通過硬門檻、商用授權不明或美術關鍵品質不可接受時才介入。

### 0.1 六類資產的預設路由

| 類別 | 預設建模 | 預設骨架／機構 | 預設動作 | 開源／替代後端 | 自動化成熟度（工程判斷） |
|---|---|---|---|---|---|
| **日系人形／NPC** | Tripo P2（低面數）或 H v3.1（精細） | Tripo Rig v3.0，`biped`，`spec=unity/vrm/mixamo` | `preset:idle/walk/run/jump/...` | Pixal3D → SkinTokens；Meshy 人形 API | **高**（但表情／髮飾需檢查） |
| **怪物** | Tripo P2/H；複雜輪廓可 Pixal3D | 兩足用 v3.0 `biped`；非標準骨架用 `others`／AniGen | 兩足沿用人形；特異肢體用模板動畫 | AniGen、SkinTokens | **中**（特殊身形易漏骨） |
| **動物** | Tripo P2/H | Rig v2.5／v3.0，依 `quadruped/avian/aquatic` | 四足官方有 `preset:quadruped:walk`；其餘靠專用動作／程序化 | AniGen | **中**（不同物種動作差異大） |
| **奇幻生物** | Tripo 多視角／Pixal3D 多視角 | `others` + 解剖骨架模板，或 AniGen | 翅膀、尾巴、蛇身、多足的程序化動畫 | AniGen、SkinTokens + 自訂骨架 | **中低**（形體依賴高） |
| **機械**（道具／載具／機構） | Tripo 靜態模型或 PartCrafter 分件 | **Rigid part hierarchy／旋轉平移軸**，不使用皮膚式變形 | 關節曲線、活塞、艙門、輪轉 | PartCrafter／Blender 程序化 | **中**（零件辨識較易，機構關係較難） |
| **機器人／機甲** | Tripo／PartCrafter | 人形骨架驅動**剛性裝甲**；非人形用零件式機構 | 人形動作 + 關節約束；變形結構另建狀態機 | PartCrafter + 機械 IK | **中低**（裝甲穿插、軸心難全自動） |

> **判讀說明**：上表「高／中／中低」是建置優先級，不是官方 Benchmark；生物自動 Rig／蒙皮不等於自動得到該物種全部動畫。Tripo v3.0 官方列出人形 11 種新預設，非人形列出的現成預設較少，未列入的動作不得假設有 API 支援。[S1–S4]

---

## 1. 端到端 Agent 工作流

```text
[圖片 / 多視角圖 / 角色 brief / 動作需求]
        |
        v
 N00 Ingest & Cache  ──> 版權/授權/圖片品質檢查
        |
 N01 Visual Planner  ──> 類型、肢體數、硬／軟表面、預算、目標引擎
        |
 N02 Route Selector ──> Tripo API  |  Pixal3D  |  AniGen  |  PartCrafter
        |
 N03 Mesh QA & Repair ──> 尺寸、法線、面數、材質、UV、破洞/零件
        |
 N04 Rig Decision ────> 生物：Tripo / SkinTokens / AniGen
        |                 機械：Part-Hierarchy + Pivot + Joint Constraints
        v
 N05 Motion Planner ──> API preset / 動作庫 retarget / 程序化 IK
        |
 N06 Headless Blender ─> pose sweep / 渲染預覽 / 碰撞與權重測試
        |
 N07 Toon Formatter ──> Palette + shadow bands + outline/profile metadata
        |
 N08 Export & QA ─────> GLB / FBX / VRM(選配) / JSON / 轉台圖 / 影片
        |
  PASS → publish                 FAIL → retry/fallback → REVIEW_REQUIRED
```

**必要的狀態機**：`QUEUED → RUNNING → QA_PENDING → PASSED / RETRY / FALLBACK / REVIEW_REQUIRED / FAILED`。每個節點落盤 `manifest.json`、原始輸入、模型版本、task ID、時間、費用、VRAM、品質報告；重啟只接續未完成節點，**不重跑成功且內容雜湊不變的步驟**。

### 1.1 Agent 職責切分

| Agent | 輸入 | 輸出 | 可以自主處理 | 轉人工條件 |
|---|---|---|---|---|
| **Planner** | 原圖、角色 brief | `asset_spec.json`、路由 | 辨識人形、獸形、多足、機械、所需動作 | 分類歧義且會導致錯誤 Rig |
| **Generator** | 規格、模型清單 | 靜態 3D | 選 Tripo P/H、重生成、改用 Pixal3D/AniGen | 重試後仍缺核心肢體 |
| **Rigger** | GLB、解剖模板 | Rigged GLB、骨架映射 | Rig Check、換 Rig type、SkinTokens 或剛體分件 | 關節層級不合理且無法修補 |
| **Animator** | Rig、動作目錄 | Clips、controller metadata | 套預設、IK、機械關節曲線、循環修補 | 沒有可合法使用的動作來源／無法達成動作 |
| **QA／Stylist** | 資產與 clips | 測試報告、Toon profile | 自動檢驗、縮面、校正比例、出預覽 | 嚴重變形、表情失真、商業授權問題 |

---

## 2. Colab 專案結構與 Notebook 分工

### 2.1 建議 Google Drive 目錄

```text
MyDrive/Anime3D_Agent/
├── notebooks/
│   ├── 00_bootstrap.ipynb            # Secrets、依賴與硬體檢查
│   ├── 01_ingest_plan.ipynb          # 圖片、asset_spec、分類與路由
│   ├── 02_tripo_api.ipynb            # 官方 API 建模 / rig check / rig
│   ├── 03_open_models.ipynb          # Pixal3D、SkinTokens、AniGen、PartCrafter 的獨立執行入口
│   ├── 04_motion.ipynb               # Preset、retarget、程序化動畫
│   ├── 05_blender_qa.ipynb           # Headless Blender 驗證與預覽
│   ├── 06_toon_export.ipynb          # Toon profile、貼圖／輸出
│   └── 07_batch_runner.ipynb         # 工作佇列、續跑、報表
├── configs/
│   ├── routing.yaml
│   ├── skeleton_templates/
│   ├── motion_library.json
│   └── toon_profiles/
├── scripts/                         # Python Adapter / Blender -b scripts
├── inputs/<asset_id>/                # source.png、views/、brief.json
├── cache/                            # 依 hash 存推論結果；模型 checkpoint 不建議重複下載
├── jobs/<asset_id>/
│   ├── manifest.json
│   ├── mesh/source.glb
│   ├── rig/rigged.glb
│   ├── anim/*.glb
│   ├── renders/turntable/*.png
│   ├── qa/metrics.json
│   ├── qa/report.html
│   └── logs/*.jsonl
└── exports/<asset_id>/
    ├── character.glb
    ├── character.fbx                   # 需要時才產生
    ├── material_profile.json
    ├── animations_manifest.json
    └── preview.mp4
```

**注意**：以上 `.ipynb` 與 `scripts/` 是**待建立的建議模組**，不是已隨本文件提供的可執行 Notebook。本文件提供建置規格與可改寫的 API 範例，不宣稱整套工作流已完成 Colab 整合實測。

### 2.2 執行環境建議

1. **`00_bootstrap`（CPU 也能用）**：掛載 Drive → 從 Colab Secrets 取得 `TRIPO_API_KEY`／其他金鑰 → 檢查 `nvidia-smi` → 建立目錄 → 載入 `routing.yaml` → 做 API 連線及剩餘額度測試。
2. **`01_ingest_plan`**：圖檔校驗（PNG/JPEG/WebP、可見完整肢體、無過大遮擋）、去背、朝向判斷；必要時由 VLM 產生 `asset_spec`。若原圖僅正面且角色有翅膀／尾巴，標註 `multiview_recommended=true`。
3. **`02_tripo_api`（主要推薦）**：用原圖的 `file_token` 或授權 URL 呼叫 `POST /v3/generation/image-to-model`；輪詢 `GET /v3/tasks/{id}`；有骨架需求才做 `POST /v3/animations/rig-check` → `POST /v3/animations/rig`。**不要跳過 rig-check，也不要把 rig 的預設模型誤當最新版**。[S1–S3]
4. **`03_open_models`（高成本備援）**：單一 Notebook 只管理調度；每套研究模型在自己可重建的專用環境執行，完成後寫出統一 GLB。不同 Torch／CUDA 不共用執行環境。
5. **`04_motion`**：查詢骨架拓撲，選合法的動作來源；能用 Tripo preset 就呼叫 `POST /v3/animations/retarget`，其他使用經過授權的動作庫或程式生成。
6. **`05_blender_qa`**：Colab 以 `blender -b --python scripts/qa_asset.py -- <args>` 無介面處理；輸出面數、材質、骨骼、權重及 pose sweep。**無 GPU 或 Eevee 無法渲染時，幾何／骨架 QA 仍可跑，渲染改為降級模式。**
7. **`06_toon_export`**：套用日系色票，輸出 toon 材質規格與 Blender 預覽；輸出 GLB／FBX；Unity Toon Shader 在 Unity 專案由 importer 套用，**非 GLB 的標準內建特性**。
8. **`07_batch_runner`**：根據 `manifest.json` 狀態逐項執行，限制最大重試數、每日供應商 API 額度、每作業的 GPU 預算，生成 Batch Summary。

### 2.3 `asset_spec.json`：所有 Agent 的共用介面

```json
{
  "asset_id": "dragon_001",
  "source_image": "inputs/dragon_001/source.png",
  "asset_class": "fantasy_creature",
  "anatomy": "quadruped_with_wings",
  "limbs": {"legs": 4, "arms": 0, "wings": 2, "tails": 1},
  "surface_mode": "organic",
  "priority": "animation_ready",
  "target_engine": "unity",
  "toon_profile": "anime_cel_2band",
  "requested_clips": ["idle", "walk", "fly", "attack"],
  "poly_budget_triangles": 35000,
  "texture_budget": 2048,
  "prefer_api": true,
  "max_auto_retries": 2,
  "manual_review_only_on_failure": true,
  "license_status": "unverified"
}
```

**數值為示例**：35,000 triangles、2,048 px 不代表所有平台標準；依行動裝置、桌面或影片用途另調。`license_status=unverified` 應阻止**商用發佈**，但不一定阻止純內部 POC。

---

## 3. 各類資產的 Colab 管線細節

### A. 人形／NPC：日系動漫角色、村民、戰鬥角色

**預設（API 主幹）**

1. `01`：VLM 確認 `biped`、完整手腳、標準 A/T pose 趨勢；如需多角色一致性，固定風格 prompt、seed、色票與衣飾規範。
2. `02`：以 **Tripo P2-20260801**（低面數、遊戲用）為首輪；英雄／特寫可改 **H v3.1-20260211**，保留 texture／UV，必要時 retopo 後再 Rig。[S1]
3. `02`：Rig Check 通過後，呼叫 `model=v3.0-20260909`, `rig_type=biped`, `spec=unity`（Unity）或 `spec=vrm`（VRM）或 `mixamo`（對應動作庫）。[S2]
4. `04`：優先呼叫人形預設 `preset:idle`, `preset:walk`, `preset:run`, `preset:jump`, `preset:slash`, `preset:shoot`；另外建立合法動作庫的骨架映射。[S3]
5. `05`：檢查肩、肘、膝、髖、裙襬／長髮與道具穿插；臉部表情需另用 Shape Keys 或表情控制，不可由 Auto Rig 推定已存在。
6. `06`：按角色團隊色票轉成 toon profile，匯出多段 animation clips。

**備援**：Pixal3D（`--low_vram` 或多視角）→ SkinTokens（`--use_transfer`）→ Blender；API 若需文字動作，可研究 Meshy 人形 Text-to-Motion／Animations，但不應假設支援非人形。[S5–S8]

**人工例外**：臉型嚴重跑版、衣物穿模、髮飾骨架錯位、表情需求屬主角等級。

### B. 怪物：獸人、哥布林、惡魔、多臂怪、異形

**先分類，不可直接把所有怪物標成 biped。**

1. `01`：辨識兩足／四足／多臂／無腿／觸手，記錄是否保留武器、尾巴、翅膀與角。
2. `02`：建模先用 Tripo H/P；強烈特殊剪影時，改用 Pixal3D 多視角以檢查輪廓。
3. `02/03`：**標準兩手兩腳**：Tripo Rig v3.0 `biped`；**多臂、異形**：Rig v3.0 `others` 或 AniGen，經骨架模板檢查；不能把 `others` 視為保證能產生正確動作。
4. `04`：兩足使用人形 walk/attack/hurt；異形採骨鏈控制、觸手波、尾巴擺動、程序化攻擊。
5. `05`：檢查多餘手臂是否對上不同骨鏈、武器握點、尾部彎曲、角與肩部穿模。
6. `06`：高對比陰影與粗線條維持怪物辨識度。

**備援**：AniGen 直接 Image → rigged mesh；有手動定義好骨架時可試 SkinTokens `--use_skeleton --use_transfer`。[S6–S7]

**人工例外**：核心肢體缺失、骨骼階層錯誤、3D 形體與概念圖不符。

### C. 動物：貓犬狼馬、鳥、魚等

1. `01`：標記 `quadruped`、`avian`、`aquatic`；不可把鳥的翅膀等同於兩隻前腳。
2. `02`：Tripo P/H 生成；Rig Check 建議類型；用 `model=v2.5-20260210` 或 `v3.0-20260909` 與明確的 `rig_type`。[S2]
3. `04`：四足可先用 **`preset:quadruped:walk`** 交出最低可用版本；獵犬奔跑、貓躍、馬步態、鳥拍翼／魚游動由模板曲線和 IK 補完。**官方未列出的預設不要自行捏造。**[S3]
4. `05`：趾尖／蹄子接地、髖肩方向、脊椎起伏、頭尾擺動；對貓／馬不能只縮放同一種步態就算完成。
5. `06`：固定 stylized base color、眼睛高光規則、背腹色塊邊界。

**備援**：AniGen（Image → coherent mesh/skeleton/skin）→ 四足／鳥模板，適合骨架更重要的任務。[S7]

**人工例外**：前後腳反關節、腿數錯誤、鳥翼骨鏈缺失、某物種重要動作無可用模板。

### D. 奇幻生物：巨龍、翼獸、蛇形魔獸、昆蟲、奇美拉

1. `01`：產生解剖描述，例如 `4 legs + 2 wings + 1 tail`；將「翅膀」與「前肢」分開標記；若單張圖背面不明，建議先完成一致多視角條件圖。
2. `02/03`：Tripo 多視角或 Pixal3D `inference_mv.py`；若骨架一致性優先，可直接試 AniGen。[S5,S7]
3. `02/03`：Tripo rig-check；若拓撲無法完整表達，選 `others` + 模板骨架或直接切換 AniGen。不要假定 `others` 有通用飛行／攻擊動作預設。
4. `04`：模組化動作：腿部 gait、翅膀 key pose／拍翼頻率、尾巴 spline wave、蛇身曲線、頭／頸 IK，按解剖類型組合。
5. `05`：至少掃描 `rest / 30% / 60% / 90%` 翅膀展開、尾巴轉彎、落地、攻擊四種關鍵姿勢；檢查翅膀根部是否裂開、腿與翼是否錯綁。
6. `06`：用輪廓分層與 cel color ramp 提高複雜形體辨識度。

**備援**：Pixal3D → SkinTokens `--use_transfer`；非人形 Rig 成功後仍須自行提供動作模板。[S5–S7]

**人工例外**：飛行動作必須符合特定設定、四足＋雙翼解剖不能自動對應、奇美拉多頭控制失敗。

### E. 機械：武器、載具、艙門、齒輪、炮塔、可動機構

> **核心原則**：分件、樞紐、旋轉軸、平移軸及約束；**不使用生物式軟性蒙皮作為預設**。

1. `01`：由 VLM 標註可動／固定零件及自由度，如 `door:hinge`, `piston:slider`, `wheel:rotation`。
2. `02/03`：靜態機械用 Tripo P/H；可動機械走 **PartCrafter**，輸出分離零件。`--part_suggest` 可用 VLM 建議分件數，但數量≠真實機構分解。[S9]
3. `05`：Blender 以零件幾何中心、估計關節樞紐、父子關係建立 Rigid Hierarchy；添加 rotation/translation limits。
4. `04`：由 deterministic animation template 生成艙門開合、車輪轉動、炮塔旋轉、活塞伸縮、反覆運動循環。
5. `05`：檢查零件相對位置、最小間距、軸向、穿透、樞紐不穩定或不合理彎曲。
6. `06`：使用硬邊法線、裝甲分色、深色縫線與有限陰影色階。

**備援**：Tripo Mesh Segmentation／Blender mesh islands 分割（需驗證語義），再由 Agent 補零件階層。**PartCrafter 分件本身不會自動提供工程上正確的關節運動學**。

**人工例外**：機構運動互鎖、可動軸心未知、零件穿模或特殊可變形機關。

### F. 機器人／機甲：人形戰鬥機器人、四足機器人、巨型機甲

1. `01`：判斷 `humanoid_robot`、`quadruped_robot`、`multi_leg_mecha`、`transforming_mecha`，並列出裝甲、關節、武器與驅動器。
2. `02/03`：Tripo 或 PartCrafter 建模；對裝甲／肢體切件，保留硬表面輪廓。
3. `05`：**人形機甲採 Humanoid 運動控制骨架 + 裝甲零件剛性附著**；軟質管線／布料等少數部位才使用蒙皮。非人形機器人採專用機構鏈與 IK。
4. `04`：人形 walk/run/attack 動作映射到主控制骨架，之後用軸向約束修補裝甲行為；履帶、輪足、四足機甲用機械 gait 模板。
5. `05`：驗證肩／髖裝甲相互穿插、肘膝轉動方向、關節角上限、腳底落地與重心。
6. `06`：輸出硬邊 toon 法線、metal accent 色票與輪廓層。若需變形（飛機↔機器人），另建立具體機構狀態圖，不保證純 Image-to-3D 自動完成。

**備援**：PartCrafter 分件 → Blender 關節建構；人形型可用 Tripo `biped` 輔助找到主骨架，再**替換錯誤的軟蒙皮為剛體配屬**。

**人工例外**：裝甲難切分、零件自穿透、高複雜度變形機甲。

---

## 4. 動畫路由表：分清「官方現成」與「要自行補」

| 拓撲 | 可直接使用的 Tripo v3/v2.5 API 預設（官方列出） | 其他需建置的動作 | 自動生成策略 |
|---|---|---|---|
| `biped` v3.0 | `idle`, `walk`, `run`, `dive`, `climb`, `jump`, `slash`, `shoot`, `hurt`, `fall`, `turn`（前綴 `preset:`） | 表演、技能連招、面部表情、布料次級動畫 | API preset + 動作重定向 + pose sweep |
| `quadruped` | `preset:quadruped:walk` | trot、gallop、pounce、sit | gait cycles + leg IK + head/tail |
| `hexapod` | `preset:hexapod:walk` | 爬牆、攻擊、跳躍 | tripod gait + leg IK |
| `octopod` | `preset:octopod:walk` | 攀爬、抓取、攻擊 | wave gait + IK |
| `serpentine` | `preset:serpentine:march` | 盤繞、咬擊、游泳 | spline IK + phase offsets |
| `aquatic` | `preset:aquatic:march` | 迴轉、上浮下沉、攻擊 | spine wave + fin joints |
| `avian`／`others` | **目前文件未提供對應普適 preset 清單** | 翼拍、滑翔、落地、特殊混合肢體 | 專用動作模板；無模板才轉人工 |
| 硬質機械零件 | 非此 API 的預設對象 | 齒輪／樞紐／車輪／活塞／艙門 | Blender Constraint + deterministic animation |

**重要**：Tripo Retarget 的 `animation`（單一）與 `animations`（陣列，最多 5 個）互斥。新建管線不要傳已廢棄且被忽略的 `bake_animation`。`spec` 的命名慣例只對 `biped` 有效。[S3]

若改採 **Meshy**：其 Rigging API 官方主要適合標準人形；其 Animations API 支援單一／多個 preset `action_id(s)`，或由其 Text-to-Motion 產生的 `motion_task_id`，後者限 biped。**不能用這點推論 Meshy API 已全面支援所有動物或奇幻生物。**[S10,S11]

---

## 5. Colab GPU、費用及環境分配

| 後端 | 官方基本需求 | Colab 選擇（工程建議） | 工作類型 | 風險 |
|---|---|---|---|---|
| Tripo／Meshy API | Colab 端無需生成 GPU | **CPU** 即可呼叫／輪詢 | 建模、Rig、動作 API | 外部點數費／網路／任務逾時 |
| PartCrafter | NVIDIA CUDA **≥8 GB VRAM** | T4 16GB 起；調整分件／token | 機械分件 | 複雜度高、VLM 分件數≠關節 |
| SkinTokens | NVIDIA GPU **≥14 GB** | T4 16GB 起嘗試 | 自動骨架與蒙皮 | CUDA／flash-attn、輸出品質 |
| AniGen | NVIDIA GPU **≥18 GB** | L4 24GB 起；A100 較穩 | 自帶 Rig 的生成 | 官方主要驗證 A800／RTX3090，Colab 相容性未保證 |
| TRELLIS.2 | NVIDIA GPU **≥24 GB** | A100 40GB 較穩 | 高細節 3D | 24GB 只是最低需求，L4 可能 OOM |
| Pixal3D | 官方提供 `--low_vram`（預設 1024） | T4 可試低顯存；高精度優先 A100 | 高還原靜態模型 | 依賴 TRELLIS.2、編譯 NATTEN 等 |
| Blender QA（無介面） | 依算圖功能不同 | CPU 幾何 QA；渲染按 GPU／驅動 | 轉檔、權重、骨架、預覽 | Eevee/headless 支援需驗證 |

Google AI Pro 官方列出 **Colab 每月 200 Compute Units**（2026-11 查核），不是 200 GPU 小時，也不保證固定供應 T4、L4 或 A100。應在 Notebook 開頭執行 `!nvidia-smi`、`!free -h`；API 開發和日常排程盡量用 CPU，只有執行自架生成模型才切換 GPU。[S12]

**費用控制規則**：每項資產有 `max_api_credits`／`max_gpu_minutes`、重試次數上限；重試前先查是否已有 `task_id` 成功完成；失敗不要無限重送付費 API。每輪記錄 `estimated_cost` 和最終 `credits_consumed`（若供應商提供）。

---

## 6. 能開始建置的 Colab API 範例：人形從圖片到 Rig 與動作

此範例只覆蓋 **Tripo 人形路徑**，示範合法 API 順序；不包含輸入圖片上傳、Blender 腳本及多種類型的完整封裝。先把圖片透過 Tripo Files API 上傳取得 `file_token`，或使用你有權公開存取的 HTTPS 直連圖片 URL。[S1–S4]

```python
# Colab cells：pip install requests；從 Colab Secrets 讀取金鑰（不要寫死／印出）
import time, requests
from google.colab import userdata

API_KEY = userdata.get("TRIPO_API_KEY")
BASE = "https://openapi.tripo3d.ai/v3"
SESSION = requests.Session()
SESSION.headers.update({
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
})

def start_task(path, payload):
    r = SESSION.post(BASE + path, json=payload, timeout=60)
    r.raise_for_status()
    body = r.json()
    if body.get("code") != 0 or not body.get("data", {}).get("task_id"):
        raise RuntimeError(f"API rejected request: {body.get('code')}")
    return body["data"]["task_id"]

def poll_task(task_id, timeout_s=900, interval_s=8):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        r = SESSION.get(f"{BASE}/tasks/{task_id}", timeout=30)
        r.raise_for_status()
        body = r.json()
        if body.get("code") != 0:
            raise RuntimeError(f"Task query failed: {body.get('code')}")
        data = body.get("data", {})
        status = data.get("status")
        if status == "success":
            return data
        if status in ("failed", "cancelled", "expired", "banned"):
            raise RuntimeError(f"Task {task_id}: {status}, {data.get('error_message')}")
        time.sleep(interval_s)
    raise TimeoutError(f"Task still pending: {task_id}; save ID and resume polling")

# 1. 前置：請以真正取得的 token 取代範例字串；不可直接運行假 token
image_token = "YOUR_UPLOADED_IMAGE_FILE_TOKEN"
gen_id = start_task("/generation/image-to-model", {
    "input": image_token, "model": "P2-20260801",
    "texture": True, "pbr": True,
})
gen = poll_task(gen_id)

# 2. 先做 Rig Check
check_id = start_task("/animations/rig-check", {"input": gen_id})
check = poll_task(check_id)
if not check.get("output", {}).get("riggable"):
    raise RuntimeError("Not riggable: route to mesh repair or fallback")
if check["output"].get("rig_type") != "biped":
    raise RuntimeError("Unexpected topology: send back to Agent router")

# 3. 人形 Rig v3.0（不要省略 model，預設版本仍是舊版）
rig_id = start_task("/animations/rig", {
    "input": gen_id, "model": "v3.0-20260909",
    "rig_type": "biped", "spec": "unity", "out_format": "glb",
})
rig = poll_task(rig_id)

# 4. 動作重定向，最多五段 preset；可拆任務
anim_id = start_task("/animations/retarget", {
    "input": rig_id,
    "animations": ["preset:idle", "preset:walk", "preset:run"],
    "out_format": "glb",
})
anim = poll_task(anim_id)
print({
    "generate_task": gen_id, "rig_task": rig_id, "anim_task": anim_id,
    "animated_model_url": anim.get("output", {}).get("model_url"),
})
```

**準備投入批量運行前要加上**：上傳 Files API adapter、`429/5xx` 指數退避（以 `Retry-After` 為準）、下載簽章 URL、API response schema 驗證、request idempotency／任務 ID 存檔、費用限額、網路斷線恢復及安全日誌。此碼為**參考骨架**，不是開箱即用的一鍵完整專案。

**開源後端官方命令（各自的專用環境中執行）**：

```bash
# Pixal3D：單圖／低顯存；需先依官方 README 安裝 TRELLIS.2 基底與額外依賴
python inference.py --image /path/source.png --output /path/mesh.glb --low_vram
# Pixal3D：多視角
python inference_mv.py --views_dir /path/views --output /path/mesh_mv.glb

# SkinTokens：保留原貼圖與比例；需要下載模型及 flash-attn 等依賴
python demo.py --input /path/mesh.glb --output /path/rigged.glb --use_transfer

# AniGen：直接產生 rigged mesh；參考官方模型下載及 example.py 設定
python example.py --image_path /path/source.png

# PartCrafter：例子為 4 件機構；機構樞紐仍要 Blender 後處理
python scripts/inference_partcrafter.py --image_path /path/source.png \
  --num_parts 4 --tag mechanism --rmbg
```

---

## 7. 日式賽璐璐 Toon／NPR 標準

### 7.1 風格合約 `toon_profile`

| 項目 | 建議策略 | QA 判準 |
|---|---|---|
| 色票／Base Color | 限定角色主色、暗面色、點綴色；去除 PBR 貼圖內烘焙陰影 | 角色跨轉台視角顏色一致 |
| 陰影階梯 | 2 段或 3 段 cell shading（不是高頻寫實 AO） | 光源轉動時暗面形狀穩定 |
| 描邊 | 輪廓線寬按畫面尺寸調整；必要時面部／髮束分層 | 邊緣清楚、沒有細節線條過量 |
| 法線 | 人臉與頭髮可使用特殊 normals；機械保留硬邊 | 臉部不出現不自然的鼻翼黑塊 |
| 表情 | 主角人形另存 shape keys、eye/mouth controls | 不能只靠自動 Rig 假設有口型 |
| 動畫節奏 | 強調 key pose、anticipation、exaggeration；必要時抽格 | 不犧牲實際骨架變形品質 |
| 格式 | GLB 保存幾何／骨架／clips；`material_profile.json` 保存專用 Toon 規則 | 於目標引擎重現指定效果 |

**重要格式界線**：glTF 有 `KHR_materials_unlit` 可呈現不受燈光影響的平塗風格，**但不提供完整的二／三階 cel shading 和 outline 能力**；Unity 的 UTS3／其他 Toon Shader 須在引擎中套用；VRM 的 MToon 亦有自己的匯出規範。[S13,S14]

### 7.2 建議輸出：一個資產至少五件

1. `character.glb`：Mesh + Rig／Part Hierarchy + UV + 貼圖 + 可輸出的 Animation Clips。
2. `material_profile.json`：palette、toon bands、outline width、normal policy、目標 shader 名稱。
3. `animations_manifest.json`：動作名、來源、骨架規格、FPS、duration、loop/root-motion、授權。
4. `qa/metrics.json` + `qa/report.html`：各 QA gate 與影像、人工介入原因（若有）。
5. `preview.mp4`／轉台 PNG：至少正面、側面、背面及動畫關鍵影格。

---

## 8. 品質驗收：自動測、可重試、可人工接手

### 8.1 QA gates（建議預設；非官方通用門檻）

| Gate | 自動檢查 | 自動修復 | 仍失敗時 |
|---|---|---|---|
| **G0 來源與授權** | 圖片來源、模型權重與動作資料可否用於預定用途 | 改用授權清楚來源 | `REVIEW_REQUIRED`；商用輸出不可發佈 |
| **G1 Mesh** | 是否可載入、非零頂點、合理尺寸、面數預算、孔洞/非流形 | mesh repair／decimate／regen | 切模型後端 |
| **G2 Rig** | Armature 存在、無循環骨架、骨鏈覆蓋肢體、權重有限且正規化 | 改 rig_type／補模板骨鏈／重 Rig | 人工調骨 |
| **G3 動作** | clip 存在、關節角限、循環跳動、足部穿地、裝甲自穿透 | IK／foot lock／joint clamp／替換 clip | 人工改動畫 |
| **G4 Toon** | 色票限制、描邊、法線、材質是否可在目標引擎重現 | 貼圖調色／shader profile 調整 | 人工美術驗收 |
| **G5 匯出** | glTF validator、動畫 clip 名稱、檔案存在、相依貼圖 | 再匯出／重新封裝 | 工程審核 |

### 8.2 自動修復策略

```text
失敗 → 讀取 qa.failure_codes
    ├─ G1：先 repair mesh，不能修就換 Tripo P/H 或 Pixal3D
    ├─ G2：先修分類/rig_type，再換 SkinTokens 或 AniGen
    ├─ G3：先 IK/constraints，再換授權動作來源/程序化模板
    ├─ G4：先改 toon profile、貼圖減色與法線設定
    └─ G0/G5：不可繞過來源授權與驗證檢查
  每個 gate 最多自動修復 2 次；超限 → REVIEW_REQUIRED
```

**人工交接包**：`source.png`、最新 `rigged.glb`／parts、最近兩次 `qa/metrics.json`、失敗關鍵影格、Agent 的修復歷程與具體待辦。人工修完把 `manual_override.glb` 放回 job，Agent **從後續節點繼續**，不重做先前所有階段。

---

## 9. 最小可行實驗（MVP）與擴建順序

| 階段 | 目標 | 成功定義 | 不做的事 |
|---|---|---|---|
| **Sprint 0：環境** | Drive、Secrets、Tripo adapter、manifest、CPU API 任務 | 斷線能續查 task_id、輸出 GLB | 一開始裝五套大模型 |
| **Sprint 1：人形** | 1 位 NPC 完整 `image→GLB→rig→idle/walk/run→QA` | 三段動作與 Toon profile 可檢視 | 主角級臉部精修 |
| **Sprint 2：動物** | 1 隻狼，先 walk，再加 run | 四足步態、足部接地、循環平順 | 把人形 clip 直接套用 |
| **Sprint 3：機械** | 1 台砲塔或 1 扇機械門 | 零件不軟變形，軸心正確，可開合 | 複雜機甲變形 |
| **Sprint 4：異形** | 1 隻帶尾怪物及 1 隻有翼生物 | 解剖骨架完整、至少一個專用動作 | 假定官方提供飛行 preset |
| **Sprint 5：批次** | 六類各 3 件，跨 GPU/API 後端 A/B | 成功率、成本／件、人工介入率可統計 | 沒有 QA 報告就宣稱 game-ready |

### 建議追蹤 KPI

- **Autonomous completion rate**：通過 G0–G5 且完全不需人工修正的資產比例。
- **Playable asset rate**：具有至少一段可用且符合需求之動畫的比例（**不只看 Rig 是否存在**）。
- **Cost per accepted asset**：包含 API 失敗重送、GPU、貼圖、渲染與人工修復成本。
- **Category-level failure codes**：每類資產的缺腿、骨架錯誤、穿模、動作缺失與色彩不符統計。
- **Style consistency**：同一 Toon profile、同一色票及同光源轉台下的視覺一致性。

---

## 10. 風險、商用與不得省略的邊界

1. **AI Pro ≠ 免費 Tripo／Meshy／Gemini Developer API**。Google AI Pro 的 Colab CU 和第三方 API 為不同計費系統；相關免費額度或付費資格以個別帳戶為準。[S12]
2. **輸入圖版權**：僅使用擁有授權的角色設定圖；盡量保留來源、作者及使用範圍於 `asset_spec`。
3. **AniGen code MIT 不等於所有第三方元件可商用**：官方指出其 `extensions/CUBVH/` 有來自 NVIDIA instant-ngp 的非商用／研究限制。即使推論不需要它，也要清點實際部署／散布涉及的元件，必要時替換實作或取得許可。[S7]
4. **模型／權重／資料集授權需分別核對**：GitHub 程式碼授權、預訓練 checkpoint、下載貼圖、動作庫、第三方套件各有條款；不得只看 Repo 的 MIT 標記。
5. **圖片到 3D 不是自動得到完善遊戲拓撲**：對關節變形不佳、內部重疊、非流形、布料或髮絲，Agent 應先自動修補再評估是否轉人工。
6. **Colab 會中斷**：所有 API task ID、下載 URL、manifest 和 checkpoint 寫到 Drive；輪詢不是在 Colab 關閉後持續執行的背景服務。需要可靠 24/7 排程應由具備持久性的外部 orchestrator 接手。
7. **機械零件生成≠CAD／正確運動學**：PartCrafter 可以分件，但不能自動保證精確樞紐、機構自由度或無碰撞。
8. **Toon Shader 不會自然打包在 GLB**：引擎側需要材質轉換／重建；對 Unity 專案應額外準備 importer（在有 Unity Editor 的環境執行）。

---

## 11. 官方來源與核對連結

> 下列連結是本規格的功能依據；以**官方說明**為優先。部署前重新檢查版本、定價及授權，因 API 與 Colab 配額可變。

- **[S1] Tripo Image → 3D（H／P 系列）**：https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard 、https://developers.tripo3d.ai/en/docs/generation-image-to-model/p
- **[S2] Tripo Rig Check / Auto Rig**：https://developers.tripo3d.ai/en/docs/animations-rig-check 、https://developers.tripo3d.ai/en/docs/animations-rig
- **[S3] Tripo Animation Retarget**：https://developers.tripo3d.ai/en/docs/animations-retarget
- **[S4] Tripo Tasks / 檔案上傳**：https://developers.tripo3d.ai/en/docs/task-query 、https://developers.tripo3d.ai/en/docs/files
- **[S5] Pixal3D**（2026 新版含多視角、`--low_vram`；主分支依賴 TRELLIS.2）：https://github.com/TencentARC/Pixal3D
- **[S6] SkinTokens**（≥14 GB、`--use_transfer` 與 `--use_skeleton`）：https://github.com/VAST-AI-Research/SkinTokens
- **[S7] AniGen**（≥18 GB；image→mesh+skeleton+skin；第三方授權警示）：https://github.com/VAST-AI-Research/AniGen
- **[S8] TRELLIS.2**（≥24 GB）：https://github.com/microsoft/TRELLIS.2
- **[S9] PartCrafter**（≥8 GB；分件與 VLM 建議部件數）：https://github.com/wgsxm/PartCrafter
- **[S10] Meshy Rigging API（標準人形）**：https://docs.meshy.ai/en/api/rigging
- **[S11] Meshy Animation API／Library**：https://docs.meshy.ai/en/api/animation 、https://docs.meshy.ai/en/api/animation-library
- **[S12] Google AI 方案 Colab CU**：https://one.google.com/intl/zh-tw/about/google-ai-plans/
- **[S13] Unity Toon Shader**：https://github.com/Unity-Technologies/com.unity.toonshader
- **[S14] glTF `KHR_materials_unlit`**：https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_unlit/README.md
- **[S15] Blender VRM Add-on / MToon**：https://github.com/saturday06/VRM-Addon-for-Blender

---

### 本文件的交付定位

這是一份**可交付給 AI coding agent 建置 Notebook 的系統規格、路由設計、官方 API 最小範例與驗收清單**，並非聲稱所有六類、所有後端的 Colab Notebook 已完成實測或能零介入百分之百成功。最務實的第一個可運轉目標是：**一張人形圖片 → Tripo P2 → Rig v3 → 三段動畫 → Blender QA → Toon Profile → GLB + 報告**，再逐步加入動物、奇幻生物、機械與機甲的例外路由。
