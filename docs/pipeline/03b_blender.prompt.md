<!-- COSMI-PIPELINE/3:blender -->
# Blender {{input_mode_label}}｜{{subject_label}}
{{model_input}}
參數：{{parameters_path}}
輸出：{{output_path}}/
{{rig_plan}}
{{action_plan}}
依本次輸入製作該對象的完整網格、材質、骨架、蒙皮及動作；保留臉部／感知器官、服裝或體表構造的辨識細節。
檢查各視角、關節變形與貼圖，重開 .blend 並重匯入 .glb 驗證。
交付 models/{{asset_id}}.blend、models/{{asset_id}}.glb、rig/、animations/、previews/ 與 manifest.json；未完成項如實記錄。
manifest.encyclopedia_path：{{wiki_path}}
