# Drive 角色／宙獸目錄

```text
cosmos_chimera_forge/
  00_settings/                  # default.parameters.json； <asset_id>.appearance.md、<asset_id>.parameters.json
  01_portraits/<asset_id>/      # concept.json、manifest.json、images/
  02_3d/
    colab/<asset_id>/           # Colab GPU 輸出
    ai_blender/<asset_id>/      # Argon／Codex Blender 輸出
    legacy/<asset_id>/          # 既有待審成果
  03_completed/
    portraits/<asset_id>/
    models/<asset_id>/
  prompts/                     # 六個單步驟 prompt.md、TRIGGERS.md
    jobs/                      # HTML 填入參數後的單步驟 prompt
  reviews/<asset_id>.json       # 審查結果、來源立繪 ID、時間、意見
  backup/
    rejected_portraits/<revision>/<asset_id>/
    rejected_3d/<revision>/<asset_id>/
    legacy_archives/            # 已核對展開的歷史 ZIP
    legacy_prompts/             # 舊的跨步驟長 prompt
    image_backup/              # 歷史立繪備份，不代表已核准
```

3D 資產目錄內用 models/、rig/、animations/、previews/、manifest.json。每個版本使用唯一 asset_id；角色與宙獸共用結構，由 manifest.task_type 區別。立繪包涵蓋多個型態時，各模型 source_pack 皆指向同一立繪資產 ID，stage 指定型態。

格式參數獨立存 JSON；外觀 prompt 不夾帶格式與遊戲數值。審查通過的立繪先不移動；退件整個目錄搬到備份。只有最終人工核可後才能移入完成區；歷史資產不自動視為核可。Prompt 建模缺立繪時，必須補畫、核准並綁定來源才可完成。

Colab 使用 GPU 模型的細節尚待實機選定；本次建立介面、目錄與步驟指令，未聲稱已執行 GPU／建模。Blender 可在中途或後續修復。

## HTML 操作

選角色／宙獸與型態，以隨機設定、圖鑑或 AI 文字決定外觀。上方「格式參數」獨立編輯，先按「儲存外觀 .md ＋ 參數 .json」，再選步驟並按「讀取本步驟 .md／複製執行」。每個資產版本各有設定檔，指令另存 prompts/jobs/，不混用前一步的長 prompt。

立繪生成後重新載入 Drive，在「審查覆核」核准或退件。核准立繪可按「指定 3D Prompt」，再選 Colab 或 AI Blender；Colab 與指定圖片建模均要求來源立繪已核准。AI Blender 純文字建模可取消圖片來源。

模型完成後重新載入 Drive。純文字建模須補立繪、核准，再填入來源立繪資產 ID 並按「綁定目前 3D 的來源立繪」。最終人工核准才會移至完成區，審查意見可儲存至 Drive。完成區與歷史備份不會被當作新的待審輸入。

歷史參考：原 Argon 說明文件在 02_3d/ai_blender/_briefs/；原 3D_out 散裝重複輸出與總覽在 backup/legacy_loose_outputs/。完整封裝保留於歷史備份。正式目錄保留 GLB／Blend、材質、骨架／動作規格及主要審查圖，其他歷史截圖、中間檔與替代格式留在原封裝。
