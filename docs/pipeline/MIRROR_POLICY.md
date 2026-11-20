# 通用文件與 Prompt 模板：GitHub → Drive 單向鏡像

## 唯一維護來源

- **GitHub `main`**：通用目錄圖、管線步驟與分類 Prompt 模板的唯一可維護正本，所有修訂走 PR。
- **Google Drive**：同名通用文件、分類模板是供使用者與 Agent 讀取的**唯讀鏡像**；只有正式發布身分能更新。
- **個別資產仍為 Drive 可寫**：如 `_designed_prompts/`、主體資料夾內的 `*.prompt.md`、`_prompts/_jobs/`、成果、manifest、審查、版本備份。

## 路徑對照

| GitHub 正本 | Google Drive 鏡像 |
| --- | --- |
| `docs/drive/DIRECTORY.md` | 根目錄 `DIRECTORY.md` |
| `docs/drive/AGENT_QUICKSTART.md` | 根目錄 `AGENT_QUICKSTART.md` |
| `docs/pipeline/TRIGGERS.md` 與管線流程 | 對應通用閱讀文件 |
| `docs/pipeline/characters/*.prompt.md`、`skeleton_actions.md` | `characters/_prompts/` |
| `docs/pipeline/creatures/*.prompt.md`、`skeleton_actions.md` | `creatures/_prompts/` |
| `docs/pipeline/moves/*.prompt.md`、`skeleton_actions.md` | `moves/_prompts/` |

目前 Drive 實際使用 `_prompts`，部分歷史文件使用 `prompts`。不要未驗證即改名、刪除或搬移。

## 版本、同步與衝突

1. 在 GitHub 修改共用文件與模板 → PR 審查、測試 → 合併至 `main`。
2. 授權發布者只從 GitHub `main` 將列入映射的通用檔案單向複製到 Drive，盡可能保留原 Drive file ID、檔名與版本歷史。不處理任何個別資產。
3. 保存對應的 GitHub commit SHA、相對路徑、SHA-256，逐檔驗證。不符時標記 Drive 鏡像過期，禁止宣稱已同步成功。
4. 若 Drive 目前版本比 GitHub 新或衝突，先人工比對並以 GitHub PR 收錄必要修改；**不准反向自動同步**。
5. 日常前端與 Agent 僅讀取 Drive 的通用模板，不直接覆寫；個別 `_jobs/` 工作檔仍可正常寫入。
6. 「唯讀」為維護策略，不等同已設 Drive ACL。要從權限層強制阻擋須另外配置可讀不可寫的共享權限／發布帳號或程式防護；不要把完整 OAuth／Refresh Token 提交 GitHub。

**現階段：** 已確認 Drive 原有 `DIRECTORY.md`、`AGENT_QUICKSTART.md` 與三類 `_prompts/`。本次 PR 建立 GitHub 版控規範，但**沒有重新同步 Drive 內容、改變 ACL 或建立授權發布工作流**。
