# Pixal3D mesh → SkinTokens rig → Blender

`anime3d_universal.py --rig-backend skintokens` 在來源網格成功後執行真正的學習式骨架與蒙皮推論。這個 adapter 不生成替代網格、不使用 envelope guide。葉澄汐已完成下方記錄的真實 GPU 執行；其他角色與骨架仍需各自驗證。

## 環境

依 [SkinTokens 官方安裝](https://github.com/VAST-AI-Research/SkinTokens) 建立獨立 Python 3.11／Torch／CUDA 環境，安裝 requirements、flash-attn，執行 `python download.py --model`。官方列出至少 14 GB NVIDIA GPU；實際仍需符合 flash-attn 與 CUDA 的 GPU 架構要求。

Pixal3D 依其[官方安裝](https://github.com/TencentARC/Pixal3D) 準備 TRELLIS.2 基底與額外依賴，與 SkinTokens 分開安裝。不能用存在一個 GPU、config 或 checkpoint 推定相容性與推論已通過。

在 `docs/anime3d_backends.example.json` 複製實際路徑到自己的 backend config。`skintokens` 需要 `repo`、`python`、`checkpoint`；checkpoint 相對路徑以 SkinTokens repo 為基準。

```bash
python scripts/anime3d_preflight.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-yeh-chengxi-colab-20261113 --spec docs/examples/yeh_chengxi.asset_spec.json --backend pixal3d --rig-backend skintokens --backend-config /content/backends.json --blender /usr/bin/blender
python scripts/anime3d_universal.py --root /content/drive/MyDrive/project/cosmos_chimera_forge --asset-id mdl-yeh-chengxi-colab-20261113 --spec docs/examples/yeh_chengxi.asset_spec.json --backend pixal3d --rig-backend skintokens --backend-config /content/backends.json --blender /usr/bin/blender --execute
```

## 實際執行與失敗

- 官方 `demo.py --input <source> --output <staging> --model_ckpt <checkpoint> --use_transfer` 保留原網格的材質與比例。此旗標是上游功能，仍須視覺確認轉移品質。
- `source/<asset_id>.glb` 保留生成網格；`rig/<asset_id>.glb` 保存 SkinTokens 結果；完整 stdout/stderr 在 `rig/skintokens.log`。
- 輸出需為新產出的 GLB，且 mesh node 指向非空 joints、具有 JOINTS_0／WEIGHTS_0；零退出碼但無檔案或僅網格都拒收。這是結構驗證，實際有效權重仍交 Blender 檢查。
- geometry 與 rig 各自保存 SHA256；綁骨失敗重跑時重用成功的 geometry。成功 rig 被改寫或遺失則拒絕重跑覆蓋，要求使用新 asset ID。
- timeout 或中斷先給上游 Python 清理 bpy 子服務的機會；逾時仍不結束時才強制停止。須在 runtime 核對沒有遺留服務再續跑。
- 綁骨失敗維持 QA_PENDING，不會替立繪或模型建立核准。

SkinTokens 骨名可能不是既有 `Leg_*`／`Spine` 動作模板。此 adapter **沒有宣稱任意骨架的動作映射已完成**；需實際生成後檢查骨架，再建立正確的人形映射、動作及 pose sweep。Toon、減面、穿插、臉部與馬尾等品質仍須完成驗收。

## 葉澄汐目前狀態（2026-11-13）

使用者已在對話檢視指定正面圖並核准；正式紀錄已上傳至專案 `reviews/chr-20261106-1286-2039.json`，Drive file ID 為 `1Pw7pmOBOYaVq3QBT8_4c0sa149P4w_vs`。前次查核文件所記錄的「尚未核准」是歷史狀態。

使用者已允許 notebook 掛載 Drive。實際 Colab NVIDIA L4（23034 MiB、compute capability 8.9）已完成 Pixal3D 推論與 SkinTokens `demo.py --use_transfer` 綁骨，再由 Blender 匯出驗證。模型使用 Python 3.11.17／Torch 2.7.0+cu128／CUDA toolkit 12.8.93 的隔離環境，與 Colab 原生 Python 3.13 分開。

實際產物有 29,540 三角面、2048 貼圖與 52 根骨骼，無未加權頂點。`rig/motion_bone_map.json` 綁定該次 rig SHA256，記錄實際檢視後的骨名與正面方向；typed Blender 以骨架矩陣換算旋轉軸，完成三段原地程序動作及 GLB 匯出重載。四視角採貼圖預覽，另附走跑側向影片與互動檢視器。

[驗收成果](https://drive.google.com/drive/folders/1k8wNfhPIffvC-OwXEs0jSGy_N4D30Cl9) 的 `automated_pass=true`、`passed=false`、`qa_status=REVIEW_REQUIRED`。這是可驗收初版；造型、背包／腰珠細節、足部接觸、穿模與引擎端 Toon shader 尚未人工核准。
