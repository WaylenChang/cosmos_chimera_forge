<!-- COSMI-PIPELINE/3:blender -->
# Blender {{input_mode_label}}｜{{subject_label}}
{{model_input}}
參數：{{parameters_path}}
輸出：{{output_path}}/
{{rig_plan}}
{{action_plan}}
依本次輸入製作該對象的完整網格、材質、骨架、蒙皮及動作；保留臉部／感知器官、服裝或體表構造的辨識細節。
依 blender-anime-character 技能逐件確認衣物、吊掛飾物及髮束的固定端與自由端，測試世界重力、運動慣性、回擺及穿模，並驗證匯出動畫。
先以代表角色做固定曝光臉部對照及同動作回擺量測，驗證後逐角調整並更新模型目錄。
檢查各視角、關節變形與貼圖，重開 .blend 並重匯入 .glb 驗證。
交付 models/{{asset_id}}.blend、models/{{asset_id}}.glb、rig/、animations/、previews/ 與 manifest.json。
