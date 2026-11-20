# Cosmos Chimera Forge：資料儲存邊界與通用架構

> **原則：Google Drive 是所有個別宙獸、角色、技能及交付成果的唯一正式來源（Single Source of Truth）；GitHub 只維護通用規格、流程、程式與測試。**
>
> 本規範適用於後續新檔、新功能、AI Agent 與 Colab 工作。任何既有 Git 追蹤檔案的刪除，應先完成 Drive 對照與程式依賴遷移。

## 各系統責任

| 系統 | 保存或執行內容 | 不應保存 |
| --- | --- | --- |
| Google Drive | 個別主體資料、設計 Prompt、外觀、數值、圖鑑、立繪、多視角、GLB／Blend、材質、骨架、動畫、特效、manifest、審查、歷史版本與備份 | 通用程式碼的唯一版本 |
| GitHub | Drive 目錄結構及命名規範、管線流程、通用 Prompt 模板、Schema、分類規則、Notebook、工具、UI、測試與部署工作流 | 任何真實個別主體的 JSON／Markdown／圖片／模型／動畫、實際工作 Prompt、完整索引快照 |
| Colab／Blender／AI Agent | 按任務讀取 Drive 指定主體與版本，在執行環境暫存中間檔，交付結果回 Drive | 長期保存正式資產、在 GitHub 產出個別成果 |

*「通用」意指不依賴特定角色／宙獸／技能 ID 的規則。測試所需的**合成 fixture** 可以留在 GitHub，但不得含正式個案。*
* 公開 Google OAuth Client ID 與根資料夾設定可存在程式設定；Access Token、Refresh Token、個別主體 ID 清單與工作內容不可編入倉庫。
* 不要求 GitHub 與 Google Drive 雙向同步個別檔案；取得最新內容時需在取得授權後即時從 Drive 解析。

## 概念性 Drive 目錄圖

實際目錄結構與最新命名以 [Drive DIRECTORY](drive/DIRECTORY.md) 為準。以下為概念圖，ID 與版號只是佔位符，**不是應提交到 GitHub 的資料夾**。

~~~text
project/
└── cosmos_chimera_forge/                  # Google Drive
    ├── characters/
    │   ├── designed_prompts/             # 尚未開工的個別主體設計稿
    │   ├── prompts/                      # Drive 端可執行的分類模板／jobs
    │   └── <subject_id>/
    │       ├── <design_id>.prompt.md
    │       ├── <subject_id>_01_portrait_main.png
    │       ├── <subject_id>_03a_colab.glb
    │       ├── <subject_id>_05_wiki.md
    │       ├── 00_settings/
    │       ├── 01_portrait/
    │       ├── 02_review_portrait/
    │       ├── 03a_colab/
    │       ├── 03b_blender/
    │       └── 04_review_3d/
    ├── creatures/
    │   ├── designed_prompts/
    │   ├── prompts/
    │   └── <subject_id>/
    │       ├── <design_id>.prompt.md
    │       ├── <subject_id>_<stage>_03a_colab.glb
    │       ├── <subject_id>_<stage>_05_wiki.md
    │       ├── 00_settings/
    │       ├── 01_portrait/               # 宙獸圖像（含主圖）放在此
    │       ├── 02_review_portrait/
    │       ├── 03a_colab/
    │       ├── 03b_blender/
    │       └── 04_review_3d/
    ├── moves/
    │   ├── designed_prompts/
    │   ├── prompts/
    │   └── <move_id>/
    │       ├── <move_id>_05_wiki.md
    │       ├── 00_settings/
    │       ├── 01b_vfx/
    │       └── 04_review_3d/
    ├── 00_settings/                       # 全域參數
    ├── prompts/                           # 舊模板的唯讀相容區
    └── backup/                            # 退役資料與歷史索引
~~~

**不要**在 GitHub 建立上圖中的真實 `characters/<id>/`、`creatures/<id>/`、`moves/<id>/`，亦不要以產生器把 Drive 的個案複製成 Git commit。

## 管線與資料流

~~~mermaid
flowchart TD
    U[使用者選擇分類／主體 ID／步驟] --> O[Google OAuth 與 Drive ACL 驗證]
    O --> D[Drive 讀取當前主體及版本]
    G[GitHub 通用模板／Schema／工具] --> P[組裝本次任務]
    D --> P
    P --> B{選擇管線}
    B -->|Image-to-3D| I[立繪與人工來源審核]
    I --> C[Colab 03a 或 AI Blender 03b]
    B -->|Prompt-to-3D| A[AI Blender 03b]
    B -->|技能 VFX| V[01b_vfx]
    C --> Q[模型／骨架／材質／動作 QA]
    A --> Q
    V --> Q
    Q --> H[人工最終審核]
    H --> R[寫回 Drive：版本／manifest／成果／審查]
~~~

- Image-to-3D：使用已核准來源立繪；Colab + Blender 與 AI Blender 為兩條替代路線，不應強制串成同一個流程。
- Prompt-to-3D：可以在沒有立繪時以文字外觀與圖鑑建模，不得杜撰 source_pack。
- Wiki：以 Drive 上既有主體／型態圖鑑為準，缺檔時才建立待審草稿，不在模型目錄重複複製。
- 審查：程式只能提出 QA 與狀態建議；移入完成區與正式核准仍須人工授權。
- Colab：僅下載選定主體所需輸入，完成後回寫 Drive；不得在 GitHub 提交 GLB、PNG、Blend、推論結果或憑證。

## GitHub 建議的通用內容

~~~text
cosmos_chimera_forge/                       # GitHub
├── docs/
│   ├── STORAGE_BOUNDARY.md                 # 本檔
│   ├── drive/DIRECTORY.md                 # Drive 目錄示意與命名契約
│   └── pipeline/                          # 通用流程、Prompt、觸發語句
├── Data/schemas/                           # 通用 JSON Schema
├── scripts/                                # 通用 3D 與 Blender 管線
├── notebooks/                              # 通用 Colab 執行入口
├── tools/                                  # 驗證／部署／工具與合成 fixture
├── *.js                                    # 通用 UI、Drive 存取與任務邏輯
└── .github/workflows/                      # CI／部署
~~~

## 歷史存量與遷移守則

2026-11-20 盤點的倉庫**仍追蹤** `Data/_incoming/`、`palworld_data/`、`Logs/`、`designed.js` 與 `gen_designed.py` 等過往資料或依賴。尤其 `designed.js` 仍由網頁載入，不能只刪檔而不重構 UI。

1. 先逐一核對舊檔是否已在 Drive 有正確版本、權限、校驗碼與索引；「已上傳」不等於「依賴已完成遷移」。
2. 把 `designed.js` 的真實角色／宙獸清單讀取改為 OAuth 後的 Drive 動態資料；同時調整依賴該清單的 UI 與回歸測試。
3. 把產生器、硬編碼個案、實際匯入批次與第三方研究素材自 GitHub 移出；不影響通用 Schema、測試 fixture、分類規則及頁面功能。
4. 通過本機測試、Pages 架站測試與 Drive 授權整合測試後，再在獨立 PR 刪除舊追蹤檔；避免一次性刪除數千檔導致功能中斷。
5. 每次新增個別主體皆直接建立／更新 Drive，僅在 GitHub 修改必要的通用規格或流程；不得在正式倉庫提交真實主體索引快照。

本規範不宣稱已執行 Drive 遷移、資料刪除或 Colab GPU 推論。