# 個別 ID 目錄檔案命名契約（PR #25 後續）

此規則僅適用 `characters/<實體 ID 目錄>/`、`creatures/<實體 ID 目錄>/`、`moves/<實體 ID 目錄>/` 之內所有檔案，包含下層 `_步驟/`、`_版本/`。分類共用模板、索引與歷史封存區不應誤判為某一主體的資產。

## 唯一命名格式

- **角色／招式**：`<實體ID目錄名稱>_<檔案功能>[_<管線步驟>_<版本名稱>].<副檔名>`
- **宙獸**：`<實體ID目錄名稱>_<檔案功能>_<i>型態[_<管線步驟>_<版本名稱>].<副檔名>`
- `i` 必須明確且按順序：`1` juvenile（幼年）、`2` adolescent（少年）、`3` adult（成年）、`4` overload（過載）。不能使用英文階段名取代 `i型態`。
- **正式最終成果**：不含管線步驟，也不含非正式版本字尾；但只有已完成所屬管線、取得所需人工核准的成果才可標記正式。
- **所有非正式版本**：同時保留管線步驟與版本名稱，不得只保留其中一項。版本如 `draft`、`v1`、`v2`、`draft_review`。同一路線成果多版不得覆寫或以相同路徑覆蓋其他版本。
- **檔案功能**：每個實體檔至少有一個明確功能 token；相同副檔名如 `front`、`turnaround`、`main` 必須有獨立功能名稱。其他例子：`model`、`blend`、`wiki`、`manifest`、`concept`、`parameters`、`appearance`、`texture_base_color`、`preview_front`、`script_convert_glb_to_blend`、`design`。

## 實際範例

| 用途 | 完整檔名 |
| --- | --- |
| 角色已核准主立繪 | `chr_protagonist_yeh_chengxi_main.png` |
| 角色草稿正面 | `chr_protagonist_yeh_chengxi_front_01_portrait_v2.png` |
| 守衛三視圖 | `chr_warden_temple_light_turnaround.png` |
| 宙獸第一型態已核准模型 | `ch_1st_batch_aqua_slime_model_1型態.glb` |
| 宙獸第三型態 Blender 中間檔 | `ch_1st_batch_aqua_slime_blend_3型態_03b_blender_v2.blend` |
| 宙獸第四型態圖鑑草稿 | `ch_1st_batch_aqua_slime_wiki_4型態_05_wiki_draft.md` |
| 宙獸第二型態正面草稿 | `ch_starter_sun_line_front_2型態_01_portrait_v1.png` |
| 技能 VFX 草稿 | `mv_legacy_earth_pebble_shot_spec_01b_vfx_draft.json` |

## 重要相容性與遷移安全

1. **檔名前綴為實體資料夾名，而非遊戲主體 ID。** `cr_aqua_slime` 仍為遊戲內穩定 ID；物理資料夾 `ch_1st_batch_aqua_slime` 的檔名前綴使用後者。保持 `manifest.subject_id`、遊戲資料、資產二進位內容不變。
2. **舊檔名必須保留讀取相容，但不允許作為新寫入格式。** 掃描器／圖鑑／模型匯入器必須從檔名解析回原穩定主體 ID，不能把實體檔名前綴誤當成新的遊戲 ID。
3. **遷移時保留 Drive file ID、MIME 類型、共享權限及檔案 bytes。** 更名之前先產出含原檔名、新檔名、父資料夾 ID、檔案 ID、版本、核准依據及碰撞狀態的 dry-run 對照。遇到同名衝突、未核准／無法辨識版本、共用跨型態檔、額外帶作品名的 GLB、同一父目錄重複名稱時必須暫停該項，不能猜測、合併或覆寫。
4. **共用四型態的設計 Prompt** 不是任一 `i型態` 檔案。現存 `<實體目錄>.prompt.md` 屬跨型態共用規格，須另訂例外存放區或由負責人拆分四型態後才能讓全目錄達到逐檔嚴格遵循；不能自動將共用內容強行標示為 `1型態`。
5. **管線結束與正式核准不等價。** 未確認是否正式的現有 `.glb`、`.md` 一律不得僅因位於目錄根層就移除步驟／版本標記。
6. **先更新與測試所有讀寫端，再批次更名**，包括 `drive-storage.js`、`wiki.js`、`pipeline.js`、`tasks.js`、圖片／模型審查與 UI 引用。PR #25 維持 Draft 直到 Drive 唯讀稽核、無碰撞實體更名、回讀驗證與 E2E 回歸通過。
