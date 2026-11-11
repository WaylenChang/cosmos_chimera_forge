# COSMIMERA · Prompt Forge & 交付審查台 (cosmos_chimera_forge)

獨立的美術任務 Prompt 產生器與交付成果審查台。
產生交給 ChatGPT 對話版 / Gemini Argon 任務模式的美術任務 prompt，並提供交付成果（立繪、3D 模型、動作、特效）的解包、預覽、審查與升級功能。

- **線上版（GitHub Pages）**：登入 Google，且帳號有 Drive 專案資料夾權限後，開啟完整鍛造台與成果審查台。
- **資產儲存**：Google Drive `project/cosmos_chimera_forge/`。Prompt 與包內參照使用相對目錄；網頁不再從相鄰遊戲倉庫讀取圖片與模型。
- Google 登入需要 HTTP(S) 網站來源，不支援直接以 `file://` 開啟後完整使用。

> **專案審查與解壓規範**：
> - **Drive 是正式存放位置**：立繪放 `image_in/`，已處理立繪放 `image_backup/`，3D 包放 `3D_out/`，Prompt 放 `prompts/<task_id>.prompt.md`。以上均相對於 Drive 專案根目錄。
> - **登入載入與讀寫**：登入後自動讀取三個成果目錄的 ZIP。可重新載入、將本機載入的審查包存回 Drive、儲存完整 Prompt，或輸入相對路徑讀取既有 Prompt。讀取 Prompt 會開啟文字預覽，不會修改目前鍛造參數。
> - **本機匯出**：`Art/_incoming/` 僅作下載／解壓暫存，審查通過後可交付至相對遊戲目錄 `../cosmos_chimera/Art/_incoming/<task_id>/`；不再使用固定 Windows 使用者路徑。
> - **遊戲專案驗收管線**：解壓完成後，至 `cosmos_chimera` 專案執行 `python tools/validate_art.py Art/_incoming/<task_id> --apply` 完成驗收與資產入庫。

## 核心檔案架構

| 檔案 | 內容 | 何時改 |
|---|---|---|
| `index.html` | 頁面結構與樣式（包含 Prompt 鍛造台與成果審查台雙視圖） | 改介面排版、CSS |
| `forge.js` | UI 互動、隨機抽樣、任務組裝、ZIP 解析、審查與一鍵解壓指令 | 改邏輯、調整解壓或審查功能 |
| `catalog.js` | 選項池、權重、原型清單、動作 clip、特效分類 | 加選項、調權重、改動作規格 |
| `tasks.js` | 各任務的 prompt 模板（產出清單、檔名、JSON 欄位） | 新任務、改交付規格 |
| `designed.js` | 已設計項目（**產生檔，勿手改**） | 改 `Data/_incoming` 批次後跑 `python gen_designed.py` |
| `gen_designed.py` | 從 `Data/` 批次資料產生 `designed.js` | 新增已設計的進化線或修改欄位 |
| `tools/` | 驗收腳本 (`validate_art.py`)、資料驗證 (`validate_data.py`)、一鍵解壓腳本 (`unpack_incoming.ps1`) 與單元測試 | 修改交付驗收規範、資料驗證或解壓邏輯 |
| `drive-config.js` | OAuth Web Client ID、Drive 根目錄 ID 與根路徑 | 更換 Google 登入或 Drive 專案 |
| `drive-storage.js` | Google 授權、相對路徑讀寫、成果包載入 | 修改雲端存取 |
| `Art/_incoming/` | 本機下載／解壓暫存，正式資產位於 Drive | 本機匯出與遊戲交付 |
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
1. **Google 設定**：在 OAuth 所屬 Google Cloud 專案啟用 Google Drive API；OAuth 類型須為 Web application，Authorized JavaScript origins 加入 `https://changweilin.github.io`（不含路徑）。若使用本機測試，也需加入實際的 HTTP localhost 來源。Consent screen 若仍為 Testing，需加入使用者為測試帳號。
2. **Client ID**：已在 `drive-config.js` 設定網站專用 Client ID；可用 GitHub Actions repository variable `GOOGLE_OAUTH_CLIENT_ID` 覆寫。Client ID 是公開設定，請勿放入 Client Secret。授權使用 Drive scope，因需讀取／更新既有成果包；Google Cloud 的應用程式發布與驗證要求依帳號設定辦理。
3. **自動部署**：推送至 `main` 觸發 `.github/workflows/deploy.yml`，先執行存取測試，再執行 `node tools/build-site.mjs`。只上傳 `_site/` 的明確檔案清單；不包含 `Art/`、`Data/`、原始 Prompt 或 ZIP。
4. **驗證**：`node --test tools/tests/test_drive_storage.cjs`；`node tools/build-site.mjs`。正式 OAuth 登入、同意授權與 Drive 寫入仍需在已允許的網站來源，以有權限的 Google 帳號驗證。

GitHub Pages 提供公開的 HTML／JavaScript 殼層，前端登入畫面不是伺服器端存取控制；私人資產只由帶有 OAuth Bearer token 的 Drive API 讀取，實際授權由 Drive ACL 執行。Token 僅保存在記憶體，不寫入 localStorage、網址或部署成品，登出／到期後重載清除私人 blob。鍛造參數與收藏仍保存在目前瀏覽器的本機儲存空間，並非 Drive 同步資料。

2026-11-11 搬移：`image_in/`、`image_backup/`、`3D_out/` 已從 `project/cosmos_chimera/` 移至 `project/cosmos_chimera_forge/`，保留資料夾與檔案 ID；4 份既有 Prompt 搬至 `prompts/`。`argon_blender` 依使用者指示保留原位。

參考：[Google Web 授權](https://developers.google.com/identity/oauth2/web/guides/use-token-model)、[GitHub Pages 存取控制](https://docs.github.com/en/enterprise-cloud%40latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)。
