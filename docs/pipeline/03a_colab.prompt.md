<!-- COSMI-PIPELINE/2:colab -->
# Colab GPU Image-to-3D
{{model_input}}
參數：`{{parameters_path}}`；輸出：`{{output_path}}/`
先確認 Colab GPU 與生成模型可用，產生初始網格後交 Blender 修整、綁骨與匯出；無法執行則說明阻塞。
1. 判定原型（人形、怪物、生物、奇幻生物或超自然物件），搜尋並查閱相關外形、解剖、材質、骨架與運動資料；無法搜尋則註明。
2. 依本次輸入全新設計並建模，不套用或抄襲舊 3D 檔；依生物或機械構造配置蒙皮、關節與動作。
3. 由 Blender 直接儲存 `models/{{asset_id}}.blend`、匯出 `models/{{asset_id}}.glb`，保留拓撲、UV、材質與骨架。
4. 每次修改後檢查正、背、左、右、上、下視角及動作關鍵幀：臉／感知器官不被遮擋，軀幹與肢體完整連接；無破面、孔洞、透視露空、錯誤法線／貼圖、部件互穿、離體或關節錯位及各部位獨立亂移。
5. 重開 `.blend` 並重新匯入 `.glb` 驗證；交付 `models/`、`rig/`、`animations/`、`previews/`、`manifest.json`，記錄未完成項；不交 ZIP。
