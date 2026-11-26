# 生成立繪
依本次外觀及 `{{parameters_path}}` 繪製原創角色／宙獸，保持全身完整、比例與多視角特徵一致；無文字／水印及遮擋，依參數指定圖片規格輸出。
外觀：
{{appearance}}
輸出：`{{output_path}}/`；逐檔建立 `images/`、`concept.json`、`manifest.json`，如實記錄缺件；不交 ZIP。

角色設計 Prompt 與生成規則：
- 成人女性於角色識別與正面圖 Prompt 記載同一個隨機選定的 A–E Cup；未成年角色維持非性化描述。
- 先生成正面圖；三視圖與主立繪的 Prompt 開頭均須寫「參照第一張生成的正面圖」，並實際使用該圖作為參考，維持外觀一致。
- 三視圖嚴格禁止文字、標籤、字母、數字、標誌與浮水印。
- 主立繪描繪符合角色文化、背景與職業的具體場景，使用完整不透明背景。
- 三種圖的 Prompt 標題分別標示 `{{subject_id}}_01_portrait_front.png`、`{{subject_id}}_01_portrait_turnaround.png`、`{{subject_id}}_01_portrait_main.png`；有版本時依命名規範加在圖類型前。
