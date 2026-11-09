# Art/_incoming — 待審查的 AI 美術交付（本專案審查區）

無論是立繪（`chr-*`、`cr-*`）或 3D（`mdl-*`、`anim-*`），所有交付的壓縮包（`.zip`）與審查檔案均統一放置於本專案此目錄進行審查。

## 審查與解壓工作流
1. **存放與載入**：將交付壓縮包存入本目錄，或直接於成果審查台拖曳載入。
2. **成果審查台檢閱**：在 `index.html`（成果審查台）進行 2D 立繪檢閱、3D 模型/拓撲檢視、2D⇄3D 雙欄對比與審查覆核。
3. **解壓至遊戲專案**：審查確認無誤後，點選「⚡ 解壓至 cosmos_chimera」或執行 `powershell unpack_incoming.ps1`，檔案將解壓至主遊戲專案（`cosmos_chimera/Art/_incoming/<task_id>/`）。
4. **驗收搬入**：至 `cosmos_chimera` 專案目錄執行 `python tools/validate_art.py Art/_incoming/<task_id> --apply` 進行最終驗收與資產入庫。
