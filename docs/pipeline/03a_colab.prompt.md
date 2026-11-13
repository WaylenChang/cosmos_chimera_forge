
# Colab GPU：image-to-3D、骨架與動作
使用指定立繪在 Colab GPU 執行可用模型，建立可編輯網格、符合解剖或機械結構的骨架及所需動作。記錄實際模型版本、GPU、設定、執行紀錄與可續跑輸出。後端與 Blender 修復順序依當次環境選定；先確認模型能啟動及適用輸入，無可用 GPU 或模型時回報阻塞，不假稱完成。

來源立繪：{{source_path}}/
source_pack：{{source_pack}}
參數檔：{{parameters_path}}
輸出目錄：{{output_path}}/

執行入口為 notebooks/07_batch_runner.ipynb 與 scripts/anime3d_universal.py。先跑 anime3d_preflight.py；來源可在 01_portraits/ 或 03_completed/portraits/，須核對 manifest.subject_id、明確 source_image 與 reviews/<source_pack>.json 的 ok 狀態。不得替來源偽造核准。開源後端的 GPU/Torch/CUDA 環境互相隔離；來源 mesh 成功後依雜湊續跑。硬 QA 未通過維持 QA_PENDING；自動通過後仍為 REVIEW_REQUIRED。

保持原立繪設計。生物採適合的蒙皮，機械採剛性零件與正確軸心；檢查破洞、斷肢、穿插、法線及材質。必要時在 Blender 修復。依參數直接建立 models/ 下的 .glb 與 .blend、rig/、animations/、previews/ 及 manifest.json，列明未完成項目；不交壓縮檔。不擅用付費 API 代替 Colab GPU 模型。

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

