# Anime3D Colab Agent — MVP

依 `docs/AI_Agent_Colab_Anime3D_Pipeline.md` 建立第一版執行管線。

目前提供：
- Colab 入口、已核准立繪與授權狀態檢查
- Tripo v3 檔案上傳 → P2 Image-to-Model → Rig Check → Rig v3 → 動畫 Retarget
- Task ID 落盤續跑、不重送已有 Task ID 的付費請求
- Blender headless 基礎幾何 QA、GLB / Blend / Toon Profile / manifest
- 非支援的奇幻生物、機械與未知預設動作直接標記 REVIEW_REQUIRED
- 成果僅輸出到 `02_3d/colab/<asset_id>/`，不移動 `03_completed`

使用方式：

```bash
python scripts/anime3d_agent.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-example --spec /content/drive/MyDrive/project/cosmos_chimera_forge/00_settings/mdl-example.asset_spec.json
# 明確同意使用第三方付費 API 時才追加 --execute
python scripts/anime3d_agent.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-example --spec /content/drive/MyDrive/project/cosmos_chimera_forge/00_settings/mdl-example.asset_spec.json --execute
```

`asset_spec.json` 範例：

```json
{
  "source_pack": "chr-approved-source",
  "asset_class": "humanoid",
  "anatomy": "biped",
  "license_status": "internal_only",
  "requested_clips": ["idle", "walk", "run"],
  "poly_budget_triangles": 30000,
  "target_engine": "unity",
  "task_type": "model-rig",
  "subject_id": "chr_example"
}
```

`TRIPO_API_KEY` 只從 Colab Secrets 注入環境變數，不寫入 repo。圖像需在 `01_portraits/<source_pack>/`，且 `reviews/<source_pack>.json` 為 `{"status":"ok"}`。

**限制：** 尚未在真實 Colab、Blender 或付費 Tripo API 進行端到端實測；模型品質、UV、變形、動作與引擎 Toon Shader 仍須覆核。