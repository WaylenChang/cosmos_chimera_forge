# AI Blender 建模
直接操作 Blender，以指定圖片為優先參考；無圖片時依下列外觀設定建立原創模型。保持輪廓、比例、辨識特徵與配色；採符合生物解剖或機械結構的網格、骨架與動作，避免以簡單幾何堆疊冒充完成品。

圖片目錄（未指定時使用文字外觀）：{{source_path}}
外觀：
{{appearance}}
參數檔：{{parameters_path}}
輸出目錄：{{output_path}}/

在 Blender 檢查正側背面與動作變形，修復穿插、破洞、斷裂、法線及材質；重新開啟 .blend 並重新匯入 .glb 確認可用。依參數直接建立 models/、rig/、animations/、previews/ 與 manifest.json，不交壓縮檔。source_pack 如實填寫圖片來源；純文字建模時留空並記錄缺少來源立繪。無操作能力時回報限制，不虛構輸出。
