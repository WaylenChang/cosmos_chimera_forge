# COSMIMERA · Prompt Forge & 交付審查台 (cosmos_chimera_forge)

獨立的美術任務 Prompt 產生器與交付成果審查台。
產生交給 ChatGPT 對話版 / Gemini Argon 任務模式的美術任務 prompt，並提供交付成果（立繪、3D 模型、動作、特效）的解包、預覽、審查與升級功能。

- **線上版（GitHub Pages）**：登入 Google，且帳號有 Drive 專案資料夾權限後，開啟完整鍛造台與成果審查台。
- **資產儲存**：Google Drive `project/cosmos_chimera_forge/`。Prompt 與包內參照使用相對目錄；網頁不再從相鄰遊戲倉庫讀取圖片與模型。
- Google 登入需要 HTTP(S) 網站來源，不支援直接以 `file://` 開啟後完整使用。

## 角色／宙獸管線（2026-11-11）

正式資產使用 Google Drive 深層資料夾，逐檔讀取與交付。每個資產版本以唯一 asset_id 建目錄，保留 manifest.json、concept.json、images/ 或 models/、rig/、animations/、previews/。角色與宙獸共用結構，以 task_type 區分。

1. HTML 隨機／圖鑑設定或 AI 生成基礎外觀；外觀 Markdown 與格式參數 JSON 分開保存於 `00_settings/`。
2. 立繪輸出至 `01_portraits/<asset_id>/`。主用 ChatGPT／Codex，Gemini／Antigravity 輔助。
3. 審查台核准立繪時原位保存；退件時整個目錄搬到 `backup/rejected_portraits/<revision>/`。
4. Colab GPU 路線輸出至 `02_3d/colab/<asset_id>/`；AI Blender（Argon／Codex）輸出至 `02_3d/ai_blender/<asset_id>/`。歷史待審模型在 `02_3d/legacy/`。Colab 模型與修復細節尚待實機決定。
5. 最終人工核准前須有已核准的來源立繪及 .glb／.blend。核准後模型與立繪分別移至 `03_completed/models/`、`03_completed/portraits/`；模型退件搬到 `backup/rejected_3d/`，保留立繪原位。純 prompt 建模須補立繪後綁定 source_pack。

審查結果存 `reviews/<asset_id>.json`。目錄移動保留 Drive ID，搬移或寫入失敗時嘗試回復；回復失敗會明示需重新載入核對。不同資產版本不得同名。歷史 ZIP 僅留在 `backup/legacy_archives/`，不再用於正式交付。

`prompts/` 存六個互相獨立的單步驟 `.prompt.md`、`TRIGGERS.md` 與 `DIRECTORY.md`；已填入資產路徑的版本另存 `prompts/jobs/`。舊的跨步驟長 prompt 放 `backup/legacy_prompts/`。本機同步來源見 [docs/pipeline](docs/pipeline/DIRECTORY.md)。

HTML 選步驟後按「讀取本步驟 .md／複製執行」，即可預覽並複製 Drive 上的最新指令。先按「儲存外觀 .md ＋ 參數 .json」，再把參數檔與圖片交給所選 AI。讀取指令不會自動啟動外部 AI、Colab 或 Blender。3D 建模提示詞區分圖片／純文字來源，宙獸另需四型態 `bestiary.md`；如果 Drive 的 3D 模板仍是舊版，網頁會採用內建新版，避免舊指令混入。可將 `docs/pipeline/03a_colab.prompt.md` 與 `03b_blender.prompt.md` 同步到 Drive 以恢復由 Drive 管理最新版。範例觸發：「讀取 cosmos_chimera_forge/prompts/03b_blender.prompt.md，使用指定圖片或 appearance.md 及 parameters.json 執行。」

本機匯入／匯出亦使用展開後的資產目錄。遊戲交付仍可逐檔交給相鄰遊戲專案驗收。Google OAuth 登入需 HTTP(S) 網站來源，無法直接用 file:// 啟用 Drive 功能。

### 本機 Google 登入與刷新後保留登入

在專案根目錄使用 HTTP 伺服器啟動（**不可直接雙擊 `index.html`**）：

```bash
python -m http.server 8000
```

開啟 `http://localhost:8000`。若系統使用 `python3`，改用 `python3 -m http.server 8000`。

在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 找到 `drive-config.js` 使用的 **OAuth 2.0 Web application Client ID**，在 **Authorized JavaScript origins** 新增：

- `http://localhost:8000`
- `http://127.0.0.1:8000`（如果也需要使用 127.0.0.1 存取；Google 視為另一個來源）
- 正式站來源 `https://changweilin.github.io` 繼續保留

這些來源需與瀏覽器實際使用的 scheme、hostname 和 port 完全一致；不要添加 URL 路徑。確認 Cloud 專案已啟用 Drive API、OAuth consent screen / test users 已設定，且登入帳號具有專案 Drive 資料夾權限。本機與 GitHub Pages 可以使用同一組公開 Client ID，不需要 Client Secret。HTTP localhost 是 Google OAuth 開發環境允許的特例，其他非 localhost 網址通常需要 HTTPS。

**登入持續性**：驗證 Drive 權限成功後，尚未過期的 access token 與到期時間只存放在目前分頁的 `sessionStorage`；同分頁重新整理會嘗試恢復並再次驗證根目錄。主動登出、權限失效或 token 到期會清除記錄並回到登入畫面。此方案不支援跨瀏覽器工作階段的長期自動登入；要達成真正的「記住我」與 refresh token 續期，須另建後端 OAuth authorization-code + PKCE、加密 token 儲存和 HttpOnly/Secure/SameSite session cookie。不同網站來源的 sessionStorage 彼此獨立，localhost 和 GitHub Pages 各需首次授權。


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
| `pipeline.js` | 單步驟 prompt 組裝、外觀與參數隔離 | 修改角色／宙獸管線 |
| `drive-config.js` | OAuth Web Client ID、Drive 根目錄 ID 與根路徑 | 更換 Google 登入或 Drive 專案 |
| `drive-storage.js` | Google 授權、遞迴目錄讀寫、審查與搬移 | 修改雲端存取 |
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
4. **驗證**：`node --test tools/tests/test_drive_storage.cjs tools/tests/test_pipeline.cjs tools/tests/test_asset_directories.cjs`；`node tools/build-site.mjs`。正式 OAuth 登入、同意授權與 Drive 寫入仍需在已允許的網站來源，以有權限的 Google 帳號驗證。

GitHub Pages 提供公開的 HTML／JavaScript 殼層，前端登入畫面不是伺服器端存取控制；私人資產只由帶有 OAuth Bearer token 的 Drive API 讀取，實際授權由 Drive ACL 執行。Token 僅保存在記憶體與同分頁 sessionStorage（供頁面刷新恢復），不寫入 localStorage、網址或部署成品；登出／到期後重載清除私人 blob。鍛造參數與收藏仍保存在目前瀏覽器的本機儲存空間，並非 Drive 同步資料。

參考：[Google Web 授權](https://developers.google.com/identity/oauth2/web/guides/use-token-model)、[GitHub Pages 存取控制](https://docs.github.com/en/enterprise-cloud%40latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)。


### Drive 本機快取與設定（Tool 2.7.0）

登入後，使用上方「⚙ 設定」頁管理快取、帳號登出、強制同步、立繪 Prompt 模式與版本檢查。小型 Drive 資產以 IndexedDB 儲存，每包上限 24 MiB，每個帳戶 80 MiB／80 包；大型 GLB 和 Blend 不會下載至快取。預設啟用快取與自動同步，TTL 60 分鐘；可改為 15 分鐘、6 小時或 24 小時。

OAuth token 與 Drive 根目錄權限驗證成功後，先顯示未過期的快取，再並行讀取雲端檔案 metadata（檔案 ID、路徑、修改時間、大小），只下載內容變更的檔案。手動重新同步會跳過快取。快取過期或 IndexedDB 不可用時自動退回雲端載入；寫入、目錄搬移與登出會清除目前帳號的資產快取。

本機快取是裝置上的私人副本，並非加密檔案；不建議在共用電腦啟用。每個 Google 帳戶的快取以 Drive permission ID 隔離，不提供離線登入，也不繞過 Drive 存取權限。網站部署版本由版本檔顯示，沒有登入憑證或私有 Drive 路徑。
