# 線上 Drive 實測接續說明

本次收尾狀態：2026-11-12。使用者要求先收尾 commit，已停止測試程序。

## 已完成與尚未完成

- 線上版對應提交 f1880be；既有 GitHub Pages 部署成功。
- 瀏覽器控制工具在初始化與重設重試後均回報 `windows sandbox failed: helper_unknown_error: setup refresh had errors`，無法操作登入或登入後介面。
- 已在 Drive 專案 backup 下建立獨立 `_live_validation_20261112_164008` 測試區，內含目錄骨架、六份步驟 prompt 副本與預設格式 JSON 副本。沒有修改正式素材。
- 已使用本機 Blender 5.2 產生有效的最小 GLB／Blend 測試素材。測試來源 PNG 為明確的最小讀寫 fixture，不代表正式美術作品。
- 整合驗證程式已啟動，但在首筆 metadata RPC 尚未回覆前停止。尚無此次應用程式讀寫、審查核准、退件或故障回復的真實 Drive 測試結果；不可把準備完成或既有單元測試視為這些流程通過。
- 程式檢查提出兩個待驗證項目：來源綁定是否覆寫既有審查註記；重複資產 ID 是否替換掉原本具有 Drive 位置的項目。本次未宣稱已重現或修復。

## 驗證程式的用途與界限

`tools/live-drive-validation.cjs` 執行目前儲存庫的 drive-storage.js、pipeline.js 及真正的資產目錄解析器，透過 MCP 控制器把請求轉接至已連線的 Google Drive。

它不是瀏覽器，也不會測試真正的 Google OAuth、CORS、頁面渲染或使用者點擊。程式中的假 token 僅供本機 request 包裝器啟動，不是 Google 憑證，不會送至 Google。連線由 MCP 原生 Google Drive 工具授權。

Drive 根資料夾名稱必須以 `_live_validation_` 開頭；控制器也必須限制所有 ID 都屬於該測試根及其子孫，不得把正式專案根 ID 當作測試根。所有核准與退件都只發生在測試區內，不代表正式作品核可。

## 接續方式

先用已安裝的 Blender 產生 fixture，再由具有 Google Drive MCP 工具的控制器啟動 Node 程式：

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python tools/create-live-drive-fixture.py -- Art/_incoming/live_drive_validation
node tools/live-drive-validation.cjs <獨立測試根ID>
```

Node 會在 stdout 輸出 `@@RPC@@` 加上單行 JSON，等待 stdin 的單行 JSON 回覆。這是需由 MCP 控制器協作的協定，不是直接執行就會自行連線的 CLI。不要擷取瀏覽器 token、讀取憑證儲存或繞過登入。

控制器使用 Google Drive 原生工具完成各請求，回覆 `{ "reply": <請求id>, "status": 200, "data": <Drive REST 形狀資料> }`。失敗時回覆 status 與 error。讀檔回覆 file，指向已下載的原始檔本機路徑。工具的 title、mime_type、parent_ids 需轉為 name、mimeType、parents；列表包成 `{ "files": [...] }`。

| op | 動作 |
|---|---|
| metadata | 讀取指定測試 ID 的 metadata |
| list | 列出指定測試父目錄，依 name／mime 條件篩選 |
| mkdir | 在指定測試父目錄建立資料夾 |
| write | 使用程式提供的本機 file 上傳或原 ID 更新；不轉換格式 |
| read | 下載原始位元組至 target，再回覆該路徑 |
| move | 核對來源後，以 addParents／removeParents 移動，保留 ID |

依序驗證 Markdown 新增／讀回／覆寫保留 ID、步驟 prompt 讀取與代入、外觀與參數分離、目錄載入、原位立繪核准、來源綁定保留註記、故障注入後真實搬移回復、成對移入完成區、兩種退件，以及重複 ID 隔離。`@@CHECK@@` 是單項結果，`@@RESULT@@` 才是最終結果；issues 非空或 `@@FATAL@@` 均不得宣稱通過。

測試結果與 fixture 置於已被 Git 忽略的 `Art/_incoming/live_drive_validation/`。測試區保留在備份中，未自動刪除。完成程式整合測試後，仍須在真正瀏覽器另做登入、讀寫、prompt 與審查搬移驗證，再部署有必要的修正。
