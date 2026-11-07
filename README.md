# COSMIMERA · Prompt Forge & 交付審查台 (cosmos_chimera_forge)

獨立的美術任務 Prompt 產生器與交付成果審查台。
產生交給 ChatGPT 對話版 / Gemini Argon 任務模式的美術任務 prompt，並提供交付成果（立繪、3D 模型、動作、特效）的解包、預覽、審查與升級功能。

- **線上版（GitHub Pages）**：部署於本倉庫的 GitHub Pages
- **離線單頁**：直接用瀏覽器開 `index.html`（零外部依賴、純前端）。

> **解壓目標路徑**：
> 一鍵解壓、一鍵備份及管線驗收指令預設指向主遊戲專案路徑：
> `C:\Users\user\Documents\app\cosmos_chimera`（可在介面右上角自訂覆蓋）。

## 核心檔案架構

| 檔案 | 內容 | 何時改 |
|---|---|---|
| `index.html` | 頁面結構與樣式（包含 Prompt 鍛造台與成果審查台雙視圖） | 改介面排版、CSS |
| `forge.js` | UI 互動、隨機抽樣、任務組裝、ZIP 解析、審查與一鍵解壓指令 | 改邏輯、調整解壓或審查功能 |
| `catalog.js` | 選項池、權重、原型清單、動作 clip、特效分類 | 加選項、調權重、改動作規格 |
| `tasks.js` | 各任務的 prompt 模板（產出清單、檔名、JSON 欄位） | 新任務、改交付規格 |
| `designed.js` | 已設計項目（**產生檔，勿手改**） | 改 `Data/_incoming` 批次後跑 `python gen_designed.py` |
| `gen_designed.py` | 從 `Data/` 批次資料產生 `designed.js` | 新增已設計的進化線或修改欄位 |
| `Data/` | 宙獸、角色、招式、特性與原型圖鑑資料庫 | 兩邊專案同步保留的圖鑑資料 |

## 版本規範（SemVer）
每個 prompt 第一行是任務標頭 `[COSMIMERA-TASK spec tool catalog template@ver task_id seed]`，交付的 `manifest.json` 必須原樣抄回，讓任何產出都能追溯到產生它的規格版本。

| 版本號 | 位置 | major | minor | patch |
|---|---|---|---|---|
| `spec` | `forge.js` `SPEC` | manifest 結構改變 | — | — |
| `tool` | `forge.js` `TOOL_VERSION` | 任務標頭格式改變 | 新 UI 功能 | 修 bug |
| `catalog` | `catalog.js` `version` | 改名/刪除既有選項 ID、改動作 clip ID 或事件 | 新增選項、調權重 | 改中文措辭 |
| `template` | `tasks.js` 各任務 `version` | 改產出清單、檔名、JSON 欄位 | 新增選填項目 | 改措辭 |

- 每次 bump 都在 `CHANGELOG.md` 記一行。
- 動作 clip ID 會被 Unity Animator 引用，改 ID 等於破壞性變更。

## 部署與工作流
1. **GitHub Pages 自動部署**：推送到 `main` 分支時，觸發 `.github/workflows/deploy.yml` 自動發布至 GitHub Pages。
2. **本機使用**：直接點擊雙擊 `index.html` 即可完整使用所有鍛造與審查功能。
