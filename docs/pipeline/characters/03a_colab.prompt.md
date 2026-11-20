<!-- COSMI-PIPELINE/3:colab -->
# 角色 Colab Image-to-3D｜{{subject_label}}

{{model_input}}
參數：{{parameters_path}}
產物：{{output_path}}/
{{rig_plan}}
{{action_plan}}

## 來源與執行邊界
- 只讀取本角色 Google Drive `source_pack` 下**已人工核准**的主立繪／基準正面、三視（可為合圖）與獨立 45° 參考圖；正面圖須綁定 `source_image`。校對臉、髮型、服裝、配件與尺度；同一角色不同版本不得混用。
- 以 Drive 上的個別 `asset_spec.json` 填寫 `character_colab_workflow: "character-colab/2"`、`reference_views`、模型後端及角色辨識特徵。這些個別檔案僅存 Drive；GitHub 的本模板為唯一維護正本，Drive 同名模板僅為唯讀發布鏡像。
- 不可從三視圖合圖臆造相機外參。Pixal3D 的 `multiview_dir` 需實際校準的 `transforms.json`；沒有時先使用可用的已核准正面圖，其他角度供品質驗收與後續補圖。

## 視圖前處理（CPU，於首次 GPU 前執行）
- 正式 Image-to-3D 輸入必須包含獨立正面圖及三視圖中的側、背影像。若三視是拼接合圖，先依確認過的區塊座標／順序裁切，不能直接把整張合圖當成單一視角輸入；獨立 45° 圖用於外觀 QA。
- 使用 `scripts/anime3d_view_preprocess.py` 產生 `_03a_colab/<asset_id>/inputs/front.png`、`side.png`、`back.png` 及 `qa/view_preprocess.json`。檢查視角標記、左右方向、去背遮罩、頭腳手髮配件完整性、構圖和一致性，維持原圖不可變及來源／結果 SHA-256。固定色去背須人工查看可能的誤刪或邊緣瑕疵。
- 此 CPU 工具僅負責裁切、基本去背與縮放，不自動證明圖像審核通過、相機已校準或模型已使用全部影像。若多視角後端尚未整合，維持 BLOCKED，不以單張正面圖推論替代。
- 詳細規範、設定範例與異常條件見 [CHARACTER_COLAB_VIEW_PREPROCESS.md](../CHARACTER_COLAB_VIEW_PREPROCESS.md)。

## 分段執行及品質閘門
1. **Preflight（CPU）**：核對 Drive 授權／審查 `status=ok`、來源檔與 SHA-256、正面＋三視＋45°、授權、GPU/VRAM、後端與模型權重。無法驗證即中止，不代建核准紀錄。
2. **首次 GPU 推論**：使用已安裝後端（例如 Pixal3D）生成 `source/<asset_id>.glb`；不可憑空宣稱 TRELLIS.2／Hunyuan3D 已整合。保留來源 GLB 與狀態、後端設定和輸入雜湊。
3. **獨立外觀評估（先於綁骨）**：從正背側及 45° 比對輪廓、臉部、服裝、細節、材質（各 0–1）；由真正執行的人工或外部視覺評估器寫 `qa/appearance_review.json`，帶模型 SHA-256、參考圖集合 SHA-256、評估方法和身份。未評估**不等於**及格。
4. **決策式修復**：缺角度／遮擋才提案使用 MV-Adapter 補指定角度，先確認新圖與原角色一致性且有相機參數；幾何缺陷優先 Blender 定位修補；單純貼圖問題優先 Texture Refinement（UV、接縫、色彩與紋理）；身份、臉部／服裝錯誤則有針對性修改 Prompt、遮罩／參考圖或比較另一模型。**不能只換 seed 無限重跑**。首次＋最多兩次重建、MV-Adapter 最多一次；超限提交人工選模。
5. **二次閘門**：修復結果需使用**新 asset_id** 保存新模型、參考圖與評估報告，再跑同樣門檻；所有問題需保留缺陷類型、分數與修正證據。只有獨立審核達門檻時才能繼續 rigging。
6. **後段處理（CPU／Blender）**：SkinTokens（僅支援型態且已安裝才用）、骨架與蒙皮檢查、Blender 拓撲／UV／材質、動作關鍵幀及重新匯出。確認 `.blend`、`.glb`、`rig/`、`animations/`、`previews/`、`qa/`、`manifest.json` 真實存在。
7. **人工驗收與回寫**：從各視角及動作逐一核對臉、服裝、配件、材質與穿插。僅人工可核准並歸檔；未完成者標記 `REVIEW_REQUIRED` 或 `QA_PENDING`，不自動移至 completed。

GPU 任務可拆 pre_gpu／gpu／post_gpu。GPU 結束後依 Colab guard 關閉 GPU runtime；流程、模板維護及程式版本只回 GitHub，個別產物與日誌只回 Drive，不交 ZIP。
