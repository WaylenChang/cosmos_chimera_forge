# Colab GPU：image-to-3D、骨架與動作
使用指定立繪在 Colab GPU 執行可用模型，建立可編輯網格、符合解剖或機械結構的骨架及所需動作。記錄實際模型版本、GPU、設定、執行紀錄與可續跑輸出。後端與 Blender 修復順序依當次環境選定；先確認模型能啟動及適用輸入，無可用 GPU 或模型時回報阻塞，不假稱完成。

來源立繪：{{source_path}}/
source_pack：{{source_pack}}
參數檔：{{parameters_path}}
輸出目錄：{{output_path}}/

保持原立繪設計。生物採適合的蒙皮，機械採剛性零件與正確軸心；檢查破洞、斷肢、穿插、法線及材質。必要時在 Blender 修復。依參數直接建立 models/ 下的 .glb 與 .blend、rig/、animations/、previews/ 及 manifest.json，列明未完成項目；不交壓縮檔。不擅用付費 API 代替 Colab GPU 模型。
