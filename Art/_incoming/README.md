# Art/_incoming — 待審查的 AI 美術交付（本專案審查區）

此目錄僅作本機下載／解壓暫存。正式成果已搬至 Google Drive `project/cosmos_chimera_forge/`：立繪包 `image_in/`、已處理立繪 `image_backup/`、3D 包 `3D_out/`、Prompt `prompts/`。所有路徑均相對於此 Drive 根目錄。

## 審查與解壓工作流
1. **存放與載入**：登入 Google 後自動載入雲端成果包；本機 ZIP 可拖曳載入，再按「儲存審查包至 Drive」。如需本機解壓，可將下載包存入本暫存目錄。
2. **成果審查台檢閱**：在 `index.html`（成果審查台）進行 2D 立繪檢閱、3D 模型/拓撲檢視、2D⇄3D 雙欄對比與審查覆核。
3. **解壓至遊戲專案**：審查確認無誤後，點選「⚡ 解壓至 cosmos_chimera」或執行 `powershell unpack_incoming.ps1`，檔案將解壓至主遊戲專案（`cosmos_chimera/Art/_incoming/<task_id>/`）。
4. **驗收搬入**：至 `cosmos_chimera` 專案目錄執行 `python tools/validate_art.py Art/_incoming/<task_id> --apply` 進行最終驗收與資產入庫。
